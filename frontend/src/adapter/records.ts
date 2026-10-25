import { displayName, fieldOf, schemaOf } from "./schema.ts";
import { teamNames, userNames } from "./lookup.ts";
import { keyOf, scopeOf, screenField } from "./names.ts";
import { toScreenEnum, toViaEnum } from "./enums.ts";

export type Row = Record<string, any>;

// ---- date and time: the screens use "YYYY-MM-DD HH:MM:SS" (UTC), ViaCRM uses RFC 3339 ----
export function toScreenDateTime(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/.exec(value);
  return match ? `${match[1]} ${match[2]}` : value;
}

export function toViaDateTime(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(value);
  if (!match) return value;
  return `${match[1]}T${match[2].length === 5 ? `${match[2]}:00` : match[2]}Z`;
}

// Strong ETag of a record: microseconds since the epoch of its updatedAt, quoted (docs/contract m3 section 1).
export function etagOf(updatedAt: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/.exec(updatedAt);
  if (!match) return null;
  const ms = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]);
  return `"${ms * 1000 + Number(match[7])}"`;
}

// The version of every record the screens have seen (a background refresh passes remember = false: it must not move
// the version an open edit form was based on, or a save would overwrite somebody else's change), so a save can send If-Match without the screens knowing about it.
const seen = new Map<string, string>();
export const seenVersion = (entityKey: string, id: string) => seen.get(`${entityKey}:${id}`);
export const forgetVersion = (entityKey: string, id: string) => seen.delete(`${entityKey}:${id}`);

type Names = { users: Map<string, string>; teams: Map<string, string> };

function convert(entityKey: string, via: Row, names: Names, remember = true): Row {
  const row: Row = {};
  const fields = schemaOf(entityKey)?.fields ?? [];
  const types = new Map(fields.map((field) => [field.key, field.type]));
  for (const [key, value] of Object.entries(via)) {
    const type = types.get(key);
    switch (key) {
      case "ownerId": row.assignedUserId = value; row.assignedUserName = value ? names.users.get(value) ?? "" : ""; continue;
      case "createdById": row.createdById = value; row.createdByName = value ? names.users.get(value) ?? "" : ""; continue;
      case "teamIds": {
        const ids: string[] = Array.isArray(value) ? value : [];
        row.teamsIds = ids;
        row.teamsNames = Object.fromEntries(ids.map((id) => [id, names.teams.get(id) ?? ""]));
        continue;
      }
      case "updatedAt": row.modifiedAt = toScreenDateTime(value); continue;
      case "createdAt": row.createdAt = toScreenDateTime(value); continue;
    }
    if (type === "dateTime") row[key] = toScreenDateTime(value);
    else if (type === "decimal") row[key] = value === null || value === undefined ? null : Number(value);
    else if (type === "enum") row[key] = toScreenEnum(entityKey, key, value);
    else if (type === "link") row[`${key}Id`] = via[`${key}Id`];       // the link itself arrives as `<key>Id`
    else if (value !== null && typeof value === "object" && !Array.isArray(value) && fields.some((f) => f.type === "link" && f.key === key)) continue;   // expanded record, handled below
    else row[key] = value;
  }
  // `<link>Id` plus the name of the expanded target
  for (const field of fields) {
    if (field.type !== "link" || field.key === "ownerId") continue;
    const id = via[`${field.key}Id`];
    row[`${field.key}Id`] = id ?? null;
    const target = via[field.key];
    row[`${field.key}Name`] = target && typeof target === "object" ? displayName(target) : "";
    row[field.key] = row[`${field.key}Name`] || null;   // list cells show the value of the column itself
  }
  row.assignedUser = row.assignedUserName || null;
  row.createdBy = row.createdByName || null;
  row.name = displayName(via);
  if (typeof via.updatedAt === "string") {
    const etag = etagOf(via.updatedAt);
    if (remember && etag && typeof via.id === "string") seen.set(`${entityKey}:${via.id}`, etag);
  }
  return row;
}

// Converts records of one entity and resolves the names of owners, creators and teams in two batched lookups.
export async function toScreenRecords(entityKey: string, items: Row[], remember = true): Promise<Row[]> {
  const userIds = items.flatMap((item) => [item.ownerId, item.createdById].filter((id): id is string => typeof id === "string"));
  const teamIds = items.flatMap((item) => (Array.isArray(item.teamIds) ? item.teamIds : []));
  const [users, teams] = await Promise.all([userNames(userIds), teamNames(teamIds)]);
  return items.map((item) => convert(entityKey, item, { users, teams }, remember));
}

export async function toScreenRecord(entityKey: string, item: Row, remember = true): Promise<Row> {
  return (await toScreenRecords(entityKey, [item], remember))[0];
}

// ---- writes: screen attributes -> ViaCRM properties ----
export function toViaValue(entityKey: string, key: string, value: unknown): unknown {
  const field = fieldOf(entityKey, key);
  if (value === "" && field && ["date", "dateTime", "enum", "integer", "decimal", "link"].includes(field.type)) return null;
  if (field?.type === "dateTime") return toViaDateTime(value);
  if (field?.type === "enum") return toViaEnum(entityKey, key, value);
  if (field?.type === "decimal") {
    if (value === null || value === undefined || value === "") return null;
    const scale = Number(field.properties?.scale ?? 0);
    return typeof value === "number" ? value.toFixed(scale) : value;
  }
  return value;
}

// Attributes the screens send (`assignedUserId`, `teamsIds`, `accountId`, ...) -> the body of POST/PATCH. Attributes that
// are computed or derived on the screens (names, display fields) are dropped.
export function toViaBody(entityKey: string, values: Row): Row {
  const schema = schemaOf(entityKey);
  const keys = new Set((schema?.fields ?? []).map((field) => field.key));
  const body: Row = {};
  for (const [attribute, value] of Object.entries(values)) {
    if (attribute === "assignedUserId") { if (keys.has("ownerId")) body.ownerId = value || null; continue; }
    if (attribute === "teamsIds") { if (keys.has("teamIds")) body.teamIds = Array.isArray(value) ? value : []; continue; }
    if (attribute.endsWith("Id") && keys.has(attribute.slice(0, -2)) && fieldOf(entityKey, attribute.slice(0, -2))?.type === "link") { body[attribute] = value || null; continue; }
    if (!keys.has(attribute)) continue;
    const field = fieldOf(entityKey, attribute);
    if (!field || field.readOnly || field.type === "id") continue;
    body[attribute] = toViaValue(entityKey, attribute, value);
  }
  return body;
}

export { keyOf, scopeOf, screenField };
