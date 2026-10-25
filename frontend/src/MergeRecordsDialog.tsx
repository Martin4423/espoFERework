import { useEffect, useMemo, useState } from "react";
import { Check, X } from "./Icons";
import { entityLabel, fieldLabel, request } from "./api";
import type { Metadata } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type Row = Record<string, any>;
type MergeField = { name: string; attributes: string[]; readOnly: boolean };

function actualAttributes(name: string, type: string, metadata: Metadata): string[] {
  const definition = metadata.fields?.[type] as any;
  const attributes: string[] = Array.isArray(definition?.actualFields) ? definition.actualFields : [];
  const naming = definition?.naming || "suffix";
  if (!attributes.length) return [name];
  return attributes.map((attribute) => naming === "prefix" ? `${attribute}${name[0].toUpperCase()}${name.slice(1)}` : `${name}${attribute[0].toUpperCase()}${attribute.slice(1)}`);
}

function formatValue(record: Row, field: MergeField, metadata: Metadata, entity: string): string {
  const value = record[field.name] ?? record[`${field.name}Name`] ?? record[`${field.name}Ids`] ?? record[`${field.name}Id`];
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ano" : "Ne";
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? item.name || item.id || JSON.stringify(item) : String(item)).join(", ") || "—";
  if (typeof value === "object") return value.name || value.id || JSON.stringify(value);
  const option = (metadata.labels as any)?.[entity]?.options?.[field.name]?.[String(value)];
  return String(option || value);
}

export default function MergeRecordsDialog({ entity, ids, metadata, onClose, onComplete }: { entity: string; ids: string[]; metadata: Metadata; onClose: () => void; onComplete: (id: string) => void }) {
  const [records, setRecords] = useState<Row[]>([]);
  const [masterId, setMasterId] = useState(ids[0] || "");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const dialogRef = useDialogFocus<HTMLElement>(() => { if (!saving) onClose(); }, !saving);
  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    Promise.all(ids.map((id) => request<Row>(`${encodeURIComponent(entity)}/${encodeURIComponent(id)}`)))
      .then((list) => { if (live) { setRecords(list); setChoices({}); } })
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Záznamy ke sloučení se nepodařilo načíst."))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [entity, ids.join(","), metadata, retryKey]);

  const fields = useMemo(() => {
    const definitions = metadata.entityDefs?.[entity]?.fields || {};
    return Object.entries(definitions).flatMap(([name, def]) => {
      const fieldType = metadata.fields?.[def.type || ""] as any;
      if (["createdAt", "modifiedAt"].includes(name) || def.type === "linkMultiple" || def.disabled || def.utility || def.mergeDisabled || metadata.userAcl?.fieldTable?.[entity]?.[name]?.read === "no" || !fieldType || fieldType.notMergeable) return [];
      const attributes = actualAttributes(name, def.type || "varchar", metadata);
      if (!attributes.some((attribute) => records.some((record) => JSON.stringify(record[attribute] ?? null) !== JSON.stringify(records[0]?.[attribute] ?? null)))) return [];
      return [{ name, attributes, readOnly: Boolean(def.readOnly || metadata.userAcl?.fieldTable?.[entity]?.[name]?.edit === "no") }];
    }).sort((a, b) => Number(a.readOnly) - Number(b.readOnly) || fieldLabel(a.name, metadata.entityDefs?.[entity]?.fields?.[a.name], entity, metadata).localeCompare(fieldLabel(b.name, metadata.entityDefs?.[entity]?.fields?.[b.name], entity, metadata), "cs"));
  }, [entity, metadata, records]);

  async function merge() {
    if (records.length < 2 || records.length > 4 || !masterId) return;
    setSaving(true); setError("");
    const attributes: Row = {};
    for (const field of fields) {
      const sourceId = choices[field.name] || masterId;
      if (sourceId === masterId) continue;
      const source = records.find((record) => record.id === sourceId);
      if (!source) continue;
      for (const attribute of field.attributes) attributes[attribute] = source[attribute] ?? null;
    }
    try {
      await request("Action", { method: "POST", body: JSON.stringify({ entityType: entity, action: "merge", id: masterId, data: { sourceIdList: records.filter((record) => record.id !== masterId).map((record) => record.id), attributes } }) });
      onComplete(masterId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Záznamy se nepodařilo sloučit."); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><section ref={dialogRef} tabIndex={-1} className="record-modal merge-records-modal" role="dialog" aria-modal="true" aria-labelledby="merge-records-title" aria-describedby="merge-records-description">
    <div className="modal-heading"><div><span className="eyebrow">HROMADNÁ AKCE · {entityLabel(metadata, entity, true).toLocaleUpperCase("cs")}</span><h2 id="merge-records-title">Sloučit záznamy</h2><p id="merge-records-description">Vyberte hlavní záznam a zdroj hodnot u každého rozdílného pole.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Zavřít"><X size={16}/></button></div>
    {error && <div className="table-error" role="alert">{error}{!busy && <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Zkusit znovu</button>}</div>}
    {busy ? <div className="table-loading"><span className="spinner"/> Načítám vybrané záznamy…</div> : <div className="merge-records-content">
      <section><h3>Hlavní záznam</h3><p>Ostatní záznamy se po sloučení odstraní a jejich vazby se převedou.</p><div className="merge-master-list">{records.map((record, index) => <label key={record.id}><input type="radio" name="merge-master" autoFocus={index === 0} checked={masterId === record.id} onChange={() => setMasterId(record.id)}/><span><strong>{record.name || record.subject || [record.firstName, record.lastName].filter(Boolean).join(" ") || record.id}</strong><small>{record.id}{record.createdAt ? ` · ${record.createdAt}` : ""}</small></span></label>)}</div></section>
      <section><h3>Rozdílná pole <small>{fields.length}</small></h3>{fields.length ? <div className="merge-fields-table"><div className="merge-fields-header" style={{ gridTemplateColumns: `minmax(130px, 180px) repeat(${records.length}, minmax(130px, 1fr))` }}><span>Pole</span>{records.map((record) => <span key={record.id}>{record.name || record.subject || record.id}</span>)}</div>{fields.map((field) => <div className="merge-field-row" key={field.name} style={{ gridTemplateColumns: `minmax(130px, 180px) repeat(${records.length}, minmax(130px, 1fr))` }}><strong>{fieldLabel(field.name, metadata.entityDefs?.[entity]?.fields?.[field.name], entity, metadata)}</strong>{records.map((record) => <label key={record.id} title={formatValue(record, field, metadata, entity)}><input type="radio" name={`merge-${field.name}`} disabled={field.readOnly} checked={(choices[field.name] || masterId) === record.id} onChange={() => setChoices((old) => ({ ...old, [field.name]: record.id }))}/><span>{formatValue(record, field, metadata, entity)}</span></label>)}</div>)}</div> : <div className="merge-no-differences"><Check size={16}/> Záznamy nemají žádná rozdílná slučitelná pole.</div>}</section>
    </div>}
    <div className="modal-footer"><button type="button" className="button subtle" onClick={onClose} disabled={saving}>Zrušit</button><button type="button" className="button primary" onClick={() => void merge()} disabled={busy || saving || records.length < 2 || records.length > 4}>{saving ? "Slučuji…" : "Sloučit záznamy"}</button></div>
  </section></div>;
}
