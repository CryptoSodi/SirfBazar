// Run with playwright-cli run-code --filename scripts/check-icons-browser.cjs.
// All API traffic is intercepted; this fixture never sends live requests.
async (page) => {
  const user = { id: 'icon-review-user', fullName: 'Icon Review', status: 'ACTIVE', merchant: { id: 'icon-review-shop' } };
  const profile = { id: 'icon-review-shop', shopName: 'Icon Review Shop', isOwner: true, permissions: ['POS'], isOnline: true, isOpen: true, approvalStatus: 'APPROVED' };
  await page.context().route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/merchant/profile')) data = profile;
    else if (path.endsWith('/pos/capabilities')) data = { version: 2, merchantId: profile.id, idempotentSales: true, barcodeLookup: true };
    else if (path.endsWith('/pos/products')) data = [{ merchantProductId: 'icon-review-milk', productId: 'milk', name: 'Fresh Milk', imageUrl: null, unit: '1 litre', barcode: '0123456789', pricePaisa: 32000, stockQuantity: 15, isAvailable: true }];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.context().route('**/socket.io/**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: '0{"sid":"icon-fixture","upgrades":[],"pingInterval":100000,"pingTimeout":100000}' }));
  await page.context().addInitScript(({ user }) => {
    localStorage.setItem('sbs.accessToken', 'fixture.' + btoa(JSON.stringify({ role: 'MERCHANT_OWNER', exp: 4102444800 })) + '.fixture');
    localStorage.setItem('sbs.user', JSON.stringify(user));
    localStorage.setItem('sirfbazar.merchant.theme', 'light');
  }, { user });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5188/ipos');
  await page.getByText('Fresh Milk', { exact: true }).waitFor();
  const claim = page.getByRole('button', { name: 'Use this tab', exact: true });
  if (await claim.isVisible()) await claim.click();
  await page.screenshot({ path: 'output/playwright/icons-ipos-light.png', fullPage: true });
  const icons = await page.locator('svg.lucide').count();
  if (icons < 15) throw new Error('Expected library icons in shell and POS');
  const unlabeled = await page.locator('button').evaluateAll(nodes => nodes.filter(n => n.querySelector('svg') && !n.textContent.trim() && !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby') && !n.getAttribute('title')).map(n => n.outerHTML));
  if (unlabeled.length) throw new Error('Unnamed icon buttons: ' + JSON.stringify(unlabeled));
  await page.getByRole('button', { name: 'Use dark appearance', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/icons-ipos-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).waitFor();
  // Finish the responsive sidebar's CSS transition before capturing pixels.
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
  await page.screenshot({ path: 'output/playwright/icons-ipos-390.png', fullPage: true });
  const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (overflow.scrollWidth > overflow.width + 1) throw new Error('Page overflow: ' + JSON.stringify(overflow));
  console.log(JSON.stringify({ icons, unnamedIconButtons: unlabeled.length, viewport: overflow, screenshots: 3 }));
}
