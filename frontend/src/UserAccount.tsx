import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Check, KeyRound, RefreshCw, RotateCcw, Save, Shield, X } from "./Icons";
import QRCode from "qrcode";
import AccountSessions from "./AccountSessions";
import { request } from "./api";
import type { Metadata, User } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type Data = Record<string, any>;

export function UserSecurityView({ metadata, user, onBack, adminMode = false, onLogout, requiredMode = false, onTwoFactorEnabled }: { metadata: Metadata; user: User; onBack: () => void; adminMode?: boolean; onLogout?: () => void; requiredMode?: boolean; onTwoFactorEnabled?: () => void }) {
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
  const [pendingSecurityAction, setPendingSecurityAction] = useState<"disable" | "reset" | null>(null);
  const securityDialogRef = useDialogFocus<HTMLElement>(() => { if (!saving && !busy) setPendingSecurityAction(null); }, !saving && !busy, Boolean(pendingSecurityAction));
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
      if (requiredMode) onTwoFactorEnabled?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dvoufázové ověření se nepodařilo aktivovat."); }
    finally { setSaving(false); }
  }
  async function disableTwoFactor() {
    setPendingSecurityAction("disable");
  }
  async function performDisableTwoFactor() {
    setError(""); setNotice(""); setSaving(true);
    try { await request(`UserSecurity/${encodeURIComponent(user.id)}`, { method: "PUT", body: JSON.stringify({ password: setupPassword, auth2FA: false }) }); setSecurity({ auth2FA: false }); setTwoFactor(false); setSetupPassword(""); setNotice("Dvoufázové ověření bylo vypnuto."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Dvoufázové ověření se nepodařilo vypnout."); }
    finally { setSaving(false); }
  }
  async function resetTwoFactor() {
    if (!adminMode || !setupPassword) return;
    setPendingSecurityAction("reset");
  }
  async function performResetTwoFactor() {
    setError(""); setNotice(""); setSaving(true);
    try {
      await request("UserSecurity/action/getTwoFactorUserSetupData", { method: "POST", body: JSON.stringify({ id: user.id, password: setupPassword, auth2FAMethod: security.auth2FAMethod || method, reset: true }) });
      setSecurity({ auth2FA: false, auth2FAMethod: null }); setTwoFactor(false); setSetupPassword("");
      setNotice("Dvoufázové ověření bylo resetováno. Uživatel si ho může znovu nastavit.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dvoufázové ověření se nepodařilo resetovat."); }
    finally { setSaving(false); }
  }
  async function confirmSecurityAction() {
    const action = pendingSecurityAction;
    if (!action || saving || busy) return;
    setPendingSecurityAction(null);
    if (action === "disable") await performDisableTwoFactor();
    else await performResetTwoFactor();
  }
  return <div className={`admin-view user-account-view ${adminMode ? "admin-user-security" : ""} ${requiredMode ? "required-two-factor-view" : ""}`}><div className="entity-heading"><div>{!requiredMode && <button className="back-link" onClick={onBack}><ArrowLeft size={14}/> {adminMode ? "Zpět na uživatele" : "Zpět do CRM"}</button>}<div className="eyebrow">{requiredMode ? "POVINNÉ ZABEZPEČENÍ" : "ÚČET A PŘÍSTUP"}</div><h1>{requiredMode ? "Nastavit dvoufázové ověření" : "Zabezpečení"}</h1><p>{requiredMode ? `Administrátor vyžaduje dvoufázové ověření pro účet ${user.name}. Nastavení dokončete, abyste mohli pokračovat.` : adminMode ? `Správa dvoufázového ověření účtu ${user.name}.` : `Změna hesla a nastavení dvoufázového ověření pro ${user.name}.`}</p></div>{requiredMode && onLogout && <button type="button" className="button subtle" onClick={onLogout}><ArrowLeft size={14}/>Odhlásit se</button>}</div>
    {error && <div className="table-error" role="alert">{error}</div>}{notice && <div className="save-confirm" role="status"><Check size={15}/>{notice}</div>}{busy ? <div className="surface table-loading"><span className="spinner"/>Načítám zabezpečení…</div> : <div className="security-grid">{!adminMode && !requiredMode && <form className="surface security-card" onSubmit={changePassword}><div className="settings-card-head"><div><h2><KeyRound size={17}/>Změnit heslo</h2><p>Změna se ověřuje přímo serverem ViaCRM.</p></div></div><label className="field-input"><span>Současné heslo</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required/></label><label className="field-input"><span>Nové heslo</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required/></label><label className="field-input"><span>Potvrdit nové heslo</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/></label><button className="button primary" disabled={saving}><Save size={14}/>{saving ? "Ukládám…" : "Změnit heslo"}</button></form>}
    <section className="surface security-card"><div className="settings-card-head"><div><h2><Shield size={17}/>Dvoufázové ověření</h2><p>{twoFactor ? `Aktivní metoda: ${methodLabel(security.auth2FAMethod || "")}` : "Při přihlášení bude potřeba jednorázový ověřovací kód."}</p></div><span className={`security-state ${twoFactor ? "enabled" : "disabled"}`}>{twoFactor ? "Zapnuto" : "Vypnuto"}</span></div>
    {twoFactor && !changingMethod ? <><label className="field-input"><span>{adminMode ? "Heslo administrátora" : "Ověřte heslem pro vypnutí"}</span><input type="password" autoComplete="current-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)}/></label><div className="security-actions"><button className="button subtle" onClick={() => { setChangingMethod(true); setMethod(security.auth2FAMethod || availableMethods[0] || "Totp"); setSetupPassword(""); setError(""); }} disabled={saving}><RefreshCw size={14}/>Změnit metodu</button><button className="button danger" onClick={() => void disableTwoFactor()} disabled={saving || !setupPassword}>Vypnout 2FA</button>{adminMode && <button className="button subtle" onClick={() => void resetTwoFactor()} disabled={saving || !setupPassword}><RotateCcw size={14}/>Resetovat 2FA uživatele</button>}</div></> : !twoFactorAllowed || !availableMethods.length ? <p className="security-unavailable">Dvoufázové ověření není pro tento typ účtu nebo v této instalaci povolené.</p> : setupSecret || codeSent ? <form onSubmit={saveTwoFactor}><p className="security-instruction">{method === "Totp" ? "Naskenujte QR kód autentizační aplikací, případně tajný klíč zadejte ručně. Poté zadejte vygenerovaný kód." : `Zadejte ověřovací kód odeslaný na ${setupOption}.`}</p>{setupSecret && method === "Totp" && <div className="totp-setup-qr">{setupQr ? <img src={setupQr} alt="QR kód pro nastavení TOTP"/> : <span className="spinner"/>}<small>{setupLabel}</small></div>}{setupSecret && <div className="totp-secret">{setupSecret}</div>}<label className="field-input"><span>Ověřovací kód</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required/></label><div className="account-toolbar"><button type="button" className="button subtle" onClick={() => { setChangingMethod(false); setSetupSecret(""); setSetupLabel(""); setVerificationCode(""); setCodeSent(false); setSetupReady(false); }}>Zrušit</button><button className="button primary" disabled={saving || verificationCode.length < 6}>{saving ? "Ověřuji…" : changingMethod ? "Potvrdit novou metodu" : "Zapnout 2FA"}</button></div></form> : setupReady && method !== "Totp" ? <><label className="field-input"><span>{method === "Email" ? "E-mailová adresa" : "Telefonní číslo"}</span><select value={setupOption} onChange={(event) => setSetupOption(event.target.value)}>{setupOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="field-actions"><button className="button subtle" onClick={() => { setChangingMethod(false); setSetupReady(false); setSetupOptions([]); }}>Zrušit</button><button className="button primary" onClick={() => void sendTwoFactorCode()} disabled={saving || !setupOption}>{saving ? "Odesílám…" : "Odeslat kód"}</button></div></> : <><label className="field-input"><span>{adminMode ? "Heslo administrátora" : "Současné heslo"}</span><input type="password" autoComplete="current-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)}/></label><label className="field-input"><span>Metoda</span><select value={method} onChange={(event) => { setMethod(event.target.value); setSetupReady(false); setSetupSecret(""); setCodeSent(false); }}>{availableMethods.map((item) => <option key={item} value={item}>{methodLabel(item)}</option>)}</select></label><button className="button primary" onClick={() => void startTwoFactor()} disabled={saving || !setupPassword}>{saving ? "Připravuji…" : changingMethod ? "Ověřit a změnit metodu" : "Nastavit dvoufázové ověření"}</button></>}
    </section></div>}{!adminMode && !requiredMode && onLogout && <AccountSessions onLogout={onLogout}/>}
    {pendingSecurityAction && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && !busy && setPendingSecurityAction(null)}><section ref={securityDialogRef} className="record-modal security-action-confirm" role="alertdialog" aria-modal="true" aria-labelledby="security-action-title" aria-describedby="security-action-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">ZABEZPEČENÍ ÚČTU · 2FA</span><h2 id="security-action-title">{pendingSecurityAction === "disable" ? "Vypnout dvoufázové ověření?" : "Resetovat dvoufázové ověření?"}</h2><p id="security-action-description">{pendingSecurityAction === "disable" ? <>Dvoufázové ověření účtu <strong>{user.name}</strong> se vypne. Při příštím přihlášení už nebude vyžadován jednorázový kód.</> : <>Dvoufázové ověření účtu <strong>{user.name}</strong> bude resetováno. Uživatel se bude muset při příštím přihlášení znovu zaregistrovat.</>}</p></div><button type="button" className="icon-button" aria-label="Zrušit akci" onClick={() => setPendingSecurityAction(null)}><X size={16}/></button></div><div className="modal-footer"><button type="button" autoFocus className="button subtle" onClick={() => setPendingSecurityAction(null)}>Zrušit</button><button type="button" className="button danger" onClick={() => void confirmSecurityAction()}>{pendingSecurityAction === "disable" ? "Vypnout 2FA" : "Resetovat 2FA"}</button></div></section></div>}
  </div>;
}

export function RequiredTwoFactorGate({ metadata, user, onLogout, onComplete }: { metadata: Metadata; user: User; onLogout: () => void; onComplete: () => void }) {
  const [setupOpen, setSetupOpen] = useState(false);
  const introRef = useDialogFocus<HTMLElement>(() => {}, false, !setupOpen);
  const setupRef = useDialogFocus<HTMLElement>(() => {}, false, setupOpen);
  if (setupOpen) return <div className="required-two-factor-backdrop"><section ref={setupRef} className="required-two-factor-setup" role="dialog" aria-modal="true" aria-label="Povinné nastavení dvoufázového ověření" tabIndex={-1}><UserSecurityView metadata={metadata} user={user} onBack={() => {}} onLogout={onLogout} requiredMode onTwoFactorEnabled={onComplete}/></section></div>;
  return <div className="required-two-factor-backdrop"><section ref={introRef} className="record-modal required-two-factor-intro" role="alertdialog" aria-modal="true" aria-labelledby="required-two-factor-title" aria-describedby="required-two-factor-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">POVINNÉ ZABEZPEČENÍ ÚČTU</span><h2 id="required-two-factor-title">Nastavte dvoufázové ověření</h2><p id="required-two-factor-description">Správce této instalace vyžaduje při přihlašování druhý ověřovací krok. Než budete pokračovat do CRM, nastavte jej pro svůj účet.</p></div><span className="required-two-factor-icon"><Shield size={20}/></span></div><div className="required-two-factor-actions"><button type="button" className="button subtle" onClick={onLogout}>Odhlásit se</button><button type="button" autoFocus className="button primary" onClick={() => setSetupOpen(true)}>Nastavit ověření</button></div></section></div>;
}
