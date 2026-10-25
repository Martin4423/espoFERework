import { useEffect, useRef } from "react";

/** Keeps keyboard focus inside a dialog and returns it to the opener when closed. */
export function useDialogFocus<T extends HTMLElement>(onEscape?: () => void, canEscape = true, active = true) {
  const dialogRef = useRef<T>(null);
  const onEscapeRef = useRef(onEscape);
  const canEscapeRef = useRef(canEscape);
  onEscapeRef.current = onEscape;
  canEscapeRef.current = canEscape;

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusInitial = () => {
      const initial = dialog?.querySelector<HTMLElement>("[autofocus], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])");
      initial?.focus();
    };
    const frame = window.requestAnimationFrame(focusInitial);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canEscapeRef.current) { event.preventDefault(); onEscapeRef.current?.(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((item) => item.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown); returnFocus?.focus(); };
  }, [active]);

  return dialogRef;
}
