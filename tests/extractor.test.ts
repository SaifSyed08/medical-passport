import { afterEach, describe, expect, it, vi } from "vitest";
import { callModel } from "../extractor/src/anthropic";
import { parseFindings } from "../extractor/src/findings";
import { handle } from "../extractor/src/index";

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

const env = { ANTHROPIC_API_KEY: "k", MAIN_API_URL: "https://site.test" };
const req = (token?: string, recordId = "upl_x") =>
  new Request("https://x.test/extract", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ recordId }),
  });
const file = (type: string) => async () => new Response("bytes", { headers: { "content-type": type } });
const model = async () => ({ findings: [f({}), f({ fields: { name: "Gout" } })] });

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
    const r = await handle(req("t-heic"), env, { fetch: file("image/heic"), callModel: model });
    expect(r.status).toBe(415);
    expect(((await r.json()) as { code: string }).code).toBe("unsupported_type");
  });
  it("200 with suggestions, hitting the autofill file URL with the same bearer", async () => {
    let seen: { url: string; auth: string | null } | undefined;
    const r = await handle(req("t-ok"), env, {
      fetch: (async (u: string, init: RequestInit) => {
        seen = { url: u, auth: new Headers(init.headers).get("authorization") };
        return file("application/pdf")();
      }) as unknown as typeof fetch,
      callModel: model,
    });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { suggestions: unknown[] }).suggestions).toHaveLength(2);
    expect(seen!.url.endsWith("/api/v1/records/upl_x/file?purpose=autofill")).toBe(true);
    expect(seen!.auth).toBe("Bearer t-ok");
  });
  it("429 on the 11th call with the same token", async () => {
    const deps = { fetch: file("application/pdf"), callModel: model };
    for (let i = 0; i < 10; i++) expect((await handle(req("t-rate"), env, deps)).status).toBe(200);
    const r = await handle(req("t-rate"), env, deps);
    expect(r.status).toBe(429);
    expect(((await r.json()) as { code: string }).code).toBe("rate_limited");
  });
  it("502 model_error without leaking the thrown message", async () => {
    const r = await handle(req("t-err"), env, {
      fetch: file("image/png"),
      callModel: async () => { throw new Error("SECRET patient text"); },
    });
    expect(r.status).toBe(502);
    const text = await r.text();
    expect(text).toContain("model_error");
    expect(text).not.toContain("SECRET");
  });
});

describe("callModel", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (body: object) => vi.stubGlobal("fetch", async () => Response.json(body));
  const call = () => callModel("k", "m", "application/pdf", new Uint8Array([1, 2]));

  it("sends auto tool_choice, low effort and a large max_tokens", async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return Response.json({ stop_reason: "tool_use", content: [{ type: "tool_use", input: { findings: [] } }] });
    });
    await call();
    expect(body.tool_choice).toEqual({ type: "auto" });
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.max_tokens).toBe(16000);
    expect(body).not.toHaveProperty("thinking");
  });
  it("returns the tool_use input", async () => {
    stub({ stop_reason: "tool_use", content: [{ type: "tool_use", input: { findings: [] } }] });
    expect(await call()).toEqual({ findings: [] });
  });
  it("throws when there is no tool_use block", async () => {
    stub({ stop_reason: "end_turn", content: [{ type: "text", text: "hi" }] });
    await expect(call()).rejects.toThrow();
  });
  it("throws when output was truncated by max_tokens", async () => {
    stub({ stop_reason: "max_tokens", content: [{ type: "tool_use", input: { findings: [] } }] });
    await expect(call()).rejects.toThrow();
  });
});
