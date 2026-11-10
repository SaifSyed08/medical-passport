// Which record item the clinician sees flash, and that alerts never get downgraded by later mentions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeContext } from "../src/lib/contextMerge.ts";

const ckdContrast = { id: "cnd_erc", level: "alert", title: "CKD stage 3b", detail: "eGFR 44", why: "IV contrast planned; eGFR 44" };
const pen = { id: "alg_penicilina", level: "alert", title: "Penicillin anaphylaxis", detail: "2018", why: "Amoxicillin is a penicillin" };
const metContrast = { id: "med_glucophage", level: "alert", title: "Metformin + contrast", detail: "850 mg", why: "Contrast with low eGFR" };

const afterLine3 = mergeContext([], [pen, ckdContrast, metContrast], "t3", 1000, "I'd like to start you on amoxicillin and get a CT scan with contrast").next;

test("a brand-new alert flashes", () => {
  const r = mergeContext([], [pen], "t3", 1000, "amoxicillin");
  assert.equal(r.flash?.id, "alg_penicilina");
});

test("an existing alert triggered again for a new reason flashes (ibuprofen with CKD)", () => {
  const r = mergeContext(afterLine3, [pen, { ...ckdContrast, why: "Avoid NSAIDs like ibuprofen with CKD" }], "t4", 2000, "Can you take ibuprofen for the pain?");
  assert.equal(r.flash?.id, "cnd_erc");
});

test("re-listing an alert with unrelated wording does not flash", () => {
  const r = mergeContext(afterLine3, [{ ...pen, why: "Patient has a severe penicillin allergy" }], "t4", 2000, "Can you take ibuprofen for the pain?");
  assert.equal(r.flash, null);
});

test("a later 'relevant' mention keeps the alert's level and wording", () => {
  const r = mergeContext(afterLine3, [{ id: "med_glucophage", level: "relevant", title: "Metformin use", detail: "850 mg twice daily", why: "Diabetes" }], "t4", 2000, "ibuprofen");
  const m = r.next.find((c) => c.id === "med_glucophage");
  assert.equal(m.level, "alert");
  assert.equal(m.title, "Metformin + contrast");
  assert.equal(m.turnId, "t4");
});
