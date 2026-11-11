import { eq } from "drizzle-orm";
import { tesseraRecords, tesseraTravelers } from "@/db/schema";
import { appendAudit } from "./audit";
import { createCard } from "./cards";
import { dropTesseraTables, nowIso, type TesseraDb } from "./db";
import { JORDAN_ID, jordan, jordanProfile, jordanRecords, suzuki, tanaka } from "./seed-data";

const daysAgo = (d: number, h = 0) => new Date(Date.now() - (d * 24 + h) * 3600_000).toISOString();

/** Idempotent: creates Jordan Rivera, a card, records and some seeded history if they don't exist. */
export async function seedIfMissing(db: TesseraDb) {
  const exists = await db.select({ id: tesseraTravelers.id }).from(tesseraTravelers).where(eq(tesseraTravelers.id, JORDAN_ID)).get();
  if (exists) return false;
  const now = nowIso();
  await db.insert(tesseraTravelers).values({
    id: jordan.id,
    name: jordan.name,
    dob: jordan.dob,
    profile: JSON.stringify(jordanProfile),
    privacy: JSON.stringify(jordan.privacy),
    language: jordan.language,
    autoApprove: 0,
    updated: now,
  }).onConflictDoNothing();
  const card = await createCard(db, JORDAN_ID);
  await db.insert(tesseraRecords).values(
    jordanRecords.map(r => ({ ...r, travelerId: JORDAN_ID, summary: null, simulated: 0, created: now })),
  ).onConflictDoNothing();
  // Seeded history so the access log isn't empty before the clinician flow exists. Marked `seeded`.
  for (const e of [
    { c: suzuki, action: "scan" as const, at: daysAgo(3, 2) },
    { c: suzuki, action: "profile_view" as const, at: daysAgo(3, 1.9) },
    { c: tanaka, action: "scan" as const, at: daysAgo(1, 5) },
    { c: tanaka, action: "profile_view" as const, at: daysAgo(1, 4.9) },
  ]) {
    await appendAudit(db, {
      travelerId: JORDAN_ID, cardId: card.cardId, actor: e.c.name, actorRole: e.c.role, facility: e.c.facility,
      scope: e.action === "profile_view" ? "emergency" : null, action: e.action, outcome: "success",
      detail: "Seeded demo history", seeded: true, at: e.at,
    });
  }
  return true;
}

/** Presenter "reset demo data": wipes all tessera data except login tokens and seeds again. */
export async function resetDemo(d1: D1Database, db: TesseraDb) {
  await dropTesseraTables(d1);
  await seedIfMissing(db);
}
