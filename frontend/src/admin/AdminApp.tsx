import { useState } from "react";
import { Lock, ShieldCheck, Users, UsersRound, Boxes, LayoutPanelTop, Workflow, FileInput, Palette, ClipboardList, type LucideIcon } from "lucide-react";
import { NotAvailable } from "../NotAvailable.tsx";
import { T, useLocale } from "../i18n/index.ts";
import UsersAdmin from "./UsersAdmin.tsx";
import TeamsAdmin from "./TeamsAdmin.tsx";
import RolesAdmin from "./RolesAdmin.tsx";
import SchemaAdmin from "./SchemaAdmin.tsx";
import LayoutsAdmin from "./LayoutsAdmin.tsx";
import WorkflowsAdmin from "./WorkflowsAdmin.tsx";
import ImportAdmin from "./ImportAdmin.tsx";
import BrandingAdmin from "./BrandingAdmin.tsx";
import LeadFormsAdmin from "./LeadFormsAdmin.tsx";
import { AdminPage } from "./ui.tsx";

type Section = "branding" | "leadForms" | "users" | "teams" | "roles" | "schema" | "layouts" | "workflows" | "import";
type Tile = { key: Section | "locked"; label: string; description: string; icon: LucideIcon; locked?: boolean };

export default function AdminApp({ currentUserId, onSchemaChanged }: { currentUserId: string; onSchemaChanged: () => void; extraTiles?: Array<{ key: string; label: string; description: string; icon: LucideIcon; render: (back: () => void) => React.ReactNode }> }) {
  useLocale();
  const [section, setSection] = useState<string | null>(null);
  const back = () => setSection(null);
  const groups: Array<{ title: string; tiles: Tile[] }> = [
    { title: T("Uživatelé a oprávnění", "Users and permissions"), tiles: [
      { key: "users", label: T("Uživatelé", "Users"), description: T("Účty, administrátoři, aktivace", "Accounts, admins, activation"), icon: Users },
      { key: "teams", label: T("Týmy", "Teams"), description: T("Skupiny uživatelů a členství", "User groups and members"), icon: UsersRound },
      { key: "roles", label: T("Role", "Roles"), description: T("Oprávnění k entitám, polím a funkcím", "Entity, field and feature permissions"), icon: ShieldCheck }] },
    { title: T("Přizpůsobení", "Customization"), tiles: [
      { key: "schema", label: T("Entity a pole", "Entities and fields"), description: T("Vlastní entity a pole", "Custom entities and fields"), icon: Boxes },
      { key: "layouts", label: T("Rozvržení", "Layouts"), description: T("Sloupce seznamu a sekce detailu", "List columns and detail sections"), icon: LayoutPanelTop }] },
    { title: T("Data a automatizace", "Data and automation"), tiles: [
      { key: "workflows", label: T("Automatizace", "Workflows"), description: T("Pravidla po změně záznamu", "Rules run when a record changes"), icon: Workflow },
      { key: "import", label: T("Import z CSV", "CSV import"), description: T("Nahrání záznamů ze souboru", "Load records from a file"), icon: FileInput }] },
    { title: T("Veřejné stránky a vzhled", "Public pages and look"), tiles: [
      { key: "branding", label: T("Vzhled a název", "Branding"), description: T("Název aplikace, logo, motiv", "Application name, logo, theme"), icon: Palette },
      { key: "leadForms", label: T("Formuláře pro leady", "Lead forms"), description: T("Veřejné formuláře vytvářející leady", "Public forms that create leads"), icon: ClipboardList }] },
    { title: T("Zatím ve ViaCRM není k dispozici", "Not yet available in ViaCRM"), tiles: [
      { key: "locked", label: T("E-mailové účty a šablony", "E-mail accounts and templates"), description: "", icon: Lock, locked: true },
      { key: "locked", label: T("Portály a integrace", "Portals and integrations"), description: "", icon: Lock, locked: true },
      { key: "locked", label: T("Rozšíření a aktualizace", "Extensions and upgrades"), description: "", icon: Lock, locked: true }] },
  ];
  switch (section) {
    case "users": return <UsersAdmin onBack={back} currentUserId={currentUserId} />;
    case "teams": return <TeamsAdmin onBack={back} />;
    case "roles": return <RolesAdmin onBack={back} />;
    case "schema": return <SchemaAdmin onBack={back} onSchemaChanged={onSchemaChanged} />;
    case "layouts": return <LayoutsAdmin onBack={back} onSchemaChanged={onSchemaChanged} />;
    case "workflows": return <WorkflowsAdmin onBack={back} />;
    case "branding": return <BrandingAdmin onBack={back} />;
    case "leadForms": return <LeadFormsAdmin onBack={back} />;
    case "import": return <ImportAdmin onBack={back} onImported={() => undefined} />;
    case "locked": return <AdminPage title={T("Administrace", "Administration")} onBack={back}><NotAvailable /></AdminPage>;
  }
  return <AdminPage title={T("Administrace", "Administration")} subtitle={T("Správa uživatelů, přizpůsobení a dat ViaCRM.", "Manage ViaCRM users, customization and data.")} testId="admin-hub">
    {groups.map((group) => <section key={group.title} className="admin-group"><h2>{group.title}</h2>
      <div className="admin-tiles">{group.tiles.map((tile) => { const Icon = tile.icon; return <button type="button" key={tile.label} className={`admin-tile${tile.locked ? " locked" : ""}`} onClick={() => setSection(tile.key)}><Icon size={20} aria-hidden="true" /><b>{tile.label}</b>{tile.description && <small>{tile.description}</small>}</button>; })}</div></section>)}
  </AdminPage>;
}
