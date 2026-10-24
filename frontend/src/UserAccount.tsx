import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Check, KeyRound, RefreshCw, RotateCcw, Save, Shield, X } from "./Icons";
import QRCode from "qrcode";
import AccountSessions from "./AccountSessions";
import WysiwygEditor from "./WysiwygEditor";
import AdminTabListEditor from "./AdminTabListEditor";
import DashboardLayoutEditor from "./DashboardLayoutEditor";
import { canAccessEntity, fieldLabel, fetchLayout, request } from "./api";
import type { DetailLayoutPanel, FieldDef, Metadata, User } from "./api";

type Data = Record<string, any>;
type PrefField = { name: string; def: FieldDef; section: string };

function localizeLayoutLabel(value: string | undefined) {
  const key = value?.replace(/^\$label:/, "") || "";
  return ({ Locale: "Jazyk a oblast", General: "Obecné", "User Interface": "Uživatelské rozhraní", Notifications: "Upozornění" } as Record<string, string>)[key] || key;
}

function timeZones(current: string) {
  try {
    const values = (Intl as any).supportedValuesOf?.("timeZone") as string[] | undefined;
    return [...new Set([current, "UTC", ...(values || [])].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  } catch { return [current || "UTC", "UTC"].filter((value, index, array) => array.indexOf(value) === index); }
}

function choices(name: string, def: FieldDef, metadata: Metadata, settings: Data, value: any, timeFormat: string, language: string): Array<[string, string]> | null {
  let options: any[] | undefined = def.options;
  if (name === "language") options = metadata.app?.language?.list;
  if (name === "timeZone") options = timeZones(String(value || "UTC"));
  if (name === "dateFormat") options = metadata.app?.dateTime?.dateFormatList;
  if (name === "timeFormat") options = metadata.app?.dateTime?.timeFormatList;
  if (name === "defaultCurrency") options = settings.currencyList || [settings.defaultCurrency].filter(Boolean);
  if (name === "theme") options = Object.keys((metadata as any).themes || {}).sort((a, b) => a === "EspoRtl" ? -1 : b === "EspoRtl" ? 1 : ((metadata.labels as any)?.Global?.themes?.[a] || a).localeCompare((metadata.labels as any)?.Global?.themes?.[b] || b, String((metadata.app as any)?.language || "cs")));
  if (name === "weekStart") options = [-1, 0, 1, 2, 3, 4, 5, 6];
  if (["assignmentNotificationsIgnoreEntityTypeList", "assignmentEmailNotificationsIgnoreEntityTypeList"].includes(name)) {
    const key = name === "assignmentNotificationsIgnoreEntityTypeList" ? "assignmentNotificationsEntityList" : "assignmentEmailNotificationsEntityList";
    options = settings[key] || Object.keys(metadata.scopes || {}).filter((scope) => metadata.scopes[scope].entity && metadata.scopes[scope].tab);
  }
  if (!options?.length) return null;
  return options.map((option) => {
    if (name === "weekStart") return [String(option), option === -1 ? "Podle systému" : ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"][Number(option)]];
    if (name === "calendarScrollHour") {
      const hour = Number(option);
      const locale = String(language || "en").replace(/_/g, "-");
      const hourCycle: "h12" | "h23" = /(^|[^A-Za-z])h|[aA]/.test(timeFormat) ? "h12" : "h23";
      try { return [String(option), new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle, timeZone: "UTC" }).format(new Date(Date.UTC(2020, 0, 1, hour)))]; }
      catch { return [String(option), `${String(hour).padStart(2, "0")}:00`]; }
    }
    const key = String(option);
    const label = name === "language" ? (metadata.labels as any)?.Global?.options?.language?.[key] || key.replace("_", "-") : name === "theme" ? (metadata.labels as any)?.Global?.themes?.[key] || key : metadata.labels?.Global?.scopeNamesPlural?.[key] || key;
    return [key, label];
  });
}

function PreferenceChecklist({ label, options, value, onChange }: { label: string; options: Array<[string, string]>; value: any; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState("");
  const selected: string[] = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean) : [];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = options.filter(([, title]) => title.toLocaleLowerCase().includes(normalizedQuery));
  const allVisibleSelected = filtered.length > 0 && filtered.every(([key]) => selected.includes(key));
  function toggle(key: string, checked: boolean) {
    onChange(checked ? [...new Set([...selected, key])] : selected.filter((item) => item !== key));
  }
  function toggleVisible() {
    const visibleKeys = new Set(filtered.map(([key]) => key));
    onChange(allVisibleSelected ? selected.filter((item) => !visibleKeys.has(item)) : [...new Set([...selected, ...visibleKeys])]);
  }
  return <fieldset className="preference-checklist">
    <legend>{label}<span className="preference-selection-count">{selected.length} vybráno</span></legend>
    <div className="preference-checklist-tools"><label className="preference-checklist-search"><span className="sr-only">Filtrovat {label}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat v možnostech…"/></label><button type="button" className="button subtle" onClick={toggleVisible} disabled={!filtered.length}>{allVisibleSelected ? "Odebrat zobrazené" : "Vybrat zobrazené"}</button></div>
    <div className="preference-checklist-options">{filtered.map(([key, title]) => <label className={selected.includes(key) ? "selected" : ""} key={key}><input type="checkbox" checked={selected.includes(key)} onChange={(event) => toggle(key, event.target.checked)}/><span>{title}</span></label>)}{!filtered.length && <p className="preference-checklist-empty">Žádná možnost neodpovídá hledání.</p>}</div>
  </fieldset>;
}

function PreferenceControl({ field, value, metadata, settings, timeFormat, language, themeParams, onChange, onThemeParamsChange }: { field: PrefField; value: any; metadata: Metadata; settings: Data; timeFormat: string; language: string; themeParams: Data; onChange: (value: any) => void; onThemeParamsChange: (value: Data) => void }) {
  const { name, def } = field;
  const label = fieldLabel(name, def, "Preferences", metadata);
  const controlId = `pref-${name}`;
  const optionList = choices(name, def, metadata, settings, value, timeFormat, language);
  const type = def.type || "varchar";
  if (name === "theme") {
    const themes = ((metadata as any).themes || {}) as Data;
    const effectiveTheme = String(value || settings.theme || "Espo");
    const navbarDef = themes[effectiveTheme]?.params?.navbar || {};
    const navbarOptions: string[] = Array.isArray(navbarDef.options) && navbarDef.options.length > 1 ? navbarDef.options.map(String) : [];
    const navbarValue = String(themeParams?.navbar || navbarDef.default || "");
    function setTheme(nextTheme: string) {
      onChange(nextTheme);
      const nextNavbar = themes[nextTheme || settings.theme || "Espo"]?.params?.navbar || {};
      const nextOptions: string[] = Array.isArray(nextNavbar.options) ? nextNavbar.options.map(String) : [];
      if (nextOptions.length > 1 && !nextOptions.includes(navbarValue)) onThemeParamsChange({ ...(themeParams || {}), navbar: nextNavbar.default || nextOptions[0] });
    }
    return <div className="field-input preference-theme-field"><span>{label}</span><div className="theme-field-controls"><select id={controlId} value={value ?? ""} onChange={(event) => setTheme(event.target.value)}><option value="">Výchozí · {(metadata.labels as any)?.Global?.themes?.[settings.theme] || settings.theme || "Espo"}</option>{(optionList || []).map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select>{navbarOptions.length > 0 && <select aria-label="Rozložení navigace" value={navbarValue} onChange={(event) => onThemeParamsChange({ ...(themeParams || {}), navbar: event.target.value })}>{navbarOptions.map((navbar) => <option key={navbar} value={navbar}>{(metadata.labels as any)?.Global?.themeNavbars?.[navbar] || navbar}</option>)}</select>}</div></div>;
  }
  if (type === "bool") return <label className="preference-toggle" htmlFor={controlId}><span><strong>{label}</strong><small>{def.tooltip || "Osobní nastavení účtu."}</small></span><input id={controlId} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)}/><i/></label>;
  if (optionList && ["checklist", "multiEnum"].includes(type)) {
    return <PreferenceChecklist label={label} options={optionList} value={value} onChange={onChange}/>;
  }
  if (optionList) return <label className="field-input" htmlFor={controlId}><span>{label}{def.required && <i> *</i>}</span><select id={controlId} value={value ?? ""} required={def.required} onChange={(event) => onChange(event.target.value === "" ? "" : ["enumInt"].includes(type) || name === "weekStart" ? Number(event.target.value) : event.target.value)}><option value="">Výchozí nastavení</option>{optionList.map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></label>;
  if (type === "bool") return null;
  if (type === "wysiwyg") return <div className="field-input preference-signature"><span>{label}</span><WysiwygEditor value={String(value || "")} htmlMode entity="Preferences" field={name} onChange={onChange}/><small>HTML podpis se vkládá do nových e-mailů. Zprávy odeslané jako prostý text mohou odstranit formátování.</small></div>;
  if (["jsonArray", "jsonObject", "array", "checklist", "multiEnum"].includes(type)) {
    const structuredArray = name === "tabList";
    const serialized = ["array", "checklist", "multiEnum"].includes(type) && !structuredArray ? (Array.isArray(value) ? value.join("\n") : String(value || "")) : typeof value === "string" ? value : JSON.stringify(value ?? (type === "jsonArray" || structuredArray ? [] : {}), null, 2);
    return <label className="field-input preference-long-field" htmlFor={controlId}><span>{label}</span><textarea id={controlId} rows={5} value={serialized} onChange={(event) => onChange(event.target.value)} placeholder="Jedna hodnota na řádek nebo JSON"/><small>{structuredArray ? "Upravte JSON panelů a odkazů; zachovává i oddělovače navigace." : "Pole se uloží ve formátu očekávaném EspoCRM."}</small></label>;
  }
  const inputType = ["int", "float", "enumInt"].includes(type) ? "number" : "text";
  return <label className="field-input" htmlFor={controlId}><span>{label}{def.required && <i> *</i>}</span><input id={controlId} type={inputType} value={value ?? ""} required={def.required} maxLength={def.maxLength} onChange={(event) => onChange(event.target.value === "" ? "" : inputType === "number" ? Number(event.target.value) : event.target.value)}/></label>;
}

export function UserPreferencesView({ metadata, user, onBack }: { metadata: Metadata; user: User; onBack: () => void }) {
  const [settings, setSettings] = useState<Data>({});
  const [values, setValues] = useState<Data>({});
  const [original, setOriginal] = useState<Data>({});
  const [panels, setPanels] = useState<DetailLayoutPanel[]>([]);
  const [section, setSection] = useState(0);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const allowedTabScopes = useMemo(() => Object.entries(metadata.scopes || {}).filter(([scope, definition]) => {
    const item = definition as any;
    if (!item.tab || item.disabled || (user.type === "portal" && (item.disabledPortal || !item.aclPortal))) return false;
    if (item.acl && !canAccessEntity(metadata, scope)) return false;
    if (item.tabAclPermission) { const level = metadata.userAcl?.[item.tabAclPermission]; if (!level || level === "no") return false; }
    return true;
  }).map(([scope]) => scope), [metadata, user.type]);
  const dashboardLayoutAcl = metadata.userAcl?.fieldTable?.Preferences?.dashboardLayout;
  const canResetDashboard = user.type !== "portal" && dashboardLayoutAcl?.edit !== "no";
  useEffect(() => {
    let live = true;
    Promise.all([request<Data>("Settings"), request<Data>(`Preferences/${encodeURIComponent(user.id)}`), fetchLayout<DetailLayoutPanel[]>("Preferences", "detail")])
      .then(([system, prefs, layout]) => { if (!live) return; const merged = { ...system, ...prefs }; setSettings(system); setValues(merged); setOriginal(merged); setPanels(layout || []); })
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Preference se nepodařilo načíst."))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [user.id]);
  const fieldsBySection = useMemo(() => {
    const fields = metadata.entityDefs?.Preferences?.fields || {};
    const result: Array<{ title: string; fields: PrefField[] }> = [];
    const isPortal = user.type === "portal";
    const isVisible = (name: string) => {
      if (["tabList", "addCustomTabs"].includes(name) && !values.useCustomTabList) return false;
      if (name === "followCreatedEntityTypeList" && values.followCreatedEntities) return false;
      if (name === "tabColorsDisabled" && values.scopeColorsDisabled) return false;
      if (name === "dashboardLayout" && user.type !== "admin") return false;
      if (name === "theme" && settings.userThemesDisabled) return false;
      if (name === "emailUseExternalClient" && settings.emailForceUseExternalClient) return false;
      if (["receiveAssignmentEmailNotifications", "assignmentEmailNotificationsIgnoreEntityTypeList"].includes(name) && (!settings.assignmentEmailNotifications || isPortal)) return false;
      if (name === "assignmentEmailNotificationsIgnoreEntityTypeList" && !(settings.assignmentEmailNotificationsEntityList || []).length) return false;
      if (name === "assignmentNotificationsIgnoreEntityTypeList" && (!(settings.assignmentNotificationsEntityList || []).length || isPortal)) return false;
      if (name === "receiveMentionEmailNotifications" && (!settings.mentionEmailNotifications || isPortal)) return false;
      if (name === "receiveStreamEmailNotifications" && (isPortal ? !settings.portalStreamEmailNotifications : !settings.streamEmailNotifications)) return false;
      return true;
    };
    let currentTitle = "Obecné";
    for (const panel of panels) {
      if (panel.tabBreak) currentTitle = localizeLayoutLabel(panel.tabLabel) || "Obecné";
      const fieldNames = (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name ? [item.name] : []);
      if (!fieldNames.length) continue;
      let group = result.find((item) => item.title === currentTitle);
      if (!group) { group = { title: currentTitle, fields: [] }; result.push(group); }
      for (const name of fieldNames) {
        const def = fields[name];
        const fieldAcl = (metadata.userAcl?.fieldTable as any)?.Preferences?.[name];
        if (["no", "hidden"].includes(fieldAcl?.read) || ["no", "hidden"].includes(fieldAcl?.edit)) continue;
        if (!def || def.notStorable || def.readOnly || def.disabled || def.hidden || def.utility || !isVisible(name) || group.fields.some((field) => field.name === name)) continue;
        if (["dashboard"].includes(name)) continue;
        group.fields.push({ name, def, section: currentTitle });
      }
    }
    return result.filter((group) => group.fields.length);
  }, [metadata, panels, settings, values, user.type]);
  const activeSection = fieldsBySection[Math.min(section, Math.max(fieldsBySection.length - 1, 0))];
  const changed: Data = {};
  if (activeSection) for (const { name, def } of fieldsBySection.flatMap((group) => group.fields)) {
    const now = values[name] ?? def.default ?? null;
    const before = original[name] ?? def.default ?? null;
    if (JSON.stringify(now) !== JSON.stringify(before)) {
      if (["jsonArray", "jsonObject"].includes(def.type || "") && typeof now === "string") {
        try { changed[name] = JSON.parse(now); } catch { /* Invalid JSON is reported when saving. */ }
      } else if (name === "tabList" && typeof now === "string") {
        try { changed[name] = JSON.parse(now); } catch { /* Invalid JSON is reported when saving. */ }
      } else if (["array", "checklist", "multiEnum"].includes(def.type || "") && typeof now === "string") changed[name] = now.split("\n").map((item: string) => item.trim()).filter(Boolean);
      else changed[name] = now;
    }
  }
  if (JSON.stringify(values.themeParams || {}) !== JSON.stringify(original.themeParams || {})) changed.themeParams = values.themeParams || {};
  if (JSON.stringify(values.dashletsOptions || {}) !== JSON.stringify(original.dashletsOptions || {})) changed.dashletsOptions = values.dashletsOptions || {};
  if (Boolean(values.dashboardLocked) !== Boolean(original.dashboardLocked)) changed.dashboardLocked = Boolean(values.dashboardLocked);
  async function save() {
    setError(""); setNotice("");
    for (const [name, value] of Object.entries(values)) if (typeof value === "string" && (["jsonArray", "jsonObject"].includes(metadata.entityDefs?.Preferences?.fields?.[name]?.type || "") || name === "tabList") && value.trim()) {
      try { JSON.parse(value); } catch { setError(`Pole ${fieldLabel(name, metadata.entityDefs?.Preferences?.fields?.[name], "Preferences", metadata)} neobsahuje platný JSON.`); return; }
    }
    if (!Object.keys(changed).length) { setNotice("Všechny preference jsou uložené."); return; }
    setSaving(true);
    try {
      await request(`Preferences/${encodeURIComponent(user.id)}`, { method: "PUT", body: JSON.stringify(changed) });
      const next = { ...values, ...changed }; setValues(next); setOriginal(next); setNotice("Preference byly uloženy.");
      if (["language", "theme", "pageContentWidth", "themeParams"].some((key) => key in changed)) window.setTimeout(() => window.location.reload(), 900);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Preference se nepodařilo uložit."); }
    finally { setSaving(false); }
  }
  async function resetAll() {
    setSaving(true); setError(""); setNotice("");
    try { await request(`Preferences/${encodeURIComponent(user.id)}`, { method: "DELETE" }); window.location.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Výchozí preference se nepodařilo obnovit."); setSaving(false); }
  }
  async function resetDashboard() {
    setSaving(true); setError(""); setNotice("");
    try { const fresh = await request<Data>("Preferences/action/resetDashboard", { method: "POST", body: JSON.stringify({ id: user.id }) }); const next = { ...values, ...fresh }; setValues(next); setOriginal((current) => ({ ...current, ...fresh })); setNotice("Rozložení dashboardu bylo obnoveno."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Dashboard se nepodařilo obnovit."); }
    finally { setSaving(false); }
  }
  return <div className="admin-view user-account-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Zpět do CRM</button><div className="eyebrow">OSOBNÍ NASTAVENÍ</div><h1>Moje preference</h1><p>Jazyk, formáty, kalendář, vzhled a upozornění pro účet {user.name}.</p></div><div className="account-toolbar">{canResetDashboard && <button className="button subtle" onClick={() => void resetDashboard()} disabled={busy || saving}><RotateCcw size={14}/>Obnovit dashboard</button>}<button className="button subtle" onClick={() => setConfirmReset(true)} disabled={busy || saving}><RotateCcw size={14}/>Obnovit preference</button><button className="button primary" onClick={() => void save()} disabled={busy || saving || !Object.keys(changed).length}><Save size={15}/>{saving ? "Ukládám…" : "Uložit"}</button></div></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    {busy ? <div className="surface table-loading"><span className="spinner"/>Načítám preference a nativní layout…</div> : fieldsBySection.length ? <><nav className="preference-tabs">{fieldsBySection.map((item, index) => <button className={index === section ? "active" : ""} key={item.title} onClick={() => setSection(index)}>{item.title}<span>{item.fields.length}</span></button>)}</nav><section className="surface preference-panel"><div className="settings-card-head"><div><h2>{activeSection?.title}</h2><p>Rozložení a pole načtená z konfigurace instalace.</p></div></div><div className="settings-fields">{activeSection?.fields.map((field) => field.name === "tabList" ? <div className="field-input admin-tab-list-field preference-tab-list-field" key={field.name}><span>{fieldLabel(field.name, field.def, "Preferences", metadata)}</span><AdminTabListEditor value={Array.isArray(values.tabList) ? values.tabList : []} metadata={metadata} allowedScopes={allowedTabScopes} onChange={(tabList) => setValues((current) => ({ ...current, tabList }))}/><small className="field-hint">Vyberte moduly dostupné vašemu účtu a uspořádejte je v navigaci. Změny se projeví po uložení.</small></div> : field.name === "dashboardLayout" ? <div className="field-input dashboard-layout-field" key={field.name}><span>{fieldLabel(field.name, field.def, "Preferences", metadata)}</span><DashboardLayoutEditor value={values.dashboardLayout} options={values.dashletsOptions || {}} metadata={metadata} onChange={(dashboardLayout) => setValues((current) => ({ ...current, dashboardLayout }))} onOptionsChange={(dashletsOptions) => setValues((current) => ({ ...current, dashletsOptions }))}/><label className="preference-toggle"><span><strong>Uzamknout dashboard</strong><small>Uživatelé nebudou moci měnit pořadí, přidávat ani odebírat panely.</small></span><input type="checkbox" checked={Boolean(values.dashboardLocked)} onChange={(event) => setValues((current) => ({ ...current, dashboardLocked: event.target.checked }))}/><i/></label></div> : <PreferenceControl key={field.name} field={field} value={values[field.name] ?? field.def.default ?? ""} metadata={metadata} settings={settings} timeFormat={String(values.timeFormat || settings.timeFormat || "HH:mm:ss")} language={String(values.language || settings.language || "en_US")} themeParams={values.themeParams || {}} onThemeParamsChange={(themeParams) => setValues((current) => ({ ...current, themeParams }))} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}/>)}</div></section></> : <div className="surface table-loading">Pro tento účet nejsou z layoutu EspoCRM dostupná žádná editovatelná pole.</div>}
    {confirmReset && <div className="modal-backdrop"><section className="record-modal account-confirm"><div className="modal-heading"><div><span className="eyebrow">POTVRZENÍ</span><h2>Obnovit preference?</h2></div><button className="icon-button" onClick={() => setConfirmReset(false)} aria-label="Zavřít"><X size={16}/></button></div><p>Tato akce odstraní osobní nastavení a načte výchozí hodnoty EspoCRM.</p><div className="modal-footer"><button className="button subtle" onClick={() => setConfirmReset(false)}>Zrušit</button><button className="button danger" onClick={() => void resetAll()} disabled={saving}>Obnovit</button></div></section></div>}
  </div>;
}

export function UserSecurityView({ metadata, user, onBack, adminMode = false, onLogout }: { metadata: Metadata; user: User; onBack: () => void; adminMode?: boolean; onLogout?: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [security, setSecurity] = useState<Data>({});
  const [appSettings, setAppSettings] = useState<Data>({});
  const [twoFactor, setTwoFactor] = useState(false);
  const [changingMethod, setChangingMethod] = useState(false);
  const [method, setMethod] = useState("Totp");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [setupLabel, setSetupLabel] = useState("");
  const [setupQr, setSetupQr] = useState("");
  const [setupOptions, setSetupOptions] = useState<string[]>([]);
  const [setupOption, setSetupOption] = useState("");
  const [setupReady, setSetupReady] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const availableMethods: string[] = appSettings.auth2FAMethodList || [];
  const methodLabel = (value: string) => (metadata.labels as any)?.Settings?.options?.auth2FAMethodList?.[value] || ({ Totp: "Autentizační aplikace", Email: "E-mail", Sms: "SMS" } as Record<string, string>)[value] || value;
  const twoFactorAllowed = Boolean(appSettings.auth2FA) && (user.type !== "portal" || Boolean(appSettings.auth2FAInPortal)) && ["admin", "super-admin", "regular", "portal"].includes(user.type || "");
  useEffect(() => {
    if (!setupSecret) { setSetupQr(""); return; }
    let live = true;
    const label = setupLabel || user.name || user.userName;
    const uri = `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(setupSecret)}`;
    void QRCode.toDataURL(uri, { width: 224, margin: 2, errorCorrectionLevel: "H", color: { dark: "#172033", light: "#ffffff" } })
      .then((url) => live && setSetupQr(url))
      .catch(() => live && setError("QR kód pro autentizační aplikaci se nepodařilo vytvořit."));
    return () => { live = false; };
  }, [setupSecret, setupLabel, user.name, user.userName]);
  useEffect(() => { let live = true; Promise.all([request<Data>(`UserSecurity/${encodeURIComponent(user.id)}`), request<Data>("Settings")]).then(([data, configData]) => { if (live) { setSecurity(data); setAppSettings(configData); setTwoFactor(Boolean(data.auth2FA)); setMethod(data.auth2FAMethod || configData.auth2FAMethodList?.[0] || "Totp"); } }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Nastavení zabezpečení nelze načíst.")).finally(() => live && setBusy(false)); return () => { live = false; }; }, [user.id]);
  async function changePassword(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (newPassword !== confirmPassword) { setError("Nové heslo a jeho potvrzení se neshodují."); return; }
    if (!newPassword) { setError("Zadejte nové heslo."); return; }
    setSaving(true);
    try { await request("UserSecurity/password", { method: "PUT", body: JSON.stringify({ password: newPassword, currentPassword }) }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setNotice("Heslo bylo změněno."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Heslo se nepodařilo změnit."); }
    finally { setSaving(false); }
  }
  async function startTwoFactor() {
    setError(""); setNotice(""); setSaving(true);
    try {
      const data = await request<Data>("UserSecurity/action/getTwoFactorUserSetupData", { method: "POST", body: JSON.stringify({ id: user.id, password: setupPassword, auth2FAMethod: method, reset: false }) });
      setSetupSecret(data.auth2FATotpSecret || "");
      setSetupLabel(String(data.label || user.name || user.userName));
      const options: string[] = method === "Email" ? data.emailAddressList || [] : method === "Sms" ? data.phoneNumberList || [] : [];
      setSetupOptions(options); setSetupOption(options[0] || ""); setSetupReady(true); setCodeSent(false);
      if (method === "Totp" && !data.auth2FATotpSecret) throw new Error("Poskytovatel nevrátil konfigurační tajný klíč.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nastavení dvoufázového ověření nelze zahájit."); }
    finally { setSaving(false); }
  }
  async function sendTwoFactorCode() {
    if (!setupOption) { setError("Vyberte adresu nebo telefonní číslo."); return; }
    const provider = method === "Email" ? "TwoFactorEmail" : "TwoFactorSms";
    const field = method === "Email" ? "emailAddress" : "phoneNumber";
    setSaving(true); setError("");
    try { await request(`${provider}/action/sendCode`, { method: "POST", body: JSON.stringify({ id: user.id, [field]: setupOption }) }); setCodeSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Ověřovací kód se nepodařilo odeslat."); }
    finally { setSaving(false); }
  }
  async function saveTwoFactor(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const providerField = method === "Email" ? { emailAddress: setupOption } : method === "Sms" ? { phoneNumber: setupOption } : { auth2FATotpSecret: setupSecret };
      await request(`UserSecurity/${encodeURIComponent(user.id)}`, { method: "PUT", body: JSON.stringify({ password: setupPassword, auth2FA: true, auth2FAMethod: method, ...providerField, code: verificationCode }) });
      setSecurity({ auth2FA: true, auth2FAMethod: method }); setTwoFactor(true); setChangingMethod(false); setSetupSecret(""); setSetupLabel(""); setSetupPassword(""); setVerificationCode(""); setSetupReady(false); setCodeSent(false); setNotice(changingMethod ? "Metoda dvoufázového ověření byla změněna." : "Dvoufázové ověření je zapnuté.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dvoufázové ověření se nepodařilo aktivovat."); }
    finally { setSaving(false); }
  }
  async function disableTwoFactor() {
    if (!window.confirm("Opravdu chcete vypnout dvoufázové ověření?")) return;
    setError(""); setNotice(""); setSaving(true);
    try { await request(`UserSecurity/${encodeURIComponent(user.id)}`, { method: "PUT", body: JSON.stringify({ password: setupPassword, auth2FA: false }) }); setSecurity({ auth2FA: false }); setTwoFactor(false); setSetupPassword(""); setNotice("Dvoufázové ověření bylo vypnuto."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Dvoufázové ověření se nepodařilo vypnout."); }
    finally { setSaving(false); }
  }
  async function resetTwoFactor() {
    if (!adminMode || !setupPassword || !window.confirm(`Resetovat dvoufázové ověření účtu ${user.name}? Uživatel bude muset 2FA znovu nastavit.`)) return;
    setError(""); setNotice(""); setSaving(true);
    try {
      await request("UserSecurity/action/getTwoFactorUserSetupData", { method: "POST", body: JSON.stringify({ id: user.id, password: setupPassword, auth2FAMethod: security.auth2FAMethod || method, reset: true }) });
      setSecurity({ auth2FA: false, auth2FAMethod: null }); setTwoFactor(false); setSetupPassword("");
      setNotice("Dvoufázové ověření bylo resetováno. Uživatel si ho může znovu nastavit.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dvoufázové ověření se nepodařilo resetovat."); }
    finally { setSaving(false); }
  }
  return <div className={`admin-view user-account-view ${adminMode ? "admin-user-security" : ""}`}><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> {adminMode ? "Zpět na uživatele" : "Zpět do CRM"}</button><div className="eyebrow">ÚČET A PŘÍSTUP</div><h1>Zabezpečení</h1><p>{adminMode ? `Správa dvoufázového ověření účtu ${user.name}.` : `Změna hesla a nastavení dvoufázového ověření pro ${user.name}.`}</p></div></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}{busy ? <div className="surface table-loading"><span className="spinner"/>Načítám zabezpečení…</div> : <div className="security-grid">{!adminMode && <form className="surface security-card" onSubmit={changePassword}><div className="settings-card-head"><div><h2><KeyRound size={17}/>Změnit heslo</h2><p>Změna se ověřuje přímo serverem EspoCRM.</p></div></div><label className="field-input"><span>Současné heslo</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required/></label><label className="field-input"><span>Nové heslo</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required/></label><label className="field-input"><span>Potvrdit nové heslo</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/></label><button className="button primary" disabled={saving}><Save size={14}/>{saving ? "Ukládám…" : "Změnit heslo"}</button></form>}
    <section className="surface security-card"><div className="settings-card-head"><div><h2><Shield size={17}/>Dvoufázové ověření</h2><p>{twoFactor ? `Aktivní metoda: ${methodLabel(security.auth2FAMethod || "")}` : "Při přihlášení bude potřeba jednorázový ověřovací kód."}</p></div><span className={`security-state ${twoFactor ? "enabled" : "disabled"}`}>{twoFactor ? "Zapnuto" : "Vypnuto"}</span></div>
    {twoFactor && !changingMethod ? <><label className="field-input"><span>{adminMode ? "Heslo administrátora" : "Ověřte heslem pro vypnutí"}</span><input type="password" autoComplete="current-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)}/></label><div className="security-actions"><button className="button subtle" onClick={() => { setChangingMethod(true); setMethod(security.auth2FAMethod || availableMethods[0] || "Totp"); setSetupPassword(""); setError(""); }} disabled={saving}><RefreshCw size={14}/>Změnit metodu</button><button className="button danger" onClick={() => void disableTwoFactor()} disabled={saving || !setupPassword}>Vypnout 2FA</button>{adminMode && <button className="button subtle" onClick={() => void resetTwoFactor()} disabled={saving || !setupPassword}><RotateCcw size={14}/>Resetovat 2FA uživatele</button>}</div></> : !twoFactorAllowed || !availableMethods.length ? <p className="security-unavailable">Dvoufázové ověření není pro tento typ účtu nebo v této instalaci povolené.</p> : setupSecret || codeSent ? <form onSubmit={saveTwoFactor}><p className="security-instruction">{method === "Totp" ? "Naskenujte QR kód autentizační aplikací, případně tajný klíč zadejte ručně. Poté zadejte vygenerovaný kód." : `Zadejte ověřovací kód odeslaný na ${setupOption}.`}</p>{setupSecret && method === "Totp" && <div className="totp-setup-qr">{setupQr ? <img src={setupQr} alt="QR kód pro nastavení TOTP"/> : <span className="spinner"/>}<small>{setupLabel}</small></div>}{setupSecret && <div className="totp-secret">{setupSecret}</div>}<label className="field-input"><span>Ověřovací kód</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required/></label><div className="account-toolbar"><button type="button" className="button subtle" onClick={() => { setChangingMethod(false); setSetupSecret(""); setSetupLabel(""); setVerificationCode(""); setCodeSent(false); setSetupReady(false); }}>Zrušit</button><button className="button primary" disabled={saving || verificationCode.length < 6}>{saving ? "Ověřuji…" : changingMethod ? "Potvrdit novou metodu" : "Zapnout 2FA"}</button></div></form> : setupReady && method !== "Totp" ? <><label className="field-input"><span>{method === "Email" ? "E-mailová adresa" : "Telefonní číslo"}</span><select value={setupOption} onChange={(event) => setSetupOption(event.target.value)}>{setupOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="field-actions"><button className="button subtle" onClick={() => { setChangingMethod(false); setSetupReady(false); setSetupOptions([]); }}>Zrušit</button><button className="button primary" onClick={() => void sendTwoFactorCode()} disabled={saving || !setupOption}>{saving ? "Odesílám…" : "Odeslat kód"}</button></div></> : <><label className="field-input"><span>{adminMode ? "Heslo administrátora" : "Současné heslo"}</span><input type="password" autoComplete="current-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)}/></label><label className="field-input"><span>Metoda</span><select value={method} onChange={(event) => { setMethod(event.target.value); setSetupReady(false); setSetupSecret(""); setCodeSent(false); }}>{availableMethods.map((item) => <option key={item} value={item}>{methodLabel(item)}</option>)}</select></label><button className="button primary" onClick={() => void startTwoFactor()} disabled={saving || !setupPassword}>{saving ? "Připravuji…" : changingMethod ? "Ověřit a změnit metodu" : "Nastavit dvoufázové ověření"}</button></>}
    </section></div>}{!adminMode && onLogout && <AccountSessions onLogout={onLogout}/>}
  </div>;
}
