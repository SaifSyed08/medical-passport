import type { Suggestion } from "../../shared/autofill";
import { callModel as defaultCallModel } from "./anthropic";
import { parseFindings } from "./findings";

type Env = { ANTHROPIC_API_KEY: string; MAIN_API_URL: string; MODEL?: string };
type Deps = { fetch?: typeof fetch; callModel?: typeof defaultCallModel };

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
  const model = deps.callModel ?? defaultCallModel;
  const { pathname } = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (pathname !== "/extract") return fail(404, "Not found.", "not_found");
  if (request.method !== "POST") return fail(405, "Use POST.", "method_not_allowed");

  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return fail(401, "Please sign in again.", "unauthorized");
  if (await limited(token)) return fail(429, "Too many scans. Try again later.", "rate_limited");

  const recordId = await request.json().then((b: unknown) => (b as { recordId?: unknown } | null)?.recordId, () => undefined);
  if (typeof recordId !== "string" || !recordId) return fail(400, "recordId is required.", "bad_request");

  const url = `${env.MAIN_API_URL.replace(/\/$/, "")}/api/v1/records/${encodeURIComponent(recordId)}/file?purpose=autofill`;
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

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const raw = await model(env.ANTHROPIC_API_KEY, env.MODEL || "claude-sonnet-5-5", contentType, bytes);
    const suggestions: Suggestion[] = parseFindings(raw);
    return json({ suggestions });
  } catch {
    return fail(502, "The scan failed. Please try again.", "model_error");
  }
}

const worker = { fetch: (r: Request, e: Env) => handle(r, e) };
export default worker;
