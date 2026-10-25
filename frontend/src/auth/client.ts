import { ApiError, networkError, problemFromResponse } from "../problem.ts";

// ViaCRM identity (docs/contract m1): Bearer access token (15 min) + rotating refresh token (14 days).
export type MeResponse = { id: string; email: string; firstName?: string; lastName: string; type: "regular" | "admin" | string; isActive: boolean; createdAt: string };

// `name` and `userName` are kept for the screens that were written for the previous backend.
export type User = MeResponse & { name: string; userName: string; portalId?: string; auth2FA?: boolean };

export type Session = { username: string; token: string; user: User; accessToken: string; refreshToken: string; accessExpiresAt: number; refreshExpiresAt: number };

type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number };

export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
export type LockManagerLike = { request<T>(name: string, callback: () => Promise<T>): Promise<T> };

export type AuthDeps = {
  fetch: typeof fetch;
  storage: StorageLike;
  now: () => number;
  locks?: LockManagerLike;
  onExpired?: () => void;
  storageKey?: string;
  // Refresh this long before the access token ends, so a request never leaves with a token about to expire.
  refreshMarginMs?: number;
};

const DEFAULT_KEY = "via-session";
const LOCK_NAME = "via-auth-refresh";

export function toUser(me: MeResponse): User {
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ").trim() || me.email;
  return { ...me, name, userName: me.email };
}

export class AuthClient {
  private readonly deps: AuthDeps;
  private readonly key: string;
  private readonly margin: number;
  private inflightRefresh: Promise<void> | null = null;

  constructor(deps: AuthDeps) {
    this.deps = deps;
    this.key = deps.storageKey ?? DEFAULT_KEY;
    this.margin = deps.refreshMarginMs ?? 30_000;
  }

  // Always read from storage: another tab may have refreshed the tokens (the refresh token rotates).
  getSession(): Session | null {
    try {
      const raw = this.deps.storage.getItem(this.key);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (typeof value?.accessToken !== "string" || typeof value?.refreshToken !== "string" || !value.user) return null;
      return value as Session;
    } catch { return null; }
  }

  private save(session: Session) { this.deps.storage.setItem(this.key, JSON.stringify(session)); }

  private clear() { this.deps.storage.removeItem(this.key); }

  private expire() { this.clear(); this.deps.onExpired?.(); }

  private fromTokens(tokens: TokenResponse, user: User): Session {
    const now = this.deps.now();
    return {
      username: user.email, token: tokens.accessToken, user,
      accessToken: tokens.accessToken, refreshToken: tokens.refreshToken,
      accessExpiresAt: now + tokens.expiresIn * 1000, refreshExpiresAt: now + tokens.refreshExpiresIn * 1000,
    };
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    try { return await this.deps.fetch(path, init); } catch (cause) { throw networkError(cause); }
  }

  async login(email: string, password: string): Promise<Session> {
    const response = await this.send("/v1/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }),
    });
    if (!response.ok) throw await problemFromResponse(response);
    const tokens = (await response.json()) as TokenResponse;
    const me = await this.send("/v1/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    if (!me.ok) throw await problemFromResponse(me);
    const session = this.fromTokens(tokens, toUser((await me.json()) as MeResponse));
    this.save(session);
    return session;
  }

  // Replaces the stored user (e.g. after /v1/me) without touching the tokens.
  updateUser(user: User): Session | null {
    const session = this.getSession();
    if (!session) return null;
    const next = { ...session, user, username: user.email };
    this.save(next);
    return next;
  }

  // Ends the session on the server (best effort, never refreshes) and forgets it locally.
  async logout(): Promise<void> {
    const session = this.getSession();
    this.clear();
    if (!session) return;
    try {
      await this.deps.fetch("/v1/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` } });
    } catch { /* the server will drop the session when its refresh token expires */ }
  }

  // The refresh token rotates and a reused one revokes the whole session, so only one refresh may run at a time:
  // one per client (single flight) and one per browser (Web Locks; the winner's tokens are re-read from storage).
  // `rejected` is the access token the server just refused: refresh unless it was already replaced.
  private refresh(rejected?: string): Promise<void> {
    this.inflightRefresh ??= this.refreshOnce(rejected).finally(() => { this.inflightRefresh = null; });
    return this.inflightRefresh;
  }

  private async refreshOnce(rejected?: string): Promise<void> {
    const run = async () => {
      const session = this.getSession();
      if (!session) throw new ApiError("", 401, null, undefined, { code: "UNAUTHENTICATED" });
      const alreadyFresh = rejected !== undefined
        ? session.accessToken !== rejected                                   // replaced by another tab meanwhile
        : session.accessExpiresAt - this.margin > this.deps.now();           // still valid: refreshed by another tab
      if (alreadyFresh) return;
      const response = await this.send("/v1/auth/refresh", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (response.status === 401 || response.status === 400) {
        this.expire();
        throw await problemFromResponse(response);
      }
      if (!response.ok) throw await problemFromResponse(response);   // transient: keep the session
      this.save(this.fromTokens((await response.json()) as TokenResponse, session.user));
    };
    await (this.deps.locks ? this.deps.locks.request(LOCK_NAME, run) : run());
  }

  private async validAccessToken(): Promise<string> {
    let session = this.getSession();
    if (!session) throw new ApiError("", 401, null, undefined, { code: "UNAUTHENTICATED" });
    if (session.accessExpiresAt - this.margin <= this.deps.now()) {
      await this.refresh();
      session = this.getSession();
      if (!session) throw new ApiError("", 401, null, undefined, { code: "UNAUTHENTICATED" });
    }
    return session.accessToken;
  }

  // fetch with the Bearer token; on 401 one refresh and one retry, then the session is over.
  async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const attempt = async (token: string) => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return this.send(path, { ...init, headers });
    };
    const used = await this.validAccessToken();
    const first = await attempt(used);
    if (first.status !== 401) return first;
    try {
      await this.refresh(used);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) throw error;
      return first;
    }
    const session = this.getSession();
    if (!session) throw new ApiError("", 401, null, undefined, { code: "UNAUTHENTICATED" });
    const second = await attempt(session.accessToken);
    if (second.status === 401) { this.expire(); }
    return second;
  }
}
