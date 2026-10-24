import { entityLabel, entityList } from "./api";
import type { Metadata } from "./api";

export function portalEntities(metadata: Metadata) {
  return entityList(metadata)
    .filter((name) => metadata.scopes[name]?.aclPortal && !metadata.scopes[name]?.disabled)
    .sort((a, b) => (metadata.scopes[a]?.order ?? 999) - (metadata.scopes[b]?.order ?? 999) || entityLabel(metadata, a, true).localeCompare(entityLabel(metadata, b, true), "cs"));
}
