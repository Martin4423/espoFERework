import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleHelp, Clock3, LifeBuoy, Search } from "./Icons";
import { entityLabel, request } from "./api";
import type { Metadata, User } from "./api";
import { portalEntities } from "./portalEntities";

type Row = Record<string, any>;
type PortalSection = { entity: string; list: Row[]; total: number };

export default function PortalHome({ metadata, user, portalName = "Klientský portál", onOpenEntity, onOpenRecord, onAvailableChange }: {
  metadata: Metadata;
  user: User;
  portalName?: string;
  onOpenEntity: (entity: string) => void;
  onOpenRecord: (entity: string, row: Row) => void;
  onAvailableChange: (entities: string[]) => void;
}) {
  const scopes = useMemo(() => portalEntities(metadata), [metadata]);
  const [sections, setSections] = useState<PortalSection[]>([]);
  const [pending, setPending] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    setPending(true);
    Promise.allSettled(scopes.map(async (entity) => {
      const orderBy = String(metadata.entityDefs[entity]?.collection?.orderBy || "");
      const order = String(metadata.entityDefs[entity]?.collection?.order || "asc");
      const params = new URLSearchParams({ maxSize: "5" });
      if (orderBy) { params.set("orderBy", orderBy); params.set("order", order); }
      const response = await request<{ list?: Row[]; total?: number }>(`${encodeURIComponent(entity)}?${params.toString()}`);
      return { entity, list: response.list || [], total: Number(response.total || 0) };
    })).then((results) => {
      if (!live) return;
      const available = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setSections(available);
      onAvailableChange(available.map((section) => section.entity));
      setPending(false);
    });
    return () => { live = false; };
  }, [scopes, onAvailableChange]);

  const visibleSections = sections.filter((section) => !query || entityLabel(metadata, section.entity, true).toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs")) || section.list.some((row) => String(row.name || row.subject || row.number || "").toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs"))));
  const totalRecords = sections.reduce((sum, section) => sum + section.total, 0);

  return <div className="portal-home">
    <section className="portal-welcome"><div className="portal-welcome-copy"><span className="eyebrow">{portalName}</span><h1>Dobrý den, {user.name || "vítejte"}</h1><p>Na jednom místě najdete své požadavky, dokumenty a komunikaci s naším týmem.</p><label className="portal-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat v dostupných záznamech…" aria-label="Hledat v dostupných záznamech"/></label></div><div className="portal-welcome-art"><LifeBuoy size={62} strokeWidth={1.3}/><span><b>{sections.length}</b> dostupných oblastí</span></div></section>
    <div className="portal-home-stats"><div><span>Oblasti portálu</span><strong>{sections.length || (pending ? "—" : 0)}</strong></div><div><span>Dostupné záznamy</span><strong>{pending ? "—" : totalRecords.toLocaleString("cs-CZ")}</strong></div><div><span>Váš účet</span><strong className="portal-account-state">Aktivní</strong></div></div>
    <div className="portal-section-heading"><div><span className="eyebrow">VAŠE ZÁZNAMY</span><h2>Co potřebujete vyřídit?</h2><p>Obsah a oprávnění spravuje váš poskytovatel portálu.</p></div><span className="portal-updated"><Clock3 size={14}/> Aktuální data</span></div>
    {pending ? <div className="portal-record-grid">{Array.from({ length: Math.min(Math.max(scopes.length, 1), 4) }, (_, index) => <div className="surface portal-record-card portal-loading-card" key={index}><span className="portal-loading-line"/><span className="portal-loading-line short"/><span className="portal-loading-line"/></div>)}</div> : visibleSections.length ? <div className="portal-record-grid">{visibleSections.map((section) => <section className="surface portal-record-card" key={section.entity}><header><div><h3>{entityLabel(metadata, section.entity, true)}</h3><small>{section.total.toLocaleString("cs-CZ")} záznamů</small></div><button className="portal-open-all" onClick={() => onOpenEntity(section.entity)} aria-label={`Zobrazit ${entityLabel(metadata, section.entity, true)}`}><ArrowRight size={16}/></button></header>{section.list.length ? <div className="portal-record-list">{section.list.map((row, index) => <button key={row.id || index} onClick={() => onOpenRecord(section.entity, row)}><span><strong>{row.name || row.subject || row.number || "Záznam"}</strong><small>{row.status || row.stage || row.type || "Otevřít detail"}</small></span><ArrowRight size={14}/></button>)}</div> : <div className="portal-empty-list">Zatím tu nejsou žádné záznamy.</div>}<button className="portal-all-records" onClick={() => onOpenEntity(section.entity)}>Všechny záznamy <ArrowRight size={13}/></button></section>)}</div> : <div className="surface portal-no-results"><CircleHelp size={20}/><div><strong>{query ? "Nic jsme nenašli" : "Zatím nejsou dostupné žádné oblasti"}</strong><p>{query ? "Zkuste jiný výraz nebo vymažte hledání." : "Požádejte správce portálu o přístup k záznamům."}</p></div></div>}
    <footer className="portal-home-footer">Vaše záznamy jsou chráněné oprávněními nastavenými v EspoCRM.</footer>
  </div>;
}
