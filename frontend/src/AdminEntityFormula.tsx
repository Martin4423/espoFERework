import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Code2, RotateCcw, Save, Search } from "./Icons";
import { entityLabel, fieldLabel, request } from "./api";
import type { Metadata } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type FormulaType = "beforeSaveCustomScript" | "beforeSaveApiScript";
type FormulaFunction = { name: string; insertText?: string; returnType?: string };
type FormulaResult = { isSuccess?: boolean; isSyntaxError?: boolean; message?: string };
type PendingFormulaAction = { kind: "close" | "switch" | "reset"; type?: FormulaType };

const serviceFunctions: FormulaFunction[] = [
  { name: "recordService\\skipDuplicateCheck", insertText: "recordService\\skipDuplicateCheck()", returnType: "bool" },
  { name: "recordService\\throwDuplicateConflict", insertText: "recordService\\throwDuplicateConflict(RECORD_ID)" },
  { name: "recordService\\throwBadRequest", insertText: "recordService\\throwBadRequest(MESSAGE)" },
  { name: "recordService\\throwForbidden", insertText: "recordService\\throwForbidden(MESSAGE)" },
  { name: "recordService\\throwConflict", insertText: "recordService\\throwConflict(MESSAGE)" },
];

function entityFormulaAttributes(metadata: Metadata, entity: string): string[] {
  const defs = metadata.entityDefs?.[entity]?.fields || {};
  const attributes = Object.keys(defs).filter((name) => !defs[name].disabled && !defs[name].utility && !defs[name].notStorable);
  attributes.push("id");
  const links = metadata.entityDefs?.[entity]?.links || {};
  for (const [link, def] of Object.entries(links)) {
    if (!(def.type === "belongsToParent" || def.type === "hasOne" || def.type === "belongsTo") || !def.entity || (def as any).disabled) continue;
    const foreignFields = metadata.entityDefs?.[def.entity]?.fields || {};
    for (const [name, field] of Object.entries(foreignFields)) if (!field.disabled && !field.utility && !field.notStorable) attributes.push(`${link}.${name}`);
  }
  return [...new Set(attributes)].sort((a, b) => a.localeCompare(b, "cs"));
}

export default function AdminEntityFormula({ metadata, entity, onClose }: { metadata: Metadata; entity: string; onClose: () => void }) {
  const [type, setType] = useState<FormulaType>("beforeSaveCustomScript");
  const [script, setScript] = useState("");
  const [baseline, setBaseline] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingFormulaAction | null>(null);
  const confirmDialogRef = useDialogFocus<HTMLElement>(() => { if (!saving && !busy) setPendingAction(null); }, !saving && !busy, Boolean(pendingAction));
  const textarea = useRef<HTMLTextAreaElement>(null);
  const formulaMeta = (metadata.app as any)?.formula || {};
  const functions: FormulaFunction[] = useMemo(() => [
    ...(Array.isArray(formulaMeta.functionList) ? formulaMeta.functionList : []),
    ...(type === "beforeSaveApiScript" ? serviceFunctions : []),
  ].filter((item: FormulaFunction) => item?.insertText), [formulaMeta.functionList, type]);
  const attrs = useMemo(() => entityFormulaAttributes(metadata, entity), [metadata, entity]);
  const visibleAttrs = attrs.filter((name) => `${name} ${name.includes(".") ? name.split(".").map((part) => fieldLabel(part, metadata.entityDefs?.[name.split(".")[0]]?.fields?.[part], entity, metadata)).join(" ") : fieldLabel(name, metadata.entityDefs?.[entity]?.fields?.[name], entity, metadata)}`.toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs"))).slice(0, 80);
  const visibleFunctions = functions.filter((item) => `${item.name} ${item.returnType || ""}`.toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs"))).slice(0, 80);
  const changed = script !== baseline;

  useEffect(() => {
    let active = true;
    setBusy(true); setError(""); setNotice("");
    const params = new URLSearchParams({ key: `formula.${entity}` });
    request<Record<string, string>>(`Metadata/action/get?${params}`).then((data) => {
      if (!active) return;
      const value = data?.[type] || "";
      setScript(value); setBaseline(value);
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : "Formula skript se nepodařilo načíst."))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [entity, type]);

  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  function close() {
    if (changed) setPendingAction({ kind: "close" });
    else onClose();
  }
  function switchType(nextType: FormulaType) {
    if (nextType === type) return;
    if (changed) setPendingAction({ kind: "switch", type: nextType });
    else { setType(nextType); setQuery(""); }
  }
  function insert(value: string) {
    const input = textarea.current;
    if (!input) { setScript((old) => `${old}${old && !old.endsWith("\n") ? "\n" : ""}${value}`); return; }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const next = `${script.slice(0, start)}${value}${script.slice(end)}`;
    setScript(next);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + value.length, start + value.length); });
  }
  async function save() {
    if (!changed) { setNotice("Skript nebyl změněn."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      await request("EntityManager/action/formula", { method: "POST", body: JSON.stringify({ scope: entity, data: { [type]: script || null } }) });
      setBaseline(script); setNotice("Formula skript byl uložen.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Formula skript se nepodařilo uložit."); }
    finally { setSaving(false); }
  }
  async function reset() {
    setPendingAction({ kind: "reset" });
  }
  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action || saving || busy) return;
    setPendingAction(null);
    if (action.kind === "close") { onClose(); return; }
    if (action.kind === "switch" && action.type) { setType(action.type); setQuery(""); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      await request("EntityManager/action/resetFormulaToDefault", { method: "POST", body: JSON.stringify({ scope: entity, type }) });
      const params = new URLSearchParams({ key: `formula.${entity}` });
      const data = await request<Record<string, string>>(`Metadata/action/get?${params}`);
      const value = data?.[type] || "";
      setScript(value); setBaseline(value); setNotice("Výchozí Formula skript byl obnoven.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Výchozí Formula skript se nepodařilo obnovit."); }
    finally { setSaving(false); }
  }
  async function checkSyntax() {
    setChecking(true); setError(""); setNotice("");
    try {
      const result = await request<FormulaResult>("Formula/action/checkSyntax", { method: "POST", body: JSON.stringify({ expression: script }) });
      if (result.isSuccess) setNotice("Syntaxe Formula skriptu je v pořádku.");
      else setError(result.message || (result.isSyntaxError ? "Formula skript obsahuje syntaktickou chybu." : "Syntaxi se nepodařilo ověřit."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Syntaxi Formula skriptu se nepodařilo ověřit."); }
    finally { setChecking(false); }
  }

  return <div className="modal-backdrop admin-formula-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="record-modal admin-entity-formula" role="dialog" aria-modal="true" aria-label={`Formula skripty · ${entityLabel(metadata, entity)}`}>
    <div className="modal-heading"><div><span className="eyebrow">SPRÁVCE ENTIT · {entity.toLocaleUpperCase("cs")}</span><h2>Formula skripty</h2><p>Skripty běží na serveru při ukládání záznamů této entity.</p></div><button type="button" className="icon-button" onClick={close} aria-label="Zavřít">×</button></div>
    <div className="entity-formula-tabs">{(["beforeSaveCustomScript", "beforeSaveApiScript"] as FormulaType[]).map((item) => <button type="button" key={item} className={type === item ? "active" : ""} onClick={() => switchType(item)}><strong>{item === "beforeSaveCustomScript" ? "Před uložením" : "Před uložením přes API"}</strong><small>{item === "beforeSaveCustomScript" ? "Formulář uživatele" : "Požadavek REST API"}</small></button>)}</div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={14}/>{notice}</div>}
    <div className="entity-formula-workspace"><div className="entity-formula-editor"><div className="settings-card-head"><div><h3>{type === "beforeSaveCustomScript" ? "Skript formuláře" : "Skript API"}</h3><p>{busy ? "Načítám skript…" : changed ? "Neuložené změny" : "Všechny změny jsou uložené"}</p></div><Code2 size={16}/></div><textarea ref={textarea} className="formula-editor" spellCheck={false} value={script} disabled={busy || saving} onChange={(event) => setScript(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "s") { event.preventDefault(); void save(); } }} aria-label="Formula skript" placeholder={'$name = record\\attribute(\'name\');'} /><small>Ctrl + S uloží skript. Prázdný skript odstraní vlastní definici.</small></div>
      <aside className="entity-formula-insert"><label className="field-input"><span>Najít funkci nebo pole</span><span className="formula-search"><Search size={13}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrovat…"/></span></label><div className="entity-formula-insert-section"><strong>Funkce {visibleFunctions.length ? `· ${visibleFunctions.length}` : ""}</strong>{visibleFunctions.map((item) => <button type="button" key={item.name} onClick={() => insert(item.insertText!)} title={item.insertText}>{item.name}<small>{item.returnType || ""}</small></button>)}</div><div className="entity-formula-insert-section"><strong>Atributy {visibleAttrs.length ? `· ${visibleAttrs.length}` : ""}</strong>{visibleAttrs.map((name) => <button type="button" key={name} onClick={() => insert(name)} title={name}>{name.includes(".") ? name : fieldLabel(name, metadata.entityDefs?.[entity]?.fields?.[name], entity, metadata)}</button>)}</div></aside></div>
    <div className="modal-footer"><button type="button" className="button subtle" onClick={() => void checkSyntax()} disabled={busy || checking || saving}>{checking ? "Kontroluji…" : "Zkontrolovat syntaxi"}</button><button type="button" className="button subtle" onClick={() => void reset()} disabled={busy || saving}><RotateCcw size={14}/> Obnovit výchozí</button><button type="button" className="button subtle" onClick={close}>Zavřít</button><button type="button" className="button primary" onClick={() => void save()} disabled={busy || saving || !changed}>{saving ? "Ukládám…" : <><Save size={14}/> Uložit skript</>}</button></div>
  </section>{pendingAction && <div className="modal-backdrop formula-confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && !busy && setPendingAction(null)}><section ref={confirmDialogRef} className="record-modal formula-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="formula-confirm-title" aria-describedby="formula-confirm-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">SPRÁVCE ENTIT · {entity.toLocaleUpperCase("cs")}</span><h2 id="formula-confirm-title">{pendingAction.kind === "reset" ? "Obnovit výchozí skript?" : pendingAction.kind === "switch" ? "Přepnout typ skriptu?" : "Zavřít editor skriptu?"}</h2><p id="formula-confirm-description">{pendingAction.kind === "reset" ? <>Vlastní skript <strong>{type === "beforeSaveCustomScript" ? "Před uložením" : "Před uložením přes API"}</strong> pro <strong>{entityLabel(metadata, entity)}</strong> bude odstraněn a nahrazen výchozím nastavením.</> : pendingAction.kind === "switch" ? <>Neuložené změny skriptu <strong>{type === "beforeSaveCustomScript" ? "Před uložením" : "Před uložením přes API"}</strong> se zahodí a otevře se <strong>{pendingAction.type === "beforeSaveCustomScript" ? "Skript formuláře" : "Skript API"}</strong>.</> : <>Neuložené změny skriptu <strong>{type === "beforeSaveCustomScript" ? "Před uložením" : "Před uložením přes API"}</strong> se zahodí.</>}</p></div><button type="button" className="icon-button" aria-label="Pokračovat v úpravách" onClick={() => setPendingAction(null)}>×</button></div><div className="modal-footer"><button type="button" autoFocus className="button subtle" onClick={() => setPendingAction(null)}>Pokračovat v úpravách</button><button type="button" className={`button ${pendingAction.kind === "reset" ? "danger" : "primary"}`} onClick={() => void confirmPendingAction()}>{pendingAction.kind === "reset" ? <><RotateCcw size={14}/> Obnovit výchozí</> : pendingAction.kind === "switch" ? "Zahodit a přepnout" : "Zahodit a zavřít"}</button></div></section></div>}</div>;
}
