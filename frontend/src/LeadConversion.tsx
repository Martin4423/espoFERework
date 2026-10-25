import { useState } from "react";
import { X } from "./Icons";
import { apiJson } from "./http.ts";
import { ApiError } from "./problem.ts";
import { canCreateEntity, entityLabel, request } from "./api";
import type { Metadata } from "./api";
import { t, useLocale } from "./i18n/index.ts";
import type { MessageKey } from "./i18n/index.ts";

type Row = Record<string, any>;
type Result = { leadId: string; accountId: string | null; contactId: string | null; dealId: string | null };

const TARGETS: Array<{ flag: "createAccount" | "createContact" | "createDeal"; scope: string; label: MessageKey; result: keyof Result; on: boolean }> = [
  { flag: "createAccount", scope: "Account", label: "convert.account", result: "accountId", on: true },
  { flag: "createContact", scope: "Contact", label: "convert.contact", result: "contactId", on: true },
  { flag: "createDeal", scope: "Deal", label: "convert.deal", result: "dealId", on: false },
];

// Converts a lead into an account, a contact and a deal (POST /v1/records/lead/{id}/convert).
export default function LeadConversion({ metadata, lead, onClose, onOpenRecord, onConverted }: { metadata: Metadata; lead: Row; onClose: () => void; onOpenRecord: (entity: string, row: Row) => void; onConverted: (record: Row) => void }) {
  useLocale();
  const offered = TARGETS.filter((target) => metadata.scopes?.[target.scope]?.entity && canCreateEntity(metadata, target.scope));
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(offered.map((target) => [target.flag, target.on])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const converted = String(lead.status) === "Converted";

  async function convert() {
    if (!offered.some((target) => selected[target.flag])) { setError(t("convert.pick")); return; }
    setBusy(true); setError("");
    try {
      const body = Object.fromEntries(TARGETS.map((target) => [target.flag, Boolean(selected[target.flag])]));
      setResult(await apiJson<Result>(`/v1/records/lead/${lead.id}/convert`, { method: "POST", body: JSON.stringify(body) }));
      onConverted(await request<Row>(`Lead/${encodeURIComponent(lead.id)}`));
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409 ? t("convert.already") : cause instanceof Error ? cause.message : t("error.generic", { status: 0 }));
    } finally { setBusy(false); }
  }

  async function open(scope: string, id: string) {
    onOpenRecord(scope, await request<Row>(`${scope}/${id}`));
    onClose();
  }

  return <div className="modal-backdrop lead-convert-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section className="record-modal lead-convert-modal" role="dialog" aria-modal="true" aria-label={t("convert.title")} data-testid="lead-convert">
      <div className="modal-heading"><div><span className="eyebrow">{entityLabel(metadata, "Lead")}</span><h2>{t("convert.title")}</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t("common.close")} disabled={busy}><X size={17} /></button></div>
      <div className="modal-fields" style={{ gridTemplateColumns: "1fr" }}>
        <p className="login-hint">{converted ? t("convert.already") : result ? t("convert.done") : t("convert.hint")}</p>
        {!result && !converted && offered.map((target) => <label key={target.flag} className="field-input checkbox-field"><span>
          <input type="checkbox" checked={Boolean(selected[target.flag])} onChange={(event) => setSelected((old) => ({ ...old, [target.flag]: event.target.checked }))} /> {t(target.label)}</span></label>)}
        {result && TARGETS.filter((target) => result[target.result]).map((target) => <button key={target.flag} type="button" className="button subtle" onClick={() => void open(target.scope, result[target.result] as string)}>{t("convert.open")}: {entityLabel(metadata, target.scope)}</button>)}
        {error && <div className="inline-error" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="button subtle" onClick={onClose} disabled={busy}>{result ? t("common.close") : t("common.cancel")}</button>
        {!result && !converted && <button type="button" className="button primary" onClick={() => void convert()} disabled={busy}>{busy ? t("convert.busy") : t("convert.submit")}</button>}
      </div>
    </section>
  </div>;
}
