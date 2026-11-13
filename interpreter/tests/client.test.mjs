// Client helpers that don't need a browser. Run with --experimental-strip-types (npm test does).
import { test } from "node:test";
import assert from "node:assert/strict";
import { nearlySame } from "../src/lib/names.ts";
import { downsample, encodeWav } from "../src/lib/mic.ts";
import { sttTerms } from "../src/lib/record.ts";
import { sofia, PERSONAS } from "../src/data/personas.ts";

test("near-identical names don't get a visual swap", () => {
  assert.equal(nearlySame("ibuprofen", "ibuprofeno"), true);
  assert.equal(nearlySame("amoxicillin", "amoxicilina"), true);
  assert.equal(nearlySame("losartan", "losartán"), true);
  assert.equal(nearlySame("Ventolin", "albuterol"), false);
  assert.equal(nearlySame("Neo-Melubrinas", "metamizole"), false);
  assert.equal(nearlySame("Glucophage", "metformin"), false);
  assert.equal(nearlySame("Lantus", "ランタス"), false);
});

test("downsample 48k -> 16k keeps duration", () => {
  const out = downsample(new Float32Array(48000).fill(0.5), 48000, 16000);
  assert.equal(out.length, 16000);
  assert.ok(Math.abs(out[100] - 0.5) < 1e-6);
});

test("WAV encoder writes a valid 16 kHz mono PCM header", async () => {
  const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]), 16000);
  const b = Buffer.from(await wav.arrayBuffer());
  assert.equal(b.toString("ascii", 0, 4), "RIFF");
  assert.equal(b.toString("ascii", 8, 12), "WAVE");
  assert.equal(b.readUInt16LE(22), 1);
  assert.equal(b.readUInt32LE(24), 16000);
  assert.equal(b.readUInt32LE(40), 8);
  assert.equal(b.readInt16LE(46), 0x7fff);
  assert.equal(b.readInt16LE(48), -0x8000);
});

test("speech recognition is primed with the patient's own names", () => {
  const terms = sttTerms(sofia);
  for (const t of ["Neo-Melubrina", "Ventolin inhalador", "Glucophage", "metamizol sódico", "Penicilina"]) assert.ok(terms.includes(t), `missing ${t}`);
  assert.ok(terms.length <= 40);
});

test("persona record ids are unique and prefixed by kind", () => {
  for (const p of PERSONAS) {
    const ids = [...p.allergies, ...p.medications, ...p.conditions, ...p.labs, ...p.documents].map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${p.id} has duplicate ids`);
    for (const a of p.allergies) assert.ok(a.id.startsWith("alg_"));
    for (const m of p.medications) assert.ok(m.id.startsWith("med_"));
    for (const c of p.conditions) assert.ok(c.id.startsWith("cnd_"));
    for (const l of p.labs) assert.ok(l.id.startsWith("lab_"));
  }
});
