export type SalePayload = {
  requestId: string;
  items: { merchantProductId: string; quantity: number; expectedUnitPricePaisa: number }[];
  amountTenderedPaisa?: number;
};
export type SaleRecovery = {
  version: 1;
  owner: string;
  merchantId: string;
  payload: SalePayload;
};
const KEY = 'sbp.saleRecovery.v1';

export function readSaleRecovery(owner: string): SaleRecovery | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as SaleRecovery;
  if (value.version !== 1 || !value.owner || !value.merchantId || !value.payload?.requestId || !value.payload.items?.length)
    throw new Error('Saved sale is damaged. Check sales history or contact support before charging again.');
  return value.owner === owner ? value : null;
}

export function saveSaleRecovery(record: SaleRecovery) {
  const raw = localStorage.getItem(KEY);
  const value = JSON.stringify(record);
  if (raw && raw !== value) throw new Error('Another sale still needs a status check on this device. Resolve it before charging again.');
  localStorage.setItem(KEY, value);
  if (localStorage.getItem(KEY) !== value) throw new Error('Sale could not be saved on this device. Enable storage or free space before charging.');
}

export function clearSaleRecovery(record: SaleRecovery) {
  if (localStorage.getItem(KEY) === JSON.stringify(record)) localStorage.removeItem(KEY);
}

/** Only a definitive POST rejection releases the saved request for a new bill review. */
export function isDefinitiveSaleRejection(status: unknown): boolean {
  return typeof status === 'number' && status >= 400 && status < 500 &&
    status !== 401 && status !== 408 && status !== 409;
}

export function receiptMatches(record: SaleRecovery, sale: any): boolean {
  const expected = [...record.payload.items].sort((a, b) => a.merchantProductId.localeCompare(b.merchantProductId));
  const actual = [...(sale?.items ?? [])].sort((a, b) => String(a.merchantProductId).localeCompare(String(b.merchantProductId)));
  const total = expected.reduce((sum, item) => sum + item.expectedUnitPricePaisa * item.quantity, 0);
  return sale?.id === record.payload.requestId && sale?.merchantId === record.merchantId && sale?.cashierId === record.owner &&
    Number.isSafeInteger(total) && sale?.totalAmountPaisa === total &&
    sale?.amountTenderedPaisa === (record.payload.amountTenderedPaisa ?? total) &&
    actual.length === expected.length && actual.every((item, index) =>
      item.merchantProductId === expected[index].merchantProductId && item.quantity === expected[index].quantity &&
      item.unitPricePaisa === expected[index].expectedUnitPricePaisa);
}
