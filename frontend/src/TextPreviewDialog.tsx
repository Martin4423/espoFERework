import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { X } from "./Icons";

/** Markdown preview matching EspoCRM complexText sanitization and link behavior. */
export default function TextPreviewDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const html = useMemo(() => {
    const clean = DOMPurify.sanitize(marked.parse(text || "") as string, {});
    const template = document.createElement("template");
    template.innerHTML = clean;
    template.content.querySelectorAll("a[href]").forEach((link) => { link.setAttribute("target", "_blank"); link.setAttribute("rel", "noopener noreferrer"); });
    return template.innerHTML;
  }, [text]);
  return <div className="modal-backdrop text-preview-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="text-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="text-preview-title"><header><div><span className="eyebrow">POLE TEXT</span><h2 id="text-preview-title">Náhled</h2></div><button type="button" className="icon-button" aria-label="Zavřít náhled" onClick={onClose}><X size={16}/></button></header><article className="complex-text" dangerouslySetInnerHTML={{ __html: html }}/></section></div>;
}
