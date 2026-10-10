require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PosService } = require('../src/pos/pos.service');

function fixture() {
  let state = { stock: 10, orders: [], audits: [], trial: null }, queue = Promise.resolve(), auditFails = false;
  const offer = { id: 'mp1', productId: 'p1', merchantId: 'shop', merchantSku: 'LOCAL1', pricePaisa: 29050, discountPricePaisa: null,
    isAvailable: true, product: { name: 'Milk', unit: 'pack', barcode: '00123', imageUrl: null, approvalStatus: 'APPROVED', isRestricted: false, requiresPrescription: false } };
  let lookupRows = null, lastQuery, missNextReplay = false;
  const prisma = {
    merchant: { findUnique: async () => ({ userId: 'owner' }) },
    merchantPosTrial: { findUnique: async () => state.trial },
    merchantProduct: { findMany: async (query) => { lastQuery = query; return lookupRows ?? [{ ...offer, stockQuantity: state.stock }]; } },
    order: { findUnique: async ({ where }) => { if (missNextReplay) { missNextReplay = false; return null; } return state.orders.find((o) => o.id === where.id) ?? null; },
      findFirst: async ({ where }) => state.orders.find((o) => o.id === where.id && o.merchantId === where.merchantId && o.channel === where.channel) ?? null },
    auditLog: { findFirst: async ({ where }) => state.audits.find((a) => a.entityId === where.entityId) ?? null },
    customer: { findFirst: async () => ({ id: 'walkin' }) },
    $transaction: (task) => {
      const result = queue.then(async () => {
        const before = structuredClone(state);
        try { return await task({
          merchantProduct: { updateMany: async ({ where, data }) => {
            assert.equal(where.merchantId, 'shop'); assert.equal(where.isAvailable, true);
            assert.equal(where.pricePaisa, offer.pricePaisa); assert.equal(where.product.approvalStatus, 'APPROVED');
            if (state.stock < where.stockQuantity.gte) return { count: 0 };
            state.stock -= data.stockQuantity.decrement; return { count: 1 };
          } },
          order: { create: async ({ data }) => {
            const id = data.id || 'legacy-' + state.orders.length;
            if (state.orders.some((o) => o.id === id)) throw Error('Unique ID collision');
            const row = { ...data, id, items: data.items.create }; state.orders.push(row); return row;
          } },
          auditLog: { create: async ({ data }) => { if (auditFails) throw Error('Audit write failure'); state.audits.push(data); return data; } },
        }); } catch (cause) { state = before; throw cause; }
      }); queue = result.catch(() => undefined); return result;
    },
  };
  const access = { merchantContext: async (userId) => ({ merchantId: userId === 'foreign' ? 'other-shop' : 'shop', isOwner: userId === 'owner', permissions: userId === 'denied' ? [] : ['POS'] }),
    requirePermission: (ctx) => { if (!ctx.isOwner && !ctx.permissions.includes('POS')) throw Error('Permission denied'); } };
  return { service: new PosService(prisma, access), state: () => state, offer, setRows: (rows) => { lookupRows = rows; }, query: () => lastQuery, failAudit: () => { auditFails = true; }, missNextReplay: () => { missNextReplay = true; }, setTrial: (trial) => { state.trial = trial; } };
}
const input = { requestId: '6c322b3a-1304-4d4f-b2a8-374b5f15f08a', counterName: 'Counter 1', amountTenderedPaisa: 100000,
  items: [{ merchantProductId: 'mp1', quantity: 2, expectedUnitPricePaisa: 29050 }] };

test('concurrent retries save one sale, one audit and one stock decrement', async () => {
  const f = fixture(); const replies = await Promise.all([f.service.createSale('owner', input), f.service.createSale('owner', input)]);
  assert.equal(replies[0].id, replies[1].id); assert.equal(f.state().stock, 8); assert.equal(f.state().orders.length, 1); assert.equal(f.state().audits.length, 1);
  assert.equal(replies[0].amountTenderedPaisa, 100000); assert.equal(replies[0].changePaisa, 41900);
  f.offer.pricePaisa = 30000;
  assert.equal((await f.service.createSale('owner', input)).changePaisa, 41900);
  assert.equal((await f.service.saleDetail('owner', input.requestId)).amountTenderedPaisa, 100000);
});
test('reference replay rejects another tenant, cashier or changed payload', async () => {
  const f = fixture(); await f.service.createSale('owner', input);
  await assert.rejects(f.service.createSale('foreign', input), /reference/);
  await assert.rejects(f.service.createSale('staff', input), /reference/);
  await assert.rejects(f.service.createSale('owner', { ...input, amountTenderedPaisa: 120000 }), /reference/);
  await assert.rejects(f.service.saleDetail('foreign', input.requestId), /not found/);
  assert.equal(f.state().stock, 8);
});
test('retry recovers a concurrent commit before stock or price validation rejects it', async () => {
  const f = fixture(); await f.service.createSale('owner', input);
  // Model a commit just after the retry's initial no-receipt lookup.
  f.missNextReplay(); f.state().stock = 0;
  assert.equal((await f.service.createSale('owner', input)).id, input.requestId);
  f.missNextReplay(); f.state().stock = 8; f.offer.pricePaisa = 31000;
  assert.equal((await f.service.createSale('owner', input)).changePaisa, 41900);
  assert.equal(f.state().orders.length, 1); assert.equal(f.state().audits.length, 1);
});
test('unavailable, restricted, fractional and stale-price sales are rejected without stock mutation', async () => {
  for (const change of [f => { f.offer.isAvailable = false; }, f => { f.offer.product.isRestricted = true; }, f => { f.offer.product.approvalStatus = 'DISABLED'; }, f => { f.offer.pricePaisa = 30000; }]) {
    const f = fixture(); change(f); await assert.rejects(f.service.createSale('owner', input)); assert.equal(f.state().stock, 10);
  }
  const f = fixture();
  await assert.rejects(f.service.createSale('owner', { ...input, items: [{ ...input.items[0], quantity: 1.5 }] }), /Invalid quantity/);
  await assert.rejects(f.service.createSale('owner', { ...input, items: [...input.items, ...input.items] }), /Combine/);
});
test('a failed financial audit rolls the sale and stock back', async () => {
  const f = fixture(); f.failAudit(); await assert.rejects(f.service.createSale('owner', input), /Audit write failure/);
  assert.equal(f.state().stock, 10); assert.equal(f.state().orders.length, 0);
});
test('exact barcode lookup preserves leading zeros, scopes merchant and rejects ambiguity', async () => {
  const f = fixture(); const row = await f.service.lookupProduct('owner', '00123');
  assert.equal(row.barcode, '00123'); assert.equal(f.query().where.merchantId, 'shop'); assert.equal(f.query().where.OR[1].product.barcode, '00123');
  f.setRows([]); await assert.rejects(f.service.lookupProduct('owner', 'unknown'), /No item/);
  f.setRows([f.offer, f.offer]); await assert.rejects(f.service.lookupProduct('owner', '00123'), /more than one/);
  await assert.rejects(f.service.lookupProduct('denied', '00123'), /Permission/);
});
test('capabilities and refresh lookup require POS permission and retain tenant filtering', async () => {
  const f = fixture(); assert.equal((await f.service.capabilities('owner')).idempotentSales, true);
  await assert.rejects(f.service.capabilities('denied'), /Permission/);
  await f.service.listProducts('owner', undefined, ['mp1']);
  assert.deepEqual(f.query().where, { merchantId: 'shop', id: { in: ['mp1'] } });
});

test('expired and declined POS trials block new sales while retaining read-only records', async () => {
  const f = fixture();
  f.setTrial({ optedIn: true, startedAt: new Date('2026-01-01T00:00:00Z'), endsAt: new Date('2026-02-01T00:00:00Z') });
  const expired = await f.service.capabilities('owner');
  assert.equal(expired.salesEnabled, false); assert.equal(expired.readOnly, true); assert.equal(expired.trial.status, 'EXPIRED');
  await assert.rejects(f.service.createSale('owner', input), /trial has ended.*read-only/);
  assert.equal(f.state().stock, 10); assert.equal(f.state().orders.length, 0);
  f.setTrial({ optedIn: false, startedAt: null, endsAt: null });
  await assert.rejects(f.service.createSale('owner', input), /POS sales are disabled/);
});

test('legacy shops remain enabled and a completed receipt retry remains readable after expiry', async () => {
  const f = fixture();
  assert.equal((await f.service.capabilities('owner')).salesEnabled, true);
  await f.service.createSale('owner', input);
  f.setTrial({ optedIn: true, startedAt: new Date('2026-01-01T00:00:00Z'), endsAt: new Date('2026-02-01T00:00:00Z') });
  assert.equal((await f.service.createSale('owner', input)).id, input.requestId);
  assert.equal(f.state().stock, 8); assert.equal(f.state().orders.length, 1);
});
