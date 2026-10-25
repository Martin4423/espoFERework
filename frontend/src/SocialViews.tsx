import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { Activity, ArrowDown, ArrowLeft, Bell, Check, ChevronRight, Eye, EyeSlash, Globe, LoaderCircle, Mail, MessageSquare, Paperclip, RefreshCw, Search, Send, Trash2, UserRound, Users, X } from "./Icons";
import { canAccessEntity, entityLabel, humanize, request, uploadAttachment } from "./api";
import type { Metadata, User } from "./api";
import { StreamItem, type Note } from "./RecordStream";
import SelectRecordsDialog from "./SelectRecordsDialog";
import { formatEspoDateTime, useEspoTimeZone } from "./timeZone";

type Page<T> = { list?: T[]; total?: number };
type NotificationItem = Record<string, any>;
const PAGE_SIZE = 20;

function customNotificationMessage(item: NotificationItem, metadata: Metadata) {
  const type = String(item.type || "");
  const key = type ? type[0].toLocaleLowerCase() + type.slice(1) : "";
  const data = item.data || {};
  const note = item.noteData || {};
  const parents = [item.relatedParentType, item.relatedType, note.parentType].filter((value): value is string => typeof value === "string");
  const dictionaries = (metadata.labels as any) || {};
  const template = parents.map((parent) => dictionaries[parent]?.notificationMessages?.[key]).find((value) => typeof value === "string") || dictionaries.Global?.notificationMessages?.[key];
  if (typeof template !== "string" || !template) return "";
  const entityType = data.entityType || note.parentType || item.relatedParentType || item.relatedType || "";
  const values: Record<string, string> = {
    entityType: entityType ? entityLabel(metadata, entityType) : "",
    entity: String(data.entityName || note.parentName || item.relatedParentName || data.emailName || ""),
    user: String(data.userName || note.createdByName || item.createdByName || ""),
    assignee: String(data.assigneeName || data.assignedUserName || ""),
    mentioned: String(data.mentionedName || data.mentionedUserName || ""),
    from: String(data.fromString || data.personEntityName || ""),
    post: String(note.post || data.post || ""),
    invitee: String(data.inviteeName || ""),
    type: String(data.type || ""),
  };
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => values[name] || match);
}

function notificationTitle(item: NotificationItem, metadata: Metadata) {
  const data = item.data || {};
  const note = item.noteData || {};
  const actor = note.createdByName || item.createdByName || data.userName;
  const entityType = data.entityType || item.relatedParentType || item.relatedType;
  if (item.message) return item.message;
  if (item.type === "Note" && note.type === "EventConfirmation") {
    const statusKey = String(note.data?.status || "Tentative");
    const status = (metadata.labels as any)?.Meeting?.options?.acceptanceStatus?.[statusKey] || ({ Accepted: "přijal/a", Declined: "odmítl/a", Tentative: "se zatím nerozhodl/a" } as Record<string, string>)[statusKey] || "odpověděl/a";
    return actor ? `${actor} ${status} pozvánku` : "Odpověď na pozvánku";
  }
  if (item.type === "Note") return actor ? `Nová aktivita od ${actor}` : "Nová aktivita";
  if (item.type === "MentionInPost") return actor ? `${actor} vás zmínil/a v příspěvku` : "Zmínka v příspěvku";
  if (item.type === "UserReaction") {
    const reaction = (metadata.labels as any)?.Global?.reactions?.[data.type] || data.type;
    return actor ? `${actor} reagoval/a na příspěvek${reaction ? ` · ${reaction}` : ""}` : "Reakce na příspěvek";
  }
  if (item.type === "Assign") return entityType ? `Byl vám přiřazen ${entityLabel(metadata, entityType)}` : "Záznam vám byl přiřazen";
  if (item.type === "EventAttendee") return customNotificationMessage(item, metadata) || (actor ? `${actor} vás přidal/a k události` : "Byli jste přidáni k události");
  if (item.type === "EmailInbox") return actor ? `${actor} přidal/a e-mail do vaší schránky` : "Nový e-mail ve schránce";
  if (item.type === "EmailReceived") return "Nový e-mail";
  if (item.type === "EntityRemoved") return actor ? `${actor} odstranil/a záznam` : "Záznam byl odstraněn";
  if (item.type === "System") return data.message || "Systémové oznámení";
  const customView = (metadata.clientDefs?.Notification as any)?.itemViews?.[String(item.type || "")];
  return customView ? customNotificationMessage(item, metadata) || `Oznámení · ${humanize(item.type || "")}` : humanize(item.type || "Oznámení");
}

function notificationDetail(item: NotificationItem, metadata: Metadata) {
  const data = item.data || {};
  const note = item.noteData || {};
  const entityType = data.entityType || note.parentType || item.relatedParentType || item.relatedType;
  const entityName = data.entityName || data.emailName || note.parentName || item.relatedParentName;
  const post = String(note.post || "").replace(/\s+/g, " ").trim();
  if (["Note", "MentionInPost", "UserReaction"].includes(item.type)) return post || (entityName && entityType ? `${entityLabel(metadata, entityType)} · ${entityName}` : "Otevřít související příspěvek");
  if (["Assign", "EntityRemoved", "EventAttendee", "EmailInbox"].includes(item.type)) return [entityName, entityType ? entityLabel(metadata, entityType) : ""].filter(Boolean).join(" · ") || "Otevřít související záznam";
  if (item.type === "EmailReceived") return [data.emailName || data.subject, data.personEntityName || data.fromString].filter(Boolean).join(" · ") || "Otevřít doručený e-mail";
  if (item.type === "Message") return "";
  return entityName && entityType ? `${entityLabel(metadata, entityType)} · ${entityName}` : item.type || "";
}

function NotificationMessage({ item }: { item: NotificationItem }) {
  const message = String(item.message || item.data?.message || "");
  const html = DOMPurify.sanitize(marked.parse(message) as string);
  return <div className="notification-message" dangerouslySetInnerHTML={{ __html: html }}/>;
}

function NotificationTypeIcon({ type }: { type: string }) {
  if (type === "EmailReceived") return <Mail size={14}/>;
  if (type === "Assign" || type === "EntityRemoved") return <UserRound size={14}/>;
  if (type === "Note" || type === "MentionInPost" || type === "UserReaction") return <MessageSquare size={14}/>;
  if (type === "System") return <Activity size={14}/>;
  return <Bell size={14}/>;
}

function openNotification(item: NotificationItem, onOpenRecord: (scope: string, id: string) => void) {
  const note = item.noteData || {};
  const related = item.related || {};
  const data = item.data || {};
  if (item.type === "EmailReceived" && data.emailId) { onOpenRecord("Email", data.emailId); return; }
  const scope = note.parentType || item.relatedParentType || item.relatedType || related.type || data.entityType || data.scope;
  const id = note.parentId || item.relatedParentId || item.relatedId || related.id || data.entityId || data.id;
  if (scope && id) onOpenRecord(scope, id);
}

async function updateNotificationRead(item: NotificationItem, read: boolean) {
  await request(`Notification/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify({ read }) });
}

export function NotificationPanel({ metadata, onClose, onOpenList, onOpenRecord, onUnreadChange }: { metadata: Metadata; onClose: () => void; onOpenList: () => void; onOpenRecord: (scope: string, id: string) => void; onUnreadChange: () => void }) {
  const timeZone = useEspoTimeZone();
  const maxItems = Math.max(1, Number(metadata.appParams?.notificationsMaxSize) || 5);
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const result = await request<Page<NotificationItem>>(`Notification?maxSize=${maxItems}&offset=0`); setItems(result.list || []); onUnreadChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, [maxItems, onUnreadChange]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, []);
  function handlePanelKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) { event.preventDefault(); panelRef.current.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  async function markAllRead() {
    setWorking(true); setError("");
    try { await request("Notification/action/markAllRead", { method: "POST", body: JSON.stringify({}) }); setItems((old) => old.map((item) => ({ ...item, read: true }))); onUnreadChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo označit jako přečtená."); }
    finally { setWorking(false); }
  }
  async function remove(item: NotificationItem) {
    setWorking(true); setError("");
    try { await request(`Notification/${encodeURIComponent(item.id)}`, { method: "DELETE" }); setItems((old) => old.filter((entry) => entry.id !== item.id)); onUnreadChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo odstranit."); }
    finally { setWorking(false); }
  }
  async function toggleRead(item: NotificationItem) {
    const read = !item.read;
    setWorking(true); setError("");
    try { await updateNotificationRead(item, read); setItems((old) => old.map((entry) => entry.id === item.id ? { ...entry, read } : entry)); onUnreadChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Stav oznámení se nepodařilo změnit."); }
    finally { setWorking(false); }
  }
  return <div className="notification-popover-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={panelRef} tabIndex={-1} className="notification-popover surface" role="dialog" aria-modal="true" aria-label="Oznámení" aria-busy={busy} onKeyDown={handlePanelKeyDown} onMouseDown={(event) => event.stopPropagation()}>
    <header><div><strong>Oznámení</strong><small>Poslední upozornění na vašem účtu</small></div><button type="button" className="button subtle" onClick={() => void markAllRead()} disabled={working}><Check size={13}/>Označit vše</button></header>
    {error && <div className="table-error">{error}<button type="button" onClick={() => void load()}>Zkusit znovu</button></div>}
    <div className="notification-popover-list">{busy ? <div className="table-loading"><span className="spinner"/>Načítám oznámení…</div> : items.length ? items.map((item) => <article className={`notification-row ${item.read ? "is-read" : "is-unread"} ${item.type === "Message" ? "has-notification-message" : ""}`} key={item.id}><button className="notification-main" onClick={() => { openNotification(item, onOpenRecord); onClose(); }}><span className="notification-icon"><NotificationTypeIcon type={item.type}/></span><span className="notification-copy"><strong>{item.type === "Message" ? "Otevřít zprávu" : notificationTitle(item, metadata)}</strong>{item.type !== "Message" && notificationDetail(item, metadata) && <span>{notificationDetail(item, metadata)}</span>}<time>{item.createdAt ? formatEspoDateTime(item.createdAt, timeZone) : ""}</time></span>{!item.read && <i className="notification-unread-dot"/>}</button>{item.type === "Message" && <div className="notification-message-content"><NotificationMessage item={item}/></div>}<button type="button" className="notification-remove notification-read-toggle" aria-label={item.read ? "Označit jako nepřečtené" : "Označit jako přečtené"} title={item.read ? "Označit jako nepřečtené" : "Označit jako přečtené"} disabled={working} onClick={() => void toggleRead(item)}>{item.read ? <EyeSlash size={13}/> : <Eye size={13}/>}</button><button type="button" className="notification-remove" aria-label="Odstranit oznámení" disabled={working} onClick={() => void remove(item)}><Trash2 size={13}/></button></article>) : <div className="stream-empty"><Bell size={20}/><span>Nemáte žádná oznámení.</span></div>}</div>
    <footer><button type="button" onClick={() => { onClose(); onOpenList(); }}>Zobrazit všechna oznámení<ChevronRight size={14}/></button></footer>
  </section></div>;
}

export function ActivityView({ user, metadata, onBack }: { user: User; metadata: Metadata; onBack: () => void }) {
  const [mode, setMode] = useState<"stream" | "own">("stream");
  const filterKey = (target: "stream" | "own") => `via:user-stream-filter:${user.id}:${target}`;
  const storedFilter = (target: "stream" | "own"): "all" | "posts" | "updates" => {
    try { const value = localStorage.getItem(filterKey(target)); return value === "posts" || value === "updates" ? value : "all"; } catch { return "all"; }
  };
  const [activityFilter, setActivityFilter] = useState<"all" | "posts" | "updates">(() => storedFilter("stream"));
  const [items, setItems] = useState<Note[]>([]);
  const [total, setTotal] = useState(-2);
  const [post, setPost] = useState("");
  const [files, setFiles] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [reactions, setReactions] = useState<string[]>(["Like"]);
  const [targetType, setTargetType] = useState("self");
  const [audiencePicker, setAudiencePicker] = useState<"users" | "teams" | "portals" | "">("");
  const [audience, setAudience] = useState<{ users: Array<{ id: string; name: string }>; teams: Array<{ id: string; name: string }>; portals: Array<{ id: string; name: string }> }>({ users: [], teams: [], portals: [] });
  const draftIds = useRef<string[]>([]);
  const messagePermission = String(metadata.userAcl?.messagePermission || "no");
  const portalPermission = String(metadata.userAcl?.portalPermission || "no");
  const targetOptions = ["self", ...((messagePermission === "team" || messagePermission === "all") ? ["users", ...(canAccessEntity(metadata, "Team") ? ["teams"] : [])] : []), ...(messagePermission === "all" ? ["all"] : []), ...(portalPermission === "yes" ? [...(canAccessEntity(metadata, "Portal") ? ["portals"] : []), ...(messagePermission === "team" || messagePermission === "all" ? [] : ["users"])] : [])];

  const url = useMemo(() => `User/${encodeURIComponent(user.id)}/stream${mode === "own" ? "/own" : ""}`, [user.id, mode]);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ maxSize: String(PAGE_SIZE), offset: "0" });
      if (activityFilter !== "all") params.set("filter", activityFilter);
      const result = await request<Page<Note>>(`${url}?${params}`);
      setItems(result.list || []); setTotal(result.total ?? -2);
    } catch (e) { setError(e instanceof Error ? e.message : "Aktivitu se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, [url, activityFilter]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let live = true;
    request<Record<string, any>>("Settings").then((settings) => { if (live && Array.isArray(settings.availableReactions)) setReactions(settings.availableReactions); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => () => { void Promise.allSettled(draftIds.current.map((id) => request(`Attachment/${encodeURIComponent(id)}`, { method: "DELETE" }))); }, []);

  async function submitPost(event: FormEvent) {
    event.preventDefault();
    if (!post.trim() && !files.length) return;
    setPosting(true); setError("");
    try {
      const recipients = audience[targetType as "users" | "teams" | "portals"] || [];
      if (["users", "teams", "portals"].includes(targetType) && !recipients.length) { setError("Vyberte alespoň jednoho příjemce příspěvku."); return; }
      const audienceData = targetType === "users" ? { usersIds: recipients.map((item) => item.id), usersNames: Object.fromEntries(recipients.map((item) => [item.id, item.name])) }
        : targetType === "teams" ? { teamsIds: recipients.map((item) => item.id), teamsNames: Object.fromEntries(recipients.map((item) => [item.id, item.name])) }
        : targetType === "portals" ? { portalsIds: recipients.map((item) => item.id), portalsNames: Object.fromEntries(recipients.map((item) => [item.id, item.name])) } : {};
      await request("Note", { method: "POST", body: JSON.stringify({ parentType: "User", parentId: user.id, targetType, ...audienceData, type: "Post", post: post.trim() || null, attachmentsIds: files.map((file) => file.id), attachmentsNames: Object.fromEntries(files.map((file) => [file.id, file.name])), attachmentsTypes: Object.fromEntries(files.map((file) => [file.id, file.type])) }) });
      draftIds.current = []; setFiles([]); setPost(""); setTargetType("self"); setAudience({ users: [], teams: [], portals: [] }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Příspěvek se nepodařilo publikovat."); }
    finally { setPosting(false); }
  }

  async function addFiles(fileList: FileList | File[] | null) {
    if (!fileList?.length) return;
    setUploading(true); setFileError("");
    try {
      const uploaded: Array<{ id: string; name: string; type: string }> = [];
      for (const file of Array.from(fileList)) { const item = await uploadAttachment(file, "Note", "attachments", true); uploaded.push(item); draftIds.current.push(item.id); }
      setFiles((old) => [...old, ...uploaded]);
    } catch (e) { setFileError(e instanceof Error ? e.message : "Přílohu se nepodařilo nahrát."); }
    finally { setUploading(false); }
  }
  function pasteAttachments(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
      .map((file, index) => file.name ? file : new File([file], `vlozeny-obrazek-${Date.now()}-${index + 1}.${file.type.split("/")[1]?.replace("jpeg", "jpg") || "png"}`, { type: file.type }));
    if (!pasted.length) return;
    event.preventDefault();
    void addFiles(pasted);
  }
  async function removeFile(id: string) {
    setFiles((old) => old.filter((file) => file.id !== id)); draftIds.current = draftIds.current.filter((item) => item !== id);
    await request(`Attachment/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  async function loadMore() {
    setLoadingMore(true); setError("");
    try {
      const params = new URLSearchParams({ maxSize: String(PAGE_SIZE), offset: String(items.length) });
      if (activityFilter !== "all") params.set("filter", activityFilter);
      const result = await request<Page<Note>>(`${url}?${params}`);
      setItems((old) => [...old, ...(result.list || []).filter((item) => !old.some((existing) => existing.id === item.id))]); setTotal(result.total ?? -2);
    } catch (e) { setError(e instanceof Error ? e.message : "Starší aktivitu se nepodařilo načíst."); }
    finally { setLoadingMore(false); }
  }
  async function react(note: Note, type: string) {
    setActionId(`${note.id}:${type}`); setError("");
    try { const own = (note.myReactions || []).includes(type); await request(`Note/${encodeURIComponent(note.id)}/myReactions/${encodeURIComponent(type)}`, { method: own ? "DELETE" : "POST", ...(own ? {} : { body: JSON.stringify({}) }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Reakci se nepodařilo uložit."); }
    finally { setActionId(""); }
  }
  async function remove(note: Note) {
    if (!window.confirm("Opravdu odstranit tento příspěvek?")) return;
    setActionId(note.id); setError("");
    try { await request(`Note/${encodeURIComponent(note.id)}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Příspěvek se nepodařilo odstranit."); }
    finally { setActionId(""); }
  }
  async function edit(note: Note, value: string) {
    setActionId(note.id); setError("");
    try { await request(`Note/${encodeURIComponent(note.id)}`, { method: "PUT", body: JSON.stringify({ post: value }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Příspěvek se nepodařilo upravit."); throw e; }
    finally { setActionId(""); }
  }
  function quote(note: Note) { const quoteText = "> " + String(note.post || "").split(/\r?\n/).join("\n> "); setPost((old) => `${old}${old ? "\n" : ""}${quoteText}\n\n`); document.querySelector<HTMLTextAreaElement>(".activity-composer textarea")?.focus(); }
  const canLoadMore = total >= 0 ? items.length < total : items.length === PAGE_SIZE;
  const pickerEntity = audiencePicker === "users" ? "User" : audiencePicker === "teams" ? "Team" : "Portal";
  const selectedAudience = audiencePicker ? audience[audiencePicker] : [];
  const targetLabels: Record<string, string> = { self: "Moje zeď", users: "Vybraní uživatelé", teams: "Vybrané týmy", portals: "Portály", all: "Všichni uživatelé" };

  return <div className="social-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Přehled</button><div className="eyebrow">STREAM A KOMUNIKACE</div><h1>Aktivita</h1><p>Příspěvky a aktualizace sdílené s vaším účtem.</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/> Obnovit</button></div>
    <div className="social-tabs"><button className={mode === "stream" ? "active" : ""} onClick={() => { setMode("stream"); setActivityFilter(storedFilter("stream")); }}><Users size={14}/> Stream pro mě</button><button className={mode === "own" ? "active" : ""} onClick={() => { setMode("own"); setActivityFilter(storedFilter("own")); }}><Activity size={14}/> Moje příspěvky</button></div>
    <div className="stream-filter-tabs" role="group" aria-label="Filtrovat aktivitu">{([["all", "Vše"], ["posts", "Příspěvky"], ["updates", "Změny"]] as const).map(([key, label]) => <button type="button" key={key} className={activityFilter === key ? "active" : ""} aria-pressed={activityFilter === key} onClick={() => { setActivityFilter(key); try { if (key === "all") localStorage.removeItem(filterKey(mode)); else localStorage.setItem(filterKey(mode), key); } catch {} }}>{label}</button>)}</div>
    {error && <div className="table-error">{error}<button onClick={() => void load()}>Zkusit znovu</button></div>}
    <form className="surface activity-composer" onSubmit={(event) => void submitPost(event)}>{targetOptions.length > 1 && <label className="activity-audience"><span>Publikovat pro</span><select value={targetType} onChange={(event) => setTargetType(event.target.value)}>{targetOptions.map((target) => <option value={target} key={target}>{targetLabels[target]}</option>)}</select></label>}{["users", "teams", "portals"].includes(targetType) && <button type="button" className="button subtle activity-audience-picker" onClick={() => setAudiencePicker(targetType as "users" | "teams" | "portals")}>{targetLabels[targetType]}{audience[targetType as "users" | "teams" | "portals"].length ? ` · ${audience[targetType as "users" | "teams" | "portals"].length} vybráno` : " · vybrat…"}</button>}<textarea value={post} onChange={(event) => setPost(event.target.value)} onPaste={pasteAttachments} placeholder="Napište příspěvek…" rows={3}/>{files.length > 0 && <div className="stream-draft-files">{files.map((file) => <span key={file.id}>{file.name}<button type="button" onClick={() => void removeFile(file.id)} aria-label={`Odebrat ${file.name}`}><X size={12}/></button></span>)}</div>}{fileError && <small className="stream-file-error">{fileError}</small>}<div><label className="stream-add-file"><input type="file" multiple onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }} disabled={uploading || posting}/><Paperclip size={14}/>{uploading ? "Nahrávám…" : "Přiložit soubor"}</label><small>{targetLabels[targetType]}</small><button className="button primary" disabled={posting || uploading || (!post.trim() && !files.length)}>{posting ? "Odesílám…" : "Publikovat"}<Send size={13}/></button></div></form>
    <section className="surface social-feed">{busy ? <div className="table-loading"><span className="spinner"/> Načítám aktivitu…</div> : items.length ? items.map((note) => <StreamItem key={note.id} note={note} metadata={metadata} reactions={reactions} currentUserId={user.id} busy={actionId === note.id || actionId.startsWith(`${note.id}:`)} onReact={react} onPin={() => {}} onRemove={remove} onEdit={edit} onQuote={quote} pinned={false} allowPin={false} avatarsDisabled={Boolean(metadata.appSettings?.avatarsDisabled)}/>) : <div className="stream-empty"><Activity size={22}/><span>Ve streamu zatím nejsou žádné příspěvky.</span></div>}{canLoadMore && !busy && <button className="stream-load-more" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? <LoaderCircle size={14} className="spin"/> : <ArrowDown size={14}/>} Starší aktivita</button>}</section>
    {audiencePicker && <SelectRecordsDialog entity={pickerEntity} metadata={metadata} multiple selectedIds={selectedAudience.map((item) => item.id)} selectedRows={selectedAudience} primaryFilter={audiencePicker === "users" ? portalPermission === "yes" && messagePermission === "no" ? "activePortal" : "active" : undefined} boolFilterList={audiencePicker === "users" && messagePermission === "team" ? ["onlyMyTeam"] : []} filterList={audiencePicker === "users" && portalPermission === "yes" ? messagePermission === "no" ? ["activePortal"] : ["active", "activePortal"] : []} onClose={() => setAudiencePicker("")} onSelect={(rows) => { setAudience((old) => ({ ...old, [audiencePicker]: rows.map((row) => ({ id: row.id, name: row.name || row.userName || row.id })) })); setAudiencePicker(""); }}/ >}
  </div>;
}

export function GlobalStreamView({ user, metadata, onBack, onOpenRecord, portalMode = false }: { user: User; metadata: Metadata; onBack: () => void; onOpenRecord: (scope: string, id: string) => void; portalMode?: boolean }) {
  const [items, setItems] = useState<Note[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "posts" | "updates">("all");
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [reactions, setReactions] = useState<string[]>(["Like"]);
  const [busyId, setBusyId] = useState("");
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 20;
  const where = useMemo(() => filter === "all" ? [] : [{ type: filter === "posts" ? "equals" : "notEquals", attribute: "type", value: "Post" }], [filter]);
  const load = useCallback(async (append = false, beforeNumber?: number) => {
    if (!portalMode && !canAccessEntity(metadata, "GlobalStream")) { setItems([]); setHasMore(false); setError("Nemáte oprávnění číst globální stream."); setBusy(false); setLoadingMore(false); return; }
    if (append) setLoadingMore(true); else setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ maxSize: String(pageSize), orderBy: "number", order: "desc" });
      if (portalMode) {
        params.set("offset", String(append ? beforeNumber ?? 0 : 0));
        if (filter !== "all") params.set("filter", filter);
      } else {
        if (append && beforeNumber != null) params.set("beforeNumber", String(beforeNumber));
        if (query) params.set("q", query);
        if (where.length) params.set("where", JSON.stringify(where));
      }
      const result = await request<Page<Note>>(`${portalMode ? "Stream" : "GlobalStream"}?${params}`);
      const list = result.list || [];
      setItems((old) => append ? [...old, ...list.filter((item) => !old.some((current) => current.id === item.id))] : list);
      setHasMore(list.length === pageSize);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Globální stream se nepodařilo načíst.");
      if (!append) { setItems([]); setHasMore(false); }
    } finally { setBusy(false); setLoadingMore(false); }
  }, [query, where, metadata, portalMode, filter]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let live = true;
    request<Record<string, any>>("Settings").then((settings) => { if (live && Array.isArray(settings.availableReactions)) setReactions(settings.availableReactions); }).catch(() => {});
    return () => { live = false; };
  }, []);
  async function react(note: Note, type: string) {
    setBusyId(`${note.id}:${type}`);
    try { const own = (note.myReactions || []).includes(type); await request(`Note/${encodeURIComponent(note.id)}/myReactions/${encodeURIComponent(type)}`, { method: own ? "DELETE" : "POST", ...(own ? {} : { body: JSON.stringify({}) }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Reakci se nepodařilo uložit."); }
    finally { setBusyId(""); }
  }
  async function remove(note: Note) {
    if (!window.confirm("Opravdu odstranit tento příspěvek?")) return;
    setBusyId(note.id);
    try { await request(`Note/${encodeURIComponent(note.id)}`, { method: "DELETE" }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Příspěvek se nepodařilo odstranit."); }
    finally { setBusyId(""); }
  }
  async function edit(note: Note, post: string) {
    setBusyId(note.id);
    try { await request(`Note/${encodeURIComponent(note.id)}`, { method: "PUT", body: JSON.stringify({ post }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Příspěvek se nepodařilo upravit."); throw cause; }
    finally { setBusyId(""); }
  }
  return <div className="social-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Přehled</button><div className="eyebrow">STREAM A KOMUNIKACE</div><h1><Globe size={22}/> {portalMode ? "Stream" : "Globální stream"}</h1><p>{portalMode ? "Příspěvky a změny dostupné ve vašem portálu." : "Veřejné a týmové příspěvky dostupné vašemu účtu."}</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/> Obnovit</button></div>
    <div className="surface global-stream-toolbar">{!portalMode && <form className="global-stream-search" onSubmit={(event) => { event.preventDefault(); setQuery(queryDraft.trim()); }}><Search size={15}/><input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="Hledat ve streamu"/><button className="button subtle" disabled={busy}>Hledat</button></form>}<div className="stream-filter-tabs" role="group" aria-label={portalMode ? "Filtrovat stream" : "Filtrovat globální stream"}>{([ ["all", "Vše"], ["posts", "Příspěvky"], ["updates", "Změny"] ] as const).map(([key, label]) => <button type="button" key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
    {error && <div className="table-error" role="alert">{error}<button onClick={() => void load()}>Zkusit znovu</button></div>}
    <section className="surface social-feed">{busy ? <div className="table-loading"><span className="spinner"/> Načítám {portalMode ? "stream" : "globální stream"}…</div> : items.length ? items.map((note) => <StreamItem key={note.id} note={note} metadata={metadata} reactions={reactions} currentUserId={user.id} busy={busyId === note.id || busyId.startsWith(`${note.id}:`)} onReact={react} onPin={() => {}} onRemove={remove} onEdit={edit} onQuote={() => {}} allowQuote={false} pinned={false} allowPin={false} onOpen={(item) => onOpenRecord("Note", item.id)} onOpenParent={(item) => { const scope = item.parentType || item.entityType; const id = item.parentId || item.entityId; if (scope && id) onOpenRecord(scope, id); }} avatarsDisabled={Boolean(metadata.appSettings?.avatarsDisabled)}/>) : <div className="stream-empty"><Activity size={22}/><span>{query || filter !== "all" ? "Pro zadaná kritéria nejsou ve streamu žádné záznamy." : `${portalMode ? "Stream" : "Globální stream"} zatím neobsahuje žádné záznamy.`}</span></div>}{hasMore && !busy && <button className="stream-load-more" onClick={() => void load(true, portalMode ? items.length : Number(items.at(-1)?.number))} disabled={loadingMore}>{loadingMore ? <LoaderCircle size={14} className="spin"/> : <ArrowDown size={14}/>} Starší aktivita</button>}</section>
  </div>;
}

export function NotificationCenter({ metadata, onBack, onOpenRecord, onUnreadChange }: { metadata: Metadata; onBack: () => void; onOpenRecord: (scope: string, id: string) => void; onUnreadChange: () => void }) {
  const timeZone = useEspoTimeZone();
  const pageSize = Math.max(1, Number(metadata.appSettings?.recordsPerPage) || 20);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [marking, setMarking] = useState(false);
  const [removing, setRemoving] = useState("");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const load = useCallback(async (offset = 0) => {
    if (!offset) setBusy(true); else setLoadingMore(true);
    setError("");
    try {
      const result = await request<Page<NotificationItem>>(`Notification?maxSize=${pageSize}&offset=${offset}`);
      const page: NotificationItem[] = result.list || [];
      if (!offset) setItems(page); else setItems((old) => [...old, ...page.filter((item) => !old.some((previous) => previous.id === item.id))]);
      setHasMore(page.length === pageSize);
      onUnreadChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo načíst."); }
    finally { setBusy(false); setLoadingMore(false); }
  }, [onUnreadChange, pageSize]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function markAllRead() {
    setMarking(true); setError("");
    try { await request("Notification/action/markAllRead", { method: "POST", body: JSON.stringify({}) }); setItems((old) => old.map((item) => ({ ...item, read: true }))); onUnreadChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo označit jako přečtená."); }
    finally { setMarking(false); }
  }
  async function remove(item: NotificationItem) {
    setRemoving(item.id); setError("");
    try { await request(`Notification/${encodeURIComponent(item.id)}`, { method: "DELETE" }); setItems((old) => old.filter((entry) => entry.id !== item.id)); onUnreadChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo odstranit."); }
    finally { setRemoving(""); }
  }
  async function toggleRead(item: NotificationItem) {
    const read = !item.read;
    setRemoving(item.id); setError("");
    try { await updateNotificationRead(item, read); setItems((old) => old.map((entry) => entry.id === item.id ? { ...entry, read } : entry)); onUnreadChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Stav oznámení se nepodařilo změnit."); }
    finally { setRemoving(""); }
  }
  function open(item: NotificationItem) {
    openNotification(item, onOpenRecord);
  }
  return <div className="social-view notification-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Přehled</button><div className="eyebrow">CENTRUM UPOZORNĚNÍ</div><h1>Oznámení</h1><p>Upozornění přiřazená vašemu účtu.</p></div><div className="notification-actions"><button className="button subtle" onClick={() => setRefreshKey((value) => value + 1)} disabled={busy}><RefreshCw size={14}/> Obnovit</button><button className="button primary" onClick={() => void markAllRead()} disabled={marking}>{marking ? "Označuji…" : "Označit vše jako přečtené"}<Check size={14}/></button></div></div>
    {error && <div className="table-error">{error}<button onClick={() => setRefreshKey((value) => value + 1)}>Zkusit znovu</button></div>}
    <section className="surface notification-list">{busy ? <div className="table-loading"><span className="spinner"/> Načítám oznámení…</div> : items.length ? items.map((item) => <article className={`notification-row ${item.read ? "is-read" : "is-unread"} ${item.type === "Message" ? "has-notification-message" : ""}`} key={item.id}><button className="notification-main" onClick={() => open(item)}><span className="notification-icon"><NotificationTypeIcon type={item.type}/></span><span className="notification-copy"><strong>{item.type === "Message" ? "Otevřít zprávu" : notificationTitle(item, metadata)}</strong>{item.type !== "Message" && notificationDetail(item, metadata) && <span>{notificationDetail(item, metadata)}</span>}<time>{item.createdAt ? formatEspoDateTime(item.createdAt, timeZone) : ""}</time></span>{!item.read && <i className="notification-unread-dot"/>}<ChevronRight size={15}/></button>{item.type === "Message" && <div className="notification-message-content"><NotificationMessage item={item}/></div>}<button className="notification-remove notification-read-toggle" onClick={() => void toggleRead(item)} disabled={removing === item.id} aria-label={item.read ? "Označit jako nepřečtené" : "Označit jako přečtené"} title={item.read ? "Označit jako nepřečtené" : "Označit jako přečtené"}>{item.read ? <EyeSlash size={14}/> : <Eye size={14}/>}</button><button className="notification-remove" onClick={() => void remove(item)} disabled={removing === item.id} aria-label="Odstranit oznámení" title="Odstranit oznámení"><Trash2 size={14}/></button></article>) : <div className="stream-empty"><Bell size={22}/><span>Nemáte žádná nová oznámení.</span></div>}{hasMore && !busy && <button className="stream-load-more" onClick={() => void load(items.length)} disabled={loadingMore}>{loadingMore ? <LoaderCircle size={14} className="spin"/> : <ArrowDown size={14}/>} Načíst starší oznámení</button>}</section>
  </div>;
}
