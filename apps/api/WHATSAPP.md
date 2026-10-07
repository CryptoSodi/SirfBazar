# WhatsApp delivery

The browser continues calling this NestJS API. Only the backend calls the WhatsApp API.
Use these **server environment** settings:

```dotenv
OTP_PROVIDER=whatsapp
WHATSAPP_API_BASE_URL=http://otp.sirfbazar.com
OTP_TTL_SECONDS=300
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_ATTEMPTS=5
OTP_MAX_REQUESTS_PER_HOUR=5
```

Set `WHATSAPP_API_KEY` privately in the server/service environment. Never commit it, place it
in public frontend environment variables, or pass it in a URL or command argument.
The supplied HTTP base URL is supported; use HTTPS when enabled at the service to also
protect the bearer credential in transit. Redirects are rejected rather than forwarded.

## Authentication

- `POST /api/auth/send-otp`: login challenges for existing customer/rider flows.
- `POST /api/auth/merchant-register/start`: merchant mobile verification.
- `POST /api/auth/merchant-password/request`: merchant mobile password recovery.
- Existing verify/reset endpoints still perform all verification in this application.
- Random six-digit strings (including leading zeros) are generated with Node crypto.
  Only salted bcrypt hashes are stored. Challenges expire and are single-use.
- Recipient cooldown (60 seconds) and hourly cap (5) are shared across purposes.
  PostgreSQL transaction-scoped advisory locks serialize challenge creation for the same
  recipient, including across API processes. Atomic attempt reservations enforce the
  five-attempt cap, and atomic consumption prevents concurrent replay.
- A resend invalidates older challenges for that purpose. Explicit send rejection
  invalidates the new challenge but still counts against the cooldown/request cap.
- Timeout, network failure, malformed acceptance or `SEND_UNCONFIRMED` retain the
  challenge because the code may arrive. **No send is automatically retried.** Login
  and registration responses have `status: "unconfirmed"` and explanatory text;
  registration retains its `attemptId`, allowing the received code to be verified.
  Recovery uses generic wording to avoid asserting delivery or revealing an account.
- Successful submission uses `status: "submitted"`; it does **not** mean delivered.
  Legacy `sent` on login is retained for compatibility, meaning submission only.
- Email signup/recovery is rejected clearly in real-provider mode because this service
  only sends WhatsApp messages. Merchant users should select mobile recovery.
- Mock OTP is disabled in production, and the mock adapter no longer logs codes.
  Previously issued SHA-256 OTP challenges must be re-requested after this release;
  account passwords and refresh-token hashing are unchanged. No schema migration is required.

## Custom messages and readiness

Import `WhatsAppModule` and inject `WhatsAppService` in the backend consumer.
`sendMessage(recipientPhone, message)` sends to `/send-message`; callers must derive and
authorize the actual recipient. There is intentionally no public arbitrary-message relay.
Phones must have a country code and leading `+`, without whitespace. OTP transport accepts
4–10 digit strings; messages must be nonblank and at most 1,000 Unicode code points.

`sendOtp` and `sendMessage` return only `{status: "submitted", messageId, requestId}`.
Both use Bearer authentication, JSON bodies and a 30-second timeout. The shared singleton
fails fast on concurrent submissions and limits combined send requests to 30/minute per
API process. The upstream service enforces the global limit across all clients/replicas.
If using several workers, upstream 429 responses remain authoritative; no retries/queue.

Provider 400/422/429 map to sanitized application errors. Provider 401 becomes a 503
configuration error (not a browser-session 401). Provider 503 means unavailable.
502/504 and uncertain network outcomes report `SEND_UNCONFIRMED`. Provider bodies,
credentials, recipients and message/OTP contents are not logged by this integration.

`GET /api/admin/whatsapp/ready` requires an admin/super-admin application JWT and calls
the provider's authenticated `/ready`: 200 `{ready:true}`, or 503 `{ready:false}`.
The backend-only `npm run whatsapp:ready` command performs the same connectivity check
without sending any message. `/health` is not used to infer WhatsApp connectivity.

## Validation and activation

1. `npm run test:whatsapp` runs mocked transport and in-memory auth regression checks.
2. `npm run typecheck` and `npm run build` validate the API.
3. Configure the private key and `OTP_PROVIDER=whatsapp` in the **actual server** service
   environment; run `npm run whatsapp:ready` there, then deploy/restart the backend.
4. Confirm one controlled recipient can request and verify an OTP through the app.
   Do not automatically repeat an ambiguous send. Respect the resend cooldown.

Automated checks send no real messages and do not touch a live database. They do not
substitute for production readiness, real-recipient delivery, or PostgreSQL integration
testing. This source change alone does not activate the running server.
