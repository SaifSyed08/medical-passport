// Thin fetch wrapper around the OpenAI endpoints the interpreter uses.
const BASE = "https://api.openai.com/v1";

export const MODELS = {
  // gpt-4.1(-mini) and gpt-4o(-mini)-transcribe shut down Jan/Feb 2027; these are OpenAI's replacements.
  stt: process.env.STT_MODEL || "gpt-transcribe",
  /** Live captions while someone is still talking: speed over accuracy; the final pass uses `stt`. */
  sttFast: process.env.STT_FAST_MODEL || "gpt-transcribe",
  /** Interpreting, record translation, medicine equivalents. Quality fallback: LLM_MODEL=gpt-6.1-terra. */
  llm: process.env.LLM_MODEL || "gpt-6-luna",
  context: process.env.CONTEXT_MODEL || "gpt-6-luna",
  // Shuts down Jan 6, 2027; its replacement (gpt-realtime-2.1-mini) is Realtime API only, not /audio/speech.
  tts: process.env.TTS_MODEL || "gpt-4o-mini-tts",
};

function key() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new HttpError(500, "OPENAI_API_KEY is not set on the server");
  return k;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function fail(res, what) {
  let detail = "";
  try {
    const j = await res.json();
    detail = j?.error?.message || JSON.stringify(j);
  } catch {
    detail = res.statusText;
  }
  throw new HttpError(502, `${what} failed (${res.status}): ${detail}`);
}

/** Speech to text. `audio` is a Buffer holding a WAV file. */
export async function transcribe(audio, { prompt, mime = "audio/wav", filename = "utterance.wav", model = MODELS.stt } = {}) {
  const fd = new FormData();
  const send = (withPrompt) => {
    const fd = new FormData();
    fd.append("file", new Blob([audio], { type: mime }), filename);
    fd.append("model", model);
    fd.append("response_format", "json");
    if (withPrompt) fd.append("prompt", prompt);
    return fetch(`${BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}` },
      body: fd,
      signal: AbortSignal.timeout(30_000),
    });
  };
  let res = await send(Boolean(prompt));
  // A model that doesn't take the priming prompt still has to produce captions.
  if (res.status === 400 && prompt) {
    const detail = await res.clone().text();
    if (/prompt/i.test(detail)) {
      console.warn(`[transcribe] ${model} rejected the prompt; retrying without it`);
      res = await send(false);
    }
  }
  if (!res.ok) await fail(res, "Transcription");
  const j = await res.json();
  return (j.text || "").trim();
}

// Token counts per call (never content), so cost per turn can be read off the server log.
function logUsage(name, model, u) {
  if (!u) return;
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const reasoning = u.completion_tokens_details?.reasoning_tokens ?? 0;
  console.log(`[usage] ${name} ${model} in=${u.prompt_tokens} cached=${cached} out=${u.completion_tokens} reasoning=${reasoning}`);
}

// Reasoning models (gpt-5/6, o-series) take reasoning_effort and reject temperature; older ones the reverse.
const tuning = (model, effort) => (/^(gpt-5|gpt-6|o\d)/.test(model) ? { reasoning_effort: effort } : { temperature: 0.1 });

/** Chat completion constrained to a strict JSON schema. Returns the parsed object. */
export async function chatJSON({ system, user, schema, name, model = MODELS.llm, effort = "low" }) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    ...tuning(model, effort),
  };
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) await fail(res, `${name} call`);
  const j = await res.json();
  logUsage(name, model, j.usage);
  const msg = j.choices?.[0]?.message;
  if (msg?.refusal) throw new HttpError(502, `${name} refused: ${msg.refusal}`);
  return JSON.parse(msg?.content || "{}");
}

/** Chat completion in plain JSON mode (no schema), for free-form shapes like a whole record. */
export async function chatJSONObject({ system, user, model = MODELS.llm, effort = "low" }) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      ...tuning(model, effort),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) await fail(res, "record translation");
  const j = await res.json();
  logUsage("translate_record", model, j.usage);
  return JSON.parse(j.choices?.[0]?.message?.content || "{}");
}

/** Text to speech. Returns the fetch Response so the caller can stream the body. */
export async function speech(text, { voice = "coral", instructions, format = "mp3" } = {}) {
  const body = { model: MODELS.tts, input: text, voice, response_format: format };
  if (instructions && MODELS.tts !== "tts-1" && MODELS.tts !== "tts-1-hd") body.instructions = instructions;
  const res = await fetch(`${BASE}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) await fail(res, "Speech");
  return res;
}
