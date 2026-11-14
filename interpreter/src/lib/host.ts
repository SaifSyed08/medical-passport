// Running inside the Tessera mobile app: the app's WebView sets window.__TESSERA__ before the page loads,
// carrying the signed-in traveler's own record, and posts { type: "tessera:persona" } when it changes.
import type { Persona } from "./types";

declare global {
  interface Window {
    __TESSERA__?: { persona?: Persona };
  }
}

const valid = (p: unknown): p is Persona =>
  Boolean(p && typeof p === "object" && typeof (p as Persona).id === "string" && Array.isArray((p as Persona).medications));

export const embedded = () => typeof window !== "undefined" && Boolean(window.__TESSERA__);

export function hostPersona(): Persona | null {
  const p = typeof window !== "undefined" ? window.__TESSERA__?.persona : undefined;
  return valid(p) ? p : null;
}

/** Calls `cb` whenever the app sends an updated record. Returns the unsubscribe. */
export function onHostPersona(cb: (p: Persona) => void) {
  const handler = (e: MessageEvent) => {
    let data = e.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (data?.type !== "tessera:persona" || !valid(data.persona)) return;
    window.__TESSERA__ = { ...window.__TESSERA__, persona: data.persona };
    cb(data.persona);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
