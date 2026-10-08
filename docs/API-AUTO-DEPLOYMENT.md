# SirfBazar API push deployment

## Status: prepared, not activated

On 8 October 2026 the owner selected `codex/server-api-deployment` as the production API branch, then declined creation of a deployment account and GitHub credentials. This change prepares the workflow only. It does not create an account, install server scripts, create a GitHub environment, add secrets, enable a variable, restart the API, or replace production code.

The API already runs on `129.153.16.84`. Production uses the dedicated `sirfbazar-api.service`, existing native PostgreSQL database `sirfbazar`, and the direct Cloudflare A record plus Caddy route to `127.0.0.1:3002`. It does not require a tunnel or a running Windows API.

## What a future enabled push will do

1. Run the existing API, web, admin, POS/shop/mobile, browser-fixture and disposable-database CI checks, plus deployment helper tests. Production is not contacted during those checks.
2. Build the exact pushed commit with Node 22 on Ubuntu 24.04. Install production dependencies from the lockfile in a separate runner-temporary directory and include the Linux-generated Prisma client.
3. Package code and dependencies only. The archive has a per-file SHA-256 manifest; `.env`, databases, uploads, documents and provider sessions are not included. Validate the archive on the runner.
4. Send the archive through a dedicated forced SSH command. Verify its overall checksum again on the server. Reject path traversal, hard links, device files, privileged permissions, unexpected top-level paths, unsafe symbolic links, excess size, missing files and manifest mismatches.
5. Reject any Prisma schema difference from the running release, ignoring Windows/Linux line endings. There is no automatic migration, `db push`, reset, seed, category rollout, import or demo stocking.
6. Check the existing API and WhatsApp readiness; make a root-private, custom-format backup of only `sirfbazar` and verify its archive listing. Promote the immutable release pointer and restart only `sirfbazar-api.service`.
7. Check local and public anonymous catalogue/categories, nearby discovery, coupons, a sample self-hosted image when available, quote/import-preview routes, website/POS CORS and the authenticated WhatsApp `/ready` endpoint. No OTP, order or payment is sent. Confirm the live environment and service file are unchanged.
8. On restart or health failure, restore the previous code pointer, restart only SirfBazar and repeat the checks. Never restore the database automatically: orders may have arrived after restart. Report failure even when rollback succeeds.

The deployment job requires **all** CI dependencies to pass. It accepts only a `push` to `refs/heads/codex/server-api-deployment` with the **repository-level** variable `SIRFBAZAR_API_DEPLOY_ENABLED` equal to `true`. Missing or false means skipped. Pull requests, other branches, `master`, tags and manual CI dispatch cannot deploy. Deployment concurrency does not cancel an in-flight promotion; a server lock also prevents overlapping promotions.

## Activation requires new owner approval

Do not run the steps below under the current "prepare only" authorization.

1. Approve the restricted account and GitHub environment secrets separately. Review this runbook, the helper source, `docs/API-UPDATE.md`, and the exact branch diff. Coordinate incompatible API/client releases and the maintenance/checkout pause procedure. Mobile source alone does not update installed APKs.
2. Verify a recoverable database/configuration/storage backup. The automated `pg_restore --list` check validates an archive, not a full restore; verify recovery in an explicitly approved, isolated scratch database before activation. Never restore over the live database as a test.
3. Generate a dedicated, unencrypted Ed25519 deployment key in private storage outside Git. Do not reuse the administrator/Oracle key. Securely retain the private key for the GitHub environment and put only its public key on the server. Treat workflow edits as production-sensitive even though SSH access is restricted.
4. Transfer the reviewed `deploy/api` helper directory from a Linux checkout and the public key to a private operator staging directory on `129.153.16.84`. Run the installer explicitly as the administrator:

   ```bash
   sudo bash deploy/api/install.sh /private/path/sirfbazar-deploy.pub --approved
   ```

   This creates only `sirfbazar-deploy`, its root-owned SSH authorization file, root-owned helpers and a sudo rule for the single validating promotion helper. It refuses to overwrite a pre-existing account or helper installation. The password is locked; the login shell exists only so SSH can execute the forced command. Authorized-key restrictions disable shell access, PTY and forwarding. Do not install an unrestricted authorized key for this user.

5. Verify the account cannot run `bash`, `id`, SCP/SFTP, arbitrary paths or other service commands. Verify `status` reports the existing release and `active`. Exercise the helper tests in disposable directories on Linux before any real promotion; do not aim fixtures at production.
6. Create the GitHub environment `sirfbazar-api-production`, restrict deployment branches to the exact `codex/server-api-deployment` name, and configure required reviewers if the release process requires approval per push. Preserve existing Vercel environments. Store these **environment secrets** without printing them or committing them:

   | Secret | Value |
   | --- | --- |
   | `API_DEPLOY_SSH_KEY` | Dedicated `sirfbazar-deploy` private key, not an administrator key |
   | `API_DEPLOY_KNOWN_HOSTS` | Pinned, independently verified SSH host-key entry for `129.153.16.84` |

   Obtain the host key through the already trusted administrator SSH connection and compare its fingerprint with trusted server records. Do not populate this secret using an unauthenticated `ssh-keyscan` during a workflow. Do not add PostgreSQL credentials, JWT secrets, WhatsApp keys or the production `.env` to GitHub. The destination IP and account are fixed in the workflow; there are no host/user variables.

7. Only after the above checks and explicit activation approval, set the **repository** variable `SIRFBAZAR_API_DEPLOY_ENABLED=true`. Environment-scoped variables are not suitable for the job-level activation guard. Push a reviewed commit to the selected branch and verify the actual workflow, server pointer, service and public API. Do not call automatic deployment active until that first real deployment completes successfully.

GitHub's [environment protection rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) provide a second branch/reviewer boundary. The workflow keeps the activation guard separate from environment secrets, consistent with [GitHub configuration variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables).

## Live configuration and isolation

The server keeps `/etc/sirfbazar-api.env`, including `DATABASE_URL`, existing JWT/quote settings, `OTP_PROVIDER=whatsapp`, `WHATSAPP_API_BASE_URL`, `WHATSAPP_API_KEY`, CORS, Google and push settings. New code requiring extra runtime variables needs an approved operator configuration update before deployment; the workflow never overwrites this file.

The service still uses `/var/lib/sirfbazar-api` as its working directory. Catalogue images, uploads and private documents remain there rather than inside a code release. The workflow never changes Caddy, Cloudflare DNS, PostgreSQL configuration/roles, Docker, other APIs or WhatsApp provider sessions. Existing services and their ports are not restarted or reconfigured.

Only the promotion helper may run as root. It verifies command arguments, copies the bounded upload to root-private storage, validates/extracts it into a new root-owned release, and freezes permissions before promotion. It never runs repository application code, npm lifecycle scripts or uploaded programs as root. The static health checker runs as `sirfbazar-api`, which already has permission to read the runtime environment.

## Operations and recovery

- Release layout: `/opt/sirfbazar-api/releases/<commit>-<run-id>-<attempt>`; `/opt/sirfbazar-api/current` points to the active release. The release ID and manifest identify the exact deployed Git commit. GitHub also verifies `status` after promotion.
- Backups and deployment proofs: `/var/backups/sirfbazar-api`, root-only. Runtime users and GitHub cannot download them. Keep established migration/recovery backups intact.
- Uploads: `/var/lib/sirfbazar-deploy/incoming`; private copied archives: `/opt/sirfbazar-api/deploy-work`. Failed releases/uploads stay for inspection. Successful uploads are removed. There is no automatic deletion of old release or database backups.
- Upload/promotion refuse to start with less than 3 GiB free. Monitor disk usage and make an approved retention plan; a dump/list verification failure blocks cutover. The deployer cannot clean up root-owned backups.
- Schema changes require a separately reviewed migration and compatible-client release; do not bypass the schema guard to get CI green.
- Disable future promotions by deleting or setting the repository activation variable to `false`. This does not abort an in-flight deployment or stop the live API. Remove the dedicated key from its authorization file to revoke new SSH access if necessary.
- For emergency code recovery, inspect the deployment proof and restore the recorded previous symlink as an administrator, then restart **only** `sirfbazar-api.service` and run the read-only health checker as its API user. Do not change DNS, restore data automatically, restart PostgreSQL, start a second API writer, or reactivate the old Windows API.
- A hard power loss or `SIGKILL` cannot run rollback logic. Inspect the current pointer, deployment journal/proof, backup and service before resuming. A failed rollback requires operator intervention; do not repeatedly rerun an unsafe release.

## Local verification

```powershell
rtk proxy python -B -m unittest discover -s deploy/api -p "test_*.py" -v
rtk proxy node --test deploy/api/healthcheck.test.cjs
rtk proxy node --check scripts/build-api-release.cjs
```

Linux CI additionally checks installer syntax, API typecheck/build and the real Linux production package. Helper tests use temporary files and mocked HTTP only; they do not contact production. Server installation, forced-key login, database backup/recovery and real promotion remain unverified until activation is approved.
