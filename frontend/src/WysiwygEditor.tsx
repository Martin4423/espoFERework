import { useEffect, useRef, useState } from "react";
import EspoIcon from "./EspoIcon";
import DOMPurify from "dompurify";
import { getAttachmentPreviewUrl, uploadAttachment } from "./api";

type Props = { value: string; htmlMode: boolean; entity: string; field: string; disabled?: boolean; sanitizeHtml?: boolean; onChange: (value: string) => void; onRegisterInsert?: (insert: (text: string, html?: boolean) => void) => void };

export default function WysiwygEditor({ value, htmlMode, entity, field, disabled = false, sanitizeHtml = true, onChange, onRegisterInsert }: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const codeEditor = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<Range | null>(null);
  const target = useRef<HTMLElement | null>(null);
  const blobUrls = useRef<string[]>([]);
  const imageInput = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<"link" | "image" | "table" | "cell" | null>(null);
  const [editingTable, setEditingTable] = useState(false);
  const [url, setUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [newWindow, setNewWindow] = useState(false);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [props, setProps] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codeView, setCodeView] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const node = canvas.current;
    if (!node || codeView) return;
    const needsRender = normalizeHtml(node) !== value;
    if (!needsRender) return;
    node.innerHTML = sanitizeHtml ? DOMPurify.sanitize(value, { USE_PROFILES: { html: true } }) : value;
    node.querySelectorAll<HTMLImageElement>("img[data-espo-attachment-id]").forEach((image) => {
      const id = image.dataset.espoAttachmentId;
      if (!id) return;
      void getAttachmentPreviewUrl(id).then((blobUrl) => {
        blobUrls.current.push(blobUrl); image.src = blobUrl;
      }).catch(() => {});
    });
  }, [value, sanitizeHtml, codeView]);
  useEffect(() => () => { blobUrls.current.forEach((url) => URL.revokeObjectURL(url)); blobUrls.current = []; }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [fullscreen]);
  useEffect(() => onRegisterInsert?.((text, html = false) => {
    if (codeView && codeEditor.current) {
      const input = codeEditor.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const insertion = html ? DOMPurify.sanitize(text, { USE_PROFILES: { html: true } }) : text;
      const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + insertion.length, start + insertion.length); });
      return;
    }
    restoreSelection();
    const current = window.getSelection();
    const insertion = html ? DOMPurify.sanitize(text, { USE_PROFILES: { html: true } }) : text;
    const fragment = document.createDocumentFragment();
    if (html) fragment.append(...Array.from(new DOMParser().parseFromString(insertion, "text/html").body.childNodes));
    else fragment.append(document.createTextNode(text));
    const lastNode = fragment.lastChild;
    if (current?.rangeCount) { const range = current.getRangeAt(0); range.deleteContents(); range.insertNode(fragment); if (lastNode) range.setStartAfter(lastNode); range.collapse(true); current.removeAllRanges(); current.addRange(range); selection.current = range.cloneRange(); }
    else canvas.current?.append(fragment);
    changed();
  }), [onRegisterInsert, codeView, value, onChange]);

  function rememberSelection() {
    const current = window.getSelection();
    if (!current?.rangeCount || !canvas.current?.contains(current.anchorNode)) return;
    selection.current = current.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    canvas.current?.focus();
    const current = window.getSelection();
    if (current && selection.current) { current.removeAllRanges(); current.addRange(selection.current); }
  }
  function normalizeHtml(root: HTMLElement) {
    const copy = root.cloneNode(true) as HTMLElement;
    copy.querySelectorAll<HTMLImageElement>("img[data-espo-attachment-id]").forEach((image) => { image.setAttribute("src", `?entryPoint=attachment&id=${encodeURIComponent(image.dataset.espoAttachmentId || "")}`); });
    return copy.innerHTML;
  }
  function changed() { if (canvas.current) onChange(normalizeHtml(canvas.current)); }
  function command(name: string, value?: string) { restoreSelection(); document.execCommand(name, false, value); changed(); rememberSelection(); }
  function setLineHeight(value: string) {
    restoreSelection();
    const current = window.getSelection();
    const selectedNode = current?.rangeCount ? current.getRangeAt(0).startContainer : null;
    const element = selectedNode instanceof Element ? selectedNode : selectedNode?.parentElement;
    const block = element?.closest("p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre") as HTMLElement | null;
    if (block && canvas.current?.contains(block)) { block.style.lineHeight = value; changed(); rememberSelection(); }
  }
  function openDialog(name: typeof dialog) {
    rememberSelection(); setError(""); setUrl(""); setLinkText(""); setNewWindow(false); setProps({});
    const current = window.getSelection();
    const selected = current?.rangeCount ? current.getRangeAt(0) : null;
    if (name === "link" && selected) setLinkText(selected.toString());
    if (name === "table" || name === "cell") {
      const element = selected?.startContainer instanceof Element ? selected.startContainer : selected?.startContainer.parentElement;
      const node = element?.closest(name === "table" ? "table" : "td,th") as HTMLElement | null;
      target.current = node;
      if (node) setProps({ width: node.style.width, height: node.style.height, backgroundColor: node.style.backgroundColor, color: node.style.color, borderWidth: node.style.borderWidth, borderColor: node.style.borderColor, padding: node.style.padding, textAlign: node.style.textAlign, verticalAlign: node.style.verticalAlign });
    }
    setDialog(name);
  }
  function openTableEditor() { setEditingTable(true); openDialog("table"); }
  function insertLink() {
    const safeUrl = url.trim();
    if (!safeUrl) return;
    if (!/^(https?:|mailto:|tel:)/i.test(safeUrl)) { setError("Odkaz musí používat http, https, mailto nebo tel."); return; }
    restoreSelection();
    const selectionNow = window.getSelection();
    const selectedText = selectionNow?.toString() || linkText.trim() || safeUrl;
    if (selectionNow?.rangeCount) selectionNow.getRangeAt(0).deleteContents();
    const anchor = document.createElement("a"); anchor.href = safeUrl; anchor.textContent = selectedText;
    if (newWindow) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
    selectionNow?.getRangeAt(0)?.insertNode(anchor);
    const range = document.createRange(); range.setStartAfter(anchor); range.collapse(true); selectionNow?.removeAllRanges(); selectionNow?.addRange(range);
    selection.current = range.cloneRange(); changed(); setDialog(null);
  }
  function insertImage(src: string, attachmentId?: string) {
    if (!src.trim()) return;
    if (!attachmentId && !/^https?:\/\//i.test(src.trim())) { setError("Adresa obrázku musí začínat http:// nebo https://."); return; }
    restoreSelection();
    const image = document.createElement("img"); image.src = src.trim(); image.alt = ""; image.style.maxWidth = "100%";
    if (attachmentId) image.dataset.espoAttachmentId = attachmentId;
    const active = window.getSelection();
    if (active?.rangeCount) active.getRangeAt(0).insertNode(image); else canvas.current?.append(image);
    const range = document.createRange(); range.setStartAfter(image); range.collapse(true); active?.removeAllRanges(); active?.addRange(range); selection.current = range.cloneRange(); changed();
    if (attachmentId) void getAttachmentPreviewUrl(attachmentId).then((blobUrl) => { blobUrls.current.push(blobUrl); if (image.isConnected) image.src = blobUrl; else URL.revokeObjectURL(blobUrl); }).catch(() => {});
    setDialog(null);
  }
  async function uploadImage(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try { const attachment = await uploadAttachment(file, entity, field, false, "Inline Attachment"); insertImage(`?entryPoint=attachment&id=${encodeURIComponent(attachment.id)}`, attachment.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Obrázek se nepodařilo nahrát."); }
    finally { setBusy(false); }
  }
  function insertTable() {
    restoreSelection();
    const table = document.createElement("table"); table.style.width = "100%"; table.style.borderCollapse = "collapse"; table.style.border = "1px solid #aeb7c6";
    const body = document.createElement("tbody");
    for (let row = 0; row < Math.min(20, Math.max(1, rows)); row++) { const tr = document.createElement("tr"); for (let col = 0; col < Math.min(12, Math.max(1, columns)); col++) { const cell = document.createElement(row === 0 ? "th" : "td"); cell.style.border = "1px solid #aeb7c6"; cell.style.padding = "6px"; cell.innerHTML = "&nbsp;"; tr.append(cell); } body.append(tr); }
    table.append(body); const active = window.getSelection(); if (active?.rangeCount) active.getRangeAt(0).insertNode(table); else canvas.current?.append(table); changed(); setDialog(null);
  }
  function applyElement() {
    const element = target.current;
    if (!element) return;
    for (const property of ["width", "height", "backgroundColor", "color", "borderWidth", "borderColor", "padding", "textAlign", "verticalAlign"]) {
      const value = props[property]?.trim() || "";
      if (property === "borderWidth" && value && /^\d+(\.\d+)?$/.test(value)) element.style.setProperty("border-width", `${value}px`);
      else if (["width", "height", "padding"].includes(property) && value && /^\d+(\.\d+)?$/.test(value)) element.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), `${value}px`);
      else if (value) element.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value);
      else element.style.removeProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
    }
    changed(); setDialog(null);
  }

  if (!htmlMode) return <textarea className="wysiwyg-plain-editor" aria-label="Text editoru" rows={9} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} spellCheck/>;
  return <div className={`wysiwyg-editor${fullscreen ? " is-fullscreen" : ""}`}>
    <fieldset className="wysiwyg-toolbar" disabled={disabled} role="toolbar" aria-label="Formátování">
      <select aria-label="Styl odstavce" title="Styl odstavce" defaultValue="p" onMouseDown={rememberSelection} onChange={(event) => { command("formatBlock", `<${event.target.value}>`); event.currentTarget.value = event.target.value; }}><option value="p">Odstavec</option><option value="h1">Nadpis 1</option><option value="h2">Nadpis 2</option><option value="h3">Nadpis 3</option><option value="h4">Nadpis 4</option><option value="blockquote">Citace</option><option value="pre">Předformátovaný text</option></select>
      <button type="button" title="Tučně" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}><EspoIcon className="fas fa-bold" size={14}/></button>
      <button type="button" title="Kurzíva" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}><EspoIcon className="fas fa-italic" size={14}/></button>
      <button type="button" title="Podtržení" onMouseDown={(event) => event.preventDefault()} onClick={() => command("underline")}><EspoIcon className="fas fa-underline" size={14}/></button>
      <button type="button" title="Přeškrtnutí" onMouseDown={(event) => event.preventDefault()} onClick={() => command("strikeThrough")}><EspoIcon className="fas fa-strikethrough" size={14}/></button>
      <button type="button" title="Odstranit formátování" onMouseDown={(event) => event.preventDefault()} onClick={() => command("removeFormat")}><EspoIcon className="fas fa-eraser" size={14}/></button>
      <select aria-label="Velikost písma" title="Velikost písma" defaultValue="" onMouseDown={rememberSelection} onChange={(event) => { if (event.target.value) command("fontSize", event.target.value); event.currentTarget.value = ""; }}><option value="">Velikost</option><option value="1">8 pt</option><option value="2">10 pt</option><option value="3">12 pt</option><option value="4">14 pt</option><option value="5">18 pt</option><option value="6">24 pt</option><option value="7">36 pt</option></select>
      <label className="wysiwyg-color-control" title="Barva písma" aria-label="Barva písma"><EspoIcon className="fas fa-font" size={13}/><input type="color" aria-label="Barva písma" onMouseDown={rememberSelection} onChange={(event) => command("foreColor", event.target.value)}/></label>
      <label className="wysiwyg-color-control" title="Barva zvýraznění" aria-label="Barva zvýraznění"><EspoIcon className="fas fa-highlighter" size={13}/><input type="color" aria-label="Barva zvýraznění" onMouseDown={rememberSelection} onChange={(event) => command("hiliteColor", event.target.value)}/></label>
      <button type="button" title="Odrážky" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")}><EspoIcon className="fas fa-list-ul" size={14}/></button>
      <button type="button" title="Číslovaný seznam" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertOrderedList")}><EspoIcon className="fas fa-list-ol" size={14}/></button>
      <select aria-label="Řádkování" title="Řádkování" defaultValue="" onMouseDown={rememberSelection} onChange={(event) => { if (event.target.value) setLineHeight(event.target.value); event.currentTarget.value = ""; }}><option value="">Řádky</option><option value="1">1×</option><option value="1.15">1,15×</option><option value="1.5">1,5×</option><option value="2">2×</option></select>
      <button type="button" title="Zarovnat vlevo" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyLeft")}><EspoIcon className="fas fa-align-left" size={14}/></button>
      <button type="button" title="Zarovnat na střed" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyCenter")}><EspoIcon className="fas fa-align-center" size={14}/></button>
      <button type="button" title="Zarovnat vpravo" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyRight")}><EspoIcon className="fas fa-align-right" size={14}/></button>
      <button type="button" title="Vložit nebo upravit odkaz" onMouseDown={(event) => event.preventDefault()} onClick={() => openDialog("link")}><EspoIcon className="fas fa-link" size={14}/></button>
      <button type="button" title="Vložit obrázek" onMouseDown={(event) => event.preventDefault()} onClick={() => openDialog("image")}><EspoIcon className="fas fa-image" size={14}/></button>
      <button type="button" title="Vložit tabulku" onMouseDown={(event) => event.preventDefault()} onClick={() => { setEditingTable(false); setRows(3); setColumns(3); openDialog("table"); }}><EspoIcon className="fas fa-table" size={14}/></button>
      <button type="button" title="Upravit tabulku" onMouseDown={(event) => event.preventDefault()} onClick={openTableEditor}><EspoIcon className="fas fa-pen-to-square" size={14}/></button>
      <button type="button" title="Upravit buňku" onMouseDown={(event) => event.preventDefault()} onClick={() => openDialog("cell")}><EspoIcon className="fas fa-pen-to-square" size={14}/></button>
      <button type="button" title="Vložit vodorovnou čáru" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertHorizontalRule")}><EspoIcon className="fas fa-minus" size={14}/></button>
      <button type="button" title={codeView ? "Vizuální editor" : "Zdrojový HTML kód"} aria-pressed={codeView} onMouseDown={(event) => { if (!codeView) rememberSelection(); event.preventDefault(); }} onClick={() => { if (codeView) selection.current = null; setCodeView((current) => !current); }}><EspoIcon className={codeView ? "fas fa-eye" : "fas fa-code"} size={14}/></button>
      <button type="button" title={fullscreen ? "Ukončit celoobrazovkové zobrazení" : "Celoobrazovkové zobrazení"} aria-pressed={fullscreen} onMouseDown={(event) => event.preventDefault()} onClick={() => setFullscreen((current) => !current)}><EspoIcon className={fullscreen ? "fas fa-compress" : "fas fa-expand"} size={14}/></button>
    </fieldset>
    {codeView ? <textarea ref={codeEditor} className="wysiwyg-codeview" aria-label="Zdrojový HTML kód" rows={14} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} spellCheck={false}/> : <div ref={canvas} className="wysiwyg-canvas" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-label="Obsah HTML" aria-multiline="true" onInput={changed} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={rememberSelection}/>}
    {dialog && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}><section className="record-modal wysiwyg-modal"><div className="modal-heading"><div><span className="eyebrow">EDITOR OBSAHU</span><h2>{dialog === "link" ? "Vložit odkaz" : dialog === "image" ? "Vložit obrázek" : dialog === "table" ? editingTable ? "Nastavení tabulky" : "Vložit tabulku" : "Nastavení buňky"}</h2></div><button type="button" className="icon-button" onClick={() => setDialog(null)} aria-label="Zavřít">×</button></div>
      {dialog === "link" && <><label className="setting-field"><span>Adresa URL</span><input autoFocus type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" required/></label><label className="setting-field"><span>Text odkazu</span><input value={linkText} onChange={(event) => setLinkText(event.target.value)} placeholder="Text odkazu"/></label>{error && <div className="inline-error">{error}</div>}<label className="wysiwyg-checkbox"><input type="checkbox" checked={newWindow} onChange={(event) => setNewWindow(event.target.checked)}/> Otevřít v novém okně</label></>}
      {dialog === "image" && <><label className="setting-field"><span>Adresa obrázku</span><input autoFocus type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…"/></label><div className="wysiwyg-upload"><span>Nebo nahrajte obrázek jako inline přílohu</span><input ref={imageInput} type="file" accept="image/*" disabled={busy} onChange={(event) => { void uploadImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}/></div>{error && <div className="inline-error">{error}</div>}</>}
      {dialog === "table" && !editingTable && <div className="wysiwyg-dimensions"><label className="setting-field"><span>Řádky</span><input type="number" min="1" max="20" value={rows} onChange={(event) => setRows(Number(event.target.value))}/></label><label className="setting-field"><span>Sloupce</span><input type="number" min="1" max="12" value={columns} onChange={(event) => setColumns(Number(event.target.value))}/></label></div>}
      {(dialog === "table" && editingTable && target.current || dialog === "cell" && target.current) && <div className="wysiwyg-dimensions">{(dialog === "table" ? ["width", "height", "borderWidth", "borderColor", "padding", "backgroundColor", "textAlign"] : ["width", "height", "backgroundColor", "color", "verticalAlign", "textAlign"]).map((key) => <label className="setting-field" key={key}><span>{{width:"Šířka",height:"Výška",borderWidth:"Tloušťka okraje",borderColor:"Barva okraje",padding:"Odsazení buňky",backgroundColor:"Barva pozadí",color:"Barva textu",textAlign:"Zarovnání textu",verticalAlign:"Svislé zarovnání"}[key]}</span>{["textAlign", "verticalAlign"].includes(key) ? <select value={props[key] || ""} onChange={(event) => setProps({ ...props, [key]: event.target.value })}><option value="">Výchozí</option>{(key === "textAlign" ? ["left", "center", "right"] : ["top", "middle", "bottom"]).map((item) => <option key={item}>{item}</option>)}</select> : <input type={key.includes("Color") || key === "color" || key === "backgroundColor" ? "color" : "text"} value={props[key] || ""} onChange={(event) => setProps({ ...props, [key]: event.target.value })}/>}</label>)}</div>}
      {(dialog === "cell" || dialog === "table" && editingTable) && !target.current && <div className="inline-error">Nejprve klikněte do tabulky nebo její buňky, kterou chcete upravit.</div>}
      <div className="modal-footer"><button type="button" className="button subtle" onClick={() => setDialog(null)}>Zrušit</button><button type="button" className="button primary" disabled={busy || dialog === "link" && !url.trim() || dialog === "image" && !url.trim() || (dialog === "cell" || dialog === "table" && editingTable) && !target.current} onClick={() => dialog === "link" ? insertLink() : dialog === "image" ? insertImage(url) : dialog === "table" && !editingTable ? insertTable() : applyElement()}>{busy ? "Nahrávám…" : dialog === "table" && !editingTable ? "Vložit tabulku" : "Použít"}</button></div>
    </section></div>}
  </div>;
}
