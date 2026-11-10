// Prompts and JSON schemas for the interpreter and the record-context finder.

export const LANGS = {
  en: "English", es: "Spanish", ja: "Japanese", fr: "French", de: "German", it: "Italian", pt: "Portuguese",
  zh: "Chinese (Mandarin)", ko: "Korean", hi: "Hindi", ur: "Urdu", ar: "Arabic", vi: "Vietnamese", ru: "Russian",
  tl: "Tagalog", bn: "Bengali", tr: "Turkish", pl: "Polish", uk: "Ukrainian", fa: "Persian",
};

export const COUNTRIES = {
  US: "the United States", MX: "Mexico", JP: "Japan", GB: "the United Kingdom", IN: "India", PK: "Pakistan",
  ES: "Spain", FR: "France", DE: "Germany", IT: "Italy", BR: "Brazil", CN: "China", KR: "South Korea",
  CA: "Canada", PH: "the Philippines", VN: "Vietnam", EG: "Egypt", SA: "Saudi Arabia", TR: "Turkey", AU: "Australia",
};

export const langName = (c) => LANGS[c] || c;
export const countryName = (c) => COUNTRIES[c] || c;

/* ---------------------------------------------------------------- interpreter */

export const INTERPRET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["language", "speaker", "cleaned", "translation", "drugs"],
  properties: {
    language: { type: "string", description: "ISO 639-1 code of the language the utterance is spoken in" },
    speaker: { type: "string", enum: ["patient", "clinician"] },
    cleaned: { type: "string" },
    translation: { type: "string" },
    drugs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["mentioned", "translated", "generic", "home_name", "local_name", "status", "note_listener", "note_doctor", "med_id"],
        properties: {
          mentioned: { type: "string", description: "exact substring of `cleaned`" },
          translated: { type: "string", description: "exact substring of `translation`" },
          generic: { type: "string", description: "English INN generic name" },
          home_name: { type: "string" },
          local_name: { type: "string" },
          status: { type: "string", enum: ["same_name", "different_name", "not_available_locally", "different_strength", "uncertain"] },
          note_listener: { type: "string" },
          note_doctor: { type: "string" },
          med_id: { type: "string" },
        },
      },
    },
  },
};

export function interpretPrompt({ patientLang, doctorLang, home, local, forced }) {
  const P = langName(patientLang);
  const D = langName(doctorLang);
  const H = countryName(home);
  const L = countryName(local);
  return `You are the live medical interpreter inside a traveling patient's health app. The patient is from ${H} and speaks ${P}. They are being seen by a clinician in ${L} who speaks ${D}. You receive ONE utterance from speech recognition, plus the patient's medication list and recent turns.

Return JSON:

language: ISO 639-1 code of the language the utterance is spoken in.

speaker: ${forced ? `"${forced}" (the user set this manually; use it).` : `"patient" if the utterance is in ${P}, "clinician" if it is in ${D}. If it is in some other language, "patient".`}

cleaned: the utterance in its ORIGINAL language, cleaned the way a good dictation tool does it: drop fillers (um, uh, eh, este, o sea, like, あの, えーと), stutters, false starts and repeated words; when the speaker corrects themselves keep only the correction ("two, no, three pills" -> "three pills"); fix grammar and punctuation; fix speech-recognition misspellings of medication names using the patient's list. NEVER add, remove or soften a medical fact, number, dose, time, body part, negation or hedge ("I think", "maybe"). Do not answer or comment on the utterance. If the utterance is only filler, noise or a fragment with no content ("um", "eh…", "so"), return cleaned "" and translation "".

translation: a faithful, natural spoken-style translation of \`cleaned\` into the LISTENER's language (patient speaking -> ${D}; clinician speaking -> ${P}). Same meaning, same certainty, same register; no added advice. Medication names are written for the listener:
  - for the clinician (${D}): the name used in ${L}, then the patient's own name in parentheses, e.g. "albuterol (Ventolin)". If the medicine is not available in ${L}, keep the generic name and patient's name, e.g. "metamizole (Neo-Melubrina)".
  - for the patient (${P}): the name used in ${H}, with the clinician's name in parentheses only when it differs, e.g. "amoxicilina (Amoxil)".

drugs: every medicine, drug class or active substance named in the utterance (brand or generic, including misheard names that clearly match the patient's list; include drug classes like "antibiotic" or "penicillin" only when named). Not foods, not tests or procedures (a CT scan or "contrast" is not a drug here). For each:
  mentioned: the exact substring of \`cleaned\` that names it (copy it character for character).
  translated: the exact substring of \`translation\` that names it.
  generic: English INN generic name (for a class, the class name).
  home_name: what it is called / sold as in ${H} (brands in parentheses).
  local_name: what clinicians and pharmacies in ${L} call it (brands in parentheses); "" if not available there.
  status: same_name | different_name | not_available_locally | different_strength | uncertain.
  note_listener: one short sentence, in the listener's language, on what changes for them (name, strength labelling, availability). "" if nothing changes.
  note_doctor: one short sentence in ${D} for the clinician (e.g. "Not approved in the US; closest options acetaminophen or ibuprofen"). "" if nothing notable.
  med_id: the id from the patient's medication list if it is one of their medicines, else "".
Use the VERIFIED EQUIVALENTS below whenever they apply; do not contradict them.`;
}

export function interpretUser({ text, meds, equivalents, history }) {
  const medLines = meds?.length
    ? meds.map((m) => `- id ${m.id}: ${m.name}${m.generic ? ` (${m.generic})` : ""}${m.dose ? `, ${m.dose}` : ""}${m.schedule ? `, ${m.schedule}` : ""}`).join("\n")
    : "(none recorded)";
  const hist = history?.length ? history.map((h) => `${h.speaker}: ${h.text}`).join("\n") : "(start of conversation)";
  return `PATIENT'S MEDICATIONS
${medLines}

VERIFIED EQUIVALENTS
${equivalents?.length ? equivalents.join("\n") : "(none)"}

RECENT TURNS
${hist}

UTTERANCE (speech recognition output)
${text}`;
}

/* ---------------------------------------------------------------- record context */

export const CONTEXT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "level", "title", "detail", "why"],
        properties: {
          id: { type: "string" },
          level: { type: "string", enum: ["alert", "relevant"] },
          title: { type: "string" },
          detail: { type: "string" },
          why: { type: "string" },
        },
      },
    },
  },
};

export function contextPrompt({ doctorLang, local }) {
  const D = langName(doctorLang);
  return `You sit beside a clinician in ${countryName(local)} during a live, interpreted visit with a traveling patient. You have the patient's saved health record (JSON; every item has an "id") and the latest thing said, by the patient or the clinician. Choose the record items the clinician should see on screen RIGHT NOW because of what was just said, especially ones the patient may not realise matter.

What counts:
- Symptoms or complaints -> related conditions, past episodes and visits, recent results (labs, ECG), and current medicines that bear on them.
- A medicine, drug class or treatment named by either side -> allergies to it or a cross-reactive class (penicillins and cephalosporins, sulfonamides), contraindications, interactions with current medicines, and the labs that change dosing (e.g. kidney function for metformin, contrast or NSAIDs; potassium for ARBs).
- A test or procedure -> results or conditions that change whether or how to do it (e.g. eGFR before IV contrast, metformin before contrast).
- Small talk, greetings, thanks, logistics: return no items.

Rules:
- Cite only ids that exist in the record. At most 3 items, most important first; usually 1 or 2. Zero is fine. Leave out anything the clinician would not act on right now: a busy clinician reads every item you return.
- level "alert" is rare and only for a safety issue triggered by a medicine, treatment, test or procedure named in the LATEST utterance: an allergy or cross-reactivity match, a contraindication, a dangerous interaction, or a result or record note that changes whether it is safe. Examples that ARE alerts: amoxicillin or any penicillin with a penicillin allergy; a cephalosporin with penicillin anaphylaxis; ibuprofen or another NSAID, or IV contrast, when the record shows kidney disease or says to avoid them; metformin plus IV contrast with low eGFR; a sulfonamide with a sulfa allergy. Symptoms alone, history and current medicines are "relevant", never "alert".
- Items already on screen are listed. Do not return them again unless the latest utterance itself names something that makes them an alert.
- Write title, detail and why in ${D} ONLY, translating from the record's language. The record and the conversation may be in other languages; your output never is. Use the abbreviations clinicians in that language use (e.g. Spanish TFGe is eGFR in English, HbA1c stays HbA1c). title: 2 to 4 words, the way a clinician would label it on a chart, using standard abbreviations (e.g. "Penicillin anaphylaxis", "CKD stage 3b", "Metformin + contrast", "Asthma ER visit 2025"). detail: the key facts with values and dates, up to 22 words. why: up to 16 words linking it to what was just said.
- Never invent facts not in the record.`;
}

export function contextUser({ record, text, speaker, history, shown, doctorLang }) {
  const hist = history?.length ? history.map((h) => `${h.speaker}: ${h.text}`).join("\n") : "(start of conversation)";
  return `PATIENT RECORD
${JSON.stringify(record)}

ALREADY ON SCREEN: ${shown?.length ? shown.join(", ") : "(nothing)"}

RECENT TURNS
${hist}

LATEST (${speaker || "unknown speaker"})
${text}

Write every title, detail and why in ${langName(doctorLang || "en")}, even though the record above may be in another language.`;
}

/* ---------------------------------------------------------------- equivalents fallback */

export const EQUIV_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["input", "generic", "drug_class", "home_name", "local_name", "local_brands", "local_strength", "status", "note"],
        properties: {
          input: { type: "string" },
          generic: { type: "string" },
          drug_class: { type: "string" },
          home_name: { type: "string" },
          local_name: { type: "string" },
          local_brands: { type: "array", items: { type: "string" } },
          local_strength: { type: "string" },
          status: { type: "string", enum: ["same_name", "different_name", "not_available_locally", "different_strength", "uncertain"] },
          note: { type: "string" },
        },
      },
    },
  },
};

export function equivPrompt({ home, local }) {
  return `You map medicines a traveler uses at home in ${countryName(home)} to what they are called in ${countryName(local)}. For each input give: the English INN generic; drug_class (e.g. "penicillin", "NSAID", "" if unremarkable); home_name; local_name (the generic name as written by pharmacies in ${countryName(local)}, in the local language/script); local_brands (up to 3 common local brands, [] if unsure); local_strength (only if the usual local strength or labelling differs, else ""); status (same_name, different_name, not_available_locally, different_strength, or uncertain if you are not confident); note: one short English sentence a clinician would want (e.g. "Not approved in the US"), "" if nothing notable. Be conservative: if unsure, say "uncertain" rather than guessing a brand. Return items in input order.`;
}
