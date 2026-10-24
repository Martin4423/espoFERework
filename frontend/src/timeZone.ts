import { useEffect, useState } from "react";
import { getSession, request } from "./api";

export function parseEspoDateTime(value?: string) {
  if (!value) return null;
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEspoDateTime(value: string | undefined, timeZone: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
  }
  const date = parseEspoDateTime(value);
  if (!date) return value || "—";
  try { return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short", timeZone }).format(date); }
  catch { return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(date); }
}

function zonedWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timeZone: string) {
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute, second);
  let timestamp = targetWallTime;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let index = 0; index < 3; index++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    const representedWallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    timestamp += targetWallTime - representedWallTime;
  }
  return new Date(timestamp);
}

function toEspoUtcString(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

export function formatEspoDateTimeInput(value: string | undefined, timeZone: string) {
  const date = parseEspoDateTime(value);
  if (!date) return "";
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch { return date.toISOString().slice(0, 16); }
}

export function espocrmDateTimeFromInput(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  try { return toEspoUtcString(zonedWallTimeToUtc(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]), 0, timeZone)); }
  catch { return value.replace("T", " "); }
}

export function dateFilterBoundaryInTimeZone(value: string, timeZone: string, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return `${value} ${endOfDay ? "23:59:59" : "00:00:00"}`;
  const date = new Date(Date.UTC(year, month - 1, day + (endOfDay ? 1 : 0)));
  const result = zonedWallTimeToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 0, 0, 0, timeZone);
  if (endOfDay) result.setTime(result.getTime() - 1000);
  return toEspoUtcString(result);
}

export function useEspoTimeZone() {
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  useEffect(() => {
    const userId = getSession()?.user.id;
    if (!userId) return;
    let live = true;
    request<Record<string, unknown>>(`Preferences/${encodeURIComponent(userId)}`).then((preferences) => {
      if (!live || typeof preferences.timeZone !== "string" || !preferences.timeZone) return;
      try { new Intl.DateTimeFormat("en", { timeZone: preferences.timeZone }); setTimeZone(preferences.timeZone); }
      catch { /* Keep the browser time zone when the saved zone is invalid. */ }
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  return timeZone;
}
