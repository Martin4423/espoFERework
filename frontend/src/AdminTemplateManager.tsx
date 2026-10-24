import { lazy, Suspense, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowLeft, FileText, RotateCcw, Save, Search, X } from "./Icons";
import { request, type Metadata } from "./api";

const WysiwygEditor = lazy(() => import("./WysiwygEditor"));

type TemplateItem = { name: string; scope?: string; label: string; key: string };
type TemplateData = { body: string; subject?: string };

/** Native EspoCRM system-template editor backed by TemplateManager actions. */
export default function AdminTemplateManager({ metadata, onBack }: { metadata: Metadata; onBack: () => void }) {
  const [selected, setSelected] = useState<TemplateItem | null>(null);
  const [data, setData] = useState<TemplateData | null>(null);
  const [original, setOriginal] = useState<TemplateData | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const definitions = metadata.app?.templates || {};
  const items = useMemo<TemplateItem[]>(() => Object.entries(definitions).flatMap(([name, raw]) => {
    const def = raw as { scopeList?: string[]; scopeListConfigParam?: string; noSubject?: boolean };
    const title = (metadata.labels as any)?.Admin?.templates?.[name] || (metadata.labels as any)?.Admin?.[name] || name;
    const scopeNames = (metadata.labels as any)?.Global?.scopeNames || {};
    const configuredScopes = def.scopeList || (def.scopeListConfigParam ? (metadata.appSettings as any)?.[def.scopeListConfigParam] : undefined);
    const scopes = Array.isArray(configuredScopes) ? [...configuredScopes].sort((a, b) => (scopeNames[a] || a).localeCompare(scopeNames[b] || b, "cs")) : [];
    return scopes.length ? scopes.map((scope) => ({ name, scope, key: `${name}_${scope}`, label: `${title} · ${scopeNames[scope] || scope}` })) : [{ name, key: name, label: title }];
  }).sort((a, b) => a.label.localeCompare(b.label, "cs")), [definitions, metadata.labels, metadata.appSettings]);
  const filtered = items.filter((item) => item.label.toLocaleLowerCase("cs").includes(query.trim().toLocaleLowerCase("cs")));
  const hasSubject = selected ? !Boolean((definitions[selected.name] as any)?.noSubject) : false;
  const dirty = Boolean(data && original && (data.body !== original.body || data.subject !== original.subject));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function leave() {
    if (!dirty || window.confirm("Máte neuložené změny systémové šablony. Opravdu chcete odejít bez uložení?")) onBack();
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey) || !(event.key.toLowerCase() === "s" || event.key === "Enter")) return;
    event.preventDefault();
    event.stopPropagation();
    void save();
  }

  async function select(item: TemplateItem) {
    if (dirty && !window.confirm("Máte neuložené změny. Zahodit je a otevřít jinou šablonu?")) return;
    setSelected(item); setData(null); setOriginal(null); setBusy(true); setError(""); setNotice("");
    const params = new URLSearchParams({ name: item.name });
    if (item.scope) params.set("scope", item.scope);
    try { const result = await request<TemplateData>(`TemplateManager/action/getTemplate?${params}`); setData(result); setOriginal(result); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Šablonu se nepodařilo načíst."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!selected || !data || saving || busy) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await request("TemplateManager/action/saveTemplate", { method: "POST", body: JSON.stringify({ name: selected.name, ...(selected.scope ? { scope: selected.scope } : {}), body: data.body, ...(hasSubject ? { subject: data.subject || "" } : {}) }) });
      setOriginal(data); setNotice("Šablona byla uložena.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Šablonu se nepodařilo uložit."); }
    finally { setSaving(false); }
  }

  async function reset() {
    if (!selected || !data || saving || busy || !window.confirm("Obnovit výchozí obsah této šablony? Vlastní úpravy budou nahrazeny.")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await request<TemplateData>("TemplateManager/action/resetTemplate", { method: "POST", body: JSON.stringify({ name: selected.name, ...(selected.scope ? { scope: selected.scope } : {}) }) });
      setData(result); setOriginal(result); setNotice("Byla obnovena výchozí šablona.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Výchozí šablonu se nepodařilo obnovit."); }
    finally { setSaving(false); }
  }

  return <div className="admin-view template-manager-view" onKeyDown={handleKeyboard}>
    <div className="entity-heading"><div><button className="back-link" onClick={leave} disabled={saving}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">SYSTÉMOVÉ TEXTY</div><h1>Správce šablon</h1><p>Upravte texty e-mailů a oznámení používané touto instalací EspoCRM.</p></div><div className="layout-heading-actions">{dirty && <button className="button subtle" onClick={() => { if (original && window.confirm("Zahodit všechny neuložené změny této šablony?")) { setData(original); setError(""); setNotice(""); } }} disabled={busy || saving}><X size={14}/> Zahodit změny</button>}<button className="button subtle" onClick={() => void reset()} disabled={!selected || !data || busy || saving}><RotateCcw size={14}/> Obnovit výchozí</button><button className="button primary" onClick={() => void save()} disabled={!dirty || saving || busy}><Save size={14}/>{saving ? "Ukládám…" : "Uložit šablonu"}</button></div></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm">{notice}</div>}
    <div className="template-manager-layout"><aside className="surface template-list"><label className="admin-settings-search"><Search size={14}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Najít šablonu…" aria-label="Hledat systémovou šablonu"/><span>{filtered.length} / {items.length}</span></label><div className="template-list-items">{filtered.map((item) => <button type="button" key={item.key} className={selected?.key === item.key ? "active" : ""} disabled={busy || saving} onClick={() => void select(item)}><FileText size={15}/><span>{item.label}</span></button>)}{!filtered.length && <p className="field-manager-empty">Žádná šablona neodpovídá hledání.</p>}</div></aside>
      <section className="surface template-editor">{!selected ? <div className="field-manager-placeholder"><span><FileText size={20}/></span><h2>Vyberte šablonu</h2><p>Seznam odpovídá systémovým šablonám dostupným v metadatech.</p></div> : busy ? <div className="table-loading"><span className="spinner"/>Načítám šablonu…</div> : data && <><div className="settings-card-head"><div><h2>{selected.label}</h2><p>{dirty ? "Máte neuložené změny." : "Úpravy se ukládají přímo do konfigurace EspoCRM."}</p></div></div>{hasSubject && <label className="field-input"><span>Předmět</span><input disabled={saving} value={data.subject || ""} onChange={(event) => setData((current) => current ? { ...current, subject: event.target.value } : current)}/></label>}<div className="field-input template-body-field"><span>Obsah</span><Suspense fallback={<div className="table-loading" role="status"><span className="spinner"/>Načítám editor šablony…</div>}><WysiwygEditor value={data.body || ""} htmlMode entity="TemplateManager" field="body" disabled={saving} sanitizeHtml={false} onChange={(body) => setData((current) => current ? { ...current, body } : current)}/></Suspense><small>Editor zachovává HTML i proměnné Handlebars EspoCRM. Uložit lze také klávesami Ctrl/Cmd + S nebo Ctrl/Cmd + Enter.</small></div></>}</section>
    </div>
  </div>;
}
