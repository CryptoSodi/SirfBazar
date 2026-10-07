/**
 * Capture Grocerie.pk's publicly displayed catalog for local SirfBazar demos.
 * Reads only the public Firestore collections used by the storefront. No login,
 * checkout, private customer data, or image downloading.
 *
 * Run from the repository root: node tools/grocerie-scraper/scrape.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ORIGIN = 'https://www.grocerie.pk';
const DATABASE = 'https://firestore.googleapis.com/v1/projects/grocerie-admin/databases/(default)/documents';
const OUTPUT = resolve(import.meta.dirname, 'output/catalog.json');
const PAGE_SIZE = 250;
const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

function field(value) {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  return null;
}

async function collection(name) {
  const documents = [];
  let nextPageToken;
  for (let page = 0; page < 10; page += 1) {
    const url = new URL(`${DATABASE}/${name}`);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const body = await response.json();
    documents.push(...(body.documents ?? []));
    nextPageToken = body.nextPageToken;
    if (!nextPageToken) return documents;
    await sleep(250);
  }
  throw new Error(`${name}: pagination exceeded 10 pages`);
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sizeFromName(name) {
  const matches = [...name.matchAll(/\b\d+(?:\.\d+)?\s*(?:kg|g|gm|grams?|ml|l|ltr|litre|pcs?|pieces?|pack)\b/gi)];
  return matches.length ? matches.at(-1)[0].replace(/\s+/g, ' ') : null;
}

const [rawCategories, rawProducts] = await Promise.all([collection('categories'), collection('products')]);
const categories = rawCategories
  .map((document) => ({
    sourceId: document.name.split('/').at(-1),
    name: field(document.fields?.title),
    slug: field(document.fields?.slug),
    active: field(document.fields?.active) !== false,
  }))
  .filter((category) => category.active && category.name && category.slug)
  .sort((a, b) => a.name.localeCompare(b.name));
const categorySlugs = new Set(categories.map((category) => category.slug));
const products = rawProducts
  .map((document) => {
    const fields = document.fields ?? {};
    const name = String(field(fields.title) ?? '').trim();
    const price = numeric(field(fields.price));
    const originalPrice = numeric(field(fields.originalPrice));
    return {
      sourceId: document.name.split('/').at(-1),
      name,
      slug: String(field(fields.slug) ?? '').trim(),
      categoryName: String(field(fields.category) ?? '').trim(),
      categorySlug: String(field(fields.categorySlug) ?? '').trim(),
      brand: field(fields.brand) || null,
      size: sizeFromName(name),
      pricePaisa: price == null ? null : Math.round(price * 100),
      originalPricePaisa: originalPrice == null ? null : Math.round(originalPrice * 100),
      imageUrl: field(fields.image) || null,
      sourceUrl: `${ORIGIN}/products/${encodeURIComponent(String(field(fields.slug) ?? '').trim())}`,
      active: field(fields.active) !== false,
    };
  })
  .filter((product) => product.active && product.name && product.slug && product.pricePaisa > 0 && categorySlugs.has(product.categorySlug))
  .sort((a, b) => a.name.localeCompare(b.name));

if (categories.length < 10 || products.length < 100) {
  throw new Error(`Unexpectedly small public catalog: ${categories.length} categories, ${products.length} products`);
}

const snapshot = {
  source: ORIGIN,
  capturedAt: new Date().toISOString(),
  note: 'Public product facts for local demo only. Prices, images, and stock are not live SirfBazar merchant offers.',
  categories,
  products,
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Captured ${categories.length} categories and ${products.length} products to ${OUTPUT}`);
console.log('Categories:', categories.map((category) => category.name).join(', '));
