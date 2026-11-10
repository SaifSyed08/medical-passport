# Tessera Interpreter

**A patient-aware medical interpreter on the patient's phone.**

A foreign patient can't explain what's wrong. They hand the doctor their phone, and then they both just talk. The app hears who is speaking from the language. While they're still talking it shows live captions, then the cleaned-up sentence, then the translation in large type, spoken aloud. Because it knows the patient's saved record, it also does two things a translator can't:

- **It swaps medicine names for local ones.** The patient says *Ventolin* and the word flips to **albuterol** for a US doctor. *Neo-Melubrina* turns into **metamizole**, flagged as not sold in the US.
- **It brings up what matters from the record.** The doctor says "amoxicillin and a CT with contrast". The patient's **penicillin anaphylaxis** and **eGFR 44** tiles flash red, even though the patient never mentioned either.

> Demo only. The patients are fictional and it is not for clinical use. Local drug names don't mean two products are interchangeable.

## Try it in 30 seconds: demo mode

```sh
npm install
npm run dev          # then open http://localhost:5173
```

Press **D**, or tap **Play demo conversation**. It replays a real recorded run: the speakers' voices, live captions, the drug-name flips, the record tiles and alerts, and the spoken translations. It needs no mic, no network and no API calls. **Esc** stops it. Switch patients under ⚙ on the home screen.

- **Sofía Hernández** is from Guadalajara and visiting Austin (Spanish ⇄ English). Her record is written in Spanish, and the doctor reads it in English.
- **Jordan Rivera** is an American student in Tokyo (English ⇄ Japanese). He's the traveler from the [Tessera medical passport](https://github.com/SaifSyed08/medical-passport) demo.

## What it does

| | |
| --- | --- |
| **Hears who's talking** | The language spoken decides who it is, so there are no buttons to press. You can override it in ⋯. |
| **Live captions** | While someone talks, the audio so far goes to a fast transcription model about once a second and the caption grows. When they stop, `gpt-4o-transcribe` makes the final pass. |
| **Cleans up speech** | Fillers, stutters and self-corrections are removed ("two, no, three pills" becomes "three pills"). Facts, doses and hedges never change. The original is one tap away. |
| **Local medicine names** | A curated cross-country table covers MX, US, JP, GB and IN, and the server enforces it on top of the model's output. The phone saves each match, so it works offline. |
| **Record in real time** | The record is matched against what was just said and shown as compact tiles above the mic. Alerts come first; a new or re-triggered alert flashes and the phone vibrates. Each tile opens a short explanation and the original entry. |
| **Record in the doctor's language** | The full record opens translated, color-coded by section, with a toggle back to the original. A translation is rejected if it comes back incomplete. |
| **Spoken translation** | `gpt-4o-mini-tts` reads each translation in order. The mic pauses while the phone speaks, so it never translates itself. |

## Run it on a phone

You need Node 22+ and `OPENAI_API_KEY` in the environment.

```sh
npm run dev      # http://localhost:5173, plus https://<LAN-IP>:5443 (self-signed) for phones on the same Wi-Fi
npm run demo     # production build + server
```

The mic needs HTTPS, so pick one:

1. **Same Wi-Fi:** open the `https://<laptop-IP>:5443` address printed at startup and accept the certificate warning.
2. **Tunnel** (most reliable at events): run `npx cloudflared tunnel --url http://localhost:5173`. Start the server with `ACCESS_CODE=something` and open the link once as `…/?code=something`. Without the code the API answers 401, so nobody else can spend your credits.

In a loud room, switch to **Tap to talk** under ⋯. **⌨ Type** runs typed text through the same pipeline.

## How it works

```
phone mic ─► voice-activity detection (AudioWorklet) ─► utterance WAV ───────────────► /api/transcribe (gpt-4o-transcribe,
         └─► snapshot every ~1 s while talking ─► /api/transcribe?fast (live caption)    primed with the patient's medicines)
                                                                                         │
                     ┌───────────────────────────────────────────────────────────────────┤
                     ▼                                                                   ▼
   /api/interpret (gpt-4.1): language → speaker, cleanup,           /api/context (gpt-4.1-mini): which record items matter
   translation, drug spans; curated names enforced server-side      now; ids validated, local drug names enforced
                     │
                     ▼
   /api/tts (gpt-4o-mini-tts), spoken in order; the mic pauses while it plays
```

| Path | What |
| --- | --- |
| `server/index.mjs` | Express server and API routes, self-signed HTTPS, optional access code, record translation with validation |
| `server/prompts.mjs` | Interpreter, context and translation prompts and JSON schemas |
| `server/drugs.mjs` | Curated medicine names, matching, local-name enforcement |
| `src/lib/mic.ts` | Mic capture, voice-activity detection, live-caption snapshots, WAV encoding |
| `src/lib/duplex.ts`, `audioSession.ts`, `player.ts` | Mic pause while speaking; one shared audio session, unlocked by the first tap or key press |
| `src/lib/contextMerge.ts` | Merging record items; deciding which alert flashes |
| `src/lib/recordTranslation.ts` | Translated record: cache, merge, validation |
| `src/components/` | Home, Conversation (transcript, demo player), Stage, ContextTiles, Orb, sheets |
| `public/demo/` | The recorded demo runs (made with `scripts/build-demo.mjs`) |

Models can be overridden with `STT_MODEL`, `STT_FAST_MODEL`, `LLM_MODEL`, `CONTEXT_MODEL` and `TTS_MODEL`. From the end of speech to the translation takes about 2–3 s.

## Tests

```sh
npm test                                   # unit tests: drug names, merges, mic and player behavior, translation validation
npm run typecheck
node scripts/demo-check.mjs sofia          # plays demo mode headless and checks turns, captions, alerts and layout
node scripts/demo-regressions.mjs          # browser regressions with a mocked API (stop/restart, half-duplex, scrolling…)
npm run test:api -- sofia                  # live API: TTS-voiced lines → transcribe → interpret + context (paid)
npm run test:e2e -- sofia                  # headless Chrome with a fake mic feeding the real pipeline (paid)
```

After changing prompts or the drug table, re-record the demo with `node --experimental-strip-types scripts/build-demo.mjs`.

## Limits

- Drug equivalents outside the curated table are AI suggestions and are labeled that way.
- The demo record is sent to the model to find context and to translate. A real version needs consent, data minimization and a BAA-covered provider.
- Record tiles are AI summaries of the patient's own record. Each tile links back to its source entry.
- Not yet tested on a physical iPhone or Android. On iOS the mic is released during playback, and audio is unlocked on the first tap.
