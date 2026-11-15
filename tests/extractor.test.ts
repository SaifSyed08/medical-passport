import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFindings } from "../extractor/src/findings";
import { handle } from "../extractor/src/index";
import { jobStatus, readText, startJob } from "../extractor/src/ocr";
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

const JOB = "0123456789abcdef0123456789abcdef";
const bearer = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : undefined);
const startReq = (token?: string, recordId = "upl_x") =>
  new Request("https://x.test/extract/start", { method: "POST", headers: bearer(token), body: JSON.stringify({ recordId }) });
const jobReq = (token?: string, query = "?recordId=upl_x", id = JOB, method = "GET") =>
  new Request(`https://x.test/extract/jobs/${id}${query}`, { method, headers: bearer(token) });
const sha = async (t: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, "0")).join("");
/** A main API stub: GET .../text answers with `saved`, GET .../file with a PDF, PUT .../text is recorded. */
const api = (saved: string, log: { url: string; method?: string; body?: string }[] = [], type = "application/pdf") =>
  (async (u: string, init: RequestInit = {}) => {
    log.push({ url: u, method: init.method, body: init.body as string | undefined });
    if (u.endsWith("/text")) return init.method === "PUT" ? new Response(null, { status: 204 }) : Response.json({ text: saved });
    return new Response("bytes", { headers: { "content-type": type } });
  }) as unknown as typeof fetch;

describe("background scan: start", () => {
  it("reuses the text saved on the record and never loads the file", async () => {
    const log: { url: string }[] = [];
    const r = await handle(startReq("t-s1"), env, { fetch: api("Diagnoses: Asthma; Gout", log), startJob: async () => { throw new Error("should not start"); } });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { status: string; suggestions: unknown[] };
    expect(body.status).toBe("done");
    expect(body.suggestions).toHaveLength(2);
    expect(log.some(c => c.url.includes("/file"))).toBe(false);
  });
  it("with no saved text it loads the file, starts a job owned by the token's hash, and returns the job id", async () => {
    let seen: { type: string; owner: string } | undefined;
    const r = await handle(startReq("t-s2"), env, { fetch: api(""), startJob: async (type, _bytes, owner) => ((seen = { type, owner }), JOB) });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "reading", page: 0, pages: 0, jobId: JOB });
    expect(seen).toEqual({ type: "application/pdf", owner: await sha("t-s2") });
  });
  it("relays a 404 from the main API, rejects heic, and hides OCR failures", async () => {
    const notFound = (async () => Response.json({ error: "Document not found.", code: "not_found" }, { status: 404 })) as unknown as typeof fetch;
    expect((await handle(startReq("t-s3"), env, { fetch: notFound })).status).toBe(404);
    const heic = await handle(startReq("t-s4"), env, { fetch: api("", [], "image/heic"), startJob: async () => JOB });
    expect(heic.status).toBe(415);
    const down = await handle(startReq("t-s5"), env, { fetch: api(""), startJob: async () => { throw new Error("SECRET patient text"); } });
    expect(down.status).toBe(502);
    const text = await down.text();
    expect(text).toContain("ocr_error");
    expect(text).not.toContain("SECRET");
  });
  it("401 without a bearer, 400 without a recordId, 405 for GET", async () => {
    expect((await handle(startReq(), env)).status).toBe(401);
    expect((await handle(new Request("https://x.test/extract/start", { method: "POST", headers: bearer("t-s6"), body: "{}" }), env)).status).toBe(400);
    expect((await handle(new Request("https://x.test/extract/start", { headers: bearer("t-s6") }), env)).status).toBe(405);
  });
  it("starting a scan counts against the hourly limit, checking on one does not", async () => {
    const deps = { fetch: api("Diagnoses: Asthma"), jobStatus: async () => ({ status: "reading" as const, page: 1, pages: 2 }) };
    for (let i = 0; i < 10; i++) expect((await handle(startReq("t-s7"), env, deps)).status).toBe(200);
    expect((await handle(startReq("t-s7"), env, deps)).status).toBe(429);
    expect((await handle(jobReq("t-s7"), env, deps)).status).toBe(200);
  });
});

describe("background scan: progress", () => {
  it("reports the page being read, asking as the same owner that started it", async () => {
    let owner = "";
    const r = await handle(jobReq("t-j1"), env, { jobStatus: async (_id, o) => ((owner = o), { status: "reading", page: 2, pages: 3 }) });
    expect(await r.json()).toEqual({ status: "reading", page: 2, pages: 3 });
    expect(owner).toBe(await sha("t-j1"));
  });
  it("when done, returns the suggestions and saves the text on the record with the same bearer", async () => {
    const log: { url: string; method?: string; body?: string }[] = [];
    const r = await handle(jobReq("t-j2"), env, {
      fetch: api("", log),
      jobStatus: async () => ({ status: "done", page: 1, pages: 1, text: "Diagnoses: Asthma; Gout" }),
    });
    const body = (await r.json()) as { status: string; suggestions: unknown[] };
    expect(body.status).toBe("done");
    expect(body.suggestions).toHaveLength(2);
    const save = log.find(c => c.method === "PUT" && c.url.endsWith("/api/v1/records/upl_x/text"))!;
    expect(JSON.parse(save.body!)).toEqual({ text: "Diagnoses: Asthma; Gout" });
  });
  it("404 for an unknown scan, 502 for a failed one, 401 without a bearer, 400 without a recordId, 405 for POST", async () => {
    expect((await handle(jobReq("t-j3"), env, { jobStatus: async () => null })).status).toBe(404);
    expect((await handle(jobReq("t-j3"), env, { jobStatus: async () => ({ status: "error" }) })).status).toBe(502);
    expect((await handle(jobReq(), env)).status).toBe(401);
    expect((await handle(jobReq("t-j3", ""), env)).status).toBe(400);
    expect((await handle(jobReq("t-j3", "?recordId=upl_x", JOB, "POST"), env)).status).toBe(405);
    expect((await handle(jobReq("t-j3", "?recordId=upl_x", "not-a-job-id"), env)).status).toBe(404);
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

describe("startJob and jobStatus", () => {
  const ok = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as unknown as typeof fetch;
  it("startJob posts the bytes with their type and the owner to /jobs and returns the id", async () => {
    let seen: { url: string; type: string | null; owner: string | null } | undefined;
    const doFetch = (async (u: string, init: RequestInit) => {
      const h = new Headers(init.headers);
      seen = { url: u, type: h.get("content-type"), owner: h.get("x-owner") };
      return Response.json({ id: JOB }, { status: 202 });
    }) as unknown as typeof fetch;
    expect(await startJob("http://ocr.test/", "application/pdf", new Uint8Array([1]), "owner-hash", doFetch)).toBe(JOB);
    expect(seen).toEqual({ url: "http://ocr.test/jobs", type: "application/pdf", owner: "owner-hash" });
    await expect(startJob("http://o", "image/png", new Uint8Array(), "o", ok({ error: "busy" }, 429))).rejects.toThrow();
    await expect(startJob("http://o", "image/png", new Uint8Array(), "o", ok({}))).rejects.toThrow();
  });
  it("jobStatus reads progress, the finished text, a failure, and null when the job is unknown", async () => {
    expect(await jobStatus("http://o", JOB, "o", ok({ status: "reading", page: 1, pages: 3 }))).toEqual({ status: "reading", page: 1, pages: 3 });
    expect(await jobStatus("http://o", JOB, "o", ok({ status: "done", page: 3, pages: 3, text: "Allergies: latex" }))).toEqual({ status: "done", page: 3, pages: 3, text: "Allergies: latex" });
    expect(await jobStatus("http://o", JOB, "o", ok({ status: "error" }))).toEqual({ status: "error" });
    expect(await jobStatus("http://o", JOB, "o", ok({ error: "Not found." }, 404))).toBeNull();
    await expect(jobStatus("http://o", JOB, "o", ok({ status: "weird" }))).rejects.toThrow();
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
  it("suggests a condition from 'findings consistent with', marked low confidence so it shows 'Check carefully'", () => {
    const out = parseFindings(findFindings([
      "PATHOLOGIST'S INTERPRETATION   (NOTE)",
      "PREDOMINANCE OF HEMOGLOBIN S WITH A LESSER AMOUNT OF HEMOGLOBIN F.",
      "FINDINGS CONSISTENT WITH HOMOZYGOUS HEMOGLOBIN S (SICKLE CELL DISEASE)",
      "VERSUS DOUBLY HETEROZYGOUS HEMOGLOBIN S-HEREDITARY PERSISTENCE OF",
      "FETAL HEMOGLOBIN.   RECOMMEND FAMILY STUDIES, IF CLINICALLY INDICATED.",
    ].join("\n")));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("condition");
    expect(out[0].fields.name).toBe("Sickle cell disease");
    expect(out[0].fields.note).toContain("not a confirmed diagnosis");
    expect(out[0].fields.note).toContain("Homozygous hemoglobin");
    expect(out[0].quote).toMatch(/^FINDINGS CONSISTENT WITH/);
    expect(out[0].confidence).toBeLessThan(0.6);
  });
  it("keeps only the first of 'X versus Y' and does not turn an ICD code into the name", () => {
    expect(read("Consistent with iron deficiency anemia versus thalassemia trait")).toEqual([
      expect.objectContaining({ kind: "condition", name: "iron deficiency anemia" }),
    ]);
    expect(read("Consistent with type 2 diabetes (E11.9)")).toEqual([expect.objectContaining({ kind: "condition", name: "type 2 diabetes" })]);
  });
  it("skips 'consistent with' lines that are negated, inconsistent, or about someone else", () => {
    expect(read("Findings are not consistent with sickle cell disease.")).toEqual([]);
    expect(read("Findings inconsistent with anemia")).toEqual([]);
    expect(read("His mother's findings were consistent with diabetes")).toEqual([]);
  });
  it("reads a discharge prescription list: schedule like '3 times a day' and the course length, no label lines as medicines", () => {
    const rx = [
      "MEDICATIONS:",
      "New Medications:",
      "Example Pharmacy, 12 Main St Springfield, ST 00000, (555) 010 - 0000",
      "acetaminophen (acetaminophen 500 mg oral tablet) 2 tab(s) Take by mouth every 6 hours for 14 Days.",
      "Refills: 0.",
      "cyclobenzaprine (cyclobenzaprine 5 mg oral tablet) 1 tab(s) Take by mouth 3 times a day for 14 Days.",
      "Refills: 0.",
      "meloxicam (meloxicam 7.5 mg oral tablet) 1 tab(s) Take by mouth 2 times a day for 14 Days. Refills: 0.",
      "Medications to continue taking that have changed:",
      "Start: folic acid (folic acid 1 mg oral tablet) 1 tab(s) Take by mouth once a day for 14 Days. Refills: 0.",
      "MRN: 1234567   FIN: 7654321   2 of 23",
    ].join("\n");
    expect(parseFindings(findFindings(rx)).map(s => [s.fields.generic, s.fields.schedule])).toEqual([
      ["acetaminophen", "every 6 hours for 14 Days"],
      ["cyclobenzaprine", "3 times a day for 14 Days"],
      ["meloxicam", "2 times a day for 14 Days"],
      ["folic acid", "once a day for 14 Days"],
    ]);
  });
  it("does not treat label words under a medications heading as medicines", () => {
    expect(read("MEDICATIONS:\nNew Medications:\nRefills: 0.\nMRN: 1234567\nPharmacy: Example Pharmacy")).toEqual([]);
  });
  it("skips medicines listed as stopped", () => {
    expect(read("Medications to stop taking:\nibuprofen 400 mg every 6 hours")).toEqual([]);
  });
  it("understands more ways to write a schedule", () => {
    expect(parseFindings(findFindings("Medications:\nMetformin 500 mg two times a day\nCetirizine 10 mg every morning\nLisinopril 10 mg 1 time a day"))
      .map(s => s.fields.schedule)).toEqual(["two times a day", "every morning", "1 time a day"]);
  });
  it("quotes the source line on every finding", () => {
    for (const s of parseFindings(findFindings("Allergies: latex (hives)\nMedications: cetirizine 10 mg daily"))) expect(s.quote.length).toBeGreaterThan(0);
  });
});
