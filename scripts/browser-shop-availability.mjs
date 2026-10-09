import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('../apps/web/node_modules/playwright');
const url = process.env.BROWSER_WEB_URL || 'http://127.0.0.1:5201';
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw Error('Availability fixtures may only use local previews.');
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  try { console.log(await require('./check-shop-availability-browser.cjs')(await context.newPage(), url)); }
  finally { await context.close(); }
} finally { await browser.close(); }
