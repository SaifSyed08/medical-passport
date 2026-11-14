import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFindings } from "../extractor/src/findings";
import { handle } from "../extractor/src/index";
import { readText } from "../extractor/src/ocr";
import { findFindings } from "../extractor/src/rules";

const f = (o: object) => ({ kind: "condition", fields: { name: "Asthma" }, quote: "q", confidence: 0.9, ...o });

describe("parseFindings", () => {
  it("drops an allergy without substance", () => {
    expect(parseFindings({ findings: [{ kind: "allergy", fields: { reaction: "rash" }, quote: "q", confidence: 1 }] })).toEqual([]);
  });
  it("truncates, coerces severity, clamps confidence, assigns ids", () => {
    const out = parseFindings({
      findings: [
        f({ fields: { name: "Asthma", note: "x".repeat(600) }, confidence: 7 }),
        { kind: "allergy", fields: { substance: "Penicillin", severity: "life-threatening" }, quote: "q", confidence: 0.5 },
      ],
    });
    expect(out[0].fields.note).toHaveLength(400);
    expect(out[0].confidence).toBe(1);
    expect(out[1].fields.severity).toBe("moderate");
    expect(out.map(s => s.id)).toEqual(["sg_1", "sg_2"]);
  });
  it("normalizes severity case and whitespace", () => {
    const [a] = parseFindings({ findings: [{ kind: "allergy", fields: { substance: "Nuts", severity: " Severe " }, quote: "q", confidence: 1 }] });
    expect(a.fields.severity).toBe("severe");
  });
  it("rejects bad blood types and non-string fields", () => {
    const bt = (value: string) => ({ kind: "bloodType", fields: { value }, quote: "q", confidence: 1 });
    expect(parseFindings({ findings: [bt("Unknown"), bt("Z+"), f({ fields: { name: 5 } })] })).toEqual([]);
    expect(parseFindings({ findings: [bt("O+")] })).toHaveLength(1);
  });
  it("drops 'no known allergies' items and keeps a real allergy", () => {
    const al = (substance: string) => ({ kind: "allergy", fields: { substance }, quote: "q", confidence: 1 });
    const out = parseFindings({ findings: [al("NKDA"), al(" No known drug allergies "), al("Penicillin")] });
    expect(out.map(s => s.fields.substance)).toEqual(["Penicillin"]);
  });
  it("drops negated conditions", () => {
    expect(parseFindings({ findings: [f({ fields: { name: "No history of asthma" } })] })).toEqual([]);
  });
  it("drops items without a quote", () => {
    expect(parseFindings({ findings: [f({ quote: "  " }), f({ quote: undefined })] })).toEqual([]);
  });
  it("returns [] for garbage", () => {
    for (const g of [null, "x", { findings: "no" }]) expect(parseFindings(g)).toEqual([]);
  });
});

const env = { MAIN_API_URL: "https://site.test", OCR_URL: "http://ocr.test" };
const req = (token?: string, recordId = "upl_x") =>
  new Request("https://x.test/extract", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ recordId }),
  });
const file = (type: string) => async () => new Response("bytes", { headers: { "content-type": type } });
const ocrText = async () => "Diagnoses: Asthma; Gout";

describe("handle", () => {
  it("401 without a bearer", async () => {
    const r = await handle(req(), env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { code: string }).code).toBe("unauthorized");
  });
  it("relays 404 from the file fetch", async () => {
    const r = await handle(req("t-404"), env, {
      fetch: async () => Response.json({ error: "Not found", code: "not_found" }, { status: 404 }),
    });
    expect(r.status).toBe(404);
    expect(((await r.json()) as { code: string }).code).toBe("not_found");
  });
  it("relays 401 from the file fetch with its code", async () => {
    const r = await handle(req("t-401"), env, {
      fetch: async () => Response.json({ error: "Session expired", code: "session_expired" }, { status: 401 }),
    });
    expect(r.status).toBe(401);
    expect(((await r.json()) as { code: string }).code).toBe("session_expired");
  });
  it("415 for heic", async () => {
    const r = await handle(req("t-heic"), env, { fetch: file("image/heic"), readText: ocrText });
    expect(r.status).toBe(415);
    expect(((await r.json()) as { code: string }).code).toBe("unsupported_type");
  });
  it("200 with suggestions, hitting the autofill file URL with the same bearer", async () => {
    let seen: { url: string; auth: string | null } | undefined;
    const r = await handle(req("t-ok"), env, {
      fetch: (async (u: string, init: RequestInit) => {
        if (u.endsWith("/text")) return new Response(null, { status: 204 });
        seen = { url: u, auth: new Headers(init.headers).get("authorization") };
        return file("application/pdf")();
      }) as unknown as typeof fetch,
      readText: ocrText,
    });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { suggestions: unknown[] }).suggestions).toHaveLength(2);
    expect(seen!.url.endsWith("/api/v1/records/upl_x/file?purpose=autofill")).toBe(true);
    expect(seen!.auth).toBe("Bearer t-ok");
  });
  it("429 on the 11th call with the same token", async () => {
    const deps = { fetch: file("application/pdf"), readText: ocrText };
    for (let i = 0; i < 10; i++) expect((await handle(req("t-rate"), env, deps)).status).toBe(200);
    const r = await handle(req("t-rate"), env, deps);
    expect(r.status).toBe(429);
    expect(((await r.json()) as { code: string }).code).toBe("rate_limited");
  });
  it("502 ocr_error without leaking the thrown message", async () => {
    const r = await handle(req("t-err"), env, {
      fetch: file("image/png"),
      readText: async () => { throw new Error("SECRET patient text"); },
    });
    expect(r.status).toBe(502);
    const text = await r.text();
    expect(text).toContain("ocr_error");
    expect(text).not.toContain("SECRET");
  });
  it("saves the read text on the record with the same bearer, and still answers if that fails", async () => {
    const calls: { url: string; method?: string; auth: string | null; body?: string }[] = [];
    const r = await handle(req("t-save"), env, {
      fetch: (async (u: string, init: RequestInit) => {
        calls.push({ url: u, method: init.method, auth: new Headers(init.headers).get("authorization"), body: init.body as string });
        if (u.endsWith("/text")) throw new Error("down");
        return file("application/pdf")();
      }) as unknown as typeof fetch,
      readText: ocrText,
    });
    expect(r.status).toBe(200);
    const save = calls.find(c => c.url.endsWith("/api/v1/records/upl_x/text"))!;
    expect(save.method).toBe("PUT");
    expect(save.auth).toBe("Bearer t-save");
    expect(JSON.parse(save.body!)).toEqual({ text: "Diagnoses: Asthma; Gout" });
  });
});

describe("readText", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("posts the bytes with their type to /ocr and returns the text", async () => {
    let seen: { url: string; type: string | null } | undefined;
    const doFetch = (async (u: string, init: RequestInit) => {
      seen = { url: u, type: new Headers(init.headers).get("content-type") };
      return Response.json({ text: "Allergies: latex" });
    }) as unknown as typeof fetch;
    expect(await readText("http://ocr.test/", "image/png", new Uint8Array([1]), doFetch)).toBe("Allergies: latex");
    expect(seen).toEqual({ url: "http://ocr.test/ocr", type: "image/png" });
  });
  it("throws on an error status or a malformed reply", async () => {
    await expect(readText("http://o", "image/png", new Uint8Array(), (async () => Response.json({}, { status: 422 })) as unknown as typeof fetch)).rejects.toThrow();
    await expect(readText("http://o", "image/png", new Uint8Array(), (async () => Response.json({ lines: [] })) as unknown as typeof fetch)).rejects.toThrow();
  });
});

const read = (text: string) => parseFindings(findFindings(text)).map(s => ({ kind: s.kind, ...s.fields }));

describe("rules (no AI)", () => {
  it("reads the sample discharge summary", () => {
    expect(read("Discharge summary\nPatient: Jordan Example (synthetic)\nAdmitted: 2026-03-02   Discharged: 2026-03-05\nDx: HbSS sickle cell disease, diagnosed 2019\nAllergic to penicillin: anaphylaxis\nPlan: hydration, pain control, follow up with hematology in 2 weeks.")).toEqual([
      { kind: "condition", name: "HbSS sickle cell disease", note: "diagnosed 2019" },
      { kind: "allergy", substance: "penicillin", reaction: "anaphylaxis", severity: "severe" },
    ]);
  });
  it("finds nothing in the sample clinic note: negation, family history, NKDA, rule-out", () => {
    expect(read("Clinic note\nPatient: Jordan Example (synthetic)\nVisit: 2026-05-14\nNo history of asthma\nMother has type 2 diabetes\nNKDA\nRule out iron deficiency; repeat labs in 6 weeks.")).toEqual([]);
  });
  it("finds nothing in a lab report", () => {
    expect(read("Lab report\nHemoglobin 13.2 g/dL (12.0-15.5)\nPotassium 4.2 mmol/L (3.5-5.1)\nGlucose 92 mg/dL (70-99)")).toEqual([]);
  });
  it("reads headed lists: allergies with reactions, medications with dose and schedule, conditions with notes", () => {
    const out = read([
      "Blood type: O negative",
      "Allergies:", "- Sulfa drugs (rash, hives)", "- Latex - throat swelling", "- Peanuts: mild itching",
      "Home Medications:", "1. Metformin 500 mg twice daily with meals", "2. Lantus 18 units subcutaneous at bedtime", "3. ProAir HFA 2 puffs every 4 hours as needed for wheezing",
      "Past Medical History:", "Type 1 diabetes, diagnosed 2013; Asthma (moderate persistent); Hypertension",
      "Family History:", "Father with hypertension and coronary artery disease",
      "Assessment: Rule out pneumonia",
      "Patient was diagnosed with migraine in 2020.",
    ].join("\n"));
    expect(out).toEqual([
      { kind: "bloodType", value: "O-" },
      { kind: "allergy", substance: "Sulfa drugs", reaction: "rash, hives", severity: "moderate" },
      { kind: "allergy", substance: "Latex", reaction: "throat swelling", severity: "severe" },
      { kind: "allergy", substance: "Peanuts", reaction: "mild itching", severity: "mild" },
      { kind: "medication", generic: "metformin", brand: "", dose: "500 mg", schedule: "twice daily, with meals", purpose: "" },
      { kind: "medication", generic: "insulin glargine", brand: "Lantus", dose: "18 units subcutaneous", schedule: "at bedtime", purpose: "" },
      { kind: "medication", generic: "albuterol", brand: "Proair", dose: "2 puffs", schedule: "every 4 hours, as needed", purpose: "wheezing" },
      { kind: "condition", name: "Type 1 diabetes", note: "diagnosed 2013" },
      { kind: "condition", name: "Asthma", note: "moderate persistent" },
      { kind: "condition", name: "Hypertension", note: "" },
      { kind: "condition", name: "migraine", note: "in 2020" },
    ]);
  });
  it("needs a dose to report a medicine mentioned outside a medications list", () => {
    expect(read("We discussed amoxicillin.")).toEqual([]);
    expect(read("Advised ibuprofen 400 mg every 6 hours for pain.")).toEqual([
      { kind: "medication", generic: "ibuprofen", brand: "", dose: "400 mg", schedule: "every 6 hours", purpose: "pain" },
    ]);
  });
  it("quotes the source line on every finding", () => {
    for (const s of parseFindings(findFindings("Allergies: latex (hives)\nMedications: cetirizine 10 mg daily"))) expect(s.quote.length).toBeGreaterThan(0);
  });
});
