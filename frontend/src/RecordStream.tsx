import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, Check, ExternalLink, FileImage, Heart, MessageSquare, Paperclip, Pin, RefreshCw, Send, Smile, Star, ThumbsUp, Trash2, X } from "./Icons";
import { downloadAttachment, getAttachmentPreviewUrl, getSession, request, uploadAttachment } from "./api";
import type { Metadata } from "./api";
import ImagePreviewDialog from "./ImagePreviewDialog";

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
const reactionIcons: Record<string, typeof Heart> = { Like: ThumbsUp, Love: Heart, Smile, Laugh: Smile, Surprise: Smile, Sad: Smile, Dislike: ThumbsUp, Meh: Smile };
const reactionNames: Record<string, string> = { Like: "To se mi líbí", Love: "Láska", Smile: "Úsměv", Laugh: "Smích", Surprise: "Překvapení", Sad: "Smutek", Dislike: "Nelíbí", Meh: "Nic moc" };

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
  const draftAttachmentIds = useRef<string[]>([]);
  const postInput = useRef<HTMLTextAreaElement>(null);
  const mentionRange = useRef<[number, number] | null>(null);
  const mentionPermission = metadata.userAcl?.mentionPermission;

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
      await request("Note", { method: "POST", body: JSON.stringify({ parentType: entity, parentId: record.id, type: "Post", post: post.trim() || null, attachmentsIds: attachments.map((item) => item.id), attachmentsNames: Object.fromEntries(attachments.map((item) => [item.id, item.name])), attachmentsTypes: Object.fromEntries(attachments.map((item) => [item.id, item.type])) }) });
      if (followEntityOnStreamPost && !followed) {
        try { await request(`${encodeURIComponent(entity)}/${encodeURIComponent(record.id)}/subscription`, { method: "PUT" }); setFollowed(true); }
        catch { setError("Příspěvek byl zveřejněn, ale automatické sledování záznamu se nepodařilo zapnout."); }
      }
      draftAttachmentIds.current = []; setAttachments([]); setPost(""); await load();
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
  return <section className="record-stream">
    <div className="record-stream-heading"><div><h3><Activity size={15}/> Aktivita</h3><span>{total} záznamů</span></div><div className="record-stream-actions"><button className={`stream-toggle ${followed ? "is-on" : ""}`} onClick={() => void toggleSubscription("subscription")} disabled={Boolean(actionId) || !canFollow} title={followed ? "Přestat sledovat" : "Sledovat záznam"}>{followed ? <Check size={14}/> : <Activity size={14}/>} {followed ? "Sledujete" : "Sledovat"}</button><button className={`icon-button ${starred ? "stream-starred" : ""}`} onClick={() => void toggleSubscription("starSubscription")} disabled={Boolean(actionId)} title={starred ? "Odebrat z oblíbených" : "Přidat do oblíbených"}><Star size={15} fill={starred ? "currentColor" : "none"}/></button><button className="icon-button" onClick={() => void load()} disabled={busy} title="Obnovit aktivitu"><RefreshCw size={14}/></button></div></div>
    <div className="stream-filter-tabs" role="group" aria-label="Filtrovat aktivitu">{([["all", "Vše"], ["posts", "Příspěvky"], ["updates", "Změny"]] as const).map(([key, label]) => <button type="button" key={key} className={streamFilter === key ? "active" : ""} aria-pressed={streamFilter === key} onClick={() => { setStreamFilter(key); try { if (key === "all") localStorage.removeItem(filterStorageKey); else localStorage.setItem(filterStorageKey, key); } catch {} }} disabled={busy && streamFilter === key}>{label}</button>)}</div>
    {error && <div className="stream-error">{error}<button onClick={() => void load()}>Načíst znovu</button></div>}
    <form className="stream-composer" onSubmit={(event) => void submitPost(event)}><div className="stream-composer-input"><textarea ref={postInput} value={post} onChange={(event) => handlePostChange(event.target.value, event.currentTarget.selectionStart)} onPaste={pasteAttachments} onKeyDown={handleComposerKeyDown} rows={2} placeholder="Sdílejte novinku…"/>{mentionUsers.length > 0 && <div className="stream-mention-menu" role="listbox">{mentionUsers.map((user, index) => <button type="button" role="option" aria-selected={index === mentionIndex} className={index === mentionIndex ? "active" : ""} key={user.id} onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(user)}><span>{String(user.name || user.userName || "?").slice(0, 1).toUpperCase()}</span><strong>{user.name || user.userName}</strong><small>@{user.userName}</small></button>)}</div>}</div>{attachments.length > 0 && <div className="stream-draft-files">{attachments.map((item) => <span key={item.id}>{item.name}<button type="button" onClick={() => void removeDraftAttachment(item.id)} aria-label={`Odebrat ${item.name}`}><X size={12}/></button></span>)}</div>}{fileError && <div className="stream-file-error">{fileError}</div>}<div><label className="stream-add-file"><input type="file" multiple onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }} disabled={uploading || posting}/><Paperclip size={14}/>{uploading ? "Nahrávám…" : "Přiložit soubor"}</label><small>Příspěvek uvidí uživatelé s přístupem ke streamu.</small><button className="button primary" disabled={posting || uploading || (!post.trim() && !attachments.length)}>{posting ? "Odesílám…" : "Publikovat"}<Send size={13}/></button></div></form>
    {pinned.length > 0 && <div className="stream-pinned"><div className="stream-subheading"><Pin size={13}/> Připnuté příspěvky</div>{pinned.map((note) => <StreamItem key={`pin-${note.id}`} note={note} reactions={reactions} currentUserId={session?.user.id} busy={actionId === note.id} onReact={toggleReaction} onPin={togglePin} onRemove={removeNote} onEdit={editNote} onQuote={quoteReply} onOpen={onOpenNote} pinned/>)}</div>}
    <div className="stream-list">{busy ? <div className="stream-loading"><span className="spinner"/> Načítám aktivitu…</div> : notes.length ? notes.map((note) => <StreamItem key={note.id} note={note} reactions={reactions} currentUserId={session?.user.id} busy={actionId === note.id || actionId.startsWith(`${note.id}:`)} onReact={toggleReaction} onPin={togglePin} onRemove={removeNote} onEdit={editNote} onQuote={quoteReply} onOpen={onOpenNote} pinned={pinnedIds.has(note.id)}/>) : <div className="stream-empty"><MessageSquare size={20}/><span>Zatím tu nejsou žádné příspěvky ani změny.</span></div>}</div>
    {notes.length > 0 && notes.length < total && <button className="stream-load-more" onClick={() => void loadOlder()} disabled={loadingMore}>{loadingMore ? <span className="spinner"/> : <ArrowDown size={14}/>} Starší aktivita ({notes.length} z {total})</button>}
  </section>;
}

export function StreamItem({ note, reactions, currentUserId, busy, onReact, onPin, onRemove, onEdit, onQuote, onOpen, pinned, allowPin = true }: { note: Note; reactions: string[]; currentUserId?: string; busy: boolean; onReact: (note: Note, type: string) => void; onPin: (note: Note) => void; onRemove: (note: Note) => void; onEdit: (note: Note, post: string) => Promise<void>; onQuote: (note: Note) => void; onOpen?: (note: Note) => void; pinned: boolean; allowPin?: boolean }) {
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
  return <article className={`stream-item ${pinned ? "is-pinned" : ""}`}>
    <div className="stream-avatar">{author.slice(0, 1).toUpperCase()}</div><div className="stream-item-body"><div className="stream-item-head"><div><strong>{author}</strong><span>{type === "Post" ? "přidal/a příspěvek" : systemText[type] || "provedl/a změnu"}</span><time>{relativeTime(note.createdAt)}</time></div>{note.isInternal && <span className="stream-internal">Interní</span>}</div>
      {editing ? <form className="stream-edit-form" onSubmit={(event) => { event.preventDefault(); setEditError(""); void onEdit(note, draft).then(() => setEditing(false)).catch((e) => setEditError(e instanceof Error ? e.message : "Uložení selhalo.")); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)}/>{editError && <small>{editError}</small>}<div><button type="button" className="stream-item-action" onClick={() => { setDraft(note.post || ""); setEditing(false); }}>Zrušit</button><button className="stream-item-action is-on" disabled={busy || !draft.trim()}>Uložit změny</button></div></form> : note.post ? <p className="stream-post-text">{note.post}</p> : note.data ? <SystemChange data={note.data}/> : null}
      {attachmentIds.length > 0 && <div className="stream-attachments">{attachmentIds.map((id) => { const imageAt = imageAttachments.findIndex((item) => item.id === id); const name = attachmentNames[id] || "Příloha"; return imageAt >= 0 ? <StreamImageAttachment key={id} id={id} name={name} onOpen={() => setImageIndex(imageAt)}/> : <button key={id} onClick={() => void downloadAttachment(id, name)}>{name}</button>; })}</div>}
      <div className="stream-item-footer">{reactions.map((reaction) => { const Icon = reactionIcons[reaction] || Smile; const count = Number(counts[reaction] || 0); const active = myReactions.includes(reaction); return <button key={reaction} className={`stream-reaction ${active ? "is-active" : ""}`} onClick={() => onReact(note, reaction)} disabled={busy} title={reactionNames[reaction] || reaction}><Icon size={13}/>{count > 0 ? count : ""}</button>; })}
        {onOpen && <button className="stream-item-action" onClick={() => onOpen(note)} title="Otevřít samostatný záznam poznámky"><ExternalLink size={13}/> Otevřít</button>}
        {type === "Post" && note.post && <button className="stream-item-action" onClick={() => onQuote(note)} title="Citovat v odpovědi"><MessageSquare size={13}/> Odpovědět citací</button>}
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
