import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const device = process.env.NATIVE_DEVICE_ID;
const api = new URL(process.env.NATIVE_TEST_API_URL ?? '');
if (!device || !['http:', 'https:'].includes(api.protocol) || /(^|\.)api\.sirfbazar\.com$/i.test(api.hostname))
  throw new Error('Native gate requires an attached device and a nonproduction test API URL');
const adb = (...args) => execFileSync('adb', ['-s', device, ...args], { encoding: 'utf8', timeout: 20000 });
assert.match(adb('get-state').trim(), /^device$/);
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const xml = () => {
  const output = adb('exec-out', 'uiautomator', 'dump', '/dev/tty');
  const start = output.indexOf('<?xml');
  if (start < 0) throw new Error('Android accessibility hierarchy was unavailable');
  return output.slice(start);
};
const nodeFor = (hierarchy, label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<node[^>]*(?:text|content-desc)="[^"]*${escaped}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*>`);
  return hierarchy.match(pattern);
};

for (const [app, prefix] of [['customer-app', 'CUSTOMER'], ['merchant-app', 'MERCHANT'], ['rider-app', 'RIDER']]) {
  const productionId = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'apps', app, 'app.json'), 'utf8')).expo.android.package;
  const pkg = process.env[`NATIVE_${prefix}_TEST_APP_ID`];
  if (pkg !== `${productionId}.remediation`) throw new Error(`${app} requires its dedicated .remediation test build ID`);
  const start = process.env[`NATIVE_${prefix}_START_TEXT`];
  const tap = process.env[`NATIVE_${prefix}_TAP_TEXT`];
  const destination = process.env[`NATIVE_${prefix}_DESTINATION_TEXT`];
  if (!start || !tap || !destination) throw new Error(`Native ${app} journey requires START_TEXT, TAP_TEXT and DESTINATION_TEXT fixture labels`);
  assert.match(adb('shell', 'pm', 'path', pkg), /package:/, `${app} test build is not installed`);
  adb('shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1');
  await sleep(1800);
  const first = xml();
  assert.ok(nodeFor(first, start), `${app} did not render the expected start control/text: ${start}`);
  const target = nodeFor(first, tap);
  assert.ok(target, `${app} did not expose navigation control: ${tap}`);
  const [, x1, y1, x2, y2] = target;
  adb('shell', 'input', 'tap', String(Math.floor((Number(x1) + Number(x2)) / 2)), String(Math.floor((Number(y1) + Number(y2)) / 2)));
  await sleep(1800);
  assert.ok(nodeFor(xml(), destination), `${app} navigation did not reach ${destination}`);
  console.log(`PASS ${app}: installed native build launched, rendered ${start}, navigated via ${tap} to ${destination}`);
}
