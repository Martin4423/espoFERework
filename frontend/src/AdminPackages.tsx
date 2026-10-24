import { useCallback, useEffect, useState } from "react";
import type { DragEvent } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, ExternalLink, Package, RefreshCw, ShieldAlert, Trash2, Upload, X } from "./Icons";
import { request } from "./api";
import type { Metadata } from "./api";

type Extension = { id: string; name: string; version?: string; description?: string; isInstalled?: boolean; [key: string]: any };
type UploadResult = { id: string; name: string; version: string; description?: string };

function readPackage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Balíček nelze přečíst."));
    reader.readAsDataURL(file);
  });
}

function PackageUploadCard({ title, description, buttonLabel, disabled, busy, maxSize, onFile, className = "" }: {
  title: string;
  description: string;
  buttonLabel: string;
  disabled: boolean;
  busy: boolean;
  maxSize: number;
  onFile: (file: File | undefined) => void;
  className?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    if (!disabled) onFile(event.dataTransfer.files?.[0]);
  }
  return <section className={`surface package-upload ${dragOver ? "drag-over" : ""} ${disabled ? "upload-disabled" : ""} ${className}`.trim()}
    onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragOver(true); }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { const target = event.relatedTarget; if (!(target instanceof Node) || !event.currentTarget.contains(target)) setDragOver(false); }}
    onDrop={drop} aria-label={title}>
    <div className="package-upload-icon"><Upload size={19}/></div>
    <div><strong>{title}</strong><p>{description}{maxSize > 0 ? ` Limit souboru je ${maxSize} MB.` : ""}</p><small className="package-drop-hint">nebo přetáhněte ZIP soubor sem</small></div>
    <label className={`button primary ${disabled ? "disabled" : ""}`}>
      <input type="file" accept=".zip,application/zip" disabled={disabled} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; onFile(file); }}/>
      <Upload size={14}/>{busy ? "Ověřuji balíček…" : buttonLabel}
    </label>
    {dragOver && !disabled && <span className="package-drop-overlay" aria-live="polite">Pusťte ZIP balíček k nahrání</span>}
  </section>;
}

export function AdminExtensions({ metadata, onBack, onInstalled }: { metadata: Metadata; onBack: () => void; onInstalled: () => void }) {
  const [items, setItems] = useState<Extension[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const pageSize = Math.max(1, Number(metadata.appSettings?.recordsPerPage) || 20);
  const [pending, setPending] = useState<UploadResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const result = await request<{ list: Extension[]; total?: number }>(`Extension?maxSize=${pageSize}&offset=${offset}&orderBy=name&order=asc`); const list = result.list || []; const count = Number(result.total) || 0; setItems(list); setTotal(count); if (!list.length && offset > 0 && offset >= count) setOffset(Math.max(0, Math.floor((Math.max(count, 1) - 1) / pageSize) * pageSize)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Rozšíření nelze načíst."); }
    finally { setBusy(false); }
  }, [offset, pageSize]);
  useEffect(() => { void load(); }, [load]);
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) { setError("Vyberte ZIP balíček rozšíření EspoCRM."); return; }
    const maxSize = Number(metadata.appParams?.maxUploadSize);
    if (maxSize > 0 && file.size > maxSize * 1024 * 1024) { setError(`Soubor překračuje limit pro nahrávání (${maxSize} MB).`); return; }
    setUploading(true); setError(""); setNotice(""); setPending(null);
    try {
      const body = await readPackage(file);
      const result = await request<UploadResult>("Extension/action/upload", { method: "POST", headers: { "Content-Type": "application/zip" }, body });
      setPending(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Balíček se nepodařilo nahrát nebo ověřit."); }
    finally { setUploading(false); }
  }
  async function install(item: UploadResult | Extension) {
    if (!window.confirm(`Nainstalovat rozšíření ${item.name} ${item.version || ""}? Instalace může změnit data a konfiguraci CRM.`)) return;
    setActionId(item.id); setError(""); setNotice("");
    try { await request("Extension/action/install", { method: "POST", body: JSON.stringify({ id: item.id }) }); setPending(null); setNotice(`Rozšíření ${item.name} bylo nainstalováno.`); await load(); onInstalled(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Instalace se nepodařila."); }
    finally { setActionId(""); }
  }
  async function uninstall(item: Extension) {
    if (!window.confirm(`Opravdu odinstalovat rozšíření ${item.name}?`)) return;
    setActionId(item.id); setError(""); setNotice("");
    try { await request("Extension/action/uninstall", { method: "POST", body: JSON.stringify({ id: item.id }) }); setNotice(`Rozšíření ${item.name} bylo odinstalováno.`); await load(); onInstalled(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Odinstalace se nepodařila."); }
    finally { setActionId(""); }
  }
  async function remove(item: Extension) {
    if (!window.confirm(`Trvale odstranit neinstalované rozšíření ${item.name}?`)) return;
    setActionId(item.id); setError(""); setNotice("");
    try { await request(`Extension/${encodeURIComponent(item.id)}`, { method: "DELETE" }); setNotice(`Balíček ${item.name} byl odstraněn.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Balíček se nepodařilo odstranit."); }
    finally { setActionId(""); }
  }
  return <div className="admin-view package-admin-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">DOPLŇKY A ROZŠÍŘENÍ</div><h1>Rozšíření</h1><p>Nahrávejte, instalujte a spravujte balíčky rozšíření EspoCRM.</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/>Obnovit</button></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <PackageUploadCard title="Nahrát ZIP balíček" description="EspoCRM ověří manifest kompatibility před instalací." buttonLabel="Vybrat balíček" disabled={uploading || Boolean(actionId)} busy={uploading} maxSize={Number(metadata.appParams?.maxUploadSize) || 0} onFile={(file) => void upload(file)}/>
    {pending && <section className="surface package-ready"><div className="package-ready-icon"><Package size={18}/></div><div className="package-ready-copy"><span className="eyebrow">BALÍČEK OVĚŘEN</span><strong>{pending.name} <small>v{pending.version}</small></strong><p>{pending.description || "Balíček prošel kontrolou EspoCRM a je připravený k instalaci."}</p></div><button className="button primary" onClick={() => void install(pending)} disabled={Boolean(actionId)}><Download size={14}/>{actionId ? "Instaluji…" : "Nainstalovat"}</button><button className="icon-button" onClick={() => setPending(null)} aria-label="Zavřít"><X size={15}/></button></section>}
    <section className="surface package-list"><div className="settings-card-head"><div><h2>Nahrané rozšíření</h2><p>{total} balíčků v instalaci EspoCRM</p></div></div>{busy ? <div className="table-loading"><span className="spinner"/>Načítám seznam rozšíření…</div> : items.length ? <><div className="package-items">{items.map((item) => <article className="package-row" key={item.id}><span className={`package-item-icon ${item.isInstalled ? "installed" : ""}`}><Package size={18}/></span><span className="package-item-info"><strong>{item.name}<small>v{item.version || "?"}</small></strong><span>{item.description || "Bez popisu"}</span></span><span className={`package-status ${item.isInstalled ? "installed" : "pending"}`}>{item.isInstalled ? "Nainstalováno" : "Nenainstalováno"}</span><div className="package-actions">{item.isInstalled ? <button className="button subtle danger-text" onClick={() => void uninstall(item)} disabled={Boolean(actionId)}>{actionId === item.id ? "Odebírám…" : "Odinstalovat"}</button> : <><button className="button primary" onClick={() => void install(item)} disabled={Boolean(actionId)}>{actionId === item.id ? "Instaluji…" : "Nainstalovat"}</button><button className="icon-button danger-ghost" title="Odstranit balíček" onClick={() => void remove(item)} disabled={Boolean(actionId)}><Trash2 size={14}/></button></>}</div></article>)}</div>{total > pageSize && <div className="package-pagination"><span>{offset + 1}–{Math.min(offset + items.length, total)} z {total}</span><button className="icon-button" aria-label="Předchozí rozšíření" disabled={!offset || busy} onClick={() => setOffset((current) => Math.max(0, current - pageSize))}><ChevronLeft size={15}/></button><button className="icon-button" aria-label="Další rozšíření" disabled={offset + items.length >= total || busy} onClick={() => setOffset((current) => current + pageSize)}><ChevronRight size={15}/></button></div>}</> : <div className="package-empty"><Package size={23}/><strong>Žádná rozšíření</strong><span>Nahrané balíčky se zobrazí v tomto seznamu.</span></div>}</section>
    <div className="package-security-note"><ShieldAlert size={15}/><span>Instalujte pouze balíčky z důvěryhodného zdroje. Rozšíření může přidat kód a měnit chování CRM.</span></div>
  </div>;
}

export function AdminUpgrade({ metadata, onBack, onUpgraded }: { metadata: Metadata; onBack: () => void; onUpgraded: () => void }) {
  const [version, setVersion] = useState("");
  const [upgradeId, setUpgradeId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) { setError("Vyberte ZIP balíček aktualizace EspoCRM."); return; }
    const maxSize = Number(metadata.appParams?.maxUploadSize);
    if (maxSize > 0 && file.size > maxSize * 1024 * 1024) { setError(`Soubor překračuje limit pro nahrávání (${maxSize} MB).`); return; }
    setUploading(true); setError(""); setNotice(""); setUpgradeId("");
    try { const body = await readPackage(file); const result = await request<{ id: string; version: string }>("Admin/action/uploadUpgradePackage", { method: "POST", headers: { "Content-Type": "application/zip" }, body }); setUpgradeId(result.id); setVersion(result.version); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Aktualizační balíček nelze ověřit."); }
    finally { setUploading(false); }
  }
  async function runUpgrade() {
    if (!upgradeId || !window.confirm(`Spustit aktualizaci EspoCRM na verzi ${version}? Před pokračováním ověřte zálohu souborů i databáze.`)) return;
    setRunning(true); setError(""); setNotice("Aktualizace probíhá. Nezavírejte toto okno.");
    try { await request("Admin/action/runUpgrade", { method: "POST", body: JSON.stringify({ id: upgradeId }) }); setNotice(`EspoCRM bylo aktualizováno na verzi ${version}.`); setUpgradeId(""); onUpgraded(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Aktualizace se nepodařila."); setNotice(""); }
    finally { setRunning(false); }
  }
  return <div className="admin-view package-admin-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">ÚDRŽBA INSTALACE</div><h1>Aktualizace EspoCRM</h1><p>Nahrajte a ověřte aktualizační balíček a spusťte upgrade instalace.</p></div></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <section className="surface upgrade-guidance"><div><span className="eyebrow">AKTUÁLNÍ INSTALACE</span><strong>EspoCRM {metadata.appSettings?.version || "—"}</strong></div><p>Než začnete, vytvořte zálohu databáze i souborů a ověřte požadavky cílové verze. Upgrade může dočasně přerušit dostupnost CRM.</p><div className="upgrade-links"><a href="https://www.espocrm.com/documentation/administration/upgrading/" target="_blank" rel="noreferrer">Postup aktualizace <ExternalLink size={13}/></a><a href="https://www.espocrm.com/download/upgrades" target="_blank" rel="noreferrer">Stáhnout upgrade balíček <ExternalLink size={13}/></a></div></section>
    <PackageUploadCard className="upgrade-upload" title="Nahrát aktualizační balíček" description="EspoCRM balíček před spuštěním ověří." buttonLabel="Vybrat ZIP" disabled={uploading || running} busy={uploading} maxSize={Number(metadata.appParams?.maxUploadSize) || 0} onFile={(file) => void upload(file)}/>
    {upgradeId && <section className="surface upgrade-ready"><div><span className="eyebrow">PŘIPRAVENO K AKTUALIZACI</span><h2>EspoCRM {version}</h2><p>Balíček byl úspěšně nahrán a ověřen. Upgrade může dočasně přerušit dostupnost CRM.</p></div><button className="button primary" onClick={() => void runUpgrade()} disabled={running}><Download size={14}/>{running ? "Probíhá upgrade…" : "Spustit aktualizaci"}</button></section>}
  </div>;
}
