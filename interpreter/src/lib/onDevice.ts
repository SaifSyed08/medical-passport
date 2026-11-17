// Private mode (press P): the patient's voice, words and record are handled by small models on this device
// instead of the cloud. Every request then carries X-On-Device, and the server answers it locally
// (server/local.mjs) without ever falling back to OpenAI. Remembered on this phone.
import { useSyncExternalStore } from "react";

const KEY = "ti.onDevice";
let on = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();
const subs = new Set<() => void>();

export const onDevice = () => on;

export function setOnDevice(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  subs.forEach((f) => f());
}

export function useOnDevice() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => on,
  );
}

export const deviceHeaders = (): Record<string, string> => (on ? { "X-On-Device": "1" } : {});

export type LocalStatus = { ready: boolean; mt?: boolean; device?: string; voices: Record<string, boolean>; models: Record<string, string> };

/** Loads the local models for this pair of languages, so the first line isn't slow. */
export async function warmLocal(langs: string[]): Promise<LocalStatus | null> {
  try {
    const r = await fetch(`/api/local?warm=1&langs=${encodeURIComponent(langs.join(","))}`);
    return r.ok ? ((await r.json()) as LocalStatus) : null;
  } catch {
    return null;
  }
}
