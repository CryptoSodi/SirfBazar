// Isolated browser fixture. Never connects to or mutates the marketplace DB.
const http = require('node:http');
const { createRequire } = require('node:module');
const apiRequire = createRequire(require('node:path').resolve(__dirname, '../../api/package.json'));
const { Server } = apiRequire('socket.io');
const orders = new Map();
let allowSocket = true;
let failSnapshot = false;
let snapshotDelay = 0;
let joins = 0;
const profile = { id: 'alert-test-shop', shopName: 'Alert test shop', isOwner: true, permissions: ['ORDERS', 'STORE', 'RIDERS'], isOnline: true, isOpen: true, approvalStatus: 'APPROVED' };
const user = { id: 'alert-test-owner', fullName: 'Alert test owner', merchant: profile };
const token = `fixture.${Buffer.from(JSON.stringify({ sub: user.id, role: 'MERCHANT_OWNER' })).toString('base64url')}.fixture`;
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  res.setHeader('Content-Type', 'application/json');
  const url = new URL(req.url, 'http://localhost');
  const send = value => res.end(JSON.stringify(value));
  if (url.pathname === '/test/session') return send({ accessToken: token, refreshToken: 'fixture', user });
  if (url.pathname.startsWith('/test/')) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    if (url.pathname === '/test/new') {
      const id = body.id || `order-${orders.size + 1}`;
      const order = { id, orderNumber: `SB-TEST-${id}`, status: 'SENT_TO_MERCHANT', createdAt: new Date().toISOString(), totalAmountPaisa: 50000, subtotalPaisa: 40000, deliveryFeePaisa: 10000, items: [] };
      orders.set(id, order);
      if (!body.silent) {
        io.to(`merchant:${profile.id}`).emit('order:new', { orderId: id, orderNumber: order.orderNumber });
        io.to(`user:${user.id}`).emit('notification', { type: 'NEW_ORDER', referenceId: id });
      }
      return send({ ok: true, at: Date.now(), id });
    }
    if (url.pathname === '/test/update') {
      const order = orders.get(body.id);
      if (order) { order.status = body.status; io.to(`merchant:${profile.id}`).emit('order:update', { orderId: order.id, orderNumber: order.orderNumber, status: order.status }); }
      return send({ ok: true });
    }
    if (url.pathname === '/test/socket') {
      allowSocket = body.enabled;
      if (!allowSocket) for (const socket of io.sockets.sockets.values()) socket.conn.close();
      return send({ ok: true });
    }
    if (url.pathname === '/test/snapshot') { failSnapshot = !!body.fail; snapshotDelay = body.delay || 0; return send({ ok: true }); }
    if (url.pathname === '/test/stats') return send({ joins, sockets: io.sockets.sockets.size });
  }
  if (url.pathname === '/api/auth/me') return send(user);
  if (url.pathname === '/api/auth/refresh-token') return send({ accessToken: token, refreshToken: 'fixture', user });
  if (url.pathname === '/api/merchant/profile') return send(profile);
  if (url.pathname === '/api/merchant/dashboard') return send({ todayOrders: orders.size, pendingOrders: [...orders.values()].filter(order => order.status === 'SENT_TO_MERCHANT').length, preparingOrders: 0, readyOrders: 0, activeDeliveries: 0, lowStockProducts: 0, ...profile });
  if (url.pathname === '/api/merchant/earnings') return send({ grossSalesPaisa: 0, deliveredOrders: 0, byDay: [] });
  if (url.pathname === '/api/merchant/orders') {
    const result = [...orders.values()].filter(order => !url.searchParams.get('status') || order.status === url.searchParams.get('status')).map(order => ({ ...order }));
    if (snapshotDelay) await new Promise(resolve => setTimeout(resolve, snapshotDelay));
    if (failSnapshot) { res.statusCode = 503; return send({ message: 'fixture unavailable' }); }
    return send(result);
  }
  const detail = url.pathname.match(/^\/api\/merchant\/orders\/([^/]+)$/);
  if (detail && orders.has(detail[1])) return send(orders.get(detail[1]));
  res.statusCode = 404; send({ message: 'fixture route not found' });
});
const io = new Server(server, { cors: { origin: true }, pingInterval: 1000, pingTimeout: 1000 });
io.use((socket, next) => allowSocket && socket.handshake.auth.token === token ? next() : next(Error('fixture disconnected')));
io.on('connection', socket => {
  socket.join(`user:${user.id}`);
  socket.on('join:merchant', (body, reply) => { const ok = body.merchantId === profile.id; if (ok) { socket.join(`merchant:${profile.id}`); joins++; } reply({ ok }); });
});
server.listen(3199, '127.0.0.1', () => console.log('Isolated alert fixture: http://127.0.0.1:3199'));
