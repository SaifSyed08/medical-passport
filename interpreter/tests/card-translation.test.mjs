import { test } from "node:test";
import assert from "node:assert/strict";
import { cachedTranslation, recordKey } from "../server/recordCache.mjs";

const record = { allergies: [{ id: "a1", substance: "Penicilina", reaction: "Anafilaxia" }], medications: [] };

test("the doctor page and the patient's phone reach the same cache entry for the same record", () => {
  const cache = { [recordKey(record, "en")]: { allergies: [{ id: "a1", substance: "Penicillin", reaction: "Anaphylaxis" }], medications: [] } };
  assert.equal(cachedTranslation(cache, structuredClone(record), "en").allergies[0].substance, "Penicillin");
});

test("a record edited on the phone, another language, or the phone-sized models' copy is a miss", () => {
  const cache = { [recordKey(record, "en")]: { ok: true }, [recordKey(record, "ja", true)]: { ok: true } };
  assert.equal(cachedTranslation(cache, { ...record, medications: [{ id: "m1" }] }, "en"), undefined);
  assert.equal(cachedTranslation(cache, record, "fr"), undefined);
  assert.equal(cachedTranslation(cache, record, "ja"), undefined);
});

test("nonsense input is a miss, never an error", () => {
  assert.equal(cachedTranslation({}, null, "en"), undefined);
  assert.equal(cachedTranslation({}, "text", "en"), undefined);
  assert.equal(cachedTranslation({}, record, undefined), undefined);
});
