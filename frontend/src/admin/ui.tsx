import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { ApiError, fieldErrorsText } from "../problem.ts";
import { T, useLocale } from "../i18n/index.ts";

// A small kit for the administration screens: the same look as the rest of the application.

export function useAsync<D>(load: () => Promise<D>, deps: unknown[]) {
  const [data, setData] = useState<D | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  const reload = useCallback(async () => {
    const id = ++run.current;
    setLoading(true); setError("");
    try { const value = await load(); if (id === run.current) setData(value); }
    catch (cause) { if (id === run.current) setError(describe(cause)); }
    finally { if (id === run.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

// The sentence for a failed call: refused fields by name when the backend names them, else the plain message.
export function describe(cause: unknown, label: (field: string) => string = (field) => field): string {
  if (cause instanceof ApiError && cause.errors.length) return fieldErrorsText(cause, label);
  return cause instanceof Error ? cause.message : T("Operace se nezdařila.", "The operation failed.");
}

export function AdminPage({ title, subtitle, onBack, actions, children, testId }: { title: string; subtitle?: string; onBack?: () => void; actions?: ReactNode; children: ReactNode; testId?: string }) {
  useLocale();
  return <div className="admin-view" data-testid={testId}>
    <div className="entity-heading">
      <div>
        {onBack && <button type="button" className="button subtle" onClick={onBack}><ArrowLeft size={14} /> {T("Administrace", "Administration")}</button>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="admin-actions">{actions}</div>}
    </div>
    {children}
  </div>;
}

export function Banner({ text, tone = "error" }: { text: string; tone?: "error" | "ok" }) {
  if (!text) return null;
  return <div className={tone === "ok" ? "inline-notice" : "inline-error"} role={tone === "ok" ? "status" : "alert"}>{text}</div>;
}

export function Dialog({ title, onClose, children, footer, busy = false, testId, wide = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; busy?: boolean; testId?: string; wide?: boolean }) {
  useLocale();
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section className="record-modal admin-dialog" role="dialog" aria-modal="true" aria-label={title} data-testid={testId} style={wide ? { width: "min(920px, calc(100vw - 32px))" } : undefined}>
      <div className="modal-heading"><div><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={T("Zavřít", "Close")} disabled={busy}><X size={17} /></button></div>
      <div className="modal-fields" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </section>
  </div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field-input"><span>{label}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>;
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return <div className="table-wrap"><table>
    <thead><tr>{head.map((name, index) => <th key={`${name}-${index}`}>{name}</th>)}</tr></thead>
    <tbody>{children || <tr><td colSpan={head.length} className="muted-cell">{empty}</td></tr>}</tbody>
  </table></div>;
}

export function Busy({ text }: { text?: string }) {
  return <div className="table-loading"><span className="spinner" /> {text ?? T("Načítám…", "Loading…")}</div>;
}
