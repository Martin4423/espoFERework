import { useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { publicJson, useBranding } from "./public/client.ts";
import { T, useLocale } from "./i18n/index.ts";

// "About": the installation's name and whether the server answers.
export default function AboutDialog({ onClose }: { onClose: () => void }) {
  useLocale();
  const branding = useBranding();
  const dialogRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");
  useEffect(() => {
    dialogRef.current?.focus();
    let live = true;
    publicJson("/v1/health").then(() => { if (live) setStatus("ok"); }).catch(() => { if (live) setStatus("down"); });
    return () => { live = false; };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="record-modal about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" tabIndex={-1}>
      <div className="modal-heading"><div><span className="eyebrow">{T("INFORMACE", "INFORMATION")}</span><h2 id="about-title">{T("O aplikaci", "About")}</h2></div><button className="icon-button" type="button" aria-label={T("Zavřít", "Close")} onClick={onClose}><X size={16} /></button></div>
      <div className="about-content"><div className="about-brand-mark"><Info size={22} /></div><div><strong>{branding.appName}</strong><span>{status === "checking" ? T("Kontroluji server…", "Checking the server…") : status === "ok" ? T("Server odpovídá.", "The server is responding.") : T("Server neodpovídá.", "The server is not responding.")}</span></div></div>
      <div className="modal-actions"><button className="button primary" type="button" onClick={onClose}>{T("Zavřít", "Close")}</button></div>
    </section>
  </div>;
}
