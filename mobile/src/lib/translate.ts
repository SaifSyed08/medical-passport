// The record in the doctor's language, translated by AI on the interpreter server (interpreter/server,
// POST /api/translate-record: it keeps every item and id, rejects incomplete translations, and caches).
// Only the readable text is sent, with each item's id. The result stays in memory: patient data never goes to disk.
import { useEffect, useState } from "react";
import type { Language, Profile, RecordItem } from "@shared/tessera";
import { INTERPRETER_URL, interpreterPost } from "./interpreter";

export const TRANSLATION_AVAILABLE = !!INTERPRETER_URL;

/** The fields the app shows, per list. Brand names, doses, dates and phone numbers are left out: they stay as entered. */
export type RecordText = {
  allergies: { id: string; substance: string; reaction: string }[];
  medications: { id: string; generic: string; schedule: string; purpose: string }[];
  conditions: { id: string; name: string; note: string }[];
  contacts: { id: string; relationship: string }[];
  documents: { id: string; title: string; summary: string; body: string }[];
};

// A typed note or a scan can run long; the start is what the list shows, and every switch re-sends this.
const DOC_CHARS = 1200;

export function recordText(profile: Profile | undefined, records: RecordItem[] | undefined): RecordText {
  return {
    allergies: (profile?.allergies ?? []).map(({ id, substance, reaction }) => ({ id, substance, reaction })),
    medications: (profile?.medications ?? []).map(({ id, generic, schedule, purpose }) => ({ id, generic, schedule, purpose })),
    conditions: (profile?.conditions ?? []).map(({ id, name, note }) => ({ id, name, note })),
    contacts: (profile?.contacts ?? []).map(({ id, relationship }) => ({ id, relationship })),
    documents: (records ?? []).map(r => ({ id: r.id, title: r.title, summary: r.summary ?? "", body: (r.body ?? "").slice(0, DOC_CHARS) })),
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const cache = new Map<string, RecordText>();
const inflight = new Map<string, Promise<RecordText>>();

/** Translate (once per content and language) and keep it for this session. */
export function loadTranslation(body: RecordText, to: Language): Promise<RecordText> {
  const key = `${to}:${hash(JSON.stringify(body))}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  if (!inflight.has(key)) {
    inflight.set(
      key,
      interpreterPost<{ record: RecordText }>("/api/translate-record", { record: body, to, from: "en" }, 60000)
        .then(r => {
          cache.set(key, r.record);
          return r.record;
        })
        .finally(() => inflight.delete(key)),
    );
  }
  return inflight.get(key)!;
}

/** A field from the AI translation, by list, id and field name; undefined when there is none. */
export function aiField(t: RecordText | null | undefined, list: keyof RecordText, id: string, field: string): string | undefined {
  const item = (t?.[list] as { id: string }[] | undefined)?.find(x => x.id === id) as Record<string, unknown> | undefined;
  const v = item?.[field];
  return typeof v === "string" && v.trim() ? v : undefined;
}

export type Translation = { data: RecordText | null; loading: boolean; error: boolean };

/** The translation of `body` into `to` while `on`; nothing is fetched while it's off. */
export function useTranslation(body: RecordText, to: Language, on: boolean): Translation {
  const key = `${to}:${hash(JSON.stringify(body))}`;
  const [state, setState] = useState<{ key: string; data: RecordText | null; error: boolean }>({ key: "", data: null, error: false });
  const want = on && TRANSLATION_AVAILABLE && to !== "en";
  useEffect(() => {
    if (!want) return;
    let live = true;
    loadTranslation(body, to)
      .then(data => live && setState({ key, data, error: false }))
      .catch(() => live && setState({ key, data: null, error: true }));
    return () => {
      live = false;
    };
    // `body` is covered by key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, want]);
  if (!want) return { data: null, loading: false, error: false };
  const now = state.key === key ? state : null;
  return { data: now?.data ?? cache.get(key) ?? null, loading: !now && !cache.has(key), error: !!now?.error };
}
