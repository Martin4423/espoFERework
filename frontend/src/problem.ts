import { t } from "./i18n/index.ts";
import type { MessageKey } from "./i18n/index.ts";

// RFC 9457 problem+json as the ViaCRM backend sends it (docs/contract m0/m1: always `code`, optional `errors[]`).
export type FieldProblem = { field: string; code: string; message?: string };

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly statusReason?: { reason?: string; data?: any };
  readonly code?: string;
  readonly errors: FieldProblem[];
  readonly retryAfter?: number;
  constructor(message: string, status: number, data: unknown, statusReason?: { reason?: string; data?: any }, extra: { code?: string; errors?: FieldProblem[]; retryAfter?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.statusReason = statusReason;
    this.code = extra.code;
    this.errors = extra.errors ?? [];
    this.retryAfter = extra.retryAfter;
  }
}

// A feature the ViaCRM backend does not offer yet. Thrown by the legacy Espo call paths until each one is migrated.
export class UnsupportedError extends ApiError {
  constructor(what = "") {
    super(t("unsupported.title"), 501, { unsupported: what }, undefined, { code: "UNSUPPORTED" });
    this.name = "UnsupportedError";
  }
}

export function isUnsupported(error: unknown): error is UnsupportedError {
  return error instanceof UnsupportedError;
}

const KNOWN: ReadonlySet<string> = new Set([
  "INVALID_CREDENTIALS", "TOO_MANY_ATTEMPTS", "UNAUTHENTICATED", "INVALID_REFRESH_TOKEN", "FORBIDDEN", "NOT_FOUND",
  "VALIDATION_FAILED", "CONFLICT", "PRECONDITION_FAILED", "PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE",
]);

// The user-facing text of a failed response: the code decides, the server's English title is never shown.
export function problemMessage(status: number, code: string | undefined, retryAfter?: number): string {
  if (code === "TOO_MANY_ATTEMPTS") {
    return retryAfter && retryAfter > 0
      ? t("error.TOO_MANY_ATTEMPTS", { minutes: Math.max(1, Math.ceil(retryAfter / 60)) })
      : t("error.TOO_MANY_ATTEMPTS.soon");
  }
  if (code && KNOWN.has(code)) return t(`error.${code}` as MessageKey);
  if (status >= 500) return t("error.INTERNAL");
  return t("error.generic", { status });
}

export async function problemFromResponse(response: Response): Promise<ApiError> {
  let body: any = null;
  try { const text = await response.text(); body = text ? JSON.parse(text) : null; } catch { body = null; }
  const code = typeof body?.code === "string" ? body.code : undefined;
  const header = Number(response.headers.get("Retry-After"));
  const retryAfter = Number.isFinite(header) && header > 0 ? header : undefined;
  const errors: FieldProblem[] = Array.isArray(body?.errors)
    ? body.errors.filter((e: any) => e && typeof e.field === "string" && typeof e.code === "string").map((e: any) => ({ field: e.field, code: e.code, message: typeof e.message === "string" ? e.message : undefined }))
    : [];
  return new ApiError(problemMessage(response.status, code, retryAfter), response.status, body, undefined, { code, errors, retryAfter });
}

export function networkError(cause?: unknown): ApiError {
  return new ApiError(t("error.network"), 0, { cause: String(cause ?? "") }, undefined, { code: "NETWORK" });
}

const FIELD_CODES: ReadonlySet<string> = new Set(["REQUIRED", "INVALID_VALUE", "INVALID_TYPE", "TOO_LONG", "UNKNOWN_ID", "DUPLICATE_OPTION", "FIELD_NOT_WRITABLE", "UNKNOWN_FIELD"]);

// "Last name is required; Email has an invalid value": one sentence per refused field, for the banner of a form.
export function fieldErrorsText(error: ApiError, label: (field: string) => string): string {
  const parts = error.errors.map((problem) => {
    const what = FIELD_CODES.has(problem.code) ? t(`fieldError.${problem.code}` as MessageKey) : t("fieldError.other", { code: problem.code });
    return `${label(problem.field)} ${what}`;
  });
  return [...new Set(parts)].join("; ");
}
