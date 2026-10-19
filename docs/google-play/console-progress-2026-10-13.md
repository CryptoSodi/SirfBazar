# Play Console progress - 13 October 2026

This record supplements the earlier readiness audit. Draft creation, asset upload,
bundle validation, test distribution and public publication are separate states.

## Owner decisions

- The owner approved the US export declaration for all three apps.
- The owner approved Developer Program Policies acceptance for all three apps and
  confirmed support will fulfill account-and-data deletion requests at
  `support@sirfbazar.com` using the documented manual process.
- Manual fulfillment is an operational commitment, not evidence of a completed
  erasure test or an automated erasure implementation.
- Under the owner's instruction to choose ordinary listing details, use free apps,
  English (US), Pakistan-only distribution and an intended adult audience (18+).
  Distribution and audience are not saved until verified in their Console forms.
- Categories: Shopping for Customer; Business for Merchant and Rider.

## Created app records

Developer account: LudoCities (`5606090932663776281`).

| App | Package | Console app ID |
| --- | --- | --- |
| SirfBazar: Local Shopping | `pk.sirfbazar.customer` | `4974237851366309616` |
| SirfBazar Merchant | `pk.sirfbazar.merchant` | `4975742202861729293` |
| SirfBazar Rider | `pk.sirfbazar.rider` | `4972894916911202627` |

All three drafts were created. Privacy-policy URLs were saved for all three.
English descriptions, role-specific icons and feature graphics were uploaded and
saved as listing drafts. Actual phone screenshots are still required; feature
graphics are not substitutes for screenshots.

Categories and contacts are saved for all three: Customer Shopping; Merchant and
Rider Business; `support@sirfbazar.com`; `https://www.sirfbazar.com`. The initial
scheme-less Merchant/Rider website entries were corrected to explicit HTTPS.

All three dashboards show **6 of 11 initial setup tasks complete**: privacy
policy, category/contact details, no ads, not a government app, no health
features, and no financial-service features. Order/COD and settlement records
are commerce functionality, not banking, lending, investment or wallet services.
These saved declarations have not been sent for review.

The owner separately approved IARC terms. All three questionnaires are saved and
the Console shows IARC status Completed. All have ESRB Everyone / PEGI 3 / IARC
3+ ratings. Customer additionally has USK 16+ for increased communication risks:
public reviews lack dedicated blocking/reporting controls. Location sharing was
declared for Customer and Rider. Target audience remains blocked by incomplete
Sign in details. No personal Google credentials were supplied. See
[reviewer access](reviewer-access.md) for the approved isolated account work.

## Bundle progress

All three build-6 AABs were uploaded, processed and saved as internal-testing
release drafts. Play recognized version `6 (1.0.0)`, minimum API 24 and target SDK
36, with native debug symbols attached. Each preview had two warnings and no
reported errors: no testers configured, and no deobfuscation mapping file.
Generated native build configuration defaults release minification to false;
the build script does not enable it. The mapping warning is expected for these
non-R8-obfuscated builds. No rollout was performed.

The locally verified artifacts and hashes are recorded in
[build6-verification.md](build6-verification.md). Console screenshots are in
ignored `output/play-{customer,merchant,rider}-bundle-validated.jpg`.

## Signing and remaining work

Update 14 October: all three recorded Play signing certificates now have Android
OAuth clients. Customer native Maps authorization failed during device checks;
its separately approved repair is in progress. See
[current signing and reviewer follow-up](play-signing-follow-up-2026-10-14.md).
The statements below describe the earlier registration baseline.

Play automatically shows Google-managed signing for the newly created app.
No local private keystore was uploaded or changed. Play distribution certificates
must be registered with Google OAuth/Maps and Play-installed sign-in verified.
Do not infer those registrations from the existing sideload/upload certificates.

Current **app signing** SHA-1 fingerprints copied from each Console page (not the
separate upload-key certificate section):

| Package | Google Play app signing SHA-1 |
| --- | --- |
| `pk.sirfbazar.customer` | `36:24:71:D3:51:82:F5:B7:C2:CC:CE:B8:51:BE:15:24:6F:68:B7:02` |
| `pk.sirfbazar.merchant` | `9D:71:12:A1:75:24:D5:E9:7B:EC:76:8E:FD:7B:65:02:6F:8E:71:41` |
| `pk.sirfbazar.rider` | `81:8B:7E:53:6D:E9:43:CF:A1:F1:FA:29:04:CF:3F:93:60:53:5A:59` |

These public fingerprints are recorded for provider registration; recording them
does not configure OAuth or Maps. Existing local release/upload keys remain
unchanged. Play also lists previous quantum-ready certificates; verify signing
coverage for supported Android versions before distribution.

Historical remaining work at the 13 October inspection: store forms, screenshots,
data safety, reviewer access, rating, audience, countries, signing-provider
configuration, device testing and submission. The approved isolated reviewer
accounts were subsequently activated and live-tested, and private Sign in details,
store forms and screenshots were submitted on 14 October; see
[submission evidence](production-submission-progress-2026-10-14.md) and
[reviewer coverage](reviewer-access.md). Fresh onboarding/upload and Play-installed
verification remain unverified. This dated record does not establish current
public availability; see the [maintenance records](README.md) for later releases.
