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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ serviceable: false }) });
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
  const map = picker.locator('.leaflet-container');
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
  await map.waitFor();
  await checkContrast();
  await picker.getByText(/^(Map centre|Selected): 31\.52040, 74\.35870$/).waitFor();
  await picker.getByRole('heading', { name: 'Pick my area', exact: true }).waitFor();
  await picker.getByRole('button', { name: 'Use my current location', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.__fixtureGps.options), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  await map.click({ position: { x: 250, y: 80 } });
  const pinText = await picker.locator('.sb-area-picker-coordinates').textContent();
  const match = pinText.match(/Selected: (-?\d+\.\d+), (-?\d+\.\d+)/);
  assert.ok(match, 'a pointer-selected point has visible coordinates');
  await page.evaluate(() => window.__fixtureGps.success({ coords: { latitude: 32.1, longitude: 75.1 } }));
  assert.equal(await picker.locator('.sb-area-picker-coordinates').textContent(), pinText, 'late GPS must not replace a newer manually selected pin');
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sb.location')));
  assert.equal(saved.latitude.toFixed(5), match[1]);
  assert.equal(saved.longitude.toFixed(5), match[2]);
  assert.deepEqual(lookups.at(-1), { latitude: saved.latitude, longitude: saved.longitude });
  await trigger.getByText(/Pinned location/).waitFor();
  await trigger.click();
  await map.waitFor();
  await picker.getByText(`Selected: ${saved.latitude.toFixed(5)}, ${saved.longitude.toFixed(5)}`, { exact: true }).waitFor();
  await picker.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await page.evaluate(() => window.__fixtureGps.success({ coords: { latitude: 31.61, longitude: 74.41 } }));
  await picker.getByText('Selected: 31.61000, 74.41000', { exact: true }).waitFor();
  await map.focus(); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !document.querySelector('.sb-area-picker-coordinates').textContent.includes('74.41000'));
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'picker restores its header trigger');
  await page.setViewportSize({ width: 320, height: 720 });
  await trigger.click(); await map.waitFor();
  await checkContrast();
  assert.equal(await picker.evaluate(node => node.scrollWidth <= node.clientWidth), true);
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/location-map-320.png', fullPage: true });
  await page.keyboard.press('Escape'); await picker.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await trigger.click(); await map.waitFor();
  await checkContrast();
  assert.equal(await picker.evaluate(node => node.scrollWidth <= node.clientWidth), true);
  await picker.evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: 'output/playwright/location-map-dark-320.png', fullPage: true });
  await page.keyboard.press('Escape'); await picker.waitFor({ state: 'hidden' });
  return 'PASS inline area map: saved pin, click coordinates, fresh GPS, late-GPS fence, exact confirmation, keyboard pan, reopen, Escape/focus and 320px reflow';
};
