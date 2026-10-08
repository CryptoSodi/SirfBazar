# API host handoff — icons, category subsections and merchant workflows

Prepared 8 October 2026. This is a runbook for Codex on the laptop that actually hosts `api.sirfbazar.com`, not a shell script. Read it before executing commands.

## Request to paste into Codex on the API laptop

> Fetch `origin/codex/unified-icons-mobile-signup` from `CryptoSodi/SirfBazar`. Read `AGENTS.md`, `docs/API-UPDATE.md`, `docs/CATEGORY-SUBSECTIONS.md` and the referenced release reviews. Prepare the API update using this runbook. Preserve my working environment, WhatsApp OTP, database and uploads. Inspect the running service and local changes first; do not reset or overwrite them. Back up and verify recovery before mutations. Show the production category plan before applying it. Coordinate the API restart with the matching frontend release because checkout now requires approved quotes. Do not publish master, reseed, run db push, change provider credentials or send real OTP/payment/order requests without my direction. Report the deployed commit, checks and any blockers without exposing secrets.

## Release boundaries

- Branch: `codex/unified-icons-mobile-signup`. Fetch it explicitly; a normal pull of `master` will NOT retrieve these changes.
- Includes the reviewed remediation commit `5bbb9659ce8d82416bde7e1c9a50e115b58511ed`, then the icon/signup/category release changes. Record the exact fetched HEAD before deploying; don't deploy an unreviewed later commit by accident.
- Live `master` was `c603943ea232c1247e374ca35e3e99b0bcfc5c06` when checked. Confirm the actual host revision; do not assume it matches.
- API changes are not just icons: quote-based checkout, financial/stock/auth repairs, import preview and scoped upload size, plus descendant category filters and parent-coupon matching. See `remediation-final-review-2026-10-07.md` and `api-contract.md`.
- No Prisma schema change is included. No `prisma db push`, reset, seed, merge-categories, demo stocking, scraper import, or disposable-test SQL against production.
- Preserve `.env`, secrets, JWT/quote-signing settings, WAHA/WhatsApp sessions, Google/push settings, database, Cloudflare Tunnel configuration, catalogue images and uploaded merchant documents. Do not replace them with files from another laptop or print them.
- New category data changes only `Category`, `Product.categoryId` and rollout audit entries. It does NOT change product/merchant IDs, prices, discounts, stock, barcode/SKU, approval, prescription/restriction flags, orders, refunds or settlements.
- Mobile source changes do not update already-installed APKs. Those require new builds and separate device checks.

## 1. Inspect and protect the current host

Read repository instructions and current deployment records. Determine the repository path, live process manager/service, working directory, entrypoint, Node version, runtime storage paths, database identity and tunnel status. Inspect Git status and local commits. Do not reset, force checkout, auto-stash, force-push, kill all Node processes or reconfigure the tunnel.

From the host checkout, these are read-only/fetch operations (use the host's required command wrapper, e.g. `rtk proxy`):

```powershell
git status --short
git rev-parse HEAD
git remote -v
git fetch origin codex/unified-icons-mobile-signup
git log --oneline HEAD..origin/codex/unified-icons-mobile-signup
git diff --stat HEAD...origin/codex/unified-icons-mobile-signup
```

Prefer a separate release checkout/worktree for preparation; leave the running checkout untouched until the cutover is understood. If there are live-only fixes, compare and carry them forward deliberately. Stop and ask about conflicts instead of overwriting them.

Record the current deployed commit and process configuration. Make a full PostgreSQL backup with `pg_dump -Fc` using the existing connection configuration without exposing its password. Save it outside Git. Verify the dump with `pg_restore --list`; preferably restore it into an isolated scratch database and validate counts. Listing a dump is only an archive-integrity check, not a complete restore test. Also back up runtime configuration and uploads securely. Do not proceed without a usable backup and a concrete rollback path.

## 2. Prepare and verify without changing live

Use Node 22 for this release. Install from `apps/api/package-lock.json` in the isolated release checkout. Do not run package install over the active service's files.

From that checkout's `apps/api`:

```powershell
npm ci
npm run prisma:generate
npm run typecheck
node -r ts-node/register/transpile-only --test test/category-sections.test.cjs
npm run test:pos
npm run test:waha
npm run test:whatsapp
```

The WAHA/WhatsApp suites are mocks; review that isolation before running them. Never run `smoke`, seed or database test scripts with the production URL. The category database regression requires a fresh, disposable `category_test` database on a non-live localhost port. Its SQL fixture is for a NEW disposable database only.

Confirm the existing database matches the committed schema by read-only inspection, particularly the existing auth, push and audit tables used by remediation. If something is missing, stop and report it; this runbook does not authorize improvising migrations.

The repository normally prohibits starting/building another API over an owned process. For this explicit deployment, use the host's established isolated production build procedure only after confirming it cannot overwrite the running build. Confirm the built entrypoint and preserve its rollback artifact. Don't start a second API or WAHA process on the live port during preparation.

## 3. Generate and review the production category plan

From the prepared `apps/api`, securely supply the host's existing `DATABASE_URL`. The script uses the process environment first, otherwise its local `.env`. Never copy a test URL into the live configuration. Confirm the selected database identity privately before continuing.

Use a new absolute path outside Git for `category-plan.json`:

```powershell
node scripts/category-rollout.cjs plan <absolute-path-to-new-category-plan.json>
```

`plan` reads categories and all products, including unapproved products; it does not write the database. It refuses to overwrite an existing plan file. Keep this file private/outside Git because host product names may include pending catalogue submissions.

Review `create`, `moves`, `review` and `fingerprint`. Show the owner the subsection counts and ambiguous names, not secrets. Specifically confirm Fresh Fruits / Fresh Vegetables under Fruits & Vegetables and Chicken / Beef / Mutton / Seafood under Meat & Seafood. Parent IDs remain unchanged. Existing nested products are left in their current categories. New children inherit the parent's active/restricted state and artwork.

The public snapshot used in development had 26 roots and 2,610 products, producing 123 subsections with no unmatched names. These are reference counts, NOT required production counts. Classification is based on parent-scoped name rules; inspect it before applying. Unknown names on the host go into an explicit Other subsection and are listed for review. If a mapping is wrong, change/review the source rule and regenerate the plan; do not hand-edit the JSON to bypass verification.

## 4. Coordinate the cutover, then apply

**Do not restart the new API while old checkout clients are still taking orders without an agreed maintenance/cutover window.** The new backend requires approved quotes. Coordinate website, merchant dashboard/IPOS, standalone POS and compatible customer APK versions. Do not weaken the payment or quote guards merely to accommodate old clients.

Have the matching frontend artifacts ready. During the agreed cutover, pause catalogue/admin edits and checkout using the site's existing operational procedure. If there is no safe procedure, ask the owner; don't invent a destructive workaround.

Restart only the identified API service with the verified new build, using its existing environment, storage paths and process manager. Do not restart WAHA, clear sessions or change Cloudflare routing as part of this update. First verify the backend is healthy. Then, after owner review of the plan and verified backup:

```powershell
node scripts/category-rollout.cjs apply <absolute-path-to-reviewed-category-plan.json> --backup-verified <backup-reference>
```

The backup reference is a non-secret name/path identifying the verified backup. The flag is an operator acknowledgement, not a substitute for making or testing the backup.

The script locks category/product writes, regenerates the plan inside a serializable transaction and rejects stale or altered plans. Failure rolls back all changes, including category inserts and audit entries. A successful result reports `created`, `moved` and `planHash`. Preserve those values and the exact plan file. If anything changed after the plan was generated, generate and review a new one; do not force it through. Don't blindly repeat a timed-out apply: inspect the audit entry and current plan first.

## 5. Read-only smoke and client release gate

- Check `https://api.sirfbazar.com/docs-json` includes `/api/orders/quote` and `/api/merchant/products/bulk-preview`.
- Check `/api/products/categories` returns the expected child sections with preserved root IDs.
- Compare `/api/products/catalog?categoryId=<parent-id>` with child-category totals. Approved products directly on the parent plus approved descendants should equal the parent total. Check Fruits & Vegetables and Meat & Seafood specifically.
- Verify public product images still resolve and the API service logs show no startup/schema/storage errors. Do not disclose OTPs, tokens or customer data from logs.
- Generate a fresh read-only category plan; normally `create` and `moves` are zero immediately after rollout. Save it to a NEW filename.
- Verify WhatsApp/WAHA readiness using the existing host health check without sending a real OTP or exposing session details. Auth/signup delivery tests need an owner-approved phone number.
- Test checkout/import/financial mutations only with designated staging/test accounts and data. Do not place real orders, create refunds, or import into a real shop for smoke testing without explicit approval.

Report the backend commit, rollout hash, category counts and checks to the owner. Only then promote the same reviewed branch to the production frontend branch/Vercel projects. This hosting-laptop handoff does not by itself authorize pushing `master` or publishing unrelated changes. The original release chat can finish that coordinated promotion.

## Rollback

Keep checkout/catalogue writes paused while diagnosing. A failed apply is transactional and requires no data rollback. For a successfully applied category plan that must be undone:

```powershell
node scripts/category-rollout.cjs rollback <absolute-path-to-original-applied-plan.json> --backup-verified <backup-reference>
```

Rollback requires a matching database audit entry, restores only recorded product category assignments, and deactivates only newly created empty subsections; it never deletes their IDs or changes stock/prices. It refuses later category reassignments or new references such as products/coupons and rolls back that rollback transaction on failure. Stop for manual reconciliation if refused. Reapplying after rollback intentionally needs a newly reviewed plan/state reconciliation because the deactivated categories still exist.

Revert the API build only through the identified service's saved previous artifact/configuration, coordinated with clients. Do not roll the API back to exact-parent-only filtering while products remain assigned to children. Do not restore a whole database backup over new orders/payments just to undo categories; use the guarded rollback or a reviewed reconciliation plan. A full backup restore is a separate recovery decision requiring the owner's approval.

## Return to the release chat

Provide: deployed SHA; API route checks; root/child/product counts; plan hash; backup/restore verification result; WhatsApp health result (no secret details); checkout/client compatibility status; any remaining blockers. Say explicitly whether the API is merely prepared or actually restarted and live. Keep the review plan and backup on the host, not in Git.
