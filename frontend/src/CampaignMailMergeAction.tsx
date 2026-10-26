import { useMemo, useState } from "react";
import { Download, X } from "./Icons";
import { canAccessEntity, entityLabel, request, downloadAttachment } from "./api";
import type { Metadata } from "./api";

type Campaign = { id?: string; name?: string; type?: string; targetListsIds?: string[]; contactsTemplateId?: string; leadsTemplateId?: string; accountsTemplateId?: string; usersTemplateId?: string };
const recipientLinks = ["contacts", "leads", "accounts", "users"] as const;

export default function CampaignMailMergeAction({ campaign, metadata }: { campaign: Campaign; metadata: Metadata }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = useMemo(() => recipientLinks.flatMap((name) => {
    const templateId = campaign[`${name}TemplateId` as keyof Campaign];
    const targetEntity = metadata.entityDefs?.TargetList?.links?.[name]?.entity;
    if (!templateId || !targetEntity || !canAccessEntity(metadata, targetEntity)) return [];
    return [{ name, targetEntity, label: entityLabel(metadata, targetEntity, true) }];
  }), [campaign, metadata]);
  const available = Boolean(campaign.id) && campaign.type === "Mail" && Boolean(campaign.targetListsIds?.length) && options.length > 0;
  if (!available) return null;

  async function generate() {
    if (!link || busy || !campaign.id) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ id: string }>(`Campaign/${encodeURIComponent(campaign.id)}/generateMailMerge`, { method: "POST", body: JSON.stringify({ link }) });
      if (!result?.id) throw new Error("ViaCRM nevydalo PDF soubor ke stažení.");
      const safeName = (campaign.name || "kampan").replace(/[\\/:*?"<>|]+/g, "-").trim() || "kampan";
      await downloadAttachment(result.id, `${safeName}.pdf`);
      setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDF se nepodařilo vytvořit."); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" className="button subtle" onClick={() => { setLink(options[0]?.name || ""); setError(""); setOpen(true); }}><Download size={14}/> Vygenerovat PDF pro hromadnou korespondenci</button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setOpen(false)}><section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-merge-title">
      <div className="modal-heading"><div><span className="eyebrow">KAMPAŇ · PDF</span><h2 id="campaign-merge-title">Generovat PDF hromadné korespondence</h2><p>Vyberte skupinu příjemců, pro kterou je připravena šablona kampaně.</p></div><button type="button" className="icon-button" onClick={() => setOpen(false)} disabled={busy} aria-label="Zavřít"><X size={16}/></button></div>
      <label className="field-input"><span>Příjemci</span><select autoFocus value={link} onChange={(event) => setLink(event.target.value)}>{options.map((option) => <option key={option.name} value={option.name}>{option.label}</option>)}</select></label>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="modal-footer"><button type="button" className="button subtle" onClick={() => setOpen(false)} disabled={busy}>Zrušit</button><button type="button" className="button primary" onClick={() => void generate()} disabled={busy || !link}>{busy ? "Vytvářím PDF…" : "Vytvořit a stáhnout"}<Download size={14}/></button></div>
    </section></div>}
  </>;
}
