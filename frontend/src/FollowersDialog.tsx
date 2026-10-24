import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, UserRound, X } from "./Icons";
import { getSession, request } from "./api";
import type { Metadata } from "./api";
import SelectRecordsDialog from "./SelectRecordsDialog";

type Follower = Record<string, any>;
type Page = { list?: Follower[]; total?: number };

export default function FollowersDialog({ entity, recordId, metadata, canManage, currentUserId, onClose, onOpenUser, onChanged }: { entity: string; recordId: string; metadata: Metadata; canManage: boolean; currentUserId?: string; onClose: () => void; onOpenUser: (user: Follower) => void; onChanged: () => void }) {
  const [rows, setRows] = useState<Follower[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(true);
  const [removing, setRemoving] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 20;
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), select: "id,name,userName,type,avatarId,avatarName" });
      const result = await request<Page>(`${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}/followers?${params}`);
      setRows(result.list || []); setTotal(Number(result.total) || 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sledující se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, [entity, recordId, offset]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !selectOpen) onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose, selectOpen]);
  async function unlink(user: Follower) {
    if (!window.confirm(`Odebrat ${user.name || user.userName || "uživatele"} ze sledujících tohoto záznamu?`)) return;
    setRemoving(user.id); setError("");
    try {
      await request(`${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}/followers`, { method: "DELETE", body: JSON.stringify({ id: user.id }) });
      onChanged();
      if (rows.length === 1 && offset > 0) setOffset(Math.max(0, offset - pageSize)); else await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Uživatele se nepodařilo odebrat."); }
    finally { setRemoving(""); }
  }
  async function add(user: Follower) {
    setAdding(true); setError("");
    try {
      await request(`${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}/followers`, { method: "POST", body: JSON.stringify({ id: user.id }) });
      setSelectOpen(false); onChanged(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Uživatele se nepodařilo přidat mezi sledující."); }
    finally { setAdding(false); }
  }
  const page = Math.floor(offset / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const isAdmin = ["admin", "super-admin"].includes(String(getSession()?.user?.type || ""));
  const followerPermission = String(metadata.userAcl?.followerManagementPermission || "no");
  const portalPermission = String(metadata.userAcl?.portalPermission || "no");
  const canUnlink = (user: Follower) => isAdmin || followerPermission !== "no" || (user.type === "portal" && portalPermission === "yes") || user.id === currentUserId;
  const primaryFilter = !isAdmin && metadata.userAcl?.followerManagementPermission === "no" && metadata.userAcl?.portalPermission === "yes" ? "activePortal" : "active";
  return <><div className="modal-backdrop followers-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="followers-dialog" role="dialog" aria-modal="true" aria-labelledby="followers-title"><header><div><span className="eyebrow">SLEDUJÍCÍ</span><h2 id="followers-title">Uživatelé sledující záznam</h2><p>{total} sledujících · {metadata.labels?.Global?.scopeNames?.[entity] || entity}</p></div><div className="followers-header-actions">{canManage && <button type="button" className="button primary" onClick={() => setSelectOpen(true)} disabled={adding}><Plus size={14}/>Přidat sledujícího</button>}<button type="button" className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={16}/></button></div></header>{error && <div className="table-error">{error}<button type="button" onClick={() => void load()}>Zkusit znovu</button></div>}<div className="followers-list">{busy ? <div className="table-loading"><span className="spinner"/>Načítám sledující…</div> : rows.length ? rows.map((row) => <div className="followers-row" key={row.id}><button type="button" className="followers-user" onClick={() => onOpenUser(row)}><span className="followers-avatar"><UserRound size={15}/></span><span><strong>{row.name || row.userName || row.id}</strong><small>{row.userName || row.type || "Uživatel"}</small></span></button>{canUnlink(row) && <button type="button" className="button subtle followers-unlink" onClick={() => void unlink(row)} disabled={Boolean(removing)}>{removing === row.id ? "Odebírám…" : "Odebrat"}</button>}</div>) : !error ? <div className="followers-empty">Tento záznam zatím nikdo nesleduje.</div> : null}</div><footer><span>{total ? `${offset + 1}–${Math.min(offset + pageSize, total)} z ${total}` : "0 uživatelů"}</span><div><button type="button" className="icon-button" aria-label="Předchozí stránka" disabled={page <= 1 || busy} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ChevronLeft size={15}/></button><span>Stránka {page} / {pageCount}</span><button type="button" className="icon-button" aria-label="Další stránka" disabled={page >= pageCount || busy} onClick={() => setOffset(offset + pageSize)}><ChevronRight size={15}/></button></div></footer></section></div>{selectOpen && <SelectRecordsDialog entity="User" metadata={metadata} multiple={false} selectedIds={[]} selectedRows={[]} primaryFilter={primaryFilter} mandatorySelectAttributeList={["type"]} onClose={() => setSelectOpen(false)} onSelect={(users) => { if (users[0]) void add(users[0]); }}/>}</>;
}
