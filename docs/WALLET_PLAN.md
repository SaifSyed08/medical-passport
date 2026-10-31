# Apple Wallet plan

Status: **groundwork only.** No pass is generated or signed today. This document covers what exists, what's left, and an open question about where signing can run.

## What exists now

| Piece | Where | Notes |
|---|---|---|
| Card fields for Wallet | `tessera_cards.serial_number` (stable per card), `status` (`active` / `frozen` / `voided`), `pass_last_updated` (nullable, set when status changes) | `db/schema.ts`, `lib/tessera/cards.ts` |
| `PassIssuer` interface | `issue(content: PassContent): Promise<Uint8Array>` | `lib/tessera/wallet.ts` |
| `NullPassIssuer` | Throws `WalletNotEnabledError` | Exported as `passIssuer`. Swap this one line for the real issuer. |
| Pass content allow-list | `buildPassContent(card, name)` builds the only input an issuer gets: serial, branding, patient name, QR message (the card URL), clinician instructions, voided flag | Enforced by `tests/profile-wallet.test.ts`: no allergies, conditions, medications, DOB, blood type or insurance |
| Feature flag | `WALLET_ENABLED` env var, default off | `lib/tessera/flags.ts`. Exposed to the app as `walletEnabled` in `GET /api/v1/me`. |
| Reserved endpoint | `GET /api/v1/passes/{card_id}.pkpass` (traveler bearer token) | Returns `501 {"code":"wallet_not_enabled"}` while the flag is off or the issuer is the null one |
| App button and preview | "Add to Apple Wallet · Coming soon" plus a labelled mockup | `mobile/src/app/wallet-preview.tsx` |

## Steps to ship real passes

1. **Join the Apple Developer Program** ($99/year) with the account that will own the pass type.
2. **Create a Pass Type ID** (e.g. `pass.org.texasconvergent.tessera`) in Certificates, Identifiers & Profiles.
3. **Create a pass-signing certificate** for that Pass Type ID: generate a CSR, download the certificate, and export the certificate and private key. Keep the key out of git, and store it as a host secret if the host supports secrets (see the open question below).
4. **Add Apple's WWDR intermediate certificate.** Check the current generation on Apple's certificate authority page; Apple has rotated it before.
5. **Build the pass** from `buildPassContent()`:
   - `pass.json`: a `generic` pass with `passTypeIdentifier`, `teamIdentifier`, `serialNumber`, `organizationName: "Tessera"`, `description`, a primary field with the patient name, back fields with the clinician instructions, a QR barcode whose `message` is the card URL (`PKBarcodeFormatQR`, `messageEncoding: "iso-8859-1"`), and `voided` from the card status.
   - Image assets: `icon.png`, `icon@2x.png`, `logo.png` and so on.
   - `manifest.json`: SHA-1 hash of every file in the pass.
   - `signature`: a detached PKCS#7 (CMS) signature over `manifest.json`, DER-encoded, signed with the pass certificate and key, with the WWDR certificate included.
   - Zip everything flat (no wrapper folder).
6. **Serve it.** `GET /api/v1/passes/{card_id}.pkpass` returns the archive with `Content-Type: application/vnd.apple.pkpass`. Opened in Safari on iOS, that content type shows Apple's "Add to Wallet" sheet. The app can open the URL in the browser, or download it and hand it to the system.
7. **Add the PassKit web service** so the pass follows the card. Set `webServiceURL` (HTTPS) and a per-pass `authenticationToken` (16+ random characters, stored hashed, like the app tokens). Implement Apple's endpoints under that URL:
   - `POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}`: register a device.
   - `DELETE` on the same path: unregister.
   - `GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}?passesUpdatedSince=…`: list serials changed since a tag. Use `pass_last_updated`.
   - `GET /v1/passes/{passTypeIdentifier}/{serialNumber}`: the latest signed pass.
   - `POST /v1/log`: device error logs.

   Devices authenticate with `Authorization: ApplePass <authenticationToken>`. This needs a new table for device registrations.
8. **Freeze or replace voids the pass.** `setFrozen` and `replaceCard` already bump `pass_last_updated`. Add an APNs push to registered devices (Apple's pass-update push uses the pass certificate). The device then fetches the latest pass, which has `voided: true`, and the QR stops working anyway because the server refuses the old or frozen `card_id`.
9. Flip `WALLET_ENABLED=true` and enable the app button.

The product rule stays the same: the pass carries only the card URL as a QR, the patient's name, branding and brief clinician instructions. If a field gets added to `PassContent`, the test will fail until `PASS_FIELDS` is deliberately updated.

## Open question: can signing run inside the Workers runtime?

**Not verified.** The parts:

- **Zip and SHA-1 manifest:** fine on Workers. SHA-1 is available in Web Crypto (`crypto.subtle.digest("SHA-1", …)`), and a small pure-JS zip writer (store-only is enough) has no Node dependency.
- **Detached PKCS#7/CMS signature:** the hard part. Web Crypto can do the RSA-SHA256 signing primitive, but not CMS/PKCS#7 encoding. That has to come from a library:
  - `node-forge` implements PKCS#7 in pure JavaScript (its own RSA, no Node `crypto`). It should be able to run under `nodejs_compat`, but it's large and slow, and RSA signing in pure JS adds CPU time per pass. That matters against Workers CPU limits.
  - `passkit-generator` (built on `node-forge`) reportedly ships a Cloudflare Workers example, per its repository description in search results. I haven't run it here, and it may depend on `Buffer`/streams that `nodejs_compat` only partly covers.
  - Newer Web Crypto-only libraries (e.g. `passmint`, `@swapnanildhol/passkit-pkcs7-signature`) build the CMS structure themselves and call Web Crypto for the RSA signature. They're early and pre-1.0. Web Crypto also needs the key in PKCS#8 form, so the PKCS#1 key Apple's tools usually produce would need converting first.
- **Secrets:** signing needs the private key at runtime. This project is hosted on the OpenAI Sites platform, and it's **unknown whether Sites supports custom secret bindings** (`.openai/hosting.json` only declares D1 and R2). If it doesn't, the key can't be supplied to this Worker, whatever library is used.

**Recommendation:** spike `passkit-generator`'s Workers example (or a Web Crypto CMS library) in a local `npm start` build and measure CPU time per pass. If it works and Sites can hold the key as a secret, keep signing in the Worker behind `PassIssuer`.

**Fallback if either fails:** run a tiny separate signing service (a single-route Node function using `passkit-generator` or `openssl smime`) that holds the certificate and key. The Worker builds `PassContent`, calls the service over HTTPS with a shared secret, and streams back the `.pkpass`. Only a `RemotePassIssuer` implementing `PassIssuer` changes; endpoints, the app and tests stay the same. The signing service receives only the allow-listed `PassContent`, so it never sees medical data.

## Out of scope for now
Google Wallet, NFC, App Store submission, real clinician identity.
