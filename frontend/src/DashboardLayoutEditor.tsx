import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "./Icons";
import type { Metadata } from "./api";
import { findDashletPosition, packDashboardItems } from "./dashboardGrid";

type Item = { id: string; name: string; x?: number; y?: number; width?: number; height?: number };
type Tab = { id?: string; name: string; layout: Item[] };
type Data = Record<string, any>;

function newId() { return `via-${Math.random().toString(36).slice(2, 11)}`; }
function normalizeLayout(value: unknown): Tab[] {
  if (!Array.isArray(value)) return [{ name: "Přehled", layout: [] }];
  return value.map((tab: any, tabIndex) => ({ ...tab, name: String(tab?.name || `Přehled ${tabIndex + 1}`), layout: Array.isArray(tab?.layout) ? tab.layout.map((item: any, index: number) => ({ ...item, id: String(item?.id || newId()), name: String(item?.name || "Records"), x: Number.isFinite(Number(item?.x)) ? Number(item.x) : index % 2, y: Number.isFinite(Number(item?.y)) ? Number(item.y) : Math.floor(index / 2), width: Math.max(1, Math.min(4, Number(item?.width) || 2)), height: Math.max(1, Math.min(8, Number(item?.height) || 3)) })) : [] }));
}

/** Edits the native dashboard tab/grid JSON used by DashboardTemplate and user preferences. */
export default function DashboardLayoutEditor({ value, options, metadata, disabled, onChange, onOptionsChange }: { value: unknown; options: Data; metadata: Metadata; disabled?: boolean; onChange: (value: Tab[]) => void; onOptionsChange: (value: Data) => void }) {
  const tabs = useMemo(() => normalizeLayout(value), [value]);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedDashlet, setSelectedDashlet] = useState("");
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const current = tabs[Math.min(activeTab, Math.max(0, tabs.length - 1))] || { name: "Přehled", layout: [] };
  const defs = ((metadata as any).dashlets || {}) as Data;
  const labels = ((metadata as any).labels?.dashlets || {}) as Data;
  const available = Object.keys(defs).sort((a, b) => String(labels[a] || a).localeCompare(String(labels[b] || b), "cs"));

  function updateTab(index: number, next: Tab) { onChange(tabs.map((tab, i) => i === index ? next : tab)); }
  function addTab() { onChange([...tabs, { id: newId(), name: `Přehled ${tabs.length + 1}`, layout: [] }]); setActiveTab(tabs.length); }
  function moveTab(delta: number) {
    const nextIndex = activeTab + delta;
    if (nextIndex < 0 || nextIndex >= tabs.length) return;
    const next = [...tabs]; [next[activeTab], next[nextIndex]] = [next[nextIndex], next[activeTab]];
    onChange(next); setActiveTab(nextIndex);
  }
  function deleteTab() {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((_, index) => index !== activeTab);
    const remainingIds = new Set(nextTabs.flatMap((tab) => tab.layout.map((item) => item.id)));
    const nextOptions = Object.fromEntries(Object.entries(options).filter(([id]) => remainingIds.has(id)));
    onOptionsChange(nextOptions); onChange(nextTabs); setActiveTab(Math.max(0, activeTab - 1));
  }
  function addDashlet() {
    if (!selectedDashlet) return;
    const id = newId();
    const defaults = defs[selectedDashlet]?.options?.defaults || {};
    const item: Item = { id, name: selectedDashlet, ...findDashletPosition(current.layout), width: 2, height: 3 };
    updateTab(activeTab, { ...current, layout: [...current.layout, item] });
    onOptionsChange({ ...options, [id]: { ...defaults, title: defaults.title || labels[selectedDashlet] || selectedDashlet } });
    setSelectedDashlet("");
  }
  function updateItem(id: string, patch: Partial<Item>) { updateTab(activeTab, { ...current, layout: current.layout.map((item) => item.id === id ? { ...item, ...patch } : item) }); }
  function moveItem(index: number, delta: number) {
    const nextIndex = index + delta; if (nextIndex < 0 || nextIndex >= current.layout.length) return;
    const layout = [...current.layout]; [layout[index], layout[nextIndex]] = [layout[nextIndex], layout[index]];
    updateTab(activeTab, { ...current, layout: packDashboardItems(layout) });
  }
  function removeItem(item: Item) {
    updateTab(activeTab, { ...current, layout: current.layout.filter((candidate) => candidate.id !== item.id) });
    const next = { ...options }; delete next[item.id]; onOptionsChange(next);
  }
  function setOption(item: Item, name: string, next: unknown) { onOptionsChange({ ...options, [item.id]: { ...(options[item.id] || defs[item.name]?.options?.defaults || {}), [name]: next } }); }
  function renderOption(item: Item, name: string, rawDef: Data) {
    const def = rawDef || {};
    const setting = options[item.id] || defs[item.name]?.options?.defaults || {};
    const optionValue = setting[name] ?? def.default ?? "";
    const choiceList = Array.isArray(def.options) ? def.options : name === "entityType" ? Object.keys(metadata.entityDefs || {}).filter((scope) => metadata.entityDefs[scope]?.fields) : name.toLowerCase().includes("scope") || def.translation?.includes("scopeNames") ? Object.keys(metadata.scopes || {}).filter((scope) => metadata.scopes[scope]?.entity).sort() : [];
    if (def.type === "bool") return <label className="dashboard-layout-option" key={`${item.id}-${name}`}><input type="checkbox" checked={Boolean(optionValue)} onChange={(event) => setOption(item, name, event.target.checked)}/><span>{name}</span></label>;
    if (["enum", "enumInt", "enumFloat"].includes(def.type) && choiceList.length) return <label className="dashboard-layout-option" key={`${item.id}-${name}`}><span>{name}</span><select value={String(optionValue)} onChange={(event) => setOption(item, name, def.type === "enumInt" ? Number(event.target.value) : def.type === "enumFloat" ? Number(event.target.value) : event.target.value)}>{choiceList.map((choice: any) => <option key={String(choice)} value={String(choice)}>{metadata.scopes?.[String(choice)] ? ((metadata.labels as any)?.scopeNamesPlural?.[String(choice)] || (metadata.labels as any)?.scopeNames?.[String(choice)] || String(choice)) : String(choice)}</option>)}</select></label>;
    if (def.type === "multiEnum" && choiceList.length) return <label className="dashboard-layout-option" key={`${item.id}-${name}`}><span>{name}</span><select multiple size={Math.min(5, Math.max(3, choiceList.length))} value={Array.isArray(optionValue) ? optionValue.map(String) : []} onChange={(event) => setOption(item, name, Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{choiceList.map((choice: any) => <option key={String(choice)} value={String(choice)}>{metadata.scopes?.[String(choice)] ? ((metadata.labels as any)?.scopeNamesPlural?.[String(choice)] || String(choice)) : String(choice)}</option>)}</select></label>;
    if (def.type === "text" || def.type === "jsonObject" || def.type === "jsonArray" || def.type === "base") {
      const isJson = def.type.startsWith("json") || def.type === "base";
      const draftKey = `${item.id}:${name}`;
      const jsonText = typeof optionValue === "string" ? optionValue : JSON.stringify(optionValue ?? (def.type === "jsonArray" ? [] : {}), null, 2);
      return <label className="dashboard-layout-option full" key={`${item.id}-${name}`}><span>{name}{isJson ? " (JSON)" : ""}</span><textarea rows={3} value={isJson ? (jsonDrafts[draftKey] ?? jsonText) : jsonText} onChange={(event) => { if (!isJson) { setOption(item, name, event.target.value); return; } const text = event.target.value; setJsonDrafts((current) => ({ ...current, [draftKey]: text })); try { setOption(item, name, JSON.parse(text)); setJsonDrafts((current) => { const next = { ...current }; delete next[draftKey]; return next; }); } catch { /* Retain incomplete JSON text while the user edits. */ } }}/></label>;
    }
    return <label className="dashboard-layout-option" key={`${item.id}-${name}`}><span>{name}</span><input type={["int", "float", "enumInt", "enumFloat"].includes(def.type) ? "number" : def.type === "url" ? "url" : "text"} min={def.min} max={def.max} value={optionValue} onChange={(event) => setOption(item, name, ["int", "float", "enumInt", "enumFloat"].includes(def.type) ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value)}/></label>;
  }

  return <section className="dashboard-layout-editor">
    <div className="dashboard-layout-tabs">{tabs.map((tab, index) => <button type="button" key={`${index}-${tab.name}`} className={index === activeTab ? "active" : ""} onClick={() => setActiveTab(index)}>{tab.name || `Přehled ${index + 1}`}<small>{tab.layout.length}</small></button>)}<button type="button" className="dashboard-layout-add-tab" onClick={addTab} disabled={disabled}><Plus size={14}/> Přidat záložku</button></div>
    <div className="dashboard-layout-toolbar"><label><span>Název záložky</span><input value={current.name} disabled={disabled} onChange={(event) => updateTab(activeTab, { ...current, name: event.target.value })}/></label><div className="dashboard-layout-item-actions"><button type="button" title="Posunout záložku nahoru" disabled={disabled || activeTab === 0} onClick={() => moveTab(-1)}><ArrowUp size={14}/></button><button type="button" title="Posunout záložku dolů" disabled={disabled || activeTab === tabs.length - 1} onClick={() => moveTab(1)}><ArrowDown size={14}/></button></div><button type="button" className="button subtle" disabled={disabled || tabs.length < 2} onClick={deleteTab}><Trash2 size={13}/> Odebrat záložku</button></div>
    <div className="dashboard-layout-add"><label><span>Přidat panel</span><select value={selectedDashlet} disabled={disabled} onChange={(event) => setSelectedDashlet(event.target.value)}><option value="">Vyberte panel…</option>{available.map((name) => <option key={name} value={name}>{labels[name] || name}</option>)}</select></label><button type="button" className="button subtle" disabled={disabled || !selectedDashlet} onClick={addDashlet}><Plus size={14}/> Přidat panel</button></div>
    {!current.layout.length ? <div className="dashboard-layout-empty">Tato záložka zatím nemá žádné panely.</div> : <div className="dashboard-layout-items">{current.layout.map((item, index) => {
      const fieldDefs = defs[item.name]?.options?.fields || {};
      const itemOptions = options[item.id] || defs[item.name]?.options?.defaults || {};
      return <article className="dashboard-layout-item" key={item.id}><header><strong>{labels[item.name] || item.name}</strong><small>{item.name} · sloupec {Number(item.x || 0) + 1}, řádek {Number(item.y || 0) + 1}</small><div className="dashboard-layout-item-actions"><button type="button" title="Posunout nahoru" disabled={disabled || index === 0} onClick={() => moveItem(index, -1)}><ArrowUp size={14}/></button><button type="button" title="Posunout dolů" disabled={disabled || index === current.layout.length - 1} onClick={() => moveItem(index, 1)}><ArrowDown size={14}/></button><button type="button" title="Odebrat panel" disabled={disabled} onClick={() => removeItem(item)}><Trash2 size={14}/></button></div></header>
        <div className="dashboard-layout-grid-settings"><label><span>Šířka</span><select value={item.width || 2} disabled={disabled} onChange={(event) => updateItem(item.id, { width: Number(event.target.value) })}>{[1, 2, 3, 4].map((n) => <option value={n} key={n}>{n} / 4</option>)}</select></label><label><span>Výška</span><select value={item.height || 3} disabled={disabled} onChange={(event) => updateItem(item.id, { height: Number(event.target.value) })}>{[2, 3, 4, 5, 6, 8].map((n) => <option value={n} key={n}>{n}</option>)}</select></label></div>
        {Object.keys(fieldDefs).length > 0 && <details className="dashboard-layout-options"><summary>Nastavení panelu</summary><div>{Object.entries(fieldDefs).map(([name, def]) => renderOption(item, name, def as Data))}</div></details>}
        {Object.keys(itemOptions).some((name) => !(name in fieldDefs)) && <details className="dashboard-layout-options"><summary>Další uložená nastavení</summary><label className="dashboard-layout-option full"><span>Rozšířené volby (JSON)</span><textarea rows={4} spellCheck={false} value={jsonDrafts[`${item.id}:__extended`] ?? JSON.stringify(itemOptions, null, 2)} disabled={disabled} onChange={(event) => { const text = event.target.value; setJsonDrafts((current) => ({ ...current, [`${item.id}:__extended`]: text })); try { onOptionsChange({ ...options, [item.id]: JSON.parse(text) }); setJsonDrafts((current) => { const next = { ...current }; delete next[`${item.id}:__extended`]; return next; }); } catch { /* Retain incomplete JSON text while the user edits. */ } }}/></label></details>}
      </article>;
    })}</div>}
  </section>;
}
