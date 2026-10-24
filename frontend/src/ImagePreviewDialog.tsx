import { useEffect, useState } from "react";
import { ArrowDownToLine, ChevronLeft, ChevronRight, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from "./Icons";
import { downloadAttachment, getAttachmentPreviewUrl } from "./api";

type ImageFile = { id: string; name: string; type?: string };

/** Authenticated image preview with native-style navigation and transform controls. */
export default function ImagePreviewDialog({ images, index, onIndexChange, onClose }: { images: ImageFile[]; index: number; onIndexChange: (index: number) => void; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const image = images[index];
  useEffect(() => {
    if (!image?.id) return;
    let live = true;
    let objectUrl = "";
    setUrl(""); setError(""); setScale(1); setRotation(0);
    getAttachmentPreviewUrl(image.id).then((next) => { objectUrl = next; if (live) setUrl(next); else URL.revokeObjectURL(next); }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Obrázek nelze načíst."));
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image?.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && images.length > 1) onIndexChange((index - 1 + images.length) % images.length);
      if (event.key === "ArrowRight" && images.length > 1) onIndexChange((index + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, index, onClose, onIndexChange]);
  if (!image) return null;
  return <div className="modal-backdrop image-preview-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="image-preview-dialog" role="dialog" aria-modal="true" aria-label={`Náhled obrázku ${image.name || ""}`}><header><div><span className="eyebrow">NÁHLED OBRÁZKU {images.length > 1 ? `· ${index + 1} / ${images.length}` : ""}</span><strong title={image.name}>{image.name || "Obrázek"}</strong></div><div className="image-preview-actions"><button type="button" className="icon-button" title="Oddálit" aria-label="Oddálit" onClick={() => setScale((value) => Math.max(.25, value - .25))}><ZoomOut size={15}/></button><button type="button" className="image-preview-scale" onClick={() => setScale(1)} title="Obnovit velikost">{Math.round(scale * 100)}%</button><button type="button" className="icon-button" title="Přiblížit" aria-label="Přiblížit" onClick={() => setScale((value) => Math.min(4, value + .25))}><ZoomIn size={15}/></button><button type="button" className="icon-button" title="Otočit doleva" aria-label="Otočit doleva" onClick={() => setRotation((value) => value - 90)}><RotateCcw size={15}/></button><button type="button" className="icon-button" title="Otočit doprava" aria-label="Otočit doprava" onClick={() => setRotation((value) => value + 90)}><RotateCw size={15}/></button><button type="button" className="button subtle" onClick={() => void downloadAttachment(image.id, image.name || "obrazek")}><ArrowDownToLine size={14}/>Stáhnout</button><button type="button" className="icon-button" aria-label="Zavřít náhled" onClick={onClose}><X size={17}/></button></div></header><div className="image-preview-stage">{images.length > 1 && <button className="image-preview-nav previous" aria-label="Předchozí obrázek" onClick={() => onIndexChange((index - 1 + images.length) % images.length)}><ChevronLeft size={23}/></button>}{error ? <p className="inline-error">{error}</p> : url ? <img src={url} alt={image.name || "Náhled obrázku"} style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}/> : <span className="spinner"/>}{images.length > 1 && <button className="image-preview-nav next" aria-label="Další obrázek" onClick={() => onIndexChange((index + 1) % images.length)}><ChevronRight size={23}/></button>}</div></section></div>;
}
