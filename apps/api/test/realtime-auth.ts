import 'reflect-metadata';
import assert from 'node:assert/strict';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';

async function run() {
  const makeClient = (token: string) => {
    const rooms: string[] = [];
    return { client: { data: {}, handshake: { auth: { token } }, join: (room: string) => rooms.push(room) } as any, rooms };
  };
  let release: (value: unknown) => void = () => {};
  const jwt = { verifyAsync: () => new Promise(resolve => { release = resolve; }) };
  const prisma = { merchant: { findUnique: async () => ({ userId: 'owner', staff: [{ userId: 'staff', status: 'ACTIVE' }] }) } };
  const gateway = new RealtimeGateway(jwt as any, prisma as any);
  const owner = makeClient('owner-token');
  const authentication = gateway.handleConnection(owner.client);
  const joining = gateway.joinMerchant(owner.client, { merchantId: 'shop' });
  assert.deepEqual(owner.rooms, [], 'must wait for JWT verification');
  release({ sub: 'owner', role: 'MERCHANT_OWNER' });
  await authentication;
  assert.deepEqual(await joining, { ok: true });
  assert.deepEqual(owner.rooms, ['user:owner', 'merchant:shop']);

  const foreign = makeClient('foreign-token');
  const foreignAuth = gateway.handleConnection(foreign.client);
  const foreignJoin = gateway.joinMerchant(foreign.client, { merchantId: 'shop' });
  release({ sub: 'foreign', role: 'MERCHANT_OWNER' });
  await foreignAuth;
  assert.deepEqual(await foreignJoin, { ok: false });
  assert.deepEqual(foreign.rooms, ['user:foreign']);

  const staff = makeClient('staff-token');
  const staffAuth = gateway.handleConnection(staff.client);
  const staffJoin = gateway.joinMerchant(staff.client, { merchantId: 'shop' });
  release({ sub: 'staff', role: 'MERCHANT_STAFF' });
  await staffAuth;
  assert.deepEqual(await staffJoin, { ok: true });

  const invalidGateway = new RealtimeGateway({ verifyAsync: async () => { throw Error('invalid'); } } as any, prisma as any);
  const invalid = makeClient('bad');
  await invalidGateway.handleConnection(invalid.client);
  assert.deepEqual(await invalidGateway.joinMerchant(invalid.client, { merchantId: 'shop' }), { ok: false });
  assert.deepEqual(invalid.rooms, []);
  console.log('PASS: asynchronous authentication, owner/staff membership, foreign tenant and invalid-token denial');
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
