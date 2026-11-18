// The patient's record, translated into the doctor's language on demand and kept on the phone.
import { useEffect, useState } from "react";
import type { Persona } from "./types";
import { translateRecord } from "./api.ts";

export type RecordBody = Pick<Persona, "allergies" | "medications" | "conditions" | "labs" | "documents" | "contacts">;

export const recordBody = (p: Persona): RecordBody => ({
  allergies: p.allergies,
  medications: p.medications,
  conditions: p.conditions,
  labs: p.labs,
  documents: p.documents,
  contacts: p.contacts,
});

// Keyed by the record's content, so an edit (a deleted row, a scanned document) gets a fresh translation.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
const key = (p: Persona, lang: string) => `ti.record.${p.id}.${lang}.${hash(JSON.stringify(recordBody(p)))}`;

function readCache(p: Persona, lang: string): RecordBody | null {
  try {
    const v = localStorage.getItem(key(p, lang));
    return v ? (JSON.parse(v) as RecordBody) : null;
  } catch {
    return null;
  }
}

const inflight = new Map<string, Promise<RecordBody>>();

/** Fetch (once) and cache the translation. Safe to call early to warm it up. */
export function loadTranslatedRecord(p: Persona, lang: string): Promise<RecordBody> {
  const cached = readCache(p, lang);
  if (cached) return Promise.resolve(cached);
  const k = key(p, lang);
  if (!inflight.has(k)) {
    inflight.set(
      k,
      translateRecord(recordBody(p), lang, p.recordLanguage)
        .then((r) => {
          const merged = mergeIds(recordBody(p), r.record);
          try {
            localStorage.setItem(k, JSON.stringify(merged));
          } catch {
            /* storage unavailable */
          }
          return merged;
        })
        .finally(() => inflight.delete(k)),
    );
  }
  return inflight.get(k)!;
}

/** Keep the original ids, numbers and flags even if the model dropped or changed one. */
export function mergeIds(orig: RecordBody, tr: Partial<RecordBody>): RecordBody {
  for (const k of Object.keys(orig) as (keyof RecordBody)[]) {
    const a = orig[k] as unknown as { id: string }[];
    const b = tr[k] as unknown as { id?: string }[] | undefined;
    if (!Array.isArray(b) || b.length !== a.length || a.some((x, i) => b[i]?.id !== x.id)) throw new Error("translation came back incomplete");
  }
  const out = {} as RecordBody;
  for (const k of Object.keys(orig) as (keyof RecordBody)[]) {
    const a = orig[k] as unknown as Record<string, unknown>[];
    const b = (Array.isArray(tr[k]) ? tr[k] : []) as unknown as Record<string, unknown>[];
    (out as unknown as Record<string, unknown>)[k] = a.map((item, i) => {
      const t = b.find((x) => x?.id === item.id) || b[i] || {};
      const merged: Record<string, unknown> = { ...item };
      for (const [f, v] of Object.entries(item)) if (typeof v === "string" && typeof t[f] === "string" && t[f]) merged[f] = t[f];
      for (const f of ["id", "value", "unit", "ref", "flag", "date", "phone", "severity"]) if (f in item) merged[f] = item[f];
      return merged;
    });
  }
  return out;
}

export function useTranslatedRecord(p: Persona, lang: string, enabled: boolean) {
  const want = enabled && p.recordLanguage !== lang;
  // The state remembers which record + language it holds, so switching country never shows the last language's text.
  const k = key(p, lang);
  const [state, setState] = useState<{ k: string; record: RecordBody | null; loading: boolean; error: string }>(() => ({ k, record: readCache(p, lang), loading: false, error: "" }));
  useEffect(() => {
    if (!want) return;
    const c = readCache(p, lang);
    if (c) return setState({ k, record: c, loading: false, error: "" });
    let live = true;
    setState({ k, record: null, loading: true, error: "" });
    loadTranslatedRecord(p, lang)
      .then((r) => live && setState({ k, record: r, loading: false, error: "" }))
      .catch((e) => live && setState({ k, record: null, loading: false, error: (e as Error).message }));
    return () => {
      live = false;
    };
    // `k` covers the record's content and the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, want]);
  if (!want) return { record: null, loading: false, error: "" };
  if (state.k !== k) {
    const c = readCache(p, lang);
    return { record: c, loading: !c, error: "" };
  }
  return { record: state.record, loading: state.loading, error: state.error };
}
