# Translation review

**Status: unreviewed.** Every non-English string in Tessera (Japanese, Spanish, French, Italian, German) was hand-written for a demo and has **not** been checked by a qualified medical translator. Before any user test with clinicians who read these languages, a reviewer must verify them. Verified translations are one of the product's success metrics.

## Where the strings live
- `lib/tessera/seed-data.ts`: the `tr` map on Jordan Rivera's allergies, medications, conditions and contact relationships (`tr.ja`, `tr.es`, `tr.fr`, `tr.it`, `tr.de`).
- `lib/tessera/profile.ts`: section titles, severity labels and "None recorded" for the emergency view, in all six languages.
- `mobile/src/lib/i18n.ts`: the traveler app's own UI (English and Japanese), plus the clinician hint on the full-screen QR in all six languages.
- `shared/tessera.ts`: `LANGUAGE_NAMES` and the destination → language mapping (`DESTINATIONS`).

## Rules the app already follows
- When a traveler edits English text, that field's translations are dropped in every language. The doctor sees the English original marked untranslated. Nothing is machine-translated.
- Items a traveler adds themselves are never translated. Doctors see them in English, marked as such.
- An empty list is shown as "None recorded" (or its translation), never as "no known allergies". Reviewers should confirm each translation keeps that meaning.
- A local medicine name is not a substitution recommendation.
- Doses (e.g. "18 units, subcutaneous") are not translated yet.

## Items to check, by language
Check each language column against the English.

### Emergency-view labels (`lib/tessera/profile.ts`)
| English | 日本語 | Español | Français | Italiano | Deutsch |
|---|---|---|---|---|---|
| Allergies | アレルギー | Alergias | Allergies | Allergie | Allergien |
| Medications | 服用中の薬 | Medicamentos | Médicaments | Farmaci | Medikamente |
| Conditions | 持病 | Enfermedades | Pathologies | Patologie | Erkrankungen |
| Blood type | 血液型 | Grupo sanguíneo | Groupe sanguin | Gruppo sanguigno | Blutgruppe |
| Emergency contacts | 緊急連絡先 | Contactos de emergencia | Contacts d'urgence | Contatti di emergenza | Notfallkontakte |
| None recorded | 記録なし | Sin registros | Aucune donnée enregistrée | Nessun dato registrato | Keine Angaben |
| Severe / Moderate / Mild | 重度 / 中等度 / 軽度 | Grave / Moderada / Leve | Sévère / Modérée / Légère | Grave / Moderata / Lieve | Schwer / Mittelschwer / Leicht |

### Sample traveler (`lib/tessera/seed-data.ts`)
| English | Notes for the reviewer |
|---|---|
| Penicillin-class antibiotics (amoxicillin) · Anaphylaxis (2019): throat swelling, low blood pressure | Most safety-critical item. Check every language. |
| Kiwi fruit · Itching of mouth and lips | |
| insulin glargine · Once daily at 10 PM · Long-acting insulin for type 1 diabetes | Check the time format per country. |
| insulin lispro · With meals · Rapid-acting insulin for type 1 diabetes | |
| albuterol (salbutamol) 90 mcg/actuation · As needed for wheezing, up to every 4 hours · Rescue inhaler for asthma | "Albuterol" is the US name. Most countries say salbutamol; each translation leads with salbutamol. Check the local naming. |
| glucagon nasal powder 3 mg · Emergency only: severe low blood sugar · Emergency treatment of severe hypoglycemia | Confirm the product's availability and name per country. |
| Type 1 diabetes · Diagnosed 2013… History of diabetic ketoacidosis (2023). | |
| Asthma, moderate persistent · Triggered by exercise and cold air… | |
| Mother (in the United States) · Study abroad coordinator in Tokyo | |

### Traveler app (`mobile/src/lib/i18n.ts`)
- The Japanese UI strings.
- The clinician hint on the full-screen QR, one sentence in each of the six languages.
