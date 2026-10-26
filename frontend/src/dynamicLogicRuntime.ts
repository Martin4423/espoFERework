type Row = Record<string, any>;
type UserContext = { id?: string; teamsIds?: string[] };

/** Evaluate the server's stored logicDefs conditions against current editor values. */
function conditionMatches(condition: any, values: Row, user: UserContext = {}): boolean {
  if (!condition || typeof condition !== "object") return false;
  const type = condition.type || "equals";
  if (["and", "or", "not"].includes(type)) {
    const list: any[] = Array.isArray(condition.value) ? condition.value : [];
    if (type === "and") return list.every((item) => conditionMatches(item, values, user));
    if (type === "or") return list.some((item) => conditionMatches(item, values, user));
    return !list.some((item) => conditionMatches(item, values, user));
  }
  const attribute = String(condition.attribute || "");
  if (!attribute) return false;
  const value = attribute === "$user.id" ? user.id : attribute === "$user.teamsIds" ? user.teamsIds || [] : values[attribute];
  const expected = condition.value;
  const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
  switch (type) {
    case "equals": return value === expected;
    case "notEquals": return value !== expected;
    case "isEmpty": return empty;
    case "isNotEmpty": return !empty;
    case "isTrue": return Boolean(value);
    case "isFalse": return !value;
    case "contains": case "has": return Array.isArray(value) ? value.includes(expected) : typeof value === "string" && value.includes(String(expected ?? ""));
    case "notContains": case "notHas": return !conditionMatches({ ...condition, type: "contains" }, values, user);
    case "startsWith": return typeof value === "string" && value.startsWith(String(expected ?? ""));
    case "endsWith": return typeof value === "string" && value.endsWith(String(expected ?? ""));
    case "matches": {
      if (typeof value !== "string" || typeof expected !== "string") return false;
      const match = /^\/(.*)\/([a-z]*)$/.exec(expected);
      if (!match) return false;
      try { return new RegExp(match[1], match[2]).test(value); } catch { return false; }
    }
    case "greaterThan": return value > expected;
    case "lessThan": return value < expected;
    case "greaterThanOrEquals": return value >= expected;
    case "lessThanOrEquals": return value <= expected;
    case "in": return Array.isArray(expected) && expected.includes(value);
    case "notIn": return Array.isArray(expected) && !expected.includes(value);
    case "isToday": case "inFuture": case "inPast": {
      if (!value) return false;
      const date = new Date(String(value).replace(" ", "T"));
      if (Number.isNaN(date.getTime())) return false;
      const now = new Date();
      if (type === "isToday") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      return type === "inFuture" ? date > now : date < now;
    }
    default: return false;
  }
}

export function conditionGroupMatches(rule: any, values: Row, user?: UserContext): boolean {
  if (!rule?.conditionGroup) return false;
  return conditionMatches({ type: "and", value: rule.conditionGroup }, values, user);
}
