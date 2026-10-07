export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 1000;
const MAX_CELL = 4096;

export type BulkItem = { rowId: string; productId?: string; name?: string; categoryId?: string; unit?: string; merchantSku?: string; pricePaisa: number; stockQuantity: number; expected?: unknown };
export type BulkMode = 'ADD_MISSING' | 'UPDATE_EXISTING';
export type PreviewRow = { rowId: string; status: 'NEW' | 'MATCH' | 'SKIP' | 'CONFLICT'; old?: Record<string, unknown>; new?: Record<string, unknown>; error?: string };
export type PreviewResult = { rows: PreviewRow[]; previewToken: string; expiresAt: string };
export type UploadRow = { rowId: string; status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED'; merchantProductId?: string; error?: string };
export type UploadResult = { created: number; updated: number; failed: { index: number; error: string }[]; skipped: number; rows: UploadRow[] };

export function parseCsv(text: string): string[][] {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw Error('CSV is over 2 MiB. Split it into smaller files.');
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; closed = false; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell); if (row.some((value) => value !== '')) rows.push(row);
      row = []; cell = ''; closed = false;
      if (rows.length > MAX_CSV_ROWS + 1) throw Error('CSV has over 1,000 rows. Split it into smaller files.');
    } else if (closed || char === '"') throw Error(`Malformed CSV near row ${rows.length + 1}. Check quoted cells.`);
    else cell += char;
    if (cell.length > MAX_CELL) throw Error(`A cell in row ${rows.length + 1} is too long.`);
  }
  if (quoted) throw Error('CSV has an unclosed quoted cell. Correct the file and try again.');
  if (cell || row.length) { row.push(cell); if (row.some((value) => value !== '')) rows.push(row); }
  if (rows.length < 2) throw Error('Include a header and at least one product row.');
  if (rows.length > MAX_CSV_ROWS + 1) throw Error('CSV has over 1,000 rows. Split it into smaller files.');
  const width = rows[0].length;
  if (rows.some((entry) => entry.length !== width)) throw Error('CSV rows have different column counts. Correct the file and try again.');
  return rows;
}

export function parseRupees(value: string): number {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw Error('Enter sale price in rupees with up to two decimal places.');
  const paisa = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (paisa < 1n || paisa > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Sale price is outside the supported range.');
  return Number(paisa);
}

export function parseStock(value: string): number {
  if (!/^\d+$/.test(value.trim())) throw Error('Enter a whole stock quantity in units; missing stock cannot be assumed zero.');
  const quantity = Number(value.trim());
  if (!Number.isSafeInteger(quantity) || quantity > 100000000) throw Error('Stock quantity is outside the supported range.');
  return quantity;
}

export type CsvField = 'productId' | 'name' | 'categoryId' | 'unit' | 'merchantSku' | 'priceRupees' | 'stockQuantity';
export type CsvMapping = Partial<Record<CsvField, number>>;
export const CSV_FIELDS: { key: CsvField; label: string }[] = [
  { key: 'productId', label: 'Catalogue product ID' }, { key: 'name', label: 'Product name' },
  { key: 'categoryId', label: 'Category ID' }, { key: 'unit', label: 'Unit' },
  { key: 'merchantSku', label: 'Merchant SKU or barcode' }, { key: 'priceRupees', label: 'Sale price (Rs)' },
  { key: 'stockQuantity', label: 'Stock quantity (units)' },
];

export function mapCsv(rows: string[][], mapping: CsvMapping): BulkItem[] {
  if (mapping.priceRupees === undefined || mapping.stockQuantity === undefined) throw Error('Map sale price and stock quantity columns. Cost and stock value are different fields.');
  if (mapping.productId === undefined && mapping.name === undefined && mapping.merchantSku === undefined) throw Error('Map a catalogue ID, product name, or SKU/barcode.');
  const used = Object.values(mapping).filter((value) => value !== undefined);
  if (new Set(used).size !== used.length) throw Error('Map each CSV column to one field only.');
  const seen = new Set<string>();
  return rows.slice(1).map((row, index) => {
    const get = (field: CsvField) => mapping[field] === undefined ? '' : row[mapping[field]!] ?? '';
    const productId = get('productId').trim(), name = get('name').trim(), merchantSku = get('merchantSku').trim();
    if (!productId && !name && !merchantSku) throw Error(`Row ${index + 2}: add a product identity.`);
    const identities = [productId && `id:${productId}`, merchantSku && `sku:${merchantSku.toLowerCase()}`, !productId && !merchantSku && name && `name:${name.toLowerCase()}`].filter(Boolean) as string[];
    for (const identity of identities) {
      if (seen.has(identity)) throw Error(`Row ${index + 2}: duplicate product identity ${identity}.`);
      seen.add(identity);
    }
    try {
      return { rowId: String(index + 2), ...(productId ? { productId } : {}), ...(name ? { name } : {}),
        ...(get('categoryId').trim() ? { categoryId: get('categoryId').trim() } : {}),
        ...(get('unit').trim() ? { unit: get('unit').trim() } : {}),
        ...(merchantSku ? { merchantSku } : {}),
        pricePaisa: parseRupees(get('priceRupees')), stockQuantity: parseStock(get('stockQuantity')) };
    } catch (cause) { throw Error(`Row ${index + 2}: ${(cause as Error).message}`); }
  });
}
