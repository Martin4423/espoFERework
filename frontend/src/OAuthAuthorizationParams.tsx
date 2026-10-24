import { useMemo } from "react";
import { Braces, Check, WandSparkles } from "./Icons";

type Props = { value: unknown; onChange?: (value: string) => void; readOnly?: boolean; label?: string };
function textOf(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
export default function OAuthAuthorizationParams({ value, onChange, readOnly = false, label = "Authorization parameters" }: Props) {
  const text = textOf(value);
  const validity = useMemo(() => {
    if (!text.trim()) return { valid: true, empty: true };
    try { JSON.parse(text); return { valid: true, empty: false }; }
    catch { return { valid: false, empty: false }; }
  }, [text]);
  function format() {
    if (!onChange) return;
    try { onChange(JSON.stringify(JSON.parse(text || "{}"), null, 2)); } catch {}
  }
  if (readOnly) return <pre className="oauth-params-readonly">{text || "—"}</pre>;
  return <div className="field-input oauth-params-editor"><span><Braces size={14}/>{label}</span><div className="oauth-params-toolbar"><small className={validity.valid ? "valid" : "invalid"}>{validity.empty ? "Prázdný objekt bude uložen jako null" : validity.valid ? <><Check size={12}/> Platný JSON</> : "Neplatný JSON"}</small><button type="button" className="button subtle" onClick={format} disabled={!validity.valid || validity.empty}><WandSparkles size={13}/>Formátovat</button></div><textarea aria-label="OAuth authorization parameters JSON" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={text} onChange={(event) => onChange?.(event.target.value)} onKeyDown={(event) => { if (event.key !== "Tab") return; event.preventDefault(); const target = event.currentTarget; const start = target.selectionStart; const end = target.selectionEnd; const next = text.slice(0, start) + "  " + text.slice(end); onChange?.(next); requestAnimationFrame(() => target.setSelectionRange(start + 2, start + 2)); }} placeholder={'{\n  "prompt": "consent"\n}'}/><small className="oauth-params-hint">Vložte validní JSON objekt. Tato pole se přidají do OAuth autorizačního požadavku.</small></div>;
}
