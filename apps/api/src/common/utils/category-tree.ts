import { Prisma } from '@prisma/client';

type CategoryLink = { id: string; parentCategoryId: string | null; isActive: boolean };

/** Includes the selected category and active descendants; malformed/inactive ancestry fails closed. */
export function categoryBranch(rows: CategoryLink[], selectedId: string): string[] {
  const byId = new Map(rows.map(row => [row.id, row]));
  const ancestry = new Set<string>();
  let cursor: string | null = selectedId;
  while (cursor) {
    const row = byId.get(cursor);
    if (!row?.isActive || ancestry.has(cursor)) return [];
    ancestry.add(cursor);
    cursor = row.parentCategoryId;
  }
  const result = new Set([selectedId]);
  const queue = [selectedId];
  const children = new Map<string, CategoryLink[]>();
  for (const row of rows) {
    if (row.parentCategoryId) children.set(row.parentCategoryId, [...(children.get(row.parentCategoryId) ?? []), row]);
  }
  for (let index = 0; index < queue.length; index++) {
    for (const row of children.get(queue[index]) ?? []) {
      if (row.isActive && !result.has(row.id)) { result.add(row.id); queue.push(row.id); }
    }
  }
  return [...result];
}

export async function resolveCategoryBranch(db: Pick<Prisma.TransactionClient, 'category'>, id: string) {
  return categoryBranch(await db.category.findMany({ select: { id: true, parentCategoryId: true, isActive: true } }), id);
}
