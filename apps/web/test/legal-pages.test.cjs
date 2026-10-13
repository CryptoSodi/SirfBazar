const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function load(relative) {
  const filename = path.join(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module, exports: module.exports,
    require: name => {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name.endsWith('/AppIcon')) return { AppIcon: () => null };
      if (name.startsWith('@/')) {
        const base = name.slice(2);
        return load(base + (fs.existsSync(path.join(root, base + '.tsx')) ? '.tsx' : '.ts'));
      }
      throw Error(`Unexpected dependency: ${name}`);
    },
  });
  cache.set(filename, module.exports);
  return module.exports;
}

for (const route of ['terms', 'privacy-policy', 'account-deletion', 'contact']) {
  test(`${route} renders publicly with the approved email and accessible policy navigation`, () => {
    const page = load(`app/${route}/page.tsx`);
    const html = renderToStaticMarkup(React.createElement(page.default));
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.match(html, /aria-label="Policies and support"/);
    for (const href of ['/terms', '/privacy-policy', '/account-deletion', '/contact']) {
      assert.ok(html.includes(`href="${href}"`));
    }
    assert.match(html, /support@sirfbazar\.com/);
    assert.doesNotMatch(html, /support@sirfbazar\.pk|\+92 300 0000000/);
    assert.ok(page.metadata.title);
  });
}

test('deletion email has a subject but does not attach personal information or claim completion', () => {
  const { DELETION_EMAIL_URL } = load('lib/legal.ts');
  const url = new URL(DELETION_EMAIL_URL);
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, 'support@sirfbazar.com');
  assert.equal(url.searchParams.get('subject'), 'SirfBazar account and data deletion request');
  assert.equal(url.searchParams.has('body'), false);
  const html = renderToStaticMarkup(React.createElement(load('app/account-deletion/page.tsx').default));
  assert.match(html, /No website sign-in or app reinstallation is required/);
  assert.match(html, /Do not send passwords/);
  assert.match(html, /A disabled account is not confirmation/);
  assert.match(html, /retention period/);
  assert.doesNotMatch(html, /deleted immediately|deleted within \d+/i);
});

test('privacy describes all apps, precise coordinates and foreground rider location honestly', () => {
  const html = renderToStaticMarkup(React.createElement(load('app/privacy-policy/page.tsx').default));
  for (const text of ['Sirf Bazar', 'SirfBazar Merchant', 'SirfBazar Rider', 'may be precise', 'foreground', 'Expo', 'does not by itself erase']) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /id="account-deletion"/);
});

test('footer exposes terms, privacy and deletion separately', () => {
  const layout = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8');
  for (const route of ['/terms', '/privacy-policy', '/account-deletion', '/contact']) assert.ok(layout.includes(`'${route}'`));
  const prose = fs.readFileSync(path.join(root, 'components/ProsePage.tsx'), 'utf8');
  assert.match(prose, /overflow-wrap:anywhere/);
  assert.match(prose, /var\(--sb-ink\)/);
});
