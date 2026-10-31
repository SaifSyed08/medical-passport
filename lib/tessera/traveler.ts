import { and, desc, eq } from "drizzle-orm";
import { tesseraRecords, tesseraRequests, tesseraTravelers } from "@/db/schema";
import { DEFAULT_PRIVACY, type AccessRequest, type Language, type Privacy, type Profile, type RecordItem, type RequestStatus } from "@/shared/tessera";
import { appendAudit } from "./audit";
import { createCard, currentCard } from "./cards";
import { nowIso, type TesseraDb } from "./db";
import { mergeTranslations, upgradeProfile } from "./profile";
import { blankProfile, JORDAN_ID, jordanProfile, type DemoClinician } from "./seed-data";
import { randomId } from "./tokens";

type TravelerRow = typeof tesseraTravelers.$inferSelect;

/**
 * The sample traveler may have been stored before newer seed translations existed. Fill them in for
 * fields whose English text is unchanged; edited fields stay untranslated (same rule as edits).
 */
function withSeedTranslations(id: string, profile: Profile): Profile {
  if (id !== JORDAN_ID) return profile;
  const merged = mergeTranslations(jordanProfile, profile);
  return { ...merged, basics: { ...merged.basics, destinationCountry: merged.basics.destinationCountry ?? jordanProfile.basics.destinationCountry } };
}

export function unpackTraveler(r: TravelerRow) {
  return {
    id: r.id,
    name: r.name,
    dob: r.dob,
    profile: withSeedTranslations(r.id, upgradeProfile(JSON.parse(r.profile) as Profile)),
    privacy: JSON.parse(r.privacy) as Privacy,
    language: r.language as Language,
    autoApprove: r.autoApprove === 1,
  };
}
export type Traveler = ReturnType<typeof unpackTraveler>;

export const isSample = (t: Pick<Traveler, "id">) => t.id === JORDAN_ID;
export const needsSetup = (t: Pick<Traveler, "name" | "dob">) => !t.name.trim() || !t.dob;

/** A fresh, empty traveler for a user-test participant, with its own card. */
export async function createBlankTraveler(db: TesseraDb) {
  const id = "trv_" + randomId(12);
  await db.insert(tesseraTravelers).values({
    id, name: "", dob: "", profile: JSON.stringify(blankProfile()), privacy: JSON.stringify(DEFAULT_PRIVACY),
    language: "en", autoApprove: 0, updated: nowIso(),
  });
  await createCard(db, id);
  return id;
}

export async function updateIdentity(db: TesseraDb, id: string, identity: { name: string; dob: string }) {
  await db.update(tesseraTravelers).set({ name: identity.name, dob: identity.dob, updated: nowIso() }).where(eq(tesseraTravelers.id, id));
}

export async function getTraveler(db: TesseraDb, id: string): Promise<Traveler | null> {
  const r = await db.select().from(tesseraTravelers).where(eq(tesseraTravelers.id, id)).get();
  return r ? unpackTraveler(r) : null;
}

export async function updateTraveler(
  db: TesseraDb,
  id: string,
  patch: Partial<{ profile: Profile; privacy: Privacy; language: Language; autoApprove: boolean }>,
) {
  const set: Partial<TravelerRow> = { updated: nowIso() };
  if (patch.profile) set.profile = JSON.stringify(patch.profile);
  if (patch.privacy) set.privacy = JSON.stringify(patch.privacy);
  if (patch.language) set.language = patch.language;
  if (patch.autoApprove !== undefined) set.autoApprove = patch.autoApprove ? 1 : 0;
  await db.update(tesseraTravelers).set(set).where(eq(tesseraTravelers.id, id));
}

type RecordRow = typeof tesseraRecords.$inferSelect;
export function toRecord(r: RecordRow): RecordItem {
  return {
    id: r.id,
    kind: r.kind as RecordItem["kind"],
    title: r.title,
    date: r.date,
    facility: r.facility,
    summary: r.summary,
    body: r.body,
    simulated: r.simulated === 1,
    hasFile: !!r.r2Key,
    contentType: r.contentType,
    size: r.size,
  };
}

export async function listRecords(db: TesseraDb, travelerId: string) {
  const rows = await db.select().from(tesseraRecords).where(eq(tesseraRecords.travelerId, travelerId)).orderBy(desc(tesseraRecords.date));
  return rows.map(toRecord);
}

export const UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "photo",
  "image/png": "photo",
  "image/heic": "photo",
};
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** The "extracted" summary is a placeholder, always labelled as simulated. No file contents are read. */
export function simulatedSummary(title: string, contentType: string, size: number) {
  const kb = Math.max(1, Math.round(size / 1024));
  return `Simulated extraction (demo): ${UPLOAD_TYPES[contentType] ?? "file"} "${title}", ${kb} KB. No text was actually read from this file. Review the original before relying on it.`;
}

type RequestRow = typeof tesseraRequests.$inferSelect;
const toRequest = (r: RequestRow): AccessRequest => ({
  id: r.id, clinician: r.clinician, role: r.role, facility: r.facility, reason: r.reason,
  status: r.status as RequestStatus, created: r.created, decided: r.decided,
});

export async function listRequests(db: TesseraDb, travelerId: string) {
  const rows = await db.select().from(tesseraRequests).where(eq(tesseraRequests.travelerId, travelerId)).orderBy(desc(tesseraRequests.created));
  return rows.map(toRequest);
}

/** A clinician asks for full-record scope. Today this is only produced by the presenter simulation. */
export async function createFullRequest(db: TesseraDb, traveler: Traveler, clinician: DemoClinician, reason: string) {
  const card = await currentCard(db, traveler.id);
  if (!card || card.status !== "active") return null;
  const row: RequestRow = {
    id: "req_" + randomId(12),
    travelerId: traveler.id,
    cardId: card.cardId,
    clinician: clinician.name,
    role: clinician.role,
    facility: clinician.facility,
    reason,
    status: "pending",
    created: nowIso(),
    decided: null,
  };
  await db.insert(tesseraRequests).values(row);
  await appendAudit(db, {
    travelerId: traveler.id, cardId: card.cardId, actor: clinician.name, actorRole: clinician.role,
    facility: clinician.facility, scope: "full", action: "full_record_request", outcome: "info", detail: reason,
  });
  if (traveler.autoApprove) return decideRequest(db, traveler.id, row.id, "approved", "auto-approved (presenter setting)");
  return toRequest(row);
}

export async function decideRequest(db: TesseraDb, travelerId: string, id: string, decision: "approved" | "denied", note?: string) {
  const row = await db.select().from(tesseraRequests).where(and(eq(tesseraRequests.id, id), eq(tesseraRequests.travelerId, travelerId))).get();
  if (!row) return null;
  if (row.status !== "pending") return toRequest(row);
  const decided = nowIso();
  await db.update(tesseraRequests).set({ status: decision, decided }).where(eq(tesseraRequests.id, id));
  await appendAudit(db, {
    travelerId, cardId: row.cardId, actor: row.clinician, actorRole: row.role, facility: row.facility, scope: "full",
    action: "full_record_decision", outcome: decision === "approved" ? "success" : "denied", detail: note ?? null,
  });
  return toRequest({ ...row, status: decision, decided });
}
