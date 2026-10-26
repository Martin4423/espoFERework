import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { entityLabel, request } from "../api";
import type { Metadata } from "../api";
import { T, useLocale } from "../i18n/index.ts";

type Row = Record<string, any>;
type Hit = { scope: string; row: Row };

const PER_ENTITY = 5;
const DEBOUNCE_MS = 250;

// Ctrl/Cmd+K: one search over every entity the user can read, grouped by entity; the arrows and Enter pick a hit.
export function GlobalSearch({ metadata, entities, onClose, onSelect }: { metadata: Metadata; entities: string[]; onClose: () => void; onSelect: (scope: string, row: Row) => void }) {
  useLocale();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const run = useRef(0);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    const text = query.trim();
    const id = ++run.current;
    if (text.length < 2) { setHits([]); setBusy(false); setFailed(false); return; }
    setBusy(true);
    const timer = window.setTimeout(async () => {
      const answers = await Promise.all(entities.map(async (scope) => {
        try { return { scope, rows: (await request<{ list: Row[] }>(`${scope}?maxSize=${PER_ENTITY}&offset=0&textFilter=${encodeURIComponent(text)}`)).list, ok: true }; }
        catch { return { scope, rows: [] as Row[], ok: false }; }
      }));
      if (id !== run.current) return;
      setHits(answers.flatMap((answer) => answer.rows.map((row) => ({ scope: answer.scope, row }))));
      setFailed(answers.length > 0 && answers.every((answer) => !answer.ok));
      setActive(0); setBusy(false);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, entities]);

  function key(event: React.KeyboardEvent) {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(hits.length - 1, value + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
    else if (event.key === "Enter" && hits[active]) { event.preventDefault(); onSelect(hits[active].scope, hits[active].row); }
  }

  let lastScope = "";
  return <div className="modal-backdrop global-search-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="record-modal global-search" role="dialog" aria-modal="true" aria-label={T("Hledání", "Search")} data-testid="global-search" onKeyDown={key}>
      <div className="global-search-input"><Search size={16} aria-hidden="true" />
        <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T("Hledat ve všech záznamech…", "Search all records…")} aria-label={T("Hledat", "Search")} /></div>
      <div className="global-search-results" role="listbox">
        {query.trim().length < 2 && <p className="muted-cell">{T("Napište aspoň dva znaky.", "Type at least two characters.")}</p>}
        {busy && <p className="muted-cell">{T("Hledám…", "Searching…")}</p>}
        {!busy && failed && <p className="inline-error" role="alert">{T("Hledání se nepodařilo.", "The search failed.")}</p>}
        {!busy && !failed && query.trim().length >= 2 && !hits.length && <p className="muted-cell" data-testid="global-search-empty">{T("Nic nenalezeno.", "Nothing found.")}</p>}
        {hits.map((hit, index) => {
          const heading = hit.scope !== lastScope ? entityLabel(metadata, hit.scope, true) : null;
          lastScope = hit.scope;
          return <div key={`${hit.scope}-${hit.row.id}`}>
            {heading && <h4>{heading}</h4>}
            <button type="button" role="option" aria-selected={index === active} className={`global-search-hit${index === active ? " active" : ""}`} onMouseEnter={() => setActive(index)} onClick={() => onSelect(hit.scope, hit.row)}>{hit.row.name || hit.row.subject || hit.row.id}</button>
          </div>;
        })}
      </div>
    </section>
  </div>;
}
