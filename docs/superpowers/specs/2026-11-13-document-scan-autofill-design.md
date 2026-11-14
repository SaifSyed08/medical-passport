# Document scan and profile auto-fill: design

Date: 2026-11-13. Status: draft for approval.

## Intent

Travelers add medical documents (labs, diagnoses, reports, prescriptions) by scanning with the camera or picking a file. The app reads each document and proposes updates to the passport profile (conditions, allergies, medications, blood type). The traveler confirms every proposed item before anything is saved.

Why: typing a medical history by hand is slow and error-prone, and the emergency card is only useful if it is complete. This is for a demo day with judges (synthetic data only), but it must be built so it could handle real records later, and the team must be able to answer "how do you keep the data safe, now and later?"

## Goals

- Camera scan and file pick (PDF, JPEG, PNG) feed one upload path.
- Real extraction (the model actually reads the file), replacing today's fake "Simulated extraction" text.
- One-time opt-in on the first upload. The traveler can switch auto-fill off later.
- A review screen where each suggestion shows the quoted source line, can be edited, and must be individually checked before it can be added.
- Privacy built in where cheap, with an honest roadmap for the rest.

## Non-goals

- Compliance claims. Do not say "HIPAA compliant". Say "designed for it, here is the path."
- Insurance, emergency contacts, name or date of birth extraction.
- Summaries of documents or lab values. Extraction only pulls facts that fill a profile field; a document with none (for example a plain lab report) is stored like any other document. The fake `simulatedSummary` text is removed and records keep no summary.
- Auto-translation of accepted items (they appear untranslated in other languages, as any edited English field does today).
- Storing real people's records. The demo label stays until the roadmap items below are done.

## Anti-goals

- Anything reaching the profile or emergency card without an explicit per-item check.
- A wrong or hallucinated allergy or condition becoming a "confirmed" fact.
- An API key in the mobile app, in git, or in the main Worker.

## Constraints

- The main Worker (OpenAI Sites, vinext) has no secret bindings and it is unknown whether Sites supports any. So the model call lives in a separate Cloudflare Worker that holds the key.
- Do not restructure vinext. Use existing patterns (`app/api/v1/*/route.ts`, `withTraveler`, Drizzle, zod `profileSchema`).
- Workers runtime only (Web APIs; no `fs`).
- Existing upload cap is 8 MB.
- The team (Shushant) funds the Claude API key for the demo, with a small spending cap, and provides the Cloudflare account for the extraction Worker. The Worker must also enforce a per-traveler call limit so one user cannot burn the cap.
- Emergency view must keep showing "None recorded", never "no known allergies".

## Approaches considered

A. Polish the UI around the fake extraction. Cheapest, but the demo would not read anything and the safety question gets only hypothetical answers. Rejected.

B. Real extraction on synthetic data, privacy built in where cheap, roadmap for the rest. Chosen by the team.

C. Production-grade safety now. Too large for the timeline and cannot be honestly claimed by demo day. Rejected.

For where the key lives, two options were considered: a separate secrets-holding Worker (chosen), or a low-cap key used directly from the main Worker (rejected: unknown whether Sites supports secrets).

## Design

### Flow

1. Camera (`launchCameraAsync`) or picker produces a file. The app uploads it through the existing `POST /api/v1/records` (stored in R2 under `tessera/{traveler}/{record}`).
2. First upload only: the app shows an opt-in sheet ("Read this document and suggest profile updates?"). The choice is stored on the traveler as a preference (`autoFill`: unset, on, off). If off, the document is just stored.
3. If on, the app calls the extraction Worker with the record id and the traveler's bearer token.
4. The Worker fetches the file from `GET /api/v1/records/:id/file` using that same token. This proves who is asking, and needs no shared secret between the two Workers.
5. The Worker sends the file to the model and returns structured suggestions. It stores nothing and logs no document text.
6. The app shows the review screen. Each suggestion: type, value, quoted source line, an edit control and a checkmark. "Add N to my passport" stays disabled until every shown item is checked or removed.
7. Confirmed items are saved through the existing profile update path, with a link to the source record.

### Suggestion shape

Validated by the existing `profileSchema` item schemas (allergy: substance, reaction, severity; medication: generic, dose, schedule, purpose; condition: name, note), plus blood type. Each carries `quote` (source text) and a `confidence`. Invalid items from the model are dropped, not repaired.

### Safety measures

Build now:
- Opt-in before any document is read; per-item confirmation.
- Per-traveler file paths (already in place).
- Audit entries via `appendAudit` for "document read" and "suggestion accepted" (already exists).
- Delete a document and its link to accepted items.
- No document text in logs.
- "Demo: synthetic data only" label.

Roadmap (to state to judges, not to build):
- A model vendor with a BAA and zero data retention.
- Per-user encryption keys.
- Security review and penetration test.
- HIPAA/GDPR scoping before any real record is stored.

### Testing

Add a small unit test for suggestion validation and a few synthetic sample documents (including an "NKDA" note, a negated finding, and a family-history line) to check the model prompt does not turn them into wrong items.

## Calls made without the team (check these)

- Scope of extraction: conditions, allergies, medications, blood type. Any diagnosis found in a document (for example "sickle cell disease") is added as a `conditions` item, because the profile has no separate diagnoses list. The quoted source line and any date go in the item's `note`. Target app is the Expo app in `mobile/` of this same repo; the web app in `app/` is only the backend/API.
- Blood type is a single value: if one exists, replacing it needs an explicit check.
- Duplicates (same substance, condition or drug already on the profile) are shown as "already on your passport" and are unchecked by default.
- Claude is the model, accessed from the separate Worker.
- Suggestions are not stored on the server. Closing the review screen discards them; the user can re-run extraction from the record.
- `autoFill` preference lives on the traveler record (new column, migration).
- Provenance: a source record id on each accepted item (schema change to profile items).
- Extraction output is English only.
- HEIC: the model may not accept it. The app should send JPEG (convert in the app) or the Worker should reject it with a clear message.

## Left to the builder

- Prompt wording and model choice within the Claude family.
- Extraction Worker project layout, deployment, and rate limiting.
- Exact review screen styling within the app's existing `ui` components.
- How to render partially-readable or low-confidence documents (show a "could not read this" state).
- Migration and schema details for `autoFill` and provenance.
