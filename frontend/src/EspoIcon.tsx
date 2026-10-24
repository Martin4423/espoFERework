import type { CSSProperties } from "react";

/** Render the icon class stored by EspoCRM metadata with EspoCRM's bundled FA font. */
export default function EspoIcon({ className, size = 16, title, style: extraStyle }: { className?: string; size?: number; title?: string; style?: CSSProperties }) {
  const classes = (className || "").trim().split(/\s+/).filter((part) => /^[a-zA-Z0-9_-]+$/.test(part));
  if (!classes.some((part) => part.startsWith("fa-"))) return null;
  const brand = classes.some((part) => part === "fab" || part === "fa-brands");
  const regular = classes.some((part) => part === "far" || part === "fa-regular");
  const style: CSSProperties = {
    fontFamily: brand ? "'Font Awesome 6 Brands'" : "'Font Awesome 6 Free'",
    fontWeight: brand || regular ? 400 : 900,
    fontSize: size,
    lineHeight: 1,
    display: "inline-block",
    width: size,
    textAlign: "center",
    flex: `0 0 ${size}px`,
    ...extraStyle,
  };
  return <i className={`espo-native-icon ${classes.join(" ")}`} style={style} aria-hidden={title ? undefined : true} aria-label={title} title={title} />;
}
