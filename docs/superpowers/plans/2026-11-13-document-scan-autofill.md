# Document Scan and Profile Auto-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Travelers scan or pick a medical document in the Expo app; a separate Worker has Claude read it and return suggestions; the traveler checks every suggestion before it is added to their profile.

**Architecture:** The app uploads the file as today (R2 via `POST /api/v1/records`), then calls a new `extractor/` Cloudflare Worker with the record id and the traveler's bearer token. The Worker fetches the file back from the main API with that same token (this authenticates the caller and avoids a shared secret), calls the Anthropic API, and returns validated suggestions without storing anything. The app's review screen requires an explicit check per item, then saves through the existing `PUT /api/v1/profile`.

**Tech Stack:** Expo/React Native (`mobile/`), vinext + Cloudflare D1/R2 + Drizzle + zod (root), Cloudflare Worker + Anthropic Messages API (`extractor/`), vitest (root only; `mobile/` has no test runner and none is added).

**Spec:** `docs/superpowers/specs/2026-11-13-document-scan-autofill-design.md`

## Global Constraints

- Target app is `mobile/`. The web app in `app/` is only the API. Do not restructure vinext.
- Workers runtime only: Web APIs, no `fs`. The main Worker gets no secrets; only `extractor/` holds `ANTHROPIC_API_KEY`.
- Nothing reaches the profile without a per-item check. Never write a "no known allergies" claim: an empty list stays "None recorded".
- Extraction scope: conditions (diagnoses go here), allergies, medications, blood type. No insurance, contacts, name, DOB, lab summaries, document summaries.
- Upload cap stays 8 MB. Output is English only. No document text in logs. Suggestions are never stored server-side.
- Opt-in is asked once on the first upload and stored on the device (`storage.ts` key `autofill.pref`, values `"on"` / `"off"`). **Deviation from spec:** the spec said a traveler-record column; the schema is applied by idempotent `CREATE TABLE IF NOT EXISTS`, which cannot add a column, so the device stores it. Consent is not audit-logged; reads and accepts are.
- Anthropic key is funded with a small spending cap by Shushant; per-token call limit in the Worker is a best-effort second guard.
- New Japanese strings are hand-written and listed in `TRANSLATION_REVIEW.md` for review.

## Review Focus

1. A document with no profile facts (a plain lab report): `suggestions` is `[]`, the screen says nothing was found, no error, file stays saved. (Task 3 test, Task 4 manual check.)
2. A profile list already at its maximum (30 allergies, 40 medications, 30 conditions): the save returns 400, the review screen shows the message and keeps the user's checks. (Task 4 manual check.)
3. Suggestion already on the passport, or a blood type that differs from a known one: shown as "Already on your passport" (not counted) or "Replaces A+" (needs its own check). (Task 1 tests.)
4. Worker or network failure, expired token, HEIC file: the document stays saved, the user sees a retryable message, 401 triggers the existing sign-in-again flow. (Task 3 tests, Task 4 manual check.)
5. Model returns malformed or oversize fields, negated findings ("no history of asthma"), family history, "NKDA": bad items dropped, long fields truncated to schema limits, no item produced for negations. (Task 3 test for dropping/truncating; Task 5 sample documents for negation.)

---

### Task 1: Shared suggestion types and merge logic

**Files:**
- Create: `shared/autofill.ts`
- Modify: `shared/tessera.ts` (add `sourceRecordId?: string` to `Allergy`, `Medication`, `Condition`; add `"document_read" | "suggestions_accepted" | "document_deleted"` to `AuditAction`)
- Modify: `lib/tessera/profile.ts` (add `sourceRecordId: id.optional()` to `allergySchema`, `medicationSchema`, `conditionSchema`)
- Modify: `lib/tessera/audit.ts` (add the three actions to `verbs`)
- Test: `tests/autofill.test.ts`

**Interfaces:**
- Produces (`shared/autofill.ts`, dependency-free):
  - `type SuggestionKind = "condition" | "allergy" | "medication" | "bloodType"`
  - `type Suggestion = { id: string; kind: SuggestionKind; fields: Record<string, string>; quote: string; confidence: number }`. Field keys: condition `name, note`; allergy `substance, reaction, severity`; medication `generic, brand, dose, schedule, purpose`; bloodType `value`.
  - `type ReviewState = "pending" | "checked" | "removed"`
  - `classify(profile: Profile, s: Suggestion): "new" | "duplicate" | "replaces"`
  - `initialState(profile: Profile, s: Suggestion): ReviewState` (`"removed"` for duplicates, else `"pending"`)
  - `readyToAdd(states: ReviewState[]): boolean` (at least one `checked`, none `pending`)
  - `mergeAccepted(profile: Profile, accepted: Suggestion[], recordId: string, newId: (prefix: string) => string): Profile` (pure; prefixes `alg`, `med`, `cnd`)

- [ ] **Step 1: Write failing tests in `tests/autofill.test.ts`** using `jordanProfile` from `lib/tessera/seed-data`:
  - `classify` returns `"duplicate"` for an allergy whose `substance` equals an existing one ignoring case and whitespace; `"new"` for a different one; for `bloodType`, `"duplicate"` when equal, `"replaces"` when profile is known and differs, `"new"` when profile is `"Unknown"`.
  - `readyToAdd(["checked","removed"])` is true; `["checked","pending"]` false; `["removed"]` false; `[]` false.
  - `mergeAccepted` on a condition suggestion `{name:"Sickle cell disease", note:"Dx 2019", quote:"HbSS sickle cell disease"}` appends a condition with `sourceRecordId` equal to the record id, `id` starting `cnd_`, and `note` equal to `Dx 2019 — “HbSS sickle cell disease”`; result passes `profileSchema.safeParse`.
  - `mergeAccepted` truncates a `note` to 400 characters; skips a suggestion that `classify` calls duplicate; sets `bloodType` only when `value` is in `BLOOD_TYPES`; does not mutate its input.
- [ ] **Step 2: Run** `npx vitest run tests/autofill.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `shared/autofill.ts` as above, make the schema, type and audit-verb edits (`document_read`: "read an uploaded document to suggest profile updates"; `suggestions_accepted`: "added suggestions from a document to your profile"; `document_deleted`: "deleted an uploaded document").
- [ ] **Step 4: Run** `npx vitest run`. Expected: all pass (existing tests included).
- [ ] **Step 5: Commit** `git add shared lib tests && git commit -m "feat: autofill suggestion types and merge logic"`

---

### Task 2: Main API changes (remove fake summary, audit reads, accepted log, delete)

**Files:**
- Modify: `app/api/v1/records/route.ts` (drop `simulatedSummary`; insert `summary: null, simulated: 0`)
- Modify: `lib/tessera/traveler.ts` (remove `simulatedSummary`; add `deleteRecord`)
- Modify: `app/api/v1/records/[id]/file/route.ts` (audit when `?purpose=autofill`)
- Create: `app/api/v1/records/[id]/accepted/route.ts`
- Create: `app/api/v1/records/[id]/route.ts` (DELETE)
- Test: `tests/records-delete.test.ts`

**Interfaces:**
- Produces: `deleteRecord(db: TesseraDb, bucket: { delete(key: string): Promise<void> } | undefined, traveler: Traveler, id: string): Promise<"deleted" | "not_found" | "not_deletable">`. Only `kind === "upload"` rows are deletable. Deletes the R2 object and the row, removes `sourceRecordId` equal to `id` from every profile item (keeping the items), and appends audit `document_deleted` (`actor: "You"`, `actorRole: "traveler"`, `outcome: "info"`).
- Produces HTTP: `DELETE /api/v1/records/:id` → 204 / 404 / 403 `not_deletable`. `POST /api/v1/records/:id/accepted` body `{count: int 1..60}` → 204, 404 if not the traveler's record; appends audit `suggestions_accepted` with `detail: "<count> item(s) from <record title>"`. `GET .../file?purpose=autofill` appends audit `document_read` with `detail` = record title, only after the file is found.

- [ ] **Step 1: Write failing tests** in `tests/records-delete.test.ts` with `freshDb()`, a seeded traveler, an inserted `upl_test000001` upload row, and a profile condition carrying `sourceRecordId: "upl_test000001"`: `deleteRecord` returns `"deleted"`, row gone, bucket stub `delete` called with the row's `r2Key`, condition still present without `sourceRecordId`, audit list contains `document_deleted`; returns `"not_found"` for another traveler's id; returns `"not_deletable"` for a seeded `kind: "document"` record.
- [ ] **Step 2: Run** `npx vitest run tests/records-delete.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `deleteRecord` and the three route changes (mirror the `appendAudit` call in `app/api/v1/privacy/route.ts`; validate `accepted` body with `body()` and a zod object).
- [ ] **Step 4: Run** `grep -rn simulatedSummary app lib tests` (expect no matches) then `npx vitest run && npm run lint`. Expected: pass.
- [ ] **Step 5: Commit** `git commit -am "feat: audited document reads, accept log, delete document"` (add new files first).

---

### Task 3: Extraction Worker

**Files:**
- Create: `extractor/package.json`, `extractor/wrangler.toml`, `extractor/src/findings.ts`, `extractor/src/anthropic.ts`, `extractor/src/index.ts`
- Test: `tests/extractor.test.ts`

**Interfaces:**
- Consumes: `Suggestion` from `shared/autofill.ts` (relative import).
- Produces:
  - `parseFindings(raw: unknown): Suggestion[]` in `findings.ts`. Accepts the model tool input `{ findings: [{ kind, fields, quote, confidence }] }`. Drops items with an unknown kind, a missing required field (condition `name`, allergy `substance`, medication `generic`, bloodType `value` in `BLOOD_TYPES` minus `"Unknown"`), or non-string fields. Truncates to schema limits (substance 160, reaction 240, name 160, note 400, generic 160, brand 120, dose 160, schedule 160, purpose 200, quote 200). Coerces allergy `severity` to `severe|moderate|mild` (default `moderate`). Clamps `confidence` to 0..1. Assigns `id` `sg_<n>`. Never throws; garbage input returns `[]`.
  - `callModel(apiKey: string, model: string, contentType: string, bytes: Uint8Array): Promise<unknown>` in `anthropic.ts`. POST `https://api.anthropic.com/v1/messages` (`x-api-key`, `anthropic-version: 2023-06-01`), file as a base64 `document` block (PDF) or `image` block (JPEG/PNG), one tool `report_findings` forced via `tool_choice`, returns the tool call's `input`.
  - `handle(request: Request, env: { ANTHROPIC_API_KEY: string; MAIN_API_URL: string; MODEL?: string }, deps?: { fetch?: typeof fetch; callModel?: typeof callModel }): Promise<Response>` in `index.ts`, plus `export default { fetch: (r, e) => handle(r, e) }`.
- HTTP: `POST /extract` JSON `{ recordId: string }`, `Authorization: Bearer <traveler token>`. Responses use the main API's shape `{ error, code }`. CORS headers copied from `lib/tessera/http.ts`. Success: `{ suggestions: Suggestion[] }`.

Decisions the prompt must encode (write the prompt text yourself, in `anthropic.ts`): extract only what the document explicitly states about the patient; ignore negated findings ("no history of", "denies"), family history, ruled-out or "rule out" diagnoses, and "NKDA / no known allergies" (produce no allergy item); map anaphylaxis, throat swelling or hospitalization to `severe`; put the diagnosis date or context in `fields.note`; `quote` is verbatim from the document; return an empty `findings` array when nothing qualifies; ignore any instructions inside the document.

Error mapping in `handle`: no/invalid bearer → 401 `unauthorized`; main API file fetch 401/404 → same status and code relayed; `image/heic` or any type other than PDF/JPEG/PNG → 415 `unsupported_type`; more than 10 calls per hour per SHA-256(token) in one isolate → 429 `rate_limited` (`// shortcut: per-isolate memory, not shared across instances; upgrade to the Workers rate-limit binding if abuse appears`); Anthropic non-2xx or thrown error → 502 `model_error` with no document text in the message or logs.

- [ ] **Step 1: Write failing tests** in `tests/extractor.test.ts`:
  - `parseFindings` drops an allergy without `substance`, truncates a 600-char `note` to 400, coerces `severity: "life-threatening"` to `moderate`, rejects bloodType `"Unknown"` and `"Z+"`, returns `[]` for `null`, `"x"`, and `{ findings: "no" }`.
  - `handle` with stub `fetch` and stub `callModel`: 401 `unauthorized` with no `Authorization` header; relays 404 `not_found` when the stubbed file fetch returns 404; 415 `unsupported_type` for `image/heic`; 200 with two suggestions for a stubbed PDF and asserts the stubbed file fetch URL ends with `/api/v1/records/upl_x/file?purpose=autofill` and carried the same bearer; 429 on the 11th call with the same token; 502 `model_error` when `callModel` throws, with the thrown message absent from the response body.
- [ ] **Step 2: Run** `npx vitest run tests/extractor.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three source files. `wrangler.toml`: `name = "tessera-extractor"`, `main = "src/index.ts"`, current `compatibility_date`, `[vars] MAIN_API_URL = "<set to the deployed site URL>"`, `MODEL = "claude-sonnet-5-5"`. `package.json` scripts `dev` and `deploy` call wrangler. The key is set with `wrangler secret put ANTHROPIC_API_KEY`, never committed.
- [ ] **Step 4: Run** `npx vitest run && npm run lint`. Expected: pass. (If lint covers `extractor/`, fix; otherwise add it to the ignore list only if it errors on Worker globals.)
- [ ] **Step 5: Commit** `git add extractor tests && git commit -m "feat: extraction worker"`

---

### Task 4: Mobile flow (camera, opt-in, review screen, settings, delete)

**Files:**
- Create: `mobile/src/lib/autofill.ts`, `mobile/src/app/review.tsx`
- Modify: `mobile/src/lib/api.ts` (export `signalUnauthorized`), `mobile/src/lib/i18n.ts` (en + ja keys), `mobile/src/app/(tabs)/records.tsx`, `mobile/src/app/(tabs)/privacy.tsx`, `mobile/src/app/record/[id].tsx`, `mobile/README.md`

**Interfaces:**
- Consumes: `Suggestion`, `ReviewState`, `classify`, `initialState`, `readyToAdd`, `mergeAccepted` (Task 1); `saveProfile`, `newId`, `ITEM_KINDS` from `mobile/src/lib/profile.ts`; `ask` from `mobile/src/lib/confirm.ts`; Task 2 endpoints.
- Produces in `autofill.ts`: `EXTRACTOR_URL` (from `process.env.EXPO_PUBLIC_EXTRACTOR_URL`), `getAutofillPref(): Promise<"on" | "off" | null>`, `setAutofillPref(v: "on" | "off"): Promise<void>`, `requestSuggestions(recordId: string): Promise<Suggestion[]>` (POST `/extract`, 60 s timeout, throws `ApiError` with the Worker's `status` and `code`; calls `signalUnauthorized()` on 401), `reportAccepted(recordId: string, count: number): Promise<void>`.
- Route `/review` with search param `recordId`.

Behavior to build (copy for en strings is yours; add the same keys to `ja`):
- `records.tsx`: add a "Scan with camera" button using `ImagePicker.requestCameraPermissionsAsync()` then `launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })`, sharing the existing `upload()` path. `upload()` returns the new `RecordItem`; afterwards call `maybeAutofill(record)`: if pref is `null`, `ask()` once ("Read this document and suggest updates to your passport? You'll check each suggestion before anything is added.") and store `"on"`/`"off"`; if `"on"`, `router.push({ pathname: "/review", params: { recordId } })`; if `"off"`, do nothing.
- `review.tsx`: loads `requestSuggestions` and `useResource<Profile>("/profile")`. Loading state, "Nothing to add from this document" for `[]` (with a back button, not an error), and a retryable error state mapping `unsupported_type` to "This file type can't be read. It's saved to your records." and `rate_limited` to "Too many requests. Try again later." Each suggestion is a card: kind label, main text, the quote, a "Check carefully" `Pill` when `confidence < 0.6`, and three controls: a check button (accessibility label "Confirm this is correct"), an edit control that expands `Field`s built from `ITEM_KINDS` (blood type uses `Chips` over `BLOOD_TYPES`) and resets that item to `pending`, and a remove control. Duplicates start `removed` with "Already on your passport"; `replaces` shows the current value and needs its own check. The bottom `Button` "Add N to my passport" is disabled until `readyToAdd(states)` and while saving (guards double taps). On press: `saveProfile(mergeAccepted(...))`, `reportAccepted`, success haptic, `router.back()`. A save error shows `Notice tone="error"` with the server's 400 message and leaves all states untouched.
- `privacy.tsx`: a "Document reading" section with a row that toggles `setAutofillPref` and shows on/off.
- `record/[id].tsx`: a destructive "Delete this document" button for `kind === "upload"` using `ask(..., destructive = true)`, calling `DELETE /records/:id` via `api()`, refreshing the records cache, then `router.back()`.
- `mobile/README.md`: document `EXPO_PUBLIC_EXTRACTOR_URL`.

- [ ] **Step 1: Implement `autofill.ts` and the `api.ts` export.**
- [ ] **Step 2: Implement the `i18n.ts` keys (en and ja) and the `records.tsx` camera and opt-in flow.**
- [ ] **Step 3: Implement `review.tsx`, the `privacy.tsx` toggle, and the delete button.**
- [ ] **Step 4: Run** `cd mobile && npm run typecheck && npm run lint`. Expected: no errors.
- [ ] **Step 5: Manual check in Expo** against `wrangler dev` for the Worker and the local API (see Task 5 samples): first upload shows the opt-in once; camera and PDF both reach review; Add stays disabled until every card is checked or removed; editing a card resets its check; a plain lab report shows "Nothing to add"; a profile with 30 allergies shows the 400 message and keeps checks; airplane mode shows the retry state and the file is still in Records; delete removes the file and leaves the accepted items.
- [ ] **Step 6: Commit** `git add mobile && git commit -m "feat: scan, opt-in, review and delete in the mobile app"`

---

### Task 5: Samples, judge-facing safety doc, translation log

**Files:**
- Create: `extractor/samples/` (three synthetic one-page PDFs), `extractor/scripts/try.mjs`, `docs/privacy-and-safety.md`
- Modify: `TRANSLATION_REVIEW.md`

**Interfaces:**
- Consumes: `extractor/src/anthropic.ts` and `findings.ts`. `try.mjs <file>` uploads nothing and needs no Worker: it calls `callModel` from `extractor/src/anthropic.ts` and `parseFindings` directly with `ANTHROPIC_API_KEY` from the environment and prints the suggestions as JSON.

- [ ] **Step 1: Create the three samples** (invented patient, no real data): (a) "Discharge summary" stating "Dx: HbSS sickle cell disease, diagnosed 2019" and "Allergic to penicillin: anaphylaxis"; (b) "Clinic note" with "No history of asthma", "Mother has type 2 diabetes", "NKDA", "Rule out iron deficiency"; (c) "Lab report" with only numeric results and no diagnoses.
- [ ] **Step 2: Write `try.mjs`** and run it on each sample. Expected: (a) exactly a sickle cell condition (note contains 2019) and a severe penicillin allergy; (b) `[]`; (c) `[]`. If (b) returns anything, tighten the prompt rules in `anthropic.ts` and re-run; this is the acceptance check for Review Focus item 5.
- [ ] **Step 3: Write `docs/privacy-and-safety.md`** (about 40 lines): what is built now (opt-in, per-item confirmation, per-traveler file paths, audit log of reads and accepts, delete a document, no document text in logs, demo label), what is roadmap (BAA vendor with zero retention, per-user encryption keys, security review and penetration test, HIPAA/GDPR scoping), and the sentence "Designed for HIPAA-grade handling; not HIPAA compliant today."
- [ ] **Step 4: Append the new Japanese strings** from Task 4 to `TRANSLATION_REVIEW.md` in the file's existing format.
- [ ] **Step 5: Run** `npx vitest run && npm run lint && (cd mobile && npm run typecheck)`. Expected: all pass.
- [ ] **Step 6: Commit** `git add extractor docs TRANSLATION_REVIEW.md && git commit -m "docs: safety write-up, sample documents, translation log"`
