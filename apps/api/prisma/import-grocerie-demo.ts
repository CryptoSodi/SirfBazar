/** Import a public Grocerie.pk catalog snapshot into the LOCAL demo database only. */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type CategoryRow = { sourceId: string; name: string; slug: string; active: boolean };
type ProductRow = {
  sourceId: string;
  name: string;
  slug: string;
  categorySlug: string;
  brand: string | null;
  size: string | null;
  pricePaisa: number;
  originalPricePaisa: number | null;
  imageUrl: string | null;
  sourceUrl: string;
  active: boolean;
};
type Catalog = {
  source: string;
  capturedAt: string;
  categories: CategoryRow[];
  products: ProductRow[];
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const db = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(db.hostname) || db.port !== '5433' || db.pathname !== '/sirfbazar') {
  throw new Error('Refusing to import into a non-demo database. Expected localhost:5433/sirfbazar.');
}

const catalogPath = path.resolve(__dirname, '../../../tools/grocerie-scraper/output/catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as Catalog;
if (catalog.source !== 'https://www.grocerie.pk' || catalog.categories.length < 10 || catalog.products.length < 100) {
  throw new Error('Unexpected or incomplete Grocerie.pk catalog snapshot.');
}

const prisma = new PrismaClient();
const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const categorySlug = (row: CategoryRow) => `grocerie-demo-${slugify(row.slug)}`;
const productSlug = (row: ProductRow) => `grocerie-demo-${slugify(row.slug).slice(0, 90)}-${row.sourceId.toLowerCase()}`;

async function main() {
  const snapshotDate = catalog.capturedAt.slice(0, 10);
  const owner = await prisma.user.upsert({
    where: { phoneNumber: '+923000000999' },
    update: { fullName: 'Grocerie Catalog Demo', role: 'MERCHANT_OWNER' },
    create: {
      phoneNumber: '+923000000999',
      fullName: 'Grocerie Catalog Demo',
      role: 'MERCHANT_OWNER',
      isPhoneVerified: true,
    },
  });
  const merchant = await prisma.merchant.upsert({
    where: { userId: owner.id },
    update: { isOnline: true, isOpen: true, approvalStatus: 'APPROVED' },
    create: {
      userId: owner.id,
      shopName: 'Grocerie Catalog Demo — Sample Store',
      shopType: 'GROCERY',
      description: `Local test shop populated from public Grocerie.pk listings captured ${snapshotDate}. Prices and stock are illustrative; this is not a real merchant.`,
      phoneNumber: '+923000000999',
      address: 'Demo location, Gulberg, Lahore',
      city: 'Lahore',
      area: 'Gulberg',
      latitude: 31.5204,
      longitude: 74.3587,
      serviceRadiusKm: 10,
      openingTime: '00:00',
      closingTime: '23:59',
      isOnline: true,
      isOpen: true,
      approvalStatus: 'APPROVED',
      minimumOrderValuePaisa: 0,
    },
  });

  const categories = new Map<string, string>();
  for (const [index, row] of catalog.categories.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: categorySlug(row) },
      update: { name: row.name, isActive: row.active, sortOrder: 100 + index },
      create: { name: row.name, slug: categorySlug(row), isActive: row.active, sortOrder: 100 + index },
    });
    categories.set(row.slug, category.id);
  }

  let imported = 0;
  for (const row of catalog.products) {
    const categoryId = categories.get(row.categorySlug);
    if (!row.active || !categoryId || !Number.isInteger(row.pricePaisa) || row.pricePaisa <= 0) continue;
    const product = await prisma.product.upsert({
      where: { slug: productSlug(row) },
      update: {
        name: row.name,
        brand: row.brand,
        categoryId,
        imageUrl: row.imageUrl,
        size: row.size,
        approvalStatus: 'APPROVED',
      },
      create: {
        name: row.name,
        slug: productSlug(row),
        brand: row.brand,
        description: `Demo listing from ${row.sourceUrl}. Public listing captured ${snapshotDate}; verify price and availability before any real use.`,
        categoryId,
        imageUrl: row.imageUrl,
        unit: 'piece',
        size: row.size,
        approvalStatus: 'APPROVED',
      },
    });
    const hasDiscount = row.originalPricePaisa && row.originalPricePaisa > row.pricePaisa;
    await prisma.merchantProduct.upsert({
      where: { merchantId_productId: { merchantId: merchant.id, productId: product.id } },
      update: {
        pricePaisa: hasDiscount ? row.originalPricePaisa! : row.pricePaisa,
        discountPricePaisa: hasDiscount ? row.pricePaisa : null,
        stockQuantity: 20,
        isAvailable: true,
      },
      create: {
        merchantId: merchant.id,
        productId: product.id,
        pricePaisa: hasDiscount ? row.originalPricePaisa! : row.pricePaisa,
        discountPricePaisa: hasDiscount ? row.pricePaisa : null,
        stockQuantity: 20,
        isAvailable: true,
        merchantSku: `grocerie-demo:${row.sourceId}`,
      },
    });
    imported++;
  }
  console.log(`Imported ${categories.size} categories and ${imported} products into local demo merchant ${merchant.id}.`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
