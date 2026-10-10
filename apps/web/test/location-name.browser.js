// Local-only playwright-cli run-code --filename fixture; no real API/geocoding requests.
async (page) => {
  const origin = new URL(page.url()).origin;
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw Error('Local preview required');
  const checks = [];
  const check = (ok, name) => { if (!ok) throw Error(name); checks.push(name); };
  const legacy = { latitude: 31.40981, longitude: 74.28032, label: 'Pinned location (31.40981, 74.28032)' };
  const requests = [];
  const mapRequests = [];
  await page.route('**/api/**', async route => {
    check(route.request().method() === 'GET', 'No API writes');
    requests.push(route.request().url());
    return route.fulfill({ status: 200, json: [], headers: { 'access-control-allow-origin': origin } });
  });
  await page.route('https://tile.openstreetmap.org/**', route => { mapRequests.push(route.request().url()); return route.abort(); });
  await page.route('https://maps.googleapis.com/**', route => route.abort());
  await page.addInitScript(legacy => {
    if (!localStorage.getItem('sb.location')) localStorage.setItem('sb.location', JSON.stringify(legacy));
    localStorage.setItem('sb.theme', 'light');
    window.__geocodes = [];
    window.google = { maps: { version: 'fixture', Geocoder: class {
      geocode(request) { return new Promise((resolve, reject) => window.__geocodes.push({ request, resolve, reject })); }
    } } };
  }, legacy);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => localStorage.removeItem('sb.location'));
  await page.goto(origin);
  const trigger = page.locator('.sb-site-location');
  await page.waitForFunction(() => window.__geocodes.length === 1);
  check(await trigger.getAttribute('title') === 'Pinned location', 'Legacy coordinate label is not shown as an address');
  check(JSON.stringify(await page.evaluate(() => window.__geocodes[0].request.location)) === JSON.stringify({ lat: legacy.latitude, lng: legacy.longitude }), 'Lookup uses exact pin');
  await page.evaluate(() => window.__geocodes[0].resolve({ results: [{ formatted_address: 'Nasheman Iqbal Phase 2, Lahore, Pakistan', types: ['neighborhood'] }] }));
  await page.waitForFunction(() => document.querySelector('.sb-site-location').title.includes('Nasheman'));
  check(await trigger.getByText('Google Maps', { exact: true }).isVisible(), 'Resolved address has attribution');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('sb.location')).label) === legacy.label, 'Google address is display-only, not persisted');
  const colourChecks = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const state = await trigger.evaluate(node => {
        const text = node.querySelector('small');
        const style = getComputedStyle(text);
        let ancestor = text;
        while (ancestor && getComputedStyle(ancestor).backgroundColor === 'rgba(0, 0, 0, 0)') ancestor = ancestor.parentElement;
        const background = getComputedStyle(ancestor).backgroundColor;
        const luminance = colour => {
          const v = colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
          return v[0] * .2126 + v[1] * .7152 + v[2] * .0722;
        };
        const a = luminance(style.color), b = luminance(background);
        return { overflow: document.documentElement.scrollWidth > innerWidth, font: style.fontSize, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), fg: style.color, bg: background, attributionFits: text.scrollWidth <= text.clientWidth };
      });
      check(!state.overflow && state.attributionFits && state.font === '12px' && state.ratio >= 4.5, `${theme} ${width}: header reflow and attribution contrast`);
      colourChecks.push({ theme, width, ...state });
    }
    await page.screenshot({ path: `output/playwright/location-name-${theme}-1440.png` });
  }
  await trigger.click();
  const picker = page.getByRole('dialog', { name: 'Choose your location', exact: true });
  const name = picker.getByRole('textbox', { name: 'Area or address name (optional)' });
  await name.fill('Plot 72, Nasheman Iqbal Phase 2');
  check(await name.evaluate(node => getComputedStyle(node).fontSize) === '16px', 'Address field avoids mobile input zoom');
  await page.setViewportSize({ width: 320, height: 720 });
  await name.focus();
  check(await name.evaluate(node => getComputedStyle(node).outlineStyle !== 'none'), 'Address field has visible focus');
  check(await picker.evaluate(node => node.scrollWidth <= node.clientWidth), 'Picker has no horizontal overflow at 320');
  await name.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/location-name-picker-320.png' });
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  check(await trigger.getAttribute('title') === 'Plot 72, Nasheman Iqbal Phase 2', 'Manual plot name updates immediately');
  check(await trigger.evaluate(node => node === document.activeElement), 'Confirmation restores trigger focus');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sb.location')));
  check(saved.latitude === legacy.latitude && saved.longitude === legacy.longitude, 'Naming preserves exact coordinates');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.sb-site-location').title.startsWith('Plot 72'));
  check(await page.evaluate(() => window.__geocodes.length) === 0, 'Manual name survives reload without geocoding');
  await trigger.click();
  await name.waitFor();
  check(await name.inputValue() === saved.label, 'Picker restores saved manual name');
  const map = picker.locator('.sb-location-map');
  await map.waitFor();
  check(await map.locator('.leaflet-container').count() === 0, 'Customer area picker does not render Leaflet');
  check(mapRequests.length === 0, 'Customer area picker does not request OpenStreetMap tiles');
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  check(await trigger.getAttribute('title') === 'Plot 72, Nasheman Iqbal Phase 2', 'Google map availability does not block named location confirmation');
  await trigger.click(); await name.fill('');
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => window.__geocodes.length === 1);
  await page.evaluate(() => window.__geocodes[0].reject(Error('Fixture API refusal')));
  check(await trigger.getAttribute('title') === 'Pinned location', 'Lookup failure leaves a usable picker');
  await trigger.click(); await name.fill('Plot 73, Lahore');
  await picker.getByRole('button', { name: 'Confirm this location', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__geocodes[1]?.resolve({ results: [{ formatted_address: 'Obsolete lookup result', types: ['route'] }] }));
  check(await trigger.getAttribute('title') === 'Plot 73, Lahore', 'Late lookup cannot overwrite a newer manual name');
  check(requests.every(url => !url.includes('/location/detect')), 'Never borrows the nearest merchant district');
  await page.screenshot({ path: 'output/playwright/location-name-saved-320.png' });
  return { result: 'PASS', checks: checks.length, colourChecks };
}
