import { and, eq, gt } from "drizzle-orm";
import { tesseraAudit } from "@/db/schema";
import type { EmergencyView, Language } from "@/shared/tessera";
import { appendAudit } from "./audit";
import { lookupForScan } from "./cards";
import type { TesseraDb } from "./db";
import { emergencyView } from "./profile";
import { getTraveler } from "./traveler";

/** Wrong dates of birth allowed per card before it locks for a while. */
export const MAX_DOB_TRIES = 5;
export const DOB_WINDOW_MS = 15 * 60 * 1000;

export type ScanView =
  | { ok: true; view: EmergencyView }
  /** `unusable`: unknown, frozen or voided card (never told apart). `mismatch`: wrong date. `locked`: too many wrong dates. */
  | { ok: false; reason: "unusable" | "mismatch" | "locked" };

/**
 * What someone who scanned the card gets after typing the patient's date of birth: the emergency view
 * (only the categories the traveler marked "emergency") or a refusal. Every attempt is written to the audit log.
 * `again` marks a re-read of an already open page (a language switch), so it isn't logged as a new view.
 */
export async function viewForScan(db: TesseraDb, cardId: string, dob: string, lang?: Language, again = false, now = Date.now()): Promise<ScanView> {
  const scan = await lookupForScan(db, cardId);
  if (!scan.usable) return { ok: false, reason: "unusable" };
  const traveler = await getTraveler(db, scan.card.travelerId);
  if (!traveler || !traveler.dob) return { ok: false, reason: "unusable" };
  const who = { travelerId: traveler.id, cardId, actor: "Someone", actorRole: "unknown", scope: "emergency" } as const;

  const since = new Date(now - DOB_WINDOW_MS).toISOString();
  const misses = await db
    .select({ seq: tesseraAudit.seq })
    .from(tesseraAudit)
    .where(and(eq(tesseraAudit.cardId, cardId), eq(tesseraAudit.action, "id_match"), eq(tesseraAudit.outcome, "denied"), gt(tesseraAudit.at, since)));
  if (misses.length >= MAX_DOB_TRIES) return { ok: false, reason: "locked" };

  if (dob !== traveler.dob) {
    await appendAudit(db, { ...who, action: "id_match", outcome: "denied", at: new Date(now).toISOString() });
    return { ok: false, reason: "mismatch" };
  }
  if (!again) {
    const at = new Date(now).toISOString();
    await appendAudit(db, { ...who, action: "id_match", outcome: "success", at });
    await appendAudit(db, { ...who, action: "profile_view", outcome: "success", at });
  }
  return { ok: true, view: emergencyView(traveler.name, traveler.profile, traveler.privacy, lang ?? traveler.language) };
}
