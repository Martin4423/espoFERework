import { describe, expect, it } from "vitest";
import { aclLevel, canAccessEntity, canChangeEntity, canCreateEntity, entityList } from "../api.ts";
import { buildMetadata } from "./metadata.ts";
import type { ViaEntities, ViaPermissions } from "./metadata.ts";
import { toDetailLayout, toListLayout } from "./layouts.ts";
import { keyOf, scopeOf, screenField, viaField } from "./names.ts";

const sys = (extra: Array<Record<string, unknown>> = []) => [
  { key: "id", type: "id", label: "ID", required: false, readOnly: true, core: true, properties: {} },
  { key: "createdAt", type: "dateTime", label: "Created at", required: false, readOnly: true, core: true, properties: {} },
  { key: "updatedAt", type: "dateTime", label: "Updated at", required: false, readOnly: true, core: true, properties: {} },
  { key: "createdById", type: "id", label: "Created by", required: false, readOnly: true, core: true, properties: {} },
  { key: "ownerId", type: "link", label: "Owner", required: false, readOnly: false, core: true, properties: { target: "user" } },
  { key: "teamIds", type: "idList", label: "Teams", required: false, readOnly: false, core: true, properties: {} },
  ...extra,
] as ViaEntities["entities"][number]["fields"];

const source: ViaEntities = {
  version: 3,
  entities: [
    { key: "account", labelSingular: "Account", labelPlural: "Accounts", hasOwner: true, hasTeams: true, builtIn: true, fields: sys([
      { key: "name", type: "string", label: "Name", required: true, readOnly: false, core: true, properties: { maxLength: 255 } },
      { key: "revenue", type: "decimal", label: "Revenue", required: false, readOnly: false, core: false, properties: { precision: 18, scale: 2, min: "0" } },
      { key: "industry", type: "enum", label: "Industry", required: false, readOnly: false, core: false, properties: { options: ["Technology", "Other"] } },
      { key: "email", type: "email", label: "E-mail", required: false, readOnly: false, core: false, properties: {} },
    ]) },
    { key: "deal", labelSingular: "Deal", labelPlural: "Deals", hasOwner: true, hasTeams: true, builtIn: true, fields: sys([
      { key: "name", type: "string", label: "Name", required: true, readOnly: false, core: true, properties: { maxLength: 255 } },
      { key: "account", type: "link", label: "Account", required: false, readOnly: false, core: false, properties: { target: "account" } },
      { key: "stage", type: "enum", label: "Stage", required: true, readOnly: false, core: false, properties: { options: ["new", "won"] }, defaultValue: "new" },
    ]) },
    { key: "quoteLine", labelSingular: "Quote line", labelPlural: "Quote lines", hasOwner: true, hasTeams: true, builtIn: true, fields: sys() },
  ],
};

const admin: ViaPermissions = { isAdmin: true, entities: {}, fields: {}, features: { export: true, import: true, massUpdate: true, audit: true } };
const rep: ViaPermissions = {
  isAdmin: false,
  entities: { account: { read: "team", edit: "own", delete: "no", create: "yes" }, deal: { read: "no", edit: "no", delete: "no", create: "no" } },
  fields: { account: { revenue: { read: true, write: false }, ownerId: { read: false, write: false } } },
  features: { export: true, massUpdate: false },
};

describe("names", () => {
  it("maps entity keys to scopes and back", () => {
    expect(scopeOf("quoteLine")).toBe("QuoteLine");
    expect(keyOf("QuoteLine")).toBe("quoteLine");
  });
  it("renames system properties for the screens and back", () => {
    expect(screenField("ownerId")).toBe("assignedUser");
    expect(screenField("updatedAt")).toBe("modifiedAt");
    expect(screenField("name")).toBe("name");
    expect(viaField("assignedUser")).toBe("ownerId");
    expect(viaField("teams")).toBe("teamIds");
  });
});

describe("buildMetadata", () => {
  const metadata = buildMetadata(source, admin);

  it("makes a scope of every entity, tabs for all but line items", () => {
    expect(Object.keys(metadata.scopes).slice(0, 3)).toEqual(["Account", "Deal", "QuoteLine"]);
    expect(metadata.scopes.Account).toMatchObject({ entity: true, tab: true, isCustom: false });
    expect(metadata.scopes.QuoteLine.tab).toBe(false);
  });

  it("translates field types", () => {
    const fields = metadata.entityDefs.Account.fields!;
    expect(fields.name).toMatchObject({ type: "varchar", required: true, maxLength: 255 });
    expect(fields.revenue).toMatchObject({ type: "float", decimalPlaces: 2, min: 0 });
    expect(fields.industry).toMatchObject({ type: "enum", options: ["Technology", "Other"] });
    expect(fields.email).toMatchObject({ type: "varchar", viaType: "email" });
    expect(metadata.entityDefs.Deal.fields!.stage).toMatchObject({ default: "new", required: true });
  });

  it("renames owner, teams and the update time, and types them as links", () => {
    const fields = metadata.entityDefs.Account.fields!;
    expect(fields.assignedUser).toMatchObject({ type: "link", entity: "User" });
    expect(fields.teams).toMatchObject({ type: "linkMultiple", entity: "Team" });
    expect(fields.createdBy).toMatchObject({ type: "link", entity: "User", readOnly: true });
    expect(fields.modifiedAt).toMatchObject({ type: "datetime", readOnly: true });
    expect(fields.ownerId).toBeUndefined();
  });

  it("describes links to other entities", () => {
    expect(metadata.entityDefs.Deal.fields!.account).toMatchObject({ type: "link", entity: "Account" });
    expect(metadata.entityDefs.Deal.links!.account).toEqual({ entity: "Account", type: "belongsTo" });
  });

  it("adds the computed display name as a hidden field only when the schema has none", () => {
    expect(metadata.entityDefs.Account.fields!.name.utility).toBeUndefined();
    expect(metadata.entityDefs.QuoteLine.fields!.name).toMatchObject({ notStorable: true, utility: true });
  });

  it("offers labels and icons", () => {
    expect(metadata.labels!.Global.scopeNames!.Account).toBe("Account");
    expect(metadata.labels!.Global.scopeNamesPlural!.Deal).toBe("Deals");
    expect(metadata.clientDefs!.Deal.iconClass).toBe("fas fa-chart-line");
  });

  it("lists the entities of ViaCRM first and the unsupported ones as locked tabs", () => {
    const list = entityList(metadata);
    expect(list.slice(0, 2)).toEqual(["Account", "Deal"]);
    expect(list).toContain("Email");
    expect((metadata.scopes.Email as any).unsupported).toBe(true);
    expect(canChangeEntity(metadata, "Email", "edit")).toBe(false);
    expect(canCreateEntity(metadata, "Email")).toBe(false);
  });

  it("gives an administrator everything", () => {
    expect(aclLevel(metadata, "Account", "delete")).toBe("all");
    expect(metadata.userAcl!.massUpdatePermission).toBe("yes");
    expect(metadata.userAcl!.exportPermission).toBe("no");
  });
});

describe("buildMetadata for a regular user", () => {
  const metadata = buildMetadata(source, rep);

  it("carries the scope levels of the role", () => {
    expect(aclLevel(metadata, "Account", "read")).toBe("team");
    expect(aclLevel(metadata, "Account", "edit")).toBe("own");
    expect(canCreateEntity(metadata, "Account")).toBe(true);
    expect(canAccessEntity(metadata, "Deal")).toBe(false);
    expect(canChangeEntity(metadata, "Account", "delete")).toBe(false);
  });

  it("hides entities the user may not read from the navigation", () => {
    expect(entityList(metadata)).not.toContain("Deal");
    expect(entityList(metadata)).toContain("Account");
  });

  it("translates field permissions to the screen names", () => {
    expect(metadata.userAcl!.fieldTable!.Account.revenue).toEqual({ read: "yes", edit: "no" });
    expect(metadata.userAcl!.fieldTable!.Account.assignedUser).toEqual({ read: "no", edit: "no" });
  });

  it("follows the mass update feature", () => {
    expect(metadata.userAcl!.massUpdatePermission).toBe("no");
  });
});

describe("layouts", () => {
  it("turns list columns into layout items, the first one a link", () => {
    expect(toListLayout({ custom: false, columns: ["name", "ownerId", "updatedAt"], sort: "-createdAt" })).toEqual([
      { name: "name", link: true }, { name: "assignedUser", link: false }, { name: "modifiedAt", link: false },
    ]);
  });

  it("turns sections into panels with rows and empty cells", () => {
    const panels = toDetailLayout({ custom: false, sections: [{ title: "Details", columns: 2, rows: [["name", "ownerId"], ["stage", null]] }, { title: "Notes", columns: 1, rows: [["description"]] }] });
    expect(panels).toEqual([
      { label: "Details", rows: [[{ name: "name", fullWidth: false }, { name: "assignedUser", fullWidth: false }], [{ name: "stage", fullWidth: false }, false]] },
      { label: "Notes", rows: [[{ name: "description", fullWidth: true }]] },
    ]);
  });
});
