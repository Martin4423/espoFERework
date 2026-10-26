import { useEffect, useState } from "react";
import { networkError, problemFromResponse } from "../problem.ts";

// Calls to the public endpoints: no session, no Authorization header, never a refresh attempt.
export async function publicJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try { response = await window.fetch(path, { ...init, headers }); } catch (cause) { throw networkError(cause); }
  if (!response.ok) throw await problemFromResponse(response);
  if (response.status === 204) return null as T;
  try { return (await response.json()) as T; } catch (cause) { throw networkError(cause); }
}

export type Branding = { appName: string; theme: "light" | "dark" | "auto"; logoUrl: string | null };
export type LoginOptions = { passwordLogin: boolean; oidc: { enabled: boolean }; passwordRecovery: { enabled: boolean; minLength: number; maxLength: number } };

const DEFAULT_BRANDING: Branding = { appName: "ViaCRM", theme: "light", logoUrl: null };
const DEFAULT_OPTIONS: LoginOptions = { passwordLogin: true, oidc: { enabled: false }, passwordRecovery: { enabled: false, minLength: 12, maxLength: 128 } };

// The branding of the installation; the defaults show until it arrives (or when it cannot be read).
export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  useEffect(() => {
    let live = true;
    publicJson<Branding>("/v1/public/branding").then((value) => { if (live) { setBranding(value); document.title = value.appName; } }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return branding;
}

export function useLoginOptions(): LoginOptions {
  const [options, setOptions] = useState<LoginOptions>(DEFAULT_OPTIONS);
  useEffect(() => {
    let live = true;
    publicJson<LoginOptions>("/v1/public/login-options").then((value) => { if (live) setOptions(value); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return options;
}

// The public page the address asks for, or null for the application itself.
export type PublicRoute = { page: "reset-password"; token: string } | { page: "lead-confirm"; token: string } | { page: "lead-form"; id: string };
export function publicRoute(location: Pick<Location, "pathname" | "search"> = window.location): PublicRoute | null {
  const path = location.pathname.replace(/\/+$/, "");
  const token = new URLSearchParams(location.search).get("token") ?? "";
  if (path === "/reset-password") return { page: "reset-password", token };
  if (path === "/lead-confirm") return { page: "lead-confirm", token };
  const form = /^\/forms\/([^/]+)$/.exec(path);
  return form ? { page: "lead-form", id: decodeURIComponent(form[1]) } : null;
}
