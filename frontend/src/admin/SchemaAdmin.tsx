import { useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { apiJson } from "../http.ts";
import { T, useLocale } from "../i18n/index.ts";
import { useConfirmDialog } from "../ConfirmDialogProvider";
import { AdminPage, Banner, Busy, Dialog, Field, Table, describe, useAsync } from "./ui.tsx";

type FieldMeta = { key: string; type: string; label: string; required: boolean; readOnly: boolean; core: boolean; status?: "active" | "removed"; properties: Record<string, any>; defaultValue?: unknown };
type EntityMeta = { key: string; labelSingular: string; labelPlural: string; hasOwner: boolean; hasTeams: boolean; builtIn: boolean; fields: FieldMeta[] };

const TYPES: Array<[string, string, string]> = [
  ["string", "Krátký text", "Short text"], ["text", "Dlouhý text", "Long text"], ["integer", "Celé číslo", "Integer"], ["decimal", "Desetinné číslo", "Decimal"],
  ["boolean", "Ano / ne", "Yes / no"], ["date", "Datum", "Date"], ["dateTime", "Datum a čas", "Date and time"], ["enum", "Výběr z možností", "Choice"],
  ["multiEnum", "Více možností", "Multiple choice"], ["email", "E-mail", "E-mail"], ["phone", "Telefon", "Phone"], ["url", "Odkaz (URL)", "Link (URL)"], ["link", "Vazba na záznam", "Link to a record"],
];
const typeText = (type: string) => { const row = TYPES.find(([key]) => key === type); return row ? T(row[1], row[2]) : type; };

export default function SchemaAdmin({ onBack, onSchemaChanged }: { onBack: () => void; onSchemaChanged: () => void }) {
  useLocale();
  const list = useAsync(() => apiJson<{ entities: EntityMeta[] }>("/v1/meta/entities"), []);
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");

  if (selected) {
    const entity = list.data?.entities.find((candidate) => candidate.key === selected);
    return <EntityPage entityKey={selected} entityLabel={entity?.labelPlural ?? selected} entities={list.data?.entities ?? []} onBack={() => setSelected("")} onChanged={() => { onSchemaChanged(); void list.reload(); }} />;
  }

  return <AdminPage title={T("Entity a pole", "Entities and fields")} subtitle={T("Vlastní pole a nové typy záznamů vznikají okamžitě, bez nasazení.", "Custom fields and new record types appear at once, without a deployment.")} onBack={onBack} testId="admin-schema"
    actions={<button type="button" className="button primary" onClick={() => setCreating(true)}><Plus size={15} /> {T("Nová entita", "New entity")}</button>}>
    <Banner text={list.error} /><Banner text={notice} tone="ok" />
    <section className="surface">
      {list.loading && !list.data ? <Busy /> : <Table head={[T("Entita", "Entity"), T("Klíč", "Key"), T("Polí", "Fields"), T("Vlastník / týmy", "Owner / teams"), ""]}>
        {list.data?.entities.map((entity) => <tr key={entity.key} style={{ cursor: "pointer" }} onClick={() => setSelected(entity.key)}>
          <td><b>{entity.labelPlural}</b> {entity.builtIn && <small>({T("základní", "built in")})</small>}</td><td><code>{entity.key}</code></td>
          <td>{entity.fields.length}</td><td>{[entity.hasOwner && T("vlastník", "owner"), entity.hasTeams && T("týmy", "teams")].filter(Boolean).join(", ") || "—"}</td>
          <td><button type="button" className="button subtle" aria-label={`${T("Otevřít", "Open")}: ${entity.key}`} onClick={() => setSelected(entity.key)}>{T("Pole", "Fields")}</button></td></tr>)}
      </Table>}
    </section>
    {creating && <NewEntityDialog onClose={() => setCreating(false)} onCreated={async (key) => { setCreating(false); setNotice(T("Entita byla vytvořena.", "The entity was created.")); onSchemaChanged(); await list.reload(); setSelected(key); }} />}
  </AdminPage>;
}

function NewEntityDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => Promise<void> }) {
  const [form, setForm] = useState({ key: "", labelSingular: "", labelPlural: "", hasOwner: true, hasTeams: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setBusy(true); setError("");
    try { await apiJson("/v1/meta/entities", { method: "POST", body: JSON.stringify(form) }); await onCreated(form.key); }
    catch (cause) { setError(describe(cause, (field) => ({ key: T("Klíč", "Key"), labelSingular: T("Název (jednotné číslo)", "Name (singular)"), labelPlural: T("Název (množné číslo)", "Name (plural)") })[field as "key"] ?? field)); }
    finally { setBusy(false); }
  }
  return <Dialog title={T("Nová entita", "New entity")} onClose={onClose} busy={busy} testId="entity-dialog" footer={<>
    <button type="button" className="button subtle" onClick={onClose} disabled={busy}>{T("Zrušit", "Cancel")}</button>
    <button type="button" className="button primary" onClick={() => void create()} disabled={busy}>{T("Vytvořit", "Create")}</button></>}>
    <Field label={T("Klíč", "Key")} hint={T("Malými písmeny a číslicemi, jednotné číslo (např. invoice). Nelze později změnit.", "Letters and digits, singular (for example invoice). Cannot be changed later.")}><input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></Field>
    <Field label={T("Název (jednotné číslo)", "Name (singular)")}><input value={form.labelSingular} onChange={(e) => setForm({ ...form, labelSingular: e.target.value })} /></Field>
    <Field label={T("Název (množné číslo)", "Name (plural)")}><input value={form.labelPlural} onChange={(e) => setForm({ ...form, labelPlural: e.target.value })} /></Field>
    <label className="field-input"><span><input type="checkbox" checked={form.hasOwner} onChange={(e) => setForm({ ...form, hasOwner: e.target.checked })} /> {T("Záznamy mají vlastníka", "Records have an owner")}</span></label>
    <label className="field-input"><span><input type="checkbox" checked={form.hasTeams} onChange={(e) => setForm({ ...form, hasTeams: e.target.checked })} /> {T("Záznamy patří týmům", "Records belong to teams")}</span></label>
    <Banner text={error} />
  </Dialog>;
}

function EntityPage({ entityKey, entityLabel, entities, onBack, onChanged }: { entityKey: string; entityLabel: string; entities: EntityMeta[]; onBack: () => void; onChanged: () => void }) {
  const confirm = useConfirmDialog();
  const fields = useAsync(() => apiJson<{ items: FieldMeta[] }>(`/v1/meta/entities/${entityKey}/fields`), [entityKey]);
  const [editing, setEditing] = useState<FieldMeta | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function act(path: string, method: string, done: string) {
    setError(""); setNotice("");
    try { await apiJson(path, { method }); setNotice(done); onChanged(); await fields.reload(); }
    catch (cause) { setError(describe(cause)); }
  }

  async function purge(field: FieldMeta) {
    if (!await confirm({ title: T("Trvale smazat pole?", "Delete the field for good?"), message: T(`Data pole „${field.label}“ budou nenávratně smazána.`, `The data of the field “${field.label}” will be lost for good.`), confirmLabel: T("Smazat trvale", "Delete for good"), tone: "danger" })) return;
    await act(`/v1/meta/entities/${entityKey}/fields/${field.key}/purge`, "POST", T("Pole bylo trvale smazáno.", "The field was deleted for good."));
  }

  return <AdminPage title={entityLabel} subtitle={`${T("Pole entity", "Fields of")} ${entityKey}`} onBack={onBack} testId="admin-entity"
    actions={<button type="button" className="button primary" onClick={() => setEditing("new")}><Plus size={15} /> {T("Nové pole", "New field")}</button>}>
    <Banner text={error || fields.error} /><Banner text={notice} tone="ok" />
    <section className="surface">
      {fields.loading && !fields.data ? <Busy /> : <Table head={[T("Pole", "Field"), T("Klíč", "Key"), T("Typ", "Type"), T("Povinné", "Required"), T("Stav", "Status"), ""]}>
        {fields.data?.items.map((field) => <tr key={field.key} style={field.status === "removed" ? { opacity: .55 } : undefined}>
          <td><b>{field.label}</b></td><td><code>{field.key}</code></td><td>{typeText(field.type)}{field.type === "link" && <small> → {String(field.properties.target)}</small>}</td>
          <td>{field.required ? T("Ano", "Yes") : "—"}</td><td>{field.status === "removed" ? T("Skryté", "Hidden") : field.core ? T("Základní", "Core") : T("Aktivní", "Active")}</td>
          <td><div className="admin-row-actions">
            {field.status !== "removed" && <button type="button" className="icon-button" aria-label={`${T("Upravit", "Edit")}: ${field.key}`} onClick={() => setEditing(field)}><Pencil size={14} /></button>}
            {field.status === "removed" ? <>
              <button type="button" className="icon-button" aria-label={`${T("Obnovit", "Restore")}: ${field.key}`} onClick={() => void act(`/v1/meta/entities/${entityKey}/fields/${field.key}/restore`, "POST", T("Pole bylo obnoveno.", "The field was restored."))}><RotateCcw size={14} /></button>
              <button type="button" className="icon-button" aria-label={`${T("Smazat trvale", "Delete for good")}: ${field.key}`} onClick={() => void purge(field)}><Trash2 size={14} /></button></>
              : !field.core && <button type="button" className="icon-button" aria-label={`${T("Skrýt", "Hide")}: ${field.key}`} title={T("Skrýt (data zůstanou)", "Hide (the data stays)")} onClick={() => void act(`/v1/meta/entities/${entityKey}/fields/${field.key}`, "DELETE", T("Pole bylo skryto.", "The field was hidden."))}><Trash2 size={14} /></button>}
          </div></td></tr>)}
      </Table>}
    </section>
    {editing && <FieldDialog entityKey={entityKey} field={editing === "new" ? null : editing} entities={entities} onClose={() => setEditing(null)} onSaved={async (text) => { setEditing(null); setNotice(text); onChanged(); await fields.reload(); }} />}
  </AdminPage>;
}

function FieldDialog({ entityKey, field, entities, onClose, onSaved }: { entityKey: string; field: FieldMeta | null; entities: EntityMeta[]; onClose: () => void; onSaved: (text: string) => Promise<void> }) {
  const p = field?.properties ?? {};
  const [form, setForm] = useState({
    key: field?.key ?? "", type: field?.type ?? "string", label: field?.label ?? "", required: field?.required ?? false, readOnly: field?.readOnly ?? false,
    maxLength: p.maxLength !== undefined ? String(p.maxLength) : "", precision: p.precision !== undefined ? String(p.precision) : "", scale: p.scale !== undefined ? String(p.scale) : "",
    min: p.min !== undefined ? String(p.min) : "", max: p.max !== undefined ? String(p.max) : "", options: Array.isArray(p.options) ? p.options.join("\n") : "", target: p.target ?? "",
    defaultValue: field?.defaultValue === undefined || field.defaultValue === null ? "" : Array.isArray(field.defaultValue) ? field.defaultValue.join(",") : String(field.defaultValue),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creating = !field;
  const set = (patch: Partial<typeof form>) => setForm((old) => ({ ...old, ...patch }));

  function body(): Record<string, unknown> {
    const out: Record<string, unknown> = { label: form.label, required: form.required, readOnly: form.readOnly };
    if (creating) { out.key = form.key; out.type = form.type; }
    const num = (value: string) => (value.trim() === "" ? undefined : Number(value));
    if (form.type === "string" && form.maxLength) out.maxLength = num(form.maxLength);
    if (form.type === "integer") { if (form.min) out.min = num(form.min); else if (!creating) out.min = null; if (form.max) out.max = num(form.max); else if (!creating) out.max = null; }
    if (form.type === "decimal") {
      if (creating) { out.precision = num(form.precision); out.scale = num(form.scale || "0"); }
      if (form.min) out.min = form.min; else if (!creating) out.min = null;
      if (form.max) out.max = form.max; else if (!creating) out.max = null;
    }
    if (form.type === "enum" || form.type === "multiEnum") out.options = form.options.split("\n").map((option) => option.trim()).filter(Boolean);
    if (form.type === "link" && creating) out.target = form.target;
    if (form.defaultValue !== "") out.defaultValue = form.type === "boolean" ? form.defaultValue === "true" : form.type === "integer" ? Number(form.defaultValue) : form.type === "multiEnum" ? form.defaultValue.split(",").map((v) => v.trim()).filter(Boolean) : form.defaultValue;
    else if (!creating && field?.defaultValue !== undefined) out.defaultValue = null;
    return out;
  }

  async function save() {
    setBusy(true); setError("");
    try {
      if (creating) await apiJson(`/v1/meta/entities/${entityKey}/fields`, { method: "POST", body: JSON.stringify(body()) });
      else await apiJson(`/v1/meta/entities/${entityKey}/fields/${field.key}`, { method: "PATCH", body: JSON.stringify(body()) });
      await onSaved(creating ? T("Pole bylo vytvořeno.", "The field was created.") : T("Pole bylo uloženo.", "The field was saved."));
    } catch (cause) { setError(describe(cause, (name) => ({ key: T("Klíč", "Key"), label: T("Název", "Label"), options: T("Možnosti", "Options"), target: T("Cíl vazby", "Link target"), precision: T("Přesnost", "Precision") })[name as "key"] ?? name)); }
    finally { setBusy(false); }
  }

  return <Dialog title={creating ? T("Nové pole", "New field") : `${T("Upravit pole", "Edit field")} ${field.key}`} onClose={onClose} busy={busy} testId="field-dialog" footer={<>
    <button type="button" className="button subtle" onClick={onClose} disabled={busy}>{T("Zrušit", "Cancel")}</button>
    <button type="button" className="button primary" onClick={() => void save()} disabled={busy}>{T("Uložit", "Save")}</button></>}>
    {creating && <Field label={T("Klíč", "Key")} hint={T("Malými písmeny a číslicemi, začíná písmenem (např. invoiceNumber). Nelze později změnit.", "Letters and digits, starts with a letter (for example invoiceNumber). Cannot be changed later.")}><input value={form.key} onChange={(e) => set({ key: e.target.value })} /></Field>}
    <Field label={T("Název pole", "Field label")}><input value={form.label} onChange={(e) => set({ label: e.target.value })} /></Field>
    <Field label={T("Typ", "Type")}><select value={form.type} disabled={!creating} onChange={(e) => set({ type: e.target.value })}>{TYPES.map(([key, cs, en]) => <option key={key} value={key}>{T(cs, en)}</option>)}</select></Field>
    {form.type === "string" && <Field label={T("Nejvyšší délka", "Maximum length")} hint={T("1 až 255, lze jen zvětšit.", "1 to 255, can only grow.")}><input type="number" value={form.maxLength} onChange={(e) => set({ maxLength: e.target.value })} /></Field>}
    {form.type === "decimal" && creating && <><Field label={T("Počet číslic celkem", "Precision")}><input type="number" value={form.precision} onChange={(e) => set({ precision: e.target.value })} /></Field><Field label={T("Počet desetinných míst", "Scale")}><input type="number" value={form.scale} onChange={(e) => set({ scale: e.target.value })} /></Field></>}
    {(form.type === "integer" || form.type === "decimal") && <><Field label={T("Minimum", "Minimum")}><input value={form.min} onChange={(e) => set({ min: e.target.value })} /></Field><Field label={T("Maximum", "Maximum")}><input value={form.max} onChange={(e) => set({ max: e.target.value })} /></Field></>}
    {(form.type === "enum" || form.type === "multiEnum") && <Field label={T("Možnosti", "Options")} hint={T("Jedna na řádek. Existující možnosti nelze odebrat, jen přidat na konec.", "One per line. Existing options cannot be removed, only appended.")}><textarea rows={5} value={form.options} onChange={(e) => set({ options: e.target.value })} /></Field>}
    {form.type === "link" && <Field label={T("Cílová entita", "Target entity")}><select value={form.target} disabled={!creating} onChange={(e) => set({ target: e.target.value })}><option value="">{T("Vyberte…", "Choose…")}</option>{entities.map((entity) => <option key={entity.key} value={entity.key}>{entity.labelSingular}</option>)}</select></Field>}
    {form.type !== "link" && <Field label={T("Výchozí hodnota", "Default value")} hint={form.type === "multiEnum" ? T("Hodnoty oddělené čárkou.", "Values separated by commas.") : form.type === "boolean" ? "true / false" : undefined}><input value={form.defaultValue} onChange={(e) => set({ defaultValue: e.target.value })} /></Field>}
    <label className="field-input"><span><input type="checkbox" checked={form.required} onChange={(e) => set({ required: e.target.checked })} /> {T("Povinné pole", "Required")}</span></label>
    <label className="field-input"><span><input type="checkbox" checked={form.readOnly} onChange={(e) => set({ readOnly: e.target.checked })} /> {T("Jen pro čtení (zapisuje ho systém)", "Read only (written by the system)")}</span></label>
    <Banner text={error} />
  </Dialog>;
}
