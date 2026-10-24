import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Search } from "./Icons";
import { canAccessEntity, entityLabel, fetchLayout, fieldLabel, request } from "./api";
import type { LayoutItem, Metadata } from "./api";
import { formatEspoDateTime, useEspoTimeZone } from "./timeZone";

type ViewedRecord = Record<string, any> & { id: string; targetType?: string; targetId?: string; targetName?: string; createdAt?: string };
type ViewedColumn = Exclude<LayoutItem, false>;

export default function LastViewedView({ metadata, onBack, onOpenRecord }: { metadata: Metadata; onBack: () => void; onOpenRecord: (entity: string, record: ViewedRecord) => void }) {
  const timeZone = useEspoTimeZone();
  const [rows, setRows] = useState<ViewedRecord[]>([]);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [layout, setLayout] = useState<ViewedColumn[]>([]);

  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    const pageSize = Math.max(1, Number(metadata.appSettings?.recordsPerPage) || 20);
    Promise.all([
      request<{ list?: ViewedRecord[] }>(`LastViewed?maxSize=${pageSize}&offset=0`),
      fetchLayout<LayoutItem[]>("ActionHistoryRecord", "listForLastViewed").catch(() => [] as LayoutItem[]),
    ]).then(([result, nativeLayout]) => {
      if (!live) return;
      setRows((result.list || []).filter((item) => item.targetType && item.targetId && metadata.entityDefs?.[item.targetType] && canAccessEntity(metadata, item.targetType)));
      setLayout(nativeLayout.filter((item): item is ViewedColumn => Boolean(item) && typeof item === "object" && Boolean(item.name)));
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Historii prohlížených záznamů se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [metadata]);

  const scopes = useMemo(() => [...new Set(rows.map((item) => item.targetType!).filter(Boolean))].sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs")), [rows, metadata]);
  const visibleRows = rows.filter((item) => (!scope || item.targetType === scope) && (!query.trim() || `${item.targetName || item.target?.name || ""} ${entityLabel(metadata, item.targetType || "")}`.toLocaleLowerCase("cs").includes(query.trim().toLocaleLowerCase("cs"))));
  const columns: ViewedColumn[] = layout.length ? layout.filter((column) => !column.hidden) : [{ name: "targetType" }, { name: "target" }, { name: "createdAt" }];
  const gridColumns = `${columns.map((column) => column.widthPx ? `${column.widthPx}px` : column.width ? `${column.width}%` : "minmax(0, 1fr)").join(" ")} 18px`;
  const gridStyle = { ["--last-viewed-grid-columns" as string]: gridColumns } as React.CSSProperties;

  function valueFor(item: ViewedRecord, name: string) {
    if (name === "targetType") return entityLabel(metadata, item.targetType || "");
    if (name === "target") return item.targetName || item.target?.name || item.target?.subject || item.target?.emailAddress || "Záznam bez názvu";
    if (name === "createdAt") return item.createdAt ? formatEspoDateTime(item.createdAt, timeZone) : "";
    const value = item[name] ?? item.target?.[name] ?? item[`${name}Name`] ?? item.target?.[`${name}Name`];
    if (Array.isArray(value)) return value.map((entry) => typeof entry === "object" ? entry.name || entry.value || "" : entry).filter(Boolean).join(", ");
    if (value && typeof value === "object") return value.name || value.value || "";
    return value == null ? "" : String(value);
  }

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
      <div className="last-viewed-list">{!busy && visibleRows.length > 0 && <div className="last-viewed-columns" style={gridStyle}>{columns.map((column) => <span key={column.name} data-column={column.name} style={{ textAlign: column.align || "left" }}>{column.label || fieldLabel(column.name!, metadata.entityDefs?.ActionHistoryRecord?.fields?.[column.name!], "ActionHistoryRecord", metadata)}</span>)}<span aria-hidden="true"/></div>}{busy ? <div className="table-loading"><span className="spinner"/> Načítám historii…</div> : visibleRows.length ? visibleRows.map((item) => <button className="last-viewed-row" key={`${item.targetType}-${item.targetId}`} onClick={() => void open(item)} disabled={Boolean(openingId)} aria-label={`Otevřít ${valueFor(item, "target")} · ${entityLabel(metadata, item.targetType || "")}`} style={gridStyle}>{columns.map((column) => <span className={`last-viewed-cell ${column.name === "targetType" ? "last-viewed-type" : column.name === "target" ? "last-viewed-name" : ""}`} key={column.name} data-column={column.name} title={valueFor(item, column.name!)} style={{ textAlign: column.align || "left" }}>{column.name === "targetType" ? valueFor(item, column.name!) : column.name === "target" ? <><strong>{valueFor(item, column.name!)}</strong><small>{item.targetType === "Contact" && item.target?.accountName ? item.target.accountName : entityLabel(metadata, item.targetType || "")}</small></> : column.name === "createdAt" ? <time>{valueFor(item, column.name!)}</time> : valueFor(item, column.name!) || <span aria-label="Bez hodnoty">—</span>}</span>)}<ArrowRight size={15} className="last-viewed-arrow"/></button>) : <div className="last-viewed-empty"><Clock3 size={22}/><strong>{query || scope ? "Nic neodpovídá filtru" : "Zatím jste neotevřeli žádné záznamy"}</strong><small>{query || scope ? "Upravte hledání nebo zvolenou oblast." : "Naposledy navštívené záznamy se objeví zde."}</small></div>}</div>
    </section>
  </div>;
}
