import { Lock } from "lucide-react";
import { t, useLocale } from "./i18n/index.ts";

// The notice for everything the ViaCRM backend does not offer yet.
export function NotAvailable({ title }: { title?: string }) {
  useLocale();
  return <section className="surface not-available" data-testid="not-available" role="status">
    <Lock size={28} aria-hidden="true" />
    {title && <h2>{title}</h2>}
    <b>{t("unsupported.title")}</b>
    <p>{t("unsupported.body")}</p>
  </section>;
}
