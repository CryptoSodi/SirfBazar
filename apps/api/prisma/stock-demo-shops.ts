/**
 * Stocks the seeded demo merchants with real catalog products (the scraped ones,
 * which have images) so the dynamic/hyperlocal customer site shows image-rich,
 * orderable products across many categories — instead of the handful of
 * image-less bespoke seed products.
 *
 * Each shop is stocked from categories appropriate to its type. Prices/stock are
 * derived deterministically from the product id (demo data; stable across re-runs).
 * Idempotent — uses skipDuplicates on the unique (merchantId, productId).
 *
 *   cd apps/api && npm run stock:demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Which catalog categories each shop type stocks.
const SHOP_CATEGORIES: Record<string, string[]> = {
  GROCERY: [
    'groceries', 'milk-eggs-bread', 'snacks-drinks', 'breakfast-essentials',
    'daalain-rice-and-flour', 'oil-and-ghee', 'disposable-bags', 'sauces-olives-and-pickles',
    'baking-and-desserts', 'dry-fruit-and-nuts', 'frozen-and-chilled', 'beverages',
    'household', 'home-care', 'fabric-care',
  ],
  FRUITS_VEGETABLES: ['fruits-vegetables', 'dry-fruit-and-nuts'],
  BAKERY: ['bakery', 'milk-eggs-bread', 'breakfast-essentials', 'baking-and-desserts'],
  PHARMACY: ['pharmacy', 'personal-care', 'baby-care', 'skin-care', 'bath-body-hair'],
};
const PER_CATEGORY = 40; // cap products stocked per category per shop

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const priceFor = (id: string) => Math.round((50 + (hash(id) % 700)) / 5) * 5 * 100; // paisa, Rs 50–750
const stockFor = (id: string) => 20 + (hash(id + 's') % 60);

async function main() {
  const merchants = await prisma.merchant.findMany({
    where: { approvalStatus: 'APPROVED' },
    select: { id: true, shopName: true, shopType: true },
  });

  let totalCreated = 0;
  for (const m of merchants) {
    const slugs = SHOP_CATEGORIES[m.shopType];
    if (!slugs) continue;

    let shopCreated = 0;
    for (const slug of slugs) {
      const category = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
      if (!category) continue;

      const products = await prisma.product.findMany({
        where: { categoryId: category.id, approvalStatus: 'APPROVED', imageUrl: { not: null } },
        select: { id: true },
        orderBy: { name: 'asc' },
        take: PER_CATEGORY,
      });
      if (products.length === 0) continue;

      const res = await prisma.merchantProduct.createMany({
        data: products.map((p) => ({
          merchantId: m.id,
          productId: p.id,
          pricePaisa: priceFor(p.id),
          stockQuantity: stockFor(p.id),
          lowStockThreshold: 5,
          isAvailable: true,
        })),
        skipDuplicates: true,
      });
      shopCreated += res.count;
    }
    totalCreated += shopCreated;
    console.log(`${m.shopName} (${m.shopType}): +${shopCreated} products`);
  }
  // Remove image-less placeholder products (the original bespoke seed items) from
  // every shelf, so the dynamic storefront shows only image-rich catalog products.
  const removed = await prisma.merchantProduct.deleteMany({ where: { product: { imageUrl: null } } });
  console.log(`Removed ${removed.count} image-less products from shelves.`);

  console.log(`\nDone. ${totalCreated} merchant products created.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
