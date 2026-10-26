import { useSyncExternalStore } from "react";
import { cs } from "./cs.ts";
import type { MessageKey } from "./cs.ts";
import { en } from "./en.ts";

export type Locale = "cs" | "en";
export type { MessageKey };

const STORAGE_KEY = "via-locale";
const dictionaries: Record<Locale, Record<MessageKey, string>> = { cs, en };
const listeners = new Set<() => void>();

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "cs" || saved === "en") return saved;
  } catch { /* storage unavailable: fall through to the browser language */ }
  const language = typeof navigator === "undefined" ? "cs" : navigator.language || "cs";
  return language.toLowerCase().startsWith("en") ? "en" : "cs";
}

let current: Locale = detect();

export function getLocale(): Locale { return current; }

export function setLocale(locale: Locale) {
  if (locale === current) return;
  current = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* keep the choice for this page session */ }
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  listeners.forEach((listener) => listener());
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = dictionaries[current][key] ?? dictionaries.cs[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

// A text with both languages next to its use (the administration screens); `{name}` placeholders as in t().
export function T(cs: string, en: string, params: Record<string, string | number> = {}): string {
  const template = current === "en" ? en : cs;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

// Re-renders the component when the language changes.
export function useLocale(): Locale {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getLocale,
    getLocale,
  );
}

if (typeof document !== "undefined") document.documentElement.lang = current;
