const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/auth-flow.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: moduleObject, exports: moduleObject.exports });
const flow = moduleObject.exports;
test('legacy OTP contexts remain scoped while merchant registration uses its dedicated flow', () => {
  assert.equal(flow.authContextFor('signup'), 'customer');
  assert.equal(flow.authContextFor('signin'), 'merchant');
  const login = fs.readFileSync(path.join(__dirname, '../screens/LoginScreen.tsx'), 'utf8');
  const onboard = fs.readFileSync(path.join(__dirname, '../screens/OnboardScreen.tsx'), 'utf8');
  assert.match(login, /Continue to shop details/);
  assert.match(onboard, /auth\/merchant-register\/start/);
  assert.match(onboard, /auth\/merchant-register\/verify/);
  assert.match(onboard, /uploadMerchantIdentity\(identityPhoto\)/);
});
test('new verified accounts can resume shop setup', () => {
  assert.equal(flow.authDestination({ status: 'ACTIVE', role: 'CUSTOMER' }, 'customer'), 'Onboard');
});
test('owner and active staff may open merchant tabs only in merchant context', () => {
  for (const user of [{ merchant: { id: 'shop' } }, { staffOf: [{ status: 'ACTIVE' }] }]) {
    assert.equal(flow.authDestination(user, 'merchant'), 'Tabs');
    assert.equal(flow.authDestination(user, 'customer'), 'Login');
  }
  assert.equal(flow.authDestination({ staffOf: [{ status: 'INACTIVE' }] }, 'merchant'), 'Login');
});
test('missing and inactive accounts cannot enter shop setup or tabs', () => {
  for (const context of ['merchant', 'customer']) {
    assert.equal(flow.authDestination(null, context), 'Login');
    for (const status of ['SUSPENDED', 'DELETED']) assert.equal(flow.authDestination({ status, merchant: {} }, context), 'Login');
  }
});
test('OTP validation requires exactly six digits, including leading zeros', () => {
  for (const value of ['1234', '12345', '1234567', '12a456', '']) assert.equal(flow.validOtp(value), false);
  assert.equal(flow.validOtp('012345'), true);
  assert.equal(flow.validOtp(' 012345 '), true);
});
test('mobile numbers normalize local and international Pakistani formats', () => {
  for (const value of ['0301 2345678', '923012345678', '+92 (301) 234-5678']) {
    assert.equal(flow.normalizeMobile(value), '+923012345678');
    assert.equal(flow.validMobile(value), true);
  }
  for (const value of ['', '0301', '+1234567890']) assert.equal(flow.validMobile(value), false);
});
test('login keeps visible sign-up, OTP autofill and keyboard-safe scrolling', () => {
  const source = fs.readFileSync(path.join(__dirname, '../screens/LoginScreen.tsx'), 'utf8');
  assert.match(source, /Sign up — create a shop/);
  assert.match(source, /autoComplete="one-time-code"/);
  assert.match(source, /KeyboardAvoidingView/);
  assert.match(source, /ScrollView/);
  assert.doesNotMatch(source, /Demo shop:|123456|catch\s*\{/);
});
test('mobile merchant flows retain owner-controlled staff passwords and idempotent catalogue adds', () => {
  const team = fs.readFileSync(path.join(__dirname, '../screens/TeamScreen.tsx'), 'utf8');
  const catalog = fs.readFileSync(path.join(__dirname, '../components/BulkCatalogModal.tsx'), 'utf8');
  const login = fs.readFileSync(path.join(__dirname, '../screens/LoginScreen.tsx'), 'utf8');
  assert.match(team, /merchant\/staff\/\$\{passwordFor\.id\}\/password/);
  assert.match(login, /auth\/merchant-login/);
  assert.match(catalog, /requestId: uuidV4\(\)/);
  assert.match(catalog, /Retry same selection/);
});
test('verified owner setup can resume before the shop is created', () => {
  const onboard = fs.readFileSync(path.join(__dirname, '../screens/OnboardScreen.tsx'), 'utf8');
  const login = fs.readFileSync(path.join(__dirname, '../screens/LoginScreen.tsx'), 'utf8');
  assert.match(onboard, /storeAuth\(session, 'customer'\)/);
  assert.match(login, /Finish an unfinished shop setup/);
  assert.match(login, /context: resumeSetup \? 'customer' : authContextFor\(mode\)/);
});
