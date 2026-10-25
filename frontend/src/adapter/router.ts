import { apiJson } from "../http.ts";
import { ApiError, UnsupportedError } from "../problem.ts";
import { forgetPagers, pagerFor } from "./pager.ts";
import { forgetVersion, seenVersion, toScreenRecord, toScreenRecords, toViaBody } from "./records.ts";
import { expandableLinks, reverseLinks, schemaOf } from "./schema.ts";
import { keyOf, screenField } from "./names.ts";
import { toFilter } from "./where.ts";
import { createNote, deleteNote, filesOf, followersOf, getNote, setFollowing, streamList, updateNote } from "./stream.ts";
import { markRead, notificationList, setRead, unreadCount } from "./notifications.ts";
import { rememberUsers } from "./lookup.ts";
import type { FilterNode } from "./where.ts";
import { auth } from "../http.ts";
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

// Bracketed query keys (`where[0][type]=contains&where[0][value]=x`, `where[1][value][]=a`) -> the nested value they describe.
export function parseBrackets(params: URLSearchParams, root: string): any[] {
  const tree: any = [];
  for (const [key, value] of params.entries()) {
    if (!key.startsWith(`${root}[`)) continue;
    const path = [...key.slice(root.length).matchAll(/\[([^\]]*)\]/g)].map((match) => match[1]);
    let node = tree;
    path.forEach((part, index) => {
      const last = index === path.length - 1;
      const next = path[index + 1];
      const slot = part === "" ? node.length : part;
      if (last) { if (part === "") node.push(value); else node[slot] = value; return; }
      if (node[slot] === undefined) node[slot] = next === "" || /^\d+$/.test(next) ? [] : {};
      node = node[slot];
    });
  }
  return tree;
}

// Espo sends the same list of where items as `where`, `whereGroup` or as bracketed query keys.
function whereItems(params: URLSearchParams): WhereItem[] {
  const items: WhereItem[] = [];
  for (const name of ["where", "whereGroup"]) {
    const parsed = parseJson(params.get(name));
    if (Array.isArray(parsed)) items.push(...parsed);
    items.push(...parseBrackets(params, name).filter(Boolean));
  }
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

async function listRecords(scope: string, params: URLSearchParams, extra: FilterNode | null = null): Promise<{ total: number; list: Row[] }> {
  const entityKey = keyOf(scope);
  const entity = schemaOf(entityKey);
  if (!entity) throw new UnsupportedError(scope);
  for (const name of ["primaryFilter", "boolFilterList"]) {
    if ([...params.keys()].some((key) => key === name || key.startsWith(`${name}[`)) && (params.get(name) || params.getAll(`${name}[]`).length)) throw new UnsupportedError(name);
  }
  const { filter: where, q } = toFilter(entityKey, whereItems(params));
  const filter = extra && where ? { and: [extra, where] } : extra ?? where;
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

// A single record does not expand links (only lists do), so the names of the linked records are fetched one by one.
async function getRecord(scope: string, id: string): Promise<Row> {
  const entityKey = keyOf(scope);
  const entity = schemaOf(entityKey);
  if (!entity) throw new UnsupportedError(scope);
  const record = await apiJson<Row>(`/v1/records/${entityKey}/${id}`);
  await Promise.all(entity.fields.filter((field) => field.type === "link" && field.key !== "ownerId" && record[`${field.key}Id`]).map(async (field) => {
    try { record[field.key] = await apiJson<Row>(`/v1/records/${field.properties.target}/${record[`${field.key}Id`]}`); }
    catch { /* the target may be unreadable for this user: the link then shows no name */ }
  }));
  const row = await toScreenRecord(entityKey, record);
  try {
    const me = auth.getSession()?.user.id;
    row.isFollowed = Boolean(me) && (await followersOf(scope, id)).list.some((follower) => follower.id === me);
  } catch { row.isFollowed = false; }
  return row;
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

// ---- related records: GET/POST/DELETE Account/{id}/contacts ----
async function relatedRequest(scope: string, id: string, linkName: string, method: string, query: string, body: () => Row): Promise<any> {
  const reverse = reverseLinks(keyOf(scope)).find((link) => link.name === linkName);
  if (!reverse) throw new UnsupportedError(`${scope}/${id}/${linkName}`);
  const relatedScope = scopeOfKey(reverse.entityKey);
  if (method === "GET") return listRecords(relatedScope, new URLSearchParams(query), { field: `${reverse.field}Id`, op: "eq", value: id });
  const ids = (() => { const data = body(); return Array.isArray(data.ids) ? data.ids : data.id ? [data.id] : []; })() as string[];
  if (method === "POST" || method === "DELETE") {
    await Promise.all(ids.map((target) => apiJson(`/v1/records/${reverse.entityKey}/${target}`, { method: "PATCH", body: JSON.stringify({ [`${reverse.field}Id`]: method === "POST" ? id : null }) })));
    forgetPagers(reverse.entityKey);
    return true;
  }
  throw new UnsupportedError(`${scope}/${id}/${linkName}`);
}

const scopeOfKey = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

// ---- mass actions: delete and update many records ----
const MAX_MASS = 5000;

async function collectIds(scope: string, params: Row): Promise<string[]> {
  if (Array.isArray(params.ids)) return params.ids;
  if (!params.byWhere) return [];
  const query = new URLSearchParams();
  const items = [...(Array.isArray(params.where) ? params.where : []), ...(params.searchParams?.textFilter ? [{ type: "textFilter", value: params.searchParams.textFilter }] : [])];
  query.set("whereGroup", JSON.stringify(items));
  const ids: string[] = [];
  for (let offset = 0; offset < MAX_MASS; offset += MAX_PAGE) {
    query.set("maxSize", String(MAX_PAGE));
    query.set("offset", String(offset));
    const page = await listRecords(scope, query);
    ids.push(...page.list.map((row) => row.id));
    if (page.list.length < MAX_PAGE) break;
  }
  return ids;
}

async function massAction(init: RequestInit): Promise<any> {
  let body: Row = {};
  try { body = JSON.parse(String(init.body ?? "{}")); } catch { /* an empty body selects nothing */ }
  const scope = String(body.entityType ?? "");
  const entityKey = keyOf(scope);
  if (!schemaOf(entityKey)) throw new UnsupportedError(`MassAction:${scope}`);
  const action = String(body.action ?? "");
  if (action !== "delete" && action !== "update") throw new UnsupportedError(`MassAction:${action}`);
  const ids = await collectIds(scope, body.params ?? {});
  const set = action === "update" ? toViaBody(entityKey, body.data?.values ?? body.data ?? {}) : undefined;
  const done: string[] = [];
  const errors: Array<{ id: string; message: string }> = [];
  for (let i = 0; i < ids.length; i += MAX_PAGE) {
    const chunk = ids.slice(i, i + MAX_PAGE);
    const result = await write(entityKey, () => apiJson<{ results: Array<{ id: string; status: string; message?: string }> }>(`/v1/records/${entityKey}/bulk`, {
      method: "POST", body: JSON.stringify(action === "delete" ? { action, ids: chunk } : { action, ids: chunk, set }),
    }));
    for (const item of result.results) {
      if (item.status === "ok") done.push(item.id);
      else errors.push({ id: item.id, message: item.message ?? "" });
    }
  }
  return { count: done.length, ids: done, errors };
}

// ---- preferences: the per-user object of /v1/me/preferences ----
// The screens read it from a dozen places while one page renders: reads within a moment share one request.
let preferencesRead: { at: number; value: Promise<Row> } | null = null;
const PREFERENCES_REUSE_MS = 1500;

async function preferences(segments: string[], method: string, body: () => Row): Promise<any> {
  const session = auth.getSession();
  if (segments.length !== 2 || segments[1] !== session?.user.id) throw new UnsupportedError("Preferences:other-user");
  if (method === "GET") {
    if (!preferencesRead || Date.now() - preferencesRead.at > PREFERENCES_REUSE_MS) {
      const value = apiJson<Row>("/v1/me/preferences");
      value.catch(() => { preferencesRead = null; });
      preferencesRead = { at: Date.now(), value };
    }
    return preferencesRead.value;
  }
  if (method === "PUT" || method === "PATCH") {
    preferencesRead = null;
    return apiJson<Row>("/v1/me/preferences", { method: "PATCH", body: JSON.stringify(body()) });
  }
  throw new UnsupportedError("Preferences");
}

// Users and teams are not records of the schema. For pickers and name displays they are answered from the lookups
// (id and name only; the administration screens of step S8 use /v1/users and /v1/teams).
async function lookupScope(scope: "User" | "Team", segments: string[], query: string): Promise<any> {
  const kind = scope === "User" ? "users" : "teams";
  const shape = (item: { id: string; name: string; isActive?: boolean }): Row => ({ id: item.id, name: item.name, ...(scope === "User" ? { userName: item.name, isActive: item.isActive ?? true } : {}) });
  if (segments.length === 2 && UUID.test(segments[1])) {
    const result = await apiJson<{ items: Array<{ id: string; name: string; isActive?: boolean }> }>(`/v1/lookup/${kind}?ids=${segments[1]}&limit=1`);
    if (!result.items.length) throw new ApiError("", 404, null, undefined, { code: "NOT_FOUND" });
    return shape(result.items[0]);
  }
  if (segments.length !== 1) throw new UnsupportedError(segments.join("/"));
  const params = new URLSearchParams(query);
  const { q } = toFilter("user", whereItems(params));
  const text = params.get("textFilter")?.trim() || q;
  const max = scope === "User" ? 50 : 200;
  const limit = Math.min(max, Math.max(1, Number(params.get("maxSize")) || 20));
  const request = new URLSearchParams({ limit: String(limit) });
  if (text) request.set("q", text);
  const result = await apiJson<{ items: Array<{ id: string; name: string; isActive?: boolean }> }>(`/v1/lookup/${kind}?${request.toString()}`);
  if (scope === "User") rememberUsers(result.items);
  return { total: result.items.length, list: result.items.map(shape) };
}

export async function legacyRequest(path: string, init: RequestInit = {}): Promise<any> {
  const method = (init.method ?? "GET").toUpperCase();
  const [pathname, query = ""] = path.replace(/^\//, "").split("?");
  const segments = pathname.split("/").map(decodeURIComponent);
  const scope = segments[0];
  const entityKey = keyOf(scope);
  const body = (): Row => { try { return JSON.parse(String(init.body ?? "{}")); } catch { return {}; } };
  if (scope === "MassAction" && method === "POST" && segments.length === 1) return massAction(init);
  if (scope === "Notification") {
    if (method === "GET" && segments.length === 1) return notificationList(new URLSearchParams(query));
    if (method === "GET" && segments[1] === "action" && segments[2] === "notReadCount") return unreadCount();
    if (method === "POST" && segments[1] === "action" && segments[2] === "markAllRead") { forgetPagers("__notification"); return markRead("all"); }
    if (method === "PUT" && segments.length === 2 && UUID.test(segments[1])) { forgetPagers("__notification"); return setRead(segments[1], Boolean(body().read)); }
    throw new UnsupportedError(path);
  }
  if (scope === "Note") {
    if (method === "POST" && segments.length === 1) return createNote(body());
    if (segments.length === 2 && UUID.test(segments[1])) {
      if (method === "GET") return getNote(segments[1]);
      if (method === "PUT" || method === "PATCH") return updateNote(segments[1], body());
      if (method === "DELETE") return deleteNote(segments[1]);
    }
    throw new UnsupportedError(path);
  }
  if (scope === "Preferences") return preferences(segments, method, () => { try { return JSON.parse(String(init.body ?? "{}")); } catch { return {}; } });
  if ((scope === "User" || scope === "Team") && method === "GET") return lookupScope(scope, segments, query);
  if (!schemaOf(entityKey)) throw new UnsupportedError(path);
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
  if (segments.length === 3 && UUID.test(segments[1])) {
    const [, id, part] = segments;
    if (part === "stream" && method === "GET") return streamList(scope, id, new URLSearchParams(query), false);
    if (part === "posts" && method === "GET") return streamList(scope, id, new URLSearchParams(query), true);
    if (part === "streamAttachments" && method === "GET") return filesOf(scope, id);
    if (part === "followers" && method === "GET") return followersOf(scope, id);
    if (part === "subscription" && (method === "PUT" || method === "DELETE")) return setFollowing(scope, id, method === "PUT");
  }
  if (segments.length === 3 && UUID.test(segments[1])) return relatedRequest(scope, segments[1], segments[2], method, query, body);
  throw new UnsupportedError(path);
}
