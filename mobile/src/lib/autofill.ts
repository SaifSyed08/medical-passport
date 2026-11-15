// Document scan auto-fill: the opt-in preference and calls to the extractor Worker.
import type { Suggestion } from "@shared/autofill";
import { api, ApiError, authHeader, signalUnauthorized } from "./api";
import { ask } from "./confirm";
import type { Strings } from "./i18n";
import { storage } from "./storage";

/** Empty means the feature is off: no opt-in prompt and no review entry points. */
export const EXTRACTOR_URL = (process.env.EXPO_PUBLIC_EXTRACTOR_URL ?? "").replace(/\/$/, "");

export const PREF_KEY = "autofill.pref";

export async function getAutofillPref(): Promise<"on" | "off" | null> {
  const v = await storage.get(PREF_KEY).catch(() => null);
  return v === "on" || v === "off" ? v : null;
}
export const setAutofillPref = (v: "on" | "off"): Promise<void> => storage.set(PREF_KEY, v);

/** Asks once (when the pref is unset) whether documents may be read; true when opted in. */
export async function ensureAutofillOptIn(t: Strings): Promise<boolean> {
  if (!EXTRACTOR_URL) return false;
  let pref = await getAutofillPref();
  if (pref === null) {
    pref = (await ask(t.autofillAskTitle, t.autofillAsk, t.autofillYes, t.autofillNo)) ? "on" : "off";
    await setAutofillPref(pref).catch(() => {});
  }
  return pref === "on";
}

type ScanReply = { status?: "reading" | "done"; page?: number; pages?: number; jobId?: string; suggestions?: Suggestion[]; error?: string; code?: string };

/** One quick call to the extractor. A scan itself runs in the background, so no call waits for the OCR. */
async function extractor(path: string, body?: unknown): Promise<ScanReply> {
  if (!EXTRACTOR_URL) throw new ApiError(0, "Extractor URL not configured", "config");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(`${EXTRACTOR_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: { ...authHeader(), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // A timeout (abort) or no network: both are retryable.
    throw new ApiError(0, "Network unavailable", "offline");
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as ScanReply;
  if (!res.ok) {
    if (res.status === 401) signalUnauthorized();
    throw new ApiError(res.status, data.error ?? "Request failed", data.code);
  }
  return data;
}

/** Starts reading a document: a job to poll, or the suggestions at once when the record's saved text is reused. */
export async function startScan(recordId: string): Promise<{ jobId: string } | { suggestions: Suggestion[] }> {
  const r = await extractor("/extract/start", { recordId });
  if (r.status === "done") return { suggestions: r.suggestions ?? [] };
  if (!r.jobId) throw new ApiError(0, "Unexpected reply", "bad_reply");
  return { jobId: r.jobId };
}

/** How far a scan has got: the page being read, or the finished suggestions. */
export async function pollScan(recordId: string, jobId: string): Promise<{ status: "reading"; page: number; pages: number } | { status: "done"; suggestions: Suggestion[] }> {
  const r = await extractor(`/extract/jobs/${jobId}?recordId=${encodeURIComponent(recordId)}`);
  return r.status === "done" ? { status: "done", suggestions: r.suggestions ?? [] } : { status: "reading", page: r.page ?? 0, pages: r.pages ?? 0 };
}

export const reportAccepted = (recordId: string, count: number): Promise<void> =>
  api<void>(`/records/${recordId}/accepted`, { body: { count } });
