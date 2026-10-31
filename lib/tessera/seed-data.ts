// Fully fictional demo traveler. No real people, phone numbers or member IDs.
// Japanese strings are hand-written and unreviewed: see TRANSLATION_REVIEW.md.
import { DEFAULT_PRIVACY, type Privacy, type Profile } from "@/shared/tessera";

export const JORDAN_ID = "trv_jordan_rivera";
export const DEMO_LOGIN_CODE = "jordan-rivera";

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
  },
  bloodType: "O-",
  allergies: [
    {
      id: "alg_penicillin",
      substance: "Penicillin-class antibiotics (amoxicillin)",
      substanceJa: "ペニシリン系抗菌薬（アモキシシリン）",
      reaction: "Anaphylaxis (2019): throat swelling, low blood pressure",
      reactionJa: "アナフィラキシー（2019年）：喉の腫れ、血圧低下",
      severity: "severe",
    },
    {
      id: "alg_kiwi",
      substance: "Kiwi fruit",
      substanceJa: "キウイフルーツ",
      reaction: "Itching of mouth and lips",
      reactionJa: "口や唇のかゆみ",
      severity: "mild",
    },
  ],
  medications: [
    {
      id: "med_lantus",
      brand: "Lantus",
      generic: "insulin glargine",
      genericJa: "インスリン グラルギン",
      dose: "18 units, subcutaneous",
      schedule: "Once daily at 10 PM",
      scheduleJa: "1日1回 午後10時",
      purpose: "Long-acting insulin for type 1 diabetes",
      purposeJa: "1型糖尿病の持効型インスリン",
    },
    {
      id: "med_humalog",
      brand: "Humalog",
      generic: "insulin lispro",
      genericJa: "インスリン リスプロ",
      dose: "1 unit per 10 g carbohydrate, subcutaneous",
      schedule: "With meals",
      scheduleJa: "食事時",
      purpose: "Rapid-acting insulin for type 1 diabetes",
      purposeJa: "1型糖尿病の超速効型インスリン",
    },
    {
      id: "med_proair",
      brand: "ProAir HFA",
      generic: "albuterol (salbutamol) 90 mcg/actuation",
      genericJa: "サルブタモール（米国名：アルブテロール）90 μg/噴霧",
      dose: "2 puffs, inhaled",
      schedule: "As needed for wheezing, up to every 4 hours",
      scheduleJa: "喘鳴時に頓用、4時間ごとまで",
      purpose: "Rescue inhaler for asthma",
      purposeJa: "喘息発作時の吸入薬",
    },
    {
      id: "med_baqsimi",
      brand: "Baqsimi",
      generic: "glucagon nasal powder 3 mg",
      genericJa: "グルカゴン点鼻粉末剤 3 mg",
      dose: "3 mg, one spray into one nostril",
      schedule: "Emergency only: severe low blood sugar",
      scheduleJa: "緊急時のみ：重症低血糖",
      purpose: "Emergency treatment of severe hypoglycemia",
      purposeJa: "重症低血糖の緊急治療",
    },
  ],
  conditions: [
    {
      id: "cnd_t1d",
      name: "Type 1 diabetes",
      nameJa: "1型糖尿病",
      note: "Diagnosed 2013. Uses insulin pen injections. History of diabetic ketoacidosis (2023).",
      noteJa: "2013年に診断。インスリンペン注射を使用。糖尿病性ケトアシドーシスの既往（2023年）。",
    },
    {
      id: "cnd_asthma",
      name: "Asthma, moderate persistent",
      nameJa: "喘息（中等症持続型）",
      note: "Triggered by exercise and cold air. Last urgent visit 2025.",
      noteJa: "運動と冷気で誘発。最後の救急受診は2025年。",
    },
  ],
  contacts: [
    {
      id: "con_maria",
      name: "Maria Rivera",
      relationship: "Mother (in the United States)",
      relationshipJa: "母（米国在住）",
      phone: "+1 512 555 0174",
    },
    {
      id: "con_program",
      name: "Program office (fictional)",
      relationship: "Study abroad coordinator in Tokyo",
      relationshipJa: "東京の留学コーディネーター",
      phone: "+81 3 0000 0000 (fictional)",
    },
  ],
  insurance: {
    plan: "Fictional Global Student Health Plan",
    memberId: "DEMO-0000-0000",
    group: "STUDY-ABROAD-DEMO",
    phone: "+1 512 555 0199",
  },
};

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
