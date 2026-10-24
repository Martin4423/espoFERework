import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderTree, Plus } from "./Icons";
import { entityLabel, request } from "./api";
import type { Metadata } from "./api";

type Row = Record<string, any>;
type CategoryChoice = { id: string; name: string } | { uncategorized: true } | null;
const categoryPageSize = 200;
type TreeNodeProps = { row: Row; entity: string; depth: number; selectedId: string; onlyNotEmpty: boolean; onSelect: (row: Row) => void };

function CategoryTreeNode({ row, entity, depth, selectedId, onlyNotEmpty, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [retryMore, setRetryMore] = useState(false);
  const [children, setChildren] = useState<Row[]>([]);
  async function loadChildren(loadMore = false) {
    if (busy || loadingMore || loaded && (!loadMore || !hasMore)) return;
    const offset = loadMore ? children.length : 0;
    setError(""); setRetryMore(loadMore);
    if (loadMore) setLoadingMore(true); else setBusy(true);
    try {
      const params = new URLSearchParams({ parentId: row.id, maxSize: String(categoryPageSize), offset: String(offset) });
      if (onlyNotEmpty) params.set("onlyNotEmpty", "true");
      const result = await request<{ list?: Row[]; total?: number }>(`${encodeURIComponent(entity)}/action/listTree?${params}`);
      const list = result.list || [];
      setChildren((current) => loadMore ? [...current, ...list] : list);
      setHasMore(typeof result.total === "number" && result.total >= 0 ? offset + list.length < result.total : list.length >= categoryPageSize);
      setLoaded(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Podkategorie se nepodařilo načíst."); }
    finally { setBusy(false); setLoadingMore(false); }
  }
  async function toggle() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    await loadChildren();
  }
  const name = String(row.name || row.id);
  return <div className="category-nav-node"><div className={`category-nav-row ${selectedId === row.id ? "selected" : ""}`} style={{ paddingLeft: 8 + depth * 14 }}><button type="button" className="category-nav-select" onClick={() => onSelect(row)}><Folder size={14}/><span>{name}</span></button><button type="button" className="category-nav-expand" aria-label={`${expanded ? "Skrýt" : "Zobrazit"} podkategorie ${name}`} aria-expanded={expanded} disabled={busy} onClick={() => void toggle()}>{busy ? <span className="spinner small"/> : expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</button></div>{expanded && error && <div className="category-nav-error" role="alert">{error}<button type="button" onClick={() => void loadChildren(retryMore)}>Zkusit znovu</button></div>}{expanded && children.map((child) => <CategoryTreeNode key={child.id} row={child} entity={entity} depth={depth + 1} selectedId={selectedId} onlyNotEmpty={onlyNotEmpty} onSelect={onSelect}/>) }{expanded && hasMore && <button type="button" className="category-nav-load-more" style={{ marginLeft: 18 + depth * 14 }} disabled={loadingMore} onClick={() => void loadChildren(true)}>{loadingMore ? <><span className="spinner small"/>Načítám další…</> : `Načíst dalších ${categoryPageSize} kategorií`}</button>}</div>;
}

export default function CategoryNavigation({ entity, metadata, selection, onSelect, onManage, canManage, onlyNotEmpty = false, headerControl }: { entity: string; metadata: Metadata; selection: CategoryChoice; onSelect: (selection: CategoryChoice) => void; onManage: () => void; canManage: boolean; onlyNotEmpty?: boolean; headerControl?: ReactNode }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    const params = new URLSearchParams({ maxSize: String(categoryPageSize), offset: "0" });
    if (onlyNotEmpty) params.set("onlyNotEmpty", "true");
    request<{ list?: Row[]; total?: number }>(`${encodeURIComponent(entity)}/action/listTree?${params}`).then((result) => { if (live) { const list = result.list || []; setRows(list); setHasMore(typeof result.total === "number" && result.total >= 0 ? list.length < result.total : list.length >= categoryPageSize); } })
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Kategorie se nepodařilo načíst."))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [entity, onlyNotEmpty, reload]);
  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true); setMoreError("");
    try {
      const params = new URLSearchParams({ maxSize: String(categoryPageSize), offset: String(rows.length) });
      if (onlyNotEmpty) params.set("onlyNotEmpty", "true");
      const result = await request<{ list?: Row[]; total?: number }>(`${encodeURIComponent(entity)}/action/listTree?${params}`);
      const list = result.list || [];
      setRows((current) => [...current, ...list]);
      setHasMore(typeof result.total === "number" && result.total >= 0 ? rows.length + list.length < result.total : list.length >= categoryPageSize);
    } catch (cause) { setMoreError(cause instanceof Error ? cause.message : "Další kategorie se nepodařilo načíst."); }
    finally { setLoadingMore(false); }
  }
  const selectedId = selection && "id" in selection ? selection.id : "";
  const selectedUncategorized = Boolean(selection && "uncategorized" in selection);
  return <aside className="category-navigation"><div className="category-navigation-heading"><span>KATEGORIE</span>{headerControl}{canManage && <button type="button" className="icon-button" title={`Spravovat ${entityLabel(metadata, entity, true).toLowerCase()}`} aria-label={`Spravovat ${entityLabel(metadata, entity, true).toLowerCase()}`} onClick={onManage}><Plus size={14}/></button>}</div><button type="button" className={`category-nav-row category-nav-all ${!selection ? "selected" : ""}`} onClick={() => onSelect(null)}><FolderTree size={14}/><span>Všechny záznamy</span></button><button type="button" className={`category-nav-row category-nav-all ${selectedUncategorized ? "selected" : ""}`} onClick={() => onSelect({ uncategorized: true })}><Folder size={14}/><span>Bez kategorie</span></button>{error ? <div className="category-nav-error" role="alert">{error}<button type="button" onClick={() => { setError(""); setBusy(true); setReload((value) => value + 1); }}>Zkusit znovu</button></div> : busy ? <div className="category-nav-loading"><span className="spinner"/>Načítám…</div> : rows.length ? <>{rows.map((row) => <CategoryTreeNode key={row.id} row={row} entity={entity} depth={0} selectedId={selectedId} onlyNotEmpty={onlyNotEmpty} onSelect={(item) => onSelect({ id: item.id, name: String(item.name || item.id) })}/>)}{hasMore && <button type="button" className="category-nav-load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <><span className="spinner small"/>Načítám další…</> : `Načíst dalších ${categoryPageSize} kategorií`}</button>}{moreError && <div className="category-nav-error" role="alert">{moreError}<button type="button" onClick={() => void loadMore()}>Zkusit znovu</button></div>}</> : <small className="category-nav-empty">Zatím nejsou vytvořené kategorie.</small>}</aside>;
}
