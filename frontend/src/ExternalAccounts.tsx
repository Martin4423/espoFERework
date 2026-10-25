import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Link2, LoaderCircle, Network, Shield, Save, ShieldCheck, Unlink, X } from "./Icons";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { request } from "./api";
import type { Metadata } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type Row = Record<string, any>;
type ExternalAccountItem = { id: string };
type OAuthInfo = { clientId?: string; redirectUri?: string; isConnected?: boolean };

function title(metadata: Metadata, id: string) {
  return (metadata.labels as any)?.Integration?.titles?.[id] || (metadata.labels as any)?.Integration?.[id] || id.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function helpText(metadata: Metadata, id: string) {
  const labels = metadata.labels as any;
  const raw = labels?.ExternalAccount?.help?.[id] || labels?.[id]?.help?.ExternalAccount || "";
  return String(raw || "");
}

function waitForAuthorization(popup: Window): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      window.clearTimeout(timeout);
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
        const oauthError = url.searchParams.get("error_description") || url.searchParams.get("errorDescription") || url.searchParams.get("error");
        if (oauthError) finish(() => reject(new Error(oauthError)));
        else if (code) finish(() => { popup.close(); resolve({ code }); });
      } catch {
        // The OAuth provider owns the popup until it redirects back to this CRM origin.
      }
    }, 300);
    const timeout = window.setTimeout(() => finish(() => reject(new Error("Připojení vypršelo. Zkuste ho spustit znovu."))), 5 * 60 * 1000);
  });
}

export default function ExternalAccounts({ metadata, userId, onBack }: { metadata: Metadata; userId: string; onBack: () => void }) {
  const integrations = ((metadata as any).integrations || {}) as Record<string, Row>;
  const [items, setItems] = useState<ExternalAccountItem[]>([]);
  const [selected, setSelected] = useState("");
  const [record, setRecord] = useState<Row | null>(null);
  const [initialEnabled, setInitialEnabled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [oauthInfo, setOAuthInfo] = useState<OAuthInfo | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);
  const disableDialogRef = useDialogFocus<HTMLElement>(() => { if (!saving) setConfirmDisable(false); }, !saving, confirmDisable);
  const live = useRef(true);
  const integrationIds = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setBusy(true); setError("");
    request<{ list?: ExternalAccountItem[] }>("ExternalAccount/action/list")
      .then((result) => { if (active) { setItems(Array.isArray(result.list) ? result.list : []); setBusy(false); } })
      .catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Externí účty se nepodařilo načíst."); setBusy(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected || !userId) { setRecord(null); setOAuthInfo(null); return; }
    let active = true;
    const id = `${selected}__${userId}`;
    setBusy(true); setRecord(null); setOAuthInfo(null); setError(""); setNotice("");
    Promise.all([
      request<Row>(`ExternalAccount/${encodeURIComponent(id)}`),
      request<OAuthInfo>(`ExternalAccount/action/getOAuth2Info?${new URLSearchParams({ id })}`).catch(() => null),
    ]).then(([next, info]) => {
      if (!active) return;
      setRecord(next); setInitialEnabled(Boolean(next.enabled)); setEnabled(Boolean(next.enabled)); setOAuthInfo(info); setBusy(false);
    }).catch((cause) => {
      if (active) { setError(cause instanceof Error ? cause.message : "Nastavení účtu se nepodařilo načíst."); setBusy(false); }
    });
    return () => { active = false; };
  }, [selected, userId]);

  async function save() {
    if (!selected || !record || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const id = `${selected}__${userId}`;
      const next = await request<Row>(`ExternalAccount/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ enabled }) });
      if (!live.current) return;
      setRecord(next); setInitialEnabled(Boolean(next.enabled)); setEnabled(Boolean(next.enabled));
      if (!next.enabled) setOAuthInfo((current) => current ? { ...current, isConnected: false } : current);
      setNotice(next.enabled ? "Nastavení účtu bylo uloženo." : "Účet byl vypnut a odpojen.");
    } catch (cause) {
      if (live.current) setError(cause instanceof Error ? cause.message : "Nastavení účtu se nepodařilo uložit.");
    } finally { if (live.current) setSaving(false); }
  }

  async function connect() {
    const definition = integrations[selected] || {};
    const params = definition.params || {};
    if (!oauthInfo?.clientId || !oauthInfo.redirectUri || !params.endpoint) {
      setError("Poskytovateli chybí OAuth endpoint, ID klienta nebo návratová adresa. Zkontrolujte nastavení integrace v administraci.");
      return;
    }
    const popup = window.open("about:blank", "ConnectWithOAuth", "location=0,status=0,width=800,height=600");
    if (!popup) { setError("Prohlížeč zablokoval přihlašovací okno. Povolte vyskakovací okna pro CRM."); return; }
    setConnecting(true); setError(""); setNotice("");
    try {
      const url = new URL(String(params.endpoint));
      const query: Record<string, unknown> = {
        client_id: oauthInfo.clientId,
        redirect_uri: oauthInfo.redirectUri,
        response_type: "code",
        scope: params.scope,
        access_type: "offline",
        approval_prompt: "force",
        ...(params.params && typeof params.params === "object" ? params.params : {}),
      };
      Object.entries(query).forEach(([key, value]) => { if (value != null && String(value) !== "") url.searchParams.set(key, String(value)); });
      popup.location.href = url.toString();
      const { code } = await waitForAuthorization(popup);
      await request("ExternalAccount/action/authorizationCode", { method: "POST", body: JSON.stringify({ id: `${selected}__${userId}`, code }) });
      const [next, info] = await Promise.all([
        request<Row>(`ExternalAccount/${encodeURIComponent(`${selected}__${userId}`)}`),
        request<OAuthInfo>(`ExternalAccount/action/getOAuth2Info?${new URLSearchParams({ id: `${selected}__${userId}` })}`),
      ]);
      if (!live.current) return;
      setRecord(next); setInitialEnabled(Boolean(next.enabled)); setEnabled(Boolean(next.enabled)); setOAuthInfo(info); setNotice("Externí účet je připojen.");
    } catch (cause) {
      if (!popup.closed) popup.close();
      if (live.current) setError(cause instanceof Error ? cause.message : "Externí účet se nepodařilo připojit.");
    } finally { if (live.current) setConnecting(false); }
  }

  function cancel() {
    setEnabled(initialEnabled); setError(""); setNotice(""); setSelected("");
  }

  const integration = integrations[selected] || {};
  const connected = Boolean(oauthInfo?.isConnected);
  const unsupportedCustomView = Boolean(integration.userView);
  const canConnect = integration.authMethod === "oauth2" && !unsupportedCustomView;
  const oauthConfigurationReady = Boolean(oauthInfo?.clientId && oauthInfo.redirectUri && integration.params?.endpoint);
  const changed = enabled !== initialEnabled;
  const rawHelp = helpText(metadata, selected);
  const sanitizedHelp = rawHelp ? DOMPurify.sanitize(String(marked.parse(rawHelp, { async: false }))) : "";

  return <div className="admin-view external-accounts-view">
    <div className="entity-heading"><div><button type="button" className="back-link" onClick={onBack}><ArrowLeft size={14}/> Zpět</button><div className="eyebrow">UŽIVATELSKÝ ÚČET</div><h1>Externí účty</h1><p>Připojte služby, které může CRM používat jménem vašeho účtu.</p></div></div>
    {error && <div className="table-error" role="alert"><CircleAlert size={16}/>{error}</div>}
    {notice && <div className="save-confirm" role="status"><Check size={15}/>{notice}</div>}
    <div className="external-accounts-layout">
      <nav className="surface external-accounts-nav" aria-label="Dostupné externí účty">
        <div className="external-accounts-nav-head"><Network size={15}/><span>DOSTUPNÉ SLUŽBY</span></div>
        {busy && !items.length ? <div className="table-loading" role="status"><span className="spinner"/>Načítám služby…</div> : integrationIds.length ? items.map(({ id }) => <button type="button" key={id} className={`external-account-option ${selected === id ? "active" : ""}`} aria-current={selected === id ? "page" : undefined} disabled={saving || connecting} onClick={() => setSelected(id)}><span className="external-account-option-icon"><Network size={16}/></span><span>{title(metadata, id)}</span><span className={`external-account-option-state ${selected === id && connected ? "connected" : ""}`} aria-label={selected === id && connected ? "Připojeno" : undefined}/></button>) : !busy && !error ? <div className="external-accounts-empty"><Shield size={19}/><strong>Žádné dostupné služby</strong><span>Administrátor zatím nepovolil integrace pro uživatelské účty.</span></div> : null}
      </nav>
      <section className="surface external-accounts-detail" aria-live="polite">
        {!selected ? <div className="external-accounts-welcome"><span className="external-accounts-welcome-icon"><ShieldCheck size={24}/></span><h2>Vaše připojené služby</h2><p>Vyberte službu vlevo a spravujte její připojení. CRM nikdy nezobrazí uložené přístupové tokeny.</p></div>
          : <>
            <header className="external-account-detail-heading"><span className="external-account-large-icon"><Network size={20}/></span><div><div className="eyebrow">EXTERNÍ SLUŽBA</div><h2>{title(metadata, selected)}</h2><p>{connected ? "Účet je připojený a služba může bezpečně spolupracovat s CRM." : "Povolte službu a připojte svůj účet."}</p></div><span className={`security-state ${connected ? "enabled" : enabled ? "pending" : "disabled"}`}>{connected ? "Připojeno" : enabled ? "Čeká na připojení" : "Vypnuto"}</span></header>
            {busy || !record ? <div className="table-loading" role="status"><span className="spinner"/>Načítám nastavení služby…</div> : <>
              <label className="preference-toggle external-account-enabled" htmlFor="external-account-enabled"><span><strong>Povolit přístup služby</strong><small>Umožní CRM používat přihlašovací údaje tohoto účtu.</small></span><input id="external-account-enabled" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}/><i/></label>
              {enabled && <div className="external-account-connection">
                {canConnect ? <><div className={`external-account-connection-state ${connected ? "connected" : ""}`}><span className="external-account-state-icon">{connected ? <Check size={17}/> : <Link2 size={17}/>}</span><div><strong>{connected ? "Účet je bezpečně připojen" : "Připojte svůj účet"}</strong><span>{connected ? "Ověření proběhlo úspěšně. Připojení můžete kdykoli vypnout." : "Přihlaste se u poskytovatele a potvrďte přístup pro CRM."}</span></div>{!connected && <button type="button" className="button primary" onClick={() => void connect()} disabled={connecting || saving || !oauthConfigurationReady || changed}>{connecting ? <><LoaderCircle size={14} className="spin"/>Připojuji…</> : <><Link2 size={14}/>Připojit účet</>}</button>}</div>
                  {!connected && changed && <div className="external-account-security-note"><Save size={15}/><span>Nejdřív uložte zapnutí služby. Potom můžete bezpečně připojit účet.</span></div>}
                  {!connected && !oauthConfigurationReady && <div className="external-account-notice"><CircleAlert size={17}/><span>Administrátor musí nejdřív dokončit konfiguraci OAuth tohoto poskytovatele.</span></div>}
                  </>
                  : unsupportedCustomView ? <div className="external-account-notice"><CircleAlert size={17}/><span>Tato služba používá vlastní připojovací obrazovku z rozšíření. Její nastavení nelze zobrazit v tomto klientovi.</span></div>
                  : <div className="external-account-notice"><CircleAlert size={17}/><span>Tato služba nepoužívá podporovaný OAuth2 způsob připojení.</span></div>}
                <div className="external-account-security-note"><ShieldCheck size={15}/><span>Přihlašovací tokeny zůstávají uložené v EspoCRM a nejsou zobrazené v prohlížeči.</span></div>
              </div>}
              {sanitizedHelp && <div className="external-account-help external-account-help-standalone" dangerouslySetInnerHTML={{ __html: sanitizedHelp }} />}
              <div className="external-account-actions"><button type="button" className="button subtle" onClick={cancel} disabled={saving || connecting}>Zrušit</button><button type="button" className="button primary" onClick={() => enabled ? void save() : setConfirmDisable(true)} disabled={saving || connecting || !changed}>{saving ? <><LoaderCircle size={14} className="spin"/>Ukládám…</> : <><Save size={14}/>{enabled ? "Uložit" : "Vypnout a odpojit"}</>}</button></div>
            </>}
          </>}
      </section>
    </div>
    {confirmDisable && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConfirmDisable(false)}><section ref={disableDialogRef} className="record-modal external-account-disable-dialog" role="alertdialog" aria-modal="true" aria-labelledby="external-account-disable-title" aria-describedby="external-account-disable-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">ODPOJENÍ ÚČTU</span><h2 id="external-account-disable-title">Vypnout {title(metadata, selected)}?</h2><p id="external-account-disable-description">CRM odebere uložené přihlašovací údaje této služby. Při příštím použití bude nutné účet znovu připojit.</p></div><button type="button" className="icon-button" aria-label="Zrušit vypnutí" onClick={() => setConfirmDisable(false)}><X size={16}/></button></div><div className="modal-footer"><button type="button" className="button subtle" onClick={() => setConfirmDisable(false)}>Ponechat připojení</button><button type="button" className="button danger" onClick={() => { setConfirmDisable(false); void save(); }}><Unlink size={14}/>Vypnout a odpojit</button></div></section></div>}
  </div>;
}
