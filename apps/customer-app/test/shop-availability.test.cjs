const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies) {
  const module = { exports: {} }, jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module, exports: module.exports, require: name => name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : dependencies[name] ?? {},
  });
  return module.exports;
}
const state = load('../lib/shop-availability.ts', {});
const ui = load('../components/CustomerUI.tsx', {
  'react-native': { TouchableOpacity: 'Button', Text: 'Text', View: 'View' },
  '../lib/theme': { useTheme: () => ({ colors: { card: '#fff', text: '#071f18', muted: '#52665c' } }) },
  '../lib/shop-availability': state,
});
test('only explicit online/open flags enable shop navigation; offline/closed remain readable disabled cards', () => {
  for (const flags of [{ isOnline: false, isOpen: true }, { isOnline: true, isOpen: false }, { isOnline: false, isOpen: false }, {}]) {
    const card = ui.ShopCard({ shop: { id: 'shop', shopName: 'Test shop', ...flags }, onPress: () => { throw Error('Unavailable shop must not navigate'); } });
    assert.equal(card.props.disabled, true); assert.equal(card.props.accessibilityState.disabled, true);
    assert.equal(card.props.onPress, undefined); assert.match(card.props.accessibilityLabel, /not accepting orders/);
    assert.equal(card.props.style.opacity, undefined, 'text is not faded');
    assert.match(JSON.stringify(card), flags.isOnline ? /Closed/ : /Offline/);
  }
  let navigated = false;
  const card = ui.ShopCard({ shop: { shopName: 'Test shop', isOnline: true, isOpen: true }, onPress: () => navigated = true });
  assert.equal(card.props.disabled, false); card.props.onPress(); assert.equal(navigated, true);
});

function catalog(shop) {
  let slot = 0;
  const cached = { productId: 'milk', merchantProductId: 'mp', name: 'Cached unavailable milk' };
  const component = load('../components/CatalogScreen.tsx', {
    react: { useState: initial => [slot++ === 1 ? shop : slot === 6 ? [cached] : initial, () => {}], useEffect() {}, useCallback: fn => fn, useRef: initial => ({ current: initial }) },
    '@react-navigation/native': { useNavigation: () => ({ navigate() {} }), useFocusEffect() {} },
    'react-native': { View: 'View', ScrollView: 'ScrollView', FlatList: 'FlatList', useWindowDimensions: () => ({ width: 320 }), Platform: { OS: 'android' } },
    '../lib/theme': { useTheme: () => ({ colors: {}, s: {} }) },
    '../lib/shop-availability': state,
    './CustomerUI': { usePageInset: () => 16, PageHeading: 'Heading', StatePanel: 'StatePanel', SearchField: 'Search', SectionTitle: 'SectionTitle' },
  });
  return component.CatalogScreen({ merchantId: 'shop' });
}
test('direct native shop view never renders cached products while offline or awaiting shop metadata', () => {
  for (const shop of [null, { id: 'shop', shopName: 'Offline Shop', isOnline: false, isOpen: true }, { id: 'shop', shopName: 'Closed Shop', isOnline: true, isOpen: false }]) {
    const tree = catalog(shop);
    assert.equal(JSON.stringify(tree).includes('Cached unavailable milk'), false);
  }
  const tree = catalog({ id: 'shop', shopName: 'Online Shop', isOnline: true, isOpen: true });
  assert.equal(JSON.stringify(tree).includes('Cached unavailable milk'), true, 'an eligible shop still renders its products');
});
