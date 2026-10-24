import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Check, Network, Pencil, Plus, RefreshCw, Settings, Trash2, X } from "./Icons";
import { entityLabel, fetchMetadata, fieldLabel, request } from "./api";
import type { Metadata } from "./api";

type Data = Record<string, any>;
const relationshipTypes = [
  { id: "oneToMany", label: "Jeden k více", note: "Jedna položka zde může souviset s více položkami cílové entity." },
  { id: "manyToOne", label: "Více k jednomu", note: "Tato položka odkazuje na jednu položku cílové entity." },
  { id: "manyToMany", label: "Více k více", note: "Obě entity mohou mít libovolný počet propojených položek." },
  { id: "oneToOneLeft", label: "Jedna k jedné", note: "Každá entita může být propojena s nejvýše jednou položkou." },
  { id: "oneToOneRight", label: "Jedna k jedné (opačná strana)", note: "Jedna k jedné s opačným vlastnictvím vztahu." },
  { id: "childrenToParent", label: "Hierarchický vztah", note: "Položka může mít nadřazený záznam z vybraných entit." },
];

function baseLinkName(entity: string, metadata: Metadata) {
  const clean = metadata.scopes[entity]?.isCustom && entity.startsWith("C") && /[A-Z]/.test(entity[1] || "") ? entity.slice(1) : entity;
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}
function pluralize(name: string) { if (name.endsWith("y")) return `${name.slice(0, -1)}ies`; if (name.endsWith("s")) return `${name}es`; return `${name}s`; }
function suggested(type: string, source: string, target: string, metadata: Metadata) {
  const sourceName = baseLinkName(source, metadata); const targetName = baseLinkName(target, metadata);
  let link = targetName; let linkForeign = sourceName;
  if (type === "oneToMany") { link = pluralize(targetName); linkForeign = sourceName; }
  if (type === "manyToOne") { link = targetName; linkForeign = pluralize(sourceName); }
  if (type === "manyToMany") { link = pluralize(targetName); linkForeign = pluralize(sourceName); if (link === linkForeign) { link = `${link}Right`; linkForeign = `${linkForeign}Left`; } }
  if (type === "oneToOneLeft" || type === "oneToOneRight") { link = targetName; linkForeign = sourceName; }
  if (source === target && type === "oneToMany") linkForeign += "Parent";
  if (source === target && type === "manyToOne") link += "Parent";
  return { link, linkForeign, label: link.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase()), labelForeign: linkForeign.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase()) };
}

function describeLink(metadata: Metadata, defs: Data) {
  if (defs.type === "belongsToParent") return "Nadřazená entita";
  const foreign = defs.entity ? metadata.entityDefs?.[defs.entity]?.links?.[defs.foreign || ""] as Data | undefined : undefined;
  const mapping: Record<string, Record<string, string>> = {
    hasMany: { hasMany: "Více k více", belongsTo: "Jeden k více" },
    belongsTo: { hasMany: "Více k jednomu", hasOne: "Jedna k jedné" },
    hasOne: { belongsTo: "Jedna k jedné" },
    hasChildren: { belongsToParent: "Hierarchie" },
  };
  return mapping[defs.type]?.[foreign?.type] || (defs.relationName ? "Více k více" : defs.type || "Vztah");
}
function relationEditorType(metadata: Metadata, defs: Data): string | null {
  if (defs.type === "belongsToParent") return "childrenToParent";
  const foreignType = defs.entity && defs.foreign ? metadata.entityDefs?.[defs.entity]?.links?.[defs.foreign]?.type : "";
  if (defs.type === "hasChildren" && foreignType === "belongsToParent") return "parentToChildren";
  if (defs.type === "hasMany" && foreignType === "hasMany") return "manyToMany";
  if (defs.type === "hasMany" && foreignType === "belongsTo") return "oneToMany";
  if (defs.type === "belongsTo" && foreignType === "hasMany") return "manyToOne";
  if (defs.type === "belongsTo" && foreignType === "hasOne") return "oneToOneRight";
  if (defs.type === "hasOne" && foreignType === "belongsTo") return "oneToOneLeft";
  return null;
}
function relationshipLayouts(metadata: Metadata, entity: string) {
  const layouts = (metadata.clientDefs?.[entity] as Data | undefined)?.additionalLayouts || {};
  return Object.entries(layouts).filter(([, value]) => ["list", "listSmall"].includes((value as Data)?.type)).map(([name]) => name);
}
function relationshipFilters(metadata: Metadata, entity: string) {
  const items = (metadata.clientDefs?.[entity] as Data | undefined)?.filterList || [];
  return items.map((item: any) => typeof item === "string" ? item : item?.name).filter(Boolean) as string[];
}

export default function AdminLinkManager({ metadata, onBack }: { metadata: Metadata; onBack: () => void }) {
  const [liveMetadata, setLiveMetadata] = useState(metadata);
  const [scope, setScope] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLinkName, setEditingLinkName] = useState("");
  const [paramsLink, setParamsLink] = useState<{ name: string; defs: Data } | null>(null);
  const [paramsReadOnly, setParamsReadOnly] = useState(false);
  const [form, setForm] = useState<Data>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const entityList = useMemo(() => Object.keys(liveMetadata.scopes).filter((name) => liveMetadata.scopes[name].entity && liveMetadata.scopes[name].customizable && liveMetadata.scopes[name].entityManager?.relationships !== false).sort((a, b) => entityLabel(liveMetadata, a).localeCompare(entityLabel(liveMetadata, b), "cs")), [liveMetadata]);
  const links = liveMetadata.entityDefs[scope]?.links || {};
  const foreignEntityList = entityList;
  const hierarchyParentChoices: string[] = form.noParentEntityTypeList ? entityList : (form.parentEntityTypeList || []);
  const hierarchyLinkName = editingLinkName || form.link || "";
  const hierarchyLinkChoices = hierarchyParentChoices.filter((parentType) => Object.values(liveMetadata.entityDefs?.[parentType]?.links || {}).some((parentLink: any) => parentLink.type === "hasChildren" && parentLink.entity === scope && parentLink.foreign === hierarchyLinkName));

  useEffect(() => { if (!scope && entityList.length) setScope(entityList[0]); else if (scope && !entityList.includes(scope)) setScope(entityList[0] || ""); }, [scope, entityList]);

  function startCreate() {
    const target = entityList.find((name) => name !== scope) || scope;
    const type = "oneToMany";
    setForm({ ...suggested(type, scope, target, liveMetadata), entityForeign: target, linkType: type, audited: false, auditedForeign: false, parentEntityTypeList: [], foreignLinkEntityTypeList: [], noParentEntityTypeList: false });
    setCreateOpen(true); setError(""); setNotice("");
  }
  function updateRelationship(key: string, value: any) { setForm((old) => ({ ...old, [key]: value })); }
  function startEditLink(name: string, defs: Data) {
    const entityForeign = String(defs.entity || "");
    const panel = (liveMetadata.clientDefs?.[scope] as Data | undefined)?.relationshipPanels?.[name] || {};
    const panelForeign = (liveMetadata.clientDefs?.[entityForeign] as Data | undefined)?.relationshipPanels?.[defs.foreign || ""] || {};
    const ownField = liveMetadata.entityDefs?.[scope]?.fields?.[name] as Data | undefined;
    const foreignField = liveMetadata.entityDefs?.[entityForeign]?.fields?.[defs.foreign || ""] as Data | undefined;
    const linkType = relationEditorType(liveMetadata, defs) || "";
    const noParentEntityTypeList = linkType === "childrenToParent" && ownField?.entityList === null;
    const parentEntityTypeList: string[] = linkType === "childrenToParent" ? (noParentEntityTypeList ? entityList : (ownField?.entityList || []).filter((item: string) => entityList.includes(item))) : [];
    const foreignLinkEntityTypeList = parentEntityTypeList.filter((parentType) => Object.values(liveMetadata.entityDefs?.[parentType]?.links || {}).some((parentLink: any) => parentLink.type === "hasChildren" && parentLink.entity === scope && parentLink.foreign === name));
    setForm({
      link: name,
      linkForeign: defs.foreign || "",
      linkType,
      entityForeign,
      label: (liveMetadata.labels as any)?.[scope]?.links?.[name] || name,
      labelForeign: (liveMetadata.labels as any)?.[entityForeign]?.links?.[defs.foreign || ""] || defs.foreign || "",
      relationName: defs.relationName || "",
      linkMultipleField: ownField?.type === "linkMultiple" && !ownField?.noLoad,
      linkMultipleFieldForeign: foreignField?.type === "linkMultiple" && !foreignField?.noLoad,
      audited: Boolean(defs.audited),
      auditedForeign: Boolean((liveMetadata.entityDefs?.[entityForeign]?.links?.[defs.foreign || ""] as Data | undefined)?.audited || (linkType === "childrenToParent" && defs.audited)),
      layout: panel.layout || "",
      layoutForeign: panelForeign.layout || "",
      selectFilter: panel.selectPrimaryFilterName || "",
      selectFilterForeign: panelForeign.selectPrimaryFilterName || "",
      parentEntityTypeList,
      foreignLinkEntityTypeList,
      noParentEntityTypeList,
    });
    setEditingLinkName(name); setError(""); setNotice("");
  }
  function changeTargetOrType(next: Partial<Data>) {
    setForm((old) => {
      const merged = { ...old, ...next };
      if (merged.linkType === "childrenToParent") {
        const link = liveMetadata.entityDefs?.[scope]?.links?.parent ? "parentAnother" : "parent";
        const linkForeign = pluralize(baseLinkName(scope, liveMetadata));
        const parents: string[] = old.linkType === "childrenToParent" ? (old.parentEntityTypeList || []) : [];
        return { ...old, ...merged, entityForeign: "", label: "Parent", labelForeign: "", link, linkForeign, parentEntityTypeList: parents, foreignLinkEntityTypeList: [], noParentEntityTypeList: false };
      }
      return { ...old, ...suggested(merged.linkType, scope, merged.entityForeign, liveMetadata), ...next, parentEntityTypeList: [], foreignLinkEntityTypeList: [], noParentEntityTypeList: false };
    });
  }
  async function createLink(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const payload: Data = { ...form, entity: scope };
      if (form.linkType === "childrenToParent") {
        delete payload.entityForeign; delete payload.labelForeign; delete payload.selectFilter; delete payload.selectFilterForeign;
        payload.parentEntityTypeList = form.parentEntityTypeList || [];
        payload.foreignLinkEntityTypeList = form.foreignLinkEntityTypeList || [];
      }
      await request("EntityManager/action/createLink", { method: "POST", body: JSON.stringify(payload) });
      setLiveMetadata(await fetchMetadata()); setCreateOpen(false); setNotice("Vztah byl vytvořen. EspoCRM přestavělo metadata.");
    } catch (e) { setError(e instanceof Error ? e.message : "Vztah se nepodařilo vytvořit."); }
    finally { setBusy(false); }
  }
  async function updateLink(event: FormEvent) {
    event.preventDefault(); if (!editingLinkName) return;
    setBusy(true); setError(""); setNotice("");
    const payload: Data = {
      entity: scope, entityForeign: form.entityForeign, link: editingLinkName, linkForeign: form.linkForeign,
      label: form.label, labelForeign: form.labelForeign, linkType: form.linkType, relationName: form.relationName || null,
      linkMultipleField: Boolean(form.linkMultipleField), linkMultipleFieldForeign: Boolean(form.linkMultipleFieldForeign),
      audited: Boolean(form.audited), auditedForeign: Boolean(form.auditedForeign),
      layout: form.layout || null, layoutForeign: form.layoutForeign || null,
      selectFilter: form.selectFilter || null, selectFilterForeign: form.selectFilterForeign || null,
    };
    if (form.linkType === "childrenToParent") {
      delete payload.entityForeign; delete payload.labelForeign; delete payload.selectFilter; delete payload.selectFilterForeign;
      payload.parentEntityTypeList = form.noParentEntityTypeList ? null : (form.parentEntityTypeList || []);
      payload.foreignLinkEntityTypeList = form.foreignLinkEntityTypeList || [];
    } else if (form.linkType === "parentToChildren") {
      delete payload.selectFilter; delete payload.selectFilterForeign;
    }
    try {
      await request("EntityManager/action/updateLink", { method: "POST", body: JSON.stringify(payload) });
      setLiveMetadata(await fetchMetadata()); setEditingLinkName(""); setNotice("Vztah byl upraven a metadata EspoCRM byla přestavěna.");
    } catch (e) { setError(e instanceof Error ? e.message : "Vztah se nepodařilo upravit."); }
    finally { setBusy(false); }
  }
  async function removeLink(name: string) {
    if (!window.confirm(`Odstranit vlastní vztah „${fieldLabel(name, undefined, scope, liveMetadata)}“?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("EntityManager/action/removeLink", { method: "POST", body: JSON.stringify({ entity: scope, link: name }) });
      setLiveMetadata(await fetchMetadata()); setNotice("Vztah byl odstraněn.");
    } catch (e) { setError(e instanceof Error ? e.message : "Vztah se nepodařilo odstranit."); }
    finally { setBusy(false); }
  }
  async function saveLinkParams() {
    if (!paramsLink) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("EntityManager/action/updateLinkParams", { method: "POST", body: JSON.stringify({ entityType: scope, link: paramsLink.name, params: { readOnly: paramsReadOnly } }) });
      setLiveMetadata(await fetchMetadata()); setParamsLink(null); setNotice("Parametry vztahu byly uloženy.");
    } catch (e) { setError(e instanceof Error ? e.message : "Parametry vztahu se nepodařilo uložit."); }
    finally { setBusy(false); }
  }
  async function resetLinkParams() {
    if (!paramsLink || !window.confirm("Obnovit výchozí parametry tohoto systémového vztahu?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("EntityManager/action/resetLinkParamsToDefault", { method: "POST", body: JSON.stringify({ entityType: scope, link: paramsLink.name }) });
      const refreshed = await fetchMetadata(); setLiveMetadata(refreshed);
      setParamsReadOnly(Boolean((refreshed.entityDefs?.[scope]?.links?.[paramsLink.name] as Data | undefined)?.readOnly));
      setNotice("Výchozí parametry vztahu byly obnoveny.");
    } catch (e) { setError(e instanceof Error ? e.message : "Výchozí parametry vztahu se nepodařilo obnovit."); }
    finally { setBusy(false); }
  }

  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">PŘIZPŮSOBENÍ CRM</div><h1>Správce vztahů</h1><p>Propojte entity a spravujte jejich vlastní relace.</p></div><div className="layout-heading-actions"><button className="button subtle" onClick={async () => setLiveMetadata(await fetchMetadata())} disabled={busy}><RefreshCw size={14}/> Obnovit</button><button className="button primary" onClick={startCreate} disabled={!scope || busy}><Plus size={15}/> Nový vztah</button></div></div>
    {error && <div className="table-error">{error}<button onClick={() => setError("")}>Zavřít</button></div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <section className="surface relationship-manager"><div className="relationship-toolbar"><label className="setting-field"><span>Entita</span><select value={scope} onChange={(event) => { setScope(event.target.value); setCreateOpen(false); setNotice(""); }}>{entityList.map((name) => <option value={name} key={name}>{entityLabel(liveMetadata, name, true)}</option>)}</select></label><span>{Object.keys(links).length} vztahů v metadatech</span></div>
      <div className="relationship-list">{Object.entries(links).filter(([, defs]) => Boolean((defs as Data).entity) || (defs as Data).type === "belongsToParent").sort(([a], [b]) => a.localeCompare(b)).map(([name, raw]) => { const defs = raw as Data; const foreignName = defs.entity || ""; const canEditParams = ["hasMany", "hasChildren"].includes(defs.type); const canEditLink = Boolean(relationEditorType(liveMetadata, defs)); return <article className="relationship-row" key={name}><div className="relationship-symbol"><Network size={16}/></div><div className="relationship-main"><strong>{fieldLabel(name, undefined, scope, liveMetadata)}</strong><small>{name} · {describeLink(liveMetadata, defs)}</small></div><div className="relationship-target">{foreignName ? entityLabel(liveMetadata, foreignName, true) : "Dynamická hierarchie"}{defs.foreign && <small>{defs.foreign}</small>}</div><span className={`relationship-badge ${defs.isCustom ? "custom" : ""}`}>{defs.isCustom ? "Vlastní" : "Systém"}</span>{canEditLink && <button className="layout-icon-action" onClick={() => startEditLink(name, defs)} disabled={busy} title="Upravit definici vztahu" aria-label={`Upravit definici vztahu ${name}`}><Pencil size={14}/></button>}{canEditParams && <button className="layout-icon-action" onClick={() => { setParamsLink({ name, defs }); setParamsReadOnly(Boolean(defs.readOnly)); }} disabled={busy} title="Upravit parametry vztahu" aria-label={`Upravit parametry vztahu ${name}`}><Settings size={14}/></button>}{defs.isCustom && <button className="layout-icon-action danger" onClick={() => void removeLink(name)} disabled={busy} title="Odstranit vztah" aria-label={`Odstranit vztah ${name}`}><Trash2 size={14}/></button>}</article>; })}</div>
      {!Object.keys(links).length && <div className="field-manager-placeholder"><span><Network size={20}/></span><h2>Entita zatím nemá žádné vztahy</h2><p>Vytvořte vztah a propojte ji s jinou entitou.</p></div>}
    </section>
    {createOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setCreateOpen(false)}><form className="record-modal relationship-modal" onSubmit={createLink}><div className="modal-heading"><div><span className="eyebrow">NOVÁ RELACE · {entityLabel(liveMetadata, scope).toUpperCase()}</span><h2>Vytvořit vztah</h2></div><button type="button" className="icon-button" onClick={() => setCreateOpen(false)} aria-label="Zavřít">×</button></div>
      {form.linkType !== "childrenToParent" && <label className="field-input"><span>Cílová entita</span><select required value={form.entityForeign || ""} onChange={(event) => changeTargetOrType({ entityForeign: event.target.value })}>{foreignEntityList.map((name) => <option key={name} value={name}>{entityLabel(liveMetadata, name)}</option>)}</select></label>}
      <label className="field-input"><span>Typ vztahu</span><select value={form.linkType || "oneToMany"} onChange={(event) => changeTargetOrType({ linkType: event.target.value })}>{relationshipTypes.map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}</select><small className="field-hint">{relationshipTypes.find((type) => type.id === form.linkType)?.note}</small></label>
      <div className="settings-fields relationship-fields"><label className="setting-field"><span>Název vztahu v této entitě</span><input value={form.link || ""} required pattern="[a-z][a-zA-Z0-9]*" onChange={(event) => updateRelationship("link", event.target.value)}/></label>{form.linkType !== "childrenToParent" && <label className="setting-field"><span>Název vztahu v cílové entitě</span><input value={form.linkForeign || ""} required pattern="[a-z][a-zA-Z0-9]*" onChange={(event) => updateRelationship("linkForeign", event.target.value)}/></label>}<label className="setting-field"><span>Popisek vztahu</span><input value={form.label || ""} required onChange={(event) => updateRelationship("label", event.target.value)}/></label>{form.linkType !== "childrenToParent" && <label className="setting-field"><span>Popisek v cílové entitě</span><input value={form.labelForeign || ""} required onChange={(event) => updateRelationship("labelForeign", event.target.value)}/></label>}</div>
      {form.linkType === "manyToMany" && <label className="field-input"><span>Název relační tabulky (volitelné)</span><input value={form.relationName || ""} onChange={(event) => updateRelationship("relationName", event.target.value)}/><small className="field-hint">Pokud zůstane prázdný, EspoCRM jej vytvoří automaticky.</small></label>}
      {form.linkType === "childrenToParent" && <div className="entity-filter-fields"><strong>Povolené rodičovské entity</strong><div>{entityList.map((entityName) => <label key={entityName}><input type="checkbox" checked={hierarchyParentChoices.includes(entityName)} disabled={busy} onChange={(event) => { const next = event.target.checked ? [...hierarchyParentChoices, entityName] : hierarchyParentChoices.filter((item) => item !== entityName); const newLinks = next.filter((parentType) => Object.values(liveMetadata.entityDefs?.[parentType]?.links || {}).some((parentLink: any) => parentLink.type === "hasChildren" && parentLink.entity === scope && parentLink.foreign === hierarchyLinkName)); setForm((old) => ({ ...old, parentEntityTypeList: next, foreignLinkEntityTypeList: [...new Set([...(old.foreignLinkEntityTypeList || []).filter((item: string) => next.includes(item)), ...newLinks])] })); }}/>{entityLabel(liveMetadata, entityName)}</label>)}</div><strong>Rodiče se zpětnou vazbou</strong><div>{hierarchyLinkChoices.map((entityName) => <label key={entityName}><input type="checkbox" checked={(form.foreignLinkEntityTypeList || []).includes(entityName)} disabled={busy} onChange={(event) => updateRelationship("foreignLinkEntityTypeList", event.target.checked ? [...new Set([...(form.foreignLinkEntityTypeList || []), entityName])] : (form.foreignLinkEntityTypeList || []).filter((item: string) => item !== entityName))}/>{entityLabel(liveMetadata, entityName)}</label>)}</div></div>}
      <div className="entity-manager-toggles">{form.linkType !== "childrenToParent" && <label className="switch-row"><input type="checkbox" checked={Boolean(form.audited)} onChange={(event) => updateRelationship("audited", event.target.checked)}/><span>Auditovat změny relace</span></label>}<label className="switch-row"><input type="checkbox" checked={Boolean(form.auditedForeign)} onChange={(event) => updateRelationship("auditedForeign", event.target.checked)}/><span>{form.linkType === "childrenToParent" ? "Auditovat zpětné změny" : "Auditovat změny na druhé straně"}</span></label></div>
      <div className="modal-footer"><button type="button" className="button subtle" onClick={() => setCreateOpen(false)} disabled={busy}>Zrušit</button><button className="button primary" disabled={busy}>{busy ? "Vytvářím…" : "Vytvořit vztah"}</button></div>
    </form></div>}
    {editingLinkName && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setEditingLinkName("")}><form className="record-modal relationship-modal" onSubmit={updateLink}><div className="modal-heading"><div><span className="eyebrow">UPRAVIT RELACI · {entityLabel(liveMetadata, scope).toUpperCase()}</span><h2>{fieldLabel(editingLinkName, undefined, scope, liveMetadata)}</h2><p>{editingLinkName} · {form.linkForeign} · definici endpointů určuje nativní typ vztahu</p></div><button type="button" className="icon-button" onClick={() => setEditingLinkName("")} disabled={busy} aria-label="Zavřít"><X size={16}/></button></div>
      <div className="settings-fields relationship-fields"><label className="setting-field"><span>Popisek vztahu</span><input value={form.label || ""} required onChange={(event) => updateRelationship("label", event.target.value)}/></label>{form.linkType !== "childrenToParent" && <label className="setting-field"><span>Popisek v cílové entitě</span><input value={form.labelForeign || ""} required onChange={(event) => updateRelationship("labelForeign", event.target.value)}/></label>}</div>
      {form.linkType === "manyToMany" && <label className="setting-field"><span>Relační tabulka</span><input value={form.relationName || ""} readOnly/><small className="field-hint">Název relační tabulky nelze změnit po vytvoření vztahu.</small></label>}
      <div className="entity-manager-toggles">{["manyToMany", "oneToMany", "parentToChildren"].includes(form.linkType) && <label className="switch-row"><input type="checkbox" checked={Boolean(form.audited)} disabled={busy} onChange={(event) => updateRelationship("audited", event.target.checked)}/><span>Auditovat změny relace</span></label>}{["manyToMany", "manyToOne", "childrenToParent"].includes(form.linkType) && <label className="switch-row"><input type="checkbox" checked={Boolean(form.auditedForeign)} disabled={busy} onChange={(event) => updateRelationship("auditedForeign", event.target.checked)}/><span>Auditovat změny na druhé straně</span></label>}{["manyToMany", "oneToMany"].includes(form.linkType) && (liveMetadata.entityDefs?.[scope]?.fields?.[editingLinkName] as Data | undefined)?.type === "linkMultiple" && <label className="switch-row"><input type="checkbox" checked={Boolean(form.linkMultipleField)} disabled={busy || !(links[editingLinkName] as Data | undefined)?.isCustom} onChange={(event) => updateRelationship("linkMultipleField", event.target.checked)}/><span>Použít pole pro více odkazů</span></label>}{["manyToMany", "manyToOne"].includes(form.linkType) && (liveMetadata.entityDefs?.[form.entityForeign]?.fields?.[form.linkForeign] as Data | undefined)?.type === "linkMultiple" && <label className="switch-row"><input type="checkbox" checked={Boolean(form.linkMultipleFieldForeign)} disabled={busy || !(links[editingLinkName] as Data | undefined)?.isCustom} onChange={(event) => updateRelationship("linkMultipleFieldForeign", event.target.checked)}/><span>Použít pole pro více odkazů na cílové straně</span></label>}</div>
      {form.linkType === "childrenToParent" && <div className="entity-filter-fields"><strong>Povolené rodičovské entity</strong>{form.noParentEntityTypeList ? <small className="field-hint">Vztah přijímá všechny entity povolené instalací.</small> : <div>{entityList.map((entityName) => <label key={entityName}><input type="checkbox" checked={hierarchyParentChoices.includes(entityName)} disabled={busy} onChange={(event) => { const next = event.target.checked ? [...hierarchyParentChoices, entityName] : hierarchyParentChoices.filter((item) => item !== entityName); const newLinks = next.filter((parentType) => Object.values(liveMetadata.entityDefs?.[parentType]?.links || {}).some((parentLink: any) => parentLink.type === "hasChildren" && parentLink.entity === scope && parentLink.foreign === editingLinkName)); setForm((old) => ({ ...old, parentEntityTypeList: next, foreignLinkEntityTypeList: [...new Set([...(old.foreignLinkEntityTypeList || []).filter((item: string) => next.includes(item)), ...newLinks])] })); }}/>{entityLabel(liveMetadata, entityName)}</label>)}</div>}<strong>Rodiče se zpětnou vazbou</strong><div>{hierarchyLinkChoices.map((entityName) => <label key={entityName}><input type="checkbox" checked={(form.foreignLinkEntityTypeList || []).includes(entityName)} disabled={busy} onChange={(event) => updateRelationship("foreignLinkEntityTypeList", event.target.checked ? [...new Set([...(form.foreignLinkEntityTypeList || []), entityName])] : (form.foreignLinkEntityTypeList || []).filter((item: string) => item !== entityName))}/>{entityLabel(liveMetadata, entityName)}</label>)}</div></div>}
      <div className="settings-fields relationship-fields">{["manyToMany", "oneToMany", "parentToChildren"].includes(form.linkType) && <label className="setting-field"><span>Rozložení seznamu</span><select value={form.layout || ""} disabled={busy} onChange={(event) => updateRelationship("layout", event.target.value)}><option value="">Výchozí</option>{relationshipLayouts(liveMetadata, form.entityForeign).map((name) => <option key={name} value={name}>{(liveMetadata.labels as any)?.[form.entityForeign]?.layouts?.[name] || name}</option>)}</select></label>}{["manyToMany"].includes(form.linkType) && <label className="setting-field"><span>Rozložení na cílové straně</span><select value={form.layoutForeign || ""} disabled={busy} onChange={(event) => updateRelationship("layoutForeign", event.target.value)}><option value="">Výchozí</option>{relationshipLayouts(liveMetadata, scope).map((name) => <option key={name} value={name}>{(liveMetadata.labels as any)?.[scope]?.layouts?.[name] || name}</option>)}</select></label>}{["manyToMany", "oneToMany", "manyToOne", "oneToOneLeft", "oneToOneRight"].includes(form.linkType) && <><label className="setting-field"><span>Filtr výběru</span><select value={form.selectFilter || ""} disabled={busy} onChange={(event) => updateRelationship("selectFilter", event.target.value)}><option value="">Všechny záznamy</option>{relationshipFilters(liveMetadata, form.entityForeign).map((name) => <option key={name} value={name}>{(liveMetadata.labels as any)?.[form.entityForeign]?.presetFilters?.[name] || name}</option>)}</select></label><label className="setting-field"><span>Filtr na cílové straně</span><select value={form.selectFilterForeign || ""} disabled={busy} onChange={(event) => updateRelationship("selectFilterForeign", event.target.value)}><option value="">Všechny záznamy</option>{relationshipFilters(liveMetadata, scope).map((name) => <option key={name} value={name}>{(liveMetadata.labels as any)?.[scope]?.presetFilters?.[name] || name}</option>)}</select></label></>}</div>
      <div className="modal-footer"><button type="button" className="button subtle" onClick={() => setEditingLinkName("")} disabled={busy}>Zrušit</button><button className="button primary" disabled={busy}>{busy ? "Ukládám…" : "Uložit vztah"}</button></div>
    </form></div>}
    {paramsLink && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setParamsLink(null)}><section className="record-modal relationship-modal" role="dialog" aria-modal="true" aria-label={`Parametry vztahu ${paramsLink.name}`}><div className="modal-heading"><div><span className="eyebrow">PARAMETRY RELACE · {entityLabel(liveMetadata, scope).toUpperCase()}</span><h2>{fieldLabel(paramsLink.name, undefined, scope, liveMetadata)}</h2><p>{paramsLink.name} · {entityLabel(liveMetadata, paramsLink.defs.entity || "")}</p></div><button type="button" className="icon-button" onClick={() => setParamsLink(null)} disabled={busy} aria-label="Zavřít"><X size={16}/></button></div><label className="switch-row"><input type="checkbox" checked={paramsReadOnly} disabled={busy} onChange={(event) => setParamsReadOnly(event.target.checked)}/><span>Vztah pouze pro čtení</span></label><div className="modal-footer">{!paramsLink.defs.isCustom && <button type="button" className="button subtle" onClick={() => void resetLinkParams()} disabled={busy}>Obnovit výchozí</button>}<button type="button" className="button subtle" onClick={() => setParamsLink(null)} disabled={busy}>Zrušit</button><button type="button" className="button primary" onClick={() => void saveLinkParams()} disabled={busy}>{busy ? "Ukládám…" : "Uložit"}</button></div></section></div>}
  </div>;
}
