// Accuracy check against a running server (npm run dev). Paid: about 16 TTS clips plus 3 model calls per line,
// a few cents a run (voices are cached in .cache/voice-acc, so reruns only pay for the models).
// The lines are NOT the demo scripts: they're new sentences for the same three patients, each with what a
// correct answer must contain. Every line is voiced with TTS, then run through transcribe -> interpret + context
// exactly as the phone does.
//   node --experimental-strip-types --no-warnings scripts/accuracy.mjs [--base http://localhost:5173]
// Scores:
//   transcription   character error rate vs what was said (punctuation and spacing ignored)
//   speaker         patient/clinician told apart from the language alone
//   medicines       each brand or generic mentioned is recognised as the right medicine
//   alerts          the record alert a clinician must see fires (recall)
//   false alarms    lines that should raise nothing alarming raise no alert
//   key terms       words that must survive translation do (e.g. the medicine name in its local form)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PERSONAS } from "../src/data/personas.ts";
import { recordForContext, sttTerms } from "../src/lib/record.ts";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:5173";
const CACHE = path.resolve(".cache/voice-acc");
fs.mkdirSync(CACHE, { recursive: true });

// speaker: who says it. drugs: medicine keys that must be recognised. alert: record ids, one of which must come
// back as an alert. quiet: no alert may come back. say: regexes the translation must match.
const CASES = {
  sofia: [
    { speaker: "patient", text: "Tomo Glucophage dos veces al día y Cozaar en la mañana.", drugs: ["metformin", "losartan"], say: [/metformin/i, /losartan/i] },
    { speaker: "patient", text: "Hace dos días tomé una Neo-Melubrina para el dolor de cabeza.", drugs: ["metamizole"], say: [/headache/i] },
    { speaker: "clinician", text: "I'd like to start you on amoxicillin for the infection.", drugs: ["amoxicillin"], alert: ["alg_penicilina"], say: [/amoxicilina/i] },
    { speaker: "clinician", text: "Let's give you ibuprofen, 600 mg every eight hours.", drugs: ["ibuprofen"], alert: ["cnd_erc", "lab_tfge", "lab_creatinina"], say: [/ibuprofeno/i] },
    { speaker: "clinician", text: "Use your albuterol inhaler, two puffs before exercise.", drugs: ["salbutamol"], say: [/salbutamol|ventolin/i] },
    { speaker: "patient", text: "Gracias, doctor. ¿A qué hora abre la farmacia?", quiet: true, say: [/pharmacy/i] },
  ],
  jordan: [
    { speaker: "patient", text: "I take Lantus at night and Humalog with my meals.", drugs: ["insulin-glargine", "insulin-lispro"], say: [/ランタス|グラルギン/, /ヒューマログ|リスプロ/] },
    { speaker: "patient", text: "My ProAir inhaler is almost empty.", drugs: ["salbutamol"], say: [/サルブタモール|サルタノール/] },
    { speaker: "clinician", text: "ペニシリン系の抗生物質を出しますね。", alert: ["alg_penicillin"], say: [/penicillin/i, /antibiotic/i] },
    { speaker: "clinician", text: "お大事にしてください。", quiet: true, say: [/care|well|better/i] },
  ],
  sita: [
    { speaker: "patient", text: "मलाई दम छ, म एस्थालिन इन्हेलर प्रयोग गर्छु।", drugs: ["salbutamol"], say: [/asthma/i, /albuterol/i] },
    { speaker: "patient", text: "म दिनको दुई पटक बुडेकोर्ट लिन्छु।", drugs: ["budesonide-inhaler"], say: [/budesonide|pulmicort/i, /twice/i] },
    { speaker: "clinician", text: "Let's try some diclofenac gel on your back.", drugs: [], alert: ["alg_nsaid", "cnd_aerd"], say: [/डाइक्लोफेनाक|डिक्लोफेनाक|diclofenac/i] },
    { speaker: "clinician", text: "Let's start with a chest X-ray today.", quiet: true, say: [/एक्स-?रे|एक्सरे|x-?ray/i] },
    { speaker: "patient", text: "धन्यवाद, अब अलि सजिलो भयो।", quiet: true, say: [/thank/i] },
    { speaker: "patient", text: "मलाई सिटी स्क्यानको डाइले पहिले एलर्जी भएको थियो।", alert: ["alg_contrast"], say: [/contrast|dye/i, /CT/] },
  ],
};

const LANG = { ne: "Nepali", es: "Spanish", ja: "Japanese", en: "English" };

async function voice(text, lang, who) {
  const h = crypto.createHash("sha1").update(`${lang}|${who}|${text}`).digest("hex").slice(0, 16);
  const f = path.join(CACHE, `${h}.wav`);
  if (fs.existsSync(f)) return fs.readFileSync(f);
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: who === "patient" ? "ash" : "sage", input: text, response_format: "wav", instructions: `Speak naturally in ${LANG[lang] || lang}, like a ${who === "patient" ? "patient" : "doctor"} in a clinic.` }),
  });
  if (!r.ok) throw new Error(`tts ${r.status} ${await r.text()}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(f, buf);
  return buf;
}

async function post(route, body) {
  const t0 = Date.now();
  const r = await fetch(BASE + route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${route} ${r.status}: ${j.error}`);
  return { ...j, wall: Date.now() - t0 };
}

// Character error rate: edit distance over the reference length, on letters and digits only.
const squash = (s) => s.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
function cer(ref, hyp) {
  const a = [...squash(ref)];
  const b = [...squash(hyp)];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return a.length ? prev[b.length] / a.length : 0;
}

const tally = { lines: 0, speaker: [0, 0], drugs: [0, 0], alerts: [0, 0], quiet: [0, 0], say: [0, 0], cer: {}, wall: [] };
const misses = [];
const hit = (k, ok) => {
  tally[k][1]++;
  if (ok) tally[k][0]++;
  return ok;
};

for (const [pid, cases] of Object.entries(CASES)) {
  const persona = PERSONAS.find((p) => p.id === pid);
  const common = { patientLang: persona.language, doctorLang: persona.trip.doctorLanguage, home: persona.home, local: persona.trip.country };
  const eq = await post("/api/equivalents", { home: persona.home, local: persona.trip.country, items: persona.medications.map((m) => ({ id: m.id, name: m.name, generic: m.generic })) });
  console.log(`\n== ${persona.name} (${LANG[persona.language]} <-> ${LANG[persona.trip.doctorLanguage]})`);
  for (const c of cases) {
    const lang = c.speaker === "patient" ? persona.language : persona.trip.doctorLanguage;
    const wav = await voice(c.text, lang, c.speaker);
    const stt = await post("/api/transcribe", { audio: wav.toString("base64"), mime: "audio/wav", ...common, terms: sttTerms(persona) });
    const [it, cx] = await Promise.all([
      post("/api/interpret", { text: stt.text, ...common, meds: persona.medications, equivalents: eq.items, history: [] }),
      post("/api/context", { text: stt.text, speaker: c.speaker, record: recordForContext(persona), doctorLang: persona.trip.doctorLanguage, local: persona.trip.country, history: [], shown: [] }),
    ]);
    tally.lines++;
    tally.wall.push(stt.wall + Math.max(it.wall, cx.wall));
    const e = cer(c.text, stt.text);
    (tally.cer[lang] ||= []).push(e);
    const alerts = cx.items.filter((i) => i.level === "alert").map((i) => i.id);
    const keys = it.drugs.map((d) => d.key);
    const notes = [];
    if (!hit("speaker", it.speaker === c.speaker)) notes.push(`speaker ${it.speaker}`);
    for (const k of c.drugs || []) if (!hit("drugs", keys.includes(k))) notes.push(`missed ${k} (got ${keys.join(",") || "none"})`);
    if (c.alert && !hit("alerts", alerts.some((a) => c.alert.includes(a)))) notes.push(`no alert (got ${alerts.join(",") || "none"})`);
    if (c.quiet && !hit("quiet", alerts.length === 0)) notes.push(`false alarm ${alerts.join(",")}`);
    for (const re of c.say || []) if (!hit("say", re.test(it.translation))) notes.push(`translation lacks ${re}`);
    console.log(`  [${c.speaker}] ${c.text}\n    heard: ${stt.text}  (CER ${(e * 100).toFixed(1)}%)\n    said:  ${it.translation}\n    ${alerts.length ? `alerts: ${alerts.join(", ")}` : "no alerts"} · ${notes.length ? `MISS ${notes.join("; ")}` : "ok"}`);
    if (notes.length) misses.push(`${pid}: ${c.text} -> ${notes.join("; ")}`);
  }
}

const pct = ([a, b]) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : "n/a");
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sorted = [...tally.wall].sort((a, b) => a - b);
const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const cerAll = Object.values(tally.cer).flat();
const summary = {
  when: new Date().toISOString(),
  lines: tally.lines,
  transcriptionCER: `${(mean(cerAll) * 100).toFixed(1)}%`,
  transcriptionCERByLanguage: Object.fromEntries(Object.entries(tally.cer).map(([l, xs]) => [LANG[l] || l, `${(mean(xs) * 100).toFixed(1)}%`])),
  speaker: pct(tally.speaker),
  medicines: pct(tally.drugs),
  alerts: pct(tally.alerts),
  quietLinesWithoutFalseAlarm: pct(tally.quiet),
  keyTermsInTranslation: pct(tally.say),
  latencyMs: { median: q(0.5), p90: q(0.9) },
  misses,
};
console.log("\n== summary");
console.log(JSON.stringify(summary, null, 2));
fs.mkdirSync(".cache/accuracy", { recursive: true });
fs.writeFileSync(".cache/accuracy/latest.json", JSON.stringify(summary, null, 2));
