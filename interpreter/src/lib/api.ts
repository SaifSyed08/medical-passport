import type { DrugMention, Equivalent, Speaker } from "./types";

/** Every call gives up after a while: a request that hangs on a weak connection must not freeze the conversation. */
async function post<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  } catch (e) {
    throw new Error(abort.signal.aborted ? "The connection is too slow right now." : (e as Error)?.message === "Failed to fetch" || (e as Error)?.name === "TypeError" ? "Can't reach the interpreter. Check the connection." : (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) throw new Error((data as { error?: string })?.error || `${path} failed (${res.status})`);
  return data as T;
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export type Pair = { patientLang: string; doctorLang: string; home: string; local: string };

export async function transcribe(wav: Blob, pair: Pair, terms: string[], opts: { fast?: boolean } = {}) {
  return post<{ text: string; ms?: number; dropped?: string }>("/api/transcribe", {
    audio: await blobToBase64(wav),
    mime: wav.type || "audio/wav",
    patientLang: pair.patientLang,
    doctorLang: pair.doctorLang,
    terms,
    fast: Boolean(opts.fast),
  }, opts.fast ? 8000 : 25000);
}

export type InterpretResult = {
  /** Filler-only fragment: nothing to show or say. */
  empty?: boolean;
  language: string;
  speaker: Speaker;
  listenerLang: string;
  raw: string;
  cleaned: string;
  translation: string;
  drugs: DrugMention[];
  ms: number;
};

export function interpret(body: Pair & {
  text: string;
  forced: Speaker | null;
  meds: { id: string; name: string; generic: string; dose: string; schedule: string }[];
  equivalents: Equivalent[];
  history: { speaker: string; text: string }[];
}) {
  return post<InterpretResult>("/api/interpret", body);
}

export type ContextResult = { items: { id: string; level: "alert" | "relevant"; title: string; detail: string; why: string }[]; ms: number };

export function context(body: {
  text: string;
  speaker: string;
  record: unknown;
  doctorLang: string;
  local: string;
  history: { speaker: string; text: string }[];
  shown: string[];
}) {
  return post<ContextResult>("/api/context", body);
}

export function equivalents(body: { home: string; local: string; items: { id: string; name: string; generic: string }[] }) {
  return post<{ items: Equivalent[] }>("/api/equivalents", body);
}

export function translateRecord<T>(record: T, to: string) {
  return post<{ record: T; cached: boolean }>("/api/translate-record", { record, to });
}

export async function health() {
  const r = await fetch("/api/health");
  return (await r.json()) as { ok: boolean; key: boolean; locked?: boolean; models: Record<string, string> };
}
