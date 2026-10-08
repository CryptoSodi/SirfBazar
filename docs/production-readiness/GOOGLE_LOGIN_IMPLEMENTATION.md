# Google Login Implementation Evidence

Date: 2026-10-08. Branch: `codex/google-login-completion`.
Base: `codex/server-api-deployment` at
`6c316b065a5cda72b0fad509d1b76a5d70a4bf9b`.

**Overall status: PARTIAL. Local implementation and approved OAuth registrations
are configured; consent publishing and end-to-end/native release verification
remain incomplete. Nothing was committed, pushed or deployed by this task.**

This is a follow-up to the historical Phase 0 [audit](AUDIT.md), not a replacement
for that evidence or approval to implement all of its findings. Only Google-login
work was subsequently authorized. No replacement apps/backend were created.

## Why Login Was Incomplete

Existing Google SDK integrations and a shared Web client ID were present; the
feature was not wholly absent. The active merchant web route, however, used a
placeholder Google action while another legacy login screen contained older
integration code. Native helpers did not handle the installed SDK's cancellation
response safely or supply complete iOS setup. The API allowed mock provider mode
without a production guard and had incomplete real-provider validation.

The current work extends the existing release code rather than reverting to the
older main branch. It retains guest-first checkout, approved interface structure,
themes, rider workflows, quote-compatible clients and WhatsApp OTP paths.

## Application Coverage

Paths below are relative to the repository root.

| App/control | Status | Implementation evidence | Remaining evidence |
| --- | --- | --- | --- |
| API Google proof | VERIFIED in isolated tests | `apps/api/src/auth/google/google-auth.service.ts`: official SDK, mandatory audience, issuer/signature/expiry/verified-email checks, cached public keys with 5s fetch deadline, generic errors, production mock rejection | Real Google token against an isolated running API; production env not inspected |
| API account association | VERIFIED in isolated tests; PARTIAL integration | `apps/api/src/auth/auth.service.ts`: subject-first identity, safe email-link conditions, active status, app-role checks, conditional writes, sorted advisory locks, private `google-link` | Actual PostgreSQL concurrent requests/rollback and cross-flow races not exercised |
| Customer website | PARTIAL | `apps/web/components/LoginSheet.tsx`, `GoogleAccountLink.tsx`, `app/profile/page.tsx`: existing login, pending guard, profile linking, guest flow retained | Real Google callback, guest merge and full responsive/profile E2E |
| Merchant website | PARTIAL | `apps/shop/src/auth/GoogleSignIn.tsx`, `SignInPage.tsx`, `SignupFlowPage.tsx`, `lib/api.ts`: active-route Google login, active staff sessions, optional post-OTP link, resumable verified setup | Real registration/linking and role-denial E2E |
| Admin | PARTIAL | `apps/admin/src/pages/Login.tsx`, `components/GoogleAccountLink.tsx`, `AdminHeaderTools.tsx`: existing Google login hardened; settings link; same admin context | Real permitted/denied admin identities and responsive settings check |
| POS | PARTIAL | `apps/pos/src/pages/Login.tsx`, `components/GoogleAccountLink.tsx`, `App.tsx`: login guard, account linking, wrapping header | Real owner/staff session and device layout checks |
| Customer native | PARTIAL | `apps/customer-app/lib/google.ts`, `components/LoginSheet.tsx`, `GoogleAccountLink.tsx`, `screens/ProfileScreen.tsx`, `app.config.js`, `eas.json`; approved provider registrations saved | Actual artifact/Play signer, release-signed Android/iOS login and physical-device UI |
| Merchant native | PARTIAL | `apps/merchant-app/lib/google.ts`, `screens/LoginScreen.tsx`, `MoreScreen.tsx`, `components/GoogleAccountLink.tsx`, `app.config.js`, `eas.json`; approved provider registrations saved | Actual artifact/Play signer and physical-device login/linking |
| Rider native | PARTIAL | `apps/rider-app/lib/google.ts`, `screens/RiderLoginScreen.tsx`, `RiderProfileScreen.tsx`, `components/GoogleAccountLink.tsx`, `app.config.js`, `eas.json`: cancelled/repeated-tap handling; onboarding consent retained; approved registrations saved | Actual artifact/Play signer and real rider onboarding/login/device regression |
| Production Google provider | UNVERIFIED | No server env inspection or mutation in this batch | Verify configuration securely before a separately approved release |

The new link endpoint requires the existing JWT guard, accepts no client-selected
user/role, preserves phone/email/memberships and refuses cross-account conflicts.
It does not add account merging, unlinking, fresh-password step-up or MFA. Broad
rate limiting/session/storage controls remain covered by the separate audit.

## Executed Checks

| Check | Result and scope |
| --- | --- |
| API `npm run test:google` | PASS, 35 tests. Real RSA-signed synthetic tokens through Google SDK; mocked certificate transport; in-memory identity fixtures; public/private route metadata; bad link proof does not invalidate app session |
| `node --test scripts/test-google-native.cjs` | PASS, 18 tests. Actual helper/config code with fake native SDK: cancellation, single flight, errors, Play services, iOS requirements, config preservation; all nine EAS profiles match registered native IDs and iOS clients |
| `node --test scripts/test-google-clients.cjs` | PASS, 20 tests. Actual handlers with mocked hooks/SDK/transport: seven app link controls, merchant login widget, rider pending guard, owner/staff session adapter |
| API build | PASS after final API changes |
| Shop/admin/POS production builds | PASS; shop reports a large-chunk warning |
| Website default Turbopack build | FAIL locally: worker exited before connection while writing `/page` / processing global CSS; also failed outside sandbox |
| Website `npm run build -- --webpack` | PASS, compiled/typechecked and generated 17 static pages; default build script unchanged |
| All three native typechecks | PASS; all rerun after provider/build configuration changes |
| Actual Expo configuration | PASS in separate processes: local envs resolve the three distinct registered iOS callback schemes and unchanged package/bundle IDs |
| Subsequent Android APK candidates | All three EAS preview APKs FINISHED; downloaded signatures, package IDs and non-debuggable status verified. See [APK build evidence](ANDROID_APK_CANDIDATES.md) for artifacts, checksums and unresolved Expo Doctor warnings. No device E2E or store submission |
| WhatsApp transport/auth regressions | PASS with fake provider/in-memory fixtures; no messages sent |
| Existing customer native tests | PASS, 45 tests |
| Existing merchant native tests | PASS, 7 tests plus 3 push-lifecycle tests |
| Existing rider native tests | PASS, 3 push-lifecycle tests |
| Existing website/POS recovery tests | PASS, 3 checkout-recovery and 3 sale-recovery tests |
| Existing shop IPOS tests | PASS, 12 tests |
| `git diff --check` | PASS; setup/report local Markdown links also resolve |
| Merchant browser desktop/mobile | Google SDK button rendered on the active sign-in route; signup owner form retained. Narrow viewport: document width 312 CSS px, Google control width 231 px without horizontal overflow. Temporary viewport overrides removed |
| Merchant provider popup | Initial `origin_mismatch` at `http://127.0.0.1:5194` resolved after approved origin addition: fresh preview reaches Google's SirfBazar account chooser. Popup closed; no real credential or API session obtained |

The 73 focused Google tests are not full browser automation, real native SDK
instrumentation, live Google verification, or a database concurrency test.
No OTP, order, payment, upload, production load/security test or migration ran.

Only the API manifest/lockfile gains a new runtime dependency,
`google-auth-library`; frontend/native packages already had their Google SDKs.
Locked dependencies were restored for build checks. Package installation reported
dependency advisories, including critical items in API/native trees.
No broad `npm audit fix` or unrelated upgrades were performed; attribution and
remediation remain release work.

## Provider Configuration Follow-up

Access is now resolved using the owner-selected signed-in Google account. The
existing project `sirfbazar` (`453311658725`) and shared Web client were retained.
With explicit approval, seven Web origins were added, three correctly matched
iOS clients were created, four additional Android package/SHA registrations were
created, and the sole approved test user was saved. Console creation/save results
and the final 11-client inventory were observed. Existing release Android clients
match the default EAS signing SHA-1 values, inspected read-only. All native EAS
profiles and local env examples now supply their corresponding Google IDs.

Exact public identifiers, SHA-1 values and evidence are recorded in
[Google OAuth configuration](GOOGLE_OAUTH_CONFIGURATION.md).

Remaining limitations:

1. Consent remains External/Testing. Publish is disabled pending Branding
   completion; homepage, privacy-policy and terms links are blank. No public
   publishing, legal acceptance, scope or IAM change was performed.
2. The approved machine-debug key differs from the shared Expo SDK 54 template
   debug key. The shared key was not registered. Actual Gradle/APK signing reports
   must establish debug-build coverage; an EAS credential is not proof of a
   shipped artifact's certificate. The subsequently built release-signed APK
   certificates now match their registered defaults; Play App Signing remains
   unverified.
3. Three direct-download Android testing candidates were subsequently built and
   verified, but no device completed Google login and no IPA was built. Future
   native configuration changes require a rebuild. Remediation-suffix builds need
   separate provider registrations.
4. Real provider tokens against an isolated API/database and production-origin
   behavior remain unverified. No API was started against an unknown database.

See [setup variables and provider checklist](../google-login.md) for exact app
identifiers, normal origins and configuration steps. Reuse the existing Google
project/Web ID; do not create duplicate infrastructure to bypass access controls.

## Security And Compatibility Notes

- F02 is addressed in local source/tests, but remains PARTIAL at deployment level.
  Production mocks are rejected and real Google verification fails closed.
- **F01 remains an independent P0 release gate:** public merchant registration
  can mutate existing identity credentials before OTP. No production exploit or
  account enumeration was performed, and this Google batch does not remediate it.
- App context is still resolved server-side; Google authentication does not
  confer staff, owner or admin permission. Rider new-account consent still yields
  the existing onboarding flow, not automatic shop membership.
- The login API shape is unchanged; linking is additive and changes only the
  existing `googleId` field. No schema change or data migration is required.
- API startup now rejects invalid Google configuration, so env verification is
  mandatory before rollout. Deploy compatible API support before link-enabled
  clients; do not restore an unsafe mock-capable production release as rollback.
- API local changes affect only Google variables. Native public build variables,
  env examples and ignored local envs now match approved provider settings.
  Database/JWT/WhatsApp values, live server configuration, Cloudflare and deployment
  secrets were not changed. The auto-deployment activation guard remains disabled.

## Next Verification Batch

Preserve the configured SirfBazar OAuth clients and approved origins. Obtain
owner-approved consent completion and verify actual native signing identities.
Use isolated test identities/database for real login and explicit linking in all
apps, including role denial, duplicate taps, account conflicts, cancellation,
offline recovery, logout/account switching and the actual native signing builds.
Record provider settings and results without tokens/secrets.

Before any production release, separately close F01, validate the live env,
resolve/reproduce the default website build failure on its deployment runner,
and approve rollout/rollback. No broader audit remediation, deployment activation
or live database mutation is implied by this report.
