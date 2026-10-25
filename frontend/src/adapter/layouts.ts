import { apiJson } from "../http.ts";
import { UnsupportedError } from "../problem.ts";
import { keyOf, screenField } from "./names.ts";
import type { DetailLayoutPanel, LayoutItem } from "../api";

// ---- ViaCRM wire shape (docs/contract m4 section 2) ----
export type ViaLayouts = {
  list: { custom: boolean; columns: string[]; sort?: string };
  detail: { custom: boolean; sections: Array<{ title: string; columns: number; rows: Array<Array<string | null>> }> };
};

export function toListLayout(layout: ViaLayouts["list"]): LayoutItem[] {
  return layout.columns.map((column, index) => ({ name: screenField(column), link: index === 0 }));
}

export function toDetailLayout(layout: ViaLayouts["detail"]): DetailLayoutPanel[] {
  return layout.sections.map((section) => ({
    label: section.title,
    rows: section.rows.map((row) => row.map((cell) => (cell ? { name: screenField(cell), fullWidth: section.columns === 1 } : false))),
  }));
}

const cache = new Map<string, Promise<ViaLayouts>>();

export function clearLayoutCache() { cache.clear(); }

function load(scope: string): Promise<ViaLayouts> {
  let pending = cache.get(scope);
  if (!pending) {
    pending = apiJson<ViaLayouts>(`/v1/meta/entities/${encodeURIComponent(keyOf(scope))}/layouts`);
    pending.catch(() => cache.delete(scope));
    cache.set(scope, pending);
  }
  return pending;
}

const LIST_NAMES = new Set(["list", "listSmall", "listForLastViewed"]);
const DETAIL_NAMES = new Set(["detail", "detailSmall"]);

// The screens ask for layouts by their old names; ViaCRM has "list" and "detail".
export async function loadLayout(scope: string, name: string): Promise<LayoutItem[] | DetailLayoutPanel[]> {
  if (LIST_NAMES.has(name)) return toListLayout((await load(scope)).list);
  if (DETAIL_NAMES.has(name)) return toDetailLayout((await load(scope)).detail);
  throw new UnsupportedError(`${scope}/layout/${name}`);
}
