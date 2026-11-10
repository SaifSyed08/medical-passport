export type Speaker = "patient" | "clinician";

export type Allergy = { id: string; substance: string; reaction: string; severity: "mild" | "moderate" | "severe"; since?: string };
export type Medication = { id: string; name: string; generic: string; dose: string; schedule: string; purpose: string };
export type Condition = { id: string; name: string; since?: string; note: string };
export type Lab = { id: string; name: string; value: string; unit: string; ref: string; flag: "H" | "L" | "" ; date: string; source?: string };
export type RecordDoc = { id: string; kind: "visit" | "document" | "imaging"; title: string; date: string; facility: string; body: string };
export type Contact = { id: string; name: string; relationship: string; phone: string };

export type Persona = {
  id: string;
  name: string;
  initials: string;
  dob: string;
  sex: string;
  bloodType: string;
  /** Language the patient speaks (ISO 639-1). */
  language: string;
  /** Home country (ISO 3166-1 alpha-2): where their medicines are named. */
  home: string;
  trip: { country: string; city: string; doctorLanguage: string; reason: string };
  /** Language the record itself is written in. */
  recordLanguage: string;
  allergies: Allergy[];
  medications: Medication[];
  conditions: Condition[];
  labs: Lab[];
  documents: RecordDoc[];
  contacts: Contact[];
  /** Suggested lines for the presenter. */
  script: { speaker: Speaker; text: string; shows: string }[];
};

export type DrugStatus = "same_name" | "different_name" | "not_available_locally" | "different_strength" | "uncertain";

export type Equivalent = {
  id?: string;
  input?: string;
  key: string;
  generic: string;
  drug_class: string;
  home_name: string;
  home_strength?: string;
  local_name: string;
  local_brands: string[];
  local_strength: string;
  status: DrugStatus;
  note: string;
  source: "curated" | "ai";
};

export type DrugMention = {
  key: string;
  mentioned: string;
  translated: string;
  inCleaned: boolean;
  inTranslation: boolean;
  generic: string;
  drug_class: string;
  home_name: string;
  home_strength: string;
  local_name: string;
  local_brands: string[];
  local_strength: string;
  status: DrugStatus;
  note_listener: string;
  note_doctor: string;
  curated_note: string;
  med_id: string;
  source: "curated" | "ai";
  /** Set on the client when this mapping was already saved on the phone. */
  cached?: boolean;
};

/** live = still being spoken (captions update); then transcribing → interpreting → done. */
export type TurnStatus = "live" | "transcribing" | "interpreting" | "done" | "error";

export type Turn = {
  id: string;
  at: number;
  status: TurnStatus;
  raw: string;
  cleaned: string;
  translation: string;
  language: string;
  speaker: Speaker | null;
  listenerLang: string;
  forced: Speaker | null;
  drugs: DrugMention[];
  error?: string;
  timings: { stt?: number; llm?: number; total?: number };
};

export type ContextItem = {
  id: string;
  level: "alert" | "relevant";
  title: string;
  detail: string;
  why: string;
  turnId: string;
  at: number;
};
