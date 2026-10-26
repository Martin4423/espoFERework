import { useState } from "react";
import type { FormEvent } from "react";
import { LogOut, Monitor } from "lucide-react";
import { apiJson } from "../http.ts";
import { AdminPage, Banner, Busy, Field, Table, describe, useAsync } from "../admin/ui.tsx";
import { T, getLocale, setLocale, useLocale } from "../i18n/index.ts";
import { useConfirmDialog } from "../ConfirmDialogProvider";

type Session = { id: string; createdAt: string; lastUsedAt: string; expiresAt: string; ip: string | null; userAgent: string | null; current: boolean };
type Attempt = { at: string; ip: string | null; succeeded: boolean };

const when = (value: string) => new Date(value).toLocaleString(getLocale() === "cs" ? "cs-CZ" : "en-GB");
// "Mozilla/5.0 (Macintosh…) Chrome/120" is not for people; keep the browser and the system.
function device(agent: string | null): string {
  if (!agent) return T("Neznámé zařízení", "Unknown device");
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "";
  const system = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS X|Macintosh/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return [browser, system].filter(Boolean).join(" · ") || agent.slice(0, 40);
}

export function AccountSecurity({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) {
  useLocale();
  const confirm = useConfirmDialog();
  const sessions = useAsync(() => apiJson<{ items: Session[] }>("/v1/me/sessions"), []);
  const history = useAsync(() => apiJson<{ items: Attempt[] }>("/v1/me/login-history?limit=25"), []);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const label = (field: string) => field === "currentPassword" ? T("Současné heslo", "Current password") : field === "newPassword" ? T("Nové heslo", "New password") : field;

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (next !== again) { setError(T("Nová hesla se neshodují.", "The new passwords do not match.")); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await apiJson("/v1/me/password", { method: "POST", body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      setCurrent(""); setNext(""); setAgain("");
      setNotice(T("Heslo je změněno. Ostatní zařízení byla odhlášena.", "The password is changed. The other devices were signed out."));
      await sessions.reload();
    } catch (cause) { setError(describe(cause, label)); }
    finally { setBusy(false); }
  }
  async function revoke(session: Session) {
    setError(""); setNotice("");
    try {
      await apiJson(`/v1/me/sessions/${session.id}`, { method: "DELETE" });
      if (session.current) { onLogout(); return; }
      await sessions.reload();
    } catch (cause) { setError(describe(cause)); }
  }
  async function revokeOthers() {
    if (!await confirm({ title: T("Odhlásit ostatní zařízení?", "Sign out the other devices?"), message: T("Na všech ostatních zařízeních se budete muset přihlásit znovu.", "You will have to sign in again on every other device."), confirmLabel: T("Odhlásit", "Sign out"), tone: "danger" })) return;
    setError(""); setNotice("");
    try {
      const result = await apiJson<{ revoked: number }>("/v1/me/sessions/revoke-others", { method: "POST" });
      setNotice(T(`Odhlášeno zařízení: ${result.revoked}.`, `Devices signed out: ${result.revoked}.`));
      await sessions.reload();
    } catch (cause) { setError(describe(cause)); }
  }

  return <AdminPage title={T("Zabezpečení účtu", "Account security")} subtitle={T("Heslo, přihlášená zařízení a historie přihlášení.", "Password, signed-in devices and sign-in history.")} onBack={onBack} testId="account-security">
    <Banner text={error} /><Banner text={notice} tone="ok" />
    <section className="surface" style={{ padding: 18 }}>
      <h3>{T("Změna hesla", "Change password")}</h3>
      <form onSubmit={changePassword} data-testid="password-form">
        <div className="modal-fields" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", padding: 0 }}>
          <Field label={T("Současné heslo", "Current password")}><input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
          <Field label={T("Nové heslo", "New password")} hint={T("12 až 128 znaků", "12 to 128 characters")}><input type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label={T("Nové heslo znovu", "New password again")}><input type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
        </div>
        <div className="admin-actions" style={{ marginTop: 12 }}><button className="button primary" disabled={busy}>{T("Změnit heslo", "Change password")}</button></div>
      </form>
    </section>
    <section className="surface" style={{ padding: 18, marginTop: 16 }} data-testid="sessions">
      <div className="entity-heading"><h3>{T("Přihlášená zařízení", "Signed-in devices")}</h3>
        <button type="button" className="button" onClick={() => void revokeOthers()} disabled={(sessions.data?.items.length ?? 0) < 2}>{T("Odhlásit ostatní", "Sign out the others")}</button></div>
      {sessions.loading && !sessions.data ? <Busy /> : <Table head={[T("Zařízení", "Device"), T("Adresa", "Address"), T("Naposledy", "Last used"), ""]} empty={T("Žádná zařízení.", "No devices.")}>
        {sessions.data?.items.map((session) => <tr key={session.id} data-current={session.current}>
          <td><Monitor size={14} aria-hidden="true" /> {device(session.userAgent)} {session.current && <b>({T("toto zařízení", "this device")})</b>}</td>
          <td>{session.ip ?? "—"}</td><td>{when(session.lastUsedAt)}</td>
          <td><button type="button" className="icon-button" aria-label={`${T("Odhlásit", "Sign out")}: ${device(session.userAgent)}`} onClick={() => void revoke(session)}><LogOut size={14} /></button></td></tr>)}
      </Table>}
    </section>
    <section className="surface" style={{ padding: 18, marginTop: 16 }} data-testid="login-history">
      <h3>{T("Historie přihlášení", "Sign-in history")}</h3>
      {history.loading && !history.data ? <Busy /> : <Table head={[T("Kdy", "When"), T("Adresa", "Address"), T("Výsledek", "Result")]} empty={T("Zatím žádné záznamy.", "No entries yet.")}>
        {history.data?.items.map((attempt, index) => <tr key={`${attempt.at}-${index}`}><td>{when(attempt.at)}</td><td>{attempt.ip ?? "—"}</td><td>{attempt.succeeded ? T("Úspěšné", "Succeeded") : T("Neúspěšné", "Failed")}</td></tr>)}
      </Table>}
    </section>
  </AdminPage>;
}

export function AccountPreferences({ onBack }: { onBack: () => void }) {
  useLocale();
  const confirm = useConfirmDialog();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const locale = getLocale();
  async function reset() {
    if (!await confirm({ title: T("Smazat uložená nastavení?", "Delete the saved settings?"), message: T("Uložené filtry a zobrazení se smažou.", "Saved filters and views are deleted."), confirmLabel: T("Smazat", "Delete"), tone: "danger" })) return;
    setError(""); setNotice("");
    try { await apiJson("/v1/me/preferences", { method: "DELETE" }); setNotice(T("Uložená nastavení jsou smazána.", "The saved settings are deleted.")); }
    catch (cause) { setError(describe(cause)); }
  }
  return <AdminPage title={T("Nastavení", "Preferences")} onBack={onBack} testId="account-preferences">
    <Banner text={error} /><Banner text={notice} tone="ok" />
    <section className="surface" style={{ padding: 18 }}>
      <Field label={T("Jazyk", "Language")}><select aria-label={T("Jazyk", "Language")} value={locale} onChange={(e) => setLocale(e.target.value as "cs" | "en")}><option value="cs">Čeština</option><option value="en">English</option></select></Field>
      <div className="admin-actions" style={{ marginTop: 14 }}><button type="button" className="button subtle" onClick={() => void reset()}>{T("Smazat uložené filtry a zobrazení", "Delete saved filters and views")}</button></div>
    </section>
  </AdminPage>;
}
