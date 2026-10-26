import { useMemo, useState } from "react";
import { apiJson } from "../http.ts";
import { T, useLocale } from "../i18n/index.ts";
import { parseCsv } from "./csv.ts";
import { AdminPage, Banner, Busy, Field, Table, describe, useAsync } from "./ui.tsx";

type FieldMeta = { key: string; type: string; label: string; readOnly: boolean; core: boolean };
type EntityMeta = { key: string; labelPlural: string; fields: FieldMeta[] };
type Result = { externalId: string; status: "created" | "updated" | "unchanged" | "error"; id?: string; code?: string; message?: string; errors?: Array<{ field: string; code: string; message?: string }> };

const BATCH = 200;
const SKIP = "";
const EXTERNAL_ID = "__externalId";
const SYSTEM = new Set(["id", "createdAt", "updatedAt", "createdById", "ownerId", "teamIds"]);

// A CSV cell -> the JSON value of the field type (the backend validates the result and reports what it refuses).
function convert(field: FieldMeta, raw: string): unknown {
  const text = raw.trim();
  if (text === "") return undefined;
  switch (field.type) {
    case "integer": return Number.isFinite(Number(text)) ? Number(text) : text;
    case "boolean": return /^(1|true|yes|ano|y)$/i.test(text) ? true : /^(0|false|no|ne|n)$/i.test(text) ? false : text;
    case "multiEnum": return text.split(/[,|]/).map((part) => part.trim()).filter(Boolean);
    case "decimal": return text.replace(",", ".");
    default: return raw;
  }
}

export default function ImportAdmin({ onBack, onImported }: { onBack: () => void; onImported: () => void }) {
  useLocale();
  const meta = useAsync(() => apiJson<{ entities: EntityMeta[] }>("/v1/meta/entities"), []);
  const [entityKey, setEntityKey] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [dry, setDry] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entity = meta.data?.entities.find((candidate) => candidate.key === entityKey);
  const writable = useMemo(() => (entity?.fields ?? []).filter((field) => !SYSTEM.has(field.key) && field.type !== "link" && !field.readOnly), [entity]);
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  async function load(file: File | undefined) {
    if (!file) return;
    setError(""); setResults(null);
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) { setError(T("Soubor musí mít záhlaví a aspoň jeden řádek.", "The file needs a header and at least one row.")); return; }
    setFileName(file.name); setRows(parsed);
    // match columns to fields by key or label, case-insensitively
    const names = new Map(writable.flatMap((field) => [[field.key.toLowerCase(), field.key], [field.label.toLowerCase(), field.key]] as Array<[string, string]>));
    setMapping(parsed[0].map((column) => names.get(column.trim().toLowerCase()) ?? SKIP));
  }

  async function run(dryRun: boolean) {
    setBusy(true); setError(""); setResults(null);
    try {
      const source = `csv-${fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file"}`;
      const idColumn = mapping.indexOf(EXTERNAL_ID);
      const items = body.map((cells, index) => {
        const values: Record<string, unknown> = {};
        mapping.forEach((target, column) => {
          const field = writable.find((candidate) => candidate.key === target);
          if (!field) return;
          const value = convert(field, cells[column] ?? "");
          if (value !== undefined) values[field.key] = value;
        });
        return { externalId: (idColumn >= 0 && cells[idColumn]?.trim()) || `row-${index + 1}`, values };
      });
      const all: Result[] = [];
      for (let i = 0; i < items.length; i += BATCH) {
        const response = await apiJson<{ results: Result[] }>(`/v1/import/${entityKey}`, { method: "POST", body: JSON.stringify({ source, dryRun, records: items.slice(i, i + BATCH) }) });
        all.push(...response.results);
        setResults([...all]);
      }
      if (!dryRun) onImported();
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  }

  const counts = (status: string) => results?.filter((result) => result.status === status).length ?? 0;
  const failed = results?.filter((result) => result.status === "error") ?? [];
  return <AdminPage title={T("Import z CSV", "CSV import")} subtitle={T("Hlavní řádek souboru jsou názvy sloupců; opakovaný import téhož souboru záznamy neduplikuje.", "The first row of the file holds the column names; importing the same file again does not duplicate records.")} onBack={onBack} testId="admin-import">
    <Banner text={error || meta.error} />
    <section className="surface" style={{ padding: 18 }}>
      <div className="modal-fields" style={{ gridTemplateColumns: "1fr 1fr", padding: 0 }}>
        <Field label={T("Do které entity", "Into which entity")}><select aria-label={T("Entita", "Entity")} value={entityKey} onChange={(e) => { setEntityKey(e.target.value); setRows([]); setResults(null); }}><option value="">{T("Vyberte…", "Choose…")}</option>{meta.data?.entities.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.labelPlural}</option>)}</select></Field>
        <Field label={T("Soubor CSV", "CSV file")}><input type="file" accept=".csv,text/csv,text/plain" data-testid="csv-input" disabled={!entityKey} onChange={(e) => void load(e.target.files?.[0])} /></Field>
      </div>
      {meta.loading && <Busy />}
      {rows.length > 0 && <>
        <h3>{T("Přiřazení sloupců", "Column mapping")} <small>({body.length} {T("řádků", "rows")})</small></h3>
        <Table head={[T("Sloupec v souboru", "Column in the file"), T("Ukázka", "Sample"), T("Pole ve ViaCRM", "ViaCRM field")]}>
          {header.map((column, index) => <tr key={index}><td><b>{column}</b></td><td><small>{body[0]?.[index]}</small></td>
            <td><select aria-label={`${T("Pole pro sloupec", "Field for column")} ${column}`} value={mapping[index] ?? SKIP} onChange={(e) => setMapping(mapping.map((value, i) => i === index ? e.target.value : value))}>
              <option value={SKIP}>{T("— přeskočit —", "— skip —")}</option><option value={EXTERNAL_ID}>{T("Identifikátor řádku (opakovaný import)", "Row identifier (for re-imports)")}</option>
              {writable.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></td></tr>)}
        </Table>
        <div className="admin-actions" style={{ marginTop: 14 }}>
          <label><input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} /> {T("Jen zkontrolovat, nic neukládat", "Only check, store nothing")}</label>
          <button type="button" className="button primary" onClick={() => void run(dry)} disabled={busy || mapping.every((value) => !value || value === EXTERNAL_ID)}>{dry ? T("Zkontrolovat", "Check") : T("Importovat", "Import")}</button>
        </div>
      </>}
      {busy && <Busy text={T("Importuji…", "Importing…")} />}
      {results && !busy && <div data-testid="import-result" style={{ marginTop: 16 }}>
        <Banner tone={failed.length ? "error" : "ok"} text={`${dry ? T("Kontrola", "Check") : T("Import", "Import")}: ${T("vytvořeno", "created")} ${counts("created")}, ${T("změněno", "updated")} ${counts("updated")}, ${T("beze změny", "unchanged")} ${counts("unchanged")}, ${T("chyb", "errors")} ${failed.length}`} />
        {failed.length > 0 && <Table head={[T("Řádek", "Row"), T("Chyba", "Error")]}>{failed.slice(0, 50).map((result) => <tr key={result.externalId}><td>{result.externalId}</td><td>{result.errors?.length ? result.errors.map((e) => `${e.field}: ${e.code}`).join("; ") : result.message}</td></tr>)}</Table>}
      </div>}
    </section>
  </AdminPage>;
}
