# SirfBazar New Machine Setup Guide

Generated from the repository on 2026-09-21.

This guide explains how to prepare a clean machine, configure the database and environment variables, run every SirfBazar application, and verify the installation.

## Repository components and ports

| Component | Directory | Local URL or runtime |
| --- | --- | --- |
| Backend API | `apps/api` | `http://localhost:3001` |
| Swagger API docs | `apps/api` | `http://localhost:3001/docs` |
| Customer website | `apps/web` | `http://localhost:3000` |
| Admin dashboard | `apps/admin` | `http://localhost:5173` |
| Merchant web portal | `apps/shop` | `http://localhost:5174` |
| Browser POS | `apps/pos` | `http://localhost:5175` |
| Customer mobile app | `apps/customer-app` | Expo development server |
| Merchant mobile app | `apps/merchant-app` | Expo development server |
| Rider mobile app | `apps/rider-app` | Expo development server |
| PostgreSQL | `docker-compose.yml` | `localhost:5432` |

There is no root `package.json`. Dependencies must be installed inside each application directory.

## 1. System prerequisites

Install the following:

- Git.
- Node.js 20 or newer. Node.js 22 is used by CI and is the recommended version.
- npm, included with Node.js.
- Docker Desktop, or PostgreSQL 16 or newer installed directly.
- PowerShell 7 on Windows if using `scripts/dev.ps1`.

For mobile development, also install what your target requires:

- Expo Go for basic JavaScript development where supported.
- An Android device or Android Studio emulator for Android testing.
- macOS with Xcode for local iOS builds.
- An Expo development build for native Google login and remote push notifications. Those features do not work fully in Expo Go.
- An Expo account and EAS access if creating signed development or production builds.

Confirm the basic tools:

```powershell
git --version
node --version
npm --version
docker --version
```

## 2. Clone the repository

```powershell
git clone https://github.com/CryptoSodi/SirfBazar.git
cd SirfBazar
```

All commands below assume the repository root is the current directory unless another directory is shown.

## 3. Install application dependencies

For a reproducible installation, use `npm ci` in every application:

```powershell
$apps = @(
  'api',
  'web',
  'admin',
  'shop',
  'pos',
  'customer-app',
  'merchant-app',
  'rider-app'
)

foreach ($app in $apps) {
  Push-Location "apps/$app"
  npm ci
  Pop-Location
}
```

To work on only one application, run `npm ci` only in that application's directory.

## 4. Start PostgreSQL

### Option A: Docker Compose

The included Compose file starts PostgreSQL 16 with the development credentials expected by `.env.example`:

```powershell
docker compose up -d
docker compose ps
```

Development connection string:

```text
postgresql://postgres:postgres@localhost:5432/sirfbazar
```

The database is stored in the Docker volume `sirfbazar-pgdata`.

To stop PostgreSQL without deleting its data:

```powershell
docker compose stop
```

Do not run `docker compose down -v` unless you intentionally want to delete the development database volume.

### Option B: native PostgreSQL

Install PostgreSQL 16 or newer, create a database named `sirfbazar`, and update `DATABASE_URL` with the password chosen during installation.

Example on Windows:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\createdb.exe' -U postgres sirfbazar
```

Example connection string:

```text
postgresql://postgres:YOUR_PASSWORD@localhost:5432/sirfbazar
```

If the password contains reserved URL characters, URL-encode it before placing it in `DATABASE_URL`.

## 5. Configure the backend API

Create the local API environment file:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

For a complete local setup, `apps/api/.env` should contain values equivalent to:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sirfbazar"

PORT=3001
PUBLIC_BASE_URL="http://localhost:3001"

JWT_SECRET="replace-with-a-long-random-local-secret"
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=30

DB_CONNECT_RETRIES=10
DB_CONNECT_RETRY_DELAY_MS=3000

OTP_PROVIDER=mock
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_PROVIDER_BASE_URL=
OTP_PROVIDER_API_KEY=

GOOGLE_AUTH_PROVIDER=mock
GOOGLE_CLIENT_ID=

DEFAULT_DELIVERY_BASE_FEE_PAISA=5000
DEFAULT_DELIVERY_PER_KM_FEE_PAISA=1500
DEFAULT_SERVICE_FEE_PAISA=1000
SMALL_ORDER_THRESHOLD_PAISA=30000
SMALL_ORDER_FEE_PAISA=3000
DEFAULT_COMMISSION_PERCENT=10
MERCHANT_ACCEPT_TIMEOUT_MINUTES=10

CORS_ORIGINS="http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175"
```

`PUBLIC_BASE_URL` is important on a local machine. Without it, newly uploaded image URLs default to the production API hostname.

### Create the schema and development data

```powershell
cd apps/api
npx prisma generate
npx prisma db push
npm run seed
cd ../..
```

The seed is idempotent, but it creates development accounts and known credentials. Do not run it against a real production database without reviewing and changing those credentials.

The repository currently has no Prisma migration history. `prisma db push` is appropriate for a new development database; production should adopt reviewed migrations as described in `docs/remaining-work-report.md`.

## 6. Run the backend API

Development mode with file watching:

```powershell
cd apps/api
npm run dev
```

Production-style local run:

```powershell
cd apps/api
npm run build
npm run start:prod
```

Verify the API from another terminal:

```powershell
Invoke-RestMethod http://localhost:3001/api/products/categories
```

Open Swagger at `http://localhost:3001/docs`.

Run the API smoke test after the API is running and the database is seeded:

```powershell
cd apps/api
npm run smoke
```

To test a non-default API URL:

```powershell
$env:API_URL = 'https://api.example.com/api'
npm run smoke
```

## 7. Run the customer website

Create `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Then run:

```powershell
cd apps/web
npm run dev
```

Open `http://localhost:3000`.

Notes:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is optional when backend Google auth is in mock mode. Set it to the Google Web OAuth client ID for real browser Google login.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is required for the interactive Google map picker. Restrict the key to the correct HTTP referrers and the Maps JavaScript API.
- Variables prefixed with `NEXT_PUBLIC_` are embedded into browser code and are not secrets.

## 8. Run the admin dashboard

Create `apps/admin/.env.local`:

```dotenv
VITE_API_URL="http://localhost:3001/api"
VITE_GOOGLE_CLIENT_ID=
```

Run:

```powershell
cd apps/admin
npm run dev
```

Open `http://localhost:5173`.

The seeded development admin login is documented in `docs/users-and-apps.md`. Change seeded credentials before any real deployment.

## 9. Run the merchant web portal

Create `apps/shop/.env.local`:

```dotenv
VITE_API_URL="http://localhost:3001/api"
VITE_GOOGLE_CLIENT_ID=
```

Run:

```powershell
cd apps/shop
npm run dev
```

Open `http://localhost:5174`.

Use a seeded merchant owner phone number with mock OTP `123456`, or configure real Google login.

## 10. Run the browser POS

Create `apps/pos/.env.local`:

```dotenv
VITE_API_URL="http://localhost:3001/api"
VITE_GOOGLE_CLIENT_ID=
```

Run:

```powershell
cd apps/pos
npm run dev
```

Open `http://localhost:5175`.

The POS uses merchant authentication and the merchant's shared product inventory. Merchant staff must have the `POS` permission.

## 11. Run the three web applications together

The included script starts only the API, customer website, and admin dashboard in separate PowerShell windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1
```

Start the merchant portal and POS separately:

```powershell
Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd '$PWD\apps\shop'; npm run dev"
Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd '$PWD\apps\pos'; npm run dev"
```

PostgreSQL must already be running before starting the API.

## 12. Run the customer mobile app

### Use the live API

No API variable is required because the app defaults to `https://api.sirfbazar.com/api`:

```powershell
cd apps/customer-app
npx expo start
```

### Use the local API from a physical device

`localhost` on a phone points to the phone, not the development computer. Find the computer's LAN IPv4 address with `ipconfig`, then create `apps/customer-app/.env.local`:

```dotenv
EXPO_PUBLIC_API_URL="http://192.168.1.50:3001/api"
```

Replace `192.168.1.50` with the actual LAN address. The phone and computer must be on the same network, and the firewall must allow inbound TCP traffic to port `3001` on the private network.

Run:

```powershell
cd apps/customer-app
npx expo start
```

## 13. Run the merchant mobile app

Create `apps/merchant-app/.env.local` when using a local API:

```dotenv
EXPO_PUBLIC_API_URL="http://192.168.1.50:3001/api"
```

Run:

```powershell
cd apps/merchant-app
npx expo start
```

## 14. Run the rider mobile app

Create `apps/rider-app/.env.local` when using a local API:

```dotenv
EXPO_PUBLIC_API_URL="http://192.168.1.50:3001/api"
```

Run:

```powershell
cd apps/rider-app
npx expo start
```

The rider app needs location permission. It sends location approximately every 15 seconds during an active delivery.

## 15. Native mobile configuration that is not environment-based

Several mobile settings are currently committed in source files rather than read from environment variables. A new owner or fork must review them.

### Google OAuth

Each mobile app contains these constants in `lib/google.ts`:

- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`

For real Google login:

1. Create a Web OAuth client and use its ID in the backend `GOOGLE_CLIENT_ID` and each app's `GOOGLE_WEB_CLIENT_ID`.
2. Create Android OAuth clients for these package names and register the signing SHA-1 fingerprints:
   - `pk.sirfbazar.customer`
   - `pk.sirfbazar.merchant`
   - `pk.sirfbazar.rider`
3. Create iOS OAuth clients for these bundle identifiers if building for iOS:
   - `pk.sirfbazar.customer`
   - `pk.sirfbazar.merchant`
   - `pk.sirfbazar.rider`
4. Set each `GOOGLE_IOS_CLIENT_ID` and configure the required iOS URL scheme in `app.json`.
5. Use a development or production build, not Expo Go.

### Google Maps

The customer Android Maps key is currently in `apps/customer-app/app.json` under `android.config.googleMaps.apiKey`. Replace it for a different Google Cloud project and restrict it to the Android package and signing certificate.

The customer website uses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` instead.

### Expo and push notifications

Each `app.json` contains an EAS `projectId`. If the new machine uses the existing Expo organization, authenticate with the account that owns those projects. For a fork or new organization:

1. Run `npx eas-cli login`.
2. Run `npx eas-cli init` in each mobile app.
3. Replace the EAS project ID written into `app.json`.
4. Configure Android and iOS push credentials in EAS.
5. Build a development client or production binary.

Example Android development build:

```powershell
cd apps/customer-app
npx eas-cli build --profile development --platform android
npx expo start --dev-client
```

Repeat in `merchant-app` and `rider-app` as needed.

## 16. Complete environment-variable reference

### Backend API: `apps/api/.env`

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | None | PostgreSQL connection string used by Prisma. |
| `PORT` | No | `3001` | API listening port. |
| `PUBLIC_BASE_URL` | Recommended | `https://api.sirfbazar.com` | Base URL returned for uploaded and imported image URLs. Do not include `/api`. |
| `JWT_SECRET` | Production: yes | Unsafe development fallback | Signs access tokens. Use a long random secret. |
| `JWT_ACCESS_TTL_SECONDS` | No | `900` | Access-token lifetime in seconds. |
| `JWT_REFRESH_TTL_DAYS` | No | `30` | Refresh-token lifetime in days. |
| `DB_CONNECT_RETRIES` | No | `10` | Database connection attempts during startup. |
| `DB_CONNECT_RETRY_DELAY_MS` | No | `3000` | Delay between startup connection attempts. |
| `OTP_PROVIDER` | No | `mock` | `mock` for development or `external` for the provider adapter. |
| `OTP_TTL_SECONDS` | No | `300` | OTP lifetime. |
| `OTP_MAX_ATTEMPTS` | No | `5` | Verification attempts allowed per OTP. |
| `OTP_RESEND_COOLDOWN_SECONDS` | No | `60` | Delay before another OTP can be requested. |
| `OTP_PROVIDER_BASE_URL` | External OTP: yes | Empty | Base URL expected by the generic external OTP adapter. |
| `OTP_PROVIDER_API_KEY` | External OTP: yes | Empty | Bearer credential used by the generic external OTP adapter. |
| `GOOGLE_AUTH_PROVIDER` | No | `mock` | `mock` or `google`. |
| `GOOGLE_CLIENT_ID` | Real Google auth: yes | Empty | Expected Google ID-token audience. Use the Web OAuth client ID. |
| `DEFAULT_DELIVERY_BASE_FEE_PAISA` | No | `5000` | Base delivery fee in paisa. |
| `DEFAULT_DELIVERY_PER_KM_FEE_PAISA` | No | `1500` | Additional delivery fee per kilometer in paisa. |
| `DEFAULT_SERVICE_FEE_PAISA` | No | `1000` | Service fee in paisa. |
| `SMALL_ORDER_THRESHOLD_PAISA` | No | `30000` | Subtotal below which the small-order fee applies. |
| `SMALL_ORDER_FEE_PAISA` | No | `3000` | Small-order fee in paisa. |
| `DEFAULT_COMMISSION_PERCENT` | No | `10` | Default merchant percentage commission used by onboarding/seeded defaults. |
| `MERCHANT_ACCEPT_TIMEOUT_MINUTES` | No | `10` | Time before an unaccepted merchant order is automatically rejected. |
| `CORS_ORIGINS` | Recommended | `*` plus built-in production origins | Comma-separated browser origins allowed to call the API. |

### Customer website: `apps/web/.env.local`

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Recommended | `http://localhost:3001/api` | Browser-facing API base URL. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Real Google login: yes | Empty | Google Web OAuth client ID. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Map picker: yes | Empty | Google Maps JavaScript API key. |

### Admin, merchant web, and POS: each app's `.env.local`

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | Recommended | `http://localhost:3001/api` | Browser-facing API base URL. |
| `VITE_GOOGLE_CLIENT_ID` | Real Google login: yes | Empty | Google Web OAuth client ID. |

Set these independently in `apps/admin`, `apps/shop`, and `apps/pos` because Vite reads environment files from the application's own directory.

### Mobile apps: each app's `.env.local`

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Local API: yes | `https://api.sirfbazar.com/api` | API base URL embedded in the Expo application. |

`EXPO_PUBLIC_` variables are included in the client binary and must never contain secrets.

### Test-only variable

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `API_URL` | No | `http://localhost:3001/api` | API target used by `apps/api/test/smoke.ts`. |

## 17. Recommended production values

Example shape only; replace every placeholder:

```dotenv
DATABASE_URL="postgresql://APP_USER:URL_ENCODED_PASSWORD@DB_HOST:5432/sirfbazar"
PORT=3001
PUBLIC_BASE_URL="https://api.example.com"

JWT_SECRET="GENERATE_A_LONG_RANDOM_SECRET"
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=30

OTP_PROVIDER=external
OTP_PROVIDER_BASE_URL="https://selected-provider.example"
OTP_PROVIDER_API_KEY="SECRET_PROVIDER_KEY"

GOOGLE_AUTH_PROVIDER=google
GOOGLE_CLIENT_ID="WEB_OAUTH_CLIENT_ID.apps.googleusercontent.com"

CORS_ORIGINS="https://example.com,https://www.example.com,https://admin.example.com,https://shop.example.com,https://pos.example.com"
```

Important production notes:

- The current external OTP adapter is a provider-shaped placeholder. Adapt it to the selected vendor before setting `OTP_PROVIDER=external`.
- Real online payment providers are not integrated yet, so there are no payment gateway environment variables in the current code.
- Never expose `DATABASE_URL`, `JWT_SECRET`, or `OTP_PROVIDER_API_KEY` through `NEXT_PUBLIC_`, `VITE_`, or `EXPO_PUBLIC_` variables.
- Do not commit `.env`, `.env.local`, tunnel credentials, signing keys, or production database credentials.
- Ensure production `CORS_ORIGINS` contains every deployed browser application.

## 18. Production build commands

### API

```powershell
cd apps/api
npm ci
npx prisma generate
npm run build
npm run start:prod
```

### Customer website

```powershell
cd apps/web
npm ci
npm run build
npm run start
```

### Admin, merchant web, or POS

Run this inside the relevant directory:

```powershell
npm ci
npm run build
npm run preview
```

`npm run preview` is for local build verification. Deploy the generated Vite application to a static host such as Vercel for production.

### Mobile applications

Run from the relevant mobile directory:

```powershell
npx eas-cli build --profile production --platform android
```

Use `--platform ios` on macOS or through EAS when iOS credentials are configured.

## 19. Production host and Cloudflare Tunnel

The current deployment design serves `api.sirfbazar.com` from a self-hosted API through Cloudflare Tunnel. A new production host also needs:

- PostgreSQL data restored or initialized.
- `apps/api/.env` containing production values.
- API and PostgreSQL startup supervision.
- Cloudflare Tunnel credentials and `%USERPROFILE%\.cloudflared\config.yml`.
- A tunnel ingress mapping from the API hostname to `http://localhost:3001`.
- Automated database backups.
- Sleep disabled and reboot recovery tested if using a workstation as the host.

The full DNS, Vercel, and Cloudflare Tunnel procedure is in `docs/deployment.md`.

Do not copy a tunnel credential file through source control. Provision a new tunnel or transfer credentials through an approved secret-management channel.

## 20. New-machine verification checklist

- [ ] Node.js 20+ and npm are installed.
- [ ] Dependencies are installed in all applications being used.
- [ ] PostgreSQL is running and `DATABASE_URL` connects successfully.
- [ ] Prisma client generation and schema push complete successfully.
- [ ] Development seed completes successfully when demo data is wanted.
- [ ] API starts and Swagger opens at `http://localhost:3001/docs`.
- [ ] API smoke test passes.
- [ ] Customer web loads categories and products at `http://localhost:3000`.
- [ ] Admin opens at `http://localhost:5173` and can log in.
- [ ] Merchant portal opens at `http://localhost:5174` and can log in.
- [ ] POS opens at `http://localhost:5175` and can load merchant inventory.
- [ ] Physical mobile devices can reach the computer's LAN IP on port `3001`.
- [ ] Customer app can browse, add to cart, log in, and place a COD order.
- [ ] Merchant app can accept the order and assign an owned rider.
- [ ] Rider app can progress the delivery and complete it with the delivery code.
- [ ] Uploaded image URLs point to the intended API host.
- [ ] Every deployed browser origin is present in `CORS_ORIGINS`.
- [ ] Real Google login is tested with the correct Web, Android, and iOS OAuth clients.
- [ ] Push notifications are tested using a development or production build, not Expo Go.

## 21. Common setup problems

### Browser reports a CORS error

Add the exact browser origin, including protocol and port, to `CORS_ORIGINS`, restart the API, and retry. Local values should normally include ports `3000`, `5173`, `5174`, and `5175`.

### Mobile app cannot connect to the local API

- Do not use `localhost` in `EXPO_PUBLIC_API_URL` on a physical device.
- Use the computer's LAN IPv4 address.
- Confirm both devices are on the same network.
- Allow TCP port `3001` through the host firewall on private networks.
- Verify the URL in the phone browser or with another device before debugging the app.

### API cannot connect to PostgreSQL

- Confirm `docker compose ps` or the native PostgreSQL service shows the database running.
- Verify the database name, user, password, host, and port in `DATABASE_URL`.
- URL-encode special characters in the password.
- Check whether another PostgreSQL instance already occupies port `5432`.

### Products do not load in deployed browser apps

- Verify the public API endpoint directly.
- Confirm the Cloudflare Tunnel or reverse proxy is healthy.
- Confirm the frontend API URL ends with `/api`.
- Confirm the deployed origin is allowed by CORS.

### Google login does not appear or fails

- Browser clients require the corresponding public Google client-ID variable.
- The backend must use the same Web OAuth client ID as `GOOGLE_CLIENT_ID`.
- Native apps require Android/iOS OAuth clients and a development build.
- Android signing SHA-1 fingerprints must match the OAuth client configuration.

### Remote push notifications do not arrive

- Expo Go is insufficient for the current push setup.
- Verify the EAS project ID and push credentials.
- Ensure notification permission was granted on the device.
- Confirm the user logged in after installing the build so the push token was registered with the API.
