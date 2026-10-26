import { Check, Phone, X } from "./Icons";
import FaIcon from "./FaIcon";
import type { FieldDef, Metadata } from "./api";

type Row = Record<string, any>;

export default function LinkMultipleDisplay({ entity, name, record, def, metadata, onOpen, onOpenCategory, showRelatedColorIcon = false }: {
  entity: string;
  name: string;
  record: Row;
  def: FieldDef;
  metadata: Metadata;
  showRelatedColorIcon?: boolean;
  onOpen?: (entity: string, id: string) => void;
  onOpenCategory?: (entity: string, id: string) => void;
}) {
  const relatedEntity = metadata.entityDefs?.[entity]?.links?.[name]?.entity || (def as any).entity || "";
  const relatedEntityColor = showRelatedColorIcon && !metadata.appSettings?.scopeColorsDisabled
    ? String(metadata.clientDefs?.[relatedEntity]?.color || "")
    : "";
  const isCategoryTree = String(def.view || "").includes("link-multiple-category-tree");
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
    const configuredColumns = (def as any).columns || (entity === "Settings" && name === "oidcTeams" ? { group: "group" } : {});
    return Object.entries(configuredColumns).flatMap(([key, rawField]) => {
      const field = String(rawField);
      const localScope = ["Meeting", "Call"].includes(entity) && key === "status" ? entity : "";
      const scope = localScope || (metadata.entityDefs?.[relatedEntity]?.fields?.[field] ? relatedEntity : entity);
      const fieldName = localScope ? "acceptanceStatus" : field;
      const fieldDef = metadata.entityDefs?.[scope]?.fields?.[fieldName] || (entity === "Settings" && name === "oidcTeams" && key === "group" ? { type: "varchar", label: "IdP Group" } : {});
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
    const phoneNumber = entity === "Call" && name === "contacts" ? String(record.phoneNumbersMap?.[`${relatedEntity}_${id}`] || "") : "";
    const dialNumber = phoneNumber.replace(/[^\d+*#,;]/g, "");
    const link = isCategoryTree && onOpenCategory && relatedEntity
      ? <button type="button" className="link-multiple-name" onClick={(event) => { event.stopPropagation(); onOpenCategory(relatedEntity, id); }}>{label}</button>
      : onOpen && relatedEntity
      ? <button type="button" className={`link-multiple-name${inactive ? " inactive-account-reference" : ""}`} onClick={(event) => { event.stopPropagation(); onOpen(relatedEntity, id); }}>{label}</button>
      : <span className={`link-multiple-name${inactive ? " inactive-account-reference" : ""}`}>{label}</span>;
    return <span className="link-multiple-display-item" key={id}>
      {hasTaskStatusIcon && <span className={`link-multiple-status-icon ${style}`} title={statusLabel} aria-label={statusLabel}>{style === "success" ? <Check size={11}/> : isCanceled ? <X size={11}/> : <i/>}</span>}
      {relatedEntityColor && <FaIcon className="link-multiple-related-icon fas fa-square" size={11} style={{ color: relatedEntityColor }} />}
      {link}
      {phoneNumber && <a className="attendee-phone-link" href={`tel:${dialNumber}`} aria-label={`Zavolat ${label} na ${phoneNumber}`} title={`Zavolat ${phoneNumber}`} onClick={(event) => event.stopPropagation()}><Phone size={12}/><span>{phoneNumber}</span></a>}
      {columnsToShow.map((column) => {
        const value = rowColumns[column.key];
        if (value == null || value === "") return null;
        const translation = (metadata.labels as any)?.[column.scope]?.options?.[column.field]?.[String(value)];
        const fieldDef = column.def as any;
        let styleMap = fieldDef.style || {};
        if (!Object.keys(styleMap).length && fieldDef.optionsReference) {
          const [referenceEntity, referenceField] = String(fieldDef.optionsReference).split(".");
          styleMap = metadata.entityDefs?.[referenceEntity]?.fields?.[referenceField]?.style || {};
        }
        const configuredStyle = String(styleMap[String(value)] || "default");
        const isStyledLabel = Boolean(fieldDef.displayAsLabel) && configuredStyle !== "default";
        const allowedStyle = ["warning", "danger", "success", "info", "primary"].includes(configuredStyle) ? configuredStyle : "default";
        return <span className="link-multiple-column-value" key={column.key}><i aria-hidden="true">·</i>{isStyledLabel ? <span className={`enum-value-label ${allowedStyle}`}>{translation || String(value)}</span> : translation || String(value)}</span>;
      })}
    </span>;
  })}</span>;
}
