const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const target = { exports: {} };
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../components/GroceryHero.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  module: target, exports: target.exports, require: name => {
    if (name === 'next/link') return { default: 'Link' };
    if (name === 'next/image') return { default: 'Image' };
    if (name === './AppIcon') return { AppIcon: 'Icon' };
    if (name.endsWith('.module.css')) return { default: {} };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    throw Error(`Unexpected dependency: ${name}`);
  },
});
const { GroceryHero } = target.exports;
const homeSource = fs.readFileSync(require.resolve('../app/page.tsx'), 'utf8');
function nodes(node) {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== 'object') return [node];
  return [node, ...nodes(node.props.children)];
}

test('hero uses real semantic text and never implies a default delivery location', () => {
  for (const confirmed of [false, true]) {
    const tree = nodes(GroceryHero({ hasConfirmedLocation: confirmed, onChooseLocation() {} }));
    const heading = tree.find(node => node.type === 'h1');
    const text = nodes(heading).filter(node => typeof node === 'string').join('');
    assert.equal(text, confirmed ? 'Everyday groceries from shops near you.' : 'Everyday groceries from local shops.');
    assert.equal(tree.filter(node => node.type === 'h1').length, 1);
    assert.equal(tree[0].props['aria-labelledby'], heading.props.id);
    assert.equal(tree.filter(node => node.type === 'li').length, 4);
  }
});

test('confirmed location links to guest shop discovery without auth dependencies', () => {
  const links = nodes(GroceryHero({ hasConfirmedLocation: true, onChooseLocation() {} })).filter(node => node.type === 'Link');
  assert.deepEqual(links.map(node => node.props.href), ['/search', '/search?type=shops']);
  assert.ok(links.every(node => !node.props.onClick));
});

test('unconfirmed location requires an explicit action before local discovery', () => {
  let opened = false;
  const tree = nodes(GroceryHero({ hasConfirmedLocation: false, onChooseLocation() { opened = true; } }));
  const button = tree.find(node => node.type === 'button');
  assert.equal(button.props.children, 'Set delivery location');
  button.props.onClick();
  assert.equal(opened, true);
});

test('nearby shops are the first homepage section after the hero and failures stay scoped', () => {
  const hero = homeSource.indexOf('<GroceryHero');
  const shops = homeSource.indexOf('aria-labelledby="nearby-shops-title"');
  const categories = homeSource.indexOf('Shop by category');
  assert.ok(hero >= 0 && shops > hero && categories > shops);
  assert.match(homeSource, /setShopError\(!!location && shopResult\?\.status === 'rejected'\)/);
  assert.match(homeSource, /setProductError\(!!location && productResult\?\.status === 'rejected'\)/);
});

test('only separate production artwork is rendered with reserved dimensions and responsive sizing', () => {
  const tree = nodes(GroceryHero({ hasConfirmedLocation: false, onChooseLocation() {} }));
  const images = tree.filter(node => node.type === 'Image');
  assert.equal(images.length, 1);
  assert.equal(images[0].props.src, '/images/hero/grocery-hero-artwork.webp');
  assert.equal(images[0].props.width, 809);
  assert.equal(images[0].props.height, 644);
  assert.equal(images[0].props.alt, '');
  assert.equal(images[0].props.preload, true);
  assert.match(images[0].props.sizes, /767px/);
  const text = tree.filter(node => typeof node === 'string').join(' ');
  assert.doesNotMatch(text, /Fast delivery|Fresh everyday|Quality you can trust|Cash on delivery|Wapda Town/);
});
