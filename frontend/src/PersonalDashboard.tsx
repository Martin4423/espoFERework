import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, PointerEvent, ReactNode } from "react";
import { Activity, ArrowDown, ArrowUp, BarChart3, CalendarDays, Check, ChevronDown, Clock3, GripVertical, Mail, Plus, RefreshCw, RotateCcw, Send, Settings2, Star, Trash2, Users, X } from "./Icons";
import { aclLevel, canAccessEntity, canChangeEntity, canCreateEntity, entityLabel, entityList, request } from "./api";
import type { Metadata, User } from "./api";
import SelectRecordsDialog from "./SelectRecordsDialog";
import { findDashletPosition, packDashboardItems, placeDashboardItem } from "./dashboardGrid";

type Data = Record<string, any>;
type Dashlet = { id: string; name: string; x?: number; y?: number; width?: number; height?: number };
type DashTab = { name: string; layout: Dashlet[] };
type DashTabDraft = { sourceIndex: number | null; name: string };
const defaultLayout: DashTab[] = [{ name: "My Espo", layout: [{ id: "default-activities", name: "Activities", x: 2, y: 2, width: 2, height: 4 }, { id: "default-stream", name: "Stream", x: 0, y: 0, width: 2, height: 4 }] }];
const entityByDashlet: Record<string, string> = { Leads: "Lead", Opportunities: "Opportunity", Cases: "Case", Calls: "Call", Meetings: "Meeting", Tasks: "Task", Emails: "Email" };

function taskDeadlineSummary(row: Data, timeZone: string): { kind: "overdue" | "today" | "normal" | "none"; label: string } {
  const dateOnly = Boolean(row.dateEndDate);
  const raw = dateOnly ? row.dateEndDate : row.dateEnd;
  if (!raw) return { kind: "none", label: "" };
  const date = dateOnly ? new Date(`${String(raw).slice(0, 10)}T12:00:00Z`) : new Date(`${String(raw).replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return { kind: "none", label: "" };
  const terminal = ["Completed", "Canceled"].includes(String(row.status || ""));
  let kind: "overdue" | "today" | "normal" = "normal";
  if (!terminal && dateOnly) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const today = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
    const dueDay = String(raw).slice(0, 10);
    kind = dueDay < today ? "overdue" : dueDay === today ? "today" : "normal";
  } else if (!terminal && date.getTime() < Date.now()) kind = "overdue";
  let dateLabel = "";
  try {
    dateLabel = new Intl.DateTimeFormat("cs-CZ", dateOnly
      ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(date);
  } catch { dateLabel = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short" }).format(date); }
  return { kind, label: `${dateLabel}${kind === "overdue" ? " · Po termínu" : kind === "today" ? " · Dnes" : ""}` };
}

function dashletFieldValue(row: Data, entity: string, item: Data, metadata: Metadata): string {
  const name = String(item.name || "");
  const field = metadata.entityDefs?.[entity]?.fields?.[name] || {};
  const raw = (metadata.entityDefs?.[entity]?.links?.[name] || field.type === "link") ? row[`${name}Name`] || row[name] || row[`${name}Id`] : row[name];
  if (raw === null || raw === undefined || raw === "") return "—";
  if (typeof raw === "boolean") return raw ? "Ano" : "Ne";
  if (Array.isArray(raw)) return raw.map((value) => typeof value === "object" ? value.name || value.id || "" : String(value)).filter(Boolean).join(", ");
  if (typeof raw === "object") return raw.name || raw.value || JSON.stringify(raw);
  if (["date", "datetime", "datetimeOptional"].includes(field.type || "") && !Number.isNaN(Date.parse(String(raw)))) {
    return new Intl.DateTimeFormat("cs-CZ", field.type === "date" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(raw)));
  }
  return String(raw);
}

function dashletExpandedValue(row: Data, entity: string, item: Data, metadata: Metadata): ReactNode | null {
  const name = String(item.name || "");
  const field = metadata.entityDefs?.[entity]?.fields?.[name] || {};
  const value = dashletFieldValue(row, entity, item, metadata);
  if (value === "—" && name !== "name") return null;
  if (field.type?.startsWith("enum") && row[name] != null) {
    const raw = String(row[name]);
    const style = String(field.style?.[raw] || "default");
    if (entity === "Task" && name === "priority" && style === "default") return null;
    const label = (metadata.labels as any)?.[entity]?.options?.[name]?.[raw] || value;
    const tone = ["warning", "danger", "success", "info", "primary"].includes(style) ? style : "default";
    return <span className={`dashlet-enum-label ${tone}`}>{label}</span>;
  }
  return <span>{value}</span>;
}

const chartColors = ["#6258d6", "#36a27b", "#e39a42", "#4285c5", "#d66a7e", "#7f68ad", "#5b9b9f", "#b28c48", "#61768f", "#bd6b47"];

function DashletChart({ name, rows, currency }: { name: string; rows: Data[]; currency: string }) {
  const maxValue = Math.max(1, ...rows.map((row) => Number(row.value) || 0));
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.value) || 0), 0);
  const formatValue = (value: unknown) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value ?? "0");
    try { return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: currency || "CZK", maximumFractionDigits: 0 }).format(number); }
    catch { return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(number); }
  };

  if (name === "OpportunitiesByLeadSource") {
    let angle = 0;
    const segments = rows.map((row, index) => {
      const start = angle;
      angle += total ? Math.max(0, Number(row.value) || 0) / total * 360 : 0;
      return `${chartColors[index % chartColors.length]} ${start}deg ${angle}deg`;
    });
    return <div className="dashlet-pie-chart"><div className="dashlet-pie" role="img" aria-label={`Rozdělení podle zdroje, celkem ${formatValue(total)}`} style={{ background: total ? `conic-gradient(${segments.join(",")})` : "#e8eaf0" }}/><div className="dashlet-chart-legend">{rows.map((row, index) => <div key={`${row.name}-${index}`}><i style={{ background: chartColors[index % chartColors.length] }}/><span>{row.name || "Bez zdroje"}</span><strong>{formatValue(row.value)}</strong></div>)}</div></div>;
  }

  if (name === "SalesByMonth") return <div className="dashlet-month-chart">{rows.map((row, index) => {
    const parsed = /^\d{4}-\d{2}/.test(String(row.name)) ? new Date(`${String(row.name).slice(0, 7)}-01T00:00:00`) : null;
    const label = parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat("cs-CZ", { month: "short" }).format(parsed) : String(row.name || "");
    const value = Number(row.value) || 0;
    return <div className="dashlet-month-column" key={`${row.name}-${index}`} title={`${row.name}: ${formatValue(value)}`}><strong>{formatValue(value)}</strong><i><b style={{ height: `${Math.max(2, value / maxValue * 100)}%`, background: chartColors[index % chartColors.length] }}/></i><small>{label}</small></div>;
  })}</div>;

  if (name === "SalesPipeline") return <div className="dashlet-funnel-chart">{rows.map((row, index) => {
    const width = total ? Math.max(34, Number(row.value) / maxValue * 100) : 34;
    return <div className="dashlet-funnel-row" key={`${row.name}-${index}`}><div className="dashlet-funnel-segment" style={{ width: `${width}%`, background: chartColors[index % chartColors.length] }}><span>{row.name}</span><strong>{formatValue(row.value)}</strong></div></div>;
  })}</div>;

  return <div className="personal-chart-list">{rows.map((row, index) => <div key={`${row.name}-${index}`} title={`${row.name}: ${formatValue(row.value)}`}><span><strong>{row.name}</strong><b>{formatValue(row.value)}</b></span><i><em style={{ width: `${Math.max(2, (Number(row.value) / maxValue) * 100)}%`, background: chartColors[index % chartColors.length] }}/></i></div>)}</div>;
}

function DashletCard({ item, user, metadata, options, appSettings, refreshKey, onOpenRecord, onComposeEmail, onCreateRecord }: { item: Dashlet; user: User; metadata: Metadata; options: Data; appSettings: Data; refreshKey: number; onOpenRecord: (scope: string, record: Data) => void; onComposeEmail: () => void; onCreateRecord: (scope: string) => void }) {
  const [rows, setRows] = useState<Data[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [postOpen, setPostOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [emailActionBusy, setEmailActionBusy] = useState("");
  const [activityActionBusy, setActivityActionBusy] = useState("");
  const definition = (metadata as any).dashlets?.[item.name] || {};
  const entity = definition.entityType || entityByDashlet[item.name] || options.entityType;
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  useEffect(() => { if (!["Task", "Activities", "Calendar"].includes(String(entity))) return; let live = true; request<Data>(`Preferences/${encodeURIComponent(user.id)}`).then((prefs) => live && typeof prefs.timeZone === "string" && Boolean(prefs.timeZone) && setTimeZone(prefs.timeZone)).catch(() => {}); return () => { live = false; }; }, [entity, user.id]);
  useEffect(() => {
    let live = true;
    async function load() {
      setBusy(true); setError("");
      try {
        if (item.name === "Stream") {
          if (aclLevel(metadata, "Stream", "read") === "no") { if (live) setRows([]); return; }
          const params = new URLSearchParams({ maxSize: String(Number(options.displayRecords || 8)), offset: "0" });
          if (options.skipOwn) params.set("skipOwn", "true");
          const data = await request<Data>(`Stream?${params}`);
          const list = Array.isArray(data) ? data : data.list || [];
          if (live) setRows(list);
        } else if (item.name === "Activities") {
          const allowedActivities = (options.enabledScopeList || ["Meeting", "Call", "Task"]).filter((scope: string) => canAccessEntity(metadata, scope));
          if (!allowedActivities.length) { if (live) setRows([]); return; }
          const params = new URLSearchParams({ maxSize: String(Number(options.displayRecords || 5)), futureDays: String(Number(options.futureDays ?? 30)) });
          allowedActivities.forEach((scope: string) => params.append("entityTypeList[]", scope));
          if (options.includeShared) params.set("includeShared", "true");
          const data = await request<Data[] | { list?: Data[] }>(`Activities/upcoming?${params}`);
          const list = Array.isArray(data) ? data : data.list || [];
          if (live) setRows(list);
        } else if (item.name === "Calendar") {
          const start = new Date(); start.setDate(start.getDate() - 7);
          const end = new Date(); end.setDate(end.getDate() + Math.max(7, Number(options.futureDays || 30)));
          const allowedActivities = (options.enabledScopeList || ["Meeting", "Call", "Task"]).filter((scope: string) => canAccessEntity(metadata, scope));
          if (!allowedActivities.length) { if (live) setRows([]); return; }
          const params = new URLSearchParams({ from: start.toISOString().slice(0, 19).replace("T", " "), to: end.toISOString().slice(0, 19).replace("T", " "), scopeList: allowedActivities.join(","), agenda: "true" });
          params.set("futureDays", String(Number(options.futureDays ?? 30)));
          if (options.includeShared) params.set("includeShared", "true");
          if (item.name === "Calendar") {
            if (options.mode === "timeline" && Array.isArray(options.usersIds) && options.usersIds.length) params.set("userIdList", options.usersIds.join(","));
            if (["basicWeek", "month", "basicDay"].includes(options.mode) && Array.isArray(options.teamsIds) && options.teamsIds.length) params.set("teamIdList", options.teamsIds.join(","));
          }
          const data = await request<Data[]>(`Activities?${params}`);
          if (live) setRows((data || []).slice(0, Number(options.displayRecords || 8)));
        } else if (item.name === "Memo") {
          if (live) setRows([]);
        } else if (item.name === "Emails" && canAccessEntity(metadata, "Email")) {
          const params = new URLSearchParams({ maxSize: String(Number(options.displayRecords || 5)), offset: "0", orderBy: "dateSent", order: "desc", where: JSON.stringify([{ type: "inFolder", attribute: "folderId", value: options.folder || "inbox" }]) });
          const data = await request<{ list?: Data[] }>(`Email?${params}`);
          if (live) setRows(data.list || []);
        } else if (entity && metadata.entityDefs?.[entity]?.fields && canAccessEntity(metadata, entity)) {
          const params = new URLSearchParams({ maxSize: String(Number(options.displayRecords || 8)), offset: "0", orderBy: options.sortBy || options.orderBy || metadata.entityDefs[entity]?.collection?.orderBy || "modifiedAt", order: options.sortDirection || options.order || metadata.entityDefs[entity]?.collection?.order || "desc" });
          const searchData = options.searchData && typeof options.searchData === "object" ? options.searchData : {};
          const primaryFilter = options.primaryFilter || searchData.primary;
          if (primaryFilter && primaryFilter !== "all") params.set("primaryFilter", primaryFilter);
          const savedBoolFilters = searchData.bool && typeof searchData.bool === "object"
            ? Object.entries(searchData.bool).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name)
            : [];
          const boolFilters = [...new Set([...(Array.isArray(options.boolFilterList) ? options.boolFilterList : []), ...savedBoolFilters])];
          boolFilters.forEach((filter) => params.append("boolFilterList[]", filter));
          if (options.includeShared && (metadata.scopes?.[entity] as Data | undefined)?.collaborators) params.set("includeShared", "true");
          const expandedItems = (options.expandedLayout?.rows || []).flatMap((row: any[]) => Array.isArray(row) ? row : []).filter((item: Data) => item?.name && metadata.entityDefs[entity]?.fields?.[item.name] && (metadata.userAcl?.fieldTable?.[entity]?.[item.name] as Data | undefined)?.read !== "no");
          const attributes = Array.from(new Set(["name", ...expandedItems.flatMap((item: Data) => {
            const fieldName = String(item.name);
            const field = metadata.entityDefs[entity]?.fields?.[fieldName] || {};
            return field.type === "link" || metadata.entityDefs[entity]?.links?.[fieldName] ? [fieldName, `${fieldName}Id`, `${fieldName}Name`, `${fieldName}Type`] : [fieldName];
          })]));
          if (expandedItems.length) params.set("select", attributes.join(","));
          const data = await request<{ list: Data[] }>(`${encodeURIComponent(entity)}?${params}`);
          if (live) setRows(data.list || []);
        } else if (["OpportunitiesByStage", "OpportunitiesByLeadSource", "SalesByMonth", "SalesPipeline"].includes(item.name) && canAccessEntity(metadata, "Opportunity")) {
          const action = { OpportunitiesByStage: "reportByStage", OpportunitiesByLeadSource: "reportByLeadSource", SalesByMonth: "reportSalesByMonth", SalesPipeline: "reportSalesPipeline" }[item.name];
          const params = new URLSearchParams({ dateFilter: options.dateFilter || "currentYear" });
          if (options.dateFilter === "between") { params.set("dateFrom", options.dateFrom || ""); params.set("dateTo", options.dateTo || ""); }
          if (item.name === "SalesPipeline" && options.useLastStage) params.set("useLastStage", "true");
          if (item.name === "SalesPipeline" && options.teamId) params.set("teamId", options.teamId);
          const data = await request<Data>(`Opportunity/action/${action}?${params}`);
          const chartRows = item.name === "SalesPipeline" && Array.isArray(data?.dataList)
            ? data.dataList.map((row: Data) => ({ name: (metadata.labels as any)?.Opportunity?.options?.stage?.[row.stage] || row.stageTranslated || row.stage || "", value: row.value }))
            : Object.entries(data || {}).map(([name, value]) => ({ name: (metadata.labels as any)?.Opportunity?.options?.stage?.[name] || name, value }));
          if (live) setRows(chartRows);
        } else if (live) setRows([]);
      } catch (cause) { if (live) setError(cause instanceof Error ? cause.message : "Obsah panelu nelze načíst."); }
      finally { if (live) setBusy(false); }
    }
    void load();
    return () => { live = false; };
  }, [item.name, item.id, user.id, entity, options.folder, options.displayRecords, options.enabledScopeList, options.futureDays, options.includeShared, options.orderBy, options.sortBy, options.sortDirection, options.order, options.primaryFilter, options.boolFilterList?.join(","), JSON.stringify(options.searchData || {}), options.dateFilter, options.dateFrom, options.dateTo, options.useLastStage, options.teamId, options.teamsIds, options.usersIds, metadata, refreshIndex, refreshKey]);
  const title = options.title || (metadata as any).labels?.dashlets?.[item.name] || item.name;
  const expandedItems: Data[] = Array.isArray(options.expandedLayout?.rows) ? options.expandedLayout.rows.flatMap((row: any[]) => Array.isArray(row) ? row : []).filter((field: Data) => field?.name) : [];
  const createScopes = (item.name === "Activities" ? options.enabledScopeList || ["Meeting", "Call", "Task"] : entity ? [entity] : []).filter((scope: string) => canAccessEntity(metadata, scope) && canCreateEntity(metadata, scope) && Boolean(metadata.scopes?.[scope]?.entity) && !metadata.scopes?.[scope]?.disabled && !metadata.clientDefs?.[scope]?.createDisabled);
  async function createPost() {
    if (!postText.trim()) return;
    setPosting(true); setError("");
    try { await request("Note", { method: "POST", body: JSON.stringify({ type: "Post", targetType: "self", post: postText.trim() }) }); setPostText(""); setPostOpen(false); setRefreshIndex((value) => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Příspěvek se nepodařilo odeslat."); }
    finally { setPosting(false); }
  }
  async function runEmailAction(row: Data, action: "important" | "trash" | "retrieve" | "remove") {
    if (!row.id || emailActionBusy) return;
    if (action === "remove" && !window.confirm("Opravdu chcete tento e-mail odstranit?")) return;
    setEmailActionBusy(`${row.id}:${action}`); setError("");
    try {
      if (action === "important") await request("Email/inbox/important", { method: row.isImportant ? "DELETE" : "POST", body: JSON.stringify({ id: row.id }) });
      else if (action === "trash") await request("Email/inbox/inTrash", { method: "POST", body: JSON.stringify({ id: row.id }) });
      else if (action === "retrieve") await request("Email/inbox/inTrash", { method: "DELETE", body: JSON.stringify({ id: row.id }) });
      else await request(`Email/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      if (action === "important") setRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, isImportant: !row.isImportant } : entry));
      else setRows((current) => current.filter((entry) => entry.id !== row.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Akci s e-mailem se nepodařilo provést."); }
    finally { setEmailActionBusy(""); }
  }
  async function runActivityAction(row: Data, action: "complete" | "held" | "notHeld" | "remove") {
    const scope = String(row.scope || row.entityType || entity || "");
    const id = String(row.id || row.recordId || "");
    if (!scope || !id || activityActionBusy) return;
    if (action === "remove" && !window.confirm("Opravdu chcete tento záznam odstranit?")) return;
    setActivityActionBusy(`${id}:${action}`); setError("");
    try {
      if (action === "complete") await request(`${encodeURIComponent(scope)}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "Completed" }) });
      else if (action === "held" || action === "notHeld") await request(`${encodeURIComponent(scope)}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: action === "held" ? "Held" : "Not Held" }) });
      else await request(`${encodeURIComponent(scope)}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (action === "held" || action === "notHeld") setRefreshIndex((value) => value + 1);
      else setRows((current) => current.filter((item) => String(item.id || item.recordId) !== id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Akci s aktivitou se nepodařilo provést."); }
    finally { setActivityActionBusy(""); }
  }
  const icon = item.name === "Activities" || item.name === "Stream" ? Activity : item.name === "Calendar" ? CalendarDays : item.name === "Emails" ? Mail : item.name.includes("Opportunities") || item.name.includes("Sales") ? BarChart3 : Users;
  const Icon = icon;
  const isChart = ["OpportunitiesByStage", "OpportunitiesByLeadSource", "SalesByMonth", "SalesPipeline"].includes(item.name);
  let safeIframeUrl = "";
  if (item.name === "Iframe" && options.url) {
    try { const url = new URL(options.url); if (["http:", "https:"].includes(url.protocol)) safeIframeUrl = url.toString(); } catch { /* Invalid URLs are not loaded. */ }
  }
  let iframeSandbox: string | undefined = "allow-scripts";
  if (safeIframeUrl) { try { if ((appSettings.iframeSandboxExcludeDomainList || []).includes(new URL(safeIframeUrl).hostname)) iframeSandbox = undefined; } catch { /* Keep the restrictive default. */ } }
  return <section className="surface personal-dashlet"><header><span className="personal-dashlet-icon"><Icon size={16}/></span><h2>{title}</h2>{item.name === "Stream" && <button className="icon-button" aria-label="Napsat příspěvek" title="Napsat příspěvek" onClick={() => setPostOpen(true)}><Plus size={14}/></button>}{item.name === "Emails" && canCreateEntity(metadata, "Email") && <button className="icon-button" aria-label="Napsat e-mail" title="Napsat e-mail" onClick={onComposeEmail}><Plus size={14}/></button>}{createScopes.length === 1 && <button className="icon-button" aria-label={`Vytvořit ${entityLabel(metadata, createScopes[0])}`} title={`Vytvořit ${entityLabel(metadata, createScopes[0])}`} onClick={() => onCreateRecord(createScopes[0])}><Plus size={14}/></button>}{createScopes.length > 1 && <div className="dashlet-create-menu"><button className="icon-button" aria-label="Vytvořit aktivitu" title="Vytvořit aktivitu" aria-expanded={createMenuOpen} onClick={() => setCreateMenuOpen((value) => !value)}><Plus size={14}/></button>{createMenuOpen && <div className="dashlet-create-popover">{createScopes.map((scope: string) => <button type="button" key={scope} onClick={() => { setCreateMenuOpen(false); onCreateRecord(scope); }}>Vytvořit {entityLabel(metadata, scope)}</button>)}</div>}</div>}<button className="icon-button" aria-label="Obnovit panel" onClick={() => setRefreshIndex((value) => value + 1)}><RefreshCw size={13}/></button></header>
    {item.name === "Memo" ? <div className="personal-memo">{options.text || "Poznámka je prázdná. Upravte nastavení panelu."}</div> : item.name === "Iframe" ? safeIframeUrl ? <iframe className="personal-dashlet-iframe" title={title} src={safeIframeUrl} sandbox={iframeSandbox}/> : <div className="personal-dashlet-empty">Nastavte platnou adresu http nebo https.</div> : busy ? <div className="table-loading"><span className="spinner"/>Načítám…</div> : error && item.name !== "Stream" ? <div className="dashlet-error">{error}</div> : rows.length ? isChart ? <DashletChart name={item.name} rows={rows} currency={String(appSettings.defaultCurrency || "CZK")}/> : <div className="personal-dashlet-list">{rows.map((row, index) => { const scope = row.scope || row.entityType || entity || ""; const id = row.recordId || row.id; const text = item.name === "Emails" ? row.subject || "(bez předmětu)" : row.name || row.title || row.subject || row.message || row.nameValue || "Aktivita"; const taskDue = scope === "Task" ? taskDeadlineSummary(row, timeZone) : null; const hasExpandedTaskDeadline = scope === "Task" && expandedItems.some((field: Data) => field.name === "dateEnd"); const subtitle = item.name === "Emails" ? [row.personStringData || row.fromString || row.fromName || row.fromAddress, row.dateSent].filter(Boolean).join(" · ") : `${scope ? entityLabel(metadata, scope) : row.createdByName || row.createdAt || ""}${taskDue?.label && !hasExpandedTaskDeadline ? ` · ${taskDue.label}` : row.dateStart ? ` · ${row.dateStart}` : ""}`; const isEmail = item.name === "Emails"; const rowBusy = emailActionBusy.startsWith(`${row.id}:`); const activityBusy = activityActionBusy.startsWith(`${row.id || row.recordId}:`); const trash = Boolean(row.inTrash); const canEditActivity = Boolean(scope) && canChangeEntity(metadata, String(scope), "edit"); const canRemoveActivity = Boolean(scope) && canChangeEntity(metadata, String(scope), item.name === "Activities" || item.name === "Calendar" ? "edit" : "delete"); const isTask = scope === "Task"; const isEvent = scope === "Meeting" || scope === "Call"; const canChangeStatus = canEditActivity && metadata.userAcl?.fieldTable?.[String(scope)]?.status?.edit !== "no"; return <div key={`${id}-${index}`} className={`personal-dashlet-row${isEmail ? " personal-dashlet-email-row" : ""}`}><button className={`personal-dashlet-open${isEmail && !row.isRead ? " dashlet-email-unread" : ""}`} onClick={() => scope && metadata.entityDefs?.[scope]?.fields && onOpenRecord(scope, { ...row, id })}><span><strong>{text}</strong><small>{subtitle}</small>{isTask && taskDue?.kind === "overdue" && <span className="dashlet-task-overdue"><Clock3 size={11}/>Po termínu</span>}{isTask && taskDue?.kind === "today" && <span className="dashlet-task-today"><Clock3 size={11}/>Dnes</span>}{["Records", "Tasks"].includes(item.name) && expandedItems.map((field: Data, fieldIndex: number) => { const rendered = dashletExpandedValue(row, String(entity || ""), field, metadata); if (rendered == null) return null; const label = field.label || (metadata.labels as any)?.[entity || ""]?.fields?.[field.name] || field.name; return <small className={`dashlet-expanded-field${field.soft ? " soft" : ""}${field.small ? " small" : ""}`} key={`${field.name}-${fieldIndex}`}><span>{label}</span> {rendered}</small>; })}</span><ChevronDown size={13}/></button>{isEmail && <div className="personal-dashlet-row-actions">{row.isUsers && <button className={`icon-button${row.isImportant ? " is-active" : ""}`} aria-label={row.isImportant ? "Odebrat důležitost" : "Označit jako důležitý"} title={row.isImportant ? "Odebrat důležitost" : "Označit jako důležitý"} disabled={rowBusy} onClick={() => void runEmailAction(row, "important")}><Star size={13} fill={row.isImportant ? "currentColor" : "none"}/></button>}{row.isUsers && row.status !== "Draft" && <button className="icon-button" aria-label={trash ? "Obnovit z koše" : "Přesunout do koše"} title={trash ? "Obnovit z koše" : "Přesunout do koše"} disabled={rowBusy} onClick={() => void runEmailAction(row, trash ? "retrieve" : "trash")}>{trash ? <RotateCcw size={13}/> : <Trash2 size={13}/>}</button>}{canChangeEntity(metadata, "Email", "delete") && <button className="icon-button" aria-label="Odstranit e-mail" title="Odstranit e-mail" disabled={rowBusy} onClick={() => void runEmailAction(row, "remove")}><X size={13}/></button>}</div>}{!isEmail && (isTask || isEvent || item.name === "Activities" || item.name === "Calendar") && <div className="personal-dashlet-row-actions">{isTask && canChangeStatus && !["Completed", "Canceled"].includes(row.status) && <button className="icon-button" aria-label="Dokončit úkol" title="Dokončit úkol" disabled={activityBusy} onClick={() => void runActivityAction(row, "complete")}><Check size={13}/></button>}{isEvent && canChangeStatus && !["Held", "Not Held"].includes(row.status) && <><button className="icon-button" aria-label="Označit jako proběhlé" title="Označit jako proběhlé" disabled={activityBusy} onClick={() => void runActivityAction(row, "held")}><Check size={13}/></button><button className="icon-button" aria-label="Označit jako neproběhlé" title="Označit jako neproběhlé" disabled={activityBusy} onClick={() => void runActivityAction(row, "notHeld")}><X size={13}/></button></>}{canRemoveActivity && <button className="icon-button" aria-label="Odstranit aktivitu" title="Odstranit aktivitu" disabled={activityBusy} onClick={() => void runActivityAction(row, "remove")}><Trash2 size={13}/></button>}</div>}</div>; })}</div> : <div className="personal-dashlet-empty">V tomto panelu zatím nejsou žádné záznamy.</div>}
    {error && item.name === "Stream" && <div className="dashlet-error">{error}</div>}{postOpen && <div className="dashlet-post-form"><textarea rows={3} placeholder="Co chcete sdílet?" value={postText} onChange={(event) => setPostText(event.target.value)}/><div><button className="button subtle" onClick={() => setPostOpen(false)}>Zrušit</button><button className="button primary" onClick={() => void createPost()} disabled={posting || !postText.trim()}><Send size={13}/>{posting ? "Odesílám…" : "Publikovat"}</button></div></div>}
  </section>;
}

export default function PersonalDashboard({ user, metadata, refreshKey, onOpenRecord, onComposeEmail, onCreateRecord, fallback, layoutOverride, optionsOverride }: { user: User; metadata: Metadata; refreshKey: number; onOpenRecord: (scope: string, record: Data) => void; onComposeEmail: () => void; onCreateRecord: (scope: string) => void; fallback: ReactNode; layoutOverride?: unknown; optionsOverride?: Data }) {
  const [layout, setLayout] = useState<DashTab[]>(defaultLayout);
  const [dashletsOptions, setDashletsOptions] = useState<Data>({});
  const [preferences, setPreferences] = useState<Data>({});
  const [appSettings, setAppSettings] = useState<Data>({});
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDashlet, setSelectedDashlet] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [editing, setEditing] = useState<Dashlet | null>(null);
  const [editOptions, setEditOptions] = useState<Data>({});
  const [optionPicker, setOptionPicker] = useState<{ field: string; entity: string; multiple: boolean } | null>(null);
  const [emailFolderOptions, setEmailFolderOptions] = useState<Array<[string, string]>>([["inbox", "Doručená pošta"]]);
  const [tabsOpen, setTabsOpen] = useState(false);
  const [tabDraft, setTabDraft] = useState<DashTabDraft[]>([]);
  const [lockedDraft, setLockedDraft] = useState(false);
  const dashboardGridRef = useRef<HTMLDivElement>(null);
  const [resizeDraft, setResizeDraft] = useState<{ id: string; startX: number; startY: number; startWidth: number; startHeight: number; width: number; height: number } | null>(null);
  const definitions = (metadata as any).dashlets || {};
  const currentTab = layout[activeTab] || layout[0];
  const canEditLayout = !user.portalId && metadata.userAcl?.fieldTable?.Preferences?.dashboardLayout?.edit !== "no";
  const canEditDashlets = !user.portalId && metadata.userAcl?.fieldTable?.Preferences?.dashletsOptions?.edit !== "no";
  const canAddDashlet = canEditLayout && !preferences.dashboardLocked;
  useEffect(() => {
    let live = true;
    const settingsRequest = request<Data>("Settings");
    const preferencesRequest = layoutOverride === undefined ? request<Data>(`Preferences/${encodeURIComponent(user.id)}`) : Promise.resolve(null);
    Promise.all([preferencesRequest, settingsRequest]).then(([data, config]) => {
      if (!live) return;
      const personalPreferences = data || {};
      setPreferences(personalPreferences);
      setAppSettings(config);
      const nextLayout = Array.isArray(layoutOverride) && layoutOverride.length ? layoutOverride : personalPreferences.dashboardLayout;
      const nextOptions = optionsOverride || personalPreferences.dashletsOptions || {};
      setLayout(Array.isArray(nextLayout) && nextLayout.length ? nextLayout : defaultLayout);
      setDashletsOptions(nextOptions);
      setActiveTab(Math.min(Number(localStorage.getItem(`via-dashboard-tab-${user.id}`) || 0), Math.max(((nextLayout || defaultLayout) as unknown[]).length - 1, 0)));
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Dashboard nejde načíst." )).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [user.id, layoutOverride, optionsOverride]);
  async function save(nextLayout = layout, nextOptions = dashletsOptions, nextLocked = Boolean(preferences.dashboardLocked)) {
    setSaving(true); setError("");
    try { const data = await request<Data>(`Preferences/${encodeURIComponent(user.id)}`, { method: "PUT", body: JSON.stringify({ dashboardLayout: nextLayout, dashletsOptions: nextOptions, dashboardLocked: nextLocked }) }); setPreferences((old) => ({ ...old, ...data, dashboardLocked: nextLocked })); setLayout(data.dashboardLayout || nextLayout); setDashletsOptions(data.dashletsOptions || nextOptions); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Dashboard se nepodařilo uložit."); }
    finally { setSaving(false); }
  }
  function openTabsEditor() {
    setTabDraft(layout.map((tab, sourceIndex) => ({ sourceIndex, name: tab.name || `Záložka ${sourceIndex + 1}` })));
    setLockedDraft(Boolean(preferences.dashboardLocked));
    setTabsOpen(true);
  }
  function moveTab(index: number, direction: -1 | 1) {
    setTabDraft((old) => { const target = index + direction; if (target < 0 || target >= old.length) return old; const next = [...old]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  async function saveTabs() {
    const names = tabDraft.map((tab) => tab.name.trim());
    if (!names.length || names.some((name) => !name) || new Set(names.map((name) => name.toLocaleLowerCase("cs"))).size !== names.length) { setError("Zadejte neprázdné a jedinečné názvy záložek."); return; }
    const nextLayout = tabDraft.map((tab, index) => ({ name: names[index], layout: tab.sourceIndex == null ? [] : layout[tab.sourceIndex]?.layout || [] }));
    const retained = new Set(nextLayout.flatMap((tab) => tab.layout.map((item) => item.id)));
    const nextOptions = Object.fromEntries(Object.entries(dashletsOptions).filter(([id]) => retained.has(id)));
    setLayout(nextLayout); setDashletsOptions(nextOptions); setActiveTab(0); localStorage.setItem(`via-dashboard-tab-${user.id}`, "0"); setTabsOpen(false);
    await save(nextLayout, nextOptions, lockedDraft);
  }
  function addDashlet() {
    if (!selectedDashlet || !currentTab) return;
    const id = `via-${Math.random().toString(36).slice(2, 10)}`;
    const defaults = definitions[selectedDashlet]?.options?.defaults || {};
    const position = findDashletPosition(currentTab.layout);
    const next = layout.map((tab, index) => index === activeTab ? { ...tab, layout: [...tab.layout, { id, name: selectedDashlet, ...position, width: 2, height: 3 }] } : tab);
    const opts = { ...dashletsOptions, [id]: { ...defaults, title: defaults.title || (metadata as any).labels?.dashlets?.[selectedDashlet] || selectedDashlet } };
    setLayout(next); setDashletsOptions(opts); setAddOpen(false); setSelectedDashlet(""); void save(next, opts);
  }
  function removeDashlet(id: string) {
    const next = layout.map((tab, index) => index === activeTab ? { ...tab, layout: tab.layout.filter((item) => item.id !== id) } : tab);
    const opts = { ...dashletsOptions }; delete opts[id]; setLayout(next); setDashletsOptions(opts); void save(next, opts);
  }
  function saveGridPlacement(id: string, x: number, y: number, width?: number, height?: number) {
    const next = layout.map((tab, index) => index === activeTab ? { ...tab, layout: placeDashboardItem(tab.layout, id, x, y, width, height) } : tab);
    setLayout(next); void save(next);
  }
  function dropDashlet(target: Dashlet, event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); event.stopPropagation();
    const id = event.dataTransfer.getData("text/plain");
    const moving = currentTab?.layout.find((item) => item.id === id);
    if (!moving || id === target.id || !canEditLayout || preferences.dashboardLocked || window.innerWidth <= 760) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratioX = Math.max(0, Math.min(.999, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    const ratioY = Math.max(0, Math.min(.999, (event.clientY - rect.top) / Math.max(rect.height, 1)));
    const targetX = Number(target.x) || 0; const targetY = Number(target.y) || 0;
    const targetWidth = Number(target.width) || 2; const targetHeight = Number(target.height) || 3;
    saveGridPlacement(id, targetX + Math.floor(ratioX * targetWidth) - Math.floor((Number(moving.width) || 2) / 2), targetY + Math.floor(ratioY * targetHeight) - Math.floor((Number(moving.height) || 3) / 2));
  }
  function startResize(item: Dashlet, event: PointerEvent<HTMLButtonElement>) {
    if (!canEditLayout || preferences.dashboardLocked || window.innerWidth <= 760) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    setResizeDraft({ id: item.id, startX: event.clientX, startY: event.clientY, startWidth: Number(item.width) || 2, startHeight: Number(item.height) || 3, width: Number(item.width) || 2, height: Number(item.height) || 3 });
  }
  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeDraft) return;
    const gridWidth = dashboardGridRef.current?.clientWidth || 800;
    const cellWidth = (gridWidth - 30) / 4;
    setResizeDraft((current) => current ? { ...current, width: Math.max(1, Math.min(4, current.startWidth + Math.round((event.clientX - current.startX) / cellWidth))), height: Math.max(1, Math.min(8, current.startHeight + Math.round((event.clientY - current.startY) / 88))) } : current);
  }
  function finishResize(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeDraft) return;
    event.preventDefault(); event.stopPropagation();
    const item = currentTab?.layout.find((dashlet) => dashlet.id === resizeDraft.id);
    if (item) saveGridPlacement(item.id, Number(item.x) || 0, Number(item.y) || 0, resizeDraft.width, resizeDraft.height);
    setResizeDraft(null);
  }
  function moveDashlet(id: string, direction: -1 | 1) {
    const next = layout.map((tab, index) => {
      if (index !== activeTab) return tab;
      const items = [...tab.layout]; const from = items.findIndex((item) => item.id === id); const to = from + direction;
      if (from < 0 || to < 0 || to >= items.length) return tab;
      [items[from], items[to]] = [items[to], items[from]];
      return { ...tab, layout: packDashboardItems(items) };
    });
    setLayout(next); void save(next);
  }
  async function beginEdit(item: Dashlet) {
    setEditing(item); setEditOptions({ ...(dashletsOptions[item.id] || {}) });
    if (item.name === "Emails") {
      try {
        const result = await request<{ list?: Array<{ id: string; name: string }> }>(`EmailFolder/action/listAll?userId=${encodeURIComponent(user.id)}`);
        const folders = (result.list || []).filter((folder) => !["inbox", "trash"].includes(folder.id)).map((folder) => [folder.id, folder.name] as [string, string]);
        setEmailFolderOptions([["", "Doručená pošta"], ...folders]);
      } catch { setEmailFolderOptions([["", "Doručená pošta"]]); }
    }
  }
  async function commitEdit() {
    if (!editing) return;
    const nextOptions = { ...editOptions };
    const optionDefs = definitions[editing.name]?.options?.fields || {};
    try { for (const [name, def] of Object.entries(optionDefs) as Array<[string, Data]>) if (def.type === "base" && typeof nextOptions[name] === "string") nextOptions[name] = JSON.parse(nextOptions[name]); }
    catch { setError("Rozložení panelu obsahuje neplatný JSON."); return; }
    const next = { ...dashletsOptions, [editing.id]: nextOptions }; setDashletsOptions(next); setEditing(null); await save(layout, next);
  }
  function updateExpandedRows(rows: Data[][]) {
    setEditOptions((old) => ({ ...old, expandedLayout: { ...(old.expandedLayout || {}), rows } }));
  }
  function expandedLayoutRows(): Data[][] {
    const rows = editOptions.expandedLayout?.rows;
    return Array.isArray(rows) ? rows.map((row: any[]) => Array.isArray(row) ? row.filter(Boolean).map((item: any) => typeof item === "string" ? { name: item } : { ...item }) : []) : [];
  }
  function expandedLayoutFields(): Array<[string, string]> {
    const scope = editOptions.entityType || definitions[editing?.name || ""]?.entityType || entityByDashlet[editing?.name || ""] || "";
    const fields = metadata.entityDefs?.[scope]?.fields || {};
    const allowed = Object.entries(fields).filter(([name, def]) => {
      if (def.disabled || def.listLayoutDisabled || def.utility || metadata.userAcl?.fieldTable?.[scope]?.[name]?.read === "no") return false;
      if (Array.isArray(def.layoutAvailabilityList) && !def.layoutAvailabilityList.includes("list")) return false;
      if ((def.layoutIgnoreList || []).includes("list")) return false;
      return true;
    }).sort(([a], [b]) => String((metadata.labels as any)?.[scope]?.fields?.[a] || a).localeCompare(String((metadata.labels as any)?.[scope]?.fields?.[b] || b), "cs"));
    return allowed.map(([name]) => [name, (metadata.labels as any)?.[scope]?.fields?.[name] || name]);
  }
  function renderExpandedLayout(name: string) {
    const rows = expandedLayoutRows();
    const fieldList = expandedLayoutFields();
    const fieldLabels = new Map(fieldList);
    const setItem = (rowIndex: number, itemIndex: number, patch: Data) => {
      const next = rows.map((row) => [...row]);
      next[rowIndex][itemIndex] = { ...next[rowIndex][itemIndex], ...patch };
      updateExpandedRows(next);
    };
    const selectField = (rowIndex: number, itemIndex: number, field: string) => {
      const next = rows.map((row) => [...row]);
      const current = next[rowIndex][itemIndex];
      if (!field) { next[rowIndex].splice(itemIndex, 1); if (!next[rowIndex].length) next.splice(rowIndex, 1); updateExpandedRows(next); return; }
      const { link: _oldLink, ...rest } = current || {};
      next[rowIndex][itemIndex] = { ...rest, name: field, ...(field === "name" ? { link: true } : {}) };
      updateExpandedRows(next);
    };
    const moveExpandedItem = (rowIndex: number, itemIndex: number, direction: -1 | 1) => {
      const next = rows.map((row) => [...row]);
      const target = itemIndex + direction;
      if (target < 0 || target >= next[rowIndex].length) return;
      [next[rowIndex][itemIndex], next[rowIndex][target]] = [next[rowIndex][target], next[rowIndex][itemIndex]];
      updateExpandedRows(next);
    };
    const availableFieldsFor = (rowIndex: number, itemIndex: number) => {
      const usedElsewhere = new Set(rows.flatMap((row, ri) => row.filter((_, ii) => ri !== rowIndex || ii !== itemIndex).map((item) => item.name)));
      const currentName = rows[rowIndex]?.[itemIndex]?.name;
      return fieldList.filter(([field]) => field === currentName || !usedElsewhere.has(field));
    };
    return <section className="expanded-layout-editor" key={name}>
      <div className="expanded-layout-heading"><div><strong>{dashletOptionLabel(name)}</strong><small>Vyberte pole a jejich pořadí v rozbaleném řádku záznamu.</small></div><button type="button" className="button subtle" onClick={() => updateExpandedRows([...rows, []])} disabled={!fieldList.length}><Plus size={13}/>Přidat řádek</button></div>
      {!editOptions.entityType && !definitions[editing?.name || ""]?.entityType && !entityByDashlet[editing?.name || ""] ? <p className="field-hint">Nejdříve vyberte entitu.</p> : rows.map((row, rowIndex) => <div className="expanded-layout-row" key={`row-${rowIndex}`}><div className="expanded-layout-row-head"><strong>Řádek {rowIndex + 1}</strong><span><button type="button" className="icon-button" title="Posunout řádek nahoru" disabled={!rowIndex} onClick={() => { const next = [...rows]; [next[rowIndex - 1], next[rowIndex]] = [next[rowIndex], next[rowIndex - 1]]; updateExpandedRows(next); }}><ArrowUp size={13}/></button><button type="button" className="icon-button" title="Posunout řádek dolů" disabled={rowIndex === rows.length - 1} onClick={() => { const next = [...rows]; [next[rowIndex + 1], next[rowIndex]] = [next[rowIndex], next[rowIndex + 1]]; updateExpandedRows(next); }}><ArrowDown size={13}/></button><button type="button" className="icon-button danger-ghost" title="Odebrat řádek" onClick={() => updateExpandedRows(rows.filter((_, index) => index !== rowIndex))}><Trash2 size={13}/></button></span></div>
        {row.map((item, itemIndex) => <div className="expanded-layout-item" key={`${item.name}-${itemIndex}`}><label><span>Pole</span><select value={item.name || ""} onChange={(event) => selectField(rowIndex, itemIndex, event.target.value)}><option value="">Odebrat pole…</option>{availableFieldsFor(rowIndex, itemIndex).map(([field, label]) => <option key={field} value={field}>{label}</option>)}</select></label><span className="expanded-layout-item-move"><button type="button" className="icon-button" title="Posunout pole doleva" aria-label="Posunout pole doleva" disabled={!itemIndex} onClick={() => moveExpandedItem(rowIndex, itemIndex, -1)}><ArrowUp size={12}/></button><button type="button" className="icon-button" title="Posunout pole doprava" aria-label="Posunout pole doprava" disabled={itemIndex === row.length - 1} onClick={() => moveExpandedItem(rowIndex, itemIndex, 1)}><ArrowDown size={12}/></button></span><label className="expanded-layout-flag"><input type="checkbox" checked={Boolean(item.soft)} onChange={(event) => setItem(rowIndex, itemIndex, { soft: event.target.checked || undefined })}/> Jemný text</label><label className="expanded-layout-flag"><input type="checkbox" checked={Boolean(item.small)} onChange={(event) => setItem(rowIndex, itemIndex, { small: event.target.checked || undefined })}/> Menší text</label><button type="button" className="icon-button danger-ghost" aria-label={`Odebrat pole ${fieldLabels.get(item.name) || item.name}`} title="Odebrat pole" onClick={() => selectField(rowIndex, itemIndex, "")}><X size={14}/></button></div>)}
        <label className="expanded-layout-add-field"><span>Přidat pole do řádku</span><select value="" disabled={!availableFieldsFor(rowIndex, -1).length} onChange={(event) => { const field = event.target.value; if (!field) return; const next = rows.map((row) => [...row]); next[rowIndex].push({ name: field, ...(field === "name" ? { link: true } : {}) }); updateExpandedRows(next); }}><option value="">Vybrat pole…</option>{availableFieldsFor(rowIndex, -1).map(([field, label]) => <option key={field} value={field}>{label}</option>)}</select></label>
      </div>)}
      {!rows.length && <div className="expanded-layout-empty">Rozšířené rozložení je prázdné. Přidejte řádek a vyberte pole.</div>}
    </section>;
  }
  function updateDashletOption(name: string, value: any, type?: string) {
    if (name === "entityType" && editing?.name === "Records") {
      const entity = String(value || "");
      const collection = metadata.entityDefs?.[entity]?.collection as Data | undefined;
      const title = entity ? (metadata.labels as any)?.Global?.scopeNamesPlural?.[entity] || entityLabel(metadata, entity, true) : (metadata as any).labels?.dashlets?.Records || "Records";
      setEditOptions((old) => ({ ...old, entityType: entity, title, primaryFilter: null, boolFilterList: [], sortBy: collection?.orderBy || null, sortDirection: collection?.order || "asc", expandedLayout: { rows: entity ? [[{ name: "name", link: true, scope: entity }]] : [] } }));
      return;
    }
    setEditOptions((old) => ({ ...old, [name]: type === "enumFloat" || type === "enumInt" ? Number(value) : value }));
  }
  function dashletOptionLabel(name: string) { return (metadata.labels as any)?.DashletOptions?.fields?.[name] || name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (char: string) => char.toLocaleUpperCase("cs")); }
  function dashletOptionItems(name: string, def: Data): Array<[string, string]> {
    if (editing?.name === "Emails" && name === "folder") return emailFolderOptions;
    if (name === "entityType") return entityList(metadata).filter((scope) => metadata.scopes[scope]?.object && !metadata.scopes[scope]?.disabled && canAccessEntity(metadata, scope)).map((scope) => [scope, (metadata.labels as any)?.Global?.scopeNames?.[scope] || entityLabel(metadata, scope, false)]);
    if (name === "enabledScopeList") return entityList(metadata).filter((scope) => metadata.scopes[scope]?.calendar && canAccessEntity(metadata, scope)).map((scope) => [scope, (metadata.labels as any)?.Global?.scopeNamesPlural?.[scope] || entityLabel(metadata, scope, true)]);
    if (name === "boolFilterList") { const scope = editOptions.entityType || entityByDashlet[editing?.name || ""] || ""; const list = metadata.clientDefs?.[scope]?.boolFilterList || []; const keys = Array.isArray(list) ? list.map((item: any) => typeof item === "string" ? item : item.name).filter(Boolean) : Object.keys(list); return keys.map((key: string) => [key, (metadata.labels as any)?.[scope]?.boolFilters?.[key] || key]); }
    if (name === "primaryFilter") { const scope = editOptions.entityType || entityByDashlet[editing?.name || ""] || ""; return (metadata.clientDefs?.[scope]?.filterList || []).flatMap((item: any) => { const key = typeof item === "string" ? item : item.name || item.primary; return key ? [[key, (metadata.labels as any)?.[scope]?.filters?.[key] || key] as [string, string]] : []; }); }
    if (name === "sortBy" || name === "sortField") { const scope = editOptions.entityType || entityByDashlet[editing?.name || ""] || ""; return Object.entries(metadata.entityDefs?.[scope]?.fields || {}).filter(([key, def]) => !def.hidden && !def.utility && metadata.userAcl?.fieldTable?.[scope]?.[key]?.read !== "no").map(([key]) => [key, (metadata.labels as any)?.[scope]?.fields?.[key] || key]); }
    const options = Array.isArray(def.options) ? def.options : [];
    return options.map((value: any) => { const key = String(value); const label = (metadata.labels as any)?.DashletOptions?.options?.[name]?.[key] || (metadata.labels as any)?.Global?.options?.dateSearchRanges?.[key] || key; return [key, label]; });
  }
  function renderDashletOption(name: string, rawDef: any) {
    const def = rawDef || {};
    const optionName = dashletOptionLabel(name);
    if ((name === "dateFrom" || name === "dateTo") && editOptions.dateFilter !== "between") return null;
    if (name === "teams" && (!(["basicWeek", "month", "basicDay"].includes(editOptions.mode)) || metadata.userAcl?.userCalendarPermission === "no")) return null;
    if (name === "users" && editOptions.mode !== "timeline") return null;
    if (["primaryFilter", "sortBy", "sortField", "sortDirection", "boolFilterList"].includes(name) && !editOptions.entityType && !entityByDashlet[editing?.name || ""]) return null;
    if (name === "expandedLayout") return renderExpandedLayout(name);
    if (def.type === "bool") return <label className="preference-toggle dashlet-option-toggle" key={name}><span><strong>{optionName}</strong></span><input type="checkbox" checked={Boolean(editOptions[name])} onChange={(event) => setEditOptions((old) => ({ ...old, [name]: event.target.checked }))}/><i/></label>;
    if (def.type === "link" || def.type === "linkMultiple") {
      const multiple = def.type === "linkMultiple";
      const idsKey = name === "users" || name === "teams" ? `${name}Ids` : multiple ? `${name}Ids` : `${name}Id`;
      const namesKey = name === "users" || name === "teams" ? `${name}Names` : multiple ? `${name}Names` : `${name}Name`;
      const ids = multiple ? (Array.isArray(editOptions[idsKey]) ? editOptions[idsKey].map(String) : []) : editOptions[idsKey] ? [String(editOptions[idsKey])] : [];
      const nameValue = editOptions[namesKey] || {};
      const selectedRows = ids.map((id) => ({ id, name: typeof nameValue === "object" ? nameValue[id] || id : nameValue || id }));
      return <div className="field-input dashlet-option-link" key={name}><span>{optionName}</span><button type="button" className="button subtle" onClick={() => setOptionPicker({ field: name, entity: def.entity || "User", multiple })}>{selectedRows.length ? selectedRows.map((row) => row.name).join(", ") : `Vybrat: ${entityLabel(metadata, def.entity || "User", true)}`}</button></div>;
    }
    if (def.type === "base") return <label className="field-input preference-long-field" key={name}><span>{optionName} · JSON</span><textarea rows={5} value={typeof editOptions[name] === "string" ? editOptions[name] : JSON.stringify(editOptions[name] || {}, null, 2)} onChange={(event) => setEditOptions((old) => ({ ...old, [name]: event.target.value }))}/></label>;
    const optionItems = dashletOptionItems(name, def);
    if (def.type === "multiEnum") {
      const selected: string[] = Array.isArray(editOptions[name]) ? editOptions[name].map(String) : [];
      return <fieldset className="preference-checklist dashlet-option-checklist" key={name}><legend>{optionName}</legend><div>{optionItems.map(([key, label]) => <label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={(event) => setEditOptions((old) => ({ ...old, [name]: event.target.checked ? [...selected, key] : selected.filter((value) => value !== key) }))}/>{label}</label>)}</div></fieldset>;
    }
    const type = String(def.type || "varchar");
    if (["enum", "enumFloat", "enumInt"].includes(type) && optionItems.length) return <label className="field-input" key={name}><span>{optionName}{def.required && <i> *</i>}</span><select required={Boolean(def.required)} value={editOptions[name] ?? def.default ?? ""} onChange={(event) => updateDashletOption(name, event.target.value, type)}><option value="">—</option>{optionItems.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;
    if (["int", "float"].includes(type)) return <label className="field-input" key={name}><span>{optionName}{def.required && <i> *</i>}</span><input type="number" min={def.min} max={def.max} step={type === "int" ? 1 : "any"} required={Boolean(def.required)} value={editOptions[name] ?? def.default ?? ""} onChange={(event) => setEditOptions((old) => ({ ...old, [name]: event.target.value === "" ? "" : Number(event.target.value) }))}/></label>;
    if (["text", "wysiwyg"].includes(type)) return <label className="field-input preference-long-field" key={name}><span>{optionName}{def.required && <i> *</i>}</span><textarea rows={5} required={Boolean(def.required)} value={editOptions[name] ?? def.default ?? ""} onChange={(event) => setEditOptions((old) => ({ ...old, [name]: event.target.value }))}/></label>;
    const inputType = type === "date" ? "date" : type === "url" ? "url" : type === "email" ? "email" : "text";
    return <label className="field-input" key={name}><span>{optionName}{def.required && <i> *</i>}</span><input type={inputType} maxLength={def.maxLength} required={Boolean(def.required)} value={editOptions[name] ?? def.default ?? ""} onChange={(event) => setEditOptions((old) => ({ ...old, [name]: event.target.value }))}/></label>;
  }
  const availableDashlets = useMemo(() => Object.keys(definitions).filter((name) => {
    const aclScope = definitions[name]?.aclScope || definitions[name]?.entityType || entityByDashlet[name];
    if (aclScope && (!metadata.entityDefs?.[aclScope]?.fields || !canAccessEntity(metadata, aclScope))) return false;
    if (name === "Stream" && aclLevel(metadata, "Stream", "read") === "no") return false;
    return `${name} ${(metadata as any).labels?.dashlets?.[name] || ""}`.toLocaleLowerCase("cs").includes(addSearch.toLocaleLowerCase("cs"));
  }).sort((a, b) => a.localeCompare(b)), [definitions, metadata, addSearch]);
  if (loading) return <div className="dashboard-view"><div className="surface table-loading"><span className="spinner"/>Načítám osobní dashboard…</div></div>;
  if (error && !preferences.id) return <>{fallback}<div className="dashlet-error">{error}</div></>;
  return <div className="personal-dashboard"><div className="personal-dashboard-heading"><div><span className="eyebrow">OSOBNÍ DASHBOARD</span><h1>{currentTab?.name || "Přehled"}</h1><p>Vaše panely a záznamy z EspoCRM.</p></div><div className="personal-dashboard-actions">{canEditLayout && <button className="button subtle" onClick={openTabsEditor}><Settings2 size={14}/>Upravit záložky</button>}{canAddDashlet && <button className="button primary" onClick={() => setAddOpen(true)}><Plus size={14}/>Přidat panel</button>}</div></div>
    {error && <div className="table-error">{error}</div>}{layout.length > 0 && <nav className="personal-dashboard-tabs">{layout.map((tab, index) => <button className={activeTab === index ? "active" : ""} key={`${tab.name}-${index}`} onClick={() => { setActiveTab(index); localStorage.setItem(`via-dashboard-tab-${user.id}`, String(index)); }}>{tab.name}</button>)}</nav>}
    <div className="personal-dashboard-grid" ref={dashboardGridRef}>{currentTab?.layout.map((item, index) => <div className="personal-dashlet-wrap" key={item.id} style={{ "--dashboard-x": Math.max(0, Number(item.x) || 0), "--dashboard-y": Math.max(0, Number(item.y) || 0), "--dashlet-width": resizeDraft?.id === item.id ? resizeDraft.width : Math.max(1, Math.min(4, Number(item.width) || 2)), "--dashlet-height": resizeDraft?.id === item.id ? resizeDraft.height : Math.max(1, Math.min(8, Number(item.height) || 3)) } as CSSProperties} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropDashlet(item, event)}><div className="personal-dashlet-manage">{canEditLayout && <><button type="button" className="personal-dashlet-drag" title="Přetáhnout panel" aria-label="Přetáhnout panel" draggable={!preferences.dashboardLocked} onDragStart={(event) => { if (preferences.dashboardLocked) { event.preventDefault(); return; } event.dataTransfer.setData("text/plain", item.id); event.dataTransfer.effectAllowed = "move"; }}><GripVertical size={13}/></button><button title="Posunout nahoru" onClick={() => moveDashlet(item.id, -1)} disabled={!index || Boolean(preferences.dashboardLocked)}><ArrowUp size={13}/></button><button title="Posunout dolů" onClick={() => moveDashlet(item.id, 1)} disabled={index === (currentTab.layout.length - 1) || Boolean(preferences.dashboardLocked)}><ArrowDown size={13}/></button></>}{canEditDashlets && <><button title="Nastavit panel" onClick={() => beginEdit(item)}><Settings2 size={13}/></button><button title="Odebrat panel" onClick={() => removeDashlet(item.id)}><Trash2 size={13}/></button></>}</div><DashletCard key={`${item.id}-${refreshKey}`} item={item} user={user} metadata={metadata} options={dashletsOptions[item.id] || definitions[item.name]?.options?.defaults || {}} appSettings={appSettings} refreshKey={refreshKey} onOpenRecord={onOpenRecord} onComposeEmail={onComposeEmail} onCreateRecord={onCreateRecord}/>{canEditLayout && <button type="button" className="personal-dashlet-resize" aria-label={`Změnit velikost panelu ${item.name}`} title="Změnit velikost panelu" disabled={Boolean(preferences.dashboardLocked)} onPointerDown={(event) => startResize(item, event)} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize}/>}</div>)}{!currentTab?.layout.length && <section className="surface dashboard-empty"><Activity size={22}/><h2>Dashboard je prázdný</h2><p>Přidejte si seznam záznamů, aktivity nebo stream.</p>{canAddDashlet && <button className="button primary" onClick={() => setAddOpen(true)}><Plus size={14}/>Přidat panel</button>}</section>}</div>
    {tabsOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setTabsOpen(false)}><section className="record-modal dashlet-picker"><div className="modal-heading"><div><span className="eyebrow">OSOBNÍ DASHBOARD</span><h2>Správa záložek</h2><p>Přejmenujte, seřaďte nebo odstraňte záložky dashboardu.</p></div><button className="icon-button" onClick={() => setTabsOpen(false)} aria-label="Zavřít"><X size={16}/></button></div><div className="dashboard-tab-editor-list">{tabDraft.map((tab, index) => <div className="dashboard-tab-editor-row" key={`${tab.sourceIndex ?? "new"}-${index}`}><span className="dashboard-tab-editor-move"><button type="button" className="icon-button" title="Posunout nahoru" onClick={() => moveTab(index, -1)} disabled={!index}><ArrowUp size={13}/></button><button type="button" className="icon-button" title="Posunout dolů" onClick={() => moveTab(index, 1)} disabled={index === tabDraft.length - 1}><ArrowDown size={13}/></button></span><input aria-label={`Název záložky ${index + 1}`} maxLength={36} value={tab.name} onChange={(event) => setTabDraft((old) => old.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}/><button type="button" className="icon-button danger-ghost" title="Odebrat záložku" disabled={tabDraft.length <= 1} onClick={() => setTabDraft((old) => old.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14}/></button></div>)}</div><label className="dashboard-lock-toggle"><input type="checkbox" checked={lockedDraft} onChange={(event) => setLockedDraft(event.target.checked)}/><span><strong>Zamknout rozložení panelů</strong><small>Vypne přesouvání a změnu velikosti panelů na dashboardu.</small></span></label><button type="button" className="button subtle dashboard-add-tab" onClick={() => setTabDraft((old) => [...old, { sourceIndex: null, name: `Nová záložka ${old.length + 1}` }])}><Plus size={14}/>Přidat záložku</button><div className="modal-footer"><button className="button subtle" onClick={() => setTabsOpen(false)}>Zrušit</button><button className="button primary" onClick={() => void saveTabs()} disabled={saving || !tabDraft.length}><Check size={14}/>Uložit záložky</button></div></section></div>}
    {addOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAddOpen(false)}><section className="record-modal dashlet-picker"><div className="modal-heading"><div><span className="eyebrow">OSOBNÍ DASHBOARD</span><h2>Přidat panel</h2></div><button className="icon-button" onClick={() => setAddOpen(false)} aria-label="Zavřít"><X size={16}/></button></div><input className="dashlet-search" placeholder="Filtrovat panely…" value={addSearch} onChange={(event) => setAddSearch(event.target.value)}/><div className="dashlet-picker-list">{availableDashlets.map((name) => <button key={name} className={selectedDashlet === name ? "selected" : ""} onClick={() => setSelectedDashlet(name)}><span><strong>{(metadata as any).labels?.dashlets?.[name] || name}</strong><small>{definitions[name]?.entityType ? entityLabel(metadata, definitions[name].entityType) : definitions[name]?.aclScope ? entityLabel(metadata, definitions[name].aclScope) : "Osobní panel EspoCRM"}</small></span><Plus size={15}/></button>)}</div><div className="modal-footer"><button className="button subtle" onClick={() => setAddOpen(false)}>Zrušit</button><button className="button primary" onClick={addDashlet} disabled={!selectedDashlet}>Přidat panel</button></div></section></div>}
    {editing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}><form className="record-modal dashlet-option-editor" onSubmit={(event) => { event.preventDefault(); void commitEdit(); }}><div className="modal-heading"><div><span className="eyebrow">NASTAVENÍ PANELU</span><h2>{editOptions.title || editing.name}</h2></div><button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Zavřít"><X size={16}/></button></div><div className="dashlet-option-fields">{Object.entries(definitions[editing.name]?.options?.fields || {}).map(([name, def]) => renderDashletOption(name, def))}{!definitions[editing.name]?.options?.fields && <p className="field-manager-empty">Tento panel nemá uživatelsky nastavitelné volby.</p>}</div><div className="modal-footer"><button type="button" className="button subtle" onClick={() => setEditing(null)}>Zrušit</button><button className="button primary">Uložit nastavení</button></div></form></div>}
    {optionPicker && editing && (() => { const multiple = optionPicker.multiple; const idsKey = optionPicker.field === "users" || optionPicker.field === "teams" ? `${optionPicker.field}Ids` : multiple ? `${optionPicker.field}Ids` : `${optionPicker.field}Id`; const namesKey = optionPicker.field === "users" || optionPicker.field === "teams" ? `${optionPicker.field}Names` : multiple ? `${optionPicker.field}Names` : `${optionPicker.field}Name`; const selectedIds = multiple ? (Array.isArray(editOptions[idsKey]) ? editOptions[idsKey].map(String) : []) : editOptions[idsKey] ? [String(editOptions[idsKey])] : []; const nameData = editOptions[namesKey] || {}; const selectedRows = selectedIds.map((id) => ({ id, name: typeof nameData === "object" ? nameData[id] || id : nameData || id })); const restricted = metadata.userAcl?.userCalendarPermission === "team"; const fixedWhere = restricted ? [{ type: "bool", value: [optionPicker.field === "teams" ? "onlyMy" : "onlyMyTeam"] }] : []; return <SelectRecordsDialog entity={optionPicker.entity} metadata={metadata} multiple={multiple} selectedIds={selectedIds} selectedRows={selectedRows} primaryFilter={optionPicker.field === "users" ? "active" : undefined} fixedWhere={fixedWhere} onClose={() => setOptionPicker(null)} onSelect={(rows) => { if (multiple) { const names = Object.fromEntries(rows.map((row) => [row.id, row.name || row.userName || row.id])); setEditOptions((old) => ({ ...old, [idsKey]: rows.map((row) => row.id), [namesKey]: names })); } else { const row = rows[0]; setEditOptions((old) => ({ ...old, [idsKey]: row?.id || null, [namesKey]: row ? row.name || row.userName || row.id : null })); } setOptionPicker(null); }}/>; })()}
  </div>;
}
