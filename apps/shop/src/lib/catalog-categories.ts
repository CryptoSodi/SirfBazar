export type CatalogCategory = { id: string; name: string; children?: CatalogCategory[] };

/** Resolve a selected subsection without confusing it with its parent. */
export function categoryPath(categories: CatalogCategory[], selected: string): CatalogCategory[] {
  for (const category of categories) {
    if (category.id === selected) return [category];
    const childPath = categoryPath(category.children ?? [], selected);
    if (childPath.length) return [category, ...childPath];
  }
  return [];
}
