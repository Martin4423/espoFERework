import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, ArrowDownToLine, Check, ExternalLink, FileImage, FileText, MessageSquare, Paperclip, Pin, RefreshCw, Send, Star, Trash2, X } from "./Icons";
import { canAccessEntity, downloadAttachment, getAttachmentPreviewUrl, getSession, request, uploadAttachment } from "./api";
import type { Metadata } from "./api";
import EspoIcon from "./EspoIcon";
import ImagePreviewDialog from "./ImagePreviewDialog";
import SelectRecordsDialog from "./SelectRecordsDialog";
import { formatEspoDateTime, useEspoTimeZone } from "./timeZone";
import { useDialogFocus } from "./useDialogFocus";

export type Note = Record<string, any>;
type Page = { list?: Note[]; total?: number; pinnedList?: Note[] };
function StreamImageAttachment({ id, name, onOpen }: { id: string; name: string; onOpen: () => void }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    let objectUrl = "";
    getAttachmentPreviewUrl(id).then((url) => { objectUrl = url; if (live) setSrc(url); else URL.revokeObjectURL(url); }).catch(() => {});
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return <button type="button" className="stream-attachment-image" onClick={onOpen} title={`Náhled obrázku ${name}`}><span>{src ? <img src={src} alt="" loading="lazy"/> : <FileImage size={20}/>}</span><small>{name}</small></button>;
}

function StreamAvatar({ id, name, disabled }: { id?: string; name: string; disabled?: boolean }) {
  const [failed, setFailed] = useState(false);
  const url = id ? `/?entryPoint=avatar&size=small&id=${encodeURIComponent(id)}` : "";
  return <div className="stream-avatar">{url && !disabled && !failed ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)}/> : name.slice(0, 1).toUpperCase()}</div>;
}
function relativeTime(value: string) {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  const relative = new Intl.RelativeTimeFormat("cs", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export default function RecordStream({ entity, record, metadata, onOpenNote }: { entity: string; record: Note; metadata: Metadata; onOpenNote?: (note: Note) => void }) {
  const session = getSession();
  const timeZone = useEspoTimeZone();
  const filterStorageKey = `via:stream-filter:${entity}`;
  const [streamFilter, setStreamFilter] = useState<"all" | "posts" | "updates">(() => {
    try { const value = localStorage.getItem(filterStorageKey); return value === "posts" || value === "updates" ? value : "all"; } catch { return "all"; }
  });
  const [notes, setNotes] = useState<Note[]>([]);
  const [pinned, setPinned] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [post, setPost] = useState("");
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [followed, setFollowed] = useState(Boolean(record.isFollowed));
  const [followEntityOnStreamPost, setFollowEntityOnStreamPost] = useState(false);
  const [starred, setStarred] = useState(Boolean(record.isStarred));
  const [reactions, setReactions] = useState<string[]>(["Like"]);
  const [fileError, setFileError] = useState("");
  const [mentionTerm, setMentionTerm] = useState("");
  const [mentionUsers, setMentionUsers] = useState<Note[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [targetType, setTargetType] = useState("self");
  const [audiencePicker, setAudiencePicker] = useState<"users" | "teams" | "portals" | "">("");
  const [streamAttachmentsOpen, setStreamAttachmentsOpen] = useState(false);
  const [streamAttachments, setStreamAttachments] = useState<Note[]>([]);
  const [streamAttachmentsTotal, setStreamAttachmentsTotal] = useState(0);
  const [streamAttachmentsPage, setStreamAttachmentsPage] = useState(0);
  const [streamAttachmentsBusy, setStreamAttachmentsBusy] = useState(false);
  const [streamAttachmentsError, setStreamAttachmentsError] = useState("");
  const streamAttachmentsDialogRef = useDialogFocus<HTMLElement>(() => setStreamAttachmentsOpen(false), !streamAttachmentsBusy);
  const [streamPostsOpen, setStreamPostsOpen] = useState(false);
  const [streamPosts, setStreamPosts] = useState<Note[]>([]);
  const [streamPostsTotal, setStreamPostsTotal] = useState(0);
  const [streamPostsPage, setStreamPostsPage] = useState(0);
  const [streamPostsBusy, setStreamPostsBusy] = useState(false);
  const [streamPostsError, setStreamPostsError] = useState("");
  const streamPostsDialogRef = useDialogFocus<HTMLElement>(() => setStreamPostsOpen(false), !streamPostsBusy);
  const [audience, setAudience] = useState<{ users: Array<{ id: string; name: string }>; teams: Array<{ id: string; name: string }>; portals: Array<{ id: string; name: string }> }>({ users: [], teams: [], portals: [] });
  const draftAttachmentIds = useRef<string[]>([]);
  const postInput = useRef<HTMLTextAreaElement>(null);
  const mentionRange = useRef<[number, number] | null>(null);
  const mentionPermission = metadata.userAcl?.mentionPermission;
  const messagePermission = String(metadata.userAcl?.messagePermission || "no");
  const portalPermission = String(metadata.userAcl?.portalPermission || "no");
  const targetOptions = ["self", ...((messagePermission === "team" || messagePermission === "all") ? ["users", ...(canAccessEntity(metadata, "Team") ? ["teams"] : [])] : []), ...(messagePermission === "all" ? ["all"] : []), ...(portalPermission === "yes" ? [...(canAccessEntity(metadata, "Portal") ? ["portals"] : []), ...(messagePermission === "team" || messagePermission === "all" ? [] : ["users"])] : [])];
  const targetLabels: Record<string, string> = { self: "Jen já", users: "Vybraní uživatelé", teams: "Vybrané týmy", portals: "Portály", all: "Všichni uživatelé" };

  async function loadStreamAttachments(page = 0) {
    setStreamAttachmentsBusy(true); setStreamAttachmentsError("");
    try {
      const params = new URLSearchParams({ maxSize: "30", offset: String(page * 30), orderBy: "createdAt", order: "desc" });
      const data = await request<Page>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/streamAttachments?${params}`);
      setStreamAttachments(data.list || []); setStreamAttachmentsTotal(Number(data.total || 0)); setStreamAttachmentsPage(page); setStreamAttachmentsOpen(true);
    } catch (cause) { setStreamAttachmentsError(cause instanceof Error ? cause.message : "Přílohy streamu se nepodařilo načíst."); setStreamAttachmentsOpen(true); }
    finally { setStreamAttachmentsBusy(false); }
  }

  async function loadStreamPosts(page = 0) {
    setStreamPostsBusy(true); setStreamPostsError("");
    try {
      const params = new URLSearchParams({ maxSize: "30", offset: String(page * 30), orderBy: "createdAt", order: "desc" });
      const data = await request<Page>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/posts?${params}`);
      setStreamPosts(data.list || []); setStreamPostsTotal(Number(data.total || 0)); setStreamPostsPage(page); setStreamPostsOpen(true);
    } catch (cause) { setStreamPostsError(cause instanceof Error ? cause.message : "Příspěvky se nepodařilo načíst."); setStreamPostsOpen(true); }
    finally { setStreamPostsBusy(false); }
  }

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ maxSize: "30", offset: "0", orderBy: "createdAt", order: "desc" });
      if (streamFilter !== "all") params.set("filter", streamFilter);
      const data = await request<Page>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/stream?${params}`);
      setNotes(data.list || []); setPinned(data.pinnedList || []); setTotal(data.total || 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Záznamový stream se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, [entity, record.id, streamFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { void Promise.allSettled(draftAttachmentIds.current.map((id) => request(`Attachment/${encodeURIComponent(id)}`, { method: "DELETE" }))); }, []);
  useEffect(() => {
    let live = true;
    request<Note>("Settings").then((settings) => {
      if (live && Array.isArray(settings.availableReactions)) setReactions(settings.availableReactions);
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    let live = true;
    if (!session?.user.id) return () => { live = false; };
    request<Note>(`Preferences/${encodeURIComponent(session.user.id)}`).then((preferences) => live && setFollowEntityOnStreamPost(Boolean(preferences.followEntityOnStreamPost))).catch(() => live && setFollowEntityOnStreamPost(false));
    return () => { live = false; };
  }, [session?.user.id]);
  useEffect(() => {
    let live = true;
    if (!mentionTerm || mentionPermission === "no") { setMentionUsers([]); setMentionIndex(0); return () => { live = false; }; }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: mentionTerm, primaryFilter: "active", maxSize: String(metadata.appParams?.recordsPerPage || 20), select: "id,name,userName", orderBy: "name", order: "asc" });
      if (mentionPermission === "team") params.append("boolFilterList[]", "onlyMyTeam");
      request<{ list?: Note[] }>(`User?${params}`).then((result) => live && setMentionUsers(result.list || [])).catch(() => live && setMentionUsers([]));
    }, 180);
    return () => { live = false; window.clearTimeout(timer); };
  }, [mentionTerm, mentionPermission, metadata.appParams?.recordsPerPage]);

  const streamEnabled = Boolean(metadata.scopes?.[entity]?.stream);
  const canFollow = Boolean(streamEnabled && record.id && metadata.scopes?.[entity]?.stream);
  const pinnedIds = useMemo(() => new Set(pinned.map((item) => item.id)), [pinned]);

  async function submitPost(event: React.FormEvent) {
    event.preventDefault();
    if (!post.trim() && !attachments.length) return;
    setPosting(true); setError("");
    try {
      const recipients = audience[targetType as "users" | "teams" | "portals"] || [];
      if (["users", "teams", "portals"].includes(targetType) && !recipients.length) { setError("Vyberte alespoň jednoho příjemce příspěvku."); return; }
      const audienceData = targetType === "users" ? { usersIds: recipients.map((item) => item.id), usersNames: Object.fromEntries(recipients.map((item) => [item.id, item.name])) }
        : targetType === "teams" ? { teamsIds: recipients.map((item) => item.id), teamsNames: Object.fromEntries(recipients.map((item) => [item.id, item.name])) }
        : targetType === "portals" ? { portalsIds: recipients.map((item) => item.id), portalsNames: Object.fromEntries(recipients.map((item) => [item.id, item.name])) } : {};
      await request("Note", { method: "POST", body: JSON.stringify({ parentType: entity, parentId: record.id, targetType, ...audienceData, type: "Post", post: post.trim() || null, attachmentsIds: attachments.map((item) => item.id), attachmentsNames: Object.fromEntries(attachments.map((item) => [item.id, item.name])), attachmentsTypes: Object.fromEntries(attachments.map((item) => [item.id, item.type])) }) });
      if (followEntityOnStreamPost && !followed) {
        try { await request(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/subscription`, { method: "PUT" }); setFollowed(true); }
        catch { setError("Příspěvek byl zveřejněn, ale automatické sledování záznamu se nepodařilo zapnout."); }
      }
      draftAttachmentIds.current = []; setAttachments([]); setPost(""); setTargetType("self"); setAudience({ users: [], teams: [], portals: [] }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Příspěvek se nepodařilo publikovat."); }
    finally { setPosting(false); }
  }

  async function addFiles(list: FileList | File[] | null) {
    if (!list?.length) return;
    setUploading(true); setFileError("");
    try {
      const uploaded: Array<{ id: string; name: string; type: string }> = [];
      for (const file of Array.from(list)) {
        const item = await uploadAttachment(file, "Note", "attachments", true);
        uploaded.push(item); draftAttachmentIds.current.push(item.id);
      }
      setAttachments((old) => [...old, ...uploaded]);
    } catch (e) { setFileError(e instanceof Error ? e.message : "Přílohu se nepodařilo nahrát."); }
    finally { setUploading(false); }
  }

  function pasteAttachments(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
      .map((file, index) => file.name ? file : new File([file], `vlozeny-obrazek-${Date.now()}-${index + 1}.${file.type.split("/")[1]?.replace("jpeg", "jpg") || "png"}`, { type: file.type }));
    if (!files.length) return;
    event.preventDefault();
    void addFiles(files);
  }

  async function removeDraftAttachment(id: string) {
    setAttachments((old) => old.filter((item) => item.id !== id));
    draftAttachmentIds.current = draftAttachmentIds.current.filter((item) => item !== id);
    await request(`Attachment/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  function quoteReply(note: Note) {
    const quote = "> " + String(note.post || "").split(/\r?\n/).join("\n> ");
    setPost((old) => `${old}${old ? "\n" : ""}${quote}\n\n`);
    postInput.current?.focus();
    postInput.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handlePostChange(value: string, cursor: number) {
    setPost(value);
    const before = value.slice(0, cursor);
    const match = before.match(/(^|\s)@([\w@.-]*)$/);
    if (!match || !match[2] || mentionPermission === "no") {
      mentionRange.current = null; setMentionTerm(""); setMentionUsers([]); return;
    }
    const start = cursor - match[2].length - 1;
    mentionRange.current = [start, cursor];
    setMentionTerm(match[2]); setMentionIndex(0);
  }

  function insertMention(user: Note) {
    const range = mentionRange.current;
    const input = postInput.current;
    if (!range || !input) return;
    const token = `@${user.userName}`;
    const next = `${post.slice(0, range[0])}${token}${post.slice(range[1])}`;
    const cursor = range[0] + token.length;
    setPost(next); setMentionTerm(""); setMentionUsers([]); mentionRange.current = null;
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(cursor, cursor); });
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionUsers.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setMentionIndex((index) => (index + 1) % mentionUsers.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setMentionIndex((index) => (index - 1 + mentionUsers.length) % mentionUsers.length); }
    else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); insertMention(mentionUsers[mentionIndex]); }
    else if (event.key === "Escape") { setMentionUsers([]); setMentionTerm(""); mentionRange.current = null; }
  }

  async function toggleSubscription(kind: "subscription" | "starSubscription") {
    const isOn = kind === "subscription" ? followed : starred;
    const key = kind;
    setActionId(key); setError("");
    try {
      await request(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/${kind}`, { method: isOn ? "DELETE" : "PUT" });
      kind === "subscription" ? setFollowed(!isOn) : setStarred(!isOn);
    } catch (e) { setError(e instanceof Error ? e.message : "Akci se nepodařilo dokončit."); }
    finally { setActionId(""); }
  }

  async function loadOlder() {
    setLoadingMore(true); setError("");
    try {
      const params = new URLSearchParams({ maxSize: "30", offset: String(notes.length), orderBy: "createdAt", order: "desc" });
      if (streamFilter !== "all") params.set("filter", streamFilter);
      const data = await request<Page>(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/stream?${params}`);
      setNotes((old) => [...old, ...(data.list || []).filter((item) => !old.some((existing) => existing.id === item.id))]);
      setTotal(data.total || 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Starší aktivitu se nepodařilo načíst."); }
    finally { setLoadingMore(false); }
  }

  async function toggleReaction(note: Note, type: string) {
    setActionId(`${note.id}:${type}`); setError("");
    try {
      const own = (note.myReactions || []).includes(type);
      await request(`Note/${encodeURIComponent(note.id)}/myReactions/${encodeURIComponent(type)}`, { method: own ? "DELETE" : "POST", ...(own ? {} : { body: JSON.stringify({}) }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Reakci se nepodařilo uložit."); }
    finally { setActionId(""); }
  }

  async function togglePin(note: Note) {
    setActionId(note.id); setError("");
    try { await request(`Note/${encodeURIComponent(note.id)}/pin`, { method: pinnedIds.has(note.id) ? "DELETE" : "POST", ...(pinnedIds.has(note.id) ? {} : { body: JSON.stringify({}) }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Příspěvek se nepodařilo připnout."); }
    finally { setActionId(""); }
  }

  async function removeNote(note: Note) {
    if (!window.confirm("Opravdu odstranit tento příspěvek?")) return;
    setActionId(note.id); setError("");
    try { await request(`Note/${encodeURIComponent(note.id)}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Příspěvek se nepodařilo odstranit."); }
    finally { setActionId(""); }
  }

  async function editNote(note: Note, value: string) {
    setActionId(note.id); setError("");
    try { await request(`Note/${encodeURIComponent(note.id)}`, { method: "PUT", body: JSON.stringify({ post: value }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Příspěvek se nepodařilo upravit."); throw e; }
    finally { setActionId(""); }
  }

  if (!streamEnabled) return null;
  return <><section className="record-stream">
    <div className="record-stream-heading"><div><h3><Activity size={15}/> Aktivita</h3><span>{total} záznamů</span></div><div className="record-stream-actions">{entity !== "User" && <><button type="button" className="button subtle" onClick={() => void loadStreamPosts()} title="Zobrazit všechny příspěvky"><MessageSquare size={14}/>Příspěvky</button><button type="button" className="button subtle" onClick={() => void loadStreamAttachments()} title="Zobrazit všechny přílohy aktivity"><Paperclip size={14}/>Přílohy</button></>}<button className={`stream-toggle ${followed ? "is-on" : ""}`} onClick={() => void toggleSubscription("subscription")} disabled={Boolean(actionId) || !canFollow} title={followed ? "Přestat sledovat" : "Sledovat záznam"}>{followed ? <Check size={14}/> : <Activity size={14}/>} {followed ? "Sledujete" : "Sledovat"}</button><button className={`icon-button ${starred ? "stream-starred" : ""}`} onClick={() => void toggleSubscription("starSubscription")} disabled={Boolean(actionId)} title={starred ? "Odebrat z oblíbených" : "Přidat do oblíbených"}><Star size={15} fill={starred ? "currentColor" : "none"}/></button><button className="icon-button" onClick={() => void load()} disabled={busy} title="Obnovit aktivitu"><RefreshCw size={14}/></button></div></div>
    <div className="stream-filter-tabs" role="group" aria-label="Filtrovat aktivitu">{([["all", "Vše"], ["posts", "Příspěvky"], ["updates", "Změny"]] as const).map(([key, label]) => <button type="button" key={key} className={streamFilter === key ? "active" : ""} aria-pressed={streamFilter === key} onClick={() => { setStreamFilter(key); try { if (key === "all") localStorage.removeItem(filterStorageKey); else localStorage.setItem(filterStorageKey, key); } catch {} }} disabled={busy && streamFilter === key}>{label}</button>)}</div>
    {error && <div className="stream-error">{error}<button onClick={() => void load()}>Načíst znovu</button></div>}
    <form className="stream-composer" onSubmit={(event) => void submitPost(event)}>{targetOptions.length > 1 && <label className="activity-audience"><span>Publikovat pro</span><select value={targetType} onChange={(event) => setTargetType(event.target.value)}>{targetOptions.map((target) => <option value={target} key={target}>{targetLabels[target]}</option>)}</select></label>}{["users", "teams", "portals"].includes(targetType) && <button type="button" className="button subtle activity-audience-picker" onClick={() => setAudiencePicker(targetType as "users" | "teams" | "portals")}>{targetLabels[targetType]}{audience[targetType as "users" | "teams" | "portals"].length ? ` · ${audience[targetType as "users" | "teams" | "portals"].length} vybráno` : " · vybrat…"}</button>}<div className="stream-composer-input"><textarea ref={postInput} value={post} onChange={(event) => handlePostChange(event.target.value, event.currentTarget.selectionStart)} onPaste={pasteAttachments} onKeyDown={handleComposerKeyDown} rows={2} placeholder="Sdílejte novinku…"/>{mentionUsers.length > 0 && <div className="stream-mention-menu" role="listbox">{mentionUsers.map((user, index) => <button type="button" role="option" aria-selected={index === mentionIndex} className={index === mentionIndex ? "active" : ""} key={user.id} onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(user)}><span>{String(user.name || user.userName || "?").slice(0, 1).toUpperCase()}</span><strong>{user.name || user.userName}</strong><small>@{user.userName}</small></button>)}</div>}</div>{attachments.length > 0 && <div className="stream-draft-files">{attachments.map((item) => <span key={item.id}>{item.name}<button type="button" onClick={() => void removeDraftAttachment(item.id)} aria-label={`Odebrat ${item.name}`}><X size={12}/></button></span>)}</div>}{fileError && <div className="stream-file-error">{fileError}</div>}<div><label className="stream-add-file"><input type="file" multiple onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }} disabled={uploading || posting}/><Paperclip size={14}/>{uploading ? "Nahrávám…" : "Přiložit soubor"}</label><small>{targetLabels[targetType]}</small><button className="button primary" disabled={posting || uploading || (!post.trim() && !attachments.length)}>{posting ? "Odesílám…" : "Publikovat"}<Send size={13}/></button></div></form>
    {pinned.length > 0 && <div className="stream-pinned"><div className="stream-subheading"><Pin size={13}/> Připnuté příspěvky</div>{pinned.map((note) => <StreamItem key={`pin-${note.id}`} note={note} metadata={metadata} reactions={reactions} currentUserId={session?.user.id} busy={actionId === note.id} onReact={toggleReaction} onPin={togglePin} onRemove={removeNote} onEdit={editNote} onQuote={quoteReply} onOpen={onOpenNote} pinned avatarsDisabled={Boolean(metadata.appSettings?.avatarsDisabled)}/>)}</div>}
    <div className="stream-list">{busy ? <div className="stream-loading"><span className="spinner"/> Načítám aktivitu…</div> : notes.length ? notes.map((note) => <StreamItem key={note.id} note={note} metadata={metadata} reactions={reactions} currentUserId={session?.user.id} busy={actionId === note.id || actionId.startsWith(`${note.id}:`)} onReact={toggleReaction} onPin={togglePin} onRemove={removeNote} onEdit={editNote} onQuote={quoteReply} onOpen={onOpenNote} pinned={pinnedIds.has(note.id)} avatarsDisabled={Boolean(metadata.appSettings?.avatarsDisabled)}/>) : <div className="stream-empty"><MessageSquare size={20}/><span>Zatím tu nejsou žádné příspěvky ani změny.</span></div>}</div>
    {notes.length > 0 && notes.length < total && <button className="stream-load-more" onClick={() => void loadOlder()} disabled={loadingMore}>{loadingMore ? <span className="spinner"/> : <ArrowDown size={14}/>} Starší aktivita ({notes.length} z {total})</button>}
  </section>{streamPostsOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setStreamPostsOpen(false)}><section ref={streamPostsDialogRef} className="record-modal stream-attachments-modal" role="dialog" aria-modal="true" aria-labelledby="stream-posts-title"><div className="modal-heading"><div><span className="eyebrow">AKTIVITA · PŘÍSPĚVKY</span><h2 id="stream-posts-title">Příspěvky záznamu</h2><p>{streamPostsTotal.toLocaleString("cs-CZ")} příspěvků</p></div><button type="button" className="icon-button" aria-label="Zavřít příspěvky" onClick={() => setStreamPostsOpen(false)}><X size={16}/></button></div>{streamPostsError && <div className="stream-error" role="alert">{streamPostsError}<button type="button" onClick={() => void loadStreamPosts(streamPostsPage)}>Zkusit znovu</button></div>}{streamPostsBusy ? <div className="table-loading"><span className="spinner"/> Načítám příspěvky…</div> : streamPosts.length ? <div className="stream-post-list">{streamPosts.map((note) => <article className="stream-post-list-item" key={note.id}><StreamAvatar id={note.createdById} name={note.createdByName || "Uživatel"} disabled={Boolean(metadata.appSettings?.avatarsDisabled)}/><button type="button" className="stream-post-list-content" onClick={() => { setStreamPostsOpen(false); onOpenNote?.(note); }}><span><strong>{note.createdByName || "Neznámý uživatel"}</strong><time dateTime={note.createdAt || undefined}>{formatEspoDateTime(note.createdAt, timeZone)}</time></span><p>{note.post || "(prázdný příspěvek)"}</p></button></article>)}</div> : !streamPostsError && <div className="stream-empty"><MessageSquare size={20}/><span>K tomuto záznamu zatím nejsou žádné příspěvky.</span></div>}<footer className="stream-attachments-footer"><span>Seřazeno od nejnovějších</span><div><button type="button" className="button subtle" disabled={streamPostsPage === 0 || streamPostsBusy} onClick={() => void loadStreamPosts(streamPostsPage - 1)}>Předchozí</button><span>{streamPostsTotal ? streamPostsPage + 1 : 0} / {Math.max(1, Math.ceil(streamPostsTotal / 30))}</span><button type="button" className="button subtle" disabled={(streamPostsPage + 1) * 30 >= streamPostsTotal || streamPostsBusy} onClick={() => void loadStreamPosts(streamPostsPage + 1)}>Další</button></div></footer></section></div>}{streamAttachmentsOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setStreamAttachmentsOpen(false)}><section ref={streamAttachmentsDialogRef} className="record-modal stream-attachments-modal" role="dialog" aria-modal="true" aria-labelledby="stream-attachments-title"><div className="modal-heading"><div><span className="eyebrow">AKTIVITA · PŘÍLOHY</span><h2 id="stream-attachments-title">Přílohy záznamu</h2><p>{streamAttachmentsTotal.toLocaleString("cs-CZ")} souborů připojených k aktivitě</p></div><button type="button" className="icon-button" aria-label="Zavřít přílohy" onClick={() => setStreamAttachmentsOpen(false)}><X size={16}/></button></div>{streamAttachmentsError && <div className="stream-error" role="alert">{streamAttachmentsError}<button type="button" onClick={() => void loadStreamAttachments(streamAttachmentsPage)}>Zkusit znovu</button></div>}{streamAttachmentsBusy ? <div className="table-loading"><span className="spinner"/> Načítám přílohy…</div> : streamAttachments.length ? <div className="stream-attachment-list">{streamAttachments.map((file) => <div className="stream-attachment-row" key={file.id}><span className="stream-attachment-file-icon"><FileText size={16}/></span><span className="stream-attachment-file-info"><strong title={file.name}>{file.name || "Soubor bez názvu"}</strong><small>{file.type || "Typ souboru neznámý"}</small></span><time dateTime={file.createdAt || undefined}>{formatEspoDateTime(file.createdAt, timeZone)}</time><button type="button" className="icon-button" aria-label={`Stáhnout ${file.name || "soubor"}`} title="Stáhnout" onClick={() => void downloadAttachment(file.id, file.name || "soubor")}><ArrowDownToLine size={15}/></button></div>)}</div> : !streamAttachmentsError && <div className="stream-empty"><Paperclip size={20}/><span>K tomuto záznamu zatím nejsou připojené žádné soubory.</span></div>}<footer className="stream-attachments-footer"><span>Seřazeno od nejnovějších</span><div><button type="button" className="button subtle" disabled={streamAttachmentsPage === 0 || streamAttachmentsBusy} onClick={() => void loadStreamAttachments(streamAttachmentsPage - 1)}>Předchozí</button><span>{streamAttachmentsTotal ? streamAttachmentsPage + 1 : 0} / {Math.max(1, Math.ceil(streamAttachmentsTotal / 30))}</span><button type="button" className="button subtle" disabled={(streamAttachmentsPage + 1) * 30 >= streamAttachmentsTotal || streamAttachmentsBusy} onClick={() => void loadStreamAttachments(streamAttachmentsPage + 1)}>Další</button></div></footer></section></div>}{audiencePicker && <SelectRecordsDialog entity={audiencePicker === "users" ? "User" : audiencePicker === "teams" ? "Team" : "Portal"} metadata={metadata} multiple selectedIds={audience[audiencePicker].map((item) => item.id)} selectedRows={audience[audiencePicker]} primaryFilter={audiencePicker === "users" ? portalPermission === "yes" && messagePermission === "no" ? "activePortal" : "active" : undefined} boolFilterList={audiencePicker === "users" && messagePermission === "team" ? ["onlyMyTeam"] : []} filterList={audiencePicker === "users" && portalPermission === "yes" ? messagePermission === "no" ? ["activePortal"] : ["active", "activePortal"] : []} onClose={() => setAudiencePicker("")} onSelect={(rows) => { setAudience((old) => ({ ...old, [audiencePicker]: rows.map((row) => ({ id: row.id, name: row.name || row.userName || row.id })) })); setAudiencePicker(""); }}/ >}</>;
}

export function StreamItem({ note, metadata, reactions, currentUserId, busy, onReact, onPin, onRemove, onEdit, onQuote, onOpen, onOpenParent, pinned, allowPin = true, allowQuote = true, avatarsDisabled = false }: { note: Note; metadata: Metadata; reactions: string[]; currentUserId?: string; busy: boolean; onReact: (note: Note, type: string) => void; onPin: (note: Note) => void; onRemove: (note: Note) => void; onEdit: (note: Note, post: string) => Promise<void>; onQuote: (note: Note) => void; onOpen?: (note: Note) => void; onOpenParent?: (note: Note) => void; pinned: boolean; allowPin?: boolean; allowQuote?: boolean; avatarsDisabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.post || "");
  const [editError, setEditError] = useState("");
  const [imageIndex, setImageIndex] = useState<number | null>(null);
  const type = note.type || "Update";
  const author = note.createdByName || "EspoCRM";
  const isOwnPost = note.createdById && currentUserId === note.createdById;
  const systemText: Record<string, string> = { Create: "vytvořil/a záznam", CreateRelated: "vytvořil/a související záznam", Update: "upravil/a záznam", Status: "změnil/a stav", Assign: "změnil/a přiřazení", Relate: "propojil/a záznam", Unrelate: "odpojil/a záznam", EmailReceived: "přijal/a e-mail", EmailSent: "odeslal/a e-mail" };
  const attachmentIds: string[] = note.attachmentsIds || [];
  const attachmentNames: Record<string, string> = note.attachmentsNames || {};
  const attachmentTypes: Record<string, string> = note.attachmentsTypes || {};
  const imageAttachments = attachmentIds.filter((id) => attachmentTypes[id]?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachmentNames[id] || "")).map((id) => ({ id, name: attachmentNames[id] || "Obrázek", type: attachmentTypes[id] }));
  const counts = note.reactionCounts || {};
  const myReactions: string[] = note.myReactions || [];
  const reactionDefinitions = (((metadata.app as any)?.reactions?.list || []) as Array<{ type: string; iconClass?: string }>);
  const reactionLabels = (metadata.labels as any)?.Global?.reactions || {};
  return <article className={`stream-item ${pinned ? "is-pinned" : ""}`}>
    <StreamAvatar id={note.createdById} name={author} disabled={avatarsDisabled}/><div className="stream-item-body"><div className="stream-item-head"><div><strong>{author}</strong><span>{type === "Post" ? "přidal/a příspěvek" : systemText[type] || "provedl/a změnu"}</span><time>{relativeTime(note.createdAt)}</time></div>{note.isInternal && <span className="stream-internal">Interní</span>}</div>
      {editing ? <form className="stream-edit-form" onSubmit={(event) => { event.preventDefault(); setEditError(""); void onEdit(note, draft).then(() => setEditing(false)).catch((e) => setEditError(e instanceof Error ? e.message : "Uložení selhalo.")); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)}/>{editError && <small>{editError}</small>}<div><button type="button" className="stream-item-action" onClick={() => { setDraft(note.post || ""); setEditing(false); }}>Zrušit</button><button className="stream-item-action is-on" disabled={busy || !draft.trim()}>Uložit změny</button></div></form> : note.post ? <p className="stream-post-text">{note.post}</p> : note.data ? <SystemChange data={note.data}/> : null}
      {attachmentIds.length > 0 && <div className="stream-attachments">{attachmentIds.map((id) => { const imageAt = imageAttachments.findIndex((item) => item.id === id); const name = attachmentNames[id] || "Příloha"; return imageAt >= 0 ? <StreamImageAttachment key={id} id={id} name={name} onOpen={() => setImageIndex(imageAt)}/> : <button key={id} onClick={() => void downloadAttachment(id, name)}>{name}</button>; })}</div>}
      <div className="stream-item-footer">{type === "Post" && reactions.map((reaction) => { const definition = reactionDefinitions.find((item) => item.type === reaction); const count = Number(counts[reaction] || 0); const active = myReactions.includes(reaction); const label = reactionLabels[reaction] || reaction; return <button key={reaction} className={`stream-reaction ${active ? "is-active" : ""}`} onClick={() => onReact(note, reaction)} disabled={busy} title={label} aria-label={`${label}${count ? ` · ${count}` : ""}`} aria-pressed={active}><EspoIcon className={definition?.iconClass || "fas fa-face-smile"} size={13}/>{count > 0 ? count : ""}</button>; })}
        {onOpen && <button className="stream-item-action" onClick={() => onOpen(note)} title="Otevřít samostatný záznam poznámky"><ExternalLink size={13}/> Otevřít</button>}
        {onOpenParent && (note.parentId || note.entityId) && <button className="stream-item-action" onClick={() => onOpenParent(note)} title="Otevřít související záznam"><ExternalLink size={13}/> {note.parentName || "Související záznam"}</button>}
        {allowQuote && type === "Post" && note.post && <button className="stream-item-action" onClick={() => onQuote(note)} title="Citovat v odpovědi"><MessageSquare size={13}/> Odpovědět citací</button>}
        {isOwnPost && type === "Post" && <button className="stream-item-action" onClick={() => { setDraft(note.post || ""); setEditError(""); setEditing(true); }} disabled={busy}>Upravit</button>}
        {isOwnPost && type === "Post" && <button className="stream-item-action danger" onClick={() => onRemove(note)} disabled={busy} title="Odstranit příspěvek"><Trash2 size={13}/></button>}
        {allowPin && type === "Post" && <button className={`stream-item-action ${pinned ? "is-on" : ""}`} onClick={() => onPin(note)} disabled={busy} title={pinned ? "Odepnout" : "Připnout"}><Pin size={13}/>{pinned ? "Připnuto" : "Připnout"}</button>}
      </div>
    </div>
    {imageIndex != null && <ImagePreviewDialog images={imageAttachments} index={imageIndex} onIndexChange={setImageIndex} onClose={() => setImageIndex(null)}/>}
  </article>;
}

function SystemChange({ data }: { data: Note }) {
  const entries = Object.entries(data).filter(([key]) => !["id", "entityType", "entityId", "parentType", "parentId"].includes(key)).slice(0, 4);
  if (!entries.length) return null;
  return <dl className="stream-change-list">{entries.map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd></div>)}</dl>;
}
