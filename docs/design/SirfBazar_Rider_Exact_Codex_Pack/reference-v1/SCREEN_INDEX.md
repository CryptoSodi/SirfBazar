# Rider screen directory

26 compositions include core screens and recovery states. 36 screenshots include light/dark variants, a sheet and the desktop review shell. The screenshot number is not the same as the R screen ID.

| Screen | Reference ID | Light screenshot | Dark screenshot |
|---|---|---|---|
| R01 · Your deliveries | `home` | [01-home-light.png](screens/01-home-light.png) | [02-home-dark.png](screens/02-home-dark.png) |
| R02 · Assigned order | `assigned` | [03-assigned-light.png](screens/03-assigned-light.png) | Theme supported in interactive preview |
| R03 · Pickup check | `pickup` | [04-pickup-light.png](screens/04-pickup-light.png) | [28-pickup-dark.png](screens/28-pickup-dark.png) |
| R04 · On the way | `navigate` | [05-active-delivery-light.png](screens/05-active-delivery-light.png) | [29-navigate-dark.png](screens/29-navigate-dark.png) |
| R05 · At the customer | `doorstep` | [06-at-customer-light.png](screens/06-at-customer-light.png) | Theme supported in interactive preview |
| R06 · Cash & delivery code | `code` | [07-delivery-code-light.png](screens/07-delivery-code-light.png) | [30-code-dark.png](screens/30-code-dark.png) |
| R07 · Delivery completed | `complete` | [08-completed-light.png](screens/08-completed-light.png) | [31-complete-dark.png](screens/31-complete-dark.png) |
| R08 · Paid order completion | `prepaid` | [09-paid-completion-light.png](screens/09-paid-completion-light.png) | Theme supported in interactive preview |
| R09 · Delivery history | `history` | [10-history-light.png](screens/10-history-light.png) | Theme supported in interactive preview |
| R10 · Help | `help` | [11-help-light.png](screens/11-help-light.png) | Theme supported in interactive preview |
| R11 · Report a delivery issue | `report` | [12-report-light.png](screens/12-report-light.png) | Theme supported in interactive preview |
| R12 · Rider profile | `profile` | [13-profile-light.png](screens/13-profile-light.png) | [32-profile-dark.png](screens/32-profile-dark.png) |
| R13 · Light / Dark / System | `appearance` | [14-appearance-light.png](screens/14-appearance-light.png) | [33-appearance-dark.png](screens/33-appearance-dark.png) |
| R14 · Location & alerts | `permissions` | [15-permissions-light.png](screens/15-permissions-light.png) | Theme supported in interactive preview |
| R15 · Sign in | `login` | [16-login-light.png](screens/16-login-light.png) | [34-login-dark.png](screens/34-login-dark.png) |
| R16 · Verify phone | `login-code` | [17-login-code-light.png](screens/17-login-code-light.png) | Theme supported in interactive preview |
| R17 · Find your shop | `shops` | [18-shops-light.png](screens/18-shops-light.png) | Theme supported in interactive preview |
| R18 · Join shop | `apply` | [19-apply-light.png](screens/19-apply-light.png) | Theme supported in interactive preview |
| R19 · Awaiting shop approval | `pending` | [20-pending-light.png](screens/20-pending-light.png) | Theme supported in interactive preview |
| R20 · No assignments | `empty` | [21-empty-light.png](screens/21-empty-light.png) | Theme supported in interactive preview |
| R21 · Connection lost | `offline` | [22-offline-light.png](screens/22-offline-light.png) | Theme supported in interactive preview |
| R22 · Loading | `loading` | [23-loading-light.png](screens/23-loading-light.png) | Theme supported in interactive preview |
| R23 · API unavailable | `error` | [24-error-light.png](screens/24-error-light.png) | Theme supported in interactive preview |
| R24 · Session expired | `expired` | [25-expired-light.png](screens/25-expired-light.png) | Theme supported in interactive preview |
| R25 · Account inactive | `inactive` | [26-inactive-light.png](screens/26-inactive-light.png) | Theme supported in interactive preview |
| R26 · Completion not confirmed | `unknown` | [27-unknown-light.png](screens/27-unknown-light.png) | Theme supported in interactive preview |

Additional captures: `screens/35-pickup-confirmation-sheet.png`, `screens/36-design-studio.png`.

Screens are 390×844 logical viewport at device scale 2 (780×1688 pixel PNGs), except the 1440×1000 desktop review shell at scale 2. Screens with more content scroll; the PNG is the visible viewport, not the full scroll area. Do not make real app screens 780 logical units wide.

Use the review rail on desktop, bottom review selector on a narrow browser, or the interactive app controls. Production excludes review controls and the simulated status bar.
