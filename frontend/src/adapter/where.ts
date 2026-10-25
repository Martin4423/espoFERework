import { UnsupportedError } from "../problem.ts";
import { fieldOf, schemaOf } from "./schema.ts";
import { toViaDateTime } from "./records.ts";
import { toViaEnum } from "./enums.ts";

// The screens describe filters as a tree of `where` items (type, attribute, value). ViaCRM takes the filter DSL of
// docs/contract m3b: {and|or|not} groups and {field, op, value} comparisons.
export type WhereItem = { type?: string; attribute?: string; value?: any; [key: string]: any };
export type FilterNode = Record<string, any>;

// Attributes of the screens -> ViaCRM property names.
const ATTRIBUTE: Record<string, string> = { assignedUserId: "ownerId", modifiedAt: "updatedAt", teamsIds: "teamIds", teamsId: "teamIds" };

export function viaAttribute(attribute: string): string {
  return ATTRIBUTE[attribute] ?? attribute;
}

function unsupported(what: string): never {
  throw new UnsupportedError(`where:${what}`);
}

function typed(entityKey: string, key: string, value: any): any {
  const field = fieldOf(entityKey, key);
  if (field?.type === "dateTime") return toViaDateTime(value);
  if (field?.type === "enum") return toViaEnum(entityKey, key, value);
  if (field?.type === "decimal" && typeof value === "number") return String(value);
  return value;
}

// ---- date presets ("today", "lastSevenDays", "currentMonth"...) -> boundaries in the user's time zone ----
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const quarterStart = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);

// Half-open range [from, to) as local midnights; null for the open side. Undefined when ViaCRM cannot express the preset.
export function presetRange(type: string, count: number, now: Date): { from: Date | null; to: Date | null } | undefined {
  const today = startOfDay(now);
  switch (type) {
    case "ever": return { from: null, to: null };
    case "today": return { from: today, to: addDays(today, 1) };
    case "past": return { from: null, to: today };
    case "future": return { from: addDays(today, 1), to: null };
    case "lastSevenDays": return { from: addDays(today, -7), to: addDays(today, 1) };
    case "currentMonth": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    case "lastMonth": return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "nextMonth": return { from: new Date(now.getFullYear(), now.getMonth() + 1, 1), to: new Date(now.getFullYear(), now.getMonth() + 2, 1) };
    case "currentQuarter": { const q = quarterStart(now); return { from: q, to: new Date(q.getFullYear(), q.getMonth() + 3, 1) }; }
    case "lastQuarter": { const q = quarterStart(now); return { from: new Date(q.getFullYear(), q.getMonth() - 3, 1), to: q }; }
    case "currentYear": return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    case "lastYear": return { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear(), 0, 1) };
    case "lastXDays": return { from: addDays(today, -count), to: addDays(today, 1) };
    case "nextXDays": return { from: today, to: addDays(today, count + 1) };
    case "olderThanXDays": return { from: null, to: addDays(today, -count) };
    case "afterXDays": return { from: addDays(today, count + 1), to: null };
    default: return undefined;   // fiscal quarters and years are not offered
  }
}

function rangeFilter(attribute: string, isDateField: boolean, range: { from: Date | null; to: Date | null }): FilterNode | null {
  const at = (d: Date) => (isDateField ? localDate(d) : d.toISOString().replace(/\.\d{3}Z$/, "Z"));
  const parts: FilterNode[] = [];
  if (range.from) parts.push({ field: attribute, op: "gte", value: at(range.from) });
  if (range.to) parts.push({ field: attribute, op: "lt", value: at(range.to) });
  return parts.length === 0 ? null : parts.length === 1 ? parts[0] : { and: parts };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const SIMPLE: Record<string, string> = {
  equals: "eq", notEquals: "ne", contains: "contains", startsWith: "startsWith", endsWith: "endsWith",
  greaterThan: "gt", lessThan: "lt", greaterThanOrEquals: "gte", lessThanOrEquals: "lte",
};

function compare(entityKey: string, item: WhereItem): FilterNode {
  const attribute = item.attribute ? viaAttribute(item.attribute) : "";
  if (!attribute) return unsupported(`${item.type}:no-attribute`);
  const known = attribute === "id" || attribute === "createdAt" || attribute === "updatedAt" || attribute === "createdById" || attribute === "ownerId" || attribute === "teamIds" || fieldOf(entityKey, attribute);
  if (!known) return unsupported(`${item.type}:${item.attribute}`);
  const field = (op: string, value?: any) => ({ field: attribute, op, ...(value === undefined ? {} : { value }) });
  const list = () => (Array.isArray(item.value) ? item.value : [item.value]).map((v: any) => typed(entityKey, attribute, v));

  switch (item.type) {
    case "equals": case "notEquals": case "greaterThan": case "lessThan": case "greaterThanOrEquals": case "lessThanOrEquals":
      return field(SIMPLE[item.type], typed(entityKey, attribute, item.value));
    case "contains": case "startsWith": case "endsWith":
      return field(SIMPLE[item.type], item.value);
    case "notContains":
      return { not: field("contains", item.value) };
    case "like": case "notLike": {
      // SQL patterns: only the shapes ViaCRM has an operator for
      const pattern = String(item.value ?? "");
      const body = pattern.replace(/^%|%$/g, "");
      if (!body || body.includes("%") || body.includes("_")) return unsupported(`${item.type}:pattern`);
      const op = pattern.startsWith("%") && pattern.endsWith("%") ? "contains" : pattern.startsWith("%") ? "endsWith" : pattern.endsWith("%") ? "startsWith" : "eq";
      const node = field(op, body);
      return item.type === "notLike" ? { not: node } : node;
    }
    case "in": return attribute === "teamIds" ? field("hasAny", list()) : field("in", list());
    case "notIn": return attribute === "teamIds" ? { not: field("hasAny", list()) } : field("nin", list());
    case "isNull": return field("isNull", true);
    case "isNotNull": return field("isNull", false);
    case "isTrue": return field("eq", true);
    case "isFalse": return field("eq", false);
    case "between": {
      const [from, to] = Array.isArray(item.value) ? item.value : [];
      return { and: [field("gte", typed(entityKey, attribute, from)), field("lte", typed(entityKey, attribute, to))] };
    }
    case "on": case "notOn": case "after": case "before": {
      const day = String(item.value ?? "").slice(0, 10);
      if (!DATE_ONLY.test(day)) return unsupported(`${item.type}:value`);
      const [y, m, d] = day.split("-").map(Number);
      const from = new Date(y, m - 1, d);
      const range = item.type === "before" ? { from: null, to: from } : item.type === "after" ? { from: addDays(from, 1), to: null } : { from, to: addDays(from, 1) };
      const node = rangeFilter(attribute, fieldOf(entityKey, attribute)?.type === "date", range) ?? unsupported(`${item.type}:range`);
      return item.type === "notOn" ? { not: node } : node;
    }
    case "arrayAnyOf": case "anyOf": return field("hasAny", list());
    case "arrayAllOf": case "allOf": return field("hasAll", list());
    case "arrayNoneOf": case "noneOf": return { not: field("hasAny", list()) };
    case "arrayIsEmpty": return { not: field("hasAny", (schemaOf(entityKey)?.fields.find((f) => f.key === attribute)?.properties?.options as string[] | undefined) ?? []) };
    default: {
      const range = presetRange(String(item.type), Number(item.value) || 0, new Date());
      if (!range) return unsupported(`${item.type}:${item.attribute ?? ""}`);
      const node = rangeFilter(attribute, fieldOf(entityKey, attribute)?.type === "date", range);
      if (!node) return { field: attribute, op: "isNull", value: false } as FilterNode;   // "ever": any value, which is not the same as no filter for null cells, so keep it
      return node;
    }
  }
}

// Returns the filter of the whole list (items are ANDed) and the text search, which ViaCRM takes as a separate parameter.
export function toFilter(entityKey: string, where: WhereItem[]): { filter: FilterNode | null; q: string | null } {
  const nodes: FilterNode[] = [];
  let q: string | null = null;
  const walk = (item: WhereItem, top: boolean): FilterNode | null => {
    // The display name of some entities is computed (first and last name, subject): searching "name" is the text search.
    if (top && item.attribute === "name" && !fieldOf(entityKey, "name") && ["contains", "startsWith", "equals"].includes(String(item.type))) {
      q = String(item.value ?? "").trim() || null;
      return null;
    }
    switch (item.type) {
      case "textFilter":
        if (!top) return unsupported("textFilter:nested");
        q = String(item.value ?? "").trim() || null;
        return null;
      case "and": case "or": {
        const parts = (Array.isArray(item.value) ? item.value : []).map((child: WhereItem) => walk(child, false)).filter((n: FilterNode | null): n is FilterNode => n !== null);
        if (!parts.length) return null;
        return parts.length === 1 ? parts[0] : { [item.type]: parts };
      }
      case "bool": case "primary": case "inFolder": case "inCategory":
        return unsupported(item.type);
      default: return compare(entityKey, item);
    }
  };
  for (const item of where) {
    const node = walk(item, true);
    if (node) nodes.push(node);
  }
  return { filter: nodes.length === 0 ? null : nodes.length === 1 ? nodes[0] : { and: nodes }, q };
}
