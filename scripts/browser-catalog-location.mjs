import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('../apps/web/node_modules/playwright');
const shop = process.env.BROWSER_SHOP_URL || 'http://127.0.0.1:5198';
const web = process.env.BROWSER_WEB_URL || 'http://127.0.0.1:5200';
for (const url of [shop, web]) if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw Error('These fixtures may only run against local previews.');
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [file, url] of [['./check-catalog-autoload-browser.cjs', shop], ['./check-location-picker-browser.cjs', web]]) {
    const context = await browser.newContext();
    try {
      await context.route('**/*', route => {
        const host = new URL(route.request().url()).hostname;
        return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
      });
      console.log(await require(file)(await context.newPage(), url));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
