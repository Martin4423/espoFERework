import { apiJson } from "../http.ts";

// Names of users and teams for the owner, creator and team fields. Cached per page load: names change rarely and a
// stale name for a few minutes is harmless; the cache is cleared with the metadata.
const users = new Map<string, string>();
const teams = new Map<string, string>();

export function clearLookupCache() { users.clear(); teams.clear(); }

type Item = { id: string; name: string };

async function resolve(kind: "users" | "teams", cache: Map<string, string>, ids: string[], chunk: number): Promise<Map<string, string>> {
  const missing = [...new Set(ids)].filter((id) => id && !cache.has(id));
  for (let i = 0; i < missing.length; i += chunk) {
    const part = missing.slice(i, i + chunk);
    try {
      const result = await apiJson<{ items: Item[] }>(`/v1/lookup/${kind}?ids=${part.join(",")}&limit=${chunk}`);
      for (const item of result.items) cache.set(item.id, item.name);
    } catch { /* a name that cannot be resolved is shown as empty; the record itself is still usable */ }
  }
  return cache;
}

export const userNames = (ids: string[]) => resolve("users", users, ids, 50);
export const teamNames = (ids: string[]) => resolve("teams", teams, ids, 200);
