// Merging newly returned record items into what the clinician already sees, and picking which alert to flash.
import type { ContextItem } from "./types";

type Incoming = { id: string; level: "alert" | "relevant"; title: string; detail: string; why: string };

const stems = (s: string) => (s.toLowerCase().match(/[\p{L}]{5,}/gu) || []).map((w) => w.slice(0, 6));

export function mergeContext(cur: ContextItem[], items: Incoming[], turnId: string, now: number, said = "") {
  const fresh = items.map((i, n) => {
    const prev = cur.find((c) => c.id === i.id);
    // An alert stays an alert, with its alert wording, if a later mention only calls it "relevant".
    if (prev?.level === "alert" && i.level !== "alert") return { ...prev, turnId, at: now - n };
    return { ...i, level: prev?.level === "alert" ? "alert" : i.level, turnId, at: now - n } as ContextItem;
  });
  // Flash a brand-new alert; failing that, an existing alert the latest sentence triggers again for a new reason
  // (CKD first for contrast, then again for ibuprofen): its "why" changed and mentions something just said.
  const said6 = new Set(stems(said));
  const newAlert =
    fresh.find((f) => f.level === "alert" && cur.find((c) => c.id === f.id)?.level !== "alert") ||
    fresh.find((f) => {
      const prev = cur.find((c) => c.id === f.id);
      return f.level === "alert" && prev?.level === "alert" && prev.why !== f.why && stems(f.why).some((w) => said6.has(w));
    }) ||
    null;
  const ids = new Set(fresh.map((f) => f.id));
  return { next: [...fresh, ...cur.filter((c) => !ids.has(c.id))], flash: newAlert };
}
