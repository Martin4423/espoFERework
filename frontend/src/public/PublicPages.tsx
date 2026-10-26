import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ApiError, fieldErrorsText } from "../problem.ts";
import { T, getLocale, setLocale, useLocale } from "../i18n/index.ts";
import { publicJson, useBranding, useLoginOptions } from "./client.ts";
import type { PublicRoute } from "./client.ts";

// The pages a person reaches from a link without signing in: password reset, lead form, lead confirmation.

export function BrandMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return <div className="brand lockup">{logoUrl ? <img src={logoUrl} alt="" className="brand-logo" style={{ height: 32 }} /> : <span className="brand-mark">{name.slice(0, 1).toUpperCase()}</span>}<span>{name}</span></div>;
}

function PublicShell({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  useLocale();
  const branding = useBranding();
  const locale = getLocale();
  return <main className="login-page public-page">
    <section className="login-story"><BrandMark name={branding.appName} logoUrl={branding.logoUrl} /><div className="story-foot"><span>{branding.appName}</span></div></section>
    <section className="login-side">
      <div className="login-card" data-testid={testId}>
        <h2>{title}</h2>
        {children}
      </div>
      <div className="login-bottom">
        <button type="button" className="login-recovery-link" aria-pressed={locale === "cs"} onClick={() => setLocale("cs")}>Čeština</button><span>·</span>
        <button type="button" className="login-recovery-link" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button>
      </div>
    </section>
  </main>;
}

const problemText = (cause: unknown, label: (field: string) => string = (field) => field) =>
  cause instanceof ApiError && cause.errors.length ? fieldErrorsText(cause, label) : cause instanceof Error ? cause.message : T("Operace se nezdařila.", "The operation failed.");

const goHome = () => { window.location.assign("/"); };

// "Forgot the password": the answer is the same for every address, so the page never says whether the account exists.
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await publicJson("/v1/auth/password-recovery", { method: "POST", body: JSON.stringify({ email: email.trim() }) }); setSent(true); }
    catch (cause) { setError(problemText(cause)); }
    finally { setBusy(false); }
  }
  if (sent) return <div data-testid="recovery-sent"><p className="login-hint">{T("Pokud k této adrese existuje účet, poslali jsme na ni odkaz pro nastavení nového hesla. Odkaz platí hodinu.", "If an account exists for this address, we sent it a link to set a new password. The link is valid for one hour.")}</p><button type="button" className="button" onClick={onBack}>{T("Zpět na přihlášení", "Back to sign-in")}</button></div>;
  return <form onSubmit={submit} data-testid="recovery-form">
    <p className="login-hint">{T("Zadejte e-mail účtu, pošleme vám odkaz pro nastavení nového hesla.", "Enter the e-mail of your account and we will send you a link to set a new password.")}</p>
    <label>{T("E-mail", "E-mail")}<input type="email" name="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    {error && <div className="inline-error" role="alert">{error}</div>}
    <button className="button primary login-submit" disabled={busy || !email.trim()}>{busy ? T("Odesílám…", "Sending…") : T("Poslat odkaz", "Send the link")}</button>
    <button type="button" className="login-recovery-link" onClick={onBack}>{T("Zpět na přihlášení", "Back to sign-in")}</button>
  </form>;
}

function ResetPasswordPage({ token }: { token: string }) {
  useLocale();
  const options = useLoginOptions();
  const [state, setState] = useState<"checking" | "valid" | "invalid" | "done">("checking");
  const [limits, setLimits] = useState({ min: 12, max: 128 });
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    if (!token) { setState("invalid"); return; }
    publicJson<{ minLength: number; maxLength: number }>(`/v1/auth/password-recovery/${encodeURIComponent(token)}`)
      .then((value) => { if (live) { setLimits({ min: value.minLength, max: value.maxLength }); setState("valid"); } })
      .catch(() => { if (live) setState("invalid"); });
    return () => { live = false; };
  }, [token]);
  const label = (field: string) => field === "newPassword" ? T("Nové heslo", "New password") : field === "token" ? T("Odkaz", "Link") : field;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== again) { setError(T("Hesla se neshodují.", "The passwords do not match.")); return; }
    setBusy(true); setError("");
    try { await publicJson("/v1/auth/password-reset", { method: "POST", body: JSON.stringify({ token, newPassword: password }) }); setState("done"); }
    catch (cause) { setError(cause instanceof ApiError && cause.errors.some((e) => e.code === "INVALID_TOKEN") ? T("Odkaz už neplatí. Vyžádejte si nový.", "The link is no longer valid. Request a new one.") : problemText(cause, label)); }
    finally { setBusy(false); }
  }
  return <PublicShell title={T("Nové heslo", "New password")} testId="reset-password">
    {state === "checking" && <p className="login-hint">{T("Kontroluji odkaz…", "Checking the link…")}</p>}
    {state === "invalid" && <><div className="inline-error" role="alert" data-testid="reset-invalid">{T("Odkaz je neplatný nebo vypršel. Vyžádejte si nový na přihlašovací stránce.", "The link is invalid or has expired. Request a new one on the sign-in page.")}</div><button type="button" className="button" onClick={goHome}>{T("Na přihlášení", "To sign-in")}</button></>}
    {state === "done" && <><div className="inline-notice" role="status" data-testid="reset-done">{T("Heslo je změněno. Všechna zařízení byla odhlášena, přihlaste se novým heslem.", "The password is changed. All devices were signed out; sign in with the new password.")}</div><button type="button" className="button primary" onClick={goHome}>{T("Na přihlášení", "To sign-in")}</button></>}
    {state === "valid" && <form onSubmit={submit}>
      <p className="login-hint">{T(`Heslo musí mít ${limits.min} až ${limits.max} znaků.`, `The password must be ${limits.min} to ${limits.max} characters.`)}</p>
      <label>{T("Nové heslo", "New password")}<input type="password" name="newPassword" autoComplete="new-password" autoFocus required minLength={options.passwordRecovery.minLength} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label>{T("Nové heslo znovu", "New password again")}<input type="password" name="again" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} /></label>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <button className="button primary login-submit" disabled={busy}>{busy ? T("Ukládám…", "Saving…") : T("Nastavit heslo", "Set the password")}</button>
    </form>}
  </PublicShell>;
}

function LeadConfirmPage({ token }: { token: string }) {
  useLocale();
  const [status, setStatus] = useState<"working" | "confirmed" | "already-confirmed" | "expired" | "invalid">("working");
  async function confirm() {
    try { setStatus((await publicJson<{ status: "confirmed" | "already-confirmed" | "expired" }>("/v1/public/lead-forms/confirm", { method: "POST", body: JSON.stringify({ token }) })).status); }
    catch { setStatus("invalid"); }
  }
  // The POST is made by this page, not by the link itself, so a mail scanner that opens the link confirms nothing.
  useEffect(() => { void confirm(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const text = {
    working: T("Potvrzuji…", "Confirming…"),
    confirmed: T("Děkujeme, váš požadavek je potvrzen.", "Thank you, your request is confirmed."),
    "already-confirmed": T("Tento požadavek už byl potvrzen dříve.", "This request was already confirmed."),
    expired: T("Platnost potvrzovacího odkazu vypršela. Odešlete formulář znovu.", "The confirmation link has expired. Submit the form again."),
    invalid: T("Odkaz není platný.", "The link is not valid."),
  }[status];
  return <PublicShell title={T("Potvrzení požadavku", "Request confirmation")} testId="lead-confirm"><p className={status === "invalid" || status === "expired" ? "inline-error" : "login-hint"} role="status" data-testid="lead-confirm-status">{text}</p></PublicShell>;
}

type FormField = { key: string; label: string; type: string; required: boolean; properties?: { options?: string[]; maxLength?: number }; defaultValue?: unknown };
type FormDescription = { id: string; name: string; fields: FormField[]; optIn: boolean; successMessage: string | null };

function FieldControl({ field, value, onChange }: { field: FormField; value: unknown; onChange: (value: unknown) => void }) {
  const common = { id: `f-${field.key}`, name: field.key, required: field.required };
  const text = typeof value === "string" ? value : "";
  switch (field.type) {
    case "text": return <textarea {...common} rows={4} value={text} onChange={(e) => onChange(e.target.value)} />;
    case "boolean": return <input id={common.id} name={field.key} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case "integer": case "decimal": return <input {...common} inputMode="decimal" value={text} onChange={(e) => onChange(e.target.value)} />;
    case "date": return <input {...common} type="date" value={text} onChange={(e) => onChange(e.target.value)} />;
    case "dateTime": return <input {...common} type="datetime-local" value={text} onChange={(e) => onChange(e.target.value)} />;
    case "email": return <input {...common} type="email" value={text} onChange={(e) => onChange(e.target.value)} />;
    case "phone": return <input {...common} type="tel" value={text} onChange={(e) => onChange(e.target.value)} />;
    case "url": return <input {...common} type="url" value={text} onChange={(e) => onChange(e.target.value)} />;
    case "enum": return <select {...common} value={text} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{field.properties?.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
    case "multiEnum": {
      const chosen = Array.isArray(value) ? (value as string[]) : [];
      return <div className="admin-check-grid">{field.properties?.options?.map((option) => <label key={option}><input type="checkbox" checked={chosen.includes(option)} onChange={() => onChange(chosen.includes(option) ? chosen.filter((item) => item !== option) : [...chosen, option])} /> {option}</label>)}</div>;
    }
    default: return <input {...common} maxLength={field.properties?.maxLength} value={text} onChange={(e) => onChange(e.target.value)} />;
  }
}

// A date-time input gives "2026-10-26T09:30"; the API wants an RFC 3339 instant.
function toWire(field: FormField, value: unknown): unknown {
  if (value === "" || value === undefined || (Array.isArray(value) && !value.length)) return undefined;
  if (field.type === "integer" && typeof value === "string") return Number.isFinite(Number(value)) ? Number(value) : value;
  if (field.type === "dateTime" && typeof value === "string" && value.length === 16) return `${value}:00Z`;
  return value;
}

function LeadFormPage({ id }: { id: string }) {
  useLocale();
  const [form, setForm] = useState<FormDescription | null>(null);
  const [missing, setMissing] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"created" | "confirmation-required" | null>(null);
  useEffect(() => {
    let live = true;
    publicJson<FormDescription>(`/v1/public/lead-forms/${encodeURIComponent(id)}`)
      .then((value) => { if (live) { setForm(value); setValues(Object.fromEntries(value.fields.filter((field) => field.defaultValue !== undefined).map((field) => [field.key, field.defaultValue]))); } })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true); setError("");
    const body: Record<string, unknown> = {};
    for (const field of form.fields) { const wire = toWire(field, values[field.key]); if (wire !== undefined) body[field.key] = wire; }
    try {
      const answer = await publicJson<{ status: "created" | "confirmation-required" }>(`/v1/public/lead-forms/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify({ values: body, ...(form.optIn ? { consent } : {}) }) });
      setResult(answer.status);
    } catch (cause) {
      const names = new Map(form.fields.map((field) => [`values.${field.key}`, field.label]));
      setError(problemText(cause, (field) => names.get(field) ?? (field === "consent" ? T("Souhlas", "Consent") : field)));
    } finally { setBusy(false); }
  }
  if (missing) return <PublicShell title={T("Formulář", "Form")} testId="lead-form"><div className="inline-error" role="alert" data-testid="lead-form-missing">{T("Tento formulář neexistuje nebo není aktivní.", "This form does not exist or is not active.")}</div></PublicShell>;
  if (!form) return <PublicShell title={T("Formulář", "Form")} testId="lead-form"><p className="login-hint">{T("Načítám…", "Loading…")}</p></PublicShell>;
  if (result) return <PublicShell title={form.name} testId="lead-form"><div className="inline-notice" role="status" data-testid="lead-form-done">{result === "confirmation-required" ? T("Poslali jsme vám e-mail s odkazem. Požadavek odešleme po potvrzení.", "We sent you an e-mail with a link. The request is submitted once you confirm it.") : form.successMessage || T("Děkujeme, váš požadavek jsme přijali.", "Thank you, we received your request.")}</div></PublicShell>;
  return <PublicShell title={form.name} testId="lead-form">
    <form onSubmit={submit} noValidate={false}>
      {form.fields.map((field) => <label key={field.key} className="field-input"><span>{field.label}{field.required ? " *" : ""}</span><FieldControl field={field} value={values[field.key]} onChange={(value) => setValues({ ...values, [field.key]: value })} /></label>)}
      {form.optIn && <label><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {T("Souhlasím se zpracováním údajů a s odesláním potvrzovacího e-mailu.", "I agree to the processing of my data and to receiving a confirmation e-mail.")}</label>}
      {error && <div className="inline-error" role="alert" data-testid="lead-form-error">{error}</div>}
      <button className="button primary login-submit" disabled={busy}>{busy ? T("Odesílám…", "Sending…") : T("Odeslat", "Submit")}</button>
    </form>
  </PublicShell>;
}

export function PublicPage({ route }: { route: PublicRoute }) {
  if (route.page === "reset-password") return <ResetPasswordPage token={route.token} />;
  if (route.page === "lead-confirm") return <LeadConfirmPage token={route.token} />;
  return <LeadFormPage id={route.id} />;
}
