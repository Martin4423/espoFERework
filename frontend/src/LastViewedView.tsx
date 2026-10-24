import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, ExternalLink, Search } from "./Icons";
import { canAccessEntity, entityLabel, request } from "./api";
import type { Metadata } from "./api";

type ViewedRecord = Record<string, any> & { id: string; targetType?: string; targetId?: string; targetName?: string; createdAt?: string };

export default function LastViewedView({ metadata, onBack, onOpenRecord }: { metadata: Metadata; onBack: () => void; onOpenRecord: (entity: string, record: ViewedRecord) => void }) {
  const [rows, setRows] = useState<ViewedRecord[]>([]);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState("");

  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    request<{ lastViewedCount?: number }>("Settings").catch(() => ({ lastViewedCount: 20 })).then((settings) => request<{ list?: ViewedRecord[] }>(`LastViewed?maxSize=${Math.min(200, Math.max(1, Number(settings.lastViewedCount) || 20))}&offset=0`)).then((result) => {
      if (live) setRows((result.list || []).filter((item) => item.targetType && item.targetId && metadata.entityDefs?.[item.targetType] && canAccessEntity(metadata, item.targetType)));
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Historii prohlížených záznamů se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [metadata]);

  const scopes = useMemo(() => [...new Set(rows.map((item) => item.targetType!).filter(Boolean))].sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs")), [rows, metadata]);
  const visibleRows = rows.filter((item) => (!scope || item.targetType === scope) && (!query.trim() || `${item.targetName || item.target?.name || ""} ${entityLabel(metadata, item.targetType || "")}`.toLocaleLowerCase("cs").includes(query.trim().toLocaleLowerCase("cs"))));

  async function open(item: ViewedRecord) {
    if (!item.targetType || !item.targetId) return;
    setOpeningId(item.id); setError("");
    try {
      const record = await request<ViewedRecord>(`${encodeURIComponent(item.targetType)}/${encodeURIComponent(item.targetId)}`);
      onOpenRecord(item.targetType, record);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Záznam už není dostupný."); }
    finally { setOpeningId(""); }
  }

  return <div className="last-viewed-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Zpět</button><div className="eyebrow">HISTORIE PRÁCE</div><h1>Naposledy zobrazené<span className="title-count">{rows.length}</span></h1><p>Pokračujte v práci se záznamy, které jste nedávno otevřeli.</p></div><span className="last-viewed-clock"><Clock3 size={17}/> Osobní historie</span></div>
    {error && <div className="table-error">{error}<button onClick={() => setError("")}>Zavřít</button></div>}
    <section className="surface last-viewed-surface"><div className="last-viewed-toolbar"><label className="setting-field"><span>Oblast</span><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="">Všechny oblasti</option>{scopes.map((item) => <option key={item} value={item}>{entityLabel(metadata, item, true)}</option>)}</select></label><form className="last-viewed-search" onSubmit={(event) => event.preventDefault()}><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrovat nedávné záznamy…" aria-label="Filtrovat nedávné záznamy"/></form></div>
      <div className="last-viewed-list">{busy ? <div className="table-loading"><span className="spinner"/> Načítám historii…</div> : visibleRows.length ? visibleRows.map((item) => <button className="last-viewed-row" key={`${item.targetType}-${item.targetId}`} onClick={() => void open(item)} disabled={Boolean(openingId)}><span className="last-viewed-type">{entityLabel(metadata, item.targetType || "")}</span><span className="last-viewed-name"><strong>{item.targetName || item.target?.name || item.target?.subject || "Záznam bez názvu"}</strong><small>{item.targetType === "Contact" && item.target?.accountName ? item.target.accountName : item.targetType}</small></span><time>{item.createdAt ? new Date(item.createdAt).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" }) : ""}</time><span className="last-viewed-open">{openingId === item.id ? "Otevírám…" : <><ExternalLink size={14}/>Otevřít</>}</span><ArrowRight size={15} className="last-viewed-arrow"/></button>) : <div className="last-viewed-empty"><Clock3 size={22}/><strong>{query || scope ? "Nic neodpovídá filtru" : "Zatím jste neotevřeli žádné záznamy"}</strong><small>{query || scope ? "Upravte hledání nebo zvolenou oblast." : "Naposledy navštívené záznamy se objeví zde."}</small></div>}</div>
    </section>
  </div>;
}
