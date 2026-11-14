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

### Document scan and suggestions (`mobile/src/lib/i18n.ts`, Japanese only)
| English | 日本語 | Notes for the reviewer |
|---|---|---|
| Scan with camera | カメラでスキャン | |
| Camera access is off. Turn it on in Settings to scan documents. | カメラへのアクセスがオフです。書類をスキャンするには、設定でオンにしてください。 | |
| Suggest updates? | 更新を提案しますか？ | |
| Read this document and suggest updates to your passport? You'll check each suggestion before anything is added. | この書類を読み取って、パスポートの更新を提案しますか？追加する前に、提案を1つずつ確認できます。 | Consent prompt. Check that it is clear nothing is added automatically. |
| Read it / No thanks | 読み取る / いいえ | |
| Suggested updates | 更新の提案 | |
| Read from your document. Check each one before it's added. | 書類から読み取りました。追加する前に1つずつ確認してください。 | |
| Reading your document… | 書類を読み取っています… | |
| Nothing to add from this document | この書類から追加できる項目はありません | |
| This file type can't be read. It's saved to your records. | このファイル形式は読み取れません。記録には保存されています。 | |
| Too many requests. Try again later. | リクエストが多すぎます。しばらくしてからお試しください。 | |
| Couldn't read the document. It's still saved to your records. | 書類を読み取れませんでした。記録には保存されています。 | |
| Back | 戻る | |
| Condition / Allergy / Medication | 疾患 / アレルギー / 薬 | "疾患" here vs "持病" in the emergency view. Pick one. |
| Check carefully | よく確認してください | Low-confidence warning. |
| Already on your passport | すでにパスポートに登録済み | |
| Currently | 現在 | Shown before the current blood type. |
| Confirm / Confirm this is correct / Confirmed | 確認 / 正しいことを確認 / 確認済み | |
| Don't add / Undo | 追加しない / 元に戻す | |
| Add {n} to my passport | {n}件をパスポートに追加 | Check the counter. |
| Document reading | 書類の読み取り | |
| After you add a document, suggest updates to your passport. You check each one first. | 書類を追加した後に、パスポートの更新を提案します。追加する前に1つずつ確認できます。 | |
| On / Off | オン / オフ | |
| Suggest profile updates | プロフィールの更新を提案 | |
| Delete this document | この書類を削除 | |
| Delete this document? Anything you already added to your passport stays. | この書類を削除しますか？パスポートに追加済みの項目は残ります。 | |
