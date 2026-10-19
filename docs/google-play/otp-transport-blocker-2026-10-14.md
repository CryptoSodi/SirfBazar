# WhatsApp OTP transport blocker - 14 October 2026

Status: unresolved security finding; no longer held as a Console submission gate.
All three releases were submitted after app/SDK disclosure review. The historical
inspection below predates the scoped remediation attempt described here.

## Subsequent authorized attempt and operator decision

The owner later approved a scoped HTTPS fix and proxy restart. Connect received
a dedicated `whatsapp-otp-https.service` using the existing Caddy binary,
`/opt/whatsapp-otp-api/config/HTTPS.Caddyfile`, HTTPS storage under that service's
directory, and a TCP 443 host firewall rule tagged `sirfbazar-otp-https` persisted
in `/etc/iptables/rules.v4`. Backups are in
`/var/backups/whatsapp-otp-https-20261014`.

Public HTTPS remained unreachable with Oracle ingress unavailable to this
operator; certificate issuance did not complete. The dedicated HTTPS service
and rule remain from that attempt. Original HTTP proxy and WhatsApp session
were preserved. The live API OTP URL was not switched and no encrypted SSH
forward was installed. The proposed forward was not authorized; the owner
directed publication to proceed without further OTP work.

The Data safety encryption answer concerns device-to-server transport, not a
certification that this backend hop is secure. No unsolicited OTP narrative was
added to the store listing. The internal finding and attempted configuration are
retained here for operational follow-up. Statements below about no changes,
unsent declarations and incomplete revision tests describe the earlier check,
not the final submission state.

## Evidence

- A read-only check of the running API configuration on `129.153.16.84`
  reported `OTP_PROVIDER=whatsapp`, `GOOGLE_AUTH_PROVIDER=google`, and
  `WHATSAPP_API_BASE_URL` using `http:` with host `otp.sirfbazar.com`.
  Only provider names and URL protocol/host were printed, not credentials.
- `apps/api/src/whatsapp/whatsapp.service.ts`, methods `configuration`,
  `sendOtp` and `send`, permit HTTP and send the phone number and OTP as JSON
  with a bearer service credential. `ready` also sends that credential.
  Redirects are rejected; an HTTP redirect would not fix this integration.
- An unauthenticated HTTPS health request from the API server to
  `https://otp.sirfbazar.com/health` timed out at the 10-second connection
  limit, reporting HTTP `000`. No OTP, phone number or credential was sent.
  This establishes no working HTTPS response at that time, not a diagnosis of
  DNS, firewall, certificate or proxy failure, or proof of a permanent outage.

The main app-to-API HTTPS connection does not encrypt this subsequent HTTP hop.
The configuration exposes phone numbers, OTPs and the service credential to
network interception or modification. No interception or credential compromise
was demonstrated; no packet capture or intrusive security test was performed.

## Google Play declaration qualification

[Google's Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
describes the encryption disclosure in terms of device-to-server transport,
including SDK transmissions, and discusses some user-directed external-service
exceptions. Consequently, this backend HTTP finding alone is not a definitive
answer to the Play encryption checkbox. Do not assume an exception applies to
SirfBazar's authentication service or certify all data paths from one HTTPS URL.

The earlier suggestion that this hop automatically mandates an encryption answer
of No was too broad. The customer's draft encryption answer remains unanswered,
pending a complete assessment of applicable app, SDK and provider flows. No
encryption declaration or completed Data safety form was submitted in this check.
The transport weakness remains a security blocker independently of that form.

## Change boundary

No OTP-server configuration, certificate, DNS, firewall, WhatsApp session, API
environment, credential or service was changed for this finding. No service was
restarted, and no deployment was performed. Do not repair or rotate credentials
under the previous broad release authorization: obtain fresh approval first.

## Proposed remediation after approval

1. Inspect only the OTP hostname's TLS routing and reachability; identify the
   failure before proposing a change. Preserve other services and WhatsApp state.
2. Back up relevant configuration securely. Establish valid, directly reachable
   HTTPS for the OTP hostname and verify it from the API host without secrets.
3. Back up the API configuration, then switch only the OTP base URL to HTTPS.
   Restart only the SirfBazar API if required; verify provider readiness and an
   explicitly authorized test OTP without logging credentials or codes.
4. Assess credential rotation because of historical cleartext exposure; coordinate
   both ends under separate approval. Consider a production HTTPS-only guard
   with focused configuration tests in a subsequent code change.
5. Retest failure handling and update the declaration evidence. If cutover fails,
   do not silently restore insecure HTTP; obtain an explicit operational decision.

## Other remaining release gates

- Owner declined internal testers. No tester was added or testing rollout
  published. Play-installed Google login, Maps and signing behavior remain
  unverified; sideloaded release APK checks do not substitute for those checks.
- Native onboarding/upload and order-revision coverage remain incomplete.
- Per-app Data safety classification and manual deletion fulfillment verification
  remain incomplete. No full-feature-access certification or Play review
  submission was made.
