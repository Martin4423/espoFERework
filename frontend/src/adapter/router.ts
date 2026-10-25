import { apiJson } from "../http.ts";
import { ApiError, UnsupportedError } from "../problem.ts";
import { forgetPagers, pagerFor } from "./pager.ts";
import { forgetVersion, seenVersion, toScreenRecord, toScreenRecords, toViaBody } from "./records.ts";
import { expandableLinks, schemaOf } from "./schema.ts";
import { keyOf, screenField } from "./names.ts";
import { toFilter } from "./where.ts";
import type { WhereItem } from "./where.ts";

// The screens still call the old REST shape: `Account?maxSize=20&offset=40&where=[...]`, `Account/{id}`, `PUT Account/{id}`.
// This router answers those calls from ViaCRM `/v1/records/...` and returns records in the shape the screens know.
// Anything it does not recognise is a feature that is not connected yet (UnsupportedError).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORTABLE = new Set(["string", "text", "integer", "decimal", "boolean", "date", "dateTime", "enum", "email", "phone", "url"]);
const MAX_PAGE = 200;

type Row = Record<string, any>;

function parseJson(text: string | null): any {
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

// Espo sends the same list of where items as `where`, `whereGroup` or as bracketed query keys.
function whereItems(params: URLSearchParams): WhereItem[] {
  const items: WhereItem[] = [];
  for (const name of ["where", "whereGroup"]) {
    const parsed = parseJson(params.get(name));
    if (Array.isArray(parsed)) items.push(...parsed);
  }
  if ([...params.keys()].some((key) => key.startsWith("where["))) throw new UnsupportedError("where[]");
  return items;
}

// The key a screen sorts by -> ViaCRM sort text (or null: keep the default order).
export function sortFor(entityKey: string, orderBy: string | null, order: string | null): string | null {
  if (!orderBy) return null;
  const entity = schemaOf(entityKey);
  if (!entity) return null;
  const direction = order?.toLowerCase() === "desc" ? "-" : "";
  const has = (key: string) => entity.fields.some((field) => field.key === key);
  const key = orderBy === "modifiedAt" ? "updatedAt" : orderBy;
  if (key === "createdAt" || key === "updatedAt" || key === "id") return `${direction}${key}`;
  if (key === "name" && !has("name")) {
    if (has("subject")) return `${direction}subject`;
    if (has("lastName")) return has("firstName") ? `${direction}lastName,${direction}firstName` : `${direction}lastName`;
    return null;
  }
  const field = entity.fields.find((candidate) => candidate.key === key);
  return field && SORTABLE.has(field.type) ? `${direction}${key}` : null;
}

async function listRecords(scope: string, params: URLSearchParams): Promise<{ total: number; list: Row[] }> {
  const entityKey = keyOf(scope);
  const entity = schemaOf(entityKey);
  if (!entity) throw new UnsupportedError(scope);
  for (const name of ["primaryFilter", "boolFilterList"]) {
    if ([...params.keys()].some((key) => key === name || key.startsWith(`${name}[`)) && (params.get(name) || params.getAll(`${name}[]`).length)) throw new UnsupportedError(name);
  }
  const { filter, q } = toFilter(entityKey, whereItems(params));
  const textFilter = params.get("textFilter")?.trim() || q;
  const limit = Math.min(MAX_PAGE, Math.max(1, Number(params.get("maxSize")) || 20));
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const sort = sortFor(entityKey, params.get("orderBy"), params.get("order"));
  const expand = expandableLinks(entityKey);

  const base = new URLSearchParams();
  if (sort) base.set("sort", sort);
  if (filter) base.set("filter", JSON.stringify(filter));
  if (textFilter) base.set("q", textFilter);
  if (expand.length) base.set("expand", expand.join(","));
  const signature = base.toString();
  const pager = pagerFor(entityKey, signature, async ({ limit: size, cursor, total }) => {
    const query = new URLSearchParams(base);
    query.set("limit", String(size));
    if (cursor) query.set("cursor", cursor);
    if (total) query.set("total", "true");
    return apiJson<{ items: Row[]; nextCursor: string | null; total?: number }>(`/v1/records/${entityKey}?${query.toString()}`);
  });
  const page = await pager.page(offset, limit);
  return { total: page.total ?? offset + page.items.length, list: await toScreenRecords(entityKey, page.items) };
}

async function getRecord(scope: string, id: string): Promise<Row> {
  const entityKey = keyOf(scope);
  if (!schemaOf(entityKey)) throw new UnsupportedError(scope);
  const expand = expandableLinks(entityKey);
  const record = await apiJson<Row>(`/v1/records/${entityKey}/${id}${expand.length ? `?expand=${expand.join(",")}` : ""}`);
  return toScreenRecord(entityKey, record);
}

// Field errors of the backend use ViaCRM names; the screens know the names of their own attributes.
function screenErrors(error: ApiError): ApiError {
  if (!error.errors.length) return error;
  const errors = error.errors.map((e) => {
    const name = e.field.replace(/\[\d+\]$/, "");
    const field = name.endsWith("Id") && name !== "id" ? name.slice(0, -2) : name;
    return { ...e, field: screenField(name === "ownerId" || name === "teamIds" ? name : field) };
  });
  return new ApiError(error.message, error.status, error.data, error.statusReason, { code: error.code, errors, retryAfter: error.retryAfter });
}

async function write(entityKey: string, run: () => Promise<any>): Promise<any> {
  try {
    const result = await run();
    forgetPagers(entityKey);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 412) {
      // the screens know "409 modified" as the signal for the "record changed in the meantime" dialog
      throw new ApiError(error.message, 409, error.data, { reason: "modified" }, { code: error.code });
    }
    throw error instanceof ApiError ? screenErrors(error) : error;
  }
}

export async function legacyRequest(path: string, init: RequestInit = {}): Promise<any> {
  const method = (init.method ?? "GET").toUpperCase();
  const [pathname, query = ""] = path.replace(/^\//, "").split("?");
  const segments = pathname.split("/").map(decodeURIComponent);
  const scope = segments[0];
  const entityKey = keyOf(scope);
  if (!schemaOf(entityKey)) throw new UnsupportedError(path);
  const body = (): Row => { try { return JSON.parse(String(init.body ?? "{}")); } catch { return {}; } };

  if (segments.length === 1) {
    if (method === "GET") return listRecords(scope, new URLSearchParams(query));
    if (method === "POST") {
      return write(entityKey, async () => toScreenRecord(entityKey, await apiJson<Row>(`/v1/records/${entityKey}`, { method: "POST", body: JSON.stringify(toViaBody(entityKey, body())) })));
    }
  }
  if (segments.length === 2 && UUID.test(segments[1])) {
    const id = segments[1];
    if (method === "GET") return getRecord(scope, id);
    if (method === "PUT" || method === "PATCH") {
      return write(entityKey, async () => {
        const headers: Record<string, string> = {};
        const version = seenVersion(entityKey, id);
        if (version) headers["If-Match"] = version;
        const record = await apiJson<Row>(`/v1/records/${entityKey}/${id}`, { method: "PATCH", headers, body: JSON.stringify(toViaBody(entityKey, body())) });
        return toScreenRecord(entityKey, record);
      });
    }
    if (method === "DELETE") {
      return write(entityKey, async () => { await apiJson(`/v1/records/${entityKey}/${id}`, { method: "DELETE" }); forgetVersion(entityKey, id); return true; });
    }
  }
  throw new UnsupportedError(path);
}
