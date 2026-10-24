import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Code2, Play, RotateCcw, Search, ShieldAlert } from "./Icons";
import { entityLabel, request } from "./api";
import type { Metadata } from "./api";

type Row = Record<string, any>;
type FormulaResult = { output?: string | null; message?: string | null; isSuccess?: boolean; isSyntaxError?: boolean };
const STORAGE_KEY = "via-espo-formula-sandbox";

function storedState(): { script: string; targetType: string; targetId: string; targetName: string } {
  try { return { script: "", targetType: "", targetId: "", targetName: "", ...JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return { script: "", targetType: "", targetId: "", targetName: "" }; }
}

export default function AdminFormulaSandbox({ metadata, onBack }: { metadata: Metadata; onBack: () => void }) {
  const [initial] = useState(storedState);
  const [script, setScript] = useState(initial.script);
  const [targetType, setTargetType] = useState(initial.targetType);
  const [targetId, setTargetId] = useState(initial.targetId);
  const [targetName, setTargetName] = useState(initial.targetName);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [recordBusy, setRecordBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [checkingSyntax, setCheckingSyntax] = useState(false);
  const [syntaxMessage, setSyntaxMessage] = useState("");
  const [result, setResult] = useState<FormulaResult | null>(null);
  const [error, setError] = useState("");
  const entityTypes = useMemo(() => Object.keys(metadata.scopes || {}).filter((name) => Boolean((metadata.scopes[name] as any).object) && !metadata.scopes[name].disabled).sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs")), [metadata]);

  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ script, targetType, targetId, targetName })); }, [script, targetType, targetId, targetName]);
  useEffect(() => {
    if (!targetType) { setRecords([]); return; }
    let live = true;
    const params = new URLSearchParams({ maxSize: "50", offset: "0", orderBy: "name", order: "asc" });
    if (query.trim()) params.set("textFilter", query.trim());
    setRecordBusy(true);
    request<{ list?: Row[] }>(`${encodeURIComponent(targetType)}?${params}`).then((data) => {
      if (!live) return;
      const rows = data.list || [];
      if (targetId && targetName && !rows.some((item) => item.id === targetId)) rows.unshift({ id: targetId, name: targetName });
      setRecords(rows);
    }).catch(() => live && setRecords(targetId && targetName ? [{ id: targetId, name: targetName }] : [])).finally(() => live && setRecordBusy(false));
    return () => { live = false; };
  }, [query, targetId, targetName, targetType]);

  async function run() {
    if (!script.trim()) { setError("Napište formula skript, který chcete spustit."); setResult(null); return; }
    setRunning(true); setError(""); setResult(null); setSyntaxMessage("");
    try {
      const response = await request<FormulaResult>("Formula/action/run", { method: "POST", body: JSON.stringify({ expression: script, targetType: targetType || null, targetId: targetId || null }) });
      setResult(response);
      if (!response.isSuccess) setError(response.message || (response.isSyntaxError ? "Formula skript obsahuje syntaktickou chybu." : "Skript se nepodařilo dokončit."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Formula skript nelze spustit."); }
    finally { setRunning(false); }
  }
  async function checkSyntax() {
    if (!script.trim()) { setSyntaxMessage("Napište Formula skript ke kontrole."); return; }
    setCheckingSyntax(true); setError(""); setSyntaxMessage("");
    try {
      const response = await request<FormulaResult & { isSuccess?: boolean }>("Formula/action/checkSyntax", { method: "POST", body: JSON.stringify({ expression: script }) });
      setSyntaxMessage(response.isSuccess ? "Syntaxe je v pořádku." : response.message || "Skript obsahuje syntaktickou chybu.");
      if (!response.isSuccess) setError(response.message || "Skript obsahuje syntaktickou chybu.");
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Syntaxi skriptu nelze ověřit."; setSyntaxMessage(message); setError(message); }
    finally { setCheckingSyntax(false); }
  }
  function reset() { setScript(""); setResult(null); setError(""); setSyntaxMessage(""); setTargetType(""); setTargetId(""); setTargetName(""); setQuery(""); }

  return <div className="admin-view formula-sandbox-view">
    <div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">NÁSTROJE PRO VÝVOJ</div><h1>Formula sandbox</h1><p>Pište a spusťte Formula skripty v kontextu vybrané entity.</p></div><div className="formula-actions"><button className="button subtle" onClick={reset}><RotateCcw size={14}/> Vymazat</button><button className="button subtle" onClick={() => void checkSyntax()} disabled={checkingSyntax || !script.trim()}>{checkingSyntax ? "Kontroluji…" : "Zkontrolovat syntaxi"}</button><button className="button primary" onClick={() => void run()} disabled={running || !script.trim()}><Play size={14}/>{running ? "Spouštím…" : "Spustit"}<kbd>Ctrl ↵</kbd></button></div></div>
    {syntaxMessage && <div className={syntaxMessage === "Syntaxe je v pořádku." ? "save-confirm" : "table-error"}>{syntaxMessage === "Syntaxe je v pořádku." && <Check size={15} />}{syntaxMessage}</div>}
    <div className="formula-warning"><ShieldAlert size={16}/><span>Skript se vykoná na serveru s oprávněními administrátora. Kontrola syntaxe pouze ověří kód; tlačítko Spustit jej skutečně provede. Zkontrolujte cílový záznam před spuštěním.</span></div>
    {error && <div className="table-error">{error}</div>}{result?.isSuccess && <div className="save-confirm"><Check size={15}/> Skript byl úspěšně spuštěn.</div>}
    <section className="surface formula-context"><div className="settings-card-head"><div><h2><Code2 size={15}/> Kontext spuštění</h2><p>Vyberte typ záznamu a konkrétní záznam, pokud jej skript potřebuje.</p></div></div><div className="formula-context-fields"><label className="field-input"><span>Typ záznamu</span><select value={targetType} onChange={(event) => { setTargetType(event.target.value); setTargetId(""); setTargetName(""); setQuery(""); }}><option value="">Bez cílového záznamu</option>{entityTypes.map((name) => <option key={name} value={name}>{entityLabel(metadata, name, true)}</option>)}</select></label>{targetType && <div className="formula-record-picker"><label className="field-input"><span>Hledat záznam</span><span className="formula-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Hledat v ${entityLabel(metadata, targetType, true).toLocaleLowerCase("cs")}…`}/></span></label><label className="field-input"><span>Cílový záznam</span><select value={targetId} onChange={(event) => { const row = records.find((item) => item.id === event.target.value); setTargetId(event.target.value); setTargetName(row?.name || ""); }}><option value="">Bez konkrétního záznamu</option>{records.map((row) => <option key={row.id} value={row.id}>{row.name || row.subject || row.userName || row.id}</option>)}</select>{recordBusy && <small className="field-hint">Načítám záznamy…</small>}</label></div>}</div></section>
    <section className="surface formula-editor-card"><div className="settings-card-head"><div><h2>Skript</h2><p>Výstup vytiskněte pomocí <code>output\\print(VALUE)</code> nebo <code>output\\printLine(VALUE)</code>.</p></div><span>Ctrl + Enter pro spuštění</span></div><textarea className="formula-editor" spellCheck={false} value={script} onChange={(event) => setScript(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void run(); } }} placeholder={'$name = record\\attribute(\'name\');\noutput\\printLine($name);'} aria-label="Formula skript" /></section>
    {result && <section className="surface formula-output"><div className="settings-card-head"><div><h2>{result.isSuccess ? "Výstup" : "Chyba spuštění"}</h2><p>{result.isSuccess ? "Výsledek zpracování na serveru EspoCRM" : "Formula runtime"}</p></div></div><pre>{result.output || result.message || (result.isSuccess ? "Skript nevrátil žádný výstup." : "Bez dalších detailů.")}</pre></section>}
  </div>;
}
