import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Activity, ArrowDown, ArrowLeft, Bell, Check, ChevronRight, LoaderCircle, Paperclip, RefreshCw, Send, Trash2, Users, X } from "./Icons";
import { request, uploadAttachment } from "./api";
import type { User } from "./api";
import { StreamItem, type Note } from "./RecordStream";

type Page<T> = { list?: T[]; total?: number };
type NotificationItem = Record<string, any>;
const PAGE_SIZE = 20;

export function ActivityView({ user, onBack }: { user: User; onBack: () => void }) {
  const [mode, setMode] = useState<"stream" | "own">("stream");
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
  const draftIds = useRef<string[]>([]);

  const url = useMemo(() => `User/${encodeURIComponent(user.id)}/stream${mode === "own" ? "/own" : ""}`, [user.id, mode]);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const result = await request<Page<Note>>(`${url}?maxSize=${PAGE_SIZE}&offset=0`);
      setItems(result.list || []); setTotal(result.total ?? -2);
    } catch (e) { setError(e instanceof Error ? e.message : "Aktivitu se nepodařilo načíst."); }
    finally { setBusy(false); }
  }, [url]);
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
      await request("Note", { method: "POST", body: JSON.stringify({ parentType: "User", parentId: user.id, targetType: "self", type: "Post", post: post.trim() || null, attachmentsIds: files.map((file) => file.id), attachmentsNames: Object.fromEntries(files.map((file) => [file.id, file.name])), attachmentsTypes: Object.fromEntries(files.map((file) => [file.id, file.type])) }) });
      draftIds.current = []; setFiles([]); setPost(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Příspěvek se nepodařilo publikovat."); }
    finally { setPosting(false); }
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true); setFileError("");
    try {
      const uploaded: Array<{ id: string; name: string; type: string }> = [];
      for (const file of Array.from(fileList)) { const item = await uploadAttachment(file, "Note", "attachments", true); uploaded.push(item); draftIds.current.push(item.id); }
      setFiles((old) => [...old, ...uploaded]);
    } catch (e) { setFileError(e instanceof Error ? e.message : "Přílohu se nepodařilo nahrát."); }
    finally { setUploading(false); }
  }
  async function removeFile(id: string) {
    setFiles((old) => old.filter((file) => file.id !== id)); draftIds.current = draftIds.current.filter((item) => item !== id);
    await request(`Attachment/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  async function loadMore() {
    setLoadingMore(true); setError("");
    try {
      const result = await request<Page<Note>>(`${url}?maxSize=${PAGE_SIZE}&offset=${items.length}`);
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

  return <div className="social-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Přehled</button><div className="eyebrow">STREAM A KOMUNIKACE</div><h1>Aktivita</h1><p>Příspěvky a aktualizace sdílené s vaším účtem.</p></div><button className="button subtle" onClick={() => void load()} disabled={busy}><RefreshCw size={14}/> Obnovit</button></div>
    <div className="social-tabs"><button className={mode === "stream" ? "active" : ""} onClick={() => setMode("stream")}><Users size={14}/> Stream pro mě</button><button className={mode === "own" ? "active" : ""} onClick={() => setMode("own")}><Activity size={14}/> Moje příspěvky</button></div>
    {error && <div className="table-error">{error}<button onClick={() => void load()}>Zkusit znovu</button></div>}
    <form className="surface activity-composer" onSubmit={(event) => void submitPost(event)}><textarea value={post} onChange={(event) => setPost(event.target.value)} placeholder="Napište příspěvek…" rows={3}/>{files.length > 0 && <div className="stream-draft-files">{files.map((file) => <span key={file.id}>{file.name}<button type="button" onClick={() => void removeFile(file.id)} aria-label={`Odebrat ${file.name}`}><X size={12}/></button></span>)}</div>}{fileError && <small className="stream-file-error">{fileError}</small>}<div><label className="stream-add-file"><input type="file" multiple onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }} disabled={uploading || posting}/><Paperclip size={14}/>{uploading ? "Nahrávám…" : "Přiložit soubor"}</label><small>Publikuje se na vaší osobní zdi.</small><button className="button primary" disabled={posting || uploading || (!post.trim() && !files.length)}>{posting ? "Odesílám…" : "Publikovat"}<Send size={13}/></button></div></form>
    <section className="surface social-feed">{busy ? <div className="table-loading"><span className="spinner"/> Načítám aktivitu…</div> : items.length ? items.map((note) => <StreamItem key={note.id} note={note} reactions={reactions} currentUserId={user.id} busy={actionId === note.id || actionId.startsWith(`${note.id}:`)} onReact={react} onPin={() => {}} onRemove={remove} onEdit={edit} onQuote={quote} pinned={false} allowPin={false}/>) : <div className="stream-empty"><Activity size={22}/><span>Ve streamu zatím nejsou žádné příspěvky.</span></div>}{canLoadMore && !busy && <button className="stream-load-more" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? <LoaderCircle size={14} className="spin"/> : <ArrowDown size={14}/>} Starší aktivita</button>}</section>
  </div>;
}

export function NotificationCenter({ onBack, onOpenRecord, onUnreadChange }: { onBack: () => void; onOpenRecord: (scope: string, id: string) => void; onUnreadChange: () => void }) {
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
      const result = await request<Page<NotificationItem>>(`Notification?maxSize=${PAGE_SIZE}&offset=${offset}`);
      const page: NotificationItem[] = (result.list || []).map((item): NotificationItem => ({ ...item, read: true }));
      if (!offset) setItems(page); else setItems((old) => [...old, ...page.filter((item) => !old.some((previous) => previous.id === item.id))]);
      setHasMore(page.length === PAGE_SIZE);
      onUnreadChange();
    } catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo načíst."); }
    finally { setBusy(false); setLoadingMore(false); }
  }, [onUnreadChange]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function markAllRead() {
    setMarking(true); setError("");
    try { await request("Notification/action/markAllRead", { method: "POST", body: JSON.stringify({}) }); setItems((old) => old.map((item) => ({ ...item, read: true }))); onUnreadChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo označit jako přečtená."); }
    finally { setMarking(false); }
  }
  async function remove(item: NotificationItem) {
    setRemoving(item.id); setError("");
    try { await request(`Notification/${encodeURIComponent(item.id)}`, { method: "DELETE" }); setItems((old) => old.filter((entry) => entry.id !== item.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Oznámení se nepodařilo odstranit."); }
    finally { setRemoving(""); }
  }
  function open(item: NotificationItem) {
    const note = item.noteData || {};
    const related = item.related || {};
    const scope = note.parentType || item.relatedParentType || item.relatedType || related.type || item.data?.entityType || item.data?.scope;
    const id = note.parentId || item.relatedParentId || item.relatedId || related.id || item.data?.entityId || item.data?.id;
    if (scope && id) onOpenRecord(scope, id);
  }
  function title(item: NotificationItem) {
    if (item.noteData?.post) return item.noteData.post;
    if (item.message) return item.message;
    return ({ Note: "Nová aktivita", MentionInPost: "Zmínka v příspěvku", UserReaction: "Reakce na příspěvek", Assign: "Záznam vám byl přiřazen", EmailReceived: "Nový e-mail", EntityRemoved: "Záznam byl odstraněn" } as Record<string, string>)[item.type] || item.type || "Oznámení";
  }
  return <div className="social-view notification-view"><div className="entity-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={14}/> Přehled</button><div className="eyebrow">CENTRUM UPOZORNĚNÍ</div><h1>Oznámení</h1><p>Upozornění přiřazená vašemu účtu.</p></div><div className="notification-actions"><button className="button subtle" onClick={() => setRefreshKey((value) => value + 1)} disabled={busy}><RefreshCw size={14}/> Obnovit</button><button className="button primary" onClick={() => void markAllRead()} disabled={marking}>{marking ? "Označuji…" : "Označit vše jako přečtené"}<Check size={14}/></button></div></div>
    {error && <div className="table-error">{error}<button onClick={() => setRefreshKey((value) => value + 1)}>Zkusit znovu</button></div>}
    <section className="surface notification-list">{busy ? <div className="table-loading"><span className="spinner"/> Načítám oznámení…</div> : items.length ? items.map((item) => { const note = item.noteData || {}; const author = note.createdByName || item.createdByName; const scope = note.parentType || item.relatedType; return <article className={`notification-row ${item.read ? "is-read" : "is-unread"}`} key={item.id}><button className="notification-main" onClick={() => open(item)}><span className="notification-icon"><Bell size={15}/></span><span className="notification-copy"><strong>{title(item)}</strong><span>{author ? `${author} · ` : ""}{scope || item.type || "CRM"}</span><time>{item.createdAt ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(item.createdAt).replace(" ", "T"))) : ""}</time></span>{!item.read && <i className="notification-unread-dot"/>}<ChevronRight size={15}/></button><button className="notification-remove" onClick={() => void remove(item)} disabled={removing === item.id} title="Odstranit oznámení"><Trash2 size={14}/></button></article>; }) : <div className="stream-empty"><Bell size={22}/><span>Nemáte žádná nová oznámení.</span></div>}{hasMore && !busy && <button className="stream-load-more" onClick={() => void load(items.length)} disabled={loadingMore}>{loadingMore ? <LoaderCircle size={14} className="spin"/> : <ArrowDown size={14}/>} Načíst starší oznámení</button>}</section>
  </div>;
}
