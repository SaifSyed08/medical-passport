// Records one real run of each persona's demo script through the live pipeline, so the app's demo mode
// (press D) can replay it offline: the speakers' voices, transcription, translation, drug swaps, context
// cards and the spoken translation.
//   npm run dev                                                  (server on :5173)
//   node --experimental-strip-types scripts/api-check.mjs sofia  (voices the lines once into .cache/voice)
//   node --experimental-strip-types scripts/build-demo.mjs [sofia jordan]
import fs from "node:fs";
import path from "node:path";
import { PERSONAS } from "../src/data/personas.ts";
import { recordForContext, sttTerms } from "../src/lib/record.ts";

const BASE = process.env.BASE || "http://localhost:5173";
const OUT = path.resolve("public/demo");
fs.mkdirSync(OUT, { recursive: true });
const which = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const personas = which.length ? PERSONAS.filter((p) => which.includes(p.id)) : PERSONAS;

async function post(route, body) {
  const r = await fetch(BASE + route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${route} ${r.status}: ${j.error}`);
  return j;
}

/** Duration of a PCM16 mono WAV (TTS streams can carry a bogus data size, so measure the file). */
function wavMs(buf) {
  const rate = buf.readUInt32LE(24);
  return Math.round(((buf.length - 44) / 2 / rate) * 1000);
}

for (const p of personas) {
  const pair = { patientLang: p.language, doctorLang: p.trip.doctorLanguage, home: p.home, local: p.trip.country };
  const eq = await post("/api/equivalents", { home: p.home, local: p.trip.country, items: p.medications.map((m) => ({ id: m.id, name: m.name, generic: m.generic })) });
  const history = [];
  const shown = [];
  const lines = [];
  for (const [i, line] of p.script.entries()) {
    const src = path.resolve(`.cache/voice/${p.id}-${i}.wav`);
    if (!fs.existsSync(src)) throw new Error(`missing ${src}: run api-check for ${p.id} first`);
    const wav = fs.readFileSync(src);
    fs.copyFileSync(src, path.join(OUT, `${p.id}-${i}.wav`));
    const stt = await post("/api/transcribe", { audio: wav.toString("base64"), mime: "audio/wav", ...pair, terms: sttTerms(p) });
    const [it, cx] = await Promise.all([
      post("/api/interpret", { text: stt.text, ...pair, forced: line.speaker, meds: p.medications, equivalents: eq.items, history }),
      post("/api/context", { text: stt.text, speaker: line.speaker, record: recordForContext(p), doctorLang: p.trip.doctorLanguage, local: p.trip.country, history, shown }),
    ]);
    if (it.empty) throw new Error(`line ${i} came back empty`);
    history.push({ speaker: it.speaker, text: it.cleaned });
    for (const c of cx.items) if (!shown.includes(c.id)) shown.push(c.id);
    const voice = it.speaker === "patient" ? "coral" : "sage";
    const q = new URLSearchParams({ text: it.translation, lang: it.listenerLang, voice });
    const tts = await fetch(`${BASE}/api/tts?${q}`);
    if (!tts.ok) throw new Error(`tts ${tts.status}`);
    fs.writeFileSync(path.join(OUT, `${p.id}-${i}-tr.mp3`), Buffer.from(await tts.arrayBuffer()));
    lines.push({
      speaker: line.speaker,
      audio: `/demo/${p.id}-${i}.wav`,
      audioMs: wavMs(wav),
      speech: `/demo/${p.id}-${i}-tr.mp3`,
      stt: { text: stt.text, ms: stt.ms },
      interpret: it,
      context: cx.items,
    });
    console.log(`${p.id} ${i}: ${it.translation}  [${cx.items.map((c) => c.level[0] + ":" + c.id).join(" ")}]`);
  }
  fs.writeFileSync(path.join(OUT, `${p.id}.json`), JSON.stringify({ persona: p.id, recordedAt: new Date().toISOString(), equivalents: eq.items, lines }, null, 1));
}
