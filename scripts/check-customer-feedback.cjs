// Local production browser test. Every API request is intercepted; no real orders.
module.exports = async (page, baseUrl) => {
  const address = { id: 'address-fixture', label: 'Home', fullAddress: 'Test Street', city: 'Lahore', isDefault: true, latitude: 31.52, longitude: 74.35 };
  const cart = { id: 'cart-fixture', itemCount: 1, subtotalPaisa: 30000, deliveryFeePaisa: 5000, serviceFeePaisa: 1000, totalPaisa: 36000, groups: [{ merchant: { id: 'shop-fixture', shopName: 'Fixture shop' }, deliveryFeePaisa: 5000, items: [{ id: 'line-fixture', inStock: true, quantity: 1 }] }] };
  const categories = [{ id: 'dairy', slug: 'milk-eggs-bread', name: 'Milk, Eggs & Bread', children: [{ id: 'milk', slug: 'fresh-milk', name: 'Fresh Milk' }, { id: 'eggs', slug: 'fresh-eggs', name: 'Eggs' }] }, { id: 'produce', slug: 'fruits-vegetables', name: 'Fruits & Vegetables', children: [{ id: 'fruit', slug: 'fresh-fruits', name: 'Fresh Fruits' }, { id: 'veg', slug: 'fresh-vegetables', name: 'Fresh Vegetables' }] }];
  let rejectQuote = true; let submitted = []; const filters = [];
  await page.context().route('**/api/**', async route => {
    const u = new URL(route.request().url()); let data = {}; let status = 200;
    if (u.pathname.endsWith('/cart')) data = cart;
    else if (u.pathname.endsWith('/customer/addresses')) data = [address];
    else if (u.pathname.endsWith('/orders/quote')) {
      const body = route.request().postDataJSON(); if (body.cartId !== cart.id) throw Error('Quote omitted cart identity');
      if (rejectQuote) { status = 400; data = { message: ['requestId must be a UUID', 'cartId should not be empty', 'cartId must be a string'] }; }
      else data = { version: 1, approvedQuote: 'signed-fixture', quote: { cartId: cart.id, deliveryAddress: address, items: [], merchants: [], subtotalPaisa: 30000, serviceFeePaisa: 1000, totalAmountPaisa: 36000 } };
    } else if (u.pathname.endsWith('/orders') && route.request().method() === 'POST') {
      submitted.push(route.request().postDataJSON()); await route.abort('connectionfailed'); return;
    } else if (u.pathname.endsWith('/products/categories')) data = categories;
    else if (u.pathname.endsWith('/products/search')) { filters.push(u.searchParams.get('categoryId')); data = { items: [], total: 0 }; }
    else if (u.pathname.endsWith('/merchants/nearby')) data = { items: [{ id: 'shop-fixture' }], total: 1 };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.context().addInitScript(() => { localStorage.setItem('sb.accessToken','fixture'); localStorage.setItem('sb.user',JSON.stringify({ id:'customer-fixture' })); localStorage.setItem('sb.location',JSON.stringify({ latitude:31.52,longitude:74.35,label:'Test area' })); localStorage.setItem('sb.theme','light'); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/checkout`);
  const review = page.locator('.sb-checkout-summary').getByRole('button',{name:'Review order',exact:true});
  await review.click();
  const toast = page.locator('[data-toast-host]');
  await toast.getByText(/Your basket could not be verified/).waitFor();
  if (await page.locator('.sb-checkout-summary .sb-error').count()) throw Error('Action error still embedded in page');
  if (/requestId|cartId|UUID/.test(await page.locator('body').innerText())) throw Error('Technical error leaked');
  if (await page.evaluate(()=>!!document.activeElement?.closest('[data-toast-host]'))) throw Error('Toast stole focus');
  await page.screenshot({ path:'output/playwright/customer-friendly-error.png',fullPage:true });
  // A native top-layer dialog must not cover an already visible error toast.
  await page.evaluate(() => { const dialog=document.createElement('dialog'); dialog.id='toast-layer-fixture'; dialog.setAttribute('aria-label','Notification layer test'); dialog.innerHTML='<button>Close fixture</button>'; document.body.append(dialog); dialog.showModal(); });
  await page.locator('#toast-layer-fixture [data-toast-host]').waitFor();
  await page.waitForTimeout(5500);
  if (!await toast.getByText(/Your basket could not be verified/).isVisible()) throw Error('Error disappeared before dismissal');
  await page.evaluate(() => { const dialog=document.querySelector('#toast-layer-fixture'); dialog.close(); dialog.remove(); });
  await page.locator('body > [data-toast-host]').waitFor();
  await page.setViewportSize({width:320,height:720});
  if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) throw Error('Checkout overflow at 320px');
  await toast.getByRole('button',{name:'Dismiss notification'}).click();
  await page.setViewportSize({width:1440,height:1000});
  rejectQuote = false;
  await review.click();
  await page.locator('.sb-checkout-summary').getByRole('button',{name:'Place order',exact:true}).click();
  await page.getByRole('heading',{name:'Check your saved order'}).waitFor();
  if (submitted.length!==1 || submitted[0].cartId!==cart.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submitted[0].requestId) || submitted[0].approvedQuote!=='signed-fixture') throw Error('Invalid checkout request contract');
  await page.reload();
  await page.getByRole('heading',{name:'Check your saved order'}).waitFor();
  await page.getByRole('button',{name:'Retry saved request'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-toast-host] [role=alert]'));
  if (submitted.length!==2 || JSON.stringify(submitted[0])!==JSON.stringify(submitted[1])) throw Error('Retry changed saved request');
  await page.goto(`${baseUrl}/search?category=milk-eggs-bread`);
  const subsections = page.getByRole('navigation',{name:'Subsections of Milk, Eggs & Bread'});
  await subsections.getByRole('link',{name:'Fresh Milk',exact:true}).click();
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('category')==='fresh-milk');
  await page.getByRole('heading',{name:'Fresh Milk',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'Subsections of Milk, Eggs & Bread'}).getByRole('link',{name:'Eggs',exact:true}).click();
  await page.getByRole('heading',{name:'Eggs',exact:true}).waitFor();
  await page.getByText('No nearby products found',{exact:true}).waitFor();
  if (!filters.includes('milk') || !filters.includes('eggs')) throw Error('Subsection filters did not reach API');
  await page.screenshot({path:'output/playwright/customer-subcategories.png',fullPage:true});
  for(const width of [320,390,768,1440]) { await page.setViewportSize({width,height:900}); if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) throw Error('Category overflow at '+width); }
  return 'PASS: friendly persistent floating errors, no internal fields, focus preservation, valid checkout identity, immutable retry after reload, child category filtering, responsive 320/390/768/1440px. All requests mocked.';
}
