import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, X } from "./Icons";
import { entityLabel, fetchLayout, fieldLabel } from "./api";
import type { LayoutItem, Metadata } from "./api";

type Row = Record<string, any>;

/** Native duplicate-confirmation modal with the entity's `listSmall` layout. */
export default function DuplicateCheckDialog({ entity, duplicates, metadata, busy, onCreate, onCancel }: { entity: string; duplicates: Row[]; metadata: Metadata; busy: boolean; onCreate: () => void; onCancel: () => void }) {
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  useEffect(() => { let live = true; fetchLayout<LayoutItem[]>(entity, "listSmall").then((result) => live && setLayout(Array.isArray(result) ? result : [])).catch(() => live && setLayout([])); return () => { live = false; }; }, [entity]);
  const fieldDefs = metadata.entityDefs?.[entity]?.fields || {};
  const columns = useMemo(() => {
    const fromLayout = layout.filter((item): item is Exclude<LayoutItem, false> => Boolean(item) && typeof item === "object" && Boolean(item.name)).map((item) => item.name!).filter((name) => fieldDefs[name]);
    if (fromLayout.length) return [...new Set(fromLayout)].slice(0, 5);
    return ["name", "firstName", "lastName", "emailAddress", "phoneNumber"].filter((name) => fieldDefs[name]).slice(0, 5);
  }, [layout, fieldDefs]);
  function value(row: Row, name: string) {
    const def = fieldDefs[name];
    const raw = row[name] ?? row[`${name}Name`] ?? row[`${name}Id`];
    if (raw == null || raw === "") return "—";
    if (def?.type === "bool") return raw ? "Ano" : "Ne";
    if (typeof raw === "object") return Array.isArray(raw) ? raw.map(String).join(", ") : JSON.stringify(raw);
    return (metadata.labels as any)?.[entity]?.options?.[name]?.[String(raw)] || String(raw);
  }
  return <div className="modal-backdrop duplicate-check-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}><section className="record-modal duplicate-check-dialog" role="dialog" aria-modal="true" aria-labelledby="duplicate-check-title"><div className="modal-heading"><div><span className="eyebrow">KONTROLA DUPLICIT · {entityLabel(metadata, entity, true).toUpperCase()}</span><h2 id="duplicate-check-title"><AlertTriangle size={18}/> Podobné záznamy už existují</h2><p>Prověřte nalezené záznamy. Přesto můžete vytvořit další kopii.</p></div><button type="button" className="icon-button" disabled={busy} onClick={onCancel} aria-label="Zavřít"><X size={16}/></button></div>
    <div className="duplicate-check-table-wrap"><table className="duplicate-check-table"><thead><tr>{columns.map((name) => <th key={name}>{fieldLabel(name, fieldDefs[name], entity, metadata)}</th>)}</tr></thead><tbody>{duplicates.map((row, index) => <tr key={row.id || index}>{columns.map((name) => <td key={name}>{value(row, name)}</td>)}</tr>)}</tbody></table>{!duplicates.length && <div className="duplicate-check-empty">CRM nalezlo podobný záznam, ale jeho údaje se nepodařilo zobrazit.</div>}</div>
    <div className="modal-footer"><button type="button" className="button subtle" disabled={busy} onClick={onCancel}>Zpět k úpravě</button><button type="button" className="button danger" disabled={busy} onClick={onCreate}>{busy ? "Vytvářím…" : <><Check size={14}/> Přesto vytvořit</>}</button></div>
  </section></div>;
}
