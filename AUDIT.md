# Tessera repository audit

Audited 2026-10-31 on branch `tessera-mobile`, before any changes. Scope: what exists, how it builds and ships, and what the mobile traveler app needs that is missing.

## 1. Structure, tooling, build and deploy

| Item | Finding |
|---|---|
| Package manager | npm (`package-lock.json`, `.npmrc`). Node >= 22.13. |
| Framework | vinext 1.0.0-beta.5 (Vite 8 reimplementation of the Next.js App Router API). `next` 16.3.4 is installed for imports and types only. React 19.2. |
| Layout | `app/` (pages + `app/api/*` route handlers), `components/` (screens + shadcn `ui/`), `lib/` (domain logic), `db/` (Drizzle schema), `drizzle/` (one migration), `build/` and `scripts/` (Sites platform scaffolding), `public/`. |
| `npm run dev` | `scripts/run-framework.mjs dev` → `vinext dev --port 5173` (plain Vite under the `managed-linux` execution profile). The `sites({ mockAuth })` Vite plugin injects a fake signed-in user locally. |
| `npm run build` | `vinext build` (bounded by `scripts/build-verified.sh` under `managed-linux`). Output: `dist/server` (Worker) + `dist/client` (assets). Baseline build passes. |
| `npm start` | `wrangler dev` against `dist/server/wrangler.json` with local persistence in `.wrangler/state`, port 8787. No mock auth, so you're signed out. Baseline routes respond (`/`, `/home`, `/professional`, `/card/:token` → 200; `/api/cards` → 401 signed out). |
| Deploy | **No deploy script.** The project is hosted on the OpenAI Sites platform (`.openai/hosting.json`: `project_id`, `d1: "DB"`, `r2: "BUCKET"`). History shows "Update Site source" commits. `vinext deploy` / `wrangler deploy` are not used. |
| Wrangler config | Generated at build time by `@cloudflare/vite-plugin` from `vite.config.ts`. Bindings: D1 `DB`, R2 `BUCKET`; dev-only service binding `CONNECTORS`. `compatibility_flags: ["nodejs_compat"]`. `vars` is empty. |
| Worker entry | `build/sites-worker.ts` wraps `vinext/server/fetch-handler` and sets a request-scoped connector binding via `AsyncLocalStorage`. |
| Lint / tests | `npm run lint` (ESLint 9 + eslint-config-next). **No test runner.** |
| `vinext check` | 100% compatible (11 supported, 0 partial, 0 issues). |

## 2. Where data lives

- **D1 (`DB`)** via Drizzle (`db/index.ts` → `getDb()`; `db/schema.ts`):
  - `passports`: id, owner (platform user id), token (reader link), number (`MP-…`), status (`active`/`disabled`), `data` (JSON of `dataSchema`), created, expires, arrival.
  - `photos`: id, owner.
- **R2 (`BUCKET`)**: cropped JPEG photos at `{owner}/{photoId}`.
- **Hard-coded demo data**: the identity (Alex Morgan, DOB 1994-06-18) and sample profile in `lib/passport.ts`. The reader's DOB gate compares against that constant.
- **Browser localStorage**: guest cards and photos (`lib/guest.ts`), which mirror the same API surface client-side.
- **Not present**: KV, Durable Objects, Hyperdrive, Queues, the rate-limit binding, secrets.
- **Migrations**: `drizzle/0000_*.sql`. The README says to apply them locally. There's no migrations config in the generated Wrangler file, and it's **unknown whether Sites applies migrations on deploy**.

## 3. Feature inventory

| Spec item | Status | Where |
|---|---|---|
| Card landing route | Partial: `/card/:token` (owner-only reader). No `/t/{card_id}`. | `app/card/[token]/page.tsx`, `components/reader.tsx` |
| Identity check (name + DOB) | Partial: DOB-only gate against a hard-coded DOB; name + DOB search on `/professional`. No rate limiting. | `app/api/passport/[token]/route.ts`, `app/api/lookup/route.ts` |
| Clinician sign-in / verification | **Missing.** `/professional` says no credentials are verified. | `components/professional.tsx` |
| Authorization statement | **Missing** | — |
| Emergency profile JA/EN | Partial: en/es/fr labels + term translation; **no Japanese**. | `lib/translations.ts` |
| AI Q&A with citations | Partial: deterministic keyword answerer, no citations. (Deferred this round.) | `lib/translations.ts` `answer()` |
| Source-record viewer | **Missing** | — |
| Access / audit log | **Missing** | — |
| Traveler profile / records / uploads | Partial: profile inside card `data`; photo upload only. No document records. | `app/api/cards`, `app/api/photo` |
| Privacy controls | Partial: responder view omits address/SMS (`readable()`). No per-category choice. | `lib/server.ts` |
| Freeze / replace card | Partial: disable/enable + delete. No replace (new id). | `app/api/cards/route.ts` PATCH/DELETE |
| Presenter / metrics tooling | **Missing** | — |
| Seed / synthetic data | Partial: hard-coded Alex Morgan profile. No seed command; no Jordan Rivera. | `lib/passport.ts` |

## 4. How the frontend gets data

Only **route handlers** under `app/api/*`, called from client components through `api()` in `lib/passport.ts`. No server actions. Pages are thin server components that only read the session. Consequence: nothing has to be ported out of server actions for React Native. The mobile app needs new endpoints only because the existing ones are tied to platform auth and the Alex-Morgan data shape.

## 5. Auth and session

- Identity comes from platform-injected headers `oai-authenticated-user-{id,email,full-name}` (`app/chatgpt-auth.ts`). `owner()` in `lib/server.ts` requires them and also rejects cross-origin non-GET requests.
- There are no app cookies or tokens. Locally, the headers are mocked by `build/sites-vite-plugin.ts` (dev server only).
- **Breaks for a native client:** an Expo app can't obtain the platform headers. It needs its own bearer-token scheme. The `Origin` check is fine (native requests send no `Origin`).
- **Open question:** whether the Sites edge forwards an `Authorization` header to the Worker unchanged. Not verifiable from here.

## 6. Workers constraints

- Runtime code uses only Web APIs plus `cloudflare:workers` `env`, `node:async_hooks` (`AsyncLocalStorage`, allowed by `nodejs_compat`) and Drizzle D1. `node:fs` appears only in build/dev scripts (`scripts/*`, `vite.config.ts`), never in the Worker.
- New code must not use `fs`, `Buffer`-heavy Node crypto or long-running work. Use Web Crypto (`crypto.getRandomValues`, `crypto.subtle.digest`).
- No secret bindings are configured, and it's unknown whether Sites supports custom vars. New features should work without secrets: random opaque tokens stored as SHA-256 hashes in D1, and feature flags with in-code defaults.

## 7. vinext notes

Experimental, beta. Don't upgrade, swap or restructure it. New code uses only patterns the app already uses: `app/**/route.ts` handlers with `context.params` as a Promise, server-component pages with `export const dynamic = "force-dynamic"`, `cloudflare:workers` env.

## 8. Gap list for this round (mobile traveler app)

Building now:
1. `/api/v1` JSON API with bearer-token traveler auth (demo login).
2. Tessera data model: travelers, cards (`card_id`, `serial_number`, `status`, `pass_last_updated`), records, contacts, privacy, tokens, append-only audit, full-record requests, prefs.
3. One-command, idempotent seed for Jordan Rivera (synthetic) with hand-written Japanese and `TRANSLATION_REVIEW.md`.
4. `/t/{card_id}` placeholder: neutral for unknown/frozen/voided, "coming soon" for active, logs a scan.
5. Replace card (new `card_id`, old one voided) and freeze.
6. Document uploads to R2 with a labelled simulated extraction.
7. Wallet groundwork: `PassIssuer`, `NullPassIssuer`, `WALLET_ENABLED`, reserved 501 endpoint, pass-content test, `docs/WALLET_PLAN.md`.
8. Test runner (vitest) and tests.
9. Expo app in `mobile/`.
10. Mobile presenter panel (reset, simulate clinician access / full-record request).

Deferred by decision (clinician side, AI): clinician sign-in and verification, ID check with rate limiting, authorization statement, scoped access sessions, Japanese emergency profile page, source viewer, AI Q&A with citations, web presenter/metrics page. The related acceptance criteria (stolen-card test, DOB brute-force test, scope separation, citation validity) stay **open** until that work happens.
