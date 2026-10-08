# Google Login Setup

Updated 2026-10-08. Implementation status and executed checks are recorded in
[the Google implementation report](production-readiness/GOOGLE_LOGIN_IMPLEMENTATION.md).
This is configuration guidance, not authorization to deploy or change live data.

## Existing Project

Reuse project number `453311658725` and the existing Web OAuth client:

```text
453311658725-s55gcpidi4h6kf38hgqhmrku11ha02ts.apps.googleusercontent.com
```

Access was resolved using the owner's explicitly selected signed-in account.
The console confirms project ID `sirfbazar`, number `453311658725`. The approved
Web origins, three iOS clients, four additional Android registrations and one
owner-approved OAuth test user are now saved in this existing project. Existing
release registrations and signing keys were preserved. See the dated
[provider inventory](production-readiness/GOOGLE_OAUTH_CONFIGURATION.md).
Client IDs are public identifiers. This ID-token integration needs no client secret
in any browser, mobile app, or API environment.

Later on 2026-10-08, three owner-managed release signers from `D:\keys\SirfBazar`
were registered with approval. They are selected only by the new
`release-keystore` build profile; old remote signing defaults are preserved.
See the provider inventory and [new candidate report](production-readiness/ANDROID_LOCAL_RELEASE_CANDIDATES.md).

## Variables

| App | Google variables | Local API configuration |
| --- | --- | --- |
| `apps/api` | `GOOGLE_AUTH_PROVIDER=google`, `GOOGLE_CLIENT_ID=<existing Web ID>` | `PORT=3001`; retain existing database/JWT/OTP configuration |
| `apps/web` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<existing Web ID>` | `NEXT_PUBLIC_API_URL=http://localhost:3001/api` |
| `apps/shop` | `VITE_GOOGLE_CLIENT_ID=<existing Web ID>` | `VITE_API_URL=http://localhost:3001/api` |
| `apps/admin` | `VITE_GOOGLE_CLIENT_ID=<existing Web ID>` | `VITE_API_URL=http://localhost:3001/api` |
| `apps/pos` | `VITE_GOOGLE_CLIENT_ID=<existing Web ID>` | `VITE_API_URL=http://localhost:3001/api` |
| `apps/customer-app` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<existing Web ID>`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<customer iOS ID>` | `EXPO_PUBLIC_API_URL=http://localhost:3001/api` |
| `apps/merchant-app` | Same Web ID; its own merchant iOS ID | Same local API URL |
| `apps/rider-app` | Same Web ID; its own rider iOS ID | Same local API URL |

Use ignored local environment files and the deployment platform's existing
environment settings. Rebuild clients after changing public build-time variables.
All three native `eas.json` files now supply the shared Web ID and their own iOS
ID in development, preview and production profiles. Matching `.env.example` and
ignored local `.env` files are configured; local API URLs remain localhost.
Previously configured release API URLs were preserved.
On a physical phone, `localhost` refers to the phone: use an explicitly selected,
reachable development-machine address, never silently fall back to production.

The API defaults to the real provider. Missing/invalid Web client IDs fail startup.
An explicit `GOOGLE_AUTH_PROVIDER=mock` remains available for isolated development
fixtures only; `NODE_ENV=production` rejects it. The sample API env opts into that
local fixture explicitly. The current ignored local API env was changed only to
the real Google provider and existing Web ID; the API was not started/restarted.

## Web Console Checklist

The following production/development JavaScript origins are saved in the
existing Web client. Existing origins were preserved:

| Surface | Production origin | Normal development origin |
| --- | --- | --- |
| Customer website | `https://sirfbazar.com`, `https://www.sirfbazar.com` | `http://localhost:3000` |
| Merchant website | `https://shop.sirfbazar.com` | `http://localhost:5174` |
| Admin | `https://admin.sirfbazar.com` | `http://localhost:5173` |
| POS | `https://pos.sirfbazar.com` | `http://localhost:5175` |

Google origins include scheme/host/port, not paths. `http://localhost` and
`http://127.0.0.1:5194` are also saved. The temporary preview previously returned
`origin_mismatch`; after this update it reaches Google's SirfBazar account chooser.
No real credential/API session was obtained. If testing on a different host or
port, register that exact origin separately. These clients use a JavaScript credential callback,
not a new API redirect endpoint. Keep scopes limited to the existing basic
`openid`, `email`, and `profile` use. See [Google's Web setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

API CORS is a separate allowlist. Preserve existing allowed applications and
WhatsApp settings; do not broaden CORS to fix an OAuth-origin error. Deployment
headers, popup restrictions and real logins on production origins still need
verification. The consent audience remains External/Testing with one approved
test user. Publishing is disabled pending Branding completion; homepage,
privacy-policy and terms links are blank. Do not publish consent changes or accept new terms
without the required owner action/approval.

## Native Console Checklist

| App | Android package / iOS bundle identifier |
| --- | --- |
| Customer | `pk.sirfbazar.customer` |
| Merchant | `pk.sirfbazar.merchant` |
| Rider | `pk.sirfbazar.rider` |

Android needs an OAuth registration for each actual package/signing-certificate
SHA-1 combination in the same Google project. Check local debug, EAS release and
Play App Signing certificates separately. Android client IDs are not the Web
audience sent by `lib/google.ts`. For iOS, obtain an iOS client for each bundle
identifier and put its ID in that app's environment. All three were created and
wired into the existing configuration; exact IDs are in the provider inventory.
These requirements follow
the [SDK configuration guide](https://react-native-google-signin.github.io/docs/setting-up/get-config-file).

The three `app.config.js` files derive the reversed iOS URL scheme from the iOS
client ID and reject an EAS iOS build without it. Existing plugins, themes and
remediation-build settings are retained. Remediation builds append `.remediation`
to identifiers and therefore need matching separate provider registrations.
Google sign-in needs a rebuilt native development/release app, not Expo Go;
the existing config plugin handles the iOS URL scheme. See the [Expo SDK guide](https://react-native-google-signin.github.io/docs/setting-up/expo).

Read-only inspection of this machine's standard debug keystore found SHA-1:

```text
08:92:E3:BA:8C:FA:F3:45:D2:DC:CB:AC:DC:43:60:A2:D3:B4:90:EC
```

The three approved package registrations for this machine key are now saved.
This is NOT evidence that an actual SirfBazar APK uses that key. In particular,
the Expo SDK 54 template uses a different shared debug keystore. That shared
key was NOT registered; inspect each actual artifact/signing report and use a
controlled debug key before claiming debug-build coverage. The provider inventory
records the exact fingerprints and limitations.

Read-only EAS credential inspection confirmed that all three default signing
SHA-1 values match the existing Android clients. The customer's additional stored
EAS certificate was also registered with approval. No private signing keys were
generated, replaced or downloaded. Play App Signing certificates and real
Android/iOS device logins remain unverified. OAuth Android clients use SHA-1;
iOS clients use bundle IDs, not Android SHA fingerprints.

## Account Behavior

- Google proves identity, not merchant/admin/rider authorization. Existing role
  and membership checks still determine the app-scoped session.
- The API uses Google's SDK to verify signature, audience, issuer, expiry and
  verified email. It resolves established identities by Google `sub`; new email
  links are automatic only for Google-authoritative email identities. This
  follows [Google's verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
- Phone/password users can sign in normally and select **Link Google to this
  account** from their profile/settings. `POST /auth/google-link` requires both
  their bearer session and a Google ID token. It changes only `googleId`, never
  phone, email, role or memberships. No automatic account merge or unlink exists.
- Duplicate/conflicting Google subjects or email matches fail safely. A third-party
  mailbox may require existing-account sign-in followed by explicit linking.
- New customer Google identities can self-register. Merchant/admin Google login
  cannot silently create privileged identities. Rider login retains its explicit
  new-rider consent and existing application/approval workflow.
- Merchant website signup retains owner details, CNIC, password and phone OTP.
  Optional Google selection stays in memory until verified registration, then
  links the same identity. Failure can be retried or skipped; returning verified
  sessions can resume shop setup. This is not passwordless merchant registration.
- Guest browsing/checkout and guest-cart merging remain on the existing paths.
  Cancellation is a no-op; Google errors must not create an empty-token request.
- Invalid login proof is 401. During linking, invalid Google proof/conflicts are
  400 so a valid app session is retained; invalid app authentication is still 401.
  Certificate-service outages are 503. Clients do not silently retry Google login.

## Verification Commands

Run from the repository root after installing each app's locked dependencies:

```powershell
rtk proxy npm --prefix apps/api run test:google
rtk proxy node --test scripts/test-google-native.cjs scripts/test-google-clients.cjs
rtk proxy npm --prefix apps/api run test:whatsapp
rtk proxy npm --prefix apps/api run build
rtk proxy npm --prefix apps/shop run build
rtk proxy npm --prefix apps/admin run build
rtk proxy npm --prefix apps/pos run build
rtk proxy npm --prefix apps/web run build -- --webpack
rtk proxy npm --prefix apps/customer-app run typecheck
rtk proxy npm --prefix apps/merchant-app run typecheck
rtk proxy npm --prefix apps/rider-app run typecheck
```

The focused tests use synthetic Google signatures, fake transport/SDK and
in-memory database fixtures. They send no OTP, make no production mutations,
and do not establish PostgreSQL concurrency or real provider/device behavior.
The standard Web Turbopack build failed locally; the explicit Webpack build
passed. The build script itself was not changed.

## Release And Rollback

1. Preserve the configured provider inventory. Complete owner-approved consent
   branding/publishing and verify actual artifact/Play signing identities before
   a public release; do not change the shared Web audience or signing keys.
2. Use an isolated database/API and owned test identities for real login,
   linking, denied-role, cancelled-popup, offline, expired-token, account-switch
   and cross-device checks. Verify the actual release-signed native artifacts.
3. Resolve the separate P0 existing-account registration issue **F01** in the
   [audit](production-readiness/AUDIT.md) before a production readiness sign-off.
   This Google batch does not fix or certify the other audit controls.
4. Before an authorized release, securely verify the live API's Google provider,
   Web audience, `NODE_ENV`, CORS and client build variables. Preserve the full
   existing live configuration, PostgreSQL and WhatsApp OTP integration. Release
   API support before clients that expose linking. No schema migration is needed.
5. Smoke-test only approved test accounts, preserving role and tenant boundaries.
   Auto-deployment activation remains disabled and requires separate approval.

Compatibility: `/auth/google-login` keeps its request/response shape. Linking is
additive. Strict provider/startup validation can expose previously invalid env
settings; validate before replacing a running API. Existing sessions and account
links are not deleted by this change.

Rollback: roll back affected client releases first or hide the optional Google
control, retaining phone/password access. Keep the hardened API verifier and
production mock rejection. Do not roll back to an API that accepts unproved mock
identities, restore a live database, or remove users' Google links. If a server
rollback is unavoidable, use a reviewed release retaining these security guards
and the additive endpoint for any already-released clients.
