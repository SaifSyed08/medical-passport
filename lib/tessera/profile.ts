import { z } from "zod";
import {
  BLOOD_TYPES,
  CATEGORIES,
  DESTINATIONS,
  LANGUAGES,
  OTHER_DESTINATION,
  TRANSLATED_FIELDS,
  TRANSLATED_LANGUAGES,
  type Allergy,
  type EmergencyItem,
  type EmergencySection,
  type EmergencyView,
  type Language,
  type Privacy,
  type Profile,
  type TranslatedLanguage,
} from "@/shared/tessera";

const s = (max: number) => z.string().trim().max(max);
const id = z.string().regex(/^[a-z]{3}_[A-Za-z0-9_-]{1,40}$/);
const tr = <F extends string>(fields: readonly F[], max: number) =>
  z
    .object(
      Object.fromEntries(
        TRANSLATED_LANGUAGES.map(l => [l, z.object(Object.fromEntries(fields.map(f => [f, s(max).optional()]))).partial().optional()]),
      ),
    )
    .partial()
    .optional();

export const languageSchema = z.enum(LANGUAGES as [Language, ...Language[]]);
export const destinationSchema = z.enum([OTHER_DESTINATION, ...DESTINATIONS.map(d => d.code)] as [string, ...string[]]);

export const allergySchema = z.object({
  id, substance: s(160).min(1), reaction: s(240), severity: z.enum(["severe", "moderate", "mild"]),
  tr: tr(TRANSLATED_FIELDS.allergies, 240),
});
export const medicationSchema = z.object({
  id, brand: s(120), generic: s(160).min(1), dose: s(160), schedule: s(160), purpose: s(200),
  tr: tr(TRANSLATED_FIELDS.medications, 200),
});
export const conditionSchema = z.object({ id, name: s(160).min(1), note: s(400), tr: tr(TRANSLATED_FIELDS.conditions, 400) });
export const contactSchema = z.object({
  id, name: s(120).min(1), relationship: s(120),
  phone: s(40).regex(/^[+0-9 ()-]{7,40}(\s*\(fictional\))?$/, "Enter a phone number using digits, spaces and +()-"),
  tr: tr(TRANSLATED_FIELDS.contacts, 120),
});
export const profileSchema = z.object({
  basics: z.object({
    sex: s(40),
    heightCm: z.number().min(30).max(260).nullable(),
    weightKg: z.number().min(1).max(500).nullable(),
    homeCountry: s(80), studyLocation: s(120), program: s(160),
    destinationCountry: destinationSchema.optional(),
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

/** Name and date of birth. DOB must be a real calendar date in the past, not before 1900. */
export const identitySchema = z.object({
  name: s(120).min(1, "Enter a name"),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
    .refine(d => {
      const t = new Date(d + "T00:00:00Z");
      return !isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
    }, "That date doesn't exist")
    .refine(d => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), "Enter a date of birth in the past"),
});

type Item = { id: string; tr?: Partial<Record<TranslatedLanguage, Record<string, string | undefined>>> } & Record<string, unknown>;

/**
 * Profiles stored before translations were generalised used `substanceJa`-style fields.
 * Convert them to `tr.ja` on read so existing data keeps its Japanese.
 */
export function upgradeProfile(raw: Profile): Profile {
  const lists = Object.keys(TRANSLATED_FIELDS) as (keyof typeof TRANSLATED_FIELDS)[];
  const out = { ...raw, basics: { ...raw.basics } } as Profile;
  for (const list of lists) {
    (out[list] as unknown as Item[]) = (raw[list] as unknown as Item[]).map(item => {
      const legacy = TRANSLATED_FIELDS[list].filter(f => typeof item[`${f}Ja`] === "string");
      if (!legacy.length) return item;
      const next: Item = { ...item, tr: { ...item.tr, ja: { ...item.tr?.ja } } };
      for (const f of legacy) {
        next.tr!.ja![f] = item[`${f}Ja`] as string;
        delete next[`${f}Ja`];
      }
      return next;
    });
  }
  return out;
}

/**
 * When a traveler edits English text, the hand-written translations of that field no longer apply.
 * Drop them (in every language) so doctors see the original marked untranslated, not a stale translation.
 * Translations for unchanged fields are kept from the stored profile.
 */
export function mergeTranslations(prev: Profile, next: Profile): Profile {
  const lists = Object.keys(TRANSLATED_FIELDS) as (keyof typeof TRANSLATED_FIELDS)[];
  const out = { ...next } as Profile;
  for (const list of lists) {
    const fields = TRANSLATED_FIELDS[list] as readonly string[];
    const old = prev[list] as unknown as Item[];
    (out[list] as unknown as Item[]) = (next[list] as unknown as Item[]).map(item => {
      const before = old.find(o => o.id === item.id);
      const kept: Item["tr"] = {};
      for (const lang of TRANSLATED_LANGUAGES) {
        const entry: Record<string, string> = {};
        for (const f of fields) {
          const value = before && before[f] === item[f] ? before.tr?.[lang]?.[f] : undefined;
          if (value) entry[f] = value;
        }
        if (Object.keys(entry).length) kept[lang] = entry;
      }
      const { tr: _ignored, ...rest } = item;
      void _ignored;
      return Object.keys(kept).length ? { ...rest, tr: kept } : rest;
    });
  }
  return out;
}

type Labels = { allergies: string; medications: string; conditions: string; bloodType: string; contacts: string; none: string; unknownBlood: string };
const labels: Record<Language, Labels> = {
  en: { allergies: "Allergies", medications: "Medications", conditions: "Conditions", bloodType: "Blood type", contacts: "Emergency contacts", none: "None recorded", unknownBlood: "Not recorded" },
  ja: { allergies: "アレルギー", medications: "服用中の薬", conditions: "持病", bloodType: "血液型", contacts: "緊急連絡先", none: "記録なし", unknownBlood: "記録なし" },
  es: { allergies: "Alergias", medications: "Medicamentos", conditions: "Enfermedades", bloodType: "Grupo sanguíneo", contacts: "Contactos de emergencia", none: "Sin registros", unknownBlood: "No registrado" },
  fr: { allergies: "Allergies", medications: "Médicaments", conditions: "Pathologies", bloodType: "Groupe sanguin", contacts: "Contacts d'urgence", none: "Aucune donnée enregistrée", unknownBlood: "Non renseigné" },
  it: { allergies: "Allergie", medications: "Farmaci", conditions: "Patologie", bloodType: "Gruppo sanguigno", contacts: "Contatti di emergenza", none: "Nessun dato registrato", unknownBlood: "Non registrato" },
  de: { allergies: "Allergien", medications: "Medikamente", conditions: "Erkrankungen", bloodType: "Blutgruppe", contacts: "Notfallkontakte", none: "Keine Angaben", unknownBlood: "Nicht angegeben" },
};
const severityLabel: Record<Language, Record<Allergy["severity"], string>> = {
  en: { severe: "Severe", moderate: "Moderate", mild: "Mild" },
  ja: { severe: "重度", moderate: "中等度", mild: "軽度" },
  es: { severe: "Grave", moderate: "Moderada", mild: "Leve" },
  fr: { severe: "Sévère", moderate: "Modérée", mild: "Légère" },
  it: { severe: "Grave", moderate: "Moderata", mild: "Lieve" },
  de: { severe: "Schwer", moderate: "Mittelschwer", mild: "Leicht" },
};

/** Text in `lang` if a translation exists; otherwise the English original, flagged as untranslated. */
function pick(lang: Language, item: Item, field: string) {
  const en = String(item[field] ?? "");
  if (lang === "en") return { text: en, untranslated: false };
  const t = item.tr?.[lang]?.[field];
  return t ? { text: t, untranslated: false } : { text: en, untranslated: !!en };
}

/**
 * What a verified clinician sees in emergency scope. Only categories the traveler marked
 * "emergency" are included, and allergies and medications always come first. An empty list is
 * shown as "None recorded" (never as "no known allergies"). Insurance, encounters and documents
 * are never part of this view.
 */
export function emergencyView(name: string, profile: Profile, privacy: Privacy, lang: Language): EmergencyView {
  const t = labels[lang];
  const sections: EmergencySection[] = [];
  const on = (c: keyof Privacy) => privacy[c] === "emergency";
  const none: EmergencyItem[] = [{ text: t.none, untranslated: false, empty: true }];
  const list = (items: EmergencyItem[]) => (items.length ? items : none);
  const items = <T,>(xs: T[]) => xs as unknown as Item[];

  if (on("allergies"))
    sections.push({
      category: "allergies",
      title: t.allergies,
      items: list(
        items(profile.allergies).map(a => {
          const sub = pick(lang, a, "substance"), re = pick(lang, a, "reaction");
          const sev = severityLabel[lang][a.severity as Allergy["severity"]];
          return { text: sub.text, detail: re.text ? `${sev} · ${re.text}` : sev, untranslated: sub.untranslated || re.untranslated, severe: a.severity === "severe" };
        }),
      ),
    });
  if (on("medications"))
    sections.push({
      category: "medications",
      title: t.medications,
      items: list(
        items(profile.medications).map(m => {
          const g = pick(lang, m, "generic"), sch = pick(lang, m, "schedule");
          return { text: `${g.text}${m.brand ? ` (${m.brand})` : ""}`, detail: [m.dose as string, sch.text].filter(Boolean).join(" · "), untranslated: g.untranslated || sch.untranslated };
        }),
      ),
    });
  if (on("conditions"))
    sections.push({
      category: "conditions",
      title: t.conditions,
      items: list(
        items(profile.conditions).map(c => {
          const n = pick(lang, c, "name"), note = pick(lang, c, "note");
          return { text: n.text, detail: note.text || undefined, untranslated: n.untranslated || note.untranslated };
        }),
      ),
    });
  if (on("bloodType"))
    sections.push({
      category: "bloodType",
      title: t.bloodType,
      items: [profile.bloodType === "Unknown" ? { text: t.unknownBlood, untranslated: false, empty: true } : { text: profile.bloodType, untranslated: false }],
    });
  if (on("contacts"))
    sections.push({
      category: "contacts",
      title: t.contacts,
      items: list(
        items(profile.contacts).map(c => {
          const r = pick(lang, c, "relationship");
          return { text: c.name as string, detail: [r.text, c.phone as string].filter(Boolean).join(" · "), untranslated: r.untranslated };
        }),
      ),
    });
  return { language: lang, name, sections };
}
