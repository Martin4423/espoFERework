import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Filter, Link2, Pencil, Plus, RotateCcw, Search, Send, Trash2, X } from "./Icons";
import { aclLevel, canAccessEntity, canChangeEntity, canCreateEntity, entityLabel, fetchLayout, fieldLabel, getSession, request, type LayoutItem, type Metadata } from "./api";
import RecordActivitiesPanel from "./RecordActivitiesPanel";
import SelectRecordsDialog from "./SelectRecordsDialog";
import { formatEspoDateTime, useEspoTimeZone } from "./timeZone";

type Row = Record<string, any>;
type RelationshipLink = { entity?: string; type?: string; foreign?: string; readOnly?: boolean; columnAttributeMap?: Record<string, string> };
type PanelDef = { disabled?: boolean; hidden?: boolean; label?: string; order?: number; create?: boolean; select?: boolean; removeDisabled?: boolean; createDisabled?: boolean; filterList?: string[]; selectPrimaryFilterName?: string; rowActionList?: string[]; [key: string]: any };
const relationshipPresetRequests = new Map<string, Promise<Row[]>>();
function loadRelationshipPresets(userId: string, entity: string): Promise<Row[]> {
  const key = `${userId}:${entity}`;
  const existing = relationshipPresetRequests.get(key);
  if (existing) return existing;
  const pending = request<Row>(`Preferences/${encodeURIComponent(userId)}`).then((preferences) => Array.isArray(preferences.presetFilters?.[entity]) ? preferences.presetFilters[entity] : []).catch((error) => { relationshipPresetRequests.delete(key); throw error; });
  relationshipPresetRequests.set(key, pending);
  return pending;
}

export default function RecordRelationships({ entity, record, metadata, onOpenRecord, onOpenTaskList, onComposeEmail, renderActivityEditor, onlyLink }: { entity: string; record: Row; metadata: Metadata; onOpenRecord: (entity: string, row: Row) => void; onOpenTaskList?: (entity: string, where: Row[]) => void; onComposeEmail?: (draft: Row) => void; renderActivityEditor: (scope: string, initial: Row, onSaved: (row: Row) => void, onClose: () => void) => ReactNode; onlyLink?: string }) {
  const scopeDefs = metadata.entityDefs?.[entity];
  const relationshipPanels = metadata.clientDefs?.[entity]?.relationshipPanels || {};
  const [layoutPanels, setLayoutPanels] = useState<Record<string, PanelDef>>({});
  useEffect(() => { let live = true; fetchLayout<Record<string, PanelDef>>(entity, "bottomPanelsDetail").then((data) => live && setLayoutPanels(data || {})).catch(() => live && setLayoutPanels({})); return () => { live = false; }; }, [entity]);
  const configuredPanels = metadata.clientDefs?.[entity]?.bottomPanels?.detail || [];
  const links: Record<string, RelationshipLink> = { ...(scopeDefs?.links || {}) };
  const defs = new Map<string, PanelDef>();
  for (const item of Array.isArray(configuredPanels) ? configuredPanels : []) {
    if (!item?.name) continue;
    const inherited = relationshipPanels[item.name];
    defs.set(item.name, { ...(typeof inherited === "object" ? inherited : {}), ...(typeof item === "object" ? item : {}) });
  }
  for (const [name, value] of Object.entries(layoutPanels || {})) if (!name.startsWith("_")) {
    const inherited = relationshipPanels[name];
    const layout = typeof value === "string" ? { label: value } : { ...(value as PanelDef) };
    defs.set(name, { ...(defs.get(name) || (typeof inherited === "object" ? inherited : {})), ...layout, disabled: layout.disabled ?? false });
  }
  if (entity === "MassEmail" && links.queueItems?.entity === "EmailQueueItem") {
    defs.set("queueItems", { ...(defs.get("queueItems") || relationshipPanels.queueItems || {}), label: "queueItems", select: false, selectDisabled: true, create: false, createDisabled: true, viewDisabled: true, unlinkDisabled: true, layout: "listForMassEmail", filterList: ["all", "pending", "sent", "failed"] });
  }
  const hasTaskSidePanel = (metadata.clientDefs?.[entity]?.sidePanels?.detail || []).some((item: any) => item?.name === "tasks" || String(item?.view || "").includes("record/panels/tasks"));
  if (hasTaskSidePanel && links.tasks?.entity === "Task") {
    const taskLink = entity === "Account" ? "tasksPrimary" : entity === "User" ? links.tasks.foreign || "tasks" : "tasks";
    links[taskLink] = { ...links.tasks, entity: "Task" };
    defs.set(taskLink, { label: "tasks", select: false, create: true, orderBy: "createdAt", orderDirection: "desc", filterList: ["all", "actual", "completed"], layout: "listSmall", taskSidePanel: true });
  }
  if (onlyLink && links[onlyLink]?.entity && !defs.has(onlyLink)) defs.set(onlyLink, { label: onlyLink, layout: "listSmall", create: true, select: true });
  const panels = [...defs.entries()].filter(([name, panel]) => {
    if (onlyLink && name !== onlyLink) return false;
    const link = links[name] as RelationshipLink | undefined;
    const activityPanel = name === "activities" || name === "history" || panel.reference === "activities" || panel.reference === "history";
    return !panel.disabled && !panel.hidden && (activityPanel || Boolean(link?.entity && metadata.scopes?.[link.entity] && canAccessEntity(metadata, link.entity)));
  }).sort(([a, pa], [b, pb]) => (pa.order ?? 5) - (pb.order ?? 5) || a.localeCompare(b));
  const optedOutPanel = entity === "TargetList" && (metadata.clientDefs?.TargetList?.sidePanels?.detail || []).some((item: any) => item?.name === "optedOut" || String(item?.view || "").includes("target-list/record/panels/opted-out"));
  if (!panels.length && !optedOutPanel) return null;
  return <div className="record-relationships">{optedOutPanel && <TargetListOptedOutPanel record={record} metadata={metadata} onOpenRecord={onOpenRecord}/ >}{panels.map(([name, panel]) => {
    const activityName = name === "history" || panel.reference === "history" ? "history" : "activities";
    const isActivityPanel = ["activities", "history"].includes(name) || ["activities", "history"].includes(String(panel.reference || ""));
    return isActivityPanel
      ? <RecordActivitiesPanel key={`${entity}-${record.id}-${name}`} entity={entity} record={record} panelName={activityName} metadata={metadata} onOpenRecord={onOpenRecord} onComposeEmail={onComposeEmail} renderEditor={renderActivityEditor}/>
      : <RelationshipPanel key={`${entity}-${record.id}-${name}`} entity={entity} record={record} name={name} panel={panel} link={links[name] as RelationshipLink} metadata={metadata} onOpenRecord={onOpenRecord} onOpenTaskList={onOpenTaskList} renderEditor={renderActivityEditor}/>;
  })}</div>;
}

export function RelatedRecordsPage({ entity, record, link, metadata, onBack, onOpenRecord, onComposeEmail, renderActivityEditor }: { entity: string; record: Row; link: string; metadata: Metadata; onBack: () => void; onOpenRecord: (entity: string, row: Row) => void; onComposeEmail?: (draft: Row) => void; renderActivityEditor: (scope: string, initial: Row, onSaved: (row: Row) => void, onClose: () => void) => ReactNode }) {
  const label = (metadata.labels as any)?.[entity]?.links?.[link] || link;
  const parentName = record.name || record.subject || [record.firstName, record.lastName].filter(Boolean).join(" ") || record.userName || record.id;
  return <section className="related-records-page">
    <header className="related-records-heading"><button type="button" className="button subtle" onClick={onBack}><ArrowLeft size={14}/> Zpět k záznamu</button><div><span className="eyebrow">{entityLabel(metadata, entity, true)} · {parentName}</span><h1>{label}</h1><p>Navázané záznamy a dostupné akce pro tento vztah.</p></div></header>
    <RecordRelationships entity={entity} record={record} metadata={metadata} onlyLink={link} onOpenRecord={onOpenRecord} onComposeEmail={onComposeEmail} renderActivityEditor={renderActivityEditor}/>
  </section>;
}

function TargetListOptedOutPanel({ record, metadata, onOpenRecord }: { record: Row; metadata: Metadata; onOpenRecord: (entity: string, row: Row) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const scopeList: string[] = (metadata.scopes?.TargetList as any)?.targetLinkList || ["contacts", "leads", "users", "accounts"];
  const targetTypes = scopeList.map((linkName) => metadata.entityDefs?.TargetList?.links?.[linkName]?.entity).filter((scope): scope is string => Boolean(scope && canAccessEntity(metadata, scope)));
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await request<{ list?: Row[] }>(`TargetList/${encodeURIComponent(record.id)}/optedOut?maxSize=20&offset=0`);
      setRows((result.list || []).filter((row) => targetTypes.includes(row._scope)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Odhlášené záznamy se nepodařilo načíst."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [record.id, targetTypes.join(",")]);
  async function cancelOptOut(row: Row) {
    if (!canChangeEntity(metadata, "TargetList", "edit") || busyId) return;
    const targetType = String(row._scope || "");
    if (!targetTypes.includes(targetType)) return;
    const name = row.name || row.userName || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.id;
    if (!window.confirm(`Zrušit odhlášení „${name}“ z tohoto cílového seznamu?`)) return;
    setBusyId(row.id); setError(""); setNotice("");
    try {
      await request("TargetList/action/cancelOptOut", { method: "POST", body: JSON.stringify({ id: record.id, targetId: row.id, targetType }) });
      setRows((current) => current.filter((item) => item.id !== row.id || item._scope !== targetType));
      setNotice("Odhlášení bylo zrušeno."); window.setTimeout(() => setNotice(""), 3500);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Odhlášení se nepodařilo zrušit."); }
    finally { setBusyId(""); }
  }
  const label = (metadata.labels as any)?.TargetList?.labels?.OptedOut || (metadata.labels as any)?.TargetList?.labels?.optedOut || "Odhlášené záznamy";
  const rowName = (row: Row) => row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.userName || row.emailAddress || row.id;
  return <section className="detail-panel relationship-panel target-list-opted-out"><div className="relationship-panel-head"><div><div className="drawer-section-title">{label}</div><small>{loading ? "Načítám…" : `${rows.length} záznamů`}</small></div></div>{error && <div className="inline-error">{error}</div>}{notice && <div className="save-confirm">{notice}</div>}{loading ? <div className="table-loading"><span className="spinner"/> Načítám odhlášené záznamy…</div> : rows.length ? <div className="relationship-list">{rows.map((row) => { const scope = String(row._scope || ""); return <div className="relationship-row" key={`${scope}-${row.id}`}><button className="relationship-open" onClick={() => onOpenRecord(scope, row)}><span className="relationship-row-icon"><Link2 size={14}/></span><span><strong>{rowName(row)}</strong><small>{entityLabel(metadata, scope)} · {row.emailAddress || row.phoneNumber || "Odhlášeno"}</small></span><ArrowRight size={14}/></button>{canChangeEntity(metadata, "TargetList", "edit") && <button className="button subtle" disabled={busyId === row.id} onClick={() => void cancelOptOut(row)}><RotateCcw size={13}/> Zrušit odhlášení</button>}</div>; })}</div> : <div className="relationship-empty">V tomto seznamu nejsou odhlášené záznamy.</div>}</section>;
}

function RelationshipPanel({ entity, record, name, panel, link, metadata, onOpenRecord, onOpenTaskList, renderEditor }: { entity: string; record: Row; name: string; panel: PanelDef; link: RelationshipLink; metadata: Metadata; onOpenRecord: (entity: string, row: Row) => void; onOpenTaskList?: (entity: string, where: Row[]) => void; renderEditor: (scope: string, initial: Row, onSaved: (row: Row) => void, onClose: () => void) => ReactNode }) {
  const timeZone = useEspoTimeZone();
  const relatedEntity = link.entity!;
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [listSearchDraft, setListSearchDraft] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState(String(panel.selectPrimaryFilterName || "all"));
  const [primaryFilter, setPrimaryFilter] = useState("");
  const [activeBoolFilters, setActiveBoolFilters] = useState<string[]>([]);
  const [savedPresets, setSavedPresets] = useState<Row[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [savedPresetWhere, setSavedPresetWhere] = useState<Row[]>([]);
  const [filterOptionsOpen, setFilterOptionsOpen] = useState(false);
  const filterOptionsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Row[]>([]);
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [positionDraft, setPositionDraft] = useState<Record<string, string>>({});
  const [targetListOpen, setTargetListOpen] = useState(false);
  const [targetListName, setTargetListName] = useState("");
  const [targetListIncludes, setTargetListIncludes] = useState<string[]>([]);
  const [targetListExcludes, setTargetListExcludes] = useState<string[]>([]);
  const [targetListDescription, setTargetListDescription] = useState("");
  const [targetListBusy, setTargetListBusy] = useState(false);
  const [targetListError, setTargetListError] = useState("");
  const [notice, setNotice] = useState("");
  const [massEmailEditorOpen, setMassEmailEditorOpen] = useState(false);
  const [massEmailInitial, setMassEmailInitial] = useState<Row | null>(null);
  const [testDialogRow, setTestDialogRow] = useState<Row | null>(null);
  const [testPickerEntity, setTestPickerEntity] = useState("");
  const [testCreateEntity, setTestCreateEntity] = useState("");
  const [testRecipients, setTestRecipients] = useState<Record<string, Row[]>>({ User: [], Contact: [], Lead: [], Account: [] });
  const [testBusy, setTestBusy] = useState(false);
  const [taskEditorInitial, setTaskEditorInitial] = useState<Row | null>(null);
  const [relatedCreateInitial, setRelatedCreateInitial] = useState<Row | null>(null);
  const perPage = 8;
  const jobWithTargetList = ((metadata.clientDefs?.ScheduledJob as any)?.jobWithTargetList || []) as string[];
  const scheduledJobTargetLog = entity === "ScheduledJob" && relatedEntity === "ScheduledJobLogRecord" && jobWithTargetList.includes(String(record.job || ""));
  const layoutName = scheduledJobTargetLog ? "listSmallWithTarget" : typeof panel.layout === "string" ? panel.layout : "listSmall";
  const [relatedLayout, setRelatedLayout] = useState<LayoutItem[]>(Array.isArray(panel.layout) ? panel.layout : []);
  useEffect(() => {
    if (Array.isArray(panel.layout)) { setRelatedLayout(panel.layout); return; }
    let live = true;
    fetchLayout<LayoutItem[]>(relatedEntity, layoutName).then((layout) => live && setRelatedLayout(Array.isArray(layout) ? layout : [])).catch(() => live && setRelatedLayout([]));
    return () => { live = false; };
  }, [relatedEntity, layoutName, panel.layout]);
  const layoutNames = relatedLayout.map((item) => typeof item === "object" ? item.name : undefined).filter((item): item is string => Boolean(item));
  const selectedFields = [...new Set(["id", "name", "subject", "userName", "firstName", "lastName", "status", "modifiedAt", "dateStart", "dateEnd", "isOverdue", "assignedUserName", "teamRole", "teamsColumns", ...(entity === "TargetList" ? ["targetListIsOptedOut"] : []), ...(relatedEntity === "TargetList" ? ["isOptedOut"] : []), ...layoutNames])].join(",");
  const canEditParent = canChangeEntity(metadata, entity, "edit");
  const panelName = panel.label ? (metadata.labels as any)?.[entity]?.links?.[panel.label] || panel.label : (metadata.labels as any)?.[entity]?.links?.[name] || name;
  const canSelect = panel.select !== false && !panel.selectDisabled && canEditParent;
  const foreignLink = link.foreign;
  const inverseLink = foreignLink ? metadata.entityDefs?.[relatedEntity]?.links?.[foreignLink] as RelationshipLink | undefined : undefined;
  const inverseField = foreignLink ? metadata.entityDefs?.[relatedEntity]?.fields?.[foreignLink] : undefined;
  const isTaskSidePanel = Boolean(panel.taskSidePanel);
  const canCreateRelated = panel.create !== false && !panel.createDisabled && !isTaskSidePanel && !(entity === "Campaign" && name === "massEmails") && !metadata.clientDefs?.[relatedEntity]?.createDisabled && canCreateEntity(metadata, relatedEntity) && !["User", "Team", "Role", "Portal"].includes(relatedEntity) && !inverseField?.readOnly && (!link.readOnly || inverseLink?.type === "belongsTo" || (inverseLink?.type === "hasMany" && inverseField?.type === "linkMultiple"));
  const canUnlink = !isTaskSidePanel && panel.removeDisabled !== true && panel.unlinkDisabled !== true && canEditParent && link.readOnly !== true;
  const isCampaignLogPanel = entity === "Campaign" && name === "campaignLogRecords";
  const isCampaignMassEmailPanel = entity === "Campaign" && name === "massEmails";
  const isMassEmailQueuePanel = entity === "MassEmail" && name === "queueItems" && relatedEntity === "EmailQueueItem";
  const openTrackingEnabled = Boolean(metadata.appSettings?.massEmailOpenTracking ?? metadata.appParams?.massEmailOpenTracking);
  const campaignLogFilters = ["sent", "opened", "optedOut", "bounced", "clicked", "optedIn", "leadCreated"].filter((item) => item !== "opened" || openTrackingEnabled);
  const filterList = isCampaignLogPanel ? campaignLogFilters : panel.filterList || [];
  const currentUser = getSession()?.user as any;
  const canUseFilterDefinition = (definition: any) => {
    if (!definition || typeof definition === "string") return true;
    if (definition.isPortalOnly && !["portal", "portal-user"].includes(currentUser?.type)) return false;
    if (definition.inPortalDisabled && ["portal", "portal-user"].includes(currentUser?.type)) return false;
    if (definition.isAdminOnly && !["admin", "super-admin"].includes(currentUser?.type)) return false;
    for (const access of definition.accessDataList || []) {
      if (access.scope && (access.action ? aclLevel(metadata, access.scope, access.action) === "no" : !canAccessEntity(metadata, access.scope))) return false;
      if (!access.scope && access.action && aclLevel(metadata, relatedEntity, access.action) === "no") return false;
      if (access.teamIdList?.length && !access.teamIdList.some((id: string) => currentUser?.teamsIds?.includes(id))) return false;
      if (access.portalIdList?.length && !access.portalIdList.some((id: string) => currentUser?.portalsIds?.includes(id))) return false;
    }
    return true;
  };
  const nativePrimaryFilters = [...(metadata.scopes?.[relatedEntity]?.stars ? [{ name: "starred", primary: "starred" }] : []), ...((metadata.clientDefs?.[relatedEntity]?.filterList || []) as Array<string | Row>)].filter((item) => canUseFilterDefinition(item)).map((item) => {
    const filterName = typeof item === "string" ? item : String(item.name || item.primary || "");
    const primary = typeof item === "string" ? item : String(item.primary || (item.data ? "" : item.name || ""));
    const label = (metadata.labels as any)?.[relatedEntity]?.filters?.[filterName] || (metadata.labels as any)?.[relatedEntity]?.filters?.[primary] || (primary === "starred" ? (metadata.labels as any)?.[relatedEntity]?.presetFilters?.starred : "") || (typeof item === "object" && item.label) || filterName;
    return { name: filterName, primary, label };
  }).filter((item) => item.name && item.primary);
  const nativeBoolFilters = [...((metadata.clientDefs?.[relatedEntity]?.boolFilterList || []) as Array<string | Row>)].filter((item) => canUseFilterDefinition(item) && (typeof item === "string" || !item.aux)).map((item) => {
    const filterName = typeof item === "string" ? item : String(item.name || "");
    return { name: filterName, label: (metadata.labels as any)?.[relatedEntity]?.boolFilters?.[filterName] || filterName.replace(/([a-z0-9])([A-Z])/g, "$1 $2") };
  }).filter((item) => item.name);
  const readablePresetWhere = (where: any): Row | null => {
    if (!where || typeof where !== "object") return null;
    if (["and", "or"].includes(where.type) && Array.isArray(where.value)) {
      const children = where.value.map(readablePresetWhere);
      return children.every(Boolean) ? { ...where, value: children } : null;
    }
    const rawAttribute = where.attribute || where.field;
    if (rawAttribute) {
      const attribute = String(rawAttribute).split(".").at(-1)!.replace(/Id$/, "");
      if (!metadata.entityDefs?.[relatedEntity]?.fields?.[attribute] || metadata.userAcl?.fieldTable?.[relatedEntity]?.[attribute]?.read === "no") return null;
    }
    return where;
  };
  function selectSavedPreset(id: string) {
    const preset = savedPresets.find((item) => item.id === id);
    if (!preset) { setSelectedPresetId(""); setSavedPresetWhere([]); setPrimaryFilter(""); setActiveBoolFilters([]); return; }
    const definitions = Object.values(preset.data || {}) as Row[];
    const parsed = definitions.map((definition) => readablePresetWhere(definition?.where || (definition?.type && (definition?.attribute || definition?.field) ? definition : null)));
    if (parsed.some((item) => !item)) { setError("Uložený filtr obsahuje podmínku nebo pole, které tato obrazovka neumí bezpečně použít."); return; }
    if (preset.primary && !nativePrimaryFilters.some((item) => item.primary === preset.primary)) { setError("Tento uložený filtr odkazuje na filtr, který pro vás není dostupný."); return; }
    const where = parsed.filter((item): item is Row => Boolean(item));
    setError("");
    setSelectedPresetId(preset.id);
    setSavedPresetWhere(where);
    setPrimaryFilter(String(preset.primary || ""));
    setActiveBoolFilters(Array.isArray(preset.boolFilterList) ? preset.boolFilterList.filter((item: string) => nativeBoolFilters.some((option) => option.name === item)) : []);
    setOffset(0);
  }
  const queueFilterFallbacks: Record<string, string> = { all: "Vše", pending: "Čekající", sent: "Odeslané", failed: "Neúspěšné" };
  const relationshipFilterLabel = (value: string) => (metadata.labels as any)?.[relatedEntity]?.presetFilters?.[value] || queueFilterFallbacks[value] || (value === "active" ? "Aktivní" : value);
  const actionOptions = metadata.entityDefs?.CampaignLogRecord?.fields?.action?.options || [];
  const actionLabel = (value: string) => (metadata.labels as any)?.CampaignLogRecord?.options?.action?.[value] || value;
  const campaignFilterStatus = (value: string) => {
    const raw = value.replace(/([A-Z])/g, " $1");
    return `${raw.slice(0, 1).toUpperCase()}${raw.slice(1)}`;
  };
  const canCreateTargetList = isCampaignLogPanel && canCreateEntity(metadata, "TargetList");
  const canCreateMassEmail = isCampaignMassEmailPanel && !panel.createDisabled && canEditParent && canCreateEntity(metadata, "MassEmail");
  const canCreateTask = isTaskSidePanel && canCreateEntity(metadata, "Task");
  const canRemoveTask = isTaskSidePanel && canChangeEntity(metadata, "Task", "delete");
  const canUnlinkAll = Array.isArray(panel.actionList) && panel.actionList.some((item: Row) => item?.action === "unlinkAllRelated") && canEditParent && link.readOnly !== true;
  useEffect(() => {
    const defaults = metadata.clientDefs?.[relatedEntity]?.selectDefaultFilters || {};
    const primary = String(defaults.filter || "");
    setPrimaryFilter(nativePrimaryFilters.some((item) => item.primary === primary) ? primary : "");
    setActiveBoolFilters(Object.entries(defaults.bool || {}).filter(([name, enabled]) => Boolean(enabled) && nativeBoolFilters.some((item) => item.name === name)).map(([name]) => name));
    setSavedPresets([]); setSelectedPresetId(""); setSavedPresetWhere([]);
    if (!currentUser?.id) return;
    let live = true;
    loadRelationshipPresets(currentUser.id, relatedEntity).then((items) => live && setSavedPresets(items)).catch(() => live && setSavedPresets([]));
    return () => { live = false; };
  }, [relatedEntity, metadata, currentUser?.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setListSearch(listSearchDraft.trim()); setOffset(0); }, 250);
    return () => window.clearTimeout(timer);
  }, [listSearchDraft]);
  useEffect(() => {
    if (!filterOptionsOpen) return;
    const onPointerDown = (event: PointerEvent) => { if (!filterOptionsRef.current?.contains(event.target as Node)) setFilterOptionsOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setFilterOptionsOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [filterOptionsOpen]);
  const params = useMemo(() => {
    const search = new URLSearchParams({ maxSize: String(perPage), offset: String(offset), select: selectedFields });
    const orderBy = panel.orderBy || panel.sortBy || metadata.entityDefs?.[relatedEntity]?.collection?.orderBy;
    const order = panel.orderDirection || metadata.entityDefs?.[relatedEntity]?.collection?.order;
    if (orderBy) search.set("orderBy", String(orderBy));
    if (order) search.set("order", String(order));
    const whereGroup: Row[] = [];
    if (filter && filter !== "all") {
      if (isMassEmailQueuePanel) search.set("primaryFilter", filter);
      else whereGroup.push({ type: "primary", value: filter });
    }
    if (primaryFilter) whereGroup.push({ type: "primary", value: primaryFilter });
    if (activeBoolFilters.length) whereGroup.push({ type: "bool", value: activeBoolFilters });
    whereGroup.push(...savedPresetWhere);
    if (listSearch) whereGroup.push({ type: "textFilter", value: listSearch });
    if (whereGroup.length) search.set("whereGroup", JSON.stringify(whereGroup));
    return search;
  }, [offset, panel.orderBy, panel.sortBy, panel.orderDirection, relatedEntity, metadata, filter, selectedFields, isMassEmailQueuePanel, listSearch, primaryFilter, activeBoolFilters, savedPresetWhere]);
  async function load() {
    setLoading(true); setError("");
    try { const result = await request<{ list?: Row[]; total?: number }>(`${entity}/${encodeURIComponent(record.id)}/${encodeURIComponent(name)}?${params.toString()}`); setRows(result.list || []); setTotal(result.total ?? result.list?.length ?? 0); }
    catch (cause) { setRows([]); setTotal(0); setError(cause instanceof Error ? cause.message : "Navázané záznamy se nepodařilo načíst."); }
    finally { setLoading(false); }
  }
  async function changeTargetOptOut(row: Row) {
    if (savingId || !canToggleTargetOptOut) return;
    const targetListOnParent = entity !== "TargetList";
    const stateField = targetListOnParent ? "isOptedOut" : "targetListIsOptedOut";
    const isOptedOut = Boolean(row[stateField]);
    const action = isOptedOut ? "cancelOptOut" : "optOut";
    const targetName = targetListOnParent ? record.name || record.userName || record.id : row.name || row.userName || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.id;
    if (!window.confirm(`${isOptedOut ? "Zrušit odhlášení" : "Odhlásit"} záznamu „${targetName}“ z cílového seznamu?`)) return;
    setSavingId(row.id); setError(""); setNotice("");
    try {
      await request(`TargetList/action/${action}`, { method: "POST", body: JSON.stringify(targetListOnParent ? { id: row.id, targetId: record.id, targetType: entity } : { id: record.id, targetId: row.id, targetType: relatedEntity }) });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, [stateField]: !isOptedOut } : item));
      setNotice(isOptedOut ? "Odhlášení z cílového seznamu bylo zrušeno." : "Záznam byl odhlášen z cílového seznamu.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Stav odhlášení se nepodařilo změnit."); }
    finally { setSavingId(""); }
  }
  async function unlinkAllRelated() {
    if (!canUnlinkAll || savingId || !window.confirm(`Odebrat všechny záznamy z vazby „${panelName}“?`)) return;
    setSavingId("__all__"); setError(""); setNotice("");
    try {
      await request(`${encodeURIComponent(entity)}/action/unlinkAll`, { method: "POST", body: JSON.stringify({ id: record.id, link: name }) });
      await load(); setNotice("Všechny vazby byly odebrány."); window.setTimeout(() => setNotice(""), 3500);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Vazby se nepodařilo odebrat."); }
    finally { setSavingId(""); }
  }
  async function completeRelatedTask(row: Row) {
    if (!canChangeEntity(metadata, "Task", "edit") || metadata.userAcl?.fieldTable?.Task?.status?.edit === "no" || savingId) return;
    setSavingId(row.id); setError("");
    try {
      const updated = await request<Row>(`Task/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ status: "Completed" }) });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...updated, status: updated.status || "Completed" } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Úkol se nepodařilo dokončit."); }
    finally { setSavingId(""); }
  }
  async function removeRelatedTask(row: Row) {
    if (!canRemoveTask || savingId) return;
    if (!window.confirm(`Opravdu odstranit úkol „${row.name || row.id}“?`)) return;
    setSavingId(row.id); setError(""); setNotice("");
    try {
      await request(`Task/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      setNotice("Úkol byl odstraněn.");
      if (rows.length === 1 && offset > 0) setOffset(Math.max(0, offset - perPage));
      else await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Úkol se nepodařilo odstranit."); }
    finally { setSavingId(""); }
  }
  function createRelatedTask() {
    const initial: Row = entity === "User"
      ? { assignedUserId: record.id, assignedUserName: record.name || record.userName }
      : { parentId: record.id, parentType: entity, parentName: record.name || record.subject || record.id };
    setTaskEditorInitial(initial);
  }
  function createRelatedRecord() {
    setError("");
    setNotice("");
    const initial: Row = {};
    for (const [source, target] of Object.entries(panel.createAttributeMap || {})) {
      if (record[source] !== undefined) initial[target as string] = record[source];
    }
    if (foreignLink && inverseLink?.type === "belongsTo") {
      initial[`${foreignLink}Id`] = record.id;
      initial[`${foreignLink}Name`] = record.name || record.subject || record.id;
      if (inverseLink.entity) initial[`${foreignLink}Type`] = entity;
    } else if (foreignLink && inverseLink?.type === "hasMany" && inverseField?.type === "linkMultiple") {
      const idsName = `${foreignLink}Ids`;
      const namesName = `${foreignLink}Names`;
      initial[idsName] = [...new Set([...(initial[idsName] || []), record.id])];
      initial[namesName] = { ...(initial[namesName] || {}), [record.id]: record.name || record.subject || record.id };
    }
    setRelatedCreateInitial(initial);
  }
  async function onRelatedRecordCreated(created: Row) {
    try {
      if (inverseLink?.type !== "belongsTo" && !(inverseLink?.type === "hasMany" && inverseField?.type === "linkMultiple")) {
        await request(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify({ id: created.id }) });
      }
      setRelatedCreateInitial(null);
      setOffset(0);
      await load();
      setNotice(`${entityLabel(metadata, relatedEntity)} byl vytvořen a přiřazen.`);
      window.setTimeout(() => setNotice(""), 3500);
    } catch (cause) {
      setRelatedCreateInitial(null);
      setError(cause instanceof Error ? `Záznam byl vytvořen, ale nepodařilo se ho přiřadit: ${cause.message}` : "Záznam byl vytvořen, ale nepodařilo se ho přiřadit.");
    }
  }
  useEffect(() => { void load(); }, [entity, record.id, name, params.toString()]);
  const rowLabel = (row: Row) => row.name || row.subject || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.userName || row.emailAddress || row.id;
  const layoutValues = (row: Row) => relatedLayout.flatMap((item) => {
    if (!item || typeof item !== "object" || !item.name) return [];
    const name = item.name;
    const def = metadata.entityDefs?.[relatedEntity]?.fields?.[name];
    const raw = row[name] ?? row[`${name}Name`] ?? row[`${name}Id`] ?? (name === "teamRole" ? row.teamRole : undefined);
    if (raw == null || raw === "" || name === "name" || name === "subject") return [];
    const value = relatedEntity === "TargetList" && name === "targetStatus"
      ? (metadata.labels as any)?.TargetList?.options?.targetStatus?.[row.isOptedOut ? "Opted Out" : "Listed"] || (row.isOptedOut ? "Odhlášeno" : "Zařazeno")
      : Array.isArray(raw) ? raw.join(", ") : typeof raw === "object" ? raw.name || "" : def?.type === "enum" ? (metadata.labels as any)?.[relatedEntity]?.options?.[name]?.[String(raw)] || raw : raw;
    return value === "" ? [] : [{ name, label: fieldLabel(name, def, relatedEntity, metadata), value: String(value) }];
  }).slice(0, 3);
  const searchField = (metadata.entityDefs?.[relatedEntity]?.collection?.textFilterFields as string[] | undefined)?.[0] || (metadata.entityDefs?.[relatedEntity]?.fields?.name ? "name" : metadata.entityDefs?.[relatedEntity]?.fields?.userName ? "userName" : "name");
  async function searchCandidates(event?: React.FormEvent) {
    event?.preventDefault(); setCandidateBusy(true); setCandidateError("");
    try {
      const search = new URLSearchParams({ maxSize: "12", offset: "0", select: "id,name,subject,userName,firstName,lastName" });
      const whereGroup: Row[] = [];
      if (panel.selectPrimaryFilterName) whereGroup.push({ type: "primary", value: panel.selectPrimaryFilterName });
      if (panel.selectHandler?.includes("same-account")) {
        const accountId = entity === "Account" ? record.id : record.accountId;
        if (accountId && metadata.entityDefs?.[relatedEntity]?.fields?.account) whereGroup.push({ type: "equals", attribute: "accountId", value: accountId });
      }
      if (query.trim()) whereGroup.push({ type: "contains", attribute: String(searchField), value: query.trim() });
      if (whereGroup.length) search.set("whereGroup", JSON.stringify(whereGroup));
      const result = await request<{ list?: Row[] }>(`${relatedEntity}?${search.toString()}`);
      const linked = new Set(rows.map((row) => row.id)); setCandidates((result.list || []).filter((row) => !linked.has(row.id)));
    } catch (cause) { setCandidateError(cause instanceof Error ? cause.message : "Záznamy k přiřazení se nepodařilo načíst."); }
    finally { setCandidateBusy(false); }
  }
  async function selectRow(row: Row) {
    setSavingId(row.id); setCandidateError("");
    try { await request(`${entity}/${encodeURIComponent(record.id)}/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify({ id: row.id }) }); setPickerOpen(false); setQuery(""); setOffset(0); await load(); }
    catch (cause) { setCandidateError(cause instanceof Error ? cause.message : "Záznam se nepodařilo přiřadit."); }
    finally { setSavingId(""); }
  }
  async function unlinkRow(row: Row) {
    if (!window.confirm(`Odebrat „${rowLabel(row)}“ z ${panelName}?`)) return;
    setSavingId(row.id); setError("");
    try { await request(`${entity}/${encodeURIComponent(record.id)}/${encodeURIComponent(name)}`, { method: "DELETE", body: JSON.stringify({ id: row.id }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Vztah se nepodařilo odebrat."); }
    finally { setSavingId(""); }
  }
  async function changeTeamPosition(row: Row) {
    const role = positionDraft[row.id] ?? row.teamRole ?? "";
    setSavingId(row.id); setError("");
    try {
      const current = await request<Row>(`User/${encodeURIComponent(row.id)}`);
      const teamsColumns = { ...(current.teamsColumns || {}) };
      teamsColumns[record.id] = { ...(teamsColumns[record.id] || {}), role };
      const updated = await request<Row>(`User/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ teamsColumns }) });
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, teamRole: role, teamsColumns: updated.teamsColumns || teamsColumns } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pozici uživatele v týmu se nepodařilo změnit."); }
    finally { setSavingId(""); }
  }
  async function createTargetList(event: FormEvent) {
    event.preventDefault();
    if (!targetListName.trim() || !targetListIncludes.length || targetListBusy) return;
    setTargetListBusy(true); setTargetListError("");
    try {
      await request("TargetList", { method: "POST", body: JSON.stringify({
        name: targetListName.trim(), includingActionList: targetListIncludes,
        excludingActionList: targetListExcludes, description: targetListDescription || null,
        sourceCampaignId: record.id,
      }) });
      setTargetListOpen(false); setTargetListName(""); setTargetListIncludes([]); setTargetListExcludes([]); setTargetListDescription("");
      setNotice("Cílový seznam byl vytvořen."); window.setTimeout(() => setNotice(""), 3500);
    } catch (cause) { setTargetListError(cause instanceof Error ? cause.message : "Cílový seznam se nepodařilo vytvořit."); }
    finally { setTargetListBusy(false); }
  }
  function createMassEmail() {
    const initial: Row = {};
    for (const [source, target] of Object.entries(panel.createAttributeMap || {})) {
      const value = record[source];
      if (value !== undefined) initial[target as string] = value;
    }
    initial.campaignId = record.id;
    initial.campaignName = record.name || "";
    setMassEmailInitial(initial);
    setMassEmailEditorOpen(true);
  }
  function openMassEmailTest(row: Row) {
    const user = getSession()?.user;
    setTestRecipients({ User: user?.id ? [{ ...user }] : [], Contact: [], Lead: [], Account: [] });
    setTestDialogRow(row);
  }
  async function sendMassEmailTest() {
    if (!testDialogRow || testBusy) return;
    const targetList = (["User", "Contact", "Lead", "Account"] as const).flatMap((type) => testRecipients[type].map((item) => ({ id: item.id, type })));
    if (!targetList.length) { setCandidateError("Vyberte alespoň jednoho příjemce."); return; }
    setTestBusy(true); setCandidateError("");
    try {
      await request("MassEmail/action/sendTest", { method: "POST", body: JSON.stringify({ id: testDialogRow.id, targetList }) });
      setTestDialogRow(null); setNotice("Testovací e-mail byl odeslán."); window.setTimeout(() => setNotice(""), 3500);
    } catch (cause) { setCandidateError(cause instanceof Error ? cause.message : "Testovací e-mail se nepodařilo odeslat."); }
    finally { setTestBusy(false); }
  }
  const positionList: string[] = entity === "Team" && name === "users" ? (record.positionList || []) : [];
  const canChangePosition = panel.rowActionList?.includes("changeTeamPosition") && relatedEntity === "User" && positionList.length > 0 && canChangeEntity(metadata, "User", "edit");
  const targetEntities = ["Contact", "Lead", "User", "Account"];
  const canToggleTargetOptOut = canChangeEntity(metadata, "TargetList", "edit") && (entity === "TargetList" && targetEntities.includes(relatedEntity) || targetEntities.includes(entity) && relatedEntity === "TargetList");
  return <section className="detail-panel relationship-panel"><div className="relationship-panel-head"><div><div className="drawer-section-title">{panelName}</div><small>{loading ? "Načítám…" : `${total} záznamů`}</small></div><div className="relationship-panel-actions"><form className="relationship-list-search" role="search" onSubmit={(event) => event.preventDefault()}><Search size={14}/><input type="search" aria-label={`Hledat v seznamu ${panelName}`} placeholder="Hledat v seznamu…" value={listSearchDraft} onChange={(event) => setListSearchDraft(event.target.value)}/>{listSearchDraft && <button type="button" aria-label="Vymazat hledání" onClick={() => setListSearchDraft("")}><X size={13}/></button>}</form>{(nativePrimaryFilters.length > 0 || nativeBoolFilters.length > 0 || savedPresets.length > 0) && <div className="relationship-filter-menu" ref={filterOptionsRef}><button type="button" className={`button subtle ${filterOptionsOpen ? "selected" : ""}`} aria-expanded={filterOptionsOpen} onClick={() => setFilterOptionsOpen((open) => !open)}><Filter size={14}/> Filtry{(primaryFilter || activeBoolFilters.length || selectedPresetId) ? <b>{Number(Boolean(primaryFilter)) + activeBoolFilters.length + Number(Boolean(selectedPresetId))}</b> : null}</button>{filterOptionsOpen && <div className="relationship-filter-popover" role="group" aria-label={`Pokročilé filtry ${panelName}`}>{nativePrimaryFilters.length > 0 && <label><span>Filtr EspoCRM</span><select value={primaryFilter} onChange={(event) => { setPrimaryFilter(event.target.value); setSelectedPresetId(""); setSavedPresetWhere([]); setOffset(0); }}><option value="">Všechny záznamy</option>{nativePrimaryFilters.map((item) => <option key={item.name} value={item.primary}>{item.label}</option>)}</select></label>}{savedPresets.length > 0 && <label><span>Uložený filtr</span><select value={selectedPresetId} onChange={(event) => selectSavedPreset(event.target.value)}><option value="">Bez uloženého filtru</option>{savedPresets.map((preset, index) => <option key={preset.id || index} value={preset.id}>{preset.label || preset.name || "Uložený filtr"}</option>)}</select></label>}{nativeBoolFilters.length > 0 && <fieldset><legend>Další podmínky</legend>{nativeBoolFilters.map((item) => <label className="relationship-bool-filter" key={item.name}><input type="checkbox" checked={activeBoolFilters.includes(item.name)} onChange={(event) => { setActiveBoolFilters((current) => event.target.checked ? [...current, item.name] : current.filter((name) => name !== item.name)); setOffset(0); }}/><span>{item.label}</span></label>)}</fieldset>}<button type="button" className="button subtle relationship-filter-clear" onClick={() => { setPrimaryFilter(""); setActiveBoolFilters([]); setSelectedPresetId(""); setSavedPresetWhere([]); setOffset(0); }}>Vymazat filtry</button></div>}</div>}{filterList.length > 1 && <select aria-label={`Filtr ${panelName}`} value={filter} onChange={(event) => { setFilter(event.target.value); setOffset(0); }}><option value="all">{isCampaignLogPanel || isMassEmailQueuePanel ? relationshipFilterLabel("all") : "Vše"}</option>{filterList.filter((item) => item !== "all").map((item) => <option key={item} value={item}>{isCampaignLogPanel ? actionLabel(campaignFilterStatus(item)) : isTaskSidePanel ? ({ actual: "Aktivní", completed: "Dokončené" }[item] || item) : relationshipFilterLabel(item)}</option>)}</select>}{canCreateRelated && <button type="button" className="button subtle" onClick={createRelatedRecord}><Plus size={14}/> Vytvořit</button>}{canCreateTask && <button className="button subtle" onClick={createRelatedTask}><Plus size={14}/> Vytvořit úkol</button>}{isTaskSidePanel && onOpenTaskList && <button type="button" className="button subtle" onClick={() => { const where = entity === "Account" ? [{ type: "equals", attribute: "accountId", value: record.id }] : entity === "User" ? [{ type: "equals", attribute: "assignedUserId", value: record.id }] : [{ type: "equals", attribute: "parentId", value: record.id }, { type: "equals", attribute: "parentType", value: entity }]; onOpenTaskList("Task", where); }}><ArrowRight size={13}/> Zobrazit seznam</button>}{canUnlinkAll && <button type="button" className="button subtle" disabled={Boolean(savingId)} onClick={() => void unlinkAllRelated()}><Trash2 size={13}/> Odebrat všechny</button>}{canCreateMassEmail && <button className="button subtle" onClick={() => { createMassEmail(); }}><Plus size={14}/> Nový hromadný e-mail</button>}{canCreateTargetList && <button className="button subtle" onClick={() => { const status = filter === "all" ? "" : campaignFilterStatus(filter); const initial = status && actionOptions.includes(status) ? [status] : []; setTargetListIncludes(initial); setTargetListExcludes([]); setTargetListName(""); setTargetListDescription(""); setTargetListError(""); setTargetListOpen(true); }}><Plus size={14}/> Vytvořit cílový seznam</button>}{canSelect && <button className="button subtle" onClick={() => { setPickerOpen(true); setCandidates([]); setCandidateError(""); void searchCandidates(); }}><Plus size={14}/> Přiřadit</button>}</div></div>
    {error && <div className="inline-error" role="alert">{error}</div>}{notice && <div className="save-confirm" role="status">{notice}</div>}{loading ? <div className="table-loading"><span className="spinner"/> Načítám související záznamy…</div> : rows.length ? <div className="relationship-list">{rows.map((row) => <div className="relationship-row" key={row.id}><button className="relationship-open" disabled={panel.viewDisabled} onClick={() => !panel.viewDisabled && onOpenRecord(relatedEntity, row)}><span className="relationship-row-icon"><Link2 size={14}/></span><span><strong>{rowLabel(row)}</strong><small>{isTaskSidePanel ? [row.isOverdue ? "Po termínu" : "", row.assignedUserName, row.dateEnd || row.dateEndDate ? formatEspoDateTime(String(row.dateEnd || row.dateEndDate), timeZone) : "", row.status].filter(Boolean).join(" · ") : layoutValues(row).map((item) => item.value).join(" · ") || entityLabel(metadata, relatedEntity)}</small></span>{!panel.viewDisabled && <ArrowRight size={14}/>}</button>{isTaskSidePanel && canChangeEntity(metadata, "Task", "edit") && <button type="button" className="icon-button" title="Upravit úkol" aria-label={`Upravit úkol ${rowLabel(row)}`} onClick={() => setTaskEditorInitial(row)}><Pencil size={13}/></button>}{isTaskSidePanel && canChangeEntity(metadata, "Task", "edit") && metadata.userAcl?.fieldTable?.Task?.status?.edit !== "no" && !["Completed", "Canceled"].includes(row.status) && <button type="button" className="button subtle" disabled={savingId === row.id} onClick={() => void completeRelatedTask(row)}><Check size={13}/> Dokončit</button>}{canRemoveTask && <button type="button" className="icon-button danger-ghost relationship-unlink" aria-label={`Odstranit úkol ${rowLabel(row)}`} title="Odstranit úkol" disabled={savingId === row.id} onClick={() => void removeRelatedTask(row)}><Trash2 size={14}/></button>}{isCampaignMassEmailPanel && canChangeEntity(metadata, "MassEmail", "edit") && row.status !== "Complete" && <button type="button" className="button subtle" onClick={() => openMassEmailTest(row)}><Send size={13}/> Poslat test</button>}{canToggleTargetOptOut && <button type="button" className="button subtle" disabled={savingId === row.id} onClick={() => void changeTargetOptOut(row)}>{row[entity === "TargetList" ? "targetListIsOptedOut" : "isOptedOut"] ? <><RotateCcw size={13}/> Zrušit odhlášení</> : "Odhlásit"}</button>}{canChangePosition && <div className="relationship-position"><select aria-label={`Pozice ${rowLabel(row)}`} value={positionDraft[row.id] ?? row.teamRole ?? ""} onChange={(event) => setPositionDraft((old) => ({ ...old, [row.id]: event.target.value }))}><option value="">Bez pozice</option>{positionList.map((position) => <option key={position} value={position}>{position}</option>)}</select><button className="button subtle" disabled={savingId === row.id || (positionDraft[row.id] ?? row.teamRole ?? "") === (row.teamRole ?? "")} onClick={() => void changeTeamPosition(row)}>{savingId === row.id ? "Ukládám…" : "Uložit"}</button></div>}{canUnlink && <button className="icon-button danger-ghost relationship-unlink" aria-label={`Odebrat ${rowLabel(row)}`} title="Odebrat vztah" disabled={savingId === row.id} onClick={() => void unlinkRow(row)}><Trash2 size={14}/></button>}</div>)}</div> : <div className="relationship-empty">{panel.emptyMessage || (listSearch ? `Pro hledání „${listSearch}“ jsme nic nenašli.` : "Zatím zde nejsou žádné navázané záznamy.")}{canCreateRelated && <button type="button" className="button subtle" onClick={createRelatedRecord}><Plus size={14}/> Vytvořit záznam</button>}{canSelect && <button className="button subtle" onClick={() => { setPickerOpen(true); setCandidates([]); void searchCandidates(); }}><Plus size={14}/> Přiřadit záznam</button>}{isTaskSidePanel && canCreateTask && <button className="button subtle" onClick={createRelatedTask}><Plus size={14}/> Vytvořit úkol</button>}</div>}
    {!loading && total > perPage && <div className="relationship-pagination"><button className="button subtle" disabled={offset <= 0} onClick={() => setOffset(Math.max(0, offset - perPage))}><ArrowLeft size={13}/> Předchozí</button><span>{offset + 1}–{Math.min(offset + perPage, total)} z {total}</span><button className="button subtle" disabled={offset + perPage >= total} onClick={() => setOffset(offset + perPage)}>Další <ArrowRight size={13}/></button></div>}
    {pickerOpen && <div className="modal-backdrop relationship-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPickerOpen(false)}><section className="record-modal relationship-picker"><div className="modal-heading"><div><span className="eyebrow">{panelName.toLocaleUpperCase("cs")}</span><h2>Přiřadit {entityLabel(metadata, relatedEntity).toLocaleLowerCase("cs")}</h2><p>Vyberte existující záznam, který se má propojit.</p></div><button className="icon-button" onClick={() => setPickerOpen(false)} aria-label="Zavřít"><X size={17}/></button></div><form className="relationship-search" onSubmit={(event) => void searchCandidates(event)}><Search size={15}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat podle názvu…"/><button className="button subtle">Hledat</button></form>{candidateError && <div className="inline-error">{candidateError}</div>}{candidateBusy ? <div className="table-loading"><span className="spinner"/> Hledám záznamy…</div> : candidates.length ? <div className="relationship-candidates">{candidates.map((candidate) => <button key={candidate.id} disabled={Boolean(savingId)} onClick={() => void selectRow(candidate)}><span><strong>{rowLabel(candidate)}</strong><small>{candidate.emailAddress || candidate.userName || entityLabel(metadata, relatedEntity)}</small></span><span>{savingId === candidate.id ? "Přiřazuji…" : <Plus size={15}/>}</span></button>)}</div> : <div className="relationship-empty">{query ? "Nebyly nalezeny žádné záznamy." : "Zadejte hledaný výraz nebo vyberte z výsledků."}</div>}<div className="modal-footer"><button className="button subtle" onClick={() => setPickerOpen(false)}>Zavřít</button></div></section></div>}
    {taskEditorInitial && renderEditor("Task", taskEditorInitial, () => { const wasEditing = Boolean(taskEditorInitial.id); setTaskEditorInitial(null); if (!wasEditing) setOffset(0); void load(); }, () => setTaskEditorInitial(null))}
    {relatedCreateInitial && renderEditor(relatedEntity, relatedCreateInitial, (created) => { void onRelatedRecordCreated(created); }, () => setRelatedCreateInitial(null))}
    {massEmailEditorOpen && massEmailInitial && renderEditor("MassEmail", massEmailInitial, () => { setMassEmailEditorOpen(false); setMassEmailInitial(null); setOffset(0); void load(); }, () => { setMassEmailEditorOpen(false); setMassEmailInitial(null); })}
    {testDialogRow && <div className="modal-backdrop"><section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-test-email-title"><div className="modal-heading"><div><span className="eyebrow">KAMPAŇ · TEST</span><h2 id="campaign-test-email-title">Odeslat testovací hromadný e-mail</h2><p>Vyberte alespoň jednoho příjemce. Test odešle zprávu z „{testDialogRow.name || "hromadného e-mailu"}“.</p></div><button type="button" className="icon-button" onClick={() => setTestDialogRow(null)} disabled={testBusy} aria-label="Zavřít"><X size={17}/></button></div><div className="campaign-test-recipient-list">{(["User", "Contact", "Lead", "Account"] as const).filter((scope) => canAccessEntity(metadata, scope)).map((scope) => <div key={scope}><span><strong>{entityLabel(metadata, scope, true)}</strong><small>{testRecipients[scope].map((item) => item.name || item.userName || item.id).join(", ") || "Nikdo nevybrán"}</small></span><button type="button" className="button subtle" onClick={() => setTestPickerEntity(scope)}><Plus size={13}/> Vybrat</button></div>)}</div>{candidateError && <div className="inline-error">{candidateError}</div>}<div className="modal-footer"><button type="button" className="button subtle" onClick={() => setTestDialogRow(null)} disabled={testBusy}>Zrušit</button><button type="button" className="button primary" onClick={() => void sendMassEmailTest()} disabled={testBusy || !Object.values(testRecipients).some((items) => items.length)}>{testBusy ? "Odesílám…" : "Odeslat test"}<Send size={14}/></button></div></section></div>}
    {testPickerEntity && <SelectRecordsDialog entity={testPickerEntity} metadata={metadata} multiple selectedIds={testRecipients[testPickerEntity].map((item) => item.id)} selectedRows={testRecipients[testPickerEntity]} onCreate={testPickerEntity !== "User" && canCreateEntity(metadata, testPickerEntity) && !metadata.clientDefs?.[testPickerEntity]?.createDisabled ? () => { setTestCreateEntity(testPickerEntity); setTestPickerEntity(""); } : undefined} onClose={() => setTestPickerEntity("")} onSelect={(items) => { setTestRecipients((old) => ({ ...old, [testPickerEntity]: items })); setTestPickerEntity(""); }}/>} {testCreateEntity && renderEditor(testCreateEntity, {}, (created) => { const scope = testCreateEntity; setTestRecipients((old) => ({ ...old, [scope]: [...old[scope].filter((item) => item.id !== created.id), created] })); setTestCreateEntity("" ); }, () => setTestCreateEntity(""))}
    {targetListOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !targetListBusy && setTargetListOpen(false)}><form className="record-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-target-list-title" onSubmit={(event) => void createTargetList(event)}><div className="modal-heading"><div><span className="eyebrow">KAMPAŇ · VÝSLEDKY</span><h2 id="campaign-target-list-title">Nový cílový seznam</h2><p>Seznam se propojí s kampaní „{record.name || ""}“ a zahrne vybrané akce.</p></div><button type="button" className="icon-button" onClick={() => setTargetListOpen(false)} disabled={targetListBusy} aria-label="Zavřít"><X size={17}/></button></div>
      <label className="field-input"><span>Název <i>*</i></span><input autoFocus required maxLength={255} value={targetListName} onChange={(event) => setTargetListName(event.target.value)} /></label>
      <label className="field-input"><span>Zahrnout akce <i>*</i></span><select multiple required size={Math.min(Math.max(actionOptions.length, 3), 7)} value={targetListIncludes} onChange={(event) => setTargetListIncludes(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{actionOptions.map((option) => <option key={String(option)} value={String(option)}>{actionLabel(String(option))}</option>)}</select></label>
      <label className="field-input"><span>Vyloučit akce</span><select multiple size={Math.min(Math.max(actionOptions.length, 3), 7)} value={targetListExcludes} onChange={(event) => setTargetListExcludes(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{actionOptions.map((option) => <option key={String(option)} value={String(option)}>{actionLabel(String(option))}</option>)}</select></label>
      <label className="field-input"><span>Popis</span><textarea rows={3} value={targetListDescription} onChange={(event) => setTargetListDescription(event.target.value)} /></label>
      {targetListError && <div className="inline-error" role="alert">{targetListError}</div>}
      <div className="modal-footer"><button type="button" className="button subtle" onClick={() => setTargetListOpen(false)} disabled={targetListBusy}>Zrušit</button><button className="button primary" disabled={targetListBusy || !targetListName.trim() || !targetListIncludes.length}>{targetListBusy ? "Vytvářím…" : "Vytvořit cílový seznam"}</button></div></form></div>}
  </section>;
}
