import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiJson } from "../http.ts";
import { T, useLocale } from "../i18n/index.ts";
import { useConfirmDialog } from "../ConfirmDialogProvider";
import { AdminPage, Banner, Busy, Dialog, Field, Table, describe, useAsync } from "./ui.tsx";

type FormField = { key: string; required: boolean };
type LeadForm = { id: string; name: string; active: boolean; fields: FormField[]; optIn: boolean; successMessage: string | null; ownerId: string | null; teamIds: string[] };
type EntityMeta = { key: string; fields: Array<{ key: string; label: string; type: string; readOnly: boolean }> };
type Lookup = { id: string; name: string; isActive?: boolean };

const ALLOWED = new Set(["string", "text", "integer", "decimal", "boolean", "date", "dateTime", "enum", "multiEnum", "email", "phone", "url"]);
const SERVER_SET = new Set(["status", "source"]);
const publicLink = (id: string) => `${window.location.origin}/forms/${id}`;

export default function LeadFormsAdmin({ onBack }: { onBack: () => void }) {
  useLocale();
  const confirm = useConfirmDialog();
  const list = useAsync(() => apiJson<{ items: LeadForm[] }>("/v1/lead-forms"), []);
  const [editing, setEditing] = useState<LeadForm | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function remove(form: LeadForm) {
    if (!await confirm({ title: T("Smazat formulář?", "Delete the form?"), message: T(`Formulář „${form.name}“ a jeho odkaz přestanou fungovat.`, `The form “${form.name}” and its link stop working.`), confirmLabel: T("Smazat", "Delete"), tone: "danger" })) return;
    setError(""); setNotice("");
    try { await apiJson(`/v1/lead-forms/${form.id}`, { method: "DELETE" }); setNotice(T("Formulář byl smazán.", "The form was deleted.")); await list.reload(); }
    catch (cause) { setError(describe(cause)); }
  }
  return <AdminPage title={T("Formuláře pro leady", "Lead forms")} subtitle={T("Veřejné formuláře, jejichž odeslání vytvoří lead (volitelně po potvrzení e-mailem).", "Public forms whose submission creates a lead (optionally after an e-mail confirmation).")} onBack={onBack} testId="admin-lead-forms"
    actions={<button type="button" className="button primary" onClick={() => setEditing("new")}><Plus size={15} /> {T("Nový formulář", "New form")}</button>}>
    <Banner text={error || list.error} /><Banner text={notice} tone="ok" />
    <section className="surface">
      {list.loading && !list.data ? <Busy /> : <Table head={[T("Název", "Name"), T("Polí", "Fields"), T("Potvrzení e-mailem", "E-mail confirmation"), T("Stav", "State"), T("Veřejný odkaz", "Public link"), ""]} empty={T("Žádné formuláře.", "No forms.")}>
        {list.data?.items.map((form) => <tr key={form.id}><td><b>{form.name}</b></td><td>{form.fields.length}</td><td>{form.optIn ? T("Ano", "Yes") : T("Ne", "No")}</td><td>{form.active ? T("Aktivní", "Active") : T("Vypnutý", "Off")}</td>
          <td><a href={publicLink(form.id)} target="_blank" rel="noreferrer">{publicLink(form.id)}</a></td>
          <td><div className="admin-row-actions">
            <button type="button" className="icon-button" aria-label={`${T("Upravit", "Edit")}: ${form.name}`} onClick={() => setEditing(form)}><Pencil size={14} /></button>
            <button type="button" className="icon-button" aria-label={`${T("Smazat", "Delete")}: ${form.name}`} onClick={() => void remove(form)}><Trash2 size={14} /></button></div></td></tr>)}
      </Table>}
    </section>
    {editing && <FormDialog form={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async (text) => { setEditing(null); setNotice(text); await list.reload(); }} />}
  </AdminPage>;
}

function FormDialog({ form, onClose, onSaved }: { form: LeadForm | null; onClose: () => void; onSaved: (text: string) => Promise<void> }) {
  const meta = useAsync(() => apiJson<{ entities: EntityMeta[] }>("/v1/meta/entities"), []);
  const users = useAsync(() => apiJson<{ items: Lookup[] }>("/v1/lookup/users?limit=200"), []);
  const [name, setName] = useState(form?.name ?? "");
  const [active, setActive] = useState(form?.active ?? true);
  const [optIn, setOptIn] = useState(form?.optIn ?? false);
  const [message, setMessage] = useState(form?.successMessage ?? "");
  const [ownerId, setOwnerId] = useState(form?.ownerId ?? "");
  const [fields, setFields] = useState<FormField[]>(form?.fields ?? [{ key: "lastName", required: true }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = (meta.data?.entities.find((entity) => entity.key === "lead")?.fields ?? []).filter((field) => ALLOWED.has(field.type) && !field.readOnly && !SERVER_SET.has(field.key) && !["id", "createdAt", "updatedAt", "createdById", "ownerId", "teamIds"].includes(field.key));
  const label = (key: string) => available.find((field) => field.key === key)?.label ?? key;
  const has = (key: string) => fields.some((field) => field.key === key);

  function toggle(key: string) {
    setFields(has(key) ? fields.filter((field) => field.key !== key) : [...fields, { key, required: key === "email" && optIn }]);
  }
  function setOptInFlag(value: boolean) {
    setOptIn(value);
    // the confirmation mail goes to the submitted address, so the form must ask for it
    if (value) setFields(has("email") ? fields.map((field) => field.key === "email" ? { ...field, required: true } : field) : [...fields, { key: "email", required: true }]);
  }
  async function save() {
    setBusy(true); setError("");
    const body = JSON.stringify({ name, active, fields, optIn, successMessage: message.trim() || null, ownerId: ownerId || null, teamIds: form?.teamIds ?? [] });
    try {
      if (form) await apiJson(`/v1/lead-forms/${form.id}`, { method: "PUT", body }); else await apiJson("/v1/lead-forms", { method: "POST", body });
      await onSaved(form ? T("Formulář byl uložen.", "The form was saved.") : T("Formulář byl vytvořen.", "The form was created."));
    } catch (cause) { setError(describe(cause, (field) => { const key = /^fields\[(\d+)\]/.exec(field); return key ? label(fields[Number(key[1])]?.key ?? field) : field === "name" ? T("Název", "Name") : field === "fields" ? T("Pole", "Fields") : field; })); }
    finally { setBusy(false); }
  }
  return <Dialog title={form ? T("Upravit formulář", "Edit form") : T("Nový formulář", "New form")} onClose={onClose} busy={busy} wide testId="lead-form-dialog" footer={<>
    <button type="button" className="button subtle" onClick={onClose} disabled={busy}>{T("Zrušit", "Cancel")}</button>
    <button type="button" className="button primary" onClick={() => void save()} disabled={busy || !name.trim() || !fields.length}>{T("Uložit", "Save")}</button></>}>
    <Banner text={error} />
    <Field label={T("Název", "Name")}><input aria-label={T("Název", "Name")} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></Field>
    <label><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {T("Aktivní (veřejný odkaz funguje)", "Active (the public link works)")}</label>
    <label><input type="checkbox" checked={optIn} onChange={(e) => setOptInFlag(e.target.checked)} /> {T("Před vytvořením leadu vyžadovat potvrzení e-mailem", "Require e-mail confirmation before the lead is created")}</label>
    <Field label={T("Text po odeslání (nepovinný)", "Text after submitting (optional)")}><textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
    <Field label={T("Vlastník nových leadů", "Owner of new leads")}><select aria-label={T("Vlastník", "Owner")} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}><option value="">—</option>{users.data?.items.filter((user) => user.isActive !== false).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
    <h3>{T("Pole formuláře", "Form fields")}</h3>
    {meta.loading ? <Busy /> : <Table head={[T("Pole", "Field"), T("Ve formuláři", "In the form"), T("Povinné", "Required")]}>
      {available.map((field) => { const current = fields.find((item) => item.key === field.key); return <tr key={field.key}>
        <td>{field.label}</td>
        <td><input type="checkbox" aria-label={`${T("Ve formuláři", "In the form")}: ${field.label}`} checked={Boolean(current)} onChange={() => toggle(field.key)} /></td>
        <td><input type="checkbox" aria-label={`${T("Povinné", "Required")}: ${field.label}`} disabled={!current || (optIn && field.key === "email")} checked={Boolean(current?.required)} onChange={(e) => setFields(fields.map((item) => item.key === field.key ? { ...item, required: e.target.checked } : item))} /></td></tr>; })}
    </Table>}
  </Dialog>;
}
