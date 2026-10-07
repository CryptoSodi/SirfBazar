// Run after the mocked fixture and ipos-classic-browser-check.js. Never uses real business data.
async (page) => {
  const results = [];
  const check = (ok, message) => { if (!ok) throw Error(message); results.push(message); };
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('sb.ipos.v1:ipos-test-shop:ipos-test-cashier')));
  const stats = () => page.evaluate(async () => { const response = await fetch('/api/__fixture/stats'); if (!response.ok) throw Error('Mock fixture required'); return response.json(); });
  const beforeSales = (await stats()).sales;
  check(Number.isInteger(beforeSales), 'Mock fixture confirmed before financial checks');
  await page.reload();
  await page.getByRole('button', { name: /^Classic appearance/ }).waitFor();
  const layout = [];
  const contrast = [];
  for (const appearance of ['classic', 'modern']) {
    if ((await state()).settings.appearance !== appearance) await page.getByRole('button', { name: /^Classic appearance/ }).click();
    for (const width of [320, 720, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, caption: document.querySelector('.ipos-classic-table caption')?.getBoundingClientRect().width }));
      check(dimensions.scroll <= dimensions.width, `${appearance} register has no document overflow at ${width}px`);
      if (appearance === 'classic' && width === 320) check(dimensions.caption > 200, 'Narrow Classic caption spans the bill width');
      layout.push({ appearance, ...dimensions });
      if (width === 320) await page.screenshot({ path: `output/playwright/ipos-${appearance}-mobile-reviewed.png`, fullPage: true });
    }
    contrast.push(...await page.evaluate((appearance) => {
      const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const luminance = (color) => color.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
      const background = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] === 1) return c; } return [255, 255, 255]; };
      return ['.ipos-heading h1', '.ipos-heading p', '.ipos-muted', '.ipos-nav [aria-pressed="true"]', '.ipos-totals strong', '.ipos-totals .ops-button', '.ipos-command-grid .ops-button', '.ipos-classic-table small'].flatMap(selector => {
        const el = document.querySelector(selector); if (!el) return [];
        const style = getComputedStyle(el), foreground = rgb(style.color), bg = background(el);
        const a = luminance(foreground), b = luminance(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        return [{ appearance, selector, foreground: style.color, background: bg, ratio: Number(ratio.toFixed(2)) }];
      });
    }, appearance));
  }
  check(contrast.every(pair => pair.ratio >= 4.5), 'Sampled normal-size text pairs meet 4.5:1 in both appearances');
  await page.evaluate(() => fetch('/api/__fixture/drop-next'));
  await page.locator('.ipos-totals').getByRole('button', { name: /^Take payment/ }).click();
  await page.getByRole('textbox', { name: 'Cash received', exact: true }).fill('500');
  await page.getByRole('button', { name: 'Complete cash sale', exact: true }).click();
  await page.getByRole('button', { name: 'Close and check saved sale', exact: true }).click();
  const pending = await state();
  check(!!pending.pending, 'Lost response leaves a saved pending request');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /^Classic appearance/ }).click();
    const current = await state();
    check(JSON.stringify(current.pending) === JSON.stringify(pending.pending) && JSON.stringify(current.draft) === JSON.stringify(pending.draft), 'Appearance change preserves unresolved request and bill');
  }
  for (const key of ['F2', 'F6', 'F10', 'Alt+z']) await page.keyboard.press(key);
  check(await page.getByRole('dialog').count() === 0, 'Mapped keys cannot open actions while sale is unresolved');
  check(JSON.stringify((await state()).draft) === JSON.stringify(pending.draft), 'Pending bill remains frozen after shortcut attempts');
  await page.getByRole('button', { name: 'Check saved sale', exact: true }).click();
  await page.getByRole('dialog', { name: 'Saved sale receipt' }).waitFor();
  check((await state()).pending === null && (await stats()).sales === beforeSales + 1, 'Recovery finds the original sale without another charge');
  await page.getByRole('button', { name: 'Back to counter', exact: true }).click();
  const nav = (label) => page.getByRole('navigation', { name: 'iPOS workspace' }).getByRole('button', { name: label, exact: true });
  await nav('POS settings').click();
  await page.getByRole('button', { name: 'Keyboard commands', exact: true }).click();
  await page.getByRole('combobox', { name: /^Keyboard profile/ }).selectOption('website');
  await page.getByRole('button', { name: /^Save preferences/ }).click();
  for (const width of [320, 720, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Keyboard settings reflow at ${width}px`);
  }
  await nav('Register').click();
  await page.route('**/pos/products/lookup?*', async route => { await new Promise(resolve => setTimeout(resolve, 300)); await route.fallback(); });
  await page.keyboard.press('F7');
  await page.getByRole('textbox', { name: 'Whole-unit quantity', exact: true }).fill('3');
  await page.getByRole('button', { name: 'Apply quantity', exact: true }).click();
  const scanner = page.getByRole('textbox', { name: /^Barcode \/ shop SKU/ });
  for (const code of ['NO-MATCH', '0012345', '0123456']) { await scanner.fill(code); await page.keyboard.press('Enter'); }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sb.ipos.v1:ipos-test-shop:ipos-test-cashier')).draft.lines.length === 2);
  const lines = (await state()).draft.lines;
  check(lines.find(l => l.product.merchantProductId === 'milk').quantity === 3 && lines.find(l => l.product.merchantProductId === 'eggs').quantity === 1, 'Failed lookup retains multiplier; rapid queued scans consume it only once');
  await page.unroute('**/pos/products/lookup?*');
  if ((await state()).settings.appearance !== 'classic') await page.getByRole('button', { name: /^Classic appearance/ }).click();
  await page.screenshot({ path: 'output/playwright/ipos-classic-final.png', fullPage: true });
  return { results, layout, contrast, mockSales: (await stats()).sales };
}
