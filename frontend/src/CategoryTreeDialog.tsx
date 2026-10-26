import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, FolderTree, X } from "./Icons";
import { entityLabel, request } from "./api";
import type { Metadata } from "./api";

type Row = Record<string, any>;
type Result = { list?: Row[]; total?: number };
type Level = { id: string | null; name: string; rows: Row[] };

/** Hierarchical category chooser backed by the server's listTree action. */
export default function CategoryTreeDialog({ entity, metadata, multiple, selectedIds, selectedRows, onClose, onSelect }: { entity: string; metadata: Metadata; multiple: boolean; selectedIds: string[]; selectedRows: Row[]; onClose: () => void; onSelect: (rows: Row[]) => void }) {
  const [levels, setLevels] = useState<Level[]>([{ id: null, name: "Všechny kategorie", rows: [] }]);
  const [selected, setSelected] = useState<Map<string, Row>>(() => new Map(selectedRows.filter((row) => selectedIds.includes(row.id)).map((row) => [row.id, row])));
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const level = levels[levels.length - 1];
  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    const params = new URLSearchParams({ maxSize: "200", offset: "0" });
    if (level.id) params.set("parentId", level.id);
    request<Result>(`${encodeURIComponent(entity)}/action/listTree?${params}`).then((result) => {
      if (!live) return;
      const rows: Row[] = Array.isArray(result.list) ? result.list : Array.isArray((result as any).collection) ? (result as any).collection as Row[] : [];
      setLevels((current) => current.map((item, index) => index === current.length - 1 ? { ...item, rows } : item));
      setSelected((current) => { const next = new Map(current); rows.forEach((row) => { if (next.has(row.id)) next.set(row.id, row); }); return next; });
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Strom kategorií nelze načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [entity, level.id]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const rowName = (row: Row) => row.name || row.id;
  function expand(row: Row) { setLevels((current) => [...current, { id: row.id, name: rowName(row), rows: [] }]); }
  function choose(row: Row) { if (!multiple) { onSelect([row]); return; } setSelected((current) => { const next = new Map(current); if (next.has(row.id)) next.delete(row.id); else next.set(row.id, row); return next; }); }
  function confirm() { onSelect([...selected.values()]); }
  return <div className="modal-backdrop category-tree-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="category-tree-dialog" role="dialog" aria-modal="true" aria-labelledby="category-tree-title"><header><div><span className="eyebrow">VÝBĚR Z HIERARCHIE</span><h2 id="category-tree-title">{entityLabel(metadata, entity, true)}</h2><p>{multiple ? `${selected.size} kategorií vybráno` : "Vyberte kategorii nebo přejděte do její podkategorie."}</p></div><button type="button" className="icon-button" aria-label="Zavřít" onClick={onClose}><X size={16}/></button></header><nav className="category-tree-breadcrumb" aria-label="Cesta kategorií">{levels.map((item, index) => <span key={`${item.id || "root"}-${index}`}>{index > 0 && <ChevronRight size={12}/>}<button type="button" disabled={index === levels.length - 1} onClick={() => setLevels((current) => current.slice(0, index + 1))}>{item.name}</button></span>)}</nav>{error ? <div className="inline-error">{error}</div> : <div className="category-tree-list">{level.id && <button type="button" className="category-tree-parent" onClick={() => setLevels((current) => current.slice(0, -1))}><ChevronLeft size={14}/> Zpět na nadřazenou úroveň</button>}{busy ? <div className="table-loading"><span className="spinner"/>Načítám kategorie…</div> : level.rows.length ? level.rows.map((row) => <div className={`category-tree-row ${selected.has(row.id) ? "selected" : ""}`} key={row.id}><button type="button" className="category-tree-select" onClick={() => choose(row)}>{multiple && <input type="checkbox" readOnly checked={selected.has(row.id)}/>}<FolderTree size={15}/><span>{rowName(row)}</span></button><button type="button" className="category-tree-expand" onClick={() => expand(row)} title={`Otevřít podkategorie ${rowName(row)}`} aria-label={`Otevřít podkategorie ${rowName(row)}`}><ChevronDown size={15}/></button></div>) : <div className="category-tree-empty">Tato úroveň neobsahuje žádné kategorie.</div>}</div>}<footer><button type="button" className="button subtle" onClick={onClose}>Zrušit</button>{multiple && <button type="button" className="button primary" onClick={confirm}><Check size={14}/> Potvrdit výběr ({selected.size})</button>}</footer></section></div>;
}
