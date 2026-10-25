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
  for (const key of ["name", "subject"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key];
  }
  const person = [record.firstName, record.lastName].filter((part) => typeof part === "string" && part.trim()).join(" ").trim();
  return person || String(record.id ?? "");
}

// ---- reverse links: "the contacts of an account" ----
// A link field of an entity (contact.account) gives the target a list of the records that point at it (account.contacts).
export type ReverseLink = { name: string; entityKey: string; field: string };

// Links a target's name must not shadow; the screens treat some names specially.
const RESERVED_LINK_NAMES = new Set(["teams", "assignedUser", "createdBy", "activities", "history"]);

export function reverseLinks(targetKey: string): ReverseLink[] {
  const result: ReverseLink[] = [];
  const taken = new Set<string>();
  for (const entity of entities.values()) {
    for (const field of entity.fields) {
      if (field.type !== "link" || field.key === "ownerId" || field.readOnly || field.properties?.target !== targetKey) continue;
      let name = `${entity.key}s`;
      if (RESERVED_LINK_NAMES.has(name) || taken.has(name)) name = `${entity.key}sBy${field.key.charAt(0).toUpperCase()}${field.key.slice(1)}`;
      taken.add(name);
      result.push({ name, entityKey: entity.key, field: field.key });
    }
  }
  return result;
}
