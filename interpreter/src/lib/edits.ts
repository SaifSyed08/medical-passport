// The patient's own changes to their record, kept on this phone: items they swiped away, and what they added by
// scanning a document. Applied on top of the saved record everywhere (home, record sheet, the live context), so a
// deleted allergy never surfaces in a conversation and a scanned one does.
import { useSyncExternalStore } from "react";
import type { Allergy, Condition, Medication, Persona, RecordDoc } from "./types";

export type RecordEdits = {
  removed: string[];
  allergies: Allergy[];
  medications: Medication[];
  conditions: Condition[];
  documents: RecordDoc[];
};

const EMPTY: RecordEdits = { removed: [], allergies: [], medications: [], conditions: [], documents: [] };
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
    documents: [...(add.documents || []), ...e.documents],
  });
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
  return e.removed.length + e.allergies.length + e.medications.length + e.conditions.length + e.documents.length > 0;
}

/** The record with the patient's changes applied. Returns the same object when there are none. */
export function applyEdits(p: Persona, e: RecordEdits = loadEdits(p.id)): Persona {
  if (e === EMPTY || (!e.removed.length && !e.allergies.length && !e.medications.length && !e.conditions.length && !e.documents.length)) return p;
  const keep = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !e.removed.includes(x.id));
  return {
    ...p,
    allergies: keep([...p.allergies, ...e.allergies]),
    medications: keep([...p.medications, ...e.medications]),
    conditions: keep([...p.conditions, ...e.conditions]),
    labs: keep(p.labs),
    documents: keep([...e.documents, ...p.documents]),
    contacts: keep(p.contacts),
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
