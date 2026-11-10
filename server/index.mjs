// Tessera Interpreter server: serves the app and proxies speech, translation and record-context calls to OpenAI.
// One process: Vite runs as middleware in dev, `dist/` is served with --prod.
import express from "express";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS, HttpError, transcribe, chatJSON, chatJSONObject, speech } from "./openai.mjs";
import { createHash } from "node:crypto";
import {
  INTERPRET_SCHEMA, interpretPrompt, interpretUser,
  CONTEXT_SCHEMA, contextPrompt, contextUser,
  EQUIV_SCHEMA, equivPrompt, langName,
} from "./prompts.mjs";
import { findCurated, curatedMentionedIn, curatedEquivalent, equivalentLine, norm, localizeDrug } from "./drugs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = process.argv.includes("--prod") || process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 5173);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 5443);

const app = express();
app.disable("x-powered-by");

// Optional access code for when the server is reachable from the internet (e.g. through a tunnel):
// open https://<host>/?code=<ACCESS_CODE> once on the phone; a cookie keeps it unlocked.
const ACCESS_CODE = process.env.ACCESS_CODE || "";
const cookieOk = (req) => !ACCESS_CODE || (req.headers.cookie || "").split(/;\s*/).includes(`ti_code=${encodeURIComponent(ACCESS_CODE)}`);
if (ACCESS_CODE) {
  app.use((req, res, next) => {
    if (req.query.code === ACCESS_CODE) {
      res.setHeader("Set-Cookie", `ti_code=${encodeURIComponent(ACCESS_CODE)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
      return res.redirect(req.path);
    }
    if (req.path.startsWith("/api/") && req.path !== "/api/health" && !cookieOk(req)) return res.status(401).json({ error: "Locked: open the link with ?code=… first" });
    next();
  });
}

app.use("/api", express.json({ limit: "8mb" }));

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    const status = err instanceof HttpError ? err.status : err?.name === "TimeoutError" ? 504 : 500;
    console.error(`[${req.path}]`, err?.message || err);
    if (!res.headersSent) res.status(status).json({ error: err?.message || "Server error" });
    else res.end();
  });

const str = (v, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const arr = (v, max = 50) => (Array.isArray(v) ? v.slice(0, max) : []);
const code = (v, fallback) => (typeof v === "string" && /^[A-Za-z-]{2,8}$/.test(v) ? v : fallback);

/* ---------------------------------------------------------------- health */

app.get("/api/health", (req, res) => {
  res.json({ ok: true, key: Boolean(process.env.OPENAI_API_KEY), locked: !cookieOk(req), models: MODELS });
});

/* ---------------------------------------------------------------- speech to text */

// Whisper-family models occasionally "hear" these in silence or room noise.
const PHANTOMS = [
  /^(thank you|thanks)( (so much|for watching|very much))?[.!]?$/i,
  /subt[ií]tulos/i, /amara\.org/i, /^gracias[.!]?$/i, /suscr[ií]bete/i, /please subscribe/i,
  /ご視聴ありがとうございました/, /^\.+$/, /^you[.!]?$/i, /^bye[.!]?$/i,
];

app.post("/api/transcribe", wrap(async (req, res) => {
  const b64 = str(req.body?.audio, 12_000_000);
  if (!b64) throw new HttpError(400, "audio missing");
  const audio = Buffer.from(b64, "base64");
  if (audio.length < 2000) return res.json({ text: "", dropped: "too short" });
  const patientLang = code(req.body?.patientLang, "es");
  const doctorLang = code(req.body?.doctorLang, "en");
  const terms = arr(req.body?.terms, 40).map((t) => str(t, 80)).filter(Boolean);
  // Patient-aware recognition: prime the model with the patient's own medicine and condition names.
  const prompt = `A medical consultation between a ${langName(patientLang)}-speaking patient and a ${langName(doctorLang)}-speaking clinician. Transcribe exactly what is said, in the language it is spoken; do not translate. Keep filler words, hesitations, repetitions and self-corrections verbatim (um, uh, eh, este, I mean).${terms.length ? ` Names that may come up: ${terms.join(", ")}.` : ""}`;
  const t0 = Date.now();
  const text = await transcribe(audio, { prompt, mime: str(req.body?.mime, 40) || "audio/wav", model: req.body?.fast ? MODELS.sttFast : MODELS.stt });
  const ms = Date.now() - t0;
  // The model sometimes echoes its own prompt back on near-silent audio.
  if (!text || PHANTOMS.some((re) => re.test(text.trim())) || text.includes("Transcribe exactly what is said")) {
    return res.json({ text: "", dropped: text ? "phantom" : "empty", ms });
  }
  res.json({ text, ms });
}));

/* ---------------------------------------------------------------- interpreter */

function groundingFor({ text, meds, home, local, clientEquivalents }) {
  const lines = new Map();
  for (const eq of arr(clientEquivalents, 40)) {
    if (eq && typeof eq.generic === "string") lines.set(norm(eq.generic), equivalentLine(eq));
  }
  const entries = new Set(curatedMentionedIn(text));
  for (const m of meds) {
    const e = findCurated(`${m.name} ${m.generic || ""}`);
    if (e) entries.add(e);
  }
  for (const e of entries) {
    const eq = curatedEquivalent(e, home, local) || curatedEquivalent(e, local, home);
    if (eq) lines.set(norm(eq.generic), equivalentLine(eq));
  }
  return [...lines.values()];
}

const GENERIC_WORDS = /^(antibiotics?|painkillers?|pain relievers?|pain medication|medicines?|medications?|drugs?|pills?|tablets?|vitamins?)$/i;

function locate(haystack, needle) {
  if (!needle) return -1;
  const i = haystack.indexOf(needle);
  return i >= 0 ? i : haystack.toLowerCase().indexOf(needle.toLowerCase());
}

app.post("/api/interpret", wrap(async (req, res) => {
  const text = str(req.body?.text, 2000).trim();
  if (!text) throw new HttpError(400, "text missing");
  const patientLang = code(req.body?.patientLang, "es");
  const doctorLang = code(req.body?.doctorLang, "en");
  const home = code(req.body?.home, "MX").toUpperCase();
  const local = code(req.body?.local, "US").toUpperCase();
  const forced = ["patient", "clinician"].includes(req.body?.forced) ? req.body.forced : null;
  const meds = arr(req.body?.meds, 40).filter((m) => m && typeof m.id === "string").map((m) => ({
    id: str(m.id, 60), name: str(m.name, 120), generic: str(m.generic, 120), dose: str(m.dose, 120), schedule: str(m.schedule, 120),
  }));
  const history = arr(req.body?.history, 6).map((h) => ({ speaker: str(h?.speaker, 20), text: str(h?.text, 600) }));
  const equivalents = groundingFor({ text, meds, home, local, clientEquivalents: req.body?.equivalents });

  const t0 = Date.now();
  const out = await chatJSON({
    name: "interpret",
    schema: INTERPRET_SCHEMA,
    system: interpretPrompt({ patientLang, doctorLang, home, local, forced }),
    user: interpretUser({ text, meds, equivalents, history }),
    model: MODELS.llm,
  });
  const ms = Date.now() - t0;

  // Who spoke is decided by the language actually heard, unless the user forced it.
  const language = String(out.language || "").toLowerCase().slice(0, 2);
  let speaker = out.speaker === "clinician" ? "clinician" : "patient";
  if (forced) speaker = forced;
  else if (language === doctorLang && language !== patientLang) speaker = "clinician";
  else if (language === patientLang && language !== doctorLang) speaker = "patient";
  const cleaned = String(out.cleaned ?? "").trim();
  let translation = String(out.translation ?? "").trim();
  // Filler-only fragments ("Um,") come back empty: tell the client to drop the turn.
  if (!/[\p{L}\p{N}]/u.test(cleaned) || !/[\p{L}\p{N}]/u.test(translation)) {
    return res.json({ empty: true, raw: text, ms: Date.now() - t0 });
  }
  const listenerLang = speaker === "patient" ? doctorLang : patientLang;
  const listener = speaker === "patient" ? "clinician" : "patient";

  const seen = new Set();
  const drugs = [];
  for (const d of arr(out.drugs, 12)) {
    // Plain words like "antibiotic" or "pills" aren't worth a highlight.
    if (GENERIC_WORDS.test(String(d.generic || "").trim())) continue;
    const curated = findCurated(d.generic) || findCurated(d.mentioned) || findCurated(d.home_name) || findCurated(d.local_name);
    if (curated) {
      const fixed = localizeDrug(translation, curated, { home, local, listener });
      if (fixed) {
        translation = fixed.translation;
        d.translated = fixed.label;
      }
    }
    // Always describe the drug as "patient's country name -> name where the patient is now".
    const eq = curated ? curatedEquivalent(curated, home, local) : null;
    const k = norm(curated?.key || d.generic || d.mentioned);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const med = meds.find((m) => m.id === d.med_id) || (curated ? meds.find((m) => findCurated(`${m.name} ${m.generic}`) === curated) : null);
    drugs.push({
      key: curated?.key || k,
      mentioned: String(d.mentioned || ""),
      translated: String(d.translated || ""),
      inCleaned: locate(cleaned, d.mentioned) >= 0,
      inTranslation: locate(translation, d.translated) >= 0,
      generic: eq?.generic || String(d.generic || ""),
      drug_class: eq?.drug_class || "",
      home_name: eq?.home_name || String(d.home_name || ""),
      home_strength: eq?.home_strength || "",
      local_name: eq ? eq.local_name : String(d.local_name || ""),
      local_brands: eq?.local_brands || [],
      local_strength: eq?.local_strength || "",
      status: eq?.status || d.status || "uncertain",
      note_listener: String(d.note_listener || ""),
      note_doctor: String(d.note_doctor || "") || eq?.note || "",
      curated_note: eq?.note || "",
      med_id: med?.id || "",
      source: eq ? "curated" : "ai",
    });
  }

  res.json({ language, speaker, listenerLang, raw: text, cleaned, translation, drugs, ms });
}));

/* ---------------------------------------------------------------- record context */

function recordIds(record) {
  const ids = new Set();
  for (const v of Object.values(record || {})) {
    if (Array.isArray(v)) for (const item of v) if (item && typeof item.id === "string") ids.add(item.id);
  }
  return ids;
}

app.post("/api/context", wrap(async (req, res) => {
  const text = str(req.body?.text, 2000).trim();
  const record = req.body?.record;
  if (!text || !record || typeof record !== "object") throw new HttpError(400, "text and record required");
  const doctorLang = code(req.body?.doctorLang, "en");
  const local = code(req.body?.local, "US").toUpperCase();
  const history = arr(req.body?.history, 6).map((h) => ({ speaker: str(h?.speaker, 20), text: str(h?.text, 600) }));
  const shown = arr(req.body?.shown, 40).map((s) => str(s, 60));
  const t0 = Date.now();
  const out = await chatJSON({
    name: "record_context",
    schema: CONTEXT_SCHEMA,
    system: contextPrompt({ doctorLang, local }),
    user: contextUser({ record, text, speaker: str(req.body?.speaker, 20), history, shown }),
    model: MODELS.context,
  });
  const ids = recordIds(record);
  const items = arr(out.items, 3).filter((i) => ids.has(i.id));
  res.json({ items, ms: Date.now() - t0 });
}));

/* ---------------------------------------------------------------- text to speech */

app.get("/api/tts", wrap(async (req, res) => {
  const text = str(req.query.text, 1200).trim();
  if (!text) throw new HttpError(400, "text missing");
  const lang = code(req.query.lang, "en");
  const voice = /^[a-z]{3,10}$/.test(String(req.query.voice || "")) ? String(req.query.voice) : "coral";
  const upstream = await speech(text, {
    voice,
    instructions: `Speak in ${langName(lang)} as a calm, warm professional medical interpreter. Clear and unhurried, natural native pronunciation, including medicine names.`,
  });
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  const reader = upstream.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}));

/* ---------------------------------------------------------------- medication equivalents */

const CACHE_FILE = path.join(ROOT, "data", "ai-equivalents.json");
let aiCache = {};
try {
  aiCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
} catch {
  aiCache = {};
}
function saveCache() {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(aiCache, null, 1));
  } catch (e) {
    console.warn("could not write equivalents cache:", e.message);
  }
}

app.post("/api/equivalents", wrap(async (req, res) => {
  const home = code(req.body?.home, "MX").toUpperCase();
  const local = code(req.body?.local, "US").toUpperCase();
  const items = arr(req.body?.items, 30).map((i) => ({ id: str(i?.id, 60), name: str(i?.name, 120), generic: str(i?.generic, 120) })).filter((i) => i.name);
  const out = new Array(items.length).fill(null);
  const missing = [];
  items.forEach((it, idx) => {
    const curated = findCurated(it.name) || findCurated(it.generic);
    const eq = curated && curatedEquivalent(curated, home, local);
    if (eq) out[idx] = { ...eq, id: it.id, input: it.name };
    else {
      const ck = `${home}>${local}:${norm(it.name)}`;
      if (aiCache[ck]) out[idx] = { ...aiCache[ck], id: it.id, input: it.name };
      else missing.push(idx);
    }
  });
  if (missing.length) {
    const ai = await chatJSON({
      name: "equivalents",
      schema: EQUIV_SCHEMA,
      system: equivPrompt({ home, local }),
      user: missing.map((idx) => `- ${items[idx].name}${items[idx].generic ? ` (generic: ${items[idx].generic})` : ""}`).join("\n"),
      model: MODELS.llm,
    });
    missing.forEach((idx, j) => {
      const a = ai.items?.[j];
      if (!a) return;
      const eq = {
        key: norm(a.generic || items[idx].name),
        generic: a.generic, drug_class: a.drug_class, home_name: a.home_name || items[idx].name, home_strength: "",
        local_name: a.status === "not_available_locally" ? "" : a.local_name, local_brands: a.local_brands, local_strength: a.local_strength,
        status: a.status, note: a.note, source: "ai",
      };
      aiCache[`${home}>${local}:${norm(items[idx].name)}`] = eq;
      out[idx] = { ...eq, id: items[idx].id, input: items[idx].name };
    });
    saveCache();
  }
  res.json({ items: out.filter(Boolean) });
}));

/* ---------------------------------------------------------------- record translation */

// The record is written in the patient's language; the doctor can read it in theirs. Cached per record + language.
const RECORD_CACHE_FILE = path.join(ROOT, "data", "record-translations.json");
let recordCache = {};
try {
  recordCache = JSON.parse(fs.readFileSync(RECORD_CACHE_FILE, "utf8"));
} catch {
  recordCache = {};
}

app.post("/api/translate-record", wrap(async (req, res) => {
  const record = req.body?.record;
  const to = code(req.body?.to, "en");
  if (!record || typeof record !== "object") throw new HttpError(400, "record required");
  const body = JSON.stringify(record).slice(0, 60_000);
  const ck = `${to}:${createHash("sha256").update(body).digest("hex").slice(0, 24)}`;
  if (recordCache[ck]) return res.json({ record: recordCache[ck], cached: true });
  const out = await chatJSONObject({
    system: `You translate a patient's health record into ${langName(to)} for a clinician. Return the SAME JSON structure with the same keys, arrays and item order. Translate every human-readable string value (names of conditions, allergies, reactions, notes, document titles and bodies, lab names, schedules, purposes, relationships) into clear clinical ${langName(to)}. Keep unchanged: "id" values, dates, numbers, units, reference ranges, flags, phone numbers, person names, facility names, and medicine brand names (you may add the ${langName(to)} generic name in parentheses). Do not add, drop or summarise information.`,
    user: body,
  });
  recordCache[ck] = out;
  try {
    fs.mkdirSync(path.dirname(RECORD_CACHE_FILE), { recursive: true });
    fs.writeFileSync(RECORD_CACHE_FILE, JSON.stringify(recordCache));
  } catch (e) {
    console.warn("could not write record cache:", e.message);
  }
  res.json({ record: out, cached: false });
}));

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

/* ---------------------------------------------------------------- app */

if (PROD) {
  const dist = path.join(ROOT, "dist");
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: { port: PORT + 1 }, allowedHosts: true /* tunnels (trycloudflare) and LAN IPs */ }, appType: "spa" });
  app.use(vite.middlewares);
}

function lanIPs() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
}

async function certificate() {
  const dir = path.join(ROOT, ".cert");
  const ips = lanIPs();
  const meta = path.join(dir, "ips.json");
  try {
    const cached = JSON.parse(fs.readFileSync(meta, "utf8"));
    if (ips.every((ip) => cached.includes(ip))) {
      return { key: fs.readFileSync(path.join(dir, "key.pem")), cert: fs.readFileSync(path.join(dir, "cert.pem")) };
    }
  } catch {}
  const selfsigned = (await import("selfsigned")).default;
  const pems = await selfsigned.generate([{ name: "commonName", value: "tessera-interpreter.local" }], {
    keySize: 2048,
    algorithm: "sha256",
    notAfterDate: new Date(Date.now() + 365 * 864e5),
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }, ...ips.map((ip) => ({ type: 7, ip }))] },
    ],
  });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "key.pem"), pems.private);
  fs.writeFileSync(path.join(dir, "cert.pem"), pems.cert);
  fs.writeFileSync(meta, JSON.stringify(ips));
  return { key: pems.private, cert: pems.cert };
}

http.createServer(app).listen(PORT, () => {
  console.log(`\nTessera Interpreter (${PROD ? "prod" : "dev"})`);
  console.log(`  this computer:  http://localhost:${PORT}`);
  console.log(`  models: stt=${MODELS.stt} llm=${MODELS.llm} context=${MODELS.context} tts=${MODELS.tts}`);
  if (!process.env.OPENAI_API_KEY) console.log("  WARNING: OPENAI_API_KEY is not set");
  if (ACCESS_CODE) console.log(`  locked: open any URL with ?code=${ACCESS_CODE} once per device`);
});
if (!process.argv.includes("--no-https")) {
  certificate()
    .then((tls) => {
      https.createServer(tls, app).listen(HTTPS_PORT, () => {
        for (const ip of lanIPs()) console.log(`  phone (same Wi-Fi, accept the certificate warning):  https://${ip}:${HTTPS_PORT}`);
      });
    })
    .catch((e) => console.warn("HTTPS disabled:", e.message));
}
