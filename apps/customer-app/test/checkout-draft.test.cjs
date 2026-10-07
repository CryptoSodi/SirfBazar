const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(storage) {
  const values = new Map();
  storage ??= { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/checkout-draft.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (name) => {
    assert.equal(name, '@react-native-async-storage/async-storage'); return { default: storage };
  } });
  return { flow: module.exports, values };
}
const { flow } = harness();
const point = { latitude: 31.51, longitude: 74.31 };
const draft = () => ({ ...flow.emptyCheckoutDraft(), fullAddress: 'House 12, Example Street', city: 'Lahore', contactName: 'Example customer', point });
const quote = () => ({ id: 'cart-a', itemCount: 1, subtotalPaisa: 29000, deliveryFeePaisa: 6000, serviceFeePaisa: 2000, totalPaisa: 37000,
  groups: [{ merchant: { id: 'shop-a' }, deliveryFeePaisa: 6000, items: [{ id: 'item', merchantProductId: 'mp-milk', productId: 'milk', quantity: 1, unitPricePaisa: 29000, inStock: true, stockQuantity: 10 }] }] });

test('408 timeout retains recovery markers like network errors, conflicts and server failures', () => {
  for (const status of [0, undefined, null, 408, 409, 500, 502, 503]) assert.equal(flow.isDefinitiveCheckoutRejection(status), false);
  for (const status of [400, 401, 403, 404, 422]) assert.equal(flow.isDefinitiveCheckoutRejection(status), true);
});
test('ineligible coupons block financial commitment and change the quote fingerprint', () => {
  const valid = { ...quote(), couponCode: 'WELCOME' };
  const invalid = { ...valid, couponError: 'Code expired' };
  assert.equal(flow.hasUsableCheckoutQuote(invalid), false);
  assert.notEqual(flow.quoteFingerprint(valid, point), flow.quoteFingerprint(invalid, point));
});
test('saved checkout recovery requires original cart, unchanged address and valid current charges', () => {
  const address = { ...flow.addressPayload(draft()), id: 'address-a' };
  const stored = { payload: { requestId: 'saved-uuid', cartId: 'cart-a', deliveryAddressId: 'address-a' }, addressFingerprint: flow.addressFingerprint(address) };
  assert.equal(flow.checkoutRecoveryProblem(stored, quote(), address), null);
  for (const [record, cart, destination] of [
    [{}, quote(), address], [{ ...stored, addressFingerprint: undefined }, quote(), address],
    [stored, { ...quote(), id: 'other-cart' }, address], [stored, quote(), null],
    [stored, quote(), { ...address, id: 'other-address' }], [stored, quote(), { ...address, latitude: 31.7 }],
    [stored, quote(), { ...address, instructions: 'Changed after timeout' }],
    [stored, { ...quote(), couponError: 'Expired' }, address], [stored, { ...quote(), totalPaisa: null }, address],
  ]) assert.ok(flow.checkoutRecoveryProblem(record, cart, destination));
});

test('delivery draft begins without fabricated coordinates or an account address', () => {
  const empty = flow.emptyCheckoutDraft();
  assert.equal(empty.point, null); assert.equal(empty.ownedAddress, undefined);
  const errors = flow.validateCheckoutDraft(empty);
  assert.ok(errors.fullAddress); assert.ok(errors.city); assert.ok(errors.point);
});
test('versioned hydration ignores malformed/unknown records and strips auth data', () => {
  for (const raw of ['invalid json', 'null', '{"version":2}', '{"version":1,"point":{"latitude":999,"longitude":74}}']) {
    assert.equal(flow.parseCheckoutDraft(raw).point, null);
  }
  const clean = flow.parseCheckoutDraft(JSON.stringify({ ...draft(), otp: '123456', accessToken: 'not-a-real-token', arbitrary: true }));
  assert.equal(clean.otp, undefined); assert.equal(clean.accessToken, undefined); assert.equal(clean.arbitrary, undefined);
  assert.equal(clean.fullAddress, 'House 12, Example Street');
});
test('draft fields and deliberate point survive a save and reload', async () => {
  const { flow } = harness();
  const original = { ...draft(), instructions: 'Ring the bell', customerNote: 'Keep bread upright', contactPhone: '+923001234567' };
  await flow.writeCheckoutDraft(original);
  const restored = await flow.readCheckoutDraft();
  assert.equal(JSON.stringify(restored), JSON.stringify(original));
});
test('storage writes are serialized, so a slow old keystroke cannot replace a newer draft', async () => {
  const values = new Map(); let releaseFirst, calls = 0;
  const { flow } = harness({ getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => {
    calls++; if (calls === 1) await new Promise((resolve) => releaseFirst = resolve); values.set(key, value);
  } });
  const first = flow.writeCheckoutDraft({ ...draft(), fullAddress: 'First' });
  const latest = flow.writeCheckoutDraft({ ...draft(), fullAddress: 'Latest' });
  await new Promise(setImmediate); assert.equal(calls, 1); releaseFirst();
  await Promise.all([first, latest]); assert.equal((await flow.readCheckoutDraft()).fullAddress, 'Latest');
});
test('a failed storage write is visible and does not poison the next save', async () => {
  let first = true, saved;
  const { flow } = harness({ getItem: async () => saved ?? null, setItem: async (_key, value) => {
    if (first) { first = false; throw Error('Storage full'); } saved = value;
  } });
  await assert.rejects(flow.writeCheckoutDraft(draft()), /Storage full/);
  await flow.writeCheckoutDraft({ ...draft(), city: 'Karachi' });
  assert.equal((await flow.readCheckoutDraft()).city, 'Karachi');
});
test('sign out/account switch invalidates only the owned address, not delivery entry', () => {
  const bound = flow.draftFromAddress({ ...flow.addressPayload(draft()), id: 'addr-a' }, 'account-a', draft());
  assert.equal(flow.draftForAccount(bound, 'account-a'), bound);
  for (const account of [null, 'account-b']) {
    const changed = flow.draftForAccount(bound, account);
    assert.equal(changed.ownedAddress, undefined); assert.equal(changed.fullAddress, bound.fullAddress);
    assert.equal(changed.point.latitude, point.latitude);
  }
});
test('address fingerprint detects changed recipient/instructions/pin but ignores labels', () => {
  const payload = flow.addressPayload(draft()); const base = flow.addressFingerprint(payload);
  assert.equal(base, flow.addressFingerprint({ ...payload, id: 'saved', label: 'Home', fullAddress: ` ${payload.fullAddress} ` }));
  for (const changed of [{ city: 'Other city' }, { contactName: 'Another receiver' }, { instructions: 'Another gate' }, { latitude: 31.52 }]) {
    assert.notEqual(base, flow.addressFingerprint({ ...payload, ...changed }));
  }
});
test('optional delivery contact accepts Pakistan mobile formats and rejects malformed numbers', () => {
  for (const phone of ['', '0300 1234567', '+92 300 1234567', '923001234567']) {
    assert.equal(flow.validateCheckoutDraft({ ...draft(), contactPhone: phone }).contactPhone, undefined);
  }
  assert.ok(flow.validateCheckoutDraft({ ...draft(), contactPhone: '123' }).contactPhone);
  assert.ok(flow.validateCheckoutDraft({ ...draft(), point: { latitude: NaN, longitude: 74 } }).point);
});
test('quote acknowledgment covers delivery, service, small-order, discount and final total', () => {
  const base = flow.quoteFingerprint(quote(), point);
  for (const changes of [{ deliveryFeePaisa: 7000 }, { serviceFeePaisa: 2200 }, { smallOrderFeePaisa: 500 }, { discountPaisa: 100 }, { totalPaisa: 38000 }, { couponCode: 'NEW' }]) {
    assert.notEqual(base, flow.quoteFingerprint({ ...quote(), ...changes }, point));
  }
  assert.notEqual(base, flow.quoteFingerprint(quote(), { ...point, latitude: 31.52 }));
});
test('quote acknowledgment covers shop charge, quantity, seller and availability changes', () => {
  const base = flow.quoteFingerprint(quote(), point);
  for (const change of [{ quantity: 2 }, { unitPricePaisa: 31000 }, { inStock: false }, { stockQuantity: 0 }, { merchantProductId: 'another-offer' }]) {
    const changed = quote(); Object.assign(changed.groups[0].items[0], change);
    assert.notEqual(base, flow.quoteFingerprint(changed, point));
  }
  const shop = quote(); shop.groups[0].merchant.id = 'shop-b';
  assert.notEqual(base, flow.quoteFingerprint(shop, point));
  const delivery = quote(); delivery.groups[0].deliveryFeePaisa += 100;
  assert.notEqual(base, flow.quoteFingerprint(delivery, point));
});
test('quote acknowledgment ignores nonfinancial image/timestamp changes', () => {
  const base = flow.quoteFingerprint(quote(), point);
  const refreshed = quote(); refreshed.updatedAt = 'later'; refreshed.groups[0].items[0].imageUrl = 'another-image';
  assert.equal(base, flow.quoteFingerprint(refreshed, point));
});
test('missing or malformed financial quote cannot unlock order placement', () => {
  assert.equal(flow.hasUsableCheckoutQuote(quote()), true);
  for (const changes of [{ totalPaisa: undefined }, { deliveryFeePaisa: NaN }, { serviceFeePaisa: -1 }, { itemCount: 0 }, { groups: [] }]) {
    assert.equal(flow.hasUsableCheckoutQuote({ ...quote(), ...changes }), false);
  }
  const badLine = quote(); badLine.groups[0].items[0].unitPricePaisa = undefined;
  assert.equal(flow.hasUsableCheckoutQuote(badLine), false);
});
