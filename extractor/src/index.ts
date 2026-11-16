// Document scan auto-fill: PaddleOCR reads the text (../ocr), plain rules find the findings (./rules). No AI API.
//
//   POST /extract                 {recordId}  reads the document and waits: { suggestions }
//   POST /extract/start           {recordId}  begins a background scan: { status: "done", suggestions } when the record's saved
//                                             text is reused, else { status: "reading", jobId }
//   GET  /extract/jobs/<id>?recordId=...      progress: { status: "reading", page, pages } or { status: "done", suggestions }
import type { Suggestion } from "../../shared/autofill";
import { parseFindings } from "./findings";
import { jobStatus as defaultJobStatus, readText as defaultReadText, startJob as defaultStartJob, type JobStatus } from "./ocr";
import { findFindings } from "./rules";

type Env = { MAIN_API_URL: string; OCR_URL: string };
type Deps = {
  fetch?: typeof fetch;
  readText?: (contentType: string, bytes: Uint8Array) => Promise<string>;
  startJob?: (contentType: string, bytes: Uint8Array, owner: string) => Promise<string>;
  jobStatus?: (jobId: string, owner: string) => Promise<JobStatus | null>;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "600",
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...CORS } });
const fail = (status: number, error: string, code: string) => json({ error, code }, status);

const TYPES = ["application/pdf", "image/jpeg", "image/png"];
const LIMIT = 10;
const WINDOW_MS = 3600_000;
// shortcut: per-isolate memory, not shared across instances; upgrade to the Workers rate-limit binding if abuse appears
const calls = new Map<string, number[]>();

/** SHA-256 of the bearer token: the rate-limit key, and the owner id the OCR server ties a job to. */
async function digest(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function limited(token: string) {
  const key = await digest(token);
  const now = Date.now();
  const recent = (calls.get(key) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    calls.set(key, recent);
    return true;
  }
  calls.set(key, [...recent, now]);
  return false;
}

const recordUrl = (env: Env, recordId: string) => `${env.MAIN_API_URL.replace(/\/$/, "")}/api/v1/records/${encodeURIComponent(recordId)}`;

/** The main API's own error, passed on to the app unchanged. */
async function relay(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  const fallback = res.status === 401 ? "unauthorized" : res.status === 403 ? "forbidden" : "not_found";
  return fail(res.status, body.error ?? "Not found.", body.code ?? fallback);
}

/** The document's bytes and type from the main API (this also logs the read), or the error response to send. */
async function loadFile(doFetch: typeof fetch, url: string, token: string): Promise<{ contentType: string; bytes: Uint8Array } | Response> {
  let file: Response;
  try {
    file = await doFetch(`${url}/file?purpose=autofill`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return fail(502, "Could not load the document.", "file_error");
  }
  if (file.status === 401 || file.status === 404) return relay(file);
  if (!file.ok) return fail(502, "Could not load the document.", "file_error");
  const contentType = (file.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!TYPES.includes(contentType)) return fail(415, "Only PDF, JPEG and PNG documents can be scanned.", "unsupported_type");
  return { contentType, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** Keep the text on the record so a re-run can reuse it and the interpreter can match against it. Best effort. */
async function saveText(doFetch: typeof fetch, url: string, token: string, text: string) {
  if (!text.trim()) return;
  await doFetch(`${url}/text`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 20000) }),
  }).catch(() => undefined);
}

/** The text saved on the record by an earlier scan, null when there is none, or an error response to send. */
async function savedText(doFetch: typeof fetch, url: string, token: string): Promise<string | null | Response> {
  let res: Response;
  try {
    res = await doFetch(`${url}/text`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return null;
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) return relay(res);
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { text?: unknown };
  return typeof data.text === "string" && data.text.trim() ? data.text : null;
}

const suggestionsFrom = (text: string): Suggestion[] => parseFindings(findFindings(text));

export async function handle(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const doFetch = deps.fetch ?? fetch;
  const read = deps.readText ?? ((type: string, bytes: Uint8Array) => defaultReadText(env.OCR_URL, type, bytes, doFetch));
  const start = deps.startJob ?? ((type: string, bytes: Uint8Array, owner: string) => defaultStartJob(env.OCR_URL, type, bytes, owner, doFetch));
  const status = deps.jobStatus ?? ((jobId: string, owner: string) => defaultJobStatus(env.OCR_URL, jobId, owner, doFetch));
  const { pathname, searchParams } = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const jobMatch = /^\/extract\/jobs\/([0-9a-f]{32})$/.exec(pathname);
  const route = pathname === "/extract" ? "sync" : pathname === "/extract/start" ? "start" : jobMatch ? "job" : null;
  if (!route) return fail(404, "Not found.", "not_found");
  if (request.method !== (route === "job" ? "GET" : "POST")) return fail(405, route === "job" ? "Use GET." : "Use POST.", "method_not_allowed");

  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return fail(401, "Please sign in again.", "unauthorized");

  // Checking on a running scan is cheap and happens every second or so; only starting one counts against the limit.
  if (route !== "job" && (await limited(token))) return fail(429, "Too many scans. Try again later.", "rate_limited");

  const recordId =
    route === "job"
      ? searchParams.get("recordId")
      : await request.json().then((b: unknown) => (b as { recordId?: unknown } | null)?.recordId, () => undefined);
  if (typeof recordId !== "string" || !recordId) return fail(400, "recordId is required.", "bad_request");
  const url = recordUrl(env, recordId);

  if (route === "job") {
    let job: JobStatus | null;
    try {
      job = await status(jobMatch![1], await digest(token));
    } catch {
      return fail(502, "The scan failed. Please try again.", "ocr_error");
    }
    if (!job) return fail(404, "Scan not found.", "not_found");
    if (job.status === "error") return fail(502, "The scan failed. Please try again.", "ocr_error");
    if (job.status === "reading") return json({ status: "reading", page: job.page, pages: job.pages });
    await saveText(doFetch, url, token, job.text);
    return json({ status: "done", page: job.page, pages: job.pages, suggestions: suggestionsFrom(job.text) });
  }

  if (route === "start") {
    // A document scanned before: reuse its saved text and skip reading the file again.
    const saved = await savedText(doFetch, url, token);
    if (saved instanceof Response) return saved;
    if (saved) return json({ status: "done", page: 0, pages: 0, suggestions: suggestionsFrom(saved) });
    const file = await loadFile(doFetch, url, token);
    if (file instanceof Response) return file;
    try {
      return json({ status: "reading", page: 0, pages: 0, jobId: await start(file.contentType, file.bytes, await digest(token)) });
    } catch {
      return fail(502, "The scan failed. Please try again.", "ocr_error");
    }
  }

  const file = await loadFile(doFetch, url, token);
  if (file instanceof Response) return file;
  let text: string;
  try {
    text = await read(file.contentType, file.bytes);
  } catch {
    return fail(502, "The scan failed. Please try again.", "ocr_error");
  }
  await saveText(doFetch, url, token, text);
  return json({ suggestions: suggestionsFrom(text) });
}

const worker = { fetch: (r: Request, e: Env) => handle(r, e) };
export default worker;
