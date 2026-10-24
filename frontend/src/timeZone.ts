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

export function formatEspoDateTimeShort(value: string | undefined, timeZone: string, now = new Date(), yesterdayLabel = "včera", hasSeconds = false) {
  const date = parseEspoDateTime(value);
  if (!date) return value || "—";
  const dateParts = (input: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(input).map((part) => [part.type, part.value]));
  try {
    const targetParts = dateParts(date);
    const todayParts = dateParts(now);
    const targetKey = `${targetParts.year}-${targetParts.month}-${targetParts.day}`;
    const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
    const todayDate = new Date(Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, Number(todayParts.day)));
    todayDate.setUTCDate(todayDate.getUTCDate() - 1);
    const yesterdayKey = `${todayDate.getUTCFullYear()}-${String(todayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(todayDate.getUTCDate()).padStart(2, "0")}`;
    const time = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit", ...(hasSeconds ? { second: "2-digit" as const } : {}), timeZone }).format(date);
    if (targetKey === todayKey) return time;
    if (targetKey === yesterdayKey) return `${yesterdayLabel} ${time}`;
    return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", ...(targetParts.year !== todayParts.year ? { year: "2-digit" as const } : {}), timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeZone: "UTC" }).format(date);
  }
}

export function zonedWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timeZone: string) {
  const targetDate = new Date(0);
  targetDate.setUTCFullYear(year, month - 1, day);
  targetDate.setUTCHours(hour, minute, second, 0);
  const targetWallTime = targetDate.getTime();
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const representedWallTime = (timestamp: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    const date = new Date(0);
    date.setUTCFullYear(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    date.setUTCHours(Number(parts.hour), Number(parts.minute), Number(parts.second), 0);
    return date.getTime();
  };
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = targetWallTime + hours * 60 * 60 * 1000;
    offsets.add(representedWallTime(sample) - sample);
  }
  const candidates = [...offsets].map((offset) => {
    const timestamp = targetWallTime - offset;
    return { timestamp, represented: representedWallTime(timestamp) };
  });
  const exact = candidates.filter((item) => item.represented === targetWallTime).sort((a, b) => a.timestamp - b.timestamp);
  if (exact.length) return new Date(exact[0].timestamp);

  // A wall time inside a spring-forward gap has no exact instant. Compatible
  // disambiguation moves it forward by the gap while retaining its minutes.
  const afterGap = candidates.filter((item) => item.represented > targetWallTime)
    .sort((a, b) => a.represented - b.represented || a.timestamp - b.timestamp);
  if (afterGap.length) return new Date(afterGap[0].timestamp);

  return new Date(candidates.sort((a, b) => b.represented - a.represented || a.timestamp - b.timestamp)[0]?.timestamp ?? targetWallTime);
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
