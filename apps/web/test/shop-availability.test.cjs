const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/ShopAvailability.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  module: moduleUnderTest, exports: moduleUnderTest.exports, require: name => {
    if (name === 'next/link') return { default: 'Link' };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    throw Error(name);
  },
});
const { shopAcceptingOrders, shopStatus, ShopAvailabilityLink } = moduleUnderTest.exports;
test('offline and closed shop cards are static readable content, never disabled-looking links', () => {
  for (const flags of [{ isOnline: false, isOpen: true }, { isOnline: true, isOpen: false }, {}]) {
    const shop = { id: 'shop', ...flags };
    const card = ShopAvailabilityLink({ shop, className: 'existing-design', children: 'Shop status' });
    assert.equal(shopAcceptingOrders(shop), false); assert.equal(card.type, 'div');
    assert.equal(card.props.href, undefined); assert.equal(card.props.tabIndex, undefined);
    assert.equal(card.props['data-shop-unavailable'], true);
    assert.match(card.props.className, /existing-design/); assert.equal(card.props.children, 'Shop status');
    assert.equal(shopStatus(shop), flags.isOnline ? 'Closed' : 'Offline');
  }
});
test('online/open shop retains a native link and existing appearance', () => {
  const shop = { id: 'shop', isOnline: true, isOpen: true };
  const card = ShopAvailabilityLink({ shop, className: 'existing-design', children: 'Online shop' });
  assert.equal(card.type, 'Link'); assert.equal(card.props.href, '/shop/shop');
  assert.equal(shopStatus(shop), 'Open'); assert.equal(card.props.className, 'existing-design');
});
