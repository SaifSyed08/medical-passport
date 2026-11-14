// The two demo patients. Fully fictional: no real people, phone numbers or records.
// The original file was never committed (the old `data/` ignore rule swallowed src/data/). This copy is
// reconstructed: Jordan from the medical passport seed (lib/tessera/seed-data.ts), and both records from the
// items the recorded demos in public/demo/*.json cite. Every id those recordings reference exists here.
import type { Persona } from "../lib/types";

export const sofia: Persona = {
  id: "sofia",
  name: "Sofía Hernández",
  initials: "SH",
  dob: "1967-05-21",
  sex: "Female",
  bloodType: "O+",
  language: "es",
  home: "MX",
  trip: { country: "US", city: "Austin, Texas", doctorLanguage: "en", reason: "Visiting family" },
  recordLanguage: "es",
  allergies: [
    {
      id: "alg_penicilina",
      substance: "Penicilina (amoxicilina, ampicilina)",
      reaction: "Anafilaxia en 2018: urticaria generalizada, dificultad para respirar, presión arterial baja",
      severity: "severe",
      since: "2018",
    },
  ],
  medications: [
    { id: "med_glucophage", name: "Glucophage 850 mg", generic: "metformina 850 mg", dose: "1 tableta", schedule: "Dos veces al día con alimentos", purpose: "Diabetes tipo 2" },
    { id: "med_cozaar", name: "Cozaar 50 mg", generic: "losartán 50 mg", dose: "1 tableta", schedule: "Una vez al día", purpose: "Hipertensión arterial y protección renal" },
    { id: "med_aspirina", name: "Aspirina Protect 100 mg", generic: "ácido acetilsalicílico 100 mg", dose: "1 tableta", schedule: "Una vez al día", purpose: "Prevención cardiovascular" },
    { id: "med_ventolin", name: "Ventolin inhalador", generic: "salbutamol 100 µg/dosis", dose: "2 inhalaciones", schedule: "Cada 4 horas si es necesario", purpose: "Inhalador de rescate para el asma" },
    { id: "med_neomelubrina", name: "Neo-Melubrina 500 mg", generic: "metamizol sódico 500 mg", dose: "1 tableta", schedule: "Cada 8 horas si hay dolor o fiebre", purpose: "Dolor y fiebre" },
  ],
  conditions: [
    { id: "cnd_asma", name: "Asma persistente leve", since: "Infancia", note: "Visita a urgencias en marzo de 2025 por crisis asmática." },
    { id: "cnd_erc", name: "Enfermedad renal crónica estadio 3b", since: "2024", note: "TFGe 44 mL/min/1.73 m², potasio 5.2 mmol/L (agosto de 2026). Ajustar dosis de medicamentos; precaución con medio de contraste y AINE." },
    { id: "cnd_dm2", name: "Diabetes tipo 2", since: "2012", note: "Controlada con metformina." },
    { id: "cnd_hta", name: "Hipertensión arterial", since: "2015", note: "Controlada con losartán." },
  ],
  labs: [
    { id: "lab_hba1c", name: "Hemoglobina glucosilada (HbA1c)", value: "7.1", unit: "%", ref: "<7.0", flag: "H", date: "2026-08-14", source: "Laboratorio Clínico Guadalajara (ficticio)" },
    { id: "lab_glucosa", name: "Glucosa en ayuno", value: "132", unit: "mg/dL", ref: "70–99", flag: "H", date: "2026-08-14", source: "Laboratorio Clínico Guadalajara (ficticio)" },
    { id: "lab_creatinina", name: "Creatinina sérica", value: "1.4", unit: "mg/dL", ref: "0.5–1.1", flag: "H", date: "2026-08-14", source: "Laboratorio Clínico Guadalajara (ficticio)" },
    { id: "lab_tfge", name: "TFGe", value: "44", unit: "mL/min/1.73 m²", ref: ">60", flag: "L", date: "2026-08-14", source: "Laboratorio Clínico Guadalajara (ficticio)" },
    { id: "lab_potasio", name: "Potasio", value: "5.2", unit: "mmol/L", ref: "3.5–5.0", flag: "H", date: "2026-08-14", source: "Laboratorio Clínico Guadalajara (ficticio)" },
  ],
  documents: [
    {
      id: "doc_urgencias_2025",
      kind: "visit",
      title: "Urgencias: crisis asmática",
      date: "2025-03-09",
      facility: "Hospital Civil de Guadalajara (ficticio)",
      body: "Disnea y sibilancias de inicio nocturno. Mejoró con salbutamol nebulizado y prednisona oral por 5 días. Alta con indicación de llevar siempre el inhalador de rescate.",
    },
  ],
  contacts: [{ id: "con_luis", name: "Luis Hernández", relationship: "Hijo (en Austin)", phone: "+1 512 555 0136" }],
  script: [
    { speaker: "patient", text: "Hola doctor. Eh, desde anoche me duele mucho el pecho y... me cuesta respirar.", shows: "Live captions, cleanup, asthma history from the record" },
    { speaker: "patient", text: "Tomé dos Neo-Melubrinas y usé mi Ventolin, pero no me ayudó.", shows: "Ventolin → albuterol; metamizole flagged as not sold in the US" },
    { speaker: "clinician", text: "I'd like to start you on amoxicilina and get a CT scan with contrast.", shows: "Penicillin anaphylaxis and eGFR 44 alerts" },
    { speaker: "clinician", text: "Can you take ibuprofen for the pain?", shows: "Kidney disease alert for an NSAID" },
  ],
};

export const jordan: Persona = {
  id: "jordan",
  name: "Jordan Rivera",
  initials: "JR",
  dob: "2004-03-12",
  sex: "Male",
  bloodType: "O-",
  language: "en",
  home: "US",
  trip: { country: "JP", city: "Tokyo", doctorLanguage: "ja", reason: "Semester exchange program" },
  recordLanguage: "en",
  allergies: [
    { id: "alg_penicillin", substance: "Penicillin-class antibiotics (amoxicillin)", reaction: "Anaphylaxis (2019): throat swelling, low blood pressure", severity: "severe", since: "2019" },
    { id: "alg_kiwi", substance: "Kiwi fruit", reaction: "Itching of mouth and lips", severity: "mild" },
  ],
  medications: [
    { id: "med_lantus", name: "Lantus", generic: "insulin glargine", dose: "18 units, subcutaneous", schedule: "Once daily at 10 PM", purpose: "Long-acting insulin for type 1 diabetes" },
    { id: "med_humalog", name: "Humalog", generic: "insulin lispro", dose: "1 unit per 10 g carbohydrate, subcutaneous", schedule: "With meals", purpose: "Rapid-acting insulin for type 1 diabetes" },
    { id: "med_proair", name: "ProAir HFA", generic: "albuterol (salbutamol) 90 mcg/actuation", dose: "2 puffs, inhaled", schedule: "As needed for wheezing, up to every 4 hours", purpose: "Rescue inhaler for asthma" },
    { id: "med_baqsimi", name: "Baqsimi", generic: "glucagon nasal powder 3 mg", dose: "3 mg, one spray into one nostril", schedule: "Emergency only: severe low blood sugar", purpose: "Emergency treatment of severe hypoglycemia" },
  ],
  conditions: [
    { id: "cnd_t1d", name: "Type 1 diabetes", since: "2013", note: "Uses insulin pen injections. History of diabetic ketoacidosis (2023)." },
    { id: "cnd_asthma", name: "Asthma, moderate persistent", note: "Triggered by exercise and cold air. Last urgent visit 2025." },
  ],
  labs: [
    { id: "lab_ketones", name: "Blood ketones (during DKA)", value: "4.8", unit: "mmol/L", ref: "<0.6", flag: "H", date: "2023-11-04", source: "Hill Country General Hospital (fictional)" },
  ],
  documents: [
    {
      id: "rec_dka_2023",
      kind: "visit",
      title: "Emergency admission: diabetic ketoacidosis",
      date: "2023-11-04",
      facility: "Hill Country General Hospital (fictional)",
      body: "Admitted 2 days for mild DKA after a missed basal insulin dose during illness. Treated with IV fluids and insulin infusion. Discharged on prior regimen with sick-day education.",
    },
    {
      id: "rec_asthma_2025",
      kind: "visit",
      title: "Urgent care: asthma exacerbation",
      date: "2025-01-18",
      facility: "Riverbend Urgent Care (fictional)",
      body: "Wheezing after outdoor exercise in cold weather. Improved with nebulized albuterol. Advised to carry rescue inhaler at all times.",
    },
    {
      id: "doc_allergy_letter",
      kind: "document",
      title: "Allergy clinic letter: penicillin",
      date: "2019-09-12",
      facility: "Lakeside Allergy Clinic (fictional)",
      body: "History of anaphylaxis to amoxicillin. Avoid all penicillin-class antibiotics. Alert all treating clinicians before any antibiotic is given.",
    },
  ],
  contacts: [{ id: "con_maria", name: "Maria Rivera", relationship: "Mother (in the United States)", phone: "+1 512 555 0174" }],
  script: [
    { speaker: "patient", text: "Um, I've been throwing up since this morning, and I couldn't keep my Lantus down. I mean, I skipped my Lantus.", shows: "Self-correction cleanup; diabetes and DKA history" },
    { speaker: "patient", text: "I also used my ProAir twice because my chest felt tight.", shows: "ProAir → サルブタモール; asthma from the record" },
    { speaker: "clinician", text: "抗生物質としてアモキシシリンを出しますね。", shows: "Penicillin anaphylaxis alert" },
  ],
};

export const PERSONAS: Persona[] = [sofia, jordan];

/** Personas with a recorded run in public/demo/. */
export const hasDemo = (id: string) => PERSONAS.some((p) => p.id === id);
