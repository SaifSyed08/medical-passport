// The clinician's translated record must never be half-translated, reordered or missing items.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeIds, recordBody } from "../src/lib/recordTranslation.ts";
import { sofia } from "../src/data/personas.ts";

const orig = recordBody(sofia);
const translatedCopy = () => JSON.parse(JSON.stringify(orig));

test("a complete translation is merged, keeping ids, values and flags from the original", () => {
  const tr = translatedCopy();
  tr.allergies[0].substance = "Penicillin (amoxicillin)";
  tr.labs[3].name = "Estimated glomerular filtration rate (eGFR)";
  tr.labs[3].value = "999"; // the model must not be able to change a number
  const m = mergeIds(orig, tr);
  assert.equal(m.allergies[0].substance, "Penicillin (amoxicillin)");
  assert.equal(m.labs[3].name, "Estimated glomerular filtration rate (eGFR)");
  assert.equal(m.labs[3].value, orig.labs[3].value);
  assert.equal(m.labs[3].flag, orig.labs[3].flag);
  assert.deepEqual(m.medications.map((x) => x.id), orig.medications.map((x) => x.id));
});

test("a translation that drops an item is rejected", () => {
  const tr = translatedCopy();
  tr.medications.pop();
  assert.throws(() => mergeIds(orig, tr), /incomplete/);
});

test("a translation that reorders or renames ids is rejected", () => {
  const tr = translatedCopy();
  tr.conditions.reverse();
  assert.throws(() => mergeIds(orig, tr), /incomplete/);
});

test("a malformed response (wrong shape) is rejected, not shown as 'translated'", () => {
  assert.throws(() => mergeIds(orig, { record: {} }), /incomplete/);
});
