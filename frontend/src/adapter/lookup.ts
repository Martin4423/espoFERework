import { apiJson } from "../http.ts";

// Names of users and teams for the owner, creator and team fields. Cached per page load: names change rarely and a
// stale name for a few minutes is harmless; the cache is cleared with the metadata.
const users = new Map<string, string>();
const teams = new Map<string, string>();
// Names -> ids of the users seen in pickers: a "@Name" typed into a post is turned into a mention by id.
const byName = new Map<string, string>();

export function clearLookupCache() { users.clear(); teams.clear(); byName.clear(); }

export function rememberUsers(items: Array<{ id: string; name: string }>) {
  for (const item of items) { users.set(item.id, item.name); byName.set(item.name, item.id); }
}

export function mentionedIds(text: string): string[] {
  const ids = new Set<string>();
  let rest = text;
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // longest names first, and a matched span is consumed: "@Eva Nováková" is not also read as "@Eva"
  for (const name of [...byName.keys()].sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`@${escape(name)}(?![\\p{L}\\p{N}])`, "gu");
    if (pattern.test(rest)) { ids.add(byName.get(name)!); rest = rest.replace(pattern, " "); }
  }
  return [...ids].slice(0, 20);
}

type Item = { id: string; name: string };

async function resolve(kind: "users" | "teams", cache: Map<string, string>, ids: string[], chunk: number): Promise<Map<string, string>> {
  const missing = [...new Set(ids)].filter((id) => id && !cache.has(id));
  for (let i = 0; i < missing.length; i += chunk) {
    const part = missing.slice(i, i + chunk);
    try {
      const result = await apiJson<{ items: Item[] }>(`/v1/lookup/${kind}?ids=${part.join(",")}&limit=${chunk}`);
      for (const item of result.items) { cache.set(item.id, item.name); if (kind === "users") byName.set(item.name, item.id); }
    } catch { /* a name that cannot be resolved is shown as empty; the record itself is still usable */ }
  }
  return cache;
}

export const userNames = (ids: string[]) => resolve("users", users, ids, 50);
export const teamNames = (ids: string[]) => resolve("teams", teams, ids, 200);
