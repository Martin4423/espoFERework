import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Eye, Mail, Pencil, Plus, RefreshCw, Trash2, X } from "./Icons";
import { canAccessEntity, canChangeEntity, canCreateEntity, entityLabel, fieldLabel, request, type Metadata } from "./api";

type Row = Record<string, any>;
type Page = { list?: Row[]; total?: number };
type Relation = { type?: string; entity?: string; foreign?: string };
type RenderEditor = (scope: string, initialValues: Row, onSaved: (row: Row) => void, onClose: () => void) => ReactNode;

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function RecordActivitiesPanel({ entity, record, panelName, metadata, onOpenRecord, onComposeEmail, renderEditor }: {
  entity: string;
  record: Row;
  panelName: "activities" | "history";
  metadata: Metadata;
  onOpenRecord: (entity: string, row: Row) => void;
  onComposeEmail?: (draft: Row) => void;
  renderEditor: RenderEditor;
}) {
  const pageSize = Math.max(1, Number(metadata.appSettings?.recordsPerPageSmall) || 5);
  const configuredScopes = metadata.appSettings?.[`${panelName}EntityList`];
  const scopes = (Array.isArray(configuredScopes) ? configuredScopes : panelName === "activities" ? ["Meeting", "Call", "Task"] : ["Meeting", "Call", "Task", "Email"])
    .filter((scope: string) => metadata.entityDefs?.[scope]?.fields && canAccessEntity(metadata, scope));
  const canCreateScopes = useMemo(() => scopes.filter((scope: string) => {
    const createFlag = metadata.clientDefs?.[scope]?.activityDefs?.[`${panelName}Create`];
    return Boolean(createFlag) && canCreateEntity(metadata, scope);
  }), [metadata, panelName, scopes.join(",")]);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ scope: string; initial: Row } | null>(null);
  const selectableScopes = canCreateScopes;

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: "dateStart", order: "desc" });
      if (filter) params.set("entityType", filter);
      const result = await request<Page>(`Activities/${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/${panelName}?${params.toString()}`);
      const nextRows = result.list || [];
      setRows(nextRows); setTotal(Number(result.total) || 0);
      if (!nextRows.length && offset > 0) setOffset((current) => Math.max(0, current - pageSize));
    } catch (cause) {
      setRows([]); setTotal(0);
      setError(cause instanceof Error ? cause.message : "Aktivity se nepodařilo načíst.");
    } finally { setBusy(false); }
  }, [entity, record.id, panelName, pageSize, offset, filter]);
  useEffect(() => { void load(); }, [load]);

  function getInitial(scope: string) {
    const statusList = (metadata.scopes?.[scope] as any)?.[`${panelName}StatusList`] as string[] | undefined;
    const activityDefs = metadata.clientDefs?.[scope]?.activityDefs || {};
    const linkName = String(activityDefs.link || "");
    const rootLink = (metadata.entityDefs?.[entity]?.links?.[linkName] || {}) as Relation;
    const initial: Row = { status: statusList?.[0] || undefined };
    if (rootLink.type === "hasChildren") initial.parent = { type: entity, id: record.id };
    if (entity === "User") {
      if (record.type === "portal") {
        initial.users = [record.id];
        initial.usersIds = [record.id];
      } else {
        initial.assignedUser = record.id;
        initial.assignedUserId = record.id;
      }
    }
    return { initial, linkName, rootLink };
  }

  function startCreate(scope: string) {
    const { initial } = getInitial(scope);
    setEditor({ scope, initial });
  }

  async function afterSave(scope: string, saved: Row, isNew: boolean) {
    const { linkName, rootLink } = getInitial(scope);
    if (isNew && rootLink.type !== "hasChildren" && linkName && metadata.entityDefs?.[entity]?.links?.[linkName]) {
      await request(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/${encodeURIComponent(linkName)}`, { method: "POST", body: JSON.stringify({ id: saved.id }) });
    }
    setEditor(null); setNotice("Záznam byl přidán do přehledu."); setOffset(0); await load();
  }

  async function updateStatus(row: Row, status: string) {
    setActing(row.id); setError(""); setNotice("");
    try { await request(`${encodeURIComponent(row.entityType || row.scope || "")}/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ status }) }); setNotice(`Stav změněn na „${status}“.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Stav záznamu se nepodařilo změnit."); }
    finally { setActing(""); }
  }

  async function removeRecord(row: Row) {
    const scope = String(row.entityType || row.scope || "");
    if (!scope || !window.confirm(`Opravdu trvale odstranit „${row.name || row.subject || "záznam"}“?`)) return;
    setActing(row.id); setError(""); setNotice("");
    try { await request(`${encodeURIComponent(scope)}/${encodeURIComponent(row.id)}`, { method: "DELETE" }); setNotice("Záznam byl odstraněn."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Záznam se nepodařilo odstranit."); }
    finally { setActing(""); }
  }

  function composeEmail() {
    if (!onComposeEmail) return;
    const draft: Row = { status: "Draft", to: record.emailAddress || "" };
    if (["Account", "Contact", "Lead"].includes(entity) && record.id) { draft.parentType = entity; draft.parentId = record.id; }
    onComposeEmail(draft);
  }

  const label = panelName === "activities" ? "Aktivity" : "Historie";
  return <section className="detail-panel record-activities-panel">
    <div className="activity-panel-head"><div><div className="drawer-section-title">{label}</div><small>{total >= 0 ? `${total} záznamů` : `${rows.length} načteno`}</small></div><div className="activity-panel-tools">
      {scopes.length > 1 && <select aria-label={`Filtrovat ${label.toLocaleLowerCase("cs")}`} value={filter} onChange={(event) => { setFilter(event.target.value); setOffset(0); }}><option value="">Všechny typy</option>{scopes.map((scope: string) => <option key={scope} value={scope}>{entityLabel(metadata, scope, true)}</option>)}</select>}
      {panelName === "activities" && canCreateEntity(metadata, "Email") && ["Account", "Contact", "Lead"].includes(entity) && Boolean(record.emailAddress) && <button className="button subtle" onClick={composeEmail}><Mail size={13}/>E-mail</button>}
      {selectableScopes.map((scope: string) => <button className="button subtle" key={scope} onClick={() => startCreate(scope)}><Plus size={13}/>{panelName === "activities" ? "Naplánovat" : "Zalogovat"} {entityLabel(metadata, scope).toLocaleLowerCase("cs")}</button>)}
      <button className="icon-button" onClick={() => void load()} disabled={busy} aria-label={`Obnovit ${label.toLocaleLowerCase("cs")}`} title="Obnovit"><RefreshCw size={14}/></button>
    </div></div>
    {error && <div className="inline-error">{error}</div>}{notice && <div className="save-confirm"><Check size={14}/>{notice}</div>}
    {busy ? <div className="table-loading"><span className="spinner"/>Načítám {label.toLocaleLowerCase("cs")}…</div> : rows.length ? <div className="activity-panel-list">{rows.map((row) => {
      const scope = String(row.entityType || row.scope || "");
      const scopeDef = metadata.scopes?.[scope] as any;
      const canceled = (scopeDef?.canceledStatusList || []).includes(row.status);
      const canEdit = canChangeEntity(metadata, scope, "edit");
      const canDelete = canChangeEntity(metadata, scope, "delete");
      const title = row.name || row.subject || row.parentName || entityLabel(metadata, scope);
      return <article className="activity-panel-row" key={`${scope}-${row.id}`}>
        <span className="activity-panel-kind"><CalendarDays size={15}/></span>
        <button className={`activity-panel-title ${canceled ? "canceled" : ""}`} onClick={() => onOpenRecord(scope, row)}><strong>{title}</strong><small>{entityLabel(metadata, scope)}{row.status ? ` · ${fieldLabel("status", metadata.entityDefs?.[scope]?.fields?.status, scope, metadata)}: ${((metadata.labels as any)?.[scope]?.options?.status || {})[row.status] || row.status}` : ""}</small></button>
        <span className="activity-panel-date"><Clock3 size={13}/>{formatDate(row.dateStart || row.dateSent || row.createdAt)}</span>
        <span className="activity-panel-owner">{row.assignedUserName || row.createdByName || "—"}</span>
        <div className="activity-panel-actions"><button className="icon-button" title="Zobrazit" aria-label="Zobrazit" onClick={() => onOpenRecord(scope, row)}><Eye size={14}/></button>{canEdit && <button className="icon-button" title="Upravit" aria-label="Upravit" onClick={() => setEditor({ scope, initial: row })}><Pencil size={14}/></button>}{canEdit && ["Meeting", "Call"].includes(scope) && !["Held", "Not Held"].includes(row.status) && <><button className="icon-button" title="Označit jako proběhlé" aria-label="Označit jako proběhlé" disabled={Boolean(acting)} onClick={() => void updateStatus(row, "Held")}><Check size={14}/></button><button className="icon-button" title="Označit jako neproběhlé" aria-label="Označit jako neproběhlé" disabled={Boolean(acting)} onClick={() => void updateStatus(row, "Not Held")}><X size={14}/></button></>}{canEdit && scope === "Task" && !["Completed", "Canceled"].includes(row.status) && <button className="button subtle" disabled={Boolean(acting)} onClick={() => void updateStatus(row, "Completed")}>Dokončit</button>}{canDelete && <button className="icon-button danger-ghost" title="Odstranit" aria-label="Odstranit" disabled={Boolean(acting)} onClick={() => void removeRecord(row)}><Trash2 size={14}/></button>}</div>
      </article>;
    })}</div> : <div className="activity-panel-empty">{error ? "" : `Pro tento záznam zatím nejsou žádné položky v ${label.toLocaleLowerCase("cs")}.`}{selectableScopes.length > 0 && <div>{selectableScopes.map((scope: string) => <button className="button subtle" key={scope} onClick={() => startCreate(scope)}><Plus size={13}/>{panelName === "activities" ? "Naplánovat" : "Zalogovat"} {entityLabel(metadata, scope).toLocaleLowerCase("cs")}</button>)}</div>}</div>}
    {!busy && rows.length > 0 && <footer className="activity-panel-pagination"><button className="button subtle" disabled={offset <= 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ChevronLeft size={13}/>Předchozí</button><span>{offset + 1}–{offset + rows.length}{total >= 0 ? ` z ${total}` : ""}</span><button className="button subtle" disabled={rows.length < pageSize || (total >= 0 && offset + rows.length >= total)} onClick={() => setOffset(offset + pageSize)}>Další<ChevronRight size={13}/></button></footer>}
    {editor && renderEditor(editor.scope, editor.initial, (saved) => { void afterSave(editor.scope, saved, !editor.initial.id).catch((cause) => setError(cause instanceof Error ? cause.message : "Aktivitu se nepodařilo propojit se záznamem.")); }, () => setEditor(null))}
  </section>;
}
