import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, X } from "./Icons";
import { fieldLabel, request } from "./api";
import type { FieldDef, Metadata } from "./api";

type Row = Record<string, any>;

/** Native single-record and selected-record currency conversion workflow. */
export default function CurrencyConversionDialog({ entity, metadata, fields, recordId, ids, onClose, onComplete }: { entity: string; metadata: Metadata; fields: [string, FieldDef][]; recordId?: string; ids?: string[]; onClose: () => void; onComplete: (result?: Row) => void }) {
  const [config, setConfig] = useState<Row>({});
  const [currency, setCurrency] = useState("");
  const [rates, setRates] = useState<Record<string, string>>({});
  const [selectedFields, setSelectedFields] = useState<string[]>(fields.map(([name]) => name));
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currencyList: string[] = useMemo(() => Array.isArray(config.currencyList) ? config.currencyList.map(String) : [], [config.currencyList]);
  const baseCurrency = String(config.baseCurrency || "");

  useEffect(() => {
    let live = true;
    request<Row>("Settings").then((data) => {
      if (!live) return;
      setConfig(data);
      const list: string[] = Array.isArray(data.currencyList) ? data.currencyList.map(String) : [];
      const target = list.includes(String(data.defaultCurrency || "")) ? String(data.defaultCurrency) : list.find((item) => item !== data.baseCurrency) || list[0] || "";
      setCurrency(target);
      const source = data.currencyRates && typeof data.currencyRates === "object" && !Array.isArray(data.currencyRates) ? data.currencyRates : {};
      const next: Record<string, string> = {};
      list.filter((item) => item !== data.baseCurrency).forEach((item) => {
        let value = Number(source[item]);
        if (!value && source[data.baseCurrency]) value = 1 / Number(source[data.baseCurrency]);
        next[item] = Number.isFinite(value) && value > 0 ? String(value) : "1";
      });
      setRates(next);
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Nastavení měn se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, []);

  async function convert() {
    if (!currency || !currencyList.includes(currency)) { setError("Vyberte cílovou měnu."); return; }
    const rateData: Record<string, number> = {};
    for (const code of currencyList) {
      if (code === baseCurrency) continue;
      const rate = Number(rates[code]);
      if (!Number.isFinite(rate) || rate <= 0) { setError(`Zadejte kladný kurz pro ${code}.`); return; }
      rateData[code] = rate;
    }
    setSaving(true); setError("");
    try {
      const data = { targetCurrency: currency, rates: rateData, fieldList: selectedFields.length === fields.length ? null : selectedFields };
      if (recordId) {
        const result = await request<Row>("Action", { method: "POST", body: JSON.stringify({ entityType: entity, action: "convertCurrency", id: recordId, data }) });
        onComplete(result);
      } else {
        await request("MassAction", { method: "POST", body: JSON.stringify({ entityType: entity, action: "convertCurrency", params: { ids: ids || null, where: null, searchParams: null }, data: { ...data, currency, targetCurrency: currency }, idle: false }) });
        onComplete();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Převod měn se nepodařil."); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop currency-convert-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><section className="record-modal currency-convert-dialog" role="dialog" aria-modal="true" aria-labelledby="currency-convert-title"><div className="modal-heading"><div><span className="eyebrow">{recordId ? "JEDEN ZÁZNAM" : `HROMADNÁ AKCE · ${ids?.length || 0} ZÁZNAMŮ`}</span><h2 id="currency-convert-title">Převést měnu</h2><p>Částky se přepočítají podle základní měny a zadaných kurzů.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Zavřít"><X size={16}/></button></div>
    {busy ? <div className="table-loading"><span className="spinner"/>Načítám nastavení měn…</div> : <><div className="currency-convert-summary"><label className="field-input"><span>Převést do</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="">Vyberte měnu…</option>{currencyList.map((code) => <option key={code} value={code}>{code}</option>)}</select></label><div><small>Základní měna</small><strong>{baseCurrency || "—"}</strong></div><div><small>Výchozí měna</small><strong>{config.defaultCurrency || "—"}</strong></div></div>
      {currencyList.length > 1 && <section className="currency-convert-rates"><div><strong>Kurzy vůči základní měně {baseCurrency}</strong><small>Upravte hodnoty pro tento převod; nastavení systému se nezmění.</small></div>{currencyList.filter((code) => code !== baseCurrency).map((code) => <label key={code}><span>{code}</span><input type="number" min="0.000001" step="any" value={rates[code] || ""} onChange={(event) => setRates((old) => ({ ...old, [code]: event.target.value }))}/></label>)}</section>}
      <fieldset className="currency-convert-fields"><legend>Pole částek k převodu</legend>{fields.map(([name, def]) => <label key={name}><input type="checkbox" checked={selectedFields.includes(name)} onChange={(event) => setSelectedFields((old) => event.target.checked ? [...new Set([...old, name])] : old.filter((item) => item !== name))}/><span>{fieldLabel(name, def, entity, metadata)}</span></label>)}</fieldset></>}
    {error && <div className="inline-error">{error}</div>}<div className="modal-footer"><button type="button" className="button subtle" onClick={onClose} disabled={saving}>Zrušit</button><button type="button" className="button primary" onClick={() => void convert()} disabled={busy || saving || !currency || !selectedFields.length}>{saving ? "Převádím…" : <><ArrowRightLeft size={14}/> Převést měnu</>}</button></div>
  </section></div>;
}
