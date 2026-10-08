# SirfBazar

**Your nearby bazar, now online.** SirfBazar is a hyperlocal multi-merchant commerce and delivery platform: customers order groceries, pharmacy essentials, bakery items and more from trusted local shops nearby; merchants manage their own storefront, inventory, and riders; SirfBazar provides the software, payments, tracking, and marketplace operations.

Unlike dark-store models, SirfBazar **owns no inventory and no warehouses** — every order is fulfilled by a real local shop using the shop's own riders.

## Android APK downloads

Release-signed **testing builds**, version 1.0.0 (build 1), built on 8 October 2026.
These connect to the live SirfBazar API; they are not a Google Play release.
All three download links were checked successfully on 8 October 2026.

| App | Package | Download |
|---|---|---|
| Customer | `pk.sirfbazar.customer` | [Download customer APK](https://expo.dev/artifacts/eas/23-oJtE8MVYwfXaGyV2JzrTV8pEW5tKBxaeXeasrs2Q.apk) |
| Merchant | `pk.sirfbazar.merchant` | [Download merchant APK](https://expo.dev/artifacts/eas/LNk5RrAQQLC_Udql-OASxzP3DVZRMbyUuWMnPIb34mo.apk) |
| Rider | `pk.sirfbazar.rider` | [Download rider APK](https://expo.dev/artifacts/eas/KQTRfta8lHsQTf0_tpKvsyxJkkoLOYtOQjERCw7H9Xg.apk) |

**Download links expire on 22 October 2026.** Package names, release signatures,
and file hashes were verified; see the [APK verification report](docs/production-readiness/ANDROID_LOCAL_RELEASE_CANDIDATES.md)
for checksums, build IDs, and retained local copies. Native-device login and
checkout checks remain pending, and Google consent is still in Testing.

**These APKs predate the master consolidation.** They do not contain every later
mobile source change now in `master`. Merging or pushing code does not update
installed apps or replace these downloads: build and verify new APKs from
`master`, then install/distribute them to ship those changes. iOS also requires
a separate build and distribution step; no iOS download is provided here.

These APKs use the new per-app SirfBazar release keys. They cannot update an
older APK signed with a different key in place. Do not uninstall an existing app
without first considering loss of its local data.

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
