const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../apps/api/node_modules/typescript');
const root = path.resolve(__dirname, '..');

for (const role of ['customer', 'merchant', 'rider']) {
  function component(openURL) {
    const module = { exports: {} };
    const updates = [];
    const jsx = (type, props) => ({ type, props });
    const source = fs.readFileSync(path.join(root, `apps/${role}-app/components/AccountPolicies.tsx`), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, {
      module, exports: module.exports,
      require: name => {
        if (name === 'react') return { useRef: value => ({ current: value }), useState: value => [value, next => updates.push(next)] };
        if (name === 'react-native') return { Linking: { openURL }, Pressable: 'Pressable', Text: 'Text', View: 'View' };
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        throw Error(`Unexpected import: ${name}`);
      },
    });
    return { tree: module.exports.AccountPolicies({ color: '#009966', textColor: '#333333' }), updates };
  }

  test(`${role}: public policy URLs have accessible touch targets and no session data`, async () => {
    const opened = [];
    const { tree } = component(async url => opened.push(url));
    const links = tree.props.children[0];
    assert.equal(links.length, 3);
    for (const link of links) {
      assert.equal(link.props.accessibilityRole, 'link');
      assert.ok(link.props.style.minHeight >= 48);
      link.props.onPress();
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.deepEqual(opened, [
      'https://www.sirfbazar.com/account-deletion',
      'https://www.sirfbazar.com/privacy-policy',
      'https://www.sirfbazar.com/terms',
    ]);
  });

  test(`${role}: browser failure gives the support fallback and permits retry`, async () => {
    const { tree, updates } = component(async () => { throw Error('No browser'); });
    const link = tree.props.children[0][0];
    link.props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(updates.some(value => typeof value === 'string' && value.includes('support@sirfbazar.com')));
    assert.equal(updates.at(-1), false);
    link.props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(updates.filter(value => value === true).length, 2);
  });

  test(`${role}: repeated taps do not open duplicate browser windows`, async () => {
    let calls = 0;
    let finish;
    const { tree } = component(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
    const link = tree.props.children[0][0];
    link.props.onPress(); link.props.onPress();
    assert.equal(calls, 1);
    finish();
    await new Promise(resolve => setImmediate(resolve));
  });
}

test('customer request neither disables the account nor silently signs the customer out', () => {
  const source = fs.readFileSync(path.join(root, 'apps/customer-app/screens/ProfileEditScreen.tsx'), 'utf8');
  assert.doesNotMatch(source, /api\.del|clearAuth|resetBadges/);
  assert.match(source, /mailto:support@sirfbazar\.com\?subject=/);
  assert.match(source, /Opening your email app does not send a request/);
  assert.match(source, /if \(deleteAccount\) \{ setLoaded\(true\); return; \}/);
});

test('merchant shop photos do not request microphone or broad gallery access', () => {
  const config = require('../apps/merchant-app/app.json');
  const picker = config.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');
  assert.equal(picker[1].microphonePermission, false);
  const source = fs.readFileSync(path.join(root, 'apps/merchant-app/screens/OnboardScreen.tsx'), 'utf8');
  assert.doesNotMatch(source, /requestMediaLibraryPermissionsAsync/);
  assert.match(source, /mediaTypes: \['images'\]/);
});
