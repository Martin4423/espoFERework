import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, X } from "./Icons";

/** Square, movable crop editor for EspoCRM image fields. */
export default function ImageCropDialog({ file, onCancel, onCrop }: { file: File; onCancel: () => void; onCrop: (cropped: File) => void }) {
  const [url, setUrl] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const cropSize = 320;
  const baseScale = size.width && size.height ? Math.max(cropSize / size.width, cropSize / size.height) : 1;
  const drawWidth = size.width * baseScale * zoom;
  const drawHeight = size.height * baseScale * zoom;
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  async function crop() {
    const image = new Image(); image.src = url;
    try {
      await image.decode(); setBusy(true); setError("");
      const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Pro ořez není dostupné plátno.");
      const stageOffsetX = (cropSize - drawWidth) / 2 + offset.x;
      const stageOffsetY = (cropSize - drawHeight) / 2 + offset.y;
      const sourceX = Math.max(0, -stageOffsetX / (baseScale * zoom));
      const sourceY = Math.max(0, -stageOffsetY / (baseScale * zoom));
      const sourceSize = cropSize / (baseScale * zoom);
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Ořez obrázku se nepodařil.")), "image/jpeg", .92));
      onCrop(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ořez obrázku se nepodařil."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop image-crop-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}><section className="image-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="image-crop-title"><header><div><span className="eyebrow">OBRÁZEK · OŘEZ</span><strong id="image-crop-title">{file.name}</strong></div><button type="button" className="icon-button" onClick={onCancel} disabled={busy} aria-label="Zavřít"><X size={16}/></button></header><div className="image-crop-stage" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }; }} onPointerMove={(event) => { if (!drag.current) return; const x = event.clientX - drag.current.x; const y = event.clientY - drag.current.y; setOffset({ x: Math.max((cropSize - drawWidth) / 2, Math.min((drawWidth - cropSize) / 2, drag.current.ox + x)), y: Math.max((cropSize - drawHeight) / 2, Math.min((drawHeight - cropSize) / 2, drag.current.oy + y)) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><img src={url} alt="Ořezávaný obrázek" onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} style={{ width: drawWidth, height: drawHeight, left: `calc(50% + ${offset.x}px)`, top: `calc(50% + ${offset.y}px)` }}/><div className="image-crop-mask"/></div><div className="image-crop-controls"><button type="button" className="icon-button" aria-label="Oddálit" onClick={() => setZoom((value) => Math.max(1, value - .1))}><Minus size={15}/></button><input aria-label="Přiblížení ořezu" type="range" min="1" max="4" step="0.05" value={zoom} onChange={(event) => { setZoom(Number(event.target.value)); setOffset({ x: 0, y: 0 }); }}/><button type="button" className="icon-button" aria-label="Přiblížit" onClick={() => setZoom((value) => Math.min(4, value + .1))}><Plus size={15}/></button><span>{Math.round(zoom * 100)} %</span></div>{error && <div className="inline-error">{error}</div>}<footer><button type="button" className="button subtle" onClick={onCancel} disabled={busy}>Zrušit</button><button type="button" className="button primary" onClick={() => void crop()} disabled={busy || !size.width}>{busy ? "Ořezávám…" : <><Check size={14}/> Použít ořez</>}</button></footer></section></div>;
}
