import { beforeEach, describe, expect, it } from "vitest";
import { AuthClient } from "./client.ts";
import type { LockManagerLike, StorageLike } from "./client.ts";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

// A tiny fake of the ViaCRM identity endpoints. Refresh tokens rotate; a reused one revokes the session, like the real thing.
class FakeServer {
  calls: string[] = [];
  validAccess = new Set<string>();
  validRefresh = new Set<string>();
  usedRefresh = new Set<string>();
  revoked = false;
  counter = 0;
  failLogin: { status: number; body: unknown; headers?: Record<string, string> } | null = null;
  refreshStatusOverride: number | null = null;

  json(status: number, body: unknown, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json", ...headers } });
  }

  issue() {
    this.counter++;
    const accessToken = `access-${this.counter}`;
    const refreshToken = `refresh-${this.counter}`;
    this.validAccess.add(accessToken);
    this.validRefresh.add(refreshToken);
    return { accessToken, tokenType: "Bearer", expiresIn: 900, refreshToken, refreshExpiresIn: 1209600 };
  }

  fetch = async (path: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = String(path);
    this.calls.push(`${init.method ?? "GET"} ${url}`);
    const bearer = new Headers(init.headers).get("Authorization")?.replace("Bearer ", "");
    if (url === "/v1/auth/login") {
      if (this.failLogin) return this.json(this.failLogin.status, this.failLogin.body, this.failLogin.headers);
      return this.json(200, this.issue());
    }
    if (url === "/v1/auth/refresh") {
      if (this.refreshStatusOverride) return this.json(this.refreshStatusOverride, { code: "INTERNAL", status: this.refreshStatusOverride });
      const token = JSON.parse(String(init.body)).refreshToken as string;
      if (this.usedRefresh.has(token)) { this.revoked = true; return this.json(401, { code: "INVALID_REFRESH_TOKEN", status: 401 }); }
      if (!this.validRefresh.has(token) || this.revoked) return this.json(401, { code: "INVALID_REFRESH_TOKEN", status: 401 });
      this.usedRefresh.add(token);
      return this.json(200, this.issue());
    }
    if (url === "/v1/auth/logout") return new Response(null, { status: 204 });
    if (!bearer || !this.validAccess.has(bearer) || this.revoked) return this.json(401, { code: "UNAUTHENTICATED", status: 401 });
    if (url === "/v1/me") return this.json(200, { id: "u1", email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", type: "admin", isActive: true, createdAt: "2026-01-15T12:00:00Z" });
    if (url === "/v1/ping") return this.json(200, { ok: true });
    return this.json(404, { code: "NOT_FOUND", status: 404 });
  };
}

// Web Locks stand-in: one holder at a time, FIFO.
class FakeLocks implements LockManagerLike {
  private tail: Promise<unknown> = Promise.resolve();
  request<T>(_name: string, callback: () => Promise<T>): Promise<T> {
    const run = this.tail.then(callback, callback);
    this.tail = run.catch(() => undefined);
    return run;
  }
}

describe("AuthClient", () => {
  let server: FakeServer;
  let storage: MemoryStorage;
  let time: number;
  let expired: number;
  let locks: FakeLocks;

  const client = () => new AuthClient({ fetch: ((path: string, init?: RequestInit) => server.fetch(path, init)) as typeof fetch, storage, now: () => time, locks, onExpired: () => { expired++; } });

  beforeEach(() => { server = new FakeServer(); storage = new MemoryStorage(); time = 1_000_000; expired = 0; locks = new FakeLocks(); });

  it("logs in, loads the user and stores the tokens", async () => {
    const session = await client().login("  ada@example.com ", "secret");
    expect(session.user).toMatchObject({ email: "ada@example.com", name: "Ada Lovelace", userName: "ada@example.com", type: "admin" });
    expect(session.accessExpiresAt).toBe(time + 900_000);
    expect(client().getSession()?.refreshToken).toBe("refresh-1");
  });

  it("explains a wrong password and does not store anything", async () => {
    server.failLogin = { status: 401, body: { code: "INVALID_CREDENTIALS", status: 401 } };
    await expect(client().login("a@b.cz", "x")).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    expect(client().getSession()).toBeNull();
  });

  it("turns a lockout into minutes from Retry-After", async () => {
    server.failLogin = { status: 429, body: { code: "TOO_MANY_ATTEMPTS", status: 429 }, headers: { "Retry-After": "420" } };
    const error = await client().login("a@b.cz", "x").catch((e) => e);
    expect(error).toMatchObject({ status: 429, code: "TOO_MANY_ATTEMPTS", retryAfter: 420 });
    expect(error.message).toContain("7");
  });

  it("reports an unreachable server as a network problem", async () => {
    const offline = new AuthClient({ fetch: (() => Promise.reject(new TypeError("fetch failed"))) as typeof fetch, storage, now: () => time });
    await expect(offline.login("a@b.cz", "x")).rejects.toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("sends the Bearer token without refreshing while it is valid", async () => {
    const c = client();
    await c.login("ada@example.com", "x");
    server.calls.length = 0;
    expect((await c.authorizedFetch("/v1/ping")).status).toBe(200);
    expect(server.calls).toEqual(["GET /v1/ping"]);
  });

  it("refreshes before the access token ends (30 s margin) and keeps the user", async () => {
    const c = client();
    await c.login("ada@example.com", "x");
    time += 900_000 - 29_000;
    server.calls.length = 0;
    const response = await c.authorizedFetch("/v1/ping");
    expect(response.status).toBe(200);
    expect(server.calls).toEqual(["POST /v1/auth/refresh", "GET /v1/ping"]);
    const session = c.getSession()!;
    expect(session.accessToken).toBe("access-2");
    expect(session.refreshToken).toBe("refresh-2");
    expect(session.user.name).toBe("Ada Lovelace");
  });

  it("runs ONE refresh for many parallel requests", async () => {
    const c = client();
    await c.login("ada@example.com", "x");
    time += 900_000;
    server.calls.length = 0;
    const responses = await Promise.all(Array.from({ length: 8 }, () => c.authorizedFetch("/v1/ping")));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(server.calls.filter((call) => call.includes("/auth/refresh"))).toHaveLength(1);
    expect(server.revoked).toBe(false);
  });

  it("two tabs sharing the storage never reuse a rotated refresh token", async () => {
    const tabA = client();
    const tabB = client();
    await tabA.login("ada@example.com", "x");
    time += 900_000;
    server.calls.length = 0;
    const responses = await Promise.all([tabA.authorizedFetch("/v1/ping"), tabB.authorizedFetch("/v1/ping")]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(server.calls.filter((call) => call.includes("/auth/refresh"))).toHaveLength(1);
    expect(server.revoked).toBe(false);
    expect(expired).toBe(0);
  });

  it("on a 401 refreshes once and retries the request", async () => {
    const c = client();
    await c.login("ada@example.com", "x");
    server.validAccess.clear();          // the server dropped the token (e.g. restart of its cache)
    server.calls.length = 0;
    const response = await c.authorizedFetch("/v1/ping");
    expect(response.status).toBe(200);
    expect(server.calls).toEqual(["GET /v1/ping", "POST /v1/auth/refresh", "GET /v1/ping"]);
  });

  it("ends the session when the refresh token is refused", async () => {
    const c = client();
    await c.login("ada@example.com", "x");
    time += 900_000;
    server.revoked = true;
    await expect(c.authorizedFetch("/v1/ping")).rejects.toMatchObject({ status: 401 });
    expect(c.getSession()).toBeNull();
    expect(expired).toBe(1);
  });

  it("keeps the session when the refresh fails for a transient reason", async () => {
    const c = client();
    await c.login("ada@example.com", "x");
    time += 900_000;
    server.refreshStatusOverride = 503;
    await expect(c.authorizedFetch("/v1/ping")).rejects.toMatchObject({ status: 503 });
    expect(c.getSession()).not.toBeNull();
    expect(expired).toBe(0);
  });

  it("a request that is still 401 after the retry ends the session", async () => {
    const c = client();
    await c.login("ada@example.com", "x");
    server.revoked = false;
    const original = server.fetch;
    server.fetch = async (path, init) => (String(path) === "/v1/ping" ? server.json(401, { code: "UNAUTHENTICATED", status: 401 }) : original(path, init));
    const response = await c.authorizedFetch("/v1/ping");
    expect(response.status).toBe(401);
    expect(c.getSession()).toBeNull();
    expect(expired).toBe(1);
  });

  it("without a session every request is refused locally", async () => {
    await expect(client().authorizedFetch("/v1/ping")).rejects.toMatchObject({ status: 401 });
    expect(server.calls).toEqual([]);
  });

  it("logout tells the server, forgets the session and tolerates an offline server", async () => {
    const c = client();
    await c.login("ada@example.com", "x");
    server.calls.length = 0;
    await c.logout();
    expect(server.calls).toEqual(["POST /v1/auth/logout"]);
    expect(c.getSession()).toBeNull();

    await server.fetch("/v1/auth/login", { method: "POST" });
    const offline = new AuthClient({ fetch: (() => Promise.reject(new TypeError("down"))) as typeof fetch, storage, now: () => time });
    storage.setItem("via-session", JSON.stringify({ accessToken: "a", refreshToken: "r", user: { id: "1" } }));
    await expect(offline.logout()).resolves.toBeUndefined();
    expect(storage.getItem("via-session")).toBeNull();
  });

  it("ignores a corrupted stored session", () => {
    storage.setItem("via-session", "{not json");
    expect(client().getSession()).toBeNull();
    storage.setItem("via-session", JSON.stringify({ accessToken: 1 }));
    expect(client().getSession()).toBeNull();
  });
});
