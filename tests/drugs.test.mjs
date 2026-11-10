import { test } from "node:test";
import assert from "node:assert/strict";
import { findCurated, curatedEquivalent, curatedMentionedIn, localizeDrug, norm } from "../server/drugs.mjs";

const entry = (name) => {
  const e = findCurated(name);
  assert.ok(e, `no curated entry for ${name}`);
  return e;
};

test("norm strips accents, case and punctuation", () => {
  assert.equal(norm("Losartán 50 mg"), "losartan50mg");
  assert.equal(norm("Neo-Melubrina"), "neomelubrina");
  assert.equal(norm("Ácido acetilsalicílico"), "acidoacetilsalicilico");
});

test("patient's free-text medicine names resolve to curated entries", () => {
  assert.equal(entry("Ventolin inhalador").key, "salbutamol");
  assert.equal(entry("Neo-Melubrina 500 mg").key, "metamizole");
  assert.equal(entry("Glucophage 850 mg").key, "metformin");
  assert.equal(entry("Aspirina Protect 100 mg").key, "aspirin-low");
  assert.equal(entry("ProAir HFA").key, "salbutamol");
  assert.equal(entry("amoxicilina").key, "amoxicillin");
  assert.equal(findCurated("chamomile tea"), null);
});

test("home -> local status for the demo pair (Mexico -> US)", () => {
  assert.equal(curatedEquivalent(entry("Neo-Melubrina"), "MX", "US").status, "not_available_locally");
  assert.equal(curatedEquivalent(entry("Neo-Melubrina"), "MX", "US").local_name, "");
  const sal = curatedEquivalent(entry("Ventolin"), "MX", "US");
  assert.equal(sal.status, "different_name");
  assert.equal(sal.local_name, "albuterol");
  assert.equal(curatedEquivalent(entry("Aspirina Protect"), "MX", "US").status, "different_strength");
});

test("losartán and losartan count as the same name (accents fold)", () => {
  assert.equal(curatedEquivalent(entry("Cozaar"), "MX", "US").status, "same_name");
});

test("an uncovered country gives no curated equivalent", () => {
  assert.equal(curatedEquivalent(entry("Neo-Melubrina"), "MX", "JP"), null);
});

test("curatedMentionedIn finds names inside a sentence", () => {
  const keys = curatedMentionedIn("Tomé dos Neo-Melubrinas y usé mi Ventolin").map((e) => e.key).sort();
  assert.deepEqual(keys, ["metamizole", "salbutamol"]);
});

test("patient -> doctor translation gets the local name with the patient's name in brackets", () => {
  const r = localizeDrug("I used my Ventolin inhaler, but it didn't help.", entry("Ventolin"), { home: "MX", local: "US", listener: "clinician" });
  assert.equal(r.translation, "I used my albuterol (Ventolin) inhaler, but it didn't help.");
  assert.equal(r.label, "albuterol (Ventolin)");
});

test("a medicine not sold locally keeps its generic name", () => {
  const r = localizeDrug("I took two Neo-Melubrinas.", entry("Neo-Melubrina"), { home: "MX", local: "US", listener: "clinician" });
  assert.equal(r.translation, "I took two metamizole (Neo-Melubrinas).");
});

test("no change when the translation already uses the local name", () => {
  assert.equal(localizeDrug("I used my albuterol (Ventolin).", entry("Ventolin"), { home: "MX", local: "US", listener: "clinician" }), null);
});

test("doctor -> patient translation gets the home-country name", () => {
  const r = localizeDrug("Siga usando el albuterol.", entry("albuterol"), { home: "MX", local: "US", listener: "patient" });
  assert.equal(r.translation, "Siga usando el salbutamol (albuterol).");
  assert.equal(localizeDrug("Le voy a dar amoxicilina.", entry("amoxicillin"), { home: "MX", local: "US", listener: "patient" }), null);
});

test("works inside Japanese text, where there are no spaces", () => {
  const r = localizeDrug("胸が苦しかったのでProAirを2回使いました。", entry("ProAir"), { home: "US", local: "JP", listener: "clinician" });
  assert.equal(r.translation, "胸が苦しかったのでサルブタモール (ProAir)を2回使いました。");
});

test("merges with a bracket the model already wrote instead of nesting", () => {
  const r = localizeDrug("I took Neo-Melubrina (dipyrone) yesterday.", entry("Neo-Melubrina"), { home: "MX", local: "US", listener: "clinician" });
  assert.equal(r.translation, "I took metamizole (Neo-Melubrina, dipyrone) yesterday.");
});

test("does not match a brand inside a longer word", () => {
  assert.equal(localizeDrug("Ventolinex is not a drug", entry("Ventolin"), { home: "MX", local: "US", listener: "clinician" }), null);
});
