import { z } from "zod";
import {
  BLOOD_TYPES,
  CATEGORIES,
  type Allergy,
  type Condition,
  type Contact,
  type EmergencySection,
  type EmergencyView,
  type Language,
  type Medication,
  type Privacy,
  type Profile,
} from "@/shared/tessera";

const s = (max: number) => z.string().trim().max(max);
const id = z.string().regex(/^[a-z]{3}_[A-Za-z0-9_-]{1,40}$/);
const ja = (max: number) => s(max).optional();

export const allergySchema = z.object({
  id, substance: s(160).min(1), substanceJa: ja(160), reaction: s(240), reactionJa: ja(240),
  severity: z.enum(["severe", "moderate", "mild"]),
});
export const medicationSchema = z.object({
  id, brand: s(120), generic: s(160).min(1), genericJa: ja(160), dose: s(160), schedule: s(160),
  scheduleJa: ja(160), purpose: s(200), purposeJa: ja(200),
});
export const conditionSchema = z.object({ id, name: s(160).min(1), nameJa: ja(160), note: s(400), noteJa: ja(400) });
export const contactSchema = z.object({
  id, name: s(120).min(1), relationship: s(120), relationshipJa: ja(120),
  phone: s(40).regex(/^[+0-9 ()-]{7,40}(\s*\(fictional\))?$/, "Enter a phone number using digits, spaces and +()-"),
});
export const profileSchema = z.object({
  basics: z.object({
    sex: s(40), heightCm: z.number().min(30).max(260), weightKg: z.number().min(1).max(500),
    homeCountry: s(80), studyLocation: s(120), program: s(160),
  }),
  bloodType: z.enum(BLOOD_TYPES),
  allergies: z.array(allergySchema).max(30),
  medications: z.array(medicationSchema).max(40),
  conditions: z.array(conditionSchema).max(30),
  contacts: z.array(contactSchema).max(6),
  insurance: z.object({ plan: s(160), memberId: s(60), group: s(60), phone: s(40) }),
});
export const privacySchema = z.object(
  Object.fromEntries(CATEGORIES.map(c => [c, z.enum(["emergency", "restricted"])])) as Record<
    (typeof CATEGORIES)[number],
    z.ZodEnum<["emergency", "restricted"]>
  >,
);

/**
 * When a traveler edits English text, the matching hand-written Japanese no longer applies.
 * Drop it so the clinician sees the original marked "untranslated" instead of a stale translation.
 */
export function mergeTranslations(prev: Profile, next: Profile): Profile {
  const keep = <T extends { id: string }>(old: T[], nu: T[], pairs: [keyof T, keyof T][]) =>
    nu.map(item => {
      const before = old.find(o => o.id === item.id);
      const out = { ...item };
      for (const [en, jp] of pairs) {
        const provided = item[jp] !== undefined && item[jp] !== before?.[jp];
        if (provided) continue;
        if (before && before[en] === item[en] && before[jp]) out[jp] = before[jp];
        else delete out[jp];
      }
      return out;
    });
  return {
    ...next,
    allergies: keep<Allergy>(prev.allergies, next.allergies, [["substance", "substanceJa"], ["reaction", "reactionJa"]]),
    medications: keep<Medication>(prev.medications, next.medications, [["generic", "genericJa"], ["schedule", "scheduleJa"], ["purpose", "purposeJa"]]),
    conditions: keep<Condition>(prev.conditions, next.conditions, [["name", "nameJa"], ["note", "noteJa"]]),
    contacts: keep<Contact>(prev.contacts, next.contacts, [["relationship", "relationshipJa"]]),
  };
}

const titles: Record<Language, Record<string, string>> = {
  en: { allergies: "Allergies", medications: "Medications", conditions: "Conditions", bloodType: "Blood type", contacts: "Emergency contacts" },
  ja: { allergies: "アレルギー", medications: "服用中の薬", conditions: "持病", bloodType: "血液型", contacts: "緊急連絡先" },
};
const severityLabel: Record<Language, Record<Allergy["severity"], string>> = {
  en: { severe: "Severe", moderate: "Moderate", mild: "Mild" },
  ja: { severe: "重度", moderate: "中等度", mild: "軽度" },
};

function pick(lang: Language, en: string, jp?: string) {
  return lang === "ja" && jp ? { text: jp, untranslated: false } : { text: en, untranslated: lang === "ja" && !!en };
}

/**
 * What a verified clinician sees in emergency scope. Only categories the traveler marked
 * "emergency" are included, and allergies and medications always come first.
 * Insurance, encounters and documents are never part of this view.
 */
export function emergencyView(name: string, profile: Profile, privacy: Privacy, lang: Language): EmergencyView {
  const t = titles[lang];
  const sections: EmergencySection[] = [];
  const on = (c: keyof Privacy) => privacy[c] === "emergency";
  if (on("allergies"))
    sections.push({
      category: "allergies",
      title: t.allergies,
      items: profile.allergies.map(a => {
        const sub = pick(lang, a.substance, a.substanceJa), re = pick(lang, a.reaction, a.reactionJa);
        return { text: sub.text, detail: `${severityLabel[lang][a.severity]} · ${re.text}`, untranslated: sub.untranslated || re.untranslated, severe: a.severity === "severe" };
      }),
    });
  if (on("medications"))
    sections.push({
      category: "medications",
      title: t.medications,
      items: profile.medications.map(m => {
        const g = pick(lang, m.generic, m.genericJa), sch = pick(lang, m.schedule, m.scheduleJa);
        return { text: `${g.text}${m.brand ? ` (${m.brand})` : ""}`, detail: `${m.dose} · ${sch.text}`, untranslated: g.untranslated || sch.untranslated };
      }),
    });
  if (on("conditions"))
    sections.push({
      category: "conditions",
      title: t.conditions,
      items: profile.conditions.map(c => {
        const n = pick(lang, c.name, c.nameJa), note = pick(lang, c.note, c.noteJa);
        return { text: n.text, detail: note.text, untranslated: n.untranslated || note.untranslated };
      }),
    });
  if (on("bloodType")) sections.push({ category: "bloodType", title: t.bloodType, items: [{ text: profile.bloodType, untranslated: false }] });
  if (on("contacts"))
    sections.push({
      category: "contacts",
      title: t.contacts,
      items: profile.contacts.map(c => {
        const r = pick(lang, c.relationship, c.relationshipJa);
        return { text: c.name, detail: `${r.text} · ${c.phone}`, untranslated: r.untranslated };
      }),
    });
  return { language: lang, name, sections };
}
