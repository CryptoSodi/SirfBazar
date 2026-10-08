# Master consolidation

## Scope

Requested on 8 October 2026: maintain one release branch and one backend, preserving the other developer's frontend improvements.

- Master baseline: `fa84f3d7ef814b411aa3ac63f06b790660b9c9de`.
- Oracle release source: `c376055fa1f9596a824680753db3f578bf696335`, shared by `codex/server-api-deployment` and `codex/google-login-completion`.
- Additional developer UI source: `23a8570412a4b419125cb6a9b471450c44880ae8` on `codex/unified-icons-mobile-signup`. Its web work was already published to master; its native feedback work is also included, preserving newer Google authentication.
- Integration branch: `codex/consolidate-master`.
- The merge updates the existing `apps/api`. It creates no replacement app, second API service or database. Historical Git commits and branches are not deleted.

## Preservation and compatibility

- `apps/api`, including its Prisma schema, is unchanged from the Oracle source above. No migration, schema push, seed, category move or production data mutation is part of consolidation.
- Preserve master's merchant catalogue Design A, nested categories, selection/review pane, accessible validation, CSV import, immutable retry and responsive light/dark styling.
- Preserve master's customer subcategory navigation, plain-language errors, persistent toasts, quote-compatible checkout and saved-request recovery.
- Include the other developer's native customer/merchant/rider error redaction and toast hosts, including modal hosts and native feedback parity tests. These source changes do not silently rebuild or distribute APKs.
- Add the Oracle branch's verified Google token handling, account linking, role checks, native clients and release/deployment tooling. Retain guest-first browsing, cart recovery and rider functionality.
- Keep existing APK download links and package/signing records. Merging mobile source does not replace already installed APKs or complete pending native-device checks.
- Keep live Google/WhatsApp configuration, JWT secrets, PostgreSQL, Caddy, DNS, uploads and all other Oracle services unchanged.

## Release gates

The single required `release-checks` aggregate fails unless deployment helper tests, API build/smoke, web, admin, all five other clients, isolated browser fixtures and disposable-database regressions succeed. API promotion accepts only a push to `master`, with the repository activation flag and existing production environment permission.

Browser fixtures include both the Oracle reliability journeys and master's catalogue Design A/customer feedback journeys. API calls are intercepted; no real order, login, OTP or payment is submitted. Browser selectors were aligned with the preserved UI, not by reverting the UI to older tests.

On 8 October 2026 the owner explicitly rescinded the independent approving-review requirement and authorized merging without waiting for the collaborator. Pull requests remain required, with zero required approving reviews. Preserve the required CI checks, strict up-to-date checks, conversation resolution, administrator enforcement and prohibition on force pushes/deletion; do not use an administrator bypass. After merge, verify the master CI deployment, server release pointer and read-only health checks before recording production completion.

## Verification status

- [Consolidation PR #2](https://github.com/CryptoSodi/SirfBazar/pull/2) targets master; the owner authorized immediate merge once required checks pass, without waiting for `mazharmehdi`.
- [Initial CI run 37807030699](https://github.com/CryptoSodi/SirfBazar/actions/runs/37807030699) passed all release gates for `7c76552`, including Linux production packaging/smoke, disposable database regressions and browser journeys. [CI run 37808060489](https://github.com/CryptoSodi/SirfBazar/actions/runs/37808060489) also passed all 12 checks for the complete native feedback merge at `e2615ec`; PR deployment was correctly skipped. The documentation-only approval update must also pass required CI before merging.
- Local API and all four web-app builds, native typechecks, Google/WhatsApp/POS/recovery tests, release-gate tests and mocked browser journeys passed for the initial merge. Windows Turbopack encountered a worker crash; Webpack passed locally and the unchanged normal Turbopack build passed Linux CI. No production build setting was weakened.
- The additional native feedback merge passed all three native typechecks, 48 customer tests, 7 merchant authentication tests, both merchant/rider push-lifecycle suites (3 tests each), and the 20-case cross-client Google harness. It does not alter the already-verified web apps or API. Its native feedback test is now part of the customer CI script rather than an unexecuted file.
- Interface review: retained merchant light/dark catalogue and customer checkout/subcategory screenshots; keyboard, toast layering and responsive fixtures passed at 320-1440px. Fixtures intentionally use missing/empty product data to check recovery. Real native-device login, checkout and notification rendering remain separate release gates.
- Master protection is saved with `release-checks` bound to GitHub Actions, strict up-to-date checks, required pull requests with zero required approving reviews, conversation resolution, admin enforcement and no force pushes/deletion. Production environment deployment permission is master only; secrets were not changed.
- At this pre-merge documentation checkpoint, remote master and the running Oracle release have not yet been changed by this integration. A prepared/approved PR is not a completed production deployment. The PR merge record, subsequent master CI run and post-deployment evidence on PR #2 record the actual cutover; verify the server release pointer before reporting success.

## Rollback

The API source is already the live release, so this changes the release source rather than introducing an API/schema upgrade. If promotion health checks fail, the existing helper restores the previous code pointer and restarts only `sirfbazar-api.service`. Never automatically restore the database. For a frontend regression, revert the narrow offending change through the same reviewed master workflow; do not replace master with the historical branch or discard the other developer's UI.
