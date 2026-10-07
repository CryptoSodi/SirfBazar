# Google Stitch — rider app design batches

Reuse the existing connected Google Stitch MCP project/environment. Inspect actual available actions; do not reinstall the connection or invent project IDs. This package was made as a local browser reference, not a live Stitch export. Attach the relevant screenshots and give Stitch `DESIGN.md` plus the main rider specification.

## Global instruction to prepend to every batch

```text
Design SirfBazar RIDER MOBILE screens at 390 × 844 logical units using the
attached rider reference. Preserve approved basket/wordmark geometry,
#009966 identity, #007A52 actions, Plus Jakarta Sans, card geometry, spacing
and the supplied single-line Urdu slogan. Reuse the merchant v2 family but
make this a native mobile task app, not a desktop dashboard on a phone.
Create Light and Dark versions with System appearance behavior specified.
No new logos, unsupported API fields, invented earnings, generic courier
marketplace, job acceptance countdowns or fake financial claims.
The existing merchant assigns work; the rider performs own delivery actions.
Use fictional data for review only. No real customer information in prompts.
```

## Batch R-A — Foundation and Deliveries

```text
Create a component/token board and the Deliveries home screen. Header uses
approved logo, separate RIDER text and notifications. Show linked shop,
Your deliveries, online state/switch, one strong featured assignment with
pickup/drop-off, order number, item count, correct COD instruction and View
delivery. Two small cells show assigned deliveries and linked shop, not
salary. Remaining assignments follow. Bottom tabs: Deliveries, History,
Help, Profile. Show no-assignments and pending-read variants. Match reference.
```

## Batch R-B — Assigned order and pickup

```text
Create assigned order detail, at-shop pickup check and confirmation sheet.
Use order SB-1048, five fictional items, Rehman General Store, Model Town.
Separate Navigate/Call from progress updates. Main action I’m at the shop.
Pickup view checks order number and packed bags with staff, not opening sealed
goods. Confirm pickup has explicit confirmation and becomes On the way only
after the backend result. No Accept/Decline assignment buttons.
```

## Batch R-C — Navigation and doorstep

```text
Create On the way and At the customer. Prioritize readable full address,
instructions, external navigation/call, COD information and next action.
Use an explicitly illustrative map in design frames, no invented distance
or ETA; annotate production replacement with verified map/address content.
Arrival and delivery completion are separate. Stop-safely cue, not urgency.
```

## Batch R-D — Delivery-code and payment variants

```text
Create code-confirmation screen and completion receipt. Customer delivery
code is four digits in the inspected generator, not the rider login OTP.
Cash variant: show Rs 2,480 to collect, parcel-handover acknowledgement and
cash-collected acknowledgement. Paid variant requires confirmed PAID and
has no cash instruction. Checkboxes are local UX, not new API fields.
Show incorrect-code, pending, uncertain network outcome and completed states.
No delivery-code resend endpoint, fake money movement, rider income or
merchant cash-handover receipt. Completion only after backend confirmation.
```

## Batch R-E — History, Help and Profile

```text
Create recent history (capped server list, order value not earnings), Help,
meaningful delivery issue report, read-only rider profile, Appearance and
Location & alerts. Theme system covers sheets, forms, badges and map fallback.
No self-change-shop or rider-profile edit without API support. Contacts use
native hand-offs, not fabricated in-app chat. Show OS permissions as a native
handoff, not as permissions that this design prototype granted.
```

## Batch R-F — Auth and shop application

```text
Create phone sign-in/Google, login OTP, select participating shop, rider
profile application and awaiting-shop-approval. Existing linked riders skip
application. Request fields: merchantId, fullName, phoneNumber, optional
vehicleType/vehicleNumber. No password reset, CNIC, license or compulsory
profile image added to this rider flow. Login OTP and customer delivery code
must be visibly separate concepts. Include errors and Google cancellation.
```

## Batch R-G — Recovery and motion

```text
Create connection-lost, API-error, session-expired, inactive-account and
completion-uncertain frames. Error must not look like zero jobs. No local
success for unsent actions. Preserve cached address only under an approved
privacy policy. A timeout needs a saved-status refetch before retry.
Specify 140–200ms transitions, sheet focus, reduced motion and large text.
Export named frames with route/state/theme mapping and actual project IDs.
```
