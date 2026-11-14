import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { tesseraRecords } from "@/db/schema";
import { listAudit } from "@/lib/tessera/audit";
import { seedIfMissing } from "@/lib/tessera/seed";
import { JORDAN_ID } from "@/lib/tessera/seed-data";
import { deleteRecord, getTraveler, updateTraveler } from "@/lib/tessera/traveler";
import { freshDb } from "./d1-shim";

const row = (id: string, kind: string, travelerId = JORDAN_ID) => ({
  id, travelerId, kind, title: "Lab report", date: "2026-01-01", facility: null, body: null, summary: null, simulated: 0,
  r2Key: kind === "upload" ? `tessera/${travelerId}/${id}` : null, contentType: null, size: null, created: "2026-01-01T00:00:00.000Z",
});

async function setup() {
  const { db } = await freshDb();
  await seedIfMissing(db);
  await db.insert(tesseraRecords).values([row("upl_test000001", "upload"), row("doc_test000001", "document"), row("upl_other00001", "upload", "trv_other")]);
  const t = (await getTraveler(db, JORDAN_ID))!;
  await updateTraveler(db, JORDAN_ID, {
    profile: { ...t.profile, conditions: [...t.profile.conditions, { id: "c_src", name: "Asthma", note: "", sourceRecordId: "upl_test000001" }] },
  });
  return { db, traveler: (await getTraveler(db, JORDAN_ID))! };
}

describe("deleteRecord", () => {
  it("removes the upload, its file and its profile links, and audits it", async () => {
    const { db, traveler } = await setup();
    const bucket = { delete: vi.fn(async () => {}) };
    expect(await deleteRecord(db, bucket, traveler, "upl_test000001")).toBe("deleted");
    expect(await db.select().from(tesseraRecords).where(eq(tesseraRecords.id, "upl_test000001"))).toHaveLength(0);
    expect(bucket.delete).toHaveBeenCalledWith(`tessera/${JORDAN_ID}/upl_test000001`);
    const c = (await getTraveler(db, JORDAN_ID))!.profile.conditions.find(x => x.id === "c_src");
    expect(c).toBeDefined();
    expect(c).not.toHaveProperty("sourceRecordId");
    expect((await listAudit(db, JORDAN_ID)).some(e => e.action === "document_deleted")).toBe(true);
  });

  it("returns not_found for another traveler's record", async () => {
    const { db, traveler } = await setup();
    expect(await deleteRecord(db, undefined, traveler, "upl_other00001")).toBe("not_found");
  });

  it("returns not_deletable for seeded documents", async () => {
    const { db, traveler } = await setup();
    expect(await deleteRecord(db, undefined, traveler, "doc_test000001")).toBe("not_deletable");
  });
});
