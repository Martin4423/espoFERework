type GridItem = { x?: number; y?: number; width?: number; height?: number };

/** Find the first free rectangle in EspoCRM's normalized four-column dashboard grid. */
export function findDashletPosition(items: GridItem[], width = 2, height = 3): { x: number; y: number } {
  const w = Math.max(1, Math.min(4, width));
  const h = Math.max(1, Math.min(8, height));
  const maxY = Math.max(0, ...items.map((item) => (Number(item.y) || 0) + Math.max(1, Number(item.height) || 3))) + h;
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= 4 - w; x++) {
      const overlaps = items.some((item) => {
        const itemX = Number(item.x) || 0;
        const itemY = Number(item.y) || 0;
        const itemW = Math.max(1, Number(item.width) || 2);
        const itemH = Math.max(1, Number(item.height) || 3);
        return x < itemX + itemW && x + w > itemX && y < itemY + itemH && y + h > itemY;
      });
      if (!overlaps) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}

export function packDashboardItems<T extends GridItem>(items: T[]): T[] {
  const placed: T[] = [];
  items.forEach((item) => {
    const position = findDashletPosition(placed, Number(item.width) || 2, Number(item.height) || 3);
    placed.push({ ...item, ...position });
  });
  return placed;
}

/** Move or resize one dashlet while keeping every other dashlet in a free cell. */
export function placeDashboardItem<T extends GridItem & { id?: string }>(items: T[], id: string, x: number, y: number, width?: number, height?: number): T[] {
  const moving = items.find((item) => item.id === id);
  if (!moving) return items;
  const w = Math.max(1, Math.min(4, Math.round((width ?? Number(moving.width)) || 2)));
  const h = Math.max(1, Math.min(8, Math.round((height ?? Number(moving.height)) || 3)));
  const placed: T[] = [{ ...moving, x: Math.max(0, Math.min(4 - w, Math.round(x))), y: Math.max(0, Math.round(y)), width: w, height: h }];
  for (const item of items) {
    if (item.id === id) continue;
    const itemWidth = Math.max(1, Math.min(4, Math.round(Number(item.width) || 2)));
    const itemHeight = Math.max(1, Math.min(8, Math.round(Number(item.height) || 3)));
    const itemX = Math.max(0, Math.min(4 - itemWidth, Math.round(Number(item.x) || 0)));
    const itemY = Math.max(0, Math.round(Number(item.y) || 0));
    const candidate = { ...item, x: itemX, y: itemY, width: itemWidth, height: itemHeight };
    const overlap = placed.some((existing) => Number(candidate.x) < Number(existing.x) + Number(existing.width) && Number(candidate.x) + Number(candidate.width) > Number(existing.x) && Number(candidate.y) < Number(existing.y) + Number(existing.height) && Number(candidate.y) + Number(candidate.height) > Number(existing.y));
    if (overlap) placed.push({ ...candidate, ...findDashletPosition(placed, itemWidth, itemHeight), width: itemWidth, height: itemHeight });
    else placed.push(candidate);
  }
  return placed.sort((a, b) => Number(a.y || 0) - Number(b.y || 0) || Number(a.x || 0) - Number(b.x || 0));
}
