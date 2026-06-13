/**
 * Imports a scraped catalog (tools/grocerapp-scraper/output/catalog.json) into
 * the global Product table as APPROVED products that any merchant can list.
 *
 * Images are expected to already be downloaded by the scraper into
 * apps/api/storage/catalog/ — this script only records their public URL
 * (PUBLIC_BASE_URL/static/catalog/<file>). It is idempotent (upsert by slug).
 *
 *   1. cd tools/grocerapp-scraper && npm run scrape   (produces catalog.json + images)
 *   2. cd apps/api && npm run import:catalog
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://api.sirfbazar.com';
const CATALOG_JSON = path.resolve(
  __dirname,
  '../../../tools/grocerapp-scraper/output/catalog.json',
);
const IMAGE_SRC_DIR = path.resolve(__dirname, '../../../tools/grocerapp-scraper/output/images');
const IMAGE_DEST_DIR = path.resolve(process.cwd(), 'storage/catalog');

interface ScrapedProduct {
  name: string;
  slug: string;
  brand?: string | null;
  description?: string | null;
  categoryName: string;
  categorySlug: string;
  unit?: string | null;
  size?: string | null;
  barcode?: string | null;
  imageFile?: string | null; // filename inside output/images
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  if (!fs.existsSync(CATALOG_JSON)) {
    console.error(`No catalog file at ${CATALOG_JSON} — run the scraper first.`);
    process.exit(1);
  }
  const products: ScrapedProduct[] = JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8'));
  console.log(`Importing ${products.length} products…`);

  fs.mkdirSync(IMAGE_DEST_DIR, { recursive: true });

  // Resolve/create categories once.
  const categoryCache = new Map<string, string>();
  const ensureCategory = async (name: string, slug: string): Promise<string> => {
    const key = slug || slugify(name);
    if (categoryCache.has(key)) return categoryCache.get(key)!;
    const cat = await prisma.category.upsert({
      where: { slug: key },
      update: {},
      create: { name, slug: key, isActive: true, sortOrder: 100 },
    });
    categoryCache.set(key, cat.id);
    return cat.id;
  };

  let created = 0;
  let updated = 0;
  let images = 0;
  const failed: string[] = [];

  for (const p of products) {
    try {
      const categoryId = await ensureCategory(p.categoryName, p.categorySlug);
      const slug = p.slug || slugify(p.name);

      // Copy the downloaded image into the API's served storage dir.
      let imageUrl: string | null = null;
      if (p.imageFile) {
        const src = path.join(IMAGE_SRC_DIR, p.imageFile);
        if (fs.existsSync(src)) {
          const dest = path.join(IMAGE_DEST_DIR, p.imageFile);
          if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
          imageUrl = `${PUBLIC_BASE_URL}/static/catalog/${p.imageFile}`;
          images++;
        }
      }

      const existing = await prisma.product.findUnique({ where: { slug } });
      const data = {
        name: p.name,
        brand: p.brand ?? null,
        description: p.description ?? null,
        categoryId,
        unit: p.unit || 'piece',
        size: p.size ?? null,
        barcode: p.barcode ?? null,
        approvalStatus: 'APPROVED',
        ...(imageUrl ? { imageUrl } : {}),
      };

      if (existing) {
        await prisma.product.update({ where: { slug }, data });
        updated++;
      } else {
        await prisma.product.create({ data: { slug, ...data } });
        created++;
      }
    } catch (e: any) {
      failed.push(`${p.name}: ${e.message}`);
    }
  }

  console.log(`Done. created=${created} updated=${updated} images=${images} failed=${failed.length}`);
  if (failed.length) console.log('Failures:\n  ' + failed.slice(0, 20).join('\n  '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
