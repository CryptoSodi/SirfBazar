# Master consolidation

## Scope

Requested on 8 October 2026: maintain one release branch and one backend, preserving the other developer's frontend improvements.

- Master baseline: `fa84f3d7ef814b411aa3ac63f06b790660b9c9de`.
- Oracle release source: `c376055fa1f9596a824680753db3f578bf696335`, shared by `codex/server-api-deployment` and `codex/google-login-completion`.
- Integration branch: `codex/consolidate-master`.
- The merge updates the existing `apps/api`. It creates no replacement app, second API service or database. Historical Git commits and branches are not deleted.

## Preservation and compatibility

- `apps/api`, including its Prisma schema, is unchanged from the Oracle source above. No migration, schema push, seed, category move or production data mutation is part of consolidation.
- Preserve master's merchant catalogue Design A, nested categories, selection/review pane, accessible validation, CSV import, immutable retry and responsive light/dark styling.
- Preserve master's customer subcategory navigation, plain-language errors, persistent toasts, quote-compatible checkout and saved-request recovery.
- Add the Oracle branch's verified Google token handling, account linking, role checks, native clients and release/deployment tooling. Retain guest-first browsing, cart recovery and rider functionality.
- Keep existing APK download links and package/signing records. Merging mobile source does not replace already installed APKs or complete pending native-device checks.
- Keep live Google/WhatsApp configuration, JWT secrets, PostgreSQL, Caddy, DNS, uploads and all other Oracle services unchanged.

## Release gates

The single required `release-checks` aggregate fails unless deployment helper tests, API build/smoke, web, admin, all five other clients, isolated browser fixtures and disposable-database regressions succeed. API promotion accepts only a push to `master`, with the repository activation flag and existing production environment permission.

Browser fixtures include both the Oracle reliability journeys and master's catalogue Design A/customer feedback journeys. API calls are intercepted; no real order, login, OTP or payment is submitted. Browser selectors were aligned with the preserved UI, not by reverting the UI to older tests.

Before merging, require the owner's requested branch protection and an independent approving review, since another write-capable collaborator is available. Never weaken checks or approve the author's own pull request. After merge, verify the master CI deployment, server release pointer and read-only health checks before recording production completion.

## Verification status

Consolidation and local verification are in progress. Remote master and the running production release have not yet been changed by this integration. Record the final PR, CI and deployment evidence here when available; a prepared branch alone is not a completed production deployment.

## Rollback

The API source is already the live release, so this changes the release source rather than introducing an API/schema upgrade. If promotion health checks fail, the existing helper restores the previous code pointer and restarts only `sirfbazar-api.service`. Never automatically restore the database. For a frontend regression, revert the narrow offending change through the same reviewed master workflow; do not replace master with the historical branch or discard the other developer's UI.
