// Private mode: the calls openai.mjs makes, answered on this machine by phone-sized models in a Python sidecar
// (server/local/sidecar.py): Whisper small for speech, NLLB-200 600M for translation, Piper for voices, all
// int8 or smaller. Nothing in here opens a connection beyond 127.0.0.1. Setup: npm run local:setup.
// Ollama is optional: only LOCAL_TRANSLATOR=llm uses it (a bigger model, for comparison).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "./openai.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OLLAMA = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
const SIDECAR_PORT = Number(process.env.SIDECAR_PORT || 5182);
const SIDECAR = `http://127.0.0.1:${SIDECAR_PORT}`;

export const LOCAL_MODELS = {
  stt: `whisper-${process.env.LOCAL_STT_MODEL || "small"} int8`,
  mt: "nllb-200-distilled-600M int8",
  tts: "piper (medium voices)",
  context: "rules (server/rules.mjs)",
  translator: process.env.LOCAL_TRANSLATOR === "llm" ? `ollama ${process.env.LOCAL_LLM_MODEL || "gemma3:4b"}` : "nllb",
  llm: process.env.LOCAL_LLM_MODEL || "gemma3:4b",
};

/* ---------------------------------------------------------------- sidecar */

let child = null;
let starting = null;

async function sidecarUp() {
  try {
    const r = await fetch(`${SIDECAR}/health`, { signal: AbortSignal.timeout(800) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Starts the sidecar if it isn't running (it may also have been started by hand). */
export function ensureSidecar() {
  if (starting) return starting;
  starting = (async () => {
    if (await sidecarUp()) return;
    const py = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
    child = spawn(py, [path.join(HERE, "local", "sidecar.py"), String(SIDECAR_PORT)], {
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
    });
    child.on("exit", () => {
      child = null;
      starting = null;
    });
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (await sidecarUp()) return;
      if (!child) break;
    }
    starting = null;
    throw new HttpError(503, "Private mode: the local speech service didn't start. Run npm run local:setup.");
  })();
  starting.catch(() => {});
  return starting;
}

process.on("exit", () => child?.kill());

async function sidecar(route, body, timeout = 60_000) {
  await ensureSidecar();
  const r = await fetch(SIDECAR + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) {
    let msg = r.statusText;
    try {
      msg = (await r.json()).error || msg;
    } catch {
      /* not json */
    }
    throw new HttpError(r.status === 404 ? 404 : 502, `Local ${route.slice(1)} failed: ${msg}`);
  }
  return r;
}

/** Speech to text on this machine. `langs` are the two languages in the room. */
export async function transcribeLocal(audio, { langs, terms, fast }) {
  const r = await sidecar("/stt", { audio: audio.toString("base64"), langs, terms, fast });
  const j = await r.json();
  return (j.text || "").trim();
}

/** Machine translation on this machine. `texts` is a batch; returns {texts}. */
export async function translateLocal(texts, from, to) {
  const r = await sidecar("/mt", { texts, from, to });
  return r.json();
}

/** Text to speech on this machine. Returns a WAV Buffer. */
export async function speechLocal(text, lang) {
  const r = await sidecar("/tts", { text, lang }, 30_000);
  return Buffer.from(await r.arrayBuffer());
}

/* ---------------------------------------------------------------- Ollama */

async function ollamaChat({ system, user, format }) {
  let r;
  try {
    r = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LOCAL_MODELS.llm,
        stream: false,
        format,
        keep_alive: "30m",
        options: { temperature: 0.1 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new HttpError(503, `Private mode: Ollama isn't reachable at ${OLLAMA} (${e.message}). Start Ollama.`);
  }
  if (!r.ok) throw new HttpError(502, `Local model failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  try {
    return JSON.parse(j.message?.content || "{}");
  } catch {
    throw new HttpError(502, "Local model returned malformed JSON");
  }
}

/** Same contract as openai.chatJSON: the reply follows `schema`. */
export function chatJSONLocal({ system, user, schema }) {
  return ollamaChat({ system, user, format: schema });
}

export function chatJSONObjectLocal({ system, user }) {
  return ollamaChat({ system, user, format: "json" });
}

/* ---------------------------------------------------------------- status */

export async function localStatus({ warm = false, langs = [] } = {}) {
  const useLLM = process.env.LOCAL_TRANSLATOR === "llm";
  const out = { ollama: false, model: false, speech: false, voices: {}, models: LOCAL_MODELS };
  if (useLLM) try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    out.ollama = true;
    out.model = (j.models || []).some((m) => m.name === LOCAL_MODELS.llm || m.model === LOCAL_MODELS.llm);
  } catch {
    /* not running */
  }
  if (warm) {
    // Load everything now so the first line isn't slow: Whisper + voices in the sidecar, the LLM in Ollama.
    const jobs = [ensureSidecar().then(() => fetch(`${SIDECAR}/warm`, { method: "POST", body: JSON.stringify({ langs }), signal: AbortSignal.timeout(180_000) }))];
    if (useLLM && out.model) jobs.push(fetch(`${OLLAMA}/api/generate`, { method: "POST", body: JSON.stringify({ model: LOCAL_MODELS.llm, keep_alive: "30m" }) }));
    await Promise.allSettled(jobs);
  }
  const s = await sidecarUp();
  if (s) {
    out.speech = s.loaded || !warm;
    out.device = s.device;
    out.voices = s.voices;
    out.mt = s.mt;
  }
  out.ready = Boolean(s?.mt) && (!useLLM || (out.ollama && out.model));
  return out;
}

/* ---------------------------------------------------------------- record translation */

// The fields a clinician reads as prose. Ids, dates, numbers, units, names of people and places, medicine
// names and doses stay as written.
const PROSE = new Set(["substance", "reaction", "purpose", "schedule", "note", "title", "body", "relationship"]);
const NAMED = new Set(["conditions", "labs"]);

/** The record in the clinician's language, translated field by field on this machine. Same shape back. */
export async function translateRecordLocal(record, from, to) {
  const jobs = [];
  const copy = JSON.parse(JSON.stringify(record));
  for (const [section, items] of Object.entries(copy)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      for (const [k, v] of Object.entries(item || {})) {
        if (typeof v !== "string" || !/\p{L}/u.test(v)) continue;
        if (PROSE.has(k) || (k === "name" && NAMED.has(section))) jobs.push({ item, k, v });
      }
    }
  }
  // Documents' bodies run to paragraphs: translate them a sentence at a time.
  const parts = jobs.map((j) => j.v.split(/(?<=[.!?।。])\s+|\n+/u).filter(Boolean));
  const flat = parts.flat();
  const out = [];
  for (let i = 0; i < flat.length; i += 48) out.push(...(await translateLocal(flat.slice(i, i + 48), from, to)).texts);
  let at = 0;
  jobs.forEach((j, n) => {
    const k = parts[n].length;
    j.item[j.k] = out.slice(at, at + k).join(to === "ja" || to === "zh" ? "" : " ");
    at += k;
  });
  return copy;
}
