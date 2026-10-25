import { apiJson } from "../http.ts";
import { getLocale } from "../i18n/index.ts";
import { UNSUPPORTED_SCOPES } from "../unsupported.ts";
import { keyOf, scopeOf, screenField } from "./names.ts";
import { reverseLinks, setSchema } from "./schema.ts";
import { clearLookupCache } from "./lookup.ts";
import type { FieldDef, Metadata, UserAcl } from "../api";

// ---- ViaCRM wire shapes (docs/contract m1, m2) ----
export type ViaFieldMeta = { key: string; type: string; label: string; required: boolean; readOnly: boolean; core: boolean; properties: Record<string, any>; defaultValue?: unknown };
export type ViaEntityMeta = { key: string; labelSingular: string; labelPlural: string; hasOwner: boolean; hasTeams: boolean; builtIn: boolean; fields: ViaFieldMeta[] };
export type ViaEntities = { version: number; entities: ViaEntityMeta[] };
export type ViaPermissions = {
  isAdmin: boolean;
  entities: Record<string, { read: string; edit: string; delete: string; create: string }>;
  fields: Record<string, Record<string, { read: boolean; write: boolean }>>;
  features: Record<string, boolean>;
};

// Entities that exist only as rows of another entity: no tab of their own.
const NO_TAB = new Set(["quoteLine"]);
// Font Awesome classes of the entities; the screens read them from clientDefs.
const ICONS: Record<string, string> = {
  Account: "fas fa-building", Contact: "fas fa-address-card", Lead: "fas fa-bullseye", Deal: "fas fa-chart-line",
  Product: "fas fa-box", Quote: "fas fa-file-invoice-dollar", QuoteLine: "fas fa-list", Task: "fas fa-tasks",
  Call: "fas fa-phone", Meeting: "fas fa-calendar", User: "fas fa-user", Team: "fas fa-users",
};
const CALENDAR = new Set(["task", "call", "meeting"]);

// One ViaCRM field -> the definition the screens expect. Returns the screen field name too (ownerId -> assignedUser ...).
export function toFieldDef(field: ViaFieldMeta): [string, FieldDef] {
  const name = screenField(field.key);
  const p = field.properties ?? {};
  const base: FieldDef = { label: field.label, required: field.required, readOnly: field.readOnly };
  if (field.defaultValue !== undefined) base.default = field.defaultValue;
  switch (field.type) {
    case "id": return [name, { ...base, type: "id", readOnly: true, utility: true }];
    case "string": return [name, { ...base, type: "varchar", maxLength: p.maxLength }];
    case "text": return [name, { ...base, type: "text" }];
    case "integer": return [name, { ...base, type: "int", min: p.min, max: p.max }];
    case "decimal": return [name, { ...base, type: "float", decimalPlaces: p.scale ?? 0, precision: p.precision, min: p.min === undefined ? undefined : Number(p.min), max: p.max === undefined ? undefined : Number(p.max) }];
    case "boolean": return [name, { ...base, type: "bool" }];
    case "date": return [name, { ...base, type: "date" }];
    case "dateTime": return [name, { ...base, type: "datetime" }];
    case "enum": return [name, { ...base, type: "enum", options: p.options }];
    case "multiEnum": return [name, { ...base, type: "multiEnum", options: p.options }];
    case "email": return [name, { ...base, type: "varchar", maxLength: 254, viaType: "email" }];
    case "phone": return [name, { ...base, type: "varchar", maxLength: 40, viaType: "phone" }];
    case "url": return [name, { ...base, type: "url", maxLength: 2048 }];
    case "link": return [name, { ...base, type: "link", entity: scopeOf(String(p.target === "user" ? "user" : p.target)) }];
    case "idList": return [name, { ...base, type: "linkMultiple", entity: "Team" }];
    default: return [name, { ...base, type: "varchar", notStorable: true, utility: true }];
  }
}

function aclTable(perms: ViaPermissions, entities: ViaEntityMeta[]): NonNullable<UserAcl["table"]> {
  const table: NonNullable<UserAcl["table"]> = {};
  for (const entity of entities) {
    const scope = scopeOf(entity.key);
    if (perms.isAdmin) { table[scope] = true; continue; }
    const rule = perms.entities[entity.key];
    table[scope] = rule ? { read: rule.read, edit: rule.edit, delete: rule.delete, create: rule.create } : { read: "no", edit: "no", delete: "no", create: "no" };
  }
  // Users and teams are looked up for owners and assignments (the lookup endpoints decide what is returned).
  table.User = { read: "all", edit: perms.isAdmin ? "all" : "no", delete: perms.isAdmin ? "all" : "no", create: perms.isAdmin ? "yes" : "no" };
  table.Team = { read: "all", edit: perms.isAdmin ? "all" : "no", delete: perms.isAdmin ? "all" : "no", create: perms.isAdmin ? "yes" : "no" };
  // Scopes of the previous backend that ViaCRM does not offer: readable (so the tab opens the notice), never writable.
  for (const item of UNSUPPORTED_SCOPES) table[item.scope] = { read: "all", edit: "no", delete: "no", create: "no" };
  return table;
}

function fieldTable(perms: ViaPermissions): NonNullable<UserAcl["fieldTable"]> {
  const result: NonNullable<UserAcl["fieldTable"]> = {};
  for (const [key, fields] of Object.entries(perms.fields ?? {})) {
    const scope = scopeOf(key);
    result[scope] = {};
    for (const [field, access] of Object.entries(fields)) {
      result[scope][screenField(field)] = { read: access.read ? "yes" : "no", edit: access.write ? "yes" : "no" };
    }
  }
  return result;
}

// Pure: ViaCRM entities + permissions -> the metadata the screens read.
export function buildMetadata(source: ViaEntities, perms: ViaPermissions): Metadata {
  setSchema(source.entities);
  const locale = getLocale();
  const scopes: Metadata["scopes"] = {};
  const entityDefs: Metadata["entityDefs"] = {};
  const clientDefs: NonNullable<Metadata["clientDefs"]> = {};
  const scopeNames: Record<string, string> = {};
  const scopeNamesPlural: Record<string, string> = {};
  const labels: NonNullable<Metadata["labels"]> = {};

  source.entities.forEach((entity, index) => {
    const scope = scopeOf(entity.key);
    scopes[scope] = {
      entity: true, object: true, tab: !NO_TAB.has(entity.key), layouts: true, acl: true, stream: !NO_TAB.has(entity.key), calendar: CALENDAR.has(entity.key),
      importable: false, customizable: perms.isAdmin, isCustom: !entity.builtIn, isNotRemovable: true, type: "Base", order: index,
      entityManager: { fields: true, addField: true, edit: true, relationships: false },
    } as Metadata["scopes"][string];
    const fields: Record<string, FieldDef> = {};
    const links: Record<string, { entity?: string; type?: string }> = {};
    for (const field of entity.fields) {
      const [name, def] = toFieldDef(field);
      fields[name] = def;
      if (def.type === "link") links[name] = { entity: def.entity as string, type: "belongsTo" };
      if (field.key === "ownerId") { fields[name] = { ...def, type: "link", entity: "User" }; links[name] = { entity: "User", type: "belongsTo" }; }
      if (field.key === "teamIds") { fields[name] = { ...def, type: "linkMultiple", entity: "Team" }; links[name] = { entity: "Team", type: "hasMany" }; }
      if (field.key === "createdById") { fields[name] = { ...def, type: "link", entity: "User", readOnly: true }; links[name] = { entity: "User", type: "belongsTo" }; }
    }
    // The display name of a record is computed (name, subject or first + last name); it is not a field of the schema.
    if (!fields.name) fields.name = { type: "varchar", label: entity.labelSingular, notStorable: true, readOnly: true, utility: true };
    entityDefs[scope] = { object: true, fields, links, collection: { orderBy: "createdAt", order: "desc" } };
    scopeNames[scope] = entity.labelSingular;
    scopeNamesPlural[scope] = entity.labelPlural;
    // related records: every link that points at this entity gives a panel with the records that refer to it
    const panels: Array<{ name: string; label: string }> = [];
    for (const reverse of reverseLinks(entity.key)) {
      const from = source.entities.find((candidate) => candidate.key === reverse.entityKey);
      if (!from) continue;
      links[reverse.name] = { entity: scopeOf(reverse.entityKey), type: "hasMany", foreign: reverse.field } as { entity?: string; type?: string };
      panels.push({ name: reverse.name, label: from.labelPlural });
    }
    clientDefs[scope] = { iconClass: ICONS[scope] ?? "fas fa-cube", ...(panels.length ? { bottomPanels: { detail: panels } } : {}) };
    labels[scope] = { fields: Object.fromEntries(Object.entries(fields).map(([name, def]) => [name, String(def.label ?? name)])) };
  });

  const names = (name: string, cs: string, en: string) => { scopeNames[name] = locale === "en" ? en : cs; scopeNamesPlural[name] = locale === "en" ? en : cs; };
  for (const [scope, cs, en] of [["User", "Uživatel", "User"], ["Team", "Tým", "Team"]] as const) {
    scopes[scope] = { entity: true, object: true, tab: false, layouts: false, acl: true } as Metadata["scopes"][string];
    entityDefs[scope] = { object: true, fields: { name: { type: "varchar", label: scope === "User" ? "Name" : "Name" }, userName: { type: "varchar" } }, links: {}, collection: { orderBy: "name", order: "asc" } };
    clientDefs[scope] = { iconClass: ICONS[scope] };
    names(scope, cs, en);
  }
  for (const item of UNSUPPORTED_SCOPES) {
    scopes[item.scope] = { entity: true, object: true, tab: true, acl: true, layouts: false, unsupported: true, tabLabel: item.label[locale], order: 1000 } as Metadata["scopes"][string];
    entityDefs[item.scope] = { object: true, fields: {}, links: {}, collection: {} };
    clientDefs[item.scope] = { iconClass: item.icon };
    names(item.scope, item.label.cs, item.label.en);
  }
  labels.Global = { scopeNames, scopeNamesPlural } as NonNullable<Metadata["labels"]>[string];

  // Navigation: the entities of ViaCRM in schema order, then the locked ones of the previous backend.
  const tabList = [
    "Home",
    ...source.entities.filter((entity) => !NO_TAB.has(entity.key)).map((entity) => scopeOf(entity.key)),
    "_delimiter_",
    ...UNSUPPORTED_SCOPES.map((item) => item.scope),
  ];
  const features = perms.features ?? {};
  const userAcl: UserAcl = {
    table: aclTable(perms, source.entities),
    fieldTable: fieldTable(perms),
    exportPermission: "no",                                   // ViaCRM has no export yet
    massUpdatePermission: perms.isAdmin || features.massUpdate ? "yes" : "no",
    assignmentPermission: "all",
  };
  return {
    scopes, entityDefs, clientDefs, labels, userAcl,
    fields: {}, logicDefs: {}, app: {},
    appSettings: { applicationName: "ViaCRM", theme: "Espo", tabQuickSearch: false, globalSearchEntityList: [], quickCreateList: [], tabList },
    appParams: { isRestrictedMode: false, extensions: [] },
  } as Metadata;
}

export async function loadMetadata(): Promise<Metadata> {
  const [entities, permissions] = await Promise.all([
    apiJson<ViaEntities>("/v1/meta/entities"),
    apiJson<ViaPermissions>("/v1/me/permissions"),
  ]);
  setSchema(entities.entities);
  clearLookupCache();
  return buildMetadata(entities, permissions);
}

export { keyOf, scopeOf };
