// Merging newly returned record items into what the clinician already sees, and picking which alert to flash.
import type { ContextItem } from "./types";

type Incoming = { id: string; level: "alert" | "relevant"; title: string; detail: string; why: string };

// Words too common in clinical "why" lines and small talk to count as a match on their own.
const COMMON = new Set(
  "doctor docto patien severe medica medici please thank thanks today feelin really should could would because pain painf allerg recent histor record clinic before taking taken".split(" "),
);

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;

/** Meaningful word stems: Latin words of 5+ letters (first 6), CJK words of 2+ characters (as is). */
export function stems(s: string): Set<string> {
  const out = new Set<string>();
  const words = segmenter ? [...segmenter.segment(s.toLowerCase())].filter((w) => w.isWordLike).map((w) => w.segment) : s.toLowerCase().split(/[^\p{L}]+/u);
  for (const w of words) {
    // Mixed runs like "proairを" split into their Latin and CJK parts.
    for (const part of w.match(/[a-zà-ɏ]+|[぀-ヿ㐀-鿿가-힯]+/g) || []) {
      const latin = /^[a-zà-ɏ]+$/.test(part);
      if (latin ? part.length < 5 : part.length < 2) continue;
      const stem = latin ? part.slice(0, 6) : part;
      if (!COMMON.has(stem)) out.add(stem);
    }
  }
  return out;
}

export function mergeContext(cur: ContextItem[], items: Incoming[], turnId: string, now: number, said = "") {
  const fresh = items.map((i, n) => {
    const prev = cur.find((c) => c.id === i.id);
    // An alert stays an alert, with its alert wording, if a later mention only calls it "relevant".
    if (prev?.level === "alert" && i.level !== "alert") return { ...prev, turnId, at: now - n };
    return { ...i, level: prev?.level === "alert" ? "alert" : i.level, turnId, at: now - n } as ContextItem;
  });
  // Flash a brand-new alert; failing that, the existing alert the latest sentence triggers again for a NEW reason
  // (CKD first for contrast, then again for ibuprofen): words that are new in its "why" and were just said.
  const saidStems = stems(said);
  let best: { item: ContextItem; score: number } | null = null;
  for (const f of fresh) {
    const prev = cur.find((c) => c.id === f.id);
    if (f.level !== "alert" || prev?.level !== "alert" || prev.why === f.why) continue;
    const old = stems(prev.why);
    const score = [...stems(f.why)].filter((w) => !old.has(w) && saidStems.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { item: f, score };
  }
  const newAlert = fresh.find((f) => f.level === "alert" && cur.find((c) => c.id === f.id)?.level !== "alert") || best?.item || null;
  const ids = new Set(fresh.map((f) => f.id));
  return { next: [...fresh, ...cur.filter((c) => !ids.has(c.id))], flash: newAlert };
}
