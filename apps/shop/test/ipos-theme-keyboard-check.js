// Read-only layout/keyboard checks after loading the mocked browser fixture.
async (page) => {
  await page.keyboard.press('Escape');
  const results = [];
  const check = (ok, message) => { if (!ok) throw Error(message); results.push(message); };
  await page.getByRole('button', { name: 'Theme Studio', exact: true }).click();
  await page.getByRole('group', { name: 'Appearance', exact: true }).getByRole('button', { name: 'dark', exact: true }).click();
  await page.getByRole('button', { name: 'Close Theme Studio', exact: true }).click();
  check(await page.locator('.ipos-workspace').evaluate(el => getComputedStyle(el).backgroundColor === 'rgb(194, 214, 232)'), 'Classic keeps its fixed blue palette in a dark dashboard');
  await page.getByRole('button', { name: /^Classic appearance/ }).click();
  check(await page.evaluate(() => document.documentElement.dataset.sbMode === 'dark'), 'Modern keeps the dashboard dark preference');
  await page.screenshot({ path: 'output/playwright/ipos-modern-dark-reviewed.png', fullPage: true });
  const contrast = await page.evaluate(() => {
    const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = c => c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    return ['.ipos-heading h1', '.ipos-muted', '.ipos-command-grid .ops-button', '.ipos-totals .ops-button', '.ipos-nav [aria-pressed="true"]'].map(selector => {
      const el = document.querySelector(selector); let bg = [255, 255, 255];
      for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] === 1) { bg = c; break; } }
      const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg);
      return { selector, ratio: Number(((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2)) };
    });
  });
  check(contrast.every(pair => pair.ratio >= 4.5), 'Sampled dark Modern text pairs meet 4.5:1');
  await page.setViewportSize({ width: 320, height: 844 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Dark Modern reflows at 320px');
  await page.getByRole('button', { name: /^Classic appearance/ }).click();
  await page.keyboard.press('F4');
  check(await page.getByRole('textbox', { name: /^Barcode \/ shop SKU/ }).evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'), 'Keyboard-focused scanner has a visible outline');
  check(await page.getByRole('columnheader', { name: 'Description', exact: true }).count() === 1, 'Reflowed Classic table retains accessible column headers');
  await page.keyboard.press('F11');
  const dialog = page.getByRole('dialog', { name: 'Change bill quantity', exact: true });
  await dialog.waitFor();
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Quantity dialog fits a 320px screen');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    check(await dialog.evaluate(el => document.activeElement === document.body || el.contains(document.activeElement)), 'Tab does not focus background controls through the modal');
  }
  await page.keyboard.press('Escape');
  check(await page.getByRole('dialog').count() === 0, 'Escape closes quantity without changing it');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Theme Studio', exact: true }).click();
  await page.getByRole('group', { name: 'Appearance', exact: true }).getByRole('button', { name: 'light', exact: true }).click();
  await page.getByRole('button', { name: 'Close Theme Studio', exact: true }).click();
  return { results, contrast };
}
