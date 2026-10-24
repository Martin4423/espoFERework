import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Plus, RotateCcw, Save, Search, Trash2 } from "./Icons";
import { DynamicLogicEditor, DynamicOptionsEditor } from "./DynamicLogicEditor";
import { entityLabel, fieldLabel, fetchMetadata, request } from "./api";
import SelectRecordsDialog from "./SelectRecordsDialog";
import type { Metadata } from "./api";

type Data = Record<string, any>;

/** Espo's administration field manager, backed by the native FieldManager API. */
export default function AdminFieldManager({ metadata, onBack }: { metadata: Metadata; onBack: () => void }) {
  const [liveMetadata, setLiveMetadata] = useState(metadata);
  const scopes = useMemo(() => Object.keys(liveMetadata.scopes).filter((scope) => liveMetadata.scopes[scope].entity && liveMetadata.scopes[scope].customizable && liveMetadata.scopes[scope].entityManager?.fields !== false).sort((a, b) => entityLabel(liveMetadata, a, true).localeCompare(entityLabel(liveMetadata, b, true), "cs")), [liveMetadata]);
  const [scope, setScope] = useState(scopes[0] || "");
  const [fieldName, setFieldName] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [field, setField] = useState<Data | null>(null);
  const [creating, setCreating] = useState(false);
  const [createType, setCreateType] = useState("varchar");
  const [paramDraft, setParamDraft] = useState<Record<string, string>>({});
  const [defaultRecordPicker, setDefaultRecordPicker] = useState<{ entity: string; multiple: boolean } | null>(null);
  const [data, setData] = useState<Data>({});
  const [originalData, setOriginalData] = useState<Data>({});
  const [dynamicLogic, setDynamicLogic] = useState<Data>({});
  const [originalDynamicLogic, setOriginalDynamicLogic] = useState<Data>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fields = liveMetadata.entityDefs[scope]?.fields || {};
  const fieldList = Object.entries(fields).sort(([a], [b]) => fieldLabel(a, fields[a], scope, liveMetadata).localeCompare(fieldLabel(b, fields[b], scope, liveMetadata), "cs"));
  const visibleFieldList = fieldList.filter(([name]) => !fieldSearch.trim() || `${name} ${fieldLabel(name, fields[name], scope, liveMetadata)}`.toLocaleLowerCase("cs").includes(fieldSearch.trim().toLocaleLowerCase("cs")));
  const customFieldCount = fieldList.filter(([, definition]) => Boolean(definition.isCustom)).length;
  const hasUnsavedChanges = creating ? JSON.stringify(data) !== JSON.stringify(originalData) || JSON.stringify(dynamicLogic) !== JSON.stringify(originalDynamicLogic) : Boolean(field && (JSON.stringify(data) !== JSON.stringify(originalData) || JSON.stringify(dynamicLogic) !== JSON.stringify(originalDynamicLogic)));
  function confirmDiscardChanges() { return !hasUnsavedChanges || window.confirm("Máte neuložené změny v editoru pole. Opravdu je chcete zahodit?"); }
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);
  const typeList = Object.keys(liveMetadata.fields || {}).filter((type) => !liveMetadata.fields?.[type]?.notCreatable).sort((a, b) => a.localeCompare(b));
  const rawParamDefs = liveMetadata.fields?.[creating ? createType : field?.type || "varchar"]?.params || [];
  const savedLogic = liveMetadata.logicDefs?.[scope] || {};
  const fieldLogic = fieldName ? savedLogic.fields?.[fieldName] || {} : {};
  const nativeFieldDefs = fieldName ? liveMetadata.entityDefs?.[scope]?.fields?.[fieldName] || {} : {};
  const listedParams = nativeFieldDefs.fieldManagerParamList || field?.fieldManagerParamList;
  const globalRestrictions = (liveMetadata as any).entityAcl?.[scope]?.fields?.[fieldName] || {};
  const effectiveType = creating ? createType : field?.type || "";
  const baseParamDefs = rawParamDefs.filter((param) => (!listedParams || listedParams.includes(param.name)) && !nativeFieldDefs[`customization${param.name.charAt(0).toUpperCase()}${param.name.slice(1)}Disabled`] && !(globalRestrictions.readOnly && param.name === "required") && !(param.name === "createButton" && ["assignedUser", "assignedUsers", "teams", "collaborators"].includes(fieldName)) && !(param.name === "autocompleteOnEmpty" && fieldName === "assignedUser"));
  const extraParamDefs = (nativeFieldDefs.fieldManagerAdditionalParamList || field?.fieldManagerAdditionalParamList || []).map((item: Data) => ({ ...item, type: item.view === "views/admin/field-manager/fields/not-actual-options" ? "multiEnum" : item.view === "crm:views/opportunity/admin/field-manager/fields/probability-map" ? "jsonObject" : item.type || effectiveType || "varchar" }));
  if (effectiveType && !["foreign", "autoincrement"].includes(effectiveType) && !nativeFieldDefs.customizationInlineEditDisabledDisabled && !nativeFieldDefs.customizationDisabled) extraParamDefs.push({ name: "inlineEditDisabled", type: "bool" });
  const hasPersonalData = Boolean((liveMetadata.scopes[scope] as any)?.hasPersonalData && (liveMetadata.fields?.[effectiveType] as any)?.personalData);
  if (hasPersonalData) extraParamDefs.push({ name: "isPersonalData", type: "bool" });
  const hasTooltip = !nativeFieldDefs.customizationTooltipTextDisabled && !nativeFieldDefs.customizationDisabled;
  if (hasTooltip) extraParamDefs.push({ name: "tooltipText", type: "text", rowsMin: 2 });
  const paramDefs = nativeFieldDefs.customizationDisabled || globalRestrictions.forbidden ? [] : [...baseParamDefs, ...extraParamDefs.filter((param: Data) => !baseParamDefs.some((base) => base.name === param.name))];
  const canAddField = liveMetadata.scopes[scope]?.entityManager?.addField !== false;
  const canEditField = Boolean(liveMetadata.scopes[scope]?.customizable && liveMetadata.scopes[scope]?.entityManager?.fields !== false && !nativeFieldDefs.customizationDisabled);
  const supportsLogic = Boolean(field && canEditField && !creating && !nativeFieldDefs.disabled && !nativeFieldDefs.utility && !nativeFieldDefs.dynamicLogicDisabled && !nativeFieldDefs.layoutDetailDisabled);
  const typeIsReadOnly = Boolean(liveMetadata.fields?.[field?.type || ""]?.readOnly || nativeFieldDefs.readOnly);
  const canEditLogicRequired = supportsLogic && !typeIsReadOnly && !data.readOnly && paramDefs.some((param) => param.name === "required") && !nativeFieldDefs.dynamicLogicRequiredDisabled;
  const canEditLogicReadOnly = supportsLogic && !typeIsReadOnly && !data.readOnly && !nativeFieldDefs.dynamicLogicReadOnlyDisabled;
  const canEditLogicInvalid = supportsLogic && !typeIsReadOnly && !data.readOnly && !nativeFieldDefs.dynamicLogicInvalidDisabled;
  const canEditLogicOptions = supportsLogic && !data.readOnly && Boolean(liveMetadata.fields?.[field?.type || ""]?.dynamicLogicOptions) && !nativeFieldDefs.dynamicLogicOptionsDisabled;
  const canEditLogicReadOnlySaved = supportsLogic && !typeIsReadOnly && !data.readOnly && !nativeFieldDefs.dynamicLogicReadOnlySavedDisabled;

  useEffect(() => { if (!scopes.includes(scope) && scopes[0]) setScope(scopes[0]); }, [scopes, scope]);
  useEffect(() => { setFieldName(""); setFieldSearch(""); setField(null); setData({}); setOriginalData({}); setDynamicLogic({}); setOriginalDynamicLogic({}); setCreating(false); setError(""); }, [scope]);
  useEffect(() => {
    if (!fieldName || creating) { setField(null); return; }
    let live = true;
    setBusy(true); setError("");
    request<Data>(`Admin/fieldManager/${encodeURIComponent(scope)}/${encodeURIComponent(fieldName)}`).then((result) => { if (live) { const next = { ...result, label: result.label || fieldLabel(fieldName, liveMetadata.entityDefs?.[scope]?.fields?.[fieldName], scope, liveMetadata), tooltipText: result.tooltipText ?? (liveMetadata.labels as any)?.[scope]?.tooltips?.[fieldName] ?? "" }; setField(result); setData(next); setOriginalData(next); } }).catch((e) => live && setError(e instanceof Error ? e.message : "Pole se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [scope, fieldName, creating]);
  useEffect(() => {
    if (!fieldName || creating) { setDynamicLogic({}); return; }
    const optionsLogic = savedLogic.options?.[fieldName];
    const logicState = {
      dynamicLogicVisible: nativeFieldDefs.dynamicLogicVisibleDisabled ? undefined : fieldLogic.visible ?? null,
      dynamicLogicRequired: nativeFieldDefs.dynamicLogicRequiredDisabled ? undefined : fieldLogic.required ?? null,
      dynamicLogicReadOnly: nativeFieldDefs.dynamicLogicReadOnlyDisabled ? undefined : fieldLogic.readOnly ?? null,
      dynamicLogicInvalid: nativeFieldDefs.dynamicLogicInvalidDisabled ? undefined : fieldLogic.invalid ?? null,
      dynamicLogicReadOnlySaved: nativeFieldDefs.dynamicLogicReadOnlySavedDisabled ? undefined : fieldLogic.readOnlySaved ?? null,
      dynamicLogicOptions: liveMetadata.fields?.[field?.type || ""]?.dynamicLogicOptions && !nativeFieldDefs.dynamicLogicOptionsDisabled ? optionsLogic || [] : undefined,
    };
    setDynamicLogic(logicState); setOriginalDynamicLogic(logicState);
  }, [scope, fieldName, creating, field?.type, liveMetadata]);

  function newField() {
    if (!confirmDiscardChanges()) return;
    setFieldName(""); setField(null); setError(""); setNotice(""); setCreating(true); setCreateType("varchar");
    const initial = { name: "", label: "", type: "varchar" }; setData(initial); setOriginalData(initial); setDynamicLogic({}); setOriginalDynamicLogic({});
  }
  async function save() {
    if (creating && !/^[a-z][a-zA-Z0-9]*$/.test(String(data.name || ""))) { setError("Interní název musí začínat malým písmenem a obsahovat pouze písmena a číslice."); return; }
    if (!String(data.label || "").trim()) { setError("Zadejte zobrazovaný název pole."); return; }
    for (const param of paramDefs) {
      const value = data[param.name] ?? param.default;
      if (param.required && (value == null || value === "" || Array.isArray(value) && value.length === 0)) { setError(`${fieldLabel(param.name, undefined)} je povinné pole.`); return; }
      if (["int", "float"].includes(param.type || "") && value !== "" && value != null) {
        const number = Number(value);
        if (!Number.isFinite(number) || param.min != null && number < Number(param.min) || param.max != null && number > Number(param.max)) { setError(`${fieldLabel(param.name, undefined)} musí být v povoleném rozsahu${param.min != null || param.max != null ? ` (${param.min ?? "…"}–${param.max ?? "…"})` : ""}.`); return; }
      }
    }
    const defaultParam = paramDefs.find((param) => param.name === "default" && param.view?.includes("options/default"));
    if (defaultParam) {
      const available = optionsForDefault(defaultParam);
      const chosen = data.default;
      const invalid = Array.isArray(chosen) ? chosen.some((item) => !available.includes(String(item))) : chosen != null && chosen !== "" && !available.includes(String(chosen));
      if (invalid) { setError("Výchozí hodnota musí být obsažená v seznamu možností."); return; }
    }
    setBusy(true); setError(""); setNotice("");
    const payload: Data = { ...data, ...dynamicLogic, type: creating ? createType : field?.type };
    if (hasTooltip) payload.tooltip = Boolean(String(payload.tooltipText || "").trim());
    for (const param of paramDefs) {
      const name = param.name;
      if (param.type === "jsonObject" && typeof payload[name] === "string") {
        try { payload[name] = JSON.parse(payload[name]); } catch { setError(`Pole „${fieldLabel(name, undefined)}“ obsahuje neplatný JSON.`); setBusy(false); return; }
      }
      if (payload[name] === undefined && param.default !== undefined) payload[name] = param.default;
      if (Array.isArray(payload[name])) continue;
      if (["multiEnum", "array"].includes(param.type || "") && typeof payload[name] === "string") payload[name] = payload[name].split("\n").map((item: string) => item.trim()).filter(Boolean);
      if (param.type === "bool") payload[name] = Boolean(payload[name]);
      if (param.type === "int" && payload[name] !== "" && payload[name] != null) payload[name] = Number(payload[name]);
    }
    try {
      const base = `Admin/fieldManager/${encodeURIComponent(scope)}`;
      const previousNames = new Set(Object.keys(liveMetadata.entityDefs[scope]?.fields || {}));
      const result = creating
        ? await request<Data>(base, { method: "POST", body: JSON.stringify(payload) })
        : await request<Data>(`${base}/${encodeURIComponent(fieldName)}`, { method: "PATCH", body: JSON.stringify(payload) });
      const refreshedMetadata = await fetchMetadata();
      const nextName = creating
        ? Object.entries(refreshedMetadata.entityDefs[scope]?.fields || {}).find(([name, definition]) => !previousNames.has(name) && (definition as Data).isCustom && (definition as Data).type === payload.type)?.[0] || payload.name
        : fieldName;
      const savedResult = { ...result, label: result.label || payload.label || fieldLabel(nextName, refreshedMetadata.entityDefs?.[scope]?.fields?.[nextName], scope, refreshedMetadata) };
      setCreating(false); setFieldName(nextName); setField(savedResult); setData(savedResult); setOriginalData(savedResult);
      setLiveMetadata(refreshedMetadata);
      setNotice("Pole bylo uloženo a metadata EspoCRM byla přestavěna.");
    } catch (e) { setError(e instanceof Error ? e.message : "Pole se nepodařilo uložit."); }
    finally { setBusy(false); }
  }
  async function removeField() {
    if (!fieldName || !window.confirm(`Opravdu smazat vlastní pole „${field?.label || fieldName}“?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`Admin/fieldManager/${encodeURIComponent(scope)}/${encodeURIComponent(fieldName)}`, { method: "DELETE" });
      setFieldName(""); setField(null); setData({}); setOriginalData({}); setDynamicLogic({}); setOriginalDynamicLogic({}); setLiveMetadata(await fetchMetadata()); setNotice("Vlastní pole bylo odstraněno.");
    } catch (e) { setError(e instanceof Error ? e.message : "Pole se nepodařilo odstranit."); }
    finally { setBusy(false); }
  }
  async function resetFieldDefaults() {
    if (!fieldName || !field || !window.confirm(`Obnovit výchozí konfiguraci pole „${field.label || fieldName}“ z EspoCRM? Vlastní úpravy názvu a parametrů se odstraní.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("FieldManager/action/resetToDefault", { method: "POST", body: JSON.stringify({ scope, name: fieldName }) });
      const [refreshedMetadata, refreshedField] = await Promise.all([fetchMetadata(), request<Data>(`Admin/fieldManager/${encodeURIComponent(scope)}/${encodeURIComponent(fieldName)}`)]);
      const resetData = { ...refreshedField, label: refreshedField.label || fieldLabel(fieldName, refreshedMetadata.entityDefs?.[scope]?.fields?.[fieldName], scope, refreshedMetadata) };
      setLiveMetadata(refreshedMetadata); setField(resetData); setData(resetData); setOriginalData(resetData); setNotice("Výchozí konfigurace systémového pole byla obnovena.");
    } catch (e) { setError(e instanceof Error ? e.message : "Výchozí konfiguraci pole se nepodařilo obnovit."); }
    finally { setBusy(false); }
  }
  function paramOptionList(param: Data): string[] {
    if (Array.isArray(param.options)) return param.options.map(String);
    if (Array.isArray(param.optionsList)) return param.optionsList.map(String);
    if (param.name === "default" && Array.isArray(data.options)) return data.options.map(String);
    if (typeof param.optionsPath === "string") {
      const path = param.optionsPath.split(".");
      let value: any = liveMetadata;
      for (const part of path) value = value?.[part];
      if (Array.isArray(value)) return value.map(String);
    }
    if (param.view === "views/admin/field-manager/fields/pattern") {
      const patterns = ((liveMetadata.app as any)?.regExpPatterns || {}) as Data;
      return Object.keys(patterns).filter((name) => !patterns[name]?.isSystem).map((name) => `$${name}`);
    }
    if (param.view === "views/admin/field-manager/fields/source-list") return (((liveMetadata.entityDefs as any)?.Attachment?.sourceList || []) as string[]).map(String);
    if (param.view === "views/admin/field-manager/fields/text/attachment-field") return Object.entries(fields).filter(([, def]) => def.type === "attachmentMultiple" && !def.disabled && !def.utility).map(([name]) => name).sort((a, b) => fieldLabel(a, fields[a], scope, liveMetadata).localeCompare(fieldLabel(b, fields[b], scope, liveMetadata), "cs"));
    if (param.view === "views/admin/field-manager/fields/phone/default") return (Array.isArray(data.typeList) ? data.typeList : param.options || []).map(String);
    if (param.view === "views/admin/field-manager/fields/entity-list") return Object.keys(liveMetadata.scopes || {}).filter((name) => liveMetadata.scopes[name].object && !liveMetadata.scopes[name].disabled).sort((a, b) => entityLabel(liveMetadata, a, true).localeCompare(entityLabel(liveMetadata, b, true), "cs"));
    if (param.view === "views/admin/field-manager/fields/date/after-before") return Object.entries(fields).filter(([, def]) => ["date", "datetime", "datetimeOptional"].includes(def.type || "")).map(([name]) => name).filter((name) => name !== fieldName).sort((a, b) => fieldLabel(a, fields[a], scope, liveMetadata).localeCompare(fieldLabel(b, fields[b], scope, liveMetadata), "cs"));
    if (param.view === "views/admin/field-manager/fields/foreign/link") return Object.entries(liveMetadata.entityDefs[scope]?.links || {}).filter(([, rawLink]) => { const link = rawLink as any; return ["belongsTo", "hasOne"].includes(link.type || "") && !link.noJoin && !link.disabled && !link.utility; }).map(([name]) => name).sort((a, b) => fieldLabel(a, { type: "link", label: a }, scope, liveMetadata).localeCompare(fieldLabel(b, { type: "link", label: b }, scope, liveMetadata), "cs"));
    if (param.view === "views/admin/field-manager/fields/foreign/field") {
      const linkName = data.link;
      const foreignScope = (liveMetadata.entityDefs[scope]?.links?.[linkName] as any)?.entity;
      const foreignFields = foreignScope ? liveMetadata.entityDefs[foreignScope]?.fields || {} : {};
      const allowedTypes = ((liveMetadata.fields?.foreign as any)?.fieldTypeList || []) as string[];
      return Object.entries(foreignFields).filter(([, def]) => (!allowedTypes.length || allowedTypes.includes(def.type || "")) && !def.disabled && !def.utility && !def.directAccessDisabled && !def.notStorable).map(([name]) => name).sort((a, b) => fieldLabel(a, foreignFields[a], foreignScope, liveMetadata).localeCompare(fieldLabel(b, foreignFields[b], foreignScope, liveMetadata), "cs"));
    }
    if (param.view === "views/admin/field-manager/fields/options-reference") {
      const typeList = ["enum", "multiEnum", "array", "checklist", "varchar"];
      const choices: string[] = [];
      for (const [entity, def] of Object.entries(liveMetadata.entityDefs || {})) {
        if (!liveMetadata.scopes[entity]?.object) continue;
        for (const [name, field] of Object.entries(def.fields || {})) {
          if (entity === scope && name === fieldName) continue;
          if (!typeList.includes(field.type || "") || !Array.isArray(field.options) || field.optionsPath || field.optionsReference) continue;
          choices.push(`${entity}.${name}`);
        }
      }
      return choices.sort((a, b) => {
        const [entityA, fieldA] = a.split(".");
        const [entityB, fieldB] = b.split(".");
        const labelA = `${entityLabel(liveMetadata, entityA)} · ${fieldLabel(fieldA, liveMetadata.entityDefs?.[entityA]?.fields?.[fieldA], entityA, liveMetadata)}`;
        const labelB = `${entityLabel(liveMetadata, entityB)} · ${fieldLabel(fieldB, liveMetadata.entityDefs?.[entityB]?.fields?.[fieldB], entityB, liveMetadata)}`;
        return labelA.localeCompare(labelB, "cs");
      });
    }
    return [];
  }

  function optionsForDefault(param: Data): string[] {
    const reference = String(data.optionsReference || "");
    if (reference) {
      const [entity, name] = reference.split(".");
      const referenced = liveMetadata.entityDefs?.[entity]?.fields?.[name];
      if (Array.isArray(referenced?.options)) return referenced.options.map(String);
    }
    if (param.view === "views/admin/field-manager/fields/currency-default") return ["", ...(((liveMetadata.appSettings as any)?.currencyList || []) as string[])];
    if (Array.isArray(data.options)) return data.options.map(String);
    return paramOptionList(param);
  }

  function optionLabel(value: string, param: Data): string {
    if (!value) return "(výchozí)";
    if (param.translation && param.translation === "FieldManager.options.dateDefault") {
      if (value.includes("getToday")) return "Dnes";
      const shift = value.match(/getDateShiftedFromToday\((\d+), '([^']+)'\)/);
      if (shift) return `Za ${shift[1]} ${shift[2] === "year" ? "rok" : shift[2] === "weeks" ? "týdnů" : shift[2] === "months" ? "měsíců" : "dní"}`;
    }
    if (param.translation && param.translation === "FieldManager.options.dateTimeDefault") {
      if (value.includes("getNow(1)")) return "Aktuální čas";
      if (value.includes("getNow(")) return `Zaokrouhlení na ${value.match(/getNow\((\d+)\)/)?.[1] || ""} min`;
      const shift = value.match(/getDateTimeShiftedFromNow\((\d+), '([^']+)'/);
      if (shift) return `Za ${shift[1]} ${shift[2] === "hours" ? "hodin" : shift[2] === "days" ? "dní" : "týdnů"}`;
    }
    return value;
  }

  function optionTranslationValues(current: Data = data): Data {
    const localized = (liveMetadata.labels as any)?.[scope]?.options?.[fieldName] || {};
    return { ...localized, ...(current.translatedOptions || {}) };
  }

  function renderParameter(param: Data) {
    if (param.hidden) return null;
    const name = param.name as string;
    const type = param.type || "varchar";
    const value = data[name] ?? param.default ?? (["array", "arrayInt", "multiEnum"].includes(type) ? [] : "");
    const options = (() => {
      const list = param.name === "default" && (param.view?.includes("options/default") || nativeFieldDefs.customizationDefaultView === "views/admin/field-manager/fields/currency-default") ? optionsForDefault(param) : paramOptionList(param);
      // Native enum views retain an existing value even when it is no longer in the option list.
      return param.name === "default" && value != null && value !== "" && !list.includes(String(value)) ? [...list, String(value)] : list;
    })();
    const label = fieldLabel(name, undefined);
    const setValue = (next: unknown) => setData((old) => ({ ...old, [name]: next }));
    if (param.view === "views/admin/field-manager/fields/options" || param.view === "views/admin/field-manager/fields/options-with-style") {
      const optionValues: string[] = Array.isArray(value) ? value.map(String) : [];
      const translated = optionTranslationValues();
      const styleMap: Data = data.style || {};
      const addOption = () => { const next = (paramDraft[name] || "").trim(); if (!next || optionValues.includes(next)) return; setValue([...optionValues, next]); setData((old) => ({ ...old, translatedOptions: { ...optionTranslationValues(old), [next]: next } })); setParamDraft((old) => ({ ...old, [name]: "" })); };
      const moveOption = (index: number, offset: number) => { const target = index + offset; if (target < 0 || target >= optionValues.length) return; const next = [...optionValues]; [next[index], next[target]] = [next[target], next[index]]; setValue(next); };
      return <div className="setting-field field-manager-options" key={name}><span>{label}</span>{optionValues.map((option, index) => <div className="field-manager-option-row" key={`${option}-${index}`}><span className="field-manager-option-code">{option}</span><input aria-label={`Překlad volby ${option}`} value={translated[option] ?? option} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} onChange={(event) => setData((old) => ({ ...old, translatedOptions: { ...optionTranslationValues(old), [option]: event.target.value } }))}/>{param.view === "views/admin/field-manager/fields/options-with-style" && <select aria-label={`Styl volby ${option}`} value={styleMap[option] || "default"} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} onChange={(event) => setData((old) => ({ ...old, style: { ...(old.style || {}), [option]: event.target.value === "default" ? null : event.target.value } }))}>{[["default", "Výchozí"], ["primary", "Primární"], ["success", "Úspěch"], ["danger", "Nebezpečí"], ["warning", "Varování"], ["info", "Informace"]].map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select>}<button type="button" className="icon-button" disabled={!canEditField || busy || index === 0} title="Posunout nahoru" onClick={() => moveOption(index, -1)}><ArrowUp size={13}/></button><button type="button" className="icon-button" disabled={!canEditField || busy || index === optionValues.length - 1} title="Posunout dolů" onClick={() => moveOption(index, 1)}><ArrowDown size={13}/></button><button type="button" className="icon-button danger-ghost" disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} title="Odstranit možnost" onClick={() => { setValue(optionValues.filter((_, i) => i !== index)); setData((old) => { const labels = optionTranslationValues(old); const styles = { ...(old.style || {}) }; delete labels[option]; delete styles[option]; return { ...old, translatedOptions: labels, style: styles }; }); }}><Trash2 size={13}/></button></div>)}<div className="field-manager-array-add"><input value={paramDraft[name] || ""} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} maxLength={param.maxItemLength || 100} onChange={(event) => setParamDraft((old) => ({ ...old, [name]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOption(); } }} placeholder="Přidat interní hodnotu…"/><button type="button" className="button subtle" disabled={!canEditField || busy || !paramDraft[name]?.trim()} onClick={addOption}><Plus size={13}/> Přidat</button></div></div>;
    }
    if (param.view === "views/admin/field-manager/fields/not-actual-options") {
      const choices: string[] = Array.isArray(data.options) ? data.options.map(String) : [];
      const selected: string[] = Array.isArray(value) ? value.map(String) : [];
      return <fieldset className="field-manager-multienum" key={name} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)}><legend>{label}</legend>{choices.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => setValue(event.target.checked ? [...new Set([...selected, option])] : selected.filter((item) => item !== option))}/><span>{option}</span></label>)}</fieldset>;
    }
    if (param.view === "crm:views/opportunity/admin/field-manager/fields/probability-map") {
      const map: Data = data.probabilityMap || {};
      const stages: string[] = Array.isArray(data.options) ? data.options.map(String) : [];
      return <div className="setting-field field-manager-probability" key={name}><span>Pravděpodobnost podle fáze</span>{stages.map((stage) => <label key={stage}><span>{stage}</span><input type="number" min="0" max="100" step="1" value={map[stage] ?? 50} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} onChange={(event) => setData((old) => ({ ...old, probabilityMap: { ...(old.probabilityMap || {}), [stage]: event.target.value === "" ? null : Number(event.target.value) } }))}/><i>%</i></label>)}</div>;
    }
    if (param.view === "views/admin/field-manager/fields/options-reference") {
      const options = paramOptionList(param);
      return <label className="setting-field" key={name}><span>{label}</span><select disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} value={value || ""} onChange={(event) => { const selected = event.target.value; const [entity, fieldNameReference] = selected.split("."); const referenced = liveMetadata.entityDefs?.[entity]?.fields?.[fieldNameReference]; setData((old) => ({ ...old, optionsReference: selected || null, ...(referenced ? { options: referenced.options || [], translation: referenced.translation || `${entity}.options.${fieldNameReference}` } : selected ? {} : { translation: null }) })); }}><option value="">Vlastní seznam</option>{options.map((reference) => { const [entity, refField] = reference.split("."); return <option key={reference} value={reference}>{entityLabel(liveMetadata, entity)} · {fieldLabel(refField, liveMetadata.entityDefs?.[entity]?.fields?.[refField], entity, liveMetadata)}</option>; })}</select></label>;
    }
    if (param.view === "views/admin/field-manager/fields/date/after-before") return <label className="setting-field" key={name}><span>{label}</span><select disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} value={value || ""} onChange={(event) => setValue(event.target.value || null)}><option value="">—</option>{options.map((option) => <option key={option} value={option}>{fieldLabel(option, fields[option], scope, liveMetadata)}</option>)}</select></label>;
    if (param.view === "views/admin/field-manager/fields/text/attachment-field") {
      const choices = value && !options.includes(String(value)) ? [String(value), ...options] : options;
      return <label className="setting-field" key={name}><span>{label}</span><select disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} value={value || ""} onChange={(event) => setValue(event.target.value || null)}><option value="">—</option>{choices.map((option) => <option key={option} value={option}>{fieldLabel(option, fields[option], scope, liveMetadata)}</option>)}</select><small className="field-hint">Vyberte pole, které poskytne přílohy pro tento text.</small></label>;
    }
    if (param.view === "views/admin/field-manager/fields/pattern") { const choices = [...new Set(["", ...options, String(value || "")].filter((item) => item || item === ""))]; return <label className="setting-field" key={name}><span>{label}</span><select disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} value={value || ""} onChange={(event) => setValue(event.target.value || null)}><option value="">—</option>{choices.filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
    if (param.name === "default" && nativeFieldDefs.customizationDefaultView === "views/admin/field-manager/fields/currency-default") return <label className="setting-field" key={name}><span>{label}</span><select disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} value={value || ""} onChange={(event) => setValue(event.target.value || null)}><option value="">—</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
    if (param.view === "views/admin/field-manager/fields/foreign/link" || param.view === "views/admin/field-manager/fields/foreign/field") {
      const options = paramOptionList(param);
      return <label className="setting-field" key={name}><span>{label}{param.required && <i className="required-mark"> *</i>}</span><select required={Boolean(param.required)} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} value={value || ""} onChange={(event) => { const next = event.target.value; const target = (liveMetadata.entityDefs[scope]?.links?.[data.link] as any)?.entity; const foreignType = target ? liveMetadata.entityDefs[target]?.fields?.[next]?.type : ""; setData((old) => ({ ...old, [name]: next, ...(param.view === "views/admin/field-manager/fields/foreign/link" ? { field: "" } : {}), ...(param.view === "views/admin/field-manager/fields/foreign/field" && creating ? { view: ((liveMetadata.fields?.foreign as any)?.fieldTypeViewMap || {})[foreignType || ""] || old.view } : {}) })); }}>{paramOptionList(param).length === 0 && <option value="">Nejprve vyberte platnou vazbu</option>}<option value="">—</option>{options.map((option) => <option key={option} value={option}>{param.view.endsWith("/link") ? fieldLabel(option, { type: "link", label: option }, scope, liveMetadata) : fieldLabel(option, undefined, ((liveMetadata.entityDefs[scope]?.links?.[data.link] as any)?.entity || ""), liveMetadata)}</option>)}</select></label>;
    }
    if (param.view === "views/admin/field-manager/fields/link/default" || param.view === "views/admin/field-manager/fields/link-multiple/default") {
      const relationship = liveMetadata.entityDefs[scope]?.links?.[fieldName];
      const target = relationship?.entity;
      const multiple = param.view.endsWith("link-multiple/default");
      const attrs = data.defaultAttributes || {};
      const ids: string[] = multiple ? attrs[`${fieldName}Ids`] || [] : attrs[`${fieldName}Id`] ? [attrs[`${fieldName}Id`]] : [];
      const names: Data = multiple ? attrs[`${fieldName}Names`] || {} : { [attrs[`${fieldName}Id`]]: attrs[`${fieldName}Name`] || "" };
      return <div className="setting-field field-manager-link-default" key={name}><span>{label}</span><div>{ids.length ? ids.map((id) => <span className="field-manager-link-chip" key={id}>{names[id] || id}<button type="button" disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} aria-label="Odebrat výchozí záznam" onClick={() => { const next = { ...attrs }; if (multiple) { next[`${fieldName}Ids`] = ids.filter((item) => item !== id); const hash = { ...names }; delete hash[id]; next[`${fieldName}Names`] = hash; } else { delete next[`${fieldName}Id`]; delete next[`${fieldName}Name`]; } setData((old) => ({ ...old, defaultAttributes: Object.keys(next).length ? next : null })); }}>×</button></span>) : <small className="field-hint">Žádný výchozí záznam.</small>}<button type="button" className="button subtle" disabled={!canEditField || busy || !target} onClick={() => setDefaultRecordPicker({ entity: target!, multiple })}><Search size={13}/> Vybrat záznam{multiple ? "y" : ""}</button></div>{!target && <small className="field-hint">Nejdříve vytvořte vztah v nástroji Správce vztahů.</small>}</div>;
    }
    if (type === "colorpicker") {
      const color = typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : "#000000";
      const disabled = !canEditField || busy || Boolean(param.readOnlyNotNew && !creating);
      return <label className="setting-field field-manager-color" key={name}><span>{label}</span><div><input type="color" aria-label={`${label} – výběr barvy`} disabled={disabled} value={color} onChange={(event) => setValue(event.target.value)}/><input type="text" aria-label={`${label} – hexadecimální hodnota`} disabled={disabled} value={value ?? ""} maxLength={param.maxLength} onChange={(event) => setValue(event.target.value)} placeholder="#RRGGBB"/></div></label>;
    }
    if (type === "bool") return <label className="setting-field" key={name}><span>{label}</span><span className="switch-row"><input type="checkbox" disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} checked={Boolean(value)} onChange={(event) => setValue(event.target.checked)}/><span>{value ? "Zapnuto" : "Vypnuto"}</span></span></label>;
    if (["enum", "enumInt", "enumFloat"].includes(type)) return <label className="setting-field" key={name}><span>{label}</span><select disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} value={value ?? ""} onChange={(event) => { const raw = event.target.value; setValue(raw === "" ? param.name === "default" ? null : "" : type === "enum" ? raw : Number(raw)); }}><option value="">—</option>{options.map((option) => <option key={option} value={option}>{optionLabel(option, param)}</option>)}</select>{!options.length && <small className="field-hint">Nejprve přidejte možnosti výběru.</small>}</label>;
    if (type === "multiEnum") {
      const selected = Array.isArray(value) ? value.map(String) : [];
      const optionText = (option: string) => param.name === "default" ? optionLabel(option, param) : param.view === "views/admin/field-manager/fields/source-list" || param.view === "views/admin/field-manager/fields/entity-list" ? entityLabel(liveMetadata, option, true) : option;
      return <fieldset className="field-manager-multienum" key={name} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)}><legend>{label}</legend>{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => setValue(event.target.checked ? [...new Set([...selected, option])] : selected.filter((item) => item !== option))}/><span>{optionText(option)}</span></label>)}{!options.length && <small className="field-hint">Nejprve přidejte možnosti výběru.</small>}</fieldset>;
    }
    if (["array", "arrayInt"].includes(type)) {
      const items: unknown[] = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n").filter(Boolean) : [];
      const add = () => { const raw = (paramDraft[name] || "").trim(); if (!raw) return; const next = type === "arrayInt" ? Number(raw) : raw; if (type === "arrayInt" && !Number.isFinite(next)) return; setValue([...items, next]); setParamDraft((old) => ({ ...old, [name]: "" })); };
      return <div className="setting-field field-manager-array" key={name}><span>{label}</span><div className="field-manager-array-items">{items.map((item, index) => <div key={`${index}-${String(item)}`}><code>{String(item)}</code><button type="button" aria-label={`Odebrat ${item}`} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} onClick={() => setValue(items.filter((_, i) => i !== index))}>×</button></div>)}</div><div className="field-manager-array-add"><input value={paramDraft[name] || ""} disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} type={type === "arrayInt" ? "number" : "text"} onChange={(event) => setParamDraft((old) => ({ ...old, [name]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="Přidat hodnotu…"/><button type="button" className="button subtle" disabled={!canEditField || busy || !paramDraft[name]?.trim()} onClick={add}>Přidat</button></div></div>;
    }
    if (type === "jsonObject") return <label className="setting-field" key={name}><span>{label} (JSON)</span><textarea disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} rows={5} spellCheck={false} value={typeof value === "string" ? value : JSON.stringify(value || {}, null, 2)} onChange={(event) => setValue(event.target.value)} placeholder="{}"/></label>;
    if (type === "text") return <label className="setting-field" key={name}><span>{label}</span><textarea disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} required={Boolean(param.required)} rows={param.rowsMin || 4} maxLength={param.maxLength} value={value} onChange={(event) => setValue(event.target.value)}/></label>;
    return <label className="setting-field" key={name}><span>{label}</span><input disabled={!canEditField || busy || Boolean(param.readOnlyNotNew && !creating)} required={Boolean(param.required)} type={["int", "float"].includes(type) ? "number" : "text"} min={param.min} max={param.max} maxLength={type === "varchar" ? param.maxLength : undefined} step={type === "float" ? "any" : undefined} value={value} onChange={(event) => setValue(["int", "float"].includes(type) ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value)}/></label>;
  }

  return <><div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={() => { if (confirmDiscardChanges()) onBack(); }}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">PŘIZPŮSOBENÍ CRM</div><h1>Správce polí</h1><p>Upravujte všechna přizpůsobitelná pole a vytvářejte vlastní definice.</p></div><button className="button primary" onClick={newField} disabled={!scope || busy || !canAddField}><Plus size={15}/> Nové pole</button></div>
    {error && <div className="table-error">{error}<button onClick={() => setError("")}>Zavřít</button></div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <div className="field-manager-layout"><section className="surface field-manager-sidebar"><label className="setting-field"><span>Entita</span><select value={scope} onChange={(event) => { if (confirmDiscardChanges()) setScope(event.target.value); }}>{scopes.map((item) => <option key={item} value={item}>{entityLabel(liveMetadata, item, true)}</option>)}</select></label><label className="field-manager-search"><Search size={13}/><input value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} placeholder="Hledat pole…"/><span>{visibleFieldList.length}</span></label><div className="field-manager-list-head"><strong>Všechna pole</strong><span>{fieldList.length} · {customFieldCount} vlastní</span></div>{visibleFieldList.length ? visibleFieldList.map(([name, definition]) => <button key={name} className={`field-manager-item ${fieldName === name ? "active" : ""} ${(definition as Data).customizationDisabled ? "field-manager-readonly" : ""}`} onClick={() => { if (!confirmDiscardChanges()) return; setCreating(false); setFieldName(name); setField(null); setData({}); setOriginalData({}); setDynamicLogic({}); setOriginalDynamicLogic({}); setNotice(""); }}><span>{fieldLabel(name, definition, scope, liveMetadata)}</span><small>{name} · {(definition as Data).type || "field"}{(definition as Data).isCustom ? " · vlastní" : " · systémové"}{(definition as Data).customizationDisabled ? " · uzamčeno" : ""}</small></button>) : <p className="field-manager-empty">{fieldList.length ? "Žádná pole neodpovídají hledání." : "Tato entita zatím nemá žádná pole."}</p>}</section>
      <section className="surface field-manager-editor" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "s" || event.key === "Enter")) { event.preventDefault(); event.stopPropagation(); if (canEditField && !busy) void save(); } }}>{creating || fieldName ? <><div className="settings-card-head"><div><h2>{creating ? "Nové vlastní pole" : field?.label || fieldName}</h2><p>{creating ? `Přidání pole do entity ${entityLabel(liveMetadata, scope)}.` : `${scope}.${fieldName} · typ ${field?.type || "…"}`}</p></div>{hasUnsavedChanges && <span className="field-manager-unsaved" role="status"><span/>Neuložené změny</span>}</div>{busy && !creating && !field ? <div className="table-loading"><span className="spinner"/> Načítám definici pole…</div> : <div className="settings-fields field-manager-fields">
        {creating && <><label className="setting-field"><span>Interní název</span><input required pattern="[a-z][a-zA-Z0-9]*" value={data.name || ""} onChange={(event) => setData((old) => ({ ...old, name: event.target.value }))} placeholder="naprVlastniPole"/><small>Začněte malým písmenem, používejte pouze písmena a číslice. EspoCRM může automaticky přidat prefix c.</small></label><label className="setting-field"><span>Typ pole</span><select value={createType} onChange={(event) => { setCreateType(event.target.value); setData((old) => ({ name: old.name, label: old.label, type: event.target.value })); }}>{typeList.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></>}
        <label className="setting-field"><span>Zobrazovaný název</span><input required disabled={!canEditField || busy} value={data.label || ""} onChange={(event) => setData((old) => ({ ...old, label: event.target.value }))}/></label>
        {paramDefs.map(renderParameter)}
      </div>}
      {supportsLogic && (dynamicLogic.dynamicLogicVisible !== undefined || canEditLogicRequired || canEditLogicReadOnly || canEditLogicInvalid || canEditLogicOptions || canEditLogicReadOnlySaved) && <details className="field-dynamic-logic"><summary>Podmíněná logika pole</summary><p>Nastavte, kdy se pole zobrazí, bude povinné nebo se přepne do režimu pouze pro čtení.</p>{dynamicLogic.dynamicLogicVisible !== undefined && <DynamicLogicEditor metadata={liveMetadata} entity={scope} title="Viditelnost pole" value={dynamicLogic.dynamicLogicVisible} onChange={(value) => setDynamicLogic((old) => ({ ...old, dynamicLogicVisible: value }))}/>}{canEditLogicRequired && <DynamicLogicEditor metadata={liveMetadata} entity={scope} title="Povinné pole" value={dynamicLogic.dynamicLogicRequired} onChange={(value) => setDynamicLogic((old) => ({ ...old, dynamicLogicRequired: value }))}/>}{canEditLogicReadOnly && <DynamicLogicEditor metadata={liveMetadata} entity={scope} title="Pouze pro čtení" value={dynamicLogic.dynamicLogicReadOnly} onChange={(value) => setDynamicLogic((old) => ({ ...old, dynamicLogicReadOnly: value }))}/>}{canEditLogicInvalid && <DynamicLogicEditor metadata={liveMetadata} entity={scope} title="Validační chyba" value={dynamicLogic.dynamicLogicInvalid} onChange={(value) => setDynamicLogic((old) => ({ ...old, dynamicLogicInvalid: value }))}/>}{canEditLogicOptions && <DynamicOptionsEditor metadata={liveMetadata} entity={scope} field={fieldName} options={nativeFieldDefs.options || []} value={dynamicLogic.dynamicLogicOptions || []} onChange={(value) => setDynamicLogic((old) => ({ ...old, dynamicLogicOptions: value }))}/>}{canEditLogicReadOnlySaved && <DynamicLogicEditor metadata={liveMetadata} entity={scope} title="Zamknout po uložení" value={dynamicLogic.dynamicLogicReadOnlySaved} onChange={(value) => setDynamicLogic((old) => ({ ...old, dynamicLogicReadOnlySaved: value }))}/>}</details>}
      {Object.values(globalRestrictions).some(Boolean) && <section className="field-manager-global-restrictions"><strong>Globální omezení přístupu</strong><div>{Object.entries(globalRestrictions).filter(([, enabled]) => Boolean(enabled)).map(([key]) => <span key={key}>{key === "onlyAdmin" ? "Pouze administrátoři" : key === "nonAdminReadOnly" ? "Ostatní jen pro čtení" : key === "forbidden" ? "Zakázáno" : key === "internal" ? "Interní pole" : key === "readOnly" ? "Pouze pro čtení" : key}</span>)}</div></section>}
      <div className="field-manager-actions">{canEditField && <><button className="button primary" onClick={() => void save()} disabled={busy || (!creating && !field)} title="Uložit změny (Ctrl+S)"><Save size={14}/>{busy ? "Ukládám…" : "Uložit pole"}</button><span className="field-manager-shortcut">Ctrl+S</span></>}{!canEditField && !creating && <span className="field-manager-locked-note">Toto pole nelze upravit v Field Manageru podle metadat EspoCRM.</span>}{field?.isCustom && !creating && canEditField && <button className="button danger" onClick={() => void removeField()} disabled={busy}><Trash2 size={14}/> Smazat pole</button>}{field && !creating && !field.isCustom && !liveMetadata.scopes[scope]?.isCustom && canEditField && <button className="button subtle" onClick={() => void resetFieldDefaults()} disabled={busy}><RotateCcw size={13}/> Obnovit výchozí</button>}</div></> : <div className="field-manager-placeholder"><span><Save size={20}/></span><h2>Vyberte pole</h2><p>Upravte pole systému nebo vytvořte nové vlastní pole.</p></div>}</section></div>
  </div>{defaultRecordPicker && <SelectRecordsDialog entity={defaultRecordPicker.entity} metadata={liveMetadata} multiple={defaultRecordPicker.multiple} selectedIds={(() => { const attrs = data.defaultAttributes || {}; return defaultRecordPicker.multiple ? attrs[`${fieldName}Ids`] || [] : attrs[`${fieldName}Id`] ? [attrs[`${fieldName}Id`]] : []; })()} selectedRows={(() => { const attrs = data.defaultAttributes || {}; const ids: string[] = defaultRecordPicker.multiple ? attrs[`${fieldName}Ids`] || [] : attrs[`${fieldName}Id`] ? [attrs[`${fieldName}Id`]] : []; const names = defaultRecordPicker.multiple ? attrs[`${fieldName}Names`] || {} : { [attrs[`${fieldName}Id`]]: attrs[`${fieldName}Name`] || "" }; return ids.map((id) => ({ id, name: names[id] || id })); })()} onClose={() => setDefaultRecordPicker(null)} onSelect={(rows) => { const attrs = data.defaultAttributes || {}; const next = { ...attrs }; if (defaultRecordPicker.multiple) { next[`${fieldName}Ids`] = rows.map((row) => row.id); next[`${fieldName}Names`] = Object.fromEntries(rows.map((row) => [row.id, row.name || row.id])); } else if (rows[0]) { next[`${fieldName}Id`] = rows[0].id; next[`${fieldName}Name`] = rows[0].name || rows[0].id; } else { delete next[`${fieldName}Id`]; delete next[`${fieldName}Name`]; } setData((old) => ({ ...old, defaultAttributes: Object.keys(next).length ? next : null })); setDefaultRecordPicker(null); }}/>}</>;
}
