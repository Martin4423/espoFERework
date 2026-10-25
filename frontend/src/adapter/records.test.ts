import { beforeEach, describe, expect, it } from "vitest";
import { etagOf, toScreenDateTime, toViaBody, toViaDateTime, toViaValue } from "./records.ts";
import { displayName, setSchema } from "./schema.ts";
import { sortFor } from "./router.ts";
import { toFilter } from "./where.ts";
import { CursorPager } from "./pager.ts";
import { UnsupportedError } from "../problem.ts";
import type { ViaEntityMeta } from "./metadata.ts";

const f = (key: string, type: string, extra: Record<string, unknown> = {}) => ({ key, type, label: key, required: false, readOnly: false, core: false, properties: {}, ...extra });
const sys = [f("id", "id", { readOnly: true }), f("createdAt", "dateTime", { readOnly: true }), f("updatedAt", "dateTime", { readOnly: true }), f("ownerId", "link", { properties: { target: "user" } }), f("teamIds", "idList")];
const entities = [
  { key: "contact", labelSingular: "Contact", labelPlural: "Contacts", hasOwner: true, hasTeams: true, builtIn: true, fields: [...sys, f("firstName", "string"), f("lastName", "string"), f("account", "link", { properties: { target: "account" } })] },
  { key: "task", labelSingular: "Task", labelPlural: "Tasks", hasOwner: true, hasTeams: true, builtIn: true, fields: [...sys, f("subject", "string"), f("dueDate", "dateTime"), f("status", "enum", { properties: { options: ["open", "done"] } }), f("tags", "multiEnum", { properties: { options: ["a", "b"] } })] },
  { key: "deal", labelSingular: "Deal", labelPlural: "Deals", hasOwner: true, hasTeams: true, builtIn: true, fields: [...sys, f("name", "string"), f("amount", "decimal", { properties: { precision: 18, scale: 2 } }), f("won", "boolean")] },
] as unknown as ViaEntityMeta[];

beforeEach(() => setSchema(entities));

describe("date and time", () => {
  it("shows RFC 3339 as UTC wall time without fractions", () => {
    expect(toScreenDateTime("2026-01-15T12:00:05.123456Z")).toBe("2026-01-15 12:00:05");
    expect(toScreenDateTime(null)).toBeNull();
    expect(toScreenDateTime("2026-01-15")).toBe("2026-01-15");
  });
  it("sends screen times as RFC 3339 UTC", () => {
    expect(toViaDateTime("2026-01-15 12:00:05")).toBe("2026-01-15T12:00:05Z");
    expect(toViaDateTime("2026-01-15 12:00")).toBe("2026-01-15T12:00:00Z");
    expect(toViaDateTime("2026-01-15T12:00:05Z")).toBe("2026-01-15T12:00:05Z");
    expect(toViaDateTime("")).toBe("");
  });
  it("derives the strong ETag from updatedAt in microseconds", () => {
    expect(etagOf("2026-01-15T12:00:00.000000Z")).toBe(`"${Date.UTC(2026, 0, 15, 12) * 1000}"`);
    expect(etagOf("2026-01-15T12:00:00.123456Z")).toBe(`"${Date.UTC(2026, 0, 15, 12) * 1000 + 123456}"`);
    expect(etagOf("garbage")).toBeNull();
  });
});

describe("display name", () => {
  it("prefers name, then subject, then first and last name", () => {
    expect(displayName({ id: "1", name: "Acme" })).toBe("Acme");
    expect(displayName({ id: "1", subject: "Call back" })).toBe("Call back");
    expect(displayName({ id: "1", firstName: "Jan", lastName: "Novák" })).toBe("Jan Novák");
    expect(displayName({ id: "1", lastName: "Novák" })).toBe("Novák");
    expect(displayName({ id: "42" })).toBe("42");
  });
});

describe("write bodies", () => {
  it("maps owner, teams and link ids and drops computed attributes", () => {
    expect(toViaBody("contact", { firstName: "Jan", lastName: "N", assignedUserId: "u1", assignedUserName: "X", teamsIds: ["t1"], teamsNames: { t1: "T" }, accountId: "a1", accountName: "Acme", name: "Jan N", modifiedAt: "x", id: "i" }))
      .toEqual({ firstName: "Jan", lastName: "N", ownerId: "u1", teamIds: ["t1"], accountId: "a1" });
  });
  it("sends empty values as null for typed fields and an empty owner as null", () => {
    expect(toViaBody("contact", { accountId: "", assignedUserId: "" })).toEqual({ accountId: null, ownerId: null });
    expect(toViaBody("task", { dueDate: "", status: "" })).toEqual({ dueDate: null, status: null });
  });
  it("converts times and decimals", () => {
    expect(toViaBody("task", { dueDate: "2026-02-01 08:30:00" })).toEqual({ dueDate: "2026-02-01T08:30:00Z" });
    expect(toViaValue("deal", "amount", 12.5)).toBe("12.50");
    expect(toViaValue("deal", "amount", "")).toBeNull();
  });
  it("never sends read-only system fields", () => {
    expect(toViaBody("task", { createdAt: "2026-01-01 00:00:00", subject: "S" })).toEqual({ subject: "S" });
  });
});

describe("sorting", () => {
  it("maps the screen keys", () => {
    expect(sortFor("deal", "modifiedAt", "desc")).toBe("-updatedAt");
    expect(sortFor("deal", "name", "asc")).toBe("name");
    expect(sortFor("task", "name", "asc")).toBe("subject");
    expect(sortFor("contact", "name", "desc")).toBe("-lastName,-firstName");
    expect(sortFor("deal", "createdAt", "asc")).toBe("createdAt");
  });
  it("keeps the default order for keys the backend cannot sort by", () => {
    expect(sortFor("contact", "accountName", "asc")).toBeNull();
    expect(sortFor("deal", "assignedUserName", "asc")).toBeNull();
    expect(sortFor("deal", null, null)).toBeNull();
  });
});

describe("where to filter", () => {
  it("translates simple comparisons and renames attributes", () => {
    expect(toFilter("deal", [{ type: "equals", attribute: "name", value: "A" }]).filter).toEqual({ field: "name", op: "eq", value: "A" });
    expect(toFilter("deal", [{ type: "equals", attribute: "assignedUserId", value: "u" }]).filter).toEqual({ field: "ownerId", op: "eq", value: "u" });
    expect(toFilter("deal", [{ type: "isNull", attribute: "amount" }]).filter).toEqual({ field: "amount", op: "isNull", value: true });
    expect(toFilter("deal", [{ type: "isNotNull", attribute: "amount" }]).filter).toEqual({ field: "amount", op: "isNull", value: false });
    expect(toFilter("deal", [{ type: "isTrue", attribute: "won" }]).filter).toEqual({ field: "won", op: "eq", value: true });
    expect(toFilter("deal", [{ type: "greaterThan", attribute: "amount", value: 10 }]).filter).toEqual({ field: "amount", op: "gt", value: "10" });
  });
  it("combines items with AND and nests groups", () => {
    const { filter } = toFilter("deal", [
      { type: "equals", attribute: "name", value: "A" },
      { type: "or", value: [{ type: "isNull", attribute: "amount" }, { type: "equals", attribute: "amount", value: 0 }] },
    ]);
    expect(filter).toEqual({ and: [{ field: "name", op: "eq", value: "A" }, { or: [{ field: "amount", op: "isNull", value: true }, { field: "amount", op: "eq", value: "0" }] }] });
  });
  it("takes the text filter out as a search", () => {
    expect(toFilter("deal", [{ type: "textFilter", value: " acme " }])).toEqual({ filter: null, q: "acme" });
  });
  it("maps lists, between, negations and multi-value operators", () => {
    expect(toFilter("deal", [{ type: "in", attribute: "name", value: ["a", "b"] }]).filter).toEqual({ field: "name", op: "in", value: ["a", "b"] });
    expect(toFilter("deal", [{ type: "notIn", attribute: "name", value: ["a"] }]).filter).toEqual({ field: "name", op: "nin", value: ["a"] });
    expect(toFilter("deal", [{ type: "in", attribute: "teamsIds", value: ["t"] }]).filter).toEqual({ field: "teamIds", op: "hasAny", value: ["t"] });
    expect(toFilter("deal", [{ type: "between", attribute: "amount", value: [1, 5] }]).filter).toEqual({ and: [{ field: "amount", op: "gte", value: "1" }, { field: "amount", op: "lte", value: "5" }] });
    expect(toFilter("task", [{ type: "anyOf", attribute: "tags", value: ["a"] }]).filter).toEqual({ field: "tags", op: "hasAny", value: ["a"] });
    expect(toFilter("deal", [{ type: "notContains", attribute: "name", value: "x" }]).filter).toEqual({ not: { field: "name", op: "contains", value: "x" } });
  });
  it("converts date-time values", () => {
    expect(toFilter("task", [{ type: "greaterThan", attribute: "dueDate", value: "2026-02-01 10:00:00" }]).filter).toEqual({ field: "dueDate", op: "gt", value: "2026-02-01T10:00:00Z" });
  });
  it("reports what ViaCRM cannot filter yet as not available", () => {
    for (const where of [{ type: "primary", value: "active" }, { type: "bool", value: ["onlyMy"] }, { type: "today", attribute: "dueDate" }, { type: "equals", attribute: "nope", value: 1 }]) {
      expect(() => toFilter("task", [where])).toThrow(UnsupportedError);
    }
  });
});

describe("CursorPager", () => {
  // a fake backend with 1000 rows 0..999 and cursors "c<position>"
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
  const calls: Array<{ limit: number; cursor: string | null; total: boolean }> = [];
  const fetcher = async ({ limit, cursor, total }: { limit: number; cursor: string | null; total: boolean }) => {
    calls.push({ limit, cursor, total });
    const start = cursor ? Number(cursor.slice(1)) : 0;
    const items = rows.slice(start, start + limit);
    return { items, nextCursor: start + limit < rows.length ? `c${start + limit}` : null, ...(total ? { total: rows.length } : {}) };
  };
  beforeEach(() => { calls.length = 0; });

  it("serves the first page with the total", async () => {
    const pager = new CursorPager(fetcher);
    const page = await pager.page(0, 20);
    expect(page.items.map((r) => r.id)[0]).toBe("0");
    expect(page.items).toHaveLength(20);
    expect(page.total).toBe(1000);
    expect(calls).toEqual([{ limit: 20, cursor: null, total: true }]);
  });

  it("goes to the next page with one request", async () => {
    const pager = new CursorPager(fetcher);
    await pager.page(0, 20);
    calls.length = 0;
    const page = await pager.page(20, 20);
    expect(page.items[0].id).toBe("20");
    expect(calls).toEqual([{ limit: 20, cursor: "c20", total: true }]);
  });

  it("jumps to a page it has not seen by walking in chunks of 200", async () => {
    const pager = new CursorPager(fetcher);
    const page = await pager.page(450, 20);
    expect(page.items[0].id).toBe("450");
    expect(calls.map((c) => c.limit)).toEqual([200, 200, 50, 20]);
    calls.length = 0;
    expect((await pager.page(450, 20)).items[0].id).toBe("450");   // remembered
    expect(calls).toHaveLength(1);
  });

  it("returns an empty page with the real total past the end", async () => {
    const pager = new CursorPager(fetcher);
    const page = await pager.page(5000, 20);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(1000);
  });

  it("can go back to an earlier page", async () => {
    const pager = new CursorPager(fetcher);
    await pager.page(0, 20);
    await pager.page(20, 20);
    calls.length = 0;
    expect((await pager.page(0, 20)).items[0].id).toBe("0");
    expect(calls).toHaveLength(1);
  });
});
