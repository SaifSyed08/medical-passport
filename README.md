# Tessera Interpreter

A patient-aware medical interpreter for travelers. It's a phone web app. The patient hands it to a doctor who doesn't speak their language, and then they both just talk.

- **Hears who's talking from the language.** No buttons. Spanish means the patient is talking, English means the doctor. There's a manual Patient / Doctor override for the odd case.
- **Cleans up speech before translating.** Fillers, stutters and self-corrections come out ("two, no, three pills" becomes "three pills"). The meaning never changes. Tap "show what was heard" to see the raw text.
- **Swaps medicine names live.** A medicine name lights up in the transcript and turns into the name used where the patient is now: *Ventolin → albuterol*, *Neo-Melubrina → metamizole (not sold in the US)*, *ProAir → サルブタモール*. The translation the doctor hears uses the local name too.
- **Brings up the patient's record while they talk.** It shows the record items that matter right now, in the doctor's language, including ones the patient wouldn't think to mention. If the doctor says "amoxicillin" and the patient had penicillin anaphylaxis, a red alert appears. A CT with contrast brings up eGFR 44 and the note to avoid contrast.
- **Keeps medicine names on the phone.** "Trip prep" looks up the local names for every saved medicine and stores them. Any medicine heard in conversation is stored too.
- **Speaks the translation aloud** in the listener's language. The mic pauses while the phone is talking, so it never translates itself.

Demo only. The patients are fictional. Not for clinical use.

## Demo mode: press D

Press **D** anywhere, or tap **Watch the demo** on the home screen. It replays a real recorded run of the persona's script: the speakers' voices, transcription, cleanup, drug-name flips, record cards, the alert banner and the spoken translation. It needs no mic, no network and no API calls, so it's safe to run on stage or to rehearse with. **Esc** or tapping the orb stops it. **Space** works the mic in a live conversation.

The recording lives in `public/demo/` and was made with `scripts/build-demo.mjs`. Re-record it after changing prompts or the drug table.

## Run it

You need Node 22+ and `OPENAI_API_KEY` in the environment.

```sh
npm install
npm run dev        # http://localhost:5173 (Vite runs inside the server)
npm run demo       # production build + server: use this for the live demo
```

### On a phone

The mic needs HTTPS. Pick one:

1. **Same Wi-Fi.** The server also listens on `https://<laptop-LAN-IP>:5443`. The address is printed at startup and the certificate is self-signed. Open it on the phone, accept the warning, and allow the mic. Conference Wi-Fi often blocks phone-to-laptop traffic. If the page doesn't load, use option 2.
2. **Tunnel (most reliable at events).** Run `npx cloudflared tunnel --url http://localhost:5173` and open the `https://….trycloudflare.com` link it prints. That link is public. Start the server with `ACCESS_CODE=something` first, and open the link once as `https://…/?code=something`. A cookie unlocks that phone. Without the code the API answers 401, so nobody else can spend your OpenAI credits.

Do a ten-second mic check at the venue. Hands-free mode learns the room's noise level. In a loud hall, switch to **Tap to talk** (bottom right). Tapping the mic while someone is talking also sends the speech right away.

If the mic fails completely, **⌨ Type** runs typed text through the same pipeline.

## Demo script (Sofía, Spanish → English)

Sofía is from Guadalajara and is visiting her son in Austin. Her record is in Spanish, the way her clinic wrote it. The app translates the relevant parts for the doctor.

1. **Patient:** *"Hola doctor, eh, desde anoche me duele mucho el pecho y, um, me cuesta respirar."* Cleaned up, spoken in English. Cards appear: asthma, the March 2025 ER visit for an asthma attack, the rescue inhaler.
2. **Patient:** *"Tomé dos Neo-Melubrinas y usé mi Ventolin pero no me ayudó."* Neo-Melubrina turns into **metamizole** with a red "!" (not sold in the US). Ventolin turns into **albuterol**. The doctor hears "metamizole (Neo-Melubrina)… albuterol (Ventolin)".
3. **Doctor:** *"Okay. I'd like to start you on amoxicillin and get a CT scan with contrast."* Sofía hears it in Spanish. **Alerts:** penicillin anaphylaxis (2018), and kidney disease with eGFR 44 plus the note to avoid contrast. Metformin also shows, since it matters with contrast.
4. **Doctor:** *"Can you take ibuprofen for the pain?"* An NSAID with CKD gets flagged.

Tap any highlighted medicine for both countries' names, brands, strengths and notes. Tap any card for the original record entry. The second persona, **Jordan Rivera**, is the Tessera medical-passport traveler: an English speaker seeing a Japanese doctor. The languages and current country can be changed on the home screen.

## How it works

```
phone mic ─► voice-activity detection (AudioWorklet, adaptive noise floor) ─► 16 kHz WAV per utterance
   └► POST /api/transcribe   gpt-4o-transcribe, primed with the patient's medicine/condition names
        ├► POST /api/interpret   language → speaker, cleanup, translation, drug spans
        │      grounded with the curated table + the phone's saved equivalents, then
        │      local names enforced server-side (server/drugs.mjs › localizeDrug)
        │   └► GET /api/tts      gpt-4o-mini-tts, streamed; mic paused while it plays
        └► POST /api/context     record items that matter now (ids validated against the record)
```

| File | What |
| --- | --- |
| `server/index.mjs` | Express server, API routes, HTTPS with a self-signed certificate, optional access code |
| `server/prompts.mjs` | Interpreter and context prompts, JSON schemas |
| `server/drugs.mjs` | Curated cross-country medicine names (MX/US/JP/GB/IN), matching, local-name enforcement |
| `src/lib/mic.ts` | Mic capture, voice-activity detection, WAV encoding |
| `src/lib/player.ts` | Ordered speech playback (one unlocked `<audio>`, which iOS needs) |
| `src/lib/store.ts` | localStorage: settings and saved medicine equivalents |
| `src/data/personas.ts` | Demo patients and their records |
| `src/components/*` | Home (passport card, trip prep in settings), Conversation (stage, demo player), Stage (word reveal, drug flip), ContextDock + AlertToast, Orb, sheets |

Models can be overridden with `STT_MODEL`, `LLM_MODEL` (default `gpt-4.1`), `CONTEXT_MODEL` (default `gpt-4.1-mini`) and `TTS_MODEL`. Measured on the demo lines, one utterance takes about 2–3 s from end of speech to translation: transcription 0.3–0.8 s, interpretation 1–2 s, with context running in parallel.

## Tests

```sh
npm test                    # unit tests: drug matching and swaps, WAV/VAD helpers, persona data
npm run typecheck
npm run test:api -- sofia   # live API: TTS voices the demo lines → transcribe → interpret + context, with checks
npm run test:e2e -- sofia   # headless Chrome with a fake mic playing those lines into the real app; screenshots in .cache/e2e
node scripts/demo-check.mjs sofia   # plays demo mode headless, checks it finishes with an alert; screenshots in .cache/demo-shots
node --experimental-strip-types scripts/build-demo.mjs   # re-record public/demo from the live pipeline
```

`test:api` caches its voice clips in `.cache/voice`, and `test:e2e` needs them. Add `--speak` to the e2e run to test spoken playback and mic pausing.

## Limits

- Drug equivalents outside the curated table are AI suggestions and are labelled that way. Same active ingredient doesn't mean the products are interchangeable.
- The whole demo record is sent to the model for context. A real version would need consent, minimisation and a BAA-covered provider.
- The context cards are AI summaries of the patient's own record. Each card links back to the source entry.
- Not tested on a physical iPhone or Android yet. On iOS the mic stream is released during playback, because iOS otherwise plays speech quietly while recording.
