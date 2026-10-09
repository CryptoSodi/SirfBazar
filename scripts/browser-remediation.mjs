import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });
const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });
const visibleToast = (page) => page.locator('[data-toast-host] > div').last();
const findings = [];
await mkdir('output/playwright', { recursive: true });

try {
  const web = await browser.newContext();
  const requestId = '1c627504-0f23-4bd2-a8f2-943735519cba';
  const checkoutPayload = { requestId, cartId: 'cart-1', approvedQuote: 'approved-test-token', deliveryAddressId: 'address-1', paymentMethod: 'COD' };
  await web.addInitScript(({ payload }) => {
    localStorage.setItem('sb.accessToken', 'fixture-access');
    localStorage.setItem('sb.user', JSON.stringify({ id: 'customer-1' }));
    localStorage.setItem('sb.checkoutRecovery.v1', JSON.stringify({ version: 1, owner: 'customer-1', state: 'pending', payload }));
  }, { payload: checkoutPayload });
  let retried = null;
  await web.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/cart')) return route.fulfill(json({ id: 'cart-1', groups: [], itemCount: 0 }));
    if (url.pathname.endsWith('/customer/addresses')) return route.fulfill(json([]));
    if (url.pathname.endsWith(`/orders/${requestId}`)) return route.fulfill(json({ message: 'Not found' }, 404));
    if (url.pathname.endsWith('/orders') && route.request().method() === 'POST') {
      retried = route.request().postDataJSON();
      return route.fulfill(json({ id: requestId }));
    }
    return route.fulfill(json({ message: `Unexpected fixture request: ${url.pathname}` }, 500));
  });
  const webPage = await web.newPage();
  await webPage.goto(`${process.env.BROWSER_WEB_URL}/checkout`);
  await webPage.getByRole('heading', { name: 'Check your saved order' }).waitFor();
  await webPage.getByRole('button', { name: 'Check saved order' }).click();
  await visibleToast(webPage).getByText('No saved order was found yet.').waitFor();
  await webPage.getByRole('button', { name: 'Retry saved request' }).click();
  assert.deepEqual(retried, checkoutPayload, 'web recovery must POST identical saved payload and ID');
  console.log('PASS web saved checkout survives consumed cart and retries identical request');
  await web.close();

  const rejectedWeb = await browser.newContext();
  await rejectedWeb.addInitScript(({ payload }) => {
    localStorage.setItem('sb.accessToken', 'fixture-access');
    localStorage.setItem('sb.user', JSON.stringify({ id: 'customer-1' }));
    localStorage.setItem('sb.checkoutRecovery.v1', JSON.stringify({ version: 1, owner: 'customer-1', state: 'pending', payload }));
  }, { payload: checkoutPayload });
  let rejectedRetry = null;
  await rejectedWeb.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/cart')) return route.fulfill(json({ id: 'cart-1', groups: [], itemCount: 0 }));
    if (path.endsWith('/customer/addresses')) return route.fulfill(json([]));
    if (path.endsWith(`/orders/${requestId}`)) return route.fulfill(json({ message: 'Not found' }, 404));
    if (path.endsWith('/orders') && route.request().method() === 'POST') {
      rejectedRetry = route.request().postDataJSON();
      return route.fulfill(json({ code: 'QUOTE_CHANGED', message: 'Approved quote expired' }, 409));
    }
    return route.fulfill(json({ message: `Unexpected rejected checkout fixture request: ${path}` }, 500));
  });
  const rejectedPage = await rejectedWeb.newPage();
  await rejectedPage.goto(`${process.env.BROWSER_WEB_URL}/checkout`);
  await rejectedPage.getByRole('button', { name: 'Check saved order' }).click();
  await visibleToast(rejectedPage).getByText('No saved order was found yet.').waitFor();
  assert.equal((await rejectedPage.evaluate(() => JSON.parse(localStorage.getItem('sb.checkoutRecovery.v1')))).payload.requestId, requestId, 'GET 404 alone retains saved checkout ID');
  await rejectedPage.getByRole('button', { name: 'Retry saved request' }).click();
  assert.deepEqual(rejectedRetry, checkoutPayload, 'expired quote retry must use identical saved POST payload');
  await rejectedPage.getByRole('heading', { name: 'Check your saved order' }).waitFor({ state: 'hidden' });
  assert.equal(await rejectedPage.evaluate(() => localStorage.getItem('sb.checkoutRecovery.v1')), null, 'definitive QUOTE_CHANGED rejection clears pending checkout');
  await rejectedPage.screenshot({ path: 'output/playwright/customer-expired-quote-review.png', fullPage: true });
  console.log('PASS web GET 404 retains saved ID; definitive quote rejection clears pending checkout');
  await rejectedWeb.close();

  const firstAddress = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await firstAddress.addInitScript(() => {
    localStorage.setItem('sb.accessToken', 'fixture-access');
    localStorage.setItem('sb.user', JSON.stringify({ id: 'customer-1' }));
  });
  const fixtureCart = { id: 'cart-first-address', itemCount: 1, subtotalPaisa: 25000, serviceFeePaisa: 0, smallOrderFeePaisa: 0, discountPaisa: 0, totalPaisa: 25000, groups: [{ merchant: { id: 'merchant-1', shopName: 'Fixture Shop' }, deliveryFeePaisa: 0, items: [{ merchantProductId: 'offer-1', name: 'Fixture milk', quantity: 1, unitPricePaisa: 25000, inStock: true }] }] };
  let addressPost = null;
  let addressResponse = null;
  let quotePost = null;
  await firstAddress.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/cart')) return route.fulfill(json(fixtureCart));
    if (path.endsWith('/customer/addresses') && route.request().method() === 'GET') return route.fulfill(json([]));
    if (path.endsWith('/customer/addresses') && route.request().method() === 'POST') {
      addressPost = route.request().postDataJSON();
      addressResponse = { ...addressPost, id: 'address-first' };
      return route.fulfill(json(addressResponse));
    }
    if (path.endsWith('/orders/quote')) {
      quotePost = route.request().postDataJSON();
      return route.fulfill(json({ version: 1, approvedQuote: 'fixture-approved-quote', expiresAt: '2030-01-01T00:00:00.000Z', quote: { items: fixtureCart.groups[0].items, merchants: [{ merchantId: 'merchant-1', shopName: 'Fixture Shop', deliveryFeePaisa: 0 }], deliveryAddress: addressResponse, subtotalPaisa: 25000, serviceFeePaisa: 0, smallOrderFeePaisa: 0, discountPaisa: 0, totalAmountPaisa: 25000 } }));
    }
    return route.fulfill(json({ message: `Unexpected first-address fixture request: ${path}` }, 500));
  });
  await firstAddress.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const firstPage = await firstAddress.newPage();
  await firstPage.goto(`${process.env.BROWSER_WEB_URL}/checkout`);
  await firstPage.getByLabel('Recipient name').fill('Fixture Customer');
  await firstPage.getByLabel('Delivery contact number').fill('03000000000');
  await firstPage.getByLabel('House / apartment, street & area').fill('Fixture Street 12');
  await firstPage.getByLabel('City').fill('Lahore');
  await firstPage.getByRole('button', { name: 'Pin on map' }).click();
  const firstPicker = firstPage.getByRole('dialog', { name: 'Choose a delivery location' });
  await firstPicker.locator('.leaflet-container').focus();
  await firstPage.keyboard.press('ArrowRight');
  await firstPicker.getByRole('button', { name: 'Select map center' }).click();
  await firstPicker.getByRole('button', { name: 'Confirm location' }).click();
  await firstPicker.waitFor({ state: 'hidden' });
  const displayedPin = await firstPage.getByText(/^Pinned: /).textContent();
  await firstPage.getByRole('button', { name: 'Save as new address' }).click();
  await visibleToast(firstPage).getByText('Delivery details saved.').waitFor();
  assert.equal(Number.isFinite(addressPost?.latitude), true, 'first address POST has selected numeric latitude');
  assert.equal(Number.isFinite(addressPost?.longitude), true, 'first address POST has selected numeric longitude');
  assert.notEqual(addressPost.longitude, 0, 'map keyboard pan selects an actual location');
  assert.equal(displayedPin?.trim(), `Pinned: ${addressPost.latitude.toFixed(5)}, ${addressPost.longitude.toFixed(5)}`, 'submitted coordinates match the selected visible map pin');
  assert.deepEqual({ ...addressResponse, id: undefined }, { ...addressPost, id: undefined }, 'fixture address response echoes exact POST, without injected coordinates');
  await firstPage.getByRole('button', { name: 'Review order' }).first().click();
  await firstPage.getByText('Approved order review').waitFor();
  assert.deepEqual(quotePost, { cartId: fixtureCart.id, deliveryAddressId: 'address-first', paymentMethod: 'COD' }, 'quote uses just-saved first address');
  await firstPage.screenshot({ path: 'output/playwright/customer-first-address-review-390.png', fullPage: true });
  console.log('PASS first-time checkout pins exact coordinates, saves echoed address, then obtains approved quote');
  await firstAddress.close();

  const mapContext = await browser.newContext({ viewport: { width: 640, height: 720 } });
  await mapContext.addInitScript(() => {
    localStorage.setItem('sb.accessToken', 'fixture-access');
    localStorage.setItem('sb.user', JSON.stringify({ id: 'customer-1' }));
  });
  await mapContext.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/cart')) return route.fulfill(json({ id: 'cart-1', groups: [], itemCount: 0 }));
    if (path.endsWith('/customer/profile')) return route.fulfill(json({ id: 'customer-1', fullName: 'Fixture Customer', phoneNumber: '03000000000' }));
    if (path.endsWith('/customer/addresses')) return route.fulfill(json([]));
    if (path.endsWith('/location/detect')) return route.fulfill(json({ city: 'Lahore' }));
    return route.fulfill(json({ message: `Unexpected map fixture request: ${path}` }, 500));
  });
  await mapContext.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const mapPage = await mapContext.newPage();
  await mapPage.goto(`${process.env.BROWSER_WEB_URL}/profile`);
  await mapPage.getByRole('button', { name: /Add address/ }).click();
  const mapTrigger = mapPage.getByRole('button', { name: 'Pin on map' });
  await mapTrigger.click();
  const picker = mapPage.getByRole('dialog', { name: 'Choose a delivery location' });
  await picker.waitFor();
  await picker.getByRole('button', { name: 'Use current location' }).click();
  await mapPage.getByText(/Location access failed/).waitFor();
  await picker.getByRole('button', { name: 'Dismiss notification' }).click();
  await picker.locator('.leaflet-container').focus();
  await mapPage.keyboard.press('ArrowRight');
  await picker.getByRole('button', { name: 'Select map center' }).click();
  await picker.getByRole('button', { name: 'Confirm location' }).click();
  await picker.waitFor({ state: 'hidden' });
  await mapPage.waitForTimeout(100);
  if (!await mapTrigger.evaluate((node) => node === document.activeElement)) findings.push('map picker did not restore focus after confirmation');
  await mapTrigger.click();
  await mapPage.keyboard.press('Escape');
  await picker.waitFor({ state: 'hidden' });
  await mapPage.waitForTimeout(100);
  if (!await mapTrigger.evaluate((node) => node === document.activeElement)) findings.push('map picker did not restore focus after Escape');
  await mapPage.screenshot({ path: 'output/playwright/customer-map-keyboard.png', fullPage: true });
  if (!findings.some((finding) => finding.startsWith('map picker'))) console.log('PASS denied GPS to keyboard map-center selection, confirm, Escape and focus restoration');
  await mapContext.close();

  const pos = await browser.newContext();
  await pos.addInitScript(() => {
    localStorage.setItem('sbp.accessToken', 'fixture-access');
    localStorage.setItem('sbp.user', JSON.stringify({ id: 'cashier-1', role: 'MERCHANT_OWNER' }));
  });
  let pendingSale = null;
  await pos.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/pos/capabilities')) return route.fulfill(json({ version: 2, merchantId: 'merchant-1', idempotentSales: true }));
    if (url.pathname.endsWith('/pos/products')) return route.fulfill(json([{ merchantProductId: 'offer-1', productId: 'product-1', name: 'Fixture milk', imageUrl: null, unit: 'pack', barcode: null, pricePaisa: 25000, stockQuantity: 4, isAvailable: true }]));
    if (url.pathname.endsWith('/pos/sales') && route.request().method() === 'POST') {
      pendingSale = route.request().postDataJSON();
      return route.abort('failed');
    }
    if (pendingSale && url.pathname.endsWith(`/pos/sales/${pendingSale.requestId}`)) return route.fulfill(json({
      id: pendingSale.requestId, merchantId: 'merchant-1', cashierId: 'cashier-1', orderNumber: 'FIXTURE-1',
      totalAmountPaisa: 25000, amountTenderedPaisa: 25000, changePaisa: 0,
      items: [{ id: 'line-1', merchantProductId: 'offer-1', quantity: 1, unitPricePaisa: 25000, totalPricePaisa: 25000, productNameSnapshot: 'Fixture milk' }],
    }));
    return route.fulfill(json({ message: `Unexpected fixture request: ${url.pathname}` }, 500));
  });
  const posPage = await pos.newPage();
  await posPage.goto(process.env.BROWSER_POS_URL);
  await posPage.getByRole('button', { name: /Fixture milk/ }).click();
  const trigger = posPage.getByRole('button', { name: /Charge Rs/ });
  await trigger.click();
  const dialog = posPage.getByRole('dialog', { name: 'Cash payment' });
  await dialog.waitFor();
  assert.equal(await posPage.locator('#pos-cash-received').evaluate((node) => node === document.activeElement), true);
  await posPage.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  await trigger.click();
  await posPage.getByRole('button', { name: 'Complete sale' }).click();
  await posPage.getByText('Check saved sale before charging again').waitFor();
  await dialog.waitFor({ state: 'hidden' });
  const recoveryPanel = posPage.getByRole('status').filter({ hasText: 'Check saved sale before charging again' });
  assert.equal(await recoveryPanel.isVisible(), true, 'saved-sale recovery remains visible outside the closed cash dialog');
  assert.equal(await recoveryPanel.evaluate((node) => node === document.activeElement && node.tabIndex === -1), true, 'keyboard focus moves to durable recovery');
  assert.equal(await trigger.isDisabled(), true, 'cash cannot be charged again before the saved sale is checked');
  const saved = await posPage.evaluate(() => JSON.parse(localStorage.getItem('sbp.saleRecovery.v1')));
  assert.equal(saved.payload.requestId, pendingSale.requestId);
  assert.deepEqual(saved.payload.items, pendingSale.items);
  await posPage.reload();
  await posPage.getByRole('button', { name: 'Check saved sale' }).click();
  await posPage.getByRole('dialog', { name: /Sale complete/ }).waitFor();
  assert.equal(await posPage.evaluate(() => localStorage.getItem('sbp.saleRecovery.v1')), null);
  console.log('PASS POS modal keyboard flow and lost-response sale recovery');
  await pos.close();

  for (const retryStatus of [400, 500]) {
    const retryContext = await browser.newContext();
    await retryContext.addInitScript(({ recovery }) => {
      localStorage.setItem('sbp.accessToken', 'fixture-access');
      localStorage.setItem('sbp.user', JSON.stringify({ id: 'cashier-1', role: 'MERCHANT_OWNER' }));
      localStorage.setItem('sbp.saleRecovery.v1', JSON.stringify(recovery));
    }, { recovery: saved });
    let retryPayload = null;
    await retryContext.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/pos/capabilities')) return route.fulfill(json({ version: 2, merchantId: 'merchant-1', idempotentSales: true }));
      if (path.endsWith('/pos/products')) return route.fulfill(json([{ merchantProductId: 'offer-1', productId: 'product-1', name: 'Fixture milk', imageUrl: null, unit: 'pack', barcode: null, pricePaisa: 25000, stockQuantity: 4, isAvailable: true }]));
      if (path.endsWith('/pos/sales') && route.request().method() === 'POST') {
        retryPayload = route.request().postDataJSON();
        return route.fulfill(json({ message: retryStatus === 400 ? 'Saved sale was rejected without a write' : 'Temporary unknown error' }, retryStatus));
      }
      return route.fulfill(json({ message: `Unexpected POS retry fixture request: ${path}` }, 500));
    });
    const retryPage = await retryContext.newPage();
    await retryPage.goto(process.env.BROWSER_POS_URL);
    await retryPage.getByRole('button', { name: 'Retry saved request' }).click();
    assert.deepEqual(retryPayload, saved.payload, `POS saved ${retryStatus} retry uses exact persisted payload`);
    if (retryStatus === 400) {
      await retryPage.getByRole('button', { name: 'Review bill again' }).waitFor();
      assert.equal(await retryPage.evaluate(() => localStorage.getItem('sbp.saleRecovery.v1')), null, 'definitive POS 400 clears pending sale');
      await retryPage.getByRole('button', { name: 'Review bill again' }).click();
      await retryPage.getByRole('button', { name: /Fixture milk/ }).click();
      await retryPage.getByRole('button', { name: /Charge Rs/ }).waitFor();
      await retryPage.screenshot({ path: 'output/playwright/pos-definitive-rejection-review.png', fullPage: true });
    } else {
      await retryPage.getByText('The service is temporarily unavailable. Check the saved status before trying the action again.').waitFor();
      assert.equal((await retryPage.evaluate(() => JSON.parse(localStorage.getItem('sbp.saleRecovery.v1')))).payload.requestId, saved.payload.requestId, 'unknown POS retry error retains pending ID');
      await retryPage.getByRole('button', { name: 'Retry saved request' }).waitFor();
    }
    await retryContext.close();
  }
  console.log('PASS POS definitive saved retry rejection returns to bill review; unknown retry retains saved ID');

  const ipos = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ipos.addInitScript(() => {
    const token = `fixture.${btoa(JSON.stringify({ role: 'MERCHANT_OWNER' }))}.fixture`;
    localStorage.setItem('sbs.accessToken', token);
    localStorage.setItem('sbs.refreshToken', 'fixture-refresh');
    localStorage.setItem('sbs.user', JSON.stringify({ id: 'owner-1', fullName: 'Fixture Cashier', merchant: { id: 'merchant-1' } }));
  });
  await ipos.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/merchant/profile')) return route.fulfill(json({ id: 'merchant-1', shopName: 'Fixture Shop', isOwner: true, permissions: [], isOnline: true, isOpen: true, approvalStatus: 'APPROVED' }));
    if (path.endsWith('/pos/capabilities')) return route.fulfill(json({ version: 2, merchantId: 'merchant-1', idempotentSales: true, barcodeLookup: true }));
    if (path.endsWith('/pos/products')) return route.fulfill(json([{ merchantProductId: 'offer-1', productId: 'product-1', name: 'Fixture milk', unit: 'pack', barcode: null, pricePaisa: 25000, stockQuantity: 4, isAvailable: true }]));
    return route.fulfill(json({ message: `Unexpected iPOS fixture request: ${path}` }, 500));
  });
  const iposPage = await ipos.newPage();
  await iposPage.goto(`${process.env.BROWSER_SHOP_URL}/ipos`);
  await iposPage.locator('.ipos-product').filter({ hasText: 'Fixture milk' }).click();
  const toastRegion = iposPage.locator('[data-toast-host]');
  await visibleToast(iposPage).getByText(/Fixture milk added to the bill/).waitFor();
  assert.equal(await toastRegion.evaluate((node) => node.parentElement === document.body), true, 'normal toast portals to body');
  await iposPage.screenshot({ path: 'output/playwright/merchant-ipos-toast-normal.png', fullPage: true });
  await toastRegion.getByRole('button', { name: 'Dismiss notification' }).click();
  await iposPage.locator('#ipos-scan').focus();
  await iposPage.keyboard.press('F6');
  const shortcutState = await iposPage.locator('.ipos-nav').innerText();
  assert.match(shortcutState, /Held bills \(1\)/, 'existing F6 shortcut holds the bill while scanning');
  await visibleToast(iposPage).getByText('Bill held in this browser.').waitFor();
  assert.equal(await iposPage.locator('#ipos-scan').evaluate((node) => node === document.activeElement), true, 'hold toast leaves scanner input focused');
  await toastRegion.getByRole('button', { name: 'Dismiss notification' }).click();
  await iposPage.locator('.ipos-product').filter({ hasText: 'Fixture milk' }).click();
  await iposPage.getByRole('button', { name: /Discard bill/ }).first().click();
  const discardDialog = iposPage.getByRole('dialog', { name: 'Discard this unpaid bill?' });
  await discardDialog.waitFor();
  assert.equal(await toastRegion.evaluate((node) => node.parentElement?.tagName), 'DIALOG', 'toast region moves into active dialog');
  await toastRegion.getByRole('button', { name: 'Dismiss notification' }).click();
  await discardDialog.getByRole('button', { name: 'Discard unpaid bill' }).click();
  await visibleToast(iposPage).getByText('Unpaid bill discarded.').waitFor();
  await iposPage.screenshot({ path: 'output/playwright/merchant-ipos-toast-modal.png', fullPage: true });
  await toastRegion.getByRole('button', { name: 'Dismiss notification' }).click();
  const fullscreen = iposPage.getByRole('button', { name: 'Full screen' });
  await fullscreen.click();
  await iposPage.waitForFunction(() => ['browser', 'window'].includes(document.documentElement.dataset.iposFullscreen));
  const mode = await iposPage.evaluate(() => document.documentElement.dataset.iposFullscreen);
  assert.ok(mode === 'browser' || mode === 'window', 'iPOS enters native or fallback fullscreen');
  await iposPage.locator('.ipos-product').filter({ hasText: 'Fixture milk' }).click();
  await visibleToast(iposPage).getByText(/Fixture milk added to the bill/).waitFor();
  const fullscreenTarget = await toastRegion.evaluate((node) => ({ parent: node.parentElement?.tagName, insideFullscreen: !!document.fullscreenElement?.contains(node) }));
  if (mode === 'browser') assert.equal(fullscreenTarget.insideFullscreen, true, 'native fullscreen toast is inside fullscreen element');
  await iposPage.screenshot({ path: `output/playwright/merchant-ipos-toast-${mode}.png`, fullPage: true });
  await toastRegion.getByRole('button', { name: 'Dismiss notification' }).click();
  await iposPage.getByRole('button', { name: /Exit full screen/ }).click();
  await iposPage.waitForFunction(() => !document.documentElement.dataset.iposFullscreen);
  await iposPage.evaluate(() => Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false }));
  await iposPage.getByRole('button', { name: 'Full screen' }).click();
  await iposPage.waitForFunction(() => document.documentElement.dataset.iposFullscreen === 'window');
  await iposPage.locator('.ipos-product').filter({ hasText: 'Fixture milk' }).click();
  await visibleToast(iposPage).getByText(/Fixture milk added to the bill/).waitFor();
  await iposPage.screenshot({ path: 'output/playwright/merchant-ipos-toast-fallback.png', fullPage: true });
  assert.equal(await toastRegion.evaluate((node) => node.parentElement === document.body), true, 'fallback fullscreen toast portals to body');
  await iposPage.keyboard.press('Escape');
  await iposPage.waitForFunction(() => !document.documentElement.dataset.iposFullscreen);
  console.log('PASS iPOS add/hold/modal toasts, scanner focus, native and fallback fullscreen visibility');
  await ipos.close();

  const profile = await browser.newContext({ viewport: { width: 320, height: 720 }, geolocation: { latitude: 31.52123, longitude: 74.35987 }, permissions: ['geolocation'] });
  await profile.addInitScript(() => {
    const token = `fixture.${btoa(JSON.stringify({ role: 'MERCHANT_OWNER' }))}.fixture`;
    localStorage.setItem('sbs.accessToken', token);
    localStorage.setItem('sbs.refreshToken', 'fixture-refresh');
    localStorage.setItem('sbs.user', JSON.stringify({ id: 'owner-1', fullName: 'Fixture Merchant', merchant: { id: 'merchant-1' } }));
  });
  const profileFixture = { id: 'merchant-1', shopName: 'Fixture Shop', address: 'Fixture Market', city: 'Lahore', area: 'Center', phoneNumber: '03000000000', isOwner: true, permissions: [], isOnline: true, isOpen: true, approvalStatus: 'APPROVED', documents: [], minimumOrderValuePaisa: 0 };
  let profileSave = null;
  await profile.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/merchant/profile') && route.request().method() === 'GET') return route.fulfill(json(profileFixture));
    if (path.endsWith('/merchant/profile') && route.request().method() === 'PUT') {
      profileSave = route.request().postDataJSON();
      return route.fulfill(json({ message: 'Fixture shop save rejected' }, 400));
    }
    return route.fulfill(json({ message: `Unexpected profile fixture request: ${path}` }, 500));
  });
  await profile.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const profilePage = await profile.newPage();
  await profilePage.goto(`${process.env.BROWSER_SHOP_URL}/profile`);
  await profilePage.getByRole('button', { name: /Edit details/ }).click();
  const editShop = profilePage.getByRole('dialog', { name: 'Edit shop details' });
  const shopPinTrigger = editShop.getByRole('button', { name: 'Pin shop on map' });
  await shopPinTrigger.click();
  const shopMap = profilePage.getByRole('dialog', { name: 'Pin your shop entrance' });
  await shopMap.waitFor();
  assert.equal(await shopMap.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(90, rect.height / 3)));
  }), true, 'shop map must be visually topmost over native edit drawer');
  await profilePage.screenshot({ path: 'output/playwright/merchant-profile-map-320.png', fullPage: true });
  await profilePage.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await shopMap.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(90, rect.height / 3)));
  }), true, 'shop map also tops native edit drawer on desktop');
  await profilePage.screenshot({ path: 'output/playwright/merchant-profile-map-desktop.png', fullPage: true });
  await profilePage.setViewportSize({ width: 320, height: 720 });
  await profilePage.keyboard.press('Escape');
  await shopMap.waitFor({ state: 'hidden' });
  assert.equal(await editShop.isVisible(), true, 'Escape closes only shop map, not edit drawer');
  assert.equal(await shopPinTrigger.evaluate((node) => node === document.activeElement), true, 'shop map Escape restores edit pin focus');
  await shopPinTrigger.click();
  await shopMap.getByRole('button', { name: 'Use current location' }).click();
  await shopMap.getByRole('button', { name: 'Use this location' }).click();
  await shopMap.waitFor({ state: 'hidden' });
  assert.equal(await editShop.isVisible(), true, 'confirm keeps edit drawer open');
  assert.equal(await shopPinTrigger.evaluate((node) => node === document.activeElement), true, 'shop map confirm restores edit pin focus');
  const selectedToast = visibleToast(profilePage).getByText('Shop pin selected. Save changes to publish it.');
  await selectedToast.waitFor();
  assert.equal(await selectedToast.isVisible(), true, 'selected-pin toast is visible inside native edit drawer');
  assert.equal(profileSave, null, 'pin confirmation does not save merchant profile');
  await editShop.getByRole('button', { name: 'Dismiss notification' }).click();
  await editShop.getByRole('button', { name: 'Save changes' }).click();
  await editShop.getByRole('alert').getByText('Fixture shop save rejected').waitFor();
  assert.equal(profileSave.latitude, 31.52123, 'shop save attempts selected latitude');
  assert.equal(profileSave.longitude, 74.35987, 'shop save attempts selected longitude');
  assert.equal(await profilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'shop map/edit drawer reflow at 320px');
  await profilePage.screenshot({ path: 'output/playwright/merchant-profile-save-error-320.png', fullPage: true });
  console.log('PASS merchant Profile map tops native edit drawer, Escape/confirm focus, in-drawer toasts and 320px reflow');
  await profile.close();

  const shop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await shop.addInitScript(() => {
    const token = `fixture.${btoa(JSON.stringify({ role: 'MERCHANT_OWNER' }))}.fixture`;
    localStorage.setItem('sbs.accessToken', token);
    localStorage.setItem('sbs.refreshToken', 'fixture-refresh');
    localStorage.setItem('sbs.user', JSON.stringify({ id: 'owner-1', role: 'CUSTOMER', merchant: { id: 'merchant-1', name: 'Fixture Shop' } }));
  });
  const catalog = [
    { productId: 'product-rice', name: 'Fixture Basmati Rice', category: { name: 'Rice' }, unit: 'pack', alreadyListed: false },
    { productId: 'product-tea', name: 'Fixture Tea', category: { name: 'Tea' }, unit: 'pack', alreadyListed: false },
    { productId: 'product-listed', name: 'Already listed fixture', category: { name: 'Rice' }, unit: 'pack', alreadyListed: true },
  ];
  const uploads = [];
  let previewPayload;
  await shop.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return route.fulfill(json({ id: 'owner-1', merchant: { id: 'merchant-1', name: 'Fixture Shop' } }));
    if (path.endsWith('/products/categories')) return route.fulfill(json([{ id: 'grocery', name: 'Grocery', children: [{ id: 'rice', name: 'Rice' }, { id: 'tea', name: 'Tea' }] }]));
    if (path.endsWith('/merchant/catalog')) {
      const category = url.searchParams.get('categoryId');
      const query = url.searchParams.get('q')?.toLowerCase();
      const items = catalog.filter((item) => (!category || category === 'grocery' || item.category.name.toLowerCase() === category) && (!query || item.name.toLowerCase().includes(query)));
      return route.fulfill(json({ items, total: items.length, totalPages: 1 }));
    }
    if (path.endsWith('/merchant/products') && route.request().method() === 'GET') return route.fulfill(json({ items: [], total: 0, totalPages: 1 }));
    if (path.endsWith('/merchant/products/bulk-preview')) {
      previewPayload = route.request().postDataJSON();
      return route.fulfill(json({ previewToken: 'fixture-preview-token', rows: previewPayload.items.map((item) => ({ rowId: item.rowId, status: 'NEW' })) }));
    }
    if (path.endsWith('/merchant/products/bulk-upload')) {
      const payload = route.request().postDataJSON(); uploads.push(payload);
      return route.fulfill(json({ created: payload.items.length - 1, updated: 0, skipped: 0, failed: [{ rowId: payload.items.at(-1).rowId, error: 'Fixture row failure' }], rows: payload.items.map((item, index) => ({ rowId: item.rowId, status: index === payload.items.length - 1 ? 'FAILED' : 'CREATED', error: index === payload.items.length - 1 ? 'Fixture row failure' : undefined })) }));
    }
    return route.fulfill(json({ message: `Unexpected fixture request: ${path}` }, 500));
  });
  const shopPage = await shop.newPage();
  await shopPage.goto(`${process.env.BROWSER_SHOP_URL}/products`);
  await shopPage.getByRole('heading', { name: 'Products', exact: true }).waitFor();
  await shopPage.getByRole('button', { name: 'Expand Grocery' }).click();
  await shopPage.getByRole('button', { name: 'Rice', exact: true }).click();
  await shopPage.getByRole('checkbox', { name: 'Select loaded', exact: true }).check();
  assert.equal(await shopPage.getByRole('checkbox', { name: /^Select product:/ }).count(), 1);
  assert.equal(await shopPage.getByRole('checkbox', { name: /^Already in my shop:/ }).isDisabled(), true);
  await shopPage.getByRole('button', { name: 'Tea', exact: true }).click();
  await shopPage.locator('.catalog-product-name').getByText('Fixture Tea', { exact: true }).waitFor();
  await shopPage.locator('article.catalog-card').filter({ hasText: 'Fixture Tea' }).getByRole('checkbox', { name: /^Select product:/ }).check();
  await shopPage.getByRole('button', { name: 'Add 2 products to shop', exact: true }).waitFor();
  await shopPage.getByRole('button', { name: 'Grocery', exact: true }).click();
  const review = shopPage.getByRole('complementary', { name: 'Selected products' });
  await review.getByRole('heading', { name: 'Ready for your shop 2', exact: true }).waitFor();
  await review.getByLabel('Sale price (Rs) for Fixture Basmati Rice', { exact: true }).fill('650.25');
  await review.getByLabel('Stock quantity for Fixture Basmati Rice', { exact: true }).fill('5');
  await review.getByLabel('Sale price (Rs) for Fixture Tea', { exact: true }).fill('250');
  await review.getByLabel('Stock quantity for Fixture Tea', { exact: true }).fill('3');
  await shopPage.screenshot({ path: 'output/playwright/merchant-bulk-desktop.png', fullPage: true });
  await review.getByRole('button', { name: 'Add 2 products to shop', exact: true }).click();
  await review.getByText(/1 added/).waitFor();
  assert.equal(uploads[0].mode, 'ADD_MISSING');
  assert.equal(uploads[0].items.length, 2);
  assert.match(await review.innerText(), /Fixture row failure/);
  await review.getByRole('heading', { name: 'Ready for your shop 1', exact: true }).waitFor();
  await review.getByRole('button', { name: 'Retry same selection' }).click();
  assert.equal(uploads[1].requestId, uploads[0].requestId);
  await shopPage.setViewportSize({ width: 320, height: 720 });
  await shopPage.screenshot({ path: 'output/playwright/merchant-bulk-320.png', fullPage: true });
  assert.equal(await shopPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'merchant bulk selection must reflow at 320px');
  console.log('PASS merchant category selection persists across filters, partial upload retries the same ID, and 320px reflows');

  await shopPage.getByRole('button', { name: 'My shop listings' }).click();
  await shopPage.getByRole('button', { name: 'Import products' }).click();
  const importDialog = shopPage.getByRole('dialog', { name: 'Import products' });
  await importDialog.waitFor();
  assert.equal(await importDialog.evaluate((node) => node.contains(document.activeElement)), true, 'import modal receives keyboard focus');
  await shopPage.keyboard.press('Tab');
  assert.equal(await importDialog.evaluate((node) => node.contains(document.activeElement)), true, 'import modal contains Tab focus');
  await importDialog.getByLabel('Or paste CSV').fill('Item,Sale,Qty,SKU\n"Rice, Premium",120.50,7,00123');
  await importDialog.getByRole('button', { name: 'Map columns' }).click();
  await importDialog.getByLabel('Product name').selectOption({ label: 'Item' });
  await importDialog.getByLabel('Sale price (Rs)').selectOption({ label: 'Sale' });
  await importDialog.getByLabel('Stock quantity (units)').selectOption({ label: 'Qty' });
  await importDialog.getByLabel('Merchant SKU').selectOption({ label: 'SKU' });
  await importDialog.getByRole('button', { name: 'Preview changes' }).click();
  await importDialog.getByText(/1 new/).waitFor();
  assert.equal(previewPayload.mode, 'ADD_MISSING');
  assert.equal(previewPayload.items[0].name, 'Rice, Premium');
  assert.equal(previewPayload.items[0].merchantSku, '00123');
  assert.equal(previewPayload.items[0].pricePaisa, 12050);
  await shopPage.screenshot({ path: 'output/playwright/merchant-import-preview-320.png', fullPage: true });
  const importWidth = await shopPage.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  if (importWidth.page > importWidth.viewport) findings.push(`merchant import drawer overflows at 320px: ${importWidth.page}px document`);
  await importDialog.getByRole('button', { name: 'Confirm import' }).click();
  await importDialog.getByText(/failed/).first().waitFor();
  assert.equal(uploads.at(-1).previewToken, 'fixture-preview-token');
  console.log('PASS merchant CSV mapping preserves quoted names, SKU zeros and paisa, then explicitly confirms add-only import');
  await shop.close();

  const signup = await browser.newContext({ viewport: { width: 320, height: 720 } });
  let registrationStarted = false;
  await signup.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/merchant-register/start')) {
      registrationStarted = true;
      const payload = route.request().postDataJSON();
      assert.equal(payload.cnic, '00000-0000000-0');
      return route.fulfill(json({ attemptId: 'fixture-attempt', message: 'Fixture verification started; no message was sent.' }));
    }
    return route.fulfill(json({ message: `Unexpected signup fixture request: ${path}` }, 500));
  });
  const signupPage = await signup.newPage();
  await signupPage.goto(`${process.env.BROWSER_SHOP_URL}/sign-up`);
  await signupPage.getByLabel('First Name').fill('Test');
  await signupPage.getByLabel('Last Name').fill('Merchant');
  await signupPage.getByLabel('Mobile Number', { exact: true }).fill('03000000000');
  await signupPage.getByLabel(/National Identity Card/).fill('00000-0000000-0');
  await signupPage.getByLabel(/Account Security Password/).fill('Dummy12345');
  await signupPage.getByLabel(/I confirm that I am authorized/).check();
  await signupPage.getByRole('button', { name: /Continue to Shop Details/ }).click();
  await signupPage.getByLabel(/Shop Name/).fill('Fixture Shop');
  await signupPage.getByLabel(/Shop Contact Number/).fill('03000000000');
  await signupPage.getByLabel(/Physical Address/).fill('Fixture Street, Lahore');
  await signupPage.getByLabel('Latitude').fill('31.520370');
  await signupPage.getByLabel('Longitude').fill('74.358749');
  await signupPage.getByRole('button', { name: /Create Shop & Open Workspace/ }).click();
  const code = signupPage.getByLabel('Verification code');
  await code.waitFor();
  assert.equal(registrationStarted, true);
  assert.equal(await code.getAttribute('autocomplete'), 'one-time-code');
  await code.fill('123456');
  assert.equal(await code.inputValue(), '123456');
  const appearance = await code.evaluate((node) => { const style = getComputedStyle(node); return { background: style.backgroundColor, border: style.borderStyle, color: style.color, width: node.getBoundingClientRect().width }; });
  assert.notEqual(appearance.background, 'rgba(0, 0, 0, 0)');
  assert.notEqual(appearance.border, 'none');
  const contrast = (foreground, background) => {
    const luminance = (value) => {
      const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
        const unit = channel / 255;
        return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const levels = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (levels[0] + 0.05) / (levels[1] + 0.05);
  };
  assert.ok(contrast(appearance.color, appearance.background) >= 4.5, `OTP text contrast must reach 4.5:1; got ${appearance.color} on ${appearance.background}`);
  await signupPage.screenshot({ path: 'output/playwright/merchant-signup-otp-320.png', fullPage: true });
  assert.equal(await signupPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'signup OTP must reflow at 320px');
  console.log('PASS merchant signup OTP is labelled, accepts six digits, and has visible surface at 320px');
  await signup.close();

  const auth = await browser.newContext({ viewport: { width: 320, height: 720 } });
  let recoveryRequests = 0;
  await auth.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/merchant-login')) return route.fulfill(json({ message: 'Invalid credentials' }, 401));
    if (path.endsWith('/auth/merchant-password/request')) {
      assert.equal(route.request().postDataJSON().identifier, 'dummy@example.test');
      recoveryRequests++;
      return route.fulfill(json({ message: 'Fixture recovery code ready; no message was sent.' }));
    }
    return route.fulfill(json({ message: `Unexpected auth fixture request: ${path}` }, 500));
  });
  const authPage = await auth.newPage();
  await authPage.goto(`${process.env.BROWSER_SHOP_URL}/sign-in`);
  await authPage.getByLabel(/Email|Mobile Number/).first().fill('dummy@example.test');
  await authPage.getByLabel('Password', { exact: true }).fill('Dummy12345');
  await authPage.getByRole('button', { name: /Sign In|Sign in/ }).first().click();
  await authPage.getByText(/password is incorrect/i).waitFor();
  await authPage.getByRole('link', { name: 'Forgot password?' }).click();
  await authPage.getByLabel(/Registered Merchant Email/).fill('dummy@example.test');
  await authPage.getByRole('button', { name: 'Request Recovery Code' }).click();
  await authPage.getByRole('heading', { name: 'Enter verification code' }).waitFor();
  assert.equal(recoveryRequests, 1);
  await authPage.screenshot({ path: 'output/playwright/merchant-recovery-320.png', fullPage: true });
  assert.equal(await authPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'password recovery must reflow at 320px');
  console.log('PASS merchant sign-in API error and dummy password recovery request at 320px');
  await auth.close();
  for (const [fixture, url] of [
    ['./check-category-browser.cjs', process.env.BROWSER_SHOP_URL],
    ['./check-catalog-autoload-browser.cjs', process.env.BROWSER_SHOP_URL],
    ['./check-location-picker-browser.cjs', process.env.BROWSER_WEB_URL],
    ['./check-customer-feedback.cjs', process.env.BROWSER_WEB_URL],
    ['./check-shop-availability-browser.cjs', process.env.BROWSER_WEB_URL],
    ['./check-account-menu-browser.cjs', process.env.BROWSER_WEB_URL],
  ]) {
    const context = await browser.newContext(fixture.includes('location-picker') ? { hasTouch: true, isMobile: true } : {});
    try { console.log(await require(fixture)(await context.newPage(), url)); }
    finally { await context.close(); }
  }
  assert.deepEqual(findings, [], `Rendered browser findings: ${findings.join('; ')}`);
} finally {
  await browser.close();
}
