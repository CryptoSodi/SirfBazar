import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('../apps/web/node_modules/playwright');
const url = process.env.BROWSER_SHOP_URL || 'http://127.0.0.1:5210';
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  try { console.log(await require('./check-merchant-order-flow-browser.cjs')(await context.newPage(), url)); }
  finally { await context.close(); }
  if (process.env.BROWSER_ADMIN_URL) {
    const admin = await browser.newContext();
    try { console.log(await require('./check-merchant-access-browser.cjs')(await admin.newPage(), process.env.BROWSER_ADMIN_URL)); }
    finally { await admin.close(); }
  }
} finally { await browser.close(); }
