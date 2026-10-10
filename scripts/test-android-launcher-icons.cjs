const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sharp = require(path.join(root, 'apps/web/node_modules/sharp'));
const roles = ['customer', 'merchant', 'rider'];
const source = fs.readFileSync(path.join(root, 'assets/brand/sirfbazar-app-icon-green.svg'), 'utf8');
const basket = source.match(/<path d="([^"]+)"/)[1];
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const raw = file => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (const role of roles) {
  const app = path.join(root, 'apps', `${role}-app`);
  const prefix = `./assets/brand/app-icons/${role}/`;
  const config = JSON.parse(fs.readFileSync(path.join(app, 'app.json'), 'utf8')).expo;

  test(`${role}: resolved Android config uses its own assets and preserves other platforms`, () => {
    const { getConfig } = require(path.join(app, 'node_modules/@expo/config'));
    const resolved = getConfig(app).exp;
    const expected = {
      foregroundImage: prefix + 'adaptive-foreground.png',
      backgroundImage: prefix + 'adaptive-background.png',
      backgroundColor: '#009966',
      monochromeImage: prefix + 'monochrome.png',
    };
    assert.equal(config.android.package, `pk.sirfbazar.${role}`);
    assert.equal(config.android.icon, prefix + 'icon-1024.png');
    assert.deepEqual(config.android.adaptiveIcon, expected);
    assert.equal(resolved.android.icon, config.android.icon);
    assert.deepEqual(resolved.android.adaptiveIcon, expected);
    assert.equal(resolved.android.package, config.android.package);
    assert.equal(resolved.icon, './assets/brand/sirfbazar-app-icon-green.png');
    assert.equal(resolved.splash.image, './assets/brand/sirfbazar-reverse.png');
    assert.equal(resolved.ios.bundleIdentifier, `pk.sirfbazar.${role}`);
    const foreground = fs.readFileSync(path.join(app, prefix, 'adaptive-foreground.svg'), 'utf8');
    assert.ok(foreground.includes(basket), 'Original basket path must remain intact');
  });

  test(`${role}: PNGs and themed silhouettes survive adaptive masks`, async () => {
    const load = name => raw(path.join(app, prefix, name));
    const fg = await load('adaptive-foreground.png');
    const bg = await load('adaptive-background.png');
    const mono = await load('monochrome.png');
    const master = await load('icon-1024.png');
    for (const image of [fg, bg, mono, master]) {
      assert.equal(image.info.width, 1024);
      assert.equal(image.info.height, 1024);
    }
    let visible = 0;
    let transparent = 0;
    let safeLoss = 0;
    let shiftedLoss = 0;
    const shift = 1024 * 3 / 108;
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 4;
      const alpha = fg.data[i + 3];
      assert.equal(bg.data.readUInt32BE(i), 0x009966ff);
      assert.equal(master.data[i + 3], 255);
      assert.equal(mono.data[i + 3], alpha);
      if (!alpha) { transparent++; continue; }
      visible++;
      assert.equal(mono.data[i], 255);
      assert.equal(mono.data[i + 1], 255);
      assert.equal(mono.data[i + 2], 255);
      const dx = x + 0.5 - 512;
      const dy = y + 0.5 - 512;
      // 108dp layers, a 66dp safe circle and a 72dp circular viewport.
      if (Math.hypot(dx, dy) > 1024 * 33 / 108) safeLoss += alpha;
      for (const [sx, sy] of [[shift, 0], [-shift, 0], [0, shift], [0, -shift]]) {
        if (Math.hypot(dx + sx, dy + sy) > 1024 * 36 / 108) shiftedLoss += alpha;
      }
    }
    assert.ok(visible > 0 && transparent > 0);
    assert.equal(safeLoss, 0, 'Foreground must fit the adaptive safe circle');
    assert.equal(shiftedLoss, 0, 'Foreground must survive a 3dp shift');
    const store = await sharp(path.join(app, prefix, 'play-store-512.png')).metadata();
    assert.equal(store.width, 512);
    assert.equal(store.height, 512);
    assert.equal(store.hasAlpha, false);
  });
}

test('all three apps have distinct legacy, adaptive and monochrome icons', () => {
  for (const file of ['icon-1024.png', 'adaptive-foreground.png', 'monochrome.png']) {
    const hashes = roles.map(role => hash(fs.readFileSync(path.join(root, 'apps', `${role}-app`, 'assets/brand/app-icons', role, file))));
    assert.equal(new Set(hashes).size, roles.length, `${file} must distinguish each role`);
  }
});
