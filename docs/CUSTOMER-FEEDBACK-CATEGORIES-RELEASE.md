# Customer categories and application feedback release

## Scope

Customer search now renders the API category tree as expandable parent sections, with selectable children and a visible subsection bar. A child filter resolves its own category ID, preserving the search term. The current website design is retained; no category data is hardcoded or migrated.

The live checkout error was a frontend/backend contract mismatch: the production customer page lacked the newer basket ID, UUID request ID and approved-quote flow already present on the development branch. This release includes that flow, validates the saved payload before submission, and preserves the same request after an uncertain result. It does not automatically place or retry orders.

Seven client apps share a tested plain-language error policy. API status, codes and details remain available for recovery logic; raw validation arrays and infrastructure diagnostics are not rendered. Action notifications use floating toast hosts. Errors remain until dismissed; web success messages pause their timeout on hover/focus. Native screen-reader mode keeps success messages available until dismissed. Structural recovery screens, confirmations and field-specific validation stay in context.

Web hosts follow native dialogs, modal panels and fullscreen. Native modal hosts take precedence over the root host. All hosts use readable text, non-colour status labels and explicit dismissal, without entrance animation or focus stealing.

## Release boundary

- Publish the four web frontends and their required frontend dependencies only.
- Native source is updated on the development branch; installed applications need new APKs and device verification.
- No API source, database, migration, credentials, hosting configuration, or WhatsApp OTP integration changes.
- The release also carries the required existing frontend icon adapters and customer checkout recovery helpers. It does not merge the entire development branch into production.

## Verification

- Customer web production build and merchant production build passed.
- Admin and standalone POS TypeScript passed; Vite builds passed with `--configLoader runner` (the default config bundler encounters a Windows permissions issue locally).
- Customer, merchant and rider native TypeScript passed.
- 90 automated tests passed: customer web 9, merchant web 23, customer native 48, merchant native 7, standalone POS 3. The native policy tests also cover the rider error helper; rider has no separate screen test suite.
- Mocked customer browser journey: friendly error redaction, no inline action error, valid basket/UUID/quote payload, unchanged retry after reload, child-category API filtering, and no overflow at 320/390/768/1440 px.
- Toast remained visible after 5.5 seconds, moved inside a top-layer dialog and returned to the body when the dialog closed.
- Mocked merchant catalogue regression: category filtering, bulk selection, partial retry, keyboard/focus, dialog draft retention, dark appearance, and responsive widths 320–1440 px.
- All browser mutations were intercepted fixtures, not real orders or inventory changes.

## Interface review

The better-interface workflow and its six focused skills informed the review: clear parent/child grouping (layout), consistent surfaces (UI), readable text hierarchy (typography), contrast plus text status labels (colours), keyboard/disclosure/current-page semantics and persistent errors (accessibility), and plain-language recovery instructions (writing). Screenshots of customer categories and the checkout toast were inspected. Native device rendering and real assistive-technology announcements remain unverified; typechecking is not a substitute for those checks.

## After publishing

Verify deployment statuses and the served customer search/category assets. Do not create a real order as a smoke test. For rollback, revert this frontend release commit and let the web deployments rebuild; there is no database rollback.
