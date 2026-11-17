// Private mode's model-free parts: record alerts by rules, medicine names in any spelling, language by script.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PERSONAS } from "../src/data/personas.ts";
import { recordForContext } from "../src/lib/record.ts";
import { contextByRules } from "../server/rules.mjs";
import { detectLanguage, findMentions } from "../server/localInterpret.mjs";

const P = (id) => PERSONAS.find((p) => p.id === id);
const alerts = (id, speaker, text) =>
  contextByRules({ record: recordForContext(P(id)), text, speaker, doctorLang: P(id).trip.doctorLanguage });
const ids = (items, level = "alert") => items.filter((i) => i.level === level).map((i) => i.id);

test("allergy families raise alerts in any of the four languages", () => {
  assert.deepEqual(ids(alerts("sofia", "clinician", "I'd like to start you on amoxicillin for the infection.")), ["alg_penicilina"]);
  assert.deepEqual(ids(alerts("jordan", "clinician", "ペニシリン系の抗生物質を出しますね。")), ["alg_penicillin"]);
  assert.ok(ids(alerts("sita", "clinician", "Let's try some diclofenac gel on your back.")).includes("alg_nsaid"));
  assert.deepEqual(ids(alerts("sita", "patient", "मलाई सिटी स्क्यानको डाइले पहिले एलर्जी भएको थियो।")), ["alg_contrast"]);
  const both = ids(alerts("sita", "clinician", "I'll give you a ketorolac shot, then a CT with contrast."));
  assert.ok(both.includes("alg_nsaid") && both.includes("alg_contrast"));
});

test("kidney trouble turns NSAIDs and contrast into alerts", () => {
  const out = ids(alerts("sofia", "clinician", "Let's give you ibuprofen, 600 mg every eight hours."));
  assert.ok(out.some((i) => ["lab_tfge", "cnd_erc", "lab_creatinina"].includes(i)), out.join());
});

test("a patient's own combination medicine counts as its ingredients", () => {
  const out = alerts("sita", "patient", "म Flexon खाँदैछु तर दुखाइ कम भएन");
  assert.ok(ids(out).includes("alg_nsaid"));
  assert.ok(ids(out, "relevant").includes("med_flexon"));
});

test("small talk and drug-free tests raise nothing", () => {
  for (const [id, sp, line] of [
    ["sofia", "patient", "Gracias, doctor. ¿A qué hora abre la farmacia?"],
    ["jordan", "clinician", "お大事にしてください。"],
    ["sita", "clinician", "Let's start with a chest X-ray today."],
    ["sita", "patient", "धन्यवाद, अब अलि सजिलो भयो।"],
  ]) assert.deepEqual(ids(alerts(id, sp, line)), [], line);
});

test("alert text is in the clinician's language", () => {
  const [a] = alerts("jordan", "clinician", "ペニシリン系の抗生物質を出しますね。");
  assert.match(a.title, /ペニシリン/);
});

test("misheard and transliterated medicine names are found", () => {
  const names = (id, text) => findMentions(text, P(id).medications).map((m) => m.name);
  assert.deepEqual(names("sofia", "Tomo glucofaje dos veces al día y cosar en la mañana."), ["Glucophage", "Cozaar"]);
  assert.ok(names("sita", "मलाई दम छ, म एस्थालिन इन्हेलर प्रयोग गर्छु।").includes("Asthalin"));
  assert.ok(names("sita", "म दिनको दुई पटक बुडेकोर्ट लिन्छु।").includes("Budecort"));
  assert.deepEqual(names("sita", "धन्यवाद, अब अलि सजिलो भयो।"), []);
  assert.deepEqual(names("sofia", "Gracias, doctor. ¿A qué hora abre la farmacia?"), []);
});

test("language comes from the script, or from common words between two Latin languages", () => {
  assert.equal(detectLanguage("मलाई दम छ", "ne", "en"), "ne");
  assert.equal(detectLanguage("Let's start with a chest X-ray today.", "ne", "en"), "en");
  assert.equal(detectLanguage("お大事にしてください。", "en", "ja"), "ja");
  assert.equal(detectLanguage("Tomo Glucophage dos veces al día.", "es", "en"), "es");
  assert.equal(detectLanguage("Use your albuterol inhaler before exercise.", "es", "en"), "en");
});

test("loose matching leaves ordinary words alone and fixes misheard family members", () => {
  const names = (id, text) => findMentions(text, P(id).medications).map((m) => m.name);
  assert.deepEqual(names("sofia", "Hace dos días tomé una Neo-Melubrina para el dolor de cabeza."), ["Neo-Melubrina"]);
  assert.deepEqual(names("sita", "Let's try some Dyklophenac gel on your back."), ["diclofenac"]);
  assert.ok(ids(alerts("sita", "clinician", "Let's try some Dyklophenac gel on your back.")).includes("alg_nsaid"));
});

test("speech-recognition slips in Nepali are fixed only in context", () => {
  assert.deepEqual(ids(alerts("sita", "patient", "मलाई सिटि स्क्यानको दाइले पहिले एलर्जी भाएको थियो")), ["alg_contrast"]);
  assert.deepEqual(ids(alerts("sita", "patient", "मेरो दाइले मलाई यहाँ ल्याउनुभयो")), []);
});

test("brand names written in Devanagari match their Latin spelling, x as ks", () => {
  assert.deepEqual(findMentions("मलाई ढाड दुख्छ, फ्लेक्सन खाँदा पनि कम भएन।", P("sita").medications).map((m) => m.name), ["Flexon"]);
  // "contrast" is a word to translate, not a name to keep.
  assert.deepEqual(findMentions("We'll do a CT scan with contrast this afternoon.", P("sofia").medications), []);
});

test("a combination brand is the combination, not its longest ingredient", () => {
  const [m] = findMentions("म Flexon खान्छु", P("sita").medications);
  assert.equal(m.entry?.key, "ibuprofen-paracetamol");
});

test("a misheard katakana drug name still raises its alert", () => {
  assert.deepEqual(ids(alerts("jordan", "clinician", "構成物質として、アモチシシリンを出しますね。")), ["alg_penicillin"]);
  assert.deepEqual(ids(alerts("jordan", "clinician", "ゆっくり休んでください。")), []);
});

test("family words match whole words only", () => {
  // "explained" holds "aine", "dyed" holds "dye", "डाइबिटिज" (diabetes) holds "डाइ" (dye).
  for (const line of ["As I explained, take it twice a day.", "She dyed her hair last week.", "मलाई डाइबिटिज छ।"]) {
    assert.deepEqual(ids(alerts("sita", "clinician", line)), [], line);
    assert.deepEqual(ids(alerts("sofia", "clinician", line)), [], line);
  }
  // Endings still count: plural, Spanish, a Nepali case ending.
  assert.ok(ids(alerts("sita", "clinician", "No NSAIDs for now.")).includes("alg_nsaid"));
  assert.ok(ids(alerts("sofia", "clinician", "Le receto ibuprofeno.")).length > 0);
  assert.deepEqual(ids(alerts("sita", "patient", "सिटी स्क्यानको डाइले एलर्जी भयो")), ["alg_contrast"]);
});
