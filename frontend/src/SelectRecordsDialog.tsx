import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, X } from "./Icons";
import { entityLabel, fetchLayout, fieldLabel, getListFields, request } from "./api";
import type { LayoutItem, Metadata, FieldDef } from "./api";
import CategoryNavigation from "./CategoryNavigation";

type Row = Record<string, any>;
type Result = { list?: Row[]; total?: number };

/** Server paged replacement for EspoCRM select-records modal. */
export default function SelectRecordsDialog({ entity, metadata, multiple, selectedIds, selectedRows, primaryFilter, boolFilterList = [], filterList = [], fixedWhere = [], mandatorySelectAttributeList = [], massRelateEnabled = false, onMassSelect, onCreate, onClose, onSelect, onSkip, skipLabel = "Pokračovat bez záznamu" }: { entity: string; metadata: Metadata; multiple: boolean; selectedIds: string[]; selectedRows: Row[]; primaryFilter?: string; boolFilterList?: string[]; filterList?: string[]; fixedWhere?: Row[]; mandatorySelectAttributeList?: string[]; massRelateEnabled?: boolean; onMassSelect?: (selection: { massRelate: true; where: Row[]; searchParams: Record<string, unknown> }) => void; onCreate?: () => void; onClose: () => void; onSelect: (rows: Row[]) => void; onSkip?: () => void; skipLabel?: string }) {
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
  const [selectAllResults, setSelectAllResults] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const submitRef = useRef<() => void>(() => {});
  onCloseRef.current = onClose;
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
    filterList.forEach((name) => params.append("filterList[]", name));
    if (where.length) params.set("whereGroup", JSON.stringify(where));
    request<Result>(`${encodeURIComponent(entity)}?${params}`).then((result) => {
      if (!live) return;
      setRows(Array.isArray(result.list) ? result.list : []); setTotal(Number(result.total) || 0);
      setSelected((current) => { const next = new Map(current); (result.list || []).forEach((row) => { if (next.has(row.id)) next.set(row.id, row); }); return next; });
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Záznamy se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [entity, offset, search, primaryFilter, boolFilterList.join(","), filterList.join(","), fixedWhereKey, mandatorySelectKey, columns.join(","), categorySelection, categoryField, categoryFieldType]);
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onCloseRef.current(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        const searchInput = dialog?.querySelector<HTMLInputElement>(".select-records-search input");
        if (searchInput) { event.preventDefault(); searchInput.focus(); }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        if (!dialog || !multiple) return;
        event.preventDefault(); event.stopPropagation(); submitRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => { window.removeEventListener("keydown", handleKeys); previouslyFocused?.focus(); };
  }, []);
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
  function submit() {
    if (selectAllResults && massRelateEnabled && onMassSelect) {
      const where: Row[] = [...fixedWhere];
      if (search.trim()) where.push({ type: "textFilter", value: search.trim() });
      if (categorySelection && "uncategorized" in categorySelection) where.push(categoryFieldType === "linkMultiple" ? { type: "isNotLinked", attribute: categoryField } : { type: "isNull", attribute: `${categoryField}Id` });
      else if (categorySelection) where.push({ type: "inCategory", attribute: categoryField, value: categorySelection.id });
      const searchParams: Record<string, unknown> = { orderBy: fields.name ? "name" : fields.subject ? "subject" : "createdAt", order: "asc" };
      if (primaryFilter) searchParams.primaryFilter = primaryFilter;
      if (boolFilterList.length) searchParams.boolFilterList = boolFilterList;
      onMassSelect({ massRelate: true, where, searchParams });
      onClose();
      return;
    }
    onSelect(selectedList.filter((row) => selectedIds.includes(row.id) || selected.has(row.id)));
  }
  submitRef.current = submit;
  return <div className="modal-backdrop select-records-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} tabIndex={-1} className={`select-records-dialog ${showCategories ? "has-categories" : ""}`} role="dialog" aria-modal="true" aria-labelledby="select-records-title"><header><div><span className="eyebrow">VÝBĚR ZÁZNAMU</span><h2 id="select-records-title">{entityLabel(metadata, entity, true)}</h2><p aria-live="polite">{multiple ? `${selected.size} vybráno · lze vybírat napříč stránkami · Ctrl+Enter potvrdí výběr` : "Vyberte záznam ze seznamu."}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={16}/></button></header><form className="select-records-search" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(query); setSelectAllResults(false); }}><Search size={15}/><input autoFocus aria-keyshortcuts="Control+/ Meta+/" aria-label={`Hledat ${entityLabel(metadata, entity, true).toLocaleLowerCase("cs")}. Stiskněte Control+lomítko pro návrat do hledání.`} value={query} onChange={(event) => { setQuery(event.target.value); setSelectAllResults(false); }} placeholder={`Hledat ${entityLabel(metadata, entity, true).toLocaleLowerCase("cs")}…`}/><button className="button subtle">Hledat</button></form><div className="select-records-content">{showCategories && <CategoryNavigation entity={categoryScope} metadata={metadata} selection={categorySelection} onSelect={(selection) => { setCategorySelection(selection); setOffset(0); setSelectAllResults(false); }} canManage={false} onManage={() => {}}/>}<div className="select-records-table-wrap" aria-live="polite" aria-busy={busy}>{error ? <div className="inline-error" role="alert">{error}</div> : <table className="select-records-table"><thead><tr>{multiple && <th aria-label="Výběr"/>}{columns.map((name) => <th key={name}>{fieldLabel(name, fields[name], entity, metadata)}</th>)}</tr></thead><tbody>{busy ? <tr><td colSpan={columns.length + Number(multiple)} className="select-records-empty">Načítám záznamy…</td></tr> : rows.length ? rows.map((row) => <tr key={row.id} tabIndex={0} aria-selected={selected.has(row.id) || selectAllResults} className={selected.has(row.id) || selectAllResults ? "selected" : ""} onClick={() => { setSelectAllResults(false); toggle(row); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectAllResults(false); toggle(row); } }}>{multiple && <td><input type="checkbox" aria-label={`Vybrat ${rowName(row)}`} checked={selected.has(row.id) || selectAllResults} onChange={() => { setSelectAllResults(false); toggle(row); }} onClick={(event) => event.stopPropagation()}/></td>}{columns.map((name) => <td key={name} title={format(row, name)}>{name === "name" ? rowName(row) : format(row, name)}</td>)}</tr>) : <tr><td colSpan={columns.length + Number(multiple)} className="select-records-empty">Nenalezeny žádné záznamy.</td></tr>}</tbody></table>}</div></div><footer><div className="select-records-pagination"><span>{total ? `${offset + 1}–${Math.min(offset + pageSize, total)} z ${total}` : "0 záznamů"}</span><button type="button" className="icon-button" aria-label="Předchozí stránka" disabled={page <= 1 || busy} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ChevronLeft size={15}/></button><span>Stránka {page} / {pageCount}</span><button type="button" className="icon-button" aria-label="Další stránka" disabled={page >= pageCount || busy} onClick={() => setOffset(offset + pageSize)}><ChevronRight size={15}/></button></div><div className="select-records-footer-actions">{massRelateEnabled && multiple && onMassSelect && <label className="select-records-all-results"><input type="checkbox" checked={selectAllResults} onChange={(event) => { setSelectAllResults(event.target.checked); if (event.target.checked) setSelected(new Map()); }}/><span>Všechny výsledky ({total})</span></label>}{onCreate && <button type="button" className="button subtle" onClick={onCreate}>+ Vytvořit nový</button>}{onSkip && <button type="button" className="button subtle" onClick={onSkip}>{skipLabel}</button>}<button type="button" className="button subtle" onClick={onClose}>Zrušit</button>{multiple && <button type="button" className="button primary" aria-keyshortcuts="Control+Enter Meta+Enter" onClick={submit}><Check size={14}/> {selectAllResults ? `Navázat výsledky (${total})` : `Potvrdit výběr (${selected.size})`}</button>}</div></footer></section></div>;
}
