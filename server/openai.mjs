// Thin fetch wrapper around the OpenAI endpoints the interpreter uses.
const BASE = "https://api.openai.com/v1";

export const MODELS = {
  stt: process.env.STT_MODEL || "gpt-4o-transcribe",
  /** Live captions while someone is still talking: speed over accuracy; the final pass uses `stt`. */
  sttFast: process.env.STT_FAST_MODEL || "gpt-4o-mini-transcribe",
  llm: process.env.LLM_MODEL || "gpt-4.1",
  context: process.env.CONTEXT_MODEL || "gpt-4.1-mini",
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
  fd.append("file", new Blob([audio], { type: mime }), filename);
  fd.append("model", model);
  fd.append("response_format", "json");
  if (prompt) fd.append("prompt", prompt);
  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: fd,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) await fail(res, "Transcription");
  const j = await res.json();
  return (j.text || "").trim();
}

/** Chat completion constrained to a strict JSON schema. Returns the parsed object. */
export async function chatJSON({ system, user, schema, name, model = MODELS.llm, effort = "low" }) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
  };
  if (/^(gpt-5|gpt-6|o\d)/.test(model)) body.reasoning_effort = effort;
  else body.temperature = 0.1;
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) await fail(res, `${name} call`);
  const j = await res.json();
  const msg = j.choices?.[0]?.message;
  if (msg?.refusal) throw new HttpError(502, `${name} refused: ${msg.refusal}`);
  return JSON.parse(msg?.content || "{}");
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
