import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Minus, Plus, RefreshCw } from "./Icons";
import { getSession, request } from "./api";
import type { Metadata } from "./api";

type Row = Record<string, any>;
type BusyRange = Row & { dateStart?: string; dateEnd?: string; isBusyRange?: boolean; isWorkingRange?: boolean; isNonWorkingRange?: boolean };
type Props = {
  metadata: Metadata;
  userIds?: string[];
  userNames?: Record<string, string>;
  assignedUserId?: string;
  assignedUserName?: string;
  dateStart?: string;
  dateEnd?: string;
  allDay?: boolean;
  entityId?: string;
};
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MAX_WINDOW = 17 * DAY;
const EMPTY_NAMES: Record<string, string> = {};

function parseUtc(value?: string) {
  if (!value) return NaN;
  const normalized = String(value).trim().replace(" ", "T");
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
}

function zonedDateTime(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return NaN;
  const desired = Date.UTC(year, month - 1, day);
  let result = desired;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(result));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    result += desired - represented;
  }
  return result;
}

function shiftDateKey(value: string, days: number) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function parseDate(value: string | undefined, allDay: boolean | undefined, timeZone: string) {
  if (!value) return NaN;
  if (allDay) return zonedDateTime(value.slice(0, 10), timeZone);
  return parseUtc(value);
}

function formatDateTime(timestamp: number, timeZone: string, options: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat("cs-CZ", { ...options, timeZone }).format(new Date(timestamp)); }
  catch { return new Intl.DateTimeFormat("cs-CZ", options).format(new Date(timestamp)); }
}

function toApiDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 19).replace("T", " ");
}

function rangeDate(value: BusyRange) {
  const source = value.dateStart;
  if (!source) return NaN;
  return parseUtc(source);
}

export default function MeetingScheduler({ metadata, userIds = [], userNames: suppliedNames, assignedUserId, assignedUserName, dateStart, dateEnd, allDay, entityId }: Props) {
  const userNames = suppliedNames || EMPTY_NAMES;
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [rangesByUser, setRangesByUser] = useState<Record<string, BusyRange[]>>({});
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const [manualShift, setManualShift] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startWindow: number; width: number } | null>(null);
  const sessionUserId = getSession()?.user?.id;

  const people = useMemo(() => {
    const result = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (assignedUserId && !result.includes(assignedUserId)) result.unshift(assignedUserId);
    return result;
  }, [userIds, assignedUserId]);
  const personKey = people.join(",");

  useEffect(() => {
    if (!sessionUserId) return;
    let live = true;
    request<Row>(`Preferences/${encodeURIComponent(sessionUserId)}`).then((preferences) => {
      if (live && typeof preferences.timeZone === "string" && preferences.timeZone) setTimeZone(preferences.timeZone);
    }).catch(() => {});
    return () => { live = false; };
  }, [sessionUserId]);

  const meetingStart = parseDate(dateStart, allDay, timeZone);
  const parsedMeetingEnd = parseDate(dateEnd, allDay, timeZone);
  const meetingEnd = Number.isFinite(parsedMeetingEnd) && allDay && dateEnd
    ? zonedDateTime(shiftDateKey(dateEnd, 1), timeZone)
    : parsedMeetingEnd;
  const duration = Number.isFinite(meetingStart) && Number.isFinite(meetingEnd) && meetingEnd > meetingStart ? Math.max(meetingEnd - meetingStart, HOUR) : HOUR;
  const baseWindow = Math.min(Math.max(duration * 7, 8 * HOUR), MAX_WINDOW);
  const windowSize = Math.min(baseWindow * zoom, MAX_WINDOW);
  const baseStart = Number.isFinite(meetingStart) ? Math.floor((meetingStart - duration * 3) / HOUR) * HOUR : NaN;
  const baseEnd = Number.isFinite(meetingEnd) ? Math.ceil((meetingEnd + duration * 3) / HOUR) * HOUR : NaN;
  const initialWindowStart = Number.isFinite(baseStart) ? baseStart + Math.round((baseEnd - baseStart - windowSize) / 2) : NaN;
  const viewStart = initialWindowStart + pageOffset * windowSize + manualShift;
  const viewEnd = viewStart + windowSize;

  useEffect(() => { setPageOffset(0); setManualShift(0); setZoom(1); }, [dateStart, dateEnd, allDay, personKey]);

  useEffect(() => {
    let live = true;
    if (!personKey || !Number.isFinite(viewStart) || !Number.isFinite(viewEnd)) {
      setRangesByUser({}); setError(""); setLoading(false); return;
    }
    const from = viewStart - DAY;
    const to = viewEnd + 2 * DAY;
    const params = new URLSearchParams({ from: toApiDate(from), to: toApiDate(to), userIdList: personKey, entityType: "Meeting" });
    if (entityId) params.set("entityId", entityId);
    const timer = window.setTimeout(() => {
      setLoading(true); setError("");
      request<Record<string, BusyRange[]>>(`Timeline/busyRanges?${params}`).then((result) => {
        if (!live) return;
        setRangesByUser(result || {});
      }).catch((cause) => live && setError(cause instanceof Error ? cause.message : "Rozvrh účastníků se nepodařilo načíst."))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [personKey, viewStart, viewEnd, entityId, refreshKey]);

  useEffect(() => {
    let live = true;
    const missing = people.filter((id) => !userNames[id] && !(id === assignedUserId && assignedUserName));
    if (!missing.length) { setResolvedNames({}); return; }
    Promise.all(missing.map(async (id) => {
      try { const user = await request<Row>(`User/${encodeURIComponent(id)}`); return [id, String(user.name || user.userName || id)] as const; }
      catch { return [id, id] as const; }
    })).then((entries) => live && setResolvedNames(Object.fromEntries(entries)));
    return () => { live = false; };
  }, [personKey, assignedUserId, assignedUserName, userNames]);

  const ticks = useMemo(() => {
    if (!Number.isFinite(viewStart) || !Number.isFinite(viewEnd)) return [];
    const span = viewEnd - viewStart;
    const step = span > 8 * DAY ? DAY : span > 3 * DAY ? 6 * HOUR : 2 * HOUR;
    const first = Math.ceil(viewStart / step) * step;
    const result: number[] = [];
    for (let value = first; value < viewEnd; value += step) result.push(value);
    return result;
  }, [viewStart, viewEnd]);

  const position = (timestamp: number) => Math.max(0, Math.min(100, (timestamp - viewStart) / (viewEnd - viewStart) * 100));
  const meetingLeft = position(meetingStart);
  const meetingRight = position(meetingEnd);
  const colors = { ...(metadata.clientDefs?.Calendar?.colors || {}), ...((metadata.appSettings as any)?.calendarColors || {}) };
  const now = Date.now();
  const visibleNow = now >= viewStart && now <= viewEnd;
  const hasDates = Number.isFinite(meetingStart) && Number.isFinite(meetingEnd) && meetingEnd > meetingStart;
  const hasRanges = people.some((id) => Array.isArray(rangesByUser[id]));
  const tickFormat = (timestamp: number) => windowSize > 3 * DAY
    ? formatDateTime(timestamp, timeZone, { weekday: "short", day: "numeric", month: "numeric" })
    : formatDateTime(timestamp, timeZone, { hour: "2-digit", minute: "2-digit" });

  function changeZoom(direction: number) {
    const next = Math.max(0.5, Math.min(MAX_WINDOW / Math.max(baseWindow, 1), zoom * (direction > 0 ? 0.7 : 1.4)));
    setZoom(next); setPageOffset(0); setManualShift(0);
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !hasDates) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startWindow: viewStart, width: Math.max(1, event.currentTarget.getBoundingClientRect().width) };
    setDragging(true);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const shift = drag.startWindow - (event.clientX - drag.startX) / drag.width * windowSize;
    setManualShift(shift - initialWindowStart - pageOffset * windowSize);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function panTrackProps() {
    return { onPointerDown: beginDrag, onPointerMove: moveDrag, onPointerUp: finishDrag, onPointerCancel: finishDrag, onLostPointerCapture: finishDrag };
  }

  return <section className="meeting-scheduler" aria-label="Dostupnost účastníků schůzky">
    <header className="meeting-scheduler-header"><div><span className="eyebrow">PLÁNOVAČ SCHŮZKY</span><h3>Dostupnost účastníků</h3><p>Rozvrhy, pracovní dobu a kolize uvidíte pro každého účastníka zvlášť.</p></div><div className="meeting-scheduler-tools"><button type="button" className="icon-button" title="Oddálit" aria-label="Oddálit časovou osu" disabled={windowSize >= MAX_WINDOW} onClick={() => changeZoom(-1)}><Minus size={14}/></button><button type="button" className="icon-button" title="Přiblížit" aria-label="Přiblížit časovou osu" disabled={zoom <= 0.5} onClick={() => changeZoom(1)}><Plus size={14}/></button><button type="button" className="button subtle" onClick={() => { setPageOffset(0); setManualShift(0); setZoom(1); }} disabled={!pageOffset && !manualShift && zoom === 1}><CalendarDays size={14}/> Ke schůzce</button><button type="button" className="icon-button" onClick={() => { setPageOffset((value) => value - 1); setManualShift(0); }} disabled={!hasDates} title="Předchozí období" aria-label="Předchozí období"><ArrowLeft size={14}/></button><button type="button" className="icon-button" onClick={() => { setPageOffset((value) => value + 1); setManualShift(0); }} disabled={!hasDates} title="Další období" aria-label="Další období"><ArrowRight size={14}/></button></div></header>
    {people.length > 0 && <div className="meeting-scheduler-legend"><span><i className="busy"/>Obsazeno</span><span><i className="working"/>Pracovní doba</span><span><i className="non-working"/>Mimo pracovní dobu</span><span><i className="selected"/>Tato schůzka</span><span className="meeting-scheduler-timezone"><Clock3 size={12}/>{timeZone}</span></div>}
    {!people.length ? <div className="meeting-scheduler-empty"><CalendarDays size={20}/><strong>Přidejte účastníky</strong><span>Vyberte alespoň jednoho účastníka, aby se zobrazila jeho dostupnost.</span></div>
      : !hasDates ? <div className="meeting-scheduler-empty"><CalendarDays size={20}/><strong>Doplňte čas schůzky</strong><span>Časová osa se načte po zadání platného začátku a konce.</span></div>
      : <><div className="meeting-scheduler-range"><strong>{formatDateTime(viewStart, timeZone, { dateStyle: "medium" })} – {formatDateTime(viewEnd, timeZone, { dateStyle: "medium" })}</strong><button type="button" className="icon-button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} title="Obnovit rozvrh" aria-label="Obnovit rozvrh"><RefreshCw size={13}/></button></div>
        {error && <div className="meeting-scheduler-error" role="alert">{error}<button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Zkusit znovu</button></div>}
        <div className={`meeting-scheduler-viewport ${loading ? "loading" : ""}`}>
          <div className="meeting-scheduler-axis"><div className="meeting-scheduler-name-cell">Účastník</div><div className={`meeting-scheduler-track axis-track ${dragging ? "dragging" : ""}`} {...panTrackProps()}>{ticks.map((tick) => <span key={tick} style={{ left: `${position(tick)}%` }}>{tickFormat(tick)}</span>)}</div></div>
          {people.map((id) => {
            const name = id === assignedUserId ? assignedUserName || userNames[id] || resolvedNames[id] || id : userNames[id] || resolvedNames[id] || id;
            const ranges = rangesByUser[id] || [];
            const overlapsMeeting = (range: BusyRange) => Number.isFinite(rangeDate(range)) && Number.isFinite(parseUtc(range.dateEnd)) && rangeDate(range) < meetingEnd && parseUtc(range.dateEnd) > meetingStart;
            const busyConflicts = ranges.filter((range) => range.isBusyRange && overlapsMeeting(range));
            const outsideWorkingHours = ranges.some((range) => range.isNonWorkingRange && overlapsMeeting(range));
            return <div className="meeting-scheduler-person" key={id}><div className="meeting-scheduler-name-cell"><span className="meeting-scheduler-avatar">{name.slice(0, 1).toUpperCase()}</span><span><strong>{name}</strong><small>{busyConflicts.length ? `${busyConflicts.length} ${busyConflicts.length === 1 ? "kolize" : "kolizí"}` : outsideWorkingHours ? "Mimo pracovní dobu" : "Bez kolize"}</small></span></div><div className={`meeting-scheduler-track ${dragging ? "dragging" : ""}`} {...panTrackProps()}>
              {ranges.map((range, index) => {
                const start = rangeDate(range); const end = parseUtc(range.dateEnd);
                if (!Number.isFinite(start) || !Number.isFinite(end) || end <= viewStart || start >= viewEnd) return null;
                const left = position(start); const right = position(end);
                const kind = range.isBusyRange ? "busy" : range.isNonWorkingRange ? "non-working" : range.isWorkingRange ? "working" : "";
                if (!kind) return null;
                return <div key={`${id}-${index}`} className={`meeting-scheduler-range-block ${kind}`} style={{ left: `${left}%`, width: `${Math.max(0.35, right - left)}%` }} title={`${kind === "busy" ? "Obsazeno" : kind === "working" ? "Pracovní doba" : "Mimo pracovní dobu"}: ${formatDateTime(start, timeZone, { dateStyle: "medium", timeStyle: "short" })} – ${formatDateTime(end, timeZone, { dateStyle: "short", timeStyle: "short" })}`}/>;
              })}
              {meetingRight > meetingLeft && <div className="meeting-scheduler-range-block selected" style={{ left: `${meetingLeft}%`, width: `${Math.max(0.4, meetingRight - meetingLeft)}%`, color: String(colors.Meeting || "#557bc9") }} title={allDay ? `Tato celodenní schůzka: ${formatDateTime(meetingStart, timeZone, { dateStyle: "medium" })} – ${formatDateTime(meetingEnd - 1, timeZone, { dateStyle: "medium" })}` : `Tato schůzka: ${formatDateTime(meetingStart, timeZone, { dateStyle: "medium", timeStyle: "short" })} – ${formatDateTime(meetingEnd, timeZone, { dateStyle: "short", timeStyle: "short" })}`}/>}
              {ticks.map((tick) => <i className="meeting-scheduler-gridline" key={tick} style={{ left: `${position(tick)}%` }}/>)}
              {visibleNow && <i className="meeting-scheduler-now" style={{ left: `${position(now)}%` }} title={`Nyní · ${formatDateTime(now, timeZone, { timeStyle: "short" })}`}/>}
            </div></div>;
          })}
        </div>
        {loading && <div className="meeting-scheduler-loading" role="status"><span className="spinner"/> Načítám kalendáře…</div>}
        {!loading && !error && !hasRanges && <div className="meeting-scheduler-note">Pro vybrané účastníky nejsou dostupné kalendářové údaje.</div>}
      </>}
    <footer className="meeting-scheduler-footer">Rozvrh se zobrazuje v časovém pásmu {timeZone}. Přístup k podrobnostem ostatních událostí určuje oprávnění v ViaCRM.</footer>
  </section>;
}
