// Counter domain and storage contracts. No UI, network or hardware side effects.
export type PosProduct = {
  merchantProductId: string; productId: string; name: string; unit: string;
  barcode: string | null; merchantSku?: string | null; pricePaisa: number;
  stockQuantity: number; isAvailable: boolean;
};
export type PosLine = { product: PosProduct; quantity: number };
export type Ticket = { id: string; createdAt: string; lines: PosLine[] };
export type SalePayload = {
  requestId: string; counterName: string; amountTenderedPaisa: number;
  items: { merchantProductId: string; quantity: number; expectedUnitPricePaisa: number }[];
};
export type PosSale = {
  id: string; orderNumber: string; createdAt: string; totalAmountPaisa: number;
  amountTenderedPaisa?: number | null; changePaisa?: number | null; counterName?: string | null;
  items: { productNameSnapshot: string; quantity: number; unitPricePaisa: number; totalPricePaisa: number; unitSnapshot?: string | null }[];
  merchant?: { shopName: string; address?: string; phoneNumber?: string };
};
export type PosSettings = {
  counterName: string; showStock: boolean; mergeScans: boolean; shortcuts: boolean;
  scannerSuffix: 'Enter' | 'Tab'; paperWidth: '80' | '58'; receiptFooter: string; showCodes: boolean;
  appearance: 'modern' | 'classic'; shortcutProfile: ShortcutProfile; bindings: ShortcutBindings;
};
export type CounterState = {
  version: 1; draft: Ticket; held: Ticket[]; pending: SalePayload | null;
  lastReceipt: PosSale | null; settings: PosSettings;
};
export const commandDefinitions = [
  { id: 'help', action: 'Show commands', detail: 'View the active key map and supported operations.' },
  { id: 'search', action: 'Description search', detail: 'Focus product name search.' },
  { id: 'scan', action: 'Item code search', detail: 'Focus the barcode / SKU field.' },
  { id: 'void', action: 'Toggle void mode', detail: 'Scan or select a bill item, then confirm removing one unpaid unit. Not a refund.' },
  { id: 'quantity', action: 'Change quantity', detail: 'Set the whole-unit quantity of a selected bill line.' },
  { id: 'multi', action: 'Multi-quantity sale', detail: 'Set quantity for the next successful product addition.' },
  { id: 'hold', action: 'Hold bill', detail: 'Save this unpaid bill in this browser.' },
  { id: 'recall', action: 'Retrieve held bill', detail: 'Open held bills; no stock is reserved.' },
  { id: 'sales', action: 'Sales list', detail: 'View completed sales and open a saved receipt.' },
  { id: 'reprint', action: 'Duplicate receipt', detail: 'Open the last saved receipt for browser printing. Never creates a sale.' },
  { id: 'settings', action: 'POS settings', detail: 'Configure this browser’s counter preferences.' },
  { id: 'payment', action: 'Take payment', detail: 'Open cash payment; never completes a sale without confirmation.' },
  { id: 'reset', action: 'Reset bill', detail: 'Confirm discarding the unpaid bill; held and completed bills stay intact.' },
  { id: 'exit', action: 'Exit counter', detail: 'Confirm returning to the dashboard, keeping the unpaid draft.' },
] as const;
export type CommandId = typeof commandDefinitions[number]['id'];
export type ShortcutProfile = 'sirfbazar' | 'video' | 'website' | 'website-code-first' | 'custom';
export type ShortcutBindings = Record<CommandId, string>;
export const shortcutProfiles = [
  { id: 'sirfbazar', label: 'SirfBazar', detail: 'Existing browser-friendly keys. F5, F11 and F12 are not assigned.' },
  { id: 'video', label: 'iPOS video reference · partial', detail: 'F5 Void, F11 Reset and F12 Exit from video analysis. Other commands are unassigned until verified.' },
  { id: 'website', label: 'iPOS legacy · description-first · partial', detail: 'Brochure left register: F2 Description, F4 Item code, F5 Void, F7 Multi-quantity and F11 Change quantity. F6 Refund is not implemented.' },
  { id: 'website-code-first', label: 'iPOS legacy · code-first · partial', detail: 'Website and brochure right register: F2 Item code, F4 Description, F5 Void, F7 Multi-quantity and F11 Change quantity. F6 Refund is not implemented.' },
  { id: 'custom', label: 'Custom keys', detail: 'Your chosen bindings, not a verified vendor profile.' },
] as const;
export const bindingOptions = ['', ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((key) => `Alt+${key}`)];
export function profileBindings(profile: ShortcutProfile): ShortcutBindings {
  const result = Object.fromEntries(commandDefinitions.map(({ id }) => [id, ''])) as ShortcutBindings;
  if (profile === 'sirfbazar') Object.assign(result, { scan: 'F2', hold: 'F6', recall: 'F7', sales: 'F8', settings: 'F9', payment: 'F10' });
  if (profile === 'video') Object.assign(result, { void: 'F5', reset: 'F11', exit: 'F12' });
  if (profile === 'website') Object.assign(result, { search: 'F2', scan: 'F4', void: 'F5', multi: 'F7', quantity: 'F11' });
  if (profile === 'website-code-first') Object.assign(result, { scan: 'F2', search: 'F4', void: 'F5', multi: 'F7', quantity: 'F11' });
  return result;
}
export function validateBindings(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose a keyboard profile before saving.';
  const keys = commandDefinitions.map(({ id }) => (value as ShortcutBindings)[id]);
  if (keys.some((key) => !bindingOptions.includes(key))) return 'Choose a listed key or leave the command unassigned.';
  const assigned = keys.filter(Boolean);
  if (new Set(assigned).size !== assigned.length) return 'Each shortcut must belong to only one command. Change the duplicate keys.';
  return null;
}
export function activeCommands(settings: PosSettings) {
  return commandDefinitions.map((command) => ({ ...command, key: settings.bindings[command.id] }));
}
export const defaults: PosSettings = {
  counterName: 'Counter 1', showStock: true, mergeScans: true, shortcuts: true,
  scannerSuffix: 'Enter', paperWidth: '80', receiptFooter: 'Thank you for shopping with us.', showCodes: true,
  appearance: 'modern', shortcutProfile: 'sirfbazar', bindings: profileBindings('sirfbazar'),
};
export function ticket(): Ticket { return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), lines: [] }; }
export function initialCounter(): CounterState { return { version: 1, draft: ticket(), held: [], pending: null, lastReceipt: null, settings: { ...defaults } }; }
export function counterKey(merchantId: string, userId: string) { return `sb.ipos.v1:${encodeURIComponent(merchantId)}:${encodeURIComponent(userId)}`; }
export function total(lines: PosLine[]) { return lines.reduce((sum, line) => sum + line.quantity * line.product.pricePaisa, 0); }
export function money(paisa: number) { return `Rs ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
export function parseCash(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ''] = clean.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount <= 2147483647 ? amount : null;
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
export function readProduct(value: unknown): PosProduct {
  if (!object(value) || typeof value.merchantProductId !== 'string' || typeof value.productId !== 'string' ||
    typeof value.name !== 'string' || typeof value.unit !== 'string' || !integer(value.pricePaisa) ||
    !integer(value.stockQuantity) || typeof value.isAvailable !== 'boolean' ||
    !(value.barcode === null || typeof value.barcode === 'string')) throw Error('Unexpected product response. Reload the catalogue or contact support.');
  return value as PosProduct;
}
export function readProducts(value: unknown): PosProduct[] {
  if (!Array.isArray(value)) throw Error('Unexpected catalogue response. Reload the catalogue.');
  return value.map(readProduct);
}
export function readSale(value: unknown): PosSale {
  if (!object(value) || typeof value.id !== 'string' || typeof value.orderNumber !== 'string' ||
    typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !integer(value.totalAmountPaisa) ||
    (value.amountTenderedPaisa != null && !integer(value.amountTenderedPaisa)) ||
    (value.changePaisa != null && !integer(value.changePaisa)) ||
    (value.counterName != null && typeof value.counterName !== 'string') ||
    !Array.isArray(value.items) || !value.items.every((line: unknown) => object(line) && typeof line.productNameSnapshot === 'string' &&
      integer(line.quantity) && line.quantity > 0 && integer(line.unitPricePaisa) && integer(line.totalPricePaisa))) {
    throw Error('Unexpected receipt response. Check this sale’s status before taking payment again.');
  }
  return value as PosSale;
}
export function readCounter(raw: string | null): CounterState {
  if (raw === null) return initialCounter();
  try {
    const state = JSON.parse(raw);
    const validTicket = (value: unknown) => object(value) && typeof value.id === 'string' && typeof value.createdAt === 'string' &&
      Array.isArray(value.lines) && value.lines.every((line: any) => integer(line.quantity) && line.quantity > 0 && !!readProduct(line.product));
    if (!object(state) || state.version !== 1 || !validTicket(state.draft) || !Array.isArray(state.held) || !state.held.every(validTicket)) throw Error();
    if (state.pending !== null && (!object(state.pending) || state.pending.requestId !== state.draft.id ||
      !integer(state.pending.amountTenderedPaisa) || !Array.isArray(state.pending.items) || !state.pending.items.length ||
      !state.pending.items.every((line: any) => typeof line.merchantProductId === 'string' && integer(line.quantity) && line.quantity > 0 && integer(line.expectedUnitPricePaisa)))) throw Error();
    if (state.lastReceipt !== null) readSale(state.lastReceipt);
    const s = state.settings;
    if (!object(s) || typeof s.counterName !== 'string' || s.counterName.length > 60 ||
      typeof s.receiptFooter !== 'string' || s.receiptFooter.length > 160 || !['Enter', 'Tab'].includes(s.scannerSuffix) || !['80', '58'].includes(s.paperWidth) ||
      !['showStock', 'mergeScans', 'shortcuts', 'showCodes'].every((key) => typeof s[key] === 'boolean')) throw Error();
    // Add preferences without changing v1 bill IDs, held tickets or pending payloads.
    s.appearance ??= 'modern'; s.shortcutProfile ??= 'sirfbazar'; s.bindings ??= profileBindings('sirfbazar');
    if (!['modern', 'classic'].includes(s.appearance) || !shortcutProfiles.some((p) => p.id === s.shortcutProfile) || validateBindings(s.bindings)) throw Error();
    return state as CounterState;
  } catch { throw Error('Saved counter data could not be read. Do not clear browser storage: it may contain an unconfirmed sale. Contact support to recover it.'); }
}
export function addProduct(lines: PosLine[], product: PosProduct): PosLine[] {
  if (!product.isAvailable || product.stockQuantity < 1) throw Error(`${product.name} cannot be sold. Check its stock and availability in Products.`);
  const existing = lines.find((line) => line.product.merchantProductId === product.merchantProductId);
  if (existing && existing.product.pricePaisa !== product.pricePaisa) throw Error(`Price changed for ${product.name}. Refresh the bill before adding more.`);
  if ((existing?.quantity ?? 0) + 1 > product.stockQuantity) throw Error(`Only ${product.stockQuantity} units of ${product.name} are available. Reduce the quantity.`);
  if (!existing && lines.length >= 200) throw Error('This bill has 200 different items. Complete it before starting another.');
  return existing ? lines.map((line) => line === existing ? { product, quantity: line.quantity + 1 } : line) : [...lines, { product, quantity: 1 }];
}
export function setLineQuantity(lines: PosLine[], id: string, quantity: number): PosLine[] {
  const line = lines.find((item) => item.product.merchantProductId === id);
  if (!line) throw Error('Select an item on the current bill.');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) throw Error('Enter a whole quantity from 1 to 100000. Use Remove to delete an item.');
  if (quantity > line.product.stockQuantity) throw Error(`Only ${line.product.stockQuantity} units of ${line.product.name} are available. Reduce the quantity.`);
  return lines.map((item) => item === line ? { ...line, quantity } : item);
}
export function addUnits(lines: PosLine[], product: PosProduct, quantity: number): PosLine[] {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) throw Error('Enter a whole quantity from 1 to 100000.');
  const count = lines.find((line) => line.product.merchantProductId === product.merchantProductId)?.quantity ?? 0;
  return setLineQuantity(addProduct(lines, product), product.merchantProductId, count + quantity);
}
export function voidUnit(lines: PosLine[], id: string): PosLine[] {
  const line = lines.find((item) => item.product.merchantProductId === id);
  if (!line) throw Error('This item is not on the unpaid bill. Scan a bill item or return to Sale mode.');
  return line.quantity === 1 ? lines.filter((item) => item !== line) : lines.map((item) => item === line ? { ...line, quantity: line.quantity - 1 } : item);
}
export function paymentPayload(draft: Ticket, settings: PosSettings, amount: string): SalePayload {
  const amountTenderedPaisa = parseCash(amount);
  if (!draft.lines.length) throw Error('Add at least one item before taking payment.');
  if (amountTenderedPaisa === null || amountTenderedPaisa < total(draft.lines)) throw Error('Enter a valid cash amount covering the bill, with at most two decimal places.');
  return { requestId: draft.id, counterName: settings.counterName, amountTenderedPaisa,
    items: draft.lines.map(({ product, quantity }) => ({ merchantProductId: product.merchantProductId, quantity, expectedUnitPricePaisa: product.pricePaisa })) };
}
export function shortcutAction(event: { key: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey?: boolean; isComposing?: boolean; defaultPrevented?: boolean }, dialogOpen: boolean, settings: PosSettings, editing = false): CommandId | null {
  if (!settings.shortcuts || dialogOpen || event.repeat || event.isComposing || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  // Alt-letter commands must not consume scanner or ordinary text input.
  if (event.altKey && editing) return null;
  const binding = event.altKey ? `Alt+${event.key.toUpperCase()}` : event.key;
  return activeCommands(settings).find((command) => command.key && command.key === binding)?.id ?? null;
}
export function shouldHandleShortcut(event: { key: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }, dialogOpen: boolean) {
  return shortcutAction(event, dialogOpen, defaults) !== null;
}
