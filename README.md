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

## Assumptions (Tessera mobile work)
Recorded while adding the Expo traveler app (`mobile/`). See [AUDIT.md](AUDIT.md) for the full audit.
- **Demo only, synthetic data, not for clinical use.** Production emergency-access policies need healthcare and legal review.
- The existing website (`/`, `/home`, `/professional`, `/card/:token`, `/api/*`) keeps its behavior. Web code may be refactored for the mobile app, but nothing changes functionally.
- The traveler app talks to a new versioned JSON API at `/api/v1/*` on the same Worker, using its own bearer tokens. The platform sign-in headers are not available to a native app.
- Tessera traveler data (Jordan Rivera) lives in new `tessera_*` D1 tables. Website cards (Alex Morgan / guest) do not appear in the mobile app, and vice versa.
- The card URL is `/t/{card_id}`. `card_id` is long and random. The backend builds the URL, and every QR code renders that URL. The URL never carries a name, DOB or medical data. Replacing a card issues a new `card_id` and voids the old one.
- The clinician flow and AI Q&A are **deferred**. For now `/t/{card_id}` is a placeholder: "card detected, clinician access coming soon" for active cards, and the same neutral "can't be used" message for unknown, frozen or voided cards.
- No new Cloudflare bindings (KV, Durable Objects, secrets). New state lives in D1 and R2 so the Sites deployment config is unchanged. Tables are created at runtime with `CREATE TABLE IF NOT EXISTS`, because it's unverified whether Sites applies Drizzle migrations.
- There's no npm workspace. `mobile/` is its own npm project, so the root lockfile and install scripts stay untouched. Shared types live in `shared/`.
- Deployment is verified locally with `npm run build` and `npm start`. The deployed Sites environment, real devices and simulators were not verified as part of this work.

### References
- ARC logo: https://www.austinregionalclinic.com/templates/ARCRD/svg/arc_logo_flat.svg
- Address suggestions: https://photon.komoot.io (OpenStreetMap). Typed address queries are sent after a 650 ms debounce. The public address-only server route falls back to a credential-free direct Photon CORS request if the hosting network is rejected. The public service has no availability guarantee; manual entry and browser autofill remain available. No medical or identity information is sent to Photon.
- https://developer.apple.com/documentation/Xcode/configuring-healthkit-access
- https://www.austinregionalclinic.com/patient-guide/mychart-tips/manage-your-authorized-sharing-for-providers-outside-arc
- https://medlineplus.gov/druginfo/meds/a607004.html
