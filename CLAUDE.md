# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A fictional "Medical Passport" demo (see [README.md](README.md) for routes and the list of product boundaries). It is not a clinical product: no real HealthKit/MyChart, no generative AI calls, DOB gating is a UX demo only. Keep it that way — don't turn demo labels into production claims.

## Commands

Requires Node >=22.13 and npm (`package-lock.json`).

- `npm install` — install deps (`install:ci` is the CI/managed-environment variant).
- `npm run dev` — dev server via `scripts/run-framework.mjs` (vinext on port 5173; plain Vite in the "managed-linux" execution profile).
- `npm run build` — production build (runs `scripts/build-verified.sh` in managed-linux).
- `npm start` — serves the built `dist/server` with `wrangler dev --local`, persisting state to `.wrangler/state`.
- `npm run lint` — ESLint.
- `npm run db:generate` — generate a Drizzle migration into `drizzle/` after editing `db/schema.ts`. Apply migrations to the local D1 database before testing.
- No test runner is configured.
- Local sign-in: visit `/signin-with-chatgpt?return_to=/` (mocked by `sites({ mockAuth })` in [vite.config.ts](vite.config.ts) outside managed-linux).

## Architecture

**Stack:** Next.js App Router API surface running on **vinext** (a Vite-based Next reimplementation) targeting **Cloudflare Workers**. Storage is D1 (`passports`, `photos` tables via Drizzle) and R2 (cropped photos). Binding names (`DB`, `BUCKET`) come from [.openai/hosting.json](.openai/hosting.json), which [vite.config.ts](vite.config.ts) reads to configure local Miniflare bindings. The worker entry is [build/sites-worker.ts](build/sites-worker.ts), which wraps vinext's fetch handler. `build/` and `scripts/` are platform scaffolding; avoid editing them for app changes.

**Dual-mode data layer (the key thing to understand):** every client call goes through `api()` in [lib/passport.ts](lib/passport.ts). It first calls `/api/session` (cached in `isGuest()`):
- **Signed in** → real `fetch` to `app/api/*` routes, backed by D1/R2, scoped by owner.
- **Guest** → [lib/guest.ts](lib/guest.ts) `guestApi()` emulates the same `/api/cards`, `/api/lookup`, `/api/passport/:token` endpoints entirely in `localStorage`, with photos as base64 data URLs. When adding or changing an API route that guests can reach, mirror the change in `guestApi` and keep `dataSchema` validation in both paths.

**Auth:** identity is not handled in-app. [app/chatgpt-auth.ts](app/chatgpt-auth.ts) reads `oai-authenticated-user-*` headers injected by the hosting platform's auth proxy; `requireChatGPTUser` redirects to `/signin-with-chatgpt`. `owner()` in [lib/server.ts](lib/server.ts) wraps this for API routes and also does a same-origin check on non-GET requests. Every read/mutation of cards, lookups, and photos must filter by owner.

**Data model:** [lib/passport.ts](lib/passport.ts) holds the zod `dataSchema`/`profileSchema` (the source of truth for card contents), fixed demo identity (Alex Morgan, 1994-06-18), and provider list. The `data` column in `passports` is that schema serialized as JSON; use `unpack()` / `readable()` in [lib/server.ts](lib/server.ts). `readable()` deliberately strips address/SMS fields — responder-facing endpoints (`/api/passport/[token]`, `/api/lookup`) must only return the `readable` shape.

**UI:** pages in `app/` are thin; the screens are large client components in `components/` (`onboarding`, `dashboard`, `card-studio`, `professional`, `reader`). `components/ui/` is shadcn/Base UI primitives (see [components.json](components.json)). Translations (en/es/fr) for the reader live in [lib/translations.ts](lib/translations.ts). Address autocomplete ([lib/address.ts](lib/address.ts)) calls `/api/address`, which proxies Photon (OpenStreetMap), and falls back to a direct browser CORS call if the server route fails.

**Connectors:** [lib/connectors.ts](lib/connectors.ts) / [lib/connector-context.ts](lib/connector-context.ts) expose a request-scoped capability via `AsyncLocalStorage`, set in the worker entry. Never cache or share it across requests.

## Conventions

- Much of `lib/` and the API routes is written in dense, compact style (multiple statements per line, few spaces). Match the surrounding file when editing rather than reformatting.
- `@/` path alias maps to the repo root.
