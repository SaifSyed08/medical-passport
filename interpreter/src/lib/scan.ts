// "Add document": read a photo of a paper record on the phone, with no AI model and nothing uploaded to us.
// Tesseract (classic OCR, run in the browser) turns the photo into text; the medical passport's own rule-based
// reader (extractor/src/rules.ts, the same rules the Tessera app's scanner uses) finds allergies, medicines and
// conditions in it. Every finding quotes its line, and the patient ticks what to keep before anything is saved.
import { findFindings } from "../../../extractor/src/rules";
import { parseFindings } from "../../../extractor/src/findings";
import type { Suggestion } from "../../../shared/autofill";
import type { Allergy, Condition, Medication, RecordDoc } from "./types";

const OCR_LANG: Record<string, string> = { en: "eng", es: "spa", ja: "jpn", ne: "nep", hi: "hin", fr: "fra", de: "deu", pt: "por", zh: "chi_sim" };

export type ScanResult = { text: string; doc: RecordDoc; findings: Suggestion[] };

/** OCR a photo. `onProgress` gets 0..1 while Tesseract reads. */
export async function readPhoto(file: Blob, recordLang: string, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const langs = ["eng", OCR_LANG[recordLang]].filter((l, i, a) => l && a.indexOf(l) === i).join("+");
  const worker = await createWorker(langs, 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    void worker.terminate();
  }
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
const DATE_RES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, (m) => iso(+m[1], +m[2], +m[3])],
  [/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/, (m) => iso(+m[3], +m[1], +m[2])],
  [new RegExp(`\\b(${MONTHS})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i"), (m) => iso(+m[3], monthOf(m[1]), +m[2])],
  [new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})[a-z]*\\.?,?\\s+(\\d{4})\\b`, "i"), (m) => iso(+m[3], monthOf(m[2]), +m[1])],
];
const monthOf = (s: string) => MONTHS.split("|").indexOf(s.toLowerCase().slice(0, 3)) + 1;
function iso(y: number, mo: number, d: number) {
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function findDate(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    for (const [re, f] of DATE_RES) {
      const m = line.match(re);
      const v = m && f(m);
      if (v) return v;
    }
  }
  return "";
}

const FACILITY = /\b(hospital|clinic|medical cent(er|re)|health( system| centre| center)?|pharmacy|laborator(y|ies)|urgent care|imaging)\b/i;
const TITLE = /\b(discharge|summary|note|report|prescription|referral|letter|results?|record|consultation|visit)\b/i;

const tidy = (s: string) => s.replace(/\s{2,}/g, " ").replace(/^[\W_]+|[\W_]+$/g, "").trim();

/** Title, date, facility and a short body for the record, from the OCR text alone. */
export function describe(text: string, findings: Suggestion[], id: string): RecordDoc {
  const lines = text.split(/\r?\n/).map(tidy).filter((l) => l.length > 2);
  const facility = lines.find((l) => FACILITY.test(l) && l.length < 70) || "";
  const title = lines.slice(0, 8).find((l) => TITLE.test(l) && l !== facility && l.length < 60) || "Scanned document";
  const counts = (["allergy", "medication", "condition"] as const)
    .map((k) => [k, findings.filter((f) => f.kind === k).length] as const)
    .filter(([, n]) => n)
    .map(([k, n]) => `${n} ${k === "allergy" ? (n > 1 ? "allergies" : "allergy") : k === "medication" ? (n > 1 ? "medicines" : "medicine") : n > 1 ? "conditions" : "condition"}`);
  const excerpt = lines.filter((l) => l !== title && l !== facility).join(" · ").slice(0, 420);
  return {
    id,
    kind: /imaging|x-?ray|ct\b|mri|ultrasound/i.test(title) ? "imaging" : /visit|discharge|consult/i.test(title) ? "visit" : "document",
    title: title.charAt(0).toUpperCase() + title.slice(1),
    date: findDate(text),
    facility,
    body: [counts.length ? `Scanned: ${counts.join(", ")}.` : "", excerpt].filter(Boolean).join(" "),
  };
}

/** Rules only: the same reader the Tessera app's scanner uses. */
export function readFindings(text: string): Suggestion[] {
  return parseFindings(findFindings(text)).filter((s) => s.kind !== "bloodType");
}

export function analyse(text: string, id = `doc_scan_${Date.now().toString(36)}`): ScanResult {
  const findings = readFindings(text);
  return { text, findings, doc: describe(text, findings, id) };
}

/** Turn the ticked findings into record items (ids unique to this scan). */
export function toItems(findings: Suggestion[], docId: string) {
  const allergies: Allergy[] = [];
  const medications: Medication[] = [];
  const conditions: Condition[] = [];
  findings.forEach((s, i) => {
    const f = s.fields;
    const id = `${docId}_${i}`;
    if (s.kind === "allergy")
      allergies.push({ id: `alg_${id}`, substance: f.substance, reaction: f.reaction || "", severity: (f.severity as Allergy["severity"]) || "moderate" });
    if (s.kind === "medication")
      medications.push({ id: `med_${id}`, name: f.brand || f.generic, generic: f.generic, dose: f.dose || "", schedule: f.schedule || "", purpose: f.purpose || "" });
    if (s.kind === "condition") conditions.push({ id: `cnd_${id}`, name: f.name, note: f.note || "" });
  });
  return { allergies, medications, conditions };
}

export const findingTitle = (s: Suggestion) =>
  s.kind === "allergy" ? s.fields.substance : s.kind === "medication" ? [s.fields.generic, s.fields.dose].filter(Boolean).join(" ") : s.fields.name;
export const findingKindLabel = (s: Suggestion) => (s.kind === "allergy" ? "Allergy" : s.kind === "medication" ? "Medicine" : "Condition");
