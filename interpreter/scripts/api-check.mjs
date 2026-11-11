// End-to-end API check against a running server (npm run dev).
// Voices each demo-script line with TTS, then runs it through transcribe -> interpret + context,
// and checks the things the demo depends on (drug swaps, alerts, speaker detection).
//   node --experimental-strip-types scripts/api-check.mjs [persona] [--base http://localhost:5173]
import fs from "node:fs";
import path from "node:path";
import { PERSONAS } from "../src/data/personas.ts";
import { recordForContext, sttTerms } from "../src/lib/record.ts";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:5173";
const which = args.find((a) => !a.startsWith("--") && a !== BASE) || "sofia";
const persona = PERSONAS.find((p) => p.id === which);
if (!persona) throw new Error(`unknown persona ${which}`);
const CACHE = path.resolve(".cache/voice");
fs.mkdirSync(CACHE, { recursive: true });

async function voice(text, lang, i) {
  const f = path.join(CACHE, `${persona.id}-${i}.wav`);
  if (fs.existsSync(f) && fs.readFileSync(f.replace(/\.wav$/, ".txt"), "utf8") === text) return fs.readFileSync(f);
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: lang === persona.language ? "ash" : "sage", input: text, response_format: "wav", instructions: `Speak naturally in ${lang}, like a ${lang === persona.language ? "worried patient" : "doctor"}, including the hesitations.` }),
  });
  if (!r.ok) throw new Error(`tts ${r.status} ${await r.text()}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(f, buf);
  fs.writeFileSync(f.replace(/\.wav$/, ".txt"), text);
  return buf;
}

async function post(route, body) {
  const t0 = Date.now();
  const r = await fetch(BASE + route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${route} ${r.status}: ${j.error}`);
  return { ...j, wall: Date.now() - t0 };
}

const common = { patientLang: persona.language, doctorLang: persona.trip.doctorLanguage, home: persona.home, local: persona.trip.country };
const eq = await post("/api/equivalents", { home: persona.home, local: persona.trip.country, items: persona.medications.map((m) => ({ id: m.id, name: m.name, generic: m.generic })) });
console.log(`\n== ${persona.name}: trip prep (${eq.wall} ms)`);
for (const e of eq.items) console.log(`  ${e.input.padEnd(24)} -> ${e.local_name || "(not available)"} [${e.status}, ${e.source}]`);

const history = [];
const shown = [];
let failures = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${msg}`);
  if (!ok) failures++;
};

for (const [i, line] of persona.script.entries()) {
  const lang = line.speaker === "patient" ? persona.language : persona.trip.doctorLanguage;
  const wav = await voice(line.text, lang, i);
  const stt = await post("/api/transcribe", { audio: wav.toString("base64"), mime: "audio/wav", ...common, terms: sttTerms(persona) });
  const [it, cx] = await Promise.all([
    post("/api/interpret", { text: stt.text, ...common, meds: persona.medications, equivalents: eq.items, history }),
    post("/api/context", { text: stt.text, speaker: line.speaker, record: recordForContext(persona), doctorLang: persona.trip.doctorLanguage, local: persona.trip.country, history, shown }),
  ]);
  history.push({ speaker: it.speaker, text: it.cleaned });
  console.log(`\n-- [${line.speaker}] ${line.text}`);
  console.log(`  heard (${stt.ms} ms):    ${stt.text}`);
  console.log(`  cleaned (${it.ms} ms):  ${it.cleaned}   [${it.language} -> ${it.speaker}]`);
  console.log(`  translation:     ${it.translation}`);
  for (const d of it.drugs) console.log(`  drug: "${d.mentioned}" -> "${d.translated}" | ${d.home_name} => ${d.local_name || "N/A"} [${d.status}, ${d.source}] ${d.note_doctor}`);
  for (const c of cx.items) console.log(`  context (${cx.ms} ms) ${c.level.toUpperCase()} ${c.id}: ${c.title} — ${c.detail} | ${c.why}`);
  for (const c of cx.items) if (!shown.includes(c.id)) shown.push(c.id);
  console.log(`  wall: stt ${stt.wall} + max(interpret ${it.wall}, context ${cx.wall}) ms`);
  check(it.speaker === line.speaker, `speaker detected as ${line.speaker}`);
  const ids = cx.items.map((c) => c.id);
  const alerts = cx.items.filter((c) => c.level === "alert").map((c) => c.id);
  if (persona.id === "sofia") {
    if (i === 1) {
      check(it.drugs.some((d) => d.key === "metamizole" && d.status === "not_available_locally"), "Neo-Melubrina flagged not available in US");
      check(it.drugs.some((d) => d.key === "salbutamol" && /albuterol/i.test(d.local_name)), "Ventolin -> albuterol");
      check(/albuterol/i.test(it.translation), "translation uses albuterol");
    }
    if (i === 2) {
      check(alerts.includes("alg_penicilina") || alerts.includes("doc_alergia_2018"), "penicillin allergy alert on amoxicillin");
      check(ids.includes("lab_tfge") || ids.includes("cnd_erc") || ids.includes("doc_nefro_2026"), "kidney function surfaced before contrast");
      check(/amoxicilina/i.test(it.translation), "Spanish translation says amoxicilina");
    }
  }
  if (persona.id === "jordan" && i === 2) {
    check(alerts.includes("alg_penicillin") || alerts.includes("doc_allergy_letter"), "penicillin allergy alert");
  }
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exitCode = failures ? 1 : 0;
