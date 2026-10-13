const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sharp = require(path.join(root, 'apps/web/node_modules/sharp'));
const listings = require('../docs/google-play/listings.json');
const out = path.join(root, 'output/google-play-2026-10-13');
const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function main() {
  const evidence = [];
  for (const app of listings.apps) {
    assert.ok(app.title.length <= 30);
    assert.ok(app.shortDescription.length <= 80);
    assert.ok(app.fullDescription.length <= 4000);
    const directory = path.join(out, app.role);
    fs.mkdirSync(directory, { recursive: true });
    const assetRoot = path.join(root, 'apps', `${app.role}-app/assets/brand/app-icons`, app.role);
    // Render the existing editable brand artwork without redrawing its logo.
    const artwork = fs.readFileSync(path.join(assetRoot, 'icon-master.svg'));
    const icon = path.join(directory, 'icon-512.png');
    await sharp(artwork).resize(512, 512).removeAlpha().png().toFile(icon);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="500" viewBox="0 0 1024 500"><rect width="1024" height="500" fill="#009966"/><rect x="0" y="460" width="1024" height="40" fill="#073E2D"/><image x="690" y="86" width="294" height="294" xlink:href="data:image/svg+xml;base64,${artwork.toString('base64')}"/><g font-family="Arial, sans-serif" fill="#ffffff"><text x="64" y="112" font-size="27" font-weight="700">${escape(app.role === 'customer' ? 'SirfBazar' : app.title)}</text><text x="64" y="223" font-size="52" font-weight="700">${escape(app.featureHeadline)}</text><text x="64" y="282" font-size="27">${escape(app.featureSubhead)}</text></g><path d="M64 333h72" stroke="#FBD66D" stroke-width="6"/></svg>`;
    fs.writeFileSync(path.join(directory, 'feature-graphic.svg'), svg);
    await sharp(Buffer.from(svg)).removeAlpha().png().toFile(path.join(directory, 'feature-graphic-1024x500.png'));
    fs.writeFileSync(path.join(directory, 'title.txt'), app.title + '\n');
    fs.writeFileSync(path.join(directory, 'short-description.txt'), app.shortDescription + '\n');
    fs.writeFileSync(path.join(directory, 'full-description.txt'), app.fullDescription + '\n');
    fs.writeFileSync(path.join(directory, 'release-notes.txt'), app.releaseNotes + '\n');
    const graphic = await sharp(path.join(directory, 'feature-graphic-1024x500.png')).metadata();
    const iconMetadata = await sharp(icon).metadata();
    assert.equal(graphic.width, 1024); assert.equal(graphic.height, 500); assert.equal(graphic.hasAlpha, false);
    assert.equal(iconMetadata.width, 512); assert.equal(iconMetadata.height, 512);
    evidence.push({ app: app.role, titleCharacters: app.title.length, shortDescriptionCharacters: app.shortDescription.length,
      fullDescriptionCharacters: app.fullDescription.length, icon: '512x512 PNG', featureGraphic: '1024x500 opaque PNG' });
  }
  fs.writeFileSync(path.join(out, 'listing-validation.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
