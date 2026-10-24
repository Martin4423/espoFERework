export type User = { id: string; name: string; userName: string; type?: string; portalId?: string };
export type Session = { username: string; token: string; user: User };
export type PendingSecondStep = { secondStepRequired: true; username: string; token: string; message?: string };
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

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly statusReason?: { reason?: string; data?: any };
  constructor(message: string, status: number, data: unknown, statusReason?: { reason?: string; data?: any }) { super(message); this.name = "ApiError"; this.status = status; this.data = data; this.statusReason = statusReason; }
}

const SESSION_KEY = "via-espo-session";
let current: Session | null = (() => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
})();

function authHeader(session: Session) {
  return btoa(`${session.username}:${session.token}`);
}

export function getSession() { return current; }

function storeLogin(username: string, body: any): Session {
  if (!body.user?.token) throw new Error(body.message || "Odpověď EspoCRM neobsahuje přihlašovací token.");
  current = { username: body.user.userName || username, token: body.user.token, user: body.user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(current));
  return current;
}

export async function login(username: string, password: string): Promise<Session | PendingSecondStep> {
  const auth = btoa(`${username}:${password}`);
  const response = await fetch("/api/v1/App/user", { headers: {
    Authorization: `Basic ${auth}`,
    "Espo-Authorization": auth,
    "Espo-Authorization-By-Token": "false",
    "Espo-Authorization-Create-Token-Secret": "true",
  } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.headers.get("X-Status-Reason") === "second-step-required") {
    if (!body.token) throw new Error(body.message || "EspoCRM vyžaduje druhý ověřovací krok, ale neposlalo jeho přihlašovací údaj.");
    return { secondStepRequired: true, username, token: body.token, message: body.message };
  }
  if (!response.ok) throw new Error(body.message || "Přihlašovací údaje nejsou správné.");
  return storeLogin(username, body);
}

export async function completeSecondStepLogin(pending: PendingSecondStep, code: string): Promise<Session> {
  const cleanCode = code.replace(/\s/g, "");
  if (!cleanCode) throw new Error("Zadejte ověřovací kód.");
  const auth = btoa(`${pending.username}:${pending.token}`);
  const response = await fetch("/api/v1/App/user", { headers: {
    Authorization: `Basic ${auth}`,
    "Espo-Authorization": auth,
    "Espo-Authorization-Code": cleanCode,
    "Espo-Authorization-Create-Token-Secret": "true",
  } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || (response.status === 401 ? "Ověřovací kód není správný nebo už vypršel." : "Druhý ověřovací krok se nezdařil."));
  return storeLogin(pending.username, body);
}

export async function restoreSession(): Promise<Session | null> {
  if (!current) return null;
  try {
    const body = await request<{ user: User }>("App/user");
    current.user = body.user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(current));
    return current;
  } catch {
    logout();
    return null;
  }
}

export function logout() {
  current = null;
  localStorage.removeItem(SESSION_KEY);
}

export async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (!current) throw new Error("Přihlášení vypršelo.");
  const headers = new Headers(init.headers);
  headers.set("Espo-Authorization", authHeader(current));
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/v1/${path}`, { ...init, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    if (response.status === 401) {
      logout();
      window.dispatchEvent(new Event("via-session-expired"));
    }
    const statusReasonHeader = response.headers.get("X-Status-Reason");
    let statusReason: ApiError["statusReason"];
    if (statusReasonHeader) {
      try { statusReason = JSON.parse(statusReasonHeader); }
      catch { statusReason = { reason: statusReasonHeader, data: body }; }
    }
    throw new ApiError(body?.message || body?.error || `CRM API vrátilo chybu ${response.status}.`, response.status, body, statusReason);
  }
  return body as T;
}

export async function downloadAttachment(id: string, name: string) {
  if (!current) throw new Error("Přihlášení vypršelo.");
  const response = await fetch(`/api/v1/Attachment/file/${encodeURIComponent(id)}`, { headers: { "Espo-Authorization": authHeader(current) } });
  if (!response.ok) throw new Error(`Soubor se nepodařilo stáhnout (${response.status}).`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name || "priloha"; anchor.style.display = "none"; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function getAttachmentPreviewUrl(id: string): Promise<string> {
  if (!current) throw new Error("Přihlášení vypršelo.");
  const response = await fetch(`/api/v1/Attachment/file/${encodeURIComponent(id)}`, { headers: { "Espo-Authorization": authHeader(current) } });
  if (!response.ok) throw new Error(`Náhled souboru se nepodařil načíst (${response.status}).`);
  return URL.createObjectURL(await response.blob());
}

export async function uploadAttachment(file: File, entity: string, field: string, multiple = false, role = "Attachment"): Promise<{ id: string; name: string; type: string }> {
  const inline = role === "Inline Attachment";
  const options = { name: file.name, type: file.type || "application/octet-stream", size: file.size, role, field, ...(inline ? { global: true, relatedType: entity } : multiple ? { parentType: entity } : { relatedType: entity }) };
  if (!file.size) {
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    const attachment = await request("Attachment", { method: "POST", body: JSON.stringify({ ...options, file: data }) });
    return { id: attachment.id, name: file.name, type: options.type };
  }
  const attachment = await request("Attachment", { method: "POST", body: JSON.stringify({ ...options, isBeingUploaded: true }) });
  const chunkSize = 1024 * 1024;
  for (let start = 0; start < file.size; start += chunkSize) {
    const chunk = file.slice(start, Math.min(start + chunkSize, file.size));
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(chunk); });
    await request(`Attachment/chunk/${encodeURIComponent(attachment.id)}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: data });
  }
  return { id: attachment.id, name: file.name, type: options.type };
}

export async function fetchMetadata() {
  const userId = current?.user.id;
  const [metadata, labels, userAcl, appData] = await Promise.all([
    request<Metadata>("Metadata"),
    request<Metadata["labels"]>("I18n"),
    userId ? request<UserAcl>(`User/${encodeURIComponent(userId)}/acl`).catch(() => undefined) : Promise.resolve(undefined),
    request<{ appParams?: Record<string, any>; settings?: Record<string, any> }>("App/user"),
  ]);
  metadata.labels = labels || {};
  metadata.userAcl = userAcl;
  metadata.appSettings = appData.settings || {};
  metadata.appParams = appData.appParams || {};
  return metadata;
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
  return request<T>(`${encodeURIComponent(entity)}/layout/${encodeURIComponent(name)}`);
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
  const preferred = ["Account", "Contact", "Lead", "Opportunity", "Case", "Call", "Meeting", "Task", "Email", "Campaign"];
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
    (["varchar", "personName", "address", "text", "enum", "enumInt", "enumFloat", "multiEnum", "arrayInt", "barcode", "bool", "date", "datetime", "datetimeOptional", "int", "float", "currency", "url", "urlMultiple", "email", "phone", "wysiwyg", "array", "jsonObject", "jsonArray", "password", "colorpicker", "file", "image", "attachmentMultiple", "checklist", "linkParent"].includes(def.type || "") || ["link", "linkOne", "linkMultiple"].includes(def.type || "") && Boolean(metadata.entityDefs?.[entity]?.links?.[name]?.entity))
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
