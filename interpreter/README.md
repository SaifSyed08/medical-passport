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

Press **D**, or tap **Play demo conversation**. It replays a real recorded run: the speakers' voices, live captions, the drug-name flips, the record tiles and alerts, and the spoken translations. It needs no mic, no network and no API calls. **Esc** stops it. If a recorded clip can't load or stalls, that line carries on silently with its captions instead of freezing the demo. Switch patients under ⚙ on the home screen.

- **Sofía Hernández** is from Guadalajara and visiting Austin (Spanish ⇄ English). Her record is written in Spanish, and the doctor reads it in English.
- **Jordan Rivera** is an American student in Tokyo (English ⇄ Japanese). He's the traveler from the [Tessera medical passport](https://github.com/SaifSyed08/medical-passport) demo.
- **Sita Gurung** is from Pokhara and visiting New York (Nepali ⇄ English). She has back pain and took two **Flexon**, not knowing it contains ibuprofen, an NSAID, which sets off her asthma. The word flips to *ibuprofen + acetaminophen* and the NSAID-allergy banner drops in. The doctor then proposes ketorolac (another NSAID) and a CT with contrast, and her record shows a contrast-dye reaction too. The lines to say are in the [demo script doc](https://claude.ai/artifact/TKTvdwnDLx7LXDkdvCNk5k).

Hidden keys:

| Key | |
| --- | --- |
| **3** | Switches to **Tandem**, a second look: navy, gold and cream, with a serif for the words that matter |
| **L** | Switches the conversation to **Focus**, an experimental layout (also under ⚙ → Conversation layout). One line at a time in very large type, the record's notes pinned under the sentence that raised them, earlier lines as a ribbon of dots at the top (tap one, or swipe sideways, to go back), and the two people as chips either side of the mic (tap one to say who talks next) |
| **F** | Fast demo: the recording plays about 1.6× faster with shorter pauses. Press again for normal speed |
| **P** | **Private mode**: the patient's voice, words and record are handled by small models on this machine instead of the cloud. A lock shows in the header. Press again for the cloud models. See [Private mode](#private-mode-p) |

## What it does

| | |
| --- | --- |
| **Hears who's talking** | The language spoken decides who it is, so there are no buttons to press. You can override it in ⋯. |
| **Live captions** | While someone talks, the audio so far goes to a fast transcription model about once a second and the caption grows. When they stop, `gpt-transcribe` makes the final pass. |
| **Cleans up speech** | Fillers, stutters and self-corrections are removed ("two, no, three pills" becomes "three pills"). Facts, doses and hedges never change. The original is one tap away. |
| **Local medicine names** | A curated cross-country table covers MX, US, JP, GB and IN, and the server enforces it on top of the model's output. The phone saves each match, so it works offline. |
| **Record in real time** | The record is matched against what was just said and shown as compact tiles above the mic. Alerts come first; a new or re-triggered alert flashes and the phone vibrates. Each tile opens a short explanation and the original entry. |
| **Editable profile** | On the home screen the patient can swipe any record row left to delete it (with undo). Every section has **Add**: type the entry in, or upload a photo of a document. Tesseract reads the photo on the phone and the medical passport's own rule-based reader (`../extractor`) finds allergies, medicines and conditions, each quoting its line. No AI model and no upload; the patient ticks what to keep. Documents show a thumbnail (the photo, or a drawn page) and open as a page. Medicines show the local name with the local flag. |
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
2. **Tunnel** (most reliable at events): run `npx cloudflared tunnel --url http://localhost:5173`. Start the server with `ACCESS_CODE=something` and open the link once as `…/?code=something`. Without the code the API answers 401, so nobody else can spend your credits. The Tessera app's Medicines tab sends the same code in an `X-Access-Code` header.

In a loud room, switch to **Tap to talk** under ⋯. **⌨ Type** runs typed text through the same pipeline.

## Private mode (P)

Press **P** and everything that carries the patient's voice, words or record is answered on this machine. The phone marks each request, and the server sends it to local models instead of OpenAI. Nothing falls back to the cloud: if a local model is missing, the line fails and says so. The models are phone-sized (int8, about 1.6 GB in all), the same class that runs on a phone today. In this demo they run on the laptop that serves the app.

| Step | Cloud | Private |
| --- | --- | --- |
| Speech to text | `gpt-transcribe` | Whisper small (464 MB, int8 at load) picks the language. Each language can have its own **speech pack**: Nepali uses a Whisper small fine-tuned on Nepali (240 MB int8), because the general model writes Nepali in Latin letters or as Hindi |
| Translation | `gpt-6-luna` | NLLB-200 distilled 600M (618 MB int8): one translation model for 200 languages, about half a second a line on the CPU. Medicine names are swapped for placeholders before translating and put back afterwards in the listener's local form, e.g. *albuterol (Asthalin)* |
| Medicine names | the model + the curated table | The curated table plus the patient's own list, matched by sound as well as spelling, so *glucofaje*, *एस्थालिन* and *アモチシシリン* still count |
| Record alerts | `gpt-6-luna` | Rules (`server/rules.mjs`): a line naming a penicillin, an NSAID or contrast dye raises the matching allergy, and NSAIDs or contrast raise kidney trouble. Alert text is in the clinician's language. The rules know only those families; the cloud model knows every drug |
| Voice | `gpt-4o-mini-tts` | Piper, one 60–75 MB voice per language |
| Record translation | `gpt-6-luna` | NLLB, field by field |

Set up once (free; needs Python 3.10+; downloads the models into `.cache/`):

```sh
npm run local:setup        # or: npm run local:setup -- --langs es,en
```

The server starts the local models (`server/local/sidecar.py`, on 127.0.0.1 only) the first time P is pressed. They use an NVIDIA GPU when one is there, borrowing Ollama's CUDA libraries if it's installed, and run on the CPU otherwise. `LOCAL_TRANSLATOR=llm` sends translation to a local Ollama model instead (default `gemma3:4b`, 3.4 GB). It's slower, about 6 s a line, and worse from English into Nepali. Smaller models (Gemma 3 1B, Qwen3 1.7B) mistranslated medical lines ("penicillin antibiotic" came back as "penile lesions"), so the default uses a translation model, not a chat model.

Demo mode (D) is a recording either way: it makes no calls at all.

## How it works

```
phone mic ─► voice-activity detection (AudioWorklet) ─► utterance WAV ───────────────► /api/transcribe (gpt-transcribe,
         └─► snapshot every ~1 s while talking ─► /api/transcribe?fast (live caption)    primed with the patient's medicines)
                                                                                         │
                     ┌───────────────────────────────────────────────────────────────────┤
                     ▼                                                                   ▼
   /api/interpret (gpt-6-luna): language → speaker, cleanup,        /api/context (gpt-6-luna): which record items matter
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

Models can be overridden with `STT_MODEL`, `STT_FAST_MODEL`, `LLM_MODEL`, `CONTEXT_MODEL` and `TTS_MODEL`. `INTERPRET_EFFORT` sets the interpreting call's reasoning effort (default `none`, for speed). `CONTEXT_EFFORT` sets the record flagger's (default `low`: with none, `gpt-6-luna` missed a CT-dye allergy alert on `scripts/accuracy.mjs` that `gpt-4.1` caught; the flags arrive about a second later, and the translation never waits for them). From the end of speech to the translation takes about 2–3 s.

The defaults are `gpt-6-luna` (text) and `gpt-transcribe` (speech to text), OpenAI's replacements for gpt-4.1, gpt-4.1-mini and gpt-4o(-mini)-transcribe, which shut down in January–February 2027. On the scripted demo conversations (`npm run test:api`) they pass every check that gpt-4.1 did, at about $0.0003 per turn instead of $0.004. They're about 0.5–1 s slower per turn. For better translations at higher cost, set `LLM_MODEL=gpt-6.1-terra`. The server logs token counts per call (`[usage] …`), never content.

**Before January 6, 2027:** `gpt-4o-mini-tts` shuts down then. OpenAI's replacement, `gpt-realtime-2.1-mini`, only works through the Realtime API, not `/v1/audio/speech`, so spoken translation needs reworking by that date.

## Tests

```sh
npm test                                   # unit tests: drug names, merges, mic and player behavior, translation validation
npm run typecheck
node scripts/demo-check.mjs sofia          # plays demo mode headless and checks turns, captions, alerts and layout
node scripts/demo-regressions.mjs          # browser regressions with a mocked API (stop/restart, half-duplex, scrolling…)
node scripts/profile-check.mjs             # editable profile: swipe to delete, undo, scan a printed note, persistence
node scripts/focus-check.mjs sita --tandem # the Focus layout through a recorded demo
npm run test:api -- sofia                  # live API: TTS-voiced lines → transcribe → interpret + context (paid)
npm run test:accuracy                      # accuracy on 16 new lines across the 3 patients (paid, a few cents)
node scripts/demo-check.mjs sita --stall   # demo failsafe: the script fetch fails once and two clips hang forever
npm run test:e2e -- sofia                  # headless Chrome with a fake mic feeding the real pipeline (paid)
npm run test:e2e -- sita --private         # the same in private mode (free); start the server with OPENAI_API_KEY= to prove no cloud call
npm run test:accuracy -- --private         # accuracy in private mode; add --holdout for the lines it was never tuned on
```

After changing prompts or the drug table, re-record the demo with `node --experimental-strip-types scripts/build-demo.mjs`.

## Accuracy

`npm run test:accuracy` (`scripts/accuracy.mjs`) voices 16 sentences with TTS. None of them are from the demo scripts; they are new lines for the three patients, in Spanish, English, Japanese and Nepali. Each one runs through the same pipeline the phone uses, and the script checks it against what a correct answer must contain.

Results from 2026-11-16, two runs, with `gpt-4.1` choosing the record items:

| Measure | Result |
| --- | --- |
| Transcription character error rate | 1.6–2.2% overall (Spanish 0%, Japanese 0%, English 1.8%, Nepali 3–6%) |
| Speaker told apart by language alone | 16/16 |
| Medicines recognized (brand or generic) | 11/11 |
| Required record alerts raised (penicillin, NSAIDs with kidney disease or AERD, contrast dye) | 5/5 |
| Lines that should raise no alert (thanks, a chest X-ray) that raised none | 4/4 |
| Key terms kept in the translation (local medicine names, the symptom) | 22/22 |
| End of speech to translation | median 1.8–2.0 s, 90th percentile 2.7–2.9 s |

With `gpt-4.1-mini` choosing the record items (the previous default), every score was the same except false alarms. Two or three of the four quiet lines raised alerts: Sita's "thank you" and her chest X-ray both raised her NSAID allergy. That is why the context model is now `gpt-4.1`; it runs beside the interpreter call, so it adds no wait.

Two caveats:
- The set is small and the voices are synthetic, so treat these as a regression check, not a clinical validation.
- The last prompt change (judge only the latest line; thanks and greetings raise nothing) was checked with `npm run test:api` for Sita and Sofía. A full accuracy rerun after it is still to do.

### Private mode

The same 16 lines through the private models (`npm run test:accuracy -- --private`, 2026-11-17, Whisper small, NLLB-200 600M, rules), and 9 lines written afterwards and never tuned on (`--holdout`, voiced by the local Piper voices because the OpenAI account was out of credit):

| Measure | 16 lines | 9 held-out lines |
| --- | --- | --- |
| Transcription character error rate | 6.6% (Spanish 3%, English 6%, Japanese 6%, Nepali 10%) | 4.1% (Nepali 15%) |
| Speaker told apart | 16/16 | 9/9 |
| Medicines recognized | 11/11 | 3/4 on the blind run, 4/4 after one fix |
| Required record alerts | 5/5 | 4/4 |
| Quiet lines with no alert | 4/4 | 4/4 |
| Key terms kept in the translation | 22/22 | 6/9 on the blind run, 7/9 after the fixes |
| End of speech to translation | median 0.8 s, 90th percentile 0.9 s | median 0.7 s |

Read the first column with care: private mode was built against those 16 lines, and two fixes target what they exposed. One is a short Nepali glossary ("दम" is asthma, which NLLB reads as breath). The other is reading "दाइ" (brother) as "डाइ" (dye) right after "scan". The held-out column is the honest number. The blind run's misses were "contrast" left untranslated and *फ्लेक्सन* not matched to Flexon, both general bugs fixed since, plus two Nepali lines whose words were misheard ("ढाड", back, became something else; "इन्हेलर" became "इनेलर"). Nepali speech is where private mode is weakest. In the browser run, two of Sita's three spoken lines came out with a wrong word ("stomach" for back) or a wrong meaning, although every alert still fired. The cloud translations read better throughout. The private ones are plainer and sometimes literal ("dos hinchas" for two puffs).

## Limits

- Drug equivalents outside the curated table are AI suggestions and are labeled that way.
- Document scanning downloads Tesseract's engine and English language data from a CDN the first time; scan once online before an offline demo.
- `scripts/demo-regressions.mjs`'s scroll check is timing-sensitive and occasionally fails on a slow machine; rerun it.
- In cloud mode the demo record is sent to the model to find context and to translate. A real version needs consent, data minimization and a BAA-covered provider, or private mode.
- Private mode runs its models on the laptop serving the app, not yet inside the phone app itself; the models are sized for a phone (int8, about 1.6 GB).
- Record tiles are AI summaries of the patient's own record. Each tile links back to its source entry.
- Not yet tested on a physical iPhone or Android. On iOS the mic is released during playback, and audio is unlocked on the first tap.
