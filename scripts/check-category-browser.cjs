// Intercepted local fixture only; never sends real merchant mutations.
async (page) => {
  const user = { id: 'category-owner', status: 'ACTIVE', merchant: { id: 'category-shop' } };
  const profile = { id: 'category-shop', shopName: 'Category Review Shop', isOwner: true, permissions: ['INVENTORY', 'POS'], approvalStatus: 'APPROVED' };
  const categories = [{ id: 'produce', name: 'Fruits & Vegetables', children: [{ id: 'fruit', name: 'Fresh Fruits' }, { id: 'veg', name: 'Fresh Vegetables' }] }, { id: 'meat', name: 'Meat & Seafood', children: [{ id: 'chicken', name: 'Chicken' }, { id: 'seafood', name: 'Seafood' }] }];
  const catalog = [{ productId: 'apple', name: 'Apples', category: { id: 'fruit', name: 'Fresh Fruits' }, alreadyListed: false }, { productId: 'banana', name: 'Bananas', category: { id: 'fruit', name: 'Fresh Fruits' }, alreadyListed: true }, { productId: 'arvi', name: 'Arvi', category: { id: 'veg', name: 'Fresh Vegetables' }, alreadyListed: false }];
  const uploads = [];
  await page.context().route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    let data = [];
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/merchant/profile')) data = profile;
    else if (path.endsWith('/products/categories')) data = categories;
    else if (path.endsWith('/merchant/catalog')) {
      const selected = url.searchParams.get('categoryId');
      const items = catalog.filter(p => !selected || selected === 'produce' || p.category.id === selected);
      data = { items, total: items.length, totalPages: 1 };
    } else if (path.endsWith('/merchant/products/bulk-upload')) {
      const payload = route.request().postDataJSON(); uploads.push(payload);
      data = { created: 1, updated: 0, skipped: 0, failed: [{ rowId: 'arvi', error: 'Fixture failure; no live write' }], rows: payload.items.map(item => ({ rowId: item.rowId, status: item.rowId === 'arvi' ? 'FAILED' : 'CREATED', error: item.rowId === 'arvi' ? 'Fixture failure; no live write' : undefined })) };
    } else if (path.endsWith('/merchant/products')) data = { items: [], total: 0, totalPages: 1 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.context().route('**/socket.io/**', route => route.abort());
  await page.context().addInitScript(({ user }) => {
    localStorage.setItem('sbs.accessToken', 'fixture.' + btoa(JSON.stringify({ role: 'MERCHANT_OWNER', exp: 4102444800 })) + '.fixture');
    localStorage.setItem('sbs.user', JSON.stringify(user));
    localStorage.setItem('sirfbazar.merchant.theme', 'light');
  }, { user });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5188/products');
  const expand = page.getByRole('button', { name: 'Expand Fruits & Vegetables', exact: true });
  await expand.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Fresh Fruits', exact: true }).click();
  await page.getByRole('button', { name: 'Already in my shop', exact: true }).waitFor();
  await page.getByRole('button', { name: /Select visible products/ }).click();
  await page.getByRole('button', { name: 'Fresh Vegetables', exact: true }).click();
  await page.getByRole('heading', { name: 'Arvi', exact: true }).waitFor();
  await page.getByRole('checkbox', { name: 'Select product', exact: true }).check();
  const review = page.getByRole('complementary', { name: 'Selected products' });
  await review.getByRole('button', { name: 'Add 2 selected', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Fruits & Vegetables (includes subcategories)', exact: true }).click();
  for (let index = 0; index < 2; index++) {
    await review.getByLabel('Sale price (Rs)').nth(index).fill(index ? '120' : '250.25');
    await review.getByLabel('Stock quantity (units)').nth(index).fill('5');
  }
  await page.screenshot({ path: 'output/playwright/categories-desktop.png', fullPage: true });
  await review.getByRole('button', { name: 'Add 2 selected', exact: true }).click();
  await review.getByText(/1 added/).waitFor();
  if (uploads.length !== 1 || uploads[0].mode !== 'ADD_MISSING' || uploads[0].items.length !== 2 || uploads[0].items[0].pricePaisa !== 25025) throw Error('Incorrect bulk submission');
  await review.getByRole('button', { name: 'Retry same selection', exact: true }).click();
  if (JSON.stringify(uploads[0]) !== JSON.stringify(uploads[1])) throw Error('Retry changed original request');
  await page.getByRole('button', { name: 'Use dark appearance', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/categories-dark.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).waitFor();
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
  await page.screenshot({ path: 'output/playwright/categories-320.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('320px horizontal overflow');
  console.log('PASS: keyboard disclosure, nested filters, multi-select across sections, exclusion of existing listings, paisa conversion, immutable partial retry, desktop/dark/320px. All API writes mocked.');
}
