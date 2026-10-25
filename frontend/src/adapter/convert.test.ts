import { beforeEach, describe, expect, it, vi } from "vitest";

const lookups: string[] = [];
vi.mock("../http.ts", () => ({
  apiJson: async (path: string) => {
    lookups.push(path);
    if (path.includes("/lookup/users")) return { items: [{ id: "u1", name: "Ada Lovelace" }, { id: "u2", name: "Bob" }] };
    if (path.includes("/lookup/teams")) return { items: [{ id: "t1", name: "Sales" }] };
    return { items: [] };
  },
}));

import { clearLookupCache } from "./lookup.ts";
import { seenVersion, toScreenRecords } from "./records.ts";
import { setSchema } from "./schema.ts";
import type { ViaEntityMeta } from "./metadata.ts";

const f = (key: string, type: string, properties: Record<string, unknown> = {}) => ({ key, type, label: key, required: false, readOnly: false, core: false, properties });
const entities = [{
  key: "contact", labelSingular: "Contact", labelPlural: "Contacts", hasOwner: true, hasTeams: true, builtIn: true,
  fields: [f("id", "id"), f("createdAt", "dateTime"), f("updatedAt", "dateTime"), f("createdById", "id"), f("ownerId", "link", { target: "user" }), f("teamIds", "idList"),
    f("firstName", "string"), f("lastName", "string"), f("revenue", "decimal", { scale: 2 }), f("seen", "dateTime"), f("account", "link", { target: "account" })],
}] as unknown as ViaEntityMeta[];

const via = (extra: Record<string, unknown> = {}) => ({
  id: "c1", createdAt: "2026-01-15T12:00:00.000000Z", updatedAt: "2026-01-15T12:30:00.123456Z", createdById: "u2", ownerId: "u1", teamIds: ["t1"],
  firstName: "Eva", lastName: "Novák", revenue: "12.50", seen: "2026-01-15T10:00:00.000000Z", accountId: "a1", account: { id: "a1", name: "Acme" }, ...extra,
});

beforeEach(() => { setSchema(entities); clearLookupCache(); lookups.length = 0; });

describe("toScreenRecords", () => {
  it("renames the system properties and resolves owner, creator and team names", async () => {
    const [row] = await toScreenRecords("contact", [via()]);
    expect(row).toMatchObject({
      id: "c1", assignedUserId: "u1", assignedUserName: "Ada Lovelace", assignedUser: "Ada Lovelace",
      createdById: "u2", createdByName: "Bob", teamsIds: ["t1"], teamsNames: { t1: "Sales" },
    });
    expect(row.ownerId).toBeUndefined();
    expect(row.teamIds).toBeUndefined();
  });

  it("shows times as UTC wall time, decimals as numbers and keeps the update time as modifiedAt", async () => {
    const [row] = await toScreenRecords("contact", [via()]);
    expect(row.createdAt).toBe("2026-01-15 12:00:00");
    expect(row.modifiedAt).toBe("2026-01-15 12:30:00");
    expect(row.seen).toBe("2026-01-15 10:00:00");
    expect(row.revenue).toBe(12.5);
  });

  it("gives a link its id, its name and the name as the column value, and computes the display name", async () => {
    const [row] = await toScreenRecords("contact", [via()]);
    expect(row).toMatchObject({ accountId: "a1", accountName: "Acme", account: "Acme", name: "Eva Novák" });
  });

  it("copes with an empty link and null owner", async () => {
    const [row] = await toScreenRecords("contact", [via({ accountId: null, account: null, ownerId: null, revenue: null })]);
    expect(row).toMatchObject({ accountId: null, accountName: "", account: null, assignedUserId: null, assignedUserName: "", revenue: null });
  });

  it("looks every user and team up once per page and caches the names", async () => {
    await toScreenRecords("contact", [via(), via({ id: "c2" }), via({ id: "c3", ownerId: "u2" })]);
    await toScreenRecords("contact", [via({ id: "c4" })]);
    expect(lookups.filter((path) => path.includes("/lookup/users"))).toHaveLength(1);
    expect(lookups.filter((path) => path.includes("/lookup/teams"))).toHaveLength(1);
    expect(lookups[0]).toContain("ids=u1,u2");
  });

  it("remembers the version of every record for If-Match", async () => {
    await toScreenRecords("contact", [via()]);
    expect(seenVersion("contact", "c1")).toBe(`"${Date.UTC(2026, 0, 15, 12, 30) * 1000 + 123456}"`);
  });

  it("survives a failing lookup: names are empty, the record is still there", async () => {
    clearLookupCache();
    vi.resetModules();
    const [row] = await toScreenRecords("contact", [via({ ownerId: "unknown" })]);
    expect(row.id).toBe("c1");
  });
});
