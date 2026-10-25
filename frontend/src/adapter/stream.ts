import { apiJson } from "../http.ts";
import { ApiError, UnsupportedError } from "../problem.ts";
import { mentionedIds, rememberUsers, userNames } from "./lookup.ts";
import { keyOf, screenField } from "./names.ts";
import { toScreenDateTime } from "./records.ts";
import { fieldOf, schemaOf } from "./schema.ts";

type Row = Record<string, any>;

// ViaCRM has notes (text with mentions) and a change history. The screens know one "stream" of notes of several types
// (Post, Create, Update): the stream is the notes and the history of the record, newest first.
const MAX_SOURCE = 100;

type ViaNote = { id: string; entity: string; recordId: string; authorId: string; authorName: string; body: string; mentions: string[]; createdAt: string; updatedAt: string; edited: boolean };
type ViaHistory = { id: number; action: string; actorId: string | null; at: string; changes: Record<string, { from?: unknown; to?: unknown }> };

const scopeOf = (entity: string) => entity.charAt(0).toUpperCase() + entity.slice(1);

export function toScreenNote(note: ViaNote): Row {
  return {
    id: note.id, type: "Post", post: note.body, parentType: scopeOf(note.entity), parentId: note.recordId,
    createdAt: toScreenDateTime(note.createdAt), createdById: note.authorId, createdByName: note.authorName,
    modifiedAt: toScreenDateTime(note.updatedAt), isEdited: note.edited, isPinned: false, isInternal: false,
    data: {}, attachmentsIds: [], attachmentsNames: {}, attachmentsTypes: {}, reactionCounts: {}, myReactions: [], mentions: note.mentions,
  };
}

// One history change in the attributes the screens compare (`assignedUserId`/`assignedUserName`, `accountId`, ...).
function screenValue(entityKey: string, key: string, value: unknown, names: Map<string, string>): Row {
  const field = fieldOf(entityKey, key);
  if (key === "ownerId") return { assignedUserId: value ?? null, assignedUserName: typeof value === "string" ? names.get(value) ?? "" : "" };
  if (key.endsWith("Id") && fieldOf(entityKey, key.slice(0, -2))?.type === "link") return { [key]: value ?? null, [`${key.slice(0, -2)}Name`]: "" };
  if (field?.type === "dateTime") return { [key]: toScreenDateTime(value) };
  if (field?.type === "decimal") return { [key]: value === null || value === undefined ? null : Number(value) };
  if (key === "teamIds") return { teamsIds: value ?? [] };
  return { [key]: value ?? null };
}

export function toScreenHistory(entityKey: string, recordId: string, entry: ViaHistory, names: Map<string, string>): Row | null {
  if (entry.action !== "create" && entry.action !== "update") return null;
  const fields: string[] = [];
  const was: Row = {};
  const became: Row = {};
  for (const [key, change] of Object.entries(entry.changes ?? {})) {
    fields.push(screenField(key.endsWith("Id") && key !== "ownerId" && key !== "createdById" ? key.slice(0, -2) : key));
    if ("from" in change) Object.assign(was, screenValue(entityKey, key, change.from, names));
    if ("to" in change) Object.assign(became, screenValue(entityKey, key, change.to, names));
  }
  return {
    id: `h${entry.id}`, type: entry.action === "create" ? "Create" : "Update", parentType: scopeOf(entityKey), parentId: recordId,
    createdAt: toScreenDateTime(entry.at), createdById: entry.actorId, createdByName: entry.actorId ? names.get(entry.actorId) ?? "" : "",
    data: entry.action === "update" ? { fields, attributes: { was, became } } : {},
    isPinned: false, reactionCounts: {}, myReactions: [],
  };
}

// Pages through a source until `want` items are collected (or it ends). `more` tells whether items are left.
async function collect<T>(path: string, limit: number, want: number): Promise<{ items: T[]; more: boolean }> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set("cursor", cursor);
    const page: { items: T[]; nextCursor: string | null } = await apiJson(`${path}?${query.toString()}`);
    items.push(...page.items);
    if (!page.nextCursor) return { items, more: false };
    if (items.length >= want) return { items, more: true };
    cursor = page.nextCursor;
  }
}

function requireEntity(scope: string): string {
  const key = keyOf(scope);
  if (!schemaOf(key)) throw new UnsupportedError(`${scope}/stream`);
  return key;
}

export async function streamList(scope: string, id: string, params: URLSearchParams, postsOnly: boolean): Promise<{ total: number; list: Row[] }> {
  const key = requireEntity(scope);
  const maxSize = Math.max(1, Number(params.get("maxSize")) || 20);
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const want = offset + maxSize;
  const notes = await collect<ViaNote>(`/v1/records/${key}/${id}/notes`, MAX_SOURCE, want);
  const history = postsOnly ? { items: [] as ViaHistory[], more: false } : await collect<ViaHistory>(`/v1/records/${key}/${id}/history`, 200, want).catch(() => ({ items: [] as ViaHistory[], more: false }));
  const actors = history.items.map((entry) => entry.actorId).filter((actor): actor is string => Boolean(actor));
  const names = await userNames(actors);
  const merged = [
    ...notes.items.map(toScreenNote),
    ...history.items.map((entry) => toScreenHistory(key, id, entry, names)).filter((row): row is Row => row !== null),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(b.id).localeCompare(String(a.id)));
  const more = notes.more || history.more;
  return { total: more ? Math.max(merged.length, want + 1) : merged.length, list: merged.slice(offset, want) };
}

export async function createNote(body: Row): Promise<Row> {
  const key = requireEntity(String(body.parentType ?? ""));
  if (Array.isArray(body.attachmentsIds) && body.attachmentsIds.length) throw new UnsupportedError("Note:attachments");
  const text = String(body.post ?? "").trim();
  const note = await apiJson<ViaNote>(`/v1/records/${key}/${body.parentId}/notes`, { method: "POST", body: JSON.stringify({ body: text, mentions: mentionedIds(text) }) });
  return toScreenNote(note);
}

export async function updateNote(id: string, body: Row): Promise<Row> {
  const text = String(body.post ?? "").trim();
  return toScreenNote(await apiJson<ViaNote>(`/v1/notes/${id}`, { method: "PATCH", body: JSON.stringify({ body: text, mentions: mentionedIds(text) }) }));
}

export async function getNote(id: string): Promise<Row> {
  return toScreenNote(await apiJson<ViaNote>(`/v1/notes/${id}`));
}

export async function deleteNote(id: string): Promise<true> {
  await apiJson(`/v1/notes/${id}`, { method: "DELETE" });
  return true;
}

// ---- files of the record, as the attachments of its stream ----
export async function filesOf(scope: string, id: string): Promise<{ total: number; list: Row[] }> {
  const key = requireEntity(scope);
  const result = await apiJson<{ items: Array<{ id: string; name: string; contentType: string; size: number; uploadedById: string; uploadedByName: string; createdAt: string }> }>(`/v1/records/${key}/${id}/files`);
  return { total: result.items.length, list: result.items.map((file) => ({ id: file.id, name: file.name, type: file.contentType, size: file.size, createdAt: toScreenDateTime(file.createdAt), createdById: file.uploadedById, createdByName: file.uploadedByName, parentType: scope, parentId: id })) };
}

// ---- followers ----
export async function followersOf(scope: string, id: string): Promise<{ total: number; list: Row[] }> {
  const key = requireEntity(scope);
  const result = await apiJson<{ items: Array<{ userId: string; name: string; since: string }> }>(`/v1/records/${key}/${id}/followers`);
  rememberUsers(result.items.map((item) => ({ id: item.userId, name: item.name })));
  return { total: result.items.length, list: result.items.map((item) => ({ id: item.userId, name: item.name, userName: item.name })) };
}

export async function setFollowing(scope: string, id: string, follow: boolean): Promise<true> {
  const key = requireEntity(scope);
  await apiJson(`/v1/records/${key}/${id}/follow`, { method: follow ? "PUT" : "DELETE" });
  return true;
}

export { ApiError };
