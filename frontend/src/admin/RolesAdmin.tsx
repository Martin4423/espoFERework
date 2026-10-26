import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiJson } from "../http.ts";
import { T, useLocale } from "../i18n/index.ts";
import { useConfirmDialog } from "../ConfirmDialogProvider";
import { AdminPage, Banner, Busy, Dialog, Field, Table, describe, useAsync } from "./ui.tsx";

type Level = "all" | "team" | "own" | "no";
type EntityRule = { read?: Level; edit?: Level; delete?: Level; create?: "yes" | "no" };
type FieldRule = { read?: boolean; write?: boolean };
type Role = { id: string; name: string; description?: string; entityPermissions: Record<string, EntityRule>; fieldPermissions: Record<string, Record<string, FieldRule>>; featurePermissions: Record<string, boolean> };
type EntityMeta = { key: string; labelPlural: string; fields: Array<{ key: string; label: string; core: boolean }> };

const LEVELS: Level[] = ["all", "team", "own", "no"];
const levelText = (level: string) => ({ all: T("Vše", "All"), team: T("Tým", "Team"), own: T("Vlastní", "Own"), no: T("Nic", "None"), yes: T("Ano", "Yes") })[level as "all"] ?? level;
const FEATURES: Array<[string, string, string]> = [
  ["import", "Import", "Import"], ["export", "Export", "Export"], ["massUpdate", "Hromadné úpravy", "Mass update"], ["audit", "Historie změn", "Change history"],
];
// system properties are always readable; they are not part of the permission registry except the owner
const SYSTEM = new Set(["id", "createdAt", "updatedAt", "createdById", "teamIds"]);

export default function RolesAdmin({ onBack }: { onBack: () => void }) {
  useLocale();
  const confirm = useConfirmDialog();
  const list = useAsync(() => apiJson<{ items: Role[] }>("/v1/roles"), []);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function remove(role: Role) {
    if (!await confirm({ title: T("Smazat roli?", "Delete the role?"), message: T(`Role „${role.name}“ bude odebrána všem uživatelům a týmům.`, `The role “${role.name}” is taken away from every user and team.`), confirmLabel: T("Smazat", "Delete"), tone: "danger" })) return;
    setError(""); setNotice("");
    try { await apiJson(`/v1/roles/${role.id}`, { method: "DELETE" }); setNotice(T("Role byla smazána.", "The role was deleted.")); await list.reload(); }
    catch (cause) { setError(describe(cause)); }
  }

  const summary = (role: Role) => Object.entries(role.entityPermissions).map(([entity, rule]) => `${entity}: ${levelText(rule.read ?? "no")}/${levelText(rule.edit ?? "no")}/${levelText(rule.delete ?? "no")}`).join(" · ");
  return <AdminPage title={T("Role a oprávnění", "Roles and permissions")} onBack={onBack} testId="admin-roles" actions={<button type="button" className="button primary" onClick={() => setEditing("new")}><Plus size={15} /> {T("Nová role", "New role")}</button>}>
    <Banner text={error || list.error} /><Banner text={notice} tone="ok" />
    <section className="surface">
      {list.loading && !list.data ? <Busy /> : <Table head={[T("Název", "Name"), T("Čtení / úpravy / mazání", "Read / edit / delete"), ""]} empty={T("Žádné role.", "No roles.")}>
        {list.data?.items.map((role) => <tr key={role.id}><td><b>{role.name}</b><br /><small>{role.description}</small></td><td><small>{summary(role) || "—"}</small></td>
          <td><div className="admin-row-actions">
            <button type="button" className="icon-button" aria-label={`${T("Upravit", "Edit")}: ${role.name}`} onClick={() => setEditing(role)}><Pencil size={14} /></button>
            <button type="button" className="icon-button" aria-label={`${T("Smazat", "Delete")}: ${role.name}`} onClick={() => void remove(role)}><Trash2 size={14} /></button></div></td></tr>)}
      </Table>}
    </section>
    {editing && <RoleDialog role={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async (text) => { setEditing(null); setNotice(text); await list.reload(); }} />}
  </AdminPage>;
}

function RoleDialog({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: (text: string) => Promise<void> }) {
  const meta = useAsync(() => apiJson<{ entities: EntityMeta[] }>("/v1/meta/entities"), []);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [entities, setEntities] = useState<Record<string, EntityRule>>(role?.entityPermissions ?? {});
  const [fields, setFields] = useState<Record<string, Record<string, FieldRule>>>(role?.fieldPermissions ?? {});
  const [features, setFeatures] = useState<Record<string, boolean>>(role?.featurePermissions ?? {});
  const [open, setOpen] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setRule = (entity: string, patch: EntityRule) => setEntities((old) => ({ ...old, [entity]: { ...old[entity], ...patch } }));
  const setField = (entity: string, field: string, patch: FieldRule) => setFields((old) => ({ ...old, [entity]: { ...old[entity], [field]: { ...old[entity]?.[field], ...patch } } }));
  const fieldRows = useMemo(() => meta.data?.entities.find((e) => e.key === open)?.fields.filter((f) => !SYSTEM.has(f.key)) ?? [], [meta.data, open]);

  async function save() {
    setBusy(true); setError("");
    try {
      // only what differs from "allowed": explicit false flags of fields, levels other than "no" of entities
      const entityPermissions = Object.fromEntries(Object.entries(entities).map(([entity, rule]) => [entity, Object.fromEntries(Object.entries(rule).filter(([, value]) => value && value !== "no"))]).filter(([, rule]) => Object.keys(rule as object).length));
      const fieldPermissions = Object.fromEntries(Object.entries(fields).map(([entity, byField]) => [entity, Object.fromEntries(Object.entries(byField).map(([field, flags]) => [field, Object.fromEntries(Object.entries(flags).filter(([, value]) => value === false))]).filter(([, flags]) => Object.keys(flags as object).length))]).filter(([, byField]) => Object.keys(byField as object).length));
      const featurePermissions = Object.fromEntries(Object.entries(features).filter(([, on]) => on));
      const body = JSON.stringify({ name, description: description.trim() || null, entityPermissions, fieldPermissions, featurePermissions });
      if (role) await apiJson(`/v1/roles/${role.id}`, { method: "PUT", body }); else await apiJson("/v1/roles", { method: "POST", body });
      await onSaved(role ? T("Role byla uložena.", "The role was saved.") : T("Role byla vytvořena.", "The role was created."));
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  }

  return <Dialog wide title={role ? T("Upravit roli", "Edit role") : T("Nová role", "New role")} onClose={onClose} busy={busy} testId="role-dialog" footer={<>
    <button type="button" className="button subtle" onClick={onClose} disabled={busy}>{T("Zrušit", "Cancel")}</button>
    <button type="button" className="button primary" onClick={() => void save()} disabled={busy}>{T("Uložit", "Save")}</button></>}>
    <Field label={T("Název role", "Role name")}><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
    <Field label={T("Popis", "Description")}><input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
    <Field label={T("Přístup k záznamům", "Access to records")}>
      {meta.loading ? <Busy /> : <Table head={[T("Entita", "Entity"), T("Čtení", "Read"), T("Úpravy", "Edit"), T("Mazání", "Delete"), T("Vytvoření", "Create"), T("Pole", "Fields")]}>
        {meta.data?.entities.map((entity) => {
          const rule = entities[entity.key] ?? {};
          const levelSelect = (action: "read" | "edit" | "delete") => <select aria-label={`${entity.labelPlural}: ${action}`} value={rule[action] ?? "no"} onChange={(e) => setRule(entity.key, { [action]: e.target.value as Level })}>{LEVELS.map((level) => <option key={level} value={level}>{levelText(level)}</option>)}</select>;
          return <tr key={entity.key}><td><b>{entity.labelPlural}</b></td><td>{levelSelect("read")}</td><td>{levelSelect("edit")}</td><td>{levelSelect("delete")}</td>
            <td><select aria-label={`${entity.labelPlural}: create`} value={rule.create ?? "no"} onChange={(e) => setRule(entity.key, { create: e.target.value as "yes" | "no" })}><option value="yes">{levelText("yes")}</option><option value="no">{levelText("no")}</option></select></td>
            <td><button type="button" className="button subtle" onClick={() => setOpen(open === entity.key ? "" : entity.key)}>{open === entity.key ? T("Skrýt", "Hide") : T("Omezit pole", "Limit fields")}</button></td></tr>;
        })}
      </Table>}
    </Field>
    {open && <Field label={T(`Pole entity ${open}`, `Fields of ${open}`)} hint={T("Odškrtnutí zakáže čtení nebo zápis tohoto pole pro roli.", "Unchecking forbids reading or writing the field for this role.")}>
      <Table head={[T("Pole", "Field"), T("Čtení", "Read"), T("Zápis", "Write")]}>{fieldRows.map((field) => {
        const flags = fields[open]?.[field.key] ?? {};
        return <tr key={field.key}><td>{field.label}</td>
          <td><input type="checkbox" aria-label={`${field.label}: read`} checked={flags.read !== false} onChange={(e) => setField(open, field.key, { read: e.target.checked ? undefined : false, ...(e.target.checked ? {} : { write: undefined }) })} /></td>
          <td><input type="checkbox" aria-label={`${field.label}: write`} checked={flags.write !== false && flags.read !== false} disabled={flags.read === false} onChange={(e) => setField(open, field.key, { write: e.target.checked ? undefined : false })} /></td></tr>;
      })}</Table></Field>}
    <Field label={T("Funkce", "Features")}><div className="admin-check-grid">{FEATURES.map(([key, cs, en]) => <label key={key}><input type="checkbox" checked={features[key] === true} onChange={(e) => setFeatures({ ...features, [key]: e.target.checked })} /> {T(cs, en)}</label>)}</div></Field>
    <Banner text={error} />
  </Dialog>;
}
