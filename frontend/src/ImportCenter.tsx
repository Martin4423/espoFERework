import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleAlert, Clock3, Copy, ExternalLink, FileInput, FileSpreadsheet, Pencil, RefreshCw, RotateCcw, Save, Trash2, Upload, X } from "./Icons";
import { canChangeEntity, downloadAttachment, entityLabel, fieldLabel, fetchLayout, getListFields, getSession, request } from "./api";
import type { LayoutItem, Metadata } from "./api";

type Row = Record<string, any>;
type HistoryResult = { list: Row[]; total: number };
type ImportParams = { entityType: string; action: "create" | "update" | "createAndUpdate"; headerRow: boolean; delimiter: string; decimalMark: string; dateFormat: string; timeFormat: string; timezone: string; currency?: string; silentMode: boolean; manualMode: boolean; idleMode: boolean; skipDuplicateChecking: boolean; textQualifier: string; personNameFormat: string };

function ImportErrorList({ items, total, offset, busy, metadata, onPage, onExport, exportBusy }: { items: Row[]; total: number; offset: number; busy: boolean; metadata: Metadata; onPage: (offset: number) => void; onExport: () => void; exportBusy: boolean }) {
  const pageSize = 20;
  function lineNumber(item: Row) {
    if (item.lineNumber != null) return item.lineNumber;
    if (item.exportLineNumber != null) return item.exportLineNumber;
    const index = item.exportRowIndex ?? item.rowIndex;
    return Number.isFinite(Number(index)) ? Number(index) + 1 : "—";
  }
  function failureLabel(failure: any, entity: string) {
    if (typeof failure === "string") return failure;
    const failureEntity = String(failure.entityType || entity);
    const field = failure.field ? fieldLabel(String(failure.field), metadata.entityDefs?.[failureEntity]?.fields?.[failure.field], failureEntity, metadata) : "Pole";
    const type = (metadata.labels as any)?.Global?.fieldValidations?.[failure.type] || failure.label || failure.type || "Neplatná hodnota";
    return `${field}: ${failure.message || type}`;
  }
  function typeLabel(type: unknown) {
    const key = String(type || "");
    const translated = (metadata.labels as any)?.ImportError?.options?.type?.[key];
    if (translated) return translated;
    return ({ Validation: "Validace", "No-Access": "Bez přístupu", Access: "Přístup", "Not-Found": "Nenalezeno", "Integrity-Constraint-Violation": "Konflikt integrity" } as Record<string, string>)[key] || key || "Chyba";
  }
  return <div className="import-error-report"><div className="import-error-heading"><strong><CircleAlert size={14}/> Chyby a přeskočené řádky ({total})</strong><button className="button subtle" onClick={onExport} disabled={exportBusy}><FileSpreadsheet size={13}/>Exportovat CSV</button></div>{busy ? <div className="table-loading"><span className="spinner"/>Načítám chyby…</div> : items.length ? <div className="import-error-list">{items.map((item) => <article key={item.id}><strong>Řádek {lineNumber(item)} · {typeLabel(item.type)}</strong>{Array.isArray(item.validationFailures) && item.validationFailures.length ? <ul>{item.validationFailures.map((failure: any, index: number) => <li key={index}>{failureLabel(failure, item.entityType || "")}</li>)}</ul> : <span>Záznam nebyl zpracován.</span>}{item.row != null && <details><summary>Zdrojová data řádku</summary><pre>{JSON.stringify(item.row, null, 2)}</pre></details>}</article>)}</div> : <div className="import-error-empty">Import neobsahuje žádné chybové řádky.</div>}{total > pageSize && <div className="import-error-pagination"><button className="button subtle" disabled={offset <= 0 || busy} onClick={() => onPage(Math.max(0, offset - pageSize))}><ArrowLeft size={13}/>Předchozí</button><span>{offset + 1}–{Math.min(offset + items.length, total)} z {total}</span><button className="button subtle" disabled={offset + pageSize >= total || busy} onClick={() => onPage(offset + pageSize)}>Další<ArrowRight size={13}/></button></div>}</div>;
}

function ImportResultRecords({ importId, entity, relation, metadata, onOpenRecord, onChanged }: { importId: string; entity: string; relation: "imported" | "updated" | "duplicates"; metadata: Metadata; onOpenRecord?: (entity: string, row: Row) => void; onChanged: () => void }) {
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const pageSize = 20;
  const fallbackFields = useMemo(() => getListFields(metadata, entity), [metadata, entity]);
  const [layoutFields, setLayoutFields] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    fetchLayout<LayoutItem[][]>(entity, "listSmall").then((layout) => {
      const result = Array.from(new Set((layout || []).flat().filter((item): item is Exclude<LayoutItem, false> => Boolean(item && typeof item === "object" && item.name)).map((item) => item.name!).filter((name) => Boolean(metadata.entityDefs?.[entity]?.fields?.[name]))));
      if (live) setLayoutFields(result);
    }).catch(() => live && setLayoutFields([]));
    return () => { live = false; };
  }, [entity, metadata]);
  const fields = layoutFields.length ? layoutFields : fallbackFields;
  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: "createdAt", order: "desc" });
    request<HistoryResult>(`Import/${encodeURIComponent(importId)}/${relation}?${params}`).then((result) => {
      if (!live) return;
      setItems(result.list || []); setTotal(result.total || 0);
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Výsledky importu se nepodařilo načíst."))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [importId, relation, offset]);
  async function unmarkDuplicate(row: Row) {
    if (!window.confirm(`Odebrat označení duplicity u záznamu „${row.name || row.subject || row.id}“?`)) return;
    setActionId(row.id); setError("");
    try {
      await request(`Import/${encodeURIComponent(importId)}/unmarkDuplicates`, { method: "POST", body: JSON.stringify({ entityId: row.id, entityType: entity }) });
      setItems((current) => current.filter((item) => item.id !== row.id)); setTotal((current) => Math.max(0, current - 1));
      onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Označení duplicity se nepodařilo odebrat."); }
    finally { setActionId(""); }
  }
  function displayValue(row: Row, field: string) {
    const value = row[`${field}Name`] ?? row[field];
    if (value == null || value === "") return "—";
    if (typeof value === "object") return Array.isArray(value) ? value.join(", ") : value.name || value.value || JSON.stringify(value);
    if (typeof value === "boolean") return value ? "Ano" : "Ne";
    return String(value);
  }
  return <section className="import-result-records"><div className="import-result-records-heading"><div><strong>{relation === "imported" ? "Vytvořené záznamy" : relation === "updated" ? "Aktualizované záznamy" : "Duplicitní záznamy"}</strong><span>{total.toLocaleString("cs-CZ")} záznamů</span></div>{busy && <span className="spinner"/>}</div>{error && <div className="inline-error">{error}</div>}{busy && !items.length ? <div className="table-loading"><span className="spinner"/>Načítám záznamy…</div> : items.length ? <div className="import-result-records-table"><table><thead><tr>{fields.map((field) => <th key={field}>{fieldLabel(field, metadata.entityDefs?.[entity]?.fields?.[field], entity, metadata)}</th>)}<th>Akce</th></tr></thead><tbody>{items.map((row) => <tr key={row.id}><td colSpan={fields.length + 1} className="import-result-row-cell"><div className="import-result-row" style={{ gridTemplateColumns: `repeat(${Math.max(fields.length, 1)}, minmax(0, 1fr)) auto` }}>{fields.map((field) => <button type="button" className="import-result-value" key={field} title={displayValue(row, field)} onClick={() => onOpenRecord?.(entity, row)}>{displayValue(row, field)}</button>)}<div className="import-result-row-actions">{onOpenRecord && <button type="button" className="icon-button" title={relation === "updated" ? "Otevřít a případně upravit" : "Otevřít záznam"} aria-label="Otevřít záznam" onClick={() => onOpenRecord(entity, row)}>{relation === "updated" && canChangeEntity(metadata, entity, "edit") ? <Pencil size={14}/> : <ExternalLink size={14}/>}</button>}{relation === "duplicates" && <button type="button" className="icon-button" title="Odebrat označení duplicity" aria-label="Odebrat označení duplicity" disabled={actionId === row.id} onClick={() => void unmarkDuplicate(row)}><X size={14}/></button>}</div></div></td></tr>)}</tbody></table></div> : <div className="import-error-empty">V této skupině nejsou žádné záznamy.</div>}{total > pageSize && <div className="import-error-pagination"><button className="button subtle" disabled={offset <= 0 || busy} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ArrowLeft size={13}/>Předchozí</button><span>{offset + 1}–{Math.min(offset + items.length, total)} z {total}</span><button className="button subtle" disabled={offset + pageSize >= total || busy} onClick={() => setOffset(offset + pageSize)}>Další<ArrowRight size={13}/></button></div>}</section>;
}

function parseCsv(input: string, delimiter: string, qualifier = '"') {
  const result: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === qualifier && input[i + 1] === qualifier) { cell += qualifier; i++; }
      else if (char === qualifier) quoted = false;
      else cell += char;
      continue;
    }
    if (qualifier && char === qualifier && cell.length === 0) { quoted = true; continue; }
    if (char === delimiter) { row.push(cell); cell = ""; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); result.push(row); row = []; cell = ""; continue;
    }
    cell += char;
  }
  if (cell.length || row.length) { row.push(cell); result.push(row); }
  while (result.length && result[result.length - 1].every((item) => item.trim() === "")) result.pop();
  return result;
}

export default function ImportCenter({ metadata, onOpenRecord }: { metadata: Metadata; onOpenRecord?: (entity: string, row: Row) => void }) {
  const [history, setHistory] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [resultRelation, setResultRelation] = useState<"imported" | "updated" | "duplicates" | "">("");
  const [importErrors, setImportErrors] = useState<Row[]>([]);
  const [importErrorTotal, setImportErrorTotal] = useState(0);
  const [importErrorOffset, setImportErrorOffset] = useState(0);
  const [importErrorsBusy, setImportErrorsBusy] = useState(false);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [entity, setEntity] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileContents, setFileContents] = useState("");
  const [headerRow, setHeaderRow] = useState(true);
  const [delimiter, setDelimiter] = useState(",");
  const [mode, setMode] = useState<ImportParams["action"]>("create");
  const [mapping, setMapping] = useState<string[]>([]);
  const [updateBy, setUpdateBy] = useState<number[]>([]);
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("HH:mm:ss");
  const [decimalMark, setDecimalMark] = useState(".");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("");
  const [textQualifier, setTextQualifier] = useState('"');
  const [personNameFormat, setPersonNameFormat] = useState("f l");
  const [silentMode, setSilentMode] = useState(true);
  const [idleMode, setIdleMode] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [skipDuplicateChecking, setSkipDuplicateChecking] = useState(false);
  const [preferenceRecord, setPreferenceRecord] = useState<Row>({});
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [manualCommand, setManualCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const importable = useMemo(() => Object.entries(metadata.scopes || {}).filter(([name, scope]) => scope.importable && metadata.entityDefs?.[name]?.fields).map(([name]) => name).sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true))), [metadata]);
  const detailStatus = detail?.status || "";
  const csvRows = useMemo(() => fileContents ? parseCsv(fileContents, delimiter, textQualifier) : [], [fileContents, delimiter, textQualifier]);
  const headers = useMemo(() => {
    const row = csvRows[0] || [];
    return headerRow ? row : row.map((_, index) => `Sloupec ${index + 1}`);
  }, [csvRows, headerRow]);
  const previewRow = useMemo(() => csvRows[headerRow ? 1 : 0] || [], [csvRows, headerRow]);
  const fields = metadata.entityDefs?.[entity]?.fields || {};
  const dateFormatOptions: string[] = (metadata.clientDefs?.Import as any)?.dateFormatList || ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "DD.MM.YYYY", "MM.DD.YYYY", "YYYY.MM.DD", "DD. MM. YYYY"];
  const timeFormatOptions: string[] = (metadata.clientDefs?.Import as any)?.timeFormatList || ["HH:mm:ss", "HH:mm", "hh:mm a", "hh:mm A"];
  const timezoneOptions: string[] = (metadata.app as any)?.timeZoneList || ["UTC", "Europe/Prague", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"];
  const currencyOptions: string[] = (metadata.app as any)?.currency?.list || [];
  const attributeOptions = useMemo(() => {
    const result: { name: string; label: string }[] = [{ name: "", label: "— Přeskočit sloupec —" }, { name: "id", label: "ID záznamu" }];
    for (const [name, def] of Object.entries(fields)) {
      if (def.importDisabled || def.disabled || def.readOnly || def.notStorable || def.utility || def.type === "foreign" && !def.relateOnImport) continue;
      result.push({ name, label: fieldLabel(name, def, entity, metadata) });
      if (def.type === "link") { result.push({ name: `${name}Name`, label: `${fieldLabel(name, def, entity, metadata)} · název` }); result.push({ name: `${name}Id`, label: `${fieldLabel(name, def, entity, metadata)} · ID` }); }
    }
    return result;
  }, [fields, entity, metadata]);
  const loadHistory = useCallback(async () => {
    setBusy(true); setError("");
    try { const result = await request<HistoryResult>("Import?maxSize=40&offset=0&orderBy=createdAt&order=desc"); setHistory(result.list || []); setTotal(Math.max(0, result.total || 0)); }
    catch (e) { setError(e instanceof Error ? e.message : "Historii importů se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => {
    const user = getSession()?.user;
    if (!user) return;
    request<Row>(`Preferences/${encodeURIComponent(user.id)}`).then((preferences) => {
      setPreferenceRecord(preferences);
      const defaults = preferences.importParams?.default || {};
      setHeaderRow(defaults.headerRow ?? true); setDelimiter(defaults.delimiter || ",");
      setDateFormat(defaults.dateFormat || "YYYY-MM-DD"); setTimeFormat(defaults.timeFormat || "HH:mm:ss");
      setDecimalMark(defaults.decimalMark || "."); setTimezone(defaults.timezone || "UTC"); setCurrency(defaults.currency || "");
      setTextQualifier(defaults.textQualifier ?? '"'); setPersonNameFormat(defaults.personNameFormat || "f l");
      setSilentMode(defaults.silentMode ?? true); setIdleMode(Boolean(defaults.idleMode)); setManualMode(Boolean(defaults.manualMode)); setSkipDuplicateChecking(Boolean(defaults.skipDuplicateChecking));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let live = true;
    const load = () => request<Row>(`Import/${selectedId}`).then((item) => live && setDetail(item)).catch((e) => live && setError(e instanceof Error ? e.message : "Import se nepodařilo načíst."));
    void load();
    const timer = window.setInterval(() => { if (live && ["Pending", "In Process"].includes(detail?.status)) void load(); }, 2500);
    return () => { live = false; window.clearInterval(timer); };
  }, [selectedId, detail?.status]);
  useEffect(() => {
    if (!selectedId) { setImportErrors([]); setImportErrorTotal(0); return; }
    let live = true;
    setImportErrorsBusy(true);
    request<HistoryResult>(`Import/${encodeURIComponent(selectedId)}/errors?maxSize=20&offset=${importErrorOffset}&orderBy=rowIndex&order=asc`)
      .then((result) => { if (live) { setImportErrors(result.list || []); setImportErrorTotal(result.total || 0); } })
      .catch(() => { if (live) { setImportErrors([]); setImportErrorTotal(0); } })
      .finally(() => live && setImportErrorsBusy(false));
    return () => { live = false; };
  }, [selectedId, detailStatus, importErrorOffset]);
  function currentDefaults(): Row { return { headerRow, delimiter, decimalMark, dateFormat, timeFormat, timezone, currency, textQualifier, personNameFormat, silentMode, idleMode, manualMode, skipDuplicateChecking }; }
  function resetWizard() {
    const defaults = preferenceRecord.importParams?.default || {};
    setStage(1); setEntity(importable[0] || ""); setFileName(""); setFileContents(""); setHeaderRow(defaults.headerRow ?? true); setDelimiter(defaults.delimiter || ","); setMode("create"); setMapping([]); setUpdateBy([]);
    setDateFormat(defaults.dateFormat || "YYYY-MM-DD"); setTimeFormat(defaults.timeFormat || "HH:mm:ss"); setDecimalMark(defaults.decimalMark || "."); setTimezone(defaults.timezone || "UTC"); setCurrency(defaults.currency || ""); setTextQualifier(defaults.textQualifier ?? '"'); setPersonNameFormat(defaults.personNameFormat || "f l"); setSilentMode(defaults.silentMode ?? true); setIdleMode(Boolean(defaults.idleMode)); setManualMode(Boolean(defaults.manualMode)); setSkipDuplicateChecking(Boolean(defaults.skipDuplicateChecking));
    setError(""); setNotice(""); setManualCommand(""); setSelectedId(""); setResultRelation(""); setImportErrorOffset(0);
  }
  async function saveDefaults() {
    const user = getSession()?.user;
    if (!user) return;
    setSavingDefaults(true); setError(""); setNotice("");
    try {
      const importParams = { ...(preferenceRecord.importParams || {}), default: currentDefaults() };
      const updated = await request<Row>(`Preferences/${encodeURIComponent(user.id)}`, { method: "PUT", body: JSON.stringify({ importParams }) });
      setPreferenceRecord((current) => ({ ...current, ...updated, importParams })); setNotice("Výchozí nastavení importu bylo uloženo do vašich preferencí.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Výchozí nastavení se nepodařilo uložit."); }
    finally { setSavingDefaults(false); }
  }
  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try { const contents = await file.text(); if (!contents.trim()) throw new Error("Soubor je prázdný."); setFileName(file.name); setFileContents(contents); }
    catch (e) { setError(e instanceof Error ? e.message : "Soubor se nepodařilo přečíst."); }
  }
  function nextToMapping() {
    if (!entity) { setError("Vyberte cílovou entitu."); return; }
    if (!fileContents) { setError("Vyberte CSV soubor."); return; }
    if (!headers.length) { setError("Soubor neobsahuje žádné sloupce."); return; }
    const initial = headers.map((header) => {
      const exact = attributeOptions.find((item) => item.name.toLowerCase() === header.trim().toLowerCase());
      if (exact) return exact.name;
      const byLabel = attributeOptions.find((item) => item.label.toLowerCase() === header.trim().toLowerCase());
      return byLabel?.name || "";
    });
    setMapping(initial);
    const idIndex = initial.findIndex((value) => value === "id");
    setUpdateBy(idIndex >= 0 ? [idIndex] : []);
    setError(""); setStage(2);
  }
  async function runImport() {
    if (!mapping.some(Boolean)) { setError("Přiřaďte alespoň jeden sloupec k poli."); return; }
    if (mode !== "create" && updateBy.length === 0) { setError("Pro aktualizaci vyberte pole, podle kterého se záznamy najdou."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const upload = await request<{ attachmentId: string }>("Import/file", { method: "POST", headers: { "Content-Type": "text/csv; charset=utf-8" }, body: fileContents });
      if (!upload.attachmentId) throw new Error("EspoCRM nevrátilo ID nahraného souboru.");
      const params: ImportParams & Row = { entityType: entity, action: mode, attributeList: mapping, updateBy, attachmentId: upload.attachmentId, headerRow, delimiter, decimalMark, dateFormat, timeFormat, timezone, currency: currency || undefined, personNameFormat, textQualifier, silentMode, idleMode: manualMode ? false : idleMode, manualMode, skipDuplicateChecking };
      const result = await request<Row>("Import", { method: "POST", body: JSON.stringify(params) });
      if (!result.id) throw new Error("Import byl přijat, ale API nevrátilo jeho ID.");
      setSelectedId(result.id); setResultRelation(""); setImportErrorOffset(0); setStage(0);
      if (result.manualMode) { const command = `php command.php import --id=${result.id}`; setManualCommand(command); setNotice("Import je připraven k ručnímu spuštění na serveru."); }
      else { setManualCommand(""); setNotice(idleMode ? "Import byl zařazen do fronty.": "Import byl spuštěn."); }
      await loadHistory();
    } catch (e) { setError(e instanceof Error ? e.message : "Import se nepodařilo spustit."); }
    finally { setBusy(false); }
  }
  async function historyAction(action: "revert" | "removeDuplicates" | "delete") {
    if (!selectedId || !window.confirm(action === "revert" ? "Vrátit všechny změny provedené tímto importem?" : action === "delete" ? "Smazat záznam importu?" : "Odstranit duplicitní záznamy vytvořené tímto importem?")) return;
    setBusy(true); setError("");
    try { if (action === "delete") await request(`Import/${selectedId}`, { method: "DELETE" }); else await request(`Import/${selectedId}/${action}`, { method: "POST" }); if (action === "delete") { setSelectedId(""); setDetail(null); } else { const updated = await request<Row>(`Import/${selectedId}`); setDetail(updated); } await loadHistory(); }
    catch (e) { setError(e instanceof Error ? e.message : "Akci se nepodařilo provést."); }
    finally { setBusy(false); }
  }
  async function exportErrors() {
    if (!selectedId) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ attachmentId: string }>(`Import/${encodeURIComponent(selectedId)}/exportErrors`, { method: "POST", body: JSON.stringify({}) });
      if (!result.attachmentId) throw new Error("EspoCRM nevytvořilo soubor s chybami.");
      await downloadAttachment(result.attachmentId, `import-${selectedId}-errors.csv`);
    } catch (e) { setError(e instanceof Error ? e.message : "Chyby importu se nepodařilo exportovat."); }
    finally { setBusy(false); }
  }
  return <div className="import-center">
    <header className="entity-heading"><div><div className="eyebrow">DATA A SPRÁVA</div><h1>Import dat</h1><p>Nahrajte CSV, přiřaďte sloupce a průběžně sledujte výsledek.</p></div><button className="button primary" onClick={resetWizard}><FileInput size={15}/>Nový import</button></header>
    {error && <div className="inline-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    {stage > 0 ? <section className="surface import-wizard">
      <div className="import-wizard-header"><button className="back-link" onClick={() => stage === 1 ? setStage(0) : setStage(1)}><ArrowLeft size={14}/>Zpět</button><div className="import-steps"><span className={stage === 1 ? "active" : "done"}><i>1</i>Soubor a akce</span><b/><span className={stage === 2 ? "active" : ""}><i>2</i>Mapování sloupců</span></div><button className="icon-button" onClick={() => setStage(0)} aria-label="Zavřít import"><X size={17}/></button></div>
      {stage === 1 ? <div className="import-step-content"><h2>Vyberte data k importu</h2><p>Zvolte typ záznamů a nahrajte CSV soubor.</p><div className="import-config-grid"><label className="setting-field">Typ záznamu<select value={entity} onChange={(e) => setEntity(e.target.value)}>{importable.map((name) => <option key={name} value={name}>{entityLabel(metadata, name, true)}</option>)}</select></label><label className="setting-field">Co provést<select value={mode} onChange={(e) => setMode(e.target.value as ImportParams["action"])}><option value="create">Pouze vytvořit nové záznamy</option><option value="createAndUpdate">Vytvořit i aktualizovat existující</option><option value="update">Pouze aktualizovat existující</option></select></label><label className="setting-field">Oddělovač<select value={delimiter} onChange={(e) => setDelimiter(e.target.value)}><option value=",">Čárka ,</option><option value=";">Středník ;</option><option value="\t">Tabulátor</option></select></label><label className="setting-check"><input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)}/>První řádek obsahuje názvy sloupců</label></div>
        <details className="import-advanced-settings"><summary>Formát a zpracování importu</summary><div className="import-advanced-grid"><label className="setting-field">Formát data<select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>{dateFormatOptions.map((format) => <option key={format} value={format}>{format}</option>)}</select></label><label className="setting-field">Formát času<select value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)}>{timeFormatOptions.map((format) => <option key={format} value={format}>{format}</option>)}</select></label><label className="setting-field">Desetinný oddělovač<select value={decimalMark} onChange={(e) => setDecimalMark(e.target.value)}><option value=".">Tečka (.)</option><option value=",">Čárka (,)</option></select></label><label className="setting-field">Časové pásmo<select value={timezone} onChange={(e) => setTimezone(e.target.value)}>{Array.from(new Set([timezone, ...timezoneOptions])).map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label>{currencyOptions.length > 0 && <label className="setting-field">Výchozí měna<select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="">Měna z nastavení CRM</option>{currencyOptions.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>}<label className="setting-field">Uvozovací znak<select value={textQualifier} onChange={(e) => setTextQualifier(e.target.value)}><option value='"'>Dvojité uvozovky</option><option value="'">Apostrof</option><option value="">Bez uvozovacího znaku</option></select></label><label className="setting-field">Pořadí jména<select value={personNameFormat} onChange={(e) => setPersonNameFormat(e.target.value)}>{["f l", "l f", "l, f", "f m l", "l f m"].map((format) => <option key={format} value={format}>{format === "f l" ? "Jméno Příjmení" : format === "l f" ? "Příjmení Jméno" : format === "l, f" ? "Příjmení, Jméno" : format === "f m l" ? "Jméno Prostřední Příjmení" : "Příjmení Jméno Prostřední"}</option>)}</select></label></div><div className="import-mode-options"><label className="setting-check"><input type="checkbox" checked={silentMode} onChange={(e) => setSilentMode(e.target.checked)}/>Tichý import — přeskočit většinu after-save skriptů a poznámky streamu</label><label className="setting-check"><input type="checkbox" checked={skipDuplicateChecking} onChange={(e) => setSkipDuplicateChecking(e.target.checked)}/>Přeskočit kontrolu duplicit</label><label className="setting-check"><input type="checkbox" checked={idleMode} disabled={manualMode} onChange={(e) => setIdleMode(e.target.checked)}/>Zpracovat import na pozadí</label><label className="setting-check"><input type="checkbox" checked={manualMode} disabled={idleMode} onChange={(e) => setManualMode(e.target.checked)}/>Připravit import pro ruční spuštění přes CLI</label></div><div className="import-defaults-actions"><span>Výchozí volby se ukládají do vašich preferencí.</span><button type="button" className="button subtle" onClick={() => void saveDefaults()} disabled={savingDefaults}><Save size={13}/>{savingDefaults ? "Ukládám…" : "Uložit jako výchozí"}</button></div></details>
        <label className="import-upload"><input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={(e) => void onFileChange(e)}/><span><Upload size={21}/></span><strong>{fileName || "Vyberte soubor CSV"}</strong><small>{fileName ? `${csvRows.length} řádků · ${headers.length} sloupců` : "Klikněte nebo přetáhněte CSV soubor"}</small></label>
        {csvRows.length > 0 && <div className="import-preview"><div><FileSpreadsheet size={15}/>Náhled dat</div><table><tbody>{csvRows.slice(0, 5).map((row, i) => <tr key={i}>{row.slice(0, 8).map((value, j) => i === 0 && headerRow ? <th key={j}>{value || `Sloupec ${j + 1}`}</th> : <td key={j}>{value || "—"}</td>)}</tr>)}</tbody></table></div>}
        <div className="modal-footer"><span>{fileName ? `${fileName} · ${csvRows.length} řádků` : "CSV nebo TSV · první řádek může obsahovat záhlaví"}</span><button className="button primary" onClick={nextToMapping}>Mapovat sloupce <ArrowRight size={14}/></button></div>
      </div> : <div className="import-step-content"><h2>Přiřaďte sloupce k polím</h2><p>Prověřte automatický návrh. Nepřiřazené sloupce se přeskočí.</p><div className="import-map-table"><div className="import-map-head"><span>Sloupec v souboru</span><span>Ukázková hodnota</span><span>Pole v CRM</span>{mode !== "create" && <span>Najít podle</span>}</div>{headers.map((header, index) => <div className="import-map-row" key={index}><strong>{header || `Sloupec ${index + 1}`}</strong><span>{previewRow[index] || "—"}</span><select value={mapping[index] || ""} onChange={(e) => setMapping((old) => old.map((value, i) => i === index ? e.target.value : value))}>{attributeOptions.map((item) => <option key={`${index}-${item.name}`} value={item.name}>{item.label}</option>)}</select>{mode !== "create" && <label><input type="checkbox" checked={updateBy.includes(index)} disabled={!mapping[index]} onChange={(e) => setUpdateBy((old) => e.target.checked ? [...old, index] : old.filter((item) => item !== index))}/></label>}</div>)}</div>
        <div className="import-mapping-summary"><CircleAlert size={15}/><span>Vybráno {mapping.filter(Boolean).length} sloupců z {headers.length}. {mode !== "create" && `Vyhledání podle ${updateBy.length} polí.`}</span></div>
        <div className="modal-footer"><button className="button subtle" onClick={() => setStage(1)}>Zpět</button><button className="button primary" disabled={busy} onClick={() => void runImport()}>{busy ? "Nahrávám a importuji…" : "Spustit import"}<ArrowRight size={14}/></button></div>
      </div>}
    </section> : <div className="import-history-grid"><section className="surface import-history"><div className="import-list-header"><div><h2>Poslední importy</h2><p>{total ? `${total} importů celkem` : "Historie zpracování dat"}</p></div><button className="icon-button" onClick={() => void loadHistory()} title="Obnovit"><RefreshCw size={15}/></button></div>{busy && !history.length ? <div className="table-loading"><span className="spinner"/>Načítám historii…</div> : history.length ? history.map((item) => <button key={item.id} className={`import-history-row ${item.id === selectedId ? "active" : ""}`} onClick={() => { setSelectedId(item.id); setResultRelation(""); setImportErrorOffset(0); setStage(0); }}><span className={`import-status-dot ${String(item.status).toLowerCase().replaceAll(" ", "-")}`}/><span className="import-history-main"><strong>{entityLabel(metadata, item.entityType, true) || item.entityType || "Import"}</strong><small>{item.fileName || item.file?.name || item.createdAt || "Import dat"}</small></span><span className="import-history-state">{item.status || "—"}</span><ChevronRight size={14}/></button>) : <div className="import-empty"><FileInput size={24}/><strong>Zatím žádné importy</strong><span>Po nahrání CSV se výsledky zobrazí tady.</span></div>}</section>
      {detail ? <section className="surface import-detail"><div className="import-list-header"><div><div className="eyebrow">VÝSLEDEK IMPORTU</div><h2>{entityLabel(metadata, detail.entityType, true) || detail.entityType}</h2><p>{detail.createdAt ? new Date(String(detail.createdAt).replace(" ", "T")).toLocaleString("cs-CZ") : ""}</p></div><button className="icon-button" title="Znovu načíst" onClick={() => void request<Row>(`Import/${selectedId}`).then(setDetail)}><RefreshCw size={15}/></button></div><div className="import-status"><span className={`import-status-dot ${String(detailStatus).toLowerCase().replaceAll(" ", "-")}`}/><strong>{detailStatus || "Neznámý stav"}</strong>{["Pending", "In Process"].includes(detailStatus) && <Clock3 size={14}/>}</div>{detailStatus === "Standby" && <div className="import-manual-command"><strong>Ruční spuštění na serveru</strong><code>{manualCommand || `php command.php import --id=${selectedId}`}</code><button className="button subtle" onClick={() => void navigator.clipboard.writeText(manualCommand || `php command.php import --id=${selectedId}`).then(() => setNotice("Příkaz byl zkopírován."))}><Copy size={13}/>Kopírovat příkaz</button></div>}<div className="import-result-stats"><div><strong>{detail.importedCount ?? "—"}</strong><span>Vytvořeno</span></div><div><strong>{detail.updatedCount ?? "—"}</strong><span>Aktualizováno</span></div><div><strong>{detail.duplicateCount ?? "—"}</strong><span>Duplicit</span></div></div><div className="import-result-tabs" role="tablist" aria-label="Záznamy z importu">{([ ["imported", "Vytvořené", detail.importedCount], ["updated", "Aktualizované", detail.updatedCount], ["duplicates", "Duplicitní", detail.duplicateCount] ] as const).map(([key, label, count]) => <button type="button" key={key} role="tab" aria-selected={resultRelation === key} className={resultRelation === key ? "active" : ""} onClick={() => setResultRelation(resultRelation === key ? "" : key)}>{label}<b>{count ?? 0}</b></button>)}</div>{resultRelation && <ImportResultRecords importId={selectedId} entity={detail.entityType} relation={resultRelation} metadata={metadata} onOpenRecord={onOpenRecord} onChanged={() => { void request<Row>(`Import/${encodeURIComponent(selectedId)}`).then(setDetail).catch(() => {}); }}/ >}{(importErrors.length > 0 || importErrorTotal > 0 || importErrorsBusy) && <ImportErrorList items={importErrors} total={importErrorTotal} offset={importErrorOffset} busy={importErrorsBusy} metadata={metadata} onPage={setImportErrorOffset} onExport={() => void exportErrors()} exportBusy={busy}/>}<div className="import-detail-actions"><button className="button" onClick={() => void historyAction("revert")} disabled={!detail.importedCount && !detail.updatedCount}><RotateCcw size={14}/>Vrátit změny</button><button className="button" onClick={() => void historyAction("removeDuplicates")} disabled={!detail.duplicateCount}><Trash2 size={14}/>Odstranit duplicity</button><button className="button danger" onClick={() => void historyAction("delete")}><Trash2 size={14}/>Smazat záznam</button></div><p className="import-detail-help">Operace a počty odpovídají zaznamenanému importu v EspoCRM.</p></section> : <section className="surface import-detail import-empty-detail"><FileInput size={25}/><strong>Vyberte import</strong><span>Zobrazíme jeho stav a dostupné akce.</span></section>}</div>}
  </div>;
}
