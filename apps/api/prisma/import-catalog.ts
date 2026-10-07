/**
 * Imports the workspace grocerapp-scraper/output/catalog.json export into
 * the global Product table as APPROVED products that any merchant can list.
 *
 * Images are copied from the scraper export to storage/catalog and served at
 * the local API's /static/catalog/<file> path. Re-running updates by slug.
 *
 *   cd sirfbazar-api && npm run import:catalog -- --dry-run
 *   cd sirfbazar-api && npm run import:catalog
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { CATEGORY_BY_ANY_SLUG } from './category-map';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const workspaceExport = path.resolve(__dirname, '../../grocerapp-scraper/output/catalog.json');
const monorepoExport = path.resolve(__dirname, '../../../tools/grocerapp-scraper/output/catalog.json');
const CATALOG_JSON = process.env.CATALOG_JSON || (fs.existsSync(workspaceExport) ? workspaceExport : monorepoExport);
const IMAGE_SRC_DIR = path.join(path.dirname(CATALOG_JSON), 'images');
const IMAGE_DEST_DIR = path.resolve(process.cwd(), 'storage/catalog');

interface ScrapedProduct {
  sourceId: number;
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

function localDatabaseUrl(): URL {
  // Prisma reads .env; read the same key solely to enforce a local-only guard.
  const line = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8')
    .split(/\r?\n/).find((value) => value.startsWith('DATABASE_URL='));
  const raw = process.env.DATABASE_URL || line?.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  if (!raw) throw new Error('DATABASE_URL is missing.');
  const url = new URL(raw);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.port !== '5433') {
    throw new Error('Catalog import is restricted to the local test database on port 5433.');
  }
  return url;
}

function imageIsValid(file: string): boolean {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 100) return false;
  const hex = bytes.subarray(0, 12).toString('hex');
  return hex.startsWith('ffd8') || hex.startsWith('89504e47') || hex.startsWith('47494638') || hex.startsWith('52494646');
}

function cleanDescription(value?: string | null): string | null {
  if (!value || /&Atilde;|&#\d+;|<[^>]+>/.test(value)) return null;
  const cleaned = value.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').trim();
  return cleaned || null;
}

async function main() {
  const database = localDatabaseUrl();
  const publicBase = (process.env.PUBLIC_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
  const publicUrl = new URL(publicBase);
  if (!['localhost', '127.0.0.1', '::1'].includes(publicUrl.hostname)) {
    throw new Error('Catalog image URLs must point to the local API for this import.');
  }
  if (!fs.existsSync(CATALOG_JSON)) {
    throw new Error(`No catalog file at ${CATALOG_JSON}.`);
  }
  const products: ScrapedProduct[] = JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8'));
  console.log(`${DRY_RUN ? 'Checking' : 'Importing'} ${products.length} products into ${database.hostname}:${database.port}${database.pathname}`);

  const sourceIds = new Set<number>();
  for (const product of products) {
    if (!Number.isInteger(product.sourceId) || !product.name?.trim() || sourceIds.has(product.sourceId)) {
      throw new Error(`Invalid or repeated source product ID: ${product.sourceId}`);
    }
    sourceIds.add(product.sourceId);
  }

  if (DRY_RUN) {
    const existing = await prisma.product.count();
    const validImages = products.filter((product) => product.imageFile &&
      fs.existsSync(path.join(IMAGE_SRC_DIR, path.basename(product.imageFile))) &&
      imageIsValid(path.join(IMAGE_SRC_DIR, path.basename(product.imageFile)))).length;
    console.log(`Dry run: existing=${existing} source=${products.length} validImages=${validImages} missingImages=${products.length - validImages}`);
    return;
  }

  fs.mkdirSync(IMAGE_DEST_DIR, { recursive: true });

  // Resolve/create categories once, normalizing through the canonical map so
  // scraped categories merge into the right icon-bearing SirfBazar category.
  const categoryCache = new Map<string, string>();
  const ensureCategory = async (name: string, slug: string): Promise<string> => {
    const scrapedSlug = slug || slugify(name);
    const canonical = CATEGORY_BY_ANY_SLUG.get(scrapedSlug);
    const target = canonical
      ? { slug: canonical.slug, name: canonical.name, icon: canonical.icon, sortOrder: canonical.sortOrder }
      : { slug: scrapedSlug, name, icon: null as string | null, sortOrder: 100 };

    if (categoryCache.has(target.slug)) return categoryCache.get(target.slug)!;
    const cat = await prisma.category.upsert({
      where: { slug: target.slug },
      update: { ...(target.icon ? { iconUrl: target.icon, name: target.name, sortOrder: target.sortOrder } : {}) },
      create: {
        name: target.name,
        slug: target.slug,
        iconUrl: target.icon,
        isActive: true,
        sortOrder: target.sortOrder,
      },
    });
    categoryCache.set(target.slug, cat.id);
    return cat.id;
  };

  let created = 0;
  let updated = 0;
  let images = 0;
  const failed: string[] = [];

  for (const p of products) {
    try {
      const categoryId = await ensureCategory(p.categoryName, p.categorySlug);
      const slug = `${slugify(p.name) || 'product'}-${p.sourceId}`;

      // Copy the downloaded image into the API's served storage dir.
      let imageUrl: string | null = null;
      if (p.imageFile && path.basename(p.imageFile) === p.imageFile) {
        const src = path.join(IMAGE_SRC_DIR, p.imageFile);
        if (fs.existsSync(src) && imageIsValid(src)) {
          const dest = path.join(IMAGE_DEST_DIR, p.imageFile);
          if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
          imageUrl = `${publicBase}/static/catalog/${encodeURIComponent(p.imageFile)}`;
          images++;
        }
      }

      const existing = await prisma.product.findUnique({ where: { slug } });
      const data = {
        name: p.name,
        brand: p.brand ?? null,
        description: cleanDescription(p.description),
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
