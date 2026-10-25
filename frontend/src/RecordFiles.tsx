import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { auth, apiJson } from "./http.ts";
import { ApiError, problemFromResponse } from "./problem.ts";
import { keyOf } from "./adapter/names.ts";
import { useConfirmDialog } from "./ConfirmDialogProvider";
import { t, useLocale } from "./i18n/index.ts";

type ViaFile = { id: string; name: string; contentType: string; size: number; uploadedById: string; uploadedByName: string; createdAt: string };

const MAX_MB = 25;

const sizeText = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export async function downloadFile(id: string, name: string): Promise<void> {
  const response = await auth.authorizedFetch(`/v1/files/${encodeURIComponent(id)}/content`);
  if (!response.ok) throw await problemFromResponse(response);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name || "file"; anchor.style.display = "none";
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The files of one record (ViaCRM keeps files per record, not in file fields).
export default function RecordFiles({ entity, recordId, canUpload, currentUserId, isAdmin }: { entity: string; recordId: string; canUpload: boolean; currentUserId: string; isAdmin: boolean }) {
  useLocale();
  const confirm = useConfirmDialog();
  const key = keyOf(entity);
  const [files, setFiles] = useState<ViaFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setFiles((await apiJson<{ items: ViaFile[] }>(`/v1/records/${key}/${recordId}/files`)).items); }
    catch (cause) { setFiles([]); if (!(cause instanceof ApiError && cause.status === 404)) setError(cause instanceof Error ? cause.message : t("files.failed")); }
  }, [key, recordId]);
  useEffect(() => { void load(); }, [load]);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setError(""); setBusy(true);
    try {
      for (const file of Array.from(list)) {
        if (file.size > MAX_MB * 1024 * 1024) { setError(t("files.tooLarge", { limit: MAX_MB })); continue; }
        const form = new FormData();
        form.append("file", file, file.name);
        const response = await auth.authorizedFetch(`/v1/records/${key}/${recordId}/files`, { method: "POST", body: form });
        if (!response.ok) { setError((await problemFromResponse(response)).message); break; }
      }
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("files.failed")); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  async function remove(file: ViaFile) {
    if (!await confirm({ title: t("files.deleteTitle"), message: t("files.deleteMessage", { name: file.name }), confirmLabel: t("files.delete"), tone: "danger" })) return;
    setError("");
    try { await apiJson(`/v1/files/${file.id}`, { method: "DELETE" }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("files.failed")); }
  }

  return <section className="surface record-files" data-testid="record-files" aria-label={t("files.title")}>
    <div className="card-heading"><div><h2>{t("files.title")}</h2><p>{files.length}</p></div>
      {canUpload && <><button type="button" className="button subtle" onClick={() => input.current?.click()} disabled={busy}><Paperclip size={14} /> {busy ? t("files.uploading") : t("files.upload")}</button>
        <input ref={input} type="file" multiple hidden data-testid="file-input" onChange={(event) => void upload(event.target.files)} /></>}
    </div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {files.length === 0 ? <p className="muted-cell">{t("files.empty")}</p> : <ul className="record-files-list">{files.map((file) => <li key={file.id}>
      <button type="button" className="link-button" onClick={() => void downloadFile(file.id, file.name).catch((cause) => setError(cause instanceof Error ? cause.message : t("files.failed")))} title={t("files.download")}>{file.name}</button>
      <small>{sizeText(file.size)} · {t("files.by", { name: file.uploadedByName })}</small>
      {(isAdmin || file.uploadedById === currentUserId) && <button type="button" className="icon-button" aria-label={`${t("files.delete")}: ${file.name}`} onClick={() => void remove(file)}><Trash2 size={14} /></button>}
    </li>)}</ul>}
  </section>;
}
