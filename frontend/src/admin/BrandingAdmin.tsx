import { useEffect, useState } from "react";
import { auth, apiJson } from "../http.ts";
import { problemFromResponse } from "../problem.ts";
import { T, useLocale } from "../i18n/index.ts";
import type { Branding } from "../public/client.ts";
import { AdminPage, Banner, Busy, Field, describe, useAsync } from "./ui.tsx";

const THEMES: Array<[Branding["theme"], string, string]> = [["light", "Světlý", "Light"], ["dark", "Tmavý", "Dark"], ["auto", "Podle systému", "Follow the system"]];

export default function BrandingAdmin({ onBack }: { onBack: () => void }) {
  useLocale();
  const stored = useAsync(() => apiJson<Branding>("/v1/settings/branding"), []);
  const [appName, setAppName] = useState("");
  const [theme, setTheme] = useState<Branding["theme"]>("light");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoVersion, setLogoVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (stored.data) { setAppName(stored.data.appName); setTheme(stored.data.theme); setLogo(stored.data.logoUrl); } }, [stored.data]);

  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await apiJson<Branding>("/v1/settings/branding", { method: "PUT", body: JSON.stringify({ appName, theme }) });
      setAppName(next.appName); setNotice(T("Vzhled byl uložen.", "The branding was saved.")); document.title = next.appName;
    } catch (cause) { setError(describe(cause, (field) => field === "appName" ? T("Název aplikace", "Application name") : field)); }
    finally { setBusy(false); }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await auth.authorizedFetch("/v1/settings/branding/logo", { method: "PUT", body: form });
      if (!response.ok) throw await problemFromResponse(response);
      setLogo("/v1/public/branding/logo"); setLogoVersion((n) => n + 1); setNotice(T("Logo bylo nahráno.", "The logo was uploaded."));
    } catch (cause) { setError(describe(cause, (field) => field === "file" ? T("Soubor", "File") : field)); }
    finally { setBusy(false); }
  }
  async function removeLogo() {
    setBusy(true); setError(""); setNotice("");
    try { await apiJson("/v1/settings/branding/logo", { method: "DELETE" }); setLogo(null); setNotice(T("Logo bylo odstraněno.", "The logo was removed.")); }
    catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  }

  return <AdminPage title={T("Vzhled a název", "Branding")} subtitle={T("Název a logo se ukazují na přihlašovací stránce a ve veřejných formulářích.", "The name and logo appear on the sign-in page and on public forms.")} onBack={onBack} testId="admin-branding">
    <Banner text={error || stored.error} /><Banner text={notice} tone="ok" />
    {stored.loading && !stored.data ? <Busy /> : <section className="surface" style={{ padding: 18 }}>
      <div className="modal-fields" style={{ gridTemplateColumns: "1fr 1fr", padding: 0 }}>
        <Field label={T("Název aplikace", "Application name")}><input aria-label={T("Název aplikace", "Application name")} value={appName} maxLength={100} onChange={(e) => setAppName(e.target.value)} /></Field>
        <Field label={T("Výchozí motiv", "Default theme")} hint={T("Uloží se; zobrazení tmavého motivu přijde později.", "It is stored; the dark theme display comes later.")}><select aria-label={T("Motiv", "Theme")} value={theme} onChange={(e) => setTheme(e.target.value as Branding["theme"])}>{THEMES.map(([value, cs, en]) => <option key={value} value={value}>{T(cs, en)}</option>)}</select></Field>
      </div>
      <div className="admin-actions" style={{ margin: "14px 0" }}><button type="button" className="button primary" onClick={() => void save()} disabled={busy || !appName.trim()}>{T("Uložit", "Save")}</button></div>
      <h3>{T("Logo", "Logo")}</h3>
      {logo ? <p><img src={`${logo}?v=${logoVersion}`} alt={T("Aktuální logo", "Current logo")} data-testid="logo-preview" style={{ maxHeight: 64, maxWidth: 240 }} /></p> : <p className="muted-cell">{T("Logo není nahrané.", "No logo is uploaded.")}</p>}
      <div className="admin-actions">
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-testid="logo-input" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        {logo && <button type="button" className="button subtle" onClick={() => void removeLogo()} disabled={busy}>{T("Odebrat logo", "Remove the logo")}</button>}
      </div>
      <small className="field-hint">{T("PNG, JPEG, WebP nebo SVG do 1 MB.", "PNG, JPEG, WebP or SVG up to 1 MB.")}</small>
    </section>}
  </AdminPage>;
}
