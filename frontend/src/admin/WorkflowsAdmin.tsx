import { useState } from "react";
import { apiJson } from "../http.ts";
import { T, useLocale } from "../i18n/index.ts";
import { Banner, Busy, Dialog, Field, AdminPage, Table, describe, useAsync } from "./ui.tsx";

type Action =
  | { type: "setField"; field: string; value: unknown }
  | { type: "createRecord"; entity: string; values: Record<string, unknown>; ownerFrom: "owner" | "actor" }
  | { type: "sendEmail"; to: string[]; subject: string; body: string };
type Workflow = { id: string; name: string; entity: string; trigger: "created" | "updated" | "deleted"; condition: unknown; actions: Action[]; active: boolean };
type EntityMeta = { key: string; label: string; labelPlural: string; fields: Array<{ key: string; label: string }> };

const MAX_ACTIONS = 10;
const SYSTEM_FIELDS = new Set(["id", "createdAt", "updatedAt", "createdById"]);
const empty = (entity: string): Workflow => ({ id: "", name: "", entity, trigger: "created", condition: null, actions: [{ type: "setField", field: "", value: "" }], active: true });
const triggerLabel = (trigger: string) => trigger === "created" ? T("Vytvoření", "Created") : trigger === "updated" ? T("Změna", "Updated") : T("Smazání", "Deleted");

// Values are typed as JSON when they parse (numbers, booleans, null), otherwise they stay text.
function parseValue(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
const showValue = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value ?? null);

export default function WorkflowsAdmin({ onBack }: { onBack: () => void }) {
  useLocale();
  const list = useAsync(() => apiJson<{ items: Workflow[] }>("/v1/workflows"), []);
  const meta = useAsync(() => apiJson<{ entities: EntityMeta[] }>("/v1/meta/entities"), []);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [conditionText, setConditionText] = useState("");
  const [valuesText, setValuesText] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const entities = meta.data?.entities ?? [];
  const entityLabel = (key: string) => entities.find((candidate) => candidate.key === key)?.labelPlural ?? key;
  const fieldsOf = (key: string) => (entities.find((candidate) => candidate.key === key)?.fields ?? []).filter((field) => !SYSTEM_FIELDS.has(field.key));

  function open(workflow: Workflow) {
    setError("");
    setEditing(structuredClone(workflow));
    setConditionText(workflow.condition ? JSON.stringify(workflow.condition, null, 2) : "");
    setValuesText(workflow.actions.map((action) => action.type === "createRecord" ? JSON.stringify(action.values, null, 2) : ""));
  }
  const patchAction = (index: number, patch: Partial<Action>) => editing && setEditing({ ...editing, actions: editing.actions.map((action, i) => i === index ? { ...action, ...patch } as Action : action) });

  async function save() {
    if (!editing) return;
    setBusy(true); setError("");
    try {
      let condition: unknown = null;
      if (conditionText.trim()) { try { condition = JSON.parse(conditionText); } catch { throw new Error(T("Podmínka není platný JSON.", "The condition is not valid JSON.")); } }
      const actions = editing.actions.map((action, index) => {
        if (action.type !== "createRecord") return action;
        try { return { ...action, values: JSON.parse(valuesText[index] || "{}") }; } catch { throw new Error(T(`Akce ${index + 1}: hodnoty nejsou platný JSON.`, `Action ${index + 1}: the values are not valid JSON.`)); }
      });
      const body = JSON.stringify({ name: editing.name, entity: editing.entity, trigger: editing.trigger, condition, actions, active: editing.active });
      await apiJson(editing.id ? `/v1/workflows/${editing.id}` : "/v1/workflows", { method: editing.id ? "PUT" : "POST", body });
      setEditing(null); await list.reload();
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  }
  async function toggle(workflow: Workflow) {
    try { await apiJson(`/v1/workflows/${workflow.id}`, { method: "PUT", body: JSON.stringify({ name: workflow.name, entity: workflow.entity, trigger: workflow.trigger, condition: workflow.condition, actions: workflow.actions, active: !workflow.active }) }); await list.reload(); }
    catch (cause) { setError(describe(cause)); }
  }
  async function remove(workflow: Workflow) {
    if (!window.confirm(T(`Smazat pravidlo „${workflow.name}“?`, `Delete the rule “${workflow.name}”?`))) return;
    try { await apiJson(`/v1/workflows/${workflow.id}`, { method: "DELETE" }); await list.reload(); }
    catch (cause) { setError(describe(cause)); }
  }

  return <AdminPage title={T("Automatizace", "Workflows")} subtitle={T("Pravidla, která po vytvoření, změně nebo smazání záznamu nastaví pole, vytvoří záznam nebo pošlou e-mail.", "Rules that set a field, create a record or send an e-mail when a record is created, changed or deleted.")} onBack={onBack} testId="admin-workflows"
    actions={<button type="button" className="button primary" onClick={() => open(empty(entities[0]?.key ?? "account"))} disabled={!entities.length}>{T("Nové pravidlo", "New rule")}</button>}>
    <Banner text={error && !editing ? error : list.error || meta.error} />
    {list.loading ? <Busy /> : <Table head={[T("Název", "Name"), T("Entita", "Entity"), T("Spouštěč", "Trigger"), T("Akcí", "Actions"), T("Stav", "State"), ""]} empty={T("Zatím žádná pravidla.", "No rules yet.")}>
      {list.data?.items.length ? list.data.items.map((workflow) => <tr key={workflow.id}>
        <td><b>{workflow.name}</b></td><td>{entityLabel(workflow.entity)}</td><td>{triggerLabel(workflow.trigger)}</td><td>{workflow.actions.length}</td>
        <td>{workflow.active ? T("Zapnuto", "On") : T("Vypnuto", "Off")}</td>
        <td className="admin-actions"><button type="button" className="button subtle" onClick={() => void toggle(workflow)}>{workflow.active ? T("Vypnout", "Turn off") : T("Zapnout", "Turn on")}</button>
          <button type="button" className="button subtle" onClick={() => open(workflow)}>{T("Upravit", "Edit")}</button>
          <button type="button" className="button subtle" onClick={() => void remove(workflow)}>{T("Smazat", "Delete")}</button></td></tr>) : null}
    </Table>}
    {editing && <Dialog wide busy={busy} testId="workflow-dialog" title={editing.id ? T("Upravit pravidlo", "Edit rule") : T("Nové pravidlo", "New rule")} onClose={() => setEditing(null)}
      footer={<><button type="button" className="button" onClick={() => setEditing(null)} disabled={busy}>{T("Zrušit", "Cancel")}</button><button type="button" className="button primary" onClick={() => void save()} disabled={busy || !editing.name.trim()}>{T("Uložit", "Save")}</button></>}>
      <Banner text={error} />
      <Field label={T("Název", "Name")}><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label={T("Název", "Name")} /></Field>
      <Field label={T("Entita", "Entity")}><select aria-label={T("Entita", "Entity")} value={editing.entity} onChange={(e) => setEditing({ ...editing, entity: e.target.value })}>{entities.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.labelPlural}</option>)}</select></Field>
      <Field label={T("Spouštěč", "Trigger")}><select aria-label={T("Spouštěč", "Trigger")} value={editing.trigger} onChange={(e) => setEditing({ ...editing, trigger: e.target.value as Workflow["trigger"] })}>{(["created", "updated", "deleted"] as const).map((trigger) => <option key={trigger} value={trigger}>{triggerLabel(trigger)}</option>)}</select></Field>
      <Field label={T("Podmínka (JSON filtr, nepovinná)", "Condition (JSON filter, optional)")} hint={T('Např. {"eq":{"stage":"won"}}; prázdná = vždy.', 'E.g. {"eq":{"stage":"won"}}; empty = always.')}><textarea rows={3} value={conditionText} onChange={(e) => setConditionText(e.target.value)} aria-label={T("Podmínka", "Condition")} /></Field>
      <label><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> {T("Zapnuto", "Active")}</label>
      <h3>{T("Akce", "Actions")}</h3>
      {editing.actions.map((action, index) => <fieldset key={index} className="admin-action-box" data-testid="workflow-action">
        <legend>{index + 1}.</legend>
        <Field label={T("Typ akce", "Action type")}><select aria-label={`${T("Typ akce", "Action type")} ${index + 1}`} value={action.type} onChange={(e) => {
          const type = e.target.value;
          const fresh: Action = type === "setField" ? { type, field: "", value: "" } : type === "createRecord" ? { type, entity: editing.entity, values: {}, ownerFrom: "owner" } : { type: "sendEmail", to: ["owner"], subject: "", body: "" };
          setEditing({ ...editing, actions: editing.actions.map((current, i) => i === index ? fresh : current) });
          setValuesText(valuesText.map((text, i) => i === index ? "" : text));
        }}><option value="setField">{T("Nastavit pole", "Set a field")}</option><option value="createRecord">{T("Vytvořit záznam", "Create a record")}</option><option value="sendEmail">{T("Poslat e-mail", "Send an e-mail")}</option></select></Field>
        {action.type === "setField" && <>
          <Field label={T("Pole", "Field")}><select aria-label={`${T("Pole", "Field")} ${index + 1}`} value={action.field} onChange={(e) => patchAction(index, { field: e.target.value })}><option value="">{T("Vyberte…", "Choose…")}</option>{fieldsOf(editing.entity).map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></Field>
          <Field label={T("Hodnota", "Value")}><input aria-label={`${T("Hodnota", "Value")} ${index + 1}`} value={showValue(action.value)} onChange={(e) => patchAction(index, { value: parseValue(e.target.value) })} /></Field></>}
        {action.type === "createRecord" && <>
          <Field label={T("Entita nového záznamu", "Entity of the new record")}><select aria-label={`${T("Nová entita", "New entity")} ${index + 1}`} value={action.entity} onChange={(e) => patchAction(index, { entity: e.target.value })}>{entities.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.labelPlural}</option>)}</select></Field>
          <Field label={T("Vlastník", "Owner")}><select value={action.ownerFrom} onChange={(e) => patchAction(index, { ownerFrom: e.target.value as "owner" | "actor" })}><option value="owner">{T("Vlastník spouštěcího záznamu", "Owner of the triggering record")}</option><option value="actor">{T("Uživatel, který změnu provedl", "User who made the change")}</option></select></Field>
          <Field label={T("Hodnoty (JSON, šablony {{pole}})", "Values (JSON, {{field}} templates)")}><textarea rows={4} aria-label={`${T("Hodnoty", "Values")} ${index + 1}`} value={valuesText[index] ?? ""} onChange={(e) => setValuesText(valuesText.map((text, i) => i === index ? e.target.value : text))} /></Field></>}
        {action.type === "sendEmail" && <>
          <Field label={T("Příjemci (čárkou: owner, creator, e-mail)", "Recipients (comma: owner, creator, e-mail)")}><input aria-label={`${T("Příjemci", "Recipients")} ${index + 1}`} value={action.to.join(", ")} onChange={(e) => patchAction(index, { to: e.target.value.split(",").map((part) => part.trim()).filter(Boolean) })} /></Field>
          <Field label={T("Předmět", "Subject")}><input aria-label={`${T("Předmět", "Subject")} ${index + 1}`} value={action.subject} onChange={(e) => patchAction(index, { subject: e.target.value })} /></Field>
          <Field label={T("Text", "Body")}><textarea rows={4} aria-label={`${T("Text", "Body")} ${index + 1}`} value={action.body} onChange={(e) => patchAction(index, { body: e.target.value })} /></Field></>}
        <button type="button" className="button subtle" onClick={() => { setEditing({ ...editing, actions: editing.actions.filter((_, i) => i !== index) }); setValuesText(valuesText.filter((_, i) => i !== index)); }} disabled={editing.actions.length <= 1}>{T("Odebrat akci", "Remove action")}</button>
      </fieldset>)}
      <button type="button" className="button" disabled={editing.actions.length >= MAX_ACTIONS} onClick={() => { setEditing({ ...editing, actions: [...editing.actions, { type: "setField", field: "", value: "" }] }); setValuesText([...valuesText, ""]); }}>{T("Přidat akci", "Add action")}</button>
    </Dialog>}
  </AdminPage>;
}
