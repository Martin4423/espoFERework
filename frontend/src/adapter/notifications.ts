import { apiJson } from "../http.ts";
import { UnsupportedError } from "../problem.ts";
import { pagerFor } from "./pager.ts";
import { toScreenDateTime } from "./records.ts";

type Row = Record<string, any>;
type ViaNotification = { id: string; kind: string; entity: string; recordId: string; noteId: string | null; actorId: string | null; actorName: string | null; payload: Row; createdAt: string; read: boolean };

const scopeOf = (entity: string) => entity.charAt(0).toUpperCase() + entity.slice(1);

// ViaCRM kinds -> the notification types the screens know ("note", "mention", "assignment").
export function toScreenNotification(item: ViaNotification): Row {
  const parentType = scopeOf(item.entity);
  const base = { id: item.id, read: item.read, createdAt: toScreenDateTime(item.createdAt), createdByName: item.actorName ?? "", createdById: item.actorId };
  if (item.kind === "assignment") {
    return { ...base, type: "Assign", relatedType: parentType, relatedId: item.recordId, relatedParentType: parentType, relatedParentId: item.recordId, data: { entityType: parentType, entityId: item.recordId } };
  }
  const noteData = { id: item.noteId, type: "Post", post: item.payload?.snippet ?? "", parentType, parentId: item.recordId, createdByName: item.actorName ?? "", createdById: item.actorId };
  return { ...base, type: item.kind === "mention" ? "MentionInPost" : "Note", relatedType: "Note", relatedId: item.noteId, relatedParentType: parentType, relatedParentId: item.recordId, noteData, data: {} };
}

export async function notificationList(params: URLSearchParams): Promise<{ total: number; list: Row[] }> {
  const limit = Math.min(100, Math.max(1, Number(params.get("maxSize")) || 20));
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const pager = pagerFor("__notification", "all", async ({ limit: size, cursor }) => {
    const query = new URLSearchParams({ limit: String(Math.min(100, size)) });
    if (cursor) query.set("cursor", cursor);
    return apiJson<{ items: ViaNotification[]; nextCursor: string | null }>(`/v1/notifications?${query.toString()}`);
  });
  const page = await pager.page(offset, limit);
  const list = page.items.map(toScreenNotification);
  return { total: page.total ?? offset + list.length, list };
}

export async function unreadCount(): Promise<number> {
  return (await apiJson<{ count: number }>("/v1/notifications/unread-count")).count;
}

export async function markRead(ids: string[] | "all"): Promise<true> {
  await apiJson("/v1/notifications/read", { method: "POST", body: JSON.stringify(ids === "all" ? { all: true } : { ids }) });
  return true;
}

export async function setRead(id: string, read: boolean): Promise<true> {
  if (!read) throw new UnsupportedError("Notification:unread");
  return markRead([id]);
}
