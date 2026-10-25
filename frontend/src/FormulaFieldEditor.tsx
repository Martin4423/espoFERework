import { useEffect, useMemo, useRef, useState } from "react";
import * as ace from "ace-builds";
import "ace-builds/src-noconflict/ext-language_tools";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-chrome";
import { Code2, Plus, Search } from "lucide-react";
import { request } from "./api";
import type { FieldDef, Metadata } from "./api";

type PickerKind = "attribute" | "function" | "";
type FormulaFunction = { name: string; insertText?: string; returnType?: string; description?: string };

export default function FormulaFieldEditor({ entity, metadata, name, label, value, def, disabled, onChange }: {
  entity: string; metadata: Metadata; name: string; label: string; value: unknown; def: FieldDef; disabled: boolean; onChange: (value: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ace.Ace.Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const [picker, setPicker] = useState<PickerKind>("");
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [syntaxResult, setSyntaxResult] = useState<{ ok: boolean; message: string } | null>(null);
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  const targetEntity = String(def.targetEntityType || entity);
  const insertDisabled = Boolean(def.insertDisabled);
  const checkSyntaxDisabled = Boolean(def.checkSyntaxDisabled);
  onChangeRef.current = onChange;

  const attributes = useMemo(() => {
    const result = new Set<string>(["id"]);
    const addFields = (scope: string, prefix = "") => {
      for (const [field, fieldDef] of Object.entries(metadata.entityDefs?.[scope]?.fields || {})) {
        if (fieldDef.disabled || fieldDef.utility || fieldDef.available === false || fieldDef.notStorable || ["map", "linkMultiple", "attachmentMultiple"].includes(fieldDef.type || "")) continue;
        result.add(`${prefix}${field}`);
      }
    };
    addFields(targetEntity);
    const links = metadata.entityDefs?.[targetEntity]?.links || {};
    for (const [link, linkDef] of Object.entries(links)) {
      if (!linkDef.entity || !["belongsToParent", "hasOne", "belongsTo"].includes(linkDef.type || "")) continue;
      addFields(linkDef.entity, `${link}.`);
    }
    return [...result].sort((a, b) => a.localeCompare(b, "cs"));
  }, [metadata.entityDefs, targetEntity]);
  const functions = ((((metadata.app as any)?.formula?.functionList || []) as FormulaFunction[])
    .filter((item) => item.name && item.insertText)
    .filter((item) => {
      const allowed = def.allowedFunctionList as string[] | undefined;
      if (allowed && !allowed.some((pattern) => pattern.endsWith("\\") ? item.name.startsWith(pattern) : item.name === pattern)) return false;
      return targetEntity || !item.name.startsWith("entity\\");
    }));
  const items = picker === "attribute"
    ? attributes.map((item) => ({ key: item, value: item, label: item, detail: "Atribut" }))
    : functions.map((item) => ({ key: item.name, value: item.insertText || "", label: item.name, detail: item.returnType || item.description || "Funkce" }));
  const filtered = items.filter((item) => `${item.label} ${item.value} ${item.detail}`.toLocaleLowerCase("cs").includes(query.trim().toLocaleLowerCase("cs")));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const editor = ace.edit(container);
    editorRef.current = editor;
    editor.session.setMode("ace/mode/javascript");
    editor.setTheme("ace/theme/chrome");
    editor.setOptions({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: def.smallFont ? 11 : 13,
      minLines: 8,
      maxLines: Number(def.maxLineEditCount || 200),
      showPrintMargin: false,
      highlightActiveLine: true,
      enableBasicAutocompletion: !insertDisabled,
      enableLiveAutocompletion: !insertDisabled,
      wrap: true,
      useWorker: false,
    });
    if (!insertDisabled) {
      (editor as any).completers = [{
        identifierRegexps: [/\\[a-zA-Z0-9{}\[\].$'"]|[a-zA-Z0-9_$]+/],
        getCompletions: (_editor: unknown, _session: unknown, _position: unknown, prefix: string, callback: (error: null, values: Array<{ caption: string; value: string; meta: string }>) => void) => {
          const needle = prefix.toLocaleLowerCase("cs");
          const functionOptions = functions.filter((item) => item.insertText && item.name.toLocaleLowerCase("cs").includes(needle))
            .map((item) => ({ caption: `${item.name}()`, value: item.insertText || "", meta: item.returnType || "Funkce" }));
          const attributeOptions = attributes.filter((item) => item.toLocaleLowerCase("cs").startsWith(needle))
            .map((item) => ({ caption: item, value: item, meta: "Atribut" }));
          callback(null, [...functionOptions, ...attributeOptions].slice(0, 100));
        },
      }];
    }
    editor.container.setAttribute("aria-labelledby", `formula-label-${entity}-${name}`.replace(/[^a-zA-Z0-9_-]/g, "-"));
    editor.setValue(text, -1);
    const handleChange = () => { setSyntaxResult(null); onChangeRef.current(editor.getValue() || null); };
    (editor.session as any).on("change", handleChange);
    const resizeObserver = new ResizeObserver(() => editor.resize());
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      (editor.session as any).off("change", handleChange);
      editor.destroy();
      editorRef.current = null;
      container.replaceChildren();
    };
  // The editor is initialized once; subsequent values are synchronized below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== text) editor.setValue(text, -1);
  }, [text]);
  useEffect(() => { editorRef.current?.setReadOnly(disabled); }, [disabled]);

  const insert = (insertion: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.insert(insertion);
    editor.focus();
    setPicker("");
    setQuery("");
  };

  const checkSyntax = async () => {
    if (!text.trim()) { setSyntaxResult({ ok: true, message: "Syntaxe je v pořádku." }); return; }
    setChecking(true);
    setSyntaxResult(null);
    try {
      const response = await request<{ isSuccess?: boolean; message?: string }>("Formula/action/checkSyntax", { method: "POST", body: JSON.stringify({ expression: text }) });
      setSyntaxResult(response.isSuccess
        ? { ok: true, message: "Syntaxe je v pořádku." }
        : { ok: false, message: response.message ? `Syntaxe obsahuje chybu: ${response.message}` : "Syntaxe obsahuje chybu." });
    } catch (cause) {
      setSyntaxResult({ ok: false, message: cause instanceof Error ? cause.message : "Kontrola syntaxe se nezdařila." });
    } finally { setChecking(false); }
  };

  return <div className="field-input formula-field-editor">
    <span id={`formula-label-${entity}-${name}`.replace(/[^a-zA-Z0-9_-]/g, "-")}>{label}{def.required && <i> *</i>}</span>
    {(!insertDisabled || !checkSyntaxDisabled) && <div className="complex-expression-toolbar formula-editor-toolbar">
      {!insertDisabled && <>
        <button type="button" className="button subtle" disabled={disabled || !attributes.length} aria-expanded={picker === "attribute"} onClick={() => { setPicker((current) => current === "attribute" ? "" : "attribute"); setQuery(""); }}><Plus size={13}/> Vložit atribut</button>
        <button type="button" className="button subtle" disabled={disabled || !functions.length} aria-expanded={picker === "function"} onClick={() => { setPicker((current) => current === "function" ? "" : "function"); setQuery(""); }}><Code2 size={13}/> Vložit funkci</button>
      </>}
      {!checkSyntaxDisabled && <button type="button" className="button subtle" disabled={disabled || checking} onClick={() => void checkSyntax()}>{checking ? "Kontroluji…" : "Zkontrolovat syntaxi"}</button>}
    </div>}
    {picker && <div className="complex-expression-picker formula-field-picker" role="dialog" aria-label={picker === "attribute" ? "Vložit atribut" : "Vložit funkci"}>
      <label><Search size={13}/><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={picker === "attribute" ? "Hledat atribut…" : "Hledat funkci…"}/></label>
      <div className="complex-expression-options">{filtered.slice(0, 100).map((item) => <button type="button" key={item.key} onClick={() => insert(item.value)}><code>{item.label}</code><small>{item.detail}</small></button>)}{!filtered.length && <small className="field-hint">Nic jsme nenašli.</small>}</div>
      <small className="field-hint">{filtered.length > 100 ? `Zobrazeno 100 z ${filtered.length}. Upřesněte hledání.` : `${filtered.length} možností`}</small>
    </div>}
    <div className={`formula-code-surface${disabled ? " is-disabled" : ""}`} style={{ minHeight: `${Math.max(180, Number(def.height || 308))}px` }}><div ref={containerRef} className="formula-code-editor"/></div>
    {syntaxResult && <div className={`formula-syntax-result ${syntaxResult.ok ? "is-success" : "is-error"}`} role="status" aria-live="polite">{syntaxResult.message}</div>}
  </div>;
}
