import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Database, RefreshCw, RotateCcw, Server, Terminal, X } from "./Icons";
import { request, type Metadata } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type SystemData = Record<string, any>;

type RequirementGroup = { key: "php" | "database" | "permission"; label: string; rows: Array<[string, any]> };

function readableRequirement(value: unknown): string {
  return String(value ?? "—").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toLocaleUpperCase("cs"));
}

export default function AdminSystemTools({ metadata, onBack, onRefreshMetadata }: { metadata: Metadata; onBack: () => void; onRefreshMetadata: () => Promise<void> }) {
  const [requirements, setRequirements] = useState<SystemData>({});
  const [jobs, setJobs] = useState<string[]>([]);
  const [cron, setCron] = useState<{ message?: string; command?: string }>({});
  const [busy, setBusy] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmAction, setConfirmAction] = useState<"clearCache" | "rebuild" | null>(null);
  const confirmDialogRef = useDialogFocus<HTMLElement>(() => { if (!action) setConfirmAction(null); }, !action, Boolean(confirmAction));
  const load = useCallback(async () => {
    setBusy(true); setError("");
    const [reqResult, jobsResult, cronResult] = await Promise.allSettled([
      request<SystemData>("Admin/action/systemRequirementList"),
      request<string[]>("Admin/jobs"),
      request<{ message?: string; command?: string }>("Admin/action/cronMessage"),
    ]);
    const failures: string[] = [];
    if (reqResult.status === "fulfilled") setRequirements(reqResult.value); else failures.push(reqResult.reason instanceof Error ? reqResult.reason.message : "Požadavky nelze načíst.");
    if (jobsResult.status === "fulfilled") setJobs(jobsResult.value || []); else failures.push(jobsResult.reason instanceof Error ? jobsResult.reason.message : "Úlohy nelze načíst.");
    if (cronResult.status === "fulfilled") setCron(cronResult.value); else failures.push(cronResult.reason instanceof Error ? cronResult.reason.message : "Cron konfiguraci nelze načíst.");
    if (failures.length) setError(failures.join(" "));
    setBusy(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function runAction(name: "clearCache" | "rebuild", confirmed = false) {
    if (!confirmed) { setConfirmAction(name); return; }
    setAction(name); setError(""); setNotice("");
    try { await request(`Admin/${name}`, { method: "POST", body: JSON.stringify({}) }); await onRefreshMetadata(); setNotice(name === "clearCache" ? "Aplikační cache byla vyčištěna a data rozhraní obnovena." : "Rebuild EspoCRM byl dokončen a data rozhraní obnovena."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Akce se nepodařila dokončit."); }
    finally { setAction(""); }
  }
  async function confirmSystemAction() {
    const name = confirmAction;
    if (!name || action) return;
    setConfirmAction(null);
    await runAction(name, true);
  }

  const nativeLabels = (metadata.labels as any)?.Admin?.systemRequirements || {};
  const groups: RequirementGroup[] = [
    { key: "php", label: "PHP nastavení", rows: Object.entries(requirements.php || {}) },
    { key: "database", label: "Nastavení databáze", rows: Object.entries(requirements.database || {}) },
    { key: "permission", label: "Oprávnění", rows: Object.entries(requirements.permission || {}) },
  ];
  const rows = groups.flatMap((group) => group.rows.map(([name, value]) => ({ group: group.key, name, value })));
  const passed = rows.filter(({ value }) => value && typeof value === "object" && value.acceptable === true).length;
  const failed = rows.filter(({ value }) => value && typeof value === "object" && value.acceptable === false).length;
  const requirementDetail = (group: RequirementGroup["key"], value: any) => {
    if (group === "permission") return nativeLabels[value?.type] || readableRequirement(value?.type);
    const actual = value?.actual ?? value?.version ?? value?.value;
    const detail = actual == null ? "—" : String(actual);
    if (value?.acceptable === false && group === "php" && value?.type === "lib") return `${detail} · Chybí rozšíření PHP`;
    if (value?.acceptable === false && value?.type === "version" && value?.required != null) return `${detail} · Požadováno: ${value.required}`;
    if (value?.acceptable === false && value?.type === "param" && value?.required != null) return `${detail} · Doporučeno: ${value.required}`;
    return detail;
  };
  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">PROVOZ A DIAGNOSTIKA</div><h1>Systémové nástroje</h1><p>Požadavky serveru, plánované úlohy a údržba instalace EspoCRM.</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/> Obnovit stav</button></div>
    {error && <div className="table-error">{error}<button onClick={() => void load()}>Načíst znovu</button></div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <div className="system-tool-actions"><section className="surface system-action-card"><span className="system-action-icon"><RotateCcw size={18}/></span><div><strong>Vyčistit cache</strong><p>Smaže dočasnou aplikační cache. EspoCRM ji znovu vytvoří při běhu.</p></div><button className="button subtle" onClick={() => void runAction("clearCache")} disabled={Boolean(action)}>{action === "clearCache" ? "Probíhá…" : "Vyčistit"}</button></section><section className="surface system-action-card"><span className="system-action-icon"><Database size={18}/></span><div><strong>Rebuild aplikace</strong><p>Obnoví metadata, konfiguraci a aplikační cache EspoCRM.</p></div><button className="button primary" onClick={() => void runAction("rebuild")} disabled={Boolean(action)}>{action === "rebuild" ? "Probíhá…" : "Spustit rebuild"}</button></section></div>
    <div className="system-tools-grid"><section className="surface system-info-card"><div className="settings-card-head"><div><h2><Server size={15}/> Systémové požadavky</h2><p>{busy ? "Načítám stav instalace…" : `${passed} v pořádku${failed ? ` · ${failed} problémů` : ""}`}</p></div></div>{busy ? <div className="table-loading"><span className="spinner"/> Kontroluji server…</div> : rows.length ? <div className="system-requirement-groups">{groups.map((group) => group.rows.length ? <div className="system-requirement-group" key={group.key}><h3>{group.label}</h3><div className="system-check-list">{group.rows.map(([name, value]) => { const acceptable = typeof value?.acceptable === "boolean" ? value.acceptable : null; const detail = requirementDetail(group.key, value); const status = acceptable === true ? "Splněno" : acceptable === false ? "Nesplněno" : "—"; return <div className="system-check-row" key={`${group.key}-${name}`}><span className={`requirement-dot ${acceptable === true ? "pass" : acceptable === false ? "fail" : "unknown"}`}/><span className="system-check-label"><strong>{nativeLabels[name] || readableRequirement(name)}</strong>{group.key === "permission" && <small>{detail}</small>}</span><span className="system-check-value">{group.key === "permission" ? status : detail}{group.key !== "permission" && <small className={acceptable === true ? "requirement-pass-label" : acceptable === false ? "requirement-fail-label" : ""}>{status}</small>}</span></div>; })}</div></div> : null)}<div className="system-requirement-help"><a href="https://docs.espocrm.com/administration/server-configuration/" target="_blank" rel="noreferrer">Pokyny ke konfiguraci serveru ↗</a></div></div> : <p className="field-manager-empty">API nevrátilo přehled systémových požadavků.</p>}</section>
      <section className="surface system-info-card"><div className="settings-card-head"><div><h2><Terminal size={15}/> Plánované úlohy</h2><p>Registrované EspoCRM scheduled jobs · {jobs.length}</p></div></div>{busy ? <div className="table-loading"><span className="spinner"/> Načítám úlohy…</div> : jobs.length ? <div className="system-job-list">{jobs.map((job) => <span key={job}>{job}</span>)}</div> : <p className="field-manager-empty">Nejsou dostupné žádné plánované úlohy.</p>}<div className="cron-command"><strong>Cron konfigurace</strong><p>{cron.message || "Nastavte systémový cron pro pravidelné spouštění úloh CRM."}</p>{cron.command && <code>{cron.command}</code>}</div></section></div>
    {confirmAction && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !action && setConfirmAction(null)}><section ref={confirmDialogRef} className="record-modal system-action-confirm" role="alertdialog" aria-modal="true" aria-labelledby="system-action-confirm-title" aria-describedby="system-action-confirm-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">PROVOZ A DIAGNOSTIKA</span><h2 id="system-action-confirm-title">{confirmAction === "clearCache" ? "Vyčistit aplikační cache?" : "Spustit rebuild EspoCRM?"}</h2></div><button type="button" className="icon-button" onClick={() => setConfirmAction(null)} disabled={Boolean(action)} aria-label="Zavřít"><X size={16}/></button></div><div className="system-action-confirm-body"><AlertTriangle size={18}/><p id="system-action-confirm-description">{confirmAction === "clearCache" ? "Dočasná aplikační cache se smaže a EspoCRM ji znovu vytvoří. Po dokončení obnovím metadata a data tohoto rozhraní." : "EspoCRM znovu sestaví metadata, konfiguraci a aplikační cache. Operace může na chvíli zatížit server; po dokončení obnovím metadata a data tohoto rozhraní."}</p></div><div className="modal-footer"><button type="button" className="button subtle" autoFocus onClick={() => setConfirmAction(null)} disabled={Boolean(action)}>Zrušit</button><button type="button" className="button primary" onClick={() => void confirmSystemAction()} disabled={Boolean(action)}>{confirmAction === "clearCache" ? <RotateCcw size={14}/> : <Database size={14}/>} {confirmAction === "clearCache" ? "Vyčistit cache" : "Spustit rebuild"}</button></div></section></div>}
  </div>;
}
