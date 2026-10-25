import { UNSUPPORTED_TITLES } from "./unsupported.ts";

// The old screens print every failed call as an inline error. A feature that ViaCRM does not offer yet is not an error,
// so a banner carrying the "not available" text is restyled as a neutral notice instead of touching every screen.
export function startNoticeStyling(root: HTMLElement = document.body) {
  const mark = (element: Element) => {
    const text = (element.textContent ?? "").trim();
    element.classList.toggle("notice-unsupported", UNSUPPORTED_TITLES.has(text));
  };
  const scan = () => root.querySelectorAll(".inline-error").forEach(mark);
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  scan();
  return () => observer.disconnect();
}
