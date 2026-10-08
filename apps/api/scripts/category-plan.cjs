'use strict';
const { createHash } = require('node:crypto');
const { definitions, classify } = require('./category-sections.cjs');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function normalized(snapshot) {
  return {
    categories: snapshot.categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, parentCategoryId: c.parentCategoryId ?? null, isActive: c.isActive, isRestricted: c.isRestricted ?? false })).sort((a, b) => a.id.localeCompare(b.id)),
    products: snapshot.products.map(p => ({ id: p.id, name: p.name, categoryId: p.categoryId })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}
function makePlan(input) {
  const snapshot = normalized(input);
  const create = [], moves = [], review = [];
  for (const parent of snapshot.categories.filter(c => !c.parentCategoryId)) {
    const products = snapshot.products.filter(p => p.categoryId === parent.id);
    const sections = definitions(parent).filter(section => section.pattern || products.some(p => !classify(parent, p.name)?.pattern));
    if (!sections.length) continue;
    const targets = new Map();
    for (const section of sections) {
      const existing = snapshot.categories.find(c => c.slug === section.slug);
      if (existing && (existing.parentCategoryId !== parent.id || existing.isActive !== parent.isActive || existing.isRestricted !== parent.isRestricted)) {
        throw new Error(`Existing subsection conflicts with plan: ${section.slug}`);
      }
      const id = existing?.id ?? `section_${digest(section.slug).slice(0, 24)}`;
      if (!existing && snapshot.categories.some(c => c.id === id)) throw new Error(`Category ID conflict: ${id}`);
      targets.set(section.slug, id);
      if (!existing) create.push({ id, name: section.name, slug: section.slug, parentCategoryId: parent.id, isActive: parent.isActive, isRestricted: parent.isRestricted, sortOrder: section.sortOrder });
    }
    for (const product of products) {
      const target = classify(parent, product.name);
      moves.push({ productId: product.id, name: product.name, from: parent.id, to: targets.get(target.slug), subsection: target.name });
      if (!target.pattern) review.push({ productId: product.id, name: product.name, parent: parent.name, subsection: target.name });
    }
  }
  return { version: 1, fingerprint: digest(snapshot), create, moves, review };
}
module.exports = { digest, makePlan };
