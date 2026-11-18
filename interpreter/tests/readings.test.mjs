import { test } from "node:test";
import assert from "node:assert/strict";
import { CURATED } from "../server/drugs.mjs";
import { addReadings, CURATED_READINGS, needsReading, scriptOf } from "../server/readings.mjs";

const eq = (local_name, local_brands = []) => ({ generic: "x", local_name, local_brands, status: "different_name" });

test("needsReading: only letters outside the reader's script", () => {
  assert.equal(needsReading("カロナール", "latn"), true);
  assert.equal(needsReading("acetaminophen 500 mg", "latn"), false);
  assert.equal(needsReading("100 µg", "latn"), false);
  assert.equal(needsReading("Tylenol", "ja"), true);
  assert.equal(needsReading("インスリン グラルギン", "ja"), false);
  assert.equal(scriptOf("JP"), "ja");
  assert.equal(scriptOf("MX"), "latn");
});

test("every curated Japanese name has a hand-written reading", () => {
  const ja = CURATED.flatMap((c) => (c.by.JP ? [c.by.JP.name, ...(c.by.JP.brands || [])] : []));
  assert.ok(ja.length > 10);
  for (const t of ja) assert.ok(CURATED_READINGS[t], `no reading for ${t}`);
});

test("US traveler in Japan: curated readings, no model call", async () => {
  let asked = false;
  const { items, added } = await addReadings([eq("アセトアミノフェン", ["カロナール", "Tylenol"])], "US", { cache: {}, ask: async () => ((asked = true), []) });
  assert.equal(asked, false);
  assert.equal(added, false);
  assert.equal(items[0].local_reading, "asetoaminofen");
  assert.deepEqual(items[0].local_brands_reading, ["karonāru", ""]);
});

test("Japanese traveler in the US: asks once, caches, and reuses", async () => {
  const cache = {};
  let calls = 0;
  const ask = async (texts, script) => {
    calls++;
    assert.equal(script, "ja");
    assert.deepEqual(texts, ["acetaminophen", "Tylenol"]);
    return ["アセトアミノフェン", "タイレノール"];
  };
  const first = await addReadings([eq("acetaminophen", ["Tylenol"])], "JP", { cache, ask });
  assert.equal(first.added, true);
  assert.equal(first.items[0].local_reading, "アセトアミノフェン");
  const again = await addReadings([eq("acetaminophen", ["Tylenol"])], "JP", { cache, ask });
  assert.equal(calls, 1);
  assert.deepEqual(again.items[0].local_brands_reading, ["タイレノール"]);
});

test("same script, a failed call, or a useless answer: no reading, names unchanged", async () => {
  const same = await addReadings([eq("paracetamol", ["Panadol"])], "MX", { cache: {}, ask: async () => assert.fail("no call needed") });
  assert.equal(same.items[0].local_reading, "");
  const failed = await addReadings([eq("Tylenol")], "JP", { cache: {}, ask: async () => { throw new Error("down"); } });
  assert.equal(failed.items[0].local_reading, "");
  assert.equal(failed.items[0].local_name, "Tylenol");
  const echoed = await addReadings([eq("Tylenol")], "JP", { cache: {}, ask: async () => ["Tylenol"] });
  assert.equal(echoed.added, false);
  const offline = await addReadings([eq("Tylenol")], "JP", { cache: {}, ask: null });
  assert.equal(offline.items[0].local_reading, "");
});
