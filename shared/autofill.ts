// Suggestion types and merge logic for document scan auto-fill.
// Shared by the extractor Worker and the Expo app: import only from ./tessera, no other dependencies.
import { BLOOD_TYPES, type Allergy, type BloodType, type Condition, type Medication, type Profile, type Severity } from "./tessera";

export type SuggestionKind = "condition" | "allergy" | "medication" | "bloodType";
export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  /** condition: name, note. allergy: substance, reaction, severity. medication: generic, brand, dose, schedule, purpose. bloodType: value. */
  fields: Record<string, string>;
  quote: string;
  confidence: number;
};
export type ReviewState = "pending" | "checked" | "removed";

const norm = (v: string | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const f = (s: Suggestion, k: string, max: number) => (s.fields[k] ?? "").trim().slice(0, max);

export function classify(profile: Profile, s: Suggestion): "new" | "duplicate" | "replaces" {
  if (s.kind === "bloodType") {
    const v = s.fields.value;
    if (v === profile.bloodType) return "duplicate";
    return profile.bloodType === "Unknown" ? "new" : "replaces";
  }
  const [list, key] =
    s.kind === "condition" ? [profile.conditions, "name"] : s.kind === "allergy" ? [profile.allergies, "substance"] : [profile.medications, "generic"];
  const want = norm(s.fields[key]);
  return (list as unknown as Record<string, string>[]).some(i => norm(i[key]) === want) ? "duplicate" : "new";
}

export const initialState = (profile: Profile, s: Suggestion): ReviewState => (classify(profile, s) === "duplicate" ? "removed" : "pending");

export const readyToAdd = (states: ReviewState[]): boolean => states.includes("checked") && !states.includes("pending");

export function mergeAccepted(profile: Profile, accepted: Suggestion[], recordId: string, newId: (prefix: string) => string): Profile {
  const out: Profile = { ...profile, allergies: [...profile.allergies], medications: [...profile.medications], conditions: [...profile.conditions] };
  for (const s of accepted) {
    if (classify(out, s) === "duplicate") continue;
    const sourceRecordId = recordId;
    if (s.kind === "bloodType") {
      if ((BLOOD_TYPES as readonly string[]).includes(s.fields.value)) out.bloodType = s.fields.value as BloodType;
    } else if (s.kind === "condition") {
      const note = [f(s, "note", 400), s.quote.trim() && `“${s.quote.trim()}”`].filter(Boolean).join(" — ").slice(0, 400);
      const c: Condition = { id: newId("cnd"), name: f(s, "name", 160), note, sourceRecordId };
      out.conditions.push(c);
    } else if (s.kind === "allergy") {
      const sev = s.fields.severity as Severity;
      const a: Allergy = {
        id: newId("alg"), substance: f(s, "substance", 160), reaction: f(s, "reaction", 240),
        severity: ["severe", "moderate", "mild"].includes(sev) ? sev : "moderate", sourceRecordId,
      };
      out.allergies.push(a);
    } else {
      const m: Medication = {
        id: newId("med"), generic: f(s, "generic", 160), brand: f(s, "brand", 120), dose: f(s, "dose", 160),
        schedule: f(s, "schedule", 160), purpose: f(s, "purpose", 200), sourceRecordId,
      };
      out.medications.push(m);
    }
  }
  return out;
}
