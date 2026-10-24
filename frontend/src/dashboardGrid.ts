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
