import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock3, Eye, LogOut, RefreshCw, Search, Shield, Trash2 } from "./Icons";
import { request } from "./api";
import { formatEspoDateTime, useEspoTimeZone } from "./timeZone";

type Row = Record<string, any> & { id: string };
type Page = { list?: Row[]; total?: number };

/** Admin view for native active and inactive AuthToken records. */
export default function AdminAuthTokens({ onBack, onOpenRecord }: { onBack: () => void; onOpenRecord: (row: Row) => void }) {
  const timeZone = useEspoTimeZone();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allResultsSelected, setAllResultsSelected] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pageSize = 25;

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: "lastAccess", order: "desc" });
      params.set("primaryFilter", status);
      if (search.trim()) params.set("textFilter", search.trim());
      const result = await request<Page>(`AuthToken?${params}`);
      setRows(result.list || []); setTotal(result.total || 0); setSelectedIds([]); setAllResultsSelected(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Aktivní sessions se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, [offset, search, status]);
  useEffect(() => { void load(); }, [load]);

  async function revoke(row: Row) {
    const user = row.userName || row.user?.name || row.userId || "uživatele";
    if (!window.confirm(`Ukončit tuto session pro ${user}? Uživatel se bude muset znovu přihlásit.`)) return;
    setActing(row.id); setError(""); setNotice("");
    try { await request(`AuthToken/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ isActive: false }) }); setNotice("Session byla ukončena."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Session se nepodařilo ukončit."); }
    finally { setActing(""); }
  }
  async function remove(row: Row) {
    if (!window.confirm("Trvale odstranit záznam této session?")) return;
    setActing(row.id); setError(""); setNotice("");
    try { await request(`AuthToken/${encodeURIComponent(row.id)}`, { method: "DELETE" }); setNotice("Záznam session byl odstraněn."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Session se nepodařilo odstranit."); }
    finally { setActing(""); }
  }
  async function runMassAction(action: "remove" | "setInactive") {
    if ((!selectedIds.length && !allResultsSelected) || acting) return;
    const count = allResultsSelected ? total : selectedIds.length;
    const message = action === "remove"
      ? `Trvale odstranit ${count} vybraných záznamů sessions?`
      : `Ukončit ${count} vybraných sessions? Uživatelé se budou muset znovu přihlásit.`;
    if (!window.confirm(message)) return;
    setActing("mass"); setError(""); setNotice("");
    try {
      await request("MassAction", {
        method: "POST",
        body: JSON.stringify({
          action: action === "remove" ? "remove" : "update",
          entityType: "AuthToken",
          params: allResultsSelected
            ? { byWhere: true, where: [{ type: status === "active" ? "isTrue" : "isFalse", attribute: "isActive" }], searchParams: { ...(search.trim() ? { textFilter: search.trim() } : {}), orderBy: "lastAccess", order: "desc" } }
            : { ids: selectedIds },
          ...(action === "setInactive" ? { data: { isActive: false } } : {}),
        }),
      });
      setNotice(action === "remove" ? `Odstraněno sessions: ${count}.` : `Ukončeno sessions: ${count}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Hromadná akce sessions se nepodařila."); }
    finally { setActing(""); }
  }
  const allVisibleSelected = allResultsSelected || rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  function toggleVisibleSelection(checked: boolean) {
    setAllResultsSelected(false); setSelectedIds(checked ? rows.map((row) => row.id) : []);
  }
  function toggleSelection(id: string, checked: boolean) {
    setAllResultsSelected(false); setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }
  const userLabel = (row: Row) => row.userName || row.user?.name || row.userId || row.portalName || row.portal?.name || "Portálová session";
  const rangeStart = total ? offset + 1 : 0;
  const rangeEnd = Math.min(offset + pageSize, total);
  return <div className="admin-view auth-token-admin"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">PŘÍSTUP A ZABEZPEČENÍ</div><h1>Aktivní sessions</h1><p>Kontrolujte přihlášená zařízení a ukončete podezřelý nebo již nepoužívaný přístup.</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/> Obnovit</button></div>
    <section className="surface auth-token-toolbar"><div className="auth-token-tabs"><button className={status === "active" ? "active" : ""} onClick={() => { setStatus("active"); setOffset(0); }}>Aktivní</button><button className={status === "inactive" ? "active" : ""} onClick={() => { setStatus("inactive"); setOffset(0); }}>Neaktivní</button></div><form className="record-search" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(query); }}><Search size={14}/><input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder="Hledat uživatele nebo IP adresu…"/><button aria-label="Hledat">Hledat</button></form></section>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm">{notice}</div>}
    <section className="surface auth-token-table">{(selectedIds.length > 0 || allResultsSelected) && <div className="auth-token-bulk"><span>{allResultsSelected ? `Všech ${total} výsledků vybráno` : `${selectedIds.length} vybráno`}</span>{!allResultsSelected && rows.length > 0 && rows.every((row) => selectedIds.includes(row.id)) && total > rows.length && <button className="bulk-clear" onClick={() => { setSelectedIds([]); setAllResultsSelected(true); }}>Vybrat všech {total} výsledků</button>}{status === "active" && <button className="button subtle" onClick={() => void runMassAction("setInactive")} disabled={Boolean(acting)}><LogOut size={13}/>Ukončit vybrané</button>}<button className="button subtle danger-text" onClick={() => void runMassAction("remove")} disabled={Boolean(acting)}><Trash2 size={13}/>Odstranit vybrané</button><button className="button subtle" onClick={() => { setSelectedIds([]); setAllResultsSelected(false); }} disabled={Boolean(acting)}>Zrušit výběr</button></div>}<div className="auth-token-head"><label className="auth-token-select"><input type="checkbox" aria-label="Vybrat všechny viditelné sessions" checked={allVisibleSelected} onChange={(event) => toggleVisibleSelection(event.target.checked)}/></label><span>Uživatel / portál</span><span>IP adresa</span><span>Poslední přístup</span><span>Vytvořeno</span><span>Stav</span><span>Akce</span></div>{busy ? <div className="table-loading"><span className="spinner"/>Načítám sessions…</div> : rows.length ? rows.map((row) => <div className="auth-token-row" key={row.id}><label className="auth-token-select"><input type="checkbox" aria-label={`Vybrat session uživatele ${userLabel(row)}`} checked={allResultsSelected || selectedIds.includes(row.id)} disabled={allResultsSelected || Boolean(acting)} onChange={(event) => toggleSelection(row.id, event.target.checked)}/></label><strong><Shield size={14}/>{userLabel(row)}</strong><code>{row.ipAddress || "—"}</code><span><Clock3 size={13}/>{formatEspoDateTime(row.lastAccess, timeZone)}</span><span>{formatEspoDateTime(row.createdAt, timeZone)}</span><span className={`auth-token-status ${row.isActive ? "active" : "inactive"}`}>{row.isActive ? "Aktivní" : "Ukončená"}</span><div><button className="icon-button" onClick={() => onOpenRecord(row)} disabled={Boolean(acting)} title="Zobrazit session" aria-label="Zobrazit session"><Eye size={14}/></button>{row.isActive && <button className="button subtle" onClick={() => void revoke(row)} disabled={Boolean(acting)} title="Ukončit session"><LogOut size={13}/>Ukončit</button>}<button className="icon-button danger-ghost" onClick={() => void remove(row)} disabled={Boolean(acting)} title="Odstranit záznam"><Trash2 size={14}/></button></div></div>) : <div className="auth-token-empty">V tomto filtru nejsou žádné sessions.</div>}<footer className="auth-token-pagination"><span>{rangeStart}–{rangeEnd} z {total}</span><div><button className="button subtle" disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Předchozí</button><button className="button subtle" disabled={busy || offset + pageSize >= total} onClick={() => setOffset(offset + pageSize)}>Další</button></div></footer></section>
  </div>;
}
