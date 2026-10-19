# Merchant mobile parity: interaction states

Scope: native Expo merchant app; keep the existing light theme, type scale and card language. This adapts the released merchant web flows rather than embedding web screens.

## Catalogue

1. Start in “Products to add”; an explicit filter changes to “All catalogue products”. Selecting a category narrows results to that branch. Search resets pagination while the selection remains intact.
2. Tap a product to select/deselect it. Already-listed products remain visible only in the all-products filter and cannot be selected again. A sticky review action shows the selection count.
3. Review each selected item, set a valid sale price and whole-number stock, then submit one idempotent bulk request. The selection remains locked when the response is uncertain, with a retry of the exact request. Successful items leave the selection; failed rows remain editable.
4. Empty state names the active filter and offers a way back to all products; loading and errors leave existing results visible where possible.

## New product, team and shop settings

- New product is a native form with a local photo preview before upload; the saved item appears in the merchant's own listings on return. It can sell in that shop while awaiting separate shared-catalogue review.
- Shop listings load in pages as the merchant scrolls; availability, price and stock edits update the visible item after the server confirms, without resetting the whole page.
- Only owners see the team entry. New staff receive a shop-owner-set password; later password changes revoke staff sessions. Destructive removal requires confirmation.
- Shop settings use the saved weekly schedule and merchant profile; saving applies one explicit request. The current-location action selects coordinates but never silently saves them.
- Sign-up collects owner name, mobile, optional email and password before shop details. CNIC number and image sit with shop details. The dedicated merchant-registration API sends and verifies the code before onboarding and private ID upload. A shop saved without a completed upload remains private, with the existing retry route.
- A verified owner whose app closes before shop creation can choose **Finish an unfinished shop setup** and verify the registered mobile again. Until onboarding returns merchant credentials, the session remains in customer context. A created draft shop with a pending identity upload can complete that upload from the dashboard.
- Notification history has current-shop and earlier-account scopes. Opening a notice marks it read and sends order/product notices to the relevant mobile area.

## Tour

The first completed mobile onboarding queues one native, index-ordered tour: dashboard, orders, products, catalogue, riders, team, settings. It is optional and replayable from More. Each step names its destination; Skip and Back remain available.

The counter POS and spreadsheet import remain browser workflows. Mobile More opens the existing merchant web routes in the system browser, with a separate browser sign-in when necessary; the app does not claim a native offline POS or native XLSX parser.
