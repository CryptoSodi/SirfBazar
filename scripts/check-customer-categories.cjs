// Read-only, intercepted local customer website fixture.
async (page) => {
  const categories = [{ id: 'produce', slug: 'fruits-vegetables', name: 'Fruits & Vegetables', children: [{ id: 'fruit', slug: 'fruits-vegetables--fresh-fruits', name: 'Fresh Fruits', children: [] }, { id: 'veg', slug: 'fruits-vegetables--fresh-vegetables', name: 'Fresh Vegetables', children: [] }] }];
  const searches = [];
  await page.context().route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let data = { items: [], total: 0, totalPages: 1 };
    if (url.pathname.endsWith('/products/categories')) data = categories;
    if (url.pathname.endsWith('/products/search')) searches.push(url.searchParams.get('categoryId'));
    if (url.pathname.endsWith('/merchants/nearby')) data = { items: [], total: 1 };
    if (url.pathname.endsWith('/cart')) data = { groups: [], itemCount: 0 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:3188/search?category=fruits-vegetables--fresh-fruits');
  await page.getByRole('heading', { name: 'No nearby products found', exact: true }).waitFor();
  if (searches.at(-1) !== 'fruit') throw Error('Child slug was not resolved to its ID');
  const sidebar = page.locator('aside.sb-browse-filters');
  await sidebar.getByRole('link', { name: 'Fresh Vegetables', exact: true }).click();
  await page.waitForURL('**/search?category=fruits-vegetables--fresh-vegetables');
  await page.getByRole('heading', { name: 'No nearby products found', exact: true }).waitFor();
  if (searches.at(-1) !== 'veg') throw Error('Subsection navigation did not change the filter');
  await sidebar.getByRole('link', { name: 'All Fruits & Vegetables', exact: true }).click();
  await page.waitForURL('**/search?category=fruits-vegetables');
  await page.getByRole('heading', { name: 'No nearby products found', exact: true }).waitFor();
  if (searches.at(-1) !== 'produce') throw Error('Parent filter missing');
  await page.screenshot({ path: 'output/playwright/customer-categories-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.locator('details.sb-mobile-filters > summary').click();
  await page.locator('details.sb-mobile-filters').getByRole('link', { name: 'Fresh Fruits', exact: true }).waitFor();
  await page.locator('details.sb-mobile-filters').getByRole('link', { name: 'Fresh Vegetables', exact: true }).click();
  await page.waitForURL('**/search?category=fruits-vegetables--fresh-vegetables');
  await page.getByRole('heading', { name: 'No nearby products found', exact: true }).waitFor();
  if (searches.at(-1) !== 'veg') throw Error('Mobile subsection action was covered or ineffective');
  await page.screenshot({ path: 'output/playwright/customer-categories-320.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Customer category filters overflow at 320px');
  const count = searches.length;
  await page.goto('http://127.0.0.1:3188/search?category=not-a-real-category');
  await page.getByText('This category is no longer available. Choose another category.', { exact: true }).waitFor();
  if (searches.length !== count) throw Error('Unknown category silently broadened the search');
  console.log('PASS: child slug resolution, parent links, subsection navigation, 320px filters and invalid category fail-closed behavior. API requests intercepted.');
}
