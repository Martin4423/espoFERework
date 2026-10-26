import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { apiJson } from "../http.ts";
import { T, useLocale } from "../i18n/index.ts";
import { AdminPage, Banner, Busy, Field, describe, useAsync } from "./ui.tsx";

type EntityMeta = { key: string; labelPlural: string; fields: Array<{ key: string; label: string }> };
type Section = { title: string; columns: number; fields: string[] };
type Layouts = { list: { custom: boolean; columns: string[]; sort?: string }; detail: { custom: boolean; sections: Array<{ title: string; columns: number; rows: Array<Array<string | null>> }> } };

// "id" is not a layout column; the other system properties are
const addable = (fields: EntityMeta["fields"]) => fields.filter((field) => field.key !== "id" && field.key !== "createdById");

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const toRows = (fields: string[], columns: number): Array<Array<string | null>> => {
  const rows: Array<Array<string | null>> = [];
  for (let i = 0; i < fields.length; i += columns) rows.push(Array.from({ length: columns }, (_, c) => fields[i + c] ?? null));
  return rows;
};

export default function LayoutsAdmin({ onBack, onSchemaChanged }: { onBack: () => void; onSchemaChanged: () => void }) {
  useLocale();
  const meta = useAsync(() => apiJson<{ entities: EntityMeta[] }>("/v1/meta/entities"), []);
  const [entityKey, setEntityKey] = useState("");
  const [kind, setKind] = useState<"list" | "detail">("list");
  const entity = meta.data?.entities.find((candidate) => candidate.key === entityKey);
  const layouts = useAsync(() => entityKey ? apiJson<Layouts>(`/v1/meta/entities/${entityKey}/layouts`) : Promise.resolve(null), [entityKey]);
  const [columns, setColumns] = useState<string[]>([]);
  const [sort, setSort] = useState("-createdAt");
  const [sections, setSections] = useState<Section[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!layouts.data) return;
    setColumns(layouts.data.list.columns);
    setSort(layouts.data.list.sort ?? "-createdAt");
    setSections(layouts.data.detail.sections.map((section) => ({ title: section.title, columns: section.columns, fields: section.rows.flat().filter((cell): cell is string => Boolean(cell)) })));
  }, [layouts.data]);

  const label = (key: string) => entity?.fields.find((field) => field.key === key)?.label ?? key;
  const free = (used: string[]) => addable(entity?.fields ?? []).filter((field) => !used.includes(field.key));

  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const body = kind === "list" ? { columns, sort } : { sections: sections.map((section) => ({ title: section.title, columns: section.columns, rows: toRows(section.fields, section.columns) })) };
      await apiJson(`/v1/meta/entities/${entityKey}/layouts/${kind}`, { method: "PUT", body: JSON.stringify(body) });
      setNotice(T("Rozložení bylo uloženo.", "The layout was saved.")); onSchemaChanged(); await layouts.reload();
    } catch (cause) { setError(describe(cause, (field) => field)); }
    finally { setBusy(false); }
  }

  async function reset() {
    setBusy(true); setError(""); setNotice("");
    try { await apiJson(`/v1/meta/entities/${entityKey}/layouts/${kind}`, { method: "DELETE" }); setNotice(T("Rozložení bylo vráceno na výchozí.", "The layout was reset to the default.")); onSchemaChanged(); await layouts.reload(); }
    catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  }

  return <AdminPage title={T("Rozložení", "Layouts")} subtitle={T("Sloupce seznamů a uspořádání detailu záznamu.", "The columns of lists and the arrangement of a record's detail.")} onBack={onBack} testId="admin-layouts">
    <Banner text={error || meta.error || layouts.error} /><Banner text={notice} tone="ok" />
    <section className="surface" style={{ padding: 18 }}>
      <div className="modal-fields" style={{ gridTemplateColumns: "1fr 1fr", padding: 0 }}>
        <Field label={T("Entita", "Entity")}><select value={entityKey} onChange={(e) => setEntityKey(e.target.value)} aria-label={T("Entita", "Entity")}><option value="">{T("Vyberte…", "Choose…")}</option>{meta.data?.entities.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.labelPlural}</option>)}</select></Field>
        <Field label={T("Rozložení", "Layout")}><select value={kind} onChange={(e) => setKind(e.target.value as "list" | "detail")} aria-label={T("Rozložení", "Layout")}><option value="list">{T("Seznam", "List")}</option><option value="detail">{T("Detail", "Detail")}</option></select></Field>
      </div>
      {entityKey && (layouts.loading && !layouts.data ? <Busy /> : <>
        {kind === "list" ? <div>
          <h3>{T("Sloupce seznamu", "List columns")}</h3>
          <ol className="admin-layout-list">{columns.map((key, index) => <li key={key}><span>{label(key)}</span>
            <button type="button" className="icon-button" aria-label={`${T("Nahoru", "Up")}: ${label(key)}`} onClick={() => setColumns(move(columns, index, -1))} disabled={index === 0}><ArrowUp size={13} /></button>
            <button type="button" className="icon-button" aria-label={`${T("Dolů", "Down")}: ${label(key)}`} onClick={() => setColumns(move(columns, index, 1))} disabled={index === columns.length - 1}><ArrowDown size={13} /></button>
            <button type="button" className="icon-button" aria-label={`${T("Odebrat", "Remove")}: ${label(key)}`} onClick={() => setColumns(columns.filter((column) => column !== key))} disabled={columns.length <= 1}><X size={13} /></button></li>)}</ol>
          <select aria-label={T("Přidat sloupec", "Add a column")} value="" onChange={(e) => e.target.value && setColumns([...columns, e.target.value])}><option value="">{T("Přidat sloupec…", "Add a column…")}</option>{free(columns).map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select>
          <Field label={T("Výchozí řazení", "Default order")}><select value={sort.replace(/^-/, "")} onChange={(e) => setSort(`${sort.startsWith("-") ? "-" : ""}${e.target.value}`)}>{columns.concat(["createdAt", "updatedAt"]).filter((key, index, all) => all.indexOf(key) === index).map((key) => <option key={key} value={key}>{label(key)}</option>)}</select>
            <label style={{ marginTop: 6 }}><input type="checkbox" checked={sort.startsWith("-")} onChange={(e) => setSort(`${e.target.checked ? "-" : ""}${sort.replace(/^-/, "")}`)} /> {T("sestupně", "descending")}</label></Field>
        </div> : <div>
          <h3>{T("Sekce detailu", "Detail sections")}</h3>
          {sections.map((section, sectionIndex) => <div key={sectionIndex} className="surface" style={{ padding: 12, margin: "10px 0" }}>
            <div className="modal-fields" style={{ gridTemplateColumns: "2fr 1fr auto", padding: 0, alignItems: "end" }}>
              <Field label={T("Název sekce", "Section title")}><input value={section.title} onChange={(e) => setSections(sections.map((s, i) => i === sectionIndex ? { ...s, title: e.target.value } : s))} /></Field>
              <Field label={T("Sloupce", "Columns")}><select value={section.columns} onChange={(e) => setSections(sections.map((s, i) => i === sectionIndex ? { ...s, columns: Number(e.target.value) } : s))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
              <div className="admin-row-actions"><button type="button" className="icon-button" aria-label={T("Sekci nahoru", "Move the section up")} onClick={() => setSections(move(sections, sectionIndex, -1))}><ArrowUp size={13} /></button>
                <button type="button" className="icon-button" aria-label={T("Odebrat sekci", "Remove the section")} onClick={() => setSections(sections.filter((_, i) => i !== sectionIndex))} disabled={sections.length <= 1}><X size={13} /></button></div></div>
            <ol className="admin-layout-list">{section.fields.map((key, index) => <li key={key}><span>{label(key)}</span>
              <button type="button" className="icon-button" aria-label={`${T("Nahoru", "Up")}: ${label(key)}`} disabled={index === 0} onClick={() => setSections(sections.map((s, i) => i === sectionIndex ? { ...s, fields: move(s.fields, index, -1) } : s))}><ArrowUp size={13} /></button>
              <button type="button" className="icon-button" aria-label={`${T("Dolů", "Down")}: ${label(key)}`} disabled={index === section.fields.length - 1} onClick={() => setSections(sections.map((s, i) => i === sectionIndex ? { ...s, fields: move(s.fields, index, 1) } : s))}><ArrowDown size={13} /></button>
              <button type="button" className="icon-button" aria-label={`${T("Odebrat", "Remove")}: ${label(key)}`} onClick={() => setSections(sections.map((s, i) => i === sectionIndex ? { ...s, fields: s.fields.filter((f) => f !== key) } : s))}><X size={13} /></button></li>)}</ol>
            <select aria-label={`${T("Přidat pole do sekce", "Add a field to the section")} ${sectionIndex + 1}`} value="" onChange={(e) => e.target.value && setSections(sections.map((s, i) => i === sectionIndex ? { ...s, fields: [...s.fields, e.target.value] } : s))}><option value="">{T("Přidat pole…", "Add a field…")}</option>{free(sections.flatMap((s) => s.fields)).map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select>
          </div>)}
          <button type="button" className="button subtle" onClick={() => setSections([...sections, { title: T("Nová sekce", "New section"), columns: 2, fields: [] }])}><Plus size={14} /> {T("Přidat sekci", "Add a section")}</button>
        </div>}
        <div className="admin-actions" style={{ marginTop: 16 }}>
          <button type="button" className="button primary" onClick={() => void save()} disabled={busy}>{T("Uložit rozložení", "Save the layout")}</button>
          <button type="button" className="button subtle" onClick={() => void reset()} disabled={busy || !(kind === "list" ? layouts.data?.list.custom : layouts.data?.detail.custom)}>{T("Vrátit výchozí", "Reset to default")}</button>
        </div>
      </>)}
    </section>
  </AdminPage>;
}
