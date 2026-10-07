// Read-only check against the existing local DB/API. No order is placed.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const apiRequire = createRequire(path.resolve(__dirname, '../../api/package.json'));
apiRequire('dotenv').config({ path: path.resolve(__dirname, '../../api/.env'), quiet: true });
const { PrismaClient } = apiRequire('@prisma/client');
const { JwtService } = apiRequire('@nestjs/jwt');
const { io } = require('socket.io-client');

async function run() {
  const database = new URL(process.env.DATABASE_URL);
  assert(['localhost', '127.0.0.1'].includes(database.hostname), 'Local DB required');
  const prisma = new PrismaClient();
  let socket;
  try {
    const merchant = await prisma.merchant.findFirst({ where: { shopName: { contains: 'mazhar', mode: 'insensitive' } }, select: { id: true, userId: true, shopName: true } });
    assert(merchant, 'Mazhar shop must exist');
    const token = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production' }).sign({ sub: merchant.userId, role: 'MERCHANT_OWNER' }, { expiresIn: 60 });
    const headers = { authorization: `Bearer ${token}` };
    const profile = await fetch('http://localhost:3001/api/merchant/profile', { headers });
    assert(profile.ok, 'Local API must return owner profile');
    assert.equal((await profile.json()).id, merchant.id);
    socket = io('http://localhost:3001', { autoConnect: false, auth: { token }, reconnection: false });
    const reply = await new Promise((resolve, reject) => {
      socket.on('connect_error', reject);
      socket.on('connect', () => socket.timeout(5_000).emit('join:merchant', { merchantId: merchant.id }, (error, result) => error ? reject(error) : resolve(result)));
      socket.connect();
    });
    assert.deepEqual(reply, { ok: true });
    const denied = await new Promise((resolve, reject) => socket.timeout(5_000).emit('join:merchant', { merchantId: 'another-shop' }, (error, result) => error ? reject(error) : resolve(result)));
    assert.deepEqual(denied, { ok: false });
    console.log(`PASS: local API profile and authenticated live room for ${merchant.shopName}; foreign shop denied; no orders or records changed`);
  } finally { socket?.disconnect(); await prisma.$disconnect(); }
}
void run().catch(() => { console.error('Local gateway check failed; inspect local API/DB availability and membership.'); process.exitCode = 1; });
