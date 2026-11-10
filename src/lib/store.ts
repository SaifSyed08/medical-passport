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
};

const SETTINGS_KEY = "ti.settings.v1";
const DEFAULT_SETTINGS: Settings = { personaId: "sofia", mode: "auto", speak: true, pairs: {} };

export const loadSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) });
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

/* ---------------------------------------------------------------- medication equivalents */

export type TripCache = { savedAt: number; items: Record<string, Equivalent> };
const tripKey = (home: string, local: string) => `ti.eq.${home}>${local}`;

export const loadTrip = (home: string, local: string): TripCache => read<TripCache>(tripKey(home, local), { savedAt: 0, items: {} });

export function saveEquivalents(home: string, local: string, items: Equivalent[]) {
  const t = loadTrip(home, local);
  for (const e of items) {
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
