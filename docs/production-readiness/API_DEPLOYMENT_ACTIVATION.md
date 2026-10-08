# API Auto-Deployment Activation

Date: 8 October 2026 (Asia/Karachi). Status: **active, first deployment verified**.

## Release And Trigger

- Repository: `CryptoSodi/SirfBazar`.
- Production API branch: `codex/server-api-deployment`, not `master`.
- Google implementation commit: `24b8763a930a0ae5d8d041c7a5259873a3ae41e4`.
- [Pre-activation CI](https://github.com/CryptoSodi/SirfBazar/actions/runs/37779844790): all checks passed; deployment deliberately skipped.
- [First production push run](https://github.com/CryptoSodi/SirfBazar/actions/runs/37781032321): all checks and `deploy-api` passed.
- First release: `24b8763a930a0ae5d8d041c7a5259873a3ae41e4-37781032321-1`.
- Previous release: `1ab4208e5196998aa74643e8d334c62a8c0dd9fb`.
- Both the source branch `codex/google-login-completion` and production API branch received the implementation. `master` and frontend production promotion were not changed by this activation.

Future pushes to the production API branch deploy only after all required CI
jobs pass. Pull requests, other branches and manual workflow dispatch cannot
deploy. This is API deployment, not Google consent publishing or a Play/App Store
release. Subsequent documentation-only pushes retain the same application code
but still run the guarded workflow.

## Authorization And Boundaries

The owner explicitly requested auto-deployment after an earlier prepare-only
decision. They also approved backing up the live configuration, correcting only
the Google provider/client ID, restarting only `sirfbazar-api.service`, and
testing recovery in a new isolated scratch database before removing it.

Only SirfBazar deployment infrastructure was installed. No PostgreSQL runtime
configuration, live schema/data migration, Caddy/DNS routing, other application
service, WhatsApp credential or provider session was changed. Frontend designs,
guest checkout and rider behavior were preserved.

## Verified Controls

| Control | Evidence |
| --- | --- |
| Full CI gate | API build/typecheck/tests and packaged smoke, web/admin/shop/POS builds, three native typechecks/tests, browser fixtures, disposable database regressions, deployment tests passed |
| Focused Google tests | 35 API plus 38 client/native tests passed; synthetic tokens and mocked providers, not a live login |
| Deployment helper tests | 20/20 on Linux, including successful promotion and failed-health rollback fixtures; five mocked health-check tests passed |
| Schema guard | Local and live schema files matched before deployment; no migration executed |
| Restricted SSH | Only `upload`, `deploy`, `status`; non-mutating shell/SCP/SFTP/arbitrary-command probes rejected; `status` succeeded |
| Private runtime boundary | Root-owned helper returns release/service metadata; deploy account has no direct runtime-directory or environment access |
| GitHub environment | `sirfbazar-api-production`, exact branch policy `codex/server-api-deployment` |
| Secrets | Only `API_DEPLOY_SSH_KEY` and `API_DEPLOY_KNOWN_HOSTS`; dedicated key, host key retrieved via trusted admin SSH and matched existing known_hosts |
| Activation | Repository variable `SIRFBAZAR_API_DEPLOY_ENABLED=true` |
| Backup and restore | Custom PostgreSQL dump restored into a unique scratch database; all 31 tables / 4,074 rows matched; scratch database removed |
| Storage/config backup | Private runtime-storage archive listing verified; original environment and service unit backed up outside Git |
| Live verification | Exact release SHA and compiled Google SDK confirmed; service active with zero automatic restarts; public Google-link OpenAPI route present |
| Health | Local/public catalog, categories, nearby discovery, coupons, sample image, quote/import routes, CORS and WhatsApp readiness passed; website HTTP 200 |
| Isolation | Service unit and every non-Google environment value unchanged; other application service PIDs unchanged. A transient operator user-session service changed during SSH work |

Backup location (root-private):
`/var/backups/sirfbazar-api/activation-20261008-69a779dc045f`.
It includes `restore-proof.json` and per-commit post-deployment proof. Each
automatic promotion also writes its own database dump and deployment proof under
`/var/backups/sirfbazar-api`.

Dedicated deployment key location on the operator machine:
`D:\keys\SirfBazar\deployment\sirfbazar-api-production-ed25519`.
Its folder ACL is restricted to the current Windows user and SYSTEM. This is not
an APK signing key or administrator key. Never commit or print the private key.

## Google Login Incident

The previously running API had `NODE_ENV=production` but
`GOOGLE_AUTH_PROVIDER=mock` and an empty Web client ID. A user-initiated Google
login returned HTTP 401 because the API expected a development mock token; the
website's generic 401 message incorrectly presented this as an expired session.

The approved correction set `GOOGLE_AUTH_PROVIDER=google` and the existing Web
audience `453311658725-s55gcpidi4h6kf38hgqhmrku11ha02ts.apps.googleusercontent.com`.
The new process environment and compiled SDK verifier were checked after
deployment. Google's public signing-certificate endpoint returned HTTP 200 from
the server. No Google token, OTP or user credential was printed or recorded.

After deployment, the owner retried Google sign-in on `www.sirfbazar.com` and
reported **"Google sign-in works"**. This is owner-confirmed customer-web login,
not independent verification of every role, account-linking or device journey.
Google consent remains External/Testing; other client/device journeys and audit
finding F01 remain open. Deployment success is not a full production-readiness
certification.

## Recovery

The workflow refuses schema drift, verifies pre/post health, and restores the
previous code pointer on a failed promotion. It never automatically restores the
live database. Keep the corrected real-Google settings when rolling back code;
do not restore production mock authentication. Disable future deployments by
setting the repository activation variable to `false`. Consult
[the runbook](../API-AUTO-DEPLOYMENT.md) before manual recovery.

Keys, password files, environment files, APKs and the 234 MiB generated scraper
ZIP remain outside Git. Scraper source was not removed.
