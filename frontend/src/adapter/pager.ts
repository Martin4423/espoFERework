// The screens page by offset ("page 3 of 12"); ViaCRM pages by opaque cursors. The pager remembers the cursor of every
// offset it has passed and walks forward in chunks to reach one it has not seen, so jumping to a page works and moving
// to the next page costs one request.
export type Page = { items: any[]; nextCursor: string | null; total?: number };
type PageFetcher = (request: { limit: number; cursor: string | null; total: boolean }) => Promise<Page>;

const WALK_CHUNK = 200;

export class CursorPager {
  private readonly cursors = new Map<number, string | null>([[0, null]]);
  private readonly fetcher: PageFetcher;

  constructor(fetcher: PageFetcher) { this.fetcher = fetcher; }

  async page(offset: number, limit: number): Promise<{ items: any[]; total: number | null }> {
    let at = Math.max(...[...this.cursors.keys()].filter((known) => known <= offset));
    while (at < offset) {
      const step = Math.min(WALK_CHUNK, offset - at);
      const chunk = await this.fetcher({ limit: step, cursor: this.cursors.get(at) ?? null, total: false });
      if (!chunk.nextCursor) {
        // past the end: the real total tells the screen where the list stops
        const last = await this.fetcher({ limit: 1, cursor: this.cursors.get(0) ?? null, total: true });
        return { items: [], total: last.total ?? null };
      }
      at += step;
      this.cursors.set(at, chunk.nextCursor);
    }
    const result = await this.fetcher({ limit, cursor: this.cursors.get(offset) ?? null, total: true });
    if (result.nextCursor) this.cursors.set(offset + result.items.length, result.nextCursor);
    return { items: result.items, total: result.total ?? null };
  }
}

// Pagers by query signature; any write to an entity forgets them (their cursors may no longer fit the data).
const pagers = new Map<string, { entity: string; pager: CursorPager }>();
const MAX_PAGERS = 40;

export function pagerFor(entityKey: string, signature: string, fetcher: PageFetcher): CursorPager {
  const key = `${entityKey}|${signature}`;
  const existing = pagers.get(key);
  if (existing) return existing.pager;
  if (pagers.size >= MAX_PAGERS) pagers.delete(pagers.keys().next().value as string);
  const created = { entity: entityKey, pager: new CursorPager(fetcher) };
  pagers.set(key, created);
  return created.pager;
}

export function forgetPagers(entityKey: string) {
  for (const [key, value] of pagers) if (value.entity === entityKey) pagers.delete(key);
}
