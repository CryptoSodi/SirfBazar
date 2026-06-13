/**
 * SirfBazar catalog scraper for grocerapp.pk.
 *
 * Loads grocerapp in a real Chromium browser, then calls its public catalog API
 * from inside the page origin (so requests carry the same context the site uses).
 * Walks every top-level category, pages through all products, normalizes them,
 * downloads product images, and writes:
 *   output/catalog.json   — normalized products for `npm run import:catalog`
 *   output/images/        — downloaded product images (self-hosted by the API)
 *
 * Polite by design: one request at a time with a small delay; image downloads
 * are best-effort and skip on failure. We capture product facts (name, size,
 * category, barcode, image) and deliberately ignore grocerapp's prices — each
 * SirfBazar merchant sets their own price and stock.
 *
 * Env:
 *   MAX_PAGES_PER_CATEGORY  cap pages per category (default: all)
 *   SKIP_IMAGES=1           skip image downloads (faster dry run)
 *   DELAY_MS                delay between API calls (default 400)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'output');
const IMG_DIR = path.join(OUT, 'images');
const VENDOR_ID = 20; // grocerapp default vendor (Lahore)
const DELAY_MS = Number(process.env.DELAY_MS || 400);
const MAX_PAGES = Number(process.env.MAX_PAGES_PER_CATEGORY || 0); // 0 = all
const SKIP_IMAGES = process.env.SKIP_IMAGES === '1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Derive a coarse base unit + keep the original size string. */
function parseUnit(unitStr) {
  const u = String(unitStr || '').toLowerCase();
  if (/\b(kg|gram|gm|g)\b/.test(u)) return 'kg';
  if (/\b(ml|ltr|liter|litre|l)\b/.test(u)) return 'litre';
  if (/\b(dozen|dz)\b/.test(u)) return 'dozen';
  if (/\b(pack|pcs|pc|unit|pieces?)\b/.test(u)) return 'pack';
  return 'piece';
}

async function main() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  });
  await page.goto('https://grocerapp.pk/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Helper: call the grocerapp API from inside the page origin.
  const apiGet = (url) =>
    page.evaluate(async (u) => {
      const r = await fetch(u, { headers: { Accept: 'application/json' } });
      return r.json();
    }, url);

  // 1. Categories tree → top-level parent categories.
  const catRes = await apiGet(
    `https://endpoints.grocerapps.com/v2/categories/list?vendor_id=${VENDOR_ID}`,
  );
  const tree = catRes?.data?.tree || [];
  const parents = tree.filter((c) => c.parent_id === 0 || c.parent_id == null);
  console.log(`Found ${parents.length} top-level categories.`);

  const productsById = new Map();

  // 2. Page through products for each top-level category.
  for (const cat of parents) {
    const categoryName = cat.name;
    const categorySlug = slugify(cat.slug_url || cat.name);
    let pageNo = 1;
    let lastPage = 1;
    do {
      const url = `https://endpoints.grocerapps.com/v3/products/listByParent?per=30&page=${pageNo}&vendor_id=${VENDOR_ID}&category_id=${cat.id}`;
      let res;
      try {
        res = await apiGet(url);
      } catch (e) {
        console.log(`  ! ${categoryName} p${pageNo} failed: ${e.message}`);
        break;
      }
      const block = res?.data;
      const list = block?.data || [];
      lastPage = block?.last_page || 1;
      for (const p of list) {
        if (!p?.name || productsById.has(p.id)) continue;
        const img = p.full_image || p.image || null;
        productsById.set(p.id, {
          sourceId: p.id,
          name: String(p.name).trim(),
          slug: slugify(p.seo_url || p.name) + '-' + p.id, // id suffix guarantees uniqueness
          brand: null,
          description: p.desc ? String(p.desc).replace(/<[^>]+>/g, '').trim() || null : null,
          categoryName,
          categorySlug,
          unit: parseUnit(p.unit),
          size: p.unit || null,
          barcode: p.barcode || null,
          imageUrl: img,
          imageFile: null,
        });
      }
      console.log(`  ${categoryName}: page ${pageNo}/${lastPage} (+${list.length}, total ${productsById.size})`);
      pageNo++;
      if (MAX_PAGES && pageNo > MAX_PAGES) break;
      await sleep(DELAY_MS);
    } while (pageNo <= lastPage);
  }

  const products = [...productsById.values()];
  console.log(`\nCollected ${products.length} unique products.`);

  // 3. Download images (best-effort).
  if (!SKIP_IMAGES) {
    let ok = 0;
    for (const p of products) {
      if (!p.imageUrl) continue;
      const ext = (p.imageUrl.split('.').pop() || 'jpg').split(/[?#]/)[0].slice(0, 5);
      const file = `${p.slug}.${ext}`;
      const dest = path.join(IMG_DIR, file);
      if (fs.existsSync(dest)) {
        p.imageFile = file;
        ok++;
        continue;
      }
      try {
        const resp = await fetch(p.imageUrl);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          fs.writeFileSync(dest, buf);
          p.imageFile = file;
          ok++;
        }
      } catch {
        /* skip image */
      }
      if (ok % 50 === 0 && ok) console.log(`  images: ${ok}/${products.length}`);
      await sleep(80);
    }
    console.log(`Downloaded ${ok} images.`);
  }

  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(products, null, 2));
  console.log(`Wrote output/catalog.json (${products.length} products).`);
  await browser.close();
}

main().catch((e) => {
  console.error('SCRAPE FAILED:', e);
  process.exit(1);
});
