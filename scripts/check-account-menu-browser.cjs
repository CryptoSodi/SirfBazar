const assert = require('node:assert/strict');

module.exports = async function checkAccountMenu(page, baseUrl) {
  const base = new URL(baseUrl);
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/api/')) {
      assert.equal(route.request().method(), 'GET', 'Account navigation must not send OTP or cart writes');
      const data = url.pathname.endsWith('/products/categories') ? []
        : url.pathname.endsWith('/cart') ? { id: 'fixture-cart', itemCount: 0, groups: [] }
        : { items: [], total: 0, page: 1, totalPages: 0 };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    }
    return url.origin === base.origin ? route.continue() : route.abort();
  });
  let minimumContrast = Infinity;
  for (const width of [1280, 900, 761, 640, 320]) {
    await page.setViewportSize({ width, height: 820 });
    for (const theme of ['light', 'dark']) {
      await page.goto(baseUrl + '/search');
      await page.getByRole('heading', { name: 'Find your everyday essentials' }).waitFor();
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      const mobile = width <= 760;
      const trigger = page.getByLabel(mobile ? 'You: sign up or sign in' : 'Account: sign up or sign in', { exact: true });
      await trigger.focus();
      assert.notEqual(await trigger.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      await page.keyboard.press('Enter');
      const panel = page.getByRole('navigation', { name: 'Account options' });
      await panel.getByRole('link', { name: 'Sign up or sign in', exact: true }).waitFor();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Sign up or sign in');
      const geometry = await panel.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
      });
      assert.ok(geometry.left >= 0 && geometry.right <= geometry.width && geometry.top >= 0 && geometry.bottom <= geometry.height, JSON.stringify(geometry));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const contrast = await panel.evaluate(node => {
        const luminance = value => {
          const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        return [...node.querySelectorAll('strong,p,a')].map(child => {
          const style = getComputedStyle(child);
          const background = child.tagName === 'A' ? style.backgroundColor : getComputedStyle(node).backgroundColor;
          const levels = [luminance(style.color), luminance(background)].sort((a,b) => b-a);
          return (levels[0] + .05) / (levels[1] + .05);
        });
      });
      minimumContrast = Math.min(minimumContrast, ...contrast);
      assert.ok(Math.min(...contrast) >= 4.5);
      if ([1280, 320].includes(width)) await page.screenshot({ path: `output/playwright/account-menu-${width}-${theme}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
      await panel.waitFor({ state: 'hidden' });
      await trigger.click();
      await page.getByRole('heading', { name: 'Find your everyday essentials' }).click();
      await panel.waitFor({ state: 'hidden' });
    }
  }
  const trigger = page.getByLabel('You: sign up or sign in', { exact: true });
  await trigger.click();
  await page.getByRole('navigation', { name: 'Account options' }).getByRole('link', { name: 'Sign up or sign in' }).click();
  await page.getByRole('dialog', { name: 'Sign in or create an account' }).waitFor();
  await page.getByLabel('Phone number', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.goto(baseUrl + '/search');
  await page.getByLabel('You: sign up or sign in', { exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('sb.accessToken', 'fixture-access');
    localStorage.setItem('sb.user', JSON.stringify({ id: 'fixture-customer' }));
    window.dispatchEvent(new Event('sb:auth'));
  });
  const signedIn = page.getByLabel('You: your profile and orders', { exact: true });
  await signedIn.waitFor();
  assert.equal(await page.locator('details.sb-account-menu[open]').count(), 0, 'Auth changes close stale options');
  await signedIn.click();
  const panel = page.getByRole('navigation', { name: 'Account options' });
  assert.equal(await panel.getByRole('link', { name: 'Sign up or sign in' }).count(), 0);
  assert.equal(await panel.getByRole('link', { name: 'View your profile' }).getAttribute('href'), '/profile');
  assert.equal(await panel.getByRole('link', { name: 'View your orders' }).getAttribute('href'), '/orders');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const bounds = await panel.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
  await page.evaluate(() => {
    document.documentElement.dir = 'ltr';
    // Stale cached profile data without a login session must still show the guest entry.
    localStorage.removeItem('sb.accessToken');
    window.dispatchEvent(new Event('sb:auth'));
  });
  await page.getByLabel('You: sign up or sign in', { exact: true }).waitFor();
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.evaluate(() => { localStorage.setItem('sb.accessToken', 'fixture-access'); window.dispatchEvent(new Event('sb:auth')); });
  await page.getByLabel('Account: your profile and orders', { exact: true }).click();
  await page.getByRole('navigation', { name: 'Account options' }).getByRole('link', { name: 'View your profile' }).waitFor();
  // Expired/revoked sessions publish the canonical event without sb:auth.
  await page.evaluate(() => {
    localStorage.setItem('sb.session', JSON.stringify({ access: null, refresh: null, user: null, epoch: 'expired', identity: '' }));
    localStorage.removeItem('sb.accessToken');
    localStorage.removeItem('sb.user');
    window.dispatchEvent(new Event('sb:session'));
  });
  await page.getByLabel('Account: sign up or sign in', { exact: true }).waitFor();
  assert.equal(await page.locator('details.sb-account-menu[open]').count(), 0, 'Session expiry closes stale signed-in options');
  const otherTab = await page.context().newPage();
  try {
    await otherTab.goto(baseUrl + '/search');
    await otherTab.getByRole('heading', { name: 'Find your everyday essentials' }).waitFor();
    await otherTab.evaluate(() => {
      localStorage.setItem('sb.session', JSON.stringify({ access: 'fixture-access', refresh: 'fixture-refresh', user: { id: 'fixture-customer' }, epoch: 'other-tab', identity: 'fixture-customer::' }));
      localStorage.setItem('sb.accessToken', 'fixture-access');
      localStorage.setItem('sb.user', JSON.stringify({ id: 'fixture-customer' }));
    });
    await page.getByLabel('Account: your profile and orders', { exact: true }).waitFor();
    await page.getByLabel('Account: your profile and orders', { exact: true }).click();
    await otherTab.evaluate(() => {
      localStorage.setItem('sb.session', JSON.stringify({ access: null, refresh: null, user: null, epoch: 'other-tab-logout', identity: '' }));
      localStorage.removeItem('sb.accessToken');
      localStorage.removeItem('sb.user');
    });
    await page.getByLabel('Account: sign up or sign in', { exact: true }).waitFor();
    assert.equal(await page.locator('details.sb-account-menu[open]').count(), 0, 'Cross-tab logout closes stale signed-in options');
  } finally { await otherTab.close(); }
  return `PASS account navbar/mobile guest entry, existing login flow, signed-in/auth-switch/session-expiry/cross-tab state, keyboard/Escape/outside close, five responsive widths, RTL and light/dark; minimum text contrast ${minimumContrast.toFixed(2)}:1`;
};
