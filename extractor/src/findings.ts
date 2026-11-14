import { BLOOD_TYPES } from "../../shared/tessera";
import type { Suggestion, SuggestionKind } from "../../shared/autofill";

// field -> max length; the first field of each kind is required.
const SPEC: Record<SuggestionKind, Record<string, number>> = {
  condition: { name: 160, note: 400 },
  allergy: { substance: 160, reaction: 240 },
  medication: { generic: 160, brand: 120, dose: 160, schedule: 160, purpose: 200 },
  bloodType: { value: 8 },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Never throws: anything malformed is dropped. */
export function parseFindings(raw: unknown): Suggestion[] {
  const list = isObj(raw) && Array.isArray(raw.findings) ? raw.findings : [];
  const out: Suggestion[] = [];
  for (const item of list) {
    if (!isObj(item) || typeof item.kind !== "string" || !Object.hasOwn(SPEC, item.kind) || !isObj(item.fields)) continue;
    const kind = item.kind as SuggestionKind;
    const src = item.fields;
    const fields: Record<string, string> = {};
    let ok = true;
    for (const [k, max] of Object.entries(SPEC[kind])) {
      const v = src[k];
      if (v === undefined || v === null) continue;
      if (typeof v !== "string") { ok = false; break; }
      fields[k] = v.trim().slice(0, max);
    }
    const required = Object.keys(SPEC[kind])[0];
    if (!ok || !fields[required]) continue;
    if (kind === "bloodType" && (fields.value === "Unknown" || !(BLOOD_TYPES as readonly string[]).includes(fields.value))) continue;
    if (kind === "allergy") fields.severity = ["severe", "moderate", "mild"].includes(src.severity as string) ? (src.severity as string) : "moderate";
    const quote = typeof item.quote === "string" ? item.quote.trim().slice(0, 200) : "";
    const c = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? item.confidence : 0;
    out.push({ id: `sg_${out.length + 1}`, kind, fields, quote, confidence: Math.min(1, Math.max(0, c)) });
  }
  return out;
}
