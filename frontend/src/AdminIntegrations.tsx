import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Network, Save, ShieldCheck } from "./Icons";
import { request } from "./api";
import type { FieldDef, Metadata } from "./api";

type Data = Record<string, any>;
function integrationFieldLabel(metadata: Metadata, integration: string, name: string, def: FieldDef) {
  return (metadata.labels as any)?.Integration?.fields?.[name] || (metadata.labels as any)?.[integration]?.fields?.[name] || def.label || name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (value) => value.toUpperCase());
}
function integrationTitle(metadata: Metadata, name: string) {
  return (metadata.labels as any)?.Integration?.titles?.[name] || (metadata.labels as any)?.Integration?.[name] || name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}
function IntegrationControl({ name, def, label, value, onChange }: { name: string; def: FieldDef; label: string; value: any; onChange: (value: any) => void }) {
  const id = `integration-${name}`;
  const disabled = Boolean(def.disabled || def.readOnly);
  if (def.type === "bool") return <label className="preference-toggle" htmlFor={id}><span><strong>{label}</strong></span><input id={id} type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)}/><i/></label>;
  if (["multiEnum", "checklist"].includes(def.type || "") && def.options?.length) return <fieldset className="integration-multi-enum"><legend>{label}{def.required && <i> *</i>}</legend>{def.options.map((option) => <label key={String(option)}><input type="checkbox" disabled={disabled} checked={Array.isArray(value) && value.map(String).includes(String(option))} onChange={(event) => onChange(event.target.checked ? [...new Set([...(Array.isArray(value) ? value : []), option])] : (Array.isArray(value) ? value.filter((item) => String(item) !== String(option)) : []))}/>{String(option)}</label>)}</fieldset>;
  if (def.options?.length) return <label className="field-input" htmlFor={id}><span>{label}{def.required && <i> *</i>}</span><select id={id} value={value ?? ""} required={def.required} disabled={disabled} onChange={(event) => onChange(["enumInt", "enumFloat"].includes(def.type || "") && event.target.value !== "" ? Number(event.target.value) : event.target.value)}><option value="">Nevybráno</option>{def.options.map((option) => <option key={String(option)} value={option}>{String(option)}</option>)}</select></label>;
  if (["text", "jsonObject", "jsonArray", "array", "arrayInt", "urlMultiple", "checklist", "multiEnum"].includes(def.type || "")) {
    const structured = ["jsonObject", "jsonArray"].includes(def.type || "");
    const current = structured ? typeof value === "string" ? value : JSON.stringify(value ?? (def.type === "jsonArray" ? [] : {}), null, 2) : Array.isArray(value) ? value.join("\n") : String(value ?? "");
    return <label className="field-input" htmlFor={id}><span>{label}{def.required && <i> *</i>}</span><textarea id={id} rows={4} value={current} required={def.required} disabled={disabled} onChange={(event) => onChange(event.target.value)}/></label>;
  }
  const type = def.type === "password" ? "password" : ["int", "float", "currency"].includes(def.type || "") ? "number" : def.type === "url" ? "url" : def.type === "email" ? "email" : def.type === "date" ? "date" : ["datetime", "datetimeOptional"].includes(def.type || "") ? "datetime-local" : def.type === "phone" ? "tel" : "text";
  return <label className="field-input" htmlFor={id}><span>{label}{def.required && <i> *</i>}</span><input id={id} type={type} value={value ?? ""} required={def.required && def.type !== "password"} disabled={disabled} maxLength={def.maxLength} min={def.min} max={def.max} step={type === "number" && def.type !== "int" ? "any" : undefined} placeholder={def.type === "password" ? "Ponechte prázdné pro zachování stávajícího klíče" : ""} onChange={(event) => onChange(event.target.value === "" ? "" : type === "number" ? Number(event.target.value) : event.target.value)}/></label>;
}
export default function AdminIntegrations({ metadata, onBack }: { metadata: Metadata; onBack: () => void }) {
  const integrations: Record<string, { fields?: Record<string, FieldDef>; allowUserAccounts?: boolean; authMethod?: string }> = (metadata as any).integrations || {};
  const names = useMemo(() => Object.keys(integrations).sort((a, b) => integrationTitle(metadata, a).localeCompare(integrationTitle(metadata, b))), [integrations, metadata]);
  const [selected, setSelected] = useState(names[0] || "");
  const [values, setValues] = useState<Data>({});
  const [original, setOriginal] = useState<Data>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);
  useEffect(() => { if (!names.includes(selected)) setSelected(names[0] || ""); }, [names, selected]);
  useEffect(() => {
    if (!selected) return;
    let live = true; setBusy(true); setError(""); setNotice("");
    request<Data>(`Integration/${encodeURIComponent(selected)}`).then((data) => { if (!live) return; setValues(data); setOriginal(data); })
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Nastavení integrace nelze načíst."))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [selected]);
  useEffect(() => {
    if (!selected || integrations[selected]?.authMethod !== "oauth2") return;
    let live = true;
    request<Data>("Settings").then((data) => { if (live) setSiteUrl(String(data.siteUrl || "")); }).catch(() => { if (live) setSiteUrl(""); });
    return () => { live = false; };
  }, [selected, integrations]);
  const definition = integrations[selected] || {};
  const fieldDefs = definition.fields || {};
  const redirectUri = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/?entryPoint=oauthCallback` : "";
  const changed: Data = {};
  for (const [name, def] of Object.entries(fieldDefs)) {
    const current = values[name];
    if (def.type === "password" && !current) continue;
    if (JSON.stringify(current) !== JSON.stringify(original[name])) changed[name] = current;
  }
  if (Boolean(values.enabled) !== Boolean(original.enabled)) changed.enabled = Boolean(values.enabled);
  async function save() {
    setError(""); setNotice("");
    for (const [name, def] of Object.entries(fieldDefs)) if (def.required && values.enabled && !values[name]) { setError(`Pole „${integrationFieldLabel(metadata, selected, name, def)}“ je povinné.`); return; }
    if (!Object.keys(changed).length) { setNotice("Nastavení integrace je aktuální."); return; }
    for (const [name, value] of Object.entries(changed)) {
      const type = fieldDefs[name]?.type;
      if (["jsonObject", "jsonArray"].includes(type || "") && typeof value === "string") { try { changed[name] = JSON.parse(value); } catch { setError(`Pole „${integrationFieldLabel(metadata, selected, name, fieldDefs[name])}“ neobsahuje platný JSON.`); return; } }
      else if (["array", "arrayInt", "urlMultiple", "checklist", "multiEnum"].includes(type || "") && typeof value === "string") {
        const items = value.split("\n").map((item: string) => item.trim()).filter(Boolean);
        if (type === "arrayInt") {
          if (items.some((item) => !Number.isInteger(Number(item)))) { setError(`Pole „${integrationFieldLabel(metadata, selected, name, fieldDefs[name])}“ očekává celá čísla, každé na samostatném řádku.`); return; }
          changed[name] = items.map(Number);
        } else changed[name] = items;
      }
    }
    setSaving(true);
    try { const result = await request<Data>(`Integration/${encodeURIComponent(selected)}`, { method: "PUT", body: JSON.stringify(changed) }); setValues(result); setOriginal(result); setNotice("Nastavení integrace bylo uloženo."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Integraci se nepodařilo uložit."); }
    finally { setSaving(false); }
  }
  async function copyRedirectUri() {
    if (!redirectUri) return;
    try { await navigator.clipboard.writeText(redirectUri); setCopiedRedirectUri(true); window.setTimeout(() => setCopiedRedirectUri(false), 1800); }
    catch { setError("Callback adresu se nepodařilo zkopírovat. Označte ji a zkopírujte ručně."); }
  }
  return <div className="admin-view integration-admin-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">PŘIPOJENÉ SLUŽBY</div><h1>Integrace</h1><p>Konfigurujte služby dostupné v metadatech této instalace EspoCRM.</p></div>{selected && <button className="button primary" onClick={() => void save()} disabled={busy || saving || !Object.keys(changed).length}><Save size={14}/>{saving ? "Ukládám…" : "Uložit změny"}</button>}</div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    {!names.length ? <div className="surface integration-empty"><Network size={22}/><strong>Nejsou nakonfigurované žádné integrace</strong><span>Seznam poskytovatelů se načítá z metadat instalace.</span></div> : <div className="integration-layout"><nav className="surface integration-nav">{names.map((name) => <button key={name} className={name === selected ? "active" : ""} onClick={() => setSelected(name)}><Network size={15}/><span>{integrationTitle(metadata, name)}</span></button>)}</nav><section className="surface integration-editor"><div className="settings-card-head"><div><h2>{integrationTitle(metadata, selected)}</h2><p>Konfigurace se ukládá do bezpečného nastavení EspoCRM.</p></div><span className={`security-state ${values.enabled ? "enabled" : "disabled"}`}>{values.enabled ? "Povoleno" : "Vypnuto"}</span></div>
      {busy ? <div className="table-loading"><span className="spinner"/>Načítám konfiguraci…</div> : <><div className="integration-fields"><IntegrationControl name="enabled" def={{ type: "bool" }} label="Povolit integraci" value={values.enabled} onChange={(value) => setValues((old) => ({ ...old, enabled: value }))}/>{Boolean(values.enabled) && Object.entries(fieldDefs).map(([name, def]) => <IntegrationControl key={name} name={name} def={def} label={integrationFieldLabel(metadata, selected, name, def)} value={values[name] ?? def.default ?? ""} onChange={(value) => setValues((old) => ({ ...old, [name]: value }))}/>)}</div>{definition.authMethod === "oauth2" && Boolean(values.enabled) && <div className="integration-redirect"><label className="field-input"><span>OAuth callback URL</span><input readOnly value={redirectUri} placeholder="Načítám veřejnou adresu instalace…"/><small>Vložte tuto adresu do seznamu povolených přesměrování u poskytovatele OAuth.</small></label><button type="button" className="button subtle" onClick={() => void copyRedirectUri()} disabled={!redirectUri}>{copiedRedirectUri ? <Check size={14}/> : <Copy size={14}/>} {copiedRedirectUri ? "Zkopírováno" : "Kopírovat"}</button></div>}{Boolean(values.enabled) && <div className="integration-note"><ShieldCheck size={15}/><span>Citlivé klíče jsou při načtení skryté. Nechte heslové pole prázdné, pokud klíč neměníte.</span></div>}</>}
    </section></div>}
  </div>;
}
