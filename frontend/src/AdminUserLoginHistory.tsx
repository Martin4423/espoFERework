import { useEffect, useState } from "react";
import { Clock3, ShieldAlert, ShieldCheck } from "./Icons";
import { request } from "./api";
import { formatEspoDateTime, useEspoTimeZone } from "./timeZone";

type LoginEvent = { id: string; username?: string; ipAddress?: string; createdAt?: string; isDenied?: boolean; denialReason?: string; authenticationMethod?: string; requestMethod?: string; requestUrl?: string };

/** The native AuthLogRecord entity is admin-readable; show its latest events in the user detail. */
export default function AdminUserLoginHistory({ userId }: { userId: string }) {
  const timeZone = useEspoTimeZone();
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setBusy(true); setError("");
    const params = new URLSearchParams({ maxSize: "10", offset: "0", orderBy: "createdAt", order: "desc" });
    params.set("whereGroup", JSON.stringify([{ type: "equals", attribute: "userId", value: userId }]));
    request<{ list?: LoginEvent[] }>(`AuthLogRecord?${params}`)
      .then((result) => live && setEvents(result.list || []))
      .catch((cause) => live && setError(cause instanceof Error ? cause.message : "Historii přihlášení se nepodařilo načíst."))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [userId]);

  return <section className="detail-panel user-login-history"><div className="drawer-section-title"><span>POSLEDNÍ PŘIHLÁŠENÍ</span><Clock3 size={14}/></div>
    {error ? <div className="inline-error">{error}</div> : busy ? <div className="table-loading"><span className="spinner"/>Načítám historii…</div> : events.length ? <div className="user-login-events">{events.map((event) => <article key={event.id} className={event.isDenied ? "denied" : "accepted"}><span className="user-login-result">{event.isDenied ? <ShieldAlert size={15}/> : <ShieldCheck size={15}/>}</span><div><strong>{event.isDenied ? `Odmítnuto${event.denialReason ? ` · ${event.denialReason}` : ""}` : "Přihlášení přijato"}</strong><small>{formatEspoDateTime(event.createdAt, timeZone)}{event.authenticationMethod ? ` · ${event.authenticationMethod}` : ""}</small></div><code>{event.ipAddress || "—"}</code></article>)}</div> : <div className="table-empty">Pro tohoto uživatele zatím nejsou zaznamenaná přihlášení.</div>}
  </section>;
}
