import { useState } from "react";
import { AlertTriangle, Check, X } from "./Icons";

type Choice = "current" | "actual" | "original";
type ConflictField = { name: string; label: string; current: unknown; actual: unknown; original: unknown };
function describe(value: unknown) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/** Field-level resolution for the server's optimistic-concurrency `modified` response. */
export default function SaveConflictDialog({ fields, onApply, onCancel }: { fields: ConflictField[]; onApply: (resolutions: Record<string, Choice>) => void; onCancel: () => void }) {
  const [resolutions, setResolutions] = useState<Record<string, Choice>>(() => Object.fromEntries(fields.map((field) => [field.name, "current"])));
  return <div className="modal-backdrop save-conflict-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><section className="record-modal save-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="save-conflict-title"><div className="modal-heading"><div><span className="eyebrow">SOUČASNÁ ÚPRAVA</span><h2 id="save-conflict-title"><AlertTriangle size={18}/> Záznam mezitím změnil někdo jiný</h2><p>Vyberte pro každé pole hodnotu, kterou chcete po uložení zachovat.</p></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Zavřít"><X size={16}/></button></div>
    <div className="save-conflict-list">{fields.map((field) => <article className="save-conflict-field" key={field.name}><header><strong>{field.label}</strong><code>{field.name}</code></header><label className="save-conflict-choice"><span>Výsledek pro toto pole</span><select value={resolutions[field.name] || "current"} onChange={(event) => setResolutions((old) => ({ ...old, [field.name]: event.target.value as Choice }))}><option value="current">Ponechat moji úpravu</option><option value="actual">Použít aktuální hodnotu v CRM</option><option value="original">Vrátit původní hodnotu</option></select></label><div className="save-conflict-values"><div><small>Moje úprava</small><pre>{describe(field.current)}</pre></div><div><small>Aktuálně v CRM</small><pre>{describe(field.actual)}</pre></div><div><small>Původní</small><pre>{describe(field.original)}</pre></div></div></article>)}</div>
    <div className="modal-footer"><button type="button" className="button subtle" onClick={onCancel}>Zrušit a dál upravovat</button><button type="button" className="button primary" onClick={() => onApply(resolutions)}><Check size={14}/> Použít volby</button></div>
  </section></div>;
}
