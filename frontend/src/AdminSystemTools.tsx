import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Database, RefreshCw, RotateCcw, Server, Terminal } from "./Icons";
import { request } from "./api";

type SystemData = Record<string, any>;
type CheckItem = { section: string; name: string; value: any };

function flattenRequirements(data: SystemData): CheckItem[] {
  return Object.entries(data || {}).flatMap(([section, items]) => Object.entries(items || {}).map(([name, value]) => ({ section, name, value })));
}

function requirementState(value: any): { passed: boolean | null; message: string } {
  if (typeof value === "boolean") return { passed: value, message: value ? "Splněno" : "Nesplněno" };
  if (!value || typeof value !== "object") return { passed: null, message: String(value ?? "—") };
  const passed = value.isPassed ?? value.passed ?? value.isValid ?? value.success ?? value.acceptable;
  const actual = value.actual ?? value.version ?? value.value;
  const message = value.message || (actual != null ? `${actual}${value.required ? ` · požadováno ${value.required}` : ""}` : value.description || JSON.stringify(value));
  return { passed: typeof passed === "boolean" ? passed : null, message };
}

export default function AdminSystemTools({ onBack }: { onBack: () => void }) {
  const [requirements, setRequirements] = useState<SystemData>({});
  const [jobs, setJobs] = useState<string[]>([]);
  const [cron, setCron] = useState<{ message?: string; command?: string }>({});
  const [busy, setBusy] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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

  async function runAction(name: "clearCache" | "rebuild") {
    const labels = { clearCache: "vyčistit aplikační cache", rebuild: "spustit kompletní rebuild CRM" };
    if (!window.confirm(`Opravdu chcete ${labels[name]}?`)) return;
    setAction(name); setError(""); setNotice("");
    try { await request(`Admin/${name}`, { method: "POST", body: JSON.stringify({}) }); setNotice(name === "clearCache" ? "Aplikační cache byla vyčištěna." : "Rebuild EspoCRM byl dokončen."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Akce se nepodařila dokončit."); }
    finally { setAction(""); }
  }

  const rows = flattenRequirements(requirements);
  const passed = rows.filter((row) => requirementState(row.value).passed === true).length;
  const failed = rows.filter((row) => requirementState(row.value).passed === false).length;
  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">PROVOZ A DIAGNOSTIKA</div><h1>Systémové nástroje</h1><p>Požadavky serveru, plánované úlohy a údržba instalace EspoCRM.</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/> Obnovit stav</button></div>
    {error && <div className="table-error">{error}<button onClick={() => void load()}>Načíst znovu</button></div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <div className="system-tool-actions"><section className="surface system-action-card"><span className="system-action-icon"><RotateCcw size={18}/></span><div><strong>Vyčistit cache</strong><p>Smaže dočasnou aplikační cache. EspoCRM ji znovu vytvoří při běhu.</p></div><button className="button subtle" onClick={() => void runAction("clearCache")} disabled={Boolean(action)}>{action === "clearCache" ? "Probíhá…" : "Vyčistit"}</button></section><section className="surface system-action-card"><span className="system-action-icon"><Database size={18}/></span><div><strong>Rebuild aplikace</strong><p>Obnoví metadata, konfiguraci a aplikační cache EspoCRM.</p></div><button className="button primary" onClick={() => void runAction("rebuild")} disabled={Boolean(action)}>{action === "rebuild" ? "Probíhá…" : "Spustit rebuild"}</button></section></div>
    <div className="system-tools-grid"><section className="surface system-info-card"><div className="settings-card-head"><div><h2><Server size={15}/> Systémové požadavky</h2><p>{busy ? "Načítám stav instalace…" : `${passed} splněno${failed ? ` · ${failed} problémů` : ""}`}</p></div></div>{busy ? <div className="table-loading"><span className="spinner"/> Kontroluji server…</div> : rows.length ? <div className="system-check-list">{rows.map((row) => { const state = requirementState(row.value); return <div className="system-check-row" key={`${row.section}-${row.name}`}><span className={`requirement-dot ${state.passed === true ? "pass" : state.passed === false ? "fail" : "unknown"}`}/><span className="system-check-label"><small>{row.section}</small><strong>{row.name}</strong></span><span className="system-check-value">{state.message}</span></div>; })}</div> : <p className="field-manager-empty">API nevrátilo přehled systémových požadavků.</p>}</section>
      <section className="surface system-info-card"><div className="settings-card-head"><div><h2><Terminal size={15}/> Plánované úlohy</h2><p>Registrované EspoCRM scheduled jobs · {jobs.length}</p></div></div>{busy ? <div className="table-loading"><span className="spinner"/> Načítám úlohy…</div> : jobs.length ? <div className="system-job-list">{jobs.map((job) => <span key={job}>{job}</span>)}</div> : <p className="field-manager-empty">Nejsou dostupné žádné plánované úlohy.</p>}<div className="cron-command"><strong>Cron konfigurace</strong><p>{cron.message || "Nastavte systémový cron pro pravidelné spouštění úloh CRM."}</p>{cron.command && <code>{cron.command}</code>}</div></section></div>
  </div>;
}
