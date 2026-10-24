import { useEffect, useState } from "react";
import { Check, Search, Users, X } from "./Icons";
import { request } from "./api";

type Row = Record<string, any>;
type Page = { list?: Row[]; total?: number };

/** Native DashboardTemplate deploy-to-users/team actions. */
export default function DashboardTemplateDeploy({ id, name, onClose, onComplete }: { id: string; name: string; onClose: () => void; onComplete: (message: string) => void }) {
  const [mode, setMode] = useState<"users" | "team">("users");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Record<string, string>>({});
  const [teamId, setTeamId] = useState("");
  const [append, setAppend] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 40;

  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: "name", order: "asc" });
    if (mode === "users") params.set("primaryFilter", "active");
    if (query.trim()) {
      params.set("where[0][type]", "contains"); params.set("where[0][attribute]", "name"); params.set("where[0][value]", query.trim());
      if (mode === "users") { params.set("where[1][type]", "equals"); params.set("where[1][attribute]", "isActive"); params.set("where[1][value]", "true"); }
    }
    const endpoint = `${mode === "users" ? "User" : "Team"}?${params}`;
    request<Page>(endpoint).then((data) => {
      if (!live) return;
      const list = Array.isArray(data) ? data as unknown as Row[] : data.list || [];
      setRows(list); setTotal(Number(data.total ?? list.length));
      if (mode === "team" && !teamId && list[0]) setTeamId(list[0].id);
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Seznam se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [mode, query, offset]);

  function switchMode(next: "users" | "team") { setMode(next); setOffset(0); setQuery(""); setRows([]); setError(""); }
  async function deploy() {
    setSaving(true); setError("");
    try {
      const action = mode === "users" ? "deployToUsers" : "deployToTeam";
      const data = mode === "users" ? { id, userIdList: Object.keys(selectedUsers), append } : { id, teamId, append };
      await request(`DashboardTemplate/action/${action}`, { method: "POST", body: JSON.stringify(data) });
      const target = mode === "users" ? `${Object.keys(selectedUsers).length} uživatelům` : `týmu ${rows.find((row) => row.id === teamId)?.name || ""}`;
      onComplete(`Rozložení „${name}“ bylo nasazeno ${target}${append ? " (připojeno k jejich stávajícím panelům)" : " (nahradilo jejich stávající rozložení)"}.`);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Rozložení se nepodařilo nasadit."); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop dashboard-deploy-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><section className="record-modal dashboard-deploy-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboard-deploy-title"><div className="modal-heading"><div><span className="eyebrow">ŠABLONA DASHBOARDU</span><h2 id="dashboard-deploy-title">Nasadit rozložení</h2><p>{name}</p></div><button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Zavřít"><X size={16}/></button></div>
    <nav className="dashboard-deploy-tabs"><button type="button" className={mode === "users" ? "active" : ""} onClick={() => switchMode("users")}><Users size={14}/>Uživatelé</button><button type="button" className={mode === "team" ? "active" : ""} onClick={() => switchMode("team")}><Users size={14}/>Tým</button></nav>
    {mode === "users" ? <><label className="dashboard-deploy-search"><Search size={14}/><input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder="Hledat aktivního uživatele…"/><span>{Object.keys(selectedUsers).length} vybráno</span></label><div className="dashboard-deploy-list">{busy ? <div className="table-loading"><span className="spinner"/>Načítám uživatele…</div> : rows.map((row) => <label className="dashboard-deploy-user" key={row.id}><input type="checkbox" checked={Boolean(selectedUsers[row.id])} onChange={(event) => setSelectedUsers((old) => { const next = { ...old }; if (event.target.checked) next[row.id] = row.name || row.userName || row.id; else delete next[row.id]; return next; })}/><span><strong>{row.name || row.userName || row.id}</strong><small>{row.userName || row.emailAddress || row.type || "Uživatel"}</small></span></label>)}</div></> : <><label className="dashboard-deploy-search"><Search size={14}/><input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder="Hledat tým…"/></label><label className="dashboard-deploy-team"><span>Cílový tým</span><select value={teamId} disabled={busy} onChange={(event) => setTeamId(event.target.value)}><option value="">Vyberte tým…</option>{rows.map((row) => <option value={row.id} key={row.id}>{row.name || row.id}</option>)}</select><small>Šablona se nasadí všem aktivním členům tohoto týmu.</small></label></>}
    {(total > pageSize || offset > 0) && <div className="dashboard-deploy-pagination"><button type="button" className="button subtle" disabled={busy || offset <= 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Předchozí</button><span>{total ? offset + 1 : 0}–{Math.min(offset + rows.length, total)} z {total}</span><button type="button" className="button subtle" disabled={busy || offset + pageSize >= total} onClick={() => setOffset(offset + pageSize)}>Další</button></div>}
    <label className="dashboard-deploy-append"><input type="checkbox" checked={append} onChange={(event) => setAppend(event.target.checked)}/><span><strong>Připojit panely ke stávajícímu dashboardu</strong><small>Vypnuto: stávající rozložení uživatele bude nahrazeno šablonou.</small></span></label>
    {error && <div className="inline-error">{error}</div>}<div className="modal-footer"><button type="button" className="button subtle" onClick={onClose} disabled={saving}>Zrušit</button><button type="button" className="button primary" onClick={() => void deploy()} disabled={saving || busy || (mode === "users" ? !Object.keys(selectedUsers).length : !teamId)}>{saving ? "Nasazuji…" : <><Check size={14}/> Nasadit {mode === "users" ? `uživatelům (${Object.keys(selectedUsers).length})` : "týmu"}</>}</button></div>
    </section></div>;
}
