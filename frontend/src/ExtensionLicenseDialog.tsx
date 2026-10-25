import DOMPurify from "dompurify";
import { marked } from "marked";
import { AlertTriangle, Check } from "./Icons";
import { useDialogFocus } from "./useDialogFocus";

type ExtensionStatus = { name: string; licenseStatus?: string; licenseStatusMessage?: string; notify?: boolean };

function statusKey(status: string) {
  const camel = status.toLowerCase().replace(/[^a-z0-9]+([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
  return `extensionLicense${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

export default function ExtensionLicenseDialog({ extensions, messages, onClose }: { extensions: ExtensionStatus[]; messages: Record<string, string>; onClose: () => void }) {
  const dialogRef = useDialogFocus<HTMLElement>(onClose, true);
  const notices = extensions.filter((extension) => extension.notify).map((extension) => {
    const template = extension.licenseStatusMessage || messages[statusKey(String(extension.licenseStatus || ""))] || "Stav licence rozšíření vyžaduje vaši pozornost.";
    const html = DOMPurify.sanitize(marked.parse(template.replaceAll("{name}", extension.name)) as string, { USE_PROFILES: { html: true } });
    return { name: extension.name, html };
  });
  if (!notices.length) return null;

  return <div className="required-two-factor-backdrop extension-license-backdrop"><section ref={dialogRef} className="record-modal extension-license-dialog" role="alertdialog" aria-modal="true" aria-labelledby="extension-license-title" aria-describedby="extension-license-description" tabIndex={-1}><header className="extension-license-heading"><span><AlertTriangle size={18}/></span><div><div className="eyebrow">STAV ROZŠÍŘENÍ</div><h2 id="extension-license-title">Zkontrolujte licence rozšíření</h2><p id="extension-license-description">Některá rozšíření upozorňují na problém s licencí.</p></div></header><div className="extension-license-list">{notices.map((notice, index) => <article key={`${notice.name}-${index}`}><strong>{notice.name}</strong><div className="complex-text" dangerouslySetInnerHTML={{ __html: notice.html }}/></article>)}</div><footer className="modal-footer"><button type="button" autoFocus className="button primary" onClick={onClose}><Check size={14}/>Rozumím</button></footer></section></div>;
}
