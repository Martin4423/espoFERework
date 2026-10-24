import { useEffect, useMemo, useRef, useState } from "react";
import { Send, X } from "./Icons";
import { request } from "./api";
import type { Metadata } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type Attendee = { id: string; _scope?: string; name?: string; firstName?: string; lastName?: string; emailAddress?: string; acceptanceStatus?: string };
type Result = { list?: Attendee[] };

/** Native Meeting send-invitations flow with a clear, searchable attendee choice. */
export default function MeetingInvitationDialog({ meeting, metadata, mode = "invitations", currentUserId = "", onClose, onSent }: { meeting: { id: string; name?: string }; metadata: Metadata; mode?: "invitations" | "cancellation"; currentUserId?: string; onClose: () => void; onSent: (sent: boolean) => void }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  busyRef.current = busy;
  const dialogRef = useDialogFocus<HTMLElement>(() => { if (!busyRef.current) onClose(); }, !busy);
  useEffect(() => {
    let live = true;
    request<Result>(`Meeting/${encodeURIComponent(meeting.id)}/attendees`).then((result) => {
      if (!live) return;
      const list = (result.list || []).filter((item) => item.emailAddress);
      setAttendees(list);
      setSelected(new Set(list.filter((item) => mode === "cancellation" ? !(item._scope === "User" && item.id === currentUserId) : !item.acceptanceStatus || item.acceptanceStatus === "None").map((item) => item.id)));
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Seznam účastníků se nepodařilo načíst.")).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [meeting.id, mode, currentUserId]);
  const statusLabels = (metadata.labels as any)?.Meeting?.options?.acceptanceStatus || {};
  const names = (attendee: Attendee) => attendee.name || [attendee.firstName, attendee.lastName].filter(Boolean).join(" ") || attendee.emailAddress || attendee.id;
  const allSelected = attendees.length > 0 && attendees.every((item) => selected.has(item.id));
  const selectedCount = useMemo(() => selected.size, [selected]);
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function send() {
    if (busy || !selected.size) return;
    setBusy(true); setError("");
    try {
      const targets = attendees.filter((item) => selected.has(item.id)).map((item) => ({ entityType: item._scope || "User", id: item.id }));
      const result = await request<boolean>(`Meeting/action/${mode === "cancellation" ? "sendCancellation" : "sendInvitations"}`, { method: "POST", body: JSON.stringify({ id: meeting.id, targets }) });
      onSent(Boolean(result));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pozvánky se nepodařilo odeslat."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop meeting-invitation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section ref={dialogRef} tabIndex={-1} className="record-modal meeting-invitation-dialog" role="dialog" aria-modal="true" aria-labelledby="meeting-invitation-title">
      <div className="modal-heading"><div><span className="eyebrow">SCHŮZKA · {meeting.name || "BEZ NÁZVU"}</span><h2 id="meeting-invitation-title">{mode === "cancellation" ? "Odeslat storno" : "Odeslat pozvánky"}</h2><p>{mode === "cancellation" ? "Vyberte účastníky s e-mailovou adresou, kterým chcete poslat oznámení o zrušení schůzky." : "Vyberte účastníky s e-mailovou adresou, kterým chcete poslat pozvánku."}</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Zavřít"><X size={16}/></button></div>
      <div className="meeting-invitation-list" aria-live="polite" aria-busy={loading}>
        {!loading && !error && attendees.length > 0 && <label className="meeting-invitation-select-all"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(attendees.map((item) => item.id)))}/><span>Vybrat všechny ({attendees.length})</span></label>}
        {loading ? <div className="table-loading"><span className="spinner"/>Načítám účastníky…</div> : error ? <div className="inline-error" role="alert">{error}</div> : attendees.length ? attendees.map((attendee) => <label className="meeting-invitation-attendee" key={`${attendee._scope}-${attendee.id}`}><input type="checkbox" checked={selected.has(attendee.id)} disabled={busy} onChange={() => toggle(attendee.id)}/><span className="meeting-invitation-name"><strong>{names(attendee)}</strong><small>{metadata.labels?.Global?.scopeNames?.[attendee._scope || ""] || attendee._scope || "Účastník"} · {attendee.emailAddress}</small></span><span className="meeting-invitation-status">{statusLabels[attendee.acceptanceStatus || "None"] || attendee.acceptanceStatus || "Bez odpovědi"}</span></label>) : <div className="meeting-invitation-empty"><strong>Žádný účastník s e-mailem</strong><span>Přidejte k schůzce alespoň jednoho účastníka s e-mailovou adresou.</span></div>}
      </div>
      <div className="modal-footer"><span className="meeting-invitation-count">{selectedCount} vybráno</span><button type="button" className="button subtle" onClick={onClose} disabled={busy}>Zrušit</button><button type="button" className={`button ${mode === "cancellation" ? "danger" : "primary"}`} onClick={() => void send()} disabled={busy || loading || !selectedCount || Boolean(error)}>{busy ? "Odesílám…" : mode === "cancellation" ? "Odeslat storno" : "Odeslat pozvánky"}<Send size={14}/></button></div>
    </section>
  </div>;
}
