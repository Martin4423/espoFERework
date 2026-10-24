import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderTree, Plus } from "./Icons";
import { entityLabel, request } from "./api";
import type { Metadata } from "./api";

type Row = Record<string, any>;
type CategoryChoice = { id: string; name: string } | { uncategorized: true } | null;
type TreeNodeProps = { row: Row; entity: string; depth: number; selectedId: string; onSelect: (row: Row) => void };

function CategoryTreeNode({ row, entity, depth, selectedId, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [children, setChildren] = useState<Row[]>([]);
  async function toggle() {
    if (!loaded) {
      setBusy(true);
      try {
        const params = new URLSearchParams({ parentId: row.id, maxSize: "200", offset: "0" });
        const result = await request<{ list?: Row[] }>(`${encodeURIComponent(entity)}/action/listTree?${params}`);
        setChildren(result.list || []);
        setLoaded(true);
      } catch { setChildren([]); setLoaded(true); }
      finally { setBusy(false); }
    }
    setExpanded((value) => !value);
  }
  const name = String(row.name || row.id);
  return <div className="category-nav-node"><div className={`category-nav-row ${selectedId === row.id ? "selected" : ""}`} style={{ paddingLeft: 8 + depth * 14 }}><button type="button" className="category-nav-select" onClick={() => onSelect(row)}><Folder size={14}/><span>{name}</span></button><button type="button" className="category-nav-expand" aria-label={`${expanded ? "Skrýt" : "Zobrazit"} podkategorie ${name}`} aria-expanded={expanded} disabled={busy} onClick={() => void toggle()}>{busy ? <span className="spinner small"/> : expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</button></div>{expanded && children.map((child) => <CategoryTreeNode key={child.id} row={child} entity={entity} depth={depth + 1} selectedId={selectedId} onSelect={onSelect}/>)}</div>;
}

export default function CategoryNavigation({ entity, metadata, selection, onSelect, onManage, canManage }: { entity: string; metadata: Metadata; selection: CategoryChoice; onSelect: (selection: CategoryChoice) => void; onManage: () => void; canManage: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    request<{ list?: Row[] }>(`${encodeURIComponent(entity)}/action/listTree?maxSize=200&offset=0`).then((result) => { if (live) setRows(result.list || []); })
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Kategorie se nepodařilo načíst."))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [entity]);
  const selectedId = selection && "id" in selection ? selection.id : "";
  const selectedUncategorized = Boolean(selection && "uncategorized" in selection);
  return <aside className="category-navigation"><div className="category-navigation-heading"><span>KATEGORIE</span>{canManage && <button type="button" className="icon-button" title={`Spravovat ${entityLabel(metadata, entity, true).toLowerCase()}`} aria-label={`Spravovat ${entityLabel(metadata, entity, true).toLowerCase()}`} onClick={onManage}><Plus size={14}/></button>}</div><button type="button" className={`category-nav-row category-nav-all ${!selection ? "selected" : ""}`} onClick={() => onSelect(null)}><FolderTree size={14}/><span>Všechny záznamy</span></button><button type="button" className={`category-nav-row category-nav-all ${selectedUncategorized ? "selected" : ""}`} onClick={() => onSelect({ uncategorized: true })}><Folder size={14}/><span>Bez kategorie</span></button>{error ? <div className="category-nav-error">{error}</div> : busy ? <div className="category-nav-loading"><span className="spinner"/>Načítám…</div> : rows.length ? rows.map((row) => <CategoryTreeNode key={row.id} row={row} entity={entity} depth={0} selectedId={selectedId} onSelect={(item) => onSelect({ id: item.id, name: String(item.name || item.id) })}/>) : <small className="category-nav-empty">Zatím nejsou vytvořené kategorie.</small>}</aside>;
}
