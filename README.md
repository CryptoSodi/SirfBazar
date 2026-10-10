# SirfBazar

**Your nearby bazar, now online.** SirfBazar is a hyperlocal multi-merchant commerce and delivery platform: customers order groceries, pharmacy essentials, bakery items and more from trusted local shops nearby; merchants manage their own storefront, inventory, and riders; SirfBazar provides the software, payments, tracking, and marketplace operations.

Unlike dark-store models, SirfBazar **owns no inventory and no warehouses** — every order is fulfilled by a real local shop using the shop's own riders.

## Android APK downloads

Release-signed **testing builds**, version 1.0.0 (Android version code 3), built
on 9 October 2026 with distinct Customer, Merchant, and Rider launcher icons.
They connect to the live SirfBazar API; they are not a Google Play release.

Build source snapshot: `47ae4cd` (base `848da0e` plus the icon changes). This
snapshot predates later mobile source changes now on `master`; these APKs are
not rebuilt from current `master`.

| App | Package | Download |
|---|---|---|
| Customer | `pk.sirfbazar.customer` | [Download customer APK](https://github.com/CryptoSodi/SirfBazar/releases/download/android-icons-build3-2026-10-09/sirfbazar-customer-v1.0.0-build3.apk) |
| Merchant | `pk.sirfbazar.merchant` | [Download merchant APK](https://github.com/CryptoSodi/SirfBazar/releases/download/android-icons-build3-2026-10-09/sirfbazar-merchant-v1.0.0-build3.apk) |
| Rider | `pk.sirfbazar.rider` | [Download rider APK](https://github.com/CryptoSodi/SirfBazar/releases/download/android-icons-build3-2026-10-09/sirfbazar-rider-v1.0.0-build3.apk) |

The [GitHub testing prerelease](https://github.com/CryptoSodi/SirfBazar/releases/tag/android-icons-build3-2026-10-09)
includes all three APKs, `SHA256SUMS.txt` and `build-manifest.json`. The downloads
are hosted on GitHub and do not use expiring Expo artifact links. Package names,
release signatures, build numbers and checksums passed verification; see the
[build 3 report](docs/production-readiness/ANDROID_ICONS_BUILD3_2026-10-09.md).

Build 3 uses the same per-app SirfBazar release keys as build 2, preserving its
update signing identity; in-place installation was not device-tested. Later
mobile changes on `master` require another build and installation. iOS requires
a separate build; no iOS download is provided here. Native-device login,
checkout, GPS and push checks remain pending, and known dependency warnings
remain documented in the report. Google consent was last recorded as
External/Testing; this release does not change consent or test-user access.

The [build 2 prerelease](https://github.com/CryptoSodi/SirfBazar/releases/tag/android-2026-10-09)
is retained as a historical version. Older APKs signed with a different key
cannot be updated in place. Do not uninstall an existing app without first
considering loss of its local data. The [previous build report](docs/production-readiness/ANDROID_LOCAL_RELEASE_CANDIDATES.md)
is retained as historical evidence.

## Repository layout

**All eight components below are consolidated in `master`**, including the
updated API, Google authentication and the other developer's frontend improvements.
The single backend remains in `apps/api`; all seven clients use that shared API.
`codex/server-api-deployment` still exists as a historical Git branch, not a
separate source folder or second API to maintain, and cannot deploy to production.
API deployment runs only after the full `release-checks` gate passes on a push
to `master`. See [the deployment runbook](docs/API-AUTO-DEPLOYMENT.md) and
[consolidation record](docs/MASTER-CONSOLIDATION.md).

| App | Path | Stack | Local port | Production |
|---|---|---|---|---|
| Backend API | [`apps/api`](apps/api) | NestJS 10 · Prisma 6 · PostgreSQL · Socket.IO | 3001 | Oracle, automatic deployment from `master` after CI |
| Customer website | [`apps/web`](apps/web) | Next.js · Tailwind | 3000 | Vercel |
| Merchant shop website | [`apps/shop`](apps/shop) | Vite · React · Tailwind | 5174 | Vercel |
| Admin dashboard | [`apps/admin`](apps/admin) | Vite · React · Tailwind | 5173 | Vercel |
| Browser POS | [`apps/pos`](apps/pos) | Vite · React · Tailwind | 5175 | Vercel |
| Customer mobile app | [`apps/customer-app`](apps/customer-app) | Expo (React Native) | — | Separate Android/iOS builds |
| Merchant mobile app | [`apps/merchant-app`](apps/merchant-app) | Expo (React Native) | — | Separate Android/iOS builds |
| Rider mobile app | [`apps/rider-app`](apps/rider-app) | Expo (React Native) | — | Separate Android/iOS builds |

Project records, API contracts and operational guides are in [`docs/`](docs/).

## Quick start (development)

Prereqs: Node.js 20+, npm.

```powershell
# 0. Database (PostgreSQL) — either Docker:
docker compose up -d        # postgres on localhost:5432
# …or paste your Render Postgres EXTERNAL connection string into apps/api/.env

# 1. Backend API
cd apps/api
npm install
copy .env.example .env
npx prisma db push          # creates the schema
npm run seed                # demo data: Lahore shops, products, riders, coupons
npm run dev                 # http://localhost:3001  (Swagger: /docs)

# 2. Customer website (new terminal)
cd apps/web
npm install
npm run dev                 # http://localhost:3000

# 3. Admin dashboard (new terminal)
cd apps/admin
npm install
npm run dev                 # http://localhost:5173

# 4. Mobile apps (Expo; requires Expo Go on a device or an emulator)
cd apps/customer-app && npm install && npx expo start
```

End-to-end smoke test (API must be running and seeded):

```powershell
cd apps/api
npm run smoke
```

## Demo accounts (seeded)

| Role | Login | Notes |
|---|---|---|
| Customer | any phone number + OTP | dev master OTP code: **123456** |
| Customer (Google) | dev token `mock:you@example.com:Your Name` | mock Google verifier in dev |
| Merchant owners | `+923010000001` … `+923010000004` + OTP 123456 | Madina General Store, Fresh Basket, Sheikh Bakers, CarePlus Pharmacy (Lahore) |
| Riders | `+923020000001` … `+923020000005` + OTP 123456 | belong to the merchants above |
| Super admin | `admin@sirfbazar.pk` / `Admin@12345` | admin dashboard login |
| Finance admin | `finance@sirfbazar.pk` / `Admin@12345` | |
| Support agent | `support@sirfbazar.pk` / `Admin@12345` | |

Delivery completion OTP also accepts **123456** in dev.

## Core product rules (implemented)

- **Zero-friction browsing** — guests browse shops/products, search, and build a cart with no account; login (Google or phone OTP) is requested only at order placement, and the guest cart merges into the account.
- **Merchant-managed delivery** — riders belong to a merchant; a merchant can only assign its own riders; riders only see their own assigned orders.
- **Multi-merchant checkout** — one cart across shops becomes a parent order with one child order per merchant, each independently fulfilled and tracked.
- **Full order timeline** — every status change writes an `OrderTimeline` entry and is pushed in real time (Socket.IO) to customer, merchant, rider, and admin.
- **Money integrity** — all amounts are integers in paisa; commission, fees, coupons, refunds (to wallet), and merchant settlements are computed server-side and audited.
- **OTP-verified delivery** — the customer's 4-digit code (revealed in tracking after pickup) is required to complete delivery.
- **Provider-agnostic OTP/SMS** — `IOtpService` with a dev mock; the real provider plugs in via env (`OTP_PROVIDER=external`) without code changes elsewhere.

## Deployment

`master` is the release source for all apps. The four web apps deploy through
Vercel, and the API deploys through GitHub Actions to Oracle. Mobile builds are
separate and do not update automatically when `master` changes.

- [sirfbazar.com](https://sirfbazar.com) and [www.sirfbazar.com](https://www.sirfbazar.com): customer website on **Vercel** (root dir `apps/web`).
- [shop.sirfbazar.com](https://shop.sirfbazar.com): merchant shop website on **Vercel** (root dir `apps/shop`).
- [admin.sirfbazar.com](https://admin.sirfbazar.com): admin dashboard on **Vercel** (root dir `apps/admin`).
- [pos.sirfbazar.com](https://pos.sirfbazar.com): browser POS on **Vercel** (root dir `apps/pos`).
- [api.sirfbazar.com](https://api.sirfbazar.com): the shared backend API on **Oracle `129.153.16.84`**, `sirfbazar-api.service`, Caddy HTTPS proxy and direct Cloudflare DNS.
- Database: existing **native PostgreSQL on Oracle**; no tunnel or Windows API is required.

API deployment configuration is part of the source: the
[GitHub Actions workflow](.github/workflows/ci.yml) and
[Oracle deployment scripts](deploy/api). Both the workflow and production
environment allow deployment only from `master`; historical branches cannot
deploy. Changes reach protected `master` through a pull request with passing
`release-checks`. Deployment preserves live configuration and creates a verified
database backup; it does not run migrations or seeds.

See the [active API deployment runbook](docs/API-AUTO-DEPLOYMENT.md) and
[consolidation record](docs/MASTER-CONSOLIDATION.md). The older Windows/tunnel
instructions in `docs/deployment.md` are historical, not the live API setup.

## Production notes

- Set strong `JWT_SECRET` (the Render blueprint generates one), real `GOOGLE_CLIENT_ID` (`GOOGLE_AUTH_PROVIDER=google`), and OTP provider credentials.
- Object storage (S3-compatible), FCM push, and real payment gateways (JazzCash/EasyPaisa/cards) integrate behind the existing payment `initiate/confirm` flow.
- See `docs/architecture.md` and `docs/api-contract.md`.
