import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, RotateCcw, Save, Trash2 } from "./Icons";
import { entityLabel, fieldLabel, request } from "./api";
import type { Metadata } from "./api";
import { DynamicLogicEditor } from "./DynamicLogicEditor";

type LayoutEntry = string | { name?: string; label?: string; [key: string]: any } | false;
const commonTypes = ["list", "detail", "listSmall", "detailSmall", "defaultSidePanel", "bottomPanelsDetail", "filters", "massUpdate", "sidePanelsDetail", "sidePanelsEdit", "sidePanelsDetailSmall", "sidePanelsEditSmall"];

async function findLayoutSetRecord(layoutSetId: string, name: string): Promise<any | null> {
  const params = new URLSearchParams({ maxSize: "1", offset: "0" });
  params.set("where[0][type]", "equals"); params.set("where[0][attribute]", "layoutSetId"); params.set("where[0][value]", layoutSetId);
  params.set("where[1][type]", "equals"); params.set("where[1][attribute]", "name"); params.set("where[1][value]", name);
  const result = await request<{ list?: any[] }>(`LayoutRecord?${params.toString()}`);
  return result.list?.[0] || null;
}

export default function AdminLayoutManager({ metadata, onBack, layoutSetId, layoutSetName, layoutList = [] }: { metadata: Metadata; onBack: () => void; layoutSetId?: string; layoutSetName?: string; layoutList?: string[] }) {
  const layoutSetScopes = useMemo(() => new Set(layoutList.map((item) => item.split(".")[0])), [layoutList]);
  const scopes = useMemo(() => Object.keys(metadata.scopes).filter((scope) => metadata.scopes[scope].entity && metadata.scopes[scope].layouts && (!layoutSetId || layoutSetScopes.has(scope))).sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs")), [metadata, layoutSetId, layoutSetScopes]);
  const [scope, setScope] = useState(scopes.includes("Account") ? "Account" : scopes[0] || "");
  const [layoutName, setLayoutName] = useState("list");
  const [value, setValue] = useState<any>(null);
  const [source, setSource] = useState("");
  const [initialSource, setInitialSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const entity = metadata.entityDefs[scope];
  const realLayoutName = layoutName === "listSmall" ? "list" : layoutName === "detailSmall" ? "detail" : (metadata.clientDefs?.[scope] as any)?.additionalLayouts?.[layoutName]?.type || layoutName;
  const fieldNames = Object.keys(entity?.fields || {}).filter((name) => {
    const def = entity?.fields?.[name] as any;
    const typeDef = metadata.fields?.[def?.type || ""] as any;
    if (!def || def.utility || def.disabled) return false;
    const availableList = def.layoutAvailabilityList;
    const ignoredList = def.layoutIgnoreList || [];
    if (Array.isArray(availableList) && !availableList.includes(layoutName) && !availableList.includes(realLayoutName)) return false;
    if (ignoredList.includes(layoutName) || ignoredList.includes(realLayoutName)) return false;
    if (layoutName === "filters") return typeDef?.filter === true && !def.layoutFiltersDisabled;
    if (layoutName === "massUpdate") return !def.massUpdateDisabled && !def.layoutMassUpdateDisabled && !def.readOnly && !def.readOnlyAfterCreate && !["duration", "foreign"].includes(def.type);
    if (layoutName === "defaultSidePanel") return !["modifiedAt", "createdAt", "modifiedBy", "createdBy"].includes(name) && !def.layoutDefaultSidePanelDisabled && !def.layoutDetailDisabled;
    if (layoutName.startsWith("list")) return !def.layoutListDisabled;
    if (layoutName.startsWith("detail")) return !def.layoutDetailDisabled;
    return true;
  }).sort((a, b) => fieldLabel(a, entity?.fields?.[a], scope, metadata).localeCompare(fieldLabel(b, entity?.fields?.[b], scope, metadata), "cs"));
  if (layoutName === "defaultSidePanel" && entity?.links?.assignedUser && !fieldNames.includes(":assignedUser")) fieldNames.unshift(":assignedUser");
  const retainedLayoutFields = Array.isArray(value) ? value.map((item: LayoutEntry) => typeof item === "string" ? item : item && typeof item === "object" ? item.name || "" : "").filter(Boolean) : [];
  const fieldOptions = [...new Set([...fieldNames, ...retainedLayoutFields])].sort((a, b) => fieldLabel(a, entity?.fields?.[a], scope, metadata).localeCompare(fieldLabel(b, entity?.fields?.[b], scope, metadata), "cs"));
  const isPanelLayout = /^((side|bottom)Panels)(Detail|Edit)/i.test(layoutName) && value !== null && !Array.isArray(value) && typeof value === "object";
  const isBottomPanels = /^bottomPanels/i.test(layoutName);
  const isKanbanLayout = layoutName === "kanban";
  const isListLayout = /^list/i.test(layoutName);
  const panelEntries = isPanelLayout ? Object.entries(value as Record<string, any>).sort((a, b) => Number(a[1]?.index ?? 999) - Number(b[1]?.index ?? 999)) : [];
  const linkDefs = entity?.links || {};
  const panelChoices = [...new Set([
    ...((entity as any)?.stream || (metadata.scopes[scope] as any)?.stream || scope === "User" ? ["stream"] : []),
    ...Object.entries(linkDefs).filter(([, def]: [string, any]) => !def.disabled && !def.utility && !def.layoutRelationshipsDisabled && ["hasMany", "hasChildren"].includes(def.type)).map(([name]) => name),
    ...((metadata.clientDefs?.[scope]?.bottomPanels?.[layoutName.includes("Edit") ? "edit" : "detail"] || []).map((panel: any) => panel?.name).filter((name: unknown): name is string => typeof name === "string")),
    ...Object.keys(value && !Array.isArray(value) && typeof value === "object" ? value : {}),
    ...(!isBottomPanels && metadata.clientDefs?.[scope]?.defaultSidePanel?.[layoutName.includes("Edit") ? "edit" : "detail"] !== false ? ["default"] : []),
  ])];
  const types = useMemo(() => {
    const client = metadata.clientDefs?.[scope] as any;
    const list = [...commonTypes];
    if (client?.bottomPanels?.edit) list.push("bottomPanelsEdit");
    if (client?.defaultSidePanelDisabled || client?.defaultSidePanelFieldList) list.splice(list.indexOf("defaultSidePanel"), 1);
    if (client?.kanbanViewMode) list.push("kanban");
    list.push(...Object.keys(client?.additionalLayouts || {}));
    const available = [...new Set(list)].filter((name) => (!layoutSetId || !name.endsWith("Portal")) && !client?.[`layout${name[0].toUpperCase()}${name.slice(1)}Disabled`]);
    return layoutSetId ? available.filter((name) => layoutList.includes(`${scope}.${name}`)) : available;
  }, [metadata, scope, layoutSetId, layoutList]);
  const isFieldList = !/^detail/i.test(layoutName) && Array.isArray(value) && value.every((item: LayoutEntry) => item === false || typeof item === "string" || Boolean(item && typeof item === "object" && typeof item.name === "string"));
  const isSectionLayout = /^detail/i.test(layoutName) && Array.isArray(value) && value.every((item: any) => item && typeof item === "object" && Array.isArray(item.rows));

  useEffect(() => { if (!scopes.includes(scope) && scopes[0]) setScope(scopes.includes("Account") ? "Account" : scopes[0]); }, [scopes, scope]);
  useEffect(() => { if (!types.includes(layoutName) && types[0]) setLayoutName(types[0]); }, [types, layoutName]);
  useEffect(() => {
    if (!scope || !layoutName) return;
    let live = true;
    setBusy(true); setError(""); setNotice(""); setValue(null); setSource("");
    const load = async () => {
      if (!layoutSetId) return request<any>(`${encodeURIComponent(scope)}/layout/${encodeURIComponent(layoutName)}`);
      const setRecord = await findLayoutSetRecord(layoutSetId, `${scope}.${layoutName}`);
      if (setRecord) return typeof setRecord.data === "string" ? JSON.parse(setRecord.data) : setRecord.data;
      const params = new URLSearchParams({ scope, name: layoutName });
      return request<any>(`Layout/action/getOriginal?${params.toString()}`);
    };
    load().then((data) => {
      if (!live) return;
      setValue(data); const formatted = JSON.stringify(data, null, 2); setSource(formatted); setInitialSource(formatted);
    }).catch((e) => live && setError(e instanceof Error ? e.message : "Rozložení se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [scope, layoutName, layoutSetId]);

  function setLayout(next: any) { setValue(next); setSource(JSON.stringify(next, null, 2)); setNotice(""); setError(""); }
  function parseSource() {
    try { setValue(JSON.parse(source)); setError(""); return true; }
    catch (e) { setError(e instanceof Error ? `Neplatný JSON: ${e.message}` : "Rozložení není platný JSON."); return false; }
  }
  function replaceItem(index: number, next: any) { const copy = [...value]; copy[index] = next; setLayout(copy); }
  function updateFieldOption(index: number, name: string, nextValue: any) {
    const item = value[index];
    const next = typeof item === "string" ? { name: item } : { ...(item || {}) };
    if (nextValue === undefined || nextValue === "") delete next[name]; else next[name] = nextValue;
    replaceItem(index, next);
  }
  function updateFieldWidth(index: number, unit: "%" | "px", rawValue: string) {
    const item = value[index];
    const next = typeof item === "string" ? { name: item } : { ...(item || {}) };
    delete next.width; delete next.widthPx;
    if (rawValue !== "") next[unit === "%" ? "width" : "widthPx"] = Number(rawValue);
    replaceItem(index, next);
  }
  function moveItem(index: number, shift: number) { const next = [...value]; const target = index + shift; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setLayout(next); }
  function addItem() { const used = new Set(value.map((item: LayoutEntry) => typeof item === "string" ? item : item && typeof item === "object" ? item.name : "")); const name = fieldNames.find((field) => !used.has(field)) || fieldNames[0]; if (!name) return; if (typeof value[0] === "string" || layoutName === "filters" || layoutName === "massUpdate") { setLayout([...value, name]); return; } if (layoutName.startsWith("list")) { const type = entity?.fields?.[name]?.type || ""; const width = layoutName === "listSmall" ? 20 : 16; setLayout([...value, { name, width, ...(metadata.fields?.[type]?.notSortable || entity?.fields?.[name]?.notSortable ? { notSortable: true } : {}) }]); return; } setLayout([...value, { name }]); }
  function updatePanel(name: string, patch: Record<string, any>) {
    const next = { ...value };
    next[name] = { ...(next[name] || { name }), ...patch };
    setLayout(next);
  }
  function addPanel(name: string) {
    const next = { ...value };
    next[name] = { ...(next[name] || {}), name, index: panelEntries.filter(([, item]) => !item?.disabled).length };
    setLayout(next);
  }
  function movePanel(name: string, shift: number) {
    const enabled = panelEntries.filter(([, item]) => !item?.disabled).map(([key]) => key);
    const index = enabled.indexOf(name), target = index + shift;
    if (target < 0 || target >= enabled.length) return;
    [enabled[index], enabled[target]] = [enabled[target], enabled[index]];
    const next = { ...value };
    enabled.forEach((key, position) => { next[key] = { ...next[key], index: position }; });
    setLayout(next);
  }
  function updateSection(sectionIndex: number, patch: Record<string, any>) {
    const next = [...value]; next[sectionIndex] = { ...next[sectionIndex], ...patch }; setLayout(next);
  }
  function updateSectionRow(sectionIndex: number, rowIndex: number, row: any[]) {
    const next = [...value]; const section = { ...next[sectionIndex], rows: [...next[sectionIndex].rows] };
    section.rows[rowIndex] = row; next[sectionIndex] = section; setLayout(next);
  }
  function moveSection(sectionIndex: number, shift: number) {
    const target = sectionIndex + shift; if (target < 0 || target >= value.length) return;
    const next = [...value]; [next[sectionIndex], next[target]] = [next[target], next[sectionIndex]]; setLayout(next);
  }
  function moveSectionRow(sectionIndex: number, rowIndex: number, shift: number) {
    const section = value[sectionIndex], target = rowIndex + shift; if (target < 0 || target >= section.rows.length) return;
    const rows = [...section.rows]; [rows[rowIndex], rows[target]] = [rows[target], rows[rowIndex]]; updateSection(sectionIndex, { rows });
  }
  function updateSectionCell(sectionIndex: number, rowIndex: number, cellIndex: number, field: string) {
    const row = [...value[sectionIndex].rows[rowIndex]]; const current = row[cellIndex];
    row[cellIndex] = field ? (current && typeof current === "object" ? { ...current, name: field } : field) : false;
    updateSectionRow(sectionIndex, rowIndex, row);
  }

  async function save() {
    if (!parseSource()) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const path = `${encodeURIComponent(scope)}/layout/${encodeURIComponent(layoutName)}${layoutSetId ? `/${encodeURIComponent(layoutSetId)}` : ""}`;
      const result = await request<any>(path, { method: "PUT", body: JSON.stringify(value) });
      const confirmed = result ?? (layoutSetId ? value : await request<any>(path));
      setValue(confirmed); const formatted = JSON.stringify(confirmed, null, 2); setSource(formatted); setInitialSource(formatted); setNotice("Rozložení bylo uloženo.");
    } catch (e) { setError(e instanceof Error ? e.message : "Rozložení se nepodařilo uložit."); }
    finally { setSaving(false); }
  }
  async function reset() {
    if (layoutSetId) {
      if (!window.confirm(`Odstranit vlastní rozložení „${layoutName}“ ze sady „${layoutSetName || ""}“ a převzít globální rozložení?`)) return;
      setBusy(true); setError(""); setNotice("");
      try {
        const inherited = await request<any>("Layout/action/resetToDefault", { method: "POST", body: JSON.stringify({ scope, name: layoutName, setId: layoutSetId }) });
        setValue(inherited); const formatted = JSON.stringify(inherited, null, 2); setSource(formatted); setInitialSource(formatted); setNotice("Vlastní rozložení bylo odstraněno; sada nyní přebírá globální rozložení.");
      } catch (e) { setError(e instanceof Error ? e.message : "Rozložení sady se nepodařilo obnovit."); }
      finally { setBusy(false); }
      return;
    }
    if (!window.confirm(`Obnovit výchozí rozložení „${layoutName}“ pro ${entityLabel(metadata, scope)}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("Layout/action/resetToDefault", { method: "POST", body: JSON.stringify({ scope, name: layoutName }) });
      const restored = await request<any>(`${encodeURIComponent(scope)}/layout/${encodeURIComponent(layoutName)}`);
      setValue(restored); const formatted = JSON.stringify(restored, null, 2); setSource(formatted); setInitialSource(formatted); setNotice("Výchozí rozložení bylo obnoveno.");
    } catch (e) { setError(e instanceof Error ? e.message : "Výchozí rozložení se nepodařilo obnovit."); }
    finally { setBusy(false); }
  }

  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> {layoutSetId ? `Sada rozložení · ${layoutSetName || ""}` : "Administrace"}</button><div className="eyebrow">{layoutSetId ? "VLASTNÍ SADA ROZLOŽENÍ" : "PŘIZPŮSOBENÍ CRM"}</div><h1>{layoutSetId ? `Rozložení: ${layoutSetName || "sada"}` : "Správce rozložení"}</h1><p>{layoutSetId ? "Nastavte rozložení obrazovek pro uživatele této sady." : "Upravte pole a panely v seznamech a záznamech."}</p></div><div className="layout-heading-actions"><button className="button subtle" onClick={() => void reset()} disabled={busy || saving}><RotateCcw size={14}/>{layoutSetId ? "Převzít globální" : "Výchozí rozložení"}</button><button className="button primary" onClick={() => void save()} disabled={busy || saving || value === null}><Save size={14}/>{saving ? "Ukládám…" : "Uložit rozložení"}</button></div></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <section className="surface layout-editor"><div className="layout-selector-row"><label className="setting-field"><span>Entita</span><select value={scope} onChange={(event) => { if (source !== initialSource && !window.confirm("Zahodit neuložené změny rozložení?")) return; setScope(event.target.value); }}>{scopes.map((item) => <option key={item} value={item}>{entityLabel(metadata, item, true)}</option>)}</select></label><label className="setting-field"><span>Typ rozložení</span><select value={layoutName} onChange={(event) => { if (source !== initialSource && !window.confirm("Zahodit neuložené změny rozložení?")) return; setLayoutName(event.target.value); }}>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></div>
      {busy ? <div className="table-loading"><span className="spinner"/> Načítám rozložení…</div> : value !== null && <>
        {isFieldList && <div className="layout-field-list"><div className="layout-field-head"><strong>Pole v rozložení</strong><button className="button subtle" onClick={addItem} disabled={!fieldNames.length}>＋ Přidat pole</button></div>{value.length ? value.map((item: LayoutEntry, index: number) => {
          const field = typeof item === "string" ? item : item && typeof item === "object" ? item.name || "" : "";
          const options = item && typeof item === "object" ? item : {};
          const setFlag = (name: string) => (event: ChangeEvent<HTMLInputElement>) => updateFieldOption(index, name, event.target.checked ? true : undefined);
          return <div className="layout-field-row layout-field-row-rich" key={`${field}-${index}`}><span className="layout-row-grip">{index + 1}</span><select value={field} onChange={(event) => replaceItem(index, typeof item === "string" ? event.target.value : { ...item, name: event.target.value })}><option value="">— prázdné —</option>{fieldOptions.map((name) => <option value={name} key={name}>{name === ":assignedUser" ? "Přiřazený uživatel" : fieldLabel(name, entity?.fields?.[name], scope, metadata)}</option>)}</select>
            {item && typeof item === "object" && <details className="layout-field-options"><summary>Nastavení</summary><div>
              <label className="layout-flag"><input type="checkbox" checked={Boolean(options.link)} onChange={setFlag("link")}/> Odkaz</label>
              {(isListLayout || isKanbanLayout) && <label className="layout-flag"><input type="checkbox" checked={Boolean(options.hidden)} onChange={setFlag("hidden")}/> Skrýt sloupec</label>}
              {isListLayout && <><label className="layout-flag"><input type="checkbox" checked={Boolean(options.notSortable)} onChange={setFlag("notSortable")}/> Bez řazení</label><label className="layout-flag"><input type="checkbox" checked={Boolean(options.noLabel)} onChange={setFlag("noLabel")}/> Bez názvu</label><label className="layout-field-number"><span>Šířka</span><div className="layout-width-control"><select aria-label="Jednotka šířky" value={options.widthPx ? "px" : "%"} onChange={(event) => updateFieldWidth(index, event.target.value === "px" ? "px" : "%", String(options.widthPx || options.width || ""))}><option value="%">%</option><option value="px">px</option></select><input type="number" min={options.widthPx ? 30 : 5} max={options.widthPx ? 768 : 95} step="any" value={options.widthPx ?? options.width ?? ""} onChange={(event) => updateFieldWidth(index, options.widthPx ? "px" : "%", event.target.value)}/></div></label><label className="layout-field-select"><span>Zarovnání</span><select value={options.align || ""} onChange={(event) => updateFieldOption(index, "align", event.target.value)}><option value="">Výchozí</option><option value="left">Vlevo</option><option value="right">Vpravo</option></select></label></>}
              {isKanbanLayout && <><label className="layout-flag"><input type="checkbox" checked={Boolean(options.isLarge)} onChange={setFlag("isLarge")}/> Velké</label><label className="layout-flag"><input type="checkbox" checked={Boolean(options.isMuted)} onChange={setFlag("isMuted")}/> Tlumené</label><label className="layout-field-select"><span>Zarovnání</span><select value={options.align || ""} onChange={(event) => updateFieldOption(index, "align", event.target.value)}><option value="">Výchozí</option><option value="left">Vlevo</option><option value="right">Vpravo</option></select></label></>}
            </div></details>}
            <button className="layout-icon-action" title="Nahoru" onClick={() => moveItem(index, -1)} disabled={index === 0}><ArrowUp size={14}/></button><button className="layout-icon-action" title="Dolů" onClick={() => moveItem(index, 1)} disabled={index === value.length - 1}><ArrowDown size={14}/></button><button className="layout-icon-action danger" title="Odebrat" onClick={() => setLayout(value.filter((_: any, i: number) => i !== index))}><Trash2 size={14}/></button>
          </div>;
        }) : <p className="field-manager-empty">Rozložení zatím neobsahuje žádná pole.</p>}</div>}
        {isSectionLayout && <div className="layout-field-list"><div className="layout-field-head"><strong>Panely a pole</strong><button className="button subtle" onClick={() => setLayout([...value, { label: "", rows: [[{ name: fieldNames[0] || "name" }]] }])} disabled={!fieldNames.length}>＋ Přidat panel</button></div>{value.length ? value.map((section: any, sectionIndex: number) => <section className="layout-section-editor" key={`section-${sectionIndex}`}><div className="layout-section-heading"><span className="layout-row-grip">{sectionIndex + 1}</span><input aria-label="Název panelu" value={section.label || ""} placeholder="Panel bez nadpisu" onChange={(event) => updateSection(sectionIndex, { label: event.target.value || undefined })}/><label className="layout-flag"><input type="checkbox" checked={Boolean(section.hidden)} onChange={(event) => updateSection(sectionIndex, { hidden: event.target.checked || undefined })}/> Skrytý</label><button className="layout-icon-action" title="Nahoru" onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0}><ArrowUp size={14}/></button><button className="layout-icon-action" title="Dolů" onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === value.length - 1}><ArrowDown size={14}/></button><button className="layout-icon-action danger" title="Odebrat panel" onClick={() => setLayout(value.filter((_: any, index: number) => index !== sectionIndex))}><Trash2 size={14}/></button></div><div className="layout-panel-options"><label className="setting-field"><span>Vzhled panelu</span><select value={section.style || "default"} onChange={(event) => updateSection(sectionIndex, { style: event.target.value })}><option value="default">Výchozí</option><option value="success">Zelený</option><option value="info">Modrý</option><option value="warning">Varování</option><option value="danger">Červený</option></select></label><label className="layout-flag"><input type="checkbox" checked={Boolean(section.tabBreak)} onChange={(event) => updateSection(sectionIndex, { tabBreak: event.target.checked || undefined })}/> Začít v nové záložce</label>{section.tabBreak && <label className="setting-field"><span>Název záložky</span><input value={section.tabLabel || ""} onChange={(event) => updateSection(sectionIndex, { tabLabel: event.target.value || undefined })} placeholder="Záložka"/></label>}{/^detail/i.test(layoutName) && <><label className="setting-field preference-long-field"><span>Poznámka panelu</span><textarea rows={2} value={section.noteText || ""} onChange={(event) => updateSection(sectionIndex, { noteText: event.target.value || undefined })}/></label>{section.noteText && <label className="setting-field"><span>Vzhled poznámky</span><select value={section.noteStyle || "info"} onChange={(event) => updateSection(sectionIndex, { noteStyle: event.target.value })}><option value="info">Modrý</option><option value="success">Zelený</option><option value="warning">Varování</option><option value="danger">Červený</option></select></label>}</>}</div><DynamicLogicEditor metadata={metadata} entity={scope} title="Zobrazit panel při splnění podmínky" value={section.dynamicLogicVisible || null} onChange={(next) => updateSection(sectionIndex, { dynamicLogicVisible: next || undefined })}/>{/^detail/i.test(layoutName) && section.style && section.style !== "default" && <DynamicLogicEditor metadata={metadata} entity={scope} title="Použít vzhled panelu při splnění podmínky" value={section.dynamicLogicStyled || null} onChange={(next) => updateSection(sectionIndex, { dynamicLogicStyled: next || undefined })}/>} {section.rows.map((row: any[], rowIndex: number) => <div className="layout-section-row" key={`row-${sectionIndex}-${rowIndex}`}>{row.map((item: any, cellIndex: number) => { const field = typeof item === "string" ? item : item && typeof item === "object" ? item.name || "" : ""; return <div className="layout-section-cell" key={`cell-${cellIndex}`}><select value={field} onChange={(event) => updateSectionCell(sectionIndex, rowIndex, cellIndex, event.target.value)}><option value="">— prázdné —</option>{fieldNames.map((name) => <option key={name} value={name}>{fieldLabel(name, entity?.fields?.[name], scope, metadata)}</option>)}</select>{item && typeof item === "object" && <label className="layout-flag"><input type="checkbox" checked={Boolean(item.fullWidth)} onChange={(event) => { const next = [...row]; next[cellIndex] = { ...item, fullWidth: event.target.checked || undefined }; updateSectionRow(sectionIndex, rowIndex, next); }}/> Celá šířka</label>}<button className="layout-icon-action danger" title="Odebrat pole" onClick={() => { const next = row.filter((_: any, index: number) => index !== cellIndex); if (!next.length) updateSection(sectionIndex, { rows: section.rows.filter((_: any, index: number) => index !== rowIndex) }); else updateSectionRow(sectionIndex, rowIndex, next); }}><Trash2 size={13}/></button></div>; })}<button className="button subtle layout-add-cell" onClick={() => updateSectionRow(sectionIndex, rowIndex, [...row, { name: fieldNames.find((name) => !row.some((cell) => (typeof cell === "string" ? cell : cell?.name) === name)) || fieldNames[0] }])} disabled={!fieldNames.length}>＋ Pole do řádku</button><button className="layout-icon-action" title="Nahoru" onClick={() => moveSectionRow(sectionIndex, rowIndex, -1)} disabled={rowIndex === 0}><ArrowUp size={14}/></button><button className="layout-icon-action" title="Dolů" onClick={() => moveSectionRow(sectionIndex, rowIndex, 1)} disabled={rowIndex === section.rows.length - 1}><ArrowDown size={14}/></button><button className="layout-icon-action danger" title="Odebrat řádek" onClick={() => updateSection(sectionIndex, { rows: section.rows.filter((_: any, index: number) => index !== rowIndex) })}><Trash2 size={13}/></button></div>)}<button className="button subtle" onClick={() => updateSection(sectionIndex, { rows: [...section.rows, [{ name: fieldNames.find((name) => !section.rows.flat().some((cell: any) => (typeof cell === "string" ? cell : cell?.name) === name)) || fieldNames[0] }] ] })} disabled={!fieldNames.length}>＋ Přidat řádek</button></section>) : <p className="field-manager-empty">Rozložení nemá panely. Přidejte první panel.</p>}</div>}
        {isPanelLayout && <div className="layout-field-list"><div className="layout-field-head"><strong>{isBottomPanels ? "Spodní panely" : "Boční panely"}</strong><select aria-label="Přidat panel" value="" onChange={(event) => { if (event.target.value) addPanel(event.target.value); }}><option value="">＋ Přidat panel…</option>{panelChoices.filter((name) => !value[name] || value[name]?.disabled).map((name) => <option value={name} key={name}>{name === "stream" ? "Stream" : name === "default" ? "Výchozí panel" : (metadata.labels?.[scope] as any)?.links?.[name] || name}</option>)}</select></div>{panelEntries.length ? panelEntries.map(([name, item], index) => {
          const disabled = Boolean(item?.disabled);
          const activeIndex = panelEntries.filter(([, panel]) => !panel?.disabled).findIndex(([key]) => key === name);
          const label = name === "stream" ? "Stream" : name === "default" ? "Výchozí panel" : (metadata.labels?.[scope] as any)?.links?.[name] || name;
          return <div className={`layout-panel-card ${disabled ? "is-disabled" : ""}`} key={name}><div className="layout-panel-toolbar"><span className="layout-row-grip">{index + 1}</span><div><strong>{label}</strong><small>{name}</small></div><label className="layout-flag"><input type="checkbox" checked={!disabled} onChange={(event) => updatePanel(name, event.target.checked ? { disabled: undefined, name } : { disabled: true })}/> Aktivní</label><button className="layout-icon-action" title="Nahoru" onClick={() => movePanel(name, -1)} disabled={disabled || activeIndex <= 0}><ArrowUp size={14}/></button><button className="layout-icon-action" title="Dolů" onClick={() => movePanel(name, 1)} disabled={disabled || activeIndex < 0 || activeIndex >= panelEntries.filter(([, panel]) => !panel?.disabled).length - 1}><ArrowDown size={14}/></button></div>{!disabled && <div className="layout-panel-options"><label className="setting-field"><span>Vzhled</span><select value={item?.style || "default"} onChange={(event) => updatePanel(name, { style: event.target.value })}><option value="default">Výchozí</option><option value="success">Zelený</option><option value="info">Modrý</option><option value="warning">Varování</option><option value="danger">Červený</option></select></label>{isBottomPanels && <><label className="setting-field"><span>Štítek panelu</span><input value={item?.tabLabel || ""} onChange={(event) => updatePanel(name, { tabLabel: event.target.value || undefined, tabBreak: true })} placeholder="Název záložky"/></label><label className="layout-flag"><input type="checkbox" checked={Boolean(item?.tabBreak)} onChange={(event) => updatePanel(name, { tabBreak: event.target.checked || undefined })}/> Začít v nové záložce</label></>}<label className="layout-flag"><input type="checkbox" checked={Boolean(item?.sticked)} onChange={(event) => updatePanel(name, { sticked: event.target.checked || undefined })}/> Připnout</label></div>}{!disabled && <DynamicLogicEditor metadata={metadata} entity={scope} title={`Zobrazit panel „${label}“ při splnění podmínky`} value={item?.dynamicLogicVisible || null} onChange={(next) => updatePanel(name, { dynamicLogicVisible: next || undefined })}/>}</div>;
          {item?.style && item.style !== "default" && <DynamicLogicEditor metadata={metadata} entity={scope} title={`Použít vzhled panelu „${label}“ při splnění podmínky`} value={item?.dynamicLogicStyled || null} onChange={(next) => updatePanel(name, { dynamicLogicStyled: next || undefined })}/>}
        }) : <p className="field-manager-empty">Pro tuto entitu zatím nejsou nakonfigurované žádné panely.</p>}</div>}
        <details className="layout-json"><summary>Pokročilá konfigurace JSON</summary><textarea spellCheck={false} value={source} onChange={(event) => setSource(event.target.value)} onBlur={parseSource} rows={16}/><small>JSON odpovídá přímo definici rozložení EspoCRM. Uložení probíhá přes nativní Layout API.</small></details>
      </>}
    </section>
  </div>;
}
