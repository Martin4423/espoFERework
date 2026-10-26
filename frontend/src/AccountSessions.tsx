import { useCallback, useEffect, useState } from "react";
import { Clock3, LogOut, RefreshCw, Shield, ShieldAlert, ShieldCheck, Trash2 } from "./Icons";
import { request } from "./api";
import { formatServerDateTime, useServerTimeZone } from "./timeZone";
import { useDialogFocus } from "./useDialogFocus";
import { X } from "./Icons";

type SessionRow = { id: string; ipAddress?: string; createdAt?: string; lastAccess?: string; isCurrent?: boolean };
type LoginEvent = { id: string; ipAddress?: string; createdAt?: string; isDenied?: boolean; denialReason?: string; authenticationMethod?: string };
type PendingSessionAction = { kind: "single"; session: SessionRow } | { kind: "others" };
export default function AccountSessions({ onLogout }: { onLogout: () => void }) {
  const timeZone = useServerTimeZone();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingSessionAction | null>(null);
  const confirmDialogRef = useDialogFocus<HTMLElement>(() => { if (!acting && !revokingOthers) setPendingAction(null); }, !acting && !revokingOthers, Boolean(pendingAction));

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
    setPendingAction({ kind: "single", session });
  }
  async function performRevoke(session: SessionRow) {
    setActing(session.id); setError(""); setNotice("");
    try {
      await request(`UserSecurity/currentSession/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      if (session.isCurrent) { onLogout(); return; }
      setNotice("Přihlášení bylo ukončeno."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Přihlášení se nepodařilo ukončit."); }
    finally { setActing(""); }
  }

  async function revokeOtherSessions() {
    setPendingAction({ kind: "others" });
  }
  async function performRevokeOtherSessions() {
    setRevokingOthers(true); setError(""); setNotice("");
    try {
      const result = await request<{ revokedCount?: number }>("UserSecurity/otherSessions", { method: "POST", body: JSON.stringify({}) });
      const count = Number(result.revokedCount || 0);
      setNotice(count ? `Ostatní přihlášení byla ukončena (${count}). Toto zařízení zůstalo přihlášené.` : "Žádná další aktivní přihlášení nebyla nalezena.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ostatní přihlášení se nepodařilo ukončit."); }
    finally { setRevokingOthers(false); }
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action || acting || revokingOthers) return;
    setPendingAction(null);
    if (action.kind === "single") await performRevoke(action.session);
    else await performRevokeOtherSessions();
  }

  return <div className="account-security-panels"><section className="surface account-sessions"><div className="settings-card-head"><div><h2><Shield size={17}/>Přihlášená zařízení</h2><p>Spravujte aktivní přihlášení k tomuto účtu.</p></div><div className="account-session-toolbar">{sessions.some((session) => !session.isCurrent) && <button className="button danger" onClick={() => void revokeOtherSessions()} disabled={busy || revokingOthers || Boolean(acting)}><LogOut size={13}/>{revokingOthers ? "Ukončuji…" : "Odhlásit ostatní zařízení"}</button>}<button className="button subtle" onClick={() => void load()} disabled={busy || revokingOthers}><RefreshCw size={13}/>Obnovit</button></div></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm">{notice}</div>}
    {busy ? <div className="table-loading"><span className="spinner"/>Načítám sessions…</div> : sessions.length ? <div className="account-session-list">{sessions.map((session) => <article key={session.id}><span className="account-session-icon"><Clock3 size={15}/></span><div><strong>{session.isCurrent ? "Toto zařízení" : "Přihlášené zařízení"}{session.ipAddress ? ` · ${session.ipAddress}` : ""}</strong><small>Naposledy aktivní {formatServerDateTime(session.lastAccess, timeZone)} · přihlášeno {formatServerDateTime(session.createdAt, timeZone)}</small></div><button className={`button ${session.isCurrent ? "subtle" : "danger"}`} onClick={() => void revoke(session)} disabled={Boolean(acting) || revokingOthers} title="Ukončit přihlášení"><LogOut size={13}/><span>{session.isCurrent ? "Odhlásit" : "Ukončit"}</span><Trash2 size={13}/></button></article>)}</div> : <div className="table-empty">Není evidováno žádné aktivní přihlášení.</div>}
  </section><section className="surface account-login-history"><div className="settings-card-head"><div><h2><Clock3 size={17}/>Historie přihlášení</h2><p>Posledních 25 událostí, které ViaCRM přiřadilo k vašemu účtu.</p></div></div>{historyError ? <div className="table-error">{historyError}</div> : busy ? <div className="table-loading"><span className="spinner"/>Načítám historii…</div> : history.length ? <div className="account-login-event-list">{history.map((event) => <article className={event.isDenied ? "denied" : "accepted"} key={event.id}><span>{event.isDenied ? <ShieldAlert size={15}/> : <ShieldCheck size={15}/>}</span><div><strong>{event.isDenied ? `Přístup odmítnut${event.denialReason ? ` · ${event.denialReason}` : ""}` : "Přihlášení přijato"}</strong><small>{formatServerDateTime(event.createdAt, timeZone)}{event.authenticationMethod ? ` · ${event.authenticationMethod}` : ""}</small></div><code>{event.ipAddress || "—"}</code></article>)}</div> : <div className="table-empty">Pro tento účet nejsou dostupné žádné záznamy.</div>}</section>
  {pendingAction && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !acting && !revokingOthers && setPendingAction(null)}><section ref={confirmDialogRef} className="record-modal session-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-confirm-title" aria-describedby="session-confirm-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">ZABEZPEČENÍ ÚČTU · PŘIHLÁŠENÍ</span><h2 id="session-confirm-title">{pendingAction.kind === "others" ? "Ukončit ostatní přihlášení?" : pendingAction.session.isCurrent ? "Odhlásit toto zařízení?" : "Ukončit toto přihlášení?"}</h2><p id="session-confirm-description">{pendingAction.kind === "others" ? <>Ukončí se všechna ostatní přihlášení k tomuto účtu. Aktuální zařízení zůstane přihlášené{sessions.filter((session) => !session.isCurrent).length ? `; počet dalších zařízení: ${sessions.filter((session) => !session.isCurrent).length}` : ""}.</> : pendingAction.session.isCurrent ? <>Toto zařízení bude odhlášeno a následně přesměrováno na přihlašovací obrazovku.</> : <>Přihlášení{pendingAction.session.ipAddress ? <> z adresy <strong>{pendingAction.session.ipAddress}</strong></> : " tohoto zařízení"} bude ukončeno. Zařízení se bude muset znovu přihlásit.</>}</p></div><button type="button" className="icon-button" aria-label="Zrušit akci" onClick={() => setPendingAction(null)}><X size={16}/></button></div><div className="modal-footer"><button type="button" autoFocus className="button subtle" onClick={() => setPendingAction(null)}>Ponechat přihlášení</button><button type="button" className="button danger" onClick={() => void confirmPendingAction()}><LogOut size={14}/>{pendingAction.kind === "others" ? "Ukončit ostatní" : "Ukončit přihlášení"}</button></div></section></div>}
  </div>;
}
