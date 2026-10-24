import { useEffect, useState } from "react";
import { ExternalLink, Info, X } from "./Icons";
import { request } from "./api";
import { useDialogFocus } from "./useDialogFocus";

type AboutInfo = { version?: string; text?: string };

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialogFocus<HTMLElement>(onClose);
  const [info, setInfo] = useState<AboutInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    request<AboutInfo>("App/about").then((result) => { if (live) setInfo(result); })
      .catch(() => { if (live) setError("Informace o aplikaci se nepodařilo načíst."); });
    return () => { live = false; };
  }, []);

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="record-modal about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" tabIndex={-1}>
      <div className="modal-heading"><div><span className="eyebrow">INFORMACE</span><h2 id="about-title">O aplikaci</h2></div><button className="icon-button" type="button" aria-label="Zavřít" onClick={onClose}><X size={16}/></button></div>
      <div className="about-content"><div className="about-brand-mark"><Info size={22}/></div><div><strong>EspoCRM</strong><span>{error || (info ? `Verze ${info.version || "—"}` : "Načítám informace o verzi…")}</span></div></div>
      {info?.text && <p className="about-description">{info.text}</p>}
      <div className="about-footer"><span>Rozhraní ViaCRM</span><a href="https://www.espocrm.com/" target="_blank" rel="noreferrer">EspoCRM <ExternalLink size={13}/></a></div>
      <div className="modal-actions"><button className="button primary" type="button" onClick={onClose}>Zavřít</button></div>
    </section>
  </div>;
}
