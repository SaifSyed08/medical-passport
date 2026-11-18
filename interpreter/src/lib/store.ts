// Everything here lives only on this phone (localStorage). Reads and writes never throw:
// private windows and blocked storage just mean nothing is remembered.
import type { DrugMention, Equivalent } from "./types";
import type { MicMode } from "./mic";

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const norm = (s: string) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

/* ---------------------------------------------------------------- settings */

export type Settings = {
  personaId: string;
  mode: MicMode;
  speak: boolean;
  pairs: Record<string, { patientLang: string; doctorLang: string; local: string }>;
  /** Visual identity: Parity (the original light look, formerly "Tessera"), or Tandem (press 3 to switch). */
  brand: "parity" | "tandem";
  /** Conversation layout: the scrolling transcript, or Focus (one line at a time; press L to switch). */
  layout: "classic" | "focus";
  /** Which of the four parts is open: the health card, documents, the medicine converter, or the interpreter. */
  tab: Tab;
};

export type Tab = "card" | "docs" | "meds" | "talk";
export const TABS: Tab[] = ["card", "docs", "meds", "talk"];

const SETTINGS_KEY = "ti.settings.v1";
const DEFAULT_SETTINGS: Settings = { personaId: "sofia", mode: "auto", speak: true, pairs: {}, brand: "parity", layout: "classic", tab: "card" };

export const loadSettings = (): Settings => {
  const s = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) };
  // The original look was called Tessera; phones that saved that name get Parity.
  if (s.brand !== "tandem") s.brand = "parity";
  if (!TABS.includes(s.tab)) s.tab = "card";
  return s;
};
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

/* ---------------------------------------------------------------- medication equivalents */

export type TripCache = { savedAt: number; items: Record<string, Equivalent> };
const tripKey = (home: string, local: string) => `ti.eq.${home}>${local}`;

export const loadTrip = (home: string, local: string): TripCache => read<TripCache>(tripKey(home, local), { savedAt: 0, items: {} });

export function saveEquivalents(home: string, local: string, items: Equivalent[]) {
  const t = loadTrip(home, local);
  for (const next of items) {
    // Names heard in conversation come without readings; keep the ones already fetched for the same names.
    const prev = t.items[norm(next.input || next.key || next.generic)];
    const same = prev && prev.local_name === next.local_name && prev.local_brands.join("|") === next.local_brands.join("|");
    const e = next.local_reading === undefined && same ? { ...next, local_reading: prev.local_reading, local_brands_reading: prev.local_brands_reading } : next;
    if (e.input) t.items[norm(e.input)] = e;
    t.items[norm(e.key || e.generic)] = e;
  }
  t.savedAt = Date.now();
  write(tripKey(home, local), t);
  return t;
}

/** Remember drugs heard in conversation so the next lookup is already on the phone. */
export function rememberMentions(home: string, local: string, drugs: DrugMention[]) {
  const items: Equivalent[] = drugs.map((d) => ({
    input: d.mentioned,
    key: d.key,
    generic: d.generic,
    drug_class: d.drug_class,
    home_name: d.home_name,
    home_strength: d.home_strength,
    local_name: d.local_name,
    local_brands: d.local_brands,
    local_strength: d.local_strength,
    status: d.status,
    note: d.curated_note || d.note_doctor,
    source: d.source,
  }));
  if (items.length) saveEquivalents(home, local, items);
}

export function isCached(t: TripCache, d: DrugMention) {
  return Boolean(t.items[norm(d.key)] || t.items[norm(d.generic)] || t.items[norm(d.mentioned)]);
}

/** Unique equivalents, for sending as grounding with each turn. */
export function uniqueEquivalents(t: TripCache): Equivalent[] {
  const seen = new Set<string>();
  return Object.values(t.items).filter((e) => {
    const k = norm(e.key || e.generic);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function clearTrip(home: string, local: string) {
  try {
    localStorage.removeItem(tripKey(home, local));
  } catch {
    /* ignore */
  }
}
