// The patient's own changes to their record, kept on this phone: items they swiped away, and what they added by
// scanning a document. Applied on top of the saved record everywhere (home, record sheet, the live context), so a
// deleted allergy never surfaces in a conversation and a scanned one does.
import { useSyncExternalStore } from "react";
import type { Allergy, Condition, Contact, Insurance, Lab, Medication, Persona, RecordDoc } from "./types";

export type RecordEdits = {
  removed: string[];
  allergies: Allergy[];
  medications: Medication[];
  conditions: Condition[];
  labs: Lab[];
  documents: RecordDoc[];
  contacts: Contact[];
  /** Basics and insurance as the patient corrected them (Card tab → Edit). */
  profile?: ProfileEdits;
};

export type ProfileEdits = { sex?: string; bloodType?: string; heightCm?: number | null; weightKg?: number | null; insurance?: Insurance };

const EMPTY: RecordEdits = { removed: [], allergies: [], medications: [], conditions: [], labs: [], documents: [], contacts: [] };
const keyOf = (personaId: string) => `ti.edits.${personaId}`;
const listeners = new Set<() => void>();
const memo = new Map<string, { raw: string | null; value: RecordEdits }>();

function raw(personaId: string): string | null {
  try {
    return localStorage.getItem(keyOf(personaId));
  } catch {
    return null;
  }
}

export function loadEdits(personaId: string): RecordEdits {
  const r = raw(personaId);
  const hit = memo.get(personaId);
  if (hit && hit.raw === r) return hit.value;
  let value = EMPTY;
  try {
    if (r) value = { ...EMPTY, ...(JSON.parse(r) as Partial<RecordEdits>) };
  } catch {
    /* corrupt: start over */
  }
  memo.set(personaId, { raw: r, value });
  return value;
}

function save(personaId: string, e: RecordEdits) {
  try {
    localStorage.setItem(keyOf(personaId), JSON.stringify(e));
  } catch {
    /* storage unavailable: the change lasts until reload */
    memo.set(personaId, { raw: raw(personaId), value: e });
  }
  listeners.forEach((l) => l());
}

export function removeItem(personaId: string, id: string) {
  const e = loadEdits(personaId);
  if (e.removed.includes(id)) return;
  save(personaId, { ...e, removed: [...e.removed, id] });
}

export function restoreItem(personaId: string, id: string) {
  const e = loadEdits(personaId);
  save(personaId, { ...e, removed: e.removed.filter((x) => x !== id) });
}

export function addItems(personaId: string, add: Partial<Omit<RecordEdits, "removed">>) {
  const e = loadEdits(personaId);
  save(personaId, {
    ...e,
    allergies: [...e.allergies, ...(add.allergies || [])],
    medications: [...e.medications, ...(add.medications || [])],
    conditions: [...e.conditions, ...(add.conditions || [])],
    labs: [...(add.labs || []), ...e.labs],
    documents: [...(add.documents || []), ...e.documents],
    contacts: [...e.contacts, ...(add.contacts || [])],
  });
}

export function saveProfile(personaId: string, patch: ProfileEdits) {
  const e = loadEdits(personaId);
  save(personaId, { ...e, profile: { ...e.profile, ...patch } });
}

export function resetEdits(personaId: string) {
  try {
    localStorage.removeItem(keyOf(personaId));
  } catch {
    /* ignore */
  }
  memo.delete(personaId);
  listeners.forEach((l) => l());
}

export function hasEdits(personaId: string) {
  const e = loadEdits(personaId);
  return count(e) > 0;
}

const count = (e: RecordEdits) =>
  e.removed.length + e.allergies.length + e.medications.length + e.conditions.length + e.labs.length + e.documents.length + e.contacts.length + (e.profile ? 1 : 0);

/** The record with the patient's changes applied. Returns the same object when there are none. */
export function applyEdits(p: Persona, e: RecordEdits = loadEdits(p.id)): Persona {
  if (e === EMPTY || !count(e)) return p;
  const keep = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !e.removed.includes(x.id));
  return {
    ...p,
    allergies: keep([...p.allergies, ...e.allergies]),
    medications: keep([...p.medications, ...e.medications]),
    conditions: keep([...p.conditions, ...e.conditions]),
    labs: keep([...e.labs, ...p.labs]),
    documents: keep([...e.documents, ...p.documents]),
    contacts: keep([...p.contacts, ...e.contacts]),
    ...e.profile,
  };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (ev: StorageEvent) => ev.key?.startsWith("ti.edits.") && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

/** Re-renders when this patient's edits change. */
export function useEdits(personaId: string): RecordEdits {
  return useSyncExternalStore(subscribe, () => loadEdits(personaId));
}

/* A scanned document's photo (a small JPEG) and the text read from it, kept beside the record rather than in it,
   so they never travel to translation or the live context. */
export type DocFile = { image?: string; text?: string };

export function saveDocFile(docId: string, f: DocFile) {
  try {
    localStorage.setItem(`ti.docfile.${docId}`, JSON.stringify(f));
  } catch {
    /* full: the document is still saved, just without its picture */
  }
}

export function loadDocFile(docId: string): DocFile | null {
  try {
    const r = localStorage.getItem(`ti.docfile.${docId}`);
    return r ? (JSON.parse(r) as DocFile) : null;
  } catch {
    return null;
  }
}
