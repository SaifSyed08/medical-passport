// Shared between the Workers API (/api/v1) and the Expo app (mobile/).
// Keep this file dependency-free: the mobile bundler resolves it from outside its project.

export const API_VERSION = "v1";
export const DEMO_NOTICE =
  "Demo only · synthetic data · not for clinical use. Production emergency-access policies need healthcare and legal review.";
export const NEUTRAL_CARD_MESSAGE = "This card can't be used right now.";

/** Languages the doctor-facing emergency profile can be shown in. */
export type Language = "en" | "ja" | "es" | "fr" | "it" | "de";
export const LANGUAGES: Language[] = ["en", "ja", "es", "fr", "it", "de"];
export type TranslatedLanguage = Exclude<Language, "en">;
export const TRANSLATED_LANGUAGES: TranslatedLanguage[] = ["ja", "es", "fr", "it", "de"];
/** Each language's own name, so a reader recognises theirs. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
};

/** Study-abroad destinations and the language a local doctor would read. Anything else falls back to English. */
export type Destination = { code: string; name: string; language: Language };
export const DESTINATIONS: Destination[] = [
  { code: "AR", name: "Argentina", language: "es" },
  { code: "AU", name: "Australia", language: "en" },
  { code: "AT", name: "Austria", language: "de" },
  { code: "BE", name: "Belgium", language: "fr" },
  { code: "CA", name: "Canada", language: "en" },
  { code: "CL", name: "Chile", language: "es" },
  { code: "CO", name: "Colombia", language: "es" },
  { code: "CR", name: "Costa Rica", language: "es" },
  { code: "DO", name: "Dominican Republic", language: "es" },
  { code: "EC", name: "Ecuador", language: "es" },
  { code: "FR", name: "France", language: "fr" },
  { code: "DE", name: "Germany", language: "de" },
  { code: "IE", name: "Ireland", language: "en" },
  { code: "IT", name: "Italy", language: "it" },
  { code: "JP", name: "Japan", language: "ja" },
  { code: "MX", name: "Mexico", language: "es" },
  { code: "MA", name: "Morocco", language: "fr" },
  { code: "NZ", name: "New Zealand", language: "en" },
  { code: "PE", name: "Peru", language: "es" },
  { code: "SN", name: "Senegal", language: "fr" },
  { code: "ZA", name: "South Africa", language: "en" },
  { code: "ES", name: "Spain", language: "es" },
  { code: "CH", name: "Switzerland (French-speaking)", language: "fr" },
  { code: "GB", name: "United Kingdom", language: "en" },
];
/** "OTHER" means a country not in the list; its doctors get the English profile. */
export const OTHER_DESTINATION = "OTHER";
export function languageForCountry(code: string | null | undefined): Language {
  return DESTINATIONS.find(d => d.code === code)?.language ?? "en";
}
export function destinationName(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === OTHER_DESTINATION) return "Other country";
  return DESTINATIONS.find(d => d.code === code)?.name ?? null;
}

export const CATEGORIES = [
  "allergies",
  "medications",
  "conditions",
  "bloodType",
  "contacts",
  "insurance",
  "encounters",
  "documents",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Visibility = "emergency" | "restricted";
export type Privacy = Record<Category, Visibility>;
export const DEFAULT_PRIVACY: Privacy = {
  allergies: "emergency",
  medications: "emergency",
  conditions: "emergency",
  bloodType: "emergency",
  contacts: "emergency",
  insurance: "restricted",
  encounters: "restricted",
  documents: "restricted",
};

export type Severity = "severe" | "moderate" | "mild";
export const BLOOD_TYPES = ["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

/**
 * Hand-written translations of an item's English fields, by language and field name,
 * e.g. `tr.ja.substance`. Editing the English text drops that field's translations, so doctors see
 * the original marked untranslated instead of a stale translation.
 */
export type Translations<F extends string> = Partial<Record<TranslatedLanguage, Partial<Record<F, string>>>>;
export type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: Severity;
  tr?: Translations<"substance" | "reaction">;
};
export type Medication = {
  id: string;
  brand: string;
  generic: string;
  dose: string;
  schedule: string;
  purpose: string;
  tr?: Translations<"generic" | "schedule" | "purpose">;
};
export type Condition = { id: string; name: string; note: string; tr?: Translations<"name" | "note"> };
export type Contact = { id: string; name: string; relationship: string; phone: string; tr?: Translations<"relationship"> };
/** English field names that carry translations, per list. */
export const TRANSLATED_FIELDS = {
  allergies: ["substance", "reaction"],
  medications: ["generic", "schedule", "purpose"],
  conditions: ["name", "note"],
  contacts: ["relationship"],
} as const;
export type Insurance = { plan: string; memberId: string; group: string; phone: string };
export type Basics = {
  sex: string;
  /** null = not recorded. */
  heightCm: number | null;
  weightKg: number | null;
  homeCountry: string;
  studyLocation: string;
  program: string;
  /** ISO country code from DESTINATIONS, or OTHER_DESTINATION. Sets the doctor-facing language. */
  destinationCountry?: string;
};
export type Profile = {
  basics: Basics;
  bloodType: BloodType;
  allergies: Allergy[];
  medications: Medication[];
  conditions: Condition[];
  contacts: Contact[];
  insurance: Insurance;
};

export type CardStatus = "active" | "frozen" | "voided";
export type Card = {
  cardId: string;
  /** Built by the backend. Every QR (web, mobile, future Wallet pass) renders exactly this URL. */
  cardUrl: string;
  serialNumber: string;
  status: CardStatus;
  created: string;
  passLastUpdated: string | null;
};

export type Me = {
  /** `needsSetup`: a blank profile without a name or date of birth yet. `sample`: the seeded Jordan Rivera. */
  traveler: { id: string; name: string; dob: string; needsSetup: boolean; sample: boolean };
  language: Language;
  destinationCountry: string | null;
  autoApprove: boolean;
  walletEnabled: boolean;
  presenterEnabled: boolean;
  demoNotice: string;
};

export type RecordKind = "document" | "encounter" | "upload";
export type RecordItem = {
  id: string;
  kind: RecordKind;
  title: string;
  date: string;
  facility: string | null;
  summary: string | null;
  body: string | null;
  /** True when the summary was not produced from the file's real contents. */
  simulated: boolean;
  hasFile: boolean;
  contentType: string | null;
  size: number | null;
};

export type AuditAction =
  | "scan"
  | "id_match"
  | "sign_in"
  | "profile_view"
  | "ai_question"
  | "source_open"
  | "full_record_request"
  | "full_record_decision"
  | "card_frozen"
  | "card_unfrozen"
  | "card_replaced"
  | "privacy_changed"
  | "identity_changed";
export type AccessEvent = {
  seq: number;
  at: string;
  actor: string;
  actorRole: string;
  facility: string | null;
  scope: string | null;
  action: AuditAction;
  outcome: "success" | "failure" | "denied" | "info";
  detail: string | null;
  /** Seeded history, not something that happened in this session. */
  seeded: boolean;
  message: string;
};

export type RequestStatus = "pending" | "approved" | "denied";
export type AccessRequest = {
  id: string;
  clinician: string;
  role: string;
  facility: string;
  reason: string;
  status: RequestStatus;
  created: string;
  decided: string | null;
};

/** `empty`: placeholder for a list with nothing recorded ("None recorded"), not a clinical "none". */
export type EmergencyItem = { text: string; detail?: string; untranslated: boolean; severe?: boolean; empty?: boolean };
export type EmergencySection = { category: Category; title: string; items: EmergencyItem[] };
/** What a verified clinician will see in emergency scope. Allergies and medications always lead. */
export type EmergencyView = { language: Language; name: string; sections: EmergencySection[] };

export type ApiError = { error: string; code?: string };
