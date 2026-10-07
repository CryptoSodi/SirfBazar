#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const modes = new Set(process.argv.slice(2));
const known = new Set(['--database', '--browser', '--native', '--staging']);
for (const mode of modes) if (!known.has(mode)) { console.error(`Unknown mode: ${mode}`); process.exit(2); }

const results = [];
function packageScript(app, script, env = process.env) {
  const file = resolve(root, 'apps', app, 'package.json');
  if (!existsSync(file)) throw new Error(`Missing ${file}`);
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  if (!pkg.scripts?.[script]) throw new Error(`${app} has no executable ${script} script`);
  if (!existsSync(resolve(root, 'apps', app, 'node_modules'))) throw new Error(`${app} dependencies are absent; run npm ci in an isolated copy first`);
  run(`${app} ${script}`, 'npm', ['--prefix', resolve(root, 'apps', app), 'run', script], 180000, env);
}
function run(label, command, args, timeout = 120000, env = process.env) {
  console.log(`\n[RUN] ${label}`);
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', timeout, shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) {
    results.push({ label, ok: false });
    throw new Error(`${label} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}`);
  }
  results.push({ label, ok: true });
}
function requireLocalDatabase() {
  const raw = process.env.REMEDIATION_DATABASE_URL;
  if (!raw) throw new Error('--database requires REMEDIATION_DATABASE_URL for a disposable database');
  const url = new URL(raw);
  if (!/^postgres(ql)?:$/.test(url.protocol) || !['localhost', '127.0.0.1', '::1'].includes(url.hostname))
    throw new Error('--database only accepts local disposable PostgreSQL');
  if (!/remediation[_-]test/i.test(url.pathname) || ['5432', '5433', '3001'].includes(url.port))
    throw new Error('--database requires a remediation_test database on a unique non-live port');
  return raw;
}
async function confirmDatabaseIdentity(database) {
  const requireApi = createRequire(resolve(root, 'apps/api/package.json'));
  const { PrismaClient } = requireApi('@prisma/client');
  const client = new PrismaClient({ datasources: { db: { url: database } } });
  try {
    const [identity] = await client.$queryRawUnsafe('SELECT current_database() AS name');
    const url = new URL(database);
    if (identity?.name !== decodeURIComponent(url.pathname.slice(1)))
      throw new Error('Connected database identity differs from disposable URL');
  } finally { await client.$disconnect(); }
}
function requireHttpLocal(name, value) {
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol))
    throw new Error(`${name} must point to an isolated local fixture, not production`);
}
try {
  if (!modes.size) {
    packageScript('api', 'typecheck'); packageScript('api', 'build');
    for (const test of ['test:pos', 'test:waha', 'test:whatsapp']) packageScript('api', test);
    for (const app of ['web', 'admin', 'shop', 'pos']) packageScript(app, 'build');
    packageScript('web', 'test'); packageScript('pos', 'test');
    for (const test of ['test:ipos', 'test:alerts', 'test:bulk']) packageScript('shop', test);
    for (const app of ['customer-app', 'merchant-app', 'rider-app']) { packageScript(app, 'typecheck'); packageScript(app, 'test'); }
    console.log('\nExternal gates: database, browser, native device, staging were not run. Invoke their explicit modes with prerequisites.');
  }
  if (modes.has('--database')) {
    const database = requireLocalDatabase();
    await confirmDatabaseIdentity(database);
    packageScript('api', 'test:remediation', { ...process.env, DATABASE_URL: database });
    // The API test harness owns fixture creation, bounded teardown and writes.
    void database;
  }
  if (modes.has('--browser')) {
    requireHttpLocal('BROWSER_WEB_URL', process.env.BROWSER_WEB_URL);
    requireHttpLocal('BROWSER_POS_URL', process.env.BROWSER_POS_URL);
    requireHttpLocal('BROWSER_SHOP_URL', process.env.BROWSER_SHOP_URL);
    if (!process.env.PLAYWRIGHT_MODULE_PATH) throw new Error('--browser requires PLAYWRIGHT_MODULE_PATH for an installed Playwright module');
    if (!existsSync(resolve(root, 'scripts/browser-remediation.mjs'))) throw new Error('Browser journey script is missing');
    run('browser journeys', process.execPath, [resolve(root, 'scripts/browser-remediation.mjs')], 240000);
  }
  if (modes.has('--native')) {
    if (!process.env.NATIVE_DEVICE_ID) throw new Error('--native requires NATIVE_DEVICE_ID for an attached emulator/device');
    if (!process.env.NATIVE_TEST_API_URL) throw new Error('--native requires NATIVE_TEST_API_URL used by the installed test builds');
    run('native device availability', 'adb', ['-s', process.env.NATIVE_DEVICE_ID, 'get-state'], 15000);
    if (!existsSync(resolve(root, 'scripts/native-remediation.mjs'))) throw new Error('Native device journey script is missing');
    run('native device journeys', process.execPath, [resolve(root, 'scripts/native-remediation.mjs')], 300000);
  }
  if (modes.has('--staging')) {
    if (!process.env.REMEDIATION_STAGING_URL || !process.env.REMEDIATION_STAGING_FIXTURE_TOKEN) throw new Error('--staging requires REMEDIATION_STAGING_URL and customer fixture token');
    if (!existsSync(resolve(root, 'scripts/staging-remediation.mjs'))) throw new Error('Staging journey script is missing');
    run('staging journeys', process.execPath, [resolve(root, 'scripts/staging-remediation.mjs')], 300000);
  }
  console.log(`\nPASS: ${results.length} executable checks`);
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);
  process.exitCode = 1;
}
