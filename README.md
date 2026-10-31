# Medical Passport demo

A separate Sites app inspired by the existing survey's intro typography and transitions. This project has its own hosting identity, D1 database, and R2 storage. It does not access or modify the survey or its responses.

## Routes
- `/`: onboarding, eight simulated health providers, fictional record review, swipeable card styles, address autocomplete/manual entry, and interactive 3D completion.
- `/home`: account-scoped saved cards, reversible disable, confirmed delete, delivery preview and links.
- `/professional`: explicitly simulated professional access. Lookup is restricted to the signed-in user's or current browser's demo cards by number or Alex Morgan + 1994-06-18.
- `/card/:token`: account-scoped DOB-gated medical-only view. English, Spanish, and French demo terms. Browser language detection. Local medicine naming for the exact supported albuterol fixture.

## Important boundaries
This is a public fictional prototype, not a clinical product. Do not enter real health records. DOB is a UX demonstration, not a secure authentication factor. No real HealthKit / MyChart integration, credential verification, orders, SMS, or generative AI calls take place. The assistant deterministically retrieves selected facts from the saved record and declines treatment questions. Unknown edited text is retained, not silently translated. Local naming does not imply pharmaceutical interchangeability.

The optional cropped photo is stored in R2. Card records use D1, scoped to the platform authenticated user ID. APIs omit shipping and SMS details from the responder result. Disabling, expiry, and deletion prevent responder access. Owner checks are applied to every read and mutation, including lookups and photos. Existing cloud records remain protected by platform sign-in. Anonymous visitors use browser-local cards; no database ownership checks are removed. Guest cards and photos remain in localStorage on the same origin/browser. Clearing site storage removes them; guest links do not transfer records to another device.

## Before production
Use a native HealthKit application and approved provider authorization for live data; replace demo professional access with verified role-based authorization, audit logs and rate limits; implement appropriate consent, privacy, data retention and emergency-access policies; clinically validate translations and medication normalization; add a properly configured grounded model and clinical safeguards; integrate actual fulfillment and opted-in messaging. Do not merely change the demo labels to production labels.

## Development
Use Node >=22.13, the Sites installation/build helpers, and the included local preview. Generate migrations after schema changes and apply them to the local D1 database before testing. The local platform sign-in route is `/signin-with-chatgpt?return_to=/`.

## Tessera traveler app and `/api/v1`
> **Demo only · synthetic data · not for clinical use.** Production emergency-access policies need healthcare and legal review.

The repo now also contains:
- `mobile/`: the Expo traveler app (iOS and Android). Setup, Expo Go notes and checks are in [mobile/README.md](mobile/README.md).
- `/api/v1/*`: a JSON API on the same Worker for the app, with bearer-token auth (`app/api/v1`, logic in `lib/tessera`, types in `shared/tessera.ts`).
- `/t/{card_id}`: the URL every Tessera QR code opens. It's a placeholder until the clinician flow is built.
- [AUDIT.md](AUDIT.md) (repo audit and gap list), [TRANSLATION_REVIEW.md](TRANSLATION_REVIEW.md) (Japanese strings needing a qualified reviewer), [docs/WALLET_PLAN.md](docs/WALLET_PLAN.md) (Apple Wallet next steps).

### Web and backend
```sh
npm install
npm run dev          # vinext dev server (http://localhost:5173), mock platform sign-in
npm run build        # production build (same command Sites uses)
npm start            # run the built Worker locally on http://127.0.0.1:8787
npm run start:lan    # same, but reachable from phones on your Wi-Fi
npm test             # vitest (backend logic against real SQLite)
npm run lint
npm run db:seed      # seed Jordan Rivera through the running API; add `-- --reset` to wipe and reseed
```
The Tessera tables are created and seeded automatically on the first `/api/v1` or `/t/` request, so `db:seed` is optional. Point it at another server with `-- --url https://<host>`.

### Mobile against the deployed Workers URL or local dev
Set `EXPO_PUBLIC_API_URL` in `mobile/.env` (see `mobile/env.example`), then run `cd mobile && npx expo start`:
- **Deployed:** `https://<your-site-host>`. Works from any network, no tunnel. Deploy this branch first, or `/api/v1` won't exist there.
- **Local:** `npm run build && npm run start:lan` at the root, then `http://<mac-LAN-IP>:8787`. A second phone on the same Wi-Fi can open the card QR.

### Demo script (about 5 minutes)
1. Open the app, tap **Continue as Jordan Rivera**. The card shows status **Active** and a QR code.
2. Tap **Show to a doctor**. The screen brightens with a large QR. Scan it with a second phone: it opens `/t/{card_id}`, which says "card detected, clinician access coming soon" and shows nothing about the patient.
3. Back in the app, open **Activity**: "Someone scanned your card" was logged. A local notification fires for new clinician activity.
4. **Privacy → Preview what a doctor sees**: the emergency profile in Japanese, allergies and medications first. Switch to English. Mark Conditions as Restricted and preview again.
5. Long-press the **Tessera logo** for presenter tools. Run **Dr. Tanaka requests full record**: a notification arrives and Privacy shows the request. Approve or deny it with biometrics (a tap in Expo Go on iOS).
6. **Privacy → Freeze card**, then scan again: the page shows the neutral "This card can't be used right now." The log shows a blocked scan. Unfreeze.
7. **Card → Replace card**, then open the old QR or link: neutral message. The new QR works.
8. **Add to Apple Wallet** shows "Coming soon" and a labelled preview of the future pass.
9. Presenter tools → **Reset demo data** before the next participant.

### Security model (current)
- **The card URL carries no data.** `card_id` is 32 random bytes (base64url). The backend builds `/t/{card_id}`, and every QR renders exactly that URL. Unknown, frozen, voided and malformed ids give an identical neutral response (tested).
- **Traveler tokens:** 32 random bytes, stored only as SHA-256 hashes, 12-hour expiry, revoked on sign-out. The app keeps the token in `expo-secure-store`. Patient data is cached in memory only and cleared on sign-out. The only thing persisted is the card URL, so the QR still shows offline.
- **Audit log:** append-only at the database level (triggers reject UPDATE and DELETE). Every scan, simulated clinician action, approval, freeze, replace and privacy change is logged and shown in the app.
- **Emergency vs restricted:** the emergency view only ever includes the categories the traveler marked "emergency" from allergies, medications, conditions, blood type and contacts. Insurance, visits and documents are never in it (tested).
- **Wallet:** pass content is an allow-list (card URL QR, name, branding, instructions), enforced by a test. Signing isn't implemented, so the endpoint returns 501.
- **Demo login:** anyone who knows the demo code can sign in as Jordan. That's intentional for a synthetic-data demo and must not survive into anything real.

### Known limitations and deferred work
- **Clinician web flow is deferred:** ID check (name + DOB), clinician sign-in and verification, authorization statement, 15-minute scoped access sessions, the Japanese emergency profile page for doctors, the source-record viewer, AI Q&A with citations, and the web presenter/metrics page. Their acceptance criteria (stolen-card test, DOB brute-force rate limiting, scope separation, citation validity) are **not met yet**. Until then, clinician activity in the app comes from seeded history, real scans of `/t/`, and presenter simulations, all labelled.
- **Biometrics** are a client-side gate. The server can't verify them.
- **Not verified:** the deployed Sites environment (whether it forwards `Authorization` headers and applies migrations; the runtime table creation covers the latter), iOS simulator, Android emulator, Expo Go on a real device, and real-device biometrics, brightness, Photos saving and notifications. Verified locally: the web build, the `/api/v1` end to end, 22 backend tests, mobile typecheck/lint/`expo-doctor`, iOS and Android bundle export, and the UI rendered through Expo web at 390px and 360px.
- **Japanese translations** are hand-written and unreviewed (see [TRANSLATION_REVIEW.md](TRANSLATION_REVIEW.md)).
- **"Simulated extraction"** of uploaded documents is a placeholder. No text is read.

## Assumptions (Tessera mobile work)
Recorded while adding the Expo traveler app (`mobile/`). See [AUDIT.md](AUDIT.md) for the full audit.
- **Demo only, synthetic data, not for clinical use.** Production emergency-access policies need healthcare and legal review.
- The existing website (`/`, `/home`, `/professional`, `/card/:token`, `/api/*`) keeps its behavior. Web code may be refactored for the mobile app, but nothing changes functionally.
- The traveler app talks to a new versioned JSON API at `/api/v1/*` on the same Worker, using its own bearer tokens. The platform sign-in headers are not available to a native app.
- Tessera traveler data (Jordan Rivera) lives in new `tessera_*` D1 tables. Website cards (Alex Morgan / guest) do not appear in the mobile app, and vice versa.
- The card URL is `/t/{card_id}`. `card_id` is long and random. The backend builds the URL, and every QR code renders that URL. The URL never carries a name, DOB or medical data. Replacing a card issues a new `card_id` and voids the old one.
- The clinician flow and AI Q&A are **deferred**. For now `/t/{card_id}` is a placeholder: "card detected, clinician access coming soon" for active cards, and the same neutral "can't be used" message for unknown, frozen or voided cards.
- No new Cloudflare bindings (KV, Durable Objects, secrets). New state lives in D1 and R2 so the Sites deployment config is unchanged. Tables are created at runtime with `CREATE TABLE IF NOT EXISTS`, because it's unverified whether Sites applies Drizzle migrations.
- There's no npm workspace. `mobile/` is its own npm project, so the root install scripts stay untouched. The root lockfile only gains `vitest`. Shared types live in `shared/`.
- No new Cloudflare bindings were added, so DOB rate limiting (deferred with the clinician flow) is planned on D1 as well.
- `TESSERA_PUBLIC_URL` (optional env var) overrides the host used in card URLs. Otherwise the request's origin is used.
- Deployment is verified locally with `npm run build` and `npm start`. The deployed Sites environment, real devices and simulators were not verified as part of this work.

### References
- ARC logo: https://www.austinregionalclinic.com/templates/ARCRD/svg/arc_logo_flat.svg
- Address suggestions: https://photon.komoot.io (OpenStreetMap). Typed address queries are sent after a 650 ms debounce. The public address-only server route falls back to a credential-free direct Photon CORS request if the hosting network is rejected. The public service has no availability guarantee; manual entry and browser autofill remain available. No medical or identity information is sent to Photon.
- https://developer.apple.com/documentation/Xcode/configuring-healthkit-access
- https://www.austinregionalclinic.com/patient-guide/mychart-tips/manage-your-authorized-sharing-for-providers-outside-arc
- https://medlineplus.gov/druginfo/meds/a607004.html
