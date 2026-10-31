# Japanese translation review

**Status: unreviewed.** Every Japanese string in Tessera was hand-written for a demo and has **not** been checked by a qualified medical translator. Before any user test with Japanese-speaking clinicians, a reviewer must verify them. Verified translations are one of the product's success metrics.

## Where the strings live
- `lib/tessera/seed-data.ts`: the `*Ja` fields on Jordan Rivera's allergies, medications, conditions and contacts.
- `lib/tessera/profile.ts`: section titles and severity labels for the emergency view.
- `mobile/src/i18n.ts`: the traveler app's UI strings.

## What to check
| Item | English | Japanese (draft) | Reviewer notes |
|---|---|---|---|
| Allergy | Penicillin-class antibiotics (amoxicillin) | ペニシリン系抗菌薬（アモキシシリン） | |
| Reaction | Anaphylaxis (2019): throat swelling, low blood pressure | アナフィラキシー（2019年）：喉の腫れ、血圧低下 | |
| Allergy | Kiwi fruit / Itching of mouth and lips | キウイフルーツ / 口や唇のかゆみ | |
| Medication | insulin glargine (Lantus) | インスリン グラルギン | |
| Medication | insulin lispro (Humalog) | インスリン リスプロ | |
| Medication | albuterol (salbutamol) 90 mcg/actuation (ProAir HFA) | サルブタモール（米国名：アルブテロール）90 μg/噴霧 | Confirm the local naming. The US name "albuterol" is unfamiliar in Japan. |
| Medication | glucagon nasal powder 3 mg (Baqsimi) | グルカゴン点鼻粉末剤 3 mg | Confirm the product name and availability in Japan. |
| Condition | Type 1 diabetes | 1型糖尿病 | |
| Condition | Asthma, moderate persistent | 喘息（中等症持続型） | |
| Severity | Severe / Moderate / Mild | 重度 / 中等度 / 軽度 | |
| Section titles | Allergies / Medications / Conditions / Blood type / Emergency contacts | アレルギー / 服用中の薬 / 持病 / 血液型 / 緊急連絡先 | |

## Rules the app already follows
- When a traveler edits English text, its Japanese translation is dropped and the clinician sees the original, marked untranslated. Nothing is machine-translated silently.
- A local medicine name is not a substitution recommendation.
