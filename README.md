# Medical Passport demo

A separate Sites app inspired by the existing survey's intro typography and transitions. This project has its own hosting identity, D1 database, and R2 storage. It does not access or modify the survey or its responses.

## Routes
- `/`: onboarding, simulated Apple Health / ARC consent, fictional record review, card customization, address, 3D completion.
- `/home`: account-scoped saved cards, reversible disable, confirmed delete, delivery preview and links.
- `/professional`: explicitly simulated professional access. Lookup is restricted to the signed-in user's demo cards by number or Alex Morgan + 1994-06-18.
- `/card/:token`: account-scoped DOB-gated medical-only view. English, Spanish, and French demo terms. Browser language detection. Local medicine naming for the exact supported albuterol fixture.

## Important boundaries
This is an owner-private prototype, not a clinical product. Do not enter real health records. DOB is a UX demonstration, not a secure authentication factor. No real HealthKit / MyChart integration, credential verification, orders, SMS, or generative AI calls take place. The assistant deterministically retrieves selected facts from the saved record and declines treatment questions. Unknown edited text is retained, not silently translated. Local naming does not imply pharmaceutical interchangeability.

The optional cropped photo is stored in R2. Card records use D1, scoped to the platform authenticated user ID. APIs omit shipping and SMS details from the responder result. Disabling, expiry, and deletion prevent responder access. Owner checks are applied to every read and mutation, including lookups and photos. The deployed site remains private unless explicitly changed.

## Before production
Use a native HealthKit application and approved provider authorization for live data; replace demo professional access with verified role-based authorization, audit logs and rate limits; implement appropriate consent, privacy, data retention and emergency-access policies; clinically validate translations and medication normalization; add a properly configured grounded model and clinical safeguards; integrate actual fulfillment and opted-in messaging. Do not merely change the demo labels to production labels.

## Development
Use Node >=22.13, the Sites installation/build helpers, and the included local preview. Generate migrations after schema changes and apply them to the local D1 database before testing. The local platform sign-in route is `/signin-with-chatgpt?return_to=/`.

### References
- https://developer.apple.com/documentation/Xcode/configuring-healthkit-access
- https://www.austinregionalclinic.com/patient-guide/mychart-tips/manage-your-authorized-sharing-for-providers-outside-arc
- https://medlineplus.gov/druginfo/meds/a607004.html
