// Shared between the Workers API (/api/v1) and the Expo app (mobile/).
// Keep this file dependency-free: the mobile bundler resolves it from outside its project.

export const API_VERSION = "v1";
export const DEMO_NOTICE =
  "Demo only · synthetic data · not for clinical use. Production emergency-access policies need healthcare and legal review.";
export const NEUTRAL_CARD_MESSAGE = "This card can't be used right now.";

export type Language = "ja" | "en";
export const LANGUAGES: Language[] = ["ja", "en"];

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

/** `*Ja` fields are hand-written translations. Editing the English text clears them (shown as untranslated). */
export type Allergy = {
  id: string;
  substance: string;
  substanceJa?: string;
  reaction: string;
  reactionJa?: string;
  severity: Severity;
};
export type Medication = {
  id: string;
  brand: string;
  generic: string;
  genericJa?: string;
  dose: string;
  schedule: string;
  scheduleJa?: string;
  purpose: string;
  purposeJa?: string;
};
export type Condition = { id: string; name: string; nameJa?: string; note: string; noteJa?: string };
export type Contact = { id: string; name: string; relationship: string; relationshipJa?: string; phone: string };
export type Insurance = { plan: string; memberId: string; group: string; phone: string };
export type Basics = {
  sex: string;
  heightCm: number;
  weightKg: number;
  homeCountry: string;
  studyLocation: string;
  program: string;
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
  traveler: { id: string; name: string; dob: string };
  language: Language;
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
  | "privacy_changed";
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

export type EmergencyItem = { text: string; detail?: string; untranslated: boolean; severe?: boolean };
export type EmergencySection = { category: Category; title: string; items: EmergencyItem[] };
/** What a verified clinician will see in emergency scope. Allergies and medications always lead. */
export type EmergencyView = { language: Language; name: string; sections: EmergencySection[] };

export type ApiError = { error: string; code?: string };
