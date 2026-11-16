import { describe, expect, it } from "vitest";
import { listAudit } from "@/lib/tessera/audit";
import { currentCard, replaceCard, setFrozen } from "@/lib/tessera/cards";
import { DOB_WINDOW_MS, MAX_DOB_TRIES, viewForScan } from "@/lib/tessera/scan";
import { seedIfMissing } from "@/lib/tessera/seed";
import { JORDAN_ID, jordan, jordanProfile } from "@/lib/tessera/seed-data";
import { getTraveler, updateTraveler } from "@/lib/tessera/traveler";
import { freshDb } from "./d1-shim";

async function seeded() {
  const t = await freshDb();
  await seedIfMissing(t.db);
  const card = (await currentCard(t.db, JORDAN_ID))!;
  return { ...t, card };
}
const WRONG = "1990-01-01";

describe("what a scan shows", () => {
  it("shows the emergency view once the date of birth matches, and logs it", async () => {
    const { db, card } = await seeded();
    const before = (await listAudit(db, JORDAN_ID)).length;
    const r = await viewForScan(db, card.cardId, jordan.dob, "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.name).toBe(jordan.name);
    expect(r.view.sections[0].category).toBe("allergies");
    expect(JSON.stringify(r.view)).toContain(jordanProfile.allergies[0].substance);
    const added = (await listAudit(db, JORDAN_ID)).slice(0, -before || undefined).map(e => `${e.action}:${e.outcome}`);
    expect(added.sort()).toEqual(["id_match:success", "profile_view:success"]);
  });

  it("opens in the traveler's doctor-facing language unless one is asked for", async () => {
    const { db, card } = await seeded();
    const traveler = (await getTraveler(db, JORDAN_ID))!;
    const r = await viewForScan(db, card.cardId, jordan.dob);
    expect(r.ok && r.view.language).toBe(traveler.language);
    const fr = await viewForScan(db, card.cardId, jordan.dob, "fr", true);
    expect(fr.ok && fr.view.language).toBe("fr");
  });

  it("doesn't log a language switch as another view", async () => {
    const { db, card } = await seeded();
    await viewForScan(db, card.cardId, jordan.dob);
    const n = (await listAudit(db, JORDAN_ID)).length;
    await viewForScan(db, card.cardId, jordan.dob, "es", true);
    expect((await listAudit(db, JORDAN_ID)).length).toBe(n);
  });

  it("refuses a wrong date of birth, shows nothing and logs the attempt", async () => {
    const { db, card } = await seeded();
    const r = await viewForScan(db, card.cardId, WRONG);
    expect(r).toStrictEqual({ ok: false, reason: "mismatch" });
    const last = (await listAudit(db, JORDAN_ID))[0];
    expect([last.action, last.outcome]).toEqual(["id_match", "denied"]);
  });

  it("locks after too many wrong dates, even for the right one, then reopens after the window", async () => {
    const { db, card } = await seeded();
    const now = Date.now();
    for (let i = 0; i < MAX_DOB_TRIES; i++) expect(await viewForScan(db, card.cardId, WRONG, undefined, false, now)).toStrictEqual({ ok: false, reason: "mismatch" });
    expect(await viewForScan(db, card.cardId, WRONG, undefined, false, now)).toStrictEqual({ ok: false, reason: "locked" });
    expect(await viewForScan(db, card.cardId, jordan.dob, undefined, false, now)).toStrictEqual({ ok: false, reason: "locked" });
    expect((await viewForScan(db, card.cardId, jordan.dob, undefined, false, now + DOB_WINDOW_MS + 1000)).ok).toBe(true);
  });

  it("gives the same refusal for unknown, frozen and replaced cards, even with the right date", async () => {
    const { db, card } = await seeded();
    const unknown = await viewForScan(db, "A".repeat(43), jordan.dob);
    await setFrozen(db, JORDAN_ID, true);
    const frozen = await viewForScan(db, card.cardId, jordan.dob);
    await setFrozen(db, JORDAN_ID, false);
    await replaceCard(db, JORDAN_ID);
    const voided = await viewForScan(db, card.cardId, jordan.dob);
    for (const r of [unknown, frozen, voided]) expect(r).toStrictEqual({ ok: false, reason: "unusable" });
  });

  it("leaves out categories the traveler restricted, and never shows insurance", async () => {
    const { db, card } = await seeded();
    const traveler = (await getTraveler(db, JORDAN_ID))!;
    await updateTraveler(db, JORDAN_ID, { privacy: { ...traveler.privacy, conditions: "restricted" } });
    const r = await viewForScan(db, card.cardId, jordan.dob, "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cats = r.view.sections.map(s => s.category);
    expect(cats).not.toContain("conditions");
    expect(cats).not.toContain("insurance");
    const text = JSON.stringify(r.view);
    for (const c of jordanProfile.conditions) expect(text).not.toContain(c.name);
    if (jordanProfile.insurance.memberId) expect(text).not.toContain(jordanProfile.insurance.memberId);
  });
});
