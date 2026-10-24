import { useCallback, useEffect, useState } from "react";
import { Clock3, LogOut, RefreshCw, Shield, Trash2 } from "./Icons";
import { request } from "./api";

type SessionRow = { id: string; ipAddress?: string; createdAt?: string; lastAccess?: string; isCurrent?: boolean };
function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AccountSessions({ onLogout }: { onLogout: () => void }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const result = await request<{ list?: SessionRow[] }>("UserSecurity/currentSessions"); setSessions(result.list || []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Přihlášená zařízení se nepodařilo načíst."); }
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

  return <section className="surface account-sessions"><div className="settings-card-head"><div><h2><Shield size={17}/>Přihlášená zařízení</h2><p>Spravujte aktivní přihlášení k tomuto účtu.</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={13}/>Obnovit</button></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm">{notice}</div>}
    {busy ? <div className="table-loading"><span className="spinner"/>Načítám sessions…</div> : sessions.length ? <div className="account-session-list">{sessions.map((session) => <article key={session.id}><span className="account-session-icon"><Clock3 size={15}/></span><div><strong>{session.isCurrent ? "Toto zařízení" : "Přihlášené zařízení"}{session.ipAddress ? ` · ${session.ipAddress}` : ""}</strong><small>Naposledy aktivní {dateTime(session.lastAccess)} · přihlášeno {dateTime(session.createdAt)}</small></div><button className={`button ${session.isCurrent ? "subtle" : "danger"}`} onClick={() => void revoke(session)} disabled={Boolean(acting)} title="Ukončit přihlášení"><LogOut size={13}/><span>{session.isCurrent ? "Odhlásit" : "Ukončit"}</span><Trash2 size={13}/></button></article>)}</div> : <div className="table-empty">Není evidováno žádné aktivní přihlášení.</div>}
  </section>;
}
