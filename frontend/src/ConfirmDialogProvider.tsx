import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "./Icons";
import { useDialogFocus } from "./useDialogFocus";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  eyebrow?: string;
};
type Request = { id: number; options: ConfirmOptions; resolve: (confirmed: boolean) => void };
type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Request | null>(null);
  const activeRef = useRef<Request | null>(null);
  const queueRef = useRef<Request[]>([]);
  const nextIdRef = useRef(0);
  const advance = useCallback(() => {
    const next = queueRef.current.shift() || null;
    activeRef.current = next;
    setActive(next);
  }, []);
  const finish = useCallback((confirmed: boolean) => {
    const current = activeRef.current;
    if (!current) return;
    activeRef.current = null;
    current.resolve(confirmed);
    advance();
  }, [advance]);
  const confirm = useCallback<ConfirmContextValue>((options) => new Promise((resolve) => {
    const request: Request = { id: ++nextIdRef.current, options, resolve };
    if (activeRef.current) queueRef.current.push(request);
    else { activeRef.current = request; setActive(request); }
  }), []);
  const dialogRef = useDialogFocus<HTMLElement>(() => finish(false), true, active?.id || false);

  return <ConfirmContext.Provider value={confirm}>{children}{active && <div className="modal-backdrop confirm-system-backdrop" onMouseDown={(event) => event.target === event.currentTarget && finish(false)}><section ref={dialogRef} className={`record-modal confirm-system-dialog ${active.options.tone === "danger" ? "is-danger" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-system-title" aria-describedby="confirm-system-description" tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">{active.options.eyebrow || "POTVRZENÍ AKCE"}</span><h2 id="confirm-system-title">{active.options.title}</h2><p id="confirm-system-description">{active.options.message}</p></div><button type="button" className="icon-button" aria-label="Zrušit akci" onClick={() => finish(false)}><X size={16}/></button></div><div className="confirm-system-impact"><span><AlertTriangle size={15}/></span><small>{active.options.tone === "danger" ? "Tuto akci nelze vzít zpět." : "Před pokračováním zkontrolujte vybranou akci."}</small></div><div className="modal-footer"><button type="button" autoFocus className="button subtle" onClick={() => finish(false)}>{active.options.cancelLabel || "Zrušit"}</button><button type="button" className={`button ${active.options.tone === "danger" ? "danger" : "primary"}`} onClick={() => finish(true)}>{active.options.confirmLabel || "Pokračovat"}</button></div></section></div>}</ConfirmContext.Provider>;
}

export function useConfirmDialog() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirmDialog must be used inside ConfirmDialogProvider.");
  return confirm;
}
