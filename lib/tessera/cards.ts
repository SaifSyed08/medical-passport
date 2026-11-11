import { and, desc, eq } from "drizzle-orm";
import { tesseraCards } from "@/db/schema";
import type { Card, CardStatus } from "@/shared/tessera";
import { appendAudit } from "./audit";
import { nowIso, type TesseraDb } from "./db";
import { randomId } from "./tokens";

type Row = typeof tesseraCards.$inferSelect;

/** The only place a card URL is built. Contains the random card_id and nothing else. */
export function cardUrl(origin: string, cardId: string) {
  return `${origin.replace(/\/$/, "")}/t/${cardId}`;
}

export function toCard(r: Row, origin: string): Card {
  return {
    cardId: r.cardId,
    cardUrl: cardUrl(origin, r.cardId),
    serialNumber: r.serialNumber,
    status: r.status as CardStatus,
    created: r.created,
    passLastUpdated: r.passLastUpdated,
  };
}

export async function createCard(db: TesseraDb, travelerId: string) {
  const row: Row = {
    cardId: randomId(32),
    travelerId,
    serialNumber: "TS-" + randomId(12).toUpperCase().replace(/[^A-Z0-9]/g, "0"),
    status: "active",
    created: nowIso(),
    replacedBy: null,
    passLastUpdated: null,
  };
  await db.insert(tesseraCards).values(row);
  return row;
}

/** The traveler's current card: the newest one that has not been voided. */
export async function currentCard(db: TesseraDb, travelerId: string) {
  const rows = await db
    .select()
    .from(tesseraCards)
    .where(eq(tesseraCards.travelerId, travelerId))
    .orderBy(desc(tesseraCards.created));
  return rows.find(r => r.status !== "voided") ?? null;
}

export async function setFrozen(db: TesseraDb, travelerId: string, frozen: boolean) {
  const card = await currentCard(db, travelerId);
  if (!card) return null;
  const status: CardStatus = frozen ? "frozen" : "active";
  if (card.status === status) return card;
  const updated = { status, passLastUpdated: nowIso() };
  await db.update(tesseraCards).set(updated).where(eq(tesseraCards.cardId, card.cardId));
  await appendAudit(db, {
    travelerId,
    cardId: card.cardId,
    actor: "You",
    actorRole: "traveler",
    action: frozen ? "card_frozen" : "card_unfrozen",
    outcome: "info",
  });
  return { ...card, ...updated };
}

/** Issues a new card_id and voids the old one, so old QR codes and screenshots stop working. */
export async function replaceCard(db: TesseraDb, travelerId: string) {
  const old = await currentCard(db, travelerId);
  const next = await createCard(db, travelerId);
  if (old) {
    await db
      .update(tesseraCards)
      .set({ status: "voided", replacedBy: next.cardId, passLastUpdated: nowIso() })
      .where(and(eq(tesseraCards.cardId, old.cardId), eq(tesseraCards.travelerId, travelerId)));
  }
  await appendAudit(db, { travelerId, cardId: next.cardId, actor: "You", actorRole: "traveler", action: "card_replaced", outcome: "info" });
  return next;
}

export type ScanResult = { usable: true; card: Row } | { usable: false };

/**
 * Card lookup for a scan. Unknown, malformed, frozen and voided cards all give the same
 * `{ usable: false }`, so the caller cannot tell them apart.
 */
export async function lookupForScan(db: TesseraDb, cardId: string): Promise<ScanResult> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(cardId)) {
    // Still do one read so malformed ids cost about the same as unknown ones.
    await db.select({ c: tesseraCards.cardId }).from(tesseraCards).where(eq(tesseraCards.cardId, "")).get();
    return { usable: false };
  }
  const card = await db.select().from(tesseraCards).where(eq(tesseraCards.cardId, cardId)).get();
  if (!card || card.status !== "active") {
    if (card) {
      await appendAudit(db, {
        travelerId: card.travelerId,
        cardId: card.cardId,
        actor: "Someone",
        actorRole: "unknown",
        action: "scan",
        outcome: "denied",
        detail: `Card was ${card.status}`,
      });
    }
    return { usable: false };
  }
  return { usable: true, card };
}
