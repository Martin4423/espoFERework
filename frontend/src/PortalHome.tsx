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
  const [searchSections, setSearchSections] = useState<PortalSection[] | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchRetry, setSearchRetry] = useState(0);
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
      const total = Number(response.total);
      return { entity, list: response.list || [], total: Number.isFinite(total) && total >= 0 ? total : -1 };
    })).then((results) => {
      if (!live) return;
      const available = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setSections(available);
      onAvailableChange(available.map((section) => section.entity));
      setPending(false);
    });
    return () => { live = false; };
  }, [scopes, onAvailableChange]);

  useEffect(() => {
    const term = query.trim();
    if (!term) { setSearchSections(null); setSearchBusy(false); setSearchError(""); return; }
    if (term.length < 2) { setSearchSections([]); setSearchBusy(false); setSearchError(""); return; }
    setSearchBusy(true); setSearchError("");
    let live = true;
    const timer = window.setTimeout(() => {
      Promise.allSettled(scopes.map(async (entity) => {
        const params = new URLSearchParams({ maxSize: "5", textFilter: term });
        const orderBy = String(metadata.entityDefs[entity]?.collection?.orderBy || "");
        const order = String(metadata.entityDefs[entity]?.collection?.order || "asc");
        if (orderBy) { params.set("orderBy", orderBy); params.set("order", order); }
        const response = await request<{ list?: Row[]; total?: number }>(`${encodeURIComponent(entity)}?${params.toString()}`);
        return { entity, list: response.list || [], total: Number.isFinite(Number(response.total)) && Number(response.total) >= 0 ? Number(response.total) : -1 };
      })).then((results) => {
        if (!live) return;
        const matched = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        setSearchSections(matched);
        if (results.some((result) => result.status === "rejected")) setSearchError("Některé oblasti portálu se nepodařilo prohledat.");
      }).catch((cause) => live && setSearchError(cause instanceof Error ? cause.message : "Vyhledávání v portálu selhalo."))
        .finally(() => live && setSearchBusy(false));
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [query, searchRetry, scopes, metadata.entityDefs]);

  const term = query.trim();
  const visibleSections = term ? (term.length < 2 ? [] : (searchSections || []).filter((section) => section.total !== 0 || section.list.length > 0)) : sections;
  const knownTotals = sections.filter((section) => section.total >= 0);
  const totalRecords = knownTotals.reduce((sum, section) => sum + section.total, 0);
  const hasUnknownCounts = knownTotals.length !== sections.length;

  return <div className="portal-home">
    <section className="portal-welcome"><div className="portal-welcome-copy"><span className="eyebrow">{portalName}</span><h1>Dobrý den, {user.name || "vítejte"}</h1><p>Na jednom místě najdete své požadavky, dokumenty a komunikaci s naším týmem.</p><label className="portal-search"><Search size={16}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat v dostupných záznamech…" aria-label="Hledat v dostupných záznamech" aria-controls="portal-search-results"/></label></div><div className="portal-welcome-art"><LifeBuoy size={62} strokeWidth={1.3}/><span><b>{sections.length}</b> dostupných oblastí</span></div></section>
    <div className="portal-home-stats"><div><span>Oblasti portálu</span><strong>{sections.length || (pending ? "—" : 0)}</strong></div><div><span>Dostupné záznamy</span><strong title={hasUnknownCounts ? "Některé oblasti neposkytují přesný počet." : undefined}>{pending ? "—" : hasUnknownCounts ? `${totalRecords.toLocaleString("cs-CZ")}+` : totalRecords.toLocaleString("cs-CZ")}</strong></div><div><span>Váš účet</span><strong className="portal-account-state">Aktivní</strong></div></div>
    <div className="portal-section-heading"><div><span className="eyebrow">VAŠE ZÁZNAMY</span><h2>Co potřebujete vyřídit?</h2><p>Obsah a oprávnění spravuje váš poskytovatel portálu.</p></div><span className="portal-updated"><Clock3 size={14}/> Aktuální data</span></div>
    <div id="portal-search-results" aria-live="polite" aria-busy={searchBusy || pending}>
    {pending ? <div className="portal-record-grid">{Array.from({ length: Math.min(Math.max(scopes.length, 1), 4) }, (_, index) => <div className="surface portal-record-card portal-loading-card" key={index}><span className="portal-loading-line"/><span className="portal-loading-line short"/><span className="portal-loading-line"/></div>)}</div> : searchBusy ? <div className="surface portal-no-results" role="status"><span className="spinner"/><div><strong>Hledám v dostupných záznamech…</strong><p>Prohledávám všechny oblasti, ke kterým máte přístup.</p></div></div> : searchError ? <div className="surface portal-no-results" role="alert"><CircleHelp size={20}/><div><strong>Vyhledávání se nedokončilo</strong><p>{searchError}</p><button className="button subtle" onClick={() => setSearchRetry((count) => count + 1)}>Zkusit znovu</button></div></div> : term.length === 1 ? <div className="surface portal-no-results"><Search size={20}/><div><strong>Zadejte alespoň dva znaky</strong><p>Potom prohledám všechny dostupné záznamy.</p></div></div> : visibleSections.length ? <div className="portal-record-grid">{visibleSections.map((section) => <section className="surface portal-record-card" key={section.entity}><header><div><h3>{entityLabel(metadata, section.entity, true)}</h3><small>{section.total >= 0 ? `${section.total.toLocaleString("cs-CZ")} záznamů` : "Počet není dostupný"}</small></div><button className="portal-open-all" onClick={() => onOpenEntity(section.entity)} aria-label={`Zobrazit ${entityLabel(metadata, section.entity, true)}`}><ArrowRight size={16}/></button></header>{section.list.length ? <div className="portal-record-list">{section.list.map((row, index) => <button key={row.id || index} onClick={() => onOpenRecord(section.entity, row)}><span><strong>{row.name || row.subject || row.number || "Záznam"}</strong><small>{row.status || row.stage || row.type || "Otevřít detail"}</small></span><ArrowRight size={14}/></button>)}</div> : <div className="portal-empty-list">Zatím tu nejsou žádné odpovídající záznamy.</div>}<button className="portal-all-records" onClick={() => onOpenEntity(section.entity)}>Všechny záznamy <ArrowRight size={13}/></button></section>)}</div> : <div className="surface portal-no-results"><CircleHelp size={20}/><div><strong>{term ? "Nic jsme nenašli" : "Zatím nejsou dostupné žádné oblasti"}</strong><p>{term ? "Zkuste jiný výraz nebo vymažte hledání." : "Požádejte správce portálu o přístup k záznamům."}</p></div></div>}
    </div>
    <footer className="portal-home-footer">Vaše záznamy jsou chráněné oprávněními nastavenými v EspoCRM.</footer>
  </div>;
}
