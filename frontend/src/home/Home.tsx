import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { request, entityLabel, canCreateEntity } from "../api";
import type { Metadata } from "../api";
import { T, getLocale, useLocale } from "../i18n/index.ts";
import { Busy } from "../admin/ui.tsx";

type Row = Record<string, any>;
type Summary = { scope: string; total: number; recent: Row[]; failed: boolean };

const RECENT_SCOPES = 4;

// The start page: how many records each entity holds, what changed last, and the user's open tasks.
export function Home({ entities, metadata, user, refreshKey, onOpenEntity, onOpenRecord, onCreateRecord }: {
  entities: string[]; metadata: Metadata; user: { id: string; name?: string; userName?: string };
  refreshKey: number; onOpenEntity: (scope: string) => void; onOpenRecord: (scope: string, row: Row) => void; onCreateRecord: (scope: string) => void;
}) {
  useLocale();
  const [summaries, setSummaries] = useState<Summary[] | null>(null);
  useEffect(() => {
    let live = true;
    setSummaries(null);
    Promise.all(entities.map(async (scope): Promise<Summary> => {
      try {
        const page = await request<{ total: number; list: Row[] }>(`${scope}?maxSize=5&offset=0&orderBy=modifiedAt&order=desc`);
        return { scope, total: page.total, recent: page.list, failed: false };
      } catch { return { scope, total: 0, recent: [], failed: true }; }
    })).then((value) => { if (live) setSummaries(value); });
    return () => { live = false; };
  }, [entities, refreshKey]);

  const hour = new Date().getHours();
  const greeting = hour < 10 ? T("Dobré ráno", "Good morning") : hour < 18 ? T("Dobrý den", "Hello") : T("Dobrý večer", "Good evening");
  const shown = summaries?.filter((summary) => !summary.failed) ?? [];
  const withRecords = shown.filter((summary) => summary.recent.length).slice(0, RECENT_SCOPES);
  const today = new Date().toLocaleDateString(getLocale() === "cs" ? "cs-CZ" : "en-GB", { weekday: "long", day: "numeric", month: "long" });

  return <div className="home" data-testid="home">
    <div className="entity-heading"><div><h1>{greeting}{user.name ? `, ${user.name}` : ""}</h1><p>{today}</p></div></div>
    {!summaries ? <Busy /> : <>
      <section className="home-tiles" aria-label={T("Přehled záznamů", "Record overview")}>
        {shown.map((summary) => <div key={summary.scope} className="home-tile surface" data-testid={`home-tile-${summary.scope}`}>
          <button type="button" className="home-tile-open" onClick={() => onOpenEntity(summary.scope)}><span>{entityLabel(metadata, summary.scope, true)}</span><b>{summary.total}</b></button>
          {canCreateEntity(metadata, summary.scope) && <button type="button" className="icon-button" aria-label={`${T("Nový záznam", "New record")}: ${entityLabel(metadata, summary.scope)}`} onClick={() => onCreateRecord(summary.scope)}><Plus size={14} /></button>}
        </div>)}
      </section>
      <div className="home-recent">
        {withRecords.map((summary) => <section key={summary.scope} className="surface" style={{ padding: 16 }}>
          <h3>{T("Naposledy změněné", "Recently changed")}: {entityLabel(metadata, summary.scope, true)}</h3>
          <ul className="home-list">{summary.recent.map((row) => <li key={row.id}><button type="button" className="link-button" onClick={() => onOpenRecord(summary.scope, row)}>{row.name || row.subject || row.id}</button></li>)}</ul>
        </section>)}
        {!withRecords.length && <section className="surface" style={{ padding: 16 }} data-testid="home-empty"><p className="muted-cell">{T("Zatím tu nejsou žádné záznamy. Začněte tlačítkem + u některé entity.", "There are no records yet. Start with the + button on an entity.")}</p></section>}
      </div>
    </>}
  </div>;
}
