import { useMemo, useState } from "react";
import { ArrowDownToLine, Check, Shield, Trash2, X } from "./Icons";
import { request } from "./api";
import type { FieldDef } from "./api";

type PersonalField = { name: string; label: string; value: any; def: FieldDef };
function printable(value: any): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? item.name || item.value || JSON.stringify(item) : String(item)).join(", ");
  if (typeof value === "object") return value.name || value.value || JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Ano" : "Ne";
  return String(value);
}

export default function PersonalDataDialog({ entity, record, fields, canErase, onClose, onErased }: { entity: string; record: Record<string, any>; fields: PersonalField[]; canErase: boolean; onClose: () => void; onErased: (record: Record<string, any>) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const allSelected = fields.length > 0 && selected.length === fields.length;
  const exportFields = useMemo(() => selected.length ? fields.filter((field) => selected.includes(field.name)) : fields, [fields, selected]);
  function exportSelected() {
    const payload = { entityType: entity, recordId: record.id, recordName: record.name || [record.firstName, record.lastName].filter(Boolean).join(" "), exportedAt: new Date().toISOString(), fields: exportFields.map((field) => ({ name: field.name, label: field.label, value: field.value })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `${entity}-${record.id}-personal-data.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Exportováno ${exportFields.length} polí do JSON souboru.`); setError("");
  }
  async function eraseSelected() {
    if (!selected.length) { setError("Vyberte alespoň jedno pole ke smazání."); return; }
    const labels = fields.filter((field) => selected.includes(field.name)).map((field) => field.label);
    if (!window.confirm(`Opravdu odstranit osobní údaje z těchto polí?\n\n${labels.join(", ")}\n\nZměna je nevratná.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("DataPrivacy/action/erase", { method: "POST", body: JSON.stringify({ fieldList: selected, entityType: entity, id: record.id }) });
      const updated = await request<Record<string, any>>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}`);
      onErased(updated);
      setSelected([]); setNotice("Vybrané osobní údaje byly odstraněny.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Osobní údaje nelze odstranit."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop personal-data-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><section className="record-modal personal-data-modal" role="dialog" aria-modal="true" aria-label="Osobní údaje">
    <div className="modal-heading"><div><span className="eyebrow">OCHRANA SOUKROMÍ · {entity.toUpperCase()}</span><h2>Osobní údaje</h2><p>{record.name || [record.firstName, record.lastName].filter(Boolean).join(" ") || "Záznam"} · {fields.length} polí s osobními údaji</p></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Zavřít"><X size={17}/></button></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    {!fields.length ? <div className="table-loading">Tento záznam neobsahuje žádná vyplněná pole označená jako osobní údaje.</div> : <div className="personal-data-list"><div className="personal-data-list-head">{canErase && <label><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? fields.map((field) => field.name) : [])}/><span>Vybrat všechna pole</span></label>}<span>Hodnota</span></div>{fields.map((field) => <div className="personal-data-row" key={field.name}>{canErase ? <label><input type="checkbox" checked={selected.includes(field.name)} onChange={(event) => setSelected((old) => event.target.checked ? [...old, field.name] : old.filter((name) => name !== field.name))}/><strong>{field.label}</strong></label> : <strong>{field.label}</strong>}<span>{printable(field.value)}</span></div>)}</div>}
    <div className="personal-data-note"><Shield size={15}/><span>Export stahuje pouze tato pole do vašeho zařízení. Mazání se provádí přes oprávnění a audit EspoCRM.</span></div>
    <div className="modal-footer"><button type="button" className="button subtle" onClick={onClose} disabled={busy}>Zavřít</button><button type="button" className="button subtle" onClick={exportSelected} disabled={!fields.length || busy}><ArrowDownToLine size={14}/>Exportovat{selected.length ? ` (${selected.length})` : " vše"}</button>{canErase && <button type="button" className="button danger" onClick={() => void eraseSelected()} disabled={!selected.length || busy}><Trash2 size={14}/>{busy ? "Odstraňuji…" : `Odstranit${selected.length ? ` (${selected.length})` : ""}`}</button>}</div>
  </section></div>;
}
