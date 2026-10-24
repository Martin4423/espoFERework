import { useCallback, useEffect, useState } from "react";
import { Clock3, LogOut, RefreshCw, Shield, ShieldAlert, ShieldCheck, Trash2 } from "./Icons";
import { request } from "./api";

type SessionRow = { id: string; ipAddress?: string; createdAt?: string; lastAccess?: string; isCurrent?: boolean };
type LoginEvent = { id: string; ipAddress?: string; createdAt?: string; isDenied?: boolean; denialReason?: string; authenticationMethod?: string };
function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AccountSessions({ onLogout }: { onLogout: () => void }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setError(""); setHistoryError("");
    try {
      const [sessionResult, historyResult] = await Promise.allSettled([
        request<{ list?: SessionRow[] }>("UserSecurity/currentSessions"),
        request<{ list?: LoginEvent[] }>("UserSecurity/currentLoginHistory"),
      ]);
      if (sessionResult.status === "fulfilled") setSessions(sessionResult.value.list || []);
      else setError(sessionResult.reason instanceof Error ? sessionResult.reason.message : "Přihlášená zařízení se nepodařilo načíst.");
      if (historyResult.status === "fulfilled") setHistory(historyResult.value.list || []);
      else setHistoryError(historyResult.reason instanceof Error ? historyResult.reason.message : "Historii přihlášení se nepodařilo načíst.");
    }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function revoke(session: SessionRow) {
    if (!window.confirm(session.isCurrent ? "Ukončit toto přihlášení? Budete přesměrováni na přihlášení." : "Ukončit tuto session? Zařízení se bude muset znovu přihlásit.")) return;
    setActing(session.id); setError(""); setNotice("");
    try {
      await request(`UserSecurity/currentSession/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      if (session.isCurrent) { onLogout(); return; }
      setNotice("Přihlášení bylo ukončeno."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Přihlášení se nepodařilo ukončit."); }
    finally { setActing(""); }
  }

  return <div className="account-security-panels"><section className="surface account-sessions"><div className="settings-card-head"><div><h2><Shield size={17}/>Přihlášená zařízení</h2><p>Spravujte aktivní přihlášení k tomuto účtu.</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={13}/>Obnovit</button></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm">{notice}</div>}
    {busy ? <div className="table-loading"><span className="spinner"/>Načítám sessions…</div> : sessions.length ? <div className="account-session-list">{sessions.map((session) => <article key={session.id}><span className="account-session-icon"><Clock3 size={15}/></span><div><strong>{session.isCurrent ? "Toto zařízení" : "Přihlášené zařízení"}{session.ipAddress ? ` · ${session.ipAddress}` : ""}</strong><small>Naposledy aktivní {dateTime(session.lastAccess)} · přihlášeno {dateTime(session.createdAt)}</small></div><button className={`button ${session.isCurrent ? "subtle" : "danger"}`} onClick={() => void revoke(session)} disabled={Boolean(acting)} title="Ukončit přihlášení"><LogOut size={13}/><span>{session.isCurrent ? "Odhlásit" : "Ukončit"}</span><Trash2 size={13}/></button></article>)}</div> : <div className="table-empty">Není evidováno žádné aktivní přihlášení.</div>}
  </section><section className="surface account-login-history"><div className="settings-card-head"><div><h2><Clock3 size={17}/>Historie přihlášení</h2><p>Posledních 25 událostí, které EspoCRM přiřadilo k vašemu účtu.</p></div></div>{historyError ? <div className="table-error">{historyError}</div> : busy ? <div className="table-loading"><span className="spinner"/>Načítám historii…</div> : history.length ? <div className="account-login-event-list">{history.map((event) => <article className={event.isDenied ? "denied" : "accepted"} key={event.id}><span>{event.isDenied ? <ShieldAlert size={15}/> : <ShieldCheck size={15}/>}</span><div><strong>{event.isDenied ? `Přístup odmítnut${event.denialReason ? ` · ${event.denialReason}` : ""}` : "Přihlášení přijato"}</strong><small>{dateTime(event.createdAt)}{event.authenticationMethod ? ` · ${event.authenticationMethod}` : ""}</small></div><code>{event.ipAddress || "—"}</code></article>)}</div> : <div className="table-empty">Pro tento účet nejsou dostupné žádné záznamy.</div>}</section></div>;
}
