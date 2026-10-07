// Isolated in-memory test API. Never connects to the marketplace database.
const http = require('node:http');
const fs = require('node:fs');
const pathUtil = require('node:path');
const { Server } = require('../../api/node_modules/socket.io');
const user = { id: 'fixture-customer', fullName: 'Mobile Test Customer', phoneNumber: '+923009990106', role: 'CUSTOMER' };
const merchant = { id: 'shop', shopName: 'Mobile Test Kirana', area: 'Gulberg', city: 'Lahore', isOnline: true, isOpen: true };
const product = { productId: 'milk', merchantProductId: 'mp-milk', name: 'Full cream milk', imageUrl: 'http://localhost:3198/assets/product-milk.svg', categoryId: 'dairy', unit: 'litre', size: '1 litre', pricePaisa: 29500, stockQuantity: 50, isAvailable: true, merchant };
const products = [product,
  { ...product, productId: 'bread', merchantProductId: 'mp-bread', name: 'Sandwich bread', imageUrl: 'http://localhost:3198/assets/product-bread.svg', categoryId: 'bakery', size: '400 g', pricePaisa: 18000 },
  { ...product, productId: 'eggs', merchantProductId: 'mp-eggs', name: 'Farm eggs', imageUrl: 'http://localhost:3198/assets/product-eggs.svg', categoryId: 'dairy', size: '6 pack', pricePaisa: 22500 },
  { ...product, productId: 'banana', merchantProductId: 'mp-banana', name: 'Fresh bananas', imageUrl: 'http://localhost:3198/assets/product-banana.svg', categoryId: 'fresh', size: '1 dozen', pricePaisa: 16000 },
];
const categories = [{ id: 'dairy', name: 'Dairy', children: [] }, { id: 'fresh', name: 'Fresh', children: [] }, { id: 'bakery', name: 'Bakery', children: [] }, { id: 'pantry', name: 'Pantry', children: [] }];
let catalogueError = false, noService = false, multiShop = false, priceChanged = false;
let quantity = 1, customerQuantity = 0, merged = false, mergeFail = false, uncertain = false, orderPosts = 0;
let orderCreates = 0;
const createdOrders = new Map();
let replacement = true, status = 'PREPARING';
let address = { id: 'address', label: 'Home', fullAddress: 'House 12, Gulberg, Lahore', area: 'Gulberg', city: 'Lahore', latitude: 31.5204, longitude: 74.3587, isDefault: true };
let ticket = { id: 'ticket', createdByUserId: user.id, title: 'Help with an order', description: 'Test delivery question', status: 'IN_REVIEW', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [{ id: 'reply', senderUserId: 'support', senderRole: 'SUPPORT_AGENT', message: 'We are checking with your shop.', createdAt: new Date().toISOString() }] };
let notifications = [{ id: 'notification', title: 'Review a replacement', body: 'Your shop suggested a different item.', type: 'REPLACEMENT_REQUESTED', referenceId: 'order', isRead: false, createdAt: new Date().toISOString() }];
function cart(customer) {
  const qty = customer ? customerQuantity : quantity;
  const price = priceChanged ? 31000 : 29500;
  const groups = qty ? [{ merchant, deliveryFeePaisa: 8000, subtotalPaisa: qty * price, items: [{ id: 'cart-item', ...product, name: product.name, quantity: qty, unitPricePaisa: price, totalPaisa: price * qty, inStock: true, priceChanged }] }] : [];
  if (qty && multiShop) groups.push({ merchant: { ...merchant, id: 'produce-shop', shopName: 'Fixture Produce Shop' }, deliveryFeePaisa: 6000, subtotalPaisa: 16000, items: [{ ...products[3], id: 'banana-item', quantity: 1, unitPricePaisa: 16000, totalPaisa: 16000, inStock: true }] });
  const subtotal = groups.reduce((sum, group) => sum + group.subtotalPaisa, 0), delivery = groups.reduce((sum, group) => sum + group.deliveryFeePaisa, 0);
  return { id: 'cart', itemCount: qty + (qty && multiShop ? 1 : 0), groups, subtotalPaisa: subtotal, deliveryFeePaisa: delivery, serviceFeePaisa: qty ? 2000 : 0, totalPaisa: subtotal + delivery + (qty ? 2000 : 0) };
}
function order() { return { id: 'order', orderId: 'order', orderNumber: 'SB-MOBILE-FIXTURE', status, paymentStatus: 'UNPAID', totalAmountPaisa: 39500, paymentMethod: 'COD', merchant, isParent: false, createdAt: new Date().toISOString(), items: [
  { id: 'original', productNameSnapshot: product.name, unitSnapshot: '1 litre', quantity: 1, totalPricePaisa: 29500, itemStatus: replacement ? 'UNAVAILABLE' : 'REPLACED' },
  { id: 'replacement', productNameSnapshot: 'Milk alternative', unitSnapshot: '500 ml', quantity: 1, totalPricePaisa: 18500, replacementForItemId: 'original', itemStatus: replacement ? 'REPLACEMENT_SUGGESTED' : 'CONFIRMED' },
] }; }
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, 'http://localhost'); const path = url.pathname.replace(/^\/api/, '');
  if (/^\/assets\/product-(milk|bread|eggs|banana)\.svg$/.test(path)) {
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end(fs.readFileSync(pathUtil.join(__dirname, '../../../docs/design/SirfBazar_Customer_Mobile_Exact_Design_v1/reference/assets', pathUtil.basename(path)))); return;
  }
  let out = {}, code = 200;
  if (path === '/__control') {
    if ('mergeFail' in body) mergeFail = body.mergeFail;
    if ('uncertain' in body) uncertain = body.uncertain;
    if ('catalogueError' in body) catalogueError = body.catalogueError;
    if ('noService' in body) noService = body.noService;
    if ('multiShop' in body) multiShop = body.multiShop;
    if ('priceChanged' in body) priceChanged = body.priceChanged;
    if ('quantity' in body) quantity = body.quantity;
    if (body.status) { status = body.status; io.emit('order:update', { orderId: 'order', status }); }
    if (body.reset) { quantity = 1; customerQuantity = 0; merged = false; mergeFail = false; uncertain = false; catalogueError = false; noService = false; multiShop = false; priceChanged = false; orderPosts = 0; orderCreates = 0; createdOrders.clear(); replacement = true; status = 'PREPARING'; }
    out = { orderPosts, orderCreates, customerQuantity, merged, status };
  } else if (catalogueError && /^\/(products|merchants)\//.test(path)) { code = 503; out = { message: 'Fixture catalogue outage' }; }
  else if (path === '/auth/send-otp') out = { sent: true };
  else if (path === '/auth/verify-otp') {
    if (body.context !== 'customer' || body.code !== '123456') { code = 400; out = { message: 'Incorrect verification code' }; }
    else out = { accessToken: 'fixture-token', refreshToken: 'fixture-refresh', user };
  } else if (path === '/auth/me') out = user;
  else if (path === '/auth/refresh-token') out = { accessToken: 'fixture-token', refreshToken: 'fixture-refresh', user };
  else if (path === '/guest/session') out = { sessionToken: 'fixture-guest' };
  else if (path === '/guest/cart/merge-after-login') {
    if (mergeFail) { code = 503; out = { message: 'Temporary basket transfer outage' }; }
    else { if (!merged) { customerQuantity += quantity; quantity = 0; merged = true; } out = cart(true); }
  } else if (path.startsWith('/guest/cart') || path.startsWith('/cart')) {
    const customer = !path.startsWith('/guest');
    if (req.method === 'PUT') customer ? customerQuantity = body.quantity : quantity = body.quantity;
    if (req.method === 'POST' && path.endsWith('/items')) customer ? customerQuantity++ : quantity++;
    out = cart(customer);
  } else if (path === '/customer/profile') { if (req.method === 'PUT') Object.assign(user, body); out = { ...user, customer: { walletBalancePaisa: 0 } }; }
  else if (path.startsWith('/customer/addresses')) {
    if (req.method === 'POST' || req.method === 'PUT') { Object.assign(address, body); out = address; }
    else if (req.method === 'DELETE') out = { ok: true };
    else out = [address];
  } else if (path === '/products/categories') out = categories;
  else if (products.some(p => path === '/products/' + p.productId)) { const p = products.find(p => path === '/products/' + p.productId); out = { ...p, id: p.productId, isRestricted: false, requiresPrescription: false, offers: noService ? [] : [{ ...p, merchant }], similar: products.filter(other => other !== p).slice(0, 2) }; }
  else if (path.startsWith('/products/')) {
    let found = products.filter(p => (!url.searchParams.get('q') || p.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (!url.searchParams.get('categoryId') || p.categoryId === url.searchParams.get('categoryId')));
    if (path === '/products/catalog') found = found.map(({ merchantProductId, pricePaisa, merchant, ...p }) => p);
    else if (noService) found = [];
    out = { items: found, total: found.length, totalPages: 1, page: 1 };
  }
  else if (path === '/merchants/nearby') out = { items: noService ? [] : [merchant], total: noService ? 0 : 1 };
  else if (path === '/merchants/shop/products') out = { items: [{ ...product, product: { id: 'milk', name: product.name, unit: 'litre' } }], total: 1, totalPages: 1 };
  else if (path === '/merchants/shop') out = merchant;
  else if (path === '/orders' && req.method === 'POST') {
    orderPosts++;
    if (body.paymentMethod !== 'COD') { code = 400; out = { message: 'Only COD enabled' }; }
    else {
      const id = body.requestId || 'order';
      if (!createdOrders.has(id)) {
        orderCreates++; customerQuantity = 0;
        createdOrders.set(id, { ...order(), id, orderId: id, ...body });
      }
      if (uncertain) { res.destroy(); return; }
      out = createdOrders.get(id);
    }
  } else if (path === '/orders') out = [...createdOrders.values(), order()];
  else if (path === '/orders/order/track') out = { ...order(), deliveries: [{ orderId: 'order', status, merchant, timeline: [{ id: 'event', status, createdAt: new Date().toISOString() }], rider: null }] };
  else if (path === '/orders/order/items/original/replacement') { replacement = false; out = order(); io.emit('order:update', { orderId: 'order', status }); }
  else if (path === '/orders/order/cancel') { status = 'CANCELLED_BY_CUSTOMER'; out = order(); }
  else if (/^\/orders\/[^/]+\/review$/.test(path)) out = { id: 'fixture-review', ...body };
  else if (path === '/orders/order') out = order();
  else if (/^\/orders\/[^/]+\/track$/.test(path) && createdOrders.has(path.split('/')[2])) {
    const existing = createdOrders.get(path.split('/')[2]);
    out = { ...existing, deliveries: [{ orderId: existing.id, status: existing.status, merchant, timeline: [], rider: null }] };
  }
  else if (/^\/orders\/[^/]+$/.test(path) && createdOrders.has(path.split('/')[2])) out = createdOrders.get(path.split('/')[2]);
  else if (path === '/notifications') out = notifications;
  else if (path === '/notifications/read-all') { notifications.forEach((entry) => entry.isRead = true); out = { ok: true }; }
  else if (path.endsWith('/read')) { notifications.forEach((entry) => entry.isRead = true); out = { ok: true }; }
  else if (path === '/support/tickets') { if (req.method === 'POST') Object.assign(ticket, body); out = req.method === 'GET' ? [ticket] : ticket; }
  else if (path === '/support/tickets/ticket/messages') { ticket.messages.push({ id: String(Date.now()), senderUserId: user.id, message: body.message, createdAt: new Date().toISOString() }); out = ticket.messages.at(-1); }
  else if (path === '/support/tickets/ticket') out = ticket;
  else if (path === '/location/detect') out = { latitude: body.latitude, longitude: body.longitude, city: 'Lahore', area: 'Gulberg', serviceable: true };
  else { code = 404; out = { message: 'Fixture route missing: ' + path }; }
  res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(out));
});
const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', (socket) => socket.on('join:order', (_, reply) => reply?.({ ok: true })));
server.listen(3198, '127.0.0.1', () => console.log('Isolated mobile fixture listening on 3198'));
