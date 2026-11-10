import type { Persona } from "./types";

/** The slice of the record sent to the context finder. Contacts stay on the phone. */
export function recordForContext(p: Persona) {
  return {
    patient: { name: p.name, dob: p.dob, sex: p.sex, bloodType: p.bloodType, homeCountry: p.home, recordLanguage: p.recordLanguage },
    allergies: p.allergies,
    medications: p.medications,
    conditions: p.conditions,
    labs: p.labs,
    documents: p.documents,
  };
}

/** Words the speech recogniser should expect from this patient. */
export function sttTerms(p: Persona): string[] {
  const out = new Set<string>();
  for (const m of p.medications) {
    out.add(m.name.replace(/\s+\d+(\.\d+)?\s*(mg|mcg|µg)\b.*$/i, "").trim());
    out.add(m.generic.replace(/\s+\d.*$/, "").trim());
  }
  for (const a of p.allergies) out.add(a.substance.replace(/\s*\(.*\)/, "").trim());
  for (const c of p.conditions) out.add(c.name);
  return [...out].filter(Boolean).slice(0, 40);
}



export function findRecordItem(p: Persona, id: string): { kind: string; title: string; lines: string[] } | null {
  const a = p.allergies.find((x) => x.id === id);
  if (a) return { kind: "allergy", title: a.substance, lines: [a.reaction, `Severity: ${a.severity}`] };
  const m = p.medications.find((x) => x.id === id);
  if (m) return { kind: "medication", title: m.name, lines: [m.generic, `${m.dose} · ${m.schedule}`, m.purpose] };
  const c = p.conditions.find((x) => x.id === id);
  if (c) return { kind: "condition", title: c.name, lines: [c.since ? `Since ${c.since}` : "", c.note].filter(Boolean) };
  const l = p.labs.find((x) => x.id === id);
  if (l) return { kind: "lab", title: l.name, lines: [`${l.value} ${l.unit} (ref ${l.ref})${l.flag ? ` · ${l.flag === "H" ? "high" : "low"}` : ""}`, l.date, l.source || ""].filter(Boolean) };
  const d = p.documents.find((x) => x.id === id);
  if (d) return { kind: "document", title: d.title, lines: [`${d.date} · ${d.facility}`, d.body] };
  return null;
}
