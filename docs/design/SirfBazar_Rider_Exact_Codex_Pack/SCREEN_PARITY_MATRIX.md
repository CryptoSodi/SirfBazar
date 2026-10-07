# Rider screen parity matrix

All source states retain their original names/IDs. Native responsibilities below are mapping recommendations, not mandatory route names. Track Light and Dark separately. A reference with no original dark PNG is still rendered in dark by the original HTML.

| ID | Source key / screen | Suggested native responsibility | Light reference | Dark reference | Native status |
|---|---|---|---|---|---|
| R01 | `home` — Your deliveries | Existing Home route / Deliveries tab | [01-home-light.png](reference-v1/screens/01-home-light.png) | [02-home-dark.png](reference-v1/screens/02-home-dark.png) | Not yet verified |
| R02 | `assigned` — Assigned order | Delivery detail: assigned state | [03-assigned-light.png](reference-v1/screens/03-assigned-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R03 | `pickup` — Pickup check | Delivery detail: pickup state + confirmation sheet | [04-pickup-light.png](reference-v1/screens/04-pickup-light.png) | [28-pickup-dark.png](reference-v1/screens/28-pickup-dark.png) | Not yet verified |
| R04 | `navigate` — On the way | Delivery detail: on-the-way state | [05-active-delivery-light.png](reference-v1/screens/05-active-delivery-light.png) | [29-navigate-dark.png](reference-v1/screens/29-navigate-dark.png) | Not yet verified |
| R05 | `doorstep` — At the customer | Delivery detail: arrived-customer state | [06-at-customer-light.png](reference-v1/screens/06-at-customer-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R06 | `code` — Cash & delivery code | Handover/code route or sheet | [07-delivery-code-light.png](reference-v1/screens/07-delivery-code-light.png) | [30-code-dark.png](reference-v1/screens/30-code-dark.png) | Not yet verified |
| R07 | `complete` — Delivery completed | Saved completion receipt | [08-completed-light.png](reference-v1/screens/08-completed-light.png) | [31-complete-dark.png](reference-v1/screens/31-complete-dark.png) | Not yet verified |
| R08 | `prepaid` — Paid order completion | Handover/code paid-state variant | [09-paid-completion-light.png](reference-v1/screens/09-paid-completion-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R09 | `history` — Delivery history | History tab | [10-history-light.png](reference-v1/screens/10-history-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R10 | `help` — Help | Help tab | [11-help-light.png](reference-v1/screens/11-help-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R11 | `report` — Report a delivery issue | Delivery issue form | [12-report-light.png](reference-v1/screens/12-report-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R12 | `profile` — Rider profile | Profile tab | [13-profile-light.png](reference-v1/screens/13-profile-light.png) | [32-profile-dark.png](reference-v1/screens/32-profile-dark.png) | Not yet verified |
| R13 | `appearance` — Light / Dark / System | Appearance sub-screen | [14-appearance-light.png](reference-v1/screens/14-appearance-light.png) | [33-appearance-dark.png](reference-v1/screens/33-appearance-dark.png) | Not yet verified |
| R14 | `permissions` — Location & alerts | Location/alerts sub-screen | [15-permissions-light.png](reference-v1/screens/15-permissions-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R15 | `login` — Sign in | Existing Login route | [16-login-light.png](reference-v1/screens/16-login-light.png) | [34-login-dark.png](reference-v1/screens/34-login-dark.png) | Not yet verified |
| R16 | `login-code` — Verify phone | Existing Login verification step | [17-login-code-light.png](reference-v1/screens/17-login-code-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R17 | `shops` — Find your shop | Onboarding: shop selection | [18-shops-light.png](reference-v1/screens/18-shops-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R18 | `apply` — Join shop | Onboarding: application details | [19-apply-light.png](reference-v1/screens/19-apply-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R19 | `pending` — Awaiting shop approval | Linked/pending account state | [20-pending-light.png](reference-v1/screens/20-pending-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R20 | `empty` — No assignments | Deliveries successful-empty state | [21-empty-light.png](reference-v1/screens/21-empty-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R21 | `offline` — Connection lost | Last-confirmed active-delivery stale state | [22-offline-light.png](reference-v1/screens/22-offline-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R22 | `loading` — Loading | Shared loading composition | [23-loading-light.png](reference-v1/screens/23-loading-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R23 | `error` — API unavailable | Shared initial failure | [24-error-light.png](reference-v1/screens/24-error-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R24 | `expired` — Session expired | Session-expired boundary | [25-expired-light.png](reference-v1/screens/25-expired-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R25 | `inactive` — Account inactive | Account-inactive boundary | [26-inactive-light.png](reference-v1/screens/26-inactive-light.png) | Render unchanged HTML in this theme | Not yet verified |
| R26 | `unknown` — Completion not confirmed | Uncertain mutation recovery | [27-unknown-light.png](reference-v1/screens/27-unknown-light.png) | Render unchanged HTML in this theme | Not yet verified |

## Additional required overlays and behavior

Pickup confirmation uses original `screens/35-pickup-confirmation-sheet.png`. Also inspect interactive notifications, contact/navigation previews, support/request lists, permission explanations and sign-out confirmations. Replace only review/demo behavior with native/real operations while preserving their app-owned composition.

Test System mode/OS changes, larger text, keyboard, long content and scroll below the captured viewport. The desktop studio in `screens/36-design-studio.png` is excluded from the native app.

No entry is considered implemented or tested merely because a row appears here.
