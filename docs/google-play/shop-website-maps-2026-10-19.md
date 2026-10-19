# Shop website Maps configuration repair - 19 October 2026

## Finding

The profile at `https://shop.sirfbazar.com/profile` opened an empty picker with
"Google Maps is not configured for this site." This is separate from Merchant
Android. The existing Vite code reads `VITE_GOOGLE_MAPS_API_KEY` at build time;
production Vercel project `sodis-projects/sirf-bazar-shop` had no environment
variables. The signup inline marker also requires `VITE_GOOGLE_MAPS_MAP_ID`.
No component replacement or API/database change was necessary.

## Approved configuration

The owner explicitly approved a separate website-restricted key, the shop's
Vercel Maps variables and a redeploy of this project only.

- Google Cloud project: `sirfbazar` / `453311658725`.
- Key: `SirfBazar Shop Website Maps`, resource
  `04eadd03-2d0a-4b0f-9710-8da459fd8af8`.
- Application restriction: Websites, exactly `https://shop.sirfbazar.com/*`.
- API restriction: Maps JavaScript API only.
- JavaScript/raster map ID: `9bb20a3e5266fe7748498aa1`, named
  `SirfBazar Shop Website`; default Google style, no custom style changes.
- Production variables: `VITE_GOOGLE_MAPS_API_KEY` and
  `VITE_GOOGLE_MAPS_MAP_ID`, added only to `sirf-bazar-shop`.

The key value is stored outside Git in the existing owner/SYSTEM-only private
Maps directory. Although Vercel stores the values as sensitive, Vite Maps
configuration necessarily appears in the browser bundle. The origin/API
restrictions provide the protection; this is not a server secret.

Existing Android/customer/website keys, billing, enabled APIs, IAM, Google OAuth,
other Vercel projects and production API configuration were not changed. Local
Vercel linking refreshed ignored metadata/environment files; development API
configuration was retained at `http://localhost:3001/api`. No credentials were
added to tracked source.

## Deployment and verification

Rebuilt the exact existing production deployment, not the dirty local workspace:

- Previous: `dpl_7vrPvTwAdsqfqdWA8GzpK4EZYqnh`, URL
  `https://sirf-bazar-shop-d6z9j1sor-sodis-projects.vercel.app`.
- New: `https://sirf-bazar-shop-qsun0wa7l-sodis-projects.vercel.app`.
- Vercel inspection: `B3J58z3fikFFRqPWCgVj6XSZ2XYt`.
- Build succeeded and `shop.sirfbazar.com` was aliased to the new deployment.
- Verified both production variable names through Vercel CLI without exposing
  their values.
- Reloaded the live profile using the existing authenticated browser session,
  opened Edit details / Pin shop on map, and verified real Google tiles and an
  enabled Select map center action. No missing-key or Maps authorization error
  appeared in the inspected browser state/logs.
- Saved proof: ignored `output/shop-profile-web-map-working-20261019.png`.
- No profile save, location permission request, shop-coordinate update, order,
  payment or other production-data mutation was performed during verification.
- Mobile web, first-time signup's advanced marker, and geolocation permission
  flows were not separately exercised in this configuration-only repair.

## Maintenance and rollback

Keep these two Maps variables in the shop project's Production environment for
future builds. Changing them requires a rebuild: browser refresh alone cannot
repair a Vite bundle built with an empty key. The key intentionally rejects the
raw `*.vercel.app` hostname; verify Maps through `shop.sirfbazar.com`.

Do not reuse Android-restricted keys for the website or widen the existing shared
key. Preview/local origins require a separately reviewed development key.

For an unrelated deployment regression, Vercel can promote the previous verified
deployment; note that its old artifact retains the missing-Maps behavior. Retain
the new environment variables for the next rebuild. Do not rotate/delete working
keys or alter billing as a rollback shortcut.
