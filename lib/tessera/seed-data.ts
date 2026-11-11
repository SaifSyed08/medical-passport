// Fully fictional demo traveler. No real people, phone numbers or member IDs.
// All translations (ja, es, fr, it, de) are hand-written and unreviewed: see TRANSLATION_REVIEW.md.
import { DEFAULT_PRIVACY, type Privacy, type Profile } from "@/shared/tessera";

export const JORDAN_ID = "trv_jordan_rivera";
export const DEMO_LOGIN_CODE = "jordan-rivera";
export const BLANK_LOGIN_CODE = "blank";

export const jordan = {
  id: JORDAN_ID,
  name: "Jordan Rivera",
  dob: "2004-03-12",
  language: "ja" as const,
  privacy: { ...DEFAULT_PRIVACY } satisfies Privacy,
};

export const jordanProfile: Profile = {
  basics: {
    sex: "Male",
    heightCm: 178,
    weightKg: 72,
    homeCountry: "United States",
    studyLocation: "Tokyo, Japan",
    program: "Fictional semester exchange program (demo)",
    destinationCountry: "JP",
  },
  bloodType: "O-",
  allergies: [
    {
      id: "alg_penicillin",
      substance: "Penicillin-class antibiotics (amoxicillin)",
      reaction: "Anaphylaxis (2019): throat swelling, low blood pressure",
      severity: "severe",
      tr: {
        ja: { substance: "ペニシリン系抗菌薬（アモキシシリン）", reaction: "アナフィラキシー（2019年）：喉の腫れ、血圧低下" },
        es: { substance: "Antibióticos del grupo de la penicilina (amoxicilina)", reaction: "Anafilaxia (2019): inflamación de la garganta, presión arterial baja" },
        fr: { substance: "Antibiotiques de la famille des pénicillines (amoxicilline)", reaction: "Anaphylaxie (2019) : gonflement de la gorge, hypotension" },
        it: { substance: "Antibiotici della classe delle penicilline (amoxicillina)", reaction: "Anafilassi (2019): gonfiore della gola, pressione bassa" },
        de: { substance: "Antibiotika der Penicillin-Gruppe (Amoxicillin)", reaction: "Anaphylaxie (2019): Schwellung im Hals, niedriger Blutdruck" },
      },
    },
    {
      id: "alg_kiwi",
      substance: "Kiwi fruit",
      reaction: "Itching of mouth and lips",
      severity: "mild",
      tr: {
        ja: { substance: "キウイフルーツ", reaction: "口や唇のかゆみ" },
        es: { substance: "Kiwi", reaction: "Picor en la boca y los labios" },
        fr: { substance: "Kiwi", reaction: "Démangeaisons de la bouche et des lèvres" },
        it: { substance: "Kiwi", reaction: "Prurito alla bocca e alle labbra" },
        de: { substance: "Kiwi", reaction: "Juckreiz an Mund und Lippen" },
      },
    },
  ],
  medications: [
    {
      id: "med_lantus",
      brand: "Lantus",
      generic: "insulin glargine",
      dose: "18 units, subcutaneous",
      schedule: "Once daily at 10 PM",
      purpose: "Long-acting insulin for type 1 diabetes",
      tr: {
        ja: { generic: "インスリン グラルギン", schedule: "1日1回 午後10時", purpose: "1型糖尿病の持効型インスリン" },
        es: { generic: "insulina glargina", schedule: "Una vez al día a las 22:00", purpose: "Insulina de acción prolongada para diabetes tipo 1" },
        fr: { generic: "insuline glargine", schedule: "Une fois par jour à 22 h", purpose: "Insuline à action prolongée pour diabète de type 1" },
        it: { generic: "insulina glargine", schedule: "Una volta al giorno alle 22:00", purpose: "Insulina a lunga durata d'azione per diabete di tipo 1" },
        de: { generic: "Insulin glargin", schedule: "Einmal täglich um 22 Uhr", purpose: "Langwirksames Insulin bei Typ-1-Diabetes" },
      },
    },
    {
      id: "med_humalog",
      brand: "Humalog",
      generic: "insulin lispro",
      dose: "1 unit per 10 g carbohydrate, subcutaneous",
      schedule: "With meals",
      purpose: "Rapid-acting insulin for type 1 diabetes",
      tr: {
        ja: { generic: "インスリン リスプロ", schedule: "食事時", purpose: "1型糖尿病の超速効型インスリン" },
        es: { generic: "insulina lispro", schedule: "Con las comidas", purpose: "Insulina de acción rápida para diabetes tipo 1" },
        fr: { generic: "insuline lispro", schedule: "Aux repas", purpose: "Insuline à action rapide pour diabète de type 1" },
        it: { generic: "insulina lispro", schedule: "Ai pasti", purpose: "Insulina ad azione rapida per diabete di tipo 1" },
        de: { generic: "Insulin lispro", schedule: "Zu den Mahlzeiten", purpose: "Schnellwirksames Insulin bei Typ-1-Diabetes" },
      },
    },
    {
      id: "med_proair",
      brand: "ProAir HFA",
      generic: "albuterol (salbutamol) 90 mcg/actuation",
      dose: "2 puffs, inhaled",
      schedule: "As needed for wheezing, up to every 4 hours",
      purpose: "Rescue inhaler for asthma",
      tr: {
        ja: { generic: "サルブタモール（米国名：アルブテロール）90 μg/噴霧", schedule: "喘鳴時に頓用、4時間ごとまで", purpose: "喘息発作時の吸入薬" },
        es: { generic: "salbutamol (albuterol en EE. UU.) 90 mcg/inhalación", schedule: "Según necesidad si hay sibilancias, como máximo cada 4 horas", purpose: "Inhalador de rescate para el asma" },
        fr: { generic: "salbutamol (albutérol aux États-Unis) 90 µg/bouffée", schedule: "Si besoin en cas de sifflements, au maximum toutes les 4 heures", purpose: "Inhalateur de secours pour l'asthme" },
        it: { generic: "salbutamolo (albuterolo negli USA) 90 mcg/erogazione", schedule: "Al bisogno in caso di respiro sibilante, al massimo ogni 4 ore", purpose: "Inalatore di soccorso per l'asma" },
        de: { generic: "Salbutamol (in den USA Albuterol) 90 µg/Hub", schedule: "Bei Bedarf bei pfeifender Atmung, höchstens alle 4 Stunden", purpose: "Notfallspray bei Asthma" },
      },
    },
    {
      id: "med_baqsimi",
      brand: "Baqsimi",
      generic: "glucagon nasal powder 3 mg",
      dose: "3 mg, one spray into one nostril",
      schedule: "Emergency only: severe low blood sugar",
      purpose: "Emergency treatment of severe hypoglycemia",
      tr: {
        ja: { generic: "グルカゴン点鼻粉末剤 3 mg", schedule: "緊急時のみ：重症低血糖", purpose: "重症低血糖の緊急治療" },
        es: { generic: "glucagón en polvo nasal 3 mg", schedule: "Solo en emergencia: hipoglucemia grave", purpose: "Tratamiento de emergencia de la hipoglucemia grave" },
        fr: { generic: "glucagon en poudre nasale 3 mg", schedule: "Uniquement en urgence : hypoglycémie sévère", purpose: "Traitement d'urgence de l'hypoglycémie sévère" },
        it: { generic: "glucagone polvere nasale 3 mg", schedule: "Solo in emergenza: ipoglicemia grave", purpose: "Trattamento d'emergenza dell'ipoglicemia grave" },
        de: { generic: "Glucagon-Nasenpulver 3 mg", schedule: "Nur im Notfall: schwere Unterzuckerung", purpose: "Notfallbehandlung schwerer Hypoglykämie" },
      },
    },
  ],
  conditions: [
    {
      id: "cnd_t1d",
      name: "Type 1 diabetes",
      note: "Diagnosed 2013. Uses insulin pen injections. History of diabetic ketoacidosis (2023).",
      tr: {
        ja: { name: "1型糖尿病", note: "2013年に診断。インスリンペン注射を使用。糖尿病性ケトアシドーシスの既往（2023年）。" },
        es: { name: "Diabetes tipo 1", note: "Diagnosticada en 2013. Usa plumas de insulina. Antecedente de cetoacidosis diabética (2023)." },
        fr: { name: "Diabète de type 1", note: "Diagnostiqué en 2013. Utilise des stylos à insuline. Antécédent d'acidocétose diabétique (2023)." },
        it: { name: "Diabete di tipo 1", note: "Diagnosticato nel 2013. Usa penne per insulina. Pregressa chetoacidosi diabetica (2023)." },
        de: { name: "Typ-1-Diabetes", note: "2013 diagnostiziert. Verwendet Insulin-Pens. Diabetische Ketoazidose in der Vorgeschichte (2023)." },
      },
    },
    {
      id: "cnd_asthma",
      name: "Asthma, moderate persistent",
      note: "Triggered by exercise and cold air. Last urgent visit 2025.",
      tr: {
        ja: { name: "喘息（中等症持続型）", note: "運動と冷気で誘発。最後の救急受診は2025年。" },
        es: { name: "Asma persistente moderada", note: "Desencadenada por el ejercicio y el aire frío. Última visita de urgencia en 2025." },
        fr: { name: "Asthme persistant modéré", note: "Déclenché par l'effort et l'air froid. Dernière consultation en urgence en 2025." },
        it: { name: "Asma persistente moderato", note: "Scatenato da esercizio fisico e aria fredda. Ultima visita urgente nel 2025." },
        de: { name: "Mittelgradiges persistierendes Asthma", note: "Ausgelöst durch Belastung und kalte Luft. Letzter Notfallbesuch 2025." },
      },
    },
  ],
  contacts: [
    {
      id: "con_maria",
      name: "Maria Rivera",
      relationship: "Mother (in the United States)",
      phone: "+1 512 555 0174",
      tr: {
        ja: { relationship: "母（米国在住）" },
        es: { relationship: "Madre (en Estados Unidos)" },
        fr: { relationship: "Mère (aux États-Unis)" },
        it: { relationship: "Madre (negli Stati Uniti)" },
        de: { relationship: "Mutter (in den USA)" },
      },
    },
    {
      id: "con_program",
      name: "Program office (fictional)",
      relationship: "Study abroad coordinator in Tokyo",
      phone: "+81 3 0000 0000 (fictional)",
      tr: {
        ja: { relationship: "東京の留学コーディネーター" },
        es: { relationship: "Coordinación del programa en Tokio" },
        fr: { relationship: "Coordination du programme à Tokyo" },
        it: { relationship: "Coordinamento del programma a Tokyo" },
        de: { relationship: "Programmkoordination in Tokio" },
      },
    },
  ],
  insurance: {
    plan: "Fictional Global Student Health Plan",
    memberId: "DEMO-0000-0000",
    group: "STUDY-ABROAD-DEMO",
    phone: "+1 512 555 0199",
  },
};

/** What a blank (user-test) profile starts with: nothing recorded. */
export function blankProfile(): Profile {
  return {
    basics: { sex: "", heightCm: null, weightKg: null, homeCountry: "", studyLocation: "", program: "" },
    bloodType: "Unknown",
    allergies: [],
    medications: [],
    conditions: [],
    contacts: [],
    insurance: { plan: "", memberId: "", group: "", phone: "" },
  };
}

export const jordanRecords = [
  {
    id: "rec_dka_2023",
    kind: "encounter",
    title: "Emergency admission: diabetic ketoacidosis",
    date: "2023-11-04",
    facility: "Hill Country General Hospital (fictional)",
    body: "Admitted 2 days for mild DKA after a missed basal insulin dose during illness. Treated with IV fluids and insulin infusion. Discharged on prior regimen with sick-day education.",
  },
  {
    id: "rec_asthma_2025",
    kind: "encounter",
    title: "Urgent care: asthma exacerbation",
    date: "2025-01-18",
    facility: "Riverbend Urgent Care (fictional)",
    body: "Wheezing after outdoor exercise in cold weather. Improved with nebulized albuterol. Advised to carry rescue inhaler at all times.",
  },
  {
    id: "doc_vaccines",
    kind: "document",
    title: "Vaccination record",
    date: "2025-07-30",
    facility: "Campus Health Center (fictional)",
    body: "Tdap 2022 · MMR (2 doses) · Hepatitis A (2 doses) · Hepatitis B (3 doses) · Influenza 2025 · COVID-19 2025 · Japanese encephalitis: not received.",
  },
  {
    id: "doc_discharge_2023",
    kind: "document",
    title: "Discharge summary (DKA admission)",
    date: "2023-11-06",
    facility: "Hill Country General Hospital (fictional)",
    body: "Diagnosis: diabetic ketoacidosis, resolved. Home medications unchanged: insulin glargine 18 units nightly, insulin lispro with meals. Follow up with endocrinology in 2 weeks.",
  },
  {
    id: "doc_allergy_letter",
    kind: "document",
    title: "Allergy clinic letter: penicillin",
    date: "2019-09-12",
    facility: "Lakeside Allergy Clinic (fictional)",
    body: "History of anaphylaxis to amoxicillin. Avoid all penicillin-class antibiotics. Alert all treating clinicians before any antibiotic is given.",
  },
] as const;

export type DemoClinician = { name: string; role: string; facility: string; verified: boolean };
export const clinicians: DemoClinician[] = [
  { name: "Dr. Haruto Tanaka", role: "Physician (emergency medicine)", facility: "Tokyo General Hospital (fictional)", verified: true },
  { name: "Aiko Suzuki, RN", role: "Registered nurse", facility: "Tokyo General Hospital (fictional)", verified: true },
  { name: "K. Watanabe", role: "Unverified account", facility: "Unknown", verified: false },
];
export const [tanaka, suzuki, unverified] = clinicians;
