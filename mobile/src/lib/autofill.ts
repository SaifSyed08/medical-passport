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

export async function requestSuggestions(recordId: string): Promise<Suggestion[]> {
  if (!EXTRACTOR_URL) throw new ApiError(0, "Extractor URL not configured", "config");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let res: Response;
  try {
    res = await fetch(`${EXTRACTOR_URL}/extract`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ recordId }),
      signal: controller.signal,
    });
  } catch {
    // A timeout (abort) or no network: both are retryable.
    throw new ApiError(0, "Network unavailable", "offline");
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as { suggestions?: Suggestion[]; error?: string; code?: string };
  if (!res.ok) {
    if (res.status === 401) signalUnauthorized();
    throw new ApiError(res.status, data.error ?? "Request failed", data.code);
  }
  return data.suggestions ?? [];
}

export const reportAccepted = (recordId: string, count: number): Promise<void> =>
  api<void>(`/records/${recordId}/accepted`, { body: { count } });
