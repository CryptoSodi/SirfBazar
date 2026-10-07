# Customer Android/iPhone app — implementation and verification

Updated 6 October 2026. Work is in the existing `apps/customer-app` Expo/React Native application, not the Next.js customer website on port 3000.

## Delivery status

The missing API-backed customer flows and recovery paths below are implemented. This is a development handoff, **not a signed APK/IPA or an app-store release sign-off**. No production orders, payments, account deletions, or store submissions were performed.

| Area | Implemented behavior |
| --- | --- |
| Shopping | Existing location-filtered home, catalogue, product/shop offers, guest basket, quantities and server-priced multi-shop checkout retained |
| Location | Permission/GPS/address-lookup deadlines; explicit map and saved-address alternatives; no indefinite Detecting state; demo area clearly labelled |
| Sign-in | Customer-context OTP/Google flows, wrong-code errors, resend cooldown, change number; guest transfer errors remain visible and block checkout |
| Session | Single-flight token rotation; offline refresh does not erase the session; old refresh responses cannot overwrite a new login; serialized credential writes/deletion |
| Native credentials | SecureStore tokens, plaintext legacy migration only after secure persistence, no native plaintext fallback; web preview uses separate browser storage |
| Addresses | Create/edit/default/delete with persistent errors; delivery pin required; map returns to the existing editor; checkout retains the selected address and rechecks fees for its coordinates |
| Checkout | COD enabled; unconfigured online methods disabled; stock/price-change checks; stable UUID reference and original cart ID persisted before submission |
| Recovery | Lost order responses survive app reload; check the owned order by reference, or retry the identical reference/payload; legacy unresolved attempts without a reference require history/support review |
| Orders | Realtime Socket.IO events plus REST reconciliation on reconnect/foreground; focused-screen polling fallback; parent/child shop deliveries, actual items, cancellation and per-delivered-shop ratings |
| Replacements | Review original/suggested product, quantity and price; accept/decline using the child order and original item IDs; totals come from the service, no automatic refund promise |
| Notifications | Inbox, unread filter, mark read/all, supported notification deep links; native push response/cold-start routing and registration controls |
| Support | Ticket inbox, creation, conversation and replies; persistent errors and retained reply text; customer cannot link a ticket to another customer's order |
| Account | Profile editing, explicit account-deletion confirmation, light/dark/system appearance; existing wallet display retained |

The location helper has 15-second permission, 12-second position and 5-second lookup deadlines. These bound the waiting UI, not the underlying operating-system operation. The browser permission test hit the timeout and then successfully used manual coordinates. Physical-device GPS accuracy remains unverified.

Native storage follows [Expo SecureStore's platform guidance](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/). Push requires a configured native development/production build and device credentials; browser preview cannot establish real phone push delivery. See [Expo notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/) and [notification response handling](https://docs.expo.dev/push-notifications/receiving-notifications/).

## Backend changes and rollout requirement

Deploy the updated backend before releasing this mobile client. No schema or database migration was introduced by this work.

- Guest basket claim/copy is transactional. Retrying the **same guest cart** cannot repeat its quantities; a failed copy rolls back the MERGED claim. This does not constitute a full audit of all cart-creation concurrency across different guest sessions.
- `POST /orders` accepts optional UUIDv4 `requestId` and `cartId`; older clients remain compatible. The reference becomes the standalone/parent order primary key, so the existing uniqueness constraint provides a durable duplicate fence. Replays are ownership- and intent-checked before reading the current basket.
- The active basket is claimed inside the same transaction as stock, orders and payment creation. A concurrent attempt that loses the claim cannot create another order, including from older clients.
- Order recovery never makes a fresh checkout reference for the unresolved attempt. A 409 remains unresolved until the owned order/history/support is checked.
- Support order linking now checks customer ownership before creating the ticket; existing ticket read/reply ownership checks remain enforced.

REST is the canonical source after reconnect; Socket.IO alone is not a missed-event store. This follows [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/) and [client reconnection options](https://socket.io/docs/v4/client-options/). The isolated local delivery-status update reached the UI in 214 ms; this is one local measurement, not an Internet latency guarantee. Post-commit notification delivery/outbox reliability is not redesigned by this task.

## Verification

Passed:

- Customer app: `rtk npm run typecheck` and `rtk npm test`: **11 tests** for notification/replacement routing, stock checks, local native API URL resolution, GPS timeout, refresh concurrency/new-login races, offline retention, merge recovery, secure migration and logout/migration races.
- API: `rtk proxy npx.cmd tsc --noEmit` and `rtk proxy node --test -r ts-node/register test/customer-checkout.test.cjs test/customer-cart-merge.test.cjs test/customer-support.test.cjs`: **10 tests** for same-guest merges, rollback, ownership, same-reference single/multi-shop checkout, stock/payment uniqueness, legacy concurrent checkout and support boundaries.
- Expo: `rtk proxy npx.cmd expo install --check` passes after compatible patches to Expo `~54.0.37` and React Native `0.81.5`.
- Native Hermes bundles: `rtk proxy npx.cmd expo export --platform android --platform ios --output-dir ../../output/customer-mobile-native`. Both Android and iOS exports succeeded. These are JS/assets exports, not native binary compilation or signing.
- Isolated browser workflow: wrong OTP rejected; simulated merge 503 retained the guest basket; explicit retry transferred exactly one item; notification opened the replacement order; replacement acceptance; realtime delivered event; support reply; profile save; map/editor return and address save; COD submission emptied the basket.
- Lost response: fixture deliberately closed order responses. Five network attempts created **one** fixture order. Reload retained the unresolved marker; checking its UUID opened that same order without another creation.
- Location waiting exited with actionable map guidance; manual pin changed browsing location. Dark mode persisted after reload.
- Checkout at 320/390/768 px and account at 320 px: document width matched viewport width. Captures were visually inspected for wrapped address/name content, payment-state distinction and persistent bottom navigation.
- Fresh workflow checks reported no application console errors; expected injected HTTP/network failures and existing React Native Web deprecation warnings are distinct from successful smoke checks.

Backend tests use the real service methods with atomic in-memory transaction fakes, **not a PostgreSQL concurrency load test**. Browser workflows use `test/mobile-fixture.cjs` on port 3198 with Expo preview 8085 and no marketplace database. UI scripts and screenshots are in `output/playwright/customer-mobile-*`; native exports are in `output/customer-mobile-native`. Temporary test services are stopped at handoff; the real local API and app preview remain available.

Not verified:

- Android/iPhone hardware or emulators, native binaries/signing, TalkBack/VoiceOver, native large-text/keyboard behavior, background/terminated push delivery, GPS/map-provider behavior on a phone.
- Real SMS or Google account login, payment provider transactions, account deletion, delivered-shop rating submission and real rider handover. These paths must be exercised on controlled native test accounts before release.
- Production service reachability, full dependency exploitability audit, PostgreSQL load/chaos tests, and the repository's other applications/unrelated dirty changes.

## Interface review

Scope: changed customer mobile screens and shared controls; Expo SDK 54, React Native, React Navigation and existing semantic StyleSheets. Project architecture/API/backend/deployment, remaining-work/capability reports, customer-mobile V5 reference and frontend checkpoints were inspected. Existing branding and neutral missing-image states were preserved. Review uses the `better-interface` baseline and the six domain skills, not a replacement design system.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Form labels, selected/disabled payment state, notification filter, persistent alert semantics, explicit delete confirmation, 44 px header/input targets | Clear in sampled preview controls; full native traversal not verified |
| Layout | Narrow checkout/address wrapping, scrolling sheets, native map/editor return, 320/390/768 px captures | Clear within sampled widths; native keyboard/large text not verified |
| Writing | Demo location disclosure, location/manual recovery, unknown-order safety, unavailable online payments, replacement/refund wording | Clear within changed flows |
| Typography | Shared title/body hierarchy, 16 px editable inputs, long address and two-line account name in captures | Clear in sampled preview; native font scaling not verified |
| Colors | Existing light/dark semantic palette, dark account capture, separate solid action vs accent text tokens | Clear in sampled states; prior V5 contrast measurements retained |
| UI polish | Shared cards/header, disabled/busy controls, modal scrolling, persisted theme, recovery vs success transitions | Clear within changed flows |

Resolved findings:

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH (fixed) | Writing | `apps/customer-app/screens/CheckoutScreen.tsx:184`, `apps/api/src/orders/orders.service.ts:199` | An uncertain order had no durable identity or safe recovery | Persist one UUID, transactionally fence the basket, recover the owned reference | Repeated transport requests must not create duplicate purchases |
| HIGH (fixed) | Writing | `apps/customer-app/lib/location.ts:78` | Permission/provider waiting could leave Detecting indefinitely | Bounded wait and explicit map/saved-address alternatives | Users need a usable recovery path without fabricated location |
| HIGH (fixed) | Writing | `apps/customer-app/screens/CheckoutScreen.tsx` | Mock online payment confirmation could look like a usable payment flow | COD only, disabled provider option with explanation | Do not imply payment capability that is not integrated |
| MEDIUM (fixed) | Accessibility | `apps/customer-app/screens/AddressEditScreen.tsx`, `components/LoginSheet.tsx`, `components/CustomerUI.tsx` | Some form/compact controls lacked consistent labels or usable recovery text | Accessible labels, 44 px header targets, persistent alerts and busy labels | Correction instructions must remain readable and actionable |

Verdict: **Approve for the reviewed local-preview scope only.** This is not native accessibility or store-release approval.

## Remaining release gates

1. Build/install a signed development or preview binary and test on Android and iPhone. `adb devices` found no attached device; Java/Gradle were not available on PATH. No SDK/toolchain was installed and no cloud build was submitted.
2. Verify Expo project, Google OAuth package/bundle credentials, maps credentials, Android notification channel/permission, and APNs/FCM delivery in native builds. App identifiers remain `pk.sirfbazar.customer`; an EAS project is configured, but its credentials were not validated remotely.
3. Configure real SMS and hosted payments. Native checkout deliberately keeps online payment disabled. Never treat the local test OTP/provider as production authentication/payment proof.
4. Resolve remaining audit findings with Expo-compatible upgrades and rerun device checks. Compatible patches removed the critical `tar` finding; installation still reports **46 findings (16 moderate, 30 high)**. No forced major upgrade/downgrade was applied; audit presence is not a determination of runtime exploitability.
5. Verify the backend/mobile release together, including real database concurrency and post-commit notification recovery. Add store privacy/data-retention disclosures and complete native account-deletion/provider acceptance testing.

## Local handoff

Customer native-project browser preview: `http://localhost:8084/`. Backend: `http://localhost:3001/api`. Customer website is separate at `http://localhost:3000/`.

For a phone development build, use the same network as the laptop. `localhost` environment URLs are resolved to Metro's LAN hostname on native platforms; an explicit LAN API URL is also supported. Local ports must be reachable through Windows/network policy. Do not change firewall policy blindly. Expo Go is not the validation target for the app's custom native Google/push modules; use a development build. Production/preview EAS profiles explicitly select the configured HTTPS production API rather than inheriting the local `.env`; production availability remains unverified.
