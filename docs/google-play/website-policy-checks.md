# Website policy update - 13 October 2026

Owner supplied the business name **Sirf Bazar** and instructed that public
support and account-deletion requests use **support@sirfbazar.com**, replacing
the previously supplied .pk mailbox.

## Scope and behavior

- Expanded `/terms` and `/privacy-policy` using existing public Next.js routes.
- Added `/account-deletion`: a public, no-login email-request pathway covering
  customer, merchant and rider accounts. Its mailto link contains a subject only,
  not automatically collected user details. Opening it does not send an email.
- Contact page, policy navigation, website footer and Play listing drafts use
  the approved address. Removed the placeholder WhatsApp number and unverified
  hours from Contact. Existing seeded support-agent credentials are not public
  support contact details and were deliberately not changed.
- Reused `ProsePage`, with theme-token text colors, wrapping for long addresses
  and unframed readable content. Existing brand/header/navigation remain intact.
- Updated text distinguishes deletion requests from completed erasure. No
  automatic backend deletion, migration, mailbox provisioning or mail delivery
  verification was implemented or performed.

Interaction states: policy links navigate to public pages without a session;
the deletion email opens the user's email application; the visible address and
subject provide a fallback when no handler is configured. Light/dark styling and
narrow-screen line wrapping are supported. There is no fake submission-success UI.

## Executed checks

| Check | Result |
| --- | --- |
| `npm test` in `apps/web` | 34 passed, 0 failed, including 7 new legal-page checks |
| `npm run build` | Failed: Turbopack CSS worker exited before connection for existing `LocationControl.module.css`; reproduced outside sandbox |
| `npm run build -- --webpack` | Passed, including TypeScript and static generation of Terms, Privacy, Contact and Account deletion |
| `git diff --check` | Passed |
| Listing asset regeneration/validation | Passed; all three descriptions use .com |
| Chrome desktop Privacy | Rendered with one H1, visible policy navigation and no horizontal overflow at measured 2048 CSS pixels |
| Chrome narrow-mobile deletion/Terms | Navigation verified, readable wrapping, no horizontal overflow at measured 312 CSS pixels (browser zoom affected requested viewport dimensions) |
| Light/dark appearance | Visually checked on deletion page; desktop Privacy inspected in dark theme and captured in light theme |
| Email target | DOM inspected: `mailto:support@sirfbazar.com?subject=SirfBazar%20account%20and%20data%20deletion%20request` |

Local screenshots: `output/legal-mobile-preview.jpg` and
`output/legal-desktop-preview.jpg`. Preview: `http://127.0.0.1:3016/privacy-policy`,
using `NEXT_PUBLIC_API_URL=http://localhost:3001/api`. No production API mutations.
The repository-requested `better-*` skills were not found in the installed skill
roots; the existing design conventions and manual responsive/accessibility review
were used. This is not a full screen-reader or mobile-app test.

## Still required before Play submission

The website content is pushed in PR #21, **not yet deployed**. All three mobile
profile/settings views now include deletion-request and policy links; merchant
and rider login views also expose them. The customer request screen opens email
instead of calling the legacy soft-disable endpoint. Component tests passed;
updated native builds, onboarding-state coverage and full workflows still need
device verification.

An email-request page does not prove deletion fulfillment. Following the owner's
request for customary retention, `deletion-operations.md` records selected
processing/retention targets. The operational erasure process, retained financial
evidence and backup expiry remain unverified. No live erasure was performed.

Policy wording should receive appropriate legal review before publication; this
change does not certify legal or Google Play compliance. No fixed retention,
deletion completion deadline, jurisdiction clause or corporate address was invented.
