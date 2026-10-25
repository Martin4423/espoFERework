import { t } from "./i18n/index.ts";
import { cs } from "./i18n/cs.ts";
import { en } from "./i18n/en.ts";

// What the ViaCRM backend does not offer yet. One place decides what the navigation locks and the screens explain.
// Entities of the previous backend that have no counterpart (a customer may still know them from the old system):
export const UNSUPPORTED_SCOPES: ReadonlyArray<{ scope: string; icon: string; label: { cs: string; en: string } }> = [
  { scope: "Email", icon: "fas fa-envelope", label: { cs: "E-maily", en: "E-mail" } },
  { scope: "Case", icon: "fas fa-headset", label: { cs: "Požadavky", en: "Cases" } },
  { scope: "Campaign", icon: "fas fa-bullhorn", label: { cs: "Kampaně", en: "Campaigns" } },
  { scope: "Document", icon: "fas fa-file-alt", label: { cs: "Dokumenty", en: "Documents" } },
  { scope: "KnowledgeBaseArticle", icon: "fas fa-book", label: { cs: "Znalostní báze", en: "Knowledge base" } },
  { scope: "TargetList", icon: "fas fa-crosshairs", label: { cs: "Cílové seznamy", en: "Target lists" } },
];

export function isUnsupportedScope(scope: string): boolean {
  return UNSUPPORTED_SCOPES.some((item) => item.scope === scope);
}

export function unsupportedTitle(): string { return t("unsupported.title"); }

// The notice text in every language (used to recognise it in the page).
export const UNSUPPORTED_TITLES: ReadonlySet<string> = new Set([cs["unsupported.title"], en["unsupported.title"]]);
