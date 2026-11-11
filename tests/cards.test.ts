import { describe, expect, it } from "vitest";
import { cardUrl, currentCard, lookupForScan, replaceCard, setFrozen } from "@/lib/tessera/cards";
import { seedIfMissing } from "@/lib/tessera/seed";
import { JORDAN_ID, jordan, jordanProfile } from "@/lib/tessera/seed-data";
import { freshDb } from "./d1-shim";

async function seeded() {
  const t = await freshDb();
  await seedIfMissing(t.db);
  const card = (await currentCard(t.db, JORDAN_ID))!;
  return { ...t, card };
}

describe("card id and URL", () => {
  it("is long, random and carries no personal or medical data", async () => {
    const { card } = await seeded();
    expect(card.cardId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const url = cardUrl("https://tessera.example", card.cardId);
    expect(url).toBe(`https://tessera.example/t/${card.cardId}`);
    const forbidden = [jordan.name, "Jordan", "Rivera", jordan.dob, ...jordanProfile.allergies.map(a => a.substance), ...jordanProfile.medications.map(m => m.brand)];
    for (const f of forbidden) expect(url.toLowerCase()).not.toContain(f.toLowerCase());
  });

  it("gives every card a different id and serial", async () => {
    const { db, card } = await seeded();
    const next = await replaceCard(db, JORDAN_ID);
    expect(next.cardId).not.toBe(card.cardId);
    expect(next.serialNumber).not.toBe(card.serialNumber);
  });
});

describe("scan lookup is neutral", () => {
  it("accepts only an active card", async () => {
    const { db, card } = await seeded();
    expect((await lookupForScan(db, card.cardId)).usable).toBe(true);
  });

  it("returns an identical result for unknown, malformed, frozen and voided cards", async () => {
    const { db, card } = await seeded();
    const unknown = await lookupForScan(db, "A".repeat(43));
    const malformed = await lookupForScan(db, "../etc/passwd");

    await setFrozen(db, JORDAN_ID, true);
    const frozen = await lookupForScan(db, card.cardId);
    await setFrozen(db, JORDAN_ID, false);

    await replaceCard(db, JORDAN_ID);
    const voided = await lookupForScan(db, card.cardId);

    for (const r of [unknown, malformed, frozen, voided]) expect(r).toStrictEqual({ usable: false });
  });

  it("replacing a card makes the old QR fail and the new one work", async () => {
    const { db, card } = await seeded();
    const next = await replaceCard(db, JORDAN_ID);
    expect((await lookupForScan(db, card.cardId)).usable).toBe(false);
    expect((await lookupForScan(db, next.cardId)).usable).toBe(true);
    expect((await currentCard(db, JORDAN_ID))!.cardId).toBe(next.cardId);
  });

  it("unfreezing restores the same card", async () => {
    const { db, card } = await seeded();
    await setFrozen(db, JORDAN_ID, true);
    await setFrozen(db, JORDAN_ID, false);
    expect((await lookupForScan(db, card.cardId)).usable).toBe(true);
  });
});
