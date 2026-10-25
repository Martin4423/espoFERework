import { useEffect, useRef, useState } from "react";
import { Check, Link2, LoaderCircle, Unlink, X } from "./Icons";
import { request } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type Row = Record<string, any>;

/** Native OAuthAccount connection-panel behavior, backed by EspoCRM's OAuth API. */
export default function OAuthConnectionPanel({ record, onChanged }: { record: Row; onChanged: (record: Row) => void }) {
  const [current, setCurrent] = useState(record);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const confirmDialogRef = useDialogFocus<HTMLElement>(() => { if (!busy) setConfirmDisconnect(false); }, !busy, confirmDisconnect);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);
  useEffect(() => { setCurrent(record); }, [record]);

  async function refresh() {
    const next = await request<Row>(`OAuthAccount/${encodeURIComponent(record.id)}`);
    if (!live.current) return;
    setCurrent(next);
    onChanged(next);
  }

  function waitForAuthorization(popup: Window): Promise<{ code: string }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        window.clearInterval(timer);
        callback();
      };
      const timer = window.setInterval(() => {
        if (popup.closed) {
          finish(() => reject(new Error("Přihlašovací okno bylo zavřeno před dokončením.")));
          return;
        }
        try {
          const url = new URL(popup.location.href);
          const code = url.searchParams.get("code");
          const oauthError = url.searchParams.get("errorDescription") || url.searchParams.get("error");
          if (oauthError) finish(() => reject(new Error(oauthError)));
          else if (code) finish(() => { popup.close(); resolve({ code }); });
        } catch {
          // The provider owns the popup until it redirects back to this CRM origin.
        }
      }, 300);
    });
  }

  async function connect() {
    const data = current.data || {};
    if (!data.endpoint || !data.clientId || !data.redirectUri) {
      setError("Poskytovatel OAuth nemá nastavený endpoint, ID klienta nebo návratovou adresu.");
      return;
    }
    const popup = window.open("about:blank", "ConnectWithOAuth", "location=0,status=0,width=800,height=800");
    if (!popup) {
      setError("Prohlížeč zablokoval přihlašovací okno. Povolte vyskakovací okna pro CRM.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const params: Record<string, string> = {
        client_id: String(data.clientId),
        redirect_uri: String(data.redirectUri),
        response_type: "code",
        prompt: String(data.prompt || ""),
      };
      if (data.scope) params.scope = String(data.scope);
      if (data.params && typeof data.params === "object") {
        for (const [key, value] of Object.entries(data.params)) if (value != null) params[key] = String(value);
      }
      const url = new URL(String(data.endpoint));
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      popup.location.href = url.toString();
      const { code } = await waitForAuthorization(popup);
      await request(`OAuth/${encodeURIComponent(record.id)}/connection`, { method: "POST", body: JSON.stringify({ code }) });
      await refresh();
      setNotice("OAuth účet je připojen.");
    } catch (cause) {
      if (!popup.closed) popup.close();
      setError(cause instanceof Error ? cause.message : "OAuth připojení se nepodařilo dokončit.");
    } finally { if (live.current) setBusy(false); }
  }

  async function disconnect() {
    setConfirmDisconnect(true);
  }
  async function confirmDisconnectAccount() {
    if (busy) return;
    setConfirmDisconnect(false);
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`OAuth/${encodeURIComponent(record.id)}/connection`, { method: "DELETE" });
      await refresh();
      setNotice("OAuth účet byl odpojen.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "OAuth účet se nepodařilo odpojit.");
    } finally { if (live.current) setBusy(false); }
  }

  const hasToken = Boolean(current.hasAccessToken);
  return <section className="detail-panel oauth-connection-panel">
    <div className="drawer-section-title">PŘIPOJENÍ OAUTH</div>
    <div className="oauth-connection-state"><span className={`import-status-dot ${hasToken ? "completed" : "standby"}`}/><strong>{hasToken ? "Připojeno" : current.providerIsActive === false ? "Poskytovatel je vypnutý" : "Odpojeno"}</strong>{current.providerName && <span>{current.providerName}</span>}</div>
    {error && <div className="inline-error">{error}</div>}{notice && <div className="save-confirm"><Check size={14}/>{notice}</div>}
    <div className="oauth-connection-actions">{hasToken
      ? <button className="button subtle" disabled={busy} onClick={() => void disconnect()}>{busy ? <LoaderCircle size={14} className="spin"/> : <Unlink size={14}/>} Odpojit účet</button>
      : <button className="button primary" disabled={busy || current.providerIsActive === false} onClick={() => void connect()}>{busy ? <LoaderCircle size={14} className="spin"/> : <Link2 size={14}/>} Připojit účet</button>}</div>
    {confirmDisconnect && <div className="modal-backdrop oauth-disconnect-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setConfirmDisconnect(false)}><section ref={confirmDialogRef} className="record-modal oauth-disconnect-dialog" role="alertdialog" aria-modal="true" aria-labelledby="oauth-disconnect-title" aria-describedby="oauth-disconnect-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">PŘIPOJENÍ OAUTH</span><h2 id="oauth-disconnect-title">Odpojit účet?</h2><p id="oauth-disconnect-description">OAuth účet <strong>{record.name || current.providerName || record.id}</strong> se odpojí a jeho přístupový token přestane být dostupný pro CRM.</p></div><button type="button" className="icon-button" aria-label="Zrušit odpojení" onClick={() => setConfirmDisconnect(false)}><X size={16}/></button></div><div className="modal-footer"><button type="button" autoFocus className="button subtle" onClick={() => setConfirmDisconnect(false)}>Ponechat připojení</button><button type="button" className="button danger" onClick={() => void confirmDisconnectAccount()}><Unlink size={14}/> Odpojit účet</button></div></section></div>}
  </section>;
}
