const assert = require('node:assert/strict');

module.exports = async (page, baseUrl) => {
  const original = { latitude: 31.5204, longitude: 74.3587, label: 'Original fixture area' };
  const lookups = [];
  const nearby = [];
  await page.context().addInitScript(({ original }) => {
    localStorage.setItem('sb.location', JSON.stringify(original));
    navigator.geolocation.getCurrentPosition = (success, failure, options) => {
      window.__fixtureGps = { success, failure, options };
    };
  }, { original });
  await page.context().route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/location/detect')) {
      lookups.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ serviceable: true, area: 'Merchant district', city: 'Fixture city' }) });
    }
    if (url.pathname.endsWith('/merchants/nearby')) nearby.push(Object.fromEntries(url.searchParams));
    if (route.request().method() !== 'GET') throw Error('Unexpected mutation in location fixture');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.context().route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(baseUrl + '/');
  const trigger = page.locator('.sb-site-location');
  await trigger.click();
  const picker = page.getByRole('dialog', { name: 'Choose your location', exact: true });
  const map = picker.locator('.sb-location-map-canvas');
  const waitForMapState = async () => page.waitForFunction(() =>
    Boolean(document.querySelector('.sb-location-map-canvas .gm-style')) ||
    Boolean(document.querySelector('.sb-location-map-unavailable')?.textContent?.startsWith('Google Maps is not configured')) ||
    Boolean(document.querySelector('.sb-location-map-unavailable')?.textContent?.startsWith('Google Maps could not load')),
  );
  const checkContrast = async () => {
    const ratios = await picker.evaluate(root => {
      const luminance = color => {
        const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      return [...root.querySelectorAll('.sb-area-picker-copy,.sb-area-picker-coordinates,h2,h3,button.btn-primary,button.btn-secondary')].map(node => {
        const style = getComputedStyle(node);
        const bg = style.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(root).backgroundColor : style.backgroundColor;
        const a = luminance(style.color), b = luminance(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    });
    assert.ok(ratios.every(ratio => ratio >= 4.5), 'picker text and controls meet 4.5:1 contrast');
  };
  await waitForMapState();
  assert.equal(await picker.locator('.leaflet-container').count(), 0, 'location picker must not render a Leaflet fallback');
  const mapAvailable = await map.locator('.gm-style').count() > 0;
  await checkContrast();
  await picker.getByText(/^(Map centre|Selected): 31\.52040, 74\.35870$/).waitFor();
  await picker.getByRole('heading', { name: 'Pick my area', exact: true }).waitFor();
  await picker.getByRole('button', { name: 'Use my current location', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.__fixtureGps.options), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  let match;
  if (mapAvailable) {
    await map.locator('.gm-style').click({ position: { x: 250, y: 80 } });
    const pinText = await picker.locator('.sb-area-picker-coordinates').textContent();
    match = pinText.match(/Selected: (-?\d+\.\d+), (-?\d+\.\d+)/);
    assert.ok(match, 'a pointer-selected Google Maps point has visible coordinates');
    await page.evaluate(() => window.__fixtureGps.success({ coords: { latitude: 32.1, longitude: 75.1 } }));
    assert.equal(await picker.locator('.sb-area-picker-coordinates').textContent(), pinText, 'late GPS must not replace a newer manually selected pin');
  } else {
    await page.evaluate(() => window.__fixtureGps.success({ coords: { latitude: 32.1, longitude: 75.1 } }));
    await picker.getByText('Selected: 32.10000, 75.10000', { exact: true }).waitFor();
    match = ['Selected: 32.10000, 75.10000', '32.10000', '75.10000'];
    assert.equal(await picker.locator('.sb-location-map-unavailable').isVisible(), true, 'missing Google Maps configuration is explained without a different map provider');
  }
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  await page.locator('[data-toast-host] > div').last().getByText('Location updated. Nearby shops will refresh for this pin.').waitFor();
  await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sb.location')));
  assert.equal(saved.latitude.toFixed(5), match[1]);
  assert.equal(saved.longitude.toFixed(5), match[2]);
  assert.equal(lookups.length, 0, 'confirming an exact pin must not wait for a merchant-area lookup or use a shop area as the customer location');
  assert.ok(nearby.some(query => Number(query.latitude) === saved.latitude && Number(query.longitude) === saved.longitude), 'nearby shops must refresh using the newly confirmed coordinates');
  await trigger.getByText(/Pinned location/).waitFor();
  await trigger.click();
  await waitForMapState();
  await picker.getByText(`Selected: ${saved.latitude.toFixed(5)}, ${saved.longitude.toFixed(5)}`, { exact: true }).waitFor();
  await picker.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await page.evaluate(() => window.__fixtureGps.success({ coords: { latitude: 31.61, longitude: 74.41 } }));
  await picker.getByText('Selected: 31.61000, 74.41000', { exact: true }).waitFor();
  if (mapAvailable) {
    await map.locator('.gm-style').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => !document.querySelector('.sb-area-picker-coordinates').textContent.includes('74.41000'));
  }
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'picker restores its header trigger');
  await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
  const beforeStorageFailure = await page.evaluate(() => localStorage.getItem('sb.location'));
  await trigger.click(); await waitForMapState();
  await picker.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await page.evaluate(() => window.__fixtureGps.success({ coords: { latitude: 31.62, longitude: 74.42 } }));
  await picker.getByText('Selected: 31.62000, 74.42000', { exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.evaluate(() => {
    window.__fixtureStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'sb.location') throw new DOMException('Fixture storage failure', 'QuotaExceededError');
      return window.__fixtureStorageSet.call(this, key, value);
    };
  });
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.getByText(/Unable to save this location/).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('sb.location')), beforeStorageFailure, 'failed saving must retain the prior confirmed location');
  assert.equal(await picker.isVisible(), true);
  const errorBounds = await picker.locator('[data-toast-host] > div').last().boundingBox();
  const retryBounds = await picker.getByRole('button', { name: 'Confirm this location', exact: true }).boundingBox();
  assert.ok(errorBounds.y + errorBounds.height <= retryBounds.y, 'error feedback must not cover the mobile retry action');
  await page.screenshot({ path: 'output/playwright/location-save-error-320.png' });
  await page.evaluate(() => { Storage.prototype.setItem = window.__fixtureStorageSet; });
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('sb.location')))).latitude, 31.62);
  await page.locator('[data-toast-host] > div').last().getByText('Location updated. Nearby shops will refresh for this pin.').waitFor();
  assert.equal(await page.getByText(/Unable to save this location/).count(), 0, 'successful retry replaces its error without requiring manual dismissal');
  await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 720 });
  await trigger.click(); await waitForMapState();
  await checkContrast();
  assert.equal(await picker.evaluate(node => node.scrollWidth <= node.clientWidth), true);
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).scrollIntoViewIfNeeded();
  const confirmBounds = await picker.getByRole('button', { name: 'Confirm this location', exact: true }).boundingBox();
  assert.ok(confirmBounds.y >= 0 && confirmBounds.y + confirmBounds.height <= 720, 'confirmation stays within the mobile viewport');
  await page.screenshot({ path: 'output/playwright/location-map-320.png', fullPage: true });
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    const selectedOnMobile = await picker.locator('.sb-area-picker-coordinates').textContent();
    await picker.getByRole('button', { name: 'Confirm this location', exact: true }).tap();
    await picker.waitFor({ state: 'hidden' });
    const savedOnMobile = await page.evaluate(() => JSON.parse(localStorage.getItem('sb.location')));
    assert.equal(selectedOnMobile, `Selected: ${savedOnMobile.latitude.toFixed(5)}, ${savedOnMobile.longitude.toFixed(5)}`);
    await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
  await trigger.tap(); await waitForMapState();
  }
  await page.keyboard.press('Escape'); await picker.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await trigger.click(); await waitForMapState();
  await checkContrast();
  assert.equal(await picker.evaluate(node => node.scrollWidth <= node.clientWidth), true);
  await picker.evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: 'output/playwright/location-map-dark-320.png', fullPage: true });
  await page.keyboard.press('Escape'); await picker.waitFor({ state: 'hidden' });
  return `PASS Google Maps location picker: ${mapAvailable ? 'map pin interaction' : 'explicit unavailable guidance and GPS fallback'}, immediate exact confirmation, nearby refresh, storage failure/retry, saved pin, fresh GPS, focus, dark mode and 320px reflow`;
};
