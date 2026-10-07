# Rider screen implementation status — 2026-10-01

Reference: `../SirfBazar_Rider_Exact_Codex_Pack/SCREEN_PARITY_MATRIX.json` (390 × 844 logical, 2× captures). “Composed” means source code exists; it does **not** mean native visual parity or API behavior was demonstrated. No Android device/emulator was available (`adb devices` returned no device), so every native Light/Dark capture and large-text/keyboard result remains unverified.

| ID | State | Native component / route | Source implementation | Native visual evidence | Remaining check |
|---|---|---|---|---|---|
| R01 | Deliveries | RiderHomeScreen / Home | Composed with live profile/list handlers | None, both themes | Capture, compare, online switch test |
| R02 | Assigned order | RiderDeliveryScreen / Delivery, assigned | Composed | None | Capture and map hierarchy |
| R03 | Pickup | RiderDeliveryScreen / Delivery, pickup + Sheet | Composed | None | Checkbox, sheet, mutation/refetch |
| R04 | On the way | RiderDeliveryScreen / Delivery, on-way | Composed | None | Capture, address/navigation handoff |
| R05 | At customer | RiderDeliveryScreen / Delivery, doorstep | Composed | None | Capture, phone/payment variants |
| R06 | Cash and code | RiderDeliveryScreen / Delivery, code | Composed | None | Keyboard, code/error, cash checkbox |
| R07 | Completion | RiderDeliveryScreen / Delivery, complete | Composed from saved detail | None | Receipt capture, persisted state |
| R08 | Paid handover | RiderDeliveryScreen / Delivery, paid variant | Composed from returned payment status | None | Capture with actual paid test order |
| R09 | History | RiderHistoryScreen / History | Composed with live history handler | None | Filters and bounded records |
| R10 | Help | RiderHelpScreen / Help | Composed | None | Call and support-sheet behavior |
| R11 | Delivery issue | RiderReportScreen / Report | Composed with live POST handler | None | Authorized issue test and status preservation |
| R12 | Profile | RiderProfileScreen / Profile | Composed | None | Light/Dark capture, redaction |
| R13 | Appearance | RiderAppearanceScreen / Appearance | Composed with persisted Light/Dark/System | None | Theme switch without state loss |
| R14 | Permissions | RiderPermissionsScreen / Permissions | Composed; GPS transmission intentionally not enabled | None | Device permission/settings behavior |
| R15 | Sign-in | RiderLoginScreen / Login, phone | Composed with real OTP/Google handlers | None | Native auth, both themes |
| R16 | Verify phone | RiderLoginScreen / Login, code | Composed | None | OTP keyboard/resend/error |
| R17 | Shop selection | RiderOnboardScreen / Onboard, shops | Composed with live search | None | Search and empty/error |
| R18 | Rider application | RiderOnboardScreen / Onboard, apply | Composed with live POST handler | None | Authorized application test |
| R19 | Pending approval | RiderOnboardScreen / Onboard, pending; RiderHomeScreen pending | Composed | None | Relaunch/approval transition |
| R20 | No assignments | RiderHomeScreen / Home, empty | Composed | None | Successful-empty versus failure |
| R21 | Offline/stale | RiderDeliveryScreen / Delivery, offline | Composed with last fetched order in memory | None | Disconnect/reconnect; no durable offline cache |
| R22 | Loading | RiderHomeScreen / Home, loading | Composed skeleton | None | Transition capture |
| R23 | API error | RiderHomeScreen / Home, error | Composed separately from empty | None | Retry behavior |
| R24 | Session expired | RiderHomeScreen and RiderDeliveryScreen | Composed with private detail cleared | None | Expiry/refresh failure |
| R25 | Account inactive | RiderHomeScreen / Home, inactive | Composed | None | Actual inactive account |
| R26 | Confirmation unknown | RiderDeliveryScreen / Delivery, unknown | Composed with saved-status refetch; also used for other uncertain progress mutations | None | Drop-after-commit test |

Additional sheets: pickup confirmation, support contact/requests/replies, notifications, and sign-out confirmation are composed. Android back, screen-reader traversal, large text, keyboard occlusion, scrolling, and reduced-motion behavior require device checks. Existing legacy screens remain in the tree to preserve prior uncommitted work but are no longer selected by `App.tsx`.
