import { AuthClient } from "./auth/client.ts";
import { networkError, problemFromResponse } from "./problem.ts";

// One client per page. The ViaCRM API has no CORS: every call goes to /v1 on this origin (Vite or nginx proxy).
export const auth = new AuthClient({
  fetch: (path, init) => window.fetch(path, init),
  storage: (() => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; } })(),
  now: () => Date.now(),
  locks: typeof navigator !== "undefined" && "locks" in navigator ? { request: (name, callback) => navigator.locks.request(name, callback) as Promise<any> } : undefined,
  onExpired: () => window.dispatchEvent(new Event("via-session-expired")),
});

// JSON call to the ViaCRM API (path starts with /v1). 204 gives null; a failure is an ApiError built from problem+json.
export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await auth.authorizedFetch(path, { ...init, headers });
  if (!response.ok) throw await problemFromResponse(response);
  if (response.status === 204) return null as T;
  try { return (await response.json()) as T; } catch (cause) { throw networkError(cause); }
}

