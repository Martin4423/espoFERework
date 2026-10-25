import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Languages, Save, Search } from "./Icons";
import { humanize, request } from "./api";
import type { Metadata } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type LabelData = Record<string, Record<string, string>>;
type PendingLabelAction = { kind: "back" | "scope" | "language"; value?: string };

function languageLabel(code: string) {
  try {
    const name = new Intl.DisplayNames(["cs"], { type: "language" }).of(code.replaceAll("_", "-"));
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

export default function AdminLabelManager({ metadata, onBack, onRefreshMetadata }: { metadata: Metadata; onBack: () => void; onRefreshMetadata: () => Promise<void> }) {
  const [scopeList, setScopeList] = useState<string[]>([]);
  const [scope, setScope] = useState("Global");
  const languages = metadata.app?.language?.list || ["en_US"];
  const [language, setLanguage] = useState(metadata.app?.language?.default || languages[0] || "en_US");
  const [labels, setLabels] = useState<LabelData>({});
  const [original, setOriginal] = useState<LabelData>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingLabelAction | null>(null);
  const confirmDialogRef = useDialogFocus<HTMLElement>(() => { if (!busy && !saving) setPendingAction(null); }, !busy && !saving, Boolean(pendingAction));
  const loadSequence = useRef(0);

  useEffect(() => {
    let live = true;
    request<string[]>("LabelManager/action/getScopeList", { method: "POST", body: JSON.stringify({}) }).then((list) => {
      if (!live) return;
      const filtered = (list || []).filter((name) => name === "Global" || !metadata.scopes[name]?.disabled);
      setScopeList(["Global", ...filtered.filter((name) => name !== "Global").sort((a, b) => (metadata.labels?.Global?.scopeNamesPlural?.[a] || humanize(a)).localeCompare(metadata.labels?.Global?.scopeNamesPlural?.[b] || humanize(b), "cs"))]);
    }).catch((e) => live && setError(e instanceof Error ? e.message : "Seznam oblastí popisků se nepodařilo načíst."));
    return () => { live = false; };
  }, [metadata]);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await request<LabelData>("LabelManager/action/getScopeData", { method: "POST", body: JSON.stringify({ scope, language }) });
      if (sequence !== loadSequence.current) return;
      setLabels(data || {}); setOriginal(data || {});
    } catch (e) { if (sequence === loadSequence.current) setError(e instanceof Error ? e.message : "Překlady se nepodařilo načíst."); }
    finally { if (sequence === loadSequence.current) setBusy(false); }
  }, [scope, language]);
  useEffect(() => { void load(); return () => { loadSequence.current += 1; }; }, [load]);

  const dirty = useMemo(() => {
    const changes: Record<string, string> = {};
    for (const [category, values] of Object.entries(labels)) {
      for (const [key, value] of Object.entries(values || {})) {
        if (String(value ?? "") !== String(original[category]?.[key] ?? "")) changes[key] = String(value ?? "");
      }
    }
    return changes;
  }, [labels, original]);
  const filtered = useMemo(() => Object.entries(labels).map(([category, values]) => [category, Object.entries(values || {}).filter(([key, value]) => !query.trim() || `${category} ${key} ${value}`.toLowerCase().includes(query.trim().toLowerCase()))] as const).filter(([, rows]) => rows.length), [labels, query]);

  async function save() {
    if (!Object.keys(dirty).length) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await request("LabelManager/action/saveLabels", { method: "POST", body: JSON.stringify({ scope, language, labels: dirty }) });
      const savedCount = Object.keys(dirty).length;
      await load();
      await onRefreshMetadata();
      setNotice(`${savedCount} překladů bylo uloženo a nové popisky byly načteny.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Překlady se nepodařilo uložit."); }
    finally { setSaving(false); }
  }
  function setValue(category: string, key: string, value: string) { setLabels((old) => ({ ...old, [category]: { ...old[category], [key]: value } })); }
  function requestAction(action: PendingLabelAction) {
    if (busy || saving) return;
    if (Object.keys(dirty).length) setPendingAction(action);
    else if (action.kind === "back") onBack();
    else if (action.kind === "scope" && action.value) setScope(action.value);
    else if (action.kind === "language" && action.value) setLanguage(action.value);
  }
  function confirmPendingAction() {
    const action = pendingAction;
    if (!action || busy || saving) return;
    setPendingAction(null);
    if (action.kind === "back") onBack();
    else if (action.kind === "scope" && action.value) setScope(action.value);
    else if (action.kind === "language" && action.value) setLanguage(action.value);
  }
  const allRows = Object.values(labels).reduce((count, values) => count + Object.keys(values || {}).length, 0);

  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={() => requestAction({ kind: "back" })}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">LOKALIZACE</div><h1>Správce popisků</h1><p>Upravujte překlady polí, relací, voleb a systémových textů.</p></div><button className="button primary" onClick={() => void save()} disabled={busy || saving || !Object.keys(dirty).length}><Save size={14}/>{saving ? "Ukládám…" : `Uložit změny${Object.keys(dirty).length ? ` · ${Object.keys(dirty).length}` : ""}`}</button></div>
    {error && <div className="table-error">{error}<button onClick={() => void load()}>Zkusit znovu</button></div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
      <section className="surface label-manager"><div className="label-toolbar"><label className="setting-field"><span>Oblast popisků</span><select value={scope} disabled={busy || saving} onChange={(event) => requestAction({ kind: "scope", value: event.target.value })}>{scopeList.map((name) => <option value={name} key={name}>{name === "Global" ? "Globální popisky" : metadata.labels?.Global?.scopeNamesPlural?.[name] || humanize(name)}</option>)}</select></label><label className="setting-field"><span>Jazyk</span><select value={language} disabled={busy || saving} onChange={(event) => requestAction({ kind: "language", value: event.target.value })}>{languages.map((code: string) => <option value={code} key={code}>{languageLabel(code)}</option>)}</select></label><form className="label-search" onSubmit={(event) => event.preventDefault()}><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrovat popisky…"/></form><span className="label-count"><Languages size={14}/>{allRows} položek</span></div>
      {busy ? <div className="table-loading"><span className="spinner"/> Načítám překlady…</div> : filtered.length ? <div className="label-category-list">{filtered.map(([category, rows]) => <details className="label-category" key={category} open={Boolean(query)}><summary><span>{humanize(category)}</span><small>{rows.length} popisků</small></summary><div className="label-rows">{rows.map(([key, value]) => <label className="label-row" key={`${category}-${key}`}><span><strong>{key.split("[.]").slice(1).join(" · ") || key}</strong><small>{category}</small></span>{String(value).length > 72 || String(value).includes("\n") ? <textarea rows={3} value={value || ""} onChange={(event) => setValue(category, key, event.target.value)}/> : <input value={value || ""} onChange={(event) => setValue(category, key, event.target.value)}/>}</label>)}</div></details>)}</div> : <div className="label-empty"><Languages size={20}/><strong>Žádné popisky k zobrazení</strong><span>Změňte oblast nebo filtr.</span></div>}
    </section>
    {pendingAction && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && !saving && setPendingAction(null)}><section ref={confirmDialogRef} className="record-modal label-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="label-confirm-title" aria-describedby="label-confirm-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">LOKALIZACE · NEULOŽENÉ ZMĚNY</span><h2 id="label-confirm-title">{pendingAction.kind === "back" ? "Odejít bez uložení?" : "Přepnout překlady?"}</h2><p id="label-confirm-description">{pendingAction.kind === "back" ? <>Neuložené překlady pro <strong>{scope === "Global" ? "globální popisky" : metadata.labels?.Global?.scopeNamesPlural?.[scope] || humanize(scope)}</strong> v jazyce <strong>{languageLabel(language)}</strong> budou zahozeny.</> : <>Neuložené překlady pro <strong>{scope === "Global" ? "globální popisky" : metadata.labels?.Global?.scopeNamesPlural?.[scope] || humanize(scope)}</strong> v jazyce <strong>{languageLabel(language)}</strong> budou zahozeny{pendingAction.kind === "scope" ? <> a otevře se oblast <strong>{pendingAction.value === "Global" ? "Globální popisky" : metadata.labels?.Global?.scopeNamesPlural?.[pendingAction.value || ""] || humanize(pendingAction.value || "")}</strong></> : <> a otevře se jazyk <strong>{languageLabel(pendingAction.value || "")}</strong></>}.</>}</p></div><button type="button" className="icon-button" aria-label="Pokračovat v úpravách" onClick={() => setPendingAction(null)}>×</button></div><div className="modal-footer"><button type="button" autoFocus className="button subtle" onClick={() => setPendingAction(null)}>Pokračovat v úpravách</button><button type="button" className="button primary" onClick={confirmPendingAction}>{pendingAction.kind === "back" ? "Zahodit a odejít" : "Zahodit a přepnout"}</button></div></section></div>}
  </div>;
}
