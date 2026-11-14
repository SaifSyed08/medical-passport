// Rule-based reading of a document's OCR text (no AI): finds allergies, medications, conditions and blood type.
// Returns the same raw { findings } shape parseFindings() validates, so the review screen and merge logic are unchanged.
// It only reports what a line states outright: negations, family history and rule-outs are skipped, and every
// finding quotes its source line so the traveler can check it before anything is added.
import { DRUG_NAMES } from "./drugs";

type Kind = "allergy" | "medication" | "condition";
type Section = Kind | "skip" | null;
export type RawFinding = { kind: Kind | "bloodType"; fields: Record<string, string>; quote: string; confidence: number };

const HEADINGS: [RegExp, Kind | "skip"][] = [
  [/^(known |drug |medication )?(allerg(y|ies)|adverse (drug )?reactions?|intolerances?)( list)?$/i, "allergy"],
  [/^(current |home |discharge |active |outpatient |regular )?(medications?|meds|medicines?|prescriptions?|rx)( list)?$/i, "medication"],
  [/^((discharge |final |principal |primary |secondary |admitting |working )?(diagnos[ie]s|dx)|(active )?problems?( list)?|(past )?medical history|pmh|assessment( (and|&) plan)?|impression|(chronic |medical )?conditions)$/i, "condition"],
  [/^(family|social|surgical|travel) history|^(fh|sh|psh)$|^(plan|labs?|lab results|results|vitals?|vital signs|hpi|history of present illness|chief complaint|cc|review of systems|ros|physical exam(ination)?|pe|follow[- ]?up|instructions|patient|name|visit|admitted|discharged|collected|date|dob|signed|provider|physician)\b/i, "skip"],
];
const heading = (s: string): Kind | "skip" | undefined => HEADINGS.find(([re]) => re.test(s.trim()))?.[1];

// Not about this patient, or not established.
const NEGATED = /^(no|not|denies|denied|negative for|without|never|rule[sd]? out|r\/o|ruled out|possible|probable|suspected|query|\?)\b/i;
const OTHER_PERSON = /\b(mother|father|mom|dad|sister|brother|sibling|parent|grand(mother|father|parent)|aunt|uncle|cousin|family)\b/i;
const NO_ALLERGY = /^(nkda|nka|no known (drug )?allergies?|none( known)?|nil|n\/a)$/i;

const BULLET = /^\s*(?:[-*•·▪◦]|\(?\d{1,2}[.)])\s+/;
const ICD = /\s*\(?\b[A-TV-Z]\d{2}(?:\.\d{1,4})?\b\)?/g;
const DOSE = /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ug|g|ml|mL|units?|iu|IU|puffs?|tabs?|tablets?|caps?|capsules?|drops?|sprays?)(?:\s?\/\s?(?:dose|kg|ml|mL|actuation|puff|day|hr|h))?\b(?:[^,;]*?\b(?:subcutaneous(?:ly)?|oral(?:ly)?|po|sc|sq|iv|im|inhaled|topical(?:ly)?|nasal(?:ly)?))?/i;
const SCHEDULE = /\b(?:(?:once|twice|three times|four times|1x|2x|3x|4x)\s*(?:a|per)?\s*(?:day|daily|week|weekly)|(?:every|q)\s?\d+(?:\s?-\s?\d+)?\s?(?:hours?|hrs?|h)\b|daily|nightly|weekly|at bedtime|before bed|with meals|before meals|in the morning|in the evening|(?:as needed|prn)(?: for [^,;.]+)?|qd|qhs|bid|tid|qid|qam|qpm)\b(?:\s*at \d{1,2}(?::\d{2})?\s?(?:am|pm))?/i;
const PURPOSE = /\bfor ([a-z][a-z \-']{2,60}?)(?=[,;.)]|$)/i;
const SEVERE = /anaphyla|throat (swelling|closing)|airway|angioedema|hypotension|low blood pressure|stevens|sjs|ten\b|hospitali|intubat|epinephrine|epipen|collapse/i;
const MILD = /\bmild\b|itch|pruritus|nausea|upset stomach|headache/i;

const clean = (s: string) => s.replace(BULLET, "").replace(ICD, "").replace(/\s{2,}/g, " ").replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, "");
const quoteOf = (line: string) => line.replace(/\s{2,}/g, " ").trim().slice(0, 199);
// Commas inside parentheses ("(rash, hives)") don't split items.
const splitList = (s: string, commas: boolean) => s.split(commas ? /;|,(?![^(]*\))/ : /;/).map(clean).filter(Boolean);
const excluded = (s: string) => NEGATED.test(s) || OTHER_PERSON.test(s);

function findDrug(text: string) {
  const lower = ` ${text.toLowerCase()} `;
  return DRUG_NAMES.find(d => new RegExp(`[^a-z]${d.name.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}[^a-z]`).test(lower));
}

function severityOf(text: string) {
  if (/\bsevere\b/i.test(text) || SEVERE.test(text)) return "severe";
  if (/\bmoderate\b/i.test(text)) return "moderate";
  if (MILD.test(text)) return "mild";
  return "moderate";
}

function allergy(item: string, line: string, confidence: number): RawFinding | null {
  if (NO_ALLERGY.test(item) || excluded(item)) return null;
  // "Penicillin: anaphylaxis", "Penicillin - hives", "Penicillin (rash)", "Sulfa causes rash".
  const m = /^(.+?)(?:\s*[:\-–—→]\s+|\s*\(|\s+(?:causes?|caused|reaction:?|leads to|->)\s+)(.+?)\)?$/i.exec(item);
  const substance = clean(m ? m[1] : item);
  const reaction = m ? clean(m[2]) : "";
  if (!substance || substance.length > 80 || /\d{4}-\d{2}/.test(substance)) return null;
  return { kind: "allergy", fields: { substance, reaction, severity: severityOf(`${reaction} ${line}`) }, quote: quoteOf(line), confidence };
}

function medication(item: string, line: string, inSection: boolean): RawFinding | null {
  if (excluded(item)) return null;
  const drug = findDrug(item);
  const dose = DOSE.exec(item)?.[0].trim() ?? "";
  // Outside a medications section, a name alone isn't enough ("allergic to amoxicillin"): it needs a dose too.
  if (!drug && !inSection) return null;
  if (drug && !inSection && !dose) return null;
  let generic = drug?.generic ?? "";
  let brand = drug?.brand ?? "";
  if (!drug) {
    // Unknown medicine under a Medications heading: its name is whatever comes before the dose.
    const name = clean(item.split(/\s\d/)[0].split(/\s[-–(]/)[0]);
    if (!/^[a-z][a-z0-9 \-]{2,40}$/i.test(name) || heading(name)) return null;
    generic = name.toLowerCase();
  }
  if (brand) brand = brand.replace(/\b[a-z]/g, c => c.toUpperCase());
  const schedule = [...item.matchAll(new RegExp(SCHEDULE.source, "gi"))].map(m => m[0].replace(/ for .+$/i, "").trim()).join(", ");
  const purpose = PURPOSE.exec(item)?.[1].trim() ?? "";
  return { kind: "medication", fields: { generic, brand, dose, schedule, purpose }, quote: quoteOf(line), confidence: drug ? (inSection ? 0.9 : 0.75) : 0.6 };
}

const NOTE_START = /^(diagnosed|dx|since|onset|stage|grade|status|controlled|uncontrolled|well controlled|in remission|resolved|\d)/i;

function conditions(rest: string, line: string): RawFinding[] {
  const parts = splitList(rest, true);
  const out: RawFinding[] = [];
  for (const part of parts) {
    // "…, diagnosed 2019" belongs to the condition before it.
    if (out.length && NOTE_START.test(part)) {
      const prev = out[out.length - 1];
      prev.fields.note = [prev.fields.note, part].filter(Boolean).join(", ");
      continue;
    }
    if (excluded(part) || NO_ALLERGY.test(part)) continue;
    const paren = /^(.+?)\s*\((.+)\)$/.exec(part);
    const name = clean(paren ? paren[1] : part);
    // A sentence ("Patient was seen…") isn't a condition name.
    if (!name || name.split(" ").length > 8 || /\b(was|were|is|are|take|taking|advised|seen|will|should)\b/i.test(name) || !/[a-z]{3}/i.test(name)) continue;
    out.push({ kind: "condition", fields: { name, note: paren ? paren[2] : "" }, quote: quoteOf(line), confidence: 0.8 });
  }
  return out;
}

const BLOOD = /\b(?:blood\s*(?:type|group)|abo(?:\s*\/\s*rh)?)\s*(?:is|:|-)?\s*(AB|A|B|O)\s*(\+|-|−|pos(?:itive)?|neg(?:ative)?)/i;

export function findFindings(text: string): { findings: RawFinding[] } {
  const found: RawFinding[] = [];
  let section: Section = null;
  // A heading with its content on the same line ("Dx: asthma") only carries on to bulleted lines below it.
  let inline = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const body = line.replace(BULLET, "");
    if (inline && !BULLET.test(line)) section = null;
    inline = false;

    const blood = BLOOD.exec(body);
    if (blood) {
      const sign = /^(\+|pos)/i.test(blood[2]) ? "+" : "-";
      found.push({ kind: "bloodType", fields: { value: `${blood[1].toUpperCase()}${sign}` }, quote: quoteOf(line), confidence: 0.95 });
      continue;
    }

    // "Allergic to penicillin: anaphylaxis", "Allergy to latex (hives)".
    const allergicTo = /^(?:(?:the )?patient (?:is )?)?(?:allergic to|allergy to|allergies to)\s+(.+)$/i.exec(body);
    if (allergicTo) {
      for (const item of splitList(allergicTo[1], false)) {
        const a = allergy(item, line, 0.9);
        if (a) found.push(a);
      }
      section = null;
      continue;
    }

    // "Heading: rest" or a heading on its own line.
    const labeled = /^([A-Za-z][A-Za-z /&()]{1,40}?)\s*:\s*(.*)$/.exec(body);
    const own = !labeled && body.length <= 40 ? heading(body.replace(/[:\s]+$/, "")) : undefined;
    let rest = body;
    const h = labeled ? heading(labeled[1]) : undefined;
    // Inside a list, "Peanuts: mild itching" is an item, not a heading.
    if (labeled && !(h === undefined && (section === "allergy" || section === "medication" || section === "condition"))) {
      rest = labeled[2];
      // "Visit: 2026-05-14" labels one line; "Family history:" alone starts a section to skip.
      section = h === undefined || (h === "skip" && rest.trim()) ? null : h;
      if (h === undefined || h === "skip" || !rest.trim()) continue;
      inline = true;
    } else if (own) {
      section = own;
      continue;
    }

    const diagnosed = /\bdiagnosed with ([^,.;]+?)(?:[,;]?\s*(in \d{4}|\d{4}))?\s*(?=[,.;]|$)/i.exec(rest);
    if (section === "condition") found.push(...conditions(rest, line));
    else if (section === "allergy") for (const item of splitList(rest, true)) { const a = allergy(item, line, 0.85); if (a) found.push(a); }
    else if (section === "medication") for (const item of splitList(rest, false)) { const m = medication(item, line, true); if (m) found.push(m); }
    else if (section !== "skip") {
      if (diagnosed && !excluded(line)) found.push({ kind: "condition", fields: { name: clean(diagnosed[1]), note: diagnosed[2] ?? "" }, quote: quoteOf(line), confidence: 0.7 });
      const m = medication(rest, line, false);
      if (m) found.push(m);
    }
  }

  // One suggestion per item: the first (usually most specific) mention wins.
  const seen = new Set<string>();
  const key = (f: RawFinding) => `${f.kind}:${(f.fields.name ?? f.fields.substance ?? f.fields.generic ?? f.fields.value ?? "").toLowerCase()}`;
  return { findings: found.filter(f => !seen.has(key(f)) && seen.add(key(f))) };
}
