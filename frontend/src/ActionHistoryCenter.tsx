import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, Clock3, ExternalLink, FileInput, FileSearch, Filter, Search, Trash2, X } from "./Icons";
import { canAccessEntity, canChangeEntity, canUsePermission, entityLabel, getSession, request } from "./api";
import type { Metadata } from "./api";
import { dateFilterBoundaryInTimeZone, formatEspoDateTime, useEspoTimeZone } from "./timeZone";
const ExportDialog = lazy(() => import("./ExportDialog"));

type HistoryRow = Record<string, any> & { id: string; targetType?: string; targetId?: string; targetName?: string; action?: string; createdAt?: string; userName?: string; userId?: string; ipAddress?: string; data?: Record<string, unknown> };
const pageSize = 30;
const fallbackActionLabels: Record<string, string> = { read: "Zobrazení", update: "Úprava", create: "Vytvoření", delete: "Smazání" };

export default function ActionHistoryCenter({ metadata, onBack, onOpenRecord }: { metadata: Metadata; onBack: () => void; onOpenRecord: (entity: string, record: HistoryRow) => void }) {
  const timeZone = useEspoTimeZone();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [targetType, setTargetType] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [allResultsSelected, setAllResultsSelected] = useState(false);
  const [detail, setDetail] = useState<HistoryRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const selectionQueryKey = JSON.stringify([targetType, action, from, to, search]);
  const previousSelectionQueryKey = useRef(selectionQueryKey);
  const canDelete = canChangeEntity(metadata, "ActionHistoryRecord", "delete");
  const currentUserIsAdmin = ["admin", "super-admin"].includes(String(getSession()?.user.type || ""));
  const canExport = canUsePermission(metadata, "exportPermission") && !(metadata.appSettings?.exportDisabled && !currentUserIsAdmin) && !metadata.clientDefs?.ActionHistoryRecord?.exportDisabled && getSession()?.user.type !== "api";
  const actionOptions = useMemo(() => {
    const configured = metadata.entityDefs?.ActionHistoryRecord?.fields?.action?.options || [];
    const translated = Object.keys((metadata.labels as any)?.ActionHistoryRecord?.options?.action || {});
    return [...new Set([...(configured as string[]).map(String), ...translated, ...Object.keys(fallbackActionLabels)])];
  }, [metadata]);
  const actionLabel = (value?: string) => value ? (metadata.labels as any)?.ActionHistoryRecord?.options?.action?.[value] || fallbackActionLabels[value] || value : "Akce";
  const scopes = useMemo(() => Object.keys(metadata.scopes || {}).filter((scope) => metadata.scopes[scope]?.entity && canAccessEntity(metadata, scope)).sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs")), [metadata]);
  const hasNext = total === -1 ? rows.length === pageSize : total > offset + rows.length;

  useEffect(() => {
    if (previousSelectionQueryKey.current !== selectionQueryKey) {
      previousSelectionQueryKey.current = selectionQueryKey;
      setSelected([]); setAllResultsSelected(false);
    }
  }, [selectionQueryKey]);

  function buildWhere() {
    const where: Record<string, any>[] = [];
    if (targetType) where.push({ type: "equals", attribute: "targetType", value: targetType });
    if (action) where.push({ type: "equals", attribute: "action", value: action });
    if (from) where.push({ type: "greaterThanOrEquals", attribute: "createdAt", value: dateFilterBoundaryInTimeZone(from, timeZone) });
    if (to) where.push({ type: "lessThanOrEquals", attribute: "createdAt", value: dateFilterBoundaryInTimeZone(to, timeZone, true) });
    return where;
  }

  async function load() {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: "number", order: "desc" });
      const where = buildWhere();
      if (search.trim()) where.push({ type: "or", value: ["userName", "ipAddress", "targetName"].map((attribute) => ({ type: "contains", attribute, value: search.trim() })) });
      if (where.length) params.set("whereGroup", JSON.stringify(where));
      const result = await request<{ list?: HistoryRow[]; total?: number }>(`ActionHistoryRecord?${params.toString()}`);
      setRows(result.list || []); setTotal(typeof result.total === "number" && Number.isFinite(result.total) && result.total >= 0 ? result.total : -1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Auditní historii se nepodařilo načíst."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, [offset, targetType, action, from, to, search, timeZone]);
  function applySearch(event: FormEvent) { event.preventDefault(); setOffset(0); setSearch(query.trim()); }
  function clearFilters() { setTargetType(""); setAction(""); setFrom(""); setTo(""); setQuery(""); setSearch(""); setOffset(0); }
  function toggleAll(checked: boolean) {
    if (allResultsSelected) { setAllResultsSelected(false); setSelected([]); return; }
    setSelected((current) => checked ? [...new Set([...current, ...rows.map((item) => item.id)])] : current.filter((id) => !rows.some((row) => row.id === id)));
  }
  function toggle(id: string) {
    if (allResultsSelected) { setAllResultsSelected(false); setSelected(rows.filter((item) => item.id !== id).map((item) => item.id)); return; }
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  async function removeSelected() {
    if (!canDelete || (!selected.length && !allResultsSelected) || !window.confirm(allResultsSelected ? `Trvale smazat všechny záznamy odpovídající aktuálním filtrům${total >= 0 ? ` (${total})` : ""}?` : `Trvale smazat ${selected.length} záznamů z historie?`)) return;
    setDeleting(true); setError("");
    try {
      const deletedFilteredResults = allResultsSelected;
      await request("MassAction", { method: "POST", body: JSON.stringify({ entityType: "ActionHistoryRecord", action: "delete", params: deletedFilteredResults ? { byWhere: true, where: [...buildWhere(), ...(search.trim() ? [{ type: "or", value: ["userName", "ipAddress", "targetName"].map((attribute) => ({ type: "contains", attribute, value: search.trim() })) }] : [])], searchParams: { orderBy: "number", order: "desc" } } : { ids: selected } }) });
      setSelected([]); setAllResultsSelected(false);
      if (deletedFilteredResults && offset) { setOffset(0); return; }
      await load();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Historii se nepodařilo smazat."); }
    finally { setDeleting(false); }
  }
  async function removeOne(row: HistoryRow) {
    if (!canDelete || !window.confirm(`Trvale smazat auditní záznam „${row.targetName || row.id}“?`)) return;
    setDeleting(true); setError("");
    try { await request(`ActionHistoryRecord/${encodeURIComponent(row.id)}`, { method: "DELETE" }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Auditní záznam se nepodařilo smazat."); }
    finally { setDeleting(false); }
  }
  async function openTarget(row: HistoryRow) {
    if (!row.targetType || !row.targetId || !canAccessEntity(metadata, row.targetType)) return;
    try { const record = await request<HistoryRow>(`${encodeURIComponent(row.targetType)}/${encodeURIComponent(row.targetId)}`); onOpenRecord(row.targetType, record); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cílový záznam není dostupný."); }
  }
  const shownCount = offset + rows.length;

  return <div className="action-history-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">AUDIT CRM</div><h1>Historie akcí<span className="title-count">{total >= 0 ? total.toLocaleString("cs-CZ") : `${shownCount}+`}</span></h1><p>Přehled vytvořených, upravených, otevřených a odstraněných záznamů.</p></div><span className="history-audit-mark"><FileSearch size={16}/> Pouze pro čtení</span></div>
    {error && <div className="table-error">{error}<button onClick={() => setError("")}>Zavřít</button></div>}
    <section className="surface action-history-surface"><div className="action-history-toolbar"><div className="action-history-filters"><label><span>Oblast</span><select value={targetType} onChange={(event) => { setTargetType(event.target.value); setOffset(0); }}><option value="">Všechny oblasti</option>{scopes.map((scope) => <option key={scope} value={scope}>{entityLabel(metadata, scope, true)}</option>)}</select></label><label><span>Akce</span><select value={action} onChange={(event) => { setAction(event.target.value); setOffset(0); }}><option value="">Všechny akce</option>{actionOptions.map((value) => <option value={value} key={value}>{actionLabel(value)}</option>)}</select></label><label><span>Od</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }}/></label><label><span>Do</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }}/></label></div><form className="action-history-search" onSubmit={applySearch}><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Uživatel, IP adresa nebo záznam…"/><button aria-label="Hledat"><ArrowRight size={13}/></button></form></div>
      <div className="action-history-controls"><span><Filter size={13}/>{allResultsSelected ? total >= 0 ? `${total} událostí vybráno` : "Všechny filtrované události vybrány" : `${selected.length} vybráno · ${rows.length} na stránce`}</span>{!allResultsSelected && rows.length > 0 && rows.every((row) => selected.includes(row.id)) && (total > rows.length || total === -1 && rows.length === pageSize) && <button type="button" className="button subtle" onClick={() => { setSelected([]); setAllResultsSelected(true); }}>Vybrat všechny výsledky</button>}{allResultsSelected && <button type="button" className="button subtle" onClick={() => { setSelected([]); setAllResultsSelected(false); }}>Zrušit výběr</button>}<button type="button" className="button subtle" onClick={clearFilters}><X size={13}/>Vymazat filtry</button>{canExport && <button type="button" className="button subtle" onClick={() => setExportOpen(true)} disabled={busy}><FileInput size={13}/>Exportovat…</button>}{(selected.length > 0 || allResultsSelected) && canDelete && <button type="button" className="button danger" onClick={() => void removeSelected()} disabled={deleting}><Trash2 size={13}/>{deleting ? "Mažu…" : allResultsSelected ? "Smazat všechny filtrované" : `Smazat vybrané (${selected.length})`}</button>}</div>
      <div className="action-history-head"><label><input type="checkbox" checked={allResultsSelected || rows.length > 0 && rows.every((row) => selected.includes(row.id))} onChange={(event) => toggleAll(event.target.checked)}/> Záznam</label><span>Akce</span><span>Uživatel</span><span>Datum</span><span>IP adresa</span><span/></div>
      <div className="action-history-list">{busy ? <div className="table-loading"><span className="spinner"/> Načítám historii akcí…</div> : rows.length ? rows.map((row) => <article className={`action-history-row ${allResultsSelected || selected.includes(row.id) ? "selected" : ""}`} key={row.id}><label className="history-select"><input type="checkbox" checked={allResultsSelected || selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label="Vybrat auditní záznam"/></label><button type="button" className="history-target" onClick={() => setDetail(row)}><span className={`history-action-icon ${row.action || ""}`}><Clock3 size={15}/></span><span><strong>{row.targetName || "Záznam bez názvu"}</strong><small>{entityLabel(metadata, row.targetType || "", true)}</small></span></button><span className="history-action-label">{actionLabel(row.action) || "—"}</span><span className="history-user">{row.userName || "—"}</span><time>{row.createdAt ? formatEspoDateTime(row.createdAt, timeZone) : "—"}</time><span className="history-ip">{row.ipAddress || "—"}</span><button type="button" className="icon-button" aria-label="Zobrazit detail události" onClick={() => setDetail(row)}><ArrowRight size={14}/></button>{canDelete && <button type="button" className="icon-button danger-ghost" aria-label={`Smazat auditní záznam ${row.targetName || ""}`} title="Smazat auditní záznam" disabled={deleting} onClick={() => void removeOne(row)}><Trash2 size={14}/></button>}</article>) : <div className="action-history-empty"><FileSearch size={22}/><strong>{error ? "Historii se nepodařilo načíst" : "Žádné události nenalezeny"}</strong><small>Upravte filtry nebo rozsah data.</small></div>}</div>
      <footer className="action-history-pagination"><span>{shownCount} záznamů načteno{total >= 0 ? ` z ${total}` : ""}</span><div><button type="button" className="button subtle" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ArrowLeft size={13}/>Předchozí</button><b>{Math.floor(offset / pageSize) + 1}</b><button type="button" className="button subtle" disabled={!hasNext || busy} onClick={() => setOffset(offset + pageSize)}>Další<ArrowRight size={13}/></button></div></footer>
    </section>
    {exportOpen && <Suspense fallback={<div className="modal-backdrop"><section className="record-modal table-loading"><span className="spinner"/>Načítám exportní nástroje…</section></div>}><ExportDialog entity="ActionHistoryRecord" metadata={metadata} selectedIds={allResultsSelected ? [] : selected} total={total} search="" primaryFilter="" boolFilters={[]} where={[...buildWhere(), ...(search.trim() ? [{ type: "or", value: ["userName", "ipAddress", "targetName"].map((attribute) => ({ type: "contains", attribute, value: search.trim() })) }] : [])]} orderBy="number" order="desc" onClose={() => setExportOpen(false)}/></Suspense>}
    {detail && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}><section className="record-modal action-history-detail" role="dialog" aria-modal="true" aria-label="Detail auditní události"><div className="modal-heading"><div><span className="eyebrow">AUDITNÍ UDÁLOST</span><h2>{actionLabel(detail.action)}</h2><p>{detail.targetName || "Záznam bez názvu"} · {entityLabel(metadata, detail.targetType || "")}</p></div><button className="icon-button" onClick={() => setDetail(null)} aria-label="Zavřít"><X size={16}/></button></div><div className="history-detail-meta"><span>Uživatel<b>{detail.userName || "—"}</b></span><span>Datum<b>{detail.createdAt ? formatEspoDateTime(detail.createdAt, timeZone) : "—"}</b></span><span>IP adresa<b>{detail.ipAddress || "—"}</b></span></div><section className="history-detail-data"><h3>Data události</h3><pre>{JSON.stringify(detail.data || {}, null, 2)}</pre></section><div className="modal-footer"><button type="button" className="button subtle" onClick={() => setDetail(null)}>Zavřít</button>{detail.targetId && detail.targetType && canAccessEntity(metadata, detail.targetType) && <button type="button" className="button primary" onClick={() => void openTarget(detail)}><ExternalLink size={14}/>Otevřít záznam</button>}</div></section></div>}
  </div>;
}
