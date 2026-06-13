// Discovery probe: load a grocerapp category page in a real browser and capture
// every JSON response from endpoints.grocerapps.com, so we learn the real API
// paths and the product JSON shape before writing the full scraper.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  });

  const captured = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('endpoints.grocerapps.com')) return;
    let body = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
        body = '<unreadable>';
      }
    }
    captured.push({ status: res.status(), url, body });
  });

  const target = 'https://grocerapp.pk/beverages';
  console.log('Navigating', target);
  await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log('nav:', e.message));
  // Scroll to trigger lazy loading / pagination.
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(1200);
  }

  console.log(`\nCaptured ${captured.length} endpoints.grocerapps.com responses:\n`);
  for (const c of captured) {
    const keys =
      c.body && typeof c.body === 'object' ? Object.keys(c.body).join(', ') : typeof c.body;
    console.log(`[${c.status}] ${c.url}`);
    console.log(`   top-level: ${keys}`);
    // Print a shallow preview
    const preview = JSON.stringify(c.body).slice(0, 500);
    console.log(`   preview: ${preview}\n`);
  }

  // Save the richest response for shape analysis.
  const fs = require('fs');
  fs.mkdirSync(__dirname + '/output', { recursive: true });
  fs.writeFileSync(__dirname + '/output/probe.json', JSON.stringify(captured, null, 2));
  console.log('Full capture saved to output/probe.json');

  await browser.close();
})();
