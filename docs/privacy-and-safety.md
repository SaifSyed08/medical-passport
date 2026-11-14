# Privacy and safety: document reading

Designed for HIPAA-grade handling; not HIPAA compliant today.

Tessera is a demo. The app shows a "Demo: synthetic data only" label, and the sample documents in `extractor/samples/` describe an invented patient.

## What is built now

- **Opt-in.** The app asks once, on the first upload, whether it may read documents. The answer is stored on the device (`autofill.pref`). Switch it any time under Privacy, Document reading. The consent itself is not audit-logged.
- **Nothing is added without you.** The model only suggests. Every suggestion shows the quoted line it came from, and you must confirm or remove each one before "Add to my passport" is enabled.
- **Suggestions are never stored on the server.** They exist in the app until you accept or discard them. Only accepted items are saved to your profile.
- **Files are per traveler.** Uploads are stored in R2 under `tessera/{traveler}/{record}`.
- **Audit log.** The entries `document_read`, `suggestions_accepted` and `document_deleted` record who did what and when.
- **Delete a document.** The file is removed. Items you already accepted stay on your passport; their link to the document is removed.
- **No document text in logs.** Neither Worker logs file contents, quotes or model output.
- **The Anthropic key stays in one place.** It lives only in the separate extractor Worker, never in the app or the main Worker.
- **Abuse limits.** A per-token rate limit of 10 requests per hour (per isolate, best effort) and a spending cap on the key.
- **Conservative extraction.** The model reports only what the document states about the patient. It skips negations, family history and "rule out" findings. Output is English only. HEIC files are rejected.

## Roadmap, not built

- A vendor under a BAA with zero data retention.
- Per-user encryption keys for stored files.
- A security review and penetration test.
- HIPAA and GDPR scoping, including retention and data-subject requests.

## Try it without the app

```
ANTHROPIC_API_KEY=... npx tsx extractor/scripts/try.mjs extractor/samples/a-discharge-summary.pdf
```

Expected: sample a gives a sickle cell condition (2019 in the note) and a severe penicillin allergy; samples b and c give `[]`.
