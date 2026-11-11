import { describe, expect, it } from "vitest";
import { tesseraTokens } from "@/db/schema";
import { appendAudit, listAudit } from "@/lib/tessera/audit";
import { resetDemo, seedIfMissing } from "@/lib/tessera/seed";
import { JORDAN_ID } from "@/lib/tessera/seed-data";
import { authenticate, bearer, issueToken, revokeToken, TOKEN_TTL_MS } from "@/lib/tessera/tokens";
import { freshDb } from "./d1-shim";

describe("traveler bearer tokens", () => {
  it("authenticates a fresh token and stores only its hash", async () => {
    const { db } = await freshDb();
    const { token } = await issueToken(db, JORDAN_ID);
    expect(await authenticate(db, token)).toBe(JORDAN_ID);
    const rows = await db.select().from(tesseraTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].hash).not.toContain(token);
    expect(rows[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects expired, revoked, unknown and missing tokens", async () => {
    const { db } = await freshDb();
    const { token } = await issueToken(db, JORDAN_ID);
    expect(await authenticate(db, token, Date.now() + TOKEN_TTL_MS + 1000)).toBeNull();
    expect(await authenticate(db, "x".repeat(43))).toBeNull();
    expect(await authenticate(db, null)).toBeNull();
    await revokeToken(db, token);
    expect(await authenticate(db, token)).toBeNull();
  });

  it("parses only well-formed Bearer headers", () => {
    expect(bearer("Bearer " + "a".repeat(43))).toBe("a".repeat(43));
    expect(bearer("Basic abc")).toBeNull();
    expect(bearer("Bearer short")).toBeNull();
    expect(bearer(null)).toBeNull();
  });
});

describe("audit log", () => {
  it("is append-only at the database level", async () => {
    const { d1, db } = await freshDb();
    await appendAudit(db, { travelerId: JORDAN_ID, actor: "Dr. Test", actorRole: "Physician", action: "scan", outcome: "success" });
    await expect(d1.prepare("UPDATE tessera_audit SET outcome = 'denied'").run()).rejects.toThrow(/append-only/);
    await expect(d1.prepare("DELETE FROM tessera_audit").run()).rejects.toThrow(/append-only/);
    expect(await listAudit(db, JORDAN_ID)).toHaveLength(1);
  });

  it("lists newest first and supports polling after a seq", async () => {
    const { db } = await freshDb();
    await seedIfMissing(db);
    const all = await listAudit(db, JORDAN_ID);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every(e => e.seeded)).toBe(true);
    expect(all[0].seq).toBeGreaterThan(all[all.length - 1].seq);
    expect(await listAudit(db, JORDAN_ID, { after: all[0].seq })).toHaveLength(0);
    expect(all.find(e => e.action === "profile_view")!.message).toMatch(/viewed your emergency profile/);
  });

  it("demo reset wipes the log and reseeds, keeping logins", async () => {
    const { d1, db } = await freshDb();
    await seedIfMissing(db);
    const { token } = await issueToken(db, JORDAN_ID);
    await appendAudit(db, { travelerId: JORDAN_ID, actor: "Dr. Extra", actorRole: "Physician", action: "scan", outcome: "success" });
    await resetDemo(d1, db);
    const after = await listAudit(db, JORDAN_ID);
    expect(after.some(e => e.actor === "Dr. Extra")).toBe(false);
    expect(after.length).toBeGreaterThan(0);
    expect(await authenticate(db, token)).toBe(JORDAN_ID);
    expect(await seedIfMissing(db)).toBe(false);
  });
});
