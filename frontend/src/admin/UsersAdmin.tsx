import { useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { apiJson } from "../http.ts";
import { T, useLocale } from "../i18n/index.ts";
import { useConfirmDialog } from "../ConfirmDialogProvider";
import { AdminPage, Banner, Busy, Dialog, Field, Table, describe, useAsync } from "./ui.tsx";

type AdminUser = { id: string; email: string; firstName?: string; lastName: string; type: "regular" | "admin"; isActive: boolean; createdAt: string };
type Named = { id: string; name: string };
const PAGE = 20;

const fullName = (user: AdminUser) => [user.firstName, user.lastName].filter(Boolean).join(" ");
const FIELD_LABEL = (field: string) => ({ email: T("E-mail", "E-mail"), password: T("Heslo", "Password"), newPassword: T("Nové heslo", "New password"), lastName: T("Příjmení", "Last name"), firstName: T("Jméno", "First name"), type: T("Typ", "Type") })[field as "email"] ?? field;

export default function UsersAdmin({ onBack, currentUserId }: { onBack: () => void; currentUserId: string }) {
  useLocale();
  const confirm = useConfirmDialog();
  const [offset, setOffset] = useState(0);
  const list = useAsync(() => apiJson<{ items: AdminUser[]; total: number }>(`/v1/users?limit=${PAGE}&offset=${offset}`), [offset]);
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function act(run: () => Promise<unknown>, done: string) {
    setError(""); setNotice("");
    try { await run(); setNotice(done); await list.reload(); }
    catch (cause) { setError(describe(cause, FIELD_LABEL)); }
  }

  async function resetPassword(user: AdminUser) {
    const password = window.prompt(T(`Nové heslo pro ${user.email} (12 až 128 znaků):`, `New password for ${user.email} (12 to 128 characters):`));
    if (!password) return;
    await act(() => apiJson(`/v1/users/${user.id}/password`, { method: "POST", body: JSON.stringify({ newPassword: password }) }), T("Heslo bylo změněno, uživatel byl odhlášen.", "The password was changed and the user was signed out."));
  }

  async function remove(user: AdminUser) {
    if (!await confirm({ title: T("Smazat uživatele?", "Delete the user?"), message: T(`Uživatel ${user.email} bude odstraněn a odhlášen.`, `The user ${user.email} will be removed and signed out.`), confirmLabel: T("Smazat", "Delete"), tone: "danger" })) return;
    await act(() => apiJson(`/v1/users/${user.id}`, { method: "DELETE" }), T("Uživatel byl smazán.", "The user was deleted."));
  }

  const total = list.data?.total ?? 0;
  return <AdminPage title={T("Uživatelé", "Users")} onBack={onBack} testId="admin-users"
    actions={<button type="button" className="button primary" onClick={() => setEditing("new")}><Plus size={15} /> {T("Nový uživatel", "New user")}</button>}>
    <Banner text={error || list.error} /><Banner text={notice} tone="ok" />
    <section className="surface">
      {list.loading && !list.data ? <Busy /> : <Table head={[T("Jméno", "Name"), "E-mail", T("Role", "Type"), T("Stav", "Status"), ""]} empty={T("Žádní uživatelé.", "No users.")}>
        {list.data?.items.map((user) => <tr key={user.id} onClick={() => setEditing(user)} style={{ cursor: "pointer" }}>
          <td><b>{fullName(user)}</b></td><td>{user.email}</td>
          <td>{user.type === "admin" ? T("Administrátor", "Administrator") : T("Uživatel", "User")}</td>
          <td>{user.isActive ? T("Aktivní", "Active") : T("Neaktivní", "Inactive")}</td>
          <td onClick={(event) => event.stopPropagation()}><div className="admin-row-actions">
            <button type="button" className="icon-button" title={T("Změnit heslo", "Change password")} aria-label={`${T("Změnit heslo", "Change password")}: ${user.email}`} onClick={() => void resetPassword(user)}><KeyRound size={14} /></button>
            <button type="button" className="icon-button" title={T("Smazat", "Delete")} aria-label={`${T("Smazat", "Delete")}: ${user.email}`} disabled={user.id === currentUserId} onClick={() => void remove(user)}><Trash2 size={14} /></button>
          </div></td>
        </tr>)}
      </Table>}
      <div className="table-footer"><span>{T("Zobrazeno", "Showing")} <b>{total ? offset + 1 : 0}–{Math.min(offset + PAGE, total)}</b> {T("z", "of")} <b>{total}</b></span>
        <div className="pagination"><button aria-label={T("Předchozí stránka", "Previous page")} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>‹</button>
          <button aria-label={T("Další stránka", "Next page")} disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>›</button></div></div>
    </section>
    {editing && <UserDialog user={editing === "new" ? null : editing} isSelf={editing !== "new" && editing.id === currentUserId} onClose={() => setEditing(null)} onSaved={async (text) => { setEditing(null); setNotice(text); await list.reload(); }} onToggle={(user) => act(() => apiJson(`/v1/users/${user.id}/${user.isActive ? "deactivate" : "activate"}`, { method: "POST" }), user.isActive ? T("Uživatel byl deaktivován.", "The user was deactivated.") : T("Uživatel byl aktivován.", "The user was activated."))} />}
  </AdminPage>;
}

function UserDialog({ user, isSelf, onClose, onSaved, onToggle }: { user: AdminUser | null; isSelf: boolean; onClose: () => void; onSaved: (text: string) => Promise<void>; onToggle: (user: AdminUser) => Promise<void> }) {
  const teams = useAsync(() => apiJson<{ items: Named[] }>("/v1/teams"), []);
  const roles = useAsync(() => apiJson<{ items: Named[] }>("/v1/roles"), []);
  const assigned = useAsync(async () => user ? { teamIds: (await apiJson<{ teamIds: string[] }>(`/v1/users/${user.id}/teams`)).teamIds, roleIds: (await apiJson<{ roleIds: string[] }>(`/v1/users/${user.id}/roles`)).roleIds } : { teamIds: [], roleIds: [] }, [user?.id]);
  const [form, setForm] = useState({ email: user?.email ?? "", password: "", firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", type: user?.type ?? "regular" });
  const [teamIds, setTeamIds] = useState<string[] | null>(null);
  const [roleIds, setRoleIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosenTeams = teamIds ?? assigned.data?.teamIds ?? [];
  const chosenRoles = roleIds ?? assigned.data?.roleIds ?? [];
  const toggle = (list: string[], id: string) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  async function save() {
    setBusy(true); setError("");
    try {
      const names = { firstName: form.firstName.trim() || null, lastName: form.lastName };
      let id = user?.id;
      if (user) await apiJson(`/v1/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ ...names, email: form.email, ...(isSelf ? {} : { type: form.type }) }) });
      else id = (await apiJson<AdminUser>("/v1/users", { method: "POST", body: JSON.stringify({ ...names, email: form.email, password: form.password, type: form.type }) })).id;
      if (teamIds) await apiJson(`/v1/users/${id}/teams`, { method: "PUT", body: JSON.stringify({ teamIds }) });
      if (roleIds) await apiJson(`/v1/users/${id}/roles`, { method: "PUT", body: JSON.stringify({ roleIds }) });
      await onSaved(user ? T("Uživatel byl uložen.", "The user was saved.") : T("Uživatel byl vytvořen.", "The user was created."));
    } catch (cause) { setError(describe(cause, FIELD_LABEL)); }
    finally { setBusy(false); }
  }

  return <Dialog title={user ? T("Upravit uživatele", "Edit user") : T("Nový uživatel", "New user")} onClose={onClose} busy={busy} testId="user-dialog" footer={<>
    {user && !isSelf && <button type="button" className="button subtle" onClick={() => void onToggle(user).then(onClose)} disabled={busy}>{user.isActive ? T("Deaktivovat", "Deactivate") : T("Aktivovat", "Activate")}</button>}
    <button type="button" className="button subtle" onClick={onClose} disabled={busy}>{T("Zrušit", "Cancel")}</button>
    <button type="button" className="button primary" onClick={() => void save()} disabled={busy}>{T("Uložit", "Save")}</button></>}>
    <Field label={T("Jméno", "First name")}><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
    <Field label={T("Příjmení", "Last name")}><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></Field>
    <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
    {!user && <Field label={T("Heslo", "Password")} hint={T("12 až 128 znaků", "12 to 128 characters")}><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>}
    <Field label={T("Role v systému", "Account type")}><select value={form.type} disabled={isSelf} onChange={(e) => setForm({ ...form, type: e.target.value as "regular" | "admin" })}>
      <option value="regular">{T("Uživatel", "User")}</option><option value="admin">{T("Administrátor", "Administrator")}</option></select></Field>
    <Field label={T("Týmy", "Teams")}><div className="admin-check-grid">{teams.data?.items.map((team) => <label key={team.id}><input type="checkbox" checked={chosenTeams.includes(team.id)} onChange={() => setTeamIds(toggle(chosenTeams, team.id))} /> {team.name}</label>)}{teams.data?.items.length === 0 && <small>{T("Žádné týmy.", "No teams.")}</small>}</div></Field>
    <Field label={T("Role (oprávnění)", "Roles (permissions)")}><div className="admin-check-grid">{roles.data?.items.map((role) => <label key={role.id}><input type="checkbox" checked={chosenRoles.includes(role.id)} onChange={() => setRoleIds(toggle(chosenRoles, role.id))} /> {role.name}</label>)}{roles.data?.items.length === 0 && <small>{T("Žádné role.", "No roles.")}</small>}</div></Field>
    <Banner text={error} />
  </Dialog>;
}
