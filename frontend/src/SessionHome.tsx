import { LogOut } from "lucide-react";
import type { User } from "./api";
import { t, useLocale } from "./i18n/index.ts";

// Interim screen after sign-in, until the workspace is connected to the ViaCRM metadata (step S2).
export function SessionHome({ user, onLogout }: { user: User; onLogout: () => void }) {
  useLocale();
  const role = user.type === "admin" ? t("home.role.admin") : t("home.role.regular");
  return <main className="boot-screen" data-testid="session-home">
    <div className="brand-mark">V</div>
    <h2>{t("home.signedInAs", { name: user.name })}</h2>
    <p>{user.email} · {role}</p>
    <p>{t("home.interim")}</p>
    <button className="button" onClick={onLogout} data-testid="logout"><LogOut size={16} /> {t("common.logout")}</button>
  </main>;
}
