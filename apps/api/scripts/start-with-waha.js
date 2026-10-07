const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');

const configPath = process.env.SIRFBAZAR_WAHA_ENV || resolve(
  __dirname,
  '../../GroceryServer/experiments/waha/.env',
);

function readEnv(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

let waha;
try {
  waha = readEnv(configPath);
} catch {
  throw new Error('WAHA configuration was not found. Run the WAHA setup helper first.');
}

if (
  waha.WAHA_BASE_URL !== 'http://127.0.0.1:3002' ||
  !waha.WAHA_API_KEY || waha.WAHA_API_KEY.length < 32 ||
  !/^[a-zA-Z0-9_-]{1,64}$/.test(waha.WAHA_SESSION || 'default') ||
  !(waha.WAHA_TEST_RECIPIENTS || '').trim()
) {
  throw new Error('WAHA is not ready. Configure an allowed +923XXXXXXXXX test recipient before enabling it.');
}

const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: resolve(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: waha.NODE_ENV || 'development',
    OTP_PROVIDER: 'waha',
    WAHA_BASE_URL: waha.WAHA_BASE_URL,
    WAHA_API_KEY: waha.WAHA_API_KEY,
    WAHA_SESSION: waha.WAHA_SESSION || 'default',
    WAHA_TEST_RECIPIENTS: waha.WAHA_TEST_RECIPIENTS,
    WAHA_ALLOW_REMOTE: 'false',
  },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
