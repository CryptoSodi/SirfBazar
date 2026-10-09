const assert = require('node:assert/strict');
module.exports = async (page, baseUrl) => {
  const shop = { id: 'offline-shop', shopName: 'Offline Fixture Shop', city: 'Fixture city', isOnline: false, isOpen: true, minimumOrderValuePaisa: 25000 };
  const online = { ...shop, id: 'online-shop', shopName: 'Online Fixture Shop', isOnline: true };
  const closed = { ...online, id: 'closed-shop', shopName: 'Closed Fixture Shop', isOpen: false };
  let productReads = 0;
  const cart = { id: 'cart', itemCount: 2, groups: [{ merchant: shop, items: [{ id: 'item', productId: 'milk', name: 'Saved fixture milk', quantity: 2, inStock: true, stockQuantity: 5, totalPaisa: 20000 }], subtotalPaisa: 20000, deliveryFeePaisa: 0 }], subtotalPaisa: 20000, totalPaisa: 20000, serviceFeePaisa: 0 };
  await page.context().addInitScript(() => {
    localStorage.setItem('sb.location', JSON.stringify({ latitude: 0, longitude: 0, label: 'Fixture area' }));
    localStorage.setItem('sb.guestToken', 'fixture-only-guest');
  });
  await page.context().route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, '');
    assert.equal(route.request().method(), 'GET', 'availability fixture never places an order or changes a shop');
    let value = [];
    if (path === '/merchants/nearby') value = { items: [shop, online, closed], total: 3, totalPages: 1 };
    else if (path === '/merchants/offline-shop') value = shop;
    else if (path.endsWith('/products') && path.startsWith('/merchants/')) { productReads++; value = { items: [], total: 0 }; }
    else if (path.includes('/cart')) value = cart;
    else if (path.startsWith('/products/')) value = path.endsWith('/categories') ? [] : { items: [], total: 0, totalPages: 1 };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
  });
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) return route.fallback();
    return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
  });
  const ratios = [];
  for (const width of [1280, 320]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(baseUrl + '/search?type=shops');
    await page.getByText('Offline Fixture Shop', { exact: true }).waitFor();
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const disabled = page.locator('[data-shop-unavailable]');
    assert.equal(await disabled.count(), 2);
    assert.equal(await page.getByRole('link', { name: /Offline Fixture Shop|Closed Fixture Shop/ }).count(), 0);
    assert.equal(await page.getByRole('link', { name: /Online Fixture Shop/ }).count(), 1);
    assert.equal(await disabled.locator('a,button,[tabindex]').count(), 0);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('[data-shop-unavailable]')), false, 'keyboard navigation skips non-interactive shop cards');
    assert.match(await disabled.first().textContent(), /Offline.*Not accepting orders/);
    ratios.push(...await disabled.evaluateAll(nodes => {
      const l = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      return nodes.flatMap(card => [...card.querySelectorAll('strong,small')].map(text => {
        const a = l(getComputedStyle(text).color), b = l(getComputedStyle(card).backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      }));
    }));
    assert.ok(ratios.every(r => r >= 4.5), 'unavailable shop labels stay readable in both themes');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'shop directory reflows at 320px');
    await page.screenshot({ path: `output/playwright/shop-availability-${width}-${theme}.png`, fullPage: true });
  }
  // Browser zoom halves the CSS viewport; CSS `zoom` alone does not change
  // responsive media queries, so use the equivalent 640px viewport here.
  await page.setViewportSize({ width: 640, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'directory reflows at the 640px viewport equivalent of 1280px at 200% zoom');
  await page.goto(baseUrl + '/');
  await page.locator('.sb-home-shop[data-shop-unavailable]').first().waitFor();
  assert.equal(await page.locator('.sb-home-shop[data-shop-unavailable]').count(), 2);
  await page.goto(baseUrl + '/shop/offline-shop');
  await page.getByText('Offline · Not accepting orders', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /Add/ }).count(), 0);
  assert.equal(productReads, 0, 'offline direct shop page does not fetch inventory');
  shop.isOnline = true;
  await page.getByRole('button', { name: 'Check availability again' }).click();
  await page.getByText('On the shelves', { exact: true }).waitFor();
  shop.isOnline = false;
  await page.goto(baseUrl + '/cart');
  await page.getByText('Saved fixture milk', { exact: true }).waitFor();
  assert.equal(await page.getByText(/more from this shop to meet its minimum order/).count(), 0, 'do not encourage adding to an unavailable shop');
  assert.equal(await page.getByRole('button', { name: 'Add one Saved fixture milk', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Remove one Saved fixture milk', exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Remove', exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: /Continue to checkout/ }).isDisabled(), true);
  shop.isOnline = true;
  shop.minimumOrderValuePaisa = 0;
  await page.getByRole('button', { name: 'Check shop availability' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(n => n.textContent.includes('Continue to checkout'))?.disabled);
  return `PASS offline/closed directory cards, direct shop recovery, preserved basket and 320px/light/dark contrast (minimum ${Math.min(...ratios).toFixed(2)}:1)`;
};
