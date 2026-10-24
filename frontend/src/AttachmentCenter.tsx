import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, File, FileImage, FileText, Image as ImageIcon, Link2, LoaderCircle, RefreshCw, Search, Trash2, X } from "./Icons";
import { canChangeEntity, downloadAttachment, entityLabel, getAttachmentPreviewUrl, request } from "./api";
import type { Metadata } from "./api";
import { formatEspoDateTime, useEspoTimeZone } from "./timeZone";
import { useDialogFocus } from "./useDialogFocus";

type Attachment = Record<string, any> & { id: string; name?: string; type?: string; size?: number };
const pageSize = 36;

function formatSize(value: unknown) {
  const bytes = Number(value || 0);
  if (!bytes) return "Velikost neznámá";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} kB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB`;
  return `${(bytes / 1024 ** 3).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} GB`;
}

function kindOf(item: Attachment) {
  const mime = String(item.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || mime.startsWith("text/") || /word|excel|sheet|document|presentation|zip|json|xml/.test(mime)) return "document";
  return "other";
}

function fileIcon(item: Attachment) {
  const kind = kindOf(item);
  return kind === "image" ? FileImage : kind === "document" ? FileText : File;
}

function attachmentRoleLabel(item: Attachment, metadata: Metadata) {
  const role = String(item.role || "");
  return role ? (metadata.labels as any)?.Attachment?.options?.role?.[role] || role : "";
}

function AttachmentPreviewDialog({ item, metadata, url, loading, error, onClose, onRetry, onDownload, onOpenAttachment, onOpenRelated }: {
  item: Attachment;
  metadata: Metadata;
  url: string;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onDownload: () => void;
  onOpenAttachment: () => void;
  onOpenRelated: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLElement>(onClose);
  const hasRelation = Boolean((item.relatedType || item.parentType) && (item.relatedId || item.parentId));
  return <div className="modal-backdrop attachment-preview-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} tabIndex={-1} className="attachment-preview" role="dialog" aria-modal="true" aria-label={`Náhled souboru ${item.name || "přílohy"}`}><header><div><span className="eyebrow">NÁHLED PŘÍLOHY</span><strong title={item.name}>{item.name || "Soubor"}</strong><small>{[item.type || "Neznámý typ", attachmentRoleLabel(item, metadata), formatSize(item.size)].filter(Boolean).join(" · ")}</small></div><div><button type="button" className="button subtle" onClick={onOpenAttachment}><FileText size={14}/>Podrobnosti</button><button type="button" className="button subtle" onClick={onDownload}><ArrowDownToLine size={14}/>Stáhnout</button><button type="button" className="icon-button" aria-label="Zavřít náhled" onClick={onClose}><X size={16}/></button></div></header><div className="attachment-preview-body" aria-busy={loading}>{loading ? <div role="status" aria-label="Načítám náhled"><LoaderCircle className="spin" size={26}/></div> : error ? <div className="attachment-preview-unsupported" role="alert"><FileText size={32}/><strong>Náhled se nepodařilo načíst</strong><span>{error}</span><button type="button" className="button subtle" onClick={onRetry}><RefreshCw size={13}/>Zkusit znovu</button></div> : url && kindOf(item) === "image" ? <img src={url} alt={item.name || "Náhled obrázku"}/> : url && item.type === "application/pdf" ? <iframe src={url} title={`PDF ${item.name || "náhled"}`}/> : <div className="attachment-preview-unsupported"><FileText size={32}/><strong>Náhled není dostupný</strong><span>Stáhněte soubor, abyste ho otevřeli.</span></div>}</div><footer><span>{item.relatedType || item.parentType ? `Soubor patří k záznamu ${item.relatedName || item.parentName || "v CRM"}.` : "Soubor není propojený se záznamem."}</span>{hasRelation && <button type="button" className="button subtle" onClick={onOpenRelated}><Link2 size={13}/>Otevřít záznam</button>}</footer></section></div>;
}

export default function AttachmentCenter({ metadata, onOpenRecord }: { metadata: Metadata; onOpenRecord: (entity: string, record: Attachment) => void }) {
  const timeZone = useEspoTimeZone();
  const [rows, setRows] = useState<Attachment[]>([]);
  const [total, setTotal] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState({ image: 0, document: 0 });
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewReload, setPreviewReload] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openingDetails, setOpeningDetails] = useState(false);
  const canDelete = canChangeEntity(metadata, "Attachment", "delete");
  const page = Math.floor(offset / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  async function load() {
    setBusy(true); setError(""); setSelected([]);
    try {
      const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: "createdAt", order: "desc" });
      const where: Record<string, any>[] = search.trim() ? [{ type: "textFilter", value: search.trim() }] : [];
      if (category === "orphan") where.push({ type: "primary", value: "orphan" });
      else if (category === "image") where.push({ type: "startsWith", attribute: "type", value: "image/" });
      else if (category === "document") where.push({ type: "or", value: [{ type: "equals", attribute: "type", value: "application/pdf" }, { type: "startsWith", attribute: "type", value: "text/" }, ...["word", "excel", "sheet", "document", "presentation", "zip", "json", "xml"].map((value) => ({ type: "contains", attribute: "type", value }))] });
      if (where.length) params.set("whereGroup", JSON.stringify(where));
      const result = await request<{ list?: Attachment[]; total?: number }>(`Attachment?${params.toString()}`);
      setRows(result.list || []); setTotal(Number(result.total || 0));
      const countWhere = search.trim() ? [{ type: "textFilter", value: search.trim() }] : [];
      const countParams = (condition: Record<string, any>) => { const query = new URLSearchParams({ maxSize: "1", offset: "0" }); query.set("whereGroup", JSON.stringify([...countWhere, condition])); return request<{ total?: number }>(`Attachment?${query.toString()}`); };
      const [images, documents] = await Promise.all([countParams({ type: "startsWith", attribute: "type", value: "image/" }), countParams({ type: "or", value: [{ type: "equals", attribute: "type", value: "application/pdf" }, { type: "startsWith", attribute: "type", value: "text/" }, ...["word", "excel", "sheet", "document", "presentation", "zip", "json", "xml"].map((value) => ({ type: "contains", attribute: "type", value }))] })]);
      setCategoryCounts({ image: Number(images.total || 0), document: Number(documents.total || 0) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Přílohy se nepodařilo načíst."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, [offset, search, category]);
  const visibleRows = rows;

  useEffect(() => {
    let live = true;
    setPreviewUrl("");
    setPreviewError("");
    if (!preview || !["image", "document"].includes(kindOf(preview)) || (kindOf(preview) === "document" && preview.type !== "application/pdf")) { setLoadingPreview(false); return; }
    setLoadingPreview(true);
    getAttachmentPreviewUrl(preview.id).then((url) => {
      if (live) setPreviewUrl(url); else URL.revokeObjectURL(url);
    }).catch((cause) => live && setPreviewError(cause instanceof Error ? cause.message : "Náhled souboru se nepodařilo otevřít.")).finally(() => live && setLoadingPreview(false));
    return () => { live = false; };
  }, [preview, previewReload]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function chooseCategory(next: string) { setCategory(next); setOffset(0); setSelected([]); }
  function selectAll(checked: boolean) { setSelected(checked ? visibleRows.map((row) => row.id) : []); }
  function toggleSelected(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function removeSelected() {
    if (!canDelete || !selected.length || !window.confirm(`Opravdu smazat ${selected.length} vybraných příloh?`)) return;
    setDeleting(true); setError("");
    try {
      const results = await Promise.allSettled(selected.map((id) => request(`Attachment/${encodeURIComponent(id)}`, { method: "DELETE" })));
      const failed = results.filter((result) => result.status === "rejected").length;
      await load();
      if (failed) setError(`${failed} vybrané přílohy se nepodařilo smazat. Zkontrolujte oprávnění a zkuste to znovu.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Přílohy se nepodařilo smazat."); }
    finally { setDeleting(false); }
  }
  async function removeOne(item: Attachment) {
    if (!canDelete || !window.confirm(`Opravdu smazat přílohu „${item.name || "soubor"}“?`)) return;
    setDeleting(true); setError("");
    try { await request(`Attachment/${encodeURIComponent(item.id)}`, { method: "DELETE" }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Přílohu se nepodařilo smazat."); }
    finally { setDeleting(false); }
  }
  async function openRelated(item: Attachment) {
    const entity = item.relatedType || item.parentType;
    const id = item.relatedId || item.parentId;
    if (!entity || !id) return;
    try { const record = await request<Attachment>(`${encodeURIComponent(entity)}/${encodeURIComponent(id)}`); onOpenRecord(entity, record); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Související záznam není dostupný."); }
  }
  function showPreview(item: Attachment) {
    setPreview(item); setPreviewError(""); setError("");
  }
  async function openAttachmentDetails(item: Attachment) {
    setOpeningDetails(true); setPreviewError("");
    try { const fullRecord = await request<Attachment>(`Attachment/${encodeURIComponent(item.id)}`); setPreview(null); onOpenRecord("Attachment", fullRecord); }
    catch (cause) { setPreviewError(cause instanceof Error ? cause.message : "Detail přílohy se nepodařilo otevřít."); }
    finally { setOpeningDetails(false); }
  }

  return <div className="attachment-center">
    <div className="entity-heading"><div><div className="eyebrow">SOUBORY CRM</div><h1>Přílohy<span className="title-count">{total.toLocaleString("cs-CZ")}</span></h1><p>Prohlížejte soubory uložené v záznamech EspoCRM.</p></div><button type="button" className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/>Obnovit</button></div>
    <section className="surface attachment-surface">
      <div className="attachment-toolbar"><div className="attachment-tabs" role="tablist" aria-label="Typ příloh"><button className={category === "all" ? "active" : ""} onClick={() => chooseCategory("all")}>Vše <b>{total.toLocaleString("cs-CZ")}</b></button><button className={category === "image" ? "active" : ""} onClick={() => chooseCategory("image")}><ImageIcon size={13}/>Obrázky <b>{categoryCounts.image.toLocaleString("cs-CZ")}</b></button><button className={category === "document" ? "active" : ""} onClick={() => chooseCategory("document")}><FileText size={13}/>Dokumenty <b>{categoryCounts.document.toLocaleString("cs-CZ")}</b></button>{metadata.clientDefs?.Attachment?.filterList?.includes("orphan") && <button className={category === "orphan" ? "active" : ""} onClick={() => chooseCategory("orphan")} title="Soubory bez platného rodičovského záznamu">{(metadata.labels as any)?.Attachment?.presetFilters?.orphan || "Osamocené"}</button>}</div><form className="attachment-search" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(query.trim()); }}><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat soubory…" aria-label="Hledat soubory"/><button type="submit" aria-label="Spustit hledání"><ArrowRight size={13}/></button></form></div>
      {selected.length > 0 && <div className="attachment-bulkbar"><span>{selected.length} vybráno</span>{canDelete && <button type="button" onClick={() => void removeSelected()} disabled={deleting}><Trash2 size={13}/>{deleting ? "Mažu…" : "Smazat vybrané"}</button>}<button type="button" onClick={() => setSelected([])}>Zrušit výběr</button></div>}
      {error && <div className="table-error">{error}<button onClick={() => setError("")}>Zavřít</button></div>}
      <div className="attachment-grid-head"><label><input type="checkbox" checked={visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id))} onChange={(event) => selectAll(event.target.checked)} aria-label="Vybrat všechny zobrazené přílohy"/> Název souboru</label><span>Typ a velikost</span><span>Související záznam</span><span>Přidáno</span></div>
      {busy ? <div className="table-loading attachment-loading"><span className="spinner"/> Načítám přílohy…</div> : visibleRows.length ? <div className="attachment-list">{visibleRows.map((item) => { const Icon = fileIcon(item); const relatedEntity = item.relatedType || item.parentType; const relatedName = item.relatedName || item.parentName || (relatedEntity ? entityLabel(metadata, relatedEntity, false) : "Bez záznamu"); return <article className={`attachment-row ${selected.includes(item.id) ? "selected" : ""}`} key={item.id}>
        <label className="attachment-select"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Vybrat ${item.name || "soubor"}`}/></label>
        <button type="button" className="attachment-file" onClick={() => showPreview(item)}><span className={`attachment-file-icon ${kindOf(item)}`}><Icon size={18}/></span><span><strong title={item.name}>{item.name || "Soubor bez názvu"}</strong><small>{[item.type || "Neznámý typ", attachmentRoleLabel(item, metadata)].filter(Boolean).join(" · ")}</small></span></button>
        <span className="attachment-size">{formatSize(item.size)}</span><div className="attachment-related">{relatedEntity && (item.relatedId || item.parentId) ? <button type="button" onClick={() => void openRelated(item)}><Link2 size={13}/>{relatedName}</button> : <span>{relatedName}</span>}</div>
        <time className="attachment-date" dateTime={item.createdAt || undefined}>{formatEspoDateTime(item.createdAt, timeZone)}</time><div className="attachment-actions"><button type="button" className="icon-button" title="Stáhnout" aria-label={`Stáhnout ${item.name || "soubor"}`} onClick={() => void downloadAttachment(item.id, item.name || "soubor")}><ArrowDownToLine size={15}/></button>{canDelete && <button type="button" className="icon-button danger-ghost" title="Smazat" aria-label={`Smazat ${item.name || "soubor"}`} disabled={deleting} onClick={() => void removeOne(item)}><Trash2 size={14}/></button>}</div>
      </article>; })}</div> : <div className="attachment-empty"><span><File size={20}/></span><strong>{search ? "Žádné soubory nenalezeny" : "Zatím tu nejsou žádné přílohy"}</strong><small>{search ? "Zkuste jiný název nebo změňte filtr." : "Soubory se objeví po přiložení k záznamům v CRM."}</small></div>}
      <footer className="attachment-pagination"><span>Zobrazeno {total ? (offset + 1).toLocaleString("cs-CZ") : 0}–{Math.min(offset + pageSize, total).toLocaleString("cs-CZ")} z {total.toLocaleString("cs-CZ")}</span><div><button type="button" className="button subtle" disabled={offset <= 0 || busy} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ArrowLeft size={13}/>Předchozí</button><b>{page} / {pageCount}</b><button type="button" className="button subtle" disabled={offset + pageSize >= total || busy} onClick={() => setOffset(offset + pageSize)}>Další<ArrowRight size={13}/></button></div></footer>
    </section>
    {preview && <AttachmentPreviewDialog item={preview} metadata={metadata} url={previewUrl} loading={loadingPreview || openingDetails} error={previewError} onClose={() => setPreview(null)} onRetry={() => setPreviewReload((value) => value + 1)} onDownload={() => void downloadAttachment(preview.id, preview.name || "soubor")} onOpenAttachment={() => void openAttachmentDetails(preview)} onOpenRelated={() => void openRelated(preview)}/>}
  </div>;
}
