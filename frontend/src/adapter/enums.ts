// Some screens compare a status with the text of the previous backend ("Completed", "Held", "Not Held"). For those
// fields the adapter shows and sends that text and translates it from and to the ViaCRM option at the boundary.
const MAP: Record<string, Record<string, string>> = {
  "task.status": { "Not Started": "notStarted", Started: "inProgress", Completed: "completed", Canceled: "canceled", Deferred: "deferred" },
  "call.status": { Planned: "planned", Held: "held", "Not Held": "notHeld" },
  "meeting.status": { Planned: "planned", Held: "held", "Not Held": "notHeld" },
  "lead.status": { New: "new", Assigned: "assigned", "In Process": "inProcess", Converted: "converted", Recycled: "recycled", Dead: "dead" },
  "deal.stage": { Prospecting: "prospecting", Qualification: "qualification", Proposal: "proposal", Negotiation: "negotiation", "Closed Won": "won", "Closed Lost": "lost" },
};

const key = (entityKey: string, field: string) => `${entityKey}.${field}`;

export function toScreenEnum(entityKey: string, field: string, value: unknown): unknown {
  const map = MAP[key(entityKey, field)];
  if (!map || typeof value !== "string") return value;
  return Object.entries(map).find(([, via]) => via === value)?.[0] ?? value;
}

export function toViaEnum(entityKey: string, field: string, value: unknown): unknown {
  const map = MAP[key(entityKey, field)];
  if (!map || typeof value !== "string") return value;
  return map[value] ?? value;
}

export function screenOptions(entityKey: string, field: string, viaOptions: string[] | undefined): string[] | undefined {
  if (!viaOptions || !MAP[key(entityKey, field)]) return viaOptions;
  return viaOptions.map((option) => toScreenEnum(entityKey, field, option) as string);
}

// "notStarted" -> "Not started": the label of an option that has no translation.
export function optionLabel(token: string): string {
  const words = token.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
