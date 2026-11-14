// Document scan auto-fill: PaddleOCR reads the text (../ocr), plain rules find the findings (./rules). No AI API.
import type { Suggestion } from "../../shared/autofill";
import { parseFindings } from "./findings";
import { readText as defaultReadText } from "./ocr";
import { findFindings } from "./rules";

type Env = { MAIN_API_URL: string; OCR_URL: string };
type Deps = { fetch?: typeof fetch; readText?: (contentType: string, bytes: Uint8Array) => Promise<string> };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function limited(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const key = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const recent = (calls.get(key) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    calls.set(key, recent);
    return true;
  }
  calls.set(key, [...recent, now]);
  return false;
}

export async function handle(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const doFetch = deps.fetch ?? fetch;
  const read = deps.readText ?? ((type: string, bytes: Uint8Array) => defaultReadText(env.OCR_URL, type, bytes, doFetch));
  const { pathname } = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (pathname !== "/extract") return fail(404, "Not found.", "not_found");
  if (request.method !== "POST") return fail(405, "Use POST.", "method_not_allowed");

  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return fail(401, "Please sign in again.", "unauthorized");
  if (await limited(token)) return fail(429, "Too many scans. Try again later.", "rate_limited");

  const recordId = await request.json().then((b: unknown) => (b as { recordId?: unknown } | null)?.recordId, () => undefined);
  if (typeof recordId !== "string" || !recordId) return fail(400, "recordId is required.", "bad_request");

  const recordUrl = `${env.MAIN_API_URL.replace(/\/$/, "")}/api/v1/records/${encodeURIComponent(recordId)}`;
  const url = `${recordUrl}/file?purpose=autofill`;
  let file: Response;
  try {
    file = await doFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return fail(502, "Could not load the document.", "file_error");
  }
  if (file.status === 401 || file.status === 404) {
    const body = (await file.json().catch(() => ({}))) as { error?: string; code?: string };
    return fail(file.status, body.error ?? "Not found.", body.code ?? (file.status === 401 ? "unauthorized" : "not_found"));
  }
  if (!file.ok) return fail(502, "Could not load the document.", "file_error");

  const contentType = (file.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!TYPES.includes(contentType)) return fail(415, "Only PDF, JPEG and PNG documents can be scanned.", "unsupported_type");

  let text: string;
  try {
    text = await read(contentType, new Uint8Array(await file.arrayBuffer()));
  } catch {
    return fail(502, "The scan failed. Please try again.", "ocr_error");
  }
  const suggestions: Suggestion[] = parseFindings(findFindings(text));
  // Keep the text on the record so the interpreter can match against what the document says. Best effort:
  // the suggestions are still useful if saving fails.
  if (text.trim()) {
    await doFetch(`${recordUrl}/text`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 20000) }),
    }).catch(() => undefined);
  }
  return json({ suggestions });
}

const worker = { fetch: (r: Request, e: Env) => handle(r, e) };
export default worker;
