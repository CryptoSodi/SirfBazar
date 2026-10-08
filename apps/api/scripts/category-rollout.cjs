'use strict';
// Run on the API host using its EXISTING environment. Plan is read-only.
// Apply accepts only a freshly regenerated exact plan, after a verified backup.
const fs = require('node:fs');
if (!process.env.DATABASE_URL && fs.existsSync('.env')) process.loadEnvFile('.env');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { makePlan, digest } = require('./category-plan.cjs');
const prisma = new PrismaClient();
async function snapshot(db) {
  return {
    categories: await db.category.findMany({ select: { id: true, name: true, slug: true, parentCategoryId: true, isActive: true, isRestricted: true } }),
    products: await db.product.findMany({ select: { id: true, name: true, categoryId: true } }),
  };
}
async function main() {
  const [command, filename, acknowledgement, backupReference] = process.argv.slice(2);
  if (!['plan', 'apply', 'rollback'].includes(command) || !filename) throw new Error('Usage: node scripts/category-rollout.cjs plan <new-plan.json> OR apply|rollback <plan.json> --backup-verified <backup-reference>');
  if (command === 'plan') {
    const plan = makePlan(await snapshot(prisma));
    fs.writeFileSync(path.resolve(filename), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Read-only plan: ${plan.create.length} subsections; ${plan.moves.length} products; ${plan.review.length} Other assignments to review. No database writes.`);
    return;
  }
  if (acknowledgement !== '--backup-verified' || !backupReference?.trim()) throw new Error('A verified database backup reference is required. See docs/API-UPDATE.md.');
  const approved = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
  const planHash = digest(approved);
  const result = await prisma.$transaction(async tx => {
    // Do not race catalogue/admin writes during the short cutover. Failure rolls back everything.
    await tx.$executeRawUnsafe('SET LOCAL lock_timeout = \'5s\'');
    await tx.$executeRawUnsafe('LOCK TABLE "Category", "Product" IN SHARE ROW EXCLUSIVE MODE');
    if (command === 'rollback') {
      const audit = await tx.auditLog.findFirst({ where: { action: 'CATEGORY_SUBSECTIONS_ROLLOUT', entityId: planHash } });
      if (!audit?.newValue) throw new Error('No matching applied plan in this database. Nothing was changed.');
      if (await tx.auditLog.findFirst({ where: { action: 'CATEGORY_SUBSECTIONS_ROLLBACK', entityId: planHash } })) throw new Error('This plan was already rolled back.');
      const saved = JSON.parse(audit.newValue);
      if (digest(saved.moves) !== digest(approved.moves.map(({ productId, from, to }) => ({ productId, from, to }))) || digest(saved.created) !== digest(approved.create.map(c => c.id))) throw new Error('Plan does not match the saved audit.');
      // Use the server-recorded mapping. Refuse to overwrite later reassignment.
      for (const move of saved.moves) {
        const updated = await tx.product.updateMany({ where: { id: move.productId, categoryId: move.to }, data: { categoryId: move.from } });
        if (updated.count !== 1) throw new Error('Products changed after rollout. Automatic rollback refused; transaction cancelled.');
      }
      const ids = saved.created;
      if (await tx.product.count({ where: { categoryId: { in: ids } } }) || await tx.category.count({ where: { parentCategoryId: { in: ids }, id: { notIn: ids } } }) || await tx.coupon.count({ where: { applicableCategoryId: { in: ids } } })) throw new Error('New data references these subsections; automatic rollback refused.');
      // Never delete category IDs; empty new subsections become inactive.
      await tx.category.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      await tx.auditLog.create({ data: { action: 'CATEGORY_SUBSECTIONS_ROLLBACK', entityType: 'Category', entityId: planHash, newValue: JSON.stringify({ backupReference, restoredProducts: saved.moves.length, deactivatedCategories: ids }) } });
      return { restored: saved.moves.length, deactivated: ids.length, planHash };
    }
    const current = makePlan(await snapshot(tx));
    if (digest(current) !== planHash) throw new Error('Catalogue or plan changed. Generate a new plan and review it; nothing was applied.');
    for (const category of current.create) {
      // New children inherit existing artwork AND restriction/active state.
      const parent = await tx.category.findUniqueOrThrow({ where: { id: category.parentCategoryId }, select: { iconUrl: true } });
      await tx.category.create({ data: { ...category, iconUrl: parent.iconUrl } });
    }
    for (const move of current.moves) {
      const updated = await tx.product.updateMany({ where: { id: move.productId, categoryId: move.from, name: move.name }, data: { categoryId: move.to } });
      if (updated.count !== 1) throw new Error(`Concurrent change for product ${move.productId}; rolling back.`);
    }
    await tx.auditLog.create({ data: { action: 'CATEGORY_SUBSECTIONS_ROLLOUT', entityType: 'Category', entityId: planHash, newValue: JSON.stringify({ planHash, backupReference, created: current.create.map(c => c.id), moves: current.moves.map(({ productId, from, to }) => ({ productId, from, to })) }) } });
    return { created: current.create.length, moved: current.moves.length, planHash };
  }, { isolationLevel: 'Serializable', timeout: 120000, maxWait: 10000 });
  console.log(JSON.stringify(result));
  console.log(`${command} completed atomically. Keep the plan and verified backup. Merchant prices, stock, product flags and IDs are unchanged.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
