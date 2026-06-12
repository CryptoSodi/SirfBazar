# SirfBazar — production deployment

Live topology:

| Piece | Where | URL |
|---|---|---|
| Customer website (`apps/web`) | Vercel | `https://sirfbazar.com` (+ `www`) |
| Admin dashboard (`apps/admin`) | Vercel | `https://admin.sirfbazar.com` |
| Backend API (`apps/api`) | Self-hosted (your machine) behind a Cloudflare Tunnel | `https://api.sirfbazar.com` |
| DNS / TLS | Cloudflare | `sirfbazar.com` zone |
| Repo | GitHub | `https://github.com/CryptoSodi/SirfBazar` |

The frontends already default to the production API: `apps/web/.env.production` and
`apps/admin/.env.production` both point at `https://api.sirfbazar.com/api` (a Vercel
dashboard env var overrides them if you ever need to).

---

## 1. API on your machine + Cloudflare Tunnel

### 1a. Run the API as a persistent process

```powershell
cd C:\repos\SirfBazar\apps\api
npm run build
npm run start:prod        # listens on http://localhost:3001
```

To keep it alive across reboots, either use **pm2**:

```powershell
npm install -g pm2
pm2 start dist/main.js --name sirfbazar-api
pm2 save
```

…or create a Windows **Task Scheduler** task: trigger *At startup*, action
`node C:\repos\SirfBazar\apps\api\dist\main.js`, start in `C:\repos\SirfBazar\apps\api`.

Make sure `apps/api/.env` has:
- a strong `JWT_SECRET` (already rotated — do not commit `.env`),
- `CORS_ORIGINS=https://sirfbazar.com,https://www.sirfbazar.com,https://admin.sirfbazar.com,http://localhost:3000,http://localhost:5173`

### 1b. Cloudflare Tunnel → api.sirfbazar.com

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (e.g. `winget install Cloudflare.cloudflared`), then:

```powershell
cloudflared tunnel login                       # opens browser; pick the sirfbazar.com zone
cloudflared tunnel create sirfbazar-api        # note the tunnel UUID it prints
cloudflared tunnel route dns sirfbazar-api api.sirfbazar.com   # creates the CNAME in Cloudflare DNS
```

Create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: sirfbazar-api
credentials-file: C:\Users\<you>\.cloudflared\<TUNNEL-UUID>.json

ingress:
  - hostname: api.sirfbazar.com
    service: http://localhost:3001
  - service: http_status:404
```

Test it, then install it as a Windows service so it survives reboots:

```powershell
cloudflared tunnel run sirfbazar-api    # test — https://api.sirfbazar.com/docs should load
cloudflared service install             # run permanently as a service
```

Notes:
- The tunnel terminates TLS at Cloudflare — no certificates or port-forwarding needed on your machine.
- WebSockets (Socket.IO live tracking) work through Cloudflare tunnels out of the box.
- Verify: `https://api.sirfbazar.com/api/products/categories` should return JSON.

---

## 2. Website on Vercel → sirfbazar.com

1. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** → import `CryptoSodi/SirfBazar`.
2. **Root Directory:** `apps/web` (Edit → select the folder). Framework auto-detects as Next.js; leave build settings default.
3. Deploy. You get `https://<project>.vercel.app` — sanity-check it loads products (your tunnel must be up).
4. **Project → Settings → Domains:** add `sirfbazar.com` and `www.sirfbazar.com`.

## 3. Admin on Vercel → admin.sirfbazar.com

1. **Add New → Project** → import the SAME repo again.
2. **Root Directory:** `apps/admin`. Framework: Vite (auto-detected). `apps/admin/vercel.json` already handles SPA routing.
3. Deploy, then **Settings → Domains:** add `admin.sirfbazar.com`.

Both projects redeploy automatically on every `git push` to `master`.

---

## 4. Cloudflare DNS records

In the Cloudflare dashboard for `sirfbazar.com` (Vercel's Domains page shows the exact targets; these are the standard ones):

| Type | Name | Target | Proxy |
|---|---|---|---|
| A | `@` | `76.76.21.21` (Vercel) | **DNS only (grey cloud)** |
| CNAME | `www` | `cname.vercel-dns.com` | **DNS only (grey cloud)** |
| CNAME | `admin` | `cname.vercel-dns.com` | **DNS only (grey cloud)** |
| CNAME | `api` | `<TUNNEL-UUID>.cfargotunnel.com` | **Proxied (orange)** — created automatically by `tunnel route dns` |

Important: keep the Vercel records **grey-cloud (DNS only)**. Vercel issues its own certificates and proxying them through Cloudflare causes redirect loops / cert issues. The `api` record stays orange — that *is* the tunnel.

If you ever grey-cloud everything and use Cloudflare SSL settings: set SSL/TLS mode to **Full (strict)**.

---

## 5. Mobile apps against production

```powershell
$env:EXPO_PUBLIC_API_URL = "https://api.sirfbazar.com/api"
npx expo start
```

---

## 6. Go-live checklist

- [ ] `apps/api/.env`: strong `JWT_SECRET`, production `CORS_ORIGINS` (done)
- [ ] API running (pm2/Task Scheduler) + `cloudflared` service installed
- [ ] `https://api.sirfbazar.com/api/products/categories` returns JSON
- [ ] Both Vercel projects deployed with correct root directories
- [ ] Domains attached + DNS records grey-cloud for Vercel, orange for `api`
- [ ] Place a test order on `https://sirfbazar.com` end-to-end
- [ ] When the real OTP provider arrives: set `OTP_PROVIDER=external` + provider keys (mock OTP `123456` works until then — remember every visitor can log in with it)
- [ ] When real Google login is wanted: `GOOGLE_AUTH_PROVIDER=google` + `GOOGLE_CLIENT_ID`
- [ ] Back up `apps/api/prisma/dev.db` regularly (it is the production database on this setup), or migrate to PostgreSQL (`datasource provider = "postgresql"` + `DATABASE_URL`)
