import { toUser } from "./auth/client.ts";
import { apiJson, auth } from "./http.ts";
import { loadMetadata } from "./adapter/metadata.ts";
import { legacyRequest } from "./adapter/router.ts";
import { clearLayoutCache, loadLayout } from "./adapter/layouts.ts";
import type { MeResponse, Session } from "./auth/client.ts";
import { ApiError, UnsupportedError } from "./problem.ts";

export type { Session, User } from "./auth/client.ts";
export { ApiError, UnsupportedError, isUnsupported } from "./problem.ts";
export type UserAcl = { table?: Record<string, boolean | Record<string, string>>; fieldTable?: Record<string, Record<string, Record<string, string>>>; exportPermission?: string; massUpdatePermission?: string; [key: string]: any };
export type FieldDef = {
  type?: string;
  label?: string;
  required?: boolean;
  readOnly?: boolean;
  notStorable?: boolean;
  disabled?: boolean;
  options?: Array<string | number>;
  entityList?: string[];
  accept?: string[];
  maxLength?: number;
  default?: unknown;
  view?: string;
  utility?: boolean;
  hidden?: boolean;
  importDisabled?: boolean;
  relateOnImport?: boolean;
  [key: string]: any;
};
export type Metadata = {
  scopes: Record<string, { entity?: boolean; object?: boolean; tab?: boolean; aclPortal?: boolean; layouts?: boolean; calendar?: boolean; importable?: boolean; customizable?: boolean; isCustom?: boolean; isNotRemovable?: boolean; disabled?: boolean; stream?: boolean; stars?: boolean; type?: string; statusField?: string; statusFieldLocked?: boolean; kanbanStatusIgnoreList?: string[]; kanbanOrderDisabled?: boolean; entityManager?: { relationships?: boolean; edit?: boolean; fields?: boolean; addField?: boolean }; module?: string; tabLabel?: string; order?: number }>;
  entityDefs: Record<string, { object?: boolean; fields?: Record<string, FieldDef>; links?: Record<string, { entity?: string; type?: string }>; collection?: Record<string, unknown>; sourceList?: string[] }>;
  clientDefs?: Record<string, Record<string, any>>;
  fields?: Record<string, { notCreatable?: boolean; readOnly?: boolean; filter?: boolean; textFilter?: boolean; orderDisabled?: boolean; notSortable?: boolean; actualFields?: string[]; naming?: "prefix" | "suffix"; dynamicLogicOptions?: unknown; params?: Array<{ name: string; type?: string; default?: unknown }> }>;
  logicDefs?: Record<string, any>;
  app?: Record<string, any>;
  appSettings?: Record<string, any>;
  appParams?: Record<string, any>;
  userAcl?: UserAcl;
  labels?: Record<string, { fields?: Record<string, string>; scopeNames?: Record<string, string>; scopeNamesPlural?: Record<string, string> }>;
};
export type LayoutItem = { name?: string; label?: string; fullWidth?: boolean; width?: number; widthPx?: number; hidden?: boolean; link?: boolean; notSortable?: boolean; align?: "left" | "right" | "center" } | false;
export type DetailLayoutPanel = { label?: string; rows?: LayoutItem[][]; tabBreak?: boolean; tabLabel?: string };

export function getSession(): Session | null { return auth.getSession(); }

export function login(email: string, password: string): Promise<Session> { return auth.login(email, password); }

// Loads the signed-in user again (and so refreshes the tokens when needed). Null when there is no usable session;
// a network or server failure is thrown so the caller can offer a retry instead of signing the user out.
export async function restoreSession(): Promise<Session | null> {
  if (!auth.getSession()) return null;
  try {
    const me = await apiJson<MeResponse>("/v1/me");
    return auth.updateUser(toUser(me));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function logout() { void auth.logout(); }

// Legacy entry point of the screens written for the previous backend. /v1 paths go straight to the API; the old REST
// shape is answered by the adapter router; everything else is a feature that is not migrated (or not offered by
// ViaCRM yet) and ends in the "not available" notice.
export async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith("/v1/")) return apiJson<T>(normalized, init);
  return legacyRequest(path, init) as Promise<T>;
}

export async function downloadAttachment(_id: string, _name: string): Promise<void> { throw new UnsupportedError("Attachment/file"); }

export async function getAttachmentPreviewUrl(_id: string): Promise<string> { throw new UnsupportedError("Attachment/file"); }

export async function uploadAttachment(_file: File, _entity: string, _field: string, _multiple = false, _role = "Attachment"): Promise<{ id: string; name: string; type: string }> { throw new UnsupportedError("Attachment"); }

export async function fetchMetadata(): Promise<Metadata> {
  clearLayoutCache();
  return loadMetadata();
}

export function aclLevel(metadata: Metadata, entity: string, action: string): string | null {
  const table = metadata.userAcl?.table;
  if (!table) return null;
  const scope = table[entity];
  if (scope === true) return "all";
  if (scope === false || scope == null) return "no";
  return scope[action] || "no";
}

export function canCreateEntity(metadata: Metadata, entity: string): boolean {
  const level = aclLevel(metadata, entity, "create");
  return level === null || level === "yes" || level === "all";
}

export function canAccessEntity(metadata: Metadata, entity: string): boolean {
  const level = aclLevel(metadata, entity, "read");
  return level === null || level !== "no";
}

export function canChangeEntity(metadata: Metadata, entity: string, action: "edit" | "delete"): boolean {
  const level = aclLevel(metadata, entity, action);
  return level === null || level !== "no";
}

export function canUsePermission(metadata: Metadata, permission: "exportPermission" | "massUpdatePermission"): boolean {
  const level = metadata.userAcl?.[permission];
  return level == null || level === "yes" || level === "all";
}

export async function fetchLayout<T = LayoutItem[] | DetailLayoutPanel[]>(entity: string, name: string): Promise<T> {
  return (await loadLayout(entity, name)) as T;
}

export function humanize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}

export function entityLabel(metadata: Metadata, name: string, plural = false) {
  return metadata.labels?.Global?.[plural ? "scopeNamesPlural" : "scopeNames"]?.[name] || humanize(name);
}

export function fieldLabel(name: string, def?: FieldDef, entity?: string, metadata?: Metadata) {
  return def?.label || (entity && metadata?.labels?.[entity]?.fields?.[name]) || humanize(name.replace(/Name$/, ""));
}

export function entityList(metadata: Metadata) {
  const preferred = ["Account", "Contact", "Lead", "Deal", "Quote", "Product", "Task", "Call", "Meeting", "Email", "Case", "Campaign"];
  const names = Object.entries(metadata.scopes || {})
    .filter(([name, scope]) => scope.entity && scope.tab && metadata.entityDefs?.[name]?.fields && canAccessEntity(metadata, name))
    .map(([name]) => name);
  return [...new Set([...preferred.filter((name) => names.includes(name)), ...names.filter((name) => !preferred.includes(name)).sort((a, b) => a.localeCompare(b))])];
}

export function getListFields(metadata: Metadata, entity: string) {
  const fields = metadata.entityDefs?.[entity]?.fields || {};
  const preferred = ["name", "subject", "firstName", "lastName", "accountName", "emailAddress", "status", "stage", "amount", "closeDate", "assignedUserName", "createdAt"];
  const chosen = preferred.filter((name) => fields[name] && !fields[name].utility);
  for (const [name, def] of Object.entries(fields)) {
    if (chosen.length >= 6) break;
    if (chosen.includes(name) || def.utility || def.notStorable || def.type === "text" || name.endsWith("Id") || name.endsWith("Data")) continue;
    if (["varchar", "enum", "date", "datetime", "bool", "currency", "int", "float", "url", "email", "phone", "link"].includes(def.type || "")) chosen.push(name);
  }
  return chosen.slice(0, 6);
}

export function getFormFields(metadata: Metadata, entity: string) {
  const fields = metadata.entityDefs?.[entity]?.fields || {};
  const ordered = Object.entries(fields).filter(([name, def]) =>
    !def.notStorable && !def.utility && !def.readOnly && !def.disabled && !def.hidden && !def.layoutDetailDisabled && !name.endsWith("Id") && !name.endsWith("Data") &&
    (["varchar", "personName", "address", "text", "enum", "enumInt", "enumFloat", "multiEnum", "arrayInt", "barcode", "bool", "date", "datetime", "datetimeOptional", "int", "float", "currency", "rangeInt", "rangeFloat", "rangeCurrency", "url", "urlMultiple", "email", "phone", "wysiwyg", "array", "jsonObject", "jsonArray", "password", "colorpicker", "file", "image", "attachmentMultiple", "checklist", "linkParent"].includes(def.type || "") || ["link", "linkOne", "linkMultiple"].includes(def.type || "") && Boolean(metadata.entityDefs?.[entity]?.links?.[name]?.entity))
  );
  const incompatibleFields = new Set(ordered.flatMap(([, def]) => (def.detailLayoutIncompatibleFieldList || []) as string[]));
  const compatible = ordered.filter(([name]) => !incompatibleFields.has(name));
  compatible.sort((a, b) => Number(Boolean(b[1].required)) - Number(Boolean(a[1].required)));
  return compatible;
}

/** Fields with native virtual values that are writable through record API actions. */
export function getEditorFields(metadata: Metadata, entity: string): [string, FieldDef][] {
  const fields = getFormFields(metadata, entity);
  if (entity === "User") {
    // Espo's user editor renders these fields in its own panels, so the server
    // marks them layoutDetailDisabled even though they remain editable.
    const userPanelFields = new Set([
      "type", "isActive", "teams", "defaultTeam", "roles", "portals", "accounts",
      "portalRoles", "contact", "dashboardTemplate", "workingTimeCalendar", "layoutSet",
      "authMethod", "sendAccessInfo",
    ]);
    const present = new Set(fields.map(([name]) => name));
    for (const [name, def] of Object.entries(metadata.entityDefs?.User?.fields || {})) {
      if (!userPanelFields.has(name) || present.has(name)) continue;
      if (def.readOnly || def.disabled || def.hidden || def.utility || (def.notStorable && name !== "sendAccessInfo")) continue;
      fields.push([name, def]);
    }
    if (fields.some(([name]) => name === "password") && !present.has("passwordConfirm")) {
      fields.push(["passwordConfirm", { ...(metadata.entityDefs?.User?.fields?.password || { type: "password" }), label: "passwordConfirm" }]);
    }
  }
  if (["Meeting", "Call", "Task"].includes(entity)) {
    const reminders = metadata.entityDefs?.[entity]?.fields?.reminders;
    const permission = metadata.userAcl?.fieldTable?.[entity]?.reminders;
    if (reminders && permission?.read !== "no" && permission?.edit !== "no" && !fields.some(([name]) => name === "reminders")) fields.push(["reminders", reminders]);
  }
  if (["Meeting", "Call"].includes(entity)) {
    const duration = metadata.entityDefs?.[entity]?.fields?.duration;
    const permission = metadata.userAcl?.fieldTable?.[entity]?.duration;
    if (duration && permission?.read !== "no" && permission?.edit !== "no" && !fields.some(([name]) => name === "duration")) fields.push(["duration", duration]);
    const assignmentPermission = (metadata.userAcl as any)?.assignmentPermission;
    for (const name of ["users", "contacts", "leads"]) {
      const def = metadata.entityDefs?.[entity]?.fields?.[name];
      const target = metadata.entityDefs?.[entity]?.links?.[name]?.entity;
      const fieldAcl = metadata.userAcl?.fieldTable?.[entity]?.[name];
      if (!def || !target || metadata.scopes?.[target]?.disabled || !canAccessEntity(metadata, target) || fieldAcl?.read === "no" || fieldAcl?.edit === "no") continue;
      if (name === "users" && assignmentPermission === "no") continue;
      if (!fields.some(([fieldName]) => fieldName === name)) fields.push([name, def]);
    }
  }
  return fields.filter(([name]) => {
    const permissionName = name === "passwordConfirm" ? "password" : name;
    const permission = metadata.userAcl?.fieldTable?.[entity]?.[permissionName];
    return permission?.read !== "no" && permission?.edit !== "no";
  });
}
