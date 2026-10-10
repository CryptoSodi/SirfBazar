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

export function guessCsvField(heading: string): CsvField | undefined {
  const normalized = heading.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<CsvField, string[]> = {
    productId: ['productid', 'catalogproductid', 'catalogueproductid'],
    name: ['name', 'productname', 'itemname', 'title'],
    categoryId: ['categoryid', 'catalogcategoryid'],
    unit: ['unit', 'measurementunit'],
    merchantSku: ['sku', 'merchantsku', 'barcode', 'skuorbarcode'],
    priceRupees: ['price', 'saleprice', 'sellingprice', 'retailprice', 'pricers', 'salepricers'],
    stockQuantity: ['stock', 'quantity', 'stockquantity', 'unitsinstock'],
  };
  return CSV_FIELDS.find(({ key }) => aliases[key].includes(normalized))?.key;
}

export function parseWorkbookRows(rows: unknown): string[][] {
  if (!Array.isArray(rows)) throw Error('The first worksheet could not be read.');
  const converted = rows.map((row) => Array.isArray(row) ? row.map((value) => value == null ? '' : String(value)) : []);
  const width = Math.max(0, ...converted.map((row) => row.length));
  const nonEmpty = converted.filter((row) => row.some((value) => value !== '')).map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
  if (nonEmpty.length < 2) throw Error('Include a header and at least one product row.');
  if (nonEmpty.length > MAX_CSV_ROWS + 1) throw Error('The worksheet has over 1,000 product rows. Split it into smaller files.');
  if (width > 100) throw Error('The worksheet has over 100 columns. Keep only the columns needed for product import.');
  if (nonEmpty.some((row) => row.some((cell) => cell.length > MAX_CELL))) throw Error('A worksheet cell is too long.');
  return nonEmpty;
}

export function parseXlsxBytes(bytes: ArrayBuffer, xlsx: {
  read: (data: ArrayBuffer, options: Record<string, unknown>) => { SheetNames: string[]; Sheets: Record<string, Record<string, unknown>> };
  utils: {
    decode_range: (range: string) => { s: { r: number; c: number }; e: { r: number; c: number } };
    encode_cell: (address: { r: number; c: number }) => string;
    sheet_to_json: (sheet: Record<string, unknown>, options: Record<string, unknown>) => unknown;
  };
}): string[][] {
  if (bytes.byteLength > MAX_CSV_BYTES) throw Error('File is over 2 MiB. Split it into smaller files.');
  const workbook = xlsx.read(bytes, { type: 'array', cellFormula: true, sheetRows: MAX_CSV_ROWS + 2 });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw Error('The workbook has no worksheets.');
  const sheet = workbook.Sheets[firstSheet];
  const ref = typeof sheet?.['!ref'] === 'string' ? sheet['!ref'] : '';
  if (!ref) throw Error('The first worksheet is empty.');
  const range = xlsx.utils.decode_range(ref);
  if (range.e.r - range.s.r > MAX_CSV_ROWS) throw Error('The worksheet has over 1,000 product rows. Split it into smaller files.');
  if (range.e.c - range.s.c >= 100) throw Error('The worksheet has over 100 columns. Keep only the columns needed for product import.');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let column = range.s.c; column <= range.e.c; column++) {
      if ((sheet[xlsx.utils.encode_cell({ r: row, c: column })] as { f?: unknown } | undefined)?.f) throw Error('Formula cells are not supported. Replace formulas with their final values before importing.');
    }
  }
  return parseWorkbookRows(xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: false }));
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
