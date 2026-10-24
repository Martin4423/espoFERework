import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, X } from "./Icons";
import { entityLabel, request } from "./api";
import type { Metadata } from "./api";

type PopupItem = { id?: string; data?: Record<string, any> };

function formatReminderDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function PopupReminderToasts({ metadata, isPortalUser, onOpenRecord }: { metadata: Metadata; isPortalUser: boolean; onOpenRecord: (scope: string, id: string) => void }) {
  const [items, setItems] = useState<PopupItem[]>([]);
  const [removing, setRemoving] = useState("");
  const seen = useRef(new Set<string>());
  const firstCheck = useRef(true);
  const eventEnabled = useMemo(() => {
    const event = (metadata.app as any)?.popupNotifications?.event;
    return Boolean(event?.grouped && !event.disabled && !(isPortalUser && event.portalDisabled));
  }, [metadata, isPortalUser]);

  const load = useCallback(async () => {
    if (!eventEnabled) return;
    try {
      const grouped = await request<Record<string, PopupItem[]>>("PopupNotification/action/grouped");
      const next = (grouped.event || []).filter((item) => {
        if (!item.id || seen.current.has(item.id)) return false;
        seen.current.add(item.id);
        return true;
      });
      if (!firstCheck.current && next.length && !metadata.appSettings?.notificationSoundsDisabled) {
        const audio = new Audio("/client/sounds/pop_cork.mp3");
        audio.volume = 0.3;
        void audio.play().catch(() => {});
      }
      firstCheck.current = false;
      if (next.length) setItems((old) => [...old, ...next].slice(-5));
    } catch {
      // Reminders remain available from the native Notifications/Activities endpoints.
    }
  }, [eventEnabled, metadata.appSettings?.notificationSoundsDisabled]);

  useEffect(() => {
    if (!eventEnabled) return;
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [eventEnabled, load]);

  async function dismiss(item: PopupItem) {
    if (!item.id) return;
    setRemoving(item.id);
    try { await request("Activities/action/removePopupNotification", { method: "POST", body: JSON.stringify({ id: item.id }) }); }
    catch { /* Closing the local card must remain immediate even if cleanup fails. */ }
    finally { setItems((old) => old.filter((entry) => entry.id !== item.id)); setRemoving(""); }
  }

  if (!items.length) return null;
  return <aside className="popup-reminder-stack" aria-label="Připomínky" aria-live="polite">{items.map((item) => {
    const data = item.data || {};
    const scope = String(data.entityType || "");
    const id = String(data.id || "");
    const date = data.dateField ? formatReminderDate(data.attributes?.[data.dateField]) : "";
    return <article className="popup-reminder-card surface" key={item.id} role="status">
      <div className="popup-reminder-icon"><CalendarDays size={17}/></div>
      <button className="popup-reminder-main" type="button" onClick={() => { if (!scope || !id) return; void dismiss(item); onOpenRecord(scope, id); }} disabled={!scope || !id}>
        <span className="popup-reminder-heading">{scope ? entityLabel(metadata, scope) : "Připomínka"}</span>
        <strong>{data.name || "Událost"}</strong>
        {date && <span className="popup-reminder-date"><Bell size={12}/>{date}</span>}
      </button>
      <button className="icon-button popup-reminder-close" type="button" aria-label="Zavřít připomínku" title="Zavřít připomínku" disabled={removing === item.id} onClick={() => void dismiss(item)}><X size={15}/></button>
    </article>;
  })}</aside>;
}
