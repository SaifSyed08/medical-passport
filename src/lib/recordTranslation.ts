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

const key = (p: Persona, lang: string) => `ti.record.${p.id}.${lang}.${JSON.stringify(recordBody(p)).length}`;

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
      translateRecord(recordBody(p), lang)
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
  const [state, setState] = useState<{ record: RecordBody | null; loading: boolean; error: string }>(() => ({ record: readCache(p, lang), loading: false, error: "" }));
  useEffect(() => {
    if (!enabled || p.recordLanguage === lang) return;
    const c = readCache(p, lang);
    if (c) return setState({ record: c, loading: false, error: "" });
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    loadTranslatedRecord(p, lang)
      .then((r) => live && setState({ record: r, loading: false, error: "" }))
      .catch((e) => live && setState({ record: null, loading: false, error: (e as Error).message }));
    return () => {
      live = false;
    };
  }, [p, lang, enabled]);
  return state;
}
