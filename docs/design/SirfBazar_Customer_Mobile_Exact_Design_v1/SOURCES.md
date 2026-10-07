# Source register

These sources describe distinct evidence levels. Blob hashes identify fetched files, not the deployed application commit. Any API behavior inherited through E2 is a previous source-review baseline, not newly verified live behavior.

## N1

`apps/customer-app/package.json`

complete package manifest.

https://github.com/CryptoSodi/SirfBazar/blob/master/apps/customer-app/package.json

## N2

`apps/customer-app/App.tsx`

complete navigation/root source.

https://github.com/CryptoSodi/SirfBazar/blob/master/apps/customer-app/App.tsx

## N3

`apps/customer-app/lib/api.ts`

complete native API client source.

https://github.com/CryptoSodi/SirfBazar/blob/master/apps/customer-app/lib/api.ts

## N4

`apps/customer-app/screens/CheckoutScreen.tsx`

requested lines 1–230, checkout code returned.

https://github.com/CryptoSodi/SirfBazar/blob/master/apps/customer-app/screens/CheckoutScreen.tsx

## N5

`apps/customer-app/components/LoginSheet.tsx`

requested lines 1–160, LoginSheet returned.

https://github.com/CryptoSodi/SirfBazar/blob/master/apps/customer-app/components/LoginSheet.tsx

## B1

`apps/api/src/guest/guest.controller.ts`

complete guest controller.

https://github.com/CryptoSodi/SirfBazar/blob/master/apps/api/src/guest/guest.controller.ts

## B2

`apps/api/src/cart/cart.service.ts`

selected lines147–362: merge/view/validation; not whole module audit.

https://github.com/CryptoSodi/SirfBazar/blob/master/apps/api/src/cart/cart.service.ts

## E1

`evidence/API_STARTUP_LOG.txt`

Owner supplied startup log, dated29 September 2026, route registration not runtime test.



## E2

`evidence/website-baseline-API_CONTRACT_MAP.md`

Earlier customer backend review retained as baseline, not a fresh audit of all endpoints.



## W1

Codex initial-prompt command, redirects to current official developer-command documentation.

https://developers.openai.com/codex/cli/reference/

## W2

Native development builds and modules.

https://docs.expo.dev/develop/development-builds/introduction/

## W3

Logical layout/device dimensions.

https://reactnative.dev/docs/dimensions
