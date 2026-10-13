// Dedicated local PostgreSQL process. Never uses the developer's DATABASE_URL.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const root = path.resolve(__dirname, '..');
const pg = process.env.REVIEW_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/16/bin';
const dir = fs.mkdtempSync(path.join(root, 'output/review-db-'));
function run(name, args, options = {}) {
  const command = name === 'node' ? process.execPath : path.join(pg, name + (process.platform === 'win32' ? '.exe' : ''));
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', timeout: 120000, windowsHide: true, ...options });
  if (result.error || result.status !== 0) throw new Error(`${name} failed (${result.status})`);
}
(async () => {
  const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); }); });
  let started = false;
  try {
    run('initdb', ['-D', dir, '-U', 'review_test', '--auth=trust', '--encoding=UTF8', '--no-locale']);
    run('pg_ctl', ['-D', dir, '-l', path.join(dir, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
    started = true;
    run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'review_test', 'sirfbazar_remediation_test']);
    const url = `postgresql://review_test@127.0.0.1:${port}/sirfbazar_remediation_test`;
    for (const file of ['prisma/remediation-disposable-fixture.sql', 'prisma/upgrades/20261011-google-account-profile.sql', 'prisma/upgrades/20261011-merchant-settings-pos-and-order-revisions.sql']) run('psql', ['-X', '-d', url, '-v', 'ON_ERROR_STOP=1', '-f', path.join(root, 'apps/api', file)], { stdio: 'pipe' });
    run('node', ['-r', 'ts-node/register/transpile-only', '--test', 'test/review-access-database.test.cjs'], { cwd: path.join(root, 'apps/api'), env: { ...process.env, DATABASE_URL: url } });
  } finally {
    if (started) run('pg_ctl', ['-D', dir, '-m', 'fast', '-w', 'stop']);
    console.log(`Disposable test files retained at ${dir}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
