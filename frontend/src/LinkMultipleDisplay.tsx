import { Check, X } from "./Icons";
import type { FieldDef, Metadata } from "./api";

type Row = Record<string, any>;

export default function LinkMultipleDisplay({ entity, name, record, def, metadata, onOpen }: {
  entity: string;
  name: string;
  record: Row;
  def: FieldDef;
  metadata: Metadata;
  onOpen?: (entity: string, id: string) => void;
}) {
  const relatedEntity = metadata.entityDefs?.[entity]?.links?.[name]?.entity || (def as any).entity || "";
  const ids: string[] = Array.isArray(record[`${name}Ids`]) ? record[`${name}Ids`] : Array.isArray(record[name]) ? record[name] : [];
  if (!ids.length) return <span className="muted-cell">—</span>;

  const labels: Record<string, string> = record[`${name}Names`] || {};
  const columns: Row = record[`${name}Columns`] || {};
  const primaryLink = def.primaryLink || (entity === "Contact" && name === "accounts" ? "account" : "");
  const primaryId = primaryLink ? String(record[`${primaryLink}Id`] || "") : "";
  const isTaskStatusView = String(def.view || "").includes("task/fields/tasks");
  const taskStatusDef = metadata.entityDefs?.Task?.fields?.status || {};
  const taskStatusStyle = (taskStatusDef as any).style || {};
  const canceledStatuses: string[] = (metadata.scopes?.Task as any)?.canceledStatusList || ["Canceled"];
  const orderedIds = primaryId && ids.includes(primaryId) ? [primaryId, ...ids.filter((id) => id !== primaryId)] : ids;

  function relationColumns() {
    return Object.entries((def as any).columns || {}).flatMap(([key, rawField]) => {
      const field = String(rawField);
      const localScope = ["Meeting", "Call"].includes(entity) && key === "status" ? entity : "";
      const scope = localScope || (metadata.entityDefs?.[relatedEntity]?.fields?.[field] ? relatedEntity : entity);
      const fieldName = localScope ? "acceptanceStatus" : field;
      const fieldDef = metadata.entityDefs?.[scope]?.fields?.[fieldName] || {};
      if (!["enum", "enumInt", "enumFloat", "varchar"].includes(String(fieldDef.type || ""))) return [];
      return [{ key, field: fieldName, scope, def: fieldDef }];
    });
  }

  const columnsToShow = relationColumns();
  return <span className="link-multiple-display">{orderedIds.map((id) => {
    const rowColumns = columns[id] || {};
    const label = String(labels[id] || (primaryId === id && record[`${primaryLink}Name`]) || id);
    const status = String(rowColumns.status || "");
    const statusLabel = (metadata.labels as any)?.Task?.options?.status?.[status] || status;
    const style = String(taskStatusStyle[status] || "");
    const isCanceled = canceledStatuses.includes(status);
    const hasTaskStatusIcon = isTaskStatusView && Boolean(status) && (["success", "info", "danger", "warning"].includes(style));
    const inactive = entity === "Contact" && name === "accounts" && Boolean(rowColumns.isInactive);
    const link = onOpen && relatedEntity
      ? <button type="button" className={`link-multiple-name${inactive ? " inactive-account-reference" : ""}`} onClick={(event) => { event.stopPropagation(); onOpen(relatedEntity, id); }}>{label}</button>
      : <span className={`link-multiple-name${inactive ? " inactive-account-reference" : ""}`}>{label}</span>;
    return <span className="link-multiple-display-item" key={id}>
      {hasTaskStatusIcon && <span className={`link-multiple-status-icon ${style}`} title={statusLabel} aria-label={statusLabel}>{style === "success" ? <Check size={11}/> : isCanceled ? <X size={11}/> : <i/>}</span>}
      {link}
      {columnsToShow.map((column) => {
        const value = rowColumns[column.key];
        if (value == null || value === "") return null;
        const translation = (metadata.labels as any)?.[column.scope]?.options?.[column.field]?.[String(value)];
        return <span className="link-multiple-column-value" key={column.key}><i aria-hidden="true">·</i>{translation || String(value)}</span>;
      })}
    </span>;
  })}</span>;
}
