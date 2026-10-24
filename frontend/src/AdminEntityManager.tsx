import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, FileInput, Plus, Save, Search, Trash2, X } from "./Icons";
import { downloadAttachment, entityLabel, fetchMetadata, fieldLabel, request } from "./api";
import EspoIcon from "./EspoIcon";
import AdminEntityFormula from "./AdminEntityFormula";
import { espoIconClasses } from "./espoIconClasses";
import { featuredIconClasses } from "./featuredIcons";
import type { Metadata } from "./api";

type Data = Record<string, any>;
export default function AdminEntityManager({ metadata, onBack }: { metadata: Metadata; onBack: () => void }) {
  const [liveMetadata, setLiveMetadata] = useState(metadata);
  const [scope, setScope] = useState("");
  const [scopeSearch, setScopeSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [data, setData] = useState<Data>({});
  const [originalData, setOriginalData] = useState<Data>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [labelSingularEdited, setLabelSingularEdited] = useState(false);
  const [labelPluralEdited, setLabelPluralEdited] = useState(false);
  const [exportData, setExportData] = useState<Data>(() => { try { return JSON.parse(localStorage.getItem("espo-custom-export-manifest") || "{}"); } catch { return {}; } });
  const scopes = useMemo(() => Object.keys(liveMetadata.scopes || {}).filter((name) => liveMetadata.scopes[name].entity).sort((a, b) => entityLabel(liveMetadata, a, true).localeCompare(entityLabel(liveMetadata, b, true), "cs")), [liveMetadata]);
  const templates = liveMetadata.app?.entityTemplateList || [];
  const hasUnsavedChanges = JSON.stringify(data) !== JSON.stringify(originalData);
  function confirmDiscardChanges() { return !hasUnsavedChanges || window.confirm("Máte neuložené změny nastavení entity. Opravdu je chcete zahodit?"); }
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);
  const selectedScope = liveMetadata.scopes[scope] || {};
  const hasColorField = !Boolean(liveMetadata.appSettings?.scopeColorsDisabled);
  const customScopes = scopes.filter((name) => liveMetadata.scopes[name].isCustom);
  const standardScopes = scopes.filter((name) => !liveMetadata.scopes[name].isCustom);
  const normalizedScopeSearch = scopeSearch.trim().toLocaleLowerCase("cs");
  const matchesScope = (name: string) => !normalizedScopeSearch || [name, liveMetadata.labels?.Global?.scopeNames?.[name], liveMetadata.labels?.Global?.scopeNamesPlural?.[name]].some((value) => String(value || "").toLocaleLowerCase("cs").includes(normalizedScopeSearch));
  const visibleCustomScopes = customScopes.filter(matchesScope);
  const visibleStandardScopes = standardScopes.filter(matchesScope);
  const entityFields = liveMetadata.entityDefs[scope]?.fields || {};
  const sortableFields = Object.keys(entityFields).filter((name) => !entityFields[name].disabled && !entityFields[name].orderDisabled && !liveMetadata.fields?.[entityFields[name].type || ""]?.orderDisabled).sort((a, b) => fieldLabel(a, entityFields[a], scope, liveMetadata).localeCompare(fieldLabel(b, entityFields[b], scope, liveMetadata), "cs"));
  const enumFields = Object.keys(entityFields).filter((name) => entityFields[name].type === "enum" && !entityFields[name].disabled).sort((a, b) => fieldLabel(a, entityFields[a], scope, liveMetadata).localeCompare(fieldLabel(b, entityFields[b], scope, liveMetadata), "cs"));
  const textFilterFields = Object.keys(entityFields).filter((name) => !entityFields[name].disabled && liveMetadata.fields?.[entityFields[name].type || ""]?.textFilter && !entityFields[name].textFilterDisabled);
  const entityLinks = liveMetadata.entityDefs[scope]?.links || {};
  for (const [link, def] of Object.entries(entityLinks)) {
    if (def.type !== "belongsTo" || !def.entity || def.entity === "Attachment") continue;
    for (const [foreignName, foreignDef] of Object.entries(liveMetadata.entityDefs[def.entity]?.fields || {})) {
      if (!liveMetadata.fields?.[foreignDef.type || ""]?.textFilter || foreignDef.textFilterDisabled) continue;
      textFilterFields.push(`${link}.${foreignName}`);
    }
  }
  textFilterFields.unshift("id");
  const managerParamDefs = useMemo(() => {
    if (!scope || creating) return {} as Data;
    const params = (liveMetadata.app?.entityManagerParams || {}) as Data;
    const type = liveMetadata.scopes[scope]?.type || "Base";
    return { ...(params.Global || {}), ...(params[`@${type}`] || {}), ...(params[scope] || {}) } as Data;
  }, [scope, creating, liveMetadata]);
  const editable = Boolean(creating || (selectedScope.customizable && selectedScope.entityManager?.edit !== false));
  const availableIconClasses = useMemo(() => [...new Set([
    ...espoIconClasses,
    ...((liveMetadata.app as any)?.clientIcons?.classList || []),
  ])].filter((item): item is string => typeof item === "string" && /^(fas|far|fab) fa-[a-z0-9-]+$/.test(item)), [liveMetadata]);
  const normalizedIconQuery = iconQuery.trim().toLocaleLowerCase("cs");
  const iconMatches = availableIconClasses.filter((item) => item.toLocaleLowerCase("cs").includes(normalizedIconQuery));
  const filteredModuleIcons = normalizedIconQuery ? iconMatches.slice(0, 160) : featuredIconClasses.filter((item) => availableIconClasses.includes(item));
  const currentTextFilterFields = liveMetadata.entityDefs[scope]?.collection?.textFilterFields as string[] | undefined;
  const primaryFilters = !creating && scope ? (liveMetadata.clientDefs?.[scope]?.filterList || []).map((item: any) => typeof item === "object" && item.name ? item.name : String(item)) : [];
  if (!creating && scope && liveMetadata.scopes[scope]?.stars) primaryFilters.unshift("starred");

  useEffect(() => {
    if (!creating && scope) {
      const scopeData = liveMetadata.scopes[scope] || {};
      const entityDefs = liveMetadata.entityDefs[scope] || {};
      const templateType = scopeData.type || "Base";
      const managerParams = (liveMetadata.app?.entityManagerParams || {}) as Data;
      const additionalParams = { ...(managerParams.Global || {}), ...(managerParams[`@${templateType}`] || {}), ...(managerParams[scope] || {}) } as Data;
      const additionalData = Object.fromEntries(Object.entries(additionalParams).map(([name, definition]) => {
        const location = definition.location || "scopes";
        const actualParam = definition.param || name;
        const value = (liveMetadata as any)[location]?.[scope]?.[actualParam];
        return [name, value ?? definition.fieldDefs?.default ?? (definition.fieldDefs?.type === "bool" ? false : definition.fieldDefs?.type === "multiEnum" ? [] : "")];
      }));
      const currentData = {
        name: scope,
        labelSingular: liveMetadata.labels?.Global?.scopeNames?.[scope] || scope,
        labelPlural: liveMetadata.labels?.Global?.scopeNamesPlural?.[scope] || `${scope}s`,
        type: scopeData.type || "Base",
        stream: Boolean(scopeData.stream), disabled: Boolean(scopeData.disabled),
        sortBy: entityDefs.collection?.orderBy || "createdAt", sortDirection: entityDefs.collection?.order || "desc",
        fullTextSearch: Boolean(entityDefs.collection?.fullTextSearch), countDisabled: Boolean(entityDefs.collection?.countDisabled),
        kanbanViewMode: Boolean(liveMetadata.clientDefs?.[scope]?.kanbanViewMode),
        statusField: scopeData.statusField || "", kanbanStatusIgnoreList: scopeData.kanbanStatusIgnoreList || [],
        ...(hasColorField ? { color: liveMetadata.clientDefs?.[scope]?.color || "" } : {}), iconClass: liveMetadata.clientDefs?.[scope]?.iconClass || "",
        textFilterFields: currentTextFilterFields || ["name"], ...additionalData,
      };
      setData(currentData); setOriginalData(currentData);
    }
  }, [scope, creating, liveMetadata, currentTextFilterFields, hasColorField]);

  function startCreate() { if (!confirmDiscardChanges()) return; setScope(""); setCreating(true); setLabelSingularEdited(false); setLabelPluralEdited(false); setError(""); setNotice(""); const initial = { name: "", labelSingular: "", labelPlural: "", type: templates[0] || "Base", stream: false, disabled: false }; setData(initial); setOriginalData(initial); }
  function updateEntityName(rawValue: string) {
    const suggestedSingular = rawValue.charAt(0).toLocaleUpperCase("cs") + rawValue.slice(1);
    let technicalName = suggestedSingular.replace(/[-_]/g, " ").replace(/[^\w\s]/g, "").replace(/ (.)/g, (_match, char: string) => char.toLocaleUpperCase("cs")).replace(" ", "");
    if (technicalName) technicalName = technicalName.charAt(0).toLocaleUpperCase("cs") + technicalName.slice(1);
    const suggestedPlural = suggestedSingular.endsWith("y") ? `${suggestedSingular.slice(0, -1)}ies` : suggestedSingular.endsWith("s") ? `${suggestedSingular}es` : `${suggestedSingular}s`;
    setData((old) => ({ ...old, name: technicalName, labelSingular: labelSingularEdited ? old.labelSingular : suggestedSingular, labelPlural: labelPluralEdited ? old.labelPlural : suggestedPlural }));
  }
  function update(key: string, value: any) { setData((old) => ({ ...old, [key]: value })); }
  async function copyPrimaryFilter(name: string) {
    try { await navigator.clipboard.writeText(`#${scope}/list/primaryFilter=${name}`); setNotice(`Odkaz na filtr „${(liveMetadata.labels as any)?.[scope]?.presetFilters?.[name] || name}“ byl zkopírován.`); }
    catch { setError("Odkaz se nepodařilo zkopírovat. Zkontrolujte oprávnění schránky v prohlížeči."); }
  }
  async function save() {
    if (!creating) {
      for (const [name, definition] of Object.entries(managerParamDefs)) {
        const fieldDef = definition.fieldDefs || {};
        const value = data[name];
        if (fieldDef.required && (value == null || value === "" || Array.isArray(value) && !value.length)) {
          setError(`${name.replace(/([A-Z])/g, " $1").replace(/^./, (char: string) => char.toUpperCase())}: vyberte alespoň jednu možnost.`);
          return;
        }
        if (["int", "float"].includes(fieldDef.type) && value != null && value !== "") {
          const number = Number(value);
          if (!Number.isFinite(number) || fieldDef.min != null && number < Number(fieldDef.min) || fieldDef.max != null && number > Number(fieldDef.max)) {
            setError(`${name}: zadejte číslo v povoleném rozsahu.`);
            return;
          }
        }
        if (["jsonObject", "jsonArray"].includes(fieldDef.type) && typeof value === "string" && value.trim()) {
          try { JSON.parse(value); } catch { setError(`${name}: zadejte platný JSON.`); return; }
        }
      }
    }
    setBusy(true); setError(""); setNotice("");
    const payload: Data = { ...data };
    if (!creating) {
      payload.textFilterFields = data.textFilterFields || [];
      payload.sortDirection = data.sortDirection || "asc";
        payload.statusField = data.statusField || null;
        payload.kanbanStatusIgnoreList = data.kanbanViewMode ? data.kanbanStatusIgnoreList || [] : [];
        for (const [name, definition] of Object.entries(managerParamDefs)) {
          const type = definition.fieldDefs?.type;
          const value = data[name];
          payload[name] = ["int", "float", "enumFloat"].includes(type) && value !== "" && value != null ? Number(value)
            : type === "jsonObject" || type === "jsonArray" ? typeof value === "string" && value.trim() ? JSON.parse(value) : (type === "jsonArray" ? [] : {})
            : value;
        }
    }
    try {
      if (creating) {
        const result = await request<{ name: string }>("EntityManager/action/createEntity", { method: "POST", body: JSON.stringify(payload) });
        const refreshed = await fetchMetadata(); setLiveMetadata(refreshed); setScope(result.name); setCreating(false); setNotice(`Entita ${entityLabel(refreshed, result.name)} byla vytvořena.`);
      } else {
        await request("EntityManager/action/updateEntity", { method: "POST", body: JSON.stringify(payload) });
        setLiveMetadata(await fetchMetadata()); setNotice("Nastavení entity bylo uloženo.");
        if (!originalData.fullTextSearch && payload.fullTextSearch) setRebuildOpen(true);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Entitu se nepodařilo uložit."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirmDiscardChanges() || !scope || !window.confirm(`Odstranit vlastní entitu ${entityLabel(liveMetadata, scope)}? Tato akce odstraní konfiguraci entity.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("EntityManager/action/removeEntity", { method: "POST", body: JSON.stringify({ name: scope }) });
      const refreshed = await fetchMetadata(); setLiveMetadata(refreshed); setScope(""); setNotice("Vlastní entita byla odstraněna.");
    } catch (e) { setError(e instanceof Error ? e.message : "Entitu se nepodařilo odstranit."); }
    finally { setBusy(false); }
  }
  async function resetDefaults() {
    if (!confirmDiscardChanges() || !scope || !window.confirm(`Obnovit výchozí nastavení entity ${entityLabel(liveMetadata, scope)}? Přijdete o její vlastní nastavení řazení, ikon, kanbanu a dalších voleb.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await request("EntityManager/action/resetToDefault", { method: "POST", body: JSON.stringify({ scope }) }); setLiveMetadata(await fetchMetadata()); setNotice("Výchozí nastavení entity bylo obnoveno."); }
    catch (e) { setError(e instanceof Error ? e.message : "Výchozí nastavení se nepodařilo obnovit."); }
    finally { setBusy(false); }
  }
  async function exportCustomizations() {
    setExporting(true); setError(""); setNotice("");
    try {
      const result = await request<{ id: string }>("EntityManager/action/exportCustom", { method: "POST", body: JSON.stringify({ name: exportData.name, module: exportData.module, version: exportData.version, author: exportData.author, description: exportData.description || null }) });
      if (!result.id) throw new Error("EspoCRM nevrátilo soubor exportu.");
      localStorage.setItem("espo-custom-export-manifest", JSON.stringify(exportData));
      await downloadAttachment(result.id, `${String(exportData.module || "Custom").replace(/[^A-Za-z0-9_-]/g, "")}.zip`);
      setExportOpen(false); setNotice("Balíček vlastních úprav EspoCRM byl stažen.");
    } catch (e) { setError(e instanceof Error ? e.message : "Vlastní úpravy se nepodařilo exportovat."); }
    finally { setExporting(false); }
  }
  function renderList(names: string[], title: string) {
    return <><div className="entity-manager-list-heading">{title}<span>{names.length}</span></div>{names.map((name) => <button key={name} className={`entity-manager-scope ${scope === name && !creating ? "active" : ""}`} onClick={() => { if (!confirmDiscardChanges()) return; setCreating(false); setScope(name); setError(""); setNotice(""); }}><span><strong>{entityLabel(liveMetadata, name, true)}</strong><small>{name} · {liveMetadata.scopes[name].type || "Base"}</small></span><i className={liveMetadata.scopes[name].isCustom ? "custom" : ""}>{liveMetadata.scopes[name].isCustom ? "Vlastní" : "Systém"}</i></button>)}</>;
  }

  function parameterChoices(name: string, definition: Data): Array<{ value: string; label: string }> {
    const fieldDef = definition.fieldDefs || {};
    if (name === "duplicateCheckFieldList") return Object.keys(entityFields).filter((field) => !entityFields[field].disabled && ["varchar", "personName", "email", "phone", "url", "barcode"].includes(entityFields[field].type || "")).sort((a, b) => fieldLabel(a, entityFields[a], scope, liveMetadata).localeCompare(fieldLabel(b, entityFields[b], scope, liveMetadata), "cs")).map((field) => ({ value: field, label: fieldLabel(field, entityFields[field], scope, liveMetadata) }));
    if (name === "aclContactLink" || name === "aclAccountLink") {
      const target = name === "aclContactLink" ? "Contact" : "Account";
      return Object.entries(entityLinks).filter(([, link]) => link.entity === target && link.type === "belongsTo").map(([link]) => ({ value: link, label: fieldLabel(link, { type: "link", label: link }, scope, liveMetadata) }));
    }
    if (fieldDef.view === "crm:views/admin/entity-manager/fields/status-list") {
      const statusField = entityFields.status;
      return (statusField?.options || []).map((rawValue: string | number) => { const value = String(rawValue); return { value, label: (liveMetadata.labels as any)?.[scope]?.options?.status?.[value] || value }; });
    }
    return (fieldDef.options || []).map((value: string) => ({ value, label: value }));
  }

  function renderAdditionalParam(name: string, definition: Data) {
    const fieldDef = definition.fieldDefs || {};
    const type = fieldDef.type || "varchar";
    const label = (liveMetadata.labels as any)?.EntityManager?.fields?.[name] || fieldDef.label || name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (char: string) => char.toUpperCase());
    const hint = (liveMetadata.labels as any)?.EntityManager?.tooltips?.[name] || (typeof fieldDef.tooltip === "string" ? fieldDef.tooltip : "");
    const hintNode = hint ? <small className="field-hint">{hint}</small> : null;
    const options = parameterChoices(name, definition);
    const required = Boolean(fieldDef.required);
    const title = <span>{label}{required && <i className="required-mark"> *</i>}</span>;
    if (type === "bool") return <div className="manager-extra-field" key={name}><label className="switch-row manager-extra-toggle"><input type="checkbox" checked={Boolean(data[name])} disabled={!editable || busy} onChange={(event) => update(name, event.target.checked)}/><span>{label}</span></label>{hintNode}</div>;
    if (["enum", "enumFloat"].includes(type)) return <label className="setting-field" key={name}>{title}<select value={data[name] ?? ""} required={required} disabled={!editable || busy} onChange={(event) => update(name, event.target.value)}><option value="">—</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{hintNode}</label>;
    if (["multiEnum", "checklist"].includes(type)) return <div className="manager-extra-multienum" key={name}><strong>{label}{required && <i className="required-mark"> *</i>}</strong>{hintNode}<div>{options.map((item) => { const selected: string[] = Array.isArray(data[name]) ? data[name].map(String) : []; return <label key={item.value}><input type="checkbox" checked={selected.includes(item.value)} disabled={!editable || busy} onChange={(event) => update(name, event.target.checked ? [...new Set([...selected, item.value])] : selected.filter((value: string) => value !== item.value))}/>{item.label}</label>; })}</div>{!options.length && <small className="field-hint">Pro tuto entitu nejsou definované žádné možnosti.</small>}</div>;
    if (["int", "float"].includes(type)) return <label className="setting-field" key={name}>{title}<input type="number" value={data[name] ?? ""} required={required} min={fieldDef.min} max={fieldDef.max} step={type === "int" ? 1 : fieldDef.step || "any"} disabled={!editable || busy} onChange={(event) => update(name, event.target.value === "" ? "" : Number(event.target.value))}/>{hintNode}</label>;
    if (type === "text" || ["array", "jsonObject", "jsonArray"].includes(type)) {
      const value = data[name];
      const shown = ["array"].includes(type) ? (Array.isArray(value) ? value.join("\n") : String(value ?? "")) : ["jsonObject", "jsonArray"].includes(type) && value && typeof value !== "string" ? JSON.stringify(value, null, 2) : String(value ?? "");
      return <label className="setting-field" key={name}>{title}<textarea rows={type === "text" ? 4 : 3} value={shown} required={required} disabled={!editable || busy} onChange={(event) => update(name, type === "array" ? event.target.value.split("\n").filter((item) => item !== "") : event.target.value)} spellCheck={type === "text"}/>{hintNode}</label>;
    }
    const inputType = type === "email" || type === "url" || type === "phone" ? (type === "phone" ? "tel" : type) : type === "date" ? "date" : "text";
    return <label className="setting-field" key={name}>{title}<input type={inputType} value={data[name] ?? ""} required={required} maxLength={fieldDef.maxLength} pattern={fieldDef.pattern} disabled={!editable || busy} onChange={(event) => update(name, event.target.value)}/>{hintNode}</label>;
  }

  const statusOptions = data.statusField ? (entityFields[data.statusField]?.options || []).map(String) : [];

  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={() => { if (confirmDiscardChanges()) onBack(); }}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">PŘIZPŮSOBENÍ CRM</div><h1>Správce entit</h1><p>Upravujte vlastnosti modulů, jejich chování a rozšíření.</p></div><div className="entity-manager-heading-actions"><button className="button subtle" onClick={() => setExportOpen(true)} disabled={busy}><FileInput size={14}/> Exportovat úpravy</button><button className="button primary" onClick={startCreate} disabled={busy || !templates.length}><Plus size={15}/> Nová entita</button></div></div>
    {error && <div className="table-error">{error}<button onClick={() => setError("")}>Zavřít</button></div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <div className="entity-manager-layout"><aside className="surface entity-manager-sidebar"><div className="entity-manager-search"><Search size={14} aria-hidden="true"/><input type="search" value={scopeSearch} onChange={(event) => setScopeSearch(event.target.value)} placeholder="Hledat entity…" aria-label="Hledat entity podle názvu"/>{scopeSearch && <button type="button" className="icon-button" onClick={() => setScopeSearch("")} aria-label="Vymazat hledání entit"><X size={13}/></button>}</div>{renderList(visibleCustomScopes, "VLASTNÍ ENTITY")}{renderList(visibleStandardScopes, "SYSTÉMOVÉ ENTITY")}{normalizedScopeSearch && !visibleCustomScopes.length && !visibleStandardScopes.length && <div className="entity-manager-search-empty">Žádná entita neodpovídá „{scopeSearch.trim()}“.</div>}</aside>
      <section className="surface entity-manager-editor">{creating || scope ? <><div className="settings-card-head"><h2>{creating ? "Vytvořit vlastní entitu" : data.labelSingular || entityLabel(liveMetadata, scope)}</h2><p>{creating ? "Zvolte šablonu a vlastnosti nového modulu." : `${scope} · ${selectedScope.isCustom ? "vlastní entita" : "systémová entita"}${editable ? "" : " · pouze pro čtení"}`}</p></div>
        {!creating && <div className="entity-filter-fields entity-manager-primary-filters"><strong>Výchozí filtry entity</strong>{primaryFilters.length ? <div>{primaryFilters.map((name: string) => <div className="entity-manager-primary-filter" key={name}><span><b>{(liveMetadata.labels as any)?.[scope]?.presetFilters?.[name] || (name === "starred" ? "Oblíbené" : name)}</b><small>{name}</small></span><button type="button" className="button subtle" onClick={() => void copyPrimaryFilter(name)}><Copy size={13}/> Kopírovat odkaz</button></div>)}</div> : <p>Pro tuto entitu nejsou definované žádné výchozí filtry.</p>}</div>}
        <div className="settings-fields entity-manager-fields"><label className="setting-field"><span>Interní název</span><input value={data.name || ""} disabled={!creating || busy} required pattern="[A-Za-z][A-Za-z0-9]*" onChange={(event) => updateEntityName(event.target.value)} placeholder="Projekt"/><small>{creating ? "Název se průběžně vyčistí pro technické použití a navrhne popisky entity; můžete je potom upravit." : "Technický název entity."}</small></label>
          {creating && <label className="setting-field"><span>Šablona entity</span><select value={data.type || ""} onChange={(event) => update("type", event.target.value)}>{templates.map((type: string) => <option key={type} value={type}>{type}</option>)}</select></label>}
          <label className="setting-field"><span>Jednotné číslo</span><input value={data.labelSingular || ""} disabled={!editable || busy} required onChange={(event) => { setLabelSingularEdited(true); update("labelSingular", event.target.value); }}/></label><label className="setting-field"><span>Množné číslo</span><input value={data.labelPlural || ""} disabled={!editable || busy} required onChange={(event) => { setLabelPluralEdited(true); update("labelPlural", event.target.value); }}/></label>
          <div className="setting-field manager-icon-setting"><span>Ikona modulu</span><button type="button" className="manager-icon-current" onClick={() => setIconPickerOpen((value) => !value)} disabled={!editable || busy}><span><EspoIcon className={data.iconClass || "fas fa-building"} size={19}/></span><b>{data.iconClass || "fas fa-building"}</b><small>{iconPickerOpen ? "Zavřít výběr" : "Vybrat ikonu"}</small></button>{iconPickerOpen && <div className="manager-icon-picker"><input aria-label="Hledat ikonu" placeholder="Hledejte ikonu podle názvu…" value={iconQuery} onChange={(event) => setIconQuery(event.target.value)}/><small className="manager-icon-count">{normalizedIconQuery ? `${Math.min(iconMatches.length, 160)} z ${iconMatches.length} odpovídajících ikon` : `Doporučené ikony · ${availableIconClasses.length} ikon dostupných`}</small><div>{filteredModuleIcons.map((iconClass) => { const label = iconClass.replace(/^(fas|far|fab) fa-/, ""); const active = data.iconClass === iconClass; return <button type="button" key={iconClass} className={active ? "active" : ""} title={iconClass} aria-label={iconClass} onClick={() => { update("iconClass", iconClass); setIconPickerOpen(false); setIconQuery(""); }}><EspoIcon className={iconClass} size={18}/><small>{label}</small></button>; })}</div>{normalizedIconQuery && iconMatches.length > 160 && <small className="manager-icon-count">Zpřesněte hledání pro zobrazení dalších výsledků.</small>}</div>}<input className="manager-icon-class" value={data.iconClass || ""} disabled={!editable || busy} onChange={(event) => update("iconClass", event.target.value)} placeholder="Font Awesome třída dle EspoCRM (např. fas fa-building)"/><small>Náhled používá stejnou ikonu jako EspoCRM; lze zadat libovolnou Font Awesome třídu podporovanou instalací.</small></div>
          {hasColorField && <label className="setting-field"><span>Barva modulu</span><input type="color" disabled={!editable || busy} value={data.color || "#675fce"} onChange={(event) => update("color", event.target.value)}/></label>}
          {!creating && <><label className="setting-field"><span>Výchozí řazení</span><select disabled={!editable || busy} value={data.sortBy || "createdAt"} onChange={(event) => update("sortBy", event.target.value)}>{sortableFields.map((field) => <option key={field} value={field}>{fieldLabel(field, entityFields[field], scope, liveMetadata)}</option>)}</select></label><label className="setting-field"><span>Směr řazení</span><select disabled={!editable || busy} value={data.sortDirection || "asc"} onChange={(event) => update("sortDirection", event.target.value)}><option value="asc">Vzestupně</option><option value="desc">Sestupně</option></select></label>
            <label className="setting-field"><span>Statusové pole</span><select disabled={!editable || busy || selectedScope.statusFieldLocked} value={data.statusField || ""} onChange={(event) => { update("statusField", event.target.value); update("kanbanStatusIgnoreList", []); }}><option value="">Bez stavového pole</option>{enumFields.map((field) => <option key={field} value={field}>{fieldLabel(field, entityFields[field], scope, liveMetadata)}</option>)}</select></label></>}
        </div>
        <div className="entity-manager-toggles">{!creating && editable && <label className="switch-row"><input type="checkbox" checked={Boolean(data.disabled)} onChange={(event) => update("disabled", event.target.checked)}/><span>Modul je deaktivovaný</span></label>}{(creating || selectedScope.customizable && Boolean(liveMetadata.entityDefs[scope]?.object)) && scope !== "User" && <label className="switch-row"><input type="checkbox" checked={Boolean(data.stream)} disabled={!editable || busy} onChange={(event) => update("stream", event.target.checked)}/><span>Povolit stream</span></label>}{!creating && <><label className="switch-row"><input type="checkbox" checked={Boolean(data.fullTextSearch)} disabled={!editable || busy} onChange={(event) => update("fullTextSearch", event.target.checked)}/><span>Plnotextové vyhledávání</span></label><label className="switch-row"><input type="checkbox" checked={Boolean(data.countDisabled)} disabled={!editable || busy} onChange={(event) => update("countDisabled", event.target.checked)}/><span>Skrýt počty záznamů</span></label>{Boolean(data.statusField) && <label className="switch-row"><input type="checkbox" checked={Boolean(data.kanbanViewMode)} disabled={!editable || busy} onChange={(event) => update("kanbanViewMode", event.target.checked)}/><span>Povolit Kanban</span></label>}</>}</div>
        {!creating && Boolean(data.statusField && data.kanbanViewMode) && <div className="entity-filter-fields"><strong>Stavy skryté v Kanbanu</strong><div>{statusOptions.map((value: string) => <label key={value}><input type="checkbox" checked={(data.kanbanStatusIgnoreList || []).includes(value)} disabled={!editable || busy} onChange={(event) => update("kanbanStatusIgnoreList", event.target.checked ? [...new Set([...(data.kanbanStatusIgnoreList || []), value])] : (data.kanbanStatusIgnoreList || []).filter((item: string) => item !== value))}/>{(liveMetadata.labels as any)?.[scope]?.options?.[data.statusField]?.[value] || value}</label>)}</div></div>}
        {!creating && textFilterFields.length > 0 && <div className="entity-filter-fields"><strong>Pole a vztahy pro textové vyhledávání</strong><div>{textFilterFields.map((name) => <label key={name}><input type="checkbox" checked={(data.textFilterFields || []).includes(name)} disabled={!editable || busy} onChange={(event) => update("textFilterFields", event.target.checked ? [...new Set([...(data.textFilterFields || []), name])] : (data.textFilterFields || []).filter((item: string) => item !== name))}/>{name.includes(".") ? name.split(".").map((part, index) => index ? fieldLabel(part, liveMetadata.entityDefs[entityLinks[name.split(".")[0]]?.entity || ""]?.fields?.[part], entityLinks[name.split(".")[0]]?.entity || "", liveMetadata) : fieldLabel(part, { type: "link", label: part }, scope, liveMetadata)).join(" · ") : fieldLabel(name, entityFields[name], scope, liveMetadata)}</label>)}</div></div>}
        {Object.keys(managerParamDefs).length > 0 && <><div className="settings-card-head entity-manager-param-heading"><h2>Další nastavení</h2><p>Volby podle šablony entity a rozšíření v této instalaci.</p></div><div className="settings-fields entity-manager-fields entity-manager-params">{Object.entries(managerParamDefs).map(([name, definition]) => renderAdditionalParam(name, definition))}</div></>}
        <div className="field-manager-actions">{editable && <button className="button primary" onClick={() => void save()} disabled={busy}>{busy ? "Ukládám…" : <><Save size={14}/> {creating ? "Vytvořit entitu" : "Uložit změny"}</>}</button>}{!creating && selectedScope.customizable && (selectedScope.entityManager as any)?.formula !== false && <button className="button subtle" onClick={() => setFormulaOpen(true)} disabled={busy}><FileInput size={14}/> Formula skripty</button>}{!creating && editable && !selectedScope.isCustom && <button className="button subtle" onClick={() => void resetDefaults()} disabled={busy}>Obnovit výchozí nastavení</button>}{!creating && editable && selectedScope.isCustom && !selectedScope.isNotRemovable && <button className="button danger" onClick={() => void remove()} disabled={busy}><Trash2 size={14}/> Odstranit entitu</button>}</div>
      </> : <div className="field-manager-placeholder"><span><Save size={20}/></span><h2>Vyberte entitu</h2><p>Upravte její nastavení, nebo založte vlastní modul.</p></div>}</section>
    </div>
    {exportOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !exporting && setExportOpen(false)}><section className="record-modal entity-export-modal"><div className="modal-heading"><div><span className="eyebrow">DISTRIBUCE VLASTNÍCH ÚPRAV</span><h2>Exportovat rozšíření EspoCRM</h2><p>Vytvořte instalovatelný ZIP balíček vlastních polí, entit, rozložení a dalších změn.</p></div><button className="icon-button" onClick={() => setExportOpen(false)} disabled={exporting} aria-label="Zavřít"><X size={16}/></button></div><div className="settings-fields entity-export-fields"><label className="setting-field"><span>Název balíčku</span><input value={exportData.name || ""} onChange={(event) => setExportData((old: Data) => ({ ...old, name: event.target.value }))} required pattern="[A-Za-z0-9 ]+"/></label><label className="setting-field"><span>Název modulu</span><input value={exportData.module || ""} onChange={(event) => setExportData((old: Data) => ({ ...old, module: event.target.value }))} required pattern="[A-Z][a-z][A-Za-z]+" placeholder="AcmeCrm"/></label><label className="setting-field"><span>Verze</span><input value={exportData.version || "0.0.1"} onChange={(event) => setExportData((old: Data) => ({ ...old, version: event.target.value }))} required pattern="[0-9]+\.[0-9]+\.[0-9]+"/></label><label className="setting-field"><span>Autor</span><input value={exportData.author || ""} onChange={(event) => setExportData((old: Data) => ({ ...old, author: event.target.value }))} required/></label><label className="setting-field entity-export-description"><span>Popis</span><textarea rows={3} value={exportData.description || ""} onChange={(event) => setExportData((old: Data) => ({ ...old, description: event.target.value }))}/></label></div><div className="modal-footer"><button className="button subtle" onClick={() => setExportOpen(false)} disabled={exporting}>Zrušit</button><button className="button primary" onClick={() => void exportCustomizations()} disabled={exporting || !String(exportData.name || "").trim() || !/^[A-Z][a-z][A-Za-z]+$/.test(String(exportData.module || "")) || !/^\d+\.\d+\.\d+$/.test(String(exportData.version || "")) || !String(exportData.author || "").trim()}>{exporting ? "Vytvářím balíček…" : <><FileInput size={14}/> Vytvořit a stáhnout ZIP</>}</button></div></section></div>}
    {rebuildOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setRebuildOpen(false)}><section className="record-modal entity-export-modal" role="dialog" aria-modal="true" aria-labelledby="entity-rebuild-title"><div className="modal-heading"><div><span className="eyebrow">DOKONČENÍ NASTAVENÍ</span><h2 id="entity-rebuild-title">Je potřeba obnovit fulltextový index</h2><p>Plnotextové vyhledávání se začne používat po přegenerování metadat a indexů EspoCRM.</p></div><button className="icon-button" onClick={() => setRebuildOpen(false)} aria-label="Zavřít"><X size={16}/></button></div><div className="settings-fields"><div className="setting-field"><span>V terminálu na serveru spusťte</span><code>php rebuild.php</code><small>Spusťte příkaz z kořenové složky instalace EspoCRM. Do dokončení obnovy nemusí být nové vyhledávání dostupné.</small></div></div><div className="modal-footer"><button className="button subtle" onClick={() => { void navigator.clipboard?.writeText("php rebuild.php").then(() => setNotice("Příkaz php rebuild.php byl zkopírován.")); }}><Copy size={14}/> Kopírovat příkaz</button><button className="button primary" onClick={() => setRebuildOpen(false)}>Rozumím</button></div></section></div>}
    {formulaOpen && <AdminEntityFormula metadata={liveMetadata} entity={scope} onClose={() => setFormulaOpen(false)}/>}
  </div>;
}
