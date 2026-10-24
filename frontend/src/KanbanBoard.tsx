import { useState } from "react";
import { Check, ChevronDown, Eye, Pencil, Plus, Trash2 } from "./Icons";
import { entityLabel, fieldLabel, type Metadata } from "./api";

type Row = Record<string, any>;
export type KanbanLayoutItem = { name?: string; link?: boolean | string; isLarge?: boolean; isMuted?: boolean; align?: "left" | "right"; hidden?: boolean };
export type KanbanGroup = { name: string; label?: string | null; style?: string | null; total: number; list: Row[] };

export default function KanbanBoard({ entity, metadata, statusField, groups, layout, loading, canCreate, canMove, canReorder, canEdit, canDelete, busyId, onOpenRecord, onEditRecord, onCreateInGroup, onChangeStatus, onRemove, onShowMore, onReorder }: {
  entity: string;
  metadata: Metadata;
  statusField: string;
  groups: KanbanGroup[];
  layout: KanbanLayoutItem[];
  loading: boolean;
  canCreate: boolean;
  canMove: boolean;
  canReorder: boolean;
  canEdit: boolean;
  canDelete: boolean;
  busyId: string;
  onOpenRecord: (row: Row) => void;
  onEditRecord: (row: Row) => void;
  onCreateInGroup: (status: string) => void;
  onChangeStatus: (row: Row, status: string) => void;
  onRemove: (row: Row) => void;
  onShowMore: (group: KanbanGroup) => void;
  onReorder?: (group: string, ids: string[]) => void;
}) {
  const [dragId, setDragId] = useState("");
  const [dropGroup, setDropGroup] = useState("");
  const options = metadata.entityDefs?.[entity]?.fields?.[statusField]?.options || [];
  const labels = (metadata.labels as any)?.[entity]?.options?.[statusField] || {};
  const statusStyle = (group: KanbanGroup) => ["success", "warning", "danger", "info", "primary", "secondary"].includes(String(group.style || "").toLowerCase()) ? ` kanban-tone-${String(group.style).toLowerCase()}` : "";
  const cardFields = layout.filter((item) => item?.name && item.name !== "name" && !item.hidden);
  const valueOf = (row: Row, field: string) => {
    const direct = row[field];
    if (direct != null) return direct;
    return row[`${field}Name`] ?? row[`${field}Id`] ?? row[`${field}Type`] ?? null;
  };
  const title = (row: Row) => row.name || row.subject || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.id;

  return <div className="kanban-board" aria-label={`${entityLabel(metadata, entity, true)} podle ${fieldLabel(statusField, metadata.entityDefs?.[entity]?.fields?.[statusField], entity, metadata)}`}>
    {groups.map((group) => {
      const hasMore = group.total < 0 ? group.list.length > 0 : group.list.length < group.total;
      return <section className={`kanban-column${statusStyle(group)}${dropGroup === group.name ? " drop-target" : ""}`} key={group.name} onDragOver={(event) => { if (canMove && dragId) { event.preventDefault(); setDropGroup(group.name); } }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDropGroup(""); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || dragId; setDropGroup(""); setDragId(""); const row = group.list.find((item) => item.id === id); if (id && !row) { const source = groups.flatMap((item) => item.list).find((item) => item.id === id); if (source && source[statusField] !== group.name) onChangeStatus(source, group.name); } }}>
        <header className="kanban-column-head"><span><i className="kanban-status-dot"/><strong>{group.label || labels[group.name] || group.name}</strong><small>{group.total >= 0 ? group.total : group.list.length}</small></span>{canCreate && <button type="button" className="icon-button" aria-label={`Vytvořit ${entityLabel(metadata, entity).toLocaleLowerCase("cs")} ve stavu ${group.label || labels[group.name] || group.name}`} title="Vytvořit v tomto stavu" onClick={() => onCreateInGroup(group.name)}><Plus size={14}/></button>}</header>
        <div className="kanban-card-list">
          {group.list.map((row) => <article className={`kanban-card${dragId === row.id ? " is-dragging" : ""}`} key={row.id} draggable={canMove} onDragOver={(event) => { if (canMove && dragId && dragId !== row.id) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain") || dragId; const source = groups.find((item) => item.list.some((candidate) => candidate.id === id)); setDropGroup(""); setDragId(""); if (!id || !source) return; if (source.name !== group.name) { const moving = source.list.find((candidate) => candidate.id === id); if (moving) onChangeStatus(moving, group.name); return; } if (!canReorder) return; const nextIds = group.list.map((candidate) => candidate.id).filter((candidate) => candidate !== id); const targetIndex = nextIds.indexOf(row.id); nextIds.splice(targetIndex < 0 ? nextIds.length : targetIndex, 0, id); onReorder?.(group.name, nextIds); }} onDragStart={(event) => { setDragId(row.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", row.id); }} onDragEnd={() => { setDragId(""); setDropGroup(""); }}>
            <button type="button" className="kanban-card-title" onClick={() => onOpenRecord(row)}><strong>{title(row)}</strong>{metadata.scopes?.[entity]?.stars && row.isStarred && <span aria-label="Oblíbený záznam">★</span>}</button>
            {cardFields.map((item) => {
              const field = item.name!; const def = metadata.entityDefs?.[entity]?.fields?.[field]; const raw = valueOf(row, field);
              if (raw == null || raw === "" || field === statusField) return null;
              const value = Array.isArray(raw) ? raw.map((part) => typeof part === "object" ? part.name : part).filter(Boolean).join(", ") : typeof raw === "object" ? raw.name || "" : String(raw);
              if (!value) return null;
              return <div className={`kanban-card-field${item.isLarge ? " is-large" : ""}${item.isMuted ? " is-muted" : ""}${item.align === "right" ? " align-right" : ""}`} key={field}><span>{fieldLabel(field, def, entity, metadata)}</span><b>{value}</b></div>;
            })}
          <footer className="kanban-card-actions"><button type="button" className="icon-button" aria-label="Zobrazit záznam" title="Zobrazit" onClick={() => onOpenRecord(row)}><Eye size={13}/></button>{canEdit && <button type="button" className="icon-button" aria-label="Upravit záznam" title="Upravit" onClick={() => onEditRecord(row)}><Pencil size={13}/></button>}{canMove && <label className="kanban-move-picker" title="Přesunout do stavu"><ChevronDown size={12}/><select aria-label={`Přesunout ${title(row)} do stavu`} value={String(row[statusField] || "")} disabled={busyId === row.id} onChange={(event) => onChangeStatus(row, event.target.value)}><option value="">Přesunout…</option>{options.map((option) => <option value={String(option)} key={String(option)}>{labels[String(option)] || String(option)}</option>)}</select></label>}{canDelete && <button type="button" className="icon-button danger-ghost" aria-label="Odstranit záznam" title="Odstranit" disabled={busyId === row.id} onClick={() => onRemove(row)}><Trash2 size={13}/></button>}</footer>
          </article>)}
          {loading && !group.list.length && <div className="kanban-empty-loading"><span className="spinner"/></div>}
          {!loading && !group.list.length && <div className="kanban-column-empty">Žádné záznamy</div>}
        </div>
        {hasMore && <button type="button" className="kanban-show-more" disabled={loading} onClick={() => onShowMore(group)}>{loading ? "Načítám…" : "Načíst další"}</button>}
      </section>;
    })}
    {!groups.length && !loading && <div className="kanban-empty-state"><Check size={18}/> Pro tuto entitu nejsou dostupné žádné kanbanové stavy.</div>}
  </div>;
}
