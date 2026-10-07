import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/ipos.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const pos = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const product = { merchantProductId: 'mp1', productId: 'p1', name: 'Milk', unit: 'pack', barcode: '0012345', pricePaisa: 29050, stockQuantity: 3, isAvailable: true };

test('cash parsing preserves paisa and rejects malformed, negative and excessive amounts', () => {
  assert.equal(pos.parseCash('290.50'), 29050);
  assert.equal(pos.parseCash(' 1.2 '), 120);
  for (const value of ['', '1..2', '-1', '1e3', '2.999', '999999999999999']) assert.equal(pos.parseCash(value), null);
  assert.equal(pos.money(29050), 'Rs 290.50');
});
test('repeated scans add units without losing leading zeros; stock and availability are checked', () => {
  let lines = pos.addProduct([], product);
  lines = pos.addProduct(lines, product);
  assert.equal(lines.length, 1); assert.equal(lines[0].quantity, 2); assert.equal(lines[0].product.barcode, '0012345');
  assert.equal(pos.total(lines), 58100);
  lines = pos.addProduct(lines, product);
  assert.throws(() => pos.addProduct(lines, product), /available/);
  assert.throws(() => pos.addProduct([], { ...product, isAvailable: false }), /cannot be sold/);
  assert.throws(() => pos.addProduct(lines, { ...product, pricePaisa: 31000 }), /Price changed/);
});
test('payment snapshots retain the same request identity and price across retries', () => {
  const draft = { ...pos.ticket(), lines: pos.addProduct([], product) };
  const payload = pos.paymentPayload(draft, pos.defaults, '500');
  assert.equal(payload.requestId, draft.id); assert.equal(payload.amountTenderedPaisa, 50000);
  assert.equal(payload.items[0].expectedUnitPricePaisa, 29050);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
  assert.throws(() => pos.paymentPayload(draft, pos.defaults, '200'), /covering/);
  assert.throws(() => pos.paymentPayload(pos.ticket(), pos.defaults, '200'), /at least one/);
});
test('counter storage is scoped to account and shop and preserves held and pending data', () => {
  assert.notEqual(pos.counterKey('shopA', 'userA'), pos.counterKey('shopB', 'userA'));
  assert.notEqual(pos.counterKey('shopA', 'userA'), pos.counterKey('shopA', 'userB'));
  const state = pos.initialCounter(); state.draft.lines = pos.addProduct([], product);
  state.pending = pos.paymentPayload(state.draft, state.settings, '500'); state.held = [pos.ticket()];
  assert.deepEqual(pos.readCounter(JSON.stringify(state)), state);
  for (const raw of ['{bad', '{}', JSON.stringify({ ...state, version: 99 }), JSON.stringify({ ...state, pending: { requestId: 'other' } })]) assert.throws(() => pos.readCounter(raw), /Do not clear browser storage/);
});
test('keyboard shortcuts do not consume browser-reserved keys or operate through dialogs', () => {
  const event = { key: 'F10', repeat: false, ctrlKey: false, metaKey: false, altKey: false };
  assert.equal(pos.shouldHandleShortcut(event, false), true);
  for (const key of ['F5', 'F11', 'F12', 'Enter']) assert.equal(pos.shouldHandleShortcut({ ...event, key }, false), false);
  assert.equal(pos.shouldHandleShortcut(event, true), false);
  assert.equal(pos.shouldHandleShortcut({ ...event, repeat: true }, false), false);
  assert.equal(pos.shouldHandleShortcut({ ...event, ctrlKey: true }, false), false);
});
test('malformed product and receipt payloads do not appear as successful sales', () => {
  assert.throws(() => pos.readProducts({ items: [] }));
  assert.throws(() => pos.readProduct({ ...product, pricePaisa: '29050' }));
  assert.throws(() => pos.readSale({ id: 'sale' }), /Check this sale/);
  const sale = { id: 'sale', orderNumber: 'POS-1', createdAt: new Date().toISOString(), totalAmountPaisa: 29050,
    items: [{ productNameSnapshot: 'Milk', quantity: 1, unitPricePaisa: 29050, totalPricePaisa: 29050 }] };
  assert.equal(pos.readSale(sale).id, 'sale');
  assert.throws(() => pos.readSale({ ...sale, amountTenderedPaisa: '50000' }), /Check this sale/);
  assert.throws(() => pos.readSale({ ...sale, changePaisa: -1 }), /Check this sale/);
});

test('new preferences migrate existing v1 bills without changing pending sale identity', () => {
  const state = pos.initialCounter(); state.draft.lines = pos.addProduct([], product);
  state.pending = pos.paymentPayload(state.draft, state.settings, '500'); state.held = [pos.ticket()];
  delete state.settings.appearance; delete state.settings.shortcutProfile; delete state.settings.bindings;
  const migrated = pos.readCounter(JSON.stringify(state));
  assert.equal(migrated.settings.appearance, 'modern');
  assert.deepEqual(migrated.settings.bindings, pos.profileBindings('sirfbazar'));
  assert.deepEqual(migrated.pending, state.pending); assert.deepEqual(migrated.draft, state.draft); assert.deepEqual(migrated.held, state.held);
  migrated.settings.appearance = 'classic';
  assert.deepEqual(pos.readCounter(JSON.stringify(migrated)).pending, state.pending);
});

test('reference profiles do not conflate the two F11 meanings or repurpose refund F6', () => {
  const event = { key: 'F11', repeat: false, ctrlKey: false, metaKey: false, altKey: false };
  const video = { ...pos.defaults, shortcutProfile: 'video', bindings: pos.profileBindings('video') };
  const website = { ...pos.defaults, shortcutProfile: 'website', bindings: pos.profileBindings('website') };
  const codeFirst = { ...pos.defaults, shortcutProfile: 'website-code-first', bindings: pos.profileBindings('website-code-first') };
  assert.equal(pos.shortcutAction(event, false, video), 'reset');
  assert.equal(pos.shortcutAction(event, false, website), 'quantity');
  assert.equal(pos.shortcutAction({ ...event, key: 'F7' }, false, website), 'multi');
  assert.equal(pos.shortcutAction({ ...event, key: 'F2' }, false, website), 'search');
  assert.equal(pos.shortcutAction({ ...event, key: 'F4' }, false, website), 'scan');
  assert.equal(pos.shortcutAction({ ...event, key: 'F2' }, false, codeFirst), 'scan');
  assert.equal(pos.shortcutAction({ ...event, key: 'F4' }, false, codeFirst), 'search');
  assert.equal(pos.shortcutAction(event, false, codeFirst), 'quantity');
  for (const settings of [video, website, codeFirst]) {
    assert.equal(pos.shortcutAction({ ...event, key: 'F5' }, false, settings), 'void');
    assert.equal(pos.shortcutAction({ ...event, key: 'F6' }, false, settings), null);
    assert.equal(pos.shortcutAction(event, true, settings), null);
    for (const patch of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { shiftKey: true }, { defaultPrevented: true }]) assert.equal(pos.shortcutAction({ ...event, ...patch }, false, settings), null);
    assert.equal(pos.shortcutAction(event, false, { ...settings, shortcuts: false }), null);
  }
});

test('custom shortcuts reject collisions and never capture plain text or Alt letters while editing', () => {
  const bindings = pos.profileBindings('video'); bindings.scan = 'F5';
  assert.match(pos.validateBindings(bindings), /only one/);
  bindings.scan = 'a'; assert.match(pos.validateBindings(bindings), /listed key/);
  bindings.scan = 'Alt+I'; assert.equal(pos.validateBindings(bindings), null);
  const settings = { ...pos.defaults, shortcutProfile: 'custom', bindings };
  const event = { key: 'i', repeat: false, ctrlKey: false, metaKey: false, altKey: false };
  assert.equal(pos.shortcutAction(event, false, settings), null);
  assert.equal(pos.shortcutAction({ ...event, altKey: true }, false, settings), 'scan');
  assert.equal(pos.shortcutAction({ ...event, altKey: true }, false, settings, true), null);
});

test('multi-quantity additions and edits enforce stock, unit precision and limits atomically', () => {
  const lines = pos.addUnits([], product, 2);
  assert.equal(lines[0].quantity, 2);
  assert.equal(pos.setLineQuantity(lines, 'mp1', 3)[0].quantity, 3);
  assert.equal(lines[0].quantity, 2);
  for (const value of [0, -1, 1.5, 100001, NaN]) assert.throws(() => pos.addUnits(lines, product, value), /whole quantity/);
  assert.throws(() => pos.addUnits(lines, product, 2), /available/);
  assert.throws(() => pos.setLineQuantity(lines, 'mp1', 4), /available/);
  assert.throws(() => pos.setLineQuantity(lines, 'missing', 1), /Select an item/);
});

test('void removes one unpaid unit without altering source lines, prices or server stock', () => {
  const lines = pos.addUnits([], product, 2);
  const once = pos.voidUnit(lines, 'mp1');
  assert.equal(once[0].quantity, 1); assert.equal(once[0].product.pricePaisa, product.pricePaisa);
  assert.deepEqual(pos.voidUnit(once, 'mp1'), []);
  assert.equal(lines[0].quantity, 2); assert.equal(product.stockQuantity, 3);
  assert.throws(() => pos.voidUnit(lines, 'missing'), /not on the unpaid bill/);
});
