// The screens were written for the previous backend and address an entity by a PascalCase scope ("Account") and a
// record by Espo-style attribute names. These helpers translate between those and the ViaCRM keys ("account").

export function scopeOf(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function keyOf(scope: string): string {
  return scope.charAt(0).toLowerCase() + scope.slice(1);
}

// System properties that the screens know under another name.
const SYSTEM_TO_SCREEN: Record<string, string> = { ownerId: "assignedUser", teamIds: "teams", createdById: "createdBy", updatedAt: "modifiedAt" };
const SCREEN_TO_SYSTEM: Record<string, string> = { assignedUser: "ownerId", teams: "teamIds", createdBy: "createdById", modifiedAt: "updatedAt" };

// ViaCRM property or field key -> field name used by the screens (layout columns, field definitions).
export function screenField(key: string): string {
  return SYSTEM_TO_SCREEN[key] ?? key;
}

// Field name used by the screens -> ViaCRM property or field key.
export function viaField(name: string): string {
  return SCREEN_TO_SYSTEM[name] ?? name;
}
