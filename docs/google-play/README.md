# Google Play publication readiness

Last inspected: 2026-10-13. Base: `6463f3cc05b6bca2f4da5228a58bec2461551d41`.
Release preparation: PR #21, `codex/google-play-publication`.

**Not published or submitted.** This folder contains preparation, not evidence
of Google approval. No SirfBazar app was created in Play Console in this run.
No production service, database, signing key, or Google OAuth registration was changed.

Owner follow-up: the business name is **Sirf Bazar** and the public support/deletion
mailbox is now **support@sirfbazar.com** (replaces the earlier .pk address).
Terms, Privacy, Contact and a public `/account-deletion` email-request page have
been implemented locally, with footer links. They have not been deployed. This
is not a completed data-erasure system or legal-compliance certification.

## Account and listings

Play Console was inspected under the owner-specified Google account
`syedtassaduqhussainabidi@gmail.com`, developer account **LudoCities**
(`5606090932663776281`). No existing SirfBazar entries were present.
The public support mailbox `support@sirfbazar.com` was confirmed active by the
owner. The Google Cloud OAuth project and Play developer account are separate.

| App | Android package | Proposed category | Status |
| --- | --- | --- | --- |
| SirfBazar: Local Shopping | `pk.sirfbazar.customer` | Shopping | Local listing/assets prepared |
| SirfBazar Merchant | `pk.sirfbazar.merchant` | Business | Local listing/assets prepared |
| SirfBazar Rider | `pk.sirfbazar.rider` | Business | Local listing/assets prepared |

English listing copy, candidate tags and release notes are in `listings.json`.
Pakistan-only availability is a proposal, not a saved console setting. Tags
must be selected from the actual console options; candidate tags are not
represented as verified taxonomy. Ratings and audience declarations remain open.

## Assets and validation

Run from the repository root using the existing installed `sharp` dependency:

```powershell
rtk proxy node scripts/prepare-play-listing-assets.cjs
```

Output: `output/google-play-2026-10-13/<customer|merchant|rider>/`.
Each app has a 512x512 PNG icon, 1024x500 opaque PNG feature graphic, editable
feature-graphic SVG, and separate listing text files. Graphics use the existing
role-specific brand artwork, not replacement logos. All three graphics were
visually inspected. Metadata/character limits passed and are recorded in
`output/google-play-2026-10-13/listing-validation.json`.

These graphics are **not app screenshots**. Customer and merchant build-4 APKs
installed successfully in the local API-36.1 emulator, but captured launch
images were entirely black. This does not establish an app crash or a successful
native launch; emulator rendering and launch behavior still need diagnosis.
Those images must not be uploaded as store screenshots. Rider native testing
and authenticated feature screenshots remain unverified.

## Build preparation

All three `eas.json` files now contain a separate `play-store` profile extending
the existing production-configured `preview` profile, with store distribution,
Android App Bundle output, automatic version increment and local signing keys.
Existing APK profiles remain intact.

Validate locally without uploading anything:

```powershell
rtk proxy pwsh.exe -NoProfile -File scripts/Start-SirfBazarReleaseBuild.ps1 -Profile play-store
```

The script prompts privately for existing passwords. Its optional `-PasswordFile`
accepts the owner's designated local file; never commit that file or its contents.
Adding `-Submit` queues EAS builds using the previously authorized signing
service. **It does not submit to Google Play.** Do not queue a publication build
until the required mobile fixes below are included.

Both default APK and new AAB signing-profile validation passed for all three
existing release keys. EAS submission was attempted on 13 October with source
`3a329dd`. Customer versionCode incremented from 4 to 5 and its archive uploaded,
but EAS rejected the build because the account's free Android build quota was
exhausted (reported reset: 1 November 2026). No new bundle or queued build ID was
returned; merchant and rider submissions were not attempted after that failure.
Temporary local credentials.json was removed and no paid plan was purchased.
The GitHub release
`android-build4-2026-10-11` contains APKs, not Play-ready verified AAB releases.

Before upload, verify package/version, signing certificate, permissions, target
SDK, native library 16 KB alignment, and a Play-delivered build on a device.
APK ZIP alignment alone does not verify ELF library alignment. Establish the
Play App Signing key decision before enrollment: a different distribution
certificate requires corresponding Google login and Maps registrations and
can affect upgrades from sideloaded APKs. Do not disclose private signing keys
to a new service without specific authorization.

## Publication gates

| Gate | Evidence / current state | Required next action |
| --- | --- | --- |
| Account/data deletion | `apps/api/src/customers/customers.service.ts`, `deleteAccount`, only sets `DELETED` and revokes refresh tokens | Implement a genuine request/fulfillment process and test data handling; disabling access alone is insufficient |
| All-role deletion entry | All three profile/settings views now include `AccountPolicies`; merchant/rider login also expose links. Customer deletion screen opens an email request instead of falsely completing erasure | Verify updated native builds and remaining onboarding states; deploy the public web resource |
| Privacy/retention | Updated policy describes precise location, all roles and request-based deletion. Owner requested customary retention; selected targets are in `deletion-operations.md`, not yet enforced | Test actual fulfillment, verify retention settings and deployed policy; do not claim the targets already operate |
| Data safety | Source inventory is in `data-safety-review.md`; no questionnaire submitted | Reconcile SDKs, backend recipients and deployed configuration; complete each app's answers accurately |
| Reviewer access | No approved review accounts or tested review instructions established | Provide restricted, stable access to customer, approved merchant and approved rider flows; no shared production-admin credentials or auth bypass |
| Google login readiness | Live console inspected on 13 October: project `sirfbazar` / `453311658725`, External/Testing, one test user. Publish disabled pending branding. Homepage/privacy/terms fields empty | Complete branding after policy deployment, obtain publication approval where required, register Play signing SHA and test Play-installed sign-in |
| Android permissions | Build-4 merchant manifest includes microphone, legacy storage and overlay permissions. New config disables image-picker microphone and gallery flow uses the system photo picker without broad gallery permission | Inspect rebuilt merged manifest, trace remaining permissions and test camera/gallery cancellation and denial |
| Native journeys/screenshots | Installation succeeded for two APKs; launch captures black | Diagnose rendering, test all apps and capture genuine screenshots without personal information |
| AAB and prelaunch checks | Profiles/key validation passed; EAS quota blocked the attempted build | Obtain build capacity or use a verified local toolchain, inspect bundles, then test track and Play checks |
| Console declarations | Create App requires policy certification and export declaration; neither accepted | Complete truthful declarations and obtain action-time confirmation for binding terms when ready |

## Decisions needed from owner

1. Business/operator name supplied: **Sirf Bazar**. No further name is required.
2. Retention baseline selected following the owner's instruction: see
   `deletion-operations.md`. Applicable financial obligations and actual operations
   must still be verified before publishing fixed-period guarantees.
3. Suitable reviewer access and confirmation of intended countries and audience
   before those declarations are submitted.

Do not invent retention periods or claim regulatory compliance. An email request
path can be part of the solution, but it must lead to actual verified fulfillment,
with disclosed legitimate retention exceptions. The same login can participate
in multiple roles; deletion must address linked roles and financial obligations
without erasing another merchant's records or misleading the requester.

## Tests actually run

- Listing text length and PNG dimension/opacity assertions: passed for all apps.
- Visual inspection of three feature graphics: passed.
- Signing profile/private-key password/certificate validation: passed for all apps
  with both the default APK and `play-store` profiles; no password output.
- `git diff --check`: passed.
- Customer and merchant APK installation on emulator: passed.
- Native visual launch and authenticated journeys: **not verified**.
- All three mobile typechecks and 69 existing mobile tests: passed.
- New policy-link tests: 11 passed; Google-client tests: 22 passed after adding
  the new rider policy component to the isolated login test harness.
- AAB build: **attempted, blocked by quota**. Play upload, review and production
  publication: **not performed**.

The initial preparation changed no runtime code. Follow-up updates website
policies, native policy/deletion-request entry points and merchant photo permissions.
Backend runtime and database migrations remain unchanged.
See `website-policy-checks.md` for the website checks. Existing dummy product CSV is untouched.

## Official references

- [Create and set up an app](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Account and associated-data deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Photo/video permission policy](https://support.google.com/googleplay/android-developer/answer/14115180)
- [Android native page-size support](https://developer.android.com/guide/practices/page-sizes)

Google review and publication are separate from preparing these files. This
document must not be used as a blanket compliance certification.
