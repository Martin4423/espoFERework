import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Session } from "./api";
import { getLocale, setLocale, t, useLocale } from "./i18n/index.ts";

// Sign-in with e-mail and password (ViaCRM identity). Portals, OIDC and two-factor are not offered by the backend yet.
export function Login({ onLogin, notice = "" }: { onLogin: (email: string, password: string) => Promise<Session>; notice?: string }) {
  useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await onLogin(email, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("error.generic", { status: 0 })); }
    finally { setBusy(false); }
  }

  const locale = getLocale();
  return <main className="login-page">
    <section className="login-story">
      <div className="brand lockup"><span className="brand-mark">V</span><span>{t("app.name")}</span></div>
      <div className="story-foot"><span>{t("app.name")}</span><span>{t("login.secure")}</span></div>
    </section>
    <section className="login-side">
      <form className="login-card" onSubmit={submit} data-testid="login-form">
        <span className="eyebrow">{t("login.eyebrow")}</span>
        <h2>{t("login.title")}</h2>
        <p className="login-hint">{t("login.hint")}</p>
        {notice && <div className="inline-error" role="status" data-testid="login-notice">{notice}</div>}
        <label>{t("login.email")}<input id="login-email" name="email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>{t("login.password")}
          <div className="login-password-control">
            <input id="login-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="login-password-toggle" onClick={() => setPasswordVisible((v) => !v)} aria-label={passwordVisible ? t("login.hidePassword") : t("login.showPassword")}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </label>
        {error && <div className="inline-error" role="alert" data-testid="login-error">{error}</div>}
        <button className="button primary login-submit" disabled={busy}>{busy ? t("login.busy") : t("login.submit")}<span>→</span></button>
        <div className="login-secure"><span className="secure-dot" />{t("login.secure")}</div>
      </form>
      <div className="login-bottom">
        <button type="button" className="login-recovery-link" aria-pressed={locale === "cs"} onClick={() => setLocale("cs")}>Čeština</button>
        <span>·</span>
        <button type="button" className="login-recovery-link" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button>
      </div>
    </section>
  </main>;
}
