import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, X } from "./Icons";
import { entityLabel, fetchLayout, fieldLabel, getListFields, request } from "./api";
import type { LayoutItem, Metadata, FieldDef } from "./api";
import CategoryNavigation from "./CategoryNavigation";

type Row = Record<string, any>;
type Result = { list?: Row[]; total?: number };

/** Server paged replacement for EspoCRM select-records modal. */
export default function SelectRecordsDialog({ entity, metadata, multiple, selectedIds, selectedRows, primaryFilter, boolFilterList = [], fixedWhere = [], mandatorySelectAttributeList = [], onClose, onSelect, onSkip, skipLabel = "Pokračovat bez záznamu" }: { entity: string; metadata: Metadata; multiple: boolean; selectedIds: string[]; selectedRows: Row[]; primaryFilter?: string; boolFilterList?: string[]; fixedWhere?: Row[]; mandatorySelectAttributeList?: string[]; onClose: () => void; onSelect: (rows: Row[]) => void; onSkip?: () => void; skipLabel?: string }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Map<string, Row>>(() => new Map(selectedRows.filter((row) => selectedIds.includes(row.id)).map((row) => [row.id, row])));
  const [columns, setColumns] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [categorySelection, setCategorySelection] = useState<{ id: string; name: string } | { uncategorized: true } | null>(null);
  const pageSize = 20;
  const fixedWhereKey = JSON.stringify(fixedWhere);
  const mandatorySelectKey = mandatorySelectAttributeList.join(",");
  const fields = metadata.entityDefs?.[entity]?.fields || {};
  const acl = metadata.userAcl?.fieldTable?.[entity] || {};
  const categoryScope = entity === "Document" ? "DocumentFolder" : entity === "KnowledgeBaseArticle" ? "KnowledgeBaseCategory" : "";
  const categoryField = String((metadata.scopes?.[categoryScope] as any)?.categoryField || (entity === "Document" ? "folder" : "category"));
  const categoryFieldType = fields[categoryField]?.type || "link";
  const showCategories = Boolean(categoryScope && metadata.scopes?.[categoryScope]?.entity && !metadata.scopes?.[categoryScope]?.disabled && metadata.userAcl?.[categoryScope]?.read !== "no");
  useEffect(() => {
    let live = true;
    fetchLayout<LayoutItem[]>(entity, "listSmall").then((layout) => {
      if (!live) return;
      const names = Array.isArray(layout) ? layout.flatMap((item) => item && typeof item === "object" && item.name && fields[item.name] && acl[item.name]?.read !== "no" ? [item.name] : []) : [];
      setColumns(names.length ? names : getListFields(metadata, entity).filter((name) => acl[name]?.read !== "no"));
    }).catch(() => live && setColumns(getListFields(metadata, entity).filter((name) => acl[name]?.read !== "no")));
    return () => { live = false; };
  }, [entity, metadata, fields, acl]);
  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    const sortField = fields.name ? "name" : fields.subject ? "subject" : "createdAt";
    const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: sortField, order: "asc" });
    const select = [...new Set([...columns, ...mandatorySelectAttributeList])];
    if (select.length) params.set("select", select.join(","));
    const where: Row[] = [...fixedWhere];
    if (search.trim()) where.push({ type: "textFilter", value: search.trim() });
    if (categorySelection && "uncategorized" in categorySelection) where.push(categoryFieldType === "linkMultiple" ? { type: "isNotLinked", attribute: categoryField } : { type: "isNull", attribute: `${categoryField}Id` });
    else if (categorySelection) where.push({ type: "inCategory", attribute: categoryField, value: categorySelection.id });
    if (primaryFilter) params.set("primaryFilter", primaryFilter);
    boolFilterList.forEach((name) => params.append("boolFilterList[]", name));
    if (where.length) params.set("whereGroup", JSON.stringify(where));
    request<Result>(`${encodeURIComponent(entity)}?${params}`).then((result) => {
      if (!live) return;
      setRows(Array.isArray(result.list) ? result.list : []); setTotal(Number(result.total) || 0);
      setSelected((current) => { const next = new Map(current); (result.list || []).forEach((row) => { if (next.has(row.id)) next.set(row.id, row); }); return next; });
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Záznamy se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [entity, offset, search, primaryFilter, boolFilterList.join(","), fixedWhereKey, mandatorySelectKey, columns.join(","), categorySelection, categoryField, categoryFieldType]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.floor(offset / pageSize) + 1;
  const selectedList = useMemo(() => [...selected.values()], [selected]);
  const rowName = (row: Row) => row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.userName || row.emailAddress || row.id;
  const format = (row: Row, name: string) => {
    const def: FieldDef = fields[name] || {};
    const value = row[name] ?? row[`${name}Name`] ?? row[`${name}Id`];
    if (value == null || value === "") return "—";
    if (def.type === "bool") return value ? "Ano" : "Ne";
    if (def.type === "enum" || def.type === "enumInt") return (metadata.labels as any)?.[entity]?.options?.[name]?.[String(value)] || String(value);
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };
  function toggle(row: Row) {
    if (!multiple) { onSelect([row]); return; }
    setSelected((current) => { const next = new Map(current); if (next.has(row.id)) next.delete(row.id); else next.set(row.id, row); return next; });
  }
  function submit() { onSelect(selectedList.filter((row) => selectedIds.includes(row.id) || selected.has(row.id))); }
  return <div className="modal-backdrop select-records-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`select-records-dialog ${showCategories ? "has-categories" : ""}`} role="dialog" aria-modal="true" aria-labelledby="select-records-title"><header><div><span className="eyebrow">VÝBĚR ZÁZNAMU</span><h2 id="select-records-title">{entityLabel(metadata, entity, true)}</h2><p>{multiple ? `${selected.size} vybráno · lze vybrat záznamy z více stránek` : "Vyberte záznam ze seznamu."}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={16}/></button></header><form className="select-records-search" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(query); }}><Search size={15}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Hledat ${entityLabel(metadata, entity, true).toLocaleLowerCase("cs")}…`}/><button className="button subtle">Hledat</button></form><div className="select-records-content">{showCategories && <CategoryNavigation entity={categoryScope} metadata={metadata} selection={categorySelection} onSelect={(selection) => { setCategorySelection(selection); setOffset(0); }} canManage={false} onManage={() => {}}/>}<div className="select-records-table-wrap">{error ? <div className="inline-error">{error}</div> : <table className="select-records-table"><thead><tr>{multiple && <th aria-label="Výběr"/>}{columns.map((name) => <th key={name}>{fieldLabel(name, fields[name], entity, metadata)}</th>)}</tr></thead><tbody>{busy ? <tr><td colSpan={columns.length + Number(multiple)} className="select-records-empty">Načítám záznamy…</td></tr> : rows.length ? rows.map((row) => <tr key={row.id} className={selected.has(row.id) ? "selected" : ""} onClick={() => toggle(row)}>{multiple && <td><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row)} onClick={(event) => event.stopPropagation()}/></td>}{columns.map((name) => <td key={name} title={format(row, name)}>{name === "name" ? rowName(row) : format(row, name)}</td>)}</tr>) : <tr><td colSpan={columns.length + Number(multiple)} className="select-records-empty">Nenalezeny žádné záznamy.</td></tr>}</tbody></table>}</div></div><footer><div className="select-records-pagination"><span>{total ? `${offset + 1}–${Math.min(offset + pageSize, total)} z ${total}` : "0 záznamů"}</span><button type="button" className="icon-button" aria-label="Předchozí stránka" disabled={page <= 1 || busy} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ChevronLeft size={15}/></button><span>Stránka {page} / {pageCount}</span><button type="button" className="icon-button" aria-label="Další stránka" disabled={page >= pageCount || busy} onClick={() => setOffset(offset + pageSize)}><ChevronRight size={15}/></button></div><div className="select-records-footer-actions">{onSkip && <button type="button" className="button subtle" onClick={onSkip}>{skipLabel}</button>}<button type="button" className="button subtle" onClick={onClose}>Zrušit</button>{multiple && <button type="button" className="button primary" onClick={submit}><Check size={14}/> Potvrdit výběr ({selected.size})</button>}</div></footer></section></div>;
}
