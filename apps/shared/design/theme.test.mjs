import assert from 'node:assert/strict';
import test from 'node:test';
import { contrast, deriveTheme, MAX_THEME_BYTES, normalizeHex, originalTheme, parseThemeJSON, presets } from './theme.ts';

test('v5 theme JSON validates and normalizes safe fields', () => {
  assert.equal(normalizeHex('#0a6'), '#00AA66');
  assert.equal(normalizeHex('red'), null);
  assert.deepEqual(parseThemeJSON(JSON.stringify({ ...originalTheme, color: '0a6', ignored: '<script>' })), { ...originalTheme, color: '#00AA66' });
  assert.throws(() => parseThemeJSON('{broken'), /valid JSON/);
  assert.throws(() => parseThemeJSON(JSON.stringify({ ...originalTheme, version: 2 })), /Unsupported theme version/);
  assert.throws(() => parseThemeJSON(JSON.stringify({ ...originalTheme, mode: 'neon' })), /Invalid mode/);
  assert.throws(() => parseThemeJSON(' '.repeat(MAX_THEME_BYTES + 1)), /larger than 32 KiB/);
});

test('preset action colours meet the requested text contrast', () => {
  for (const [, color] of presets) {
    for (const mode of ['light', 'dark']) {
      const derived = deriveTheme({ ...originalTheme, color, mode }, false);
      assert.ok(contrast(derived.tokens['--sb-action'], '#FFFFFF') >= 4.5, `${color} ${mode} action contrast`);
      assert.ok(contrast(derived.tokens['--sb-accent-text'], derived.tokens['--sb-tint']) >= 4.5, `${color} ${mode} tint contrast`);
    }
  }
  assert.equal(deriveTheme({ ...originalTheme, mode: 'system' }, true).dark, true);
  assert.equal(deriveTheme({ ...originalTheme, mode: 'system' }, false).dark, false);
});
