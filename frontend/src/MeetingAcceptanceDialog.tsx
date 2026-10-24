import { useRef, useState } from "react";
import { Check, X } from "./Icons";
import { useDialogFocus } from "./useDialogFocus";

type Choice = { value: string; label: string; style: string };

/** Native Meeting-detail attendee response picker. */
export default function MeetingAcceptanceDialog({ meetingName, choices, selected, onClose, onSelect }: {
  meetingName: string;
  choices: Choice[];
  selected: string;
  onClose: () => void;
  onSelect: (status: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  busyRef.current = busy;
  const dialogRef = useDialogFocus<HTMLElement>(() => { if (!busyRef.current) onClose(); }, !busy);
  async function select(status: string) {
    if (busy) return;
    setBusy(true); setError("");
    try { await onSelect(status); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Odpověď se nepodařilo uložit."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop meeting-acceptance-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section ref={dialogRef} tabIndex={-1} className="record-modal meeting-acceptance-dialog" role="dialog" aria-modal="true" aria-labelledby="meeting-acceptance-title">
      <div className="modal-heading"><div><span className="eyebrow">SCHŮZKA · {meetingName || "BEZ NÁZVU"}</span><h2 id="meeting-acceptance-title">Vaše odpověď</h2><p>Vyberte, zda se schůzky zúčastníte.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Zavřít"><X size={16}/></button></div>
      <div className="meeting-acceptance-options" role="group" aria-label="Možnosti odpovědi">
        {choices.map((choice) => <button key={choice.value} type="button" className={`meeting-acceptance-option ${choice.style} ${selected === choice.value ? "selected" : ""}`} aria-pressed={selected === choice.value} disabled={busy} onClick={() => void select(choice.value)}><span>{choice.label}</span>{selected === choice.value && <Check size={16}/>}</button>)}
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="modal-footer"><button type="button" className="button subtle" onClick={onClose} disabled={busy}>Zavřít</button></div>
    </section>
  </div>;
}
