// Private mode's record check: plain rules instead of a model, small enough to run on the phone itself.
// A line is matched against a short multilingual list of risky medicine families. A match turns into an alert
// when the patient's record has an allergy to that family, or kidney trouble a family is known to worsen;
// the patient's own medicines named in the line come back as "relevant".
// Hand-written for the demo patients' risks: it knows only the families below, where the cloud model knows
// every drug. Each answer is about the latest line only, so small talk never raises anything.
import { norm } from "./drugs.mjs";
import { findMentions } from "./localInterpret.mjs";
import { FAMILIES, fixHeard } from "./families.mjs";

// Families that can hurt kidneys that are already struggling.
const KIDNEY = new Set(["nsaid", "contrast"]);
const lower = (s) => String(s || "").normalize("NFC").toLowerCase();

// Whole words only, or "explained" would hold "aine" and "डाइबिटिज" (diabetes) "डाइ" (dye). Allowed after a word:
// a plural, a longer Latin ending on long names ("ibuprofeno"), or a Nepali case ending ("डाइले", by the dye).
// Japanese has no spaces, so it is matched inside the line.
const NE_ENDINGS = "(?:ले|को|मा|बाट|लाई|हरू|हरूले)?";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = Object.entries(FAMILIES).map(([fam, words]) => [
  fam,
  words.map((w) => {
    if (/[぀-ヿ一-鿿]/.test(w)) return { w, re: new RegExp(esc(w)) };
    const tail = /[ऀ-ॿ]/.test(w) ? NE_ENDINGS : w.length >= 6 ? "\\p{L}*" : "(?:s|es)?";
    return { w, re: new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${esc(w)}${tail}(?![\\p{L}\\p{M}\\p{N}])`, "u") };
  }),
]);

function familiesIn(text) {
  const t = lower(fixHeard(text));
  const out = new Map();
  for (const [fam, words] of MATCHERS) {
    const hit = words.find(({ re }) => re.test(t));
    if (hit) out.set(fam, hit.w);
  }
  return out;
}

const L = {
  en: {
    fam: { penicillin: "penicillin", nsaid: "NSAID", contrast: "contrast dye" },
    sev: { severe: "severe", moderate: "moderate", mild: "mild" },
    allergyTitle: (f) => `${cap(f)} allergy`,
    allergyWhy: (term, f, sev) => `${term ? `${cap(term)} is in the ${f} family. ` : ""}The record lists a ${sev} ${f} allergy.`,
    kidneyTitle: "Reduced kidney function",
    kidneyWhy: { nsaid: "NSAIDs can worsen kidney function.", contrast: "Contrast can harm the kidneys; check eGFR first." },
    ownWhy: "On the patient's medication list.",
    allergic: "Allergy on record",
  },
  es: {
    fam: { penicillin: "penicilina", nsaid: "AINE", contrast: "medio de contraste" },
    sev: { severe: "grave", moderate: "moderada", mild: "leve" },
    allergyTitle: (f) => `Alergia a ${f}`,
    allergyWhy: (term, f, sev) => `${term ? `${cap(term)} pertenece al grupo de ${f}. ` : ""}El expediente registra alergia ${sev} a ${f}.`,
    kidneyTitle: "Función renal reducida",
    kidneyWhy: { nsaid: "Los AINE pueden empeorar la función renal.", contrast: "El contraste puede dañar los riñones; revise la TFGe." },
    ownWhy: "En la lista de medicamentos del paciente.",
    allergic: "Alergia registrada",
  },
  ja: {
    fam: { penicillin: "ペニシリン", nsaid: "NSAIDs", contrast: "造影剤" },
    sev: { severe: "重度", moderate: "中等度", mild: "軽度" },
    allergyTitle: (f) => `${f}アレルギー`,
    allergyWhy: (term, f, sev) => `${term ? `${term}は${f}系です。` : ""}記録に${sev}の${f}アレルギーがあります。`,
    kidneyTitle: "腎機能低下",
    kidneyWhy: { nsaid: "NSAIDsは腎機能を悪化させることがあります。", contrast: "造影剤は腎臓に負担をかけます。eGFRを確認してください。" },
    ownWhy: "患者の服用薬リストにあります。",
    allergic: "アレルギー記録あり",
  },
  ne: {
    fam: { penicillin: "पेनिसिलिन", nsaid: "NSAID", contrast: "कन्ट्रास्ट डाइ" },
    sev: { severe: "गम्भीर", moderate: "मध्यम", mild: "हल्का" },
    allergyTitle: (f) => `${f} एलर्जी`,
    allergyWhy: (term, f, sev) => `${term ? `${term} ${f} समूहको हो। ` : ""}रेकर्डमा ${sev} ${f} एलर्जी छ।`,
    kidneyTitle: "मृगौलाको कार्य कम",
    kidneyWhy: { nsaid: "NSAID ले मृगौलाको कार्य बिगार्न सक्छ।", contrast: "कन्ट्रास्टले मृगौलालाई हानि गर्न सक्छ।" },
    ownWhy: "बिरामीको औषधि सूचीमा छ।",
    allergic: "एलर्जी रेकर्डमा छ",
  },
};
const cap = (s) => (/^[a-z]/.test(s) ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Record items worth showing the clinician for one line, newest line only.
 * @returns {{id: string, level: "alert"|"relevant", title: string, detail: string, why: string}[]}
 */
export function contextByRules({ record, text, speaker, doctorLang }) {
  const T = L[doctorLang] || L.en;
  const sameLang = (record?.patient?.recordLanguage || "") === doctorLang;
  const allergies = Array.isArray(record?.allergies) ? record.allergies : [];
  const meds = Array.isArray(record?.medications) ? record.medications : [];
  const conditions = Array.isArray(record?.conditions) ? record.conditions : [];
  const labs = Array.isArray(record?.labs) ? record.labs : [];

  const fams = familiesIn(text);
  // The patient's own medicines named in the line, by brand or generic, misheard or in another script.
  const mentions = findMentions(fixHeard(text), meds);
  const own = meds.filter((m) => mentions.some((x) => x.med?.id === m.id));
  for (const x of mentions) if (x.entry && !x.med) for (const [f, w] of familiesIn(`${x.name} ${x.entry.generic}`)) if (!fams.has(f)) fams.set(f, x.name || w);
  // Misheard family members ("Dyklophenac") come back from the name finder spelled properly.
  for (const x of mentions) if (x.family && !fams.has(x.family)) fams.set(x.family, x.name);
  // What the own medicines contain counts too: Flexon is ibuprofen, so it is an NSAID.
  for (const m of own) for (const [f, w] of familiesIn(`${m.name} ${m.generic}`)) if (!fams.has(f)) fams.set(f, w === lower(m.name) ? m.name : w);

  const items = [];
  const add = (it) => !items.some((x) => x.id === it.id) && items.push(it);

  for (const [fam, term] of fams) {
    for (const a of allergies) {
      if (!familiesIn(`${a.substance} ${a.reaction}`).has(fam)) continue;
      const f = T.fam[fam];
      add({
        id: a.id,
        level: "alert",
        title: T.allergyTitle(f),
        detail: sameLang ? a.reaction : `${a.substance} · ${T.allergic}`,
        // Name the medicine when the clinician said it; a patient's word may be in the other language.
        why: T.allergyWhy(speaker === "clinician" ? term : "", f, T.sev[a.severity] || a.severity || ""),
      });
    }
    if (KIDNEY.has(fam)) {
      const ckd = conditions.find((c) => /renal|kidney|ckd|\berc\b|腎|मृगौला/i.test(`${c.name} ${c.id}`));
      const gfr = labs.find((l) => /gfr|tfg|filtrado/i.test(`${l.name} ${l.id}`) && l.flag === "L");
      const cr = labs.find((l) => /creat/i.test(`${l.name} ${l.id}`) && l.flag === "H");
      const lab = gfr || cr;
      if (ckd || lab) {
        add({
          id: (lab || ckd).id,
          level: "alert",
          title: T.kidneyTitle,
          detail: [lab ? `${lab.name} ${lab.value} ${lab.unit}` : "", ckd ? ckd.name : ""].filter(Boolean).join(" · "),
          why: T.kidneyWhy[fam],
        });
      }
    }
  }
  for (const m of own) {
    add({ id: m.id, level: "relevant", title: m.name, detail: [m.generic, m.dose, m.schedule].filter(Boolean).join(" · "), why: T.ownWhy });
  }
  // Alerts first, at most three cards, like the cloud path.
  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === "alert" ? -1 : 1)).slice(0, 3);
}

export { familiesIn, norm };
