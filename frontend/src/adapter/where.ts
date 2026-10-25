import { UnsupportedError } from "../problem.ts";
import { fieldOf, schemaOf } from "./schema.ts";
import { toViaDateTime } from "./records.ts";

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
  if (field?.type === "decimal" && typeof value === "number") return String(value);
  return value;
}

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
    case "arrayAnyOf": case "anyOf": return field("hasAny", list());
    case "arrayAllOf": case "allOf": return field("hasAll", list());
    case "arrayNoneOf": case "noneOf": return { not: field("hasAny", list()) };
    case "arrayIsEmpty": return { not: field("hasAny", (schemaOf(entityKey)?.fields.find((f) => f.key === attribute)?.properties?.options as string[] | undefined) ?? []) };
    default: return unsupported(`${item.type}:${item.attribute ?? ""}`);
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
