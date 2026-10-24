import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentType, CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Activity, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, ArrowUpDown, AtSign, Banknote, Bell, BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, Database, ExternalLink, FileInput, FileKey, FileSpreadsheet, FileText, Folder, Globe, History, Inbox as InboxIcon, Languages, LayoutDashboard, Link2, Mail, MapPin, Menu, Network, Package, Paperclip, Phone, Pencil, Plus, RefreshCw, Reply, ReplyAll, Save, Search, Send, Settings, Shield, SlidersHorizontal, Star, Target, Trash2, WandSparkles, UserRound, Users, Webhook, Workflow, X, KeyRound, Monitor, LogIn, Upload, Server, List, Brush, Wrench, Table2, SendHorizontal, Filter, ContactRound, Flag, Share2, Code2, Eye, EyeSlash, type LucideIcon } from "./Icons";
import LinkMultipleDisplay from "./LinkMultipleDisplay";
import { phoneCountryLabels, phoneCountryOptions } from "./phoneCountries";
import DOMPurify from "dompurify";
import cronstrue from "cronstrue";
import "cronstrue/locales/cs";
import EspoIcon from "./EspoIcon";
import type { KanbanGroup, KanbanLayoutItem } from "./KanbanBoard";
import { conditionGroupMatches } from "./dynamicLogicRuntime";
import { portalEntities } from "./portalEntities";
import { dateFilterBoundaryInTimeZone, espocrmDateTimeFromInput, formatEspoDateTime, formatEspoDateTimeInput } from "./timeZone";
import { ApiError, aclLevel, canAccessEntity, canChangeEntity, canCreateEntity, canUsePermission, completeSecondStepLogin, downloadAttachment, entityLabel, entityList, fetchLayout, fetchMetadata, fieldLabel, getEditorFields, getFormFields, getListFields, getSession, login, logout, request, restoreSession, uploadAttachment } from "./api";
import type { DetailLayoutPanel, FieldDef, LayoutItem, Metadata, PendingSecondStep, Session, User } from "./api";

const ImportCenter = lazy(() => import("./ImportCenter"));
const PortalHome = lazy(() => import("./PortalHome"));
const RecordStream = lazy(() => import("./RecordStream"));
const RecordRelationships = lazy(() => import("./RecordRelationships"));
const WysiwygEditor = lazy(() => import("./WysiwygEditor"));
function lazyWithFallback<Props extends object>(loader: () => Promise<{ default: ComponentType<Props> }>) {
  const Component = lazy(loader);
  return function LazyFeature(props: Props) {
    return <Suspense fallback={<div className="table-loading lazy-chunk-loading" role="status"><span className="spinner"/>Načítám funkci…</div>}><Component {...props}/></Suspense>;
  };
}
const OAuthConnectionPanel = lazyWithFallback(() => import("./OAuthConnectionPanel"));
const DashboardTemplateDeploy = lazyWithFallback(() => import("./DashboardTemplateDeploy"));
const CampaignMailMergeAction = lazyWithFallback(() => import("./CampaignMailMergeAction"));
const SaveConflictDialog = lazyWithFallback(() => import("./SaveConflictDialog"));
const DuplicateCheckDialog = lazyWithFallback(() => import("./DuplicateCheckDialog"));
const CurrencyConversionDialog = lazyWithFallback(() => import("./CurrencyConversionDialog"));
const ImagePreviewDialog = lazyWithFallback(() => import("./ImagePreviewDialog"));
const ImageCropDialog = lazyWithFallback(() => import("./ImageCropDialog"));
const MeetingAcceptanceDialog = lazyWithFallback(() => import("./MeetingAcceptanceDialog"));
const MeetingInvitationDialog = lazyWithFallback(() => import("./MeetingInvitationDialog"));
const SelectRecordsDialog = lazyWithFallback(() => import("./SelectRecordsDialog"));
const TextPreviewDialog = lazyWithFallback(() => import("./TextPreviewDialog"));
const CategoryTreeDialog = lazyWithFallback(() => import("./CategoryTreeDialog"));
const CategoryNavigation = lazyWithFallback(() => import("./CategoryNavigation"));
const OAuthAuthorizationParams = lazyWithFallback(() => import("./OAuthAuthorizationParams"));
const AdminTabListEditor = lazyWithFallback(() => import("./AdminTabListEditor"));
const AdminUserLoginHistory = lazyWithFallback(() => import("./AdminUserLoginHistory"));
const MergeRecordsDialog = lazyWithFallback(() => import("./MergeRecordsDialog"));
const PersonalDataDialog = lazyWithFallback(() => import("./PersonalDataDialog"));
const FollowersDialog = lazyWithFallback(() => import("./FollowersDialog"));
const MeetingScheduler = lazyWithFallback(() => import("./MeetingScheduler"));
const AttachmentCenter = lazy(() => import("./AttachmentCenter"));
const ExportDialog = lazy(() => import("./ExportDialog"));
const LastViewedView = lazy(() => import("./LastViewedView"));
const ActionHistoryCenter = lazy(() => import("./ActionHistoryCenter"));
const AdminFieldManager = lazy(() => import("./AdminFieldManager"));
const AdminLayoutManager = lazy(() => import("./AdminLayoutManager"));
const AdminSystemTools = lazy(() => import("./AdminSystemTools"));
const AdminEntityManager = lazy(() => import("./AdminEntityManager"));
const AdminLinkManager = lazy(() => import("./AdminLinkManager"));
const AdminLabelManager = lazy(() => import("./AdminLabelManager"));
const KanbanBoard = lazy(() => import("./KanbanBoard"));
const ActivityView = lazy(() => import("./SocialViews").then((module) => ({ default: module.ActivityView })));
const GlobalStreamView = lazy(() => import("./SocialViews").then((module) => ({ default: module.GlobalStreamView })));
const NotificationCenter = lazy(() => import("./SocialViews").then((module) => ({ default: module.NotificationCenter })));
const PopupReminderToasts = lazy(() => import("./PopupReminderToasts"));
const NotificationPanel = lazy(() => import("./SocialViews").then((module) => ({ default: module.NotificationPanel })));
const UserPreferencesView = lazy(() => import("./UserAccount").then((module) => ({ default: module.UserPreferencesView })));
const UserSecurityView = lazy(() => import("./UserAccount").then((module) => ({ default: module.UserSecurityView })));
const PersonalDashboard = lazy(() => import("./PersonalDashboard"));
const DashboardLayoutEditor = lazy(() => import("./DashboardLayoutEditor"));
const AdminExtensions = lazy(() => import("./AdminPackages").then((module) => ({ default: module.AdminExtensions })));
const AdminUpgrade = lazy(() => import("./AdminPackages").then((module) => ({ default: module.AdminUpgrade })));
const AdminIntegrations = lazy(() => import("./AdminIntegrations"));
const AdminFormulaSandbox = lazy(() => import("./AdminFormulaSandbox"));
const AdminTemplateManager = lazy(() => import("./AdminTemplateManager"));
const AdminAuthTokens = lazy(() => import("./AdminAuthTokens"));

type Row = Record<string, any>;
type AddressParts = { street?: string; city?: string; state?: string; postalCode?: string; country?: string };
type PageResult = { list: Row[]; total: number };
type FilterCondition = { field: string; operator: string; value: string | string[]; valueTo?: string; valueNames?: Record<string, string> };
type SaveConflictField = { name: string; label: string; current: unknown; actual: unknown; original: unknown };
type PortalBranding = { name?: string; applicationName?: string; companyLogoId?: string; theme?: string; themeParams?: { navbar?: string } };

let googleMapsApiPromise: Promise<void> | null = null;
function loadGoogleMapsApi(apiKey: string): Promise<void> {
  const google = (window as any).google;
  if (google?.maps?.Geocoder) return Promise.resolve();
  if (googleMapsApiPromise) return googleMapsApiPromise;
  googleMapsApiPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({ callback: "__viaGoogleMapsLoaded", loading: "async", v: "weekly", libraries: "marker" });
    if (apiKey) params.set("key", apiKey);
    (window as any).__viaGoogleMapsLoaded = () => resolve();
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true; script.onerror = () => reject(new Error("Google Maps se nepodařilo načíst."));
    document.head.appendChild(script);
  }).catch((error) => { googleMapsApiPromise = null; throw error; });
  return googleMapsApiPromise;
}

function addressText(address: AddressParts): string {
  return [address.street, address.city, address.state, address.postalCode, address.country].map((part) => String(part || "").trim()).filter(Boolean).join(", ");
}

function remapAuthenticationProviderLogic(value: any): any {
  if (Array.isArray(value)) return value.map(remapAuthenticationProviderLogic);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "attribute" && item === "authenticationMethod" ? "method" : remapAuthenticationProviderLogic(item)]));
}

function authenticationProviderLayout(metadata: Metadata, entity: string, methodName: string, values: Row = {}): DetailLayoutPanel | null {
  if (entity !== "AuthenticationProvider" || !methodName) return null;
  const methods = (metadata as any).authenticationMethods || {};
  const method = methods[methodName];
  if (!method?.provider?.isAvailable) return null;
  const provider = method.provider || {};
  const layout = provider.layout || method.settings?.layout;
  if (!layout?.rows) return null;
  const entityFields = metadata.entityDefs?.[entity]?.fields || {};
  const fieldList: string[] = provider.fieldList || method.settings?.fieldList || [];
  const dynamicFields = (provider.dynamicLogic || method.settings?.dynamicLogic || {}).fields || {};
  const rows = layout.rows.map((row: LayoutItem[]) => row.map((item) => {
    if (!item || typeof item !== "object" || !item.name) return item;
    if (!entityFields[item.name]) return false;
    const visibility = fieldList.includes(item.name) ? dynamicFields[item.name]?.visible : undefined;
    if (visibility?.conditionGroup && !conditionGroupMatches(remapAuthenticationProviderLogic(visibility), values)) return false;
    return item;
  }));
  return { ...layout, label: layout.label || methodName, tabBreak: true, tabLabel: layout.label || methodName, rows };
}


function GoogleAddressMap({ address, apiKey, mapId, height }: { address: AddressParts; apiKey: string; mapId: string; height?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Načítám mapu…");
  useEffect(() => {
    let cancelled = false;
    let marker: any;
    if (!address.city && !address.postalCode) {
      setStatus("Pro zobrazení mapy doplňte město nebo PSČ.");
      return () => { cancelled = true; };
    }
    setStatus("Načítám mapu…");
    loadGoogleMapsApi(apiKey).then(() => {
      if (cancelled || !containerRef.current) return;
      const maps = (window as any).google.maps;
      const map = new maps.Map(containerRef.current, { zoom: 15, center: { lat: 0, lng: 0 }, scrollwheel: false, mapId: mapId || "DEMO_MAP_ID" });
      const geocoder = new maps.Geocoder();
      geocoder.geocode({ address: addressText(address) }, (results: any[], resultStatus: string) => {
        if (cancelled) return;
        if (resultStatus !== "OK" || !results?.[0]?.geometry?.location) { setStatus("Adresu se nepodařilo na mapě najít."); return; }
        const location = results[0].geometry.location;
        map.setCenter(location);
        marker = maps.marker?.AdvancedMarkerElement ? new maps.marker.AdvancedMarkerElement({ map, position: location }) : new maps.Marker({ map, position: location });
        setStatus("");
      });
    }).catch((error) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "Mapu se nepodařilo otevřít."); });
    return () => { cancelled = true; if (marker?.setMap) marker.setMap(null); else if (marker) marker.map = null; };
  }, [address, apiKey, mapId]);
  return <div className="address-map-frame" style={height ? { height: `${height}px` } : undefined}><div className="address-map-canvas" ref={containerRef}/>{status && <div className="address-map-status"><span>{status}</span></div>}</div>;
}

const portalThemeColors: Record<string, Record<string, string>> = {
  Dark: { primary: "#486581", primaryDark: "#38516a", nav: "#23262a", canvas: "#18191d", surface: "#23262a", ink: "#dbdbdb", line: "#383b40" },
  Light: { primary: "#6f94d7", primaryDark: "#5d7fbd", nav: "#ffffff", canvas: "#fcfcfc", surface: "#ffffff", ink: "#0f0f0f", line: "#e5e7eb" },
  Espo: { primary: "#6092d0", primaryDark: "#487bb8", nav: "#19243c", canvas: "#f1f3f5", surface: "#ffffff", ink: "#333333", line: "#e3e6e9" },
  EspoRtl: { primary: "#6092d0", primaryDark: "#487bb8", nav: "#19243c", canvas: "#f1f3f5", surface: "#ffffff", ink: "#333333", line: "#e3e6e9" },
  Sakura: { primary: "#6490b7", primaryDark: "#4f789d", nav: "#956289", canvas: "#eef1fc", surface: "#ffffff", ink: "#424242", line: "#e2dce8" },
  Violet: { primary: "#768ed2", primaryDark: "#5f76b7", nav: "#8d6199", canvas: "#d9e1ed", surface: "#ffffff", ink: "#424242", line: "#ddd7e5" },
  Hazyblue: { primary: "#537898", primaryDark: "#42647f", nav: "#5b7384", canvas: "#e5e9eb", surface: "#ffffff", ink: "#333333", line: "#d5dcdf" },
  Glass: { primary: "#788bb8", primaryDark: "#6578a4", nav: "#14141482", canvas: "#483f57", surface: "#2424246b", ink: "#dbdbdb", line: "#ffffff30" },
};

async function fetchPortalBranding(): Promise<PortalBranding | null> {
  const params = new URLSearchParams({ path: window.location.pathname, host: window.location.hostname });
  try {
    const response = await fetch(`/api/v1/Portal/publicBranding?${params}`);
    if (!response.ok) return null;
    const data = await response.json() as PortalBranding;
    return data?.name || data?.applicationName ? data : null;
  } catch { return null; }
}

function formFieldValueFromRecord(name: string, def: FieldDef, record: Row): unknown {
  if (def.type === "duration" && def.start && def.end && record[def.start] && record[def.end]) {
    const start = new Date(String(record[def.start]).replace(" ", "T")).getTime();
    const end = new Date(String(record[def.end]).replace(" ", "T")).getTime();
    if (Number.isFinite(start) && Number.isFinite(end)) return Math.max(0, (end - start) / 1000);
  }
  if (def.type === "link" || def.type === "linkOne") return record[`${name}Id`] || "";
  if (def.type === "linkMultiple") return record[`${name}Ids`] || [];
  if (def.type === "linkParent") return { type: record[`${name}Type`] || "", id: record[`${name}Id`] || "" };
  if (def.type === "personName") return { firstName: record.firstName || "", middleName: record.middleName || "", lastName: record.lastName || "" };
  if (def.type === "address") return Object.fromEntries(["street", "city", "state", "postalCode", "country"].map((part) => [part, record[`${name}${part[0].toUpperCase()}${part.slice(1)}`] || ""]));
  if (def.type === "file" || def.type === "image") return record[`${name}Id`] ? { id: record[`${name}Id`], name: record[`${name}Name`] || "Soubor" } : null;
  if (def.type === "attachmentMultiple") return (record[`${name}Ids`] || []).map((id: string) => ({ id, name: record[`${name}Names`]?.[id] || id, type: record[`${name}Types`]?.[id] || "" }));
  return record[name];
}

function primaryLinkForField(entity: string, name: string, def: FieldDef) {
  return def.primaryLink || (entity === "Contact" && name === "accounts" ? "account" : "");
}

function valuesFromRecordFields(entity: string, fields: [string, FieldDef][], record: Row): Row {
  const result: Row = { ...record };
  for (const [name, def] of fields) {
    result[name] = formFieldValueFromRecord(name, def, record);
    if (def.type === "linkMultiple" && def.columns) result[`${name}Columns`] = record[`${name}Columns`] || {};
    const primaryLink = primaryLinkForField(entity, name, def);
    if (def.type === "linkMultiple" && primaryLink) {
      result[`${primaryLink}Id`] = record[`${primaryLink}Id`] || "";
      result[`${primaryLink}Name`] = record[`${primaryLink}Name`] || "";
    }
  }
  return result;
}

function fieldAttributeList(entity: string, name: string, def: FieldDef): string[] {
  if (["email", "phone"].includes(def.type || "")) return [name, `${name}Data`, `${name}IsOptedOut`, `${name}IsInvalid`];
  if (def.type === "currency") return [name, `${name}Currency`];
  if (def.type === "duration") return [String(def.start || ""), String(def.end || "")].filter(Boolean);
  if (def.type === "personName") return ["firstName", "middleName", "lastName"];
  if (def.type === "address") return ["street", "city", "state", "postalCode", "country"].map((part) => `${name}${part[0].toUpperCase()}${part.slice(1)}`);
  if (def.type === "link" || def.type === "linkOne") return [`${name}Id`];
  if (def.type === "linkMultiple") { const primaryLink = primaryLinkForField(entity, name, def); return [`${name}Ids`, `${name}Columns`, ...(primaryLink ? [`${primaryLink}Id`, `${primaryLink}Name`] : [])]; }
  if (def.type === "linkParent") return [`${name}Type`, `${name}Id`];
  if (def.type === "file" || def.type === "image") return [`${name}Id`, `${name}Name`];
  if (def.type === "attachmentMultiple") return [`${name}Ids`, `${name}Names`, `${name}Types`];
  return [name];
}

function attributesFromFormField(entity: string, name: string, def: FieldDef, values: Row): Row {
  const value = values[name];
  if (["email", "phone"].includes(def.type || "")) return { [name]: value || null, [`${name}Data`]: values[`${name}Data`] || [], [`${name}IsOptedOut`]: values[`${name}IsOptedOut`] ?? false, [`${name}IsInvalid`]: values[`${name}IsInvalid`] ?? false };
  if (def.type === "currency") return { [name]: value == null || value === "" ? null : Number(value), [`${name}Currency`]: values[`${name}Currency`] || null };
  if (def.type === "duration") return { ...(def.start ? { [def.start]: values[def.start] ?? null } : {}), ...(def.end ? { [def.end]: values[def.end] ?? null } : {}) };
  if (def.type === "personName") return { firstName: value?.firstName || "", middleName: value?.middleName || "", lastName: value?.lastName || "" };
  if (def.type === "address") return Object.fromEntries(["street", "city", "state", "postalCode", "country"].map((part) => [`${name}${part[0].toUpperCase()}${part.slice(1)}`, value?.[part] || ""]));
  if (def.type === "link" || def.type === "linkOne") return { [`${name}Id`]: value || null };
  if (def.type === "linkMultiple") { const primaryLink = primaryLinkForField(entity, name, def); return { [`${name}Ids`]: Array.isArray(value) ? value : [], [`${name}Columns`]: values[`${name}Columns`] || {}, ...(primaryLink ? { [`${primaryLink}Id`]: values[`${primaryLink}Id`] || null, [`${primaryLink}Name`]: values[`${primaryLink}Name`] || null } : {}) }; }
  if (def.type === "linkParent") return { [`${name}Type`]: value?.type || null, [`${name}Id`]: value?.id || null };
  if (def.type === "file" || def.type === "image") return { [`${name}Id`]: value?.id || null, [`${name}Name`]: value?.name || null };
  if (def.type === "attachmentMultiple") return { [`${name}Ids`]: (value || []).map((item: Row) => item.id), [`${name}Names`]: Object.fromEntries((value || []).map((item: Row) => [item.id, item.name])), [`${name}Types`]: Object.fromEntries((value || []).map((item: Row) => [item.id, item.type || ""])) };
  return { [name]: value ?? null };
}

function conflictDisplayValue(name: string, def: FieldDef, record: Row): unknown {
  const value = formFieldValueFromRecord(name, def, record);
  if (def.type === "link" || def.type === "linkOne") return record[`${name}Name`] || value;
  if (def.type === "linkMultiple") return (Array.isArray(value) ? value : []).map((id: string) => record[`${name}Names`]?.[id] || id);
  return value;
}

const entityIcons: Record<string, string> = {
  Account: "fas fa-building", Contact: "fas fa-address-card", Lead: "fas fa-bullseye", Opportunity: "fas fa-chart-line", Case: "fas fa-headset",
  Call: "fas fa-phone", Meeting: "fas fa-calendar-days", Task: "fas fa-list-check", Email: "fas fa-envelope", Campaign: "fas fa-bullhorn",
  User: "fas fa-user", ApiUser: "fas fa-key", PortalUser: "fas fa-globe", Team: "fas fa-users", Role: "fas fa-shield-halved", PortalRole: "fas fa-shield-halved", EmailAccount: "fas fa-at", InboundEmail: "fas fa-inbox", Import: "fas fa-file-import",
  Product: "fas fa-box", Quote: "fas fa-file-invoice-dollar", SalesOrder: "fas fa-cart-shopping", Invoice: "fas fa-receipt", Document: "fas fa-file-lines", KnowledgeBaseArticle: "fas fa-book-open",
  TargetList: "fas fa-bullseye", Target: "fas fa-crosshairs", Note: "fas fa-note-sticky", CampaignLogRecord: "fas fa-chart-column", Project: "fas fa-diagram-project", ProjectTask: "fas fa-list-check",
  TaskReminder: "fas fa-bell", EmailFilter: "fas fa-filter", EmailTemplate: "fas fa-envelope-open-text", Webhook: "fas fa-plug", WorkingTimeCalendar: "fas fa-calendar-days",
  Attachment: "fas fa-paperclip", AuthLogRecord: "fas fa-clock-rotate-left", AuthToken: "fas fa-key", AppLogRecord: "fas fa-file-lines", Job: "fas fa-gears",
  EmailAddress: "fas fa-at", PhoneNumber: "fas fa-phone", AddressCountry: "fas fa-map-location-dot", Currency: "fas fa-coins", PdfTemplate: "fas fa-file-pdf",
  WebhookQueueItem: "fas fa-plug", WebhookEventQueueItem: "fas fa-plug", KnowledgeBaseCategory: "fas fa-folder-open", Portal: "fas fa-globe", Template: "fas fa-file-pdf", DashboardTemplate: "fas fa-table-columns",
  LeadCapture: "fas fa-bullseye", CampaignTrackingUrl: "fas fa-link", CampaignTrackingUrlLogRecord: "fas fa-arrow-pointer", CampaignLog: "fas fa-chart-column",
  DocumentFolder: "fas fa-folder", ProductCategory: "fas fa-tags", QuoteItem: "fas fa-file-invoice-dollar", SalesOrderItem: "fas fa-boxes-stacked", InvoiceItem: "fas fa-receipt",
  CaseReason: "fas fa-circle-question", OpportunityStage: "fas fa-chart-simple", CampaignType: "fas fa-bullhorn", Notification: "fas fa-bell", Sms: "fas fa-comment",
  AppSecret: "fas fa-key", AuthenticationProvider: "fas fa-shield-halved", OAuthProvider: "fas fa-shield-halved", LayoutSet: "fas fa-table-columns", Formula: "fas fa-square-root-variable",
  ActionHistoryRecord: "fas fa-clock-rotate-left", ArrayValue: "fas fa-database", Autofollow: "fas fa-user-plus", EmailFolder: "fas fa-folder", EmailTemplateCategory: "fas fa-folder-open",
  Extension: "fas fa-puzzle-piece", ExternalAccount: "fas fa-globe", GlobalStream: "fas fa-rss", GroupEmailFolder: "fas fa-users", ImportError: "fas fa-file-circle-exclamation",
  LayoutRecord: "fas fa-table-columns", LeadCaptureLogRecord: "fas fa-clock-rotate-left", OAuthAccount: "fas fa-shield-halved", Preferences: "fas fa-sliders",
  ScheduledJob: "fas fa-gears", ScheduledJobLogRecord: "fas fa-clock-rotate-left", Stream: "fas fa-rss", StreamSubscription: "fas fa-users",
  UniqueId: "fas fa-fingerprint", UserData: "fas fa-user", UserReaction: "fas fa-comment", WorkingTimeRange: "fas fa-calendar-days",
  EmailQueueItem: "fas fa-paper-plane", MassEmail: "fas fa-bullhorn", Reminder: "fas fa-bell", TargetListCategory: "fas fa-folder-open",
  Integration: "fas fa-plug", PasswordChangeRequest: "fas fa-key", Calendar: "fas fa-calendar-days",
};
let metadataEntityIcons: Record<string, string> = {};
function EntityIcon({ name, size = 16 }: { name: string; size?: number }) {
  const nativeIcon = metadataEntityIcons[name];
  if (nativeIcon && /\bfa-[a-z0-9-]+\b/.test(nativeIcon)) {
    return <EspoIcon className={nativeIcon} size={size} />;
  }
  const fallback = entityIcons[name] || (/Email|Mail/.test(name) ? "fas fa-envelope" : /User|Team|Role|Contact/.test(name) ? "fas fa-users" : /Calendar|Meeting|WorkingTime/.test(name) ? "fas fa-calendar-days" : /Job|Workflow/.test(name) ? "fas fa-gears" : /File|Document|Template|Attachment/.test(name) ? "fas fa-file-lines" : /Web|Url|Link/.test(name) ? "fas fa-link" : /Phone|Call/.test(name) ? "fas fa-phone" : /Log|History/.test(name) ? "fas fa-clock-rotate-left" : /Product|Order|Invoice|Quote/.test(name) ? "fas fa-box" : /Portal|OAuth|Auth/.test(name) ? "fas fa-shield-halved" : /Target|Campaign|Lead/.test(name) ? "fas fa-bullseye" : /Project|Task/.test(name) ? "fas fa-list-check" : /Country|Address|Map/.test(name) ? "fas fa-map-location-dot" : /Currency|Price|Amount/.test(name) ? "fas fa-coins" : /Secret|Token|Key/.test(name) ? "fas fa-key" : /Webhook|Integration|Provider/.test(name) ? "fas fa-plug" : /Import/.test(name) ? "fas fa-file-import" : /Notification|Reminder/.test(name) ? "fas fa-bell" : /Dashboard|Layout/.test(name) ? "fas fa-table-columns" : /Knowledge|Article/.test(name) ? "fas fa-book-open" : /Stream/.test(name) ? "fas fa-rss" : "fas fa-cube");
  return <EspoIcon className={fallback} size={size} />;
}

function appPathname() {
  const base = import.meta.env.BASE_URL;
  const pathname = window.location.pathname;
  if (base !== "/" && pathname.startsWith(base)) return `/${pathname.slice(base.length)}` || "/";
  return pathname;
}

function appPublicPath(path: string) {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\//, "")}`;
}

function App() {
  const currentPath = appPathname();
  const publicCaptureId = currentPath.match(/^\/lead-capture\/([^/]+)\/?$/)?.[1];
  const entryParams = new URLSearchParams(window.location.search);
  const optInConfirmationId = currentPath === "/" && entryParams.get("entryPoint") === "confirmOptIn" ? entryParams.get("id") || undefined : undefined;
  const passwordChangeRequest = currentPath === "/" && entryParams.get("entryPoint") === "changePassword" ? { id: entryParams.get("id") || undefined } : undefined;
  const unsubscribeRequest = currentPath === "/" && entryParams.get("entryPoint") === "unsubscribe" ? { id: entryParams.get("id") || undefined, emailAddress: entryParams.get("emailAddress") || undefined, hash: entryParams.get("hash") || undefined } : undefined;
  const eventConfirmationRequest = currentPath === "/" && entryParams.get("entryPoint") === "eventConfirmation" ? { uid: entryParams.get("uid") || undefined, action: entryParams.get("action") || undefined } : undefined;
  const [session, setSession] = useState(getSession());
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [portalBranding, setPortalBranding] = useState<PortalBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");

  const loadApp = useCallback(async () => {
    try {
      const [valid, branding] = await Promise.all([restoreSession(), fetchPortalBranding()]);
      setPortalBranding(branding);
      const portalUser = valid && ["portal", "portal-user"].includes(String(valid.user.type));
      const accepted = branding && valid && !portalUser ? null : valid;
      if (valid && !accepted) logout();
      setSession(accepted);
      if (accepted) setMetadata(await fetchMetadata());
      else setMetadata(null);
    } catch (error) {
      setFatal(error instanceof Error ? error.message : "CRM se nepodařilo načíst.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!publicCaptureId && !optInConfirmationId && !passwordChangeRequest && !unsubscribeRequest && !eventConfirmationRequest) void loadApp(); }, [loadApp, publicCaptureId, optInConfirmationId, passwordChangeRequest?.id, Boolean(passwordChangeRequest), unsubscribeRequest?.id, unsubscribeRequest?.emailAddress, unsubscribeRequest?.hash, eventConfirmationRequest?.uid, eventConfirmationRequest?.action]);

  async function onLogin(username: string, password: string, pending?: PendingSecondStep, code?: string): Promise<Session | PendingSecondStep> {
    const user = pending ? await completeSecondStepLogin(pending, code || "") : await login(username, password);
    if ("secondStepRequired" in user) return user;
    if (portalBranding && !["portal", "portal-user"].includes(String(user.user.type))) {
      logout(); setSession(null); setMetadata(null);
      throw new Error("Tento účet není přiřazený k vybranému portálu.");
    }
    setSession(user);
    setMetadata(await fetchMetadata());
    return user;
  }

  function onLogout() {
    logout();
    setSession(null);
    setMetadata(null);
  }

  if (publicCaptureId) return <PublicLeadCapturePage key={publicCaptureId} recordId={decodeURIComponent(publicCaptureId)} />;
  if (optInConfirmationId) return <PublicLeadCaptureConfirmation key={optInConfirmationId} confirmationId={optInConfirmationId} />;
  if (passwordChangeRequest) return <PublicPasswordChangePage key={passwordChangeRequest.id || "missing"} requestId={passwordChangeRequest.id} />;
  if (unsubscribeRequest) return <PublicCampaignUnsubscribe key={`${unsubscribeRequest.id || ""}:${unsubscribeRequest.emailAddress || ""}:${unsubscribeRequest.hash || ""}`} {...unsubscribeRequest} />;
  if (eventConfirmationRequest?.uid && eventConfirmationRequest.action) return <PublicEventConfirmation key={`${eventConfirmationRequest.uid}:${eventConfirmationRequest.action}`} uid={eventConfirmationRequest.uid} action={eventConfirmationRequest.action} />;
  if (loading) return <div className="boot-screen"><div className="brand-mark">v</div><div className="boot-line"/><span>Připojuji ViaCRM</span></div>;
  if (!session) return <Login onLogin={onLogin} error={fatal} portalBranding={portalBranding} />;
  if (!metadata) return <div className="boot-screen"><div className="error-card"><b>CRM není dostupné</b><p>{fatal || "Nepodařilo se načíst metadata."}</p><button className="button primary" onClick={() => void loadApp()}>Zkusit znovu</button></div></div>;
  return <Workspace metadata={metadata} user={session.user} onLogout={onLogout} onRefreshMetadata={async () => setMetadata(await fetchMetadata())} />;
}

type EventConfirmationData = { status: string; attendeeStatus?: string; eventName?: string; translatedEntityType?: string; translatedStatus?: string; style?: string; action?: string; statusTranslation?: Record<string, string>; dateStart?: string; sentDateStart?: string };

function PublicEventConfirmation({ uid, action }: { uid: string; action: string }) {
  const [data, setData] = useState<EventConfirmationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const loadAction = useCallback(async (nextAction: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/v1/EventConfirmation/${encodeURIComponent(uid)}/${encodeURIComponent(nextAction)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Potvrzení účasti není dostupné.");
      setData(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Potvrzení účasti není dostupné."); }
    finally { setLoading(false); setBusyAction(""); }
  }, [uid]);
  useEffect(() => { void loadAction(action); }, [action, loadAction]);
  const statusOptions = data?.statusTranslation || {};
  const datesChanged = Boolean(data?.sentDateStart && data?.dateStart && data.sentDateStart !== data.dateStart);
  function formattedDate(value?: string) {
    if (!value) return "";
    const date = new Date(value.replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  return <main className="public-capture-page"><section className="public-capture-card public-confirm-card"><div className="public-capture-brand"><span className="brand-mark">v</span><span>via<span className="brand-light">crm</span></span></div><div className={`public-confirm-icon ${data?.status === "confirmed" ? "success" : ""}`}>{data?.status === "confirmed" ? <Check size={23}/> : <CalendarDays size={21}/>}</div><h1>{data?.status === "final" ? "Událost už byla uzavřena" : "Potvrzení účasti"}</h1>{error ? <p className="public-confirm-message error" role="alert">{error}</p> : loading ? <div className="public-confirm-loading"><span className="spinner"/></div> : data && <><p className="public-confirm-event">{data.eventName}</p>{data.translatedEntityType && <p className="public-confirm-list">{data.translatedEntityType}{data.dateStart ? ` · ${formattedDate(data.dateStart)}` : ""}</p>}{data.translatedStatus && <p className={`public-confirm-status ${data.status === "confirmed" ? "success" : ""}`}>{data.translatedStatus}</p>}{datesChanged && <p className="public-confirm-message">Čas události se od odeslání pozvánky změnil. Aktuální čas: {formattedDate(data.dateStart)}.</p>}{data.status === "confirmed" && data.statusTranslation && <div className="public-event-actions">{["Accepted", "Tentative", "Declined"].map((status) => { const actionByStatus: Record<string, string> = { Accepted: "accept", Tentative: "tentative", Declined: "decline" }; const nextAction = actionByStatus[status]; const active = data.attendeeStatus === status; return <button key={status} className={`button ${active ? "primary" : "subtle"}`} disabled={Boolean(busyAction) || active} onClick={() => { setBusyAction(nextAction); void loadAction(nextAction); }}>{statusOptions[status] || status}</button>; })}</div>}{data.status === "final" && <p className="public-confirm-message">{data.translatedStatus}</p>}</> }<footer>ViaCRM · Pozvánka na událost</footer></section></main>;
}

function PasswordRecoveryRequest({ onClose }: { onClose: () => void }) {
  const [userName, setUserName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/User/passwordChangeRequest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: userName.trim(), emailAddress: emailAddress.trim(), url: window.location.href }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Požadavek se nepodařilo zpracovat.");
      setSubmitted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Požadavek se nepodařilo zpracovat."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop password-recovery-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="password-recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="password-recovery-title"><div className="password-recovery-heading"><div><span className="eyebrow">OBNOVA PŘÍSTUPU</span><h2 id="password-recovery-title">Zapomenuté heslo</h2><p>Zadejte uživatelské jméno a e-mailovou adresu svého účtu.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={16}/></button></div>
    {submitted ? <div className="password-recovery-success"><Check size={19}/><p>Pokud údaje odpovídají účtu a lze mu obnovit heslo, bude odeslán odkaz pro jeho změnu.</p><button className="button primary" onClick={onClose}>Zpět na přihlášení</button></div> : <form onSubmit={(event) => void submit(event)}><label>Uživatelské jméno<input autoComplete="username" value={userName} onChange={(event) => setUserName(event.target.value)} required maxLength={255}/></label><label>E-mailová adresa<input type="email" autoComplete="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} required maxLength={255}/></label>{error && <div className="inline-error" role="alert">{error}</div>}<div className="password-recovery-actions"><button type="button" className="button subtle" onClick={onClose}>Zavřít</button><button className="button primary" disabled={busy}>{busy ? "Odesílám…" : "Odeslat odkaz"}</button></div></form>}
  </section></div>;
}

function getPhoneValidationPattern(metadata: Metadata) {
  const pattern = String((metadata.app as any)?.regExpPatterns?.phoneNumberLoose?.pattern || "");
  try { return pattern ? new RegExp(`^(?:${pattern})$`) : /^[+\d][\d\s().,/;*#-]*(?:\s*(?:ext\.?|x)\s*\d+)?$/i; }
  catch { return /^[+\d][\d\s().,/;*#-]*(?:\s*(?:ext\.?|x)\s*\d+)?$/i; }
}

function validateRequestedPassword(password: string, params: PasswordRecoveryInfo["strengthParams"] = {}) {
  const rules: Array<[boolean, string]> = [];
  const minLength = Number(params.passwordStrengthLength || 0);
  const letterCount = Number(params.passwordStrengthLetterCount || 0);
  const numberCount = Number(params.passwordStrengthNumberCount || 0);
  const specialCount = Number(params.passwordStrengthSpecialCharacterCount || 0);
  if (minLength) rules.push([password.length >= minLength, `Heslo musí mít alespoň ${minLength} znaků.`]);
  if (letterCount) rules.push([(password.match(/[a-z]/gi) || []).length >= letterCount, `Heslo musí obsahovat alespoň ${letterCount} písmena.`]);
  if (numberCount) rules.push([(password.match(/[0-9]/g) || []).length >= numberCount, `Heslo musí obsahovat alespoň ${numberCount} číslice.`]);
  if (params.passwordStrengthBothCases) rules.push([/[a-z]/.test(password) && /[A-Z]/.test(password), "Heslo musí obsahovat malé i velké písmeno."]);
  if (specialCount) rules.push([([...password].filter((char) => "'-!\"#$%&()*,./:;?@[]^_`{|}~+<=>".includes(char)).length >= specialCount), `Heslo musí obsahovat alespoň ${specialCount} speciální znak.`]);
  return rules.find(([valid]) => !valid)?.[1] || "";
}

function generateUserPassword(params: PasswordRecoveryInfo["strengthParams"] = {}) {
  const strengthLength = Number(params.passwordStrengthLength || 0);
  const length = Math.max(Number(params.passwordGenerateLength || 10), strengthLength, 10);
  const letters = Math.max(Number(params.passwordGenerateLetterCount || 4), Number(params.passwordStrengthLetterCount || 0), params.passwordStrengthBothCases ? 2 : 0);
  const numbers = Math.max(Number(params.passwordGenerateNumberCount || 2), Number(params.passwordStrengthNumberCount || 0));
  const specialCount = Number(params.passwordStrengthSpecialCharacterCount || 0);
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "'-!\"#$%&()*,./:;?@[]^_`{|}~+<=>";
  const groups = params.passwordStrengthBothCases ? [upper, lower] : [upper + lower];
  const charList: string[] = [];
  const randomIndex = (max: number) => { const values = new Uint32Array(1); crypto.getRandomValues(values); return values[0] % max; };
  const choose = (set: string) => set[randomIndex(set.length)];
  const required = [...groups.map(choose), ...Array.from({ length: Math.max(0, letters - groups.length) }, () => choose(upper + lower)), ...Array.from({ length: numbers }, () => choose(digits)), ...Array.from({ length: specialCount }, () => choose(special))];
  charList.push(...required);
  const all = `${upper}${lower}${digits}${specialCount ? special : ""}`;
  while (charList.length < length) charList.push(choose(all));
  for (let index = charList.length - 1; index > 0; index--) { const target = randomIndex(index + 1); [charList[index], charList[target]] = [charList[target], charList[index]]; }
  return charList.join("");
}

function PublicPasswordChangePage({ requestId }: { requestId?: string }) {
  const [info, setInfo] = useState<PasswordRecoveryInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(requestId));
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [loginUrl, setLoginUrl] = useState("/");
  useEffect(() => {
    if (!requestId) { setLoadError("Odkaz pro změnu hesla není platný nebo úplný."); return; }
    let live = true;
    fetch(`/api/v1/User/passwordChangeInfo/${encodeURIComponent(requestId)}`).then(async (response) => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Platnost odkazu se nepodařilo ověřit."); return data as PasswordRecoveryInfo; }).then((data) => live && setInfo(data)).catch((cause) => live && setLoadError(cause instanceof Error ? cause.message : "Platnost odkazu se nepodařilo ověřit.")).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [requestId]);
  const strengthError = password ? validateRequestedPassword(password, info?.strengthParams) : "";
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!requestId || !info?.requestFound) { setError("Odkaz pro změnu hesla už není platný. Požádejte o nový."); return; }
    if (strengthError) { setError(strengthError); return; }
    if (password !== confirmation) { setError("Zadaná hesla se neshodují."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/v1/User/changePasswordByRequest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Heslo se nepodařilo změnit. Zkontrolujte požadavky na heslo a platnost odkazu.");
      setLoginUrl(typeof body?.url === "string" && body.url ? body.url : "/"); setChanged(true); setPassword(""); setConfirmation("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Heslo se nepodařilo změnit."); }
    finally { setBusy(false); }
  }
  const title = loading ? "Ověřuji odkaz…" : changed ? "Heslo bylo změněno" : info?.requestFound ? "Zvolte nové heslo" : "Odkaz není platný";
  return <main className="public-capture-page"><section className="public-capture-card public-password-card"><div className="public-capture-brand"><span className="brand-mark">v</span><span>via<span className="brand-light">crm</span></span></div><div className={`public-confirm-icon ${changed ? "success" : ""}`}>{changed ? <Check size={22}/> : <Shield size={20}/>}</div><h1>{title}</h1>{loading ? <div className="public-confirm-loading"><span className="spinner"/></div> : changed ? <div className="public-password-success"><p>Vaše heslo bylo bezpečně změněno.</p><a className="button primary" href={loginUrl}>Přejít na přihlášení <ArrowRight size={14}/></a></div> : loadError ? <><p className="public-confirm-message error" role="alert">{loadError}</p><a className="button subtle" href="/">Zpět na přihlášení</a></> : !info?.requestFound ? <><p className="public-confirm-message">Odkaz mohl vypršet nebo už byl použit. Vraťte se na přihlášení a požádejte o nový.</p><a className="button subtle" href="/">Zpět na přihlášení</a></> : <form className="public-password-form" onSubmit={(event) => void submit(event)}><label>Nové heslo<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={255}/></label><label>Potvrdit nové heslo<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required maxLength={255}/></label>{info.strengthParams && Object.values(info.strengthParams).some(Boolean) && <ul className="public-password-rules">{Number(info.strengthParams.passwordStrengthLength) > 0 && <li className={password.length >= Number(info.strengthParams.passwordStrengthLength) ? "ok" : ""}>Nejméně {info.strengthParams.passwordStrengthLength} znaků</li>}{Number(info.strengthParams.passwordStrengthLetterCount) > 0 && <li className={(password.match(/[a-z]/gi) || []).length >= Number(info.strengthParams.passwordStrengthLetterCount) ? "ok" : ""}>Nejméně {info.strengthParams.passwordStrengthLetterCount} písmena</li>}{Number(info.strengthParams.passwordStrengthNumberCount) > 0 && <li className={(password.match(/[0-9]/g) || []).length >= Number(info.strengthParams.passwordStrengthNumberCount) ? "ok" : ""}>Nejméně {info.strengthParams.passwordStrengthNumberCount} číslice</li>}{info.strengthParams.passwordStrengthBothCases && <li className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? "ok" : ""}>Malé i velké písmeno</li>}{Number(info.strengthParams.passwordStrengthSpecialCharacterCount) > 0 && <li className={[...password].filter((char) => "'-!\"#$%&()*,./:;?@[]^_`{|}~+<=>".includes(char)).length >= Number(info.strengthParams.passwordStrengthSpecialCharacterCount) ? "ok" : ""}>Nejméně {info.strengthParams.passwordStrengthSpecialCharacterCount} speciální znak</li>}</ul>}{error && <div className="inline-error" role="alert">{error}</div>}<button className="button primary public-password-submit" disabled={busy}>{busy ? "Měním heslo…" : "Změnit heslo"}</button><a className="public-password-back" href="/">Zpět na přihlášení</a></form>}<footer>ViaCRM · Zabezpečení účtu</footer></section></main>;
}

function PublicCampaignUnsubscribe({ id, emailAddress, hash }: { id?: string; emailAddress?: string; hash?: string }) {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const infoPath = emailAddress && hash
    ? `Campaign/unsubscribeInfo/${encodeURIComponent(emailAddress)}/${encodeURIComponent(hash)}`
    : id ? `Campaign/unsubscribeInfo/${encodeURIComponent(id)}` : "";
  const actionPath = emailAddress && hash
    ? `Campaign/unsubscribe/${encodeURIComponent(emailAddress)}/${encodeURIComponent(hash)}`
    : id ? `Campaign/unsubscribe/${encodeURIComponent(id)}` : "";
  useEffect(() => {
    let live = true;
    if (!infoPath) { setError("Odkaz pro správu odběru není úplný."); return () => { live = false; }; }
    fetch(`/api/v1/${infoPath}`).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Odkaz pro správu odběru není platný.");
      return body;
    }).then((body) => live && setIsSubscribed(Boolean(body.isSubscribed)))
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Stav odběru se nepodařilo načíst."));
    return () => { live = false; };
  }, [infoPath]);
  async function updateSubscription() {
    if (!actionPath || isSubscribed == null) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/v1/${actionPath}`, { method: isSubscribed ? "POST" : "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Stav odběru se nepodařilo změnit.");
      setIsSubscribed(!isSubscribed);
      setNotice(isSubscribed ? "Odběr byl zrušen." : "Odběr byl znovu zapnut.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Stav odběru se nepodařilo změnit."); }
    finally { setBusy(false); }
  }
  return <main className="public-capture-page"><section className="public-capture-card public-confirm-card"><div className="public-capture-brand"><span className="brand-mark">v</span><span>via<span className="brand-light">crm</span></span></div><div className={`public-confirm-icon ${isSubscribed === false ? "success" : ""}`}>{isSubscribed === false ? <Check size={23}/> : <Mail size={21}/>}</div><h1>Správa e-mailového odběru</h1>{error ? <p className="public-confirm-message error" role="alert">{error}</p> : isSubscribed == null ? <div className="public-confirm-loading"><span className="spinner"/></div> : <><p className="public-confirm-message">{notice || (isSubscribed ? "Tato e-mailová adresa dostává zprávy kampaně." : "Tato e-mailová adresa je z odběru odhlášená.")}</p><button className={`button ${isSubscribed ? "subtle" : "primary"} public-unsubscribe-action`} onClick={() => void updateSubscription()} disabled={busy}>{busy ? "Ukládám…" : isSubscribed ? "Odhlásit e-maily" : "Znovu přihlásit e-maily"}</button></>}{!error && isSubscribed == null && <span className="sr-only">Načítám stav odběru.</span>}<footer>ViaCRM · Nastavení odběru</footer></section></main>;
}

function PublicLeadCaptureConfirmation({ confirmationId }: { confirmationId: string }) {
  const [result, setResult] = useState<{ status: "success" | "expired"; message?: string; leadCaptureName?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    fetch(`/api/v1/LeadCapture/confirmOptIn/${encodeURIComponent(confirmationId)}`)
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body?.message || "Potvrzení odběru se nepodařilo zpracovat."); return body; })
      .then((body) => live && setResult(body))
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Potvrzení odběru se nepodařilo zpracovat."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [confirmationId]);
  const success = result?.status === "success";
  return <main className="public-capture-page"><section className="public-capture-card public-confirm-card"><div className="public-capture-brand"><span className="brand-mark">v</span><span>via<span className="brand-light">crm</span></span></div><div className={`public-confirm-icon ${success ? "success" : ""}`}>{success ? <Check size={23}/> : <Clock3 size={22}/>}</div><h1>{loading ? "Ověřuji potvrzení…" : error ? "Potvrzení se nezdařilo" : success ? "E-mail byl potvrzen" : "Platnost odkazu vypršela"}</h1>{result?.leadCaptureName && <p className="public-confirm-list">{result.leadCaptureName}</p>}{error ? <p className="public-confirm-message error">{error}</p> : result?.message ? <div className="public-confirm-message" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.message) }}/> : loading ? <div className="public-confirm-loading"><span className="spinner"/></div> : null}<footer>ViaCRM · Potvrzení odběru</footer></section></main>;
}

type PublicLeadCaptureData = {
  requestUrl: string;
  fieldDefs: Record<string, FieldDef>;
  metadata?: { fields?: Record<string, any>; app?: Record<string, any> };
  detailLayout?: Array<{ rows?: Array<Array<{ name?: string }>> }>;
  language?: Metadata["labels"];
  successText?: string;
  text?: string;
  title?: string;
  captchaKey?: string | null;
  isDark?: boolean;
  config?: Record<string, any>;
};

function PublicLeadCapturePage({ recordId }: { recordId: string }) {
  const [form, setForm] = useState<PublicLeadCaptureData | null>(null);
  const [values, setValues] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const oldTitle = document.title;
    fetch(`/api/v1/LeadCapture/formData/${encodeURIComponent(recordId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || "Tento formulář není dostupný.");
        return data as PublicLeadCaptureData;
      })
      .then((data) => { if (live) { setForm(data); document.title = data.title || "Formulář"; } })
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Formulář se nepodařilo načíst."))
      .finally(() => live && setLoading(false));
    return () => { live = false; document.title = oldTitle; };
  }, [recordId]);
  useEffect(() => {
    if (!form?.captchaKey) return;
    const existing = document.querySelector<HTMLScriptElement>("script[data-via-captcha]");
    if (existing) return;
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(form.captchaKey)}`;
    script.async = true; script.defer = true; script.dataset.viaCaptcha = "true";
    document.head.append(script);
    return () => { script.remove(); };
  }, [form?.captchaKey]);

  const metadata = useMemo<Metadata>(() => ({
    scopes: { Lead: { entity: true } },
    entityDefs: { Lead: { fields: form?.fieldDefs || {} } },
    fields: form?.metadata?.fields || {},
    labels: form?.language || {},
    app: { ...(form?.config || {}), ...(form?.metadata?.app || {}) },
    userAcl: {},
  }), [form]);
  const orderedNames = useMemo(() => {
    if (!form) return [];
    const layoutNames = (form.detailLayout || []).flatMap((panel) => (panel.rows || []).flat().flatMap((item) => item?.name ? [item.name] : []));
    return [...new Set([...layoutNames, ...Object.keys(form.fieldDefs || {})])].filter((name) => Boolean(form.fieldDefs[name]));
  }, [form]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!formElement.reportValidity() || !form) return;
    setBusy(true); setError("");
    const payload: Row = {};
    for (const name of orderedNames) {
      const def = form.fieldDefs[name];
      const value = values[name];
      if (value == null || value === "") continue;
      if (def.type === "personName") {
        const prefix = name === "name" ? "" : name[0].toUpperCase() + name.slice(1);
        if (value.firstName) payload[`${prefix}firstName`] = value.firstName;
        if (value.middleName) payload[`${prefix}middleName`] = value.middleName;
        if (value.lastName) payload[`${prefix}lastName`] = value.lastName;
      } else if (def.type === "address") {
        for (const [part, suffix] of [["street", "Street"], ["city", "City"], ["state", "State"], ["postalCode", "PostalCode"], ["country", "Country"]]) {
          if (value[part]) payload[`${name}${suffix}`] = value[part];
        }
      } else if (["multiEnum", "array", "checklist", "urlMultiple"].includes(def.type || "") && typeof value === "string") {
        payload[name] = value.split("\n").map((part: string) => part.trim()).filter(Boolean);
      } else if (def.type === "currency") {
        payload[name] = value === "" || value == null ? null : Number(value);
        payload[`${name}Currency`] = values[`${name}Currency`] || form?.metadata?.app?.defaultCurrency || form?.config?.defaultCurrency || "USD";
      } else if (["int", "float", "enumInt"].includes(def.type || "")) {
        payload[name] = Number(value);
      } else payload[name] = value;
    }
    try {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (form.captchaKey) {
        const captcha = (window as any).grecaptcha;
        if (!captcha) throw new Error("Ověření formuláře CAPTCHA se ještě načítá. Zkuste to znovu za chvíli.");
        const token = await new Promise<string>((resolve, reject) => captcha.ready(() => captcha.execute(form.captchaKey, { action: "leadCaptureSubmit" }).then(resolve).catch(reject)));
        headers.set("X-Captcha-Token", token);
      }
      const response = await fetch(`/api/v1/${form.requestUrl}`, { method: "POST", headers, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.error || "Odeslání formuláře se nezdařilo.");
      if (result?.redirectUrl) { window.location.assign(result.redirectUrl); return; }
      setPosted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Odeslání formuláře se nezdařilo."); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="public-capture-page"><div className="surface table-loading"><span className="spinner"/> Načítám formulář…</div></main>;
  if (!form) return <main className="public-capture-page"><section className="public-capture-card"><div className="public-capture-error"><Target size={20}/><h1>Formulář není dostupný</h1><p>{error}</p></div></section></main>;
  return <main className={`public-capture-page ${form.isDark ? "dark" : ""}`}><section className="public-capture-card"><div className="public-capture-brand"><span className="brand-mark">v</span><span>via<span className="brand-light">crm</span></span></div>
    {form.title && <h1>{form.title}</h1>}
    {form.text && <div className="public-capture-copy" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.text) }}/>}
    {posted ? <div className="public-capture-success" role="status"><Check size={19}/><div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.successText || "Děkujeme za odeslání.") }}/></div> : <form className="public-capture-form" onSubmit={(event) => void submit(event)}>
      <div className="public-capture-fields">{orderedNames.map((name) => <FieldInput key={name} entity="Lead" metadata={metadata} name={name} def={form.fieldDefs[name]} value={values[name]} currencyValue={values[`${name}Currency`]} onCurrencyChange={(currency) => setValues((old) => ({ ...old, [`${name}Currency`]: currency }))} onChange={(value) => setValues((old) => ({ ...old, [name]: value }))}/>)}</div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <button className="button primary public-capture-submit" disabled={busy}>{busy ? "Odesílám…" : "Odeslat formulář"}<ArrowRight size={15}/></button>
      {form.captchaKey && <small className="public-capture-privacy">Tento formulář je chráněn službou Google reCAPTCHA.</small>}
    </form>}
    <footer>ViaCRM · Bezpečný formulář</footer>
  </section></main>;
}

type PasswordRecoveryInfo = { passwordRecoveryEnabled?: boolean; requestFound?: boolean | null; strengthParams?: Record<string, number | boolean | null> };

function Login({ onLogin, error: initialError, portalBranding }: { onLogin: (username: string, password: string, pending?: PendingSecondStep, code?: string) => Promise<Session | PendingSecondStep>; error: string; portalBranding: PortalBranding | null }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [secondStep, setSecondStep] = useState<PendingSecondStep | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const isPortalLogin = Boolean(portalBranding);
  const portalTitle = String(portalBranding?.applicationName || portalBranding?.name || "Klientský portál");
  const portalTheme = portalBranding?.theme || "Espo";
  const portalColors = portalThemeColors[portalTheme] || portalThemeColors.Espo;
  const loginStyle = (isPortalLogin ? { "--primary": portalColors.primary, "--primary-dark": portalColors.primaryDark, "--canvas": portalColors.canvas, "--ink": portalColors.ink, "--line": portalColors.line } : {}) as CSSProperties;
  const portalLogo = portalBranding?.companyLogoId ? `/?entryPoint=LogoImage&id=${encodeURIComponent(portalBranding.companyLogoId)}` : "";
  useEffect(() => { let live = true; fetch("/api/v1/User/passwordRecoveryInfo").then((response) => response.json()).then((data: PasswordRecoveryInfo) => live && setRecoveryEnabled(Boolean(data.passwordRecoveryEnabled))).catch(() => live && setRecoveryEnabled(false)); return () => { live = false; }; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await onLogin(username, password); if ("secondStepRequired" in result) { setSecondStep(result); setCode(""); setPasswordVisible(false); } } catch (e) { setError(e instanceof Error ? e.message : "Přihlášení se nezdařilo."); }
    finally { setBusy(false); }
  }
  async function submitSecondStep(event: FormEvent) {
    event.preventDefault(); if (!secondStep) return; setBusy(true); setError("");
    try { await onLogin(username, password, secondStep, code); }
    catch (e) { setError(e instanceof Error ? e.message : "Ověření se nezdařilo."); }
    finally { setBusy(false); }
  }
  return <main dir={isPortalLogin && portalTheme === "EspoRtl" ? "rtl" : "ltr"} className={`login-page ${isPortalLogin ? `portal-login portal-theme-${portalTheme.toLowerCase()}` : ""}`} style={loginStyle}>
    <section className="login-story">
      <div className="brand lockup">{portalLogo ? <img className="portal-brand-logo" src={portalLogo} alt=""/> : <span className="brand-mark">{isPortalLogin ? portalTitle.slice(0, 1).toUpperCase() : "v"}</span>}<span>{isPortalLogin ? portalTitle : <>via<span className="brand-light">crm</span></>}</span></div>
      <div className="story-copy">{isPortalLogin ? <><span className="eyebrow">ZÁKAZNICKÝ PORTÁL</span><h1>Vítejte v portálu<br/>{portalTitle}.</h1><p>Po přihlášení najdete své požadavky, dokumenty a komunikaci s naším týmem.</p></> : <><span className="eyebrow">JEDNO MÍSTO PRO VÁŠ BYZNYS</span><h1>Dobré vztahy<br/>začínají přehledem.</h1><p>Klienti, obchod i každodenní práce. Všechno navazuje na sebe.</p></>}</div>
      <div className="story-foot"><span>{isPortalLogin ? portalTitle : "Klientské CRM"}</span><span>{isPortalLogin ? "Zabezpečený přístup" : "EspoCRM · připojeno"}</span></div>
    </section>
    <section className="login-side"><form className="login-card" onSubmit={secondStep ? submitSecondStep : submit} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.requestSubmit(); } }}>
      <span className="eyebrow">{isPortalLogin ? portalTitle : "VÍTEJTE ZPĚT"}</span><h2>{isPortalLogin ? "Přihlášení do portálu" : "Přihlášení do CRM"}</h2><p className="login-hint">{isPortalLogin ? "Použijte přihlašovací údaje svého portálového účtu." : "Použijte svůj účet EspoCRM."}</p>
      {!secondStep ? <><label>Uživatelské jméno<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
      <label>Heslo<div className="login-password-control"><input id="login-password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><button type="button" className="login-password-toggle" aria-label={passwordVisible ? "Skrýt heslo" : "Zobrazit heslo"} aria-pressed={passwordVisible} aria-controls="login-password" onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeSlash size={16}/> : <Eye size={16}/>}</button></div></label></> : <><p className="login-hint">{secondStep.message || "Zadejte ověřovací kód z druhého kroku přihlášení."}</p><label>Ověřovací kód<input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required /></label></>}
      {error && <div className="inline-error">{error}</div>}
      <button className="button primary login-submit" disabled={busy}>{busy ? "Ověřuji…" : secondStep ? "Ověřit a přihlásit se" : "Přihlásit se"}<span>→</span></button>
      {secondStep ? <button type="button" className="login-recovery-link" onClick={() => { setSecondStep(null); setCode(""); setError(""); }}>Zpět na přihlášení</button> : recoveryEnabled && <button type="button" className="login-recovery-link" onClick={() => setRecoveryOpen(true)}>Zapomněli jste heslo?</button>}
      <div className="login-secure"><span className="secure-dot"/>Přihlášení ověřuje přímo EspoCRM</div>
    </form><div className="login-bottom">{isPortalLogin ? portalTitle : "ViaCRM"} <span>·</span> {isPortalLogin ? "Zákaznický portál" : "Klientský portál"}</div>{recoveryOpen && <PasswordRecoveryRequest onClose={() => setRecoveryOpen(false)}/>}</section>
  </main>;
}

function Workspace({ metadata, user, onLogout, onRefreshMetadata }: { metadata: Metadata; user: User; onLogout: () => void; onRefreshMetadata: () => Promise<void> }) {
  metadataEntityIcons = Object.fromEntries(Object.entries(metadata.clientDefs || {}).map(([scope, defs]) => [scope, String(defs.iconClass || "")]).filter(([, icon]) => Boolean(icon))) as Record<string, string>;
  const isPortalUser = user.type === "portal" || user.type === "portal-user";
  const portalSettings = isPortalUser ? metadata.appSettings || {} : {};
  const portalName = String(portalSettings.applicationName || "Klientský portál");
  const portalTheme = String(portalSettings.theme || "Espo");
  const portalNavbar = String(portalSettings.themeParams?.navbar || "side");
  const portalColors = portalThemeColors[portalTheme] || portalThemeColors.Espo;
  const portalStyle = (isPortalUser ? { "--primary": portalColors.primary, "--primary-dark": portalColors.primaryDark, "--nav": portalColors.nav, "--canvas": portalColors.canvas, "--surface": portalColors.surface, "--ink": portalColors.ink, "--line": portalColors.line } : {}) as CSSProperties;
  const portalLogoId = String(portalSettings.companyLogoId || "");
  const portalLogoUrl = isPortalUser && portalLogoId ? `/?entryPoint=LogoImage&id=${encodeURIComponent(portalLogoId)}` : "";
  const portalDirection = portalTheme === "EspoRtl" ? "rtl" : "ltr";
  const entities = useMemo(() => entityList(metadata), [metadata]);
  const [portalVisibleScopes, setPortalVisibleScopes] = useState<string[] | null>(null);
  const updatePortalScopes = useCallback((scopes: string[]) => setPortalVisibleScopes(scopes), []);
  const navEntities = isPortalUser ? portalVisibleScopes ?? portalEntities(metadata) : entities.filter((name) => name !== "User");
  const [entity, setEntity] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarUser, setCalendarUser] = useState<Row | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [globalStreamOpen, setGlobalStreamOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [lastViewedOpen, setLastViewedOpen] = useState(false);
  const [accountPage, setAccountPage] = useState<"preferences" | "security" | null>(null);
  const [preferencesTarget, setPreferencesTarget] = useState<User | null>(null);
  const [entityFixedWhere, setEntityFixedWhere] = useState<Row[]>([]);
  useEffect(() => { if (!(["EmailAccount", "Task"].includes(entity || "")) && entityFixedWhere.length) setEntityFixedWhere([]); }, [entity, entityFixedWhere]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [record, setRecord] = useState<Row | null>(null);
  const [emailDraft, setEmailDraft] = useState<Row | null>(null);
  const [emailFilterDraft, setEmailFilterDraft] = useState<Row | null>(null);
  const [emailRefresh, setEmailRefresh] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateScope, setQuickCreateScope] = useState<string | null>(null);
  const [quickCreateInitialValues, setQuickCreateInitialValues] = useState<Row>({});
  const [quickCreateFromDashboard, setQuickCreateFromDashboard] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [tabPreferences, setTabPreferences] = useState<Row>({});
  const [openTabGroups, setOpenTabGroups] = useState<Record<string, boolean>>({});
  const [quickCreateLayout, setQuickCreateLayout] = useState<{ scope: string; names: string[] } | null>(null);
  const quickCreateMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!quickCreateOpen) return;
    const onPointer = (event: PointerEvent) => { if (!quickCreateMenuRef.current?.contains(event.target as Node)) setQuickCreateOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setQuickCreateOpen(false); };
    document.addEventListener("pointerdown", onPointer); window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); window.removeEventListener("keydown", onKey); };
  }, [quickCreateOpen]);
  useEffect(() => {
    if (!quickCreateScope) return;
    let live = true;
    fetchLayout<LayoutItem[]>(quickCreateScope, "detailSmall").then((layout) => {
      if (live && Array.isArray(layout)) setQuickCreateLayout({ scope: quickCreateScope, names: layout.flatMap((item) => item && typeof item === "object" && item.name ? [item.name] : []) });
    }).catch(() => {});
    return () => { live = false; };
  }, [quickCreateScope]);
  const quickCreateScopes = useMemo(() => {
    const configured = metadata.appSettings?.quickCreateList;
    if (!Array.isArray(configured)) return [];
    return configured.filter((scope): scope is string => typeof scope === "string" && Boolean(metadata.scopes?.[scope]?.entity) && !metadata.scopes?.[scope]?.disabled && !metadata.clientDefs?.[scope]?.createDisabled && canCreateEntity(metadata, scope));
  }, [metadata]);
  function openDashboardCreate(scope: string) {
    if (!canCreateEntity(metadata, scope)) return;
    const initialValues: Row = {};
    if (metadata.entityDefs?.[scope]?.fields?.assignedUsers) {
      initialValues.assignedUsersIds = [user.id];
      initialValues.assignedUsersNames = { [user.id]: user.name };
    } else if (metadata.entityDefs?.[scope]?.fields?.assignedUser) {
      initialValues.assignedUserId = user.id;
      initialValues.assignedUserName = user.name;
    }
    setQuickCreateLayout(null);
    setQuickCreateInitialValues(initialValues);
    setQuickCreateFromDashboard(true);
    setQuickCreateScope(scope);
  }
  useEffect(() => {
    let live = true;
    request<Row>(`Preferences/${encodeURIComponent(user.id)}`).then((prefs) => live && setTabPreferences(prefs)).catch(() => live && setTabPreferences({}));
    return () => { live = false; };
  }, [user.id, accountPage]);
  const nativeNavItems = useMemo(() => {
    const system = Array.isArray(metadata.appSettings?.tabList) ? metadata.appSettings.tabList as any[] : [];
    const personal = Array.isArray(tabPreferences.tabList) ? tabPreferences.tabList as any[] : [];
    const source = tabPreferences.useCustomTabList ? tabPreferences.addCustomTabs ? [...system, ...personal] : personal : system;
    const isAdmin = user.type === "admin" || user.type === "super-admin";
    const hasAccess = (item: any): boolean => {
      if (typeof item === "string") {
        if (["Home", "_delimiter_", "_delimiter-ext_"].includes(item)) return true;
        const scope = metadata.scopes?.[item];
        if (!scope || scope.disabled) return false;
        if ((scope as any).acl) return canAccessEntity(metadata, item);
        if ((scope as any).tabAclPermission) { const level = metadata.userAcl?.[(scope as any).tabAclPermission]; return Boolean(level && level !== "no"); }
        return true;
      }
      if (!item || typeof item !== "object") return false;
      if (item.type === "divider") return true;
      if (item.type === "url") return (!item.onlyAdmin || isAdmin) && (!item.aclScope || canAccessEntity(metadata, item.aclScope));
      if (Array.isArray(item.itemList)) return item.itemList.some(hasAccess);
      return false;
    };
    const filterItem = (item: any): any => {
      if (!hasAccess(item)) return null;
      if (item && typeof item === "object" && Array.isArray(item.itemList)) {
        const itemList = item.itemList.map(filterItem).filter(Boolean);
        return itemList.length ? { ...item, itemList } : null;
      }
      return item;
    };
    const filtered = source.map(filterItem).filter(Boolean);
    return filtered.filter((item, index) => item?.type !== "divider" || Boolean(filtered[index - 1] && filtered[index + 1] && filtered[index - 1]?.type !== "divider" && filtered[index + 1]?.type !== "divider"));
  }, [metadata, tabPreferences, user.type]);
  function nativeTabLabel(item: any): string {
    if (typeof item === "string") return item === "Home" ? "Přehled" : item === "Calendar" ? "Kalendář" : entityLabel(metadata, item, true);
    const raw = String(item?.text || "");
    if (!raw) return "";
    const key = raw.startsWith("$") ? raw.slice(1) : raw;
    return (metadata.labels as any)?.Global?.navbarTabs?.[key] || (metadata.labels as any)?.Global?.labels?.[key] || key;
  }
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setGlobalSearchOpen(true); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  const refreshNotificationCount = useCallback(() => { void request<number>("Notification/action/notReadCount").then((count) => setUnreadNotifications(Number(count) || 0)).catch(() => {}); }, []);
  useEffect(() => { refreshNotificationCount(); const timer = window.setInterval(refreshNotificationCount, 60_000); return () => window.clearInterval(timer); }, [refreshNotificationCount]);
  const [mobileNav, setMobileNav] = useState(false);
  const sidebarStorageKey = `via-sidebar-collapsed:${user.id}`;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(`via-sidebar-collapsed:${user.id}`) === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { setSidebarCollapsed(localStorage.getItem(sidebarStorageKey) === "true"); } catch { setSidebarCollapsed(false); }
  }, [sidebarStorageKey]);
  function toggleSidebarCollapsed() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try { localStorage.setItem(sidebarStorageKey, String(next)); } catch { /* Keep the current preference for this page session. */ }
  }

  function openQuickCreate(scope: string) {
    setQuickCreateOpen(false);
    if (scope === "Email" && !isPortalUser) { setEntity("Email"); setRecord(null); setEmailDraft({}); setMobileNav(false); return; }
    setQuickCreateLayout(null);
    setQuickCreateScope(scope);
  }
  function openNativeTab(name: string) { if (name === "Calendar") openCalendar(); else openEntity(name); }
  function openEntity(name: string, fixedWhere: Row[] = []) { setQuickCreateScope(null); setQuickCreateOpen(false); setEntityFixedWhere(fixedWhere); setEntity(name); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setPreferencesTarget(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openCalendar() { setEntity(null); setCalendarUser(null); setCalendarOpen(true); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openCalendarFor(target: Row) { setEntity(null); setCalendarUser(target); setCalendarOpen(true); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openActivity() { setEntity(null); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(true); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openGlobalStream() { setEntity(null); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(true); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openNotifications() { setEntity(null); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(true); setLastViewedOpen(false); setAccountPage(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openLastViewed() { setEntity(null); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(true); setAccountPage(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openAdmin() { setEntity(null); setCalendarOpen(false); setAdminOpen(true); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openAccountPage(page: "preferences" | "security") { setEntity(null); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setPreferencesTarget(null); setAccountPage(page); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openPreferencesFor(target: Row) { setEntity(null); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setPreferencesTarget(target as User); setAccountPage("preferences"); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }
  function openEmailAccountsFor(target: Row) { setEntityFixedWhere([{ type: "equals", attribute: "assignedUserId", value: target.id }]); setEntity("EmailAccount"); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setRecord(null); setMobileNav(false); }
  async function openNotificationRecord(scope: string, id: string) {
    if (!metadata.entityDefs?.[scope]) return;
    setEntity(scope); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setMobileNav(false);
    try { setRecord(await request<Row>(`${encodeURIComponent(scope)}/${encodeURIComponent(id)}`)); } catch { setRecord(null); }
  }
  return <div className={`app-shell ${!isPortalUser && sidebarCollapsed ? "sidebar-collapsed" : ""} ${isPortalUser ? `portal-theme-${portalTheme.toLowerCase()} portal-navbar-${portalNavbar} ${portalDirection === "rtl" ? "portal-rtl" : ""}` : ""}`} style={portalStyle} dir={isPortalUser ? portalDirection : undefined}>
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
      <div className="brand sidebar-brand">{portalLogoUrl ? <img className="portal-brand-logo" src={portalLogoUrl} alt=""/> : <span className="brand-mark">{isPortalUser ? portalName.slice(0, 1).toUpperCase() : "v"}</span>}<span>{isPortalUser ? portalName : <>via<span className="brand-light">crm</span></>}</span><button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="Zavřít nabídku"><X size={17}/></button>{!isPortalUser && <button type="button" className="sidebar-collapse-toggle" onClick={toggleSidebarCollapsed} aria-label={sidebarCollapsed ? "Rozbalit navigaci" : "Zúžit navigaci"} title={sidebarCollapsed ? "Rozbalit navigaci" : "Zúžit navigaci"}>{sidebarCollapsed ? <ChevronRight size={15}/> : <ChevronLeft size={15}/>}</button>}</div>
      <div className="workspace-pill" aria-label={isPortalUser ? "Klientský portál" : "Pracovní prostor"} title={sidebarCollapsed ? (isPortalUser ? "Klientský portál" : "Pracovní prostor") : undefined}><span className="workspace-dot"/><span>{isPortalUser ? "KLIENTSKÝ PORTÁL" : "PRACOVNÍ PROSTOR"}</span>{!isPortalUser && <ChevronDown size={14}/>}</div>
      <nav className="nav-list">
        <div className="nav-caption">PŘEHLED</div>
        <button aria-label={isPortalUser ? "Přehled" : "Dashboard"} title={sidebarCollapsed ? (isPortalUser ? "Přehled" : "Dashboard") : undefined} className={`nav-item ${!entity && !calendarOpen && !adminOpen && !activityOpen && !globalStreamOpen && !notificationsOpen && !lastViewedOpen && !accountPage ? "active" : ""}`} onClick={() => { setEntity(null); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setAccountMenuOpen(false); setRecord(null); setMobileNav(false); }}><span className="nav-icon"><LayoutDashboard size={17}/></span><span>{isPortalUser ? "Přehled" : "Dashboard"}</span></button>
        {!isPortalUser && <>{!nativeNavItems.some((item) => item === "Calendar") && <button aria-label="Kalendář" title={sidebarCollapsed ? "Kalendář" : undefined} className={`nav-item ${calendarOpen ? "active" : ""}`} onClick={openCalendar}><span className="nav-icon"><CalendarDays size={17}/></span><span>Kalendář</span></button>}
        <button aria-label="Aktivita" title={sidebarCollapsed ? "Aktivita" : undefined} className={`nav-item ${activityOpen ? "active" : ""}`} onClick={openActivity}><span className="nav-icon"><Activity size={17}/></span><span>Aktivita</span></button>{canAccessEntity(metadata, "GlobalStream") && <button aria-label="Globální stream" title={sidebarCollapsed ? "Globální stream" : undefined} className={`nav-item ${globalStreamOpen ? "active" : ""}`} onClick={openGlobalStream}><span className="nav-icon"><Activity size={17}/></span><span>Globální stream</span></button>}</>}
        {isPortalUser ? <><div className="nav-caption modules-caption">MODULY <span>{navEntities.length}</span></div>{navEntities.map((item) => <button key={item} className={`nav-item ${entity === item ? "active" : ""}`} aria-label={entityLabel(metadata, item, true)} title={sidebarCollapsed ? entityLabel(metadata, item, true) : undefined} onClick={() => openEntity(item)}><span className="nav-icon"><EntityIcon name={item}/></span><span>{entityLabel(metadata, item, true)}</span></button>)}</> : nativeNavItems.map((item, index) => {
          if (typeof item === "string") {
            if (item === "Home" || item.startsWith("_delimiter")) return null;
            return <button key={`${item}-${index}`} aria-label={nativeTabLabel(item)} title={sidebarCollapsed ? nativeTabLabel(item) : undefined} className={`nav-item ${(item === "Calendar" ? calendarOpen : entity === item) ? "active" : ""}`} onClick={() => openNativeTab(item)}><span className="nav-icon">{item === "Calendar" ? <CalendarDays size={16}/> : <EntityIcon name={item}/>}</span><span>{nativeTabLabel(item)}</span></button>;
          }
          if (item?.type === "divider") return <div key={item.id || `divider-${index}`} className="nav-caption native-nav-divider">{nativeTabLabel(item)}</div>;
          if (item?.type === "url") return <a key={`url-${index}`} aria-label={nativeTabLabel(item)} title={sidebarCollapsed ? nativeTabLabel(item) : undefined} className="nav-item native-nav-url" href={item.url} target={item.targetBlank ? "_blank" : undefined} rel={item.targetBlank ? "noreferrer" : undefined} onClick={() => setMobileNav(false)}><span className="nav-icon"><Globe size={16}/></span><span>{nativeTabLabel(item)}</span></a>;
          if (Array.isArray(item?.itemList)) { const groupKey = String(item.id || item.text || index); const isOpen = openTabGroups[groupKey] ?? true; return <div key={`group-${groupKey}`} className={`native-nav-group ${isOpen ? "open" : ""}`}><button type="button" className="nav-caption native-nav-group-title" aria-label={nativeTabLabel(item)} title={sidebarCollapsed ? nativeTabLabel(item) : undefined} aria-expanded={isOpen} onClick={() => setOpenTabGroups((state) => ({ ...state, [groupKey]: !(state[groupKey] ?? true) }))}><span>{nativeTabLabel(item)}</span><ChevronDown size={13}/></button>{isOpen && item.itemList.filter((child: any) => typeof child === "string" && child !== "Home" || child?.type === "url").map((child: any, childIndex: number) => typeof child === "string" ? <button key={`${child}-${childIndex}`} aria-label={nativeTabLabel(child)} title={sidebarCollapsed ? nativeTabLabel(child) : undefined} className={`nav-item native-nav-group-item ${entity === child ? "active" : ""}`} onClick={() => openNativeTab(child)}><span className="nav-icon">{child === "Calendar" ? <CalendarDays size={16}/> : <EntityIcon name={child}/>}</span><span>{nativeTabLabel(child)}</span></button> : <a key={`url-${childIndex}`} aria-label={nativeTabLabel(child)} title={sidebarCollapsed ? nativeTabLabel(child) : undefined} className="nav-item native-nav-group-item" href={child.url}><span className="nav-icon"><Globe size={16}/></span><span>{nativeTabLabel(child)}</span></a>)}</div>; }
          return null;
        })}
      </nav>
      {user.type === "admin" && <div className="sidebar-bottom"><button aria-label="Administrace" title={sidebarCollapsed ? "Administrace" : undefined} className={`nav-item ${adminOpen ? "active" : ""}`} onClick={openAdmin}><span className="nav-icon"><Settings size={17}/></span><span>Administrace</span></button><div className="sidebar-version">ViaCRM UI <span>0.2</span></div></div>}
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Zavřít nabídku"/>}
    <section className="main-shell">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Otevřít nabídku"><Menu size={19}/></button><div className="breadcrumbs"><span>{isPortalUser ? portalName : "ViaCRM"}</span><b>/</b><strong>{accountPage === "preferences" ? "Moje preference" : accountPage === "security" ? "Zabezpečení" : notificationsOpen ? "Oznámení" : lastViewedOpen ? "Naposledy zobrazené" : globalStreamOpen ? "Globální stream" : activityOpen ? "Aktivita" : adminOpen ? "Administrace" : calendarOpen ? "Kalendář" : entity ? entityLabel(metadata, entity, true) : "Přehled"}{record && <><b>/</b><strong>{recordFieldDisplayValue(entity || "", "name", record) || record.subject || "Detail"}</strong></>}</strong></div>
      <div className="top-actions">{quickCreateScopes.length > 0 && <div className="quick-create-menu" ref={quickCreateMenuRef}><button type="button" className={`quick-create-trigger ${quickCreateOpen ? "selected" : ""}`} aria-label="Rychlé vytvoření" title="Rychlé vytvoření" aria-haspopup="menu" aria-expanded={quickCreateOpen} onClick={() => setQuickCreateOpen((open) => !open)}><Plus size={17}/><span>Vytvořit</span></button>{quickCreateOpen && <div className="quick-create-dropdown" role="menu"><div className="quick-create-heading">Rychle vytvořit</div>{quickCreateScopes.map((scope) => <button type="button" role="menuitem" key={scope} onClick={() => openQuickCreate(scope)}><span className="nav-icon"><EntityIcon name={scope}/></span>{scope === "Email" ? "E-mail" : entityLabel(metadata, scope)}</button>)}</div>}</div>}<button className="global-search-trigger" onClick={() => setGlobalSearchOpen(true)} title="Vyhledat v CRM" aria-label="Vyhledat v CRM"><Search size={16}/><span>Hledat v CRM</span><kbd>⌘ K</kbd></button>{!isPortalUser && <button className={`last-viewed-trigger ${lastViewedOpen ? "selected" : ""}`} onClick={openLastViewed} title="Naposledy zobrazené" aria-label="Naposledy zobrazené"><Clock3 size={17}/></button>}<button className="notification-trigger" onClick={() => setNotificationPanelOpen((open) => !open)} title="Oznámení" aria-label={`Oznámení${unreadNotifications ? `, ${unreadNotifications} nepřečtených` : ""}`} aria-haspopup="dialog" aria-expanded={notificationPanelOpen}><Bell size={17}/>{unreadNotifications > 0 && <span>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</button>{notificationPanelOpen && <Suspense fallback={null}><NotificationPanel metadata={metadata} onClose={() => setNotificationPanelOpen(false)} onOpenList={openNotifications} onOpenRecord={(scope, id) => { setNotificationPanelOpen(false); void openNotificationRecord(scope, id); }} onUnreadChange={refreshNotificationCount}/></Suspense>}<div className="connection"><span/> CRM online</div><div className="user-account-menu"><button className="user-menu" onClick={() => setAccountMenuOpen((open) => !open)} aria-expanded={accountMenuOpen} aria-haspopup="menu" title="Nabídka účtu"><span className="avatar">{(user.name || "U").slice(0, 1).toUpperCase()}</span><span className="user-name">{user.name}</span><span className="chevron">⌄</span></button>{accountMenuOpen && <div className="account-dropdown" role="menu"><div className="account-dropdown-head"><span className="avatar">{(user.name || "U").slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.userName}</small></span></div><button role="menuitem" onClick={() => openAccountPage("preferences")}><Settings size={15}/>Moje preference</button><button role="menuitem" onClick={() => openAccountPage("security")}><Shield size={15}/>Zabezpečení</button><div className="account-dropdown-divider"/><button role="menuitem" className="account-logout" onClick={() => { setAccountMenuOpen(false); onLogout(); }}><ArrowLeft size={15}/>Odhlásit se</button></div>}</div></div>
      </header>
      <main className="content-area"><Suspense fallback={<div className="surface table-loading" role="status"><span className="spinner"/> Připravuji obrazovku…</div>}>{accountPage === "preferences"
        ? <UserPreferencesView metadata={metadata} user={preferencesTarget || user} onBack={() => { const target = preferencesTarget; setAccountPage(null); setPreferencesTarget(null); if (target) { setEntity("User"); setRecord(target as Row); } }} />
        : accountPage === "security"
        ? <UserSecurityView user={user} onBack={() => setAccountPage(null)} onLogout={onLogout} />
        : lastViewedOpen
        ? <LastViewedView metadata={metadata} onBack={() => setLastViewedOpen(false)} onOpenRecord={(name, row) => { setEntity(name); setRecord(row); setLastViewedOpen(false); }} />
        : notificationsOpen
        ? <NotificationCenter metadata={metadata} onBack={() => { setNotificationsOpen(false); refreshNotificationCount(); }} onOpenRecord={(scope, id) => void openNotificationRecord(scope, id)} onUnreadChange={refreshNotificationCount} />
        : globalStreamOpen
        ? <GlobalStreamView user={user} metadata={metadata} onBack={() => setGlobalStreamOpen(false)} onOpenRecord={(scope, id) => void openNotificationRecord(scope, id)} />
        : activityOpen
        ? <ActivityView user={user} metadata={metadata} onBack={() => setActivityOpen(false)} />
        : entity === "__settings__"
        ? <AdminSettings metadata={metadata} onBack={openAdmin} />
        : entity === "__extensions__"
        ? <AdminExtensions metadata={metadata} onBack={openAdmin} onInstalled={() => void onRefreshMetadata()} />
        : entity === "__integrations__"
        ? <AdminIntegrations metadata={metadata} onBack={openAdmin} />
        : entity === "__upgrade__"
        ? <AdminUpgrade metadata={metadata} onBack={openAdmin} onUpgraded={() => void onRefreshMetadata()} />
        : entity === "__auth-settings__"
        ? <AdminAuthentication metadata={metadata} onBack={openAdmin} />
        : entity === "__notification-settings__"
        ? <AdminNotifications metadata={metadata} onBack={openAdmin} />
        : entity === "__formula-sandbox__"
        ? <AdminFormulaSandbox metadata={metadata} onBack={openAdmin} />
        : entity === "__template-manager__"
        ? <AdminTemplateManager metadata={metadata} onBack={openAdmin} />
        : entity === "__auth-tokens__"
        ? <AdminAuthTokens onBack={openAdmin} onOpenRecord={(row) => { openEntity("AuthToken"); setRecord(row); }} />
        : entity === "__ui-settings__"
        ? <AdminSettings metadata={metadata} onBack={openAdmin} focus="userInterface" />
        : entity === "__outbound-settings__" || entity === "__inbound-settings__"
        ? <AdminSettings metadata={metadata} onBack={openAdmin} focus={entity === "__outbound-settings__" ? "outboundEmails" : "inboundEmails"} />
        : entity === "__jobs-settings__"
        ? <AdminSettings metadata={metadata} onBack={openAdmin} focus="jobsSettings" />
        : entity === "__api-users__"
        ? <EntityView entity="User" metadata={metadata} onOpenRecord={setRecord} userType="api" title="API uživatelé" />
        : entity === "__portal-users__"
        ? <EntityView entity="User" metadata={metadata} onOpenRecord={setRecord} userType="portal" title="Uživatelé portálu" />
        : entity === "__currency-settings__"
        ? <AdminSettings metadata={metadata} onBack={openAdmin} focus="currency" />
        : entity === "__sms-settings__"
        ? <AdminSettings metadata={metadata} onBack={openAdmin} focus="sms" />
        : entity === "__field-manager__"
        ? <AdminFieldManager metadata={metadata} onBack={openAdmin} />
        : entity === "__layout-manager__"
        ? <AdminLayoutManager metadata={metadata} onBack={openAdmin} />
        : entity === "__system-tools__"
        ? <AdminSystemTools metadata={metadata} onBack={openAdmin} />
        : entity === "__entity-manager__"
        ? <AdminEntityManager metadata={metadata} onBack={openAdmin} />
        : entity === "__link-manager__"
        ? <AdminLinkManager metadata={metadata} onBack={openAdmin} />
        : entity === "__label-manager__"
        ? <AdminLabelManager metadata={metadata} onBack={openAdmin} onRefreshMetadata={onRefreshMetadata} />
        : entity === "Import" || entity === "__import__"
        ? <ImportCenter metadata={metadata} onOpenRecord={(name, row) => { setEntity(name); setRecord(row); }} />
        : entity === "Attachment"
        ? <AttachmentCenter metadata={metadata} onOpenRecord={(name, row) => { setEntity(name); setRecord(row); }} />
        : entity === "ActionHistoryRecord"
        ? <ActionHistoryCenter metadata={metadata} onBack={openAdmin} onOpenRecord={(name, row) => { setEntity(name); setRecord(row); }} />
        : adminOpen
        ? <AdminHub metadata={metadata} onOpenEntity={openEntity} />
        : calendarOpen
        ? <CalendarView metadata={metadata} userId={calendarUser?.id} userName={calendarUser?.name || calendarUser?.userName} onOpenRecord={(name, row) => { setCalendarUser(null); setEntity(name); setRecord(row); }} />
        : entity === "Email" && !isPortalUser ? <EmailInbox metadata={metadata} refresh={emailRefresh} onCompose={() => setEmailDraft({})} onOpenRecord={(row) => { if (row.status === "Draft") setEmailDraft({ id: row.id, status: "Draft" }); else setRecord(row); }} />
        : entity ? <EntityView key={entity} entity={entity} metadata={metadata} onOpenRecord={setRecord} onNavigateEntity={openEntity} fixedWhere={entityFixedWhere} />
        : isPortalUser && Array.isArray(portalSettings.dashboardLayout) && portalSettings.dashboardLayout.length ? <Dashboard entities={navEntities} metadata={metadata} user={user} refreshKey={dashboardRefreshKey} layoutOverride={portalSettings.dashboardLayout} optionsOverride={portalSettings.dashletsOptions} onOpenEntity={openEntity} onOpenRecord={(name, row) => { setEntity(name); setRecord(row); }} onCreateRecord={openQuickCreate} onComposeEmail={() => {}} />
        : isPortalUser ? <PortalHome metadata={metadata} user={user} portalName={portalName} onOpenEntity={openEntity} onOpenRecord={(name, row) => { setEntity(name); setRecord(row); }} onAvailableChange={updatePortalScopes} />
        : <Dashboard entities={entities} metadata={metadata} user={user} refreshKey={dashboardRefreshKey} onOpenEntity={openEntity} onOpenRecord={(name, row) => { setEntity(name); setRecord(row); }} onCreateRecord={openDashboardCreate} onComposeEmail={() => setEmailDraft({})} />}
      </Suspense></main>
      {record && entity === "Email" && !isPortalUser ? <EmailDrawer record={record} metadata={metadata} canCreateDocument={canCreateEntity(metadata, "Document")} canCreateFilter={canCreateEntity(metadata, "EmailFilter")} onClose={() => setRecord(null)} onChanged={() => setEmailRefresh((n) => n + 1)} onReply={(draft) => setEmailDraft(draft)} onOpenRecord={(next) => setRecord(next)} onOpenEntityRecord={(scope, row) => { setEntityFixedWhere([]); setEntity(scope); setRecord(row); }} onCreateFilter={(address) => { setRecord(null); setEntityFixedWhere([]); setEntity("EmailFilter"); setEmailFilterDraft({ from: address, name: address }); }} /> : record && entity && <RecordDrawer entity={entity} record={record} metadata={metadata} onClose={() => setRecord(null)} onChanged={(next) => setRecord(next)} onOpenRelated={(relatedEntity, relatedRecord) => { setEntityFixedWhere([]); setEntity(relatedEntity); setRecord(relatedRecord); }} onOpenPreferences={openPreferencesFor} onOpenEmailAccounts={openEmailAccountsFor} onOpenEntity={(name, where) => openEntity(name, where)} onOpenCalendar={openCalendarFor} onComposeEmail={(draft) => setEmailDraft(draft)} />}
      {emailFilterDraft && entity === "EmailFilter" && <RecordEditor entity="EmailFilter" fields={getEditorFields(metadata, "EmailFilter")} metadata={metadata} initialValues={emailFilterDraft} onClose={() => setEmailFilterDraft(null)} onSaved={() => { setEmailFilterDraft(null); setEmailRefresh((n) => n + 1); }} />}
      {quickCreateScope && <RecordEditor entity={quickCreateScope} fields={getEditorFields(metadata, quickCreateScope).filter(([name, def]) => (quickCreateLayout?.scope !== quickCreateScope || quickCreateLayout.names.includes(name)) && metadata.userAcl?.fieldTable?.[quickCreateScope]?.[name]?.read !== "no" && metadata.userAcl?.fieldTable?.[quickCreateScope]?.[name]?.edit !== "no" && !def.hidden && !def.utility && !def.disabled)} metadata={metadata} initialValues={quickCreateInitialValues} onClose={() => { setQuickCreateScope(null); setQuickCreateInitialValues({}); setQuickCreateFromDashboard(false); }} onSaved={(created) => { const scope = quickCreateScope; const fromDashboard = quickCreateFromDashboard; setQuickCreateScope(null); setQuickCreateInitialValues({}); setQuickCreateFromDashboard(false); if (fromDashboard) setDashboardRefreshKey((value) => value + 1); else { openEntity(scope); setRecord(created); } }}/>}
      {emailDraft && <EmailComposer metadata={metadata} initial={emailDraft} onClose={() => setEmailDraft(null)} onSaved={() => { setEmailDraft(null); setEmailRefresh((n) => n + 1); }} />}
      {globalSearchOpen && <GlobalSearchOverlay metadata={metadata} tabs={nativeNavItems} isAdmin={user.type === "admin" || user.type === "super-admin"} onClose={() => setGlobalSearchOpen(false)} onNavigate={(target) => { setGlobalSearchOpen(false); if (target === "__dashboard__") { setEntity(null); setCalendarOpen(false); setAdminOpen(false); setActivityOpen(false); setGlobalStreamOpen(false); setNotificationsOpen(false); setLastViewedOpen(false); setAccountPage(null); setRecord(null); } else if (target === "__calendar__") openCalendar(); else openEntity(target); }} onSelect={(name, row) => { setGlobalSearchOpen(false); openEntity(name); setRecord(row); }} />}
      <Suspense fallback={null}><PopupReminderToasts metadata={metadata} isPortalUser={isPortalUser} onOpenRecord={(scope, id) => void openNotificationRecord(scope, id)}/></Suspense>
      <footer className="app-footer"><span>ViaCRM</span><span>Vaše vztahy. Váš přehled.</span></footer>
    </section>
  </div>;
}

const adminGroups = [
  { title: "Uživatelé a oprávnění", description: "Spravujte přístup do CRM, týmy a role.", items: [{ name: "User", label: "Uživatelé", description: "Účty, typy přístupu a přihlašovací údaje", icon: Users }, { name: "ApiUser", label: "API uživatelé", description: "Účty pro napojení externích systémů", icon: FileKey }, { name: "Team", label: "Týmy", description: "Skupiny uživatelů a jejich členství", icon: Users }, { name: "Role", label: "Role", description: "Přístupová a datová oprávnění", icon: Shield }, { name: "PortalUser", label: "Uživatelé portálu", description: "Přístup zákazníků do portálu", icon: Globe }, { name: "PortalRole", label: "Role portálu", description: "Oprávnění pro portálové uživatele", icon: Shield }, { name: "AuthLogRecord", label: "Historie přihlášení", description: "Přehled přihlášení a ověření uživatelů", icon: History }, { name: "AuthToken", label: "Přístupové tokeny", description: "Platné tokeny účtů a integrací", icon: FileKey }] },
  { title: "E-mail a komunikace", description: "Poštovní účty, šablony a komunikace se zákazníky.", items: [{ name: "EmailAccount", label: "E-mailové účty", description: "Odchozí a osobní schránky", icon: Mail }, { name: "InboundEmail", label: "Příchozí e-mail", description: "Skupinové schránky a automatické zpracování", icon: InboxIcon }, { name: "EmailTemplate", label: "E-mailové šablony", description: "Opakovaně použitelné zprávy a odpovědi", icon: Mail }, { name: "EmailFilter", label: "Filtry e-mailů", description: "Pravidla pro třídění příchozí pošty", icon: SlidersHorizontal }, { name: "EmailAddress", label: "E-mailové adresy", description: "Index adres uložených v CRM", icon: AtSign }, { name: "PhoneNumber", label: "Telefonní čísla", description: "Index telefonních kontaktů", icon: Phone }] },
  { title: "Data a provoz", description: "Záznamy, automatizace a nástroje pro správu CRM.", items: [{ name: "Import", label: "Import dat", description: "Nahrání a mapování dat", icon: FileInput }, { name: "Job", label: "Plánované úlohy", description: "Fronta a stav úloh EspoCRM", icon: Workflow }, { name: "Webhook", label: "Webhooky", description: "Události odesílané do navázaných systémů", icon: Webhook }, { name: "AppLogRecord", label: "Systémový log", description: "Záznamy o chodu a chybách aplikace", icon: FileSpreadsheet }, { name: "AppSecret", label: "Tajné klíče aplikace", description: "Bezpečně uložené integrační klíče", icon: FileKey }, { name: "entityManager", label: "Správce entit", description: "Vytváření a konfigurace modulů CRM", icon: Database }, { name: "linkManager", label: "Správce vztahů", description: "Propojení entit a konfigurace relací", icon: Network }, { name: "fieldManager", label: "Správce polí", description: "Vlastní pole a jejich konfigurace pro entity", icon: SlidersHorizontal }, { name: "layoutManager", label: "Správce rozložení", description: "Upravte seznamy, formuláře a panely záznamů", icon: LayoutDashboard }, { name: "labelManager", label: "Správce popisků", description: "Překlady názvů, polí a systémových textů", icon: Languages }, { name: "systemTools", label: "Systémové nástroje", description: "Požadavky, plánované úlohy, cache a rebuild", icon: Database }, { name: "settings", label: "Nastavení systému", description: "Všechna editovatelná nastavení instalace", icon: Settings }] },
  { title: "Šablony a portál", description: "Spravujte zákaznické portály a obsah CRM.", items: [{ name: "Portal", label: "Portály", description: "Zákaznické a partnerské portály", icon: Globe }, { name: "Document", label: "Dokumenty", description: "Soubory a dokumentace přiřazená k CRM", icon: FileText }, { name: "Template", label: "PDF šablony", description: "Hlavičky, obsah, zápatí a proměnné PDF dokumentů", icon: FileText }, { name: "KnowledgeBaseArticle", label: "Články znalostní báze", description: "Návody a obsah pro zákazníky", icon: BookOpen }, { name: "DashboardTemplate", label: "Šablony dashboardu", description: "Výchozí přehledy a panely uživatelů", icon: LayoutDashboard }] },
  { title: "Systém, integrace a plánování", description: "Konfigurace služeb, synchronizace a automatizace.", items: [{ name: "Integration", label: "Integrace", description: "Nastavení připojených služeb", icon: Network }, { name: "OAuthProvider", label: "OAuth poskytovatelé", description: "Přihlašování a přístup přes OAuth", icon: Shield }, { name: "AuthenticationProvider", label: "Ověřovací poskytovatelé", description: "Konfigurace externích poskytovatelů přihlášení", icon: Shield }, { name: "Currency", label: "Měny", description: "Měny, sazby a formátování částek", icon: Banknote }, { name: "ScheduledJob", label: "Definice naplánovaných úloh", description: "Plánovač automatických úloh CRM", icon: Workflow }, { name: "ScheduledJobLogRecord", label: "Historie naplánovaných úloh", description: "Průběh a chyby automatických úloh", icon: History }, { name: "WebhookEventQueueItem", label: "Fronta webhooků", description: "Události čekající na doručení webhookem", icon: Webhook }, { name: "Extension", label: "Rozšíření", description: "Nainstalované doplňky EspoCRM", icon: Package }, { name: "ExternalAccount", label: "Externí účty", description: "Napojené externí účty uživatelů", icon: Globe }, { name: "WorkingTimeCalendar", label: "Pracovní kalendáře", description: "Pracovní doba a plánování dostupnosti", icon: CalendarDays }] },
];

function AdminHub({ metadata, onOpenEntity }: { metadata: Metadata; onOpenEntity: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("cs");
  const nativePanels = metadata.app?.adminPanel as Record<string, { label?: string; order?: number; itemList?: Array<{ label?: string; url?: string; action?: string; iconClass?: string; description?: string }> }> | undefined;
  const nativeTargets: Record<string, string> = { settings: "__settings__", userInterface: "__ui-settings__", authentication: "__auth-settings__", ScheduledJob: "ScheduledJob", scheduledJob: "ScheduledJob", currency: "__currency-settings__", notifications: "__notification-settings__", integrations: "__integrations__", extensions: "__extensions__", systemRequirements: "__system-tools__", jobsSettings: "__jobs-settings__", upgrade: "__upgrade__", clearCache: "__system-tools__", rebuild: "__system-tools__", users: "User", teams: "Team", roles: "Role", authLog: "AuthLogRecord", authTokens: "__auth-tokens__", actionHistory: "ActionHistoryRecord", apiUsers: "__api-users__", entityManager: "__entity-manager__", layouts: "__layout-manager__", labelManager: "__label-manager__", templateManager: "__template-manager__", outboundEmails: "__outbound-settings__", inboundEmails: "__inbound-settings__", groupEmailAccounts: "EmailAccount", personalEmailAccounts: "EmailAccount", emailFilters: "EmailFilter", emailFolders: "EmailFolder", emailFolder: "EmailFolder", groupEmailFolders: "GroupEmailFolder", emailTemplates: "EmailTemplate", sms: "__sms-settings__", portals: "Portal", portalUsers: "__portal-users__", portalRoles: "PortalRole", workingTimeCalendars: "WorkingTimeCalendar", workingTimeCalendar: "WorkingTimeCalendar", layoutSets: "LayoutSet", dashboardTemplates: "DashboardTemplate", dashboardTemplate: "DashboardTemplate", leadCapture: "LeadCapture", pdfTemplates: "Template", webhooks: "Webhook", addressCountries: "AddressCountry", authenticationProviders: "AuthenticationProvider", authenticationProvider: "AuthenticationProvider", import: "__import__", attachments: "Attachment", jobs: "Job", emailAddresses: "EmailAddress", phoneNumbers: "PhoneNumber", appSecrets: "AppSecret", oAuthProviders: "OAuthProvider", appLog: "AppLogRecord", formulaSandbox: "__formula-sandbox__" };
  const nativeIcons: Record<string, LucideIcon> = { cog: Settings, desktop: Monitor, "sign-in": LogIn, clock: Clock3, euro: Banknote, bell: Bell, network: Network, upload: Upload, server: Server, "list-ul": List, "arrow-alt-circle-up": ArrowRight, broom: Brush, database: Database, user: UserRound, users: Users, key: KeyRound, shield: Shield, history: History, "user-cog": FileKey, tools: Wrench, table: Table2, language: Languages, "envelope-open-text": Mail, "paper-plane": SendHorizontal, envelope: Mail, inbox: InboxIcon, filter: Filter, folder: Folder, "envelope-square": Mail, parking: Globe, calendar: CalendarDays, "th-large": LayoutDashboard, "id-card": ContactRound, "file-pdf": FileText, "share-alt": Share2, flag: Flag, code: Code2, "file-import": FileInput, paperclip: Paperclip, phone: Phone, list: FileSpreadsheet };
  const localItems = adminGroups.flatMap((group) => group.items);
  type HubItem = { name: string; label: string; description: string; icon?: LucideIcon; iconClass?: string; target?: string; disabled?: boolean };
  type HubGroup = { key?: string; title: string; description: string; items: HubItem[] };
  const nativeGroups: HubGroup[] = nativePanels ? Object.entries(nativePanels).sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999)).map(([key, panel]) => ({
    key,
    title: (metadata.labels as any)?.Admin?.labels?.[panel.label || ""] || ({ system: "Systém", users: "Uživatelé a oprávnění", customization: "Přizpůsobení", email: "E-mail a komunikace", portal: "Portál", setup: "Nastavení", data: "Data", misc: "Ostatní" }[key] || panel.label || key),
    description: "Nástroje administrace EspoCRM 9.1.7.",
    items: (panel.itemList || []).map((native) => {
      const route = native.action || native.url?.split("/").pop()?.replace(/^#/, "") || "";
      const target = nativeTargets[route];
      const local = localItems.find((item) => item.name === target || item.name.toLowerCase() === route.toLowerCase());
      const faName = (native.iconClass || "").split(/\s+/).find((part) => part.startsWith("fa-"))?.slice(3) || "database";
      return { name: target || `native-${key}-${route}`, label: (metadata.labels as any)?.Admin?.labels?.[native.label || ""] || local?.label || native.label || route, description: local?.description || (metadata.labels as any)?.Admin?.descriptions?.[native.description || ""] || native.description || "Administrační nástroj", icon: nativeIcons[faName] || local?.icon || Settings, iconClass: native.iconClass, target, disabled: !target || (target.startsWith("__") ? false : !metadata.entityDefs?.[target]?.fields) };
    }),
  })) : adminGroups.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item })) }));
  const adminGroupsWithEditors = nativeGroups.map((group) => group.key === "customization" ? { ...group, items: [...group.items, { name: "fieldManager", label: "Správce polí", description: "Vytváření a úpravy vlastních polí CRM.", icon: SlidersHorizontal, target: "__field-manager__", disabled: false }, { name: "linkManager", label: "Správce vztahů", description: "Vytváření a úpravy vztahů mezi entitami.", icon: Network, target: "__link-manager__", disabled: false }] } : group);
  const visibleGroups = adminGroupsWithEditors.map((group) => ({ ...group, items: group.items.filter((item) => !normalized || `${item.label} ${item.description} ${item.name}`.toLocaleLowerCase("cs").includes(normalized)) })).filter((group) => group.items.length);
  return <div className="admin-view"><div className="entity-heading"><div><div className="eyebrow">SPRÁVA CRM</div><h1>Administrace</h1><p>Uživatelé, oprávnění, e-mail a konfigurace systému.</p></div><span className="admin-secure"><Shield size={15}/> Přístup administrátora</span></div>
    <label className="admin-settings-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Najít správu uživatelů, šablon, logů…"/><span>{visibleGroups.reduce((sum, group) => sum + group.items.length, 0)} nástrojů</span></label>
    {visibleGroups.map((group) => <section className={`admin-group${group.key ? ` admin-group-${group.key}` : ""}`} key={group.key || group.title}><div className="admin-group-head"><div><h2>{group.title}</h2><p>{group.description}</p></div></div><div className="admin-cards">{group.items.map((item) => { const Icon = item.icon || Settings; const disabled = item.disabled ?? false;
      return <button className={`admin-card ${disabled ? "unavailable" : ""}`} key={item.name} disabled={disabled} onClick={() => { const target = item.target || ({ settings: "__settings__", fieldManager: "__field-manager__", layoutManager: "__layout-manager__", systemTools: "__system-tools__", entityManager: "__entity-manager__", linkManager: "__link-manager__", labelManager: "__label-manager__" } as Record<string, string>)[item.name] || item.name; onOpenEntity(target); }}><span className="admin-card-icon">{item.iconClass ? <EspoIcon className={item.iconClass} size={19}/> : <Icon size={19} strokeWidth={1.8}/>}</span><span className="admin-card-copy"><strong>{item.label}</strong><small>{disabled ? "Tato administrační část zatím nemá náhradní obrazovku" : item.description}</small></span><ArrowRight size={16} className="admin-card-arrow"/></button>;
    })}</div></section>)}
    <section className="admin-note"><span><Database size={17}/></span><div><strong>Data zůstávají ve vašem EspoCRM</strong><p>Administrativní změny se ukládají přímo přes API instalace.</p></div></section>
  </div>;
}

function useUnsavedChangesGuard(hasChanges: boolean, onLeave: () => void, message: string) {
  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);
  return () => { if (!hasChanges || window.confirm(message)) onLeave(); };
}

function buildSettingsPatch(changes: Row, metadata: Metadata): Row {
  const definitions = metadata.entityDefs.Settings?.fields || {};
  const payload: Row = {};
  for (const [name, value] of Object.entries(changes)) {
    const def: FieldDef = definitions[name] || {};
    if (def.type === "linkMultiple") {
      payload[`${name}Ids`] = Array.isArray(value) ? value : [];
      const columnsKey = `${name}Columns`;
      if (columnsKey in changes) payload[columnsKey] = changes[columnsKey];
      continue;
    }
    if (name.endsWith("Columns") && definitions[name.slice(0, -7)]?.type === "linkMultiple") {
      payload[name] = value;
      continue;
    }
    if (["jsonObject", "jsonArray"].includes(def.type || "") && typeof value === "string") {
      try { payload[name] = JSON.parse(value); }
      catch { throw new Error(`Pole „${fieldLabel(name, def, "Settings", metadata)}“ obsahuje neplatný JSON.`); }
    } else if (["int", "float", "currency", "enumInt", "enumFloat"].includes(def.type || "") && value !== "" && value != null) {
      payload[name] = Number(value);
    } else if (["multiEnum", "array", "arrayInt", "urlMultiple", "checklist"].includes(def.type || "") && typeof value === "string") {
      const items = value.split("\n").map((item: string) => item.trim()).filter(Boolean);
      payload[name] = def.type === "arrayInt" ? items.map(Number).filter(Number.isFinite) : items;
    } else {
      payload[name] = value;
    }
  }
  return payload;
}

function normalizeSettingsForEditor(data: Row, metadata: Metadata): Row {
  const result = { ...data };
  for (const [name, def] of Object.entries(metadata.entityDefs.Settings?.fields || {})) {
    if (def.type !== "linkMultiple") continue;
    const ids = data[`${name}Ids`];
    result[name] = Array.isArray(ids) ? ids : Array.isArray(data[name]) ? data[name] : [];
    const columns = data[`${name}Columns`];
    if (columns && typeof columns === "object") result[`${name}Columns`] = columns;
  }
  return result;
}

function linkMultipleColumns(entity: string, name: string, def: FieldDef): Record<string, string> {
  if (def.columns && typeof def.columns === "object") return def.columns;
  return entity === "Settings" && name === "oidcTeams" ? { group: "group" } : {};
}

function AdminSettings({ metadata, onBack, focus = "all" }: { metadata: Metadata; onBack: () => void; focus?: "all" | "userInterface" | "authentication" | "notifications" | "outboundEmails" | "inboundEmails" | "jobsSettings" | "currency" | "sms" }) {
  const [settings, setSettings] = useState<Row>({});
  const [original, setOriginal] = useState<Row>({});
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [settingsLayout, setSettingsLayout] = useState<DetailLayoutPanel[]>([]);
  useEffect(() => { let live = true; const layoutName = focus === "all" ? "settings" : ["userInterface", "outboundEmails", "inboundEmails", "jobsSettings", "currency", "sms"].includes(focus) ? focus : ""; Promise.all([request<Row>("Settings"), layoutName ? fetchLayout<DetailLayoutPanel[]>("Settings", layoutName).catch(() => []) : Promise.resolve([])]).then(([data, layout]) => { if (live) { const seeded = normalizeSettingsForEditor(data, metadata); const names = [...(layout || []).flatMap((panel) => (panel.rows || []).flat()).map((item) => item && typeof item === "object" ? item.name : undefined), ...(focus === "outboundEmails" ? ["smtpServer", "smtpPort", "smtpSecurity", "smtpAuth", "smtpUsername", "smtpPassword", "smtpAuthMechanism"] : [])]; for (const name of names) { const def = name ? metadata.entityDefs.Settings.fields?.[name] : undefined; if (name && def && !(name in seeded)) seeded[name] = def.default ?? (def.type === "multiEnum" ? [] : def.type === "bool" ? false : def.type === "base" ? {} : ""); } setSettings(seeded); setOriginal(seeded); setSettingsLayout(layout); } }).catch((e) => live && setError(e instanceof Error ? e.message : "Nastavení se nepodařilo načíst.")).finally(() => live && setBusy(false)); return () => { live = false; }; }, [focus, metadata]);
  const changed = Object.fromEntries(Object.entries(settings).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key])));
  const leave = useUnsavedChangesGuard(Boolean(Object.keys(changed).length), onBack, "Máte neuložené změny nastavení. Opravdu chcete odejít?");
  const layoutFieldNames = settingsLayout.flatMap((panel) => (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name ? [item.name] : []));
  const fields = useMemo(() => { const available = getFormFields(metadata, "Settings").filter(([name]) => name in settings); const extraNames = [...layoutFieldNames, ...(focus === "outboundEmails" ? ["smtpServer", "smtpPort", "smtpSecurity", "smtpAuth", "smtpUsername", "smtpPassword", "smtpAuthMechanism"] : [])]; if (["currency", "sms", "outboundEmails", "userInterface"].includes(focus)) for (const name of extraNames) { const def = metadata.entityDefs.Settings.fields?.[name]; if (def && !def.readOnly && !available.some(([field]) => field === name)) available.push([name, def]); } if (focus === "all" && layoutFieldNames.includes("addressPreview") && metadata.entityDefs.Settings.fields?.addressPreview && !available.some(([field]) => field === "addressPreview")) available.push(["addressPreview", metadata.entityDefs.Settings.fields.addressPreview]); return available; }, [metadata, settings, focus, settingsLayout]);
  const focusPattern = focus === "userInterface" ? /^(theme|logo|tab|navbar|dashboard|adminPanel|pageContentWidth|userThemes)/i : focus === "authentication" ? /^(auth|password|oauth|ldap|sso|2fa|login|apiKey|token)/i : focus === "notifications" ? /^(notification|emailNotifications|assignment|mention|stream)/i : focus === "outboundEmails" ? /^(smtp|outboundEmail|emailAddressLookup|emailAddressSelect|massEmail|emailScheduled)/i : focus === "inboundEmails" ? /^(emailMessageMaxSize|personalEmailMaxPortionSize|maxEmailAccountCount|inboundEmailMaxPortionSize)/i : focus === "jobsSettings" ? /^(job|cron|pool|queue|daemon)/i : focus === "currency" ? /^(currency|defaultCurrency|baseCurrency)/i : focus === "sms" ? /^(sms|outboundSms)/i : null;
  const filteredFields = fields.filter(([name, def]) => (!focusPattern || focusPattern.test(name)) && (!query.trim() || `${fieldLabel(name, def, "Settings", metadata)} ${name}`.toLowerCase().includes(query.trim().toLowerCase())));
  const restrictedMode = Boolean(metadata.appParams?.isRestrictedMode) && getSession()?.user.type !== "super-admin";
  const visibleFields = filteredFields.filter(([name]) => {
    if (focus === "userInterface" && name === "themeParams") return false;
    if (restrictedMode && focus === "all" && ["cronDisabled", "maintenanceMode"].includes(name)) return false;
    if (focus === "all" && ["phoneNumberPreferredCountryList", "phoneNumberExtensions"].includes(name) && !settings.phoneNumberInternational) return false;
    if (focus === "userInterface" && name === "tabColorsDisabled" && settings.scopeColorsDisabled) return false;
    return (focus !== "jobsSettings" || name !== "jobPoolConcurrencyNumber" || Boolean(settings.jobRunInParallel)) && (focus !== "currency" || name !== "currencyRates" || (settings.currencyList || []).length > 1) && (focus !== "outboundEmails" || !["smtpPort", "smtpSecurity", "smtpAuth"].includes(name) || Boolean(settings.smtpServer)) && (focus !== "outboundEmails" || !["smtpUsername", "smtpPassword", "smtpAuthMechanism"].includes(name) || Boolean(settings.smtpServer && settings.smtpAuth));
  });
  function settingsFieldDef(name: string, def: FieldDef): FieldDef {
    const restrictedFields = focus === "all" ? ["siteUrl", "useWebSocket"] : focus === "jobsSettings" ? ["jobRunInParallel", "jobMaxPortion", "jobPoolConcurrencyNumber", "daemonInterval", "daemonMaxProcessNumber", "daemonProcessTimeout"] : [];
    return restrictedMode && restrictedFields.includes(name) ? { ...def, readOnly: true } : def;
  }
  const pageTitle = focus === "userInterface" ? "Uživatelské rozhraní" : focus === "authentication" ? "Přihlášení a zabezpečení" : focus === "notifications" ? "Upozornění" : focus === "outboundEmails" ? "Odchozí e-mail" : focus === "inboundEmails" ? "Příchozí e-mail" : focus === "jobsSettings" ? "Nastavení úloh" : focus === "currency" ? "Měny" : focus === "sms" ? "SMS" : "Nastavení systému";
  const groupedFields = new Map<string, typeof filteredFields>();
  for (const field of visibleFields) {
    const name = field[0];
    const group = /^(smtp|email|outbound|inbound|imap)/i.test(name) ? "E-mail" : /^(auth|password|oauth|ldap|sso|2fa)/i.test(name) ? "Přihlášení a zabezpečení" : /^(currency|defaultCurrency|currencyFormat)/i.test(name) ? "Měny" : /^(week|working|calendar|timeZone|dateFormat|timeFormat)/i.test(name) ? "Čas a kalendáře" : /^(theme|logo|tab|navbar|dashboard|adminPanel)/i.test(name) ? "Rozhraní" : /^(notification|emailNotifications|assignment|mention)/i.test(name) ? "Upozornění" : /^(job|cron|pool|queue|daemon)/i.test(name) ? "Plánované úlohy" : /^(export|import|attachment|upload|maxFile|recordsPerPage)/i.test(name) ? "Data a limity" : "Obecné";
    groupedFields.set(group, [...(groupedFields.get(group) || []), field]);
  }
  const settingsGroups = settingsLayout.length ? settingsLayout.map((panel, index) => {
    const names = (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name ? [item.name] : []);
    const group = names.flatMap((name) => visibleFields.filter(([fieldName]) => fieldName === name));
    return { title: (metadata.labels as any)?.Settings?.labels?.[panel.label || ""] || (metadata.labels as any)?.Admin?.labels?.[panel.label || ""] || panel.label || (index ? `Další nastavení ${index + 1}` : "Nastavení"), group };
  }).filter((item) => item.group.length) : [...groupedFields].map(([title, group]) => ({ title, group }));
  if (focus === "outboundEmails") {
    const smtpNames = new Set(["smtpServer", "smtpPort", "smtpSecurity", "smtpAuth", "smtpUsername", "smtpPassword", "smtpAuthMechanism"]);
    const alreadyPlaced = new Set(settingsGroups.flatMap((item) => item.group.map(([name]) => name)));
    const smtpGroup = visibleFields.filter(([name]) => smtpNames.has(name) && !alreadyPlaced.has(name));
    if (smtpGroup.length) settingsGroups.unshift({ title: "SMTP server", group: smtpGroup });
  }
  async function save() {
    if (settings.thousandSeparator && settings.decimalMark && settings.thousandSeparator === settings.decimalMark) { setError((metadata.labels as any)?.Admin?.messages?.thousandSeparatorEqualsDecimalMark || "Oddělovač tisíců nesmí být stejný jako oddělovač desetinných míst."); return; }
    if (focus === "currency") {
      const rates = settings.currencyRates && typeof settings.currencyRates === "object" ? settings.currencyRates as Record<string, unknown> : {};
      const invalidRate = Object.entries(rates).find(([, rate]) => rate !== "" && (!Number.isFinite(Number(rate)) || Number(rate) <= 0));
      if (invalidRate) { setError(`Kurz měny ${invalidRate[0]} musí být kladné číslo větší než nula.`); return; }
    }
    if (focus === "outboundEmails" && settings.smtpServer && (!Number.isInteger(Number(settings.smtpPort)) || Number(settings.smtpPort) < 1 || Number(settings.smtpPort) > 65535)) { setError("Zadejte platný SMTP port od 1 do 65535."); return; }
    if (focus === "outboundEmails" && settings.smtpServer && settings.smtpAuth && !String(settings.smtpUsername || "").trim()) { setError("Při zapnutém SMTP ověřování je uživatelské jméno povinné."); return; }
    const emailAddressPattern = /^[-!#$%&'*+/=?^_`{|}~A-Za-z0-9]+(?:\.[-!#$%&'*+/=?^_`{|}~A-Za-z0-9]+)*@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9]$/;
    if (focus === "outboundEmails") for (const name of ["outboundEmailFromAddress", "outboundEmailBccAddress"]) {
      const value = String(settings[name] || "").trim();
      if (value && !emailAddressPattern.test(value)) { setError(`${fieldLabel(name, metadata.entityDefs.Settings.fields?.[name], "Settings", metadata)}: zadejte platnou e-mailovou adresu.`); return; }
    }
    let payload: Row;
    try { payload = buildSettingsPatch(changed, metadata); }
    catch (e) { setError(e instanceof Error ? e.message : "Nastavení obsahuje neplatnou hodnotu."); return; }
    setSaving(true); setError(""); setSaved(false);
    try { await request("Settings", { method: "PATCH", body: JSON.stringify(payload) }); const fresh = normalizeSettingsForEditor(await request<Row>("Settings"), metadata); setSettings(fresh); setOriginal(fresh); setSaved(true); if (focus === "userInterface" && ("theme" in changed || JSON.stringify(original.themeParams?.navbar) !== JSON.stringify(fresh.themeParams?.navbar))) window.location.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Nastavení se nepodařilo uložit."); }
    finally { setSaving(false); }
  }
  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={leave}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">KONFIGURACE</div><h1>{pageTitle}</h1><p>{focus === "all" ? "Změňte výchozí chování a formáty CRM." : focus === "outboundEmails" || focus === "inboundEmails" ? "Nastavení vychází z nativního rozložení EspoCRM 9.1.7." : "Upravitelná nastavení načtená z instalace EspoCRM."}</p></div><button className="button primary" onClick={() => void save()} disabled={busy || saving || !Object.keys(changed).length}><Save size={15}/>{saving ? "Ukládám…" : "Uložit změny"}</button></div>
    {error && <div className="table-error">{error}<button onClick={() => { setBusy(true); request<Row>("Settings").then((data) => { const fresh = normalizeSettingsForEditor(data, metadata); setSettings(fresh); setOriginal(fresh); }).catch(() => {}).finally(() => setBusy(false)); }}>Zkusit znovu</button></div>}{saved && <div className="save-confirm"><Check size={15}/> Nastavení bylo uloženo.</div>}
    {!busy && <label className="admin-settings-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrovat nastavení podle názvu…"/><span>{visibleFields.length} / {fields.length}</span></label>}
    {busy ? <div className="surface table-loading"><span className="spinner"/> Načítám nastavení…</div> : <div className="settings-sections">{settingsGroups.map(({ title, group }) => <section className="surface settings-card" key={title}><div className="settings-card-head"><h2>{title}</h2><p>{group.length} položek nastavení</p></div><div className="settings-fields">{group.map(([name, def]) => name === "currencyRates" ? <CurrencyRatesEditor key={name} metadata={metadata} currencies={settings.currencyList || []} baseCurrency={settings.baseCurrency} value={settings.currencyRates} onChange={(value) => setSettings((old) => ({ ...old, currencyRates: value }))}/> : name === "addressPreview" ? <AddressFormatPreview key={name} format={settings.addressFormat}/> : name === "dashboardLayout" ? <div className="field-input dashboard-layout-field" key={name}><span>{fieldLabel(name, def, "Settings", metadata)}</span><DashboardLayoutEditor value={settings.dashboardLayout} options={settings.dashletsOptions || {}} metadata={metadata} onChange={(dashboardLayout) => setSettings((old) => ({ ...old, dashboardLayout }))} onOptionsChange={(dashletsOptions) => setSettings((old) => ({ ...old, dashletsOptions }))}/></div> : focus === "userInterface" && name === "tabList" ? <div className="field-input admin-tab-list-field" key={name}><span>{fieldLabel(name, def, "Settings", metadata)}</span><AdminTabListEditor value={Array.isArray(settings.tabList) ? settings.tabList : []} metadata={metadata} onChange={(tabList) => setSettings((old) => ({ ...old, tabList }))}/></div> : focus === "outboundEmails" && ["outboundEmailFromAddress", "outboundEmailBccAddress"].includes(name) ? <SettingsEmailAddressField key={name} name={name} metadata={metadata} value={settings[name] || ""} suggestInbound={name === "outboundEmailFromAddress"} onChange={(value) => setSettings((old) => ({ ...old, [name]: value }))}/> : <FieldInput key={name} entity="Settings" metadata={metadata} name={name} def={settingsFieldDef(name, focus === "currency" && ["defaultCurrency", "baseCurrency"].includes(name) ? { ...def, options: settings.currencyList || [] } : focus === "sms" && name === "smsProvider" ? { ...def, options: [...new Set([...(Object.keys((metadata.app as any)?.smsProviders || {})), settings.smsProvider].filter(Boolean))] } : focus === "outboundEmails" && name === "smtpPort" && settings.smtpServer ? { ...def, required: true } : focus === "outboundEmails" && name === "smtpUsername" && settings.smtpServer && settings.smtpAuth ? { ...def, required: true } : def)} value={settings[name]} columns={settings[`${name}Columns`] || {}} onColumnsChange={def.type === "linkMultiple" ? (columns) => setSettings((old) => ({ ...old, [`${name}Columns`]: columns })) : undefined} themeParamsValue={settings.themeParams} onThemeParamsChange={(themeParams) => setSettings((old) => ({ ...old, themeParams }))} onChange={(value) => setSettings((old) => focus === "outboundEmails" && name === "smtpSecurity" ? { ...old, smtpSecurity: value, smtpPort: value === "SSL" ? 465 : value === "TLS" ? 587 : 25 } : { ...old, [name]: value })}/>)}</div></section>)}{!visibleFields.length && <div className="surface table-loading">Žádné nastavení neodpovídá filtru.</div>}</div>}
  </div>;
}

function AdminAuthentication({ metadata, onBack }: { metadata: Metadata; onBack: () => void }) {
  const [settings, setSettings] = useState<Row>({});
  const [original, setOriginal] = useState<Row>({});
  const [authLayout, setAuthLayout] = useState<DetailLayoutPanel[]>([]);
  const [active, setActive] = useState("general");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const authMethods = (metadata as any).authenticationMethods || {};
  const methods = Object.entries(authMethods).filter(([, method]: [string, any]) => method?.settings?.isAvailable && method.settings.fieldList?.length) as Array<[string, any]>;
  const selectedAuthMethod = String(settings.authenticationMethod || "Espo");
  const selectedMethods = methods.filter(([name]) => name === selectedAuthMethod);
  useEffect(() => { let live = true; Promise.all([request<Row>("Settings"), fetchLayout<DetailLayoutPanel[]>("Settings", "authentication")]).then(([data, layout]) => { if (live) { const normalized = normalizeSettingsForEditor(data, metadata); setSettings(normalized); setOriginal(normalized); setAuthLayout(layout || []); } }).catch((e) => live && setError(e instanceof Error ? e.message : "Nastavení nelze načíst.")).finally(() => live && setBusy(false)); return () => { live = false; }; }, [metadata]);
  useEffect(() => { if (active !== "general" && active !== selectedAuthMethod) setActive("general"); }, [active, selectedAuthMethod]);
  const allGeneralFields = useMemo(() => getFormFields(metadata, "Settings").filter(([name]) => /^(authenticationMethod|auth|password|login|apiKey|token)/i.test(name) && name in settings), [metadata, settings]);
  const generalFields = useMemo(() => { const byName = new Map(allGeneralFields.map((item) => [item[0], item] as [string, [string, FieldDef]])); const ordered = authLayout.flatMap((panel) => (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name && byName.has(item.name) ? [byName.get(item.name)!] : [])); return ordered.length ? ordered : allGeneralFields; }, [allGeneralFields, authLayout]);
  const currentMethod = methods.find(([name]) => name === active);
  const methodFieldNames: string[] = currentMethod ? [...new Set([...(currentMethod[1].settings.layout?.rows || []).flat().map((item: any) => item && typeof item === "object" ? item.name : undefined).filter(Boolean), ...(currentMethod[1].settings.fieldList || [])])] : [];
  const methodFields: Array<[string, FieldDef]> = currentMethod ? methodFieldNames.map((name) => [name, metadata.entityDefs.Settings?.fields?.[name] || { type: "varchar" }]) : [];
  const nativeAuthLogic: Row = { fields: { authIpAddressWhitelist: { visible: { conditionGroup: [{ attribute: "authIpAddressCheck", type: "isTrue" }] }, required: { conditionGroup: [{ attribute: "authIpAddressCheck", type: "isTrue" }] } }, authIpAddressCheckExcludedUsers: { visible: { conditionGroup: [{ attribute: "authIpAddressCheck", type: "isTrue" }] } } } };
  const restrictedMode = Boolean(metadata.appParams?.isRestrictedMode) && getSession()?.user.type !== "super-admin";
  const visibleAuthFields = (list: Array<[string, FieldDef]>, logic: Row, general = false): Array<[string, FieldDef]> => list.flatMap(([name, originalDef]) => {
    if (general && ["authIpAddressWhitelist", "authIpAddressCheckExcludedUsers"].includes(name) && !settings.authIpAddressCheck) return [];
    if (general && ["auth2FAForced", "auth2FAMethodList", "auth2FAInPortal"].includes(name) && !settings.auth2FA) return [];
    if (general && ["passwordRecoveryForAdminDisabled", "passwordRecoveryForInternalUsersDisabled", "passwordRecoveryNoExposure"].includes(name) && settings.passwordRecoveryDisabled) return [];
    const rule = logic.fields?.[name] || {};
    if (rule.visible?.conditionGroup && !conditionGroupMatches(rule.visible, settings)) return [];
    const def: FieldDef = { ...originalDef };
    if (general && name === "auth2FAMethodList" && settings.auth2FA) def.required = true;
    if (rule.required?.conditionGroup && conditionGroupMatches(rule.required, settings)) def.required = true;
    if ((rule.readOnly?.conditionGroup && conditionGroupMatches(rule.readOnly, settings)) || (general && restrictedMode && ["authIpAddressCheck", "authIpAddressWhitelist", "authIpAddressCheckExcludedUsers"].includes(name))) def.readOnly = true;
    const optionRules = logic.options?.[name];
    if (Array.isArray(optionRules)) { const match = optionRules.find((item: Row) => conditionGroupMatches(item, settings)); if (match) def.options = match.optionList || []; }
    return [[name, def]];
  });
  const changed = Object.fromEntries(Object.entries(settings).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key])));
  const leave = useUnsavedChangesGuard(Boolean(Object.keys(changed).length), onBack, "Máte neuložené změny přihlášení. Opravdu chcete odejít?");
  async function save() {
    let payload: Row;
    try { payload = buildSettingsPatch(changed, metadata); }
    catch (e) { setError(e instanceof Error ? e.message : "Nastavení obsahuje neplatnou hodnotu."); return; }
    setSaving(true); setError(""); setNotice("");
    try { await request("Settings", { method: "PATCH", body: JSON.stringify(payload) }); const fresh = normalizeSettingsForEditor(await request<Row>("Settings"), metadata); setSettings(fresh); setOriginal(fresh); setNotice("Nastavení autentizace bylo uloženo."); }
    catch (e) { setError(e instanceof Error ? e.message : "Nastavení nelze uložit."); } finally { setSaving(false); }
  }
  async function testLdap() {
    setTesting(true); setError(""); setNotice("");
    try { await request("Ldap/action/testConnection", { method: "POST", body: JSON.stringify({ host: settings.ldapHost, port: settings.ldapPort, useSsl: settings.ldapSecurity, useStartTls: settings.ldapSecurity, username: settings.ldapUsername, password: settings.ldapPassword, bindRequiresDn: settings.ldapBindRequiresDn, accountDomainName: settings.ldapAccountDomainName, accountDomainNameShort: settings.ldapAccountDomainNameShort, accountCanonicalForm: settings.ldapAccountCanonicalForm }) }); setNotice("Připojení k LDAP serveru funguje."); }
    catch (e) { setError(e instanceof Error ? e.message : "LDAP připojení se nezdařilo."); } finally { setTesting(false); }
  }
  const fields = visibleAuthFields(active === "general" ? generalFields : methodFields, active === "general" ? nativeAuthLogic : currentMethod?.[1].settings.dynamicLogic || {}, active === "general");
  const authGroups = active === "general" ? authLayout.map((panel, index) => {
    const names = (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name ? [item.name] : []);
    return { id: `${panel.label || "panel"}-${index}`, title: (metadata.labels as any)?.Settings?.labels?.[panel.label || ""] || (metadata.labels as any)?.Admin?.labels?.[panel.label || ""] || panel.label || "Nastavení", fields: names.flatMap((name) => fields.filter(([fieldName]) => fieldName === name)) };
  }).filter((group) => group.fields.length) : [{ id: active, title: active === "Espo" ? "EspoCRM" : active, fields }];
  function renderAuthField([name, def]: [string, FieldDef]) {
    if (name === "testConnection" && active === "LDAP") return <div className="field-input auth-test-connection" key={name}><span /><button type="button" className="button subtle" onClick={() => void testLdap()} disabled={testing}><Network size={14}/>{testing ? "Testuji…" : "Test připojení"}</button></div>;
    return <FieldInput key={name} entity="Settings" metadata={metadata} name={name} def={def} value={settings[name]} columns={settings[`${name}Columns`] || {}} onColumnsChange={def.type === "linkMultiple" ? (columns) => setSettings((old) => ({ ...old, [`${name}Columns`]: columns })) : undefined} onChange={(value) => setSettings((old) => ({ ...old, [name]: value }))}/>;
  }
  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={leave}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">PŘÍSTUP A ZABEZPEČENÍ</div><h1>Autentizace</h1><p>Nastavení přihlášení, metod ověření a zásad hesel podle konfigurace EspoCRM.</p></div><button className="button primary" onClick={() => void save()} disabled={busy || saving || !Object.keys(changed).length}><Save size={15}/>{saving ? "Ukládám…" : "Uložit změny"}</button></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    <div className="surface integration-nav auth-method-nav"><button className={active === "general" ? "active" : ""} onClick={() => setActive("general")}><Shield size={15}/><span>Obecné a hesla</span></button>{selectedMethods.map(([name]) => <button key={name} className={active === name ? "active" : ""} onClick={() => setActive(name)}><KeyRound size={15}/><span>{name === "Espo" ? "EspoCRM" : name}</span></button>)}</div>
    {busy ? <div className="surface table-loading"><span className="spinner"/> Načítám nastavení…</div> : <section className="surface settings-card auth-settings-card"><div className="settings-card-head"><h2>{active === "general" ? "Přihlášení a zásady hesel" : `${active === "Espo" ? "EspoCRM" : active} – konfigurace`}</h2></div><div className="auth-settings-groups">{authGroups.map((group) => <div className="auth-settings-group" key={group.id}>{active === "general" && <h3>{group.title}</h3>}<div className="settings-fields">{group.fields.map(renderAuthField)}</div></div>)}</div>{!fields.length && <p className="empty-state">Tato metoda nemá další lokální nastavení.</p>}</section>}
  </div>;
}

function AdminNotifications({ metadata, onBack }: { metadata: Metadata; onBack: () => void }) {
  const [settings, setSettings] = useState<Row>({});
  const [original, setOriginal] = useState<Row>({});
  const [layout, setLayout] = useState<DetailLayoutPanel[]>([]);
  const [systemNotices, setSystemNotices] = useState<Array<{ id: string; type: string; message: string }>>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    Promise.allSettled([request<Row>("Settings"), fetchLayout<DetailLayoutPanel[]>("Settings", "notifications"), request<Array<{ id: string; type: string; message: string }>>("Admin/action/adminNotificationList")]).then(([settingsResult, layoutResult, noticeResult]) => {
      if (!live) return;
      if (settingsResult.status === "fulfilled") { setSettings(settingsResult.value); setOriginal(settingsResult.value); } else setError(settingsResult.reason instanceof Error ? settingsResult.reason.message : "Nastavení nelze načíst.");
      if (layoutResult.status === "fulfilled") setLayout(layoutResult.value || []);
      if (noticeResult.status === "fulfilled") setSystemNotices(noticeResult.value || []);
    }).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, []);
  const panels = layout.map((panel) => ({ ...panel, fields: (panel.rows || []).flatMap((row) => row.filter((item): item is Exclude<LayoutItem, false> & { name: string } => Boolean(item && typeof item === "object" && "name" in item && item.name)).map((item) => [item.name, metadata.entityDefs.Settings?.fields?.[item.name] || { type: "varchar" }] as [string, FieldDef])) }));
  const changed = Object.fromEntries(Object.entries(settings).filter(([name, value]) => JSON.stringify(value) !== JSON.stringify(original[name])));
  const leave = useUnsavedChangesGuard(Boolean(Object.keys(changed).length), onBack, "Máte neuložené změny oznámení. Opravdu chcete odejít?");
  function visible(name: string) {
    if (name === "assignmentEmailNotificationsEntityList") return Boolean(settings.assignmentEmailNotifications);
    if (["adminNotificationsNewVersion", "adminNotificationsNewExtensionVersion"].includes(name)) return Boolean(settings.adminNotifications);
    if (["streamEmailNotificationsEntityList", "streamEmailNotificationsTypeList"].includes(name)) return Boolean(settings.streamEmailNotifications || settings.portalStreamEmailNotifications);
    return true;
  }
  async function save() {
    const fields = new Set(panels.flatMap((panel) => panel.fields.map(([name]) => name)));
    let payload: Row;
    try { payload = buildSettingsPatch(Object.fromEntries(Object.entries(changed).filter(([name]) => fields.has(name))), metadata); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Nastavení obsahuje neplatnou hodnotu."); return; }
    setSaving(true); setError(""); setNotice("");
    try { await request("Settings", { method: "PATCH", body: JSON.stringify(payload) }); const fresh = await request<Row>("Settings"); setSettings(fresh); setOriginal(fresh); setNotice("Nastavení oznámení bylo uloženo."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Nastavení oznámení nelze uložit."); } finally { setSaving(false); }
  }
  return <div className="admin-view"><div className="entity-heading"><div><button className="back-link" onClick={leave}><ArrowLeft size={14}/> Administrace</button><div className="eyebrow">UDÁLOSTI A UPOZORNĚNÍ</div><h1>Oznámení</h1><p>Nastavte, které události CRM doručuje v aplikaci a e-mailem.</p></div><button className="button primary" onClick={() => void save()} disabled={busy || saving || !Object.keys(changed).length}><Save size={15}/>{saving ? "Ukládám…" : "Uložit změny"}</button></div>
    {error && <div className="table-error">{error}</div>}{notice && <div className="save-confirm"><Check size={15}/>{notice}</div>}
    {busy ? <div className="surface table-loading"><span className="spinner"/> Načítám oznámení…</div> : <div className="settings-sections">{panels.map((panel, index) => { const rawLabel = (panel.label || "").replace(/^\$label:/, ""); const title = (metadata.labels as any)?.Settings?.labels?.[rawLabel] || (metadata.labels as any)?.Admin?.labels?.[rawLabel] || rawLabel || "Oznámení"; return <section className="surface settings-card" key={`${rawLabel || "notifications"}-${index}`}><div className="settings-card-head"><h2>{title}</h2><span>{panel.fields.filter(([name]) => visible(name)).length} nastavení</span></div><div className="settings-fields">{panel.fields.filter(([name]) => visible(name)).map(([name, def]) => <FieldInput key={name} entity="Settings" metadata={metadata} name={name} def={def} value={settings[name]} onChange={(value) => setSettings((old) => ({ ...old, [name]: value }))}/>)}</div></section>; })}{systemNotices.length > 0 && <section className="surface settings-card"><div className="settings-card-head"><div><h2>Systémová oznámení</h2><p>Aktuální upozornění administrace EspoCRM</p></div><span>{systemNotices.length}</span></div><div className="system-check-list">{systemNotices.map((item) => <div className="system-check-row" key={item.id}><span className={`requirement-dot ${/error|fail|critical/i.test(item.type) ? "fail" : "unknown"}`}/><span className="system-check-label"><small>{item.type}</small><strong>{item.message}</strong></span></div>)}</div></section>}</div>}
  </div>;
}

type QuickSearchTab = { label: string; target: string; admin?: boolean };
const quickAdminTargets: Record<string, string> = { users: "User", teams: "Team", roles: "Role", entityManager: "__entity-manager__", groupEmailAccounts: "EmailAccount", personalEmailAccounts: "EmailAccount", portalUsers: "__portal-users__", workingTimeCalendar: "WorkingTimeCalendar" };
function GlobalSearchOverlay({ metadata, tabs, isAdmin, onClose, onSelect, onNavigate }: { metadata: Metadata; tabs: any[]; isAdmin: boolean; onClose: () => void; onSelect: (entity: string, record: Row) => void; onNavigate: (target: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quickTabs = useMemo<QuickSearchTab[]>(() => {
    const items: QuickSearchTab[] = [];
    const add = (label: string, target: string, admin = false) => { if (label && !items.some((item) => item.target === target || item.label.toLocaleLowerCase() === label.toLocaleLowerCase())) items.push({ label, target, admin }); };
    const hasTabAccess = (scopeName: string) => {
      const scope = metadata.scopes?.[scopeName] as any;
      if (!scope || scope.disabled) return false;
      if (scope.acl) return canAccessEntity(metadata, scopeName);
      if (scope.tabAclPermission) { const level = metadata.userAcl?.[scope.tabAclPermission]; return Boolean(level && level !== "no"); }
      return true;
    };
    const walk = (list: any[]) => list.forEach((item) => {
      if (typeof item === "string") {
        if (item === "Home") add("Přehled", "__dashboard__");
        else if (item === "Calendar") add("Kalendář", "__calendar__");
        else if (item.startsWith("_") || !metadata.scopes?.[item]?.tab || !hasTabAccess(item)) return;
        else add(entityLabel(metadata, item, true), item);
      } else if (item?.type === "url") add(String(item.text || item.url || "Odkaz").replace(/^\$/, ""), `url:${item.url}`);
      else if (Array.isArray(item?.itemList)) walk(item.itemList);
    });
    walk(tabs);
    if (isAdmin) Object.values((metadata.app as any)?.adminPanel || {}).flatMap((panel: any) => panel?.itemList || []).filter((item: any) => item.tabQuickSearch && item.label && item.url).forEach((item: any) => {
      const route = String(item.url).match(/^#Admin\/([^/?#]+)/)?.[1];
      const target = route ? quickAdminTargets[route] : String(item.url).match(/^#([^/?#]+)$/)?.[1];
      if (!target) return;
      const labelKey = String(item.label).replace(/^\$label:/, "");
      const label = (metadata.labels as any)?.Admin?.labels?.[labelKey] || labelKey;
      add(label, `admin:${target}`, true);
    });
    return items;
  }, [metadata, tabs, isAdmin]);
  const matchingTabs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const matches = (item: QuickSearchTab) => { const label = item.label.toLocaleLowerCase(); return label.startsWith(normalized) || label.split(/\s+/).some((word) => word.startsWith(normalized)); };
    return quickTabs.filter(matches).sort((a, b) => Number(!a.label.toLocaleLowerCase().startsWith(normalized)) - Number(!b.label.toLocaleLowerCase().startsWith(normalized)) || a.label.length - b.label.length || a.label.localeCompare(b.label)).slice(0, 8);
  }, [query, quickTabs]);
  const selectableCount = matchingTabs.length + results.length;
  useEffect(() => {
    const normalized = query.trim();
    setResults([]); setSelectedIndex(0);
    setError("");
    if (normalized.length < 2) { setResults([]); setBusy(false); return; }
    setBusy(true);
    let live = true;
    const timer = window.setTimeout(() => {
      setBusy(true); setError("");
      const configuredMaxSize = Number(metadata.appSettings?.globalSearchMaxSize);
      const maxSize = Number.isFinite(configuredMaxSize) && configuredMaxSize > 0 ? Math.floor(configuredMaxSize) : 10;
      const params = new URLSearchParams({ q: normalized, maxSize: String(maxSize) });
      request<PageResult>(`GlobalSearch?${params}`).then((result) => { if (live) { setResults(result.list || []); setSelectedIndex(0); } }).catch((e) => live && setError(e instanceof Error ? e.message : "Vyhledávání selhalo.")).finally(() => live && setBusy(false));
    }, 240);
    return () => { live = false; window.clearTimeout(timer); };
  }, [query, metadata.appSettings?.globalSearchMaxSize]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose]);
  function selectResult(index: number) {
    const record = results[index];
    if (!record) return;
    const scope = record.entityType || record.scope || record._scope || "";
    if (scope) onSelect(scope, record);
    else setError("Výsledku chybí typ záznamu.");
  }
  function selectItem(index: number) {
    if (index < matchingTabs.length) {
      const target = matchingTabs[index].target;
      if (target.startsWith("url:")) window.location.assign(target.slice(4));
      else if (target.startsWith("admin:")) onNavigate(target.slice(6));
      else onNavigate(target);
      return;
    }
    selectResult(index - matchingTabs.length);
  }
  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && selectableCount) { event.preventDefault(); setSelectedIndex((index) => (index + 1) % selectableCount); }
    else if (event.key === "ArrowUp" && selectableCount) { event.preventDefault(); setSelectedIndex((index) => (index - 1 + selectableCount) % selectableCount); }
    else if (event.key === "Enter" && selectableCount) { event.preventDefault(); selectItem(Math.min(selectedIndex, selectableCount - 1)); }
  }
  return <div className="global-search-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="global-search-dialog" role="dialog" aria-modal="true" aria-label="Vyhledávání v CRM"><div className="global-search-input"><Search size={19}/><input autoFocus role="combobox" aria-autocomplete="list" aria-expanded={selectableCount > 0} aria-controls="global-search-results" aria-activedescendant={selectableCount ? `global-search-result-${selectedIndex}` : undefined} value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }} onKeyDown={handleSearchKeyDown} placeholder="Hledat moduly, administraci a záznamy…"/><kbd>ESC</kbd><button className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={17}/></button></div>
    {query.trim().length < 1 ? <div className="global-search-hint">Začněte psát název modulu, administrace nebo záznamu.</div> : <div className="global-search-results" id="global-search-results" role="listbox">{matchingTabs.length > 0 && <><div className="global-search-section-label">Rychlé přechody</div>{matchingTabs.map((item, index) => <button id={`global-search-result-${index}`} role="option" aria-selected={selectedIndex === index} className={`global-search-result ${selectedIndex === index ? "active" : ""}`} key={item.target} onMouseEnter={() => setSelectedIndex(index)} onClick={() => selectItem(index)}><span className="global-result-icon"><ArrowRight size={15}/></span><span><strong>{item.label}</strong><small>{item.admin ? "Administrace" : item.target.startsWith("url:") ? "Odkaz" : "Modul"}</small></span><ArrowRight size={14}/></button>)}</>}{query.trim().length >= 2 && <><div className="global-search-section-label">Záznamy</div>{busy ? <div className="global-search-state"><span className="spinner"/>Hledám v CRM…</div> : error ? <div className="global-search-state error">{error}</div> : results.length ? results.map((record, index) => { const scope = record.entityType || record.scope || record._scope || ""; const itemIndex = matchingTabs.length + index; return <button id={`global-search-result-${itemIndex}`} role="option" aria-selected={selectedIndex === itemIndex} className={`global-search-result ${selectedIndex === itemIndex ? "active" : ""}`} key={`${scope}-${record.id}-${index}`} onMouseEnter={() => setSelectedIndex(itemIndex)} onClick={() => selectItem(itemIndex)}><span className="global-result-icon"><EntityIcon name={scope} size={15}/></span><span><strong>{recordFieldDisplayValue(scope, "name", record) || record.subject || "Záznam"}</strong><small>{entityLabel(metadata, scope)}{record.accountName ? ` · ${record.accountName}` : ""}</small></span><ArrowRight size={14}/></button>; }) : <div className="global-search-state">Nenašli jsme žádné odpovídající záznamy.</div>}</>}</div>}
    <footer className="global-search-footer"><span><kbd>↵</kbd> otevřít záznam</span><span>Vyhledávání respektuje oprávnění účtu</span></footer>
  </section></div>;
}

type MailFolder = { id: string; name: string; entityId?: string; unread?: number };
const systemMailFolders: MailFolder[] = [
  { id: "inbox", name: "Doručené" }, { id: "important", name: "S hvězdičkou" },
  { id: "sent", name: "Odeslané" }, { id: "drafts", name: "Koncepty" },
  { id: "archive", name: "Archiv" }, { id: "trash", name: "Koš" }, { id: "all", name: "Všechny zprávy" },
];

function EmailInbox({ metadata, refresh, onCompose, onOpenRecord }: { metadata: Metadata; refresh: number; onCompose: () => void; onOpenRecord: (record: Row) => void }) {
  const [emailFilters, setEmailFilters] = useState({ from: "", subject: "", dateFrom: "", dateTo: "" });
  const [filterDraft, setFilterDraft] = useState({ from: "", subject: "", dateFrom: "", dateTo: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importEmlOpen, setImportEmlOpen] = useState(false);
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [groupFolders, setGroupFolders] = useState<MailFolder[]>([]);
  const [folderReload, setFolderReload] = useState(0);
  const [folderEditor, setFolderEditor] = useState<{ entity: "EmailFolder" | "GroupEmailFolder"; record?: Row } | null>(null);
  const [folderPicker, setFolderPicker] = useState<{ ids: string[]; groupOnly: boolean; allowArchive: boolean } | null>(null);
  const [folderPickerSearch, setFolderPickerSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [folderId, setFolderId] = useState("inbox");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 30;
  useEffect(() => {
    let live = true;
    const groupFolderRequest = canAccessEntity(metadata, "GroupEmailFolder") ? request<PageResult>("GroupEmailFolder?maxSize=200&offset=0&orderBy=order&order=asc").catch(() => ({ list: [], total: 0 })) : Promise.resolve({ list: [], total: 0 });
    Promise.all([request<{ list: MailFolder[] }>("EmailFolder/action/listAll?maxSize=200"), request<Record<string, number>>("Email/inbox/notReadCounts"), groupFolderRequest]).then(([folderData, countData, groupFolderData]) => {
      if (!live) return;
      setFolders((folderData.list || []).filter((folder) => !systemMailFolders.some((system) => system.id === folder.id)));
      setGroupFolders((groupFolderData.list || []).map((folder) => ({ id: `group:${folder.id}`, entityId: folder.id, name: folder.name })));
      setCounts(countData || {});
    }).catch((e) => live && setError(e instanceof Error ? e.message : "Složky schránky se nepodařilo načíst."));
    return () => { live = false; };
  }, [refresh, folderReload, metadata]);
  const load = useCallback(async () => {
    setBusy(true); setError(""); setSelected([]);
    const where: Row[] = [{ type: "inFolder", attribute: "folderId", value: folderId }];
    if (emailFilters.from.trim()) where.push({ type: "contains", attribute: "fromAddress", value: emailFilters.from.trim() });
    if (emailFilters.subject.trim()) where.push({ type: "contains", attribute: "subject", value: emailFilters.subject.trim() });
    if (emailFilters.dateFrom) where.push({ type: "after", attribute: "dateSent", value: `${emailFilters.dateFrom} 00:00:00` });
    if (emailFilters.dateTo) where.push({ type: "before", attribute: "dateSent", value: `${emailFilters.dateTo} 23:59:59` });
    const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: "dateSent", order: "desc", where: JSON.stringify(where) });
    if (search) params.set("textFilter", search);
    try { const result = await request<PageResult>(`Email?${params}`); setRows(result.list || []); setTotal(result.total > 0 ? result.total : 0); }
    catch (e) { setRows([]); setError(e instanceof Error ? e.message : "E-maily se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, [folderId, offset, search, emailFilters, refresh]);
  useEffect(() => { void load(); }, [load]);
  async function sendDraft(row: Row) {
    if (!row.id || row.status !== "Draft" || row.createdById !== getSession()?.user.id) return;
    if (!window.confirm(`Odeslat koncept „${row.subject || "(bez předmětu)"}“?`)) return;
    try { await request(`Email/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ status: "Sending" }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Koncept se nepodařilo odeslat."); }
  }
  async function bulkAction(kind: "read" | "unread" | "important" | "unimportant" | "trash" | "archive") {
    if (!selected.length) return;
    const endpoint = kind === "read" || kind === "unread" ? "Email/inbox/read" : kind === "important" || kind === "unimportant" ? "Email/inbox/important" : kind === "trash" ? "Email/inbox/inTrash" : "Email/inbox/folders/archive";
    const method = ["unread", "unimportant"].includes(kind) || kind === "trash" && folderId === "trash" ? "DELETE" : "POST";
    try { await request(endpoint, { method, body: JSON.stringify({ ids: selected }) }); await load(); request<Record<string, number>>("Email/inbox/notReadCounts").then(setCounts).catch(() => {}); }
    catch (e) { setError(e instanceof Error ? e.message : "Hromadnou akci se nepodařilo provést."); }
  }
  async function rowAction(row: Row, kind: "read" | "unread" | "trash" | "retrieve" | "archive" | "move", destination = "") {
    if (kind === "move" && destination) { await moveMessages([row.id], destination); return; }
    try {
      if (kind === "read" || kind === "unread") await request("Email/inbox/read", { method: kind === "read" ? "POST" : "DELETE", body: JSON.stringify({ id: row.id }) });
      else if (kind === "trash") await request("Email/inbox/inTrash", { method: "POST", body: JSON.stringify({ id: row.id }) });
      else if (kind === "retrieve") await request("Email/inbox/inTrash", { method: "DELETE", body: JSON.stringify({ id: row.id }) });
      else if (kind === "archive") await request("Email/inbox/folders/archive", { method: "POST", body: JSON.stringify({ id: row.id }) });
      await load();
      request<Record<string, number>>("Email/inbox/notReadCounts").then(setCounts).catch(() => {});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Akci se zprávou se nepodařilo provést."); }
  }
  async function markAllAsRead() {
    if (!window.confirm("Označit všechny e-mailové zprávy jako přečtené?")) return;
    try { await request("Email/inbox/read", { method: "POST", body: JSON.stringify({ all: true }) }); await load(); request<Record<string, number>>("Email/inbox/notReadCounts").then(setCounts).catch(() => {}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Zprávy se nepodařilo označit jako přečtené."); }
  }
  async function moveMessages(ids: string[], destination: string) {
    if (!destination || !ids.length) return;
    try {
      if (folderId === "trash") await request("Email/inbox/inTrash", { method: "DELETE", body: JSON.stringify({ ids }) });
      await request(`Email/inbox/folders/${encodeURIComponent(destination)}`, { method: "POST", body: JSON.stringify({ ids }) });
      setFolderPicker(null); setFolderPickerSearch("");
      await load();
      request<Record<string, number>>("Email/inbox/notReadCounts").then(setCounts).catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : "Zprávy se nepodařilo přesunout."); }
  }
  async function reorderFolder(entity: "EmailFolder" | "GroupEmailFolder", id: string, direction: "Up" | "Down") {
    try { await request(`${entity}/action/move${direction}`, { method: "POST", body: JSON.stringify({ id }) }); setFolderReload((value) => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Pořadí složek se nepodařilo změnit."); }
  }
  async function deleteFolder(entity: "EmailFolder" | "GroupEmailFolder", folder: MailFolder) {
    if (!window.confirm(`Opravdu odstranit složku „${folder.name}“? Zprávy ve složce zůstanou v CRM.`)) return;
    try { await request(`${entity}/${encodeURIComponent(folder.entityId || folder.id)}`, { method: "DELETE" }); if (folder.id === folderId) setFolderId("inbox"); setFolderReload((value) => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Složku se nepodařilo odstranit."); }
  }
  const currentFolder = [...systemMailFolders, ...folders, ...groupFolders].find((folder) => folder.id === folderId);
  const customFolders = [...folders, ...groupFolders].filter((folder) => folder.id !== folderId);
  const moveFolderOptions = [
    { id: "inbox", name: "Doručené", icon: <InboxIcon size={17}/> },
    ...(folderPicker?.allowArchive ? [{ id: "archive", name: "Archiv", icon: <Archive size={17}/> }] : []),
    ...(folderPicker?.groupOnly ? groupFolders : customFolders).map((folder) => ({ id: folder.id, name: folder.name, icon: folder.id.startsWith("group:") ? <Users size={17}/> : <Mail size={17}/> })),
  ].filter((folder) => folder.id !== folderId && folder.name.toLocaleLowerCase("cs-CZ").includes(folderPickerSearch.trim().toLocaleLowerCase("cs-CZ")));
  const selectedRows = rows.filter((row) => selected.includes(row.id));
  const markAsReadKind = selectedRows.length && selectedRows.every((row) => row.isRead) ? "unread" : "read";
  const markImportantKind = selectedRows.length && selectedRows.every((row) => row.isImportant) ? "unimportant" : "important";
  const renderCustomFolder = (folder: MailFolder, entityName: "EmailFolder" | "GroupEmailFolder", index: number, list: MailFolder[]) => {
    const canEdit = canChangeEntity(metadata, entityName, "edit");
    const canDelete = canChangeEntity(metadata, entityName, "delete");
    const entityId = folder.entityId || folder.id;
    return <div className="mail-folder-row" key={`${entityName}-${folder.id}`}><button className={`mail-folder ${folder.id === folderId ? "active" : ""}`} onClick={() => { setFolderId(folder.id); setOffset(0); }}><span className="mail-folder-icon">{entityName === "GroupEmailFolder" ? <Users size={14}/> : <Mail size={15}/>}</span><span>{folder.name}</span>{counts[folder.id] ? <b>{counts[folder.id]}</b> : null}</button>{(canEdit || canDelete) && <div className="mail-folder-actions">{canEdit && <><button className="icon-button" title="Posunout nahoru" aria-label={`Posunout složku ${folder.name} nahoru`} disabled={index === 0} onClick={() => void reorderFolder(entityName, entityId, "Up")}><ArrowUp size={12}/></button><button className="icon-button" title="Posunout dolů" aria-label={`Posunout složku ${folder.name} dolů`} disabled={index === list.length - 1} onClick={() => void reorderFolder(entityName, entityId, "Down")}><ArrowDown size={12}/></button><button className="icon-button" title="Upravit složku" aria-label={`Upravit složku ${folder.name}`} onClick={() => setFolderEditor({ entity: entityName, record: { ...folder, id: entityId } })}><Pencil size={12}/></button></>}{canDelete && <button className="icon-button danger-ghost" title="Odstranit složku" aria-label={`Odstranit složku ${folder.name}`} onClick={() => void deleteFolder(entityName, folder)}><Trash2 size={12}/></button>}</div>}</div>;
  };
  return <div className="mail-page">
    <header className="mail-page-heading"><div><div className="eyebrow">KOMUNIKACE</div><h1>E-mail</h1><p>Schránka, složky a zprávy propojené se záznamy CRM.</p></div><div className="mail-heading-actions">{canCreateEntity(metadata, "Email") && <button type="button" className="button subtle" onClick={() => setImportEmlOpen(true)}><FileInput size={14}/>Importovat EML</button>}<button className="button primary" onClick={onCompose}><Plus size={15}/>Napsat e-mail</button></div></header>
    <section className="mail-surface surface"><aside className="mail-sidebar"><div className="mail-sidebar-title">SCHRÁNKY</div>{systemMailFolders.map((folder) => <button key={folder.id} className={`mail-folder ${folder.id === folderId ? "active" : ""}`} onClick={() => { setFolderId(folder.id); setOffset(0); }}><span className="mail-folder-icon">{folder.id === "inbox" ? <InboxIcon size={16}/> : folder.id === "important" ? <Star size={15}/> : folder.id === "sent" ? <Send size={15}/> : folder.id === "drafts" ? <FileText size={15}/> : folder.id === "archive" ? <Archive size={15}/> : folder.id === "trash" ? <Trash2 size={15}/> : <Mail size={15}/>}</span><span>{folder.name}</span>{counts[folder.id] ? <b>{counts[folder.id]}</b> : null}</button>)}
      {(folders.length > 0 || canAccessEntity(metadata, "EmailFolder")) && <><div className="mail-sidebar-title custom-folders-title">VLASTNÍ SLOŽKY</div>{folders.map((folder, index) => renderCustomFolder(folder, "EmailFolder", index, folders))}</>}
      {(groupFolders.length > 0 || canAccessEntity(metadata, "GroupEmailFolder")) && <><div className="mail-sidebar-title custom-folders-title">SKUPINOVÉ SLOŽKY</div>{groupFolders.map((folder, index) => renderCustomFolder(folder, "GroupEmailFolder", index, groupFolders))}</>}
      <div className="mail-sidebar-foot">{folders.length} osobních · {groupFolders.length} skupinových složek</div>
      <div className="mail-folder-management">{canCreateEntity(metadata, "EmailFolder") && <button type="button" onClick={() => setFolderEditor({ entity: "EmailFolder" })}><Plus size={12}/>Nová osobní složka</button>}{canCreateEntity(metadata, "GroupEmailFolder") && <button type="button" onClick={() => setFolderEditor({ entity: "GroupEmailFolder" })}><Plus size={12}/>Nová skupinová složka</button>}</div>
    </aside><div className="mail-main"><div className="mail-toolbar"><div className="mail-folder-title"><h2>{currentFolder?.name || "E-mail"}</h2><span>{total ? total.toLocaleString("cs-CZ") : rows.length} zpráv</span></div><form className="mail-search" onSubmit={(e) => { e.preventDefault(); setOffset(0); setSearch(query.trim()); }}><Search size={15}/><input placeholder="Hledat ve zprávách" value={query} onChange={(e) => setQuery(e.target.value)}/><button type="submit" aria-label="Hledat"><ArrowRight size={14}/></button></form><button type="button" className={`mail-filter-toggle ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={14}/>Filtry{Object.values(emailFilters).some(Boolean) && <i/>}</button>{Boolean(counts[folderId]) && <button type="button" className="mail-mark-all-read" onClick={() => void markAllAsRead()}><Check size={13}/>Označit vše jako přečtené</button>}<button className="icon-button" title="Obnovit" onClick={() => void load()}><RefreshCw size={15}/></button></div>
      {filtersOpen && <form className="mail-filter-panel" onSubmit={(event) => { event.preventDefault(); if (filterDraft.dateFrom && filterDraft.dateTo && filterDraft.dateFrom > filterDraft.dateTo) { setError("Datum od musí být před datem do."); return; } setError(""); setOffset(0); setEmailFilters({ ...filterDraft }); }}><label>Odesílatel<input value={filterDraft.from} onChange={(event) => setFilterDraft((current) => ({ ...current, from: event.target.value }))} placeholder="e-mailová adresa"/></label><label>Předmět<input value={filterDraft.subject} onChange={(event) => setFilterDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="část předmětu"/></label><label>Od data<input type="date" value={filterDraft.dateFrom} onChange={(event) => setFilterDraft((current) => ({ ...current, dateFrom: event.target.value }))}/></label><label>Do data<input type="date" value={filterDraft.dateTo} onChange={(event) => setFilterDraft((current) => ({ ...current, dateTo: event.target.value }))}/></label><div><button type="button" className="button subtle" onClick={() => { const empty = { from: "", subject: "", dateFrom: "", dateTo: "" }; setFilterDraft(empty); setEmailFilters(empty); setOffset(0); }}>Vymazat</button><button type="submit" className="button primary">Použít filtry</button></div></form>}
      {selected.length > 0 && <div className="mail-bulkbar"><span>{selected.length} vybráno</span><button onClick={() => void bulkAction(markAsReadKind)}>{markAsReadKind === "read" ? "Označit jako přečtené" : "Označit jako nepřečtené"}</button><button onClick={() => void bulkAction(markImportantKind)}><Star size={14}/>{markImportantKind === "important" ? "Označit důležité" : "Odebrat důležitost"}</button><button type="button" onClick={() => { setFolderPicker({ ids: selected, groupOnly: folderId.startsWith("group:") || folderId === "all", allowArchive: folderId !== "all" }); setFolderPickerSearch(""); }}><Folder size={14}/>Přesunout do…</button><button className="mail-trash-action" onClick={() => void bulkAction("trash")}><Trash2 size={14}/>{folderId === "trash" ? "Obnovit" : "Koš"}</button></div>}
      {error && <div className="table-error">{error}<button onClick={() => void load()}>Zkusit znovu</button></div>}
      <div className="mail-list-head"><label><input type="checkbox" aria-label="Vybrat všechny zprávy na stránce" checked={rows.length > 0 && selected.length === rows.length} onChange={(e) => setSelected(e.target.checked ? rows.map((row) => row.id) : [])}/></label><span>ZPRÁVA</span><span>OD / VZTAH</span><span>DATUM</span></div>
      <div className="mail-list">{busy ? <div className="mail-loading"><span className="spinner"/>Načítám zprávy…</div> : rows.length ? rows.map((row) => <div className={`mail-row ${row.isRead ? "" : "unread"} ${selected.includes(row.id) ? "selected" : ""}`} key={row.id}>
        <label className="mail-check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(row.id)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, row.id] : old.filter((id) => id !== row.id))}/></label>
        <button className="mail-star" aria-label={row.isImportant ? "Odebrat důležitost" : "Označit jako důležité"} title={row.isImportant ? "Odebrat důležitost" : "Označit jako důležité"} onClick={async () => { try { await request("Email/inbox/important", { method: row.isImportant ? "DELETE" : "POST", body: JSON.stringify({ id: row.id }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Změna se nepodařila."); } }}><Star size={15} fill={row.isImportant ? "currentColor" : "none"}/></button>
        <button className="mail-row-main" onClick={() => onOpenRecord(row)}><span className="mail-subject">{row.subject || "(bez předmětu)"}{row.hasAttachment && <Paperclip size={13}/>}</span><span className="mail-preview">{row.personStringData || row.fromString || row.fromName || "Neznámý odesílatel"}</span></button>
        <button className="mail-related" onClick={() => onOpenRecord(row)}>{row.parentName || row.parent?.name || row.fromAddress || row.fromString || "—"}</button>
        <div className="mail-date-actions"><button className="mail-date" onClick={() => onOpenRecord(row)}>{row.dateSent ? formatMailDate(row.dateSent) : row.status === "Draft" ? "Koncept" : "—"}</button>{canChangeEntity(metadata, "Email", "edit") && <div className="mail-row-actions"><button type="button" title={row.isRead ? "Označit jako nepřečtené" : "Označit jako přečtené"} aria-label={row.isRead ? "Označit jako nepřečtené" : "Označit jako přečtené"} onClick={() => void rowAction(row, row.isRead ? "unread" : "read")}>{row.isRead ? <Mail size={13}/> : <Check size={13}/>}</button>{folderId !== "archive" && folderId !== "sent" && folderId !== "trash" && <button type="button" title="Archivovat" aria-label="Archivovat zprávu" onClick={() => void rowAction(row, "archive")}><Archive size={13}/></button>}{folderId === "trash" ? <button type="button" title="Obnovit z koše" aria-label="Obnovit zprávu z koše" onClick={() => void rowAction(row, "retrieve")}><RefreshCw size={13}/></button> : <button type="button" title="Přesunout do koše" aria-label="Přesunout zprávu do koše" onClick={() => void rowAction(row, "trash")}><Trash2 size={13}/></button>}<button type="button" title="Přesunout do složky" aria-label={`Přesunout zprávu ${row.subject || "bez předmětu"} do složky`} onClick={() => { const groupOnly = Boolean(row.groupFolderId) || !row.isUsers; setFolderPicker({ ids: [row.id], groupOnly, allowArchive: Boolean(row.groupFolderId) || Boolean(row.isUsers) }); setFolderPickerSearch(""); }}><Folder size={13}/></button></div>}{row.status === "Draft" && row.createdById === getSession()?.user.id && !row.inTrash && <button className="mail-draft-send" title="Odeslat koncept" aria-label={`Odeslat koncept ${row.subject || "bez předmětu"}`} onClick={() => void sendDraft(row)}><SendHorizontal size={13}/></button>}{row.status === "Draft" && canChangeEntity(metadata, "Email", "edit") && <button className="mail-draft-edit" title="Upravit koncept" aria-label={`Upravit koncept ${row.subject || "bez předmětu"}`} onClick={() => onOpenRecord(row)}><Pencil size={12}/></button>}</div>
      </div>) : <div className="mail-empty"><Mail size={25}/><strong>Žádné zprávy</strong><span>Ve složce „{currentFolder?.name || "E-mail"}“ zatím nic není.</span></div>}</div>
      <div className="mail-pagination"><span>{rows.length ? `${offset + 1}–${offset + rows.length}` : "0"}{total ? ` z ${total}` : " zpráv"}</span><div><button disabled={!offset || busy} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ChevronLeft size={15}/></button><button disabled={busy || total > 0 && offset + rows.length >= total || rows.length < pageSize} onClick={() => setOffset(offset + pageSize)}><ChevronRight size={15}/></button></div></div>
    </div></section>
    {folderPicker && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setFolderPicker(null)}><section className="record-modal mail-folder-picker" role="dialog" aria-modal="true" aria-labelledby="mail-folder-picker-title"><div className="modal-heading"><div><span className="eyebrow">PŘESUN ZPRÁV</span><h2 id="mail-folder-picker-title">Vybrat cílovou složku</h2><p>{folderPicker.ids.length === 1 ? "Zpráva bude přesunuta do zvolené složky." : `${folderPicker.ids.length} zpráv bude přesunuto do zvolené složky.`}</p></div><button type="button" className="icon-button" onClick={() => setFolderPicker(null)} aria-label="Zavřít"><X size={16}/></button></div><label className="mail-folder-picker-search"><Search size={16}/><input autoFocus value={folderPickerSearch} onChange={(event) => setFolderPickerSearch(event.target.value)} placeholder="Filtrovat složky…"/></label><div className="mail-folder-picker-options">{moveFolderOptions.length ? moveFolderOptions.map((folder) => <button type="button" key={folder.id} onClick={() => void moveMessages(folderPicker.ids, folder.id)}><span className="mail-folder-picker-icon">{folder.icon}</span><span>{folder.name}</span><ArrowRight size={15}/></button>) : <div className="mail-empty"><Folder size={23}/><strong>Žádné cílové složky</strong><span>Zkuste upravit hledaný výraz.</span></div>}</div><div className="modal-footer"><button type="button" className="button subtle" onClick={() => setFolderPicker(null)}>Zrušit</button></div></section></div>}
    {folderEditor && <RecordEditor entity={folderEditor.entity} fields={getEditorFields(metadata, folderEditor.entity)} metadata={metadata} record={folderEditor.record} onClose={() => setFolderEditor(null)} onSaved={() => { setFolderEditor(null); setFolderReload((value) => value + 1); }}/ >}{importEmlOpen && <EmailEmlImportDialog onClose={() => setImportEmlOpen(false)} onImported={(id) => { setImportEmlOpen(false); onOpenRecord({ id }); void load(); }}/ >}
  </div>;
}

function EmailEmlImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function importFile() {
    if (!file || !/\.eml$/i.test(file.name)) { setError("Vyberte soubor s příponou .eml."); return; }
    setBusy(true); setError("");
    try {
      const attachment = await uploadAttachment(file, "ImportEml", "file");
      const result = await request<{ id: string }>("Email/importEml", { method: "POST", body: JSON.stringify({ fileId: attachment.id }) });
      if (!result.id) throw new Error("Importovaný e-mail se nepodařilo otevřít.");
      onImported(result.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Soubor EML se nepodařilo importovat."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><section className="record-modal email-eml-dialog"><div className="modal-heading"><div><span className="eyebrow">IMPORT ZPRÁVY</span><h2>Importovat EML</h2><p>Načtěte zprávu ze souboru EML do schránky CRM.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Zavřít"><X size={16}/></button></div><label className="email-eml-picker"><span>Soubor EML</span><input type="file" accept=".eml,message/rfc822" disabled={busy} onChange={(event) => { const selected = event.target.files?.[0] || null; setFile(selected); setError(""); }}/>{file && <small>{file.name} · {(file.size / 1024).toLocaleString("cs-CZ", { maximumFractionDigits: 0 })} kB</small>}</label>{error && <div className="inline-error">{error}</div>}<div className="modal-footer"><button type="button" className="button subtle" disabled={busy} onClick={onClose}>Zrušit</button><button type="button" className="button primary" disabled={busy || !file} onClick={() => void importFile()}>{busy ? "Importuji…" : "Importovat zprávu"}<FileInput size={14}/></button></div></section></div>;
}

type EmailThreadEntry = { id: string; subject?: string; fromString?: string; personStringData?: string; dateSent?: string; status?: string; repliedId?: string; threadDepth?: number };

async function loadEmailThread(start: Row): Promise<EmailThreadEntry[]> {
  const select = "id,subject,fromString,personStringData,dateSent,status,repliedId";
  const visited = new Set<string>();
  let root: EmailThreadEntry = start as EmailThreadEntry;
  while (root.repliedId && !visited.has(root.repliedId)) {
    visited.add(root.id);
    const parentId = root.repliedId;
    root = await request<EmailThreadEntry>(`Email/${encodeURIComponent(parentId)}?select=${encodeURIComponent(select)}`);
  }
  const byId = new Map<string, EmailThreadEntry>([[root.id, root]]);
  const queue = [root.id];
  while (queue.length) {
    const parents = queue.splice(0, queue.length).filter((id) => !visited.has(`replies:${id}`));
    if (!parents.length) break;
    parents.forEach((id) => visited.add(`replies:${id}`));
    const childLists = await Promise.all(parents.map(async (id) => {
      const result: EmailThreadEntry[] = [];
      const pageSize = 100;
      for (let offset = 0; ; offset += pageSize) {
        const params = new URLSearchParams({ maxSize: String(pageSize), offset: String(offset), orderBy: "dateSent", order: "asc", select });
        const page = await request<{ list?: EmailThreadEntry[]; total?: number }>(`Email/${encodeURIComponent(id)}/replies?${params}`);
        const current = page.list || [];
        result.push(...current);
        if (current.length < pageSize || typeof page.total === "number" && page.total >= 0 && offset + current.length >= page.total) break;
      }
      return result;
    }));
    for (const children of childLists) for (const child of children) {
      if (!child.id || byId.has(child.id)) continue;
      byId.set(child.id, child);
      queue.push(child.id);
    }
  }
  // Keep the selected message in the thread even if its parent relation is not readable.
  if (start.id && !byId.has(start.id)) byId.set(start.id, start as EmailThreadEntry);
  const result: EmailThreadEntry[] = [];
  const appended = new Set<string>([root.id]);
  const append = (parentId: string, depth: number) => {
    const children = [...byId.values()].filter((row) => row.repliedId === parentId).sort((a, b) => String(a.dateSent || "").localeCompare(String(b.dateSent || "")));
    for (const child of children) {
      if (appended.has(child.id)) continue;
      appended.add(child.id);
      result.push({ ...child, threadDepth: depth });
      append(child.id, depth + 1);
    }
  };
  result.push(root);
  append(root.id, 1);
  return result;
}

function EmailDrawer({ record: initial, metadata, onClose, onChanged, onReply, onCreateFilter, onOpenRecord, onOpenEntityRecord, canCreateFilter, canCreateDocument }: { record: Row; metadata: Metadata; onClose: () => void; onChanged: () => void; onReply: (draft: Row) => void; onCreateFilter: (address: string) => void; onOpenRecord: (record: Row) => void; onOpenEntityRecord: (entity: string, record: Row) => void; canCreateFilter: boolean; canCreateDocument: boolean }) {
  const [record, setRecord] = useState(initial);
  const [eventCreateInitial, setEventCreateInitial] = useState<Row | null>(null);
  const [thread, setThread] = useState<EmailThreadEntry[]>([]);
  const [threadBusy, setThreadBusy] = useState(true);
  const [threadError, setThreadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const [documentDraft, setDocumentDraft] = useState<Row | null>(null);
  const [moveTargets, setMoveTargets] = useState<Row[] | null>(null);
  const [moveSearch, setMoveSearch] = useState("");
  useEffect(() => {
    let live = true;
    setBusy(true);
    request<Row>(`Email/${initial.id}`).then(async (data) => { if (!live) return; setRecord(data); if (!data.isRead && data.status !== "Draft") { await request("Email/inbox/read", { method: "POST", body: JSON.stringify({ id: initial.id }) }); setRecord((old) => ({ ...old, isRead: true })); } }).catch((e) => live && setError(e instanceof Error ? e.message : "Zprávu se nepodařilo načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [initial.id]);
  useEffect(() => {
    let live = true;
    setThreadBusy(true); setThreadError("");
    request<Row>(`Email/${initial.id}`).then((message) => loadEmailThread(message)).then((items) => { if (live) setThread(items); })
      .catch((cause) => live && setThreadError(cause instanceof Error ? cause.message : "Konverzaci se nepodařilo načíst."))
      .finally(() => live && setThreadBusy(false));
    return () => { live = false; };
  }, [initial.id]);
  async function action(path: string, method = "POST") { setError(""); try { await request(path, { method, body: JSON.stringify({ id: record.id }) }); onChanged(); if (path.includes("inTrash")) onClose(); if (path.includes("important")) setRecord((old) => ({ ...old, isImportant: method === "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Akci se nepodařilo provést."); } }
  async function openMovePicker() {
    setError(""); setMoveSearch("");
    try {
      const result = await request<{ list: Row[] }>("EmailFolder/action/listAll");
      const groupOnly = Boolean(record.groupFolderId) || !record.isUsers;
      const noArchive = !record.groupFolderId && !record.isUsers;
      const builtIn = new Set(["all", "inbox", "important", "sent", "drafts", "trash", "archive"]);
      const currentId = record.inTrash ? "trash" : record.inArchive ? "archive" : record.groupFolderId ? `group:${record.groupFolderId}` : record.folderId || "inbox";
      const options: Row[] = [{ id: "inbox", name: groupOnly ? "Všechny zprávy" : "Doručené" }];
      if (!noArchive) options.push({ id: "archive", name: "Archiv" });
      options.push(...(result.list || []).filter((item) => !builtIn.has(item.id) && (!groupOnly || String(item.id).startsWith("group:"))));
      setMoveTargets(options.filter((item) => item.id !== currentId));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Složky se nepodařilo načíst."); }
  }
  async function moveDetail(destination: string) {
    setBusy(true); setError("");
    try {
      await request(`Email/inbox/folders/${encodeURIComponent(destination)}`, { method: "POST", body: JSON.stringify({ id: record.id }) });
      const updated = await request<Row>(`Email/${encodeURIComponent(record.id)}`);
      setRecord(updated); setMoveTargets(null); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Zprávu se nepodařilo přesunout."); }
    finally { setBusy(false); }
  }
  function replyDraft(mode: "reply" | "replyAll" | "forward") {
    const reply = mode === "reply" || mode === "replyAll";
    const subject = String(record.subject || "");
    const safeBody = DOMPurify.sanitize(String(record.body || ""), { USE_PROFILES: { html: true } });
    const plainBody = record.bodyPlain || new DOMParser().parseFromString(safeBody, "text/html").body.textContent || "";
    onReply({ to: reply ? record.fromAddress || record.fromString || "" : "", cc: mode === "replyAll" ? Array.isArray(record.ccEmailAddresses) ? record.ccEmailAddresses.join(", ") : record.ccEmailAddresses || "" : "", subject: `${mode === "forward" ? "Fwd" : "Re"}: ${subject.replace(/^(re|fwd):\s*/i, "")}`, body: `\n\n${mode === "forward" ? "---------- Přeposlaná zpráva ----------" : "---------- Původní zpráva ----------"}\nOd: ${record.fromString || record.fromAddress || ""}\nDatum: ${record.dateSent || ""}\nPředmět: ${subject}\n\n${plainBody}`, ...(reply ? { repliedId: record.id, inReplyTo: record.messageId } : {}) });
  }
  const attachmentIds: string[] = Array.isArray(record.attachmentsIds) ? record.attachmentsIds : Array.isArray(record.attachments) ? record.attachments.map((item: Row) => item.id) : [];
  const attachmentNames: Record<string, string> = record.attachmentsNames || {};
  async function createDocumentFromAttachment(id: string) {
    setDocumentBusy(true); setError(""); setDocumentPickerOpen(false);
    try {
      const copied = await request<Row>(`Attachment/copy/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ relatedType: "Document", field: "file" }) });
      const name = copied.name || attachmentNames[id] || "Dokument";
      const initialValues: Row = { name, file: { id: copied.id, name }, fileId: copied.id, fileName: name };
      if (record.accountId) {
        initialValues.accounts = [record.accountId];
        initialValues.accountsIds = [record.accountId];
        initialValues.accountsNames = { [record.accountId]: record.accountName || "" };
      }
      setDocumentDraft(initialValues);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Přílohu e-mailu se nepodařilo uložit jako dokument."); }
    finally { setDocumentBusy(false); }
  }
  function createCalendarEvent() {
    const eventData = record.icsEventData || {};
    const attributes: Row = { ...(eventData.valueMap || {}) };
    attributes.parentId = record.parentId || null;
    attributes.parentType = record.parentType || null;
    attributes.parentName = record.parentName || null;
    const fromAddress = record.from;
    const fromId = record.idHash?.[fromAddress];
    const fromType = record.typeHash?.[fromAddress];
    const fromName = record.nameHash?.[fromAddress];
    const attendeeField = fromType === "User" ? "users" : fromType === "Contact" ? "contacts" : fromType === "Lead" ? "leads" : "";
    if (attendeeField && fromId && canAccessEntity(metadata, fromType)) {
      const idsKey = `${attendeeField}Ids`;
      const namesKey = `${attendeeField}Names`;
      attributes[idsKey] = [...new Set([...(attributes[idsKey] || []), fromId])];
      attributes[namesKey] = { ...(attributes[namesKey] || {}), [fromId]: fromName || fromAddress };
    }
    setEventCreateInitial(attributes);
  }
  const safeHtml = DOMPurify.sanitize(String(record.body || ""), { USE_PROFILES: { html: true } });
  return <><button className="drawer-backdrop" onClick={onClose} aria-label="Zavřít e-mail"/><aside className="record-drawer email-drawer">
    <div className="drawer-top"><span className="eyebrow">E-MAIL · ZPRÁVA</span><div>
      <button className="icon-button" title="Důležité" onClick={() => void action("Email/inbox/important", record.isImportant ? "DELETE" : "POST")}><Star size={15} fill={record.isImportant ? "currentColor" : "none"}/></button>
      {canChangeEntity(metadata, "Email", "edit") && <button className="icon-button" title="Přesunout do složky" aria-label="Přesunout e-mail do složky" onClick={() => void openMovePicker()}><Folder size={15}/></button>}
      <button className="icon-button" title="Archivovat" onClick={() => void action("Email/inbox/folders/archive")}><Archive size={15}/></button>
      <button className="icon-button danger-ghost" title={record.inTrash ? "Obnovit ze smazaných" : "Přesunout do koše"} onClick={() => void action("Email/inbox/inTrash", record.inTrash ? "DELETE" : "POST")}><Trash2 size={15}/></button>
      <button className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={17}/></button>
    </div></div>
    {error && <div className="inline-error">{error}</div>}
    {busy ? <div className="table-loading"><span className="spinner"/> Načítám zprávu…</div> : <>
      <div className="email-detail-heading">
        <div className="email-detail-actions">
          <button className="button primary" onClick={() => replyDraft("reply")}><Reply size={14}/>Odpovědět</button>
          <button className="button" onClick={() => replyDraft("replyAll")}><ReplyAll size={14}/>Všem</button>
          <button className="button" onClick={() => replyDraft("forward")}><ArrowRight size={14}/>Přeposlat</button>
          {canCreateDocument && attachmentIds.length > 0 && <button className="button subtle" onClick={() => attachmentIds.length === 1 ? void createDocumentFromAttachment(attachmentIds[0]) : setDocumentPickerOpen(true)} disabled={documentBusy}><FileText size={14}/>{documentBusy ? "Připravuji dokument…" : "Uložit přílohu jako dokument"}</button>}
        </div>
        <h2>{record.subject || "(bez předmětu)"}</h2>
        <div className="email-detail-meta">
          <span><b>Od</b>{record.fromString || record.fromAddress || "—"}{canCreateFilter && record.fromAddress && <button type="button" className="email-create-filter-link" onClick={() => onCreateFilter(String(record.fromAddress))}><SlidersHorizontal size={11}/>Vytvořit filtr</button>}</span>
          <span><b>Komu</b>{record.to || record.toEmailAddresses || "—"}</span>
          {record.cc && <span><b>Kopie</b>{record.cc}</span>}
          <span><b>Datum</b>{formatDate(record.dateSent)}</span>
          {record.parentName && <span><b>Záznam</b>{record.parentName}</span>}
        </div>
      </div>
      <EmailEventPanel record={record} metadata={metadata} onCreate={createCalendarEvent} onOpenRecord={onOpenEntityRecord}/>
      {(threadBusy || threadError || thread.length > 1) && <section className="email-thread-panel"><div className="email-thread-head"><div><strong>Konverzace</strong><small>{threadBusy ? "Načítám návazné zprávy…" : threadError || `${thread.length} zpráv`}</small></div>{threadBusy && <span className="spinner"/>}</div>{!threadBusy && thread.map((item) => <button type="button" className={`email-thread-item${item.id === record.id ? " active" : ""}`} key={item.id} style={{ marginLeft: `${Math.min(item.threadDepth || 0, 6) * 12}px` }} aria-current={item.id === record.id ? "page" : undefined} onClick={() => item.id !== record.id && onOpenRecord(item as Row)}><span className="email-thread-dot"/><span className="email-thread-copy"><strong>{item.subject || "(bez předmětu)"}</strong><small>{item.personStringData || item.fromString || "E-mail"}</small></span><time>{item.dateSent ? formatMailDate(item.dateSent) : item.status === "Draft" ? "Koncept" : "—"}</time></button>)}</section>}
      {attachmentIds.length > 0 && <div className="email-attachments">{attachmentIds.map((id) => <button key={id} onClick={() => void downloadAttachment(id, attachmentNames[id] || "priloha")}><Paperclip size={14}/>{attachmentNames[id] || "Příloha"}<span>Stáhnout</span></button>)}</div>}
      {record.isHtml ? <div className="email-body-html" dangerouslySetInnerHTML={{ __html: safeHtml }}/> : <pre className="email-body-plain">{record.bodyPlain || record.body || ""}</pre>}
    </>}
    <div className="drawer-meta"><span>Stav</span><b>{record.status === "Draft" ? "Koncept" : record.isRead ? "Přečteno" : "Nepřečteno"}</b><span>Odesláno</span><b>{formatDate(record.dateSent)}</b></div>
  </aside>
    {moveTargets && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMoveTargets(null)}><section className="record-modal mail-folder-picker" role="dialog" aria-modal="true" aria-labelledby="email-detail-folder-title"><div className="modal-heading"><div><span className="eyebrow">PŘESUN E-MAILU</span><h2 id="email-detail-folder-title">Vybrat cílovou složku</h2><p>Zpráva bude přesunuta do zvolené složky.</p></div><button type="button" className="icon-button" onClick={() => setMoveTargets(null)} aria-label="Zavřít"><X size={16}/></button></div><label className="mail-folder-picker-search"><Search size={16}/><input autoFocus value={moveSearch} onChange={(event) => setMoveSearch(event.target.value)} placeholder="Filtrovat složky…"/></label><div className="mail-folder-picker-options">{moveTargets.filter((folder) => String(folder.name || "").toLocaleLowerCase("cs-CZ").includes(moveSearch.trim().toLocaleLowerCase("cs-CZ"))).map((folder) => <button type="button" key={folder.id} disabled={busy} onClick={() => void moveDetail(folder.id)}><span className="mail-folder-picker-icon">{folder.id === "inbox" ? <InboxIcon size={17}/> : folder.id === "archive" ? <Archive size={17}/> : String(folder.id).startsWith("group:") ? <Users size={17}/> : <Mail size={17}/>}</span><span>{folder.name}</span><ArrowRight size={15}/></button>)}{moveTargets.every((folder) => !String(folder.name || "").toLocaleLowerCase("cs-CZ").includes(moveSearch.trim().toLocaleLowerCase("cs-CZ"))) && <div className="mail-empty"><Folder size={23}/><strong>Žádné cílové složky</strong><span>Zkuste upravit hledaný výraz.</span></div>}</div><div className="modal-footer"><button type="button" className="button subtle" onClick={() => setMoveTargets(null)} disabled={busy}>Zrušit</button></div></section></div>}
    {documentPickerOpen && <div className="modal-backdrop attachment-choice-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDocumentPickerOpen(false)}><section className="record-modal attachment-choice-modal" role="dialog" aria-modal="true" aria-label="Vybrat přílohu pro dokument"><div className="modal-heading"><div><span className="eyebrow">PŘÍLOHY E-MAILU</span><h2>Vyberte soubor</h2></div><button type="button" className="icon-button" aria-label="Zavřít" onClick={() => setDocumentPickerOpen(false)}><X size={16}/></button></div><div className="attachment-choice-list">{attachmentIds.map((id) => <button key={id} type="button" onClick={() => void createDocumentFromAttachment(id)}><Paperclip size={15}/><span>{attachmentNames[id] || "Příloha"}</span><ArrowRight size={14}/></button>)}</div><div className="modal-footer"><button type="button" className="button subtle" onClick={() => setDocumentPickerOpen(false)}>Zrušit</button></div></section></div>}
    {eventCreateInitial && <RecordEditor key={`${record.id}-ics-event`} entity="Meeting" fields={getEditorFields(metadata, "Meeting")} metadata={metadata} initialValues={eventCreateInitial} onClose={() => setEventCreateInitial(null)} onSaved={() => { setEventCreateInitial(null); onChanged(); void request<Row>(`Email/${encodeURIComponent(record.id)}`).then(setRecord).catch((cause) => setError(cause instanceof Error ? cause.message : "E-mail se schůzkou se nepodařilo obnovit.")); }}/ >}
    {documentDraft && <RecordEditor entity="Document" fields={getEditorFields(metadata, "Document")} metadata={metadata} initialValues={documentDraft} onClose={() => setDocumentDraft(null)} onSaved={() => { setDocumentDraft(null); onChanged(); }}/ >}
  </>;
}

function Dashboard({ entities, metadata, user, refreshKey, onOpenEntity, onOpenRecord, onCreateRecord, onComposeEmail, layoutOverride, optionsOverride }: { entities: string[]; metadata: Metadata; user: User; refreshKey: number; onOpenEntity: (name: string) => void; onOpenRecord: (name: string, row: Row) => void; onCreateRecord: (scope: string) => void; onComposeEmail: () => void; layoutOverride?: unknown; optionsOverride?: Row }) {
  return <PersonalDashboard user={user} metadata={metadata} refreshKey={refreshKey} onOpenRecord={onOpenRecord} onCreateRecord={onCreateRecord} onComposeEmail={onComposeEmail} layoutOverride={layoutOverride} optionsOverride={optionsOverride} fallback={<ClassicDashboard entities={entities} metadata={metadata} onOpenEntity={onOpenEntity} onOpenRecord={onOpenRecord}/>} />;
}

function ClassicDashboard({ entities, metadata, onOpenEntity, onOpenRecord }: { entities: string[]; metadata: Metadata; onOpenEntity: (name: string) => void; onOpenRecord: (name: string, row: Row) => void }) {
  const [stats, setStats] = useState<{ name: string; count: number | string; entity: string; tone: string }[]>([]);
  const [recent, setRecent] = useState<{ entity: string; row: Row }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const names = ["Account", "Contact", "Lead", "Opportunity"].filter((n) => entities.includes(n));
    Promise.all(names.map(async (entity) => {
      const result = await request<PageResult>(`${entity}?maxSize=5&offset=0&orderBy=modifiedAt&order=desc`);
      return { entity, result };
    })).then((values) => {
      if (!live) return;
      setStats(values.map(({ entity, result }, i) => ({ name: entityLabel(metadata, entity, true), count: typeof result.total === "number" && result.total >= 0 ? result.total : "—", entity, tone: ["blue", "violet", "amber", "green"][i] })));
      setRecent(values.flatMap(({ entity, result }) => result.list.slice(0, 4).map((row) => ({ entity, row }))).sort((a, b) => String(b.row.modifiedAt || b.row.createdAt || "").localeCompare(String(a.row.modifiedAt || a.row.createdAt || ""))).slice(0, 7));
    }).catch((e) => live && setError(e instanceof Error ? e.message : "Dashboard se nepodařilo načíst."));
    return () => { live = false; };
  }, [entities]);

  const today = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return <div className="dashboard-view">
    <div className="welcome-row"><div><span className="eyebrow">{today.toLocaleUpperCase("cs-CZ")}</span><h1>Dobrý den, <span>vítáme vás.</span></h1><p>Tady je přehled toho, co se děje ve vašem CRM.</p></div><div className="welcome-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><span>v</span><i>✦</i></div></div>
    {error && <div className="inline-error">{error}</div>}
    <div className="section-head"><div><h2>Váš přehled</h2><p>Aktuální stav důležitých záznamů</p></div><span className="live-label"><i/> AKTUÁLNÍ DATA</span></div>
    <div className="stat-grid">{stats.map((item) => <button className="stat-card" key={item.entity} onClick={() => onOpenEntity(item.entity)}><span className={`stat-icon ${item.tone}`}><EntityIcon name={item.entity} size={17}/></span><span className="stat-label">{item.name}</span><strong>{item.count}</strong><span className="stat-foot">Zobrazit záznamy <b><ArrowRight size={13}/></b></span></button>)}</div>
    <div className="dashboard-grid">
      <section className="surface recent-card"><div className="card-heading"><div><h2>Nedávná aktivita</h2><p>Poslední změněné záznamy napříč CRM</p></div><span className="activity-mark"><Activity size={15}/></span></div>
        {recent.length ? <div className="recent-list">{recent.map(({ entity, row }, i) => <button className="recent-row" key={`${entity}-${row.id}-${i}`} onClick={() => onOpenRecord(entity, row)}><span className={`recent-icon tone-${i % 4}`}><EntityIcon name={entity} size={15}/></span><span className="recent-info"><strong>{row.name || row.subject || [row.firstName, row.lastName].filter(Boolean).join(" ") || "Bez názvu"}</strong><small>{entityLabel(metadata, entity)}{row.accountName ? ` · ${row.accountName}` : ""}</small></span><span className="recent-date">{formatDate(row.modifiedAt || row.createdAt)}</span><span className="row-arrow"><ArrowRight size={14}/></span></button>)}</div> : <EmptyState label="Zatím tu nejsou žádné záznamy" />}
        {entities.includes("Account") && <button className="text-link" onClick={() => onOpenEntity("Account")}>Otevřít firmy <span>→</span></button>}
      </section>
      <section className="surface shortcuts-card"><div className="card-heading"><div><h2>Rychlý přístup</h2><p>Pokračujte tam, kde pracujete</p></div><span className="activity-mark"><Clock3 size={15}/></span></div><div className="shortcut-list">{entities.slice(0, 7).map((entity) => <button key={entity} className="shortcut" onClick={() => onOpenEntity(entity)}><span className="shortcut-icon"><EntityIcon name={entity} size={14}/></span><span>{entityLabel(metadata, entity, true)}</span><b><ArrowRight size={13}/></b></button>)}</div></section>
    </div>
    <div className="powered-line">Propojeno s EspoCRM <span>·</span> Data zůstávají ve vašem CRM</div>
  </div>;
}

type ActivityEvent = { id: string; recordId: string; scope: string; title?: string; name?: string; dateStart?: string; dateEnd?: string; dateStartDate?: string; dateEndDate?: string; isWorkingRange?: boolean; isNonWorkingRange?: boolean; isBusyRange?: boolean; status?: string; [key: string]: any };

function calendarZonedDateTime(date: Date, timeZone: string) {
  const target = { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
  const targetWallTime = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);
  let timestamp = targetWallTime;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let index = 0; index < 3; index++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    const representedWallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    timestamp += targetWallTime - representedWallTime;
  }
  return new Date(timestamp);
}

function espocrmDateTime(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")} ${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}:${String(value.getUTCSeconds()).padStart(2, "0")}`;
}

function parseEspoCalendarDateTime(value: string) {
  const normalized = value.replace(" ", "T");
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);
}

function dateKeyInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function calendarWallDateAsUtc(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

function calendarModeForUi(mode: string): "day" | "week" | "month" | "agenda" | "timeline" {
  if (["agendaDay", "basicDay", "timeGridDay", "dayGridDay"].includes(mode)) return "day";
  if (["agendaWeek", "basicWeek", "timeGridWeek", "dayGridWeek"].includes(mode)) return "week";
  if (["month", "dayGridMonth"].includes(mode)) return "month";
  if (["listDay", "listWeek", "agenda"].includes(mode)) return "agenda";
  if (mode === "timeline") return "timeline";
  return (["day", "week", "month", "agenda", "timeline"] as string[]).includes(mode) ? mode as "day" | "week" | "month" | "agenda" | "timeline" : "week";
}

function nativeCalendarMode(mode: string, metadata: Metadata): string {
  const available = metadata.clientDefs?.Calendar?.modeList;
  const options = Array.isArray(available) && available.length ? available.map(String) : ["month", "agendaWeek", "agendaDay", "timeline", "listWeek"];
  const candidates: Record<string, string[]> = {
    day: ["agendaDay", "basicDay", "timeGridDay", "dayGridDay"],
    week: ["agendaWeek", "basicWeek", "timeGridWeek", "dayGridWeek"],
    month: ["month", "dayGridMonth"],
    agenda: ["listWeek", "listDay"],
    timeline: ["timeline"],
  };
  return (candidates[mode] || []).find((item) => options.includes(item)) || options[0] || "agendaWeek";
}

function CalendarView({ metadata, onOpenRecord, userId, userName }: { metadata: Metadata; onOpenRecord: (name: string, row: Row) => void; userId?: string; userName?: string }) {
  const scopes = useMemo(() => Object.entries(metadata.scopes || {}).filter(([name, scope]) => scope.calendar && metadata.entityDefs?.[name]?.fields).map(([name]) => name), [metadata]);
  const calendarPreferenceKey = `via:calendar:${getSession()?.user.id || "guest"}`;
  const readCalendarPreference = () => { try { return JSON.parse(localStorage.getItem(calendarPreferenceKey) || "null") as Row | null; } catch { return null; } };
  const [anchor, setAnchor] = useState(() => new Date());
  const [calendarTimeZone, setCalendarTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [activeScopes, setActiveScopes] = useState<string[]>(() => { const stored = readCalendarPreference()?.scopes; return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string" && scopes.includes(item)) : scopes; });
  const [calendarUsers, setCalendarUsers] = useState<Array<{ id: string; name: string }>>(() => { const stored = readCalendarPreference()?.users; return Array.isArray(stored) ? stored.filter((item): item is { id: string; name: string } => Boolean(item && typeof item.id === "string" && typeof item.name === "string")) : []; });
  const [calendarTeams, setCalendarTeams] = useState<Array<{ id: string; name: string }>>(() => { const stored = readCalendarPreference()?.teams; return Array.isArray(stored) ? stored.filter((item): item is { id: string; name: string } => Boolean(item && typeof item.id === "string" && typeof item.name === "string")) : []; });
  const [calendarFilterPicker, setCalendarFilterPicker] = useState<"users" | "teams" | "shared-teams" | null>(null);
  const [sharedCalendarViews, setSharedCalendarViews] = useState<Array<{ id: string; name: string; mode: string; teamIdList: string[]; teamNames: Record<string, string> }>>([]);
  const [sharedViewEditor, setSharedViewEditor] = useState<{ id?: string; name: string; mode: string; teams: Array<{ id: string; name: string }> } | null>(null);
  const [selectedSharedViewId, setSelectedSharedViewId] = useState("");
  const [sharedViewsBusy, setSharedViewsBusy] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "agenda" | "timeline">(() => { const mode = readCalendarPreference()?.mode; return ["day", "week", "month", "agenda", "timeline"].includes(mode) ? mode : "week"; });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [createEntity, setCreateEntity] = useState<string | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<ActivityEvent | null>(null);
  const [movingEvent, setMovingEvent] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  useEffect(() => {
    const currentUserId = getSession()?.user.id;
    if (!currentUserId) return;
    let live = true;
    request<Row>(`Preferences/${encodeURIComponent(currentUserId)}`).then((preferences) => {
      if (!live || typeof preferences.timeZone !== "string" || !preferences.timeZone) return;
      try {
        new Intl.DateTimeFormat("en", { timeZone: preferences.timeZone });
        setCalendarTimeZone(preferences.timeZone);
        const nowParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: preferences.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
        setAnchor((current) => {
          const browserNow = new Date();
          if (current.getFullYear() !== browserNow.getFullYear() || current.getMonth() !== browserNow.getMonth() || current.getDate() !== browserNow.getDate()) return current;
          return new Date(Number(nowParts.year), Number(nowParts.month) - 1, Number(nowParts.day));
        });
      } catch { /* Keep the browser time zone when the saved zone is invalid. */ }
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  const weekStart = useMemo(() => {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return day;
  }, [anchor]);
  const range = useMemo(() => {
    if (viewMode === "day") { const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()); const end = new Date(start); end.setDate(end.getDate() + 1); return { start, end, days: [start] }; }
    if (viewMode === "month") { const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1); end.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7)) % 7); const days: Date[] = []; for (const date = new Date(start); date < end; date.setDate(date.getDate() + 1)) days.push(new Date(date)); return { start, end, days }; }
    const start = viewMode === "week" || viewMode === "timeline" ? weekStart : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    if (viewMode === "agenda") start.setDate(start.getDate() - 3);
    const end = new Date(start); end.setDate(end.getDate() + (viewMode === "week" || viewMode === "timeline" ? 7 : viewMode === "agenda" ? 7 : 1));
    const days: Date[] = []; for (const date = new Date(start); date < end; date.setDate(date.getDate() + 1)) days.push(new Date(date));
    return { start, end, days };
  }, [anchor, viewMode, weekStart]);
  const from = espocrmDateTime(calendarZonedDateTime(range.start, calendarTimeZone));
  const to = espocrmDateTime(calendarZonedDateTime(range.end, calendarTimeZone));
  const scopeParam = activeScopes.join(",");
  const userIdList = calendarUsers.map((item) => item.id).join(",");
  const teamIdList = calendarTeams.map((item) => item.id).join(",");
  const calendarPermission = String(metadata.userAcl?.userCalendarPermission || "no");
  const canManageSharedViews = !userId && calendarPermission !== "no";
  const canSelectCalendarUsers = !userId && calendarPermission !== "no" && viewMode === "timeline";
  const canSelectCalendarTeams = !userId && calendarPermission !== "no" && ["day", "week", "month"].includes(viewMode);

  useEffect(() => { setActiveScopes((current) => current.filter((scope) => scopes.includes(scope))); }, [scopes]);
  useEffect(() => { try { localStorage.setItem(calendarPreferenceKey, JSON.stringify({ mode: viewMode, scopes: activeScopes, users: calendarUsers, teams: calendarTeams })); } catch { /* Preferences are optional when storage is unavailable. */ } }, [calendarPreferenceKey, viewMode, activeScopes, calendarUsers, calendarTeams]);
  useEffect(() => {
    function handleCalendarShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable='true'], [role='dialog']") || event.altKey || event.metaKey) return;
      if (event.ctrlKey && event.code === "Space") {
        const createScope = scopes.includes("Meeting") ? "Meeting" : scopes.includes("Call") ? "Call" : scopes.includes("Task") ? "Task" : null;
        if (!createScope) return;
        event.preventDefault(); setCreateEntity(createScope); return;
      }
      if (event.ctrlKey || event.shiftKey) return;
      if (event.key === "Home") { event.preventDefault(); setAnchor(new Date()); return; }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        event.preventDefault();
        setAnchor((current) => { const next = new Date(current); if (viewMode === "month") next.setMonth(next.getMonth() + direction); else if (viewMode === "day") next.setDate(next.getDate() + direction); else next.setDate(next.getDate() + direction * 7); return next; });
        return;
      }
      const modeIndex = Number(event.key) - 1;
      const modes = ["day", "week", "timeline", "month", "agenda"] as const;
      if (modeIndex >= 0 && modeIndex < modes.length) { event.preventDefault(); setViewMode(modes[modeIndex]); }
    }
    window.addEventListener("keydown", handleCalendarShortcut);
    return () => window.removeEventListener("keydown", handleCalendarShortcut);
  }, [scopes, viewMode]);
  useEffect(() => {
    if (!canManageSharedViews) return;
    let live = true;
    request<Row>(`Preferences/${encodeURIComponent(getSession()?.user.id || "")}`).then((data) => {
      if (!live) return;
      const list = Array.isArray(data.calendarViewDataList) ? data.calendarViewDataList : [];
      setSharedCalendarViews(list.filter((item: Row) => item && typeof item.id === "string").map((item: Row) => ({ id: item.id, name: String(item.name || ""), mode: calendarModeForUi(String(item.mode || "agendaWeek")), teamIdList: Array.isArray(item.teamIdList) ? item.teamIdList : [], teamNames: item.teamNames || {} })));
    }).catch(() => { if (live) setSharedCalendarViews([]); });
    return () => { live = false; };
  }, [canManageSharedViews, calendarPreferenceKey]);
  async function saveSharedCalendarView() {
    if (!sharedViewEditor || !sharedViewEditor.name.trim() || !sharedViewEditor.teams.length) return;
    setSharedViewsBusy(true);
    const id = sharedViewEditor.id || Math.random().toString(36).slice(2, 12);
    const data = { id, name: sharedViewEditor.name.trim(), mode: nativeCalendarMode(sharedViewEditor.mode, metadata), teamIdList: sharedViewEditor.teams.map((team) => team.id), teamNames: Object.fromEntries(sharedViewEditor.teams.map((team) => [team.id, team.name])) };
    const next = sharedViewEditor.id ? sharedCalendarViews.map((item) => item.id === id ? data : { ...item, mode: nativeCalendarMode(item.mode, metadata) }) : [...sharedCalendarViews.map((item) => ({ ...item, mode: nativeCalendarMode(item.mode, metadata) })), data];
    try { await request(`Preferences/${encodeURIComponent(getSession()?.user.id || "")}`, { method: "PUT", body: JSON.stringify({ calendarViewDataList: next }) }); setSharedCalendarViews(next); setSharedViewEditor(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sdílený pohled se nepodařilo uložit."); }
    finally { setSharedViewsBusy(false); }
  }
  async function deleteSharedCalendarView() {
    if (!selectedSharedViewId || !window.confirm("Opravdu odstranit tento sdílený pohled?")) return;
    setSharedViewsBusy(true);
    const next = sharedCalendarViews.filter((item) => item.id !== selectedSharedViewId).map((item) => ({ ...item, mode: nativeCalendarMode(item.mode, metadata) }));
    try { await request(`Preferences/${encodeURIComponent(getSession()?.user.id || "")}`, { method: "PUT", body: JSON.stringify({ calendarViewDataList: next }) }); setSharedCalendarViews(next); setSelectedSharedViewId(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sdílený pohled se nepodařilo odstranit."); }
    finally { setSharedViewsBusy(false); }
  }
  useEffect(() => {
    let live = true;
    if (!scopeParam) { setEvents([]); setBusy(false); return; }
    setBusy(true); setError("");
    const params = new URLSearchParams({ from, to, scopeList: scopeParam, agenda: "false", ...(userId ? { userId } : {}), ...(canSelectCalendarUsers && userIdList ? { userIdList } : {}), ...(canSelectCalendarTeams && teamIdList ? { teamIdList } : {}) });
    request<ActivityEvent[]>(`Activities?${params.toString()}`).then((data) => { if (live) setEvents(data || []); })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : "Kalendář se nepodařilo načíst."); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [from, to, scopeParam, refreshIndex, userId, canSelectCalendarUsers, canSelectCalendarTeams, userIdList, teamIdList]);

  const days = range.days;
  const rangeLabel = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).formatRange(calendarWallDateAsUtc(range.start), calendarWallDateAsUtc(new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() - 1)));
  const eventDate = (event: ActivityEvent) => event.dateStartDate ? new Date(`${event.dateStartDate}T00:00:00`) : parseEspoCalendarDateTime(String(event.dateStart || ""));
  const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const calendarTodayKey = dateKeyInTimeZone(new Date(), calendarTimeZone);
  const dayEvents = (day: Date) => events.filter((event) => !event.isWorkingRange && !event.isNonWorkingRange && !event.isBusyRange && (event.dateStartDate || dateKeyInTimeZone(eventDate(event), calendarTimeZone)) === dayKey(day)).sort((a, b) => eventDate(a).getTime() - eventDate(b).getTime());
  const prettyTime = (event: ActivityEvent) => event.dateStartDate ? "Celý den" : Number.isNaN(eventDate(event).getTime()) ? "" : new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: calendarTimeZone }).format(eventDate(event));
  const eventTone: Record<string, string> = { Meeting: "meeting", Call: "call", Task: "task" };
  async function moveCalendarEvent(event: ActivityEvent, targetDay: Date) {
    const id = event.recordId || event.id;
    const oldStart = event.dateStartDate || event.dateStart;
    if (!oldStart || !id) return;
    const oldDate = oldStart.slice(0, 10);
    const targetDate = dayKey(targetDay);
    const utcDay = (value: string) => Math.floor(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) / 86400000);
    const shift = utcDay(targetDate) - utcDay(oldDate);
    if (!shift) return;
    const shifted = (value?: string) => {
      if (!value) return undefined;
      const date = new Date(`${value.slice(0, 10)}T12:00:00`); date.setDate(date.getDate() + shift);
      return `${dayKey(date)}${value.length > 10 ? ` ${value.slice(11)}` : ""}`;
    };
    const payload = event.dateStartDate
      ? { dateStartDate: targetDate, ...(event.dateEndDate ? { dateEndDate: shifted(event.dateEndDate) } : {}) }
      : { dateStart: shifted(event.dateStart), ...(event.dateEnd ? { dateEnd: shifted(event.dateEnd) } : {}) };
    setMovingEvent(true); setError("");
    try { await request(`${encodeURIComponent(event.scope)}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }); setRefreshIndex((n) => n + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Aktivitu se nepodařilo přesunout."); }
    finally { setMovingEvent(false); }
  }
  const timelineStartHour = 6;
  const timelineSlots = 60;
  const availabilityRanges = events.filter((event) => event.isWorkingRange || event.isNonWorkingRange || event.isBusyRange);
  const calendarActivityCount = events.length - availabilityRanges.length;
  const timelineGrid = <div className="calendar-timeline-scroll">{availabilityRanges.length > 0 && <div className="calendar-timeline-legend" aria-label="Legenda dostupnosti">{availabilityRanges.some((range) => range.isWorkingRange) && <span><i className="working"/> Pracovní doba</span>}{availabilityRanges.some((range) => range.isNonWorkingRange) && <span><i className="nonworking"/> Mimo pracovní dobu</span>}{availabilityRanges.some((range) => range.isBusyRange) && <span><i className="busy"/> Obsazeno</span>}</div>}<div className="calendar-timeline-grid" style={{ gridTemplateRows: `42px repeat(${timelineSlots}, 18px)` }}>
    <div className="calendar-timeline-corner" style={{ gridColumn: 1, gridRow: 1 }}>ČAS</div>
    {days.map((day, index) => <div className={`calendar-timeline-dayhead ${dayKey(day) === calendarTodayKey ? "today" : ""}`} key={dayKey(day)} style={{ gridColumn: index + 2, gridRow: 1 }}><span>{new Intl.DateTimeFormat("cs-CZ", { weekday: "short", timeZone: "UTC" }).format(calendarWallDateAsUtc(day))}</span><strong>{new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(calendarWallDateAsUtc(day))}</strong></div>)}
    {Array.from({ length: timelineSlots }, (_, slot) => <Fragment key={`slot-${slot}`}><div className="calendar-timeline-time" style={{ gridColumn: 1, gridRow: slot + 2 }}>{slot % 4 === 0 ? `${String(timelineStartHour + Math.floor(slot / 4)).padStart(2, "0")}:00` : ""}</div>{days.map((day, index) => <div className={`calendar-timeline-cell ${slot % 4 === 0 ? "hour" : ""}`} key={`${dayKey(day)}-${slot}`} style={{ gridColumn: index + 2, gridRow: slot + 2 }}/>)}</Fragment>)}
    {busy && <div className="calendar-timeline-loading" style={{ gridColumn: "2 / -1", gridRow: "2 / -1" }}><span className="spinner"/> Načítám události…</div>}
    {!busy && days.flatMap((day, dayIndex) => availabilityRanges.flatMap((range, rangeIndex) => {
      if (!range.dateStart || !range.dateEnd) return [];
      const rangeStart = parseEspoCalendarDateTime(String(range.dateStart));
      const rangeEnd = parseEspoCalendarDateTime(String(range.dateEnd));
      const timelineStart = new Date(day); timelineStart.setHours(timelineStartHour, 0, 0, 0);
      const timelineEnd = new Date(day); timelineEnd.setHours(timelineStartHour + timelineSlots / 4, 0, 0, 0);
      const visibleStart = Math.max(rangeStart.getTime(), calendarZonedDateTime(timelineStart, calendarTimeZone).getTime());
      const visibleEnd = Math.min(rangeEnd.getTime(), calendarZonedDateTime(timelineEnd, calendarTimeZone).getTime());
      if (!Number.isFinite(visibleStart) || !Number.isFinite(visibleEnd) || visibleEnd <= visibleStart) return [];
      const dayStart = calendarZonedDateTime(day, calendarTimeZone).getTime();
      const dayEnd = calendarZonedDateTime(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1), calendarTimeZone).getTime();
      if (rangeStart.getTime() >= dayEnd || rangeEnd.getTime() <= dayStart) return [];
      const startSlot = Math.max(0, Math.min(timelineSlots - 1, Math.floor((visibleStart - calendarZonedDateTime(timelineStart, calendarTimeZone).getTime()) / 900000)));
      const endSlot = Math.max(startSlot + 1, Math.min(timelineSlots, Math.ceil((visibleEnd - calendarZonedDateTime(timelineStart, calendarTimeZone).getTime()) / 900000)));
      const type = range.isBusyRange ? "busy" : range.isNonWorkingRange ? "nonworking" : "working";
      return [<div aria-hidden="true" className={`calendar-timeline-range ${type}`} key={`${dayKey(day)}-${type}-${rangeIndex}`} style={{ gridColumn: dayIndex + 2, gridRow: `${startSlot + 2} / ${endSlot + 2}` }}/>];
    }))}
    {!busy && days.flatMap((day, dayIndex) => dayEvents(day).map((event) => {
      const date = eventDate(event);
      const timeParts = new Intl.DateTimeFormat("en", { timeZone: calendarTimeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
      const hour = event.dateStartDate ? timelineStartHour : Number(timeParts.find((part) => part.type === "hour")?.value || 0);
      const minute = event.dateStartDate ? 0 : Number(timeParts.find((part) => part.type === "minute")?.value || 0);
      const startSlot = Math.max(0, Math.min(timelineSlots - 1, Math.floor(((hour * 60 + minute) - timelineStartHour * 60) / 15)));
      const startMs = event.dateStart ? parseEspoCalendarDateTime(String(event.dateStart)).getTime() : NaN;
      const endMs = event.dateEnd ? parseEspoCalendarDateTime(String(event.dateEnd)).getTime() : NaN;
      const span = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(1, Math.min(timelineSlots - startSlot, Math.ceil((endMs - startMs) / 900000))) : 2;
      return <button draggable={false} className={`calendar-timeline-event ${eventTone[event.scope] || "other"}`} key={`${event.scope}-${event.recordId || event.id}`} style={{ gridColumn: dayIndex + 2, gridRow: `${startSlot + 2} / span ${span}` }} title={`${prettyTime(event)} ${event.title || event.name || ""}`} onClick={() => onOpenRecord(event.scope, { ...event, id: event.recordId || event.id, name: event.title || event.name })}><time>{prettyTime(event)}</time><strong>{event.title || event.name || "Bez názvu"}</strong><small>{entityLabel(metadata, event.scope)}</small></button>;
    }))}
  </div></div>;

  return <div className="calendar-view">
    <div className="entity-heading"><div><div className="eyebrow">PLÁNOVÁNÍ A AKTIVITY</div><h1>{userName ? `Kalendář · ${userName}` : "Kalendář"}</h1><p>{userName ? "Aktivity přiřazené tomuto uživateli." : "Schůzky, hovory a úkoly v jednom týdenním přehledu."}</p></div><div className="calendar-create-actions">{["Meeting", "Call", "Task"].filter((name) => scopes.includes(name)).map((name) => <button className="button" key={name} onClick={() => setCreateEntity(name)}><Plus size={14}/>{name === "Meeting" ? "Schůzka" : name === "Call" ? "Hovor" : "Úkol"}</button>)}</div></div>
    <section className="surface calendar-surface">
      <div className="calendar-toolbar"><div className="calendar-nav"><button className="icon-button" onClick={() => setAnchor((d) => { const next = new Date(d); if (viewMode === "month") next.setMonth(next.getMonth() - 1); else if (viewMode === "day") next.setDate(next.getDate() - 1); else next.setDate(next.getDate() - 7); return next; })} aria-label="Předchozí období"><ChevronLeft size={17}/></button><button className="button subtle" onClick={() => setAnchor(new Date())}>Dnes</button><button className="icon-button" onClick={() => setAnchor((d) => { const next = new Date(d); if (viewMode === "month") next.setMonth(next.getMonth() + 1); else if (viewMode === "day") next.setDate(next.getDate() + 1); else next.setDate(next.getDate() + 7); return next; })} aria-label="Další období"><ChevronRight size={17}/></button><h2>{rangeLabel}</h2></div><div className="calendar-toolbar-actions"><div className="calendar-view-switch" role="group" aria-label="Zobrazení kalendáře">{([["day", "Den"], ["week", "Týden"], ["timeline", "Časová osa"], ["month", "Měsíc"], ["agenda", "Agenda"]] as const).map(([mode, label]) => <button key={mode} className={viewMode === mode ? "active" : ""} onClick={() => setViewMode(mode)}>{label}</button>)}</div>{canSelectCalendarUsers && <button type="button" className="button subtle calendar-participant-filter" onClick={() => setCalendarFilterPicker("users")}>Uživatelé{calendarUsers.length ? ` · ${calendarUsers.length}` : " · všichni"}</button>}{canSelectCalendarTeams && <button type="button" className="button subtle calendar-participant-filter" onClick={() => setCalendarFilterPicker("teams")}>Týmy{calendarTeams.length ? ` · ${calendarTeams.length}` : " · všechny"}</button>}{canManageSharedViews && <><select className="calendar-shared-view-select" aria-label="Sdílený pohled" value={selectedSharedViewId} onChange={(event) => { const item = sharedCalendarViews.find((view) => view.id === event.target.value); setSelectedSharedViewId(item?.id || ""); if (item) { setViewMode(calendarModeForUi(item.mode)); setCalendarTeams(item.teamIdList.map((id) => ({ id, name: item.teamNames[id] || id }))); } }}><option value="">Sdílené pohledy</option>{sharedCalendarViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select>{selectedSharedViewId && <><button type="button" className="icon-button" aria-label="Upravit sdílený pohled" title="Upravit sdílený pohled" onClick={() => { const item = sharedCalendarViews.find((view) => view.id === selectedSharedViewId); if (item) setSharedViewEditor({ id: item.id, name: item.name, mode: item.mode, teams: item.teamIdList.map((id) => ({ id, name: item.teamNames[id] || id })) }); }}><Pencil size={14}/></button><button type="button" className="icon-button" aria-label="Odstranit sdílený pohled" title="Odstranit sdílený pohled" onClick={() => void deleteSharedCalendarView()} disabled={sharedViewsBusy}><Trash2 size={14}/></button></>}<button type="button" className="icon-button" aria-label="Přidat sdílený pohled" title="Přidat sdílený pohled" onClick={() => setSharedViewEditor({ name: "", mode: viewMode, teams: calendarTeams })}><Plus size={15}/></button></>}<button className="icon-button" title="Obnovit" onClick={() => setRefreshIndex((n) => n + 1)}><RefreshCw size={15}/></button></div></div>
      <details className="calendar-shortcuts"><summary>Klávesové zkratky</summary><div className="calendar-shortcut-list"><span><kbd>←</kbd><kbd>→</kbd><span>Předchozí / další období</span></span><span><kbd>Home</kbd><span>Přejít na dnešek</span></span><span><kbd>1</kbd>–<kbd>5</kbd><span>Přepnout zobrazení</span></span>{scopes.some((scope) => ["Meeting", "Call", "Task"].includes(scope)) && <span><kbd>Ctrl</kbd> + <kbd>Space</kbd><span>Vytvořit aktivitu</span></span>}</div></details>
      <div className="calendar-filters">{scopes.map((scope) => <button key={scope} className={`calendar-filter ${activeScopes.includes(scope) ? "selected" : ""} ${eventTone[scope] || "other"}`} onClick={() => setActiveScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope])}><i/>{entityLabel(metadata, scope, true)}</button>)}</div>
      {error && <div className="table-error">{error}<button onClick={() => setAnchor(new Date(anchor))}>Zkusit znovu</button></div>}
      {viewMode === "timeline" ? timelineGrid : <div className={`calendar-week-grid calendar-${viewMode}-grid`}>{viewMode === "month" && ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((day) => <div className="calendar-month-weekday" key={day}>{day}</div>)}{days.map((day) => <section className={`calendar-day ${dayKey(day) === calendarTodayKey ? "today" : ""} ${viewMode === "month" && day.getMonth() !== anchor.getMonth() ? "outside-month" : ""} ${draggedEvent ? "calendar-drop-target" : ""}`} key={dayKey(day)} onDragOver={(event) => { if (draggedEvent) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => { event.preventDefault(); const moving = draggedEvent; setDraggedEvent(null); if (moving) void moveCalendarEvent(moving, day); }}><header><span>{new Intl.DateTimeFormat("cs-CZ", { weekday: viewMode === "month" ? "short" : "long", timeZone: "UTC" }).format(calendarWallDateAsUtc(day))}</span><b>{day.getDate()}</b></header><div className="calendar-day-events">{busy ? <div className="calendar-day-loading"/> : dayEvents(day).length ? dayEvents(day).map((event) => <button draggable={!movingEvent} onDragStart={(nativeEvent) => { setDraggedEvent(event); nativeEvent.dataTransfer.effectAllowed = "move"; nativeEvent.dataTransfer.setData("text/plain", event.recordId || event.id); }} onDragEnd={() => setDraggedEvent(null)} className={`calendar-event ${eventTone[event.scope] || "other"}`} key={`${event.scope}-${event.recordId || event.id}`} onClick={() => onOpenRecord(event.scope, { ...event, id: event.recordId || event.id, name: event.title || event.name })}><span>{prettyTime(event)}</span><strong>{event.title || event.name || "Bez názvu"}</strong><small>{entityLabel(metadata, event.scope)}{event.status ? ` · ${event.status}` : ""}</small></button>) : <span className="calendar-empty">—</span>}</div></section>)}</div>}
      <div className="calendar-footer"><span>{busy ? "Načítám aktivity…" : `${calendarActivityCount} aktivit v období`}</span><span title={`Časová zóna účtu EspoCRM: ${calendarTimeZone}`}>{movingEvent ? "Přesouvám událost…" : `Událost přetáhněte na jiný den. Časy podle nastavení účtu EspoCRM · ${calendarTimeZone}.`}</span></div>
    </section>
    {createEntity && <RecordEditor entity={createEntity} fields={getEditorFields(metadata, createEntity)} metadata={metadata} initialValues={userId ? { assignedUserId: userId, assignedUserName: userName } : {}} onClose={() => setCreateEntity(null)} onSaved={() => { setCreateEntity(null); setRefreshIndex((n) => n + 1); }} />}
    {sharedViewEditor && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !sharedViewsBusy && setSharedViewEditor(null)}><section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="shared-calendar-title"><div className="modal-heading"><div><span className="eyebrow">KALENDÁŘ · TÝMOVÉ SDÍLENÍ</span><h2 id="shared-calendar-title">{sharedViewEditor.id ? "Upravit sdílený pohled" : "Vytvořit sdílený pohled"}</h2><p>Pohled bude dostupný členům vybraných týmů.</p></div><button type="button" className="icon-button" aria-label="Zavřít" onClick={() => setSharedViewEditor(null)}><X size={16}/></button></div><label className="field-input"><span>Název</span><input autoFocus value={sharedViewEditor.name} onChange={(event) => setSharedViewEditor((current) => current ? { ...current, name: event.target.value } : current)} required/></label><label className="field-input"><span>Zobrazení</span><select value={sharedViewEditor.mode} onChange={(event) => setSharedViewEditor((current) => current ? { ...current, mode: event.target.value } : current)}>{([["day", "Den"], ["week", "Týden"], ["month", "Měsíc"], ["timeline", "Časová osa"], ["agenda", "Agenda"]] as const).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}</select></label><div className="field-input"><span>Týmy</span><button type="button" className="button subtle" onClick={() => setCalendarFilterPicker("shared-teams")}>{sharedViewEditor.teams.length ? sharedViewEditor.teams.map((team) => team.name).join(", ") : "Vybrat týmy…"}</button></div><div className="modal-footer"><button type="button" className="button subtle" onClick={() => setSharedViewEditor(null)} disabled={sharedViewsBusy}>Zrušit</button><button type="button" className="button primary" onClick={() => void saveSharedCalendarView()} disabled={sharedViewsBusy || !sharedViewEditor.name.trim() || !sharedViewEditor.teams.length}><Save size={14}/> Uložit pohled</button></div></section></div>}
    {calendarFilterPicker && (() => { const isUsers = calendarFilterPicker === "users"; const isShared = calendarFilterPicker === "shared-teams"; const selected = isUsers ? calendarUsers : isShared ? sharedViewEditor?.teams || [] : calendarTeams; const restricted = calendarPermission === "team"; return <SelectRecordsDialog entity={isUsers ? "User" : "Team"} metadata={metadata} multiple selectedIds={selected.map((item) => item.id)} selectedRows={selected} primaryFilter={isUsers ? "active" : undefined} fixedWhere={restricted ? [{ type: "bool", value: [isUsers ? "onlyMyTeam" : "onlyMy"] }] : []} onClose={() => setCalendarFilterPicker(null)} onSelect={(rows) => { const next = rows.map((row) => ({ id: row.id, name: row.name || row.userName || row.id })); if (isUsers) setCalendarUsers(next); else if (isShared) setSharedViewEditor((current) => current ? { ...current, teams: next } : current); else setCalendarTeams(next); setCalendarFilterPicker(null); }}/ >; })()}
  </div>;
}

function EntityView({ entity, metadata, onOpenRecord, onNavigateEntity, userType, title, fixedWhere = [] }: { entity: string; metadata: Metadata; onOpenRecord: (record: Row) => void; onNavigateEntity?: (name: string) => void; userType?: "api" | "portal"; title?: string; fixedWhere?: Row[] }) {
  const fieldDefs = metadata.entityDefs?.[entity]?.fields || {};
  const [dateTimeZone, setDateTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  useEffect(() => { const id = getSession()?.user.id; if (!id) return; let live = true; request<Row>(`Preferences/${encodeURIComponent(id)}`).then((prefs) => live && typeof prefs.timeZone === "string" && Boolean(prefs.timeZone) && setDateTimeZone(prefs.timeZone)).catch(() => {}); return () => { live = false; }; }, [entity]);
  const entityClientDefs = metadata.clientDefs?.[entity] || {};
  const inboundEmailList = entity === "InboundEmail";
  const emailFilterList = entity === "EmailFilter";
  const emailAccountList = entity === "EmailAccount";
  const currentAccountUserType = String(getSession()?.user.type || "");
  const emailAccountSearchDisabled = emailAccountList && ((currentAccountUserType !== "admin" && currentAccountUserType !== "super-admin") || fixedWhere.some((item) => item.attribute === "assignedUserId"));
  const emailFolderList = ["EmailFolder", "GroupEmailFolder"].includes(entity);
  const fieldPermissions = metadata.userAcl?.fieldTable?.[entity] || {};
  const canReadField = (name: string) => fieldPermissions[name]?.read !== "no";
  const statusField = String(metadata.scopes?.[entity]?.statusField || "");
  const categoryScope = entity === "Document" ? "DocumentFolder" : entity === "KnowledgeBaseArticle" ? "KnowledgeBaseCategory" : "";
  const categoryField = String((metadata.scopes?.[categoryScope] as any)?.categoryField || (entity === "Document" ? "folder" : "category"));
  const hasCategoryNavigation = Boolean(categoryScope && metadata.scopes?.[categoryScope]?.entity && !metadata.scopes?.[categoryScope]?.disabled && canAccessEntity(metadata, categoryScope));
  const categoryFieldType = fieldDefs[categoryField]?.type || "link";
  const canUseKanban = Boolean(entityClientDefs.kanbanViewMode && statusField && fieldDefs[statusField]);
  const fallbackColumns = useMemo(() => getListFields(metadata, entity).filter(canReadField), [metadata, entity, metadata.userAcl]);
  const isLeadCaptureLogRecord = entity === "LeadCaptureLogRecord";
  const canCreate = canCreateEntity(metadata, entity) && entity !== "EmailQueueItem" && entity !== "AuthLogRecord" && !isLeadCaptureLogRecord && !entityClientDefs.createDisabled;
  const isAuthLogRecord = entity === "AuthLogRecord";
  const isEmailQueueItem = entity === "EmailQueueItem";
  const canEdit = canChangeEntity(metadata, entity, "edit") && !entityClientDefs.editDisabled && !isAuthLogRecord && !isEmailQueueItem && !isLeadCaptureLogRecord;
  const canDelete = canChangeEntity(metadata, entity, "delete");
  const canExport = canUsePermission(metadata, "exportPermission") && !entityClientDefs.exportDisabled && !isAuthLogRecord && !inboundEmailList && !emailAccountList && entity !== "EmailFolder";
  const canMassUpdate = canUsePermission(metadata, "massUpdatePermission") && canEdit && !entityClientDefs.massUpdateDisabled && !isAuthLogRecord && !emailFilterList && entity !== "EmailFolder";
  const canMerge = canEdit && canDelete && !entityClientDefs.massActionsDisabled && !entityClientDefs.mergeDisabled && !isAuthLogRecord && !isEmailQueueItem && !inboundEmailList && !emailAccountList && !emailFilterList && entity !== "EmailFolder" && userType !== "api" && userType !== "portal";
  const currencyFields = Object.entries(fieldDefs).filter(([name, def]) => fieldPermissions[name]?.edit !== "no" && fieldPermissions[name]?.read !== "no" && def.type === "currency" && !def.readOnly && !def.disabled && !def.notStorable && !def.utility && !def.hidden);
  const currencyList = Array.isArray(metadata.appSettings?.currencyList) ? metadata.appSettings.currencyList : [];
  const canMassConvertCurrency = canMassUpdate && !entityClientDefs.convertCurrencyDisabled && !inboundEmailList && !emailAccountList && !emailFilterList && userType !== "api" && currencyList.length > 1 && currencyFields.length > 0;
  const canMassRemove = canDelete && !entityClientDefs.massRemoveDisabled && entity !== "EmailFolder";
  const canPrintPdf = Array.isArray(metadata.appParams?.templateEntityTypeList) && metadata.appParams.templateEntityTypeList.includes(entity) && !entityClientDefs.massPrintPdfDisabled && !inboundEmailList && !emailAccountList && !emailFilterList;
  const canMassFollow = Boolean(metadata.scopes?.[entity]?.stream) && aclLevel(metadata, entity, "stream") !== "no" && !entityClientDefs.massFollowDisabled && !inboundEmailList && userType !== "api";
  const currentUserId = getSession()?.user.id || "guest";
  const listLayoutName = userType === "api" ? "listApi" : userType === "portal" ? "listPortal" : "list";
  const sortPreferenceKey = `via:list-order:${currentUserId}:${entity}:${userType || ""}`;
  const defaultOrderBy = ["EmailFolder", "GroupEmailFolder"].includes(entity) ? "order" : entity === "User" && userType === "portal" ? "createdAt" : "modifiedAt";
  const defaultOrder = ["EmailFolder", "GroupEmailFolder"].includes(entity) ? "asc" : "desc";
  const hiddenColumnsStorageKey = `espo-listHiddenColumns-${listLayoutName}-${entity}-${currentUserId}`;
  const columnWidthsStorageKey = `espo-listColumnsWidths-${listLayoutName}-${entity}-${currentUserId}`;
  const columnResizeStorageKey = `espo-listColumnResize-${listLayoutName}-${entity}-${currentUserId}`;
  const columnOrderStorageKey = `via:list-columns:${currentUserId}:${entity}:${userType || ""}`;
  const [sortOrder, setSortOrder] = useState<{ key: string; orderBy: string; order: "asc" | "desc" }>(() => {
    try { const stored = JSON.parse(localStorage.getItem(sortPreferenceKey) || "null"); return stored && typeof stored.orderBy === "string" && ["asc", "desc"].includes(stored.order) ? { key: sortPreferenceKey, orderBy: stored.orderBy, order: stored.order } : { key: sortPreferenceKey, orderBy: defaultOrderBy, order: defaultOrder }; }
    catch { return { key: sortPreferenceKey, orderBy: defaultOrderBy, order: defaultOrder }; }
  });
  const activeOrderBy = sortOrder.key === sortPreferenceKey ? sortOrder.orderBy : defaultOrderBy;
  const activeOrder = sortOrder.key === sortPreferenceKey ? sortOrder.order : defaultOrder;
  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem(sortPreferenceKey) || "null"); setSortOrder(stored && typeof stored.orderBy === "string" && ["asc", "desc"].includes(stored.order) ? { key: sortPreferenceKey, orderBy: stored.orderBy, order: stored.order } : { key: sortPreferenceKey, orderBy: defaultOrderBy, order: defaultOrder }); }
    catch { setSortOrder({ key: sortPreferenceKey, orderBy: defaultOrderBy, order: defaultOrder }); }
  }, [sortPreferenceKey, defaultOrderBy]);
  const [layoutColumns, setLayoutColumns] = useState<string[]>([]);
  const [layoutHiddenDefaults, setLayoutHiddenDefaults] = useState<Record<string, boolean>>({});
  const [layoutWidthDefaults, setLayoutWidthDefaults] = useState<Record<string, { value: number; unit: "px" | "%" }>>({});
  const [columnWidthMap, setColumnWidthMap] = useState<Record<string, { value: number; unit: "px" | "%" }>>({});
  const [columnResizeEnabled, setColumnResizeEnabled] = useState(false);
  const [notSortableColumns, setNotSortableColumns] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [hiddenColumnMap, setHiddenColumnMap] = useState<Record<string, boolean>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const baseColumns = layoutColumns.length ? layoutColumns : fallbackColumns;
  const orderedColumns = [...baseColumns].sort((a, b) => {
    const ai = columnOrder.indexOf(a); const bi = columnOrder.indexOf(b);
    if (ai < 0 && bi < 0) return baseColumns.indexOf(a) - baseColumns.indexOf(b);
    if (ai < 0) return 1; if (bi < 0) return -1;
    return ai - bi;
  });
  const columns = orderedColumns.filter((name) => !(name in hiddenColumnMap ? hiddenColumnMap[name] : Boolean(layoutHiddenDefaults[name])));
  const getColumnWidth = (name: string) => columnWidthMap[name] || layoutWidthDefaults[name];
  const canResizeColumns = columns.length > 1;
  const [rows, setRows] = useState<Row[]>([]);
  const [kanbanGroups, setKanbanGroups] = useState<KanbanGroup[]>([]);
  const [kanbanLayout, setKanbanLayout] = useState<KanbanLayoutItem[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [kanbanBusyId, setKanbanBusyId] = useState("");
  const [starBusyId, setStarBusyId] = useState("");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterPicker, setFilterPicker] = useState<{ index: number; category: boolean } | null>(null);
  const [draftFilters, setDraftFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);
  const [primaryFilter, setPrimaryFilter] = useState("");
  const [activeBoolFilters, setActiveBoolFilters] = useState<string[]>([]);
  const [categorySelection, setCategorySelection] = useState<{ id: string; name: string } | { uncategorized: true } | null>(null);
  const [savedPresets, setSavedPresets] = useState<Row[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [savedPresetWhere, setSavedPresetWhere] = useState<Row[]>([]);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ record?: Row; initialValues?: Row } | null>(null);
  const [portalContactPicker, setPortalContactPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allResultsSelected, setAllResultsSelected] = useState(false);
  const [massEdit, setMassEdit] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [currencyConvertOpen, setCurrencyConvertOpen] = useState(false);
  const [pdfTemplateOpen, setPdfTemplateOpen] = useState(false);
  const [massField, setMassField] = useState("");
  const [massValue, setMassValue] = useState<any>("");
  const [massCurrency, setMassCurrency] = useState("");
  const [massBusy, setMassBusy] = useState(false);
  const [taskActionMenuId, setTaskActionMenuId] = useState("");
  useEffect(() => { if (!taskActionMenuId) return; const closeMenu = () => setTaskActionMenuId(""); document.addEventListener("click", closeMenu); return () => document.removeEventListener("click", closeMenu); }, [taskActionMenuId]);
  const [massNotice, setMassNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [composeEmail, setComposeEmail] = useState(false);
  const pageSize = 20;
  const selectionQueryKey = JSON.stringify([entity, fixedWhere, userType, search, primaryFilter, activeBoolFilters, savedPresetWhere, appliedFilters, categorySelection]);
  useEffect(() => { setSelectedIds([]); setAllResultsSelected(false); setMassNotice(""); }, [selectionQueryKey]);
  const kanbanPageSize = Math.max(1, Number(metadata.appSettings?.recordsPerPageKanban) || 5);
  const canMoveKanban = canChangeEntity(metadata, entity, "edit") && fieldPermissions[statusField]?.edit !== "no" && !fieldDefs[statusField]?.readOnly && !fieldDefs[statusField]?.disabled && userType !== "portal";
  const canReorderKanban = canMoveKanban && !metadata.scopes?.[entity]?.kanbanOrderDisabled;
  const canCreateKanban = canCreate && canMoveKanban;
  useEffect(() => {
    const key = `via:list-view:${currentUserId}:${entity}:${userType || ""}`;
    let stored = "";
    try { stored = localStorage.getItem(key) || ""; } catch {}
    setViewMode(canUseKanban && (stored === "kanban" || entityClientDefs.listDefaultViewMode === "kanban") ? "kanban" : "list");
  }, [currentUserId, entity, userType, canUseKanban, entityClientDefs.listDefaultViewMode]);
  useEffect(() => {
    if (!canUseKanban) { setKanbanLayout([]); return; }
    let live = true;
    fetchLayout<LayoutItem[]>(entity, "kanban").then((layout) => live && setKanbanLayout(Array.isArray(layout) ? layout.filter((item): item is Exclude<LayoutItem, false> => Boolean(item) && typeof item === "object" && Boolean(item.name) && canReadField(item.name!)) as KanbanLayoutItem[] : [])).catch(() => live && setKanbanLayout([]));
    return () => { live = false; };
  }, [entity, canUseKanban, metadata.userAcl]);
  useEffect(() => {
    let live = true;
    setLayoutColumns([]); setLayoutHiddenDefaults({}); setLayoutWidthDefaults({}); setNotSortableColumns([]);
    fetchLayout<LayoutItem[]>(entity, listLayoutName).then((layout) => {
      if (!live || !Array.isArray(layout)) return;
      const items = layout.filter((item): item is Exclude<LayoutItem, false> => Boolean(item) && typeof item === "object" && Boolean(item.name) && canReadField(item.name!));
      const names = items.map((item) => item.name!).filter(Boolean);
      if (names.length) setLayoutColumns(names);
      setLayoutHiddenDefaults(Object.fromEntries(items.map((item) => [item.name!, Boolean(item.hidden)])));
      const widths = items.reduce<Record<string, { value: number; unit: "px" | "%" }>>((map, item) => {
        if (item.name && item.width != null) map[item.name] = { value: Number(item.width), unit: "%" };
        else if (item.name && item.widthPx != null) map[item.name] = { value: Number(item.widthPx), unit: "px" };
        return map;
      }, {});
      setLayoutWidthDefaults(widths);
      setNotSortableColumns(items.filter((item) => item.notSortable).map((item) => item.name!).filter(Boolean));
    }).catch(() => {});
    return () => { live = false; };
  }, [entity, userType, listLayoutName, metadata.userAcl]);
  useEffect(() => {
    try {
      const hiddenRaw = localStorage.getItem(hiddenColumnsStorageKey);
      const hiddenValue = hiddenRaw?.startsWith("__JSON__:") ? hiddenRaw.slice(9) : hiddenRaw;
      const hidden = hiddenValue ? JSON.parse(hiddenValue) : {};
      setHiddenColumnMap(hidden && typeof hidden === "object" && !Array.isArray(hidden) ? hidden : {});
      const order = JSON.parse(localStorage.getItem(columnOrderStorageKey) || "[]");
      setColumnOrder(Array.isArray(order) ? order.filter((name) => typeof name === "string") : []);
      const widthRaw = localStorage.getItem(columnWidthsStorageKey);
      const widthValue = widthRaw?.startsWith("__JSON__:") ? widthRaw.slice(9) : widthRaw;
      const widths = widthValue ? JSON.parse(widthValue) : {};
      setColumnWidthMap(widths && typeof widths === "object" && !Array.isArray(widths) ? widths : {});
      const resizeRaw = localStorage.getItem(columnResizeStorageKey);
      const resizeValue = resizeRaw?.startsWith("__JSON__:") ? resizeRaw.slice(9) : resizeRaw;
      setColumnResizeEnabled(resizeValue ? Boolean(JSON.parse(resizeValue)) : false);
    } catch { setHiddenColumnMap({}); setColumnOrder([]); setColumnWidthMap({}); setColumnResizeEnabled(false); }
  }, [hiddenColumnsStorageKey, columnOrderStorageKey, columnWidthsStorageKey, columnResizeStorageKey]);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const orderBy = sortOrder.key === sortPreferenceKey ? sortOrder.orderBy : "modifiedAt";
      const order = sortOrder.key === sortPreferenceKey ? sortOrder.order : "desc";
      const selectedFields = viewMode === "kanban" ? [...new Set(["id", "name", "subject", statusField, ...kanbanLayout.flatMap((item) => item.name ? [item.name, `${item.name}Name`, `${item.name}Id`] : [])])].filter(Boolean).join(",") : "";
      const params = new URLSearchParams({ maxSize: String(viewMode === "kanban" ? kanbanPageSize : pageSize), offset: String(viewMode === "kanban" ? 0 : offset), orderBy, order });
      if (selectedFields) params.set("select", selectedFields);
      const whereGroup: Row[] = [...fixedWhere];
      if (search.trim()) whereGroup.push({ type: "textFilter", value: search.trim() });
      if (userType) whereGroup.push({ type: "equals", attribute: "type", value: userType });
      if (categorySelection && "uncategorized" in categorySelection) whereGroup.push(categoryFieldType === "linkMultiple" ? { type: "isNotLinked", attribute: categoryField } : { type: "isNull", attribute: `${categoryField}Id` });
      else if (categorySelection) whereGroup.push({ type: "inCategory", attribute: categoryField, value: categorySelection.id });
      if (activeBoolFilters.length) whereGroup.push({ type: "bool", value: activeBoolFilters });
      if (primaryFilter) whereGroup.push({ type: "primary", value: primaryFilter });
      whereGroup.push(...savedPresetWhere);
      for (const condition of appliedFilters) whereGroup.push(...conditionToWhere(condition));
      if (whereGroup.length) params.set("whereGroup", JSON.stringify(whereGroup));
      const data = await request<PageResult & { groups?: KanbanGroup[] }>(`${viewMode === "kanban" ? `Kanban/${encodeURIComponent(entity)}` : encodeURIComponent(entity)}?${params.toString()}`);
      setRows(data.list || []); setTotal(typeof data.total === "number" ? data.total : 0); setSelectedIds([]);
      setKanbanGroups(viewMode === "kanban" ? (data.groups || []).filter((group) => !((metadata.scopes?.[entity]?.kanbanStatusIgnoreList || []).includes(group.name))) : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Záznamy se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, [entity, offset, search, userType, appliedFilters, primaryFilter, activeBoolFilters, categorySelection, categoryField, categoryFieldType, savedPresetWhere, sortOrder, sortPreferenceKey, metadata, fixedWhere, viewMode, statusField, kanbanLayout, kanbanPageSize]);
  useEffect(() => { void load(); }, [load]);

  const createFields = useMemo(() => {
    const fields = getEditorFields(metadata, entity).filter(([name]) => canReadField(name) && !(entity === "User" && ["password", "passwordConfirm", "sendAccessInfo"].includes(name)) && (!userType || name !== "type"));
    if (entity === "User" && getSession()?.user.type === "admin" && userType !== "api") fields.push(["password", metadata.entityDefs.User.fields?.password || { type: "password" }], ["passwordConfirm", { ...(metadata.entityDefs.User.fields?.password || {}), type: "password", label: "Potvrzení hesla" }], ["sendAccessInfo", metadata.entityDefs.User.fields?.sendAccessInfo || { type: "bool" }]);
    return fields;
  }, [metadata, entity, editor?.record, userType]);
  function doSearch(event: FormEvent) { event.preventDefault(); setOffset(0); setSearch(query); }
  function startNewRecord() {
    if (entity === "User" && userType === "portal") { setPortalContactPicker(true); return; }
    const initialValues: Row = userType ? { type: userType } : {};
    if (categorySelection && "id" in categorySelection) {
      if (categoryFieldType === "linkMultiple") {
        initialValues[`${categoryField}Ids`] = [categorySelection.id];
        initialValues[`${categoryField}Names`] = { [categorySelection.id]: categorySelection.name };
      } else {
        initialValues[`${categoryField}Id`] = categorySelection.id;
        initialValues[`${categoryField}Name`] = categorySelection.name;
      }
    }
    setEditor({ initialValues });
  }
  function sortBy(field: string) {
    const nextOrder: "asc" | "desc" = activeOrderBy === field && activeOrder === "asc" ? "desc" : "asc";
    const next = { key: sortPreferenceKey, orderBy: field, order: nextOrder };
    setSortOrder(next); setOffset(0);
    try { localStorage.setItem(sortPreferenceKey, JSON.stringify({ orderBy: field, order: nextOrder })); } catch {}
  }
  function toggleColumnVisibility(name: string) {
    const isHidden = name in hiddenColumnMap ? hiddenColumnMap[name] : Boolean(layoutHiddenDefaults[name]);
    if (!isHidden && columns.length <= 1) return;
    const next = { ...hiddenColumnMap, [name]: !isHidden };
    setHiddenColumnMap(next);
    try { localStorage.setItem(hiddenColumnsStorageKey, `__JSON__:${JSON.stringify(next)}`); } catch {}
  }
  function moveColumn(name: string, direction: -1 | 1) {
    const index = orderedColumns.indexOf(name); const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedColumns.length) return;
    const next = [...orderedColumns]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setColumnOrder(next);
    try { localStorage.setItem(columnOrderStorageKey, JSON.stringify(next)); } catch {}
  }
  function resetColumnSettings() {
    setHiddenColumnMap({}); setColumnOrder([]); setColumnWidthMap({}); setColumnResizeEnabled(false);
    try { localStorage.removeItem(hiddenColumnsStorageKey); localStorage.removeItem(columnOrderStorageKey); localStorage.removeItem(columnWidthsStorageKey); localStorage.removeItem(columnResizeStorageKey); } catch {}
  }
  function toggleColumnResize() {
    const next = !columnResizeEnabled; setColumnResizeEnabled(next);
    try { localStorage.setItem(columnResizeStorageKey, `__JSON__:${JSON.stringify(next)}`); } catch {}
  }
  function startColumnResize(event: ReactPointerEvent<HTMLSpanElement>, name: string) {
    if (!event.isPrimary) return;
    event.preventDefault(); event.stopPropagation();
    const header = event.currentTarget.closest("th"); const table = header?.closest("table");
    if (!header || !table) return;
    const startX = event.clientX; const startWidth = header.getBoundingClientRect().width;
    let nextWidth = startWidth;
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
    const onMove = (moveEvent: PointerEvent) => {
      nextWidth = Math.max(44, startWidth + moveEvent.clientX - startX);
      header.style.width = `${nextWidth}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      const previous = getColumnWidth(name); const unit = previous?.unit || "px";
      const value = unit === "%" ? Math.max(1, Math.round(nextWidth / Math.max(1, table.getBoundingClientRect().width) * 10000) / 100) : Math.round(nextWidth);
      const next = { ...columnWidthMap, [name]: { value, unit } };
      setColumnWidthMap(next);
      try { localStorage.setItem(columnWidthsStorageKey, `__JSON__:${JSON.stringify(next)}`); } catch {}
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp);
  }
  const nativeUser = getSession()?.user as any;
  const canUseNativeFilter = (definition: any) => {
    if (!definition || typeof definition === "string") return true;
    if (definition.isPortalOnly && !["portal", "portal-user"].includes(nativeUser?.type)) return false;
    if (definition.inPortalDisabled && ["portal", "portal-user"].includes(nativeUser?.type)) return false;
    if (definition.isAdminOnly && !["admin", "super-admin"].includes(nativeUser?.type)) return false;
    for (const access of definition.accessDataList || []) {
      if (access.scope && (access.action ? aclLevel(metadata, access.scope, access.action) === "no" : !canAccessEntity(metadata, access.scope))) return false;
      if (!access.scope && access.action && aclLevel(metadata, entity, access.action) === "no") return false;
      if (access.teamIdList?.length && !access.teamIdList.some((id: string) => nativeUser?.teamsIds?.includes(id))) return false;
      if (access.portalIdList?.length && !access.portalIdList.some((id: string) => nativeUser?.portalsIds?.includes(id))) return false;
    }
    return true;
  };
  const nativeFilterDefs = (metadata.clientDefs?.[entity]?.filterList || []) as Array<string | { name?: string; primary?: string; label?: string; data?: Row; accessDataList?: any[]; isPortalOnly?: boolean; inPortalDisabled?: boolean; isAdminOnly?: boolean }>;
  const primaryFilterOptions = [...(metadata.scopes?.[entity]?.stars ? [{ name: "starred", primary: "starred", label: (metadata.labels as any)?.[entity]?.presetFilters?.starred || "Oblíbené" }] : []), ...nativeFilterDefs.filter(canUseNativeFilter).map((item) => { const name = typeof item === "string" ? item : item.name || item.primary || ""; const primary = typeof item === "string" ? item : item.primary || (item.data ? "" : item.name || ""); const labels = (metadata.labels as any)?.[entity] || {}; return { name, primary, label: labels.filters?.[name] || labels.filters?.[primary] || (typeof item === "object" && item.label) || name.replace(/([a-z0-9])([A-Z])/g, "$1 $2") }; }).filter((item) => item.name && item.primary)];
  const nativeBoolFilterDefs = [...((metadata.clientDefs?.[entity]?.boolFilterList || []) as Array<string | { name?: string; aux?: boolean; inPortalDisabled?: boolean; isPortalOnly?: boolean; isAdminOnly?: boolean; accessDataList?: any[] }>), ...(entity === "EmailFolder" ? ["onlyMy"] : [])];
  const nativeBoolFilters = nativeBoolFilterDefs.filter((item) => canUseNativeFilter(item) && (typeof item === "string" || !item.aux)).map((item) => { const name = typeof item === "string" ? item : item.name || ""; return { name, label: (metadata.labels as any)?.[entity]?.boolFilters?.[name] || (entity === "EmailFolder" && name === "onlyMy" ? "Pouze moje složky" : name.replace(/([a-z0-9])([A-Z])/g, "$1 $2")) }; }).filter((item) => item.name);
  useEffect(() => { const defaults = metadata.clientDefs?.[entity]?.selectDefaultFilters || {}; const primary = String(defaults.filter || ""); setPrimaryFilter(primaryFilterOptions.some((item) => item.primary === primary) ? primary : ""); setActiveBoolFilters(Object.entries(defaults.bool || {}).filter(([name, enabled]) => Boolean(enabled) && nativeBoolFilters.some((item) => item.name === name)).map(([name]) => name)); setAppliedFilters([]); setDraftFilters([]); setSavedPresetWhere([]); setSelectedPresetId(""); setPresetNameInput(""); }, [entity, userType, metadata]);
  const filtersLayoutName = String(entityClientDefs.filtersLayoutName || "filters");
  const [filtersLayoutFields, setFiltersLayoutFields] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    setFiltersLayoutFields(null);
    fetchLayout<unknown>(entity, filtersLayoutName).then((layout) => {
      if (!live) return;
      const list = Array.isArray(layout) ? layout : [];
      setFiltersLayoutFields(list.flatMap((item: any) => typeof item === "string" ? [item] : item && typeof item === "object" && typeof item.name === "string" ? [item.name] : []));
    }).catch(() => live && setFiltersLayoutFields(null));
    return () => { live = false; };
  }, [entity, filtersLayoutName]);
  const filterRelationEntity = (name: string, def: FieldDef) => def.entity || (metadata.entityDefs?.[entity]?.links?.[name] as any)?.entity || def.entityList?.[0] || "";
  const filterableFields = Object.entries(fieldDefs).filter(([name, def]) => canReadField(name) && (filtersLayoutFields === null || filtersLayoutFields.includes(name)) && !def.utility && !def.hidden && !def.notStorable && !name.endsWith("Id") && !name.endsWith("Data") && metadata.fields?.[def.type || ""]?.textFilter !== false && !def.textFilterDisabled && (["varchar", "text", "url", "enum", "enumInt", "enumFloat", "bool", "date", "datetime", "datetimeOptional", "int", "float", "currency", "email", "phone"].includes(def.type || "") || (["link", "linkOne", "linkMultiple"].includes(def.type || "") && Boolean(filterRelationEntity(name, def)))));
  const preferencesUserId = getSession()?.user.id;
  useEffect(() => {
    if (!preferencesUserId) { setSavedPresets([]); return; }
    let live = true;
    request<Row>(`Preferences/${encodeURIComponent(preferencesUserId)}`).then((preferences) => {
      if (live) setSavedPresets(Array.isArray(preferences.presetFilters?.[entity]) ? preferences.presetFilters[entity] : []);
    }).catch(() => live && setSavedPresets([]));
    return () => { live = false; };
  }, [entity, preferencesUserId]);
  const presetWhere = (name: string, definition: any): Row | null => {
    if (!definition || typeof definition !== "object") return null;
    const fieldName = String(definition.field || definition.attribute || name);
    const fieldDef = fieldDefs[fieldName] || {};
    if (definition.type === "isUserFromTeams" && ["views/fields/user", "views/fields/user-with-avatar", "views/fields/assigned-user", "views/fields/assigned-users"].includes(String(fieldDef.view || ""))) {
      return canReadField(fieldName) ? { ...definition, field: fieldName } : null;
    }
    if (definition.where && typeof definition.where === "object") {
      const allowed = (where: any): boolean => {
        if (!where || typeof where !== "object") return true;
        if (["and", "or"].includes(where.type)) return Array.isArray(where.value) && where.value.every(allowed);
        return !where.attribute || !fieldDefs[where.attribute] || canReadField(where.attribute);
      };
      return allowed(definition.where) ? definition.where : null;
    }
    if (["and", "or"].includes(definition.type) && definition.value && typeof definition.value === "object") {
      const parts = Object.entries(definition.value).map(([key, value]) => presetWhere(key, value)).filter((item): item is Row => Boolean(item));
      return { type: definition.type, value: parts };
    }
    const attribute = definition.attribute || definition.field || name;
    if (!fieldDefs[attribute] || !canReadField(attribute) || !definition.type) return null;
    const item = { ...definition, attribute };
    delete item.field;
    return item;
  };
  function selectSavedPreset(id: string) {
    const preset = savedPresets.find((item) => item.id === id);
    setSelectedPresetId(preset?.id || "");
    setSavedPresetWhere(preset ? Object.entries(preset.data || {}).map(([name, definition]) => presetWhere(name, definition)).filter((item): item is Row => Boolean(item)) : []);
    setPrimaryFilter(preset?.primary || "");
    setAppliedFilters([]); setDraftFilters([]); setOffset(0);
  }
  async function saveCurrentPreset() {
    const name = presetNameInput.trim();
    if (!name || !preferencesUserId || (!appliedFilters.length && !primaryFilter)) return;
    const seen = new Set<string>();
    const hasDuplicateField = appliedFilters.some((item) => { if (seen.has(item.field)) return true; seen.add(item.field); return false; });
    if (hasDuplicateField) { setError("EspoCRM ukládá nejvýše jednu podmínku na pole do jednoho filtru."); return; }
    setPresetSaving(true); setError("");
    try {
      const preferences = await request<Row>(`Preferences/${encodeURIComponent(preferencesUserId)}`);
      const all = { ...(preferences.presetFilters || {}) };
      const list: Row[] = Array.isArray(all[entity]) ? [...all[entity]] : [];
      const id = `f${Math.floor(Math.random() * 1000001)}`;
      const data = Object.fromEntries(appliedFilters.map((item) => {
        if (item.operator === "isFromTeams") return [item.field, { type: "isUserFromTeams", field: item.field, value: item.value, data: { type: "isFromTeams", teamIdList: item.value, teamNameHash: item.valueNames || {} } }];
        const where = conditionToWhere(item)[0];
        return [item.field, { type: item.operator, attribute: item.field, value: item.value, ...(item.valueTo != null ? { valueTo: item.valueTo } : {}), ...(Array.isArray(item.value) ? { data: { type: item.operator, valueList: item.value } } : {}), where }];
      }));
      const preset = { id, name: id, label: name, data, primary: primaryFilter || null };
      all[entity] = [...list, preset];
      await request(`Preferences/${encodeURIComponent(preferencesUserId)}`, { method: "PATCH", body: JSON.stringify({ presetFilters: all }) });
      setSavedPresets(all[entity]); setSelectedPresetId(id); setSavedPresetWhere([]); setPresetNameInput("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Uložený filtr se nepodařilo uložit."); }
    finally { setPresetSaving(false); }
  }
  async function removeSavedPreset() {
    if (!selectedPresetId || !preferencesUserId || !window.confirm("Opravdu odstranit tento uložený filtr?")) return;
    try {
      const preferences = await request<Row>(`Preferences/${encodeURIComponent(preferencesUserId)}`);
      const all = { ...(preferences.presetFilters || {}) };
      all[entity] = (Array.isArray(all[entity]) ? all[entity] : []).filter((item: Row) => item.id !== selectedPresetId);
      await request(`Preferences/${encodeURIComponent(preferencesUserId)}`, { method: "PATCH", body: JSON.stringify({ presetFilters: all }) });
      setSavedPresets(all[entity]); setSelectedPresetId(""); setSavedPresetWhere([]); setPrimaryFilter(""); setOffset(0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Uložený filtr se nepodařilo odstranit."); }
  }
  const filterOperators = (field: string) => {
    const def = fieldDefs[field] || {};
    const type = def.type;
    if (/category[-]?tree/i.test(String(def.view || ""))) return [["inCategory", "V této kategorii"]];
    if (type === "link" && ["views/fields/user", "views/fields/user-with-avatar", "views/fields/assigned-user", "views/fields/assigned-users"].includes(String(def.view || ""))) return [["is", "Je záznam"], ["isNot", "Není záznam"], ["isOneOf", "Je některý záznam"], ["isNotOneOf", "Není žádný záznam"], ["isFromTeams", "Uživatel je z vybraných týmů"], ["isEmpty", "Je prázdné"], ["isNotEmpty", "Není prázdné"]];
    if (type === "linkOne") return [["is", "Je záznam"], ["isEmpty", "Je prázdné"], ["isNotEmpty", "Není prázdné"], ["isOneOf", "Je některý záznam"]];
    if (type === "linkMultiple") return [["anyOf", "Obsahuje některý záznam"], ["allOf", "Obsahuje všechny záznamy"], ["noneOf", "Neobsahuje žádný záznam"], ["isEmpty", "Je prázdné"], ["isNotEmpty", "Není prázdné"]];
    if (type === "link") return [["is", "Je záznam"], ["isNot", "Není záznam"], ["isOneOf", "Je některý záznam"], ["isNotOneOf", "Není žádný záznam"], ["isEmpty", "Je prázdné"], ["isNotEmpty", "Není prázdné"]];
    if (type === "bool") return [["isTrue", "Je ano"], ["isFalse", "Je ne"], ["any", "Ano nebo ne"]];
    if (["enum", "enumInt", "enumFloat"].includes(type || "")) return [["anyOf", "Je některá z hodnot"], ["noneOf", "Není žádná z hodnot"], ["isEmpty", "Je prázdné"], ["isNotEmpty", "Není prázdné"]];
    if (["int", "float", "currency"].includes(type || "")) return [["equals", "Je přesně"], ["notEquals", "Není"], ["greaterThan", "Je větší než"], ["greaterThanOrEquals", "Je větší nebo rovno"], ["lessThan", "Je menší než"], ["lessThanOrEquals", "Je menší nebo rovno"], ["between", "Je v rozsahu"], ["isEmpty", "Je prázdné"], ["isNotEmpty", "Není prázdné"]];
    if (["date", "datetime", "datetimeOptional"].includes(type || "")) return [["on", "Je dne"], ["notOn", "Není dne"], ["after", "Je po datu"], ["before", "Je před datem"], ["between", "Je v rozsahu"], ["today", "Dnes"], ["past", "V minulosti"], ["future", "V budoucnosti"], ["lastSevenDays", "Posledních 7 dní"], ["currentMonth", "Tento měsíc"], ["lastMonth", "Minulý měsíc"], ["nextMonth", "Příští měsíc"], ["currentQuarter", "Toto čtvrtletí"], ["lastQuarter", "Minulé čtvrtletí"], ["currentYear", "Tento rok"], ["lastYear", "Minulý rok"], ["lastXDays", "Posledních X dní"], ["nextXDays", "Příštích X dní"], ["olderThanXDays", "Starší než X dní"], ["afterXDays", "Později než za X dní"], ["isEmpty", "Je prázdné"], ["isNotEmpty", "Není prázdné"]];
    const text = [["startsWith", "Začíná na"], ["contains", "Obsahuje"], ["equals", "Je přesně"], ["endsWith", "Končí na"], ["notContains", "Neobsahuje"], ["notEquals", "Není přesně"], ["like", "Odpovídá vzoru"], ["notLike", "Neodpovídá vzoru"], ["anyOf", "Je některá z hodnot"], ["noneOf", "Není žádná z hodnot"], ["isEmpty", "Je prázdné"], ["isNotEmpty", "Není prázdné"]];
    return text;
  };
  const filterNoValueOperators = new Set(["isNull", "isNotNull", "isTrue", "isFalse", "isEmpty", "isNotEmpty", "today", "past", "future", "lastSevenDays", "currentMonth", "lastMonth", "nextMonth", "currentQuarter", "lastQuarter", "currentYear", "lastYear"]);
  const filterNeedsRange = (operator: string) => operator === "between";
  const filterNeedsCount = (operator: string) => ["lastXDays", "nextXDays", "olderThanXDays", "afterXDays"].includes(operator);
  function updateDraftFilter(index: number, patch: Partial<FilterCondition>) { setDraftFilters((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function conditionToWhere(condition: FilterCondition): Row[] {
    const def = fieldDefs[condition.field] || {};
    const type = def.type;
    const attribute = condition.field;
    const numeric = ["int", "float", "currency", "enumInt", "enumFloat"].includes(type || "");
    const value = Array.isArray(condition.value) ? condition.value : condition.value;
    const typed = (input: string | undefined) => numeric && input !== "" && input != null ? Number(input) : input;
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    if (condition.operator === "isFromTeams" && ["views/fields/user", "views/fields/user-with-avatar", "views/fields/assigned-user", "views/fields/assigned-users"].includes(String(def.view || ""))) return [{ type: "isUserFromTeams", field: attribute, value: ids, data: { type: "isFromTeams", teamIdList: ids, teamNameHash: condition.valueNames || {} } }];
    if (/category[-]?tree/i.test(String(def.view || "")) && condition.operator === "inCategory") return [{ type: "inCategory", field: attribute, value }];
    if (type === "linkOne") {
      if (condition.operator === "isEmpty") return [{ type: "isNotLinked", attribute }];
      if (condition.operator === "isNotEmpty") return [{ type: "isLinked", attribute }];
      if (condition.operator === "isOneOf") return [{ type: "linkedWith", field: attribute, value: ids }];
      if (condition.operator === "is") return [{ type: "linkedWith", field: attribute, value: ids[0] || "" }];
    }
    if (type === "linkMultiple") {
      if (condition.operator === "isEmpty") return [{ type: "isNotLinked", attribute }];
      if (condition.operator === "isNotEmpty") return [{ type: "isLinked", attribute }];
      if (condition.operator === "anyOf") return [{ type: "linkedWith", attribute, value: ids }];
      if (condition.operator === "allOf") return [{ type: "linkedWithAll", attribute, value: ids }];
      if (condition.operator === "noneOf") return [{ type: "notLinkedWith", attribute, value: ids }];
    }
    if (type === "link") {
      const idAttribute = `${attribute}Id`;
      if (condition.operator === "isEmpty") return [{ type: "isNull", attribute: idAttribute }];
      if (condition.operator === "isNotEmpty") return [{ type: "isNotNull", attribute: idAttribute }];
      if (condition.operator === "is") return [{ type: "equals", attribute: idAttribute, value: ids[0] || "" }];
      if (condition.operator === "isNot") return [{ type: "or", value: [{ type: "notEquals", attribute: idAttribute, value: ids[0] || "" }, { type: "isNull", attribute: idAttribute }] }];
      if (condition.operator === "isOneOf") return [{ type: "in", attribute: idAttribute, value: ids }];
      if (condition.operator === "isNotOneOf") return [{ type: "or", value: [{ type: "notIn", attribute: idAttribute, value: ids }, { type: "isNull", attribute: idAttribute }] }];
    }
    if (condition.operator === "anyOf") return [{ type: "in", attribute, value: Array.isArray(value) ? value.map((item) => numeric ? Number(item) : item) : [] }];
    if (condition.operator === "noneOf") return [{ type: "or", value: [{ type: "notIn", attribute, value: Array.isArray(value) ? value.map((item) => numeric ? Number(item) : item) : [] }, { type: "isNull", attribute }] }];
    if (condition.operator === "isEmpty") return ["varchar", "email", "phone", "enum", "enumInt", "enumFloat"].includes(type || "") ? [{ type: "or", value: [{ type: "isNull", attribute }, { type: "equals", attribute, value: "" }] }] : [{ type: "isNull", attribute }];
    if (condition.operator === "isNotEmpty") return ["varchar", "email", "phone", "enum", "enumInt", "enumFloat"].includes(type || "") ? [{ type: "and", value: [{ type: "isNotNull", attribute }, { type: "notEquals", attribute, value: "" }] }] : [{ type: "isNotNull", attribute }];
    if (condition.operator === "between") return [{ type: "between", attribute, value: [typed(String(condition.value || "")), typed(condition.valueTo)] }];
    if (condition.operator === "inCategory") return [{ type: "inCategory", attribute, value: condition.value }];
    if (["today", "past", "future", "lastSevenDays", "currentMonth", "lastMonth", "nextMonth", "currentQuarter", "lastQuarter", "currentYear", "lastYear", "lastXDays", "nextXDays", "olderThanXDays", "afterXDays"].includes(condition.operator)) return [{ type: condition.operator, attribute, ...(filterNeedsCount(condition.operator) ? { value: Number(condition.value), date: true } : { date: true }) }];
    if (["on", "notOn", "after", "before"].includes(condition.operator)) return [{ type: condition.operator, attribute, value: condition.value, date: type === "date", dateTime: type !== "date" }];
    if (condition.operator === "isTrue" || condition.operator === "isFalse") return [{ type: condition.operator, attribute }];
    if (condition.operator === "any") return [{ type: "or", value: [{ type: "isTrue", attribute }, { type: "isFalse", attribute }] }];
    if (filterNeedsCount(condition.operator)) return [{ type: condition.operator, attribute, value: Number(condition.value) }];
    return [{ type: condition.operator, attribute, ...(!filterNoValueOperators.has(condition.operator) ? { value: typed(String(condition.value ?? "")) } : {}) }];
  }
  function applyFilters() {
    const usable = draftFilters.filter((item) => {
      if (!item.field) return false;
      if (filterNoValueOperators.has(item.operator) || ["isTrue", "isFalse", "any"].includes(item.operator)) return true;
      if (["anyOf", "allOf", "noneOf", "isOneOf", "isNotOneOf", "isFromTeams"].includes(item.operator)) return Array.isArray(item.value) && item.value.length > 0;
      if (filterNeedsRange(item.operator)) return item.value !== "" && Boolean(item.valueTo);
      return item.value !== "";
    });
    setAppliedFilters(usable); setOffset(0); setFilterPanelOpen(false);
  }
  async function toggleRecordStar(row: Row) {
    if (!metadata.scopes?.[entity]?.stars || starBusyId) return;
    const next = !row.isStarred;
    setStarBusyId(row.id); setError("");
    try {
      await request(`${encodeURIComponent(entity)}/${encodeURIComponent(row.id)}/starSubscription`, { method: next ? "PUT" : "DELETE" });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, isStarred: next } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Oblíbené položky se nepodařilo aktualizovat."); }
    finally { setStarBusyId(""); }
  }
  async function removeTaskRow(row: Row) {
    if (!canDelete || !window.confirm(`Opravdu odstranit úkol „${row.name || row.id}“?`)) return;
    setMassBusy(true); setError(""); setTaskActionMenuId("");
    try {
      await request(`Task/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      setSelectedIds((current) => current.filter((id) => id !== row.id));
      setMassNotice("Úkol byl odstraněn.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Úkol se nepodařilo odstranit."); }
    finally { setMassBusy(false); }
  }
  async function completeTaskRow(row: Row) {
    if (!canEdit || metadata.userAcl?.fieldTable?.Task?.status?.edit === "no" || ["Completed", "Canceled"].includes(row.status)) return;
    setMassBusy(true); setError("");
    try { await request(`Task/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ status: "Completed" }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Úkol se nepodařilo dokončit."); }
    finally { setMassBusy(false); }
  }
  async function setEventStatusRow(row: Row, status: "Held" | "Not Held") {
    if (!canEdit || !["Meeting", "Call"].includes(entity) || metadata.userAcl?.fieldTable?.[entity]?.status?.edit === "no" || ["Held", "Not Held"].includes(row.status)) return;
    setMassBusy(true); setError("");
    try { await request(`${encodeURIComponent(entity)}/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ status }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Stav události se nepodařilo změnit."); }
    finally { setMassBusy(false); }
  }
  async function removeEventRow(row: Row) {
    if (!canDelete || !window.confirm(`Opravdu odstranit ${entityLabel(metadata, entity, true).toLocaleLowerCase("cs")} „${row.name || "bez názvu"}“?`)) return;
    setMassBusy(true); setError(""); setTaskActionMenuId("");
    try { await request(`${encodeURIComponent(entity)}/${encodeURIComponent(row.id)}`, { method: "DELETE" }); setSelectedIds((current) => current.filter((id) => id !== row.id)); setMassNotice("Záznam byl odstraněn."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Záznam se nepodařilo odstranit."); }
    finally { setMassBusy(false); }
  }
  function switchViewMode(next: "list" | "kanban") {
    if (next === "kanban" && !canUseKanban) return;
    setViewMode(next); setOffset(0); setSelectedIds([]);
    try { localStorage.setItem(`via:list-view:${currentUserId}:${entity}:${userType || ""}`, next); } catch {}
  }
  async function changeKanbanStatus(row: Row, status: string) {
    if (!status || status === row[statusField]) return;
    setKanbanBusyId(row.id); setError("");
    try { await request(`${encodeURIComponent(entity)}/${encodeURIComponent(row.id)}`, { method: "PUT", body: JSON.stringify({ [statusField]: status }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Stav záznamu se nepodařilo změnit."); }
    finally { setKanbanBusyId(""); }
  }
  async function removeKanbanRecord(row: Row) {
    if (!canDelete || !window.confirm(`Opravdu trvale odstranit „${row.name || row.subject || row.id}“?`)) return;
    setKanbanBusyId(row.id); setError("");
    try { await request(`${encodeURIComponent(entity)}/${encodeURIComponent(row.id)}`, { method: "DELETE" }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Záznam se nepodařilo odstranit."); }
    finally { setKanbanBusyId(""); }
  }
  async function loadMoreKanban(group: KanbanGroup) {
    setKanbanBusyId(`more:${group.name}`); setError("");
    try {
      const params = new URLSearchParams({ maxSize: String(kanbanPageSize), offset: String(group.list.length), orderBy: activeOrderBy, order: activeOrder });
      const whereGroup: Row[] = [...fixedWhere];
      if (search.trim()) whereGroup.push({ type: "textFilter", value: search.trim() });
      if (userType) whereGroup.push({ type: "equals", attribute: "type", value: userType });
      if (activeBoolFilters.length) whereGroup.push({ type: "bool", value: activeBoolFilters });
      if (primaryFilter) whereGroup.push({ type: "primary", value: primaryFilter });
      whereGroup.push(...savedPresetWhere, ...appliedFilters.flatMap(conditionToWhere), { type: "equals", attribute: statusField, value: group.name });
      params.set("whereGroup", JSON.stringify(whereGroup));
      const select = [...new Set(["id", "name", "subject", statusField, ...kanbanLayout.flatMap((item) => item.name ? [item.name, `${item.name}Name`, `${item.name}Id`] : [])])].filter(Boolean).join(",");
      if (select) params.set("select", select);
      const result = await request<PageResult>(`${encodeURIComponent(entity)}?${params.toString()}`);
      setKanbanGroups((current) => current.map((item) => item.name === group.name ? { ...item, total: result.total ?? item.total, list: [...item.list, ...result.list.filter((row) => !item.list.some((existing) => existing.id === row.id))] } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Další záznamy se nepodařilo načíst."); }
    finally { setKanbanBusyId(""); }
  }
  async function saveKanbanOrder(group: string, ids: string[]) {
    setKanbanGroups((current) => current.map((item) => item.name === group ? { ...item, list: ids.flatMap((id) => { const row = item.list.find((entry) => entry.id === id); return row ? [row] : []; }) } : item));
    try { await request("Kanban/order", { method: "PUT", body: JSON.stringify({ entityType: entity, group, ids }) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Pořadí záznamů se nepodařilo uložit."); await load(); }
  }
  const end = Math.min(offset + pageSize, total || offset + rows.length);
  const editableFields = Object.entries(fieldDefs).filter(([name, def]) => fieldPermissions[name]?.edit !== "no" && fieldPermissions[name]?.read !== "no" && !def.readOnly && !def.disabled && !def.notStorable && !def.utility && !def.hidden && !name.endsWith("Id") && !name.endsWith("Data") && !["linkMultiple", "password", "jsonObject", "jsonArray"].includes(def.type || ""));
  async function bulkDelete() {
    const count = allResultsSelected ? total : selectedIds.length;
    if (!window.confirm(`Smazat ${allResultsSelected ? "všech " : ""}${count} vybraných záznamů?`)) return;
    setMassBusy(true); setError("");
    try { await request("MassAction", { method: "POST", body: JSON.stringify({ entityType: entity, action: "delete", params: massSelectionParams }) }); setSelectedIds([]); setAllResultsSelected(false); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Hromadné mazání selhalo."); }
    finally { setMassBusy(false); }
  }
  async function printSelectedPdf(template: Row) {
    setPdfTemplateOpen(false);
    setMassBusy(true); setError("");
    try {
      const result = await request<Row>("Pdf/action/massPrint", { method: "POST", body: JSON.stringify({ idList: selectedIds, entityType: entity, templateId: template.id }) });
      if (!result?.id) throw new Error("EspoCRM nevytvořilo soubor PDF.");
      window.open(`?entryPoint=download&id=${encodeURIComponent(result.id)}`, "_blank", "noopener,noreferrer");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDF se nepodařilo vygenerovat."); }
    finally { setMassBusy(false); }
  }
  async function massFollow(action: "follow" | "unfollow") {
    const countSelected = allResultsSelected ? total : selectedIds.length;
    const verb = action === "follow" ? "začít sledovat" : "přestat sledovat";
    if (!window.confirm(`Opravdu chcete ${verb} ${allResultsSelected ? "všech " : ""}${countSelected} vybraných záznamů?`)) return;
    setMassBusy(true); setError(""); setMassNotice("");
    try {
      const result = await request<Row>("MassAction", { method: "POST", body: JSON.stringify({ entityType: entity, action, params: massSelectionParams }) });
      const count = Number(result?.count) || 0;
      setMassNotice(count ? `${action === "follow" ? "Začali jste sledovat" : "Přestali jste sledovat"} ${count} ${count === 1 ? "záznam" : "záznamy"}.` : action === "follow" ? "Vybrané záznamy už sledujete." : "Žádný z vybraných záznamů už nesledujete.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Hromadnou změnu odběru se nepodařilo provést."); }
    finally { setMassBusy(false); }
  }
  async function removeReadOnlyListRecord(row: Row) {
    const label = isAuthLogRecord ? "záznam historie přihlášení" : "položku fronty e-mailů";
    if (!canDelete || !window.confirm(`Opravdu odstranit: ${label}?`)) return;
    setMassBusy(true); setError("");
    try { await request(`${encodeURIComponent(entity)}/${encodeURIComponent(row.id)}`, { method: "DELETE" }); setSelectedIds((ids) => ids.filter((id) => id !== row.id)); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `Záznam se nepodařilo odstranit.`); }
    finally { setMassBusy(false); }
  }
  async function openListRelatedRecord(scope: string, id: string) {
    if (!onNavigateEntity) return;
    try {
      const related = await request<Row>(`${encodeURIComponent(scope)}/${encodeURIComponent(id)}`);
      onNavigateEntity(scope); onOpenRecord(related);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Navázaný záznam se nepodařilo otevřít."); }
  }
  function startMerge() {
    if (selectedIds.length < 2) { setError("Pro sloučení vyberte alespoň dva záznamy."); return; }
    if (selectedIds.length > 4) { setError("EspoCRM umožňuje sloučit nejvýše čtyři záznamy najednou."); return; }
    setError(""); setMergeOpen(true);
  }
  async function moveEmailFolder(row: Row, direction: "Up" | "Down") {
    if (!emailFolderList || !canEdit || massBusy) return;
    setMassBusy(true); setError("");
    try { await request(`${entity}/action/move${direction}`, { method: "POST", body: JSON.stringify({ id: row.id }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Pořadí složek se nepodařilo změnit."); }
    finally { setMassBusy(false); }
  }
  async function bulkUpdate(event: FormEvent) {
    event.preventDefault(); if (!massField) return;
    setMassBusy(true); setError("");
    const def = fieldDefs[massField];
    const value = def?.type === "bool" ? Boolean(massValue) : ["int", "float", "currency", "enumInt"].includes(def?.type || "") && massValue !== "" ? Number(massValue) : massValue;
    const values = { [massField]: value, ...(def?.type === "currency" ? { [`${massField}Currency`]: massCurrency || metadata.appSettings?.defaultCurrency || (metadata.app as any)?.currency?.list?.[0] || "USD" } : {}) };
    try { await request("MassAction", { method: "POST", body: JSON.stringify({ entityType: entity, action: "update", params: massSelectionParams, data: { values, actions: {} } }) }); setMassEdit(false); setSelectedIds([]); setAllResultsSelected(false); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Hromadná úprava selhala."); }
    finally { setMassBusy(false); }
  }
  const exportWhere = [...savedPresetWhere, ...appliedFilters.flatMap(conditionToWhere), ...(userType ? [{ type: "equals", attribute: "type", value: userType }] : []), ...(categorySelection && "uncategorized" in categorySelection ? [categoryFieldType === "linkMultiple" ? { type: "isNotLinked", attribute: categoryField } : { type: "isNull", attribute: `${categoryField}Id` }] : categorySelection ? [{ type: "inCategory", attribute: categoryField, value: categorySelection.id }] : [])];
  const massSelectionParams = allResultsSelected ? { byWhere: true, where: [...fixedWhere, ...(search.trim() ? [{ type: "textFilter", value: search.trim() }] : []), ...(userType ? [{ type: "equals", attribute: "type", value: userType }] : []), ...savedPresetWhere, ...appliedFilters.flatMap(conditionToWhere), ...(categorySelection && "uncategorized" in categorySelection ? [categoryFieldType === "linkMultiple" ? { type: "isNotLinked", attribute: categoryField } : { type: "isNull", attribute: `${categoryField}Id` }] : categorySelection ? [{ type: "inCategory", attribute: categoryField, value: categorySelection.id }] : [])], searchParams: { ...(search.trim() ? { textFilter: search.trim() } : {}), ...(primaryFilter ? { primaryFilter } : {}), ...(activeBoolFilters.length ? { boolFilterList: activeBoolFilters } : {}), orderBy: activeOrderBy, order: activeOrder } } : { ids: selectedIds };

  return <div className="entity-view">
    <div className="entity-heading"><div><div className="eyebrow">SPRÁVA ZÁZNAMŮ</div><h1>{title || entityLabel(metadata, entity, true)}<span className="title-count">{total || ""}</span></h1><p>{userType === "api" ? "Účty služby EspoCRM pro přístup přes API." : userType === "portal" ? "Uživatelské účty zákaznických a partnerských portálů." : "Všechny záznamy a jejich aktuální stav na jednom místě."}</p></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}>{(emailFilterList || emailFolderList) && canAccessEntity(metadata, "Email") && <button type="button" className="button subtle" onClick={() => onNavigateEntity?.("Email")}><InboxIcon size={14}/>Otevřít poštu</button>}{canCreate && (entity === "Email" ? <button className="button primary" onClick={() => setComposeEmail(true)}><Plus size={15}/> Napsat e-mail</button> : <button className="button primary" onClick={startNewRecord}><Plus size={15}/>{userType === "api" ? "Nový API uživatel" : userType === "portal" ? "Nový uživatel portálu" : "Nový záznam"}</button>)}</div></div>
    {entity === "ScheduledJob" && <ScheduledJobCronNotice onOpenJobs={() => onNavigateEntity?.("Job")}/>}
    <section className={`surface records-surface ${hasCategoryNavigation ? "has-category-navigation" : ""}`}>
      {hasCategoryNavigation && <CategoryNavigation entity={categoryScope} metadata={metadata} selection={categorySelection} onSelect={(selection) => { setCategorySelection(selection); setOffset(0); }} canManage={canChangeEntity(metadata, categoryScope, "edit") || canCreateEntity(metadata, categoryScope)} onManage={() => onNavigateEntity?.(categoryScope)}/>}
      <div className="records-main">
      <div className="list-toolbar"><div className="list-tabs"><button className="list-tab active">Všechny záznamy <span>{total || rows.length}</span></button><button className="list-tab" onClick={() => { setOffset(0); setSearch(""); setQuery(""); setAppliedFilters([]); setDraftFilters([]); setSelectedPresetId(""); setSavedPresetWhere([]); setPrimaryFilter(""); setActiveBoolFilters([]); }}>Vymazat filtry <X size={12}/></button></div>
        {canUseKanban && <div className="list-view-mode" role="group" aria-label="Zobrazení záznamů"><button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => switchViewMode("list")} title="Seznam">Seznam</button><button type="button" className={viewMode === "kanban" ? "active" : ""} onClick={() => switchViewMode("kanban")} title="Kanban">Kanban</button></div>}
        {savedPresets.length > 0 && <div className="saved-filter-picker"><select aria-label="Uložený filtr" value={selectedPresetId} onChange={(event) => selectSavedPreset(event.target.value)}><option value="">Uložené filtry…</option>{savedPresets.map((preset, index) => <option key={preset.id || index} value={preset.id}>{preset.label || preset.name || "Uložený filtr"}</option>)}</select>{selectedPresetId && <button type="button" className="icon-button danger-ghost" aria-label="Odstranit uložený filtr" title="Odstranit uložený filtr" onClick={() => void removeSavedPreset()}><Trash2 size={13}/></button>}</div>}
        {primaryFilterOptions.length > 0 && <select className="native-primary-filter" aria-label="Přednastavený filtr" value={primaryFilter} onChange={(event) => { setPrimaryFilter(event.target.value); setOffset(0); }}><option value="">Všechny záznamy</option>{primaryFilterOptions.map((item) => <option key={item.name} value={item.primary}>{item.label}</option>)}</select>}
        {viewMode === "list" && <div className="column-settings-anchor"><button type="button" className={`button subtle column-settings-toggle ${columnSettingsOpen ? "selected" : ""}`} onClick={() => setColumnSettingsOpen((open) => !open)} aria-expanded={columnSettingsOpen}><SlidersHorizontal size={14}/>Sloupce</button>{columnSettingsOpen && <div className="column-settings-popover" role="dialog" aria-label="Nastavení sloupců"><div className="column-settings-title"><span><strong>Sloupce seznamu</strong><small>{columns.length} z {baseColumns.length} viditelných</small></span><button type="button" className="icon-button" aria-label="Zavřít nastavení sloupců" onClick={() => setColumnSettingsOpen(false)}><X size={14}/></button></div><div className="column-settings-list">{orderedColumns.map((name, index) => { const hidden = name in hiddenColumnMap ? hiddenColumnMap[name] : Boolean(layoutHiddenDefaults[name]); return <div className={`column-settings-row ${hidden ? "hidden-column" : ""}`} key={name}><label><input type="checkbox" checked={!hidden} disabled={!hidden && columns.length <= 1} onChange={() => toggleColumnVisibility(name)}/><span>{fieldLabel(name, fieldDefs[name], entity, metadata)}</span></label><div><button type="button" className="icon-button" title="Posunout nahoru" aria-label={`Posunout ${fieldLabel(name, fieldDefs[name], entity, metadata)} nahoru`} disabled={index === 0} onClick={() => moveColumn(name, -1)}><ArrowUp size={13}/></button><button type="button" className="icon-button" title="Posunout dolů" aria-label={`Posunout ${fieldLabel(name, fieldDefs[name], entity, metadata)} dolů`} disabled={index === orderedColumns.length - 1} onClick={() => moveColumn(name, 1)}><ArrowDown size={13}/></button></div></div>; })}</div>{canResizeColumns && <label className="column-resize-toggle"><input type="checkbox" checked={columnResizeEnabled} onChange={toggleColumnResize}/><span><strong>Měnit šířku tažením</strong><small>Táhněte za pravý okraj hlavičky sloupce.</small></span></label>}<div className="column-settings-footer"><button type="button" className="button subtle" onClick={resetColumnSettings}>Obnovit výchozí</button><button type="button" className="button primary" onClick={() => setColumnSettingsOpen(false)}>Hotovo</button></div></div>}</div>}
        {!entityClientDefs.searchPanelDisabled && !emailAccountSearchDisabled && <button type="button" className={`button subtle filter-toggle ${filterPanelOpen || appliedFilters.length || activeBoolFilters.length ? "selected" : ""}`} onClick={() => { setDraftFilters(appliedFilters.length ? appliedFilters : [{ field: filterableFields[0]?.[0] || "", operator: filterOperators(filterableFields[0]?.[0] || "")[0]?.[0] || "equals", value: "" }]); setFilterPanelOpen((open) => !open); }}><Filter size={14}/>Filtry{appliedFilters.length > 0 && <b>{appliedFilters.length}</b>}</button>}
        {!emailAccountSearchDisabled && <form className="record-search" onSubmit={doSearch}><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Hledat: ${entityLabel(metadata, entity, true).toLowerCase()}…`} /><button aria-label="Hledat"><ArrowRight size={13}/></button></form>}
      </div>
      {filterPanelOpen && <div className="advanced-filter-panel"><div className="advanced-filter-heading"><div><strong>Filtr podle polí</strong><small>Podmínky se kombinují a zpracovává je EspoCRM.</small></div><button type="button" className="button subtle" onClick={() => setDraftFilters((current) => [...current, { field: filterableFields[0]?.[0] || "", operator: filterOperators(filterableFields[0]?.[0] || "")[0]?.[0] || "equals", value: "" }])}><Plus size={13}/>Přidat podmínku</button></div>{nativeBoolFilters.length > 0 && <div className="native-bool-filters">{nativeBoolFilters.map((item) => <label key={item.name}><input type="checkbox" checked={activeBoolFilters.includes(item.name)} onChange={(event) => { setActiveBoolFilters((current) => event.target.checked ? [...current, item.name] : current.filter((name) => name !== item.name)); setOffset(0); }}/><span>{item.label}</span></label>)}</div>}{draftFilters.map((condition, index) => {
        const operators = filterOperators(condition.field);
        const def = fieldDefs[condition.field] || {};
        const type = def.type || "varchar";
        const multi = ["anyOf", "allOf", "noneOf", "isOneOf", "isNotOneOf", "isFromTeams"].includes(condition.operator);
        const categoryField = /category[-]?tree/i.test(String(def.view || ""));
        const relationField = ["link", "linkOne", "linkMultiple"].includes(type);
        const enumField = ["enum", "enumInt", "enumFloat"].includes(type);
        const noValue = filterNoValueOperators.has(condition.operator) || ["isTrue", "isFalse", "any"].includes(condition.operator);
        const range = filterNeedsRange(condition.operator);
        const count = filterNeedsCount(condition.operator);
        const dateField = ["date", "datetime", "datetimeOptional"].includes(type);
        const numberField = ["int", "float", "currency", "enumInt", "enumFloat"].includes(type);
        const inputType = dateField ? (type === "date" ? "date" : "datetime-local") : numberField ? "number" : "text";
        const setValue = (value: string | string[]) => updateDraftFilter(index, { value });
        return <div className={`advanced-filter-row ${range ? "has-range" : ""}`} key={index}>
          <select aria-label="Pole filtru" value={condition.field} onChange={(event) => { const field = event.target.value; updateDraftFilter(index, { field, operator: filterOperators(field)[0]?.[0] || "equals", value: "", valueTo: "" }); }}><option value="">Vyberte pole…</option>{filterableFields.map(([name, fieldDef]) => <option key={name} value={name}>{fieldLabel(name, fieldDef, entity, metadata)}</option>)}</select>
          <select aria-label="Operátor filtru" value={condition.operator} onChange={(event) => updateDraftFilter(index, { operator: event.target.value, value: ["anyOf", "allOf", "noneOf", "isOneOf", "isNotOneOf", "isFromTeams"].includes(event.target.value) ? [] : "", valueTo: "", valueNames: {} })}>{operators.map(([operator, label]) => <option key={operator} value={operator}>{label}</option>)}</select>
          {!noValue && (categoryField ? <button type="button" className="button subtle filter-record-picker" onClick={() => setFilterPicker({ index, category: true })}>{Array.isArray(condition.value) ? `Vybráno ${condition.value.length} kategorií…` : condition.value ? condition.valueNames?.[String(condition.value)] || "Změnit kategorii…" : "Vybrat kategorii…"}</button>
            : relationField ? <button type="button" className="button subtle filter-record-picker" onClick={() => setFilterPicker({ index, category: false })}>{Array.isArray(condition.value) ? `Vybráno ${condition.value.length} záznamů…` : condition.value ? condition.valueNames?.[String(condition.value)] || "Změnit záznam…" : "Vybrat záznam…"}</button>
            : multi && enumField ? <select aria-label="Hodnoty filtru" multiple value={Array.isArray(condition.value) ? condition.value : []} onChange={(event) => setValue(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{(def.options || []).filter((value: any) => value !== "").map((value: any) => <option key={String(value)} value={String(value)}>{(metadata.labels as any)?.[entity]?.options?.[condition.field]?.[String(value)] || String(value)}</option>)}</select>
            : multi ? <input aria-label="Hodnoty filtru" type="text" value={Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value || "")} onChange={(event) => setValue(event.target.value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))} placeholder="Hodnoty oddělené čárkou…"/>
            : enumField ? <select aria-label="Hodnota filtru" value={String(condition.value || "")} onChange={(event) => setValue(event.target.value)}><option value="">Vyberte hodnotu…</option>{(def.options || []).filter((value: any) => value !== "").map((value: any) => <option key={String(value)} value={String(value)}>{(metadata.labels as any)?.[entity]?.options?.[condition.field]?.[String(value)] || String(value)}</option>)}</select>
            : count ? <input aria-label="Počet dní" type="number" min="0" step="1" value={String(condition.value || "")} onChange={(event) => setValue(event.target.value)} placeholder="Počet dní…"/>
            : <input aria-label="Hodnota filtru" type={inputType} step={numberField && !["int", "enumInt"].includes(type) ? "any" : undefined} value={String(condition.value || "")} onChange={(event) => setValue(event.target.value)} placeholder="Hodnota…"/>)}
          {range && <input aria-label="Druhá hodnota rozsahu" type={inputType} step={numberField && !["int", "enumInt"].includes(type) ? "any" : undefined} value={condition.valueTo || ""} onChange={(event) => updateDraftFilter(index, { valueTo: event.target.value })} placeholder="Do…"/>}
          <button type="button" className="icon-button danger-ghost" aria-label="Odebrat podmínku" onClick={() => setDraftFilters((current) => current.filter((_, i) => i !== index))}><X size={15}/></button>
        </div>;
      })}<div className="advanced-filter-actions"><button type="button" className="button subtle" onClick={() => { setDraftFilters([]); setAppliedFilters([]); setSelectedPresetId(""); setSavedPresetWhere([]); setPrimaryFilter(""); setActiveBoolFilters([]); setOffset(0); }}>Vymazat vše</button><button type="button" className="button primary" onClick={() => { applyFilters(); setSelectedPresetId(""); setSavedPresetWhere([]); }}>Použít filtry</button></div><div className="save-filter-row"><input aria-label="Název uloženého filtru" value={presetNameInput} onChange={(event) => setPresetNameInput(event.target.value)} placeholder="Pojmenujte aktuální filtr…"/><button type="button" className="button subtle" disabled={presetSaving || !presetNameInput.trim() || (!appliedFilters.length && !primaryFilter)} onClick={() => void saveCurrentPreset()}><Save size={13}/>{presetSaving ? "Ukládám…" : "Uložit filtr"}</button></div></div>}
      {viewMode === "list" && (selectedIds.length > 0 || allResultsSelected || canExport && userType !== "api") && <div className="entity-bulkbar">{(selectedIds.length > 0 || allResultsSelected) && <b>{allResultsSelected ? `${total} výsledků vybráno` : `${selectedIds.length} vybráno`}</b>}{!inboundEmailList && !emailAccountList && !allResultsSelected && rows.length > 0 && total > rows.length && rows.every((row) => selectedIds.includes(row.id)) && <button className="bulk-clear" onClick={() => { setAllResultsSelected(true); setSelectedIds([]); }}>Vybrat všech {total} výsledků</button>}{allResultsSelected && <button className="bulk-clear" onClick={() => { setAllResultsSelected(false); setSelectedIds([]); }}>Zrušit výběr</button>}{canMassUpdate && userType !== "api" && (selectedIds.length > 0 || allResultsSelected) && <button onClick={() => { setMassField(""); setMassValue(""); setMassEdit(true); }} disabled={massBusy}>Hromadně upravit</button>}{canMerge && selectedIds.length > 0 && !allResultsSelected && <button onClick={startMerge} disabled={massBusy || selectedIds.length < 2} title={selectedIds.length > 4 ? "Sloučit lze nejvýše čtyři záznamy" : undefined}>Sloučit</button>}{canMassConvertCurrency && selectedIds.length > 0 && !allResultsSelected && <button onClick={() => setCurrencyConvertOpen(true)} disabled={massBusy}><ArrowRightLeft size={13}/> Převést měnu</button>}{canExport && userType !== "api" && <button onClick={() => setExportOpen(true)} disabled={massBusy}><FileInput size={13}/> Exportovat…</button>}{canPrintPdf && selectedIds.length > 0 && !allResultsSelected && <button onClick={() => setPdfTemplateOpen(true)} disabled={massBusy}><FileText size={13}/> Tisknout PDF…</button>}{canMassFollow && (selectedIds.length > 0 || allResultsSelected) && <><button onClick={() => void massFollow("follow")} disabled={massBusy}><Users size={13}/> Sledovat</button><button onClick={() => void massFollow("unfollow")} disabled={massBusy}><Users size={13}/> Přestat sledovat</button></>}{canMassRemove && (selectedIds.length > 0 || allResultsSelected) && <button className="bulk-danger" onClick={() => void bulkDelete()} disabled={massBusy}><Trash2 size={13}/> Smazat</button>}{selectedIds.length > 0 && !allResultsSelected && <button className="bulk-clear" onClick={() => { setSelectedIds([]); setAllResultsSelected(false); }}>Zrušit výběr</button>}</div>}
      {massNotice && <div className="save-confirm"><Check size={14}/>{massNotice}</div>}
      {error && <div className="table-error">{error}<button onClick={() => void load()}>Zkusit znovu</button></div>}
      {viewMode === "kanban" ? <KanbanBoard entity={entity} metadata={metadata} statusField={statusField} groups={kanbanGroups} layout={kanbanLayout} loading={busy || kanbanBusyId.startsWith("more:")} canCreate={canCreateKanban} canMove={canMoveKanban} canReorder={canReorderKanban} canEdit={canEdit} canDelete={canDelete} busyId={kanbanBusyId} onOpenRecord={onOpenRecord} onEditRecord={(row) => setEditor({ record: row })} onCreateInGroup={(status) => setEditor({ initialValues: { [statusField]: status } })} onChangeStatus={(row, status) => void changeKanbanStatus(row, status)} onRemove={(row) => void removeKanbanRecord(row)} onShowMore={(group) => void loadMoreKanban(group)} onReorder={(group, ids) => void saveKanbanOrder(group, ids)}/> : <><div className="table-wrap"><table className={`records-table ${columnResizeEnabled ? "column-resize-enabled" : ""}`}><thead><tr><th className="select-col"><input type="checkbox" aria-label="Vybrat všechny záznamy na stránce" checked={allResultsSelected || rows.length > 0 && rows.every((r) => selectedIds.includes(r.id))} onChange={(e) => { setAllResultsSelected(false); setSelectedIds((old) => e.target.checked ? [...new Set([...old, ...rows.map((r) => r.id)])] : old.filter((id) => !rows.some((r) => r.id === id))); }} /></th>{columns.map((column) => { const sortable = !notSortableColumns.includes(column) && !fieldDefs[column]?.notSortable && !metadata.fields?.[column]?.orderDisabled; const width = getColumnWidth(column); return <th key={column} style={width ? { width: `${width.value}${width.unit}` } : undefined} className={columnResizeEnabled ? "column-width-enabled" : undefined} aria-sort={sortable && activeOrderBy === column ? activeOrder === "asc" ? "ascending" : "descending" : undefined}>{sortable ? <button type="button" className={`list-sort-button ${activeOrderBy === column ? "sorted" : ""}`} onClick={() => sortBy(column)}>{fieldLabel(column, fieldDefs[column], entity, metadata)}{activeOrderBy === column ? <span aria-hidden="true">{activeOrder === "asc" ? "↑" : "↓"}</span> : <ArrowUpDown size={12} aria-hidden="true"/>}</button> : fieldLabel(column, fieldDefs[column], entity, metadata)}{columnResizeEnabled && columns.length > 1 && <span className="column-resizer" role="separator" aria-orientation="vertical" aria-label={`Změnit šířku sloupce ${fieldLabel(column, fieldDefs[column], entity, metadata)}`} onPointerDown={(event) => startColumnResize(event, column)}/>}</th>; })}<th className="actions-col"/></tr></thead>
        <tbody>{busy ? <tr><td colSpan={columns.length + 2}><div className="table-loading"><span className="spinner"/> Načítám záznamy…</div></td></tr> : rows.length ? rows.map((row, rowIndex) => <tr key={row.id} onClick={() => { if (!isAuthLogRecord && !isEmailQueueItem) onOpenRecord(row); }}>
          <td className="select-col" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Vybrat ${row.name || row.id}`} checked={allResultsSelected || selectedIds.includes(row.id)} onChange={(e) => { if (allResultsSelected) { setAllResultsSelected(false); setSelectedIds(e.target.checked ? rows.map((item) => item.id) : rows.filter((item) => item.id !== row.id).map((item) => item.id)); } else setSelectedIds((old) => e.target.checked ? [...old, row.id] : old.filter((id) => id !== row.id)); }} /></td>
          {columns.map((column, index) => <td key={column}>{index === 0 ? <span className="primary-cell"><span className="record-avatar">{String(recordFieldDisplayValue(entity, column, row) || "?").slice(0, 1).toUpperCase()}</span><span className={`cell-main ${entity === "InboundEmail" && column === "name" && row.isSystem ? "inbound-email-system-name" : ""}`} title={entity === "InboundEmail" && row.isSystem ? "Systémová schránka" : undefined}>{fieldDefs[column]?.type === "linkMultiple" && fieldDefs[column]?.columns ? <LinkMultipleDisplay entity={entity} name={column} record={row} def={fieldDefs[column]} metadata={metadata} onOpen={onNavigateEntity ? openListRelatedRecord : undefined}/> : ["url", "urlMultiple"].includes(String(fieldDefs[column]?.type)) ? <UrlFieldDisplay value={recordFieldDisplayValue(entity, column, row)} multiple={fieldDefs[column]?.type === "urlMultiple"} copyToClipboard={Boolean(fieldDefs[column]?.copyToClipboard)}/> : ["email", "emailAddress", "phone"].includes(String(fieldDefs[column]?.type)) ? <ContactFieldDisplay value={recordFieldDisplayValue(entity, column, row)} type={String(fieldDefs[column]?.type)}/> : fieldDefs[column]?.type?.startsWith("enum") ? <EnumValue value={recordFieldDisplayValue(entity, column, row)} def={fieldDefs[column]} metadata={metadata} entity={entity} name={column}/> : (entity === "Meeting" || entity === "Call") && column === "dateStart" ? <EventStartDisplay record={row} entity={entity} metadata={metadata} timeZone={dateTimeZone} value={row.isAllDay && entity === "Meeting" ? row.dateStartDate : row.dateStart}/> : displayValue(recordFieldDisplayValue(entity, column, row), fieldDefs[column]) || <em>Bez názvu</em>}</span>{entity === "Task" && taskDeadlineState(row, dateTimeZone).kind === "overdue" && <span className="task-overdue-badge"><Clock3 size={11}/>Po termínu</span>}</span> : entity === "Task" && column === "dateEnd" ? <TaskDeadlineDisplay record={row} timeZone={dateTimeZone}/> : (entity === "Meeting" || entity === "Call") && column === "dateStart" ? <EventStartDisplay record={row} entity={entity} metadata={metadata} timeZone={dateTimeZone} value={row.isAllDay && entity === "Meeting" ? row.dateStartDate : row.dateStart}/> : fieldDefs[column]?.type === "linkMultiple" && fieldDefs[column]?.columns ? <LinkMultipleDisplay entity={entity} name={column} record={row} def={fieldDefs[column]} metadata={metadata} onOpen={onNavigateEntity ? openListRelatedRecord : undefined}/> : entity === "Contact" && column === "account" && row.accountIsInactive ? <span className="inactive-account-reference">{renderCell(recordFieldDisplayValue(entity, column, row), fieldDefs[column], row[`${column}Currency`], metadata, entity, column, dateTimeZone)}</span> : renderCell(recordFieldDisplayValue(entity, column, row), fieldDefs[column], row[`${column}Currency`], metadata, entity, column, dateTimeZone)}</td>)}
          <td className="actions-col">{emailFolderList && canEdit && <><button type="button" className="icon-button email-folder-order-action" title="Posunout složku nahoru" aria-label={`Posunout složku ${row.name || ""} nahoru`} disabled={massBusy || offset + rowIndex === 0} onClick={(event) => { event.stopPropagation(); void moveEmailFolder(row, "Up"); }}><ArrowUp size={13}/></button><button type="button" className="icon-button email-folder-order-action" title="Posunout složku dolů" aria-label={`Posunout složku ${row.name || ""} dolů`} disabled={massBusy || Boolean(total && offset + rowIndex >= total - 1)} onClick={(event) => { event.stopPropagation(); void moveEmailFolder(row, "Down"); }}><ArrowDown size={13}/></button></>}{metadata.scopes?.[entity]?.stars && !isAuthLogRecord && !isEmailQueueItem && <button type="button" className={`icon-button record-star-action ${row.isStarred ? "is-starred" : ""}`} title={row.isStarred ? "Odebrat z oblíbených" : "Přidat do oblíbených"} aria-label={row.isStarred ? "Odebrat z oblíbených" : "Přidat do oblíbených"} disabled={starBusyId === row.id} onClick={(event) => { event.stopPropagation(); void toggleRecordStar(row); }}><Star size={14} fill={row.isStarred ? "currentColor" : "none"}/></button>}{canEdit && entity === "Task" && metadata.userAcl?.fieldTable?.Task?.status?.edit !== "no" && !["Completed", "Canceled"].includes(row.status) && <button className="icon-button task-complete-action" title="Označit jako dokončený" aria-label="Označit jako dokončený" disabled={massBusy} onClick={(e) => { e.stopPropagation(); void completeTaskRow(row); }}><Check size={14}/></button>}{(isAuthLogRecord || isEmailQueueItem) && canDelete && <button type="button" className="icon-button danger-ghost" title="Odstranit záznam" aria-label={isAuthLogRecord ? "Odstranit záznam historie přihlášení" : "Odstranit položku fronty e-mailů"} disabled={massBusy} onClick={(e) => { e.stopPropagation(); void removeReadOnlyListRecord(row); }}><Trash2 size={14}/></button>}{!isAuthLogRecord && !isEmailQueueItem && (entity === "Task" || entity === "Meeting" || entity === "Call") ? <ActivityRowActions scope={entity} row={row} expanded={taskActionMenuId === row.id} onToggle={() => setTaskActionMenuId((current) => current === row.id ? "" : row.id)} onOpen={() => { setTaskActionMenuId(""); onOpenRecord(row); }} onEdit={() => { setTaskActionMenuId(""); setEditor({ record: row }); }} canEdit={canEdit} canDelete={canDelete} canChangeStatus={canEdit && metadata.userAcl?.fieldTable?.[entity]?.status?.edit !== "no"} canComplete={entity === "Task" && canEdit && metadata.userAcl?.fieldTable?.Task?.status?.edit !== "no" && !["Completed", "Canceled"].includes(row.status)} onComplete={() => { setTaskActionMenuId(""); void completeTaskRow(row); }} onSetStatus={(status) => { setTaskActionMenuId(""); void setEventStatusRow(row, status); }} onRemove={() => { setTaskActionMenuId(""); if (entity === "Task") void removeTaskRow(row); else void removeEventRow(row); }} busy={massBusy}/> : !isAuthLogRecord && !isEmailQueueItem && <button className="row-more" onClick={(event) => { event.stopPropagation(); onOpenRecord(row); }}>···</button>}</td>
        </tr>) : <tr><td colSpan={columns.length + 2}><EmptyState label="Žádné záznamy k zobrazení" /></td></tr>}</tbody></table></div>
      <div className="table-footer"><span>Zobrazeno <b>{rows.length ? offset + 1 : 0}–{end}</b>{total ? <> z <b>{total}</b></> : " záznamů"}</span><div className="pagination"><button aria-label="Předchozí stránka" disabled={!offset || busy} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ChevronLeft size={14}/></button><span>{Math.floor(offset / pageSize) + 1}</span><button aria-label="Další stránka" disabled={busy || (total ? end >= total : rows.length < pageSize)} onClick={() => setOffset(offset + pageSize)}><ChevronRight size={14}/></button></div></div></>}
      </div>
    </section>
    {editor && <RecordEditor entity={entity} fields={createFields} metadata={metadata} record={editor.record} initialValues={{ ...(userType ? { type: userType } : {}), ...(editor.initialValues || {}) }} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void load(); }} />}
    {portalContactPicker && <SelectRecordsDialog entity="Contact" metadata={metadata} multiple={false} selectedIds={[]} selectedRows={[]} primaryFilter="notPortalUsers" onClose={() => setPortalContactPicker(false)} onSkip={() => { setPortalContactPicker(false); setEditor({ initialValues: { type: "portal" } }); }} onSelect={(rows) => { const selected = rows[0]; setPortalContactPicker(false); if (!selected?.id) return; void request<Row>(`Contact/${encodeURIComponent(selected.id)}`).then((contact) => { const initialValues: Row = { type: "portal", contactId: contact.id, contactName: contact.name, firstName: contact.firstName || "", lastName: contact.lastName || "", salutationName: contact.salutationName || "", emailAddress: contact.emailAddress || "", emailAddressData: contact.emailAddressData || [], phoneNumber: contact.phoneNumber || "", phoneNumberData: contact.phoneNumberData || [], userName: String(contact.emailAddress || "").toLowerCase() }; if (contact.accountId) { initialValues.accountsIds = [contact.accountId]; initialValues.accountsNames = { [contact.accountId]: contact.accountName || "" }; } setEditor({ initialValues }); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Kontakt se nepodařilo načíst.")); }}/ >}
    {exportOpen && <ExportDialog key={entity} entity={entity} metadata={metadata} selectedIds={selectedIds} total={total} search={search} primaryFilter={primaryFilter} boolFilters={activeBoolFilters} where={exportWhere} orderBy={activeOrderBy} order={activeOrder} onClose={() => setExportOpen(false)} />}
    {pdfTemplateOpen && <SelectRecordsDialog entity="Template" metadata={metadata} multiple={false} selectedIds={[]} selectedRows={[]} fixedWhere={[{ type: "equals", attribute: "entityType", value: entity }]} onClose={() => setPdfTemplateOpen(false)} onSelect={(templates) => { const template = templates[0]; if (template) void printSelectedPdf(template); }}/>}
    {currencyConvertOpen && <CurrencyConversionDialog entity={entity} metadata={metadata} fields={currencyFields} ids={selectedIds} onClose={() => setCurrencyConvertOpen(false)} onComplete={() => { setCurrencyConvertOpen(false); setSelectedIds([]); void load(); }}/>}
    {mergeOpen && <MergeRecordsDialog entity={entity} ids={selectedIds} metadata={metadata} onClose={() => setMergeOpen(false)} onComplete={(id) => { setMergeOpen(false); setSelectedIds([]); void load(); void request<Row>(`${encodeURIComponent(entity)}/${encodeURIComponent(id)}`).then(onOpenRecord).catch(() => {}); }}/ >}
    {massEdit && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setMassEdit(false)}><form className="record-modal mass-edit-modal" onSubmit={bulkUpdate}><div className="modal-heading"><div><span className="eyebrow">HROMADNÁ AKCE · {allResultsSelected ? total : selectedIds.length} ZÁZNAMŮ</span><h2>Upravit vybrané záznamy</h2></div><button type="button" className="icon-button" onClick={() => setMassEdit(false)} aria-label="Zavřít"><X size={17}/></button></div><label className="field-input"><span>Pole k úpravě</span><select value={massField} required onChange={(e) => { setMassField(e.target.value); setMassValue(""); setMassCurrency(""); }}><option value="">Vyberte pole…</option>{editableFields.map(([name, def]) => <option key={name} value={name}>{fieldLabel(name, def, entity, metadata)}</option>)}</select></label>{massField && <FieldInput entity={entity} metadata={metadata} name={massField} def={fieldDefs[massField]} value={massValue} currencyValue={massCurrency} onCurrencyChange={setMassCurrency} onChange={setMassValue}/>}<div className="modal-footer"><button type="button" className="button subtle" onClick={() => setMassEdit(false)}>Zrušit</button><button className="button primary" disabled={massBusy || !massField}>{massBusy ? "Ukládám…" : "Použít změnu"}</button></div></form></div>}
    {composeEmail && <EmailComposer metadata={metadata} onClose={() => setComposeEmail(false)} onSaved={() => { setComposeEmail(false); void load(); }} />}
    {filterPicker && draftFilters[filterPicker.index] && (() => {
      const condition = draftFilters[filterPicker.index];
      const def = fieldDefs[condition.field] || {};
      const relationEntity = condition.operator === "isFromTeams" ? "Team" : filterRelationEntity(condition.field, def);
      const multiple = def.type === "linkMultiple" || ["anyOf", "allOf", "noneOf", "isOneOf", "isNotOneOf", "isFromTeams"].includes(condition.operator);
      const selectedIds = Array.isArray(condition.value) ? condition.value : condition.value ? [condition.value] : [];
      const selectedRows = selectedIds.map((id: string) => ({ id, name: condition.valueNames?.[id] || id }));
      const onSelect = (rows: Row[]) => {
        const names = Object.fromEntries(rows.map((row) => [row.id, row.name || row.subject || row.userName || row.id]));
        updateDraftFilter(filterPicker.index, { value: multiple ? rows.map((row) => row.id) : rows[0]?.id || "", valueNames: names });
        setFilterPicker(null);
      };
      if (!relationEntity) return null;
      return filterPicker.category ? <CategoryTreeDialog entity={relationEntity} metadata={metadata} multiple={def.type === "linkMultiple"} selectedIds={selectedIds} selectedRows={selectedRows} onClose={() => setFilterPicker(null)} onSelect={onSelect}/> : <SelectRecordsDialog entity={relationEntity} metadata={metadata} multiple={multiple} selectedIds={selectedIds} selectedRows={selectedRows} onClose={() => setFilterPicker(null)} onSelect={onSelect}/>;
    })()}
  </div>;
}

function emailComposerSnapshot(data: Row) {
  return JSON.stringify({ to: data.to || "", cc: data.cc || "", bcc: data.bcc || "", subject: data.subject || "", body: data.body || "", isHtml: Boolean(data.isHtml), sendAt: data.sendAt || "", attachments: data.attachments || (data.attachmentsIds || []).map((id: string) => ({ id })) });
}

function dateTimeLocalValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function convertEmailBodyFormat(value: string, fromHtml: boolean, toHtml: boolean) {
  if (fromHtml === toHtml) return value;
  if (toHtml) return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  return new DOMParser().parseFromString(value, "text/html").body.textContent || "";
}

function EmailComposer({ metadata, onClose, onSaved, initial = {} }: { metadata: Metadata; onClose: () => void; onSaved: () => void; initial?: Row }) {
  const [to, setTo] = useState(initial.to || "");
  const [cc, setCc] = useState(initial.cc || "");
  const [bcc, setBcc] = useState(initial.bcc || "");
  const [repliedId, setRepliedId] = useState(initial.repliedId || "");
  const [inReplyTo, setInReplyTo] = useState(initial.inReplyTo || "");
  const [subject, setSubject] = useState(initial.subject || "");
  const [body, setBody] = useState(initial.body || "");
  const [isHtml, setIsHtml] = useState(Boolean(initial.isHtml));
  const [bodyChanged, setBodyChanged] = useState(false);
  const originalBody = useRef({ value: String(initial.body || ""), isHtml: Boolean(initial.isHtml) });
  const [sendAt, setSendAt] = useState(initial.sendAt ? String(initial.sendAt).slice(0, 16) : "");
  const [templates, setTemplates] = useState<Row[]>([]);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; type: string }>>(() => (initial.attachmentsIds || []).map((id: string) => ({ id, name: initial.attachmentsNames?.[id] || "Příloha", type: initial.attachmentsTypes?.[id] || "application/octet-stream" })));
  const [uploading, setUploading] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftLoading, setDraftLoading] = useState(Boolean(initial.id));
  const recipientEntities = (Array.isArray(metadata.appParams?.emailAddressSelectEntityTypeList) ? metadata.appParams.emailAddressSelectEntityTypeList : []).filter((entity: string) => canAccessEntity(metadata, entity));
  const [recipientPickerField, setRecipientPickerField] = useState<"to" | "cc" | "bcc" | null>(null);
  const [recipientEntity, setRecipientEntity] = useState(String(recipientEntities[0] || "Contact"));
  const initialAttachments = (initial.attachmentsIds || []).map((id: string) => ({ id, name: initial.attachmentsNames?.[id] || "Příloha", type: initial.attachmentsTypes?.[id] || "application/octet-stream" }));
  const originalAttachments = useRef(initialAttachments);
  const baseline = useRef(emailComposerSnapshot({ ...initial, attachments: initialAttachments, sendAt: initial.sendAt ? String(initial.sendAt).replace(" ", "T").slice(0, 16) : "" }));
  const currentSnapshot = emailComposerSnapshot({ to, cc, bcc, subject, body, isHtml, sendAt, attachments });
  const hasUnsavedChanges = currentSnapshot !== baseline.current;
  useEffect(() => {
    let live = true;
    const user = getSession()?.user;
    Promise.all([
      request<PageResult>("EmailTemplate?maxSize=100&select=id,name").catch(() => ({ list: [], total: 0 })),
      user ? request<Row>(`Preferences/${encodeURIComponent(user.id)}`).catch(() => ({} as Row)) : Promise.resolve({} as Row),
    ]).then(([result, preferences]) => {
      if (!live) return;
      setTemplates(result.list || []);
      const plainSignature = String(preferences.signature || "").replace(/<br\s*\/?>(\r?\n)?/gi, "\n").replace(/<\/(p|div)>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
      setSignature(plainSignature.trim());
    });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!initial.id) return;
    let live = true;
    request<Row>(`Email/${encodeURIComponent(initial.id)}`).then((draft) => {
      if (!live) return;
      setTo(draft.to || ""); setCc(draft.cc || ""); setBcc(draft.bcc || ""); setSubject(draft.subject || ""); setBody(draft.body || ""); setIsHtml(Boolean(draft.isHtml)); setRepliedId(draft.repliedId || ""); setInReplyTo(draft.inReplyTo || "");
      setSendAt(draft.sendAt ? String(draft.sendAt).replace(" ", "T").slice(0, 16) : "");
      const draftAttachments = (draft.attachmentsIds || []).map((id: string) => ({ id, name: draft.attachmentsNames?.[id] || "Příloha", type: draft.attachmentsTypes?.[id] || "application/octet-stream" }));
      setAttachments(draftAttachments);
      originalBody.current = { value: String(draft.body || ""), isHtml: Boolean(draft.isHtml) };
      originalAttachments.current = draftAttachments;
      baseline.current = emailComposerSnapshot({ ...draft, attachments: draftAttachments, sendAt: draft.sendAt ? String(draft.sendAt).replace(" ", "T").slice(0, 16) : "" });
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Koncept se nepodařilo načíst."))
      .finally(() => live && setDraftLoading(false));
    return () => { live = false; };
  }, [initial.id]);
  async function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    setError("");
    try {
      if (bodyChanged && body.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() && !window.confirm("Použití šablony nahradí rozepsaný text. Pokračovat?")) { setTemplateId(""); return; }
      const prepared = await request<Row>(`EmailTemplate/${encodeURIComponent(id)}/prepare`, { method: "POST", body: JSON.stringify({ emailAddress: to || undefined }) });
      if (prepared.subject) setSubject(prepared.subject);
      const nextHtml = typeof prepared.isHtml === "boolean" ? prepared.isHtml : isHtml;
      let nextBody = prepared.body == null ? "" : String(prepared.body);
      if (originalBody.current.value && !bodyChanged) {
        const initialText = convertEmailBodyFormat(originalBody.current.value, originalBody.current.isHtml, nextHtml);
        nextBody = nextBody ? `${nextBody}${nextHtml ? "<br><br>" : "\n\n"}${initialText}` : initialText;
      }
      setBody(nextBody);
      setIsHtml(nextHtml);
      setBodyChanged(false);
      if (prepared.to != null) setTo(prepared.to);
      if (prepared.cc != null) setCc(prepared.cc);
      const names = prepared.attachmentsNames || {};
      const templateAttachments = Array.isArray(prepared.attachmentsIds) ? prepared.attachmentsIds.map((attachmentId: string) => ({ id: attachmentId, name: names[attachmentId] || "Příloha šablony", type: "application/octet-stream" })) : [];
      setAttachments([...new Map([...templateAttachments, ...originalAttachments.current].map((item) => [item.id, item])).values()]);
    } catch (e) { setError(e instanceof Error ? e.message : "Šablonu se nepodařilo načíst."); }
  }
  function toggleHtmlFormat(enabled: boolean) {
    if (enabled === isHtml) return;
    setBody((current: string) => convertEmailBodyFormat(current, isHtml, enabled));
    setBodyChanged(true);
    setIsHtml(enabled);
  }
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setError("");
    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => uploadAttachment(file, "Email", "attachments", true)));
      setAttachments((current) => [...current, ...uploaded]);
    } catch (e) { setError(e instanceof Error ? e.message : "Přílohy se nepodařilo nahrát."); }
    finally { setUploading(false); }
  }
  async function submit(status: "Sending" | "Draft") {
    if (sendAt && (!Number.isFinite(new Date(sendAt).getTime()) || new Date(sendAt).getTime() <= Date.now())) { setError("Naplánované odeslání musí být v budoucnosti."); return; }
    if (status === "Sending" && sendAt) status = "Draft";
    setBusy(true); setError("");
    try {
      const escapedSignature = signature.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] || character)).replace(/\n/g, "<br>");
      const signatureAlreadyPresent = Boolean(signature) && (body.includes(signature) || (isHtml && body.includes(escapedSignature)));
      const messageBody = body.trim() || !signature || signatureAlreadyPresent ? body : isHtml ? `${body.trim()}<br><br>${escapedSignature}` : `${body.trim()}\n\n${signature}`;
      const payload: Row = { to, cc, bcc, subject, body: messageBody, isHtml, status, ...(initial.parentType && initial.parentId ? { parentType: initial.parentType, parentId: initial.parentId } : {}), ...(repliedId ? { repliedId } : {}), ...(inReplyTo ? { inReplyTo } : {}), attachmentsIds: attachments.map((item) => item.id), attachmentsNames: Object.fromEntries(attachments.map((item) => [item.id, item.name])), attachmentsTypes: Object.fromEntries(attachments.map((item) => [item.id, item.type])) };
      payload.sendAt = sendAt ? new Date(sendAt).toISOString() : null;
      await request<Row>(initial.id ? `Email/${encodeURIComponent(initial.id)}` : "Email", { method: initial.id ? "PUT" : "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "E-mail se nepodařilo připravit."); }
    finally { setBusy(false); }
  }
  function recipientInput(field: "to" | "cc" | "bcc", label: string, value: string, onChange: (value: string) => void) {
    return <label>{label}<div className="email-recipient-input"><input type="text" required={field === "to"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field === "to" ? "jmeno@firma.cz" : "volitelné adresy oddělené středníkem"} autoFocus={field === "to" && !initial.id}/>{recipientEntities.length > 0 && <button type="button" className="button subtle" onClick={() => { if (!recipientEntities.includes(recipientEntity)) setRecipientEntity(recipientEntities[0]); setRecipientPickerField(field); }}>Vybrat z CRM</button>}</div></label>;
  }
  function closeComposer() { if (!hasUnsavedChanges || window.confirm("E-mail obsahuje neuložené změny. Opravdu chcete zavřít editor?")) onClose(); }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeComposer(); return; }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); if (!busy && !uploading && !draftLoading) void submit("Draft"); }
      if (event.key === "Enter") { event.preventDefault(); if (!busy && !uploading && !draftLoading) void submit(sendAt ? "Draft" : "Sending"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeComposer()}><form className="record-modal email-modal" onSubmit={(e) => { e.preventDefault(); void submit(sendAt ? "Draft" : "Sending"); }}>
    <div className="modal-heading"><div><span className="eyebrow">{initial.id ? "KONCEPT E-MAILU" : "NOVÁ ZPRÁVA"}</span><h2>{initial.id ? "Upravit koncept" : "Napsat e-mail"}</h2></div><button type="button" className="icon-button" onClick={closeComposer} aria-label="Zavřít"><X size={17}/></button></div>
    {draftLoading ? <div className="table-loading"><span className="spinner"/>Načítám koncept…</div> : <div className="email-compose-fields">
      {templates.length > 0 && <label>Šablona<select value={templateId} onChange={(e) => void applyTemplate(e.target.value)}><option value="">Bez šablony</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}{recipientEntities.length > 1 && <label>Adresář kontaktů<select value={recipientEntity} onChange={(event) => setRecipientEntity(event.target.value)}>{recipientEntities.map((entity: string) => <option key={entity} value={entity}>{entityLabel(metadata, entity, true)}</option>)}</select></label>}
      {recipientInput("to", "Komu", to, setTo)}{recipientInput("cc", "Kopie", cc, setCc)}{recipientInput("bcc", "Skrytá kopie", bcc, setBcc)}<label>Předmět<input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} /></label><div className="email-compose-body"><div className="email-compose-body-head"><span>Zpráva</span><label><input type="checkbox" checked={isHtml} onChange={(e) => toggleHtmlFormat(e.target.checked)}/> Formátovaný text</label></div>{isHtml ? <Suspense fallback={<div className="table-loading" role="status"><span className="spinner"/>Načítám textový editor…</div>}><WysiwygEditor value={body} htmlMode entity="Email" field="body" onChange={(value) => { setBody(value); setBodyChanged(true); }}/></Suspense> : <textarea rows={10} value={body} onChange={(e) => { setBody(e.target.value); setBodyChanged(true); }} />}{signature && <small>Po odeslání bude připojen váš podpis z osobního nastavení.</small>}</div>
      <label>Odeslat později<input type="datetime-local" value={sendAt} min={dateTimeLocalValue(new Date(Date.now() + 60000))} onChange={(e) => setSendAt(e.target.value)} /></label>
      <label>Přílohy<input type="file" multiple onChange={(e) => { void addFiles(e.target.files); e.currentTarget.value = ""; }} /></label>
      {(uploading || attachments.length > 0) && <div className="email-attachments">{uploading && <span>Nahrávám přílohy…</span>}{attachments.map((item) => <span key={item.id}><Paperclip size={12}/>{item.name}<button type="button" aria-label={`Odebrat ${item.name}`} onClick={() => setAttachments((current) => current.filter((attachment) => attachment.id !== item.id))}><X size={12}/></button></span>)}</div>}
    </div>}
    {error && <div className="inline-error">{error}</div>}
    <div className="modal-footer"><button type="button" className="button subtle" title="Ctrl+S" onClick={() => void submit("Draft")} disabled={busy || uploading || draftLoading}>Uložit koncept <kbd>Ctrl+S</kbd></button><button className="button primary" title="Ctrl+Enter" disabled={busy || uploading || draftLoading}>{busy ? "Odesílám…" : sendAt ? "Naplánovat odeslání" : "Odeslat e-mail"}<kbd>Ctrl+Enter</kbd><ArrowRight size={14}/></button></div>
  </form>{recipientPickerField && recipientEntities.length > 0 && <SelectRecordsDialog entity={recipientEntities.includes(recipientEntity) ? recipientEntity : recipientEntities[0]} metadata={metadata} multiple selectedIds={[]} selectedRows={[]} mandatorySelectAttributeList={["emailAddress", "emailAddressIsInvalid"]} fixedWhere={[{ type: "isNotNull", attribute: "emailAddress" }, { type: "notEquals", attribute: "emailAddress", value: "" }, { type: "isFalse", attribute: "emailAddressIsInvalid" }]} onClose={() => setRecipientPickerField(null)} onSelect={(rows) => { const additions = rows.map((row) => String(row.emailAddress || "").trim()).filter(Boolean); const setter = recipientPickerField === "to" ? setTo : recipientPickerField === "cc" ? setCc : setBcc; const current = (recipientPickerField === "to" ? to : recipientPickerField === "cc" ? cc : bcc).split(/[;,]/).map((item: string) => item.trim()).filter(Boolean); setter([...new Map([...current, ...additions].map((address) => [address.toLowerCase(), address])).values()].join("; ")); setRecipientPickerField(null); }}/>}</div>;
}

function addCalendarPeriod(timestamp: number, period: string) {
  const match = /^(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)$/i.exec(period.trim());
  if (!match) return timestamp + 8 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const date = new Date(timestamp);
  if (unit.startsWith("second")) date.setUTCSeconds(date.getUTCSeconds() + amount);
  else if (unit.startsWith("minute")) date.setUTCMinutes(date.getUTCMinutes() + amount);
  else if (unit.startsWith("hour")) date.setUTCHours(date.getUTCHours() + amount);
  else if (unit.startsWith("day")) date.setUTCDate(date.getUTCDate() + amount);
  else if (unit.startsWith("week")) date.setUTCDate(date.getUTCDate() + amount * 7);
  else if (unit.startsWith("month")) date.setUTCMonth(date.getUTCMonth() + amount);
  else if (unit.startsWith("year")) date.setUTCFullYear(date.getUTCFullYear() + amount);
  return date.getTime();
}

function RecordDrawer({ entity, record: initial, metadata, onClose, onChanged, onOpenRelated, onOpenPreferences, onOpenEmailAccounts, onOpenEntity, onOpenCalendar, onComposeEmail }: { entity: string; record: Row; metadata: Metadata; onClose: () => void; onChanged: (record: Row) => void; onOpenRelated: (entity: string, row: Row) => void; onOpenPreferences: (record: Row) => void; onOpenEmailAccounts: (record: Row) => void; onOpenEntity: (entity: string, where?: Row[]) => void; onOpenCalendar: (record: Row) => void; onComposeEmail: (draft: Row) => void }) {
  const [record, setRecord] = useState(() => entity === "AppSecret" ? { ...initial, value: "" } : initial);
  const [copiedCredential, setCopiedCredential] = useState("");
  const [dateTimeZone, setDateTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  useEffect(() => { const id = getSession()?.user.id; if (!id) return; let live = true; request<Row>(`Preferences/${encodeURIComponent(id)}`).then((prefs) => live && typeof prefs.timeZone === "string" && Boolean(prefs.timeZone) && setDateTimeZone(prefs.timeZone)).catch(() => {}); return () => { live = false; }; }, [entity]);
  const [editor, setEditor] = useState(false);
  const [duplicateValues, setDuplicateValues] = useState<Row | null>(null);
  const [layoutSetEditorOpen, setLayoutSetEditorOpen] = useState(false);
  const [dashboardDeployOpen, setDashboardDeployOpen] = useState(false);
  const [mapAddress, setMapAddress] = useState<AddressParts | null>(null);
  const [busy, setBusy] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [currencyConvertOpen, setCurrencyConvertOpen] = useState(false);
  const [personalDataOpen, setPersonalDataOpen] = useState(false);
  const [userSecurityOpen, setUserSecurityOpen] = useState(false);
  const [massTestOpen, setMassTestOpen] = useState(false);
  const [massTestPicker, setMassTestPicker] = useState("");
  const [massTestRecipients, setMassTestRecipients] = useState<Record<string, Row[]>>({ User: [], Contact: [], Lead: [], Account: [] });
  const [massTestBusy, setMassTestBusy] = useState(false);
  const [acceptanceOpen, setAcceptanceOpen] = useState(false);
  const [meetingAttendeeMailMode, setMeetingAttendeeMailMode] = useState<"invitations" | "cancellation" | null>(null);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [aclMap, setAclMap] = useState<Row>({});
  const [targetAcl, setTargetAcl] = useState<Row | null>(null);
  const [userNotice, setUserNotice] = useState("");
  const [copiedFormUrl, setCopiedFormUrl] = useState(false);
  const [error, setError] = useState("");
  const fields = metadata.entityDefs?.[entity]?.fields || {};
  const readableFieldPermissions = metadata.userAcl?.fieldTable?.[entity] || {};
  const canEditRecord = !record.deleted && !["AuthLogRecord", "EmailQueueItem", "LeadCaptureLogRecord"].includes(entity) && canChangeEntity(metadata, entity, "edit") && !metadata.clientDefs?.[entity]?.editDisabled;
  const canDeleteRecord = !record.deleted && canChangeEntity(metadata, entity, "delete");
  const canDuplicateRecord = !record.deleted && entity !== "LeadCaptureLogRecord" && canCreateEntity(metadata, entity) && !metadata.clientDefs?.[entity]?.duplicateDisabled;
  const currencyFields = Object.entries(fields).filter(([name, def]) => readableFieldPermissions[name]?.edit !== "no" && readableFieldPermissions[name]?.read !== "no" && def.type === "currency" && !def.readOnly && !def.disabled && !def.notStorable && !def.utility && !def.hidden);
  const canConvertCurrency = canEditRecord && !metadata.clientDefs?.[entity]?.convertCurrencyDisabled && (metadata.appSettings?.currencyList?.length || 0) > 1 && currencyFields.length > 0;
  const [detailLayout, setDetailLayout] = useState<DetailLayoutPanel[]>([]);
  useEffect(() => { let live = true; fetchLayout<DetailLayoutPanel[]>(entity, "detail").then((layout) => live && Array.isArray(layout) && setDetailLayout(layout)).catch(() => {}); return () => { live = false; }; }, [entity]);
  const fallbackDetails = Object.entries(fields).filter(([name, def]) => readableFieldPermissions[name]?.read !== "no" && !def.notStorable && !def.utility && !def.hidden && !name.endsWith("Data") && !name.endsWith("Id") && (record[name] != null || record[`${name}Name`] != null) && record[name] !== "").map(([name]) => ({ name }));
  const basePanels = detailLayout.length ? detailLayout : [{ label: "Informace o záznamu", rows: fallbackDetails.map((item) => [item]) }];
  const providerPanel = authenticationProviderLayout(metadata, entity, String(record.method || ""), record);
  const panels = providerPanel ? [...basePanels, providerPanel] : basePanels;
  const notActualStatuses = metadata.entityDefs?.Lead?.fields?.status?.notActualOptions || [];
  const convertible = entity === "Lead" && Boolean(record.status) && ![...notActualStatuses, "Converted"].includes(record.status);
  const hasPersonalData = Boolean((metadata.scopes[entity] as any)?.hasPersonalData);
  const canViewPersonalData = hasPersonalData && aclMap.dataPrivacyPermission === "yes";
  const canErasePersonalData = canViewPersonalData && Boolean(aclMap.table?.[entity]?.edit) && aclMap.table?.[entity]?.edit !== "no";
  const personalFields = Object.entries(fields).flatMap(([name, def]) => {
    if (!(def as any).isPersonalData) return [];
    const restriction = aclMap.fieldTable?.[entity]?.[name];
    if (restriction === false || restriction?.read === false || restriction?.read === "no") return [];
    const fieldType = String(def.type || "");
    const fieldDefinition = metadata.fields?.[fieldType];
    const naming = fieldDefinition?.naming || "suffix";
    const actualFields = fieldDefinition?.actualFields;
    const attributeNames = actualFields?.length
      ? actualFields.map((part: string) => !part ? name : naming === "prefix" ? `${part}${name[0].toUpperCase()}${name.slice(1)}` : `${name}${part[0].toUpperCase()}${part.slice(1)}`)
      : [name];
    const attributes = [...new Set([...attributeNames, ...((def as any).additionalAttributeList || [])])]
      .map((attribute) => ({ name: attribute, value: record[attribute] }))
      .filter(({ value }) => Boolean(value) && (!Array.isArray(value) || value.length > 0));
    if (!attributes.length) return [];
    const value = attributes.length === 1 ? attributes[0].value : Object.fromEntries(attributes.map((attribute) => {
      const prefix = `${name[0].toLowerCase()}${name.slice(1)}`;
      let label = attribute.name === name ? name : attribute.name.startsWith(name) ? attribute.name.slice(name.length) : attribute.name.startsWith(prefix) ? attribute.name.slice(prefix.length) : attribute.name;
      label = label.replace(/^./, (part: string) => part.toLowerCase()) || name;
      return [label, attribute.value];
    }));
    return [{ name, def, value, attributes, canErase: canErasePersonalData && restriction?.edit !== false && restriction?.edit !== "no" }];
  }).sort((a, b) => fieldLabel(a.name, a.def, entity, metadata).localeCompare(fieldLabel(b.name, b.def, entity, metadata), undefined, { sensitivity: "base" }));
  const sessionUser = getSession()?.user;
  const isEventRecord = entity === "Meeting" || entity === "Call";
  const eventLabel = entity === "Call" ? "hovoru" : "schůzky";
  const meetingAcceptanceOptions = isEventRecord ? (metadata.entityDefs?.[entity]?.fields?.acceptanceStatus?.options || []).map(String).filter((status) => status !== "None") : [];
  const meetingAcceptanceStatus = String((record.usersColumns?.[sessionUser?.id || ""] as Row | undefined)?.status || "None");
  const meetingAcceptanceChoices = meetingAcceptanceOptions.map((value) => ({ value, label: (metadata.labels as any)?.[entity]?.options?.acceptanceStatus?.[value] || value, style: String((metadata.entityDefs?.[entity]?.fields?.acceptanceStatus as any)?.style?.[value] || "default").replace(/[^a-z0-9_-]/gi, "") }));
  const meetingNotActualStatuses: string[] = [...(((metadata.scopes[entity] as any)?.completedStatusList || []) as string[]), ...(((metadata.scopes[entity] as any)?.canceledStatusList || []) as string[])];
  const meetingAcceptanceAllowed = isEventRecord && !record.deleted && Boolean(sessionUser?.id) && (record.usersIds || []).map(String).includes(String(sessionUser?.id)) && !meetingNotActualStatuses.includes(String(record.status || ""));
  const meetingAttendeeCount = ["usersIds", "contactsIds", "leadsIds"].reduce((count, key) => count + (Array.isArray(record[key]) ? record[key].length : 0), 0);
  const meetingEndText = String(record.dateEnd || "");
  const meetingEndTime = meetingEndText ? new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(meetingEndText) ? meetingEndText.replace(" ", "T") : `${meetingEndText.replace(" ", "T")}Z`).getTime() : NaN;
  const meetingCanSendInvitations = isEventRecord && canEditRecord && !meetingNotActualStatuses.includes(String(record.status || "")) && meetingAttendeeCount > 0 && (!Number.isFinite(meetingEndTime) || meetingEndTime >= Date.now());
  const meetingCancellationDeadline = Number.isFinite(meetingEndTime) ? addCalendarPeriod(meetingEndTime, String(metadata.appSettings?.eventCancellationPeriod || "8 hours")) : Infinity;
  const meetingCanSendCancellation = isEventRecord && canEditRecord && ((metadata.scopes[entity] as any)?.canceledStatusList || []).includes(record.status) && meetingAttendeeCount > 0 && meetingCancellationDeadline >= Date.now();
  const canSelfAssign = ["Case", "Lead"].includes(entity) && !record.deleted && !record.assignedUserId && sessionUser?.type !== "portal" && Boolean(fields.assignedUser) && canEditRecord && readableFieldPermissions.assignedUser?.edit !== "no";
  const taskReminderNotActual = [
    ...((metadata.scopes?.Task as any)?.completedStatusList || ["Completed"]),
    ...((metadata.scopes?.Task as any)?.canceledStatusList || ["Canceled"]),
  ];
  const taskReminderVisible = entity !== "Task" || Boolean(
    (record.dateEnd || record.dateEndDate) &&
    !taskReminderNotActual.includes(String(record.status || "")) &&
    sessionUser?.id && (record.assignedUserId === sessionUser.id || (record.assignedUsersIds || []).includes(sessionUser.id))
  );
  const isAdminViewer = sessionUser?.type === "admin" || sessionUser?.type === "super-admin";
  const followerPermission = String(metadata.userAcl?.followerManagementPermission || "");
  const portalPermission = String(metadata.userAcl?.portalPermission || "");
  const canManageFollowers = isAdminViewer || followerPermission !== "no" || portalPermission !== "no";
  const isManageableUser = entity === "User" && isAdminViewer && record.type !== "super-admin";
  const isOwnUserRecord = entity === "User" && record.id === sessionUser?.id;
  const canManagePreferences = entity === "User" && (isOwnUserRecord || isAdminViewer) && ["regular", "admin", "portal"].includes(String(record.type));
  const canOpenUserEmailAccounts = entity === "User" && ["regular", "admin"].includes(String(record.type)) && ((isOwnUserRecord && canAccessEntity(metadata, "EmailAccount")) || isAdminViewer);
  const canOpenUserExternalAccounts = isOwnUserRecord && ["regular", "admin"].includes(String(record.type)) && canAccessEntity(metadata, "ExternalAccount");
  const calendarPermission = String(aclMap.userCalendarPermission || "no");
  const userTeams = Array.isArray(record.teamsIds) ? record.teamsIds.map(String) : [];
  const sessionTeams = (sessionUser as (User & { teamsIds?: string[] }) | undefined)?.teamsIds;
  const currentTeams = Array.isArray(sessionTeams) ? sessionTeams.map(String) : [];
  const canViewUserCalendar = entity === "User" && ["regular", "admin"].includes(String(record.type)) && canAccessEntity(metadata, "Calendar") && (isAdminViewer || isOwnUserRecord || ["yes", "all"].includes(calendarPermission) || (calendarPermission === "team" && userTeams.some((id: string) => currentTeams.includes(id))));
  function getValue(name: string) { return recordFieldDisplayValue(entity, name, record) ?? record[`${name}Name`] ?? record[`${name}Ids`]?.map((id: string) => record[`${name}Names`]?.[id]).filter(Boolean).join(", ") ?? record[`${name}Id`]; }
  useEffect(() => {
    let live = true;
    request<Row>(`${entity}/${initial.id}`).then((data) => { if (live) { const safeData = entity === "AppSecret" ? { ...data, value: "" } : data; setRecord(safeData); onChanged(safeData); } }).catch(() => {});
    return () => { live = false; };
  }, [entity, initial.id]);
  useEffect(() => {
    const session = getSession();
    if (!session || (!hasPersonalData && entity !== "User")) { setAclMap({}); return; }
    let live = true;
    request<Row>(`User/${encodeURIComponent(session.user.id)}/acl`).then((data) => live && setAclMap(data)).catch(() => live && setAclMap({}));
    return () => { live = false; };
  }, [entity, hasPersonalData]);
  async function remove() {
    if (!window.confirm(`Opravdu smazat tento záznam?`)) return;
    setBusy(true); setError("");
    try { await request(`${entity}/${record.id}`, { method: "DELETE" }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Záznam se nepodařilo smazat."); }
    finally { setBusy(false); }
  }
  async function openDuplicateEditor() {
    if (!canDuplicateRecord) return;
    setBusy(true); setError("");
    try {
      const attributes = await request<Row>(`${encodeURIComponent(entity)}/action/getDuplicateAttributes`, { method: "POST", body: JSON.stringify({ id: record.id }) });
      setDuplicateValues(attributes || {});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kopii záznamu se nepodařilo připravit."); }
    finally { setBusy(false); }
  }
  function openMassEmailTest() {
    const user = getSession()?.user;
    setMassTestRecipients({ User: user?.id ? [{ ...user }] : [], Contact: [], Lead: [], Account: [] });
    setError(""); setMassTestOpen(true);
  }
  async function sendMassEmailTest() {
    if (massTestBusy) return;
    const targetList = (["User", "Contact", "Lead", "Account"] as const).flatMap((type) => massTestRecipients[type].map((item) => ({ id: item.id, type })));
    if (!targetList.length) { setError("Vyberte alespoň jednoho příjemce."); return; }
    setMassTestBusy(true); setError("");
    try {
      await request("MassEmail/action/sendTest", { method: "POST", body: JSON.stringify({ id: record.id, targetList }) });
      setMassTestOpen(false); setUserNotice("Testovací hromadný e-mail byl odeslán.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Testovací e-mail se nepodařilo odeslat."); }
    finally { setMassTestBusy(false); }
  }
  async function restoreDeletedRecord() {
    setBusy(true); setError(""); setUserNotice("");
    try {
      await request(`${encodeURIComponent(entity)}/action/restoreDeleted`, { method: "POST", body: JSON.stringify({ id: record.id }) });
      const restored = { ...record, deleted: false };
      setRecord(restored); onChanged(restored); setUserNotice("Záznam byl obnoven.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Záznam se nepodařilo obnovit."); }
    finally { setBusy(false); }
  }
  async function selfAssignRecord() {
    if (!canSelfAssign || !sessionUser?.id || busy) return;
    const statusOptions = fields.status?.options;
    const attributes: Row = { assignedUserId: sessionUser.id, assignedUserName: sessionUser.name };
    if (record.status === "New" && Array.isArray(statusOptions) && statusOptions.map(String).includes("Assigned")) attributes.status = "Assigned";
    setBusy(true); setError(""); setUserNotice("");
    try {
      const next = await request<Row>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}`, { method: "PUT", body: JSON.stringify(attributes) });
      const updated = { ...record, ...next, ...attributes };
      setRecord(updated); onChanged(updated); setUserNotice(entity === "Lead" ? "Zájemce byl přiřazen vám." : "Případ byl přiřazen vám.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : entity === "Lead" ? "Zájemce se nepodařilo přiřadit." : "Případ se nepodařilo přiřadit."); }
    finally { setBusy(false); }
  }
  async function completeTask() {
    if (!canEditRecord || metadata.userAcl?.fieldTable?.Task?.status?.edit === "no" || ["Completed", "Canceled"].includes(record.status)) return;
    setBusy(true); setError(""); setUserNotice("");
    try { const next = await request<Row>(`Task/${encodeURIComponent(record.id)}`, { method: "PUT", body: JSON.stringify({ status: "Completed" }) }); setRecord(next); onChanged(next); setUserNotice("Úkol byl dokončen."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Úkol se nepodařilo dokončit."); }
    finally { setBusy(false); }
  }
  async function setEventAttendance(status: "Held" | "Not Held") {
    setBusy(true); setError(""); setUserNotice("");
    try {
      const next = await request<Row>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}`, { method: "PUT", body: JSON.stringify({ status }) });
      const updated = { ...record, ...next, status }; setRecord(updated); onChanged(updated); setUserNotice("Změna stavu byla uložena.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Stav události se nepodařilo změnit."); }
    finally { setBusy(false); }
  }
  async function setMeetingAcceptance(status: string) {
    if (!meetingAcceptanceAllowed || !meetingAcceptanceOptions.includes(status) || !sessionUser?.id) return;
    await request(`${encodeURIComponent(entity)}/action/setAcceptanceStatus`, { method: "POST", body: JSON.stringify({ id: record.id, status }) });
    const next = { ...record, usersColumns: { ...(record.usersColumns || {}), [sessionUser.id]: { ...(record.usersColumns?.[sessionUser.id] || {}), status } } };
    setRecord(next); onChanged(next); setAcceptanceOpen(false); setUserNotice("Odpověď na pozvánku byla uložena.");
    void request<Row>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}`).then((fresh) => { setRecord(fresh); onChanged(fresh); }).catch(() => {});
  }
  async function openUserAccess() {
    setBusy(true); setError("");
    try { setTargetAcl(await request<Row>(`User/${encodeURIComponent(record.id)}/acl`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Přístupová práva se nepodařilo načíst."); }
    finally { setBusy(false); }
  }
  async function userSecurityAction(action: "apiKey" | "recovery" | "password") {
    const message = action === "apiKey" ? "Vygenerovat nový API klíč? Původní klíč okamžitě přestane fungovat." : action === "recovery" ? `Odeslat uživateli ${record.emailAddress} odkaz pro změnu hesla?` : `Vygenerovat nové heslo a odeslat je uživateli ${record.emailAddress}?`;
    if (!window.confirm(message)) return;
    setBusy(true); setError(""); setUserNotice("");
    try {
      if (action === "apiKey") {
        const data = await request<Row>("UserSecurity/apiKey/generate", { method: "POST", body: JSON.stringify({ id: record.id }) });
        const next = { ...record, ...data }; setRecord(next); onChanged(next); setUserNotice("Nový API klíč byl vytvořen.");
      } else {
        await request(`UserSecurity/password/${action === "recovery" ? "recovery" : "generate"}`, { method: "POST", body: JSON.stringify({ id: record.id }) });
        setUserNotice(action === "recovery" ? "Odkaz pro změnu hesla byl odeslán." : "Nové heslo bylo vygenerováno a odesláno.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Akci uživatelského účtu se nepodařilo provést."); }
    finally { setBusy(false); }
  }
  async function copyUserCredential(label: string, value: string) {
    try {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        let copied = false;
        try { input.select(); copied = document.execCommand("copy"); }
        finally { input.remove(); }
        if (!copied) throw new Error("Clipboard unavailable");
      }
      setCopiedCredential(label);
      window.setTimeout(() => setCopiedCredential((current) => current === label ? "" : current), 1800);
    } catch {
      setError(`Hodnotu „${label}“ se nepodařilo zkopírovat.`);
    }
  }
  function loginAsUser() {
    if (!isAdminViewer || entity !== "User" || record.type !== "regular") return;
    const sessionUser = getSession()?.user;
    if (!sessionUser?.userName || !record.userName || !window.confirm(`Otevřít nové okno přihlášené jako ${record.name || record.userName}?`)) return;
    const query = new URLSearchParams({ entryPoint: "loginAs", anotherUser: String(record.userName), username: String(sessionUser.userName) });
    window.open(`/?${query.toString()}`, "_blank", "noopener,noreferrer");
  }
  async function leadCaptureTokenAction(action: "generateNewApiKey" | "generateNewFormId") {
    const label = action === "generateNewApiKey" ? "API klíč" : "ID formuláře";
    if (!window.confirm(`Vytvořit nové ${label}? Původní hodnota přestane fungovat.`)) return;
    setBusy(true); setError(""); setUserNotice("");
    try {
      const result = await request<Row>(`LeadCapture/action/${action}`, { method: "POST", body: JSON.stringify({ id: record.id }) });
      const next = { ...record, ...result }; setRecord(next); onChanged(next);
      setUserNotice(`Nové ${label} bylo vytvořeno.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Nové ${label} se nepodařilo vytvořit.`); }
    finally { setBusy(false); }
  }
  async function openRelatedFieldRecord(scope: string, id: string) {
    try { const related = await request<Row>(`${encodeURIComponent(scope)}/${encodeURIComponent(id)}`); onOpenRelated(scope, related); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Navázaný záznam se nepodařilo otevřít."); }
  }
  async function copyLeadCaptureUrl() {
    const url = `${window.location.origin}${appPublicPath(`lead-capture/${encodeURIComponent(record.formId)}`)}`;
    try { await navigator.clipboard.writeText(url); setCopiedFormUrl(true); window.setTimeout(() => setCopiedFormUrl(false), 2200); }
    catch { setError("Odkaz se nepodařilo zkopírovat. Zkopírujte jej z pole formuláře."); }
  }

  if (entity === "LayoutSet" && layoutSetEditorOpen) return <div className="layoutset-editor-layer"><Suspense fallback={<div className="surface table-loading" role="status"><span className="spinner"/> Otevírám rozložení…</div>}><AdminLayoutManager metadata={metadata} layoutSetId={record.id} layoutSetName={record.name} layoutList={record.layoutList || []} onBack={() => setLayoutSetEditorOpen(false)}/></Suspense></div>;
  return <><button className="drawer-backdrop" onClick={onClose} aria-label="Zavřít detail"/><aside className="record-drawer"><div className="drawer-top"><span className="eyebrow">{entityLabel(metadata, entity, true).toUpperCase()} · DETAIL</span><div>{!record.deleted && aclLevel(metadata, entity, "stream") !== "no" && <button className="icon-button" onClick={() => setFollowersOpen(true)} title="Zobrazit sledující" aria-label="Zobrazit sledující"><Users size={15}/></button>}{canEditRecord && <button className="icon-button" onClick={() => setEditor(true)} title="Upravit"><FileText size={15}/></button>}{canDeleteRecord && <button className="icon-button danger-ghost" onClick={() => void remove()} disabled={busy} title="Smazat"><Trash2 size={15}/></button>}<button className="icon-button" onClick={onClose} title="Zavřít"><X size={17}/></button></div></div>
    <div className={`drawer-title ${record.deleted ? "deleted-record-title" : ""}`}><span className="drawer-avatar">{String(recordFieldDisplayValue(entity, "name", record) || record.subject || "?").slice(0, 1).toUpperCase()}</span><div><h2>{recordFieldDisplayValue(entity, "name", record) || record.subject || [record.firstName, record.lastName].filter(Boolean).join(" ") || "Záznam"}</h2><p>{record.deleted ? "Smazaný záznam · " : ""}{entityLabel(metadata, entity)}{record.accountName ? ` · ${record.accountName}` : ""}</p></div></div>
    {error && <div className="inline-error">{error}</div>}{userNotice && <div className="save-confirm"><Check size={14}/>{userNotice}</div>}{entity === "LeadCaptureLogRecord" && <div className="read-only-record-note"><Shield size={15}/><span>Záznam odeslání formuláře je pouze pro čtení, aby zůstala zachována auditní stopa.</span></div>}
    {record.deleted ? <div className="drawer-actions"><button className="button primary" onClick={() => void restoreDeletedRecord()} disabled={busy}><RefreshCw size={14}/> Obnovit záznam</button></div> : <div className="drawer-actions">{canSelfAssign && <button className="button subtle" onClick={() => void selfAssignRecord()} disabled={busy}><UserRound size={14}/> Přiřadit mně</button>}{canEditRecord && <button className="button primary" onClick={() => setEditor(true)}>Upravit záznam <FileText size={14}/></button>}{canDuplicateRecord && <button className="button subtle" onClick={() => void openDuplicateEditor()} disabled={busy}><Copy size={14}/> Duplikovat</button>}{entity === "MassEmail" && canEditRecord && ["Draft", "Pending"].includes(record.status) && <button className="button subtle" onClick={openMassEmailTest}><Send size={14}/> Poslat test</button>}{canManagePreferences && <button className="button subtle" onClick={() => onOpenPreferences(record)}><Settings size={14}/> Preference uživatele</button>}{canOpenUserEmailAccounts && <button className="button subtle" onClick={() => onOpenEmailAccounts(record)}><Mail size={14}/> E-mailové účty</button>}{canOpenUserExternalAccounts && <button className="button subtle" onClick={() => onOpenEntity("ExternalAccount")}><Link2 size={14}/> Externí účty</button>}{canViewUserCalendar && <button className="button subtle" onClick={() => onOpenCalendar(record)}><CalendarDays size={14}/> Kalendář uživatele</button>}{isAdminViewer && entity === "User" && record.type === "regular" && <button className="button subtle" onClick={loginAsUser}><LogIn size={14}/> Přihlásit se jako uživatel</button>}{canEditRecord && entity === "LayoutSet" && <button className="button subtle" onClick={() => setLayoutSetEditorOpen(true)}><LayoutDashboard size={14}/> Upravit rozložení</button>}{isAdminViewer && entity === "DashboardTemplate" && <button className="button subtle" onClick={() => setDashboardDeployOpen(true)} disabled={busy}><Users size={14}/> Nasadit uživatelům / týmu</button>}{canConvertCurrency && <button className="button subtle" onClick={() => setCurrencyConvertOpen(true)} disabled={busy}><ArrowRightLeft size={14}/> Převést měnu</button>}{entity === "Campaign" && <CampaignMailMergeAction campaign={record} metadata={metadata}/>}{canEditRecord && ["Meeting", "Call"].includes(entity) && !["Held", "Not Held"].includes(record.status) && <><button className="button subtle" onClick={() => void setEventAttendance("Held")} disabled={busy}><Check size={14}/> Označit jako proběhlé</button><button className="button subtle" onClick={() => void setEventAttendance("Not Held")} disabled={busy}><X size={14}/> Označit jako neproběhlé</button></>}{canEditRecord && entity === "Task" && metadata.userAcl?.fieldTable?.Task?.status?.edit !== "no" && !["Completed", "Canceled"].includes(record.status) && <button className="button subtle" onClick={() => void completeTask()} disabled={busy}><Check size={14}/> Dokončit úkol</button>}{canEditRecord && entity === "LeadCapture" && <><button className="button subtle" onClick={() => void leadCaptureTokenAction("generateNewApiKey")} disabled={busy}><KeyRound size={14}/> Nový API klíč</button><button className="button subtle" onClick={() => void leadCaptureTokenAction("generateNewFormId")} disabled={busy}><RefreshCw size={14}/> Nové ID formuláře</button></>}{isManageableUser && record.type !== "portal" && <button className="button subtle" onClick={() => void openUserAccess()} disabled={busy}>Přístupová práva <Shield size={14}/></button>}{isManageableUser && ["regular", "admin", "portal"].includes(record.type) && <button className="button subtle" onClick={() => setUserSecurityOpen(true)}>Zabezpečení a 2FA <Shield size={14}/></button>}{isManageableUser && record.type === "api" && <button className="button subtle" onClick={() => void userSecurityAction("apiKey")} disabled={busy}>Nový API klíč <KeyRound size={14}/></button>}{isManageableUser && ["regular", "admin", "portal"].includes(record.type) && record.emailAddress && <><button className="button subtle" onClick={() => void userSecurityAction("recovery")} disabled={busy}>Odkaz na změnu hesla <Mail size={14}/></button><button className="button subtle" onClick={() => void userSecurityAction("password")} disabled={busy}>Vygenerovat heslo <RefreshCw size={14}/></button></>}{convertible && <button className="button subtle" onClick={() => setConvertOpen(true)}>Převést zájemce <ArrowRight size={14}/></button>}{canViewPersonalData && <button className="button subtle" onClick={() => setPersonalDataOpen(true)}>Osobní údaje <Shield size={14}/></button>}</div>}
    {(meetingAcceptanceAllowed && meetingAcceptanceOptions.length > 0 || meetingCanSendInvitations || meetingCanSendCancellation) && <div className="drawer-actions meeting-acceptance-actions">{meetingCanSendInvitations && <button type="button" className="button subtle" onClick={() => setMeetingAttendeeMailMode("invitations")}><Send size={14}/> Odeslat pozvánky</button>}{meetingCanSendCancellation && <button type="button" className="button danger" onClick={() => setMeetingAttendeeMailMode("cancellation")}><Send size={14}/> Odeslat storno</button>}{meetingAcceptanceAllowed && meetingAcceptanceOptions.length > 0 && <button type="button" className="button subtle meeting-acceptance-action" onClick={() => setAcceptanceOpen(true)} disabled={busy}><span className={`meeting-acceptance-dot ${String((metadata.entityDefs?.[entity]?.fields?.acceptanceStatus as any)?.style?.[meetingAcceptanceStatus] || "default")}`}/>{meetingAcceptanceStatus === "None" ? "Odpovědět na pozvánku" : `Odpověď: ${(metadata.labels as any)?.[entity]?.options?.acceptanceStatus?.[meetingAcceptanceStatus] || meetingAcceptanceStatus}`}</button>}</div>}
    {!record.deleted && entity === "LeadCapture" && record.formEnabled && <section className="lead-capture-share"><div><span className="eyebrow">VEŘEJNÝ FORMULÁŘ</span><strong>Odkaz ke sdílení</strong><small>Otevře nový formulář ViaCRM bez přihlášení.</small></div><div className="lead-capture-share-row"><input aria-label="Odkaz veřejného formuláře" readOnly value={`${window.location.origin}${appPublicPath(`lead-capture/${encodeURIComponent(record.formId || "")}`)}`}/><button className="button subtle" onClick={() => void copyLeadCaptureUrl()}><Link2 size={14}/>{copiedFormUrl ? "Zkopírováno" : "Kopírovat"}</button></div></section>}
    {!record.deleted && entity === "Campaign" && <CampaignStatsPanel record={record} metadata={metadata}/>}
    {!record.deleted && entity === "EmailTemplate" && <EmailTemplatePlaceholdersPanel metadata={metadata}/>}
    {!record.deleted && entity === "LeadCapture" && <LeadCaptureInfoPanel record={record}/>}
    {!record.deleted && entity === "Lead" && <LeadConversionResultPanel record={record} metadata={metadata} onOpenRecord={onOpenRelated}/>}
    {panels.map((panel, panelIndex) => { const entries = (panel.rows || []).flat().filter((item): item is Exclude<LayoutItem, false> => Boolean(item) && typeof item === "object" && Boolean(item.name) && readableFieldPermissions[item.name!]?.read !== "no" && !(entity === "Task" && item.name === "reminders" && !taskReminderVisible)); return entries.length ? <section className="detail-panel" key={`${panel.label || "panel"}-${panelIndex}`}><div className="drawer-section-title">{panel.label || "INFORMACE O ZÁZNAMU"}</div><div className="detail-grid">{entries.map(({ name }) => { const def = fields[name!]; const isAddress = def?.type === "address"; const isMap = def?.type === "map"; const addressField = isMap ? name!.slice(0, -3) : name!; const addressParts = isAddress || isMap ? [["street", "Street"], ["city", "City"], ["state", "State"], ["postalCode", "PostalCode"], ["country", "Country"]].map(([, suffix]) => record[`${addressField}${suffix}`]).filter(Boolean) : []; const mapAddressValue = { street: record[`${addressField}Street`], city: record[`${addressField}City`], state: record[`${addressField}State`], postalCode: record[`${addressField}PostalCode`], country: record[`${addressField}Country`] }; const isSecret = entity === "AppSecret" && name === "value"; const value = isSecret ? "**********" : isAddress || isMap ? addressParts.join(", ") : entity === "CampaignLogRecord" && name === "data" ? (record.data ?? record.stringData ?? record.action) : entity === "Task" && name === "dateEnd" ? (record.dateEnd || record.dateEndDate) : entity === "Meeting" && name === "dateStart" && record.isAllDay ? record.dateStartDate : getValue(name!); return value == null || value === "" ? isMap ? <div className="detail-field" key={name}><span>{fieldLabel(name!, def, entity, metadata)}</span><GoogleAddressMap address={mapAddressValue} apiKey={String(metadata.appSettings?.googleMapsApiKey || "")} mapId={String(metadata.appSettings?.googleMapsMapId || "")} height={Number(def?.height) || 300}/></div> : name === "reminders" && ["Meeting", "Call", "Task"].includes(entity) ? <div className="detail-field" key={name}><span>{fieldLabel(name!, def, entity, metadata)}</span><ReminderDisplay value={record.reminders} metadata={metadata}/></div> : null : <div className="detail-field" key={name}><span>{fieldLabel(name!, def, entity, metadata)}</span>{name === "reminders" && ["Meeting", "Call", "Task"].includes(entity) ? <ReminderDisplay value={record.reminders ?? value} metadata={metadata}/> : def?.type === "linkMultiple" && def.columns ? <LinkMultipleDisplay entity={entity} name={name!} record={record} def={def} metadata={metadata} onOpen={openRelatedFieldRecord}/> : entity === "CampaignLogRecord" && name === "data" ? <CampaignLogDataView record={record} onOpenRecord={onOpenRelated}/> : entity === "OAuthProvider" && name === "authorizationParams" ? <OAuthAuthorizationParams value={value} label={fieldLabel(name, def, entity, metadata)} readOnly/> : isMap ? <GoogleAddressMap address={mapAddressValue} apiKey={String(metadata.appSettings?.googleMapsApiKey || "")} mapId={String(metadata.appSettings?.googleMapsMapId || "")} height={Number(def?.height) || 300}/> : entity === "Task" && name === "dateEnd" ? <TaskDeadlineDisplay record={record} timeZone={dateTimeZone} detailed/> : (entity === "Meeting" || entity === "Call") && name === "dateStart" ? <EventStartDisplay record={record} entity={entity} metadata={metadata} timeZone={dateTimeZone} value={value}/> : ["url", "urlMultiple"].includes(String(def?.type)) ? <UrlFieldDisplay value={value} multiple={def?.type === "urlMultiple"} copyToClipboard={Boolean(def?.copyToClipboard)}/> : ["email", "emailAddress", "phone"].includes(String(def?.type)) ? <ContactFieldDisplay value={value} type={String(def?.type)}/> : def?.type?.startsWith("enum") ? <EnumValue value={value} def={def} metadata={metadata} entity={entity} name={name}/> : def?.copyToClipboard && ["varchar", "number"].includes(def?.type || "") ? <CopyableValue value={displayValue(value, def)}/> : <strong className={entity === "Contact" && name === "account" && record.accountIsInactive ? "inactive-account-reference" : undefined}>{["date", "datetime"].includes(String(def?.type)) ? formatEspoDateTime(String(value), dateTimeZone) : isSecret ? "**********" : def?.type === "currency" ? formatCurrency(value, record[`${name}Currency`], metadata) : def?.type === "currencyConverted" ? formatCurrency(value, metadata.appSettings?.defaultCurrency, metadata) : displayValue(value, def) || "—"}</strong>}{isAddress && addressParts.length > 0 && <button type="button" className="address-map-button" onClick={() => setMapAddress(mapAddressValue)}><MapPin size={13}/> Zobrazit mapu</button>}</div>; })}</div></section> : null; })}
    {!record.deleted && entity === "Meeting" && (metadata.clientDefs?.Meeting?.bottomPanels?.detail || []).some((panel: any) => panel.name === "scheduler") && <MeetingScheduler metadata={metadata} userIds={record.usersIds || []} userNames={record.usersNames} assignedUserId={record.assignedUserId} assignedUserName={record.assignedUserName} dateStart={record.isAllDay ? record.dateStartDate : record.dateStart} dateEnd={record.isAllDay ? record.dateEndDate : record.dateEnd} allDay={Boolean(record.isAllDay)} entityId={record.id}/>}
    {!record.deleted && isAdminViewer && entity === "User" && record.type === "api" && <section className="detail-panel"><div className="drawer-section-title">API PŘÍSTUP</div><div className="user-api-credentials">{[["Metoda ověření", record.authMethod || "ApiKey"], ["API klíč", record.apiKey], ...(record.authMethod === "Hmac" ? [["Tajný klíč", record.secretKey]] : [])].filter(([, value]) => Boolean(value)).map(([label, value]) => <div key={String(label)}><span><small>{label}</small><code>{String(value)}</code></span><button type="button" className="button subtle" aria-label={copiedCredential === label ? `${String(label)} zkopírován` : `Zkopírovat ${String(label)}`} onClick={() => void copyUserCredential(String(label), String(value))}>{copiedCredential === label ? <><Check size={13}/> Zkopírováno</> : <><Copy size={13}/> Kopírovat</>}</button></div>)}</div><span className="sr-only" aria-live="polite">{copiedCredential ? `${copiedCredential} zkopírován do schránky.` : ""}</span><p className="user-api-credentials-hint">Přístupové údaje vidí pouze administrátoři. Při změně klíče přestane původní hodnota okamžitě platit.</p></section>}
    {!record.deleted && entity === "User" && isAdminViewer && <AdminUserLoginHistory userId={record.id}/>}
    {!record.deleted && <Suspense fallback={<div className="surface table-loading" role="status"><span className="spinner"/>Načítám související záznamy…</div>}><RecordRelationships entity={entity} record={record} metadata={metadata} onOpenRecord={onOpenRelated} onOpenTaskList={(scope, where) => onOpenEntity(scope, where)} onComposeEmail={onComposeEmail} renderActivityEditor={(scope, initialValues, onActivitySaved, onActivityClose) => <RecordEditor key={`${scope}-${initialValues.id || "new"}`} entity={scope} fields={getEditorFields(metadata, scope)} metadata={metadata} record={initialValues.id ? initialValues : undefined} initialValues={initialValues} onClose={onActivityClose} onSaved={onActivitySaved}/>}/></Suspense>}
    {!record.deleted && entity === "OAuthAccount" && <OAuthConnectionPanel record={record} onChanged={(next) => { setRecord(next); onChanged(next); }}/>}
    {!record.deleted && aclLevel(metadata, entity, "stream") !== "no" && <Suspense fallback={<div className="surface table-loading" role="status"><span className="spinner"/>Načítám aktivitu…</div>}><RecordStream entity={entity} record={record} metadata={metadata} onOpenNote={(note) => { void request<Row>(`Note/${encodeURIComponent(note.id)}`).then((fresh) => onOpenRelated("Note", fresh)).catch(() => onOpenRelated("Note", note)); }}/></Suspense>}
    <div className="drawer-meta"><span>Vytvořeno</span><b>{formatDate(record.createdAt)}</b><span>Naposledy upraveno</span><b>{formatDate(record.modifiedAt)}</b></div>
  </aside>
  {mapAddress && <div className="modal-backdrop address-map-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMapAddress(null)}><section className="record-modal address-map-modal"><div className="modal-heading"><div><span className="eyebrow">MAPA ADRESY</span><h2>{addressText(mapAddress)}</h2></div><button className="icon-button" onClick={() => setMapAddress(null)} aria-label="Zavřít"><X size={17}/></button></div><GoogleAddressMap address={mapAddress} apiKey={String(metadata.appSettings?.googleMapsApiKey || "")} mapId={String(metadata.appSettings?.googleMapsMapId || "")}/><a className="button subtle" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText(mapAddress))}`} target="_blank" rel="noreferrer">Otevřít větší mapu <ArrowRight size={14}/></a></section></div>}
  {acceptanceOpen && <MeetingAcceptanceDialog entity={entity as "Meeting" | "Call"} eventName={record.name || ""} choices={meetingAcceptanceChoices} selected={meetingAcceptanceStatus} onClose={() => setAcceptanceOpen(false)} onSelect={setMeetingAcceptance}/>}
  {meetingAttendeeMailMode && <MeetingInvitationDialog entity={entity as "Meeting" | "Call"} meeting={{ id: record.id, name: record.name }} metadata={metadata} mode={meetingAttendeeMailMode} currentUserId={sessionUser?.id} onClose={() => setMeetingAttendeeMailMode(null)} onSent={(sent) => { const mode = meetingAttendeeMailMode; setMeetingAttendeeMailMode(null); setUserNotice(sent ? (mode === "cancellation" ? `Oznámení o zrušení ${eventLabel} bylo odesláno.` : `Pozvánky na ${eventLabel} byly odeslány.`) : "Žádnou zprávu se nepodařilo odeslat."); void request<Row>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}`).then((fresh) => { setRecord(fresh); onChanged(fresh); }).catch(() => {}); }}/ >}
  {massTestOpen && <div className="modal-backdrop"><section className="record-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><span className="eyebrow">HROMADNÝ E-MAIL · TEST</span><h2>Odeslat testovací e-mail</h2><p>Vyberte příjemce testovací zprávy.</p></div><button type="button" className="icon-button" onClick={() => setMassTestOpen(false)} disabled={massTestBusy} aria-label="Zavřít"><X size={17}/></button></div><div className="campaign-test-recipient-list">{(["User", "Contact", "Lead", "Account"] as const).filter((scope) => canAccessEntity(metadata, scope)).map((scope) => <div key={scope}><span><strong>{entityLabel(metadata, scope, true)}</strong><small>{massTestRecipients[scope].map((item) => item.name || item.userName || item.id).join(", ") || "Nikdo nevybrán"}</small></span><button type="button" className="button subtle" onClick={() => setMassTestPicker(scope)}><Plus size={13}/> Vybrat</button></div>)}</div><div className="modal-footer"><button type="button" className="button subtle" onClick={() => setMassTestOpen(false)} disabled={massTestBusy}>Zrušit</button><button type="button" className="button primary" onClick={() => void sendMassEmailTest()} disabled={massTestBusy || !Object.values(massTestRecipients).some((items) => items.length)}>{massTestBusy ? "Odesílám…" : "Odeslat test"}<Send size={14}/></button></div></section></div>}
  {massTestPicker && <SelectRecordsDialog entity={massTestPicker} metadata={metadata} multiple selectedIds={massTestRecipients[massTestPicker].map((item) => item.id)} selectedRows={massTestRecipients[massTestPicker]} onClose={() => setMassTestPicker("")} onSelect={(items) => { setMassTestRecipients((old) => ({ ...old, [massTestPicker]: items })); setMassTestPicker(""); }}/>}
  {targetAcl && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setTargetAcl(null)}><section className="record-modal user-access-modal"><div className="modal-heading"><div><span className="eyebrow">PŘÍSTUPOVÁ PRÁVA</span><h2>{record.name || record.userName}</h2></div><button className="icon-button" onClick={() => setTargetAcl(null)} aria-label="Zavřít"><X size={17}/></button></div><div className="user-access-table"><div className="user-access-row header"><b>Modul</b><b>Čtení</b><b>Vytvořit</b><b>Upravit</b><b>Smazat</b><b>Stream</b></div>{Object.entries(targetAcl.table || {}).filter(([, acl]) => acl && typeof acl === "object").sort(([a], [b]) => entityLabel(metadata, a).localeCompare(entityLabel(metadata, b), "cs")).map(([scope, raw]) => { const permission = raw as Row; return <div className="user-access-row" key={scope}><strong>{entityLabel(metadata, scope, true)}</strong>{["read", "create", "edit", "delete", "stream"].map((key) => <span key={key} className={`user-access-state ${permission[key] === "no" ? "denied" : permission[key] ? "granted" : "unknown"}`}>{permission[key] === "no" ? "Ne" : permission[key] ? permission[key] === "all" ? "Vše" : "Ano" : "—"}</span>)}</div>; })}</div><div className="modal-footer"><button className="button subtle" onClick={() => setTargetAcl(null)}>Zavřít</button></div></section></div>}
  {userSecurityOpen && <div className="modal-backdrop user-security-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setUserSecurityOpen(false)}><section className="user-security-modal"><UserSecurityView user={{ id: record.id, name: record.name || record.userName, userName: record.userName, type: record.type }} adminMode onBack={() => setUserSecurityOpen(false)}/></section></div>}
  {followersOpen && <FollowersDialog entity={entity} recordId={record.id} metadata={metadata} canManage={canManageFollowers} currentUserId={sessionUser?.id} onClose={() => setFollowersOpen(false)} onOpenUser={(user) => onOpenRelated("User", user)} onChanged={() => { void request<Row>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}`).then((fresh) => { setRecord(fresh); onChanged(fresh); }).catch(() => {}); }} />}
  {currencyConvertOpen && <CurrencyConversionDialog entity={entity} metadata={metadata} fields={currencyFields} recordId={record.id} onClose={() => setCurrencyConvertOpen(false)} onComplete={(next) => { setCurrencyConvertOpen(false); if (next) { setRecord(next); onChanged(next); } else void request<Row>(`${entity}/${record.id}`).then((fresh) => { setRecord(fresh); onChanged(fresh); }).catch(() => {}); }}/>}
  {dashboardDeployOpen && <DashboardTemplateDeploy id={record.id} name={record.name || "Dashboard"} onClose={() => setDashboardDeployOpen(false)} onComplete={setUserNotice}/>}{editor && <RecordEditor entity={entity} fields={getEditorFields(metadata, entity)} metadata={metadata} record={record} onClose={() => setEditor(false)} onSaved={(next) => { const safeNext = entity === "AppSecret" ? { ...next, value: "" } : next; setEditor(false); setRecord(safeNext); onChanged(safeNext); }} />}{duplicateValues && <RecordEditor entity={entity} fields={getEditorFields(metadata, entity)} metadata={metadata} initialValues={duplicateValues} duplicate onClose={() => setDuplicateValues(null)} onSaved={(created) => { setDuplicateValues(null); onClose(); onOpenRelated(entity, created); }}/ >}{convertOpen && <LeadConversion metadata={metadata} lead={record} onClose={() => setConvertOpen(false)} onConverted={(next) => { setRecord(next); onChanged(next); setConvertOpen(false); }}/>}{personalDataOpen && <PersonalDataDialog entity={entity} record={record} fields={personalFields.map(({ name, def, value, attributes, canErase }) => ({ name, def, value, attributes, canErase, label: fieldLabel(name, def, entity, metadata) }))} canErase={canErasePersonalData} onClose={() => setPersonalDataOpen(false)} onErased={(next) => { setRecord(next); onChanged(next); }}/>}</>;
}

function LeadConversion({ metadata, lead, onClose, onConverted }: { metadata: Metadata; lead: Row; onClose: () => void; onConverted: (record: Row) => void }) {
  const [scopes, setScopes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, Row>>({});
  const [layouts, setLayouts] = useState<Record<string, DetailLayoutPanel[]>>({});
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const configuredScopes: string[] = (metadata.entityDefs?.Lead as any)?.convertEntityList || ["Account", "Contact", "Opportunity"];
  useEffect(() => {
    let live = true;
    Promise.all([request<Row>("Lead/action/getConvertAttributes", { method: "POST", body: JSON.stringify({ id: lead.id }) }), ...configuredScopes.map((scope) => fetchLayout<DetailLayoutPanel[]>(scope, "detailConvert").catch(() => [] as DetailLayoutPanel[]))]).then(([attributes, ...layoutList]) => {
      if (!live) return;
      const available = configuredScopes.filter((scope) => Boolean(attributes?.[scope]) && metadata.entityDefs?.[scope]?.fields);
      setScopes(available);
      setValues(Object.fromEntries(available.map((scope) => {
        const initial = { ...(attributes[scope] || {}) };
        for (const [name, def] of getFormFields(metadata, scope)) {
          if (["link", "linkOne"].includes(def.type || "")) initial[name] = initial[`${name}Id`] || "";
          if (def.type === "linkMultiple") initial[name] = initial[`${name}Ids`] || [];
          if (def.type === "personName") initial[name] = { firstName: initial.firstName || "", middleName: initial.middleName || "", lastName: initial.lastName || "" };
          if (["file", "image"].includes(def.type || "")) initial[name] = initial[`${name}Id`] ? { id: initial[`${name}Id`], name: initial[`${name}Name`] || "Soubor" } : null;
          if (def.type === "attachmentMultiple") initial[name] = (initial[`${name}Ids`] || []).map((id: string) => ({ id, name: initial[`${name}Names`]?.[id] || id, type: initial[`${name}Types`]?.[id] || "" }));
        }
        return [scope, initial];
      })));
      setSelected(Object.fromEntries(available.map((scope) => [scope, false])));
      setLayouts(Object.fromEntries(available.map((scope) => [scope, layoutList[configuredScopes.indexOf(scope)] || []])));
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Údaje pro převod nelze načíst.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [lead.id, metadata, configuredScopes.join(",")]);
  function convertPayload(scope: string) {
    const raw = values[scope] || {};
    const payload: Row = {};
    for (const [name, def] of getFormFields(metadata, scope)) {
      const value = raw[name];
      if (def.type === "bool") payload[name] = Boolean(value);
      else if (def.type === "linkMultiple") payload[`${name}Ids`] = Array.isArray(value) ? value : [];
      else if (["link", "linkOne"].includes(def.type || "")) payload[`${name}Id`] = value || null;
      else if (def.type === "linkParent") { payload[`${name}Type`] = value?.type || null; payload[`${name}Id`] = value?.id || null; }
      else if (def.type === "personName") { payload.firstName = value?.firstName || ""; payload.middleName = value?.middleName || ""; payload.lastName = value?.lastName || ""; }
      else if (def.type === "address") { for (const [part, suffix] of [["street", "Street"], ["city", "City"], ["state", "State"], ["postalCode", "PostalCode"], ["country", "Country"]]) payload[`${name}${suffix}`] = value?.[part] || ""; }
      else if (["file", "image"].includes(def.type || "")) { payload[`${name}Id`] = value?.id || null; payload[`${name}Name`] = value?.name || null; }
      else if (def.type === "attachmentMultiple") { const list = Array.isArray(value) ? value : []; payload[`${name}Ids`] = list.map((item: Row) => item.id); payload[`${name}Names`] = Object.fromEntries(list.map((item: Row) => [item.id, item.name])); payload[`${name}Types`] = Object.fromEntries(list.map((item: Row) => [item.id, item.type || ""])); }
      else if (def.type === "currency") { payload[name] = value === "" || value == null ? null : Number(value); payload[`${name}Currency`] = raw[`${name}Currency`] || metadata.appSettings?.defaultCurrency || (metadata.app as any)?.currency?.list?.[0] || "USD"; }
      else if (["int", "float", "enumInt"].includes(def.type || "") && value !== "" && value != null) payload[name] = Number(value);
      else if (["array", "urlMultiple", "checklist"].includes(def.type || "") && typeof value === "string") payload[name] = value.split("\n").map((item: string) => item.trim()).filter(Boolean);
      else if (value !== undefined && value !== "") payload[name] = value;
    }
    return payload;
  }
  async function convert(skipDuplicateCheck = false) {
    const chosen = scopes.filter((scope) => selected[scope]);
    if (!chosen.length) { setError("Vyberte alespoň jeden záznam k vytvoření."); return; }
    const invalid = chosen.flatMap((scope) => getFormFields(metadata, scope).filter(([name, def]) => def.required && (values[scope]?.[name] == null || values[scope]?.[name] === "")).map(([name]) => `${entityLabel(metadata, scope)}: ${fieldLabel(name, metadata.entityDefs?.[scope]?.fields?.[name], scope, metadata)}`));
    if (invalid.length) { setError(`Doplňte povinná pole: ${invalid.join(", ")}.`); return; }
    setSaving(true); setError(""); setDuplicate(false);
    try {
      const updated = await request<Row>("Lead/action/convert", { method: "POST", body: JSON.stringify({ id: lead.id, records: Object.fromEntries(chosen.map((scope) => [scope, convertPayload(scope)])), ...(skipDuplicateCheck ? { skipDuplicateCheck: true } : {}) }) });
      onConverted(updated);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) { setDuplicate(true); setError("EspoCRM našlo možné duplicitní záznamy. Zkontrolujte je a potvrďte, pokud chcete pokračovat i přes duplicity."); }
      else setError(cause instanceof Error ? cause.message : "Zájemce se nepodařilo převést.");
    } finally { setSaving(false); }
  }
  return <div className="modal-backdrop lead-convert-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="record-modal lead-convert-modal"><div className="modal-heading"><div><span className="eyebrow">ZÁJEMCE · PŘEVOD</span><h2>Převést {lead.name || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "zájemce"}</h2><p>Vyberte záznamy, které se mají vytvořit. Pole jsou předvyplněná údaji zájemce.</p></div><button className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={17}/></button></div>
    {error && <div className={duplicate ? "duplicate-notice" : "inline-error"}>{error}</div>}
    <div className="lead-convert-content">{busy ? <div className="table-loading"><span className="spinner"/> Připravuji převod…</div> : scopes.length ? scopes.map((scope) => {
      const fields = getFormFields(metadata, scope);
      const map = new Map(fields);
      const used = new Set<string>();
      const groups = (layouts[scope] || []).flatMap((panel, index) => {
        const names = (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name && map.has(item.name) && !used.has(item.name) ? [item.name] : []);
        names.forEach((name) => used.add(name));
        return names.length ? [{ label: panel.label || (index ? `Další údaje ${index + 1}` : "Základní údaje"), names }] : [];
      });
      const remaining = fields.map(([name]) => name).filter((name) => !used.has(name));
      if (remaining.length) groups.push({ label: "Další údaje", names: remaining });
      return <section className={`lead-convert-entity ${selected[scope] ? "selected" : ""}`} key={scope}><label className="lead-convert-select"><input type="checkbox" checked={Boolean(selected[scope])} onChange={(event) => { setSelected((old) => ({ ...old, [scope]: event.target.checked })); setDuplicate(false); }}/><span><strong>{entityLabel(metadata, scope, true)}</strong><small>Vytvořit nový záznam</small></span></label>{selected[scope] && <div className="lead-convert-fields">{groups.map((group) => <div className="lead-convert-group" key={group.label}><h3>{group.label}</h3><div className="modal-fields">{group.names.map((name) => <FieldInput key={`${scope}-${name}`} entity={scope} metadata={metadata} name={name} def={map.get(name)!} value={values[scope]?.[name]} currencyValue={values[scope]?.[`${name}Currency`]} onCurrencyChange={(currency) => setValues((old) => ({ ...old, [scope]: { ...old[scope], [`${name}Currency`]: currency } }))} onChange={(value) => setValues((old) => ({ ...old, [scope]: { ...old[scope], [name]: value } }))}/>)}</div></div>)}</div>}</section>;
    }) : <div className="empty-state">Nemáte oprávnění k vytvoření převodních záznamů nebo tato instalace převod nepodporuje.</div>}</div>
    <div className="modal-footer"><button className="button subtle" onClick={onClose} disabled={saving}>Zrušit</button>{duplicate && <button className="button subtle" onClick={() => void convert(true)} disabled={saving}>{saving ? "Převádím…" : "Převést i přes duplicity"}</button>}<button className="button primary" onClick={() => void convert(false)} disabled={busy || saving || !scopes.length}>{saving ? "Převádím…" : "Převést"}</button></div></section></div>;
}

function inboundEmailFieldVisible(name: string, values: Row): boolean {
  const smtpFields = ["smtpHost", "smtpPort", "smtpAuth", "smtpSecurity", "smtpTestSend", "fromName", "smtpIsShared", "smtpIsForMassEmail"];
  if (!values.useSmtp && smtpFields.includes(name)) return false;
  if ((!values.useSmtp || !values.smtpAuth) && ["smtpUsername", "smtpPassword", "smtpAuthMechanism"].includes(name)) return false;
  if (!values.createCase && ["caseDistribution", "team", "assignToUser", "targetUserPosition"].includes(name)) return false;
  const distribution = String(values.caseDistribution || "");
  if (values.createCase && !["Round-Robin", "Least-Busy"].includes(distribution) && name === "targetUserPosition") return false;
  if (values.createCase && distribution !== "Direct-Assignment" && name === "assignToUser") return false;
  return true;
}

function emailAccountFieldVisible(name: string, values: Row): boolean {
  const smtpFields = ["smtpHost", "smtpPort", "smtpAuth", "smtpSecurity", "smtpTestSend"];
  if (!values.useSmtp && smtpFields.includes(name)) return false;
  if ((!values.useSmtp || !values.smtpAuth) && ["smtpUsername", "smtpPassword", "smtpAuthMechanism"].includes(name)) return false;
  return true;
}

function MailFolderField({ label, value, multiple, values, recordId, entity = "InboundEmail", onChange }: { label: string; value: string | string[]; multiple?: boolean; values: Row; recordId?: string; entity?: "InboundEmail" | "EmailAccount"; onChange: (value: string | string[]) => void }) {
  const [options, setOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [folderQuery, setFolderQuery] = useState("");
  async function loadFolders() {
    setBusy(true); setError("");
    try {
      const folders = await request<string[]>(`${entity}/action/getFolders`, { method: "POST", body: JSON.stringify({ host: values.host, port: values.port, security: values.security, username: values.username, password: values.password || null, ...(entity === "EmailAccount" ? { emailAddress: values.emailAddress, userId: values.assignedUser || values.assignedUserId || null } : {}), id: recordId || null }) });
      setOptions(Array.isArray(folders) ? folders.map(String) : []);
      setLoaded(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Složky IMAP se nepodařilo načíst."); }
    finally { setBusy(false); }
  }
  const selected = multiple ? (Array.isArray(value) ? value : []) : String(value || "");
  const candidates = [...new Set([...(options.length ? options : !loaded && multiple ? ["INBOX"] : []), ...(Array.isArray(selected) ? selected : selected ? [selected] : [])])];
  const visibleFolders = candidates.filter((folder) => !folderQuery.trim() || folder.toLocaleLowerCase("cs-CZ").includes(folderQuery.trim().toLocaleLowerCase("cs-CZ")));
  const selectedFolders = Array.isArray(selected) ? selected : [];
  return <div className="field-input inbound-folder-field"><span>{label}</span><div className="inbound-folder-controls"><button type="button" className="button subtle" onClick={() => void loadFolders()} disabled={busy || !values.host || !values.username}>{busy ? "Načítám složky…" : loaded ? "Obnovit složky ze serveru" : "Načíst složky ze serveru"}<RefreshCw size={13}/></button>{multiple ? <><div className="mail-folder-tools"><label className="mail-folder-search"><Search size={13}/><input type="search" value={folderQuery} onChange={(event) => setFolderQuery(event.target.value)} placeholder="Filtrovat složky…" aria-label={`Filtrovat složky: ${label}`}/></label><span>{selectedFolders.length} vybráno · {visibleFolders.length} z {candidates.length}</span><div><button type="button" className="button subtle" onClick={() => onChange([...new Set([...selectedFolders, ...visibleFolders])])} disabled={!visibleFolders.some((folder) => !selectedFolders.includes(folder))}>Vybrat zobrazené</button><button type="button" className="button subtle" onClick={() => onChange(selectedFolders.filter((folder) => !visibleFolders.includes(folder)))} disabled={!visibleFolders.some((folder) => selectedFolders.includes(folder))}>Zrušit výběr</button></div></div><div className="mail-folder-options" role="group" aria-label={label}>{visibleFolders.map((folder) => { const checked = selectedFolders.includes(folder); return <label className="mail-folder-option" key={folder}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked ? [...new Set([...selectedFolders, folder])] : selectedFolders.filter((item) => item !== folder))}/><span>{folder}</span></label>; })}{!visibleFolders.length && <small>Žádná složka neodpovídá filtru.</small>}{loaded && !options.length && <small>Server nevrátil žádné složky. Ověřte připojení a zkontrolujte výchozí složku INBOX.</small>}</div></> : <select aria-label={label} value={selected as string} onChange={(event) => onChange(event.target.value)}><option value="">— Bez složky —</option>{candidates.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select>}</div>{error && <small className="field-error">{error}</small>}<small className="field-hint">Načtěte dostupné složky a vyberte ty, které má CRM sledovat.</small></div>;
}

function MassEmailSmtpAccountField({ metadata, def, values, onChange }: { metadata: Metadata; def: FieldDef; values: Row; onChange: (patch: Row) => void }) {
  const [options, setOptions] = useState<Array<{ key: string; emailAddress: string; fromName?: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    request<Array<{ key: string; emailAddress: string; fromName?: string }>>("MassEmail/action/smtpAccountDataList")
      .then((items) => { if (live) setOptions(Array.isArray(items) ? items : []); })
      .catch(() => { if (live) setOptions([]); })
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);
  const systemAddress = String(metadata.appSettings?.outboundEmailFromAddress || "");
  const systemName = String(metadata.appSettings?.outboundEmailFromName || "");
  const currentKey = String(values.smtpAccount || (values.inboundEmailId ? `inboundEmail:${values.inboundEmailId}` : ""));
  const currentInbound = currentKey.startsWith("inboundEmail:") ? currentKey.slice("inboundEmail:".length) : "";
  const inboundOption = currentInbound && !options.some((item) => item.key === currentKey)
    ? [{ key: currentKey, emailAddress: String(values.inboundEmailName || currentInbound), fromName: "" }]
    : [];
  return <label className={`field-input ${def.required ? "required" : ""}`}>
    <span>{fieldLabel("smtpAccount", def, "MassEmail", metadata)}</span>
    <select value={currentKey} disabled={Boolean(def.readOnly || def.disabled)} onChange={(event) => {
      const key = event.target.value;
      if (!key) onChange({ smtpAccount: "", inboundEmailId: null, inboundEmailName: null, fromAddress: systemAddress, fromName: systemName });
      else if (key.startsWith("inboundEmail:")) {
        const id = key.slice("inboundEmail:".length);
        const item = options.find((candidate) => candidate.key === key);
        onChange({ smtpAccount: key, inboundEmailId: id, inboundEmailName: item?.emailAddress || values.inboundEmailName || id });
      } else {
        const item = options.find((candidate) => candidate.key === key);
        onChange({ smtpAccount: key, inboundEmailId: null, inboundEmailName: null, fromAddress: item?.emailAddress || "", fromName: item?.fromName || "" });
      }
    }}>
      <option value="">{systemAddress || "Výchozí systémový účet"} · Systém</option>
      {[...options, ...inboundOption].map((item) => <option key={item.key} value={item.key}>{item.emailAddress}{item.key.startsWith("inboundEmail:") ? " · Skupinová schránka" : ""}</option>)}
    </select>
    {!loaded && <small>Načítám dostupné účty…</small>}
  </label>;
}

function RecordEditor({ entity, fields, metadata, record, initialValues = {}, duplicate = false, onClose, onSaved }: { entity: string; fields: [string, FieldDef][]; metadata: Metadata; record?: Row; initialValues?: Row; duplicate?: boolean; onClose: () => void; onSaved: (record: Row) => void }) {
  const [values, setValues] = useState<Row>(() => {
    const defaults = Object.fromEntries(fields.filter(([, def]) => def.default !== undefined && typeof def.default !== "string" || typeof def.default === "string" && !def.default.startsWith("javascript:")).map(([name, def]) => [name, def.default]));
    const initial = { ...defaults, ...initialValues, ...(record || {}) };
    if (entity === "MassEmail" && !record) {
      initial.fromAddress = initial.fromAddress ?? metadata.appSettings?.outboundEmailFromAddress ?? "";
      initial.fromName = initial.fromName ?? metadata.appSettings?.outboundEmailFromName ?? "";
    }
    // EspoCRM's AppSecret detail field never returns or preloads a secret for editing.
    // Existing credentials stay untouched unless the administrator explicitly changes them.
    if (entity === "AppSecret" && record) initial.value = "";
    if (entity === "DashboardTemplate" && !record && !Array.isArray(initial.layout)) initial.layout = [{ name: "Přehled", layout: [] }];
    for (const [name, def] of fields) if (def.type === "personName" && record) initial[name] = { firstName: record.firstName || "", middleName: record.middleName || "", lastName: record.lastName || "" };
    for (const [name, def] of fields) if (def.type === "address" && record) initial[name] = Object.fromEntries(["street", "city", "state", "postalCode", "country"].map((part) => [part, record[`${name}${part[0].toUpperCase()}${part.slice(1)}`] || ""]));
    for (const [name, def] of fields) {
      if (["email", "phone"].includes(def.type || "") && (!Array.isArray(initial[`${name}Data`]) || (!initial[`${name}Data`].length && initial[name]))) {
        const email = def.type === "email";
        const key = email ? "emailAddress" : "phoneNumber";
        const address = String(initial[name] || "");
        initial[`${name}Data`] = address ? [{ [key]: address, primary: true, optOut: Boolean(initial[`${name}IsOptedOut`]), invalid: Boolean(initial[`${name}IsInvalid`]), ...(email ? { lower: address.toLowerCase() } : { type: def.defaultType || "Other" }) }] : [];
      }
      if (def.type === "currency") initial[`${name}Currency`] = record?.[`${name}Currency`] || initial[`${name}Currency`] || metadata.appSettings?.defaultCurrency || (metadata.app as any)?.currency?.list?.[0] || "USD";
      if (def.type === "link" || def.type === "linkOne") initial[name] = record?.[`${name}Id`] || initial[`${name}Id`] || initial[name] || "";
      if (def.type === "linkMultiple") initial[name] = record?.[`${name}Ids`] || initial[`${name}Ids`] || initial[name] || [];
      const primaryLink = primaryLinkForField(entity, name, def);
      if (def.type === "linkMultiple" && primaryLink) { initial[`${primaryLink}Id`] = record?.[`${primaryLink}Id`] || initial[`${primaryLink}Id`] || ""; initial[`${primaryLink}Name`] = record?.[`${primaryLink}Name`] || initial[`${primaryLink}Name`] || ""; }
      if (def.type === "linkParent") initial[name] = { type: record?.[`${name}Type`] || initial[`${name}Type`] || initial[name]?.type || "", id: record?.[`${name}Id`] || initial[`${name}Id`] || initial[name]?.id || "" };
      if (def.type === "file" || def.type === "image") initial[name] = record?.[`${name}Id`] ? { id: record[`${name}Id`], name: record[`${name}Name`] || "Soubor" } : initial[name] || (initial[`${name}Id`] ? { id: initial[`${name}Id`], name: initial[`${name}Name`] || "Soubor" } : null);
      if (def.type === "attachmentMultiple") initial[name] = record ? (record?.[`${name}Ids`] || []).map((id: string) => ({ id, name: record?.[`${name}Names`]?.[id] || id, type: record?.[`${name}Types`]?.[id] || "" })) : initial[name] || (initial[`${name}Ids`] || []).map((id: string) => ({ id, name: initial[`${name}Names`]?.[id] || id, type: initial[`${name}Types`]?.[id] || "" }));
    }
    if (entity === "User") initial.teamsColumns = record?.teamsColumns || {};
    if (["Meeting", "Call"].includes(entity)) for (const [name, def] of fields) if (def.type === "linkMultiple" && def.columns) initial[`${name}Columns`] = record?.[`${name}Columns`] || {};
    if (["Meeting", "Call", "Task"].includes(entity)) initial.reminders = record?.reminders || [];
    if (!record && ["Meeting", "Call"].includes(entity)) {
      initial.dateStart = initial.dateStart || dateTimeRoundedToQuarterHour();
      initial.duration = Number(initial.duration ?? (entity === "Meeting" ? 3600 : 300));
      initial.dateEnd = initial.dateEnd || dateAfterDuration(initial.dateStart, initial.duration);
    }
    for (const [name, def] of fields) if (def.type === "duration" && def.start && def.end) {
      const allDay = Boolean(record?.isAllDay || initial.isAllDay);
      const start = allDay ? record?.[`${def.start}Date`] || record?.[def.start] || initial[def.start] : record?.[def.start] || initial[def.start];
      const end = allDay ? record?.[`${def.end}Date`] || record?.[def.end] || initial[def.end] : record?.[def.end] || initial[def.end];
      if (record && start && end) {
        const startTime = new Date(String(start).replace(" ", "T")).getTime();
        const endTime = new Date(String(end).replace(" ", "T")).getTime();
        if (Number.isFinite(startTime) && Number.isFinite(endTime)) initial[name] = Math.max(0, (endTime - startTime) / 1000 + (allDay ? 86400 : 0));
      } else if (!record && start && !initial[def.end]) initial[def.end] = dateAfterDuration(start, initial[name], allDay);
    }
    return initial;
  });
  const [activeRecord, setActiveRecord] = useState<Row | undefined>(record);
  const autoPublishDate = useRef(false);
  const [dateTimeZone, setDateTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [changingAppSecret, setChangingAppSecret] = useState(!activeRecord);
  const [passwordStrengthParams, setPasswordStrengthParams] = useState<PasswordRecoveryInfo["strengthParams"] | null>(null);
  useEffect(() => {
    if (entity !== "User" || getSession()?.user.type !== "admin") return;
    let live = true;
    fetch("/api/v1/User/passwordRecoveryInfo").then((response) => response.json()).then((info: PasswordRecoveryInfo) => { if (live) setPasswordStrengthParams(info.strengthParams || {}); }).catch(() => live && setPasswordStrengthParams({}));
    return () => { live = false; };
  }, [entity]);
  const [recordBaseline, setRecordBaseline] = useState<Row>(activeRecord || {});
  const [versionNumber, setVersionNumber] = useState(activeRecord?.versionNumber ?? null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveAndContinueRequested = useRef(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [saveConflict, setSaveConflict] = useState<{ fields: SaveConflictField[]; latest: Row } | null>(null);
  const [duplicateCheck, setDuplicateCheck] = useState<{ rows: Row[]; payload: Row; keepOpen: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [connectionTestBusy, setConnectionTestBusy] = useState(false);
  const [connectionTestNotice, setConnectionTestNotice] = useState("");
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [oneOffTemplateOpen, setOneOffTemplateOpen] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState(String(values.emailAddress || ""));
  const [testEmailBusy, setTestEmailBusy] = useState(false);
  const [testEmailError, setTestEmailError] = useState("");
  const [testEmailNotice, setTestEmailNotice] = useState("");
  const [detailLayout, setDetailLayout] = useState<DetailLayoutPanel[]>([]);
  const [targetUserPositionOptions, setTargetUserPositionOptions] = useState<string[]>([]);
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);
  const templateDrafts = useRef<Record<string, Row>>({});
  useEffect(() => { let live = true; fetchLayout<DetailLayoutPanel[]>(entity, "detail").then((layout) => live && Array.isArray(layout) && setDetailLayout(layout)).catch(() => {}); return () => { live = false; }; }, [entity]);
  useEffect(() => {
    let live = true;
    if (entity !== "InboundEmail" || !values.team) { setTargetUserPositionOptions(values.targetUserPosition ? [String(values.targetUserPosition)] : []); return () => { live = false; }; }
    request<Row>(`Team/${encodeURIComponent(String(values.team))}`).then((team) => {
      if (live) setTargetUserPositionOptions([...new Set([...(team.positionList || []).map(String), ...(values.targetUserPosition ? [String(values.targetUserPosition)] : [])])]);
    }).catch(() => live && setTargetUserPositionOptions(values.targetUserPosition ? [String(values.targetUserPosition)] : []));
    return () => { live = false; };
  }, [entity, values.team, values.targetUserPosition]);
  useEffect(() => {
    const session = getSession();
    if (!session) return;
    let live = true;
    request<Row>(`Preferences/${encodeURIComponent(session.user.id)}`).then((preferences) => {
      if (!live) return;
      if (typeof preferences.timeZone === "string" && preferences.timeZone) setDateTimeZone(preferences.timeZone);
      if (activeRecord || !["Meeting", "Call", "Task"].includes(entity)) return;
      const defaultName = entity === "Task" ? "defaultRemindersTask" : "defaultReminders";
      if (Array.isArray(preferences[defaultName])) setValues((current) => current.reminders?.length ? current : { ...current, reminders: preferences[defaultName] });
    }).catch(() => {});
    return () => { live = false; };
  }, [entity, activeRecord]);
  async function cleanupUploads(keep: string[] = []) {
    const remove = uploadedIds.filter((id) => !keep.includes(id));
    await Promise.allSettled(remove.map((id) => request(`Attachment/${id}`, { method: "DELETE" })));
    setUploadedIds((old) => old.filter((id) => keep.includes(id)));
  }
  async function cancel() { await cleanupUploads(); onClose(); }
  async function testMailConnection() {
    if (!values.host) { setError("Nejdříve zadejte server pošty."); return; }
    const inbound = entity === "InboundEmail";
    const payload = inbound
      ? { host: values.host, port: values.port, security: values.security, username: values.username, password: values.password || null, id: activeRecord?.id || null }
      : { host: values.host, port: values.port, security: values.security, username: values.username, password: values.password || null, id: activeRecord?.id || null, emailAddress: values.emailAddress, userId: values.assignedUser || values.assignedUserId || null };
    setConnectionTestBusy(true); setError(""); setConnectionTestNotice("");
    try { await request(`${inbound ? "InboundEmail" : "EmailAccount"}/action/testConnection`, { method: "POST", body: JSON.stringify(payload) }); setConnectionTestNotice("Připojení k poštovnímu serveru je funkční."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Připojení k poštovnímu serveru se nezdařilo."); }
    finally { setConnectionTestBusy(false); }
  }
  async function sendTestEmail() {
    const recipient = testEmailTo.trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) { setTestEmailError("Zadejte platnou cílovou e-mailovou adresu."); return; }
    if (!values.smtpHost) { setTestEmailError("Nejdříve zadejte SMTP server."); return; }
    if (!Number.isInteger(Number(values.smtpPort)) || Number(values.smtpPort) < 1 || Number(values.smtpPort) > 65535) { setTestEmailError("Zadejte platný SMTP port od 1 do 65535."); return; }
    setTestEmailBusy(true); setTestEmailError(""); setTestEmailNotice("");
    const user = getSession()?.user as (User & { name?: string }) | undefined;
    try {
      await request("Email/sendTest", { method: "POST", body: JSON.stringify({ server: values.smtpHost, port: Number(values.smtpPort), auth: Boolean(values.smtpAuth), security: values.smtpSecurity || null, username: values.smtpUsername || null, password: values.smtpPassword || null, authMechanism: values.smtpAuthMechanism || null, fromName: entity === "InboundEmail" ? values.fromName || user?.name || "EspoCRM" : user?.name || "EspoCRM", fromAddress: values.emailAddress, emailAddress: recipient, type: entity === "InboundEmail" ? "inboundEmail" : "emailAccount", id: activeRecord?.id || null, ...(entity === "EmailAccount" ? { userId: values.assignedUser || values.assignedUserId || null } : {}) }) });
      setTestEmailNotice(`Testovací zpráva byla odeslána na ${recipient}.`); setTestEmailOpen(false);
    } catch (cause) { setTestEmailError(cause instanceof Error ? cause.message : "Testovací zprávu se nepodařilo odeslat."); }
    finally { setTestEmailBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const keepOpen = saveAndContinueRequested.current;
    saveAndContinueRequested.current = false;
    if (uploading) return; setBusy(true); setError(""); setSaveNotice("");
    if (entity === "User" && values.password && values.password !== values.passwordConfirm) { setError("Hesla se neshodují."); setBusy(false); return; }
    if (entity === "User" && values.password && passwordStrengthParams === null) { setError("Načítám pravidla hesla. Zkuste to prosím znovu za chvíli."); setBusy(false); return; }
    if (entity === "User" && values.password) { const passwordIssue = validateRequestedPassword(String(values.password), passwordStrengthParams || {}); if (passwordIssue) { setError(passwordIssue); setBusy(false); return; } }
    if (entity === "WorkingTimeRange" && values.dateStart && values.dateEnd && String(values.dateEnd) < String(values.dateStart)) { setError("Datum konce musí být stejné nebo pozdější než datum začátku."); setBusy(false); return; }
    for (const [name, def] of fields) {
      if (def.type !== "attachmentMultiple") continue;
      const count = Array.isArray(values[name]) ? values[name].length : 0;
      if (def.required && count === 0) { setError(`Pole „${fieldLabel(name, def, entity, metadata)}“ je povinné.`); setBusy(false); return; }
      if (Number(def.maxCount) > 0 && count > Number(def.maxCount)) { setError(`Pole „${fieldLabel(name, def, entity, metadata)}“ může obsahovat nejvýše ${def.maxCount} souborů.`); setBusy(false); return; }
    }
    if (["WorkingTimeCalendar", "WorkingTimeRange"].includes(entity)) {
      for (const [name, def] of fields) {
        if (!(name === "timeRanges" || /^weekday[0-6]TimeRanges$/.test(name))) continue;
        const day = name.match(/^weekday([0-6])TimeRanges$/)?.[1];
        if (day != null && !values[`weekday${day}`]) continue;
        const issue = validateTimeRanges(values[name], Boolean(def.required));
        if (issue) { setError(`${fieldLabel(name, def, entity, metadata)}: ${issue}`); setBusy(false); return; }
      }
    }
    for (const [name] of fields) {
      if (entity === "AppSecret" && name === "value" && activeRecord && !changingAppSecret) continue;
      const logic = dynamicLogicDefs.fields?.[name] || {};
      if (logic.visible?.conditionGroup && !conditionGroupMatches(logic.visible, values, dynamicLogicUser)) continue;
      if (logic.required?.conditionGroup && conditionGroupMatches(logic.required, values, dynamicLogicUser)) {
        const value = values[name];
        const empty = value == null || value === "" || (Array.isArray(value) && !value.length) || (typeof value === "object" && !Array.isArray(value) && !value.id && !value.type && !Object.values(value).some(Boolean));
        if (empty) { setError(`Pole „${fieldLabel(name, fieldMap.get(name), entity, metadata)}“ je povinné.`); setBusy(false); return; }
      }
      const invalid = logic.invalid;
      if (invalid?.conditionGroup && conditionGroupMatches(invalid, values, dynamicLogicUser)) {
        setError(invalid.message || `Hodnota pole „${fieldLabel(name, fieldMap.get(name), entity, metadata)}“ není platná.`); setBusy(false); return;
      }
    }
    for (const [name, def] of fields) {
      if (!["email", "phone"].includes(def.type || "")) continue;
      const email = def.type === "email";
      const valueKey = email ? "emailAddress" : "phoneNumber";
      const source = Array.isArray(values[`${name}Data`]) ? values[`${name}Data`] as Row[] : [];
      const rows = source.filter((item) => String(item[valueKey] || "").trim());
      const seen = new Set<string>();
      for (const item of rows) {
        const value = String(item[valueKey]).trim();
        const normalized = email ? value.toLowerCase() : value.replace(/[\s+]/g, "");
        if (seen.has(normalized)) { setError(`${fieldLabel(name, def, entity, metadata)}: stejná hodnota je uvedena vícekrát.`); setBusy(false); return; }
        seen.add(normalized);
        if (item.invalid) continue;
        const phonePattern = getPhoneValidationPattern(metadata);
        const valid = email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : phonePattern.test(value);
        if (!valid) { setError(`${fieldLabel(name, def, entity, metadata)}: ${email ? "zadejte platnou e-mailovou adresu nebo ji označte jako neplatnou" : "zkontrolujte formát telefonního čísla"}.`); setBusy(false); return; }
      }
    }
    const payload: Row = {};
    for (const [name, def] of fields) {
      if (name === "passwordConfirm") continue;
      if (entity === "AppSecret" && name === "value" && activeRecord && !changingAppSecret) continue;
      if (def.type === "duration") continue;
      const value = values[name];
      if (["email", "phone"].includes(def.type || "")) {
        const email = def.type === "email";
        const valueKey = email ? "emailAddress" : "phoneNumber";
        const sourceRows = Array.isArray(values[`${name}Data`]) ? values[`${name}Data`] as Row[] : [];
        const rows: Row[] = sourceRows.filter((item) => String(item[valueKey] || "").trim()).map((item) => ({ ...item, [valueKey]: String(item[valueKey]).trim(), ...(email ? { lower: String(item[valueKey]).trim().toLowerCase() } : {}) }));
        let primaryIndex = rows.findIndex((item) => item.primary);
        if (primaryIndex < 0 && rows.length) primaryIndex = 0;
        const primary = rows[primaryIndex];
        if (primaryIndex > 0) { const [item] = rows.splice(primaryIndex, 1); rows.unshift(item); }
        payload[name] = primary?.[valueKey] || (value ? String(value) : null);
        payload[`${name}Data`] = def.onlyPrimary ? (primary ? [{ [valueKey]: primary[valueKey], primary: true, ...(email ? { lower: primary.lower } : {}) }] : null) : rows.length ? rows.map((item, index) => ({ ...item, primary: index === 0 })) : [];
        if (!def.onlyPrimary) {
          payload[`${name}IsOptedOut`] = primary ? Boolean(primary.optOut) : null;
          payload[`${name}IsInvalid`] = primary ? Boolean(primary.invalid) : null;
        }
        continue;
      }
      if (def.type === "bool") payload[name] = Boolean(value);
      else if (def.type === "linkMultiple") {
        const ids = Array.isArray(value) ? value : [];
        payload[`${name}Ids`] = ids;
        const primaryLink = primaryLinkForField(entity, name, def);
        if (primaryLink) {
          const primaryId = values[`${primaryLink}Id`] || ids[0] || null;
          payload[`${primaryLink}Id`] = primaryId;
          payload[`${primaryLink}Name`] = primaryId ? values[`${primaryLink}Name`] || null : null;
        }
      }
      else if (["link", "linkOne"].includes(def.type || "")) payload[`${name}Id`] = value || null;
      else if (def.type === "linkParent") { payload[`${name}Type`] = value?.type || null; payload[`${name}Id`] = value?.id || null; }
      else if (def.type === "personName") { payload.firstName = value?.firstName || ""; payload.middleName = value?.middleName || ""; payload.lastName = value?.lastName || ""; }
      else if (def.type === "address") { for (const [part, suffix] of [["street", "Street"], ["city", "City"], ["state", "State"], ["postalCode", "PostalCode"], ["country", "Country"]]) payload[`${name}${suffix}`] = value?.[part] || ""; }
      else if (def.type === "file" || def.type === "image") { payload[`${name}Id`] = value?.id || null; payload[`${name}Name`] = value?.name || null; }
      else if (def.type === "attachmentMultiple") { const list = Array.isArray(value) ? value : []; payload[`${name}Ids`] = list.map((item: Row) => item.id); payload[`${name}Names`] = Object.fromEntries(list.map((item: Row) => [item.id, item.name])); payload[`${name}Types`] = Object.fromEntries(list.map((item: Row) => [item.id, item.type || ""])); }
      else if (["array", "urlMultiple", "checklist"].includes(def.type || "") && typeof value === "string") payload[name] = value.split("\n").map((line: string) => line.trim()).filter(Boolean);
      else if (def.type === "array" && Array.isArray(value)) payload[name] = value.map((item: unknown) => String(item).trim()).filter(Boolean);
      else if (def.type === "arrayInt" && Array.isArray(value)) payload[name] = value.map(Number).filter(Number.isFinite);
      else if (["WorkingTimeCalendar", "WorkingTimeRange"].includes(entity) && (name === "timeRanges" || /^weekday[0-6]TimeRanges$/.test(name)) && Array.isArray(value)) payload[name] = value.length ? value : null;
      else if (["jsonObject", "jsonArray"].includes(def.type || "") && typeof value === "string") {
        if (!value.trim()) payload[name] = null;
        else { try { payload[name] = JSON.parse(value); } catch { setError(`Pole „${fieldLabel(name, def, entity, metadata)}“ musí obsahovat platný JSON.`); setBusy(false); return; } }
      }
      else if (def.type === "currency") { payload[name] = value === "" || value == null ? null : Number(value); payload[`${name}Currency`] = values[`${name}Currency`] || metadata.appSettings?.defaultCurrency || (metadata.app as any)?.currency?.list?.[0] || "USD"; }
      else if (["int", "float", "enumInt", "enumFloat"].includes(def.type || "") && value !== "" && value != null) payload[name] = Number(value);
      else if (value !== undefined && value !== "") payload[name] = value;
      if (def.type === "linkMultiple" && def.columns) payload[`${name}Columns`] = values[`${name}Columns`] || {};
    }
    if (entity === "DashboardTemplate" || entity === "Portal") payload.dashletsOptions = values.dashletsOptions || {};
    if (entity === "Contact" && values.title !== undefined) payload.accountRole = values.title || null;
    if (entity === "EmailTemplate" && initialValues.oneOff) payload.oneOff = true;
    if (entity === "User" && fields.some(([name]) => name === "teams")) payload.teamsColumns = values.teamsColumns || {};
    if (entity === "Meeting") {
      payload.isAllDay = Boolean(values.isAllDay);
      if (values.isAllDay) {
        payload.dateStart = null; payload.dateEnd = null;
        payload.dateStartDate = values.dateStartDate || null; payload.dateEndDate = values.dateEndDate || null;
      } else {
        payload.dateStartDate = null; payload.dateEndDate = null;
      }
    }
    if (entity === "User" && !activeRecord && initialValues.type) payload.type = initialValues.type;
    try {
      const optimisticConcurrency = Boolean((metadata.entityDefs?.[entity] as any)?.optimisticConcurrencyControl && activeRecord && versionNumber != null);
      const saved = await request<Row>(activeRecord ? `${entity}/${activeRecord.id}` : entity, { method: activeRecord ? "PUT" : "POST", ...(optimisticConcurrency ? { headers: { "X-Version-Number": String(versionNumber) } } : {}), body: JSON.stringify(payload) });
      const keepIds = fields.flatMap(([name, def]) => def.type === "attachmentMultiple" ? (values[name] || []).map((item: Row) => item.id) : ["file", "image"].includes(def.type || "") && values[name]?.id ? [values[name].id] : []);
      await cleanupUploads(keepIds);
      if (keepOpen) {
        setActiveRecord(saved);
        setChangingAppSecret(false);
        setValues(valuesFromRecordFields(entity, fields, saved));
        setRecordBaseline(saved);
        setVersionNumber(saved.versionNumber ?? null);
        setSaveNotice("Změny byly uloženy. Můžete pokračovat v úpravách.");
      } else onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && !activeRecord && e.status === 409 && e.statusReason?.reason === "duplicate") {
        const data = e.statusReason.data;
        const rows = Array.isArray(data) ? data : Array.isArray(data?.duplicates) ? data.duplicates : Array.isArray(data?.list) ? data.list : [];
        setDuplicateCheck({ rows, payload, keepOpen }); setError("");
      } else if (e instanceof ApiError && e.status === 409 && e.statusReason?.reason === "modified" && activeRecord?.id) {
        try {
          const latest = await request<Row>(`${encodeURIComponent(entity)}/${encodeURIComponent(activeRecord.id)}`);
          const conflictAttributes = Object.keys(e.statusReason.data?.values || {});
          const conflictFields = fields.flatMap(([name, def]) => {
            const attributes = fieldAttributeList(entity, name, def);
            if (conflictAttributes.length && !attributes.some((attribute) => conflictAttributes.includes(attribute))) return [];
            const currentAttributes = attributesFromFormField(entity, name, def, values);
            const actualAttributes = Object.fromEntries(attributes.map((attribute) => [attribute, latest[attribute]]));
            const originalAttributes = Object.fromEntries(attributes.map((attribute) => [attribute, recordBaseline[attribute]]));
            const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
            const locallyChanged = attributes.some((attribute) => !equal(currentAttributes[attribute], originalAttributes[attribute]));
            const remotelyChanged = attributes.some((attribute) => !equal(actualAttributes[attribute], originalAttributes[attribute]));
            const divergent = attributes.some((attribute) => !equal(currentAttributes[attribute], actualAttributes[attribute]));
            if (!locallyChanged || !remotelyChanged || !divergent) return [];
            return [{ name, label: fieldLabel(name, def, entity, metadata), current: values[name], actual: conflictDisplayValue(name, def, latest), original: conflictDisplayValue(name, def, recordBaseline) }];
          });
          if (conflictFields.length) { setSaveConflict({ fields: conflictFields, latest }); setError(""); }
          else setError("CRM hlásí konflikt, který editor nedokáže bezpečně přiřadit k poli. Záznam nebyl uložen; zavřete a znovu otevřete záznam a změny zopakujte.");
        } catch (refreshError) { setError(refreshError instanceof Error ? refreshError.message : "Záznam se mezitím změnil a jeho aktuální stav se nepodařilo načíst."); }
      } else setError(e instanceof Error ? e.message : "Záznam se nepodařilo uložit.");
    }
    finally { setBusy(false); }
  }
  async function createDespiteDuplicate() {
    if (!duplicateCheck) return;
    setBusy(true); setError("");
    try {
      const saved = await request<Row>(entity, { method: "POST", headers: { "X-Skip-Duplicate-Check": "true" }, body: JSON.stringify(duplicateCheck.payload) });
      const keepIds = fields.flatMap(([name, def]) => def.type === "attachmentMultiple" ? (values[name] || []).map((item: Row) => item.id) : ["file", "image"].includes(def.type || "") && values[name]?.id ? [values[name].id] : []);
      await cleanupUploads(keepIds); setDuplicateCheck(null);
      if (duplicateCheck.keepOpen) {
        setActiveRecord(saved); setChangingAppSecret(false); setValues(valuesFromRecordFields(entity, fields, saved)); setRecordBaseline(saved); setVersionNumber(saved.versionNumber ?? null); setSaveNotice("Záznam byl vytvořen. Můžete pokračovat v úpravách.");
      } else onSaved(saved);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Záznam se nepodařilo vytvořit."); setDuplicateCheck(null); }
    finally { setBusy(false); }
  }
  function applySaveConflict(resolutions: Record<string, "current" | "actual" | "original">) {
    if (!saveConflict) return;
    const latestValues = valuesFromRecordFields(entity, fields, saveConflict.latest);
    const originalValues = valuesFromRecordFields(entity, fields, recordBaseline);
    const next = { ...latestValues };
    for (const field of saveConflict.fields) {
      const source = resolutions[field.name] === "actual" ? latestValues : resolutions[field.name] === "original" ? originalValues : values;
      const def = fieldMap.get(field.name);
      if (!def) continue;
      const primaryLink = primaryLinkForField(entity, field.name, def);
      const keys = [field.name, ...(def.type === "currency" ? [`${field.name}Currency`] : []), ...(def.type === "linkMultiple" && def.columns ? [`${field.name}Columns`] : []), ...(def.type === "linkMultiple" && primaryLink ? [`${primaryLink}Id`, `${primaryLink}Name`] : [])];
      for (const key of keys) if (key in source) next[key] = source[key];
    }
    if (entity === "User") next.teamsColumns = saveConflict.latest.teamsColumns || {};
    setValues(next); setRecordBaseline(saveConflict.latest); setVersionNumber(saveConflict.latest.versionNumber ?? null); setSaveConflict(null); setError("Zkontrolujte sloučený formulář a znovu uložte.");
  }
  const fieldMap = new Map(fields);
  const smtpPanelFieldNames = new Set(["InboundEmail", "EmailAccount"].includes(entity)
    ? detailLayout.filter((panel) => panel.tabLabel === "$label:SMTP").flatMap((panel) => (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name ? [item.name] : []))
    : []);
  const emailTestActionFields = new Set(["InboundEmail", "EmailAccount"].includes(entity) ? ["testConnection", "smtpTestSend"] : []);
  const used = new Set<string>();
  if (entity === "Portal" && fieldMap.has("themeParams")) used.add("themeParams");
  const currentUserType = entity === "User" ? String(values.type || activeRecord?.type || initialValues.type || "regular") : "";
  const providerPanel = authenticationProviderLayout(metadata, entity, String(values.method || activeRecord?.method || initialValues.method || ""), values);
  const editorDetailLayout = providerPanel ? [...detailLayout, providerPanel] : detailLayout;
  const userManagedFields = new Set(["type", "isActive", "teams", "defaultTeam", "roles", "portals", "accounts", "portalRoles", "contact", "dashboardTemplate", "workingTimeCalendar", "layoutSet", "authMethod", "password", "passwordConfirm", "sendAccessInfo"]);
  const isUserFieldVisible = (name: string) => {
    if (entity !== "User") return true;
    if (currentUserType === "portal") return !["teams", "defaultTeam", "roles", "title", "workingTimeCalendar", "layoutSet", "authMethod"].includes(name);
    if (currentUserType === "api") return !["name", "firstName", "middleName", "lastName", "emailAddress", "phoneNumber", "gender", "title", "portals", "accounts", "portalRoles", "contact", "dashboardTemplate", "workingTimeCalendar", "layoutSet", "password", "passwordConfirm"].includes(name);
    return !["portals", "accounts", "portalRoles", "contact", "dashboardTemplate", "authMethod"].includes(name);
  };
  let groups: Array<{ title: string; names: string[] }>;
  if (entity === "User") {
    groups = detailLayout.flatMap((panel, index) => {
      const names = (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name && fieldMap.has(item.name) && !userManagedFields.has(item.name) && isUserFieldVisible(item.name) && !used.has(item.name) ? [item.name] : []);
      names.forEach((name) => used.add(name));
      return names.length ? [{ title: panel.label || (index === 0 ? "Základní informace" : `Další údaje ${index}`), names }] : [];
    });
    const addUserGroup = (title: string, names: string[]) => { const available = names.filter((name) => fieldMap.has(name) && isUserFieldVisible(name) && !used.has(name)); available.forEach((name) => used.add(name)); if (available.length) groups.push({ title, names: available }); };
    addUserGroup("Přístup a týmy", ["type", "isActive", "teams", "defaultTeam", "roles"]);
    addUserGroup("Portál", ["portals", "accounts", "portalRoles", "contact", "dashboardTemplate"]);
    addUserGroup("Další nastavení", ["workingTimeCalendar", "layoutSet"]);
    addUserGroup("API ověření", ["authMethod"]);
    addUserGroup("Heslo", ["password", "passwordConfirm", "sendAccessInfo"]);
  } else if (entity === "Role" || entity === "PortalRole") {
    groups = detailLayout.flatMap((panel, index) => {
      const names = (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name && !["data", "fieldData"].includes(item.name) && fieldMap.has(item.name) && !used.has(item.name) ? [item.name] : []);
      names.forEach((name) => used.add(name));
      return names.length ? [{ title: panel.label || (index === 0 ? "Základní informace" : `Další údaje ${index}`), names }] : [];
    });
    ["data", "fieldData"].forEach((name) => { if (fieldMap.has(name)) used.add(name); });
  } else {
    groups = editorDetailLayout.flatMap((panel, index) => {
      const names = (panel.rows || []).flat().flatMap((item) => item && typeof item === "object" && item.name && (fieldMap.has(item.name) || emailTestActionFields.has(item.name)) && !used.has(item.name) ? [item.name] : []);
      names.forEach((name) => used.add(name));
      return names.length ? [{ title: panel.label || (index === 0 ? "Základní informace" : `Další údaje ${index}`), names }] : [];
    });
  }
  const unplaced = fields.map(([name]) => name).filter((name) => !used.has(name) && isUserFieldVisible(name));
  if (unplaced.length) groups.push({ title: groups.length ? "Další pole" : "Údaje", names: unplaced });
  const mailActionNames = new Set(groups.flatMap((group) => group.names));
  const emailFilterActions = values.isGlobal ? ["Skip"] : values.parent?.type === "User" ? ["Skip", "Move to Folder", "None"] : values.parent?.type === "InboundEmail" ? ["Skip", "Move to Group Folder"] : values.parent?.type === "EmailAccount" ? ["Skip"] : ["Skip"];
  function updateFieldValue(name: string, value: any) {
    setSaveNotice("");
    setValues((old) => {
      if (entity === "EmailAccount" && name === "assignedUser") return { ...old, assignedUser: value, emailFolder: "" };
      if (entity === "EmailAccount" && name === "security") return { ...old, security: value, port: value === "SSL" ? 993 : 143 };
      if (entity === "EmailAccount" && name === "smtpSecurity") return { ...old, smtpSecurity: value, smtpPort: value === "SSL" ? 465 : value === "TLS" ? 587 : 25 };
      if (entity === "Opportunity" && name === "stage") {
        const probabilityMap = (metadata.entityDefs?.Opportunity?.fields?.stage as any)?.probabilityMap || {};
        const probability = probabilityMap[String(value)];
        return probability === null || probability === undefined ? { ...old, stage: value } : { ...old, stage: value, probability };
      }
      if (entity === "Contact" && name === "title") return { ...old, title: value, accountRole: value };
      if (entity === "Document" && name === "file" && !activeRecord) return { ...old, file: value, name: String(value?.name || "") };
      if (entity === "Task" && ["dateEnd", "dateEndDate"].includes(name) && !value) {
        const next = { ...old, [name]: value };
        if (!next.dateEnd && !next.dateEndDate && Array.isArray(next.reminders) && next.reminders.length) next.reminders = [];
        return next;
      }
      if (entity === "KnowledgeBaseArticle" && name === "status") {
        if (value === "Published" && !old.publishDate) {
          autoPublishDate.current = true;
          const today = new Date();
          return { ...old, status: value, publishDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}` };
        }
        if (value !== "Published" && autoPublishDate.current) {
          autoPublishDate.current = false;
          return { ...old, status: value, publishDate: null };
        }
      }
      if (entity === "Template" && name === "entityType" && !activeRecord) {
        const previousType = String(old.entityType || "");
        if (previousType) templateDrafts.current[previousType] = Object.fromEntries(["header", "body", "footer", "style"].map((key) => [key, old[key] ?? null]));
        const cached = templateDrafts.current[String(value)];
        const defaultsByType = (metadata.entityDefs?.Template as any)?.defaultTemplates || (metadata as any).defaultTemplates || {};
        const type = String(value || "");
        const scopeType = (metadata.scopes?.[type] as any)?.type;
        const defaults = defaultsByType[type] || (scopeType ? defaultsByType[scopeType] : null) || {};
        return { ...old, entityType: type || null, ...(cached || { header: defaults.header || null, body: defaults.body || null, footer: defaults.footer || null, style: defaults.style || null }) };
      }
      if (["Meeting", "Call"].includes(entity)) {
        const durationDef = metadata.entityDefs?.[entity]?.fields?.duration;
        const startField = String(durationDef?.start || "");
        const endField = String(durationDef?.end || "");
        const startDateField = `${startField}Date`;
        const endDateField = `${endField}Date`;
        if (entity === "Meeting" && name === "isAllDay" && durationDef && startField && endField) {
          if (value) {
            const startDate = old[startDateField] || String(old[startField] || dateTimeRoundedToQuarterHour()).slice(0, 10);
            const priorEndDate = old[endDateField] || (old[endField] ? String(old[endField]).slice(0, 10) : "");
            const endDate = old.duration != null ? dateAfterDuration(startDate, old.duration, true) : priorEndDate || startDate;
            return { ...old, isAllDay: true, [startField]: "", [endField]: "", [startDateField]: startDate, [endDateField]: endDate };
          }
          const start = old[startField] || `${old[startDateField] || dateTimeRoundedToQuarterHour().slice(0, 10)} 09:00:00`;
          const end = old.duration != null ? dateAfterDuration(start, old.duration) : old[endField] || `${old[endDateField] || old[startDateField]} 10:00:00`;
          return { ...old, isAllDay: false, [startField]: start, [endField]: end, [startDateField]: "", [endDateField]: "" };
        }
        if (durationDef && startField && endField && name === "duration") {
          const allDay = Boolean(old.isAllDay);
          const start = allDay ? old[startDateField] : old[startField];
          return { ...old, duration: Number(value) || 0, [allDay ? endDateField : endField]: dateAfterDuration(start, value, allDay) };
        }
        if (durationDef && startField && endField && name === (old.isAllDay ? startDateField : startField) && old.duration != null) {
          const allDay = Boolean(old.isAllDay);
          return { ...old, [name]: value, [allDay ? endDateField : endField]: dateAfterDuration(value, old.duration, allDay) };
        }
        if (durationDef && startField && endField && name === (old.isAllDay ? endDateField : endField)) {
          const allDay = Boolean(old.isAllDay);
          const start = old[allDay ? startDateField : startField];
          const startTime = start ? new Date(String(start).replace(" ", "T")).getTime() : NaN;
          const endTime = value ? new Date(String(value).replace(" ", "T")).getTime() : NaN;
          if (Number.isFinite(startTime) && Number.isFinite(endTime)) return { ...old, [name]: value, duration: Math.max(0, (endTime - startTime) / 1000 + (allDay ? 86400 : 0)) };
        }
      }
      if (entity === "InboundEmail") {
        if (name === "emailAddress") return { ...old, emailAddress: value, name: value, ...(!activeRecord || !old.replyToAddress ? { replyToAddress: value } : {}) };
        if (name === "team") return { ...old, team: value, targetUserPosition: "" };
        if (name === "security") return { ...old, security: value, port: value === "SSL" ? 993 : 143 };
        if (name === "smtpSecurity") return { ...old, smtpSecurity: value, smtpPort: value === "SSL" ? 465 : value === "TLS" ? 587 : 25 };
        if (name === "createCase" && !value) return { ...old, createCase: false, caseDistribution: "", team: "", teamId: null, assignToUser: "", assignToUserId: null, targetUserPosition: "" };
        if (name === "caseDistribution") return { ...old, caseDistribution: value, assignToUser: "", assignToUserId: null, targetUserPosition: !value || value === "Direct-Assignment" ? "" : old.targetUserPosition };
        return { ...old, [name]: value };
      }
      if (entity === "User") {
        if (name === "password") {
          const sendable = Boolean(value && old.emailAddress && (old.type !== "portal" || old.portals?.length));
          return { ...old, password: value, passwordPreview: "", sendAccessInfo: sendable ? (old.sendAccessInfo ?? true) : false };
        }
        if (name === "emailAddress" || name === "portals") {
          const next = { ...old, [name]: value };
          const sendable = Boolean(old.password && next.emailAddress && (next.type !== "portal" || next.portals?.length));
          return { ...next, sendAccessInfo: sendable ? (old.sendAccessInfo ?? true) : false };
        }
        return { ...old, [name]: value };
      }
      if (entity !== "EmailFilter") return { ...old, [name]: value };
      if (name === "isGlobal" && value) return { ...old, isGlobal: true, parent: { type: "", id: "" }, action: "Skip", emailFolder: "", groupEmailFolder: "" };
      if (name === "parent") {
        const nextAction = (value?.type === "User" ? ["Skip", "Move to Folder", "None"] : value?.type === "InboundEmail" ? ["Skip", "Move to Group Folder"] : ["Skip"]).includes(old.action) ? old.action : "Skip";
        return { ...old, parent: value, action: nextAction, emailFolder: "", groupEmailFolder: "" };
      }
      if (name === "action") return { ...old, action: value, ...(value === "Move to Folder" ? { groupEmailFolder: "" } : { emailFolder: "" }), ...(value === "Move to Group Folder" ? { emailFolder: "" } : { groupEmailFolder: "" }) };
      return { ...old, [name]: value };
    });
  }
  const baseDynamicLogicDefs = metadata.logicDefs?.[entity] || {};
  const authenticationMethods = (metadata as any).authenticationMethods || {};
  const availableAuthenticationMethods = entity === "AuthenticationProvider" ? Object.entries(authenticationMethods).filter(([, method]: [string, any]) => method?.provider?.isAvailable) as Array<[string, any]> : [];
  const authenticationProviderFieldOwners = new Map<string, string[]>();
  const authenticationProviderDynamicFields: Row = {};
  for (const [methodName, method] of availableAuthenticationMethods) {
    const provider = method.provider || {};
    const fieldList: string[] = provider.fieldList || method.settings?.fieldList || [];
    for (const name of fieldList) authenticationProviderFieldOwners.set(name, [...(authenticationProviderFieldOwners.get(name) || []), methodName]);
    const dynamicFields = (provider.dynamicLogic || method.settings?.dynamicLogic || {}).fields || {};
    for (const [name, definition] of Object.entries(dynamicFields)) {
      if (!fieldList.includes(name)) continue;
      const remapAttribute = (value: any): any => Array.isArray(value) ? value.map(remapAttribute) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "attribute" && item === "authenticationMethod" ? "method" : remapAttribute(item)])) : value;
      authenticationProviderDynamicFields[name] = remapAttribute(definition);
    }
  }
  const dynamicLogicDefs = entity === "AuthenticationProvider" ? { ...baseDynamicLogicDefs, fields: { ...(baseDynamicLogicDefs.fields || {}), ...authenticationProviderDynamicFields } } : baseDynamicLogicDefs;
  const dynamicLogicUser = getSession()?.user as (User & { teamsIds?: string[] }) | undefined;
  const currentEditorUserId = getSession()?.user.id || "";
  const taskNonReminderStatus = [
    ...((metadata.scopes?.Task as any)?.completedStatusList || ["Completed"]),
    ...((metadata.scopes?.Task as any)?.canceledStatusList || ["Canceled"]),
  ].includes(String(values.status || ""));
  const currentUserAssignedToTask = Boolean(currentEditorUserId && (
    values.assignedUserId === currentEditorUserId ||
    (values.assignedUsers || values.assignedUsersIds || []).includes?.(currentEditorUserId)
  ));
  const taskReminderVisible = entity !== "Task" || Boolean(values.dateEnd || values.dateEndDate) && !taskNonReminderStatus && currentUserAssignedToTask;
  const editorFieldVisible = (name: string) => (entity !== "InboundEmail" || inboundEmailFieldVisible(name, values)) && (entity !== "EmailAccount" || emailAccountFieldVisible(name, values)) && (name !== "reminders" || taskReminderVisible);
  const renderField = (name: string) => {
    if (!editorFieldVisible(name)) return null;
    if ((entity === "InboundEmail" || entity === "EmailAccount") && name === "testConnection") return <div className="email-test-field" key={name}><button type="button" className="button subtle" onClick={() => void testMailConnection()} disabled={connectionTestBusy || !values.host}><Network size={14}/>{connectionTestBusy ? "Testuji připojení…" : "Testovat IMAP připojení"}</button></div>;
    if ((entity === "InboundEmail" || entity === "EmailAccount") && name === "smtpTestSend") return values.smtpHost ? <div className="email-test-field" key={name}><button type="button" className="button subtle" onClick={() => { setTestEmailTo(String((getSession()?.user as User & { emailAddress?: string } | undefined)?.emailAddress || "")); setTestEmailError(""); setTestEmailOpen(true); }} disabled={testEmailBusy}><Mail size={14}/>{testEmailBusy ? "Odesílám…" : "Odeslat testovací e-mail"}</button></div> : null;
    let def = fieldMap.get(name)!;
    if (smtpPanelFieldNames.has(name)) {
      const label = fieldLabel(name, def, entity, metadata);
      if (/^SMTP\s+/i.test(label)) def = { ...def, label: label.replace(/^SMTP\s+/i, "").replace(/^./, (character) => character.toLocaleUpperCase()) };
    }
    const owners = authenticationProviderFieldOwners.get(name);
    if (entity === "AuthenticationProvider" && owners?.length && !owners.includes(String(values.method || ""))) return null;
    if (entity === "Note" && name === "post") def = { ...def, required: !(values.attachments?.length || values.attachmentsIds?.length) };
    if (entity === "AppSecret" && name === "value" && activeRecord && !changingAppSecret) return <div className="field-input app-secret-value" key={name}><span>{fieldLabel(name, def, entity, metadata)}</span><div className="app-secret-masked"><code>••••••••••</code><span>Uložená hodnota je skrytá.</span><button type="button" className="button subtle" onClick={() => { setChangingAppSecret(true); setValues((current) => ({ ...current, value: "" })); }}>Změnit hodnotu</button></div></div>;
    if (entity === "AppSecret" && name === "value") def = { ...def, type: "password" };
    if (entity === "LeadCapture" && name === "fieldParams") return null;
    if (entity === "LeadCapture" && name === "fieldList") return <LeadCaptureFieldConfigurator key={name} metadata={metadata} selected={values.fieldList || []} params={values.fieldParams || {}} onChange={(selected, params) => setValues((old) => ({ ...old, fieldList: selected, fieldParams: params }))}/>;
    if (entity === "DashboardTemplate" && name === "layout" || entity === "Portal" && name === "dashboardLayout") return <div className="field-input dashboard-layout-field" key={name}><span>{fieldLabel(name, def, entity, metadata)}{def.required && <i> *</i>}</span><DashboardLayoutEditor value={values[name]} options={values.dashletsOptions || {}} metadata={metadata} disabled={Boolean(def.readOnly || def.disabled)} onChange={(layout) => setValues((old) => ({ ...old, [name]: layout }))} onOptionsChange={(dashletsOptions) => setValues((old) => ({ ...old, dashletsOptions }))}/></div>;
    const logic = dynamicLogicDefs.fields?.[name] || {};
    if (logic.visible?.conditionGroup && !conditionGroupMatches(logic.visible, values, dynamicLogicUser)) return null;
    const dynamicRequired = Boolean(logic.required?.conditionGroup && conditionGroupMatches(logic.required, values, dynamicLogicUser));
    const dynamicReadOnly = Boolean(logic.readOnly?.conditionGroup && conditionGroupMatches(logic.readOnly, values, dynamicLogicUser));
    const dynamicReadOnlySaved = Boolean(activeRecord && logic.readOnlySaved?.conditionGroup && conditionGroupMatches(logic.readOnlySaved, values, dynamicLogicUser));
    if (dynamicRequired || dynamicReadOnly || dynamicReadOnlySaved) def = { ...def, required: Boolean(def.required || dynamicRequired), readOnly: Boolean(def.readOnly || dynamicReadOnly || dynamicReadOnlySaved) };
    const optionRules = dynamicLogicDefs.options?.[name];
    if (Array.isArray(optionRules) && optionRules.length) {
      const matchingOptionRule = optionRules.find((rule: Row) => conditionGroupMatches(rule, values, dynamicLogicUser));
      if (matchingOptionRule) def = { ...def, options: matchingOptionRule.optionList || [] };
    }
    if (activeRecord && def.readOnlyAfterCreate) def = { ...def, readOnly: true };
    if (entity === "AuthenticationProvider" && name === "method") { const methods = (metadata as any).authenticationMethods || {}; const available = Object.entries(methods).filter(([, value]: [string, any]) => Boolean(value?.provider?.isAvailable)).map(([method]) => method); const currentMethod = String(values.method || ""); def = { ...def, options: [...new Set([...available, ...(currentMethod && !available.includes(currentMethod) ? [currentMethod] : [])])] }; }
    if (entity === "KnowledgeBaseArticle" && name === "language") { const languages = Array.isArray(metadata.app?.language?.list) ? metadata.app.language.list.map(String) : []; const currentLanguage = String(values.language || ""); def = { ...def, options: [...new Set([...languages, ...(currentLanguage && !languages.includes(currentLanguage) ? [currentLanguage] : [])])] }; }
    if (entity === "Contact" && name === "title") {
      const roles = ((metadata.entityDefs?.Account?.fields?.contactRole as any)?.options || []).map(String);
      const currentRole = String(values.title || "");
      def = { ...def, type: "enum", optionsReference: "Account.contactRole", translation: "Account.options.contactRole", options: [...new Set([...roles, ...(currentRole && !roles.includes(currentRole) ? [currentRole] : [])])] };
    }
    if (entity === "InboundEmail") {
      const roundRobin = values.createCase && ["Round-Robin", "Least-Busy"].includes(String(values.caseDistribution || ""));
      const directAssignment = values.createCase && values.caseDistribution === "Direct-Assignment";
      if (!inboundEmailFieldVisible(name, values)) return null;
      if (activeRecord && name === "fetchSince" && Boolean(values.fetchData?.lastUID)) def = { ...def, readOnly: true };
      if (name === "targetUserPosition") def = { ...def, options: ["", ...targetUserPositionOptions] };
      const required = (values.status === "Active" && values.useImap && ["username", "port", "host", "monitoredFolders"].includes(name)) || (values.useSmtp && ["smtpHost", "smtpPort"].includes(name)) || (values.useSmtp && values.smtpAuth && name === "smtpUsername") || (roundRobin && name === "team") || (directAssignment && name === "assignToUser");
      if (required || (["username", "port", "host", "monitoredFolders", "smtpHost", "smtpPort", "smtpUsername", "team", "assignToUser"].includes(name) && !required)) def = { ...def, required };
    }
    if (entity === "EmailAccount") {
      if (activeRecord && name === "fetchSince" && Boolean(values.fetchData?.lastUID)) def = { ...def, readOnly: true };
      const accountUserType = String(getSession()?.user.type || "");
      if (name === "assignedUser" && accountUserType !== "admin" && accountUserType !== "super-admin") def = { ...def, readOnly: true };
      const required = (values.status === "Active" && values.useImap && ["username", "port", "host", "monitoredFolders"].includes(name)) || (values.useSmtp && ["smtpHost", "smtpPort"].includes(name)) || (values.useSmtp && values.smtpAuth && name === "smtpUsername");
      if (required || ["username", "port", "host", "monitoredFolders", "smtpHost", "smtpPort", "smtpUsername"].includes(name)) def = { ...def, required };
    }
    if (entity === "Template" && name === "entityType" && activeRecord) def = { ...def, readOnly: true };
    if (entity === "EmailFilter") {
      if (name === "parent" && values.isGlobal) return null;
      if (name === "emailFolder" && values.action !== "Move to Folder") return null;
      if (name === "groupEmailFolder" && values.action !== "Move to Group Folder") return null;
      if (name === "action") def = { ...def, options: [...new Set([...emailFilterActions, ...(emailFilterActions.includes(String(values.action)) ? [] : [String(values.action)])])] };
    }
    if (entity === "Webhook" && name === "event") return <WebhookEventField key={name} metadata={metadata} value={String(values.event || "")} required={Boolean(def.required)} disabled={Boolean(def.readOnly || def.disabled)} onChange={(value) => updateFieldValue(name, value)}/>;
    if (entity === "MassEmail" && name === "smtpAccount") return <MassEmailSmtpAccountField key={name} metadata={metadata} def={def} values={values} onChange={(patch) => setValues((old) => ({ ...old, ...patch }))}/>;
    if (entity === "MassEmail" && name === "emailTemplate") return <div className="mass-email-template-field" key={name}><FieldInput entity={entity} metadata={metadata} name={name} def={def} value={values[name]} onChange={(value) => updateFieldValue(name, value)} timeZone={dateTimeZone} onError={setError}/><button type="button" className="button subtle" onClick={() => setOneOffTemplateOpen(true)}><Plus size={14}/> Vytvořit jednorázovou šablonu</button></div>;
    if (entity === "Meeting" && name === "dateStart") {
      const inputName = values.isAllDay ? "dateStartDate" : "dateStart";
      return <div className="meeting-date-start" key={name}><label className="meeting-all-day-toggle"><input type="checkbox" checked={Boolean(values.isAllDay)} disabled={Boolean(def.readOnly || def.disabled)} onChange={(event) => updateFieldValue("isAllDay", event.target.checked)}/><span>Celodenní událost</span></label><FieldInput entity={entity} metadata={metadata} name={name} def={{ ...def, type: values.isAllDay ? "date" : "datetimeOptional" }} value={values[inputName] || ""} onChange={(value) => updateFieldValue(inputName, value)} timeZone={dateTimeZone} onError={setError}/></div>;
    }
    if (entity === "Meeting" && name === "dateEnd") {
      const inputName = values.isAllDay ? "dateEndDate" : "dateEnd";
      return <FieldInput key={name} entity={entity} metadata={metadata} name={name} def={{ ...def, type: values.isAllDay ? "date" : "datetimeOptional" }} value={values[inputName] || ""} onChange={(value) => updateFieldValue(inputName, value)} timeZone={dateTimeZone} onError={setError}/>;
    }
    if (entity === "WorkingTimeRange" && name === "dateEnd") return <FieldInput key={name} entity={entity} metadata={metadata} name={name} def={{ ...def, min: values.dateStart || undefined }} value={values[name]} onChange={(value) => updateFieldValue(name, value)}/>;
    if (entity === "ScheduledJob" && name === "job") return <ScheduledJobJobField key={name} metadata={metadata} value={values.job || ""} disabled={Boolean(def.readOnly || def.disabled)} onChange={(job, defaults) => setValues((old) => ({ ...old, job, ...(activeRecord ? {} : defaults) }))}/>;
    if (entity === "ScheduledJob" && name === "scheduling") return <ScheduledJobCronField key={name} value={values.scheduling || ""} required={Boolean(def.required)} disabled={Boolean(def.readOnly || def.disabled)} onChange={(scheduling) => updateFieldValue(name, scheduling)}/>;
    if (def.type === "duration") return <DurationFieldInput key={name} label={fieldLabel(name, def, entity, metadata)} value={Number(values[name]) || Number(def.default) || 0} def={def} disabled={Boolean(def.readOnly || def.disabled)} onChange={(seconds) => updateFieldValue(name, seconds)}/>;
    if (["InboundEmail", "EmailAccount"].includes(entity) && name === "monitoredFolders") return <MailFolderField key={name} entity={entity as "InboundEmail" | "EmailAccount"} label={fieldLabel(name, def, entity, metadata)} multiple value={values[name] || []} values={values} recordId={activeRecord?.id} onChange={(value) => updateFieldValue(name, value)}/>;
    if (["InboundEmail", "EmailAccount"].includes(entity) && name === "sentFolder") return <MailFolderField key={name} entity={entity as "InboundEmail" | "EmailAccount"} label={fieldLabel(name, def, entity, metadata)} value={values[name] || ""} values={values} recordId={activeRecord?.id} onChange={(value) => updateFieldValue(name, value)}/>;
    if (entity === "EmailAccount" && name === "emailFolder") return <FieldInput key={name} entity={entity} metadata={metadata} name={name} def={{ ...def, createDisabled: true, autocompleteDisabled: true }} value={values[name]} relatedContext={values} onChange={(value) => updateFieldValue(name, value)} timeZone={dateTimeZone} onError={setError}/>;
    if (entity === "User" && name === "teams") return <TeamMembershipField key={name} metadata={metadata} ids={values.teams || []} columns={values.teamsColumns || {}} onChange={(ids, columns) => setValues((old) => ({ ...old, teams: ids, teamsColumns: columns }))}/>;
    if (entity === "User" && name === "sendAccessInfo" && (!values.password || !values.emailAddress || (values.type === "portal" && !values.portals?.length))) return null;
    if (["email", "phone"].includes(def.type || "")) {
      const email = def.type === "email";
      const rows: Row[] = Array.isArray(values[`${name}Data`]) && values[`${name}Data`].length
        ? values[`${name}Data`]
        : values[name] ? [{ [email ? "emailAddress" : "phoneNumber"]: values[name], primary: true, optOut: Boolean(values[`${name}IsOptedOut`]), invalid: Boolean(values[`${name}IsInvalid`]), ...(email ? { lower: String(values[name]).toLowerCase() } : { type: def.defaultType || "Other" }) }] : [];
      const optionDef = metadata.entityDefs?.[email ? "EmailAddress" : "PhoneNumber"]?.fields?.type;
      const maxCount = Number(def.maxCount || metadata.appParams?.[email ? "emailAddressMaxCount" : "phoneNumberMaxCount"] || 0);
      const itemMaxLength = Number(metadata.entityDefs?.[email ? "EmailAddress" : "PhoneNumber"]?.fields?.name?.maxLength || 255);
      return <MultipleContactField key={name} label={fieldLabel(name, def, entity, metadata)} email={email} rows={rows} options={(optionDef?.options || []).map(String).filter((option) => option !== "")} phonePattern={getPhoneValidationPattern(metadata)} disabled={Boolean(def.readOnly || def.disabled)} required={Boolean(def.required)} onlyPrimary={Boolean(def.onlyPrimary)} maxCount={maxCount} maxLength={itemMaxLength} defaultOptOut={Boolean(metadata.appParams?.[email ? "emailAddressIsOptedOutByDefault" : "phoneNumberIsOptedOutByDefault"])} onChange={(nextRows) => setValues((old) => {
        const key = email ? "emailAddress" : "phoneNumber";
        const normalized = nextRows.map((item: Row) => ({ ...item, [key]: String(item[key] || "").trim(), ...(email ? { lower: String(item[key] || "").trim().toLowerCase() } : {}) })).filter((item: Row) => item[key]);
        let primaryIndex = normalized.findIndex((item: Row) => item.primary);
        if (primaryIndex < 0 && normalized.length) primaryIndex = 0;
        const ordered: Row[] = normalized.map((item: Row, index: number) => ({ ...item, primary: index === primaryIndex }));
        if (primaryIndex > 0) { const [primary] = ordered.splice(primaryIndex, 1); ordered.unshift(primary); }
        const primary = ordered[0];
        return { ...old, [name]: primary?.[key] || "", [`${name}Data`]: ordered, [`${name}IsOptedOut`]: primary ? Boolean(primary.optOut) : null, [`${name}IsInvalid`]: primary ? Boolean(primary.invalid) : null };
      })}/>;
    }
    if (entity === "User" && name === "password") {
      const password = String(values.password || "");
      const strength = passwordStrengthParams || {};
      const hasPasswordRules = Object.values(strength).some(Boolean);
      const passwordRuleCandidates: Array<readonly [boolean, string] | null> = [
        Number(strength.passwordStrengthLength) > 0 ? [password.length >= Number(strength.passwordStrengthLength), `Nejméně ${strength.passwordStrengthLength} znaků`] as const : null,
        Number(strength.passwordStrengthLetterCount) > 0 ? [(password.match(/[a-z]/gi) || []).length >= Number(strength.passwordStrengthLetterCount), `Nejméně ${strength.passwordStrengthLetterCount} písmena`] as const : null,
        Number(strength.passwordStrengthNumberCount) > 0 ? [(password.match(/[0-9]/g) || []).length >= Number(strength.passwordStrengthNumberCount), `Nejméně ${strength.passwordStrengthNumberCount} číslice`] as const : null,
        strength.passwordStrengthBothCases ? [/[a-z]/.test(password) && /[A-Z]/.test(password), "Malé i velké písmeno"] as const : null,
        Number(strength.passwordStrengthSpecialCharacterCount) > 0 ? [[...password].filter((char) => "'-!\"#$%&()*,./:;?@[]^_`{|}~+<=>".includes(char)).length >= Number(strength.passwordStrengthSpecialCharacterCount), `Nejméně ${strength.passwordStrengthSpecialCharacterCount} speciální znak`] as const : null,
      ];
      const passwordRules = passwordRuleCandidates.filter((rule): rule is readonly [boolean, string] => rule !== null);
      return <div className="user-password-control" key={name}><div className="user-password-input"><FieldInput entity={entity} metadata={metadata} name={name} def={def} value={password} onChange={(value) => updateFieldValue(name, value)}/><button type="button" className="button subtle" disabled={!passwordStrengthParams} onClick={() => { const generated = generateUserPassword(passwordStrengthParams || {}); setValues((old) => ({ ...old, password: generated, passwordConfirm: generated, passwordPreview: generated, sendAccessInfo: old.emailAddress && (old.type !== "portal" || old.portals?.length) ? true : false })); }}><WandSparkles size={14}/> {passwordStrengthParams ? "Vygenerovat heslo" : "Načítám pravidla…"}</button></div>{hasPasswordRules && <ul className="user-password-rules" aria-label="Požadavky na heslo">{passwordRules.map(([passed, label]) => <li className={passed ? "ok" : ""} key={label}><span aria-hidden="true">{passed ? "✓" : "○"}</span>{label}</li>)}</ul>}{values.passwordPreview && <label className="field-input user-password-preview"><span>Vygenerované heslo</span><input readOnly value={values.passwordPreview}/></label>}</div>;
    }
    if (entity === "LayoutSet" && name === "layoutList") return <LayoutSetLayoutsField key={name} metadata={metadata} selected={values.layoutList || []} onChange={(selected) => updateFieldValue(name, selected)}/>;
    if (name === "reminders" && ["Meeting", "Call", "Task"].includes(entity)) return <ReminderEditor key={name} metadata={metadata} value={values.reminders || []} deadline={entity === "Task" ? values.dateEndDate || values.dateEnd : undefined} dateOnly={entity === "Task" && Boolean(values.dateEndDate)} timeZone={dateTimeZone} onChange={(value) => setValues((old) => ({ ...old, reminders: value }))}/>;
    const weekdayIndex = name.match(/^weekday([0-6])TimeRanges$/)?.[1];
    if (["WorkingTimeCalendar", "WorkingTimeRange"].includes(entity) && (name === "timeRanges" || weekdayIndex != null)) return <TimeRangesEditor key={name} label={fieldLabel(name, def, entity, metadata)} value={values[name] || []} disabled={Boolean(def.readOnly || def.disabled || (weekdayIndex != null && !values[`weekday${weekdayIndex}`]))} required={Boolean(def.required)} onChange={(value) => updateFieldValue(name, value)}/>;
    const primaryLink = primaryLinkForField(entity, name, def);
    return <FieldInput key={name} entity={entity} metadata={metadata} name={name} def={def} value={values[name]} themeParamsValue={values.themeParams} onThemeParamsChange={(themeParams) => setValues((old) => ({ ...old, themeParams }))} currencyValue={values[`${name}Currency`]} onCurrencyChange={(currency) => updateFieldValue(`${name}Currency`, currency)} columns={values[`${name}Columns`] || {}} primaryId={primaryLink ? values[`${primaryLink}Id`] : undefined} onPrimaryChange={primaryLink ? (id, label) => setValues((old) => ({ ...old, [`${primaryLink}Id`]: id, [`${primaryLink}Name`]: label || "" })) : undefined} relatedContext={values} onColumnsChange={def.type === "linkMultiple" && def.columns ? (columns) => setValues((old) => ({ ...old, [`${name}Columns`]: columns })) : undefined} onChange={(value) => updateFieldValue(name, value)} timeZone={dateTimeZone} onUploading={setUploading} onUploaded={(id) => setUploadedIds((old) => [...old, id])} onError={setError}/>;
  };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && void cancel()}><form ref={formRef} className="record-modal" onSubmit={submit}>
    <div className="modal-heading"><div><span className="eyebrow">{activeRecord ? "UPRAVIT" : duplicate ? "KOPIE ZÁZNAMU" : "NOVÝ ZÁZNAM"} · {entityLabel(metadata, entity, true).toUpperCase()}</span><h2>{activeRecord ? "Upravit záznam" : duplicate ? `Duplikovat ${entityLabel(metadata, entity).toLowerCase()}` : `Vytvořit ${entityLabel(metadata, entity).toLowerCase()}`}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={17}/></button></div>
    {entity === "EmailFilter" && <div className="email-filter-guidance"><strong>Jak pravidla vyhodnocovat</strong><span>Adresy a předmět podporují zástupný znak <code>*</code>. „Obsahuje některý“ projde při shodě alespoň jedné fráze; „Obsahuje všechny“ vyžaduje shodu všech zadaných frází.</span><small>Akce a cílová složka se řídí typem účtu, ke kterému je filtr přiřazen.</small></div>}
    <div className="record-editor-groups">{groups.filter((group) => group.names.some(editorFieldVisible)).map((group) => <section className="record-editor-group" key={group.title}><h3>{group.title}</h3><div className="modal-fields">{group.names.map(renderField)}</div></section>)}</div>
    {entity === "Template" && values.entityType && <TemplatePlaceholderPicker metadata={metadata} entityType={String(values.entityType)} onInsert={(target, code) => setValues((old) => ({ ...old, [target]: `${String(old[target] || "")}${old[target] ? " " : ""}${code}` }))}/>}
    {entity === "Meeting" && (metadata.clientDefs?.Meeting?.bottomPanels?.edit || []).some((panel: any) => panel.name === "scheduler") && <MeetingScheduler metadata={metadata} userIds={values.users || []} userNames={values.usersNames} assignedUserId={values.assignedUserId} assignedUserName={values.assignedUserName} dateStart={values.isAllDay ? values.dateStartDate : values.dateStart} dateEnd={values.isAllDay ? values.dateEndDate : values.dateEnd} allDay={Boolean(values.isAllDay)} entityId={activeRecord?.id}/>}
    {(entity === "Role" || entity === "PortalRole") && <RoleAclEditor metadata={metadata} type={entity === "PortalRole" ? "aclPortal" : "acl"} data={values.data || {}} fieldData={values.fieldData || {}} onChange={(data, fieldData) => setValues((old) => ({ ...old, data, fieldData }))}/>}
    {!["EmailAccount", "InboundEmail"].includes(entity) || mailActionNames.has("testConnection") && mailActionNames.has("smtpTestSend") ? null : <div className="email-test-bar"><span>Ověřte nastavení připojení před uložením účtu.</span><div><button type="button" className="button subtle" onClick={() => void testMailConnection()} disabled={connectionTestBusy || !values.host}>{connectionTestBusy ? "Testuji připojení…" : "Testovat připojení"}<Network size={14}/></button><button type="button" className="button subtle" onClick={() => { setTestEmailTo(String((getSession()?.user as User & { emailAddress?: string } | undefined)?.emailAddress || "")); setTestEmailError(""); setTestEmailOpen(true); }} disabled={testEmailBusy || !values.smtpHost || !values.emailAddress || (entity === "InboundEmail" && !values.useSmtp)}>{testEmailBusy ? "Odesílám…" : "Odeslat testovací e-mail"}<Mail size={14}/></button></div></div>}
    {connectionTestNotice && <div className="save-confirm"><Check size={15}/>{connectionTestNotice}</div>}
    {testEmailNotice && <div className="save-confirm"><Check size={15}/>{testEmailNotice}</div>}
    {saveNotice && <div className="save-confirm" role="status"><Check size={15}/>{saveNotice}</div>}
    {error && <div className="inline-error">{error}</div>}
    <div className="modal-footer"><button type="button" className="button subtle" onClick={() => void cancel()} disabled={busy}>Zrušit</button><button type="button" className="button subtle" disabled={busy || uploading} onClick={() => { saveAndContinueRequested.current = true; formRef.current?.requestSubmit(); }}>{uploading ? "Nahrávám soubor…" : "Uložit a pokračovat"}</button><button className="button primary" disabled={busy || uploading}>{uploading ? "Nahrávám soubor…" : busy ? "Ukládám…" : activeRecord ? "Uložit změny" : "Vytvořit záznam"}</button></div>
  </form>{oneOffTemplateOpen && <RecordEditor entity="EmailTemplate" fields={getFormFields(metadata, "EmailTemplate")} metadata={metadata} initialValues={{ oneOff: true }} onClose={() => setOneOffTemplateOpen(false)} onSaved={(created) => { setValues((old) => ({ ...old, emailTemplate: created.id, emailTemplateName: created.name })); setOneOffTemplateOpen(false); }}/ >}{duplicateCheck && <DuplicateCheckDialog entity={entity} duplicates={duplicateCheck.rows} metadata={metadata} busy={busy} onCreate={() => void createDespiteDuplicate()} onCancel={() => setDuplicateCheck(null)}/ >}{saveConflict && <SaveConflictDialog fields={saveConflict.fields} onApply={applySaveConflict} onCancel={() => setSaveConflict(null)}/ >}{testEmailOpen && <div className="modal-backdrop test-email-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !testEmailBusy && setTestEmailOpen(false)}><section className="record-modal test-email-dialog" role="dialog" aria-modal="true" aria-labelledby="test-email-title"><div className="modal-heading"><div><span className="eyebrow">SMTP · {values.smtpHost}</span><h2 id="test-email-title">Odeslat testovací e-mail</h2><p>Zkontrolujte přihlašovací údaje SMTP odesláním skutečné zprávy.</p></div><button type="button" className="icon-button" onClick={() => setTestEmailOpen(false)} disabled={testEmailBusy} aria-label="Zavřít"><X size={16}/></button></div><label className="field-input"><span>Odeslat na</span><input type="email" required autoFocus value={testEmailTo} onChange={(event) => setTestEmailTo(event.target.value)} placeholder="vas@email.cz"/></label>{testEmailError && <div className="inline-error test-email-error">{testEmailError}</div>}<div className="modal-footer"><button type="button" className="button subtle" onClick={() => setTestEmailOpen(false)} disabled={testEmailBusy}>Zrušit</button><button type="button" className="button primary" onClick={() => void sendTestEmail()} disabled={testEmailBusy || !testEmailTo.trim()}>{testEmailBusy ? "Odesílám…" : <><Send size={14}/> Odeslat testovací e-mail</>}</button></div></section></div>}</div>;
}

function CampaignLogDataView({ record, onOpenRecord }: { record: Row; onOpenRecord: (entity: string, row: Row) => void }) {
  const action = String(record.action || "");
  const targetText = record.objectName || record.stringData || "";
  if (["Sent", "Opened", "Clicked"].includes(action)) {
    return record.objectId && record.objectType && record.objectName
      ? <button type="button" className="campaign-log-target" onClick={() => onOpenRecord(String(record.objectType), { id: String(record.objectId), name: String(record.objectName) })}>{String(record.objectName)}</button>
      : <strong>{targetText || "—"}</strong>;
  }
  if (action === "Opted Out") return <strong className="campaign-log-opt-out">{String(record.stringData || "—")}</strong>;
  if (action === "Bounced") {
    const hard = record.stringAdditionalData === "Hard";
    return <span className="campaign-log-bounce"><small className={hard ? "hard" : "soft"}>{hard ? "Tvrdé odmítnutí" : "Dočasné odmítnutí"}</small><s className={hard ? "hard" : ""}>{String(record.stringData || "—")}</s></span>;
  }
  return <strong>{String(record.stringData || targetText || "—")}</strong>;
}

function CampaignStatsPanel({ record, metadata }: { record: Row; metadata: Metadata }) {
  const fieldNamesByType: Record<string, string[]> = {
    Email: ["sentCount", "openedCount", "clickedCount", "optedOutCount", "bouncedCount", "leadCreatedCount", "optedInCount", "revenue"],
    Newsletter: ["sentCount", "openedCount", "clickedCount", "optedOutCount", "bouncedCount", "leadCreatedCount", "optedInCount", "revenue"],
    "Informational Email": ["sentCount", "bouncedCount"],
    Web: ["leadCreatedCount", "optedInCount", "revenue"],
    Television: ["leadCreatedCount", "revenue"],
    Radio: ["leadCreatedCount", "revenue"],
    Mail: ["sentCount", "leadCreatedCount", "optedInCount", "revenue"],
  };
  let fieldNames = [...(fieldNamesByType[record.type] || ["leadCreatedCount", "revenue"])];
  if (!metadata.appSettings?.massEmailOpenTracking) fieldNames = fieldNames.filter((name) => name !== "openedCount");
  if (!canAccessEntity(metadata, "Lead")) fieldNames = fieldNames.filter((name) => name !== "leadCreatedCount");
  if (!canAccessEntity(metadata, "Opportunity")) fieldNames = fieldNames.filter((name) => name !== "revenue");
  const fields = metadata.entityDefs?.Campaign?.fields || {};
  const permissions = metadata.userAcl?.fieldTable?.Campaign || {};
  const visible = fieldNames.filter((name) => fields[name] && permissions[name]?.read !== "no");
  if (!visible.length) return null;
  return <section className="campaign-stats-panel"><div className="drawer-section-title">VÝSLEDKY KAMPANĚ</div><div className="campaign-stats-grid">{visible.map((name) => {
    const raw = record[name];
    const value = name === "revenue"
      ? formatCurrency(raw ?? 0, record.revenueCurrency || metadata.appSettings?.defaultCurrency, metadata)
      : new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Number(raw) || 0);
    const iconClass: Record<string, string> = { sentCount: "fas fa-paper-plane", openedCount: "fas fa-envelope-open", clickedCount: "fas fa-arrow-pointer", optedOutCount: "fas fa-ban", bouncedCount: "fas fa-envelope-open-text", leadCreatedCount: "fas fa-user-plus", optedInCount: "fas fa-user-check", revenue: "fas fa-coins" };
    return <div className="campaign-stat" key={name}><span className="campaign-stat-icon"><EspoIcon className={iconClass[name] || "fas fa-chart-column"} size={14}/></span><div><small>{fieldLabel(name, fields[name], "Campaign", metadata)}</small><strong>{value}</strong></div></div>;
  })}</div></section>;
}

function EmailEventPanel({ record, metadata, onCreate, onOpenRecord }: { record: Row; metadata: Metadata; onCreate: () => void; onOpenRecord: (entity: string, row: Row) => void }) {
  const configured = (metadata.clientDefs?.Email?.sidePanels?.detail || []).some((item: any) => item?.name === "event");
  if (!configured) return null;
  const eventData = record.icsEventData || {};
  const created = eventData.createdEvent;
  const eventId = record.createdEventId || created?.id;
  const eventType = record.createdEventType || created?.entityType || "Meeting";
  const eventName = record.createdEventName || created?.name;
  if (!record.icsEventData && !eventId) return null;
  const canCreate = Boolean(eventData.valueMap) && !eventId && canCreateEntity(metadata, "Meeting");
  return <section className="detail-panel native-info-panel email-event-panel"><div className="drawer-section-title">POZVÁNKA V KALENDÁŘI</div>{record.icsEventDateStart && <div className="email-event-date"><CalendarDays size={14}/><span><small>Začátek události</small><strong>{formatDate(record.icsEventDateStart)}</strong></span></div>}{eventId ? <button type="button" className="relationship-open email-created-event" onClick={() => onOpenRecord(eventType, { id: eventId, name: eventName || "Schůzka" })}><span><small>Vytvořená událost</small><strong>{eventName || "Otevřít událost"}</strong></span><ArrowRight size={14}/></button> : canCreate ? <><p>V e-mailu je kalendářová pozvánka. Založte z ní schůzku v CRM.</p><button type="button" className="button primary" onClick={onCreate}><Plus size={14}/> Vytvořit schůzku</button></> : null}</section>;
}

function EmailTemplatePlaceholdersPanel({ metadata }: { metadata: Metadata }) {
  const configured = (metadata.app?.emailTemplate?.placeholders || {}) as Record<string, { order?: number }>;
  const extra = (metadata.clientDefs?.EmailTemplate?.placeholderList || []) as string[];
  const descriptions = (metadata.labels as any)?.EmailTemplate?.placeholderTexts || {};
  const placeholders = [...new Set([
    ...Object.keys(configured).sort((a, b) => (configured[a]?.order || 0) - (configured[b]?.order || 0)),
    ...extra,
  ])];
  if (!placeholders.length) return null;
  return <section className="detail-panel native-info-panel email-template-placeholders"><div className="drawer-section-title">DOSTUPNÉ PLACEHOLDERY</div><p>Tyto hodnoty lze vložit do předmětu a obsahu e-mailové šablony.</p><div className="placeholder-reference-list">{placeholders.map((name) => <div key={name}><code>{`{${name}}`}</code><span>{descriptions[name] || name}</span></div>)}</div></section>;
}

function LeadCaptureInfoPanel({ record }: { record: Row }) {
  const fields = ["exampleRequestUrl", "exampleRequestMethod", "exampleRequestHeaders", "exampleRequestPayload"];
  const values = fields.map((name) => [name, record[name]] as const).filter(([, value]) => value !== undefined && value !== null && value !== "");
  const formUrl = record.formId ? `${window.location.origin}${appPublicPath(`lead-capture/${encodeURIComponent(record.formId)}`)}` : "";
  if (!values.length && !formUrl) return null;
  return <section className="detail-panel native-info-panel lead-capture-info"><div className="drawer-section-title">INTEGRACE FORMULÁŘE</div>{formUrl && <a className="lead-capture-form-url" href={formUrl} target="_blank" rel="noreferrer">{formUrl}<ExternalLink size={13}/></a>}{values.length > 0 && <div className="lead-capture-request-example">{values.map(([name, value]) => <div key={name}><small>{name}</small><pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></div>)}</div>}</section>;
}

function LeadConversionResultPanel({ record, metadata, onOpenRecord }: { record: Row; metadata: Metadata; onOpenRecord: (entity: string, row: Row) => void }) {
  const links: Array<{ field: string; entity: string }> = [
    { field: "createdAccount", entity: "Account" },
    { field: "createdContact", entity: "Contact" },
    { field: "createdOpportunity", entity: "Opportunity" },
  ];
  const entries = links.filter(({ field, entity }) => record[`${field}Id`] && canAccessEntity(metadata, entity));
  if (!entries.length) return null;
  return <section className="detail-panel lead-conversion-result"><div className="drawer-section-title">{(metadata.labels as any)?.Lead?.labels?.ConvertedTo || (metadata.labels as any)?.Lead?.labels?.["Converted To"] || "PŘEVEDENO NA"}</div><div className="lead-conversion-result-list">{entries.map(({ field, entity }) => {
    const name = record[`${field}Name`] || record[`${field}Id`];
    return <button type="button" className="relationship-open" key={field} onClick={() => onOpenRecord(entity, { id: record[`${field}Id`], name })}><span className="relationship-row-icon"><EspoIcon className={metadata.clientDefs?.[entity]?.iconClass || entityIcons[entity] || "fas fa-cube"} size={14}/></span><span><small>{entityLabel(metadata, entity)}</small><strong>{name}</strong></span><ArrowRight size={14}/></button>;
  })}</div></section>;
}

function WebhookEventField({ metadata, value, required, disabled, onChange }: { metadata: Metadata; value: string; required: boolean; disabled: boolean; onChange: (value: string) => void }) {
  const scopeList = Object.keys(metadata.scopes || {}).filter((scope) => metadata.scopes[scope].object && !metadata.scopes[scope].disabled).sort((a, b) => a.localeCompare(b));
  const [scope, action] = value.split(".");
  const scopeOptions = scope && !scopeList.includes(scope) ? [...scopeList, scope].sort() : scopeList;
  const actionOptions = ["create", "update", "delete"];
  return <label className={`field-input ${required ? "required" : ""}`}><span>Událost webhooku{required && <i> *</i>}</span><div className="link-parent-controls"><select disabled={disabled} required={required} value={scope || ""} onChange={(event) => onChange(event.target.value ? `${event.target.value}.${actionOptions.includes(action) ? action : "create"}` : "")}><option value="">Vyberte entitu…</option>{scopeOptions.map((item) => <option key={item} value={item}>{entityLabel(metadata, item, true)}</option>)}</select><select disabled={disabled || !scope} value={actionOptions.includes(action) ? action : "create"} onChange={(event) => onChange(scope ? `${scope}.${event.target.value}` : "")}><option value="create">Po vytvoření</option><option value="update">Po úpravě</option><option value="delete">Po smazání</option></select></div><small className="field-hint">Webhook se spustí při vybrané změně záznamu.</small></label>;
}

function TemplatePlaceholderPicker({ metadata, entityType, onInsert }: { metadata: Metadata; entityType: string; onInsert: (target: string, code: string) => void }) {
  const [target, setTarget] = useState("body");
  const [attribute, setAttribute] = useState("");
  const defs = metadata.entityDefs?.[entityType]?.fields || {};
  const fieldAllowed = (scope: string, name: string, def: FieldDef) => {
    const acl = metadata.userAcl?.fieldTable?.[scope]?.[name];
    return !def.disabled && !def.utility && !def.notStorable && !def.directAccessDisabled && !def.templatePlaceholderDisabled && acl?.read !== "no" && !["map", "foreign"].includes(def.type || "");
  };
  const options: Array<{ value: string; label: string; text: boolean }> = [];
  for (const [name, def] of Object.entries(defs)) {
    if (!fieldAllowed(entityType, name, def)) continue;
    options.push({ value: name, label: fieldLabel(name, def, entityType, metadata), text: ["text", "wysiwyg"].includes(def.type || "") });
    if (def.type === "personName") options.push({ value: "name", label: "Jméno", text: false });
  }
  for (const [link, linkDef] of Object.entries(metadata.entityDefs?.[entityType]?.links || {})) {
    if (linkDef.type !== "belongsTo" || !linkDef.entity) continue;
    const relationFields = metadata.entityDefs?.[linkDef.entity]?.fields || {};
    for (const [name, def] of Object.entries(relationFields)) {
      if (!fieldAllowed(linkDef.entity, name, def)) continue;
      options.push({ value: `${link}.${name}`, label: `${fieldLabel(link, undefined, entityType, metadata)} · ${fieldLabel(name, def, linkDef.entity, metadata)}`, text: ["text", "wysiwyg"].includes(def.type || "") });
    }
  }
  options.push({ value: "id", label: "ID záznamu", text: false }, { value: "today", label: "Dnešní datum", text: false }, { value: "now", label: "Aktuální datum a čas", text: false });
  const insert = () => {
    const item = options.find((option) => option.value === attribute);
    if (!item) return;
    onInsert(target, item.text ? `{{{${item.value}}}}` : `{{${item.value}}}`);
    setAttribute("");
  };
  return <section className="record-editor-group template-placeholder-picker"><h3>Proměnné šablony · {entityLabel(metadata, entityType)}</h3><p>Vložte do obsahu pole dynamickou hodnotu záznamu. Textová pole používají bezpečné HTML proměnné.</p><div className="template-placeholder-controls"><label className="field-input"><span>Vložit do pole</span><select value={target} onChange={(event) => setTarget(event.target.value)}>{["header", "body", "footer"].map((name) => <option key={name} value={name}>{fieldLabel(name, metadata.entityDefs?.Template?.fields?.[name], "Template", metadata)}</option>)}</select></label><label className="field-input"><span>Proměnná</span><select value={attribute} onChange={(event) => setAttribute(event.target.value)}><option value="">Vyberte proměnnou…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label} · {`{{${option.value}}}`}</option>)}</select></label><button type="button" className="button subtle" disabled={!attribute} onClick={insert}>Vložit proměnnou</button></div></section>;
}

function LeadCaptureFieldConfigurator({ metadata, selected, params, onChange }: { metadata: Metadata; selected: string[]; params: Row; onChange: (selected: string[], params: Row) => void }) {
  const leadDefs = metadata.entityDefs?.Lead?.fields || {};
  const captureDef = metadata.entityDefs?.LeadCapture?.fields?.fieldList || {};
  const ignored = new Set<string>((captureDef as any).ignoreFieldList || []);
  const allowedTypes = new Set<string>((captureDef as any).webFormFieldTypeList || []);
  const candidates = Object.entries(leadDefs).filter(([name, def]) => !ignored.has(name) && !def.disabled && !def.utility && !def.readOnly && !name.endsWith("Id") && !name.endsWith("Data"));
  const chosen = [...new Set((Array.isArray(selected) ? selected : []).filter((name) => candidates.some(([field]) => field === name)))];
  const labelFor = (name: string, def: FieldDef) => fieldLabel(name, def, "Lead", metadata);
  function choose(name: string) {
    const next = chosen.includes(name) ? chosen.filter((item) => item !== name) : [...chosen, name];
    const nextParams = Object.fromEntries(next.map((item) => [item, params[item] || {}]));
    onChange(next, nextParams);
  }
  function move(name: string, delta: number) {
    const index = chosen.indexOf(name); const target = index + delta;
    if (index < 0 || target < 0 || target >= chosen.length) return;
    const next = [...chosen]; [next[index], next[target]] = [next[target], next[index]]; onChange(next, params);
  }
  function toggleRequired(name: string, required: boolean) {
    onChange(chosen, { ...params, [name]: { ...(params[name] || {}), required } });
  }
  return <div className="field-input lead-capture-fields"><span><span>Pole formuláře</span><i> · {chosen.length} vybráno</i></span><p>Pořadí zde určuje pořadí polí ve veřejném formuláři. U každého pole lze nastavit povinnost.</p><div className="lead-capture-field-list">{chosen.map((name, index) => {
    const def = leadDefs[name]; const supported = allowedTypes.has(def?.type || "");
    return <div className={`lead-capture-field-row ${supported ? "" : "unsupported"}`} key={name}><span className="lead-capture-field-order">{index + 1}</span><span className="lead-capture-field-name"><strong>{labelFor(name, def)}</strong><small>{supported ? (def.type || "pole") : `Typ ${def.type || "pole"} veřejný formulář nepodporuje`}</small></span><label className="lead-capture-required"><input type="checkbox" checked={Boolean(params[name]?.required)} onChange={(event) => toggleRequired(name, event.target.checked)}/> Povinné</label><button type="button" className="icon-button" onClick={() => move(name, -1)} disabled={!index} aria-label={`Posunout ${labelFor(name, def)} výš`}><ArrowUp size={14}/></button><button type="button" className="icon-button" onClick={() => move(name, 1)} disabled={index === chosen.length - 1} aria-label={`Posunout ${labelFor(name, def)} níž`}><ArrowDown size={14}/></button><button type="button" className="icon-button danger-ghost" onClick={() => choose(name)} aria-label={`Odebrat ${labelFor(name, def)}`}><X size={14}/></button></div>;
  })}{!chosen.length && <div className="lead-capture-empty">Přidejte pole z nabídky níže.</div>}</div><label className="field-input lead-capture-add"><span>Přidat pole</span><select value="" onChange={(event) => event.target.value && choose(event.target.value)}><option value="">Vyberte pole zájemce…</option>{candidates.filter(([name]) => !chosen.includes(name)).map(([name, def]) => <option key={name} value={name}>{labelFor(name, def)}{allowedTypes.has(def.type || "") ? "" : " · nepodporovaný typ"}</option>)}</select></label></div>;
}
function localDateTimeInZoneTimestamp(value: string, timeZone: string): number {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return NaN;
  const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
  let result = desired;
  try {
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(result));
      const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
      result += desired - Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    }
  } catch { return NaN; }
  return result;
}

function ReminderEditor({ metadata, value, deadline, dateOnly = false, timeZone = "UTC", onChange }: { metadata: Metadata; value: Array<{ type: string; seconds: number }>; deadline?: string; dateOnly?: boolean; timeZone?: string; onChange: (value: Array<{ type: string; seconds: number }>) => void }) {
  const reminderDefs = metadata.entityDefs?.Reminder?.fields || {};
  const typeOptions = (reminderDefs.type?.options || ["Popup", "Email"]).map(String);
  const secondsOptions: number[] = (reminderDefs.seconds?.options || [0, 60, 300, 900, 1800, 3600, 86400, 604800]).map(Number);
  const deadlineTimestamp = deadline ? dateOnly ? localDateTimeInZoneTimestamp(`${String(deadline).slice(0, 10)} 23:59:00`, timeZone) : Date.parse(`${String(deadline).replace(" ", "T")}Z`) : NaN;
  const formatLead = (seconds: number) => seconds === 0 ? "V okamžiku události" : seconds % 86400 === 0 ? `${seconds / 86400} ${seconds === 86400 ? "den" : "dní"} předem` : seconds % 3600 === 0 ? `${seconds / 3600} h předem` : seconds % 60 === 0 ? `${seconds / 60} min předem` : `${seconds} s předem`;
  return <div className="field-input reminder-editor"><span>{fieldLabel("reminders", metadata.entityDefs?.Meeting?.fields?.reminders || metadata.entityDefs?.Call?.fields?.reminders || metadata.entityDefs?.Task?.fields?.reminders, "Meeting", metadata)}</span>{value.length ? <div className="reminder-list">{value.map((reminder, index) => <div className="reminder-row" key={`${index}-${reminder.type}-${reminder.seconds}`}><select aria-label="Typ připomínky" value={reminder.type || "Popup"} onChange={(event) => onChange(value.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}>{typeOptions.map((type) => <option key={type} value={type}>{type === "Popup" ? "Oznámení v CRM" : type === "Email" ? "E-mail" : type}</option>)}</select><select aria-label="Čas připomínky" value={Number(reminder.seconds || 0)} onChange={(event) => onChange(value.map((item, i) => i === index ? { ...item, seconds: Number(event.target.value) } : item))}>{secondsOptions.filter((seconds) => seconds === Number(reminder.seconds || 0) || !Number.isFinite(deadlineTimestamp) || Date.now() + seconds * 1000 < deadlineTimestamp).map((seconds) => <option key={seconds} value={seconds}>{formatLead(seconds)}</option>)}</select><button type="button" className="icon-button danger-ghost" aria-label="Odebrat připomínku" onClick={() => onChange(value.filter((_, i) => i !== index))}>×</button></div>)}</div> : <p className="reminder-empty">Bez připomínek</p>}<button type="button" className="button subtle reminder-add" onClick={() => onChange([...value, { type: String(reminderDefs.type?.default || "Popup"), seconds: Number(reminderDefs.seconds?.default || 0) }])}><Plus size={13}/> Přidat připomínku</button><small className="field-hint">Připomínky vycházejí z výchozího nastavení účtu. E-mailové doručení závisí na konfiguraci CRM.</small></div>;
}

function TeamMembershipField({ metadata, ids, columns, onChange }: { metadata: Metadata; ids: string[]; columns: Row; onChange: (ids: string[], columns: Row) => void }) {
  const [teams, setTeams] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const params = new URLSearchParams({ maxSize: "50", offset: "0", orderBy: "name", order: "asc" });
    if (query.trim()) { params.set("where[0][type]", "contains"); params.set("where[0][attribute]", "name"); params.set("where[0][value]", query.trim()); }
    setBusy(true); setError("");
    request<PageResult>(`Team?${params}`).then(async (result) => {
      const rows = result.list || [];
      const missing = ids.filter((id) => !rows.some((row) => row.id === id));
      const selectedRows = await Promise.all(missing.map((id) => request<Row>(`Team/${encodeURIComponent(id)}`).catch(() => null)));
      if (live) setTeams([...rows, ...selectedRows.filter((row): row is Row => Boolean(row))]);
    }).catch((cause) => { if (live) { setTeams([]); setError(cause instanceof Error ? cause.message : "Týmy se nepodařilo načíst."); } }).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [ids.join(","), query]);
  const selectedTeams = ids.map((id) => teams.find((team) => team.id === id) || { id, name: id });
  const available = teams.filter((team) => !ids.includes(team.id));
  const addTeam = () => { if (!selected || ids.includes(selected)) return; onChange([...ids, selected], { ...columns, [selected]: { ...(columns[selected] || {}), role: columns[selected]?.role || "" } }); setSelected(""); };
  const removeTeam = (id: string) => { const nextColumns = { ...columns }; delete nextColumns[id]; onChange(ids.filter((item) => item !== id), nextColumns); };
  const setRole = (id: string, role: string) => onChange(ids, { ...columns, [id]: { ...(columns[id] || {}), role } });
  return <div className="field-input team-membership-field"><span>{fieldLabel("teams", metadata.entityDefs?.User?.fields?.teams, "User", metadata)}</span><div className="team-membership-list">{selectedTeams.map((team) => { const positionList: string[] = team.positionList || []; const currentRole = columns[team.id]?.role || ""; const choices = currentRole && !positionList.includes(currentRole) ? [...positionList, currentRole] : positionList; return <div className="team-membership-row" key={team.id}><strong>{team.name}</strong>{choices.length ? <select aria-label={`Role v týmu ${team.name}`} value={currentRole} onChange={(event) => setRole(team.id, event.target.value)}><option value="">Bez pozice</option>{choices.map((role) => <option key={role} value={role}>{role}</option>)}</select> : <span className="team-position-empty">Bez definovaných pozic</span>}<button type="button" className="icon-button danger-ghost" onClick={() => removeTeam(team.id)} aria-label={`Odebrat tým ${team.name}`}>×</button></div>; })}{!selectedTeams.length && <p className="team-membership-empty">Uživatel zatím není přiřazen k žádnému týmu.</p>}</div><div className="team-membership-add"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrovat týmy…"/><select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={busy}><option value="">{busy ? "Načítám…" : "Vyberte tým…"}</option>{available.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button type="button" className="button subtle" disabled={!selected} onClick={addTeam}>Přiřadit</button></div>{error && <small className="field-error">{error}</small>}<small className="field-hint">Pro každý tým lze samostatně nastavit uživatelskou pozici.</small></div>;
}

function LayoutSetLayoutsField({ metadata, selected, onChange }: { metadata: Metadata; selected: string[]; onChange: (selected: string[]) => void }) {
  const [query, setQuery] = useState("");
  const baseTypes = ["list", "detail", "listSmall", "detailSmall", "defaultSidePanel", "bottomPanelsDetail", "filters", "massUpdate", "sidePanelsDetail", "sidePanelsEdit", "sidePanelsDetailSmall", "sidePanelsEditSmall"];
  const scopes = Object.keys(metadata.scopes || {}).filter((scope) => metadata.scopes[scope]?.layouts && !metadata.scopes[scope]?.disabled).sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs"));
  const normalized = query.trim().toLocaleLowerCase("cs");
  function typesFor(scope: string) {
    const client = metadata.clientDefs?.[scope] || {};
    const list = [...baseTypes];
    if ((client as any).bottomPanels?.edit) list.push("bottomPanelsEdit");
    if ((client as any).defaultSidePanelDisabled || (client as any).defaultSidePanelFieldList) list.splice(list.indexOf("defaultSidePanel"), 1);
    if ((client as any).kanbanViewMode) list.push("kanban");
    list.push(...Object.keys((client as any).additionalLayouts || {}));
    return [...new Set(list)].filter((type) => !type.endsWith("Portal") && !(client as any)[`layout${type[0].toUpperCase()}${type.slice(1)}Disabled`]);
  }
  function labelFor(scope: string, type: string) {
    return (metadata.labels as any)?.[scope]?.layouts?.[type] || (metadata.labels as any)?.Admin?.layouts?.[type] || type;
  }
  const visible = scopes.map((scope) => ({ scope, types: typesFor(scope).filter((type) => !normalized || `${entityLabel(metadata, scope, true)} ${scope} ${labelFor(scope, type)} ${type}`.toLocaleLowerCase("cs").includes(normalized)) })).filter((item) => item.types.length);
  function toggle(value: string) { onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]); }
  return <div className="field-input layout-set-list-field"><span>Rozložení dostupná v této sadě</span><div className="layout-set-list-toolbar"><label><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrovat entity a rozložení…"/></label><span>{selected.length} vybráno</span><button type="button" className="button subtle" onClick={() => onChange([])} disabled={!selected.length}>Vymazat</button></div><div className="layout-set-scope-list">{visible.map(({ scope, types }) => { const scopeSelected = types.filter((type) => selected.includes(`${scope}.${type}`)).length; return <details className="layout-set-scope" key={scope} open={Boolean(normalized) || scopeSelected > 0}><summary><span>{entityLabel(metadata, scope, true)}</span><small>{scopeSelected}/{types.length} typů</small></summary><div className="layout-set-type-list">{types.map((type) => { const value = `${scope}.${type}`; return <label className="layout-set-type" key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(value)}/><span>{labelFor(scope, type)}</span><code>{type}</code></label>; })}</div></details>; })}{!visible.length && <div className="empty-state">Pro tento filtr nejsou dostupná žádná rozložení.</div>}</div><small className="field-hint">Zahrnutá rozložení lze samostatně upravit v editoru této sady. Nevybraná rozložení se dědí z globální konfigurace.</small></div>;
}

function RoleAclEditor({ metadata, type, data, fieldData, onChange }: { metadata: Metadata; type: "acl" | "aclPortal"; data: Row; fieldData: Row; onChange: (data: Row, fieldData: Row) => void }) {
  const [query, setQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState("all");
  const aclProperty = type === "aclPortal" ? "aclPortal" : "acl";
  const scopes = Object.entries(metadata.scopes as Record<string, any>).filter(([, def]) => Boolean(def[aclProperty]) && !def.disabled && (type !== "aclPortal" || !def.disabledPortal)).sort(([a], [b]) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs"));
  const visibleScopes = scopes.filter(([scope]) => {
    const current = data[scope];
    const access = current === false ? "disabled" : current === undefined ? "not-set" : "enabled";
    return (accessFilter === "all" || accessFilter === access) && (!query.trim() || `${scope} ${entityLabel(metadata, scope, true)} ${entityLabel(metadata, scope)}`.toLocaleLowerCase("cs-CZ").includes(query.trim().toLocaleLowerCase("cs-CZ")));
  });
  const actions = ["create", "read", "edit", "delete", "stream"];
  const recordLevels = type === "aclPortal" ? ["all", "account", "contact", "own", "no"] : ["all", "team", "own", "no"];
  const levelOrder = type === "aclPortal" ? ["yes", "all", "account", "contact", "own", "no"] : ["yes", "all", "team", "own", "no", "account", "contact"];
  const scopeMemory = useRef<Record<string, Row>>({});
  const levelsFor = (action: string, def: Row): string[] => action === "create" ? ["yes", "no"] : def[`${type}ActionLevelListMap`]?.[action] || def[`${type}LevelList`] || recordLevels;
  const leastPermissive = (levels: string[]) => levels[levels.length - 1] || "no";
  const levelValue = (action: string, def: Row, current: any, access: string) => {
    if (current && typeof current === "object" && current[action]) return current[action];
    if (current === true) return "all";
    if (current === false || access !== "enabled") return "not-set";
    return leastPermissive(levelsFor(action, def));
  };
  const setLevel = (scope: string, action: string, value: string, def: Row) => {
    const next = { ...data };
    const current = next[scope];
    const row = { ...(current && typeof current === "object" ? current : {}) };
    if (value === "not-set") delete row[action];
    else row[action] = value;
    const currentRank = levelOrder.indexOf(value);
    if (action === "read" && value !== "not-set") {
      for (const dependent of ["edit", "delete", "stream"]) {
        if (!levelsFor(dependent, def).some((item) => levelOrder.indexOf(item) >= currentRank)) continue;
        const existing = row[dependent];
        if (existing && levelOrder.indexOf(existing) < currentRank) row[dependent] = value;
      }
    }
    if (action === "edit" && value !== "not-set") {
      const readRank = levelOrder.indexOf(row.read || "yes");
      if (currentRank < readRank) row[action] = row.read || "yes";
      const deleteRank = levelOrder.indexOf(row.delete || "no");
      if (deleteRank < levelOrder.indexOf(row[action])) row.delete = row[action];
    }
    if (action === "delete" || action === "stream") {
      const readRank = levelOrder.indexOf(row.read || "yes");
      if (value !== "not-set" && currentRank < readRank) row[action] = row.read || "yes";
      if (action === "delete" && value !== "not-set") {
        const editRank = levelOrder.indexOf(row.edit || "no");
        if (levelOrder.indexOf(row[action]) < editRank) row[action] = row.edit || "no";
      }
    }
    next[scope] = row;
    onChange(next, fieldData);
  };
  const update = (scope: string, action: string, value: string) => {
    const def = (metadata.scopes as any)?.[scope] || {};
    setLevel(scope, action, value, def);
  };
  const updateAccess = (scope: string, access: string) => {
    const next = { ...data };
    const def = (metadata.scopes as any)?.[scope] || {};
    const current = next[scope];
    if (access !== "enabled" && current && typeof current === "object") scopeMemory.current[scope] = current;
    if (access === "not-set") delete next[scope];
    else if (access === "disabled") next[scope] = false;
    else if (def[aclProperty] === "boolean" || def[aclProperty] === true) next[scope] = true;
    else {
      const restored = scopeMemory.current[scope] || (current && typeof current === "object" ? current : {});
      const levels: Row = { ...restored };
      for (const action of actions) {
        if (action === "stream" && !def.stream) continue;
        const allowed: string[] | undefined = def[`${type}ActionList`] || def.aclActionList;
        if (allowed && !allowed.includes(action)) continue;
        if (!levels[action]) levels[action] = action === "delete" ? "no" : leastPermissive(levelsFor(action, def));
      }
      next[scope] = levels;
    }
    onChange(next, fieldData);
  };
  return <section className="record-editor-group role-acl-editor"><h3>{type === "aclPortal" ? "Oprávnění portálu" : "Přístupová práva"}</h3><p className="role-acl-intro">Nastavte přístup k modulům a případná omezení jednotlivých polí. „Není nastaveno“ ponechá rozhodnutí na ostatních rolích uživatele.</p>
    <div className="role-acl-tools"><label className="role-acl-search"><Search size={14}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat modul nebo název…" aria-label="Hledat modul v oprávněních"/>{query && <button type="button" aria-label="Vymazat hledání" onClick={() => setQuery("")}>×</button>}</label><label className="role-acl-filter"><span>Stav přístupu</span><select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)}><option value="all">Všechny moduly</option><option value="enabled">Povoleno</option><option value="disabled">Zakázáno</option><option value="not-set">Není nastaveno</option></select></label><span className="role-acl-result-count" aria-live="polite">{visibleScopes.length} z {scopes.length} modulů</span></div>
    <div className="role-acl-table"><div className="role-acl-row header"><strong>Modul</strong><span>Přístup</span>{actions.map((action) => <span key={action}>{({ create: "Vytvářet", read: "Číst", edit: "Upravovat", delete: "Mazat", stream: "Stream" } as Row)[action]}</span>)}</div>
      {visibleScopes.map(([scope, def]) => {
        const current = data[scope]; const access = current === false ? "disabled" : current === undefined ? "not-set" : "enabled";
        const allowed: string[] = def[`${type}ActionList`] || def.aclActionList || actions;
        return <div className="role-acl-row" key={scope}><strong>{entityLabel(metadata, scope, true)}</strong><select aria-label={`${entityLabel(metadata, scope)} přístup`} value={access} onChange={(event) => updateAccess(scope, event.target.value)}><option value="not-set">Není nastaveno</option><option value="enabled">Povoleno</option><option value="disabled">Zakázáno</option></select>{actions.map((action) => {
          if (def[aclProperty] === "boolean" || def[aclProperty] === true) return <span key={action}>—</span>;
          if (!allowed.includes(action) || (action === "stream" && !def.stream)) return <span className="role-acl-disabled" key={action}>—</span>;
          const levels: string[] = action === "create" ? ["yes", "no"] : def[`${type}ActionLevelListMap`]?.[action] || def[`${type}LevelList`] || recordLevels;
          if (access !== "enabled") return <span className="role-acl-disabled" key={action}>—</span>;
          const level = levelValue(action, def, current, access);
          const readLevel = current && typeof current === "object" ? current.read || "yes" : "yes";
          const editLevel = current && typeof current === "object" ? current.edit || "yes" : "yes";
          const lowerBound = action === "edit" || action === "stream" ? levelOrder.indexOf(readLevel) : action === "delete" ? Math.max(levelOrder.indexOf(readLevel), levelOrder.indexOf(editLevel)) : -1;
          const availableLevels = levels.filter((item) => action === "create" || lowerBound < 0 || levelOrder.indexOf(item) >= lowerBound);
          return <select key={action} aria-label={`${entityLabel(metadata, scope)} ${action}`} value={level} onChange={(event) => update(scope, action, event.target.value)}><option value="not-set">—</option>{availableLevels.map((item) => <option key={item} value={item}>{({ yes: "Ano", all: "Vše", team: "Tým", own: "Vlastní", no: "Ne", account: "Účet", contact: "Kontakt" } as Row)[item] || item}</option>)}</select>;
        })}
          {def.entity && !def[`${type}FieldLevelDisabled`] && <details className="role-acl-fields"><summary>Omezení polí {Object.keys(fieldData[scope] || {}).length ? `(${Object.keys(fieldData[scope]).length})` : ""}</summary><RoleFieldAcl metadata={metadata} scope={scope} type={type} data={fieldData[scope] || {}} onChange={(nextScopeData) => onChange(data, { ...fieldData, [scope]: nextScopeData })}/></details>}
        </div>;
      })}
      {!visibleScopes.length && <div className="role-acl-empty">{scopes.length ? "Žádný modul neodpovídá hledání nebo vybranému filtru." : "Pro tuto roli nejsou dostupné žádné moduly s ACL."}</div>}
    </div>
  </section>;
}

function RoleFieldAcl({ metadata, scope, type, data, onChange }: { metadata: Metadata; scope: string; type: "acl" | "aclPortal"; data: Row; onChange: (data: Row) => void }) {
  const [newField, setNewField] = useState("");
  const fields = metadata.entityDefs?.[scope]?.fields || {};
  const entityAcl = (metadata as any).entityAcl?.[scope]?.fields || {};
  const mandatoryFields = (metadata.app as any)?.[type]?.mandatory?.scopeFieldLevel?.[scope] || {};
  const isAvailable = (name: string) => {
    const acl = entityAcl[name] || {};
    return !fields[name]?.disabled && !fields[name]?.utility && !acl.onlyAdmin && !acl.forbidden && !acl.internal;
  };
  const available = Object.keys(fields).filter((name) => isAvailable(name) && mandatoryFields[name] == null && !Object.prototype.hasOwnProperty.call(data, name)).sort((a, b) => fieldLabel(a, fields[a], scope, metadata).localeCompare(fieldLabel(b, fields[b], scope, metadata), "cs"));
  const set = (name: string, action: string, value: string) => {
    const next = { ...data }; const current = { ...(next[name] || {}) };
    if (!value) delete current[action]; else current[action] = value;
    if (action === "read" && value === "no" && current.edit === "yes") current.edit = "no";
    if (action === "edit" && value === "yes" && current.read === "no") current.read = "yes";
    if (Object.keys(current).length) next[name] = current; else delete next[name]; onChange(next);
  };
  const fieldEntries = Object.entries(data).sort(([a], [b]) => fieldLabel(a, fields[a], scope, metadata).localeCompare(fieldLabel(b, fields[b], scope, metadata), "cs"));
  return <div className="role-field-acl"><div className="role-field-acl-head"><span>Pole</span><span>Čtení</span><span>Úpravy</span></div>{fieldEntries.map(([name, acl]) => <div className="role-field-acl-row" key={name}><strong>{fieldLabel(name, fields[name], scope, metadata)}</strong>{["read", "edit"].map((action) => { const value = acl?.[action] || ""; const editOptions = action === "edit" && acl?.read === "no" ? ["no"] : ["yes", "no"]; return <select key={action} aria-label={`${fieldLabel(name, fields[name], scope, metadata)} ${action}`} value={value} onChange={(event) => set(name, action, event.target.value)}><option value="">Výchozí</option>{editOptions.map((item) => <option key={item} value={item}>{item === "yes" ? "Ano" : "Ne"}</option>)}</select>; })}</div>)}<div className="role-field-acl-add"><select value={newField} onChange={(event) => setNewField(event.target.value)}><option value="">Přidat omezení pole…</option>{available.map((name) => <option key={name} value={name}>{fieldLabel(name, fields[name], scope, metadata)}</option>)}</select><button type="button" className="button subtle" disabled={!newField} onClick={() => { if (!newField) return; const next = { ...data, [newField]: { read: "no", edit: "no" } }; onChange(next); setNewField(""); }}>Přidat</button></div></div>;
}

function AddressFormatPreview({ format }: { format: unknown }) {
  const samples: Record<number, string[]> = {
    1: ["Ulice 123", "Praha, Praha 110 00", "Česko"],
    2: ["Ulice 123", "110 00 Praha", "Praha Česko"],
    3: ["Česko", "110 00 Praha Praha", "Ulice 123"],
    4: ["Ulice 123", "Praha", "Česko - Praha 110 00"],
  };
  const value = Number(format) || 1;
  return <div className="address-format-preview"><span>Náhled adresy</span><div><small>Výsledek při formátu {value}</small><pre>{(samples[value] || samples[1]).join("\n")}</pre></div></div>;
}

function SettingsEmailAddressField({ name, metadata, value, suggestInbound, onChange }: { name: string; metadata: Metadata; value: string; suggestInbound: boolean; onChange: (value: string) => void }) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Row[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  useEffect(() => setQuery(value), [value]);
  useEffect(() => {
    if (!suggestInbound || query.trim().length < 1) { setSuggestions([]); return; }
    let live = true;
    const timer = window.setTimeout(() => {
      const searchParams = JSON.stringify({
        select: ["emailAddress"], maxSize: 7,
        where: [
          { type: "startsWith", attribute: "emailAddress", value: query.trim() },
          { type: "isTrue", attribute: "useSmtp" },
        ],
      });
      request<{ list?: Row[] }>(`InboundEmail?searchParams=${encodeURIComponent(searchParams)}`).then((result) => {
        if (live) { setSuggestions(result.list || []); setActiveIndex(-1); }
      }).catch(() => live && setSuggestions([]));
    }, 180);
    return () => { live = false; window.clearTimeout(timer); };
  }, [query, suggestInbound]);
  const choose = (address: string) => { setQuery(address); onChange(address); setOpen(false); setSuggestions([]); };
  const label = fieldLabel(name, metadata.entityDefs?.Settings?.fields?.[name], "Settings", metadata);
  return <label className="setting-field settings-email-address-field"><span>{label}</span><input type="email" autoComplete="email" value={query} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => { setQuery(event.target.value); onChange(event.target.value); setOpen(true); }} onKeyDown={(event) => {
    if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1)); }
    else if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) { event.preventDefault(); choose(String(suggestions[activeIndex].emailAddress || suggestions[activeIndex].attributes?.emailAddress || "")); }
    else if (event.key === "Escape") setOpen(false);
  }}/>{open && suggestInbound && suggestions.length > 0 && <div className="settings-email-suggestions" role="listbox" aria-label="Odchozí e-mailové schránky">{suggestions.map((item, index) => { const address = String(item.emailAddress || item.attributes?.emailAddress || ""); return <button key={item.id || address} type="button" role="option" aria-selected={activeIndex === index} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(address)}><Mail size={13}/><span>{address}</span><small>{item.name || "SMTP schránka"}</small></button>; })}</div>}{suggestInbound && <small className="field-hint">Našeptávání hledá adresy schránek se zapnutým SMTP.</small>}</label>;
}

function CurrencyRatesEditor({ metadata, currencies, baseCurrency, value, onChange }: { metadata: Metadata; currencies: string[]; baseCurrency: string; value: any; onChange: (value: Record<string, number>) => void }) {
  const labels = metadata.app?.currency?.symbolMap || {};
  const rates = value && !Array.isArray(value) && typeof value === "object" ? value as Record<string, number> : {};
  const otherCurrencies = currencies.filter((currency) => currency !== baseCurrency);
  return <div className="field-input currency-rates-editor"><span>{fieldLabel("currencyRates", metadata.entityDefs.Settings.fields?.currencyRates, "Settings", metadata)}</span><p className="field-hint">Zadejte, kolik jednotek dané měny odpovídá jedné jednotce základní měny ({baseCurrency || "není nastavena"}). Kurz musí být kladný.</p>{otherCurrencies.length ? <div className="currency-rate-list">{otherCurrencies.map((currency) => <label key={currency}><span id={`currency-rate-label-${currency}`}><b>{currency}</b><small>{labels[currency] || currency} za 1 {baseCurrency}</small></span><input type="number" inputMode="decimal" required min="0.000001" step="any" aria-labelledby={`currency-rate-label-${currency}`} aria-describedby={`currency-rate-help-${currency}`} value={rates[currency] ?? 1} onChange={(event) => onChange({ ...rates, [currency]: Number(event.target.value) })}/><small id={`currency-rate-help-${currency}`} className="sr-only">Zadejte kladný kurz pro {currency} vůči {baseCurrency}.</small></label>)}</div> : <div className="currency-rate-empty"><strong>Není co převádět</strong><span>{baseCurrency ? `Základní měna ${baseCurrency} je jedinou povolenou měnou.` : "Nejprve nastavte základní měnu a seznam povolených měn."}</span></div>}</div>;
}

function HtmlFieldEditor({ entity, metadata, value, onChange, htmlMode = true, fieldName, disabled = false }: { entity: string; metadata: Metadata; value: unknown; onChange: (value: string) => void; htmlMode?: boolean; fieldName: string; disabled?: boolean }) {
  const [preview, setPreview] = useState(false);
  const [placeholderScope, setPlaceholderScope] = useState("Contact");
  const [placeholderField, setPlaceholderField] = useState("name");
  const editor = useRef<HTMLTextAreaElement>(null);
  const richInsert = useRef<((text: string) => void) | null>(null);
  const html = typeof value === "string" ? value : "";
  function insertToken(token: string) {
    if (htmlMode && richInsert.current) { richInsert.current(token); return; }
    const input = editor.current;
    if (!input) { onChange(`${html}${token}`); return; }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    onChange(`${html.slice(0, start)}${token}${html.slice(end)}`);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + token.length, start + token.length); });
  }
  const templateDefs = (metadata.app?.emailTemplate?.placeholders || {}) as Record<string, { order?: number }>;
  const templateNativeList = (metadata.clientDefs?.EmailTemplate?.placeholderList || []) as string[];
  const orderedTemplateDefs = Object.keys(templateDefs).sort((a, b) => (templateDefs[a]?.order ?? 0) - (templateDefs[b]?.order ?? 0));
  const tokenList = entity === "EmailTemplate" ? [...new Set([...orderedTemplateDefs, ...templateNativeList])].map((item) => `{${item}}`) : [];
  const [placeholderFieldQuery, setPlaceholderFieldQuery] = useState("");
  const placeholderScopes = useMemo(() => ["Person", ...Object.keys(metadata.scopes).filter((scope) => scope !== "Email" && metadata.scopes[scope]?.entity && metadata.scopes[scope]?.object && metadata.entityDefs[scope]?.fields && canAccessEntity(metadata, scope)).sort((a, b) => entityLabel(metadata, a).localeCompare(entityLabel(metadata, b), "cs"))], [metadata]);
  const placeholderFields = useMemo(() => {
    if (placeholderScope === "Person") return [["name", "Jméno"], ["firstName", "Křestní jméno"], ["lastName", "Příjmení"], ["salutationName", "Oslovení"], ["emailAddress", "E-mail"], ["assignedUserName", "Přiřazený uživatel"]] as Array<[string, string]>;
    const fieldAttributes = (scope: string, key: string, def: FieldDef, isForeign = false): Array<[string, string]> => {
      const acl = metadata.userAcl?.fieldTable?.[scope]?.[key];
      const entityAcl = (metadata as any).entityAcl?.[scope]?.fields?.[key] || {};
      const fieldMeta = metadata.fields?.[def.type || ""];
      const actualFields = fieldMeta?.actualFields || [];
      if (acl?.read === "no" || entityAcl.onlyAdmin || entityAcl.forbidden || entityAcl.internal || def.disabled || def.utility || def.templatePlaceholderDisabled || def.directAccessDisabled && (isForeign || !def.loaderClassName) || ["linkMultiple", "attachmentMultiple", "map", "jsonObject", "jsonArray", "password"].includes(def.type || "")) return [];
      const attrs = actualFields.length
        ? actualFields.map((part) => !part ? key : fieldMeta?.naming === "prefix" ? `${part}${key[0].toUpperCase()}${key.slice(1)}` : `${key}${part[0].toUpperCase()}${part.slice(1)}`)
        : [key];
      if (def.type === "personName") attrs.unshift("name");
      const baseLabel = fieldLabel(key, def, scope, metadata);
      return [...new Set(attrs)].map((attribute) => {
        if (attribute === key || attribute === "name" && def.type === "personName") return [attribute, baseLabel];
        const suffix = attribute.startsWith(key) ? attribute.slice(key.length) : attribute.replace(key, "");
        return [attribute, `${baseLabel} · ${suffix || attribute}`];
      });
    };
    const directEntries = Object.entries(metadata.entityDefs[placeholderScope]?.fields || {}).flatMap(([key, def]) => fieldAttributes(placeholderScope, key, def));
    const direct = [["id", "ID"], ...directEntries];
    const links = (metadata.entityDefs[placeholderScope]?.links || {}) as Record<string, any>;
    const entityAcl = (metadata as any).entityAcl?.[placeholderScope]?.links || {};
    const related = Object.entries(links).flatMap(([link, linkDef]) => {
      const foreignScope = linkDef.type === "belongsTo" ? linkDef.entity : undefined;
      if (!foreignScope || linkDef.disabled || linkDef.utility || entityAcl[link]?.onlyAdmin || entityAcl[link]?.forbidden || entityAcl[link]?.internal) return [];
      return [[`${link}.id`, `${entityLabel(metadata, foreignScope)} · ID`] as [string, string], ...Object.entries(metadata.entityDefs[foreignScope]?.fields || {}).flatMap(([key, def]) => fieldAttributes(foreignScope, key, def, true).map(([attribute, label]) => [`${link}.${attribute}`, `${entityLabel(metadata, foreignScope)} · ${label}`] as [string, string]))];
    });
    return [...new Map([...direct, ...related].map(([name, label]) => [name, [name, label] as [string, string]])).values()].sort((a, b) => a[1].localeCompare(b[1], "cs"));
  }, [metadata, placeholderScope]);
  const filteredPlaceholderFields = useMemo(() => placeholderFields.filter(([field, label]) => !placeholderFieldQuery.trim() || `${field} ${label}`.toLocaleLowerCase("cs-CZ").includes(placeholderFieldQuery.trim().toLocaleLowerCase("cs-CZ"))), [placeholderFields, placeholderFieldQuery]);
  useEffect(() => {
    if (!placeholderScopes.includes(placeholderScope)) setPlaceholderScope(placeholderScopes[0] || "");
  }, [placeholderScopes, placeholderScope]);
  useEffect(() => {
    if (!placeholderFields.some(([name]) => name === placeholderField)) setPlaceholderField(placeholderFields[0]?.[0] || "");
  }, [placeholderFields, placeholderField]);
  useEffect(() => {
    if (!filteredPlaceholderFields.some(([name]) => name === placeholderField)) setPlaceholderField(filteredPlaceholderFields[0]?.[0] || "");
  }, [filteredPlaceholderFields, placeholderField]);
  return <div className="html-field-editor">
    {preview && htmlMode
      ? <div className="html-editor-preview" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) }}/>
       : htmlMode ? <Suspense fallback={<div className="table-loading" role="status"><span className="spinner"/>Načítám textový editor…</div>}><WysiwygEditor value={html} htmlMode entity={entity} field={fieldName} disabled={disabled} onChange={onChange} onRegisterInsert={(insert) => { richInsert.current = insert; }}/></Suspense> : <textarea ref={editor} aria-label="Text e-mailu" rows={9} value={html} disabled={disabled} onChange={(event) => onChange(event.target.value)} spellCheck/>}
    {htmlMode && <div className="html-editor-preview-toggle"><button type="button" className={preview ? "selected" : ""} onClick={() => setPreview((current) => !current)}><Eye size={14}/>{preview ? "Upravit HTML" : "Náhled"}</button></div>}
    {entity === "EmailTemplate" && (placeholderScopes.length > 0 || tokenList.length > 0) && <details className="email-template-tokens"><summary>Vložit zástupný symbol</summary><div className="email-token-picker"><select aria-label="Typ záznamu" value={placeholderScope} onChange={(event) => { setPlaceholderScope(event.target.value); setPlaceholderFieldQuery(""); }}>{placeholderScopes.map((scope) => <option key={scope} value={scope}>{scope === "Person" ? "Osoba" : entityLabel(metadata, scope)}</option>)}</select><label className="email-token-field-search"><Search size={13}/><input type="search" value={placeholderFieldQuery} onChange={(event) => setPlaceholderFieldQuery(event.target.value)} placeholder="Hledat pole…" aria-label="Hledat pole pro zástupný symbol"/><span>{filteredPlaceholderFields.length}</span></label><select aria-label="Pole záznamu" value={placeholderField} onChange={(event) => setPlaceholderField(event.target.value)}>{filteredPlaceholderFields.length ? filteredPlaceholderFields.map(([field, label]) => <option key={field} value={field}>{label}</option>) : <option value="">Žádné odpovídající pole</option>}</select><button type="button" disabled={!placeholderScope || !placeholderField || !placeholderFields.some(([field]) => field === placeholderField)} onClick={() => insertToken(`{${placeholderScope}.${placeholderField}}`)}>Vložit pole</button></div>{tokenList.length > 0 && <div>{tokenList.map((token) => <button type="button" key={token} onClick={() => insertToken(token)}>{token}</button>)}</div>}<small>Vlastní zástupné symboly načítají hodnoty z nadřazeného záznamu. Vložení proběhne na pozici kurzoru; odkazy pro odhlášení a potvrzení odběru používejte v odpovídajících kampaních.</small></details>}
  </div>;
}

function ScheduledJobJobField({ metadata, value, disabled, onChange }: { metadata: Metadata; value: string; disabled: boolean; onChange: (job: string, defaults: Row) => void }) {
  const [jobs, setJobs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const definitions = (metadata.entityDefs.ScheduledJob as any)?.jobs || {};
  const schedules = (metadata.entityDefs.ScheduledJob as any)?.jobSchedulingMap || {};
  useEffect(() => {
    let live = true;
    request<string[]>("Admin/jobs").then((list) => {
      if (!live) return;
      setJobs(list.filter((job) => !definitions[job]?.isSystem));
      setError("");
    }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Seznam úloh se nepodařilo načíst."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [definitions]);
  const options = value && !jobs.includes(value) ? [value, ...jobs] : jobs;
  return <label className="field-input scheduled-job-picker"><span>{fieldLabel("job", metadata.entityDefs.ScheduledJob.fields?.job, "ScheduledJob", metadata)} *</span><select value={value} required disabled={disabled || loading} onChange={(event) => {
    const job = event.target.value;
    const label = (metadata.labels as any)?.ScheduledJob?.options?.job?.[job] || definitions[job]?.name || job;
    onChange(job, { name: label, scheduling: schedules[job] || "*/10 * * * *" });
  }}><option value="">{loading ? "Načítám dostupné úlohy…" : "Vyberte úlohu…"}</option>{options.map((job) => <option key={job} value={job}>{(metadata.labels as any)?.ScheduledJob?.options?.job?.[job] || definitions[job]?.name || job}</option>)}</select>{error && <small className="field-error">{error}</small>}<small className="field-hint">Systémové úlohy spravuje EspoCRM a nelze je přidávat jako vlastní plánovač.</small></label>;
}

function ScheduledJobCronField({ value, required, disabled, onChange }: { value: string; required: boolean; disabled: boolean; onChange: (value: string) => void }) {
  let description = "";
  if (value.trim()) {
    if (value.trim() === "* * * * *") description = "Co nejčastěji (každou minutu)";
    else {
      try { description = cronstrue.toString(value.trim(), { locale: "cs", use24HourTimeFormat: true, throwExceptionOnParseError: true }); }
      catch { description = "Neplatný cron výraz — zkontrolujte pořadí minut, hodin, dne, měsíce a dne v týdnu."; }
    }
  }
  return <label className="field-input scheduled-job-cron"><span>{fieldLabel("scheduling", { type: "varchar" }, "ScheduledJob")} {required && <i>*</i>}</span><input value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder="*/10 * * * *" spellCheck={false}/>{description && <small className={description.startsWith("Neplatný") ? "field-error" : "field-hint cron-description"}>{description}</small>}<small className="field-hint">Formát: minuta, hodina, den v měsíci, měsíc, den v týdnu.</small></label>;
}

function ScheduledJobCronNotice({ onOpenJobs }: { onOpenJobs: () => void }) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    request<Row>("Admin/action/cronMessage").then((result) => live && setData(result)).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Cron konfiguraci se nepodařilo načíst."));
    return () => { live = false; };
  }, []);
  return <section className="scheduled-job-cron-notice"><div className="scheduled-job-cron-copy"><strong>Nastavení serverového cron</strong>{error ? <p className="field-error">{error}</p> : data && <><p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(data.message || ""), { ALLOWED_TAGS: ["strong", "b", "br", "a"], ALLOWED_ATTR: ["href", "target", "rel"] }) }}/>{data.command && <code>{data.command}</code>}</>}</div><button type="button" className="button subtle" onClick={onOpenJobs}><Workflow size={14}/>Fronta úloh</button></section>;
}

function durationLabel(totalSeconds: number) {
  if (!totalSeconds) return "0 min";
  let remaining = totalSeconds;
  const days = Math.floor(remaining / 86400); remaining %= 86400;
  const hours = Math.floor(remaining / 3600); remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  return [[days, "d"], [hours, "h"], [minutes, "min"]].filter(([amount]) => Number(amount) > 0).map(([amount, unit]) => `${amount}${unit === "min" ? " min" : unit}`).join(" ");
}

function dateAfterDuration(startValue: unknown, secondsValue: unknown, allDay = false) {
  if (!startValue) return "";
  const seconds = Math.max(0, Number(secondsValue) || 0);
  const raw = String(startValue).replace(" ", "T");
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(startValue));
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  if (allDay) {
    if (seconds) date.setDate(date.getDate() + Math.ceil(seconds / 86400) - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  date.setSeconds(date.getSeconds() + seconds);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function dateTimeRoundedToQuarterHour() {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
}

function DurationFieldInput({ label, value, def, disabled, onChange }: { label: string; value: number; def: FieldDef; disabled: boolean; onChange: (seconds: number) => void }) {
  const current = Number(value) || 0;
  const options = [...new Set([...(Array.isArray(def.options) ? def.options.map(Number) : []), current])].filter((seconds) => Number.isFinite(seconds) && seconds >= 0).sort((a, b) => a - b);
  return <div className="field-input duration-field"><span>{label}</span><div><select value={String(current)} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>{options.map((seconds) => <option key={seconds} value={seconds}>{durationLabel(seconds)}</option>)}</select><label><span>Minuty</span><input type="number" min="0" step="5" disabled={disabled} value={Number.isFinite(current) ? current / 60 : 0} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0) * 60)}/></label></div></div>;
}

function CurrencyFieldInput({ label, value, currency, currencies, symbols, defaultCurrency, decimalPlaces, def, onChange, onCurrencyChange }: { label: string; value: unknown; currency: string; currencies: string[]; symbols: Record<string, string>; defaultCurrency: string; decimalPlaces?: number; def: FieldDef; onChange: (value: number | null) => void; onCurrencyChange?: (currency: string) => void }) {
  const fixed = Boolean(def.onlyDefaultCurrency || def.params?.onlyDefaultCurrency);
  const options = [...new Set([...(currencies.length ? currencies : [defaultCurrency]), currency])];
  const step = def.decimal === false ? "1" : def.scale ? String(1 / (10 ** Number(def.scale))) : decimalPlaces === 0 ? "1" : "any";
  return <label className="field-input currency-field-input"><span>{label}{def.required && <i> *</i>}</span><div className="currency-input-row"><span className="currency-symbol">{symbols[currency] || currency}</span><input type="number" min={def.min} max={def.max} step={step} required={def.required} disabled={Boolean(def.readOnly || def.disabled)} value={value == null ? "" : String(value)} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}/>{!fixed && <select aria-label={`${label} měna`} value={currency} disabled={Boolean(def.readOnly || def.disabled) || !onCurrencyChange} onChange={(event) => onCurrencyChange?.(event.target.value)}>{options.map((code) => <option key={code} value={code}>{code} · {symbols[code] || code}</option>)}</select>}</div></label>;
}

function PortalScopeListEditor({ name, label, value, metadata, disabled, onChange }: { name: string; label: string; value: unknown; metadata: Metadata; disabled: boolean; onChange: (value: string[]) => void }) {
  const tabList = name === "tabList";
  const rawOptions = Object.entries(metadata.scopes || {}).filter(([, def]) => !def.disabled && def.aclPortal && (tabList ? def.tab : def.entity && def.object)).map(([scope]) => scope);
  if (tabList) rawOptions.push("Stream", "_delimiter_", "_delimiter-ext_");
  const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const available = rawOptions.filter((item) => item.startsWith("_delimiter") || !selected.includes(item));
  const [next, setNext] = useState(available[0] || "");
  useEffect(() => { if (!available.includes(next)) setNext(available[0] || ""); }, [next, available.join("|")]);
  const optionLabel = (item: string) => item === "Stream" ? "Stream" : item === "_delimiter_" || item === "_delimiter-ext_" ? "· · · Oddělovač · · ·" : entityLabel(metadata, item, true);
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= selected.length) return; const result = [...selected]; [result[index], result[target]] = [result[target], result[index]]; onChange(result); }
  function remove(index: number) { onChange(selected.filter((_, current) => current !== index)); }
  function add() { if (!next || !available.includes(next)) return; onChange([...selected, next]); const remaining = available.filter((item) => item !== next); setNext(remaining[0] || ""); }
  return <div className="field-input portal-scope-list-editor"><span>{label}</span><div className="portal-scope-list">{selected.map((item, index) => <div className="portal-scope-list-row" key={`${item}-${index}`}><strong>{optionLabel(item)}</strong><div><button type="button" className="icon-button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Posunout nahoru: ${optionLabel(item)}`}><ArrowUp size={13}/></button><button type="button" className="icon-button" disabled={disabled || index === selected.length - 1} onClick={() => move(index, 1)} aria-label={`Posunout dolů: ${optionLabel(item)}`}><ArrowDown size={13}/></button><button type="button" className="icon-button danger-ghost" disabled={disabled} onClick={() => remove(index)} aria-label={`Odebrat: ${optionLabel(item)}`}><Trash2 size={13}/></button></div></div>)}{!selected.length && <small>Žádná položka není vybraná.</small>}</div><div className="portal-scope-list-add"><select value={next} disabled={disabled || !available.length} onChange={(event) => setNext(event.target.value)}><option value="">Vyberte modul…</option>{available.map((item, index) => <option key={`${item}-${index}`} value={item}>{optionLabel(item)}</option>)}</select><button type="button" className="button subtle" disabled={disabled || !next} onClick={add}><Plus size={13}/>Přidat</button></div><small className="field-hint">{tabList ? "Pořadí určuje navigaci portálu. Nabízené moduly respektují portálová oprávnění." : "Rychlé vytvoření nabízí jen objekty povolené pro tento portál."}</small></div>;
}

function FieldInput({ entity, metadata, name, def: inputDef, value, columns = {}, onColumnsChange, primaryId, onPrimaryChange, onChange, onUploading, onUploaded, onError, relatedContext, currencyValue, onCurrencyChange, themeParamsValue, onThemeParamsChange, timeZone }: { entity: string; metadata: Metadata; name: string; def: FieldDef; value: any; columns?: Row; onColumnsChange?: (columns: Row) => void; primaryId?: string; onPrimaryChange?: (id: string, label?: string) => void; onChange: (value: any) => void; onUploading?: (value: boolean) => void; onUploaded?: (id: string) => void; onError?: (message: string) => void; relatedContext?: Row; currencyValue?: string; onCurrencyChange?: (currency: string) => void; themeParamsValue?: Row; onThemeParamsChange?: (value: Row) => void; timeZone?: string }) {
  const def = nativeForeignFieldDef(metadata, entity, inputDef);
  const [options, setOptions] = useState<Row[]>([]);
  const [teamPositionOptions, setTeamPositionOptions] = useState<Record<string, string[]>>({});
  const [teamPositionLoading, setTeamPositionLoading] = useState<Record<string, boolean>>({});
  const [parentEntity, setParentEntity] = useState(value?.type || "");
  const [relationSearch, setRelationSearch] = useState("");
  const [relationPick, setRelationPick] = useState("");
  const [selectRecordsOpen, setSelectRecordsOpen] = useState(false);
  const [attachmentSource, setAttachmentSource] = useState("");
  const [relatedCreateEntity, setRelatedCreateEntity] = useState("");
  const [textPreviewOpen, setTextPreviewOpen] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ images: Array<{ id: string; name: string; type?: string }>; index: number } | null>(null);
  const [imageCropFile, setImageCropFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const type = def.type || "varchar";
  const fieldTimeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const noteMessagePermission = String((metadata.userAcl as any)?.messagePermission || "");
  const notePortalPermission = String((metadata.userAcl as any)?.portalPermission || "");
  const assignedUserField = ["views/fields/assigned-user", "views/fields/assigned-users"].includes(String(def.view || ""));
  const assignmentPermission = String((metadata.userAcl as any)?.assignmentPermission || "no");
  const sessionUser = getSession()?.user;
  const emailAccountEmailFolder = entity === "EmailAccount" && name === "emailFolder";
  const emailFilterEmailFolder = entity === "EmailFilter" && name === "emailFolder";
  const emailFolderAssignedUserId = String(relatedContext?.assignedUser || relatedContext?.assignedUserId || "");
  const emailFolderUserScoped = emailAccountEmailFolder && (sessionUser?.type === "admin" || sessionUser?.type === "super-admin") && Boolean(emailFolderAssignedUserId);
  const emailFilterFolderParentId = String(relatedContext?.parent?.id || "");
  const emailFilterFolderUserScoped = emailFilterEmailFolder && (sessionUser?.type === "admin" || sessionUser?.type === "super-admin") && relatedContext?.parent?.type === "User" && Boolean(emailFilterFolderParentId);
  const fieldDisabled = Boolean(def.readOnly || def.disabled || assignedUserField && assignmentPermission === "no" || entity === "Note" && name === "users" && noteMessagePermission === "no" && notePortalPermission === "no");
  const isCategoryTree = /category[-]?tree/i.test(String(def.view || "")) || /category[-]?tree/i.test(type);
  const label = fieldLabel(name, def, entity, metadata);
  const resolvedOptions = nativeFieldOptions(metadata, entity, name, def);
  if (entity === "Portal" && ["tabList", "quickCreateList"].includes(name)) return <PortalScopeListEditor name={name} label={label} value={value} metadata={metadata} disabled={fieldDisabled} onChange={onChange}/>;
  const optionLabel = (option: string | number) => ((["language", "formLanguage"].includes(name) ? (metadata.labels as any)?.Global?.options?.language?.[String(option)] : undefined) || (name === "theme" ? (metadata.labels as any)?.Global?.themes?.[String(option)] : undefined) || (entity === "Settings" && name === "fiscalYearShift" ? (metadata.labels as any)?.Global?.lists?.monthNames?.[Number(option)] : undefined) || resolvedOptions.labels[String(option)] || String(option));
  const currencySettings = metadata.appSettings || {};
  const currencyList = (currencySettings.currencyList || (metadata.app as any)?.currency?.list || []) as string[];
  const defaultCurrency = String(currencySettings.defaultCurrency || currencyList[0] || "USD");
  if (type === "currency") return <CurrencyFieldInput label={label} value={value} currency={currencyValue || defaultCurrency} currencies={currencyList} symbols={(metadata.app as any)?.currency?.symbolMap || {}} defaultCurrency={defaultCurrency} decimalPlaces={currencySettings.currencyDecimalPlaces} def={def} onChange={onChange} onCurrencyChange={onCurrencyChange}/>;
  if (name === "theme" && ["Settings", "Portal"].includes(entity)) {
    const themes = ((metadata as any).themes || {}) as Row;
    const themeOptions = Object.keys(themes).sort((a, b) => a === "EspoRtl" ? -1 : b === "EspoRtl" ? 1 : optionLabel(a).localeCompare(optionLabel(b), "cs"));
    const navbarDefinition = themes[String(value || "")]?.params?.navbar || {};
    const navbarOptions: string[] = Array.isArray(navbarDefinition.options) && navbarDefinition.options.length > 1 ? navbarDefinition.options.map(String) : [];
    const currentNavbar = String(themeParamsValue?.navbar || navbarDefinition.default || "");
    const changeTheme = (nextTheme: string) => {
      onChange(nextTheme);
      const nextDefinition = themes[nextTheme]?.params?.navbar || {};
      const nextOptions: string[] = Array.isArray(nextDefinition.options) ? nextDefinition.options.map(String) : [];
      if (nextOptions.length > 1 && !nextOptions.includes(currentNavbar)) onThemeParamsChange?.({ ...(themeParamsValue || {}), navbar: nextDefinition.default || nextOptions[0] });
    };
    return <div className="field-input theme-field"><span>{label}{def.required && <i> *</i>}</span><div className="theme-field-controls"><select aria-label={label} value={value || ""} disabled={fieldDisabled} onChange={(event) => changeTheme(event.target.value)}>{entity === "Portal" && <option value="">Výchozí</option>}{themeOptions.map((theme) => <option key={theme} value={theme}>{optionLabel(theme)}</option>)}</select>{navbarOptions.length > 0 && <select aria-label="Rozložení navigace" value={currentNavbar} disabled={fieldDisabled} onChange={(event) => onThemeParamsChange?.({ ...(themeParamsValue || {}), navbar: event.target.value })}>{navbarOptions.map((navbar) => <option key={navbar} value={navbar}>{(metadata.labels as any)?.Global?.themeNavbars?.[navbar] || navbar}</option>)}</select>}</div></div>;
  }
  if (type === "currencyConverted") return <label className="field-input currency-converted-field"><span>{label}{def.required && <i> *</i>}</span><output>{value == null || value === "" ? "—" : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: Number(currencySettings.currencyDecimalPlaces ?? 2) }).format(Number(value))} ${((metadata.app as any)?.currency?.symbolMap || {})[defaultCurrency] || defaultCurrency}`}</output></label>;
  const dynamicEnumOptions = useMemo(() => {
    if (type === "arrayInt") return resolvedOptions.options;
    if (type !== "multiEnum" || resolvedOptions.options.length) return resolvedOptions.options;
    if (entity === "Settings" && name === "currencyList") return ((metadata.app as any)?.currency?.list || []) as string[];
    if (entity === "Settings" && name === "phoneNumberPreferredCountryList") return phoneCountryOptions;
    if (entity === "Settings" && name === "auth2FAMethodList") return Object.entries((metadata.app as any)?.authentication2FAMethods || {}).filter(([, method]: [string, any]) => method?.settings?.isAvailable).map(([method]) => method);
    const scopes = metadata.scopes as Record<string, any>;
    const view = String(def.view || "");
    return Object.keys(scopes).filter((scope) => {
      const item = scopes[scope];
      if (item.disabled) return false;
      if (name === "assignmentNotificationsEntityList" || view.includes("assignment-notifications-entity-list")) return Boolean(item.entity && item.notifications && (!item.stream || (metadata as any).notificationDefs?.[scope]?.forceAssignmentNotificator));
      if (name === "assignmentEmailNotificationsEntityList" || view.includes("assignment-email-notifications-entity-list")) return scope !== "Email" && Boolean(item.entity && item.notifications);
      if (name === "streamEmailNotificationsEntityList" || view.includes("stream-email-notifications-entity-list")) return Boolean(item.entity && item.object && item.stream);
      if (view.includes("stream-email-with-content-entity-type-list")) return Boolean(item.entity && item.stream);
      if (view.includes("activities-entity-list") || view.includes("history-entity-list")) return scope !== "Email" && Boolean(item.entity && item.object && item.activity);
      if (view.includes("calendar-entity-list") || view.includes("busy-ranges-entity-list")) return Boolean(item.entity && item.object && item.calendar);
      if (view.includes("global-search-entity-list")) return scope !== "Note" && Boolean(item.customizable && item.entity);
      if (view.includes("email-address-lookup-entity-type-list")) return Boolean(item.entity && item.object && (["User", "Contact", "Lead", "Account"].includes(scope) || ["Company", "Person"].includes(item.type)));
      if (def.translation?.includes("scopeNames")) return Boolean(item.entity && item.object);
      return true;
    }).sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs"));
  }, [resolvedOptions.options, metadata, entity, name, type, def.view, def.translation]);
  const fieldOptions = useMemo(() => {
    if (resolvedOptions.options.length) return resolvedOptions.options;
    if (entity === "Settings" && name === "dateFormat") return ((metadata.app as any)?.dateTime?.dateFormatList || []) as string[];
    if (entity === "Settings" && name === "timeFormat") return ((metadata.app as any)?.dateTime?.timeFormatList || []) as string[];
    if (entity === "Settings" && name === "fiscalYearShift") return ((metadata.labels as any)?.Global?.lists?.monthNames || []).map((_: string, index: number) => index) as number[];
    if (name === "language" || name === "formLanguage") return ((metadata.app as any)?.language?.list || []) as string[];
    if (entity === "Settings" && name === "pdfEngine") return Object.keys((metadata.app as any)?.pdfEngines || {});
    if (entity === "Settings" && name === "smsProvider") return Object.keys((metadata.app as any)?.smsProviders || {});
    if (entity === "Settings" && name === "authenticationMethod") return Object.entries((metadata as any).authenticationMethods || {}).filter(([, method]: [string, any]) => method?.settings?.isAvailable).map(([method]) => method);
    if (entity === "Settings" && ["defaultCurrency", "baseCurrency"].includes(name)) return currencyList;
    return [];
  }, [currencyList, resolvedOptions.options, entity, metadata, name]);
  const attachmentSourceList = type === "attachmentMultiple"
    ? [...new Set([...(Array.isArray(def.sourceList) ? def.sourceList : []), ...(((metadata.clientDefs?.Attachment as any)?.generalSourceList || []) as string[])])].filter((scope: string) => metadata.scopes?.[scope]?.entity && canAccessEntity(metadata, scope) && canAccessAttachmentSource(metadata, scope))
    : [];
  const attachmentSourceDef = (metadata.clientDefs?.Attachment as any)?.sourceDefs?.[attachmentSource] || {};
  const attachmentSourceFixedWhere = relatedContext?.parentType === "Account" && relatedContext.parentId && metadata.entityDefs?.[attachmentSource]?.fields?.account?.type === "link" && metadata.entityDefs?.[attachmentSource]?.links?.account?.entity === "Account"
    ? [{ type: "equals", attribute: "accountId", value: String(relatedContext.parentId) }]
    : [];
  const dynamicOptionLabels = Object.fromEntries(dynamicEnumOptions.map((option) => [String(option), entity === "Settings" && name === "phoneNumberPreferredCountryList" ? phoneCountryLabels[String(option)] || String(option) : type === "multiEnum" && metadata.scopes?.[String(option)] ? entityLabel(metadata, String(option), def.translation?.includes("Plural") ?? true) : optionLabel(option)]));
  const relationEntity = metadata.entityDefs?.[entity]?.links?.[name]?.entity || (["link", "linkOne", "linkMultiple"].includes(type) ? def.entity : undefined);
  const parentCandidates: string[] = entity === "Note" && name === "parent" ? Object.keys(metadata.scopes || {}) : def.entityList || (metadata.entityDefs?.[entity]?.links?.[name] as any)?.entityList || Object.keys(metadata.scopes || {}).filter((scope) => metadata.scopes[scope].entity);
  const attachmentParentExcluded = new Set(["Preferences", "ExternalAccount", "Notification", "Note", "ArrayValue", "Attachment"]);
  const parentEntityList = parentCandidates.filter((scope) => Boolean(metadata.scopes[scope]?.entity) && canAccessEntity(metadata, scope) && !(entity === "Note" && name === "parent") || entity === "Note" && name === "parent" && Boolean(metadata.scopes[scope]?.entity && metadata.scopes[scope]?.object && metadata.scopes[scope]?.stream) && canAccessEntity(metadata, scope) && aclLevel(metadata, scope, "stream") !== "no").filter((scope) => !(entity === "Attachment" && attachmentParentExcluded.has(scope))).sort((a, b) => entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs"));
  const noteUsersPrimaryFilter = entity === "Note" && name === "users" ? notePortalPermission === "yes" && noteMessagePermission === "no" ? "activePortal" : "active" : undefined;
  const noteUsersFilterList = entity === "Note" && name === "users" && notePortalPermission === "yes" ? noteMessagePermission === "no" ? ["activePortal"] : ["active", "activePortal"] : [];
  const noteUsersBoolFilterList = entity === "Note" && name === "users" && noteMessagePermission === "team" ? ["onlyMyTeam"] : [];
  const targetEntity = type === "linkParent" ? parentEntity : relationEntity;
  const currentId = type === "linkParent" ? value?.id : type === "linkMultiple" ? "" : value;
  const selectedRelationIds: string[] = type === "linkMultiple" && Array.isArray(value) ? value : [];
  const selectedRelationKey = selectedRelationIds.join(",");
  useEffect(() => {
    if (entity !== "User" || name !== "teams" || !selectedRelationIds.length) {
      setTeamPositionOptions({}); setTeamPositionLoading({}); return;
    }
    let live = true;
    const ids = [...selectedRelationIds];
    setTeamPositionLoading(Object.fromEntries(ids.map((id) => [id, true])));
    void Promise.all(ids.map(async (id) => {
      try {
        const team = await request<Row>(`Team/${encodeURIComponent(id)}`);
        return [id, Array.isArray(team.positionList) ? team.positionList.map(String) : []] as const;
      } catch { return [id, []] as const; }
    })).then((items) => {
      if (!live) return;
      setTeamPositionOptions(Object.fromEntries(items));
      setTeamPositionLoading(Object.fromEntries(ids.map((id) => [id, false])));
    });
    return () => { live = false; };
  }, [entity, name, selectedRelationKey]);
  useEffect(() => { if (type === "linkParent" && value?.type) setParentEntity(value.type); }, [type, value?.type]);
  useEffect(() => { if (type === "linkParent" && !parentEntity && parentEntityList.length) setParentEntity(parentEntityList[0]); }, [type, parentEntity, parentEntityList.join(",")]);
  useEffect(() => {
    if (!targetEntity || !["link", "linkOne", "linkMultiple", "linkParent"].includes(type)) { setOptions([]); return; }
    let live = true;
    const params = new URLSearchParams({ maxSize: "50", offset: "0", orderBy: "name", order: "asc" });
    if (relationSearch.trim()) { params.set("where[0][type]", "contains"); params.set("where[0][attribute]", "name"); params.set("where[0][value]", relationSearch.trim()); }
    if (assignedUserField) {
      params.set("primaryFilter", "active");
      if (assignmentPermission === "team") params.append("boolFilterList[]", "onlyMyTeam");
    }
    if (entity === "EmailFilter" && name === "parent" && targetEntity === "User") params.set("primaryFilter", "active");
    if (entity === "WorkingTimeRange" && name === "users" && targetEntity === "User") params.set("primaryFilter", "active");
    if (entity === "Webhook" && name === "user" && targetEntity === "User") params.set("primaryFilter", "activeApi");
    if (["Meeting", "Call"].includes(entity) && name === "users") {
      params.set("primaryFilter", "active");
      if ((metadata.userAcl as any)?.assignmentPermission === "team") params.append("boolFilterList[]", "onlyMyTeam");
    }
    if (emailFilterFolderUserScoped) {
      const index = relationSearch.trim() ? 1 : 0;
      params.set(`where[${index}][type]`, "equals"); params.set(`where[${index}][attribute]`, "assignedUserId"); params.set(`where[${index}][value]`, emailFilterFolderParentId);
    }
    if (emailFolderUserScoped) {
      const index = relationSearch.trim() ? 1 : 0;
      params.set(`where[${index}][type]`, "equals"); params.set(`where[${index}][attribute]`, "assignedUserId"); params.set(`where[${index}][value]`, emailFolderAssignedUserId);
    }
    request<PageResult>(`${encodeURIComponent(targetEntity)}?${params}`).then(async (result) => {
      let list = result.list || [];
      const missingIds = [currentId, ...selectedRelationIds].filter((id): id is string => Boolean(id) && !list.some((row) => row.id === id));
      const selected = await Promise.all(missingIds.map((id) => request<Row>(`${encodeURIComponent(targetEntity)}/${encodeURIComponent(id)}`).catch(() => null)));
      list = [...selected.filter((row): row is Row => Boolean(row)), ...list];
      if (live) setOptions(list);
    }).catch(() => live && setOptions([]));
    return () => { live = false; };
  }, [targetEntity, type, currentId, relationSearch, selectedRelationKey, entity, name, relatedContext?.parent?.type, relatedContext?.parent?.id, assignedUserField, assignmentPermission, emailFolderUserScoped, emailFolderAssignedUserId, emailFilterFolderUserScoped, emailFilterFolderParentId]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    if (type === "image") {
      const file = fileList[0];
      if (def.maxFileSize && file.size > Number(def.maxFileSize) * 1024 * 1024) { setFileError(`Soubor překračuje limit ${def.maxFileSize} MB.`); return; }
      setImageCropFile(file);
      return;
    }
    if (type === "attachmentMultiple" && Number(def.maxCount) > 0) {
      const existingCount = Array.isArray(value) ? value.length : 0;
      if (existingCount + fileList.length > Number(def.maxCount)) { setFileError(`Pole může obsahovat nejvýše ${def.maxCount} souborů. Odeberte některé soubory nebo vyberte menší počet.`); return; }
    }
    setFileBusy(true); onUploading?.(true); setFileError(""); onError?.("");
    try {
      const uploaded: Array<{ id: string; name: string; type: string }> = [];
      for (const file of Array.from(fileList)) {
        if (def.maxFileSize && file.size > Number(def.maxFileSize) * 1024 * 1024) throw new Error(`Soubor překračuje limit ${def.maxFileSize} MB.`);
        const attachment = await uploadAttachment(file, entity, name, type === "attachmentMultiple");
        uploaded.push(attachment); onUploaded?.(attachment.id);
      }
      onChange(type === "attachmentMultiple" ? [...(Array.isArray(value) ? value : []), ...uploaded] : uploaded[0]);
    } catch (e) { const message = e instanceof Error ? e.message : "Soubor se nepodařilo nahrát."; setFileError(message); onError?.(message); }
    finally { setFileBusy(false); onUploading?.(false); }
  }

  async function addAttachmentSourceRecords(source: string, rows: Row[]) {
    setFileBusy(true); setFileError(""); onError?.(""); onUploading?.(true);
    try {
      const maxCount = Number(def.maxCount || 0);
      const next = [...(Array.isArray(value) ? value : [])] as Array<{ id: string; name: string; type?: string }>;
      let exceededLimit = false;
      for (const row of rows) {
        const items: Row[] = source === "Attachment"
          ? [row]
          : await request<Row[]>(`${encodeURIComponent(source)}/action/getAttachmentList`, { method: "POST", body: JSON.stringify({ id: row.id, field: name, parentType: entity }) });
        for (const item of items) {
          const attachment = { id: String(item.id), name: String(item.name || item.fileName || "Soubor"), type: String(item.type || item.mimeType || "") };
          if (!attachment.id || next.some((current) => current.id === attachment.id)) continue;
          if (maxCount && next.length >= maxCount) { exceededLimit = true; continue; }
          next.push(attachment);
        }
      }
      onChange(next);
      if (exceededLimit) setFileError(`Byl dosažen limit ${maxCount} souborů; další vybrané přílohy nebyly přidány.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Soubory ze zvoleného záznamu se nepodařilo přidat.";
      setFileError(message); onError?.(message);
    } finally { setFileBusy(false); onUploading?.(false); }
  }
  const controlProps = { id: `field-${name}`, value: value ?? "", onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(e.target.value), required: def.required, maxLength: def.maxLength, min: def.min, disabled: Boolean(def.readOnly || def.disabled) };
  const handleControlChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const next = event.target.value;
    const normalized = ["datetime", "datetimeOptional"].includes(type) ? espocrmDateTimeFromInput(next, fieldTimeZone) : next;
    onChange(entity === "Portal" && name === "customId" && next ? encodeURIComponent(next.replace(/ /i, "-").toLowerCase()) : normalized);
  };
  const inputLabel = <span>{label}{def.required && <i> *</i>}</span>;
  if (entity === "Settings" && name === "availableReactions") {
    const reactions = (((metadata.app as any)?.reactions?.list || []) as Array<{ type: string; iconClass?: string }>);
    const options = reactions.map((item) => item.type).filter(Boolean);
    const labels = (metadata.labels as any)?.Global?.reactions || {};
    const iconClasses = Object.fromEntries(reactions.map((item) => [item.type, item.iconClass || "fas fa-face-smile"]));
    return <ArrayFieldInput label={inputLabel} value={Array.isArray(value) ? value.map(String) : []} disabled={Boolean(def.readOnly || def.disabled)} keepItems={false} allowCustomOptions={false} pattern="" maxCount={Number(def.maxCount || 9)} maxLength={100} options={options} optionLabels={labels} iconClasses={iconClasses} onChange={onChange}/>;
  }
  if (["array", "urlMultiple"].includes(type)) {
    const rawPattern = String(def.pattern || "");
    const namedPattern = /^\$([\w-]+)$/.exec(rawPattern);
    const pattern = namedPattern ? String((metadata.app as any)?.regExpPatterns?.[namedPattern[1]]?.pattern || rawPattern) : rawPattern;
    return <ArrayFieldInput label={inputLabel} value={Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split("\n").filter(Boolean) : []} disabled={Boolean(def.readOnly || def.disabled)} keepItems={Boolean(def.keepItems)} allowCustomOptions={Boolean(def.allowCustomOptions)} pattern={pattern} maxCount={def.maxCount} maxLength={def.maxItemLength || (type === "urlMultiple" ? 255 : 100)} options={resolvedOptions.options.map(String)} optionLabels={resolvedOptions.labels} urlMode={type === "urlMultiple"} stripProtocol={Boolean(def.strip)} onChange={onChange}/>;
  }
  if (type === "url") return <UrlFieldInput label={inputLabel} value={String(value || "")} disabled={Boolean(def.readOnly || def.disabled)} required={Boolean(def.required)} maxLength={Number(def.maxLength || 255)} stripProtocol={Boolean(def.strip)} onChange={onChange}/>;
  if (type === "wysiwyg") return <div className={`field-input html-field ${def.required ? "required" : ""}`}><span>{inputLabel}</span><HtmlFieldEditor entity={entity} metadata={metadata} value={value} onChange={onChange} htmlMode={entity !== "EmailTemplate" || relatedContext?.isHtml !== false} fieldName={name} disabled={Boolean(def.readOnly || def.disabled)}/></div>;
  if (type === "address") {
    const current = value || {};
    const parts = [["street", "Ulice"], ["city", "Město"], ["state", "Kraj / stát"], ["postalCode", "PSČ"], ["country", "Země"]];
    return <fieldset className="field-input address-input" disabled={fieldDisabled}><legend>{inputLabel}</legend><div className="address-input-grid">{parts.map(([key, caption]) => <label key={key} className={key === "street" ? "address-street" : ""}><span>{caption}</span><input value={current[key] || ""} required={key === "street" && def.required} disabled={fieldDisabled} onChange={(event) => onChange({ ...current, [key]: event.target.value })}/></label>)}</div></fieldset>;
  }
  if (type === "personName") {
    const current = value || {};
    return <fieldset className="field-input person-name-field" disabled={fieldDisabled}><legend>{inputLabel}</legend><div className="person-name-controls">{[["firstName", "Jméno"], ["middleName", "Prostřední jméno"], ["lastName", "Příjmení"]].map(([key, caption]) => <label key={key}><span>{caption}</span><input value={current[key] || ""} disabled={fieldDisabled} onChange={(event) => onChange({ ...current, [key]: event.target.value })} required={key === "lastName" && def.required}/></label>)}</div></fieldset>;
  }
  if (["link", "linkOne", "linkMultiple"].includes(type) && relationEntity) {
    const multi = type === "linkMultiple";
    const currentValue = multi ? (Array.isArray(value) ? value : []) : value || "";
    const sessionUserAssigned = Boolean(sessionUser && (multi ? currentValue.includes(sessionUser.id) : currentValue === sessionUser.id));
    const assignToCurrentUser = () => {
      if (!sessionUser) return;
      if (multi) onChange([...new Set([...currentValue, sessionUser.id])]);
      else onChange(sessionUser.id);
    };
    const rowName = (row: Row) => row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.userName || row.emailAddress || row.id;
    const selectedRows = multi ? currentValue.map((id: string) => options.find((row) => row.id === id) || { id, name: id }) : [];
    const availableRows = multi ? options.filter((row) => !currentValue.includes(row.id)) : options;
    const columnDefs = Object.entries(linkMultipleColumns(entity, name, def)).map(([key, foreignField]) => {
      const field = String(foreignField);
      const foreignDef = metadata.entityDefs?.[relationEntity]?.fields?.[field];
      const localDef = metadata.entityDefs?.[entity]?.fields?.[field];
      const columnScope = foreignDef ? relationEntity : localDef ? entity : relationEntity;
      const attendeeStatus = ["Meeting", "Call"].includes(entity) && key === "status";
      return attendeeStatus
        ? { key, field, scope: entity, def: { ...(metadata.entityDefs?.[entity]?.fields?.acceptanceStatus || {}), label: "acceptanceStatus" } }
        : { key, field, scope: columnScope, def: foreignDef || localDef || (entity === "Settings" && name === "oidcTeams" && key === "group" ? { type: "varchar", label: "IdP Group", maxLength: 255, placeholder: "IdP Group" } : {}) };
    });
    const primaryField = def.primaryLink || (entity === "Contact" && name === "accounts" ? "account" : "");
    const primaryValue = primaryId || (primaryField ? currentValue[0] || "" : "");
    const setColumnValue = (id: string, key: string, nextValue: any) => onColumnsChange && onColumnsChange({ ...columns, [id]: { ...(columns[id] || {}), [key]: nextValue } });
    const removeSelected = (id: string) => {
      const nextIds = currentValue.filter((item: string) => item !== id);
      onChange(nextIds);
      if (onColumnsChange) { const next = { ...columns }; delete next[id]; onColumnsChange(next); }
      if (primaryField && primaryValue === id) {
        const nextPrimary = nextIds[0] || "";
        onPrimaryChange?.(nextPrimary, rowName(options.find((item) => item.id === nextPrimary) || {}));
      }
    };
    const addSelected = () => {
      if (!relationPick) return;
      const selected = options.find((row) => row.id === relationPick);
      onChange([...currentValue, relationPick]);
      if (onColumnsChange && columnDefs.length) {
        const values = Object.fromEntries(columnDefs.map(({ key, def: columnDef }) => [key, columnDef.default ?? (columnDef.type === "bool" ? false : null)]));
        onColumnsChange({ ...columns, [relationPick]: { ...(columns[relationPick] || {}), ...values } });
      }
      if (primaryField && !primaryValue) onPrimaryChange?.(relationPick, selected ? rowName(selected) : relationPick);
      setRelationPick("");
    };
    const columnOptions = (column: typeof columnDefs[number], rowId: string) => {
      const optionList: Array<string | number> = column.def.options || [];
      const existing = columns[rowId]?.[column.key];
      return existing != null && !optionList.map(String).includes(String(existing)) ? [...optionList, existing] : optionList;
    };
    const selectRelatedRecords = (selected: Row[]) => {
      if (multi) {
        const nextIds = selected.map((row) => row.id);
        onChange(nextIds);
        if (onColumnsChange && columnDefs.length) {
          const nextColumns = { ...columns };
          for (const row of selected) if (!nextColumns[row.id]) nextColumns[row.id] = Object.fromEntries(columnDefs.map(({ key, def: columnDef }) => [key, columnDef.default ?? (columnDef.type === "bool" ? false : null)]));
          for (const id of Object.keys(nextColumns)) if (!nextIds.includes(id)) delete nextColumns[id];
          onColumnsChange(nextColumns);
        }
        if (primaryField) {
          const nextPrimary = nextIds.includes(primaryValue) ? primaryValue : nextIds[0] || "";
          const primaryRow = selected.find((row) => row.id === nextPrimary);
          onPrimaryChange?.(nextPrimary, primaryRow ? rowName(primaryRow) : "");
        }
      } else onChange(selected[0]?.id || "");
      setSelectRecordsOpen(false);
    };
    const canCreateRelated = !emailAccountEmailFolder && !emailFilterEmailFolder && !isCategoryTree && !["User", "Team", "Role", "Portal"].includes(relationEntity) && canCreateEntity(metadata, relationEntity);
    const createRelated = (created: Row) => {
      setOptions((current) => [created, ...current.filter((row) => row.id !== created.id)]);
      if (multi) selectRelatedRecords([...selectedRows, created]);
      else { onChange(created.id); setSelectRecordsOpen(false); }
      setRelatedCreateEntity("");
    };
    return <><div className="field-input relationship-picker"><span>{inputLabel}</span><button type="button" className="button subtle relationship-open-picker" onClick={() => setSelectRecordsOpen(true)} disabled={fieldDisabled}>{isCategoryTree ? (multi ? `Vybrat kategorie (${currentValue.length})…` : currentValue ? `Změnit kategorii · ${rowName(options.find((row) => row.id === currentValue) || { id: currentValue })}` : "Vybrat kategorii…") : (multi ? `Vybrat záznamy (${currentValue.length})…` : currentValue ? `Změnit záznam · ${rowName(options.find((row) => row.id === currentValue) || { id: currentValue })}` : "Vybrat záznam…")}</button>{assignedUserField && !def.autocompleteOnEmpty && sessionUser && !sessionUserAssigned && <button type="button" className="button subtle" onClick={assignToCurrentUser} disabled={fieldDisabled}>Přiřadit mně</button>}{!(emailAccountEmailFolder || emailFilterEmailFolder) && <input type="search" value={relationSearch} onChange={(event) => setRelationSearch(event.target.value)} placeholder={`Hledat ${entityLabel(metadata, relationEntity, true).toLocaleLowerCase("cs")}…`}/> }{multi ? <>
      <div className="relationship-selected">
        {selectedRows.map((row: Row) => <div className="relationship-selected-row" key={row.id}>
          <div className="relationship-selected-head"><strong>{rowName(row)}</strong><div>{primaryField && <button type="button" disabled={fieldDisabled} className={`relationship-primary-toggle ${primaryValue === row.id ? "active" : ""}`} title={primaryValue === row.id ? "Primární záznam" : "Nastavit jako primární"} aria-label={primaryValue === row.id ? `${rowName(row)} je primární` : `Nastavit ${rowName(row)} jako primární`} onClick={() => onPrimaryChange?.(row.id, rowName(row))}>{primaryValue === row.id ? "★" : "☆"}</button>}<button type="button" disabled={fieldDisabled} className="relationship-remove" onClick={() => removeSelected(row.id)} aria-label={`Odebrat ${rowName(row)}`}>×</button></div></div>
          {columnDefs.length > 0 && <div className="relationship-column-values">{columnDefs.map((column) => {
            const columnLabel = entity === "Settings" && name === "oidcTeams" && column.key === "group" ? "IdP Group" : fieldLabel(column.field, column.def, column.scope, metadata);
            const current = columns[row.id]?.[column.key];
            const onValue = (next: any) => setColumnValue(row.id, column.key, next);
            if (entity === "User" && name === "teams" && column.key === "role") {
              const positions = teamPositionOptions[row.id] || [];
              const values = [...new Set(["", ...positions, ...(current && !positions.includes(String(current)) ? [String(current)] : [])])];
              if (teamPositionLoading[row.id] && !positions.length && !current) return <span className="field-hint" key={column.key}>Načítám pozice týmu…</span>;
              if (!positions.length && !current && !teamPositionLoading[row.id]) return null;
              return <label className="relationship-column-control" key={column.key}><span>{columnLabel}</span><select aria-label={`Pozice v týmu ${rowName(row)}`} value={String(current || "")} disabled={Boolean(column.def.readOnly || column.def.disabled || teamPositionLoading[row.id])} onChange={(event) => onValue(event.target.value || null)}><option value="">Bez pozice</option>{values.filter(Boolean).map((position) => <option key={position} value={position}>{position}</option>)}</select></label>;
            }
            if (column.def.type === "bool") return <label className="relationship-column-bool" key={column.key}><input type="checkbox" checked={Boolean(current)} disabled={Boolean(column.def.readOnly || column.def.disabled)} onChange={(event) => onValue(event.target.checked)}/><span>{columnLabel}</span></label>;
            if (["enum", "enumInt", "enumFloat"].includes(column.def.type || "")) return <label className="relationship-column-control" key={column.key}><span>{columnLabel}</span><select value={current == null ? "" : String(current)} disabled={Boolean(column.def.readOnly || column.def.disabled)} onChange={(event) => onValue(column.def.type === "enumFloat" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}><option value="">—</option>{columnOptions(column, row.id).map((option) => <option key={String(option)} value={String(option)}>{(metadata.labels as any)?.[column.scope]?.options?.[column.field]?.[String(option)] || String(option)}</option>)}</select></label>;
            return <label className="relationship-column-control" key={column.key}><span>{columnLabel}</span><input type={["int", "float", "currency"].includes(column.def.type || "") ? "number" : column.def.type === "date" ? "date" : "text"} value={current == null ? "" : String(current)} disabled={Boolean(column.def.readOnly || column.def.disabled)} maxLength={column.def.maxLength} placeholder={column.def.placeholder || (entity === "Settings" && name === "oidcTeams" && column.key === "group" ? "IdP Group" : undefined)} onChange={(event) => onValue(["int", "float", "currency"].includes(column.def.type || "") && event.target.value !== "" ? Number(event.target.value) : event.target.value)}/></label>;
          })}</div>}
        </div>)}
        {!selectedRows.length && <small>Zatím nejsou vybrány žádné záznamy.</small>}
      </div>
      <div className="relationship-add"><select disabled={fieldDisabled} value={relationPick} onChange={(event) => setRelationPick(event.target.value)}><option value="">{availableRows.length ? "Vyberte záznam k přidání…" : "Žádné další výsledky"}</option>{availableRows.map((row) => <option key={row.id} value={row.id}>{rowName(row)}</option>)}</select><button type="button" className="button subtle" disabled={fieldDisabled || !relationPick} onClick={addSelected}>Přidat</button></div>
    </> : <select id={`field-${name}`} disabled={fieldDisabled} value={currentValue} onChange={(event) => onChange(event.target.value)}><option value="">Nevybráno</option>{options.map((row) => <option key={row.id} value={row.id}>{rowName(row)}</option>)}</select>}<small className="field-hint">Výsledky se vyhledávají v celé databázi CRM.</small></div>{selectRecordsOpen && (isCategoryTree ? <CategoryTreeDialog entity={relationEntity} metadata={metadata} multiple={multi} selectedIds={multi ? currentValue : currentValue ? [currentValue] : []} selectedRows={options} onClose={() => setSelectRecordsOpen(false)} onSelect={selectRelatedRecords}/> : <SelectRecordsDialog entity={relationEntity} metadata={metadata} multiple={multi} selectedIds={multi ? currentValue : currentValue ? [currentValue] : []} selectedRows={options} primaryFilter={assignedUserField ? "active" : noteUsersPrimaryFilter || (["Meeting", "Call"].includes(entity) && name === "users" || entity === "EmailFilter" && name === "parent" || entity === "WorkingTimeRange" && name === "users" ? "active" : entity === "Webhook" && name === "user" ? "activeApi" : undefined)} boolFilterList={assignedUserField && assignmentPermission === "team" ? ["onlyMyTeam"] : noteUsersBoolFilterList.length ? noteUsersBoolFilterList : ["Meeting", "Call"].includes(entity) && name === "users" && (metadata.userAcl as any)?.assignmentPermission === "team" ? ["onlyMyTeam"] : []} filterList={noteUsersFilterList} fixedWhere={emailFolderUserScoped ? [{ type: "equals", attribute: "assignedUserId", value: emailFolderAssignedUserId }] : emailFilterFolderUserScoped ? [{ type: "equals", attribute: "assignedUserId", value: emailFilterFolderParentId }] : []} onCreate={canCreateRelated ? () => { setRelatedCreateEntity(relationEntity); setSelectRecordsOpen(false); } : undefined} onClose={() => setSelectRecordsOpen(false)} onSelect={selectRelatedRecords}/>) }{relatedCreateEntity && <RecordEditor entity={relatedCreateEntity} fields={getFormFields(metadata, relatedCreateEntity)} metadata={metadata} onClose={() => setRelatedCreateEntity("")} onSaved={createRelated}/>}</>;
  }
  if (type === "linkParent") return <><div className={`field-input ${def.required ? "required" : ""}`}><span>{inputLabel}</span><div className="link-parent-controls"><select disabled={fieldDisabled} value={parentEntity} onChange={(event) => { setParentEntity(event.target.value); onChange({ type: event.target.value, id: "" }); }}><option value="">Typ záznamu…</option>{parentEntityList.map((target) => <option key={target} value={target}>{entityLabel(metadata, target)}</option>)}</select>{parentEntity && <button type="button" className="button subtle" disabled={fieldDisabled} onClick={() => setSelectRecordsOpen(true)}>{value?.id ? "Změnit záznam…" : "Vybrat záznam…"}</button>}<select value={value?.id || ""} disabled={fieldDisabled || !parentEntity} onChange={(event) => onChange({ type: parentEntity, id: event.target.value })}><option value="">Vyberte záznam…</option>{options.map((row) => <option key={row.id} value={row.id}>{row.name || row.subject || row.userName || row.id}</option>)}</select></div></div>{selectRecordsOpen && parentEntity && <SelectRecordsDialog entity={parentEntity} metadata={metadata} multiple={false} selectedIds={value?.id ? [value.id] : []} selectedRows={options} primaryFilter={entity === "EmailFilter" && name === "parent" && parentEntity === "User" ? "active" : undefined} onCreate={!(["User", "Team", "Role", "Portal"].includes(parentEntity)) && canCreateEntity(metadata, parentEntity) ? () => { setRelatedCreateEntity(parentEntity); setSelectRecordsOpen(false); } : undefined} onClose={() => setSelectRecordsOpen(false)} onSelect={(rows) => { onChange({ type: parentEntity, id: rows[0]?.id || "" }); setSelectRecordsOpen(false); }}/ >}{relatedCreateEntity && <RecordEditor entity={relatedCreateEntity} fields={getFormFields(metadata, relatedCreateEntity)} metadata={metadata} onClose={() => setRelatedCreateEntity("")} onSaved={(created) => { setOptions((current) => [created, ...current.filter((row) => row.id !== created.id)]); onChange({ type: relatedCreateEntity, id: created.id }); setRelatedCreateEntity(""); }}/>}</>;
  if (["file", "image", "attachmentMultiple"].includes(type)) {
    const files: Array<{ id: string; name: string; type?: string }> = type === "attachmentMultiple" ? (Array.isArray(value) ? value : []) : value ? [value] : [];
    const images = files.filter((file) => type === "image" || file.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || ""));
    return <><div className="field-input file-field"><span>{inputLabel}</span><div className="file-field-list">{files.map((file, index) => <div key={`${file.id}-${index}`}>{images.some((image) => image.id === file.id) ? <button type="button" className="file-download" onClick={() => setImagePreview({ images, index: images.findIndex((image) => image.id === file.id) })}>{file.name || "Obrázek"} · Zobrazit náhled</button> : <button type="button" className="file-download" onClick={() => void downloadAttachment(file.id, file.name)}>{file.name || "Soubor"}</button>}<button type="button" className="file-remove" disabled={Boolean(def.readOnly || def.disabled)} onClick={() => onChange(type === "attachmentMultiple" ? files.filter((_, i) => i !== index) : null)} aria-label="Odebrat soubor">×</button></div>)}</div><div className="file-picker-actions"><label className="file-picker"><input type="file" disabled={Boolean(def.readOnly || def.disabled) || fileBusy} accept={(def.accept || (type === "image" ? ["image/*"] : [])).join(",")} multiple={type === "attachmentMultiple"} onChange={(event) => { void handleFiles(event.target.files); event.currentTarget.value = ""; }}/><span>{fileBusy ? "Nahrávám…" : type === "attachmentMultiple" ? "Přidat soubory" : "Vybrat soubor"}</span></label>{attachmentSourceList.map((source: string) => <button type="button" key={source} className="button subtle" disabled={Boolean(def.readOnly || def.disabled) || fileBusy || Boolean(def.maxCount && files.length >= Number(def.maxCount))} onClick={() => setAttachmentSource(source)}>Přidat z {entityLabel(metadata, source, true)}</button>)}</div>{fileError && <small className="field-error">{fileError}</small>}</div>{attachmentSource && <SelectRecordsDialog entity={attachmentSource} metadata={metadata} multiple selectedIds={[]} selectedRows={[]} primaryFilter={attachmentSourceDef.primaryFilter} boolFilterList={attachmentSourceDef.boolFilterList || []} fixedWhere={attachmentSourceFixedWhere} onClose={() => setAttachmentSource("")} onSelect={(rows) => { const source = attachmentSource; setAttachmentSource(""); void addAttachmentSourceRecords(source, rows); }}/ >}{imagePreview && <ImagePreviewDialog images={imagePreview.images} index={imagePreview.index} onIndexChange={(index) => setImagePreview((current) => current ? { ...current, index } : null)} onClose={() => setImagePreview(null)}/ >}{imageCropFile && <ImageCropDialog file={imageCropFile} onCancel={() => setImageCropFile(null)} onCrop={async (cropped) => { setFileBusy(true); onUploading?.(true); setFileError(""); onError?.(""); try { const attachment = await uploadAttachment(cropped, entity, name); onChange(attachment); onUploaded?.(attachment.id); setImageCropFile(null); } catch (cause) { const message = cause instanceof Error ? cause.message : "Oříznutý obrázek se nepodařilo nahrát."; setFileError(message); onError?.(message); } finally { setFileBusy(false); onUploading?.(false); } }}/>}</>;
  }

  if (entity === "OAuthProvider" && name === "authorizationParams") return <OAuthAuthorizationParams value={value} label={label} onChange={onChange}/>;
  if (type === "text") return <><label className={`field-input text-field-input ${def.required ? "required" : ""}`} htmlFor={`field-${name}`}>{inputLabel}<textarea {...controlProps} rows={3} value={typeof value === "string" ? value : value == null ? "" : String(value)} onKeyDown={(event) => {
    if (event.key !== "Enter") return;
    const target = event.currentTarget; const before = target.value.slice(0, target.selectionStart); const after = target.value.slice(target.selectionEnd);
    const match = /(^|\n)([ \t]*(?:[-*]|\d+\.) )([^\n]*)$/.exec(before); if (!match) return;
    event.preventDefault();
    if (!match[3].trim()) { const next = before.slice(0, before.length - match[2].length) + "\n" + after; onChange(next); const caret = next.length - after.length; requestAnimationFrame(() => target.setSelectionRange(caret, caret)); return; }
    let marker = match[2]; const numbered = /( *)(\d+)\./.exec(marker); if (numbered) marker = `${numbered[1]}${Number(numbered[2]) + 1}. `;
    const next = `${before}\n${marker}${after}`; onChange(next); const caret = before.length + 1 + marker.length; requestAnimationFrame(() => target.setSelectionRange(caret, caret));
  }} onInput={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, window.innerHeight * .6)}px`; }}/><button type="button" className="button subtle text-preview-trigger" disabled={!value} onClick={() => setTextPreviewOpen(true)}><Eye size={13}/>Náhled formátovaného textu</button></label>{textPreviewOpen && <TextPreviewDialog text={String(value || "")} onClose={() => setTextPreviewOpen(false)}/>}</>;
  return <label className={`field-input ${def.required ? "required" : ""}`} htmlFor={`field-${name}`}>{inputLabel}
    {type === "bool" ? <span className="switch-row"><input id={`field-${name}`} type="checkbox" disabled={Boolean(def.readOnly || def.disabled)} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /><span>Ano / Ne</span></span>
      : ["enum", "enumInt", "enumFloat"].includes(type) ? <select {...controlProps} value={value == null ? "" : String(value)} onChange={(event) => onChange(type === "enumFloat" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}><option value="">{entity === "KnowledgeBaseArticle" && name === "language" ? "Jakýkoli jazyk" : "Vyberte…"}</option>{fieldOptions.filter((option) => option !== "").map((option) => <option key={option} value={String(option)}>{optionLabel(option)}</option>)}</select>
      : type === "multiEnum" ? (() => { const rawPattern = String(def.pattern || ""); const namedPattern = /^\$([\w-]+)$/.exec(rawPattern); const pattern = namedPattern ? String((metadata.app as any)?.regExpPatterns?.[namedPattern[1]]?.pattern || rawPattern) : rawPattern; return <ArrayFieldInput label={inputLabel} value={Array.isArray(value) ? value.map(String) : []} disabled={Boolean(def.readOnly || def.disabled)} keepItems={Boolean(def.keepItems)} allowCustomOptions={Boolean(def.allowCustomOptions)} pattern={pattern} maxCount={def.maxCount} maxLength={def.maxItemLength || 100} options={dynamicEnumOptions.map(String)} optionLabels={dynamicOptionLabels} onChange={onChange}/>; })()
      : type === "arrayInt" ? <select id={`field-${name}`} disabled={Boolean(def.readOnly || def.disabled)} multiple size={Math.min(Math.max(dynamicEnumOptions.length, 3), 7)} value={Array.isArray(value) ? value.map(String) : []} onChange={(e) => { const selected = Array.from(e.currentTarget.selectedOptions, (option) => option.value); onChange(selected.map(Number).filter(Number.isFinite)); }}>{dynamicEnumOptions.map((option) => <option key={option} value={String(option)}>{optionLabel(option)}</option>)}</select>
      : type === "checklist" ? <div className="checklist-field">{resolvedOptions.options.map((option) => { const checked = Array.isArray(value) && value.map(String).includes(String(option)); const limitReached = Number(def.maxCount) > 0 && (Array.isArray(value) ? value.length : 0) >= Number(def.maxCount); return <label key={option}><input type="checkbox" disabled={Boolean(def.readOnly || def.disabled) || (!checked && limitReached)} checked={checked} onChange={(event) => onChange(event.target.checked ? [...(Array.isArray(value) ? value : []), option] : (Array.isArray(value) ? value : []).filter((item) => String(item) !== String(option)))}/>{optionLabel(option)}</label>; })}</div>
      : ["text", "wysiwyg", "jsonObject", "jsonArray", "array", "urlMultiple"].includes(type) ? <textarea {...controlProps} rows={type === "text" || type === "wysiwyg" ? 3 : 5} value={typeof value === "string" ? value : value == null ? "" : Array.isArray(value) ? value.join("\n") : JSON.stringify(value, null, 2)} placeholder={["array", "urlMultiple"].includes(type) ? "Jedna hodnota na řádek" : ["jsonObject", "jsonArray"].includes(type) ? "{}" : undefined}/>
      : <input {...controlProps} onChange={handleControlChange} type={type === "date" ? "date" : ["datetime", "datetimeOptional"].includes(type) ? "datetime-local" : type === "password" ? "password" : type === "colorpicker" ? "color" : type === "email" ? "email" : type === "url" ? "url" : type === "phone" ? "tel" : ["int", "float", "currency"].includes(type) ? "number" : "text"} value={type === "datetime" || type === "datetimeOptional" ? formatEspoDateTimeInput(String(value || ""), fieldTimeZone) : value ?? ""} step={type === "float" || type === "currency" ? "any" : undefined} autoComplete={type === "password" ? "new-password" : undefined} />}
  </label>;
}

function MultipleContactField({ label, email, rows, options, phonePattern, disabled, required, onlyPrimary, maxCount, maxLength, defaultOptOut, onChange }: { label: string; email: boolean; rows: Row[]; options: string[]; phonePattern: RegExp; disabled: boolean; required: boolean; onlyPrimary: boolean; maxCount: number; maxLength: number; defaultOptOut: boolean; onChange: (rows: Row[]) => void }) {
  const empty = () => ({ [email ? "emailAddress" : "phoneNumber"]: "", primary: true, optOut: defaultOptOut, invalid: false, ...(email ? { lower: "" } : { type: options[0] || "Other" }) });
  const [items, setItems] = useState<Row[]>(() => rows.length ? rows.map((item) => ({ ...item })) : [empty()]);
  const key = email ? "emailAddress" : "phoneNumber";
  const normalizedItems = items.filter((item) => String(item[key] || "").trim());
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const duplicate = (index: number) => items.some((item, itemIndex) => itemIndex !== index && String(item[key] || "").trim().toLowerCase() === String(items[index]?.[key] || "").trim().toLowerCase() && String(item[key] || "").trim());
  const update = (next: Row[]) => {
    if (!next.length) next = [empty()];
    setItems(next);
    const clean: Row[] = next.filter((item) => String(item[key] || "").trim()).map((item) => ({ ...item, [key]: String(item[key]).trim(), ...(email ? { lower: String(item[key]).trim().toLowerCase() } : {}) }));
    let primary = clean.findIndex((item) => item.primary);
    if (primary < 0 && clean.length) primary = 0;
    clean.forEach((item, index) => { item.primary = index === primary; });
    if (primary > 0) { const [first] = clean.splice(primary, 1); clean.unshift(first); }
    onChange(clean);
  };
  const add = () => { if (disabled || !normalizedItems.length || (maxCount > 0 && normalizedItems.length >= maxCount)) return; update([...items, empty()]); };
  return <fieldset className={`field-input multiple-contact-field ${email ? "email-multiple-field" : "phone-multiple-field"}`} disabled={disabled}><legend>{label}{required && <i> *</i>}</legend><div className="multiple-contact-list">{items.map((item, index) => {
    const raw = String(item[key] || ""); const invalid = Boolean(raw) && (email ? !emailPattern.test(raw) : !phonePattern.test(raw)) && !item.invalid; const repeated = Boolean(raw) && duplicate(index);
    return <div className="multiple-contact-row" key={index}><div className="multiple-contact-main"><label className="multiple-contact-input"><span>{index === 0 && items.length === 1 ? (email ? "E-mailová adresa" : "Telefonní číslo") : `${email ? "E-mail" : "Telefon"} ${index + 1}`}</span><input type="text" inputMode={email ? "email" : "tel"} autoComplete={email ? "email" : "tel"} autoCapitalize="none" autoCorrect="off" maxLength={maxLength || undefined} value={raw} required={required && index === 0} aria-invalid={invalid || repeated} onChange={(event) => { event.currentTarget.setCustomValidity(""); update(items.map((current, i) => i === index ? { ...current, [key]: event.target.value } : current)); }} onBlur={(event) => event.currentTarget.setCustomValidity(invalid || repeated ? (repeated ? "Tato hodnota už je v seznamu." : email ? "Zadejte platnou e-mailovou adresu, nebo označte adresu jako neplatnou." : "Zkontrolujte formát telefonního čísla.") : "")} placeholder={email ? "jmeno@firma.cz" : "+420 123 456 789"}/></label>{!email && <label className="multiple-contact-type"><span>Typ</span><select value={item.type || options[0] || "Other"} onChange={(event) => update(items.map((current, i) => i === index ? { ...current, type: event.target.value } : current))}>{options.length ? options.map((option) => <option key={option} value={option}>{option}</option>) : <option value="Other">Ostatní</option>}</select></label>}</div><div className="multiple-contact-actions"><button type="button" className={`contact-property ${item.primary ? "active" : ""}`} onClick={() => update(items.map((current, i) => ({ ...current, primary: i === index })))} aria-pressed={Boolean(item.primary)}>Primární</button>{!onlyPrimary && <><button type="button" className={`contact-property ${item.optOut ? "active" : ""}`} onClick={() => update(items.map((current, i) => i === index ? { ...current, optOut: !current.optOut } : current))} aria-pressed={Boolean(item.optOut)}>Odhlášeno</button><button type="button" className={`contact-property ${item.invalid ? "active" : ""}`} onClick={(event) => { event.currentTarget.closest(".multiple-contact-row")?.querySelector("input")?.setCustomValidity(""); update(items.map((current, i) => i === index ? { ...current, invalid: !current.invalid } : current)); }} aria-pressed={Boolean(item.invalid)}>Neplatné</button></>}{!onlyPrimary && items.length > 1 && <button type="button" className="icon-button danger-ghost" aria-label={`Odebrat ${email ? "adresu" : "telefon"} ${index + 1}`} onClick={() => update(items.filter((_, i) => i !== index))}><Trash2 size={13}/></button>}</div>{invalid && <small className="field-error">{email ? "Zadejte platnou e-mailovou adresu." : "Zkontrolujte formát telefonního čísla."}</small>}{repeated && <small className="field-error">Tato hodnota už je v seznamu.</small>}</div>;
  })}</div>{!onlyPrimary && (!maxCount || normalizedItems.length < maxCount) && <button type="button" className="button subtle multiple-contact-add" onClick={add} disabled={disabled || !normalizedItems.length || Boolean(items.some((item) => !String(item[key] || "").trim()))}><Plus size={13}/> Přidat {email ? "adresu" : "telefon"}</button>}</fieldset>;
}

function ArrayFieldInput({ label, value, disabled, keepItems, allowCustomOptions, pattern, maxCount, maxLength, options, optionLabels, iconClasses = {}, urlMode = false, stripProtocol = false, onChange }: { label: React.ReactNode; value: string[]; disabled: boolean; keepItems: boolean; allowCustomOptions: boolean; pattern: string; maxCount?: number; maxLength?: number; options: string[]; optionLabels: Record<string, string>; iconClasses?: Record<string, string>; urlMode?: boolean; stripProtocol?: boolean; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const add = (raw: string) => {
    let next = raw.trim();
    if (pattern && next) {
      try {
        if (!new RegExp(`^(?:${pattern})$`).test(next)) { setError("Položka neodpovídá nastavenému vzoru."); return; }
      } catch { /* An invalid server pattern must not block editing. */ }
    }
    if (urlMode) {
      if (stripProtocol) next = next.replace(/^[a-z][a-z\d+.-]*:\/\//i, "").replace(/\/+$/, "");
      try {
        if (next === decodeURI(next)) next = encodeURI(next);
        const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(next) ? next : `https://${next}`);
        if (!/^https?:$/.test(parsed.protocol) || (!parsed.hostname.includes(".") && parsed.hostname !== "localhost")) throw new Error();
      } catch { setError("Zadejte platnou webovou adresu, například https://example.com."); return; }
    }
    if (!next || value.includes(next) || options.length && !allowCustomOptions && !options.includes(next) || (maxCount && value.length >= maxCount)) return;
    onChange([...value, next]); setDraft("");
    setError("");
  };
  const move = (index: number, offset: number) => {
    const target = index + offset; if (target < 0 || target >= value.length) return;
    const next = [...value]; [next[index], next[target]] = [next[target], next[index]]; onChange(next);
  };
  const safeUrl = (item: string) => { try { const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(item) ? item : `https://${item}`); return /^https?:$/.test(url.protocol) ? url.toString() : null; } catch { return null; } };
  const addSelected = (selected: string[]) => { const remaining = maxCount ? Math.max(0, maxCount - value.length) : selected.length; onChange([...value, ...selected.filter((item) => !value.includes(item)).slice(0, remaining)]); setPickerOpen(false); };
  return <><div className={`field-input native-array-field ${urlMode ? "url-multiple-field" : ""}`}><span>{label}</span><div className="native-array-items">{value.map((item, index) => <div className="native-array-item" key={`${item}-${index}`}><span>{iconClasses[item] && <EspoIcon className={iconClasses[item]} size={16}/>} {urlMode ? safeUrl(item) ? <a href={safeUrl(item) || undefined} target="_blank" rel="noreferrer">{item}</a> : item : optionLabels[item] || item}</span><div><button type="button" className="icon-button" aria-label={`Posunout ${item} nahoru`} disabled={disabled || index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" className="icon-button" aria-label={`Posunout ${item} dolů`} disabled={disabled || index === value.length - 1} onClick={() => move(index, 1)}>↓</button>{!keepItems && <button type="button" className="icon-button danger-ghost" aria-label={`Odebrat ${item}`} disabled={disabled} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div></div>)}{!value.length && <small className="field-hint">Zatím nejsou přidané žádné položky.</small>}</div>{!disabled && !keepItems && (!maxCount || value.length < maxCount) && <div className="native-array-add">{options.length && !allowCustomOptions ? <button type="button" className="button subtle" onClick={() => setPickerOpen(true)}>Vybrat z nabídky…</button> : <><input value={draft} maxLength={maxLength} placeholder={urlMode ? "https://example.com" : "Nová položka…"} onChange={(event) => { setDraft(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(draft); } }}/><button type="button" className="button subtle" disabled={!draft.trim()} onClick={() => add(draft)}>Přidat</button>{options.length > 0 && <button type="button" className="button subtle" onClick={() => setPickerOpen(true)}>Vybrat z nabídky…</button>}</>}</div>}{error && <small className="field-error">{error}</small>}</div>{pickerOpen && <ArrayOptionsPickerDialog options={options} labels={optionLabels} iconClasses={iconClasses} selected={value} remaining={maxCount ? Math.max(0, maxCount - value.length) : options.length} onClose={() => setPickerOpen(false)} onSelect={addSelected}/>}</>;
}

function ArrayOptionsPickerDialog({ options, labels, iconClasses = {}, selected, remaining, onClose, onSelect }: { options: string[]; labels: Record<string, string>; iconClasses?: Record<string, string>; selected: string[]; remaining: number; onClose: () => void; onSelect: (values: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const filtered = options.filter((option) => !selected.includes(option)).filter((option) => !query.trim() || `${labels[option] || option} ${option}`.toLocaleLowerCase("cs").split(/\s+/).some((part) => part.startsWith(query.trim().toLocaleLowerCase("cs"))));
  const toggle = (option: string, isChecked: boolean) => setChecked((current) => isChecked ? current.length < remaining ? [...current, option] : current : current.filter((item) => item !== option));
  return <div className="modal-backdrop array-options-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="record-modal array-options-dialog" role="dialog" aria-modal="true" aria-labelledby="array-options-title"><div className="modal-heading"><div><span className="eyebrow">VÝBĚR POLOŽEK</span><h2 id="array-options-title">Přidat možnosti</h2><p>{remaining === options.length ? "Vyberte jednu nebo více položek." : `Můžete přidat nejvýše ${remaining} položek.`}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={16}/></button></div><label className="array-options-search"><Search size={14}/><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat možnost…"/><span>{filtered.length}</span></label><div className="array-options-list">{filtered.map((option) => { const checkedNow = checked.includes(option); const disabled = !checkedNow && checked.length >= remaining; return <label key={option} className={disabled ? "disabled" : ""}><input type="checkbox" checked={checkedNow} disabled={disabled} onChange={(event) => toggle(option, event.target.checked)}/>{iconClasses[option] && <EspoIcon className={iconClasses[option]} size={16}/>}<span>{labels[option] || option}</span>{labels[option] && <small>{option}</small>}</label>; })}{!filtered.length && <p className="field-manager-empty">Žádné dostupné možnosti.</p>}</div><div className="modal-footer"><span>{checked.length} vybráno</span><button type="button" className="button subtle" onClick={onClose}>Zrušit</button><button type="button" className="button primary" disabled={!checked.length} onClick={() => onSelect(checked)}>Přidat vybrané</button></div></section></div>;
}

type TimeRange = [string | null, string | null];
const timeOptions = Array.from({ length: 49 }, (_, index) => {
  const minute = index * 30;
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
});
function normalizeCalendarTime(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const [hour, minute] = value.split(":");
  return `${String(Number(hour)).padStart(2, "0")}:${String(Number(minute || 0)).padStart(2, "0")}`;
}
function validateTimeRanges(value: unknown, required: boolean) {
  const ranges = Array.isArray(value) ? value as TimeRange[] : [];
  if (!ranges.length) return required ? "Přidejte alespoň jeden časový interval." : "";
  let previousEnd = -1;
  for (let index = 0; index < ranges.length; index++) {
    const start = normalizeCalendarTime(ranges[index]?.[0]);
    const end = normalizeCalendarTime(ranges[index]?.[1]);
    if (!start || !end) return `Doplňte začátek i konec intervalu ${index + 1}.`;
    const startMinute = timeOptions.indexOf(start) * 30;
    let endMinute = end === "00:00" ? 1440 : timeOptions.indexOf(end) * 30;
    if (startMinute < 0 || endMinute < 0) return "Použijte časy po 30 minutách.";
    if (endMinute < startMinute || (endMinute === startMinute && start !== "00:00")) return `Konec intervalu ${index + 1} musí být po jeho začátku.`;
    if (previousEnd >= 0 && (previousEnd > startMinute || previousEnd === 1440)) return "Intervaly se nesmí překrývat a musí být seřazené podle začátku.";
    previousEnd = endMinute;
  }
  return "";
}
function TimeRangesEditor({ label, value, disabled, required, onChange }: { label: string; value: unknown; disabled: boolean; required: boolean; onChange: (value: TimeRange[] | null) => void }) {
  const ranges: TimeRange[] = Array.isArray(value) ? value.map((range) => [normalizeCalendarTime(range?.[0]) || null, normalizeCalendarTime(range?.[1]) || null]) : [];
  const error = validateTimeRanges(ranges, required);
  const setRange = (index: number, position: 0 | 1, next: string) => onChange(ranges.map((range, rangeIndex) => rangeIndex === index ? (position === 0 ? [next || null, range[1]] : [range[0], next || null]) : range));
  const addRange = () => {
    const previous = ranges.at(-1);
    const start = previous?.[1] && previous[1] !== "00:00" ? previous[1] : null;
    onChange([...ranges, [start, null]]);
  };
  return <div className={`field-input time-ranges-field ${error ? "invalid" : ""}`}><span>{label}{required && <i> *</i>}</span><div className="time-ranges-list">{ranges.map((range, index) => <div className="time-range-row" key={index}><label><small>Od</small><select aria-label={`${label} interval ${index + 1} od`} value={range[0] || ""} disabled={disabled} onChange={(event) => setRange(index, 0, event.target.value)}><option value="">Čas…</option>{timeOptions.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}</select></label><span className="time-range-separator">—</span><label><small>Do</small><select aria-label={`${label} interval ${index + 1} do`} value={range[1] || ""} disabled={disabled} onChange={(event) => setRange(index, 1, event.target.value)}><option value="">Čas…</option>{timeOptions.map((time) => <option key={time} value={time}>{time === "00:00" ? "00:00 / půlnoc" : time}</option>)}</select></label><button type="button" className="icon-button danger-ghost" aria-label={`Odebrat interval ${index + 1}`} disabled={disabled} onClick={() => onChange(ranges.filter((_, rangeIndex) => rangeIndex !== index))}><Trash2 size={14}/></button></div>)}{!ranges.length && <small className="field-hint">{required ? "Je potřeba alespoň jeden interval." : "Použijí se výchozí intervaly kalendáře."}</small>}</div>{!disabled && <button type="button" className="button subtle time-range-add" onClick={addRange} disabled={Boolean(ranges.at(-1)?.[1] === "00:00" || ranges.at(-1)?.[1] === "24:00")}><Plus size={13}/> Přidat interval</button>}{error && <small className="field-error">{error}</small>}</div>;
}

function EmptyState({ label }: { label: string }) { return <div className="empty-state"><span><Database size={21}/></span><p>{label}</p></div>; }

function recordFieldDisplayValue(entity: string, name: string, record: Row): any {
  const value = record[name];
  if (entity === "Job" && name === "name" && !value) return [record.serviceName, record.methodName].filter((part) => part != null && part !== "").join(": ");
  return value;
}

function displayValue(value: any, def?: FieldDef): string {
  if (value == null || value === "") return "";
  if (def?.type === "bool" || typeof value === "boolean") return value ? "Ano" : "Ne";
  if (typeof value === "object") return Array.isArray(value) ? value.join(", ") : value.name || value.value || JSON.stringify(value);
  return String(value);
}

function formatCurrency(value: unknown, currency: unknown, metadata: Metadata): string {
  if (value == null || value === "") return "";
  const settings = metadata.appSettings || {};
  const code = String(currency || settings.defaultCurrency || (metadata.app as any)?.currency?.list?.[0] || "USD");
  try { return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: code, maximumFractionDigits: Number(settings.currencyDecimalPlaces ?? 2) }).format(Number(value)); }
  catch { return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(Number(value))} ${code}`; }
}

function UrlFieldDisplay({ value, multiple = false, copyToClipboard = false }: { value: unknown; multiple?: boolean; copyToClipboard?: boolean }) {
  const [copied, setCopied] = useState("");
  const values = (Array.isArray(value) ? value : multiple && typeof value === "string" ? value.split("\n") : [value]).map((item) => String(item || "").trim()).filter(Boolean);
  const urlFor = (item: string) => {
    try { const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(item) ? item : `https://${item}`); return /^https?:$/.test(parsed.protocol) ? parsed.toString() : null; }
    catch { return null; }
  };
  if (!values.length) return <strong>—</strong>;
  async function copy(item: string) { try { await navigator.clipboard.writeText(item); setCopied(item); window.setTimeout(() => setCopied(""), 1800); } catch { setCopied(""); } }
  return <span className="url-field-display">{values.map((item, index) => { let label = item; try { label = decodeURI(item); } catch { /* Keep malformed legacy values readable. */ } const href = urlFor(item); return <span key={`${item}-${index}`}>{href ? <a href={href} target="_blank" rel="noreferrer">{label}</a> : label}{copyToClipboard && <button type="button" className="url-copy-button" title="Kopírovat odkaz" aria-label="Kopírovat odkaz" onClick={() => void copy(item)}>{copied === item ? <Check size={12}/> : <Copy size={12}/>}</button>}</span>; })}</span>;
}

function CopyableValue({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = String(value ?? "");
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }
  return <span className="url-field-display"><span>{text}</span><button type="button" className="url-copy-button" title={copied ? "Zkopírováno" : "Kopírovat"} aria-label={copied ? "Zkopírováno" : "Kopírovat"} onClick={() => void copy()}>{copied ? <Check size={12}/> : <Copy size={12}/>}</button></span>;
}

function ContactFieldDisplay({ value, type }: { value: unknown; type: string }) {
  const text = String(value || "").trim();
  if (!text) return <strong>—</strong>;
  const phoneHref = `tel:${text.replace(/[^\d+*#;,]/g, "")}`;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  return <span className="contact-field-display">{type === "phone" ? <a href={phoneHref}>{text}</a> : validEmail ? <a href={`mailto:${encodeURIComponent(text)}`}>{text}</a> : text}</span>;
}

function UrlFieldInput({ label, value, disabled, required, maxLength, stripProtocol, onChange }: { label: React.ReactNode; value: string; disabled: boolean; required: boolean; maxLength: number; stripProtocol: boolean; onChange: (value: string) => void }) {
  const [error, setError] = useState("");
  function normalize(raw: string) {
    let next = raw.trim();
    if (stripProtocol) next = next.replace(/^[a-z][a-z\d+.-]*:\/\//i, "").replace(/\/+$/, "");
    try { if (next === decodeURI(next)) next = encodeURI(next); } catch { /* Preserve malformed legacy text for correction. */ }
    return next;
  }
  function validate(raw: string) {
    const next = raw.trim();
    if (!next) return required ? "Toto pole je povinné." : "";
    if (next.length > maxLength) return `Adresa může mít nejvýše ${maxLength} znaků.`;
    try { const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(next) ? next : `https://${next}`); if (!/^https?:$/.test(url.protocol) || (!url.hostname.includes(".") && url.hostname !== "localhost")) throw new Error(); return ""; }
    catch { return "Zadejte platnou webovou adresu."; }
  }
  return <label className={`field-input ${required ? "required" : ""}`}><span>{label}</span><input type="text" inputMode="url" spellCheck={false} autoCapitalize="none" autoCorrect="off" value={value} disabled={disabled} required={required} maxLength={maxLength} placeholder="https://example.com" onChange={(event) => { onChange(event.target.value); setError(""); event.currentTarget.setCustomValidity(""); }} onBlur={(event) => { const normalized = normalize(event.target.value); const validationMessage = validate(normalized); onChange(normalized); setError(validationMessage); event.currentTarget.setCustomValidity(validationMessage); }}/>{error && <small className="field-error">{error}</small>}</label>;
}

function metadataPathValue(root: any, path: string | undefined): any {
  if (!path) return undefined;
  return path.split(".").filter(Boolean).reduce((node, part) => node?.[part], root);
}

function canAccessAttachmentSource(metadata: Metadata, source: string): boolean {
  const sourceDef = (metadata.clientDefs?.Attachment as any)?.sourceDefs?.[source] || {};
  if (sourceDef.configCheck && !metadataPathValue(metadata.appSettings, String(sourceDef.configCheck))) return false;
  const user = getSession()?.user as any;
  const idList = (value: any): string[] => Array.isArray(value) ? value.map((item) => String(typeof item === "object" ? item.id : item)) : value && typeof value === "object" ? Object.keys(value) : [];
  const teamIds = new Set<string>(idList(user?.teamsIds || user?.teamIds || user?.teams));
  const portalIds = new Set<string>(idList(user?.portalsIds || user?.portalIds || user?.portals || (user?.portalId ? [user.portalId] : [])));
  for (const condition of (sourceDef.accessDataList || []) as Row[]) {
    if (condition.scope && aclLevel(metadata, String(condition.scope), String(condition.action || "read")) === "no") return false;
    if (condition.teamIdList?.length && !condition.teamIdList.some((id: string) => teamIds.has(String(id)))) return false;
    if (condition.portalIdList?.length && !condition.portalIdList.some((id: string) => portalIds.has(String(id)))) return false;
    if (condition.isPortalOnly && user?.type !== "portal") return false;
    if (condition.inPortalDisabled && user?.type === "portal") return false;
    if (condition.isAdminOnly && user?.type !== "admin") return false;
  }
  return true;
}

function nativeForeignFieldDef(metadata: Metadata | undefined, entity: string | undefined, def: FieldDef): FieldDef {
  if (!metadata || def.type !== "foreign" || !entity || !def.link || !def.field) return def;
  const foreignEntity = metadata.entityDefs?.[entity]?.links?.[String(def.link)]?.entity;
  const source = foreignEntity ? metadata.entityDefs?.[foreignEntity]?.fields?.[String(def.field)] : undefined;
  if (!source) return def;
  return {
    ...source,
    ...def,
    type: source.type || "varchar",
    options: def.options?.length ? def.options : source.options,
    optionsPath: def.optionsPath || source.optionsPath,
    optionsReference: def.optionsReference || source.optionsReference,
    translation: def.translation || source.translation,
    style: def.style || source.style,
    translatedOptions: def.translatedOptions || source.translatedOptions,
  };
}

function nativeFieldOptions(metadata: Metadata, entity: string, name: string, def: FieldDef) {
  def = nativeForeignFieldDef(metadata, entity, def);
  const [referenceEntity, referenceField] = String(def.optionsReference || "").split(".");
  const referencedDef = referenceEntity && referenceField ? metadata.entityDefs?.[referenceEntity]?.fields?.[referenceField] : undefined;
  const optionsPath = def.optionsPath || (referencedDef ? `entityDefs.${referenceEntity}.fields.${referenceField}.options` : undefined);
  const rawOptions = optionsPath ? metadataPathValue(metadata, optionsPath) : def.options?.length ? def.options : referencedDef?.options;
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  const translationPath = def.translation || (referencedDef ? `${referenceEntity}.options.${referenceField}` : undefined);
  const translated = metadataPathValue(metadata.labels, translationPath);
  const localOptions = (metadata.labels as any)?.[entity]?.options?.[name] || {};
  return {
    options,
    labels: { ...localOptions, ...(translated && typeof translated === "object" ? translated : {}), ...(def.translatedOptions || {}) },
    style: def.style || referencedDef?.style || {},
  };
}

function EnumValue({ value, def, metadata, entity, name }: { value: unknown; def?: FieldDef; metadata?: Metadata; entity?: string; name?: string }) {
  const raw = String(value ?? "");
  if (!raw) return <span className="muted-cell">—</span>;
  const labels = metadata?.labels as any;
  const directOptions = labels?.[entity || ""]?.options?.[name || ""];
  const resolved = metadata && entity && name && def ? nativeFieldOptions(metadata, entity, name, def) : null;
  const translationPath = String(def?.translation || "").split(".").filter(Boolean);
  let translated: any = directOptions?.[raw] || resolved?.labels?.[raw] || def?.translatedOptions?.[raw];
  if (!translated && translationPath.length) {
    let node: any = labels;
    for (const part of translationPath) node = node?.[part];
    translated = node?.[raw];
  }
  const text = String(translated || raw);
  let styleMap = resolved?.style || def?.style || {};
  if (!Object.keys(styleMap).length && def?.optionsReference) {
    const [referenceEntity, referenceField] = String(def.optionsReference).split(".");
    styleMap = metadata?.entityDefs?.[referenceEntity]?.fields?.[referenceField]?.style || {};
  }
  const style = String(styleMap?.[raw] || "default");
  const shouldLabel = Boolean(def?.displayAsLabel) || def?.labelType === "state";
  if (!shouldLabel || (style === "default" && def?.labelType !== "state")) return <span>{text}</span>;
  const allowedStyle = ["warning", "danger", "success", "info", "primary"].includes(style) ? style : "default";
  return <span className={`enum-value-label ${allowedStyle} ${def?.labelType === "state" ? "state" : ""}`}>{text}</span>;
}

function taskDeadlineState(record: Row, timeZone: string): { kind: "overdue" | "today" | "normal" | "none"; date: Date | null; dateOnly: boolean } {
  const dateOnly = Boolean(record.dateEndDate);
  const raw = dateOnly ? record.dateEndDate : record.dateEnd;
  if (!raw) return { kind: "none", date: null, dateOnly };
  if (["Completed", "Canceled"].includes(String(record.status || ""))) {
    const parsed = dateOnly ? new Date(`${String(raw).slice(0, 10)}T12:00:00Z`) : new Date(`${String(raw).replace(" ", "T")}Z`);
    return { kind: "normal", date: Number.isNaN(parsed.getTime()) ? null : parsed, dateOnly };
  }
  const date = dateOnly ? new Date(`${String(raw).slice(0, 10)}T12:00:00Z`) : new Date(`${String(raw).replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return { kind: "none", date: null, dateOnly };
  if (dateOnly) {
    const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const today = `${todayParts.find((part) => part.type === "year")?.value}-${todayParts.find((part) => part.type === "month")?.value}-${todayParts.find((part) => part.type === "day")?.value}`;
    const dueDay = String(raw).slice(0, 10);
    return { kind: dueDay < today ? "overdue" : dueDay === today ? "today" : "normal", date, dateOnly };
  }
  return { kind: date.getTime() < Date.now() ? "overdue" : "normal", date, dateOnly };
}

function TaskDeadlineDisplay({ record, timeZone, detailed = false }: { record: Row; timeZone: string; detailed?: boolean }) {
  const state = taskDeadlineState(record, timeZone);
  if (!state.date) return <span className="muted-cell">—</span>;
  let formatted = "";
  try {
    formatted = new Intl.DateTimeFormat("cs-CZ", state.dateOnly
      ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone }).format(state.date);
  } catch {
    formatted = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric" }).format(state.date);
  }
  const label = state.kind === "overdue" ? "Po termínu" : state.kind === "today" ? "Dnes" : "";
  return <span className={`task-due-date ${state.kind}${detailed ? " detailed" : ""}`}><Clock3 size={13}/><time>{formatted}</time>{label && <span className="task-due-state">{label}</span>}</span>;
}

function ReminderDisplay({ value, metadata }: { value: unknown; metadata: Metadata }) {
  const reminders = Array.isArray(value) ? value as Array<{ type?: string; seconds?: number }> : [];
  if (!reminders.length) return <span className="reminder-display-empty">Bez připomínek</span>;
  const translatedTypes = (metadata.labels as any)?.Global?.options?.reminderTypes || {};
  const formatOffset = (raw: unknown) => {
    let seconds = Math.max(0, Number(raw) || 0);
    if (!seconds) return "Na čas";
    const days = Math.floor(seconds / 86400); seconds %= 86400;
    const hours = Math.floor(seconds / 3600); seconds %= 3600;
    const minutes = Math.floor(seconds / 60); seconds %= 60;
    return `${[days ? `${days} d` : "", hours ? `${hours} h` : "", minutes ? `${minutes} min` : "", seconds ? `${seconds} s` : ""].filter(Boolean).join(" ")} před`;
  };
  return <ul className="reminder-display-list">{reminders.map((item, index) => <li key={`${item.type || "Popup"}-${item.seconds || 0}-${index}`}><Bell size={13}/><span>{translatedTypes[item.type || "Popup"] || (item.type === "Email" ? "E-mail" : "Vyskakovací oznámení")}</span><strong>{formatOffset(item.seconds)}</strong></li>)}</ul>;
}

function eventStartStyle(record: Row, entity: string, metadata: Metadata, timeZone: string): "danger" | "warning" | "" {
  if (!(entity === "Meeting" || entity === "Call") || !record.status) return "";
  const notActual = [...((metadata.scopes[entity] as any)?.completedStatusList || []), ...((metadata.scopes[entity] as any)?.canceledStatusList || [])].map(String);
  if (notActual.includes(String(record.status))) return "";
  const allDay = entity === "Meeting" && Boolean(record.isAllDay);
  const toDate = (field: "dateStart" | "dateEnd") => {
    const value = allDay ? record[`${field}Date`] : record[field];
    if (!value) return null;
    const normalized = allDay ? dateFilterBoundaryInTimeZone(String(value), timeZone, field === "dateEnd") : String(value);
    const date = parseEspoCalendarDateTime(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const end = toDate("dateEnd");
  if (end && end.getTime() < Date.now()) return "danger";
  const start = toDate("dateStart");
  if (start && start.getTime() < Date.now()) return "warning";
  return "";
}

function EventStartDisplay({ record, entity, metadata, timeZone, value }: { record: Row; entity: "Meeting" | "Call"; metadata: Metadata; timeZone: string; value: unknown }) {
  const style = eventStartStyle(record, entity, metadata, timeZone);
  const formatted = record.isAllDay && entity === "Meeting" && value ? new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)) : formatEspoDateTime(String(value || ""), timeZone);
  return <span className={`event-start-display ${style}`}><span>{formatted}</span>{style && <small>{style === "danger" ? "Po plánovaném konci" : "Právě probíhá"}</small>}</span>;
}

function ActivityRowActions({ scope, row, expanded, onToggle, onOpen, onEdit, canEdit, canDelete, canChangeStatus, canComplete, onComplete, onSetStatus, onRemove, busy }: { scope: string; row: Row; expanded: boolean; onToggle: () => void; onOpen: () => void; onEdit: () => void; canEdit: boolean; canDelete: boolean; canChangeStatus: boolean; canComplete: boolean; onComplete: () => void; onSetStatus: (status: "Held" | "Not Held") => void; onRemove: () => void; busy: boolean }) {
  const label = scope === "Task" ? "úkolu" : scope === "Meeting" ? "schůzky" : "hovoru";
  return <div className="task-row-actions"><button type="button" className="row-more task-row-menu-trigger" aria-label={`Akce ${label} ${row.name || ""}`} aria-haspopup="menu" aria-expanded={expanded} onClick={(event) => { event.stopPropagation(); onToggle(); }}><ChevronDown size={14}/></button>{expanded && <div className="task-row-menu" role="menu" onClick={(event) => event.stopPropagation()}><button type="button" role="menuitem" autoFocus onClick={onOpen}><ExternalLink size={14}/> Otevřít</button>{canEdit && <button type="button" role="menuitem" onClick={onEdit}><Pencil size={14}/> Upravit</button>}{canComplete && <button type="button" role="menuitem" disabled={busy} onClick={onComplete}><Check size={14}/> Dokončit</button>}{canChangeStatus && !["Held", "Not Held"].includes(row.status) && <><button type="button" role="menuitem" disabled={busy} onClick={() => onSetStatus("Held")}><Check size={14}/> Označit jako proběhlé</button><button type="button" role="menuitem" disabled={busy} onClick={() => onSetStatus("Not Held")}><X size={14}/> Označit jako neproběhlé</button></>}{canDelete && <button type="button" role="menuitem" className="danger" disabled={busy} onClick={onRemove}><Trash2 size={14}/> Odstranit</button>}</div>}</div>;
}

function renderCell(value: any, def?: FieldDef, currency?: unknown, metadata?: Metadata, entity?: string, name?: string, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") {
  if (def) def = nativeForeignFieldDef(metadata, entity, def);
  if (name === "reminders" && ["Meeting", "Call", "Task"].includes(String(entity))) return <ReminderDisplay value={value} metadata={metadata!}/>;
  if (["url", "urlMultiple"].includes(String(def?.type))) return <UrlFieldDisplay value={value} multiple={def?.type === "urlMultiple"} copyToClipboard={Boolean(def?.copyToClipboard)}/>;
  if (["email", "emailAddress", "phone"].includes(String(def?.type))) return <ContactFieldDisplay value={value} type={String(def?.type)}/>;
  const text = def?.type === "currency" && metadata ? formatCurrency(value, currency, metadata) : def?.type === "currencyConverted" && metadata ? formatCurrency(value, metadata.appSettings?.defaultCurrency, metadata) : displayValue(value, def);
  if (!text) return <span className="muted-cell">—</span>;
  if (def?.copyToClipboard && ["varchar", "number"].includes(def.type || "")) return <CopyableValue value={text}/>;
  if (def?.type?.startsWith("enum")) return <EnumValue value={value} def={def} metadata={metadata} entity={entity} name={name}/>;
  if (["status", "stage", "type"].includes(def?.label || "")) return <span className={`status-chip ${/won|customer|active|held|converted|closed/i.test(text) ? "success" : /lost|failed|cancel|new|draft/i.test(text) ? "neutral" : "info"}`}><i/>{text}</span>;
  if (def?.type === "date" || def?.type === "datetime") return formatEspoDateTime(text, timeZone);
  if (def?.type === "currency" || def?.type === "float" || def?.type === "int") return <span className="numeric-cell">{text}</span>;
  return text;
}

function formatDate(value: any) {
  if (!value || typeof value !== "string") return "—";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatMailDate(value: string) {
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("cs-CZ", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }).format(date);
}

export default App;
