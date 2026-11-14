// Turns the signed-in traveler's Tessera profile and records into the interpreter's patient record.
// The interpreter tab (app/(tabs)/interpreter.tsx) hands this to the embedded page, which matches it against
// what is said to flag allergies, medicines, conditions and documents. Contacts and insurance are not included.
import { destinationName, languageForCountry, OTHER_DESTINATION, type Me, type Profile, type RecordItem } from "@shared/tessera";
import type { AppLanguage } from "./i18n";

export const INTERPRETER_URL = (process.env.EXPO_PUBLIC_INTERPRETER_URL ?? "").replace(/\/$/, "");
const INTERPRETER_CODE = process.env.EXPO_PUBLIC_INTERPRETER_CODE ?? "";
/** The page to load. The access code unlocks the interpreter server once; it then keeps a cookie. */
export const interpreterPage = () => (INTERPRETER_URL ? `${INTERPRETER_URL}/${INTERPRETER_CODE ? `?code=${encodeURIComponent(INTERPRETER_CODE)}` : ""}` : "");

/** Same shape as `Persona` in interpreter/src/lib/types.ts. */
export type InterpreterPersona = {
  id: string;
  name: string;
  initials: string;
  dob: string;
  sex: string;
  bloodType: string;
  language: string;
  home: string;
  trip: { country: string; city: string; doctorLanguage: string; reason: string };
  recordLanguage: string;
  allergies: { id: string; substance: string; reaction: string; severity: "mild" | "moderate" | "severe" }[];
  medications: { id: string; name: string; generic: string; dose: string; schedule: string; purpose: string }[];
  conditions: { id: string; name: string; note: string }[];
  labs: never[];
  documents: { id: string; kind: "visit" | "document"; title: string; date: string; facility: string; body: string }[];
  contacts: never[];
  script: never[];
};

// Home countries the interpreter knows (its COUNTRIES table), by the names people type into the profile.
const COUNTRY_CODES: Record<string, string> = {
  "united states": "US", "united states of america": "US", usa: "US", us: "US", america: "US",
  mexico: "MX", "méxico": "MX", japan: "JP", "united kingdom": "GB", uk: "GB", england: "GB", "great britain": "GB",
  india: "IN", pakistan: "PK", spain: "ES", france: "FR", germany: "DE", italy: "IT", brazil: "BR", china: "CN",
  "south korea": "KR", korea: "KR", canada: "CA", philippines: "PH", vietnam: "VN", turkey: "TR", australia: "AU",
};
const homeCode = (country: string) => COUNTRY_CODES[country.trim().toLowerCase()] ?? "US";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join("") || "?";

export function toPersona(me: Me, profile: Profile, records: RecordItem[], uiLang: AppLanguage): InterpreterPersona {
  const dest = me.destinationCountry ?? profile.basics.destinationCountry ?? null;
  const local = dest && dest !== OTHER_DESTINATION ? dest : "US";
  return {
    // One fixed id: the interpreter keeps its per-patient language choices under it.
    id: "me",
    name: me.traveler.name || "You",
    initials: initials(me.traveler.name),
    dob: me.traveler.dob,
    sex: profile.basics.sex,
    bloodType: profile.bloodType === "Unknown" ? "unknown" : profile.bloodType,
    // The patient speaks the app's language; they can change it in the interpreter's settings.
    language: uiLang,
    home: homeCode(profile.basics.homeCountry),
    trip: {
      country: local,
      city: profile.basics.studyLocation || destinationName(dest) || "",
      doctorLanguage: languageForCountry(dest),
      reason: profile.basics.program,
    },
    recordLanguage: "en",
    allergies: profile.allergies.map(a => ({ id: a.id, substance: a.substance, reaction: a.reaction, severity: a.severity })),
    medications: profile.medications.map(m => ({ id: m.id, name: m.brand || m.generic, generic: m.generic, dose: m.dose, schedule: m.schedule, purpose: m.purpose })),
    conditions: profile.conditions.map(c => ({ id: c.id, name: c.name, note: c.note })),
    labs: [],
    // Documents are what lets the interpreter cite a past visit or letter while someone is talking.
    documents: records.map(r => ({
      id: r.id,
      kind: r.kind === "encounter" ? "visit" : "document",
      title: r.title,
      date: r.date,
      facility: r.facility ?? "",
      body: [r.summary && (r.simulated ? `${r.summary} (summary not read from the file)` : r.summary), r.body].filter(Boolean).join("\n\n"),
    })),
    contacts: [],
    script: [],
  };
}
