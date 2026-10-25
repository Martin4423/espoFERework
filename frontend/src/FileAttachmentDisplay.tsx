import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowDownToLine, Image as ImageIcon, Paperclip } from "./Icons";
import { downloadAttachment, getAttachmentPreviewUrl } from "./api";
import type { FieldDef } from "./api";

const ImagePreviewDialog = lazy(() => import("./ImagePreviewDialog"));
type AttachmentValue = { id?: string; name?: string; type?: string };
const previewSizes: Record<string, number> = { "x-small": 60, small: 100, medium: 200, large: 400 };

/** Native-style file/image field display with authenticated previews and downloads. */
export default function FileAttachmentDisplay({ value, def, list = false }: { value: AttachmentValue | null | undefined; def: FieldDef; list?: boolean }) {
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailError, setThumbnailError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const id = String(value?.id || "");
  const name = String(value?.name || "Soubor");
  const type = String(value?.type || def.defaultType || (def.type === "image" ? "image/jpeg" : ""));
  const isImage = def.type === "image" || type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  const canPreview = Boolean(id && isImage && (def.type === "image" || def.showPreview));
  const size = String(list ? def.listPreviewSize || "small" : def.previewSize || "small");
  const dimension = previewSizes[size] || 100;

  useEffect(() => {
    if (!canPreview) { setThumbnailUrl(""); setThumbnailError(false); return; }
    let live = true;
    let objectUrl = "";
    setThumbnailUrl(""); setThumbnailError(false);
    getAttachmentPreviewUrl(id).then((url) => {
      objectUrl = url;
      if (live) setThumbnailUrl(url);
      else URL.revokeObjectURL(url);
    }).catch(() => { if (live) setThumbnailError(true); });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, canPreview]);

  if (!id) return <span className="muted-cell">—</span>;
  if (canPreview) return <>
    <button type="button" className={`file-attachment-display image${list ? " list" : ""}`} onClick={() => setPreviewOpen(true)} aria-label={`Zobrazit náhled: ${name}`} title={name}>
      {thumbnailUrl && !thumbnailError ? <img src={thumbnailUrl} alt="" loading="lazy" style={{ maxWidth: dimension, maxHeight: dimension }}/> : <span className="file-attachment-placeholder"><ImageIcon size={18}/></span>}
      {!list && <span>{name}</span>}
    </button>
    {previewOpen && <Suspense fallback={null}><ImagePreviewDialog images={[{ id, name, type }]} index={0} onIndexChange={() => {}} onClose={() => setPreviewOpen(false)}/></Suspense>}
  </>;

  return <button type="button" className="file-attachment-display" onClick={() => void downloadAttachment(id, name)} title={`Stáhnout ${name}`}>
    {isImage ? <ImageIcon size={14}/> : <Paperclip size={14}/>}<span>{name}</span><ArrowDownToLine size={13}/>
  </button>;
}
