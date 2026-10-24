import { useEffect, useMemo, useState } from "react";
import { Check, Download, FileSpreadsheet, Search, X } from "./Icons";
import { downloadAttachment, entityLabel, fieldLabel, request } from "./api";
import type { FieldDef, Metadata } from "./api";

type Row = Record<string, any>;
type FormatDef = { fileExtension?: string; mimeType?: string; params?: { fields?: Record<string, FieldDef>; layout?: Array<Array<{ name: string }>> } };

export default function ExportDialog({ entity, metadata, selectedIds, total, search, primaryFilter, boolFilters, where, orderBy, order, onClose }: {
  entity: string; metadata: Metadata; selectedIds: string[]; total: number; search: string; primaryFilter: string;
  boolFilters: string[]; where: Row[]; orderBy: string; order: "asc" | "desc"; onClose: () => void;
}) {
  const fields = metadata.entityDefs?.[entity]?.fields || {};
  const permissions = metadata.userAcl?.fieldTable?.[entity] || {};
  const formatDefs = ((metadata.app?.export as { formatDefs?: Record<string, FormatDef> } | undefined)?.formatDefs || {});
  const formats = ((metadata.app?.export as { formatList?: string[] } | undefined)?.formatList || Object.keys(formatDefs)).filter((format) => formatDefs[format]);
  const initialFormat = formats[0] || "csv";
  const [format, setFormat] = useState(initialFormat);
  const [selectedFields, setSelectedFields] = useState<string[]>(() => Object.keys(fields).filter((name) => {
    const field = fields[name];
    return !field.hidden && !field.utility && !field.notStorable && !field.exportDisabled && field.type !== "password" && permissions[name]?.read !== "no";
  }));
  const [fieldQuery, setFieldQuery] = useState("");
  const [scope, setScope] = useState<"selected" | "filtered">(selectedIds.length ? "selected" : "filtered");
  const [idle, setIdle] = useState(total > 500);
  const [notify, setNotify] = useState(total > 500);
  const [params, setParams] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const totalLabel = total >= 0 ? `${total.toLocaleString("cs-CZ")} záznamů` : "neznámý počet záznamů";
  const formatDef = formatDefs[format] || {};
  const formatParams = formatDef.params?.fields || {};
  const filteredFields = useMemo(() => Object.keys(fields).filter((name) => {
    const def = fields[name];
    if (def.hidden || def.utility || def.notStorable || def.exportDisabled || def.type === "password" || permissions[name]?.read === "no") return false;
    const label = fieldLabel(name, def, entity, metadata);
    return !fieldQuery || `${name} ${label}`.toLocaleLowerCase("cs-CZ").includes(fieldQuery.toLocaleLowerCase("cs-CZ"));
  }).sort((a, b) => fieldLabel(a, fields[a], entity, metadata).localeCompare(fieldLabel(b, fields[b], entity, metadata), "cs")), [fields, permissions, entity, metadata, fieldQuery]);

  useEffect(() => {
    const defaults = Object.fromEntries(Object.entries(formatParams).map(([name, def]) => [name, def.default ?? (def.type === "bool" ? false : "")]));
    setParams(defaults);
  }, [format]);

  function toggleField(name: string) { setSelectedFields((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]); }
  function setAll(visible: string[], checked: boolean) { setSelectedFields((current) => checked ? [...new Set([...current, ...visible])] : current.filter((name) => !visible.includes(name))); }
  function visibleParams() {
    const dynamic = formatDef.params as any;
    const rules = dynamic?.dynamicLogic || {};
    return Object.entries(formatParams).filter(([name, def]) => {
      if (name === "recordLinks" || name === "title") return format !== "xlsx" || !params.lite;
      const condition = rules[name]?.visible?.conditionGroup?.[0]?.value?.[0];
      if (condition?.type === "isFalse" && params[condition.attribute]) return false;
      if (condition?.type === "isTrue" && !params[condition.attribute]) return false;
      return !def.hidden;
    });
  }

  async function runExport() {
    if (!selectedFields.length) { setError("Vyberte alespoň jedno pole."); return; }
    setBusy(true); setError(""); setProgress("Připravuji export…");
    try {
      const searchParams: Row = { orderBy, order: order.toUpperCase(), select: selectedFields };
      if (search.trim()) searchParams.textFilter = search.trim();
      if (primaryFilter) searchParams.primaryFilter = primaryFilter;
      if (boolFilters.length) searchParams.boolFilterList = boolFilters;
      if (where.length) searchParams.where = where;
      const requestBody: Row = {
        entityType: entity,
        fieldList: selectedFields,
        format,
        params,
        idle,
        ...(scope === "selected" && selectedIds.length ? { ids: selectedIds } : { searchParams }),
      };
      const result = await request<{ id?: string; exportId?: string }>("Export", { method: "POST", body: JSON.stringify(requestBody) });
      if (result.id) {
        setProgress("Export hotov, stahuji soubor…");
        await downloadAttachment(result.id, `${entity.toLowerCase()}-export.${formatDef.fileExtension || format}`);
        setDone(true); setProgress("Soubor je připraven.");
      } else if (result.exportId) {
        if (notify) await request(`Export/${encodeURIComponent(result.exportId)}/subscribe`, { method: "POST", body: JSON.stringify({}) });
        let completed = false;
        for (let attempt = 0; attempt < 900; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
          const status = await request<{ status: string; attachmentId?: string }>(`Export/${encodeURIComponent(result.exportId)}/status`);
          if (status.status === "Success" && status.attachmentId) {
            setProgress("Export hotov, stahuji soubor…");
            await downloadAttachment(status.attachmentId, `${entity.toLowerCase()}-export.${formatDef.fileExtension || format}`);
            setDone(true); setProgress("Soubor je připraven."); completed = true; break;
          }
          if (status.status === "Failed") throw new Error("EspoCRM nedokázalo dokončit export.");
          setProgress(`Export běží na pozadí… (${Math.floor((attempt + 1) * 2 / 60)} min)`);
        }
        if (!completed) setProgress("Export stále běží. Výsledek vám EspoCRM doručí oznámením.");
      } else throw new Error("CRM nevrátilo soubor ani úlohu exportu.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export se nepodařilo dokončit."); }
    finally { setBusy(false); }
  }

  const selectedCount = selectedFields.length;
  return <div className="modal-backdrop export-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section className="record-modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
      <div className="modal-heading"><div><span className="eyebrow">EXPORT DAT · {entityLabel(metadata, entity, true).toLocaleUpperCase("cs-CZ")}</span><h2 id="export-dialog-title">Exportovat záznamy</h2><p>{scope === "selected" && selectedIds.length ? `${selectedIds.length} vybraných záznamů` : `${totalLabel} podle aktuálních filtrů`}</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Zavřít"><X size={16}/></button></div>
      <div className="export-layout">
        <div className="export-options">
          <label className="field-input"><span>Rozsah záznamů</span><select value={scope} onChange={(event) => setScope(event.target.value as "selected" | "filtered")}><option value="filtered">Všechny záznamy podle aktuálních filtrů ({totalLabel})</option><option value="selected" disabled={!selectedIds.length}>Jen označené ({selectedIds.length})</option></select></label>
          <label className="field-input"><span>Formát souboru</span><select value={format} onChange={(event) => setFormat(event.target.value)}>{formats.map((item) => <option key={item} value={item}>{item.toUpperCase()}{formatDefs[item].fileExtension ? ` · .${formatDefs[item].fileExtension}` : ""}</option>)}</select></label>
          {visibleParams().map(([name, def]) => {
            const label = metadata.labels?.Export?.fields?.[name] || name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
            if (def.type === "bool") return <label className="export-option-toggle" key={name}><input type="checkbox" checked={Boolean(params[name])} onChange={(event) => setParams((current) => ({ ...current, [name]: event.target.checked }))}/><span>{label}</span></label>;
            if (def.type === "enum" || def.type === "multiEnum") return <label className="field-input" key={name}><span>{label}</span><select multiple={def.type === "multiEnum"} value={params[name] || (def.type === "multiEnum" ? [] : "")} onChange={(event) => setParams((current) => ({ ...current, [name]: def.type === "multiEnum" ? Array.from(event.target.selectedOptions).map((option) => option.value) : event.target.value }))}>{(def.options || []).map((item: string | number) => <option key={item} value={item}>{item}</option>)}</select></label>;
            return <label className="field-input" key={name}><span>{label}</span><input type={def.type === "int" || def.type === "float" ? "number" : "text"} value={params[name] ?? ""} onChange={(event) => setParams((current) => ({ ...current, [name]: event.target.value }))}/></label>;
          })}
          <label className="export-option-toggle"><input type="checkbox" checked={idle} onChange={(event) => { setIdle(event.target.checked); if (!event.target.checked) setNotify(false); }}/><span>Spustit na pozadí pro větší exporty</span></label>
          {idle && <label className="export-option-toggle nested"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)}/><span>Oznámit dokončení exportu</span></label>}
        </div>
        <div className="export-field-picker"><div className="export-fields-heading"><strong>Pole k exportu</strong><span>{selectedCount} / {filteredFields.length}</span></div><label className="export-field-search"><Search size={14}/><input value={fieldQuery} onChange={(event) => setFieldQuery(event.target.value)} placeholder="Hledat pole…"/></label><div className="export-field-actions"><button type="button" onClick={() => setAll(filteredFields, true)}>Vybrat vše</button><button type="button" onClick={() => setAll(filteredFields, false)}>Zrušit výběr</button></div><div className="export-field-list">{filteredFields.map((name) => <label key={name}><input type="checkbox" checked={selectedFields.includes(name)} onChange={() => toggleField(name)}/><span>{fieldLabel(name, fields[name], entity, metadata)}</span><small>{name}</small></label>)}</div></div>
      </div>
      {error && <div className="table-error export-error">{error}</div>}
      {(busy || done) && <div className={`export-progress ${done ? "success" : ""}`}>{done ? <Check size={14}/> : <span className="spinner"/>}{progress}</div>}
      <div className="modal-footer"><button type="button" className="button subtle" onClick={onClose} disabled={busy}>Zavřít</button><button type="button" className="button primary" onClick={() => void runExport()} disabled={busy || done || !formats.length || !selectedCount}>{busy ? progress : <><Download size={14}/><FileSpreadsheet size={14}/> Exportovat {scope === "selected" && selectedIds.length ? `${selectedIds.length} záznamů` : totalLabel}</>}</button></div>
    </section>
  </div>;
}
