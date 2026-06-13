/**
 * One-off: dedupe categories and apply canonical names/icons/order.
 * Merges alias categories (e.g. grocerapp's "fruits-and-vegetables") into the
 * canonical icon-bearing category ("fruits-vegetables" 🥕): reassigns all
 * products, repoints any coupons, then deletes the now-empty alias.
 * Idempotent — safe to run repeatedly.
 */
import { PrismaClient } from '@prisma/client';
import { CANONICAL_CATEGORIES } from './category-map';

const prisma = new PrismaClient();

async function main() {
  for (const c of CANONICAL_CATEGORIES) {
    // Ensure the canonical category exists with the right name/icon/order.
    const canonical = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, iconUrl: c.icon, sortOrder: c.sortOrder, isActive: true },
      create: { slug: c.slug, name: c.name, iconUrl: c.icon, sortOrder: c.sortOrder, isActive: true },
    });

    for (const aliasSlug of c.aliases ?? []) {
      const alias = await prisma.category.findUnique({ where: { slug: aliasSlug } });
      if (!alias || alias.id === canonical.id) continue;

      const moved = await prisma.product.updateMany({
        where: { categoryId: alias.id },
        data: { categoryId: canonical.id },
      });
      await prisma.coupon.updateMany({
        where: { applicableCategoryId: alias.id },
        data: { applicableCategoryId: canonical.id },
      });
      await prisma.category.delete({ where: { id: alias.id } });
      console.log(`merged ${aliasSlug} → ${c.slug} (${moved.count} products)`);
    }
  }

  const remaining = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`\n${remaining.length} categories after merge:`);
  for (const r of remaining) {
    console.log(`  ${r.iconUrl ?? '  '} ${r.name} (${r._count.products})`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
