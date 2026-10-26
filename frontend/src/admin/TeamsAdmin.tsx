import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiJson } from "../http.ts";
import { T, useLocale } from "../i18n/index.ts";
import { useConfirmDialog } from "../ConfirmDialogProvider";
import { AdminPage, Banner, Busy, Dialog, Field, Table, describe, useAsync } from "./ui.tsx";

type Team = { id: string; name: string };
type Role = { id: string; name: string };
type Member = { id: string; email: string; firstName?: string; lastName: string };

export default function TeamsAdmin({ onBack }: { onBack: () => void }) {
  useLocale();
  const confirm = useConfirmDialog();
  const list = useAsync(() => apiJson<{ items: Team[] }>("/v1/teams"), []);
  const [editing, setEditing] = useState<Team | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function remove(team: Team) {
    if (!await confirm({ title: T("Smazat tým?", "Delete the team?"), message: T(`Tým „${team.name}“ bude odstraněn, členové zůstanou.`, `The team “${team.name}” will be removed; its members stay.`), confirmLabel: T("Smazat", "Delete"), tone: "danger" })) return;
    setError(""); setNotice("");
    try { await apiJson(`/v1/teams/${team.id}`, { method: "DELETE" }); setNotice(T("Tým byl smazán.", "The team was deleted.")); await list.reload(); }
    catch (cause) { setError(describe(cause)); }
  }

  return <AdminPage title={T("Týmy", "Teams")} onBack={onBack} testId="admin-teams" actions={<button type="button" className="button primary" onClick={() => setEditing("new")}><Plus size={15} /> {T("Nový tým", "New team")}</button>}>
    <Banner text={error || list.error} /><Banner text={notice} tone="ok" />
    <section className="surface">
      {list.loading && !list.data ? <Busy /> : <Table head={[T("Název", "Name"), ""]} empty={T("Žádné týmy.", "No teams.")}>
        {list.data?.items.map((team) => <tr key={team.id}><td><b>{team.name}</b></td>
          <td><div className="admin-row-actions">
            <button type="button" className="icon-button" aria-label={`${T("Upravit", "Edit")}: ${team.name}`} onClick={() => setEditing(team)}><Pencil size={14} /></button>
            <button type="button" className="icon-button" aria-label={`${T("Smazat", "Delete")}: ${team.name}`} onClick={() => void remove(team)}><Trash2 size={14} /></button></div></td></tr>)}
      </Table>}
    </section>
    {editing && <TeamDialog team={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async (text) => { setEditing(null); setNotice(text); await list.reload(); }} />}
  </AdminPage>;
}

function TeamDialog({ team, onClose, onSaved }: { team: Team | null; onClose: () => void; onSaved: (text: string) => Promise<void> }) {
  const [name, setName] = useState(team?.name ?? "");
  const roles = useAsync(() => apiJson<{ items: Role[] }>("/v1/roles"), []);
  const state = useAsync(async () => team ? { roleIds: (await apiJson<{ roleIds: string[] }>(`/v1/teams/${team.id}/roles`)).roleIds, members: (await apiJson<{ items: Member[] }>(`/v1/teams/${team.id}/members`)).items } : { roleIds: [], members: [] as Member[] }, [team?.id]);
  const [roleIds, setRoleIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosen = roleIds ?? state.data?.roleIds ?? [];

  async function save() {
    setBusy(true); setError("");
    try {
      const saved = team ? await apiJson<Team>(`/v1/teams/${team.id}`, { method: "PUT", body: JSON.stringify({ name }) }) : await apiJson<Team>("/v1/teams", { method: "POST", body: JSON.stringify({ name }) });
      if (roleIds) await apiJson(`/v1/teams/${saved.id}/roles`, { method: "PUT", body: JSON.stringify({ roleIds }) });
      await onSaved(team ? T("Tým byl uložen.", "The team was saved.") : T("Tým byl vytvořen.", "The team was created."));
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  }

  return <Dialog title={team ? T("Upravit tým", "Edit team") : T("Nový tým", "New team")} onClose={onClose} busy={busy} testId="team-dialog" footer={<>
    <button type="button" className="button subtle" onClick={onClose} disabled={busy}>{T("Zrušit", "Cancel")}</button>
    <button type="button" className="button primary" onClick={() => void save()} disabled={busy}>{T("Uložit", "Save")}</button></>}>
    <Field label={T("Název týmu", "Team name")}><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
    <Field label={T("Role týmu", "Team roles")} hint={T("Členové týmu dostanou oprávnění těchto rolí.", "Members of the team get the permissions of these roles.")}>
      <div className="admin-check-grid">{roles.data?.items.map((role) => <label key={role.id}><input type="checkbox" checked={chosen.includes(role.id)} onChange={() => setRoleIds(chosen.includes(role.id) ? chosen.filter((id) => id !== role.id) : [...chosen, role.id])} /> {role.name}</label>)}</div></Field>
    {team && <Field label={T("Členové", "Members")}>{state.data?.members.length ? <ul>{state.data.members.map((member) => <li key={member.id}>{[member.firstName, member.lastName].filter(Boolean).join(" ")} · {member.email}</li>)}</ul> : <small>{T("Tým nemá členy.", "The team has no members.")}</small>}</Field>}
    <Banner text={error} />
  </Dialog>;
}
