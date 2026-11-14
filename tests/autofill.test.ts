import { describe, expect, it } from "vitest";
import { classify, initialState, mergeAccepted, readyToAdd, type Suggestion } from "@/shared/autofill";
import { profileSchema } from "@/lib/tessera/profile";
import { jordanProfile } from "@/lib/tessera/seed-data";

const sug = (kind: Suggestion["kind"], fields: Record<string, string>, quote = "q"): Suggestion => ({
  id: "s1", kind, fields, quote, confidence: 0.9,
});
let n = 0;
const newId = (p: string) => `${p}_t${++n}`;
const existing = jordanProfile.allergies[0].substance;

describe("classify", () => {
  it("flags allergy duplicates ignoring case and whitespace", () => {
    expect(classify(jordanProfile, sug("allergy", { substance: `  ${existing.toUpperCase().replace(/ /g, "  ")} ` }))).toBe("duplicate");
    expect(classify(jordanProfile, sug("allergy", { substance: "Peanuts" }))).toBe("new");
  });
  it("handles blood type", () => {
    const known = { ...jordanProfile, bloodType: "O+" as const };
    expect(classify(known, sug("bloodType", { value: "O+" }))).toBe("duplicate");
    expect(classify(known, sug("bloodType", { value: "A-" }))).toBe("replaces");
    expect(classify({ ...jordanProfile, bloodType: "Unknown" }, sug("bloodType", { value: "A-" }))).toBe("new");
  });
  it("initialState removes duplicates", () => {
    expect(initialState(jordanProfile, sug("allergy", { substance: existing }))).toBe("removed");
    expect(initialState(jordanProfile, sug("allergy", { substance: "Peanuts" }))).toBe("pending");
  });
});

describe("readyToAdd", () => {
  it("needs a checked and no pending", () => {
    expect(readyToAdd(["checked", "removed"])).toBe(true);
    expect(readyToAdd(["checked", "pending"])).toBe(false);
    expect(readyToAdd(["removed"])).toBe(false);
    expect(readyToAdd([])).toBe(false);
  });
});

describe("mergeAccepted", () => {
  it("appends a condition with source and quote", () => {
    const out = mergeAccepted(jordanProfile, [sug("condition", { name: "Sickle cell disease", note: "Dx 2019" }, "HbSS sickle cell disease")], "doc_1", newId);
    const c = out.conditions.at(-1)!;
    expect(c.id).toMatch(/^cnd_/);
    expect(c.sourceRecordId).toBe("doc_1");
    expect(c.note).toBe("Dx 2019 — “HbSS sickle cell disease”");
    expect(profileSchema.safeParse(out).success).toBe(true);
  });
  it("adds allergies and medications that pass the schema", () => {
    const out = mergeAccepted(jordanProfile, [
      sug("allergy", { substance: "Peanuts", reaction: "Hives", severity: "bogus" }),
      sug("medication", { generic: "Metformin", dose: "500 mg" }),
    ], "doc_1", newId);
    expect(out.allergies.at(-1)).toMatchObject({ substance: "Peanuts", severity: "moderate", sourceRecordId: "doc_1" });
    expect(out.medications.at(-1)).toMatchObject({ generic: "Metformin", brand: "", sourceRecordId: "doc_1" });
    expect(profileSchema.safeParse(out).success).toBe(true);
  });
  it("truncates note to 400 chars", () => {
    const out = mergeAccepted(jordanProfile, [sug("condition", { name: "X", note: "n".repeat(500) })], "doc_1", newId);
    expect(out.conditions.at(-1)!.note).toHaveLength(400);
  });
  it("skips duplicates", () => {
    const out = mergeAccepted(jordanProfile, [sug("allergy", { substance: existing })], "doc_1", newId);
    expect(out.allergies).toHaveLength(jordanProfile.allergies.length);
  });
  it("sets blood type only when valid", () => {
    expect(mergeAccepted(jordanProfile, [sug("bloodType", { value: "AB-" })], "d", newId).bloodType).toBe("AB-");
    expect(mergeAccepted(jordanProfile, [sug("bloodType", { value: "Z+" })], "d", newId).bloodType).toBe(jordanProfile.bloodType);
  });
  it("does not mutate input", () => {
    const before = JSON.stringify(jordanProfile);
    mergeAccepted(jordanProfile, [sug("condition", { name: "X", note: "" }), sug("bloodType", { value: "AB-" })], "d", newId);
    expect(JSON.stringify(jordanProfile)).toBe(before);
  });
});
