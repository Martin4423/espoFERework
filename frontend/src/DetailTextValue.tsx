import { Fragment, useState } from "react";
import { ChevronDown, ChevronsUp } from "./Icons";

/** Native-style long-text detail with safe, useful links and an accessible expand control. */
export default function DetailTextValue({ value, cutHeight = 200, seeMoreDisabled = false, expandedByDefault = false }: { value: unknown; cutHeight?: number; seeMoreDisabled?: boolean; expandedByDefault?: boolean }) {
  const text = String(value ?? "");
  const collapsedHeight = Math.max(80, Number(cutHeight) || 200);
  const canCollapse = !seeMoreDisabled && !expandedByDefault && text.length > Math.floor(collapsedHeight * 3.5);
  const [expanded, setExpanded] = useState(expandedByDefault);
  const parts = text.split(/(https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Z]{2,})/gi);
  return <div className="detail-long-text">
    <div className={`detail-long-text-content${canCollapse && !expanded ? " is-collapsed" : ""}`} style={canCollapse && !expanded ? { maxHeight: collapsedHeight } : undefined}>
      {parts.map((part, index) => {
        if (/^https?:\/\//i.test(part)) return <a key={index} href={part} target="_blank" rel="noreferrer">{part}</a>;
        if (/^[\w.+-]+@[\w.-]+\.[A-Z]{2,}$/i.test(part)) return <a key={index} href={`mailto:${encodeURIComponent(part)}`}>{part}</a>;
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </div>
    {canCollapse && <button type="button" className="detail-long-text-toggle" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? <><ChevronsUp size={13}/>Zobrazit méně</> : <><ChevronDown size={13}/>Zobrazit celý text</>}</button>}
  </div>;
}
