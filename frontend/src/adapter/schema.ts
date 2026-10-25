import type { ViaEntityMeta } from "./metadata.ts";

// The schema the adapter translates against (set whenever the metadata is loaded).
let entities = new Map<string, ViaEntityMeta>();

export function setSchema(list: ViaEntityMeta[]) {
  entities = new Map(list.map((entity) => [entity.key, entity]));
}

export function schemaOf(entityKey: string): ViaEntityMeta | undefined {
  return entities.get(entityKey);
}

export function fieldOf(entityKey: string, fieldKey: string) {
  return entities.get(entityKey)?.fields.find((field) => field.key === fieldKey);
}

// Active link fields the records of the entity can expand (not the owner: that one is resolved through the lookups).
export function expandableLinks(entityKey: string): string[] {
  return (entities.get(entityKey)?.fields ?? []).filter((field) => field.type === "link" && field.key !== "ownerId").map((field) => field.key);
}

// The name shown for a record: `name`, else `subject`, else first and last name.
export function displayName(record: Record<string, any>): string {
  for (const key of ["name", "subject", "title"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key];
  }
  const person = [record.firstName, record.lastName].filter((part) => typeof part === "string" && part.trim()).join(" ").trim();
  return person || String(record.id ?? "");
}
