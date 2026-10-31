import { and, desc, eq, gt } from "drizzle-orm";
import { tesseraAudit } from "@/db/schema";
import type { AccessEvent, AuditAction } from "@/shared/tessera";
import { nowIso, type TesseraDb } from "./db";

export type AuditInput = {
  travelerId: string;
  cardId?: string | null;
  actor: string;
  actorRole: string;
  facility?: string | null;
  scope?: string | null;
  action: AuditAction;
  outcome: AccessEvent["outcome"];
  detail?: string | null;
  seeded?: boolean;
  at?: string;
};

/** The only write path for the audit log. Rows are never updated or deleted (enforced by DB triggers). */
export async function appendAudit(db: TesseraDb, e: AuditInput) {
  await db.insert(tesseraAudit).values({
    travelerId: e.travelerId,
    cardId: e.cardId ?? null,
    actor: e.actor,
    actorRole: e.actorRole,
    facility: e.facility ?? null,
    scope: e.scope ?? null,
    action: e.action,
    outcome: e.outcome,
    detail: e.detail ?? null,
    seeded: e.seeded ? 1 : 0,
    at: e.at ?? nowIso(),
  });
}

const verbs: Record<AuditAction, string> = {
  scan: "scanned your card",
  id_match: "checked your name and date of birth",
  sign_in: "signed in to view your card",
  profile_view: "viewed your emergency profile",
  ai_question: "asked a question about your records",
  source_open: "opened a source record",
  full_record_request: "requested your full record",
  full_record_decision: "full-record request decided",
  card_frozen: "froze your card",
  card_unfrozen: "unfroze your card",
  card_replaced: "replaced your card",
  privacy_changed: "changed what appears in your emergency profile",
  identity_changed: "updated the name or date of birth on your card",
};

const attempts: Partial<Record<AuditAction, string>> = {
  scan: "scanned your card, but it couldn't be used",
  id_match: "entered a name and date of birth that didn't match",
  sign_in: "tried to sign in without verification",
  profile_view: "tried to view your emergency profile",
  full_record_request: "requested your full record",
};

export function describe(e: Pick<AccessEvent, "actor" | "facility" | "action" | "outcome">): string {
  const who = e.facility ? `${e.actor} at ${e.facility}` : e.actor;
  if (e.action === "full_record_decision") return `You ${e.outcome === "success" ? "approved" : "denied"} full-record access for ${who}`;
  if (e.outcome === "denied" || e.outcome === "failure") return `${who} ${attempts[e.action] ?? verbs[e.action]} (blocked)`;
  return `${who} ${verbs[e.action]}`;
}

type Row = typeof tesseraAudit.$inferSelect;
export function toEvent(r: Row): AccessEvent {
  const e = {
    seq: r.seq,
    at: r.at,
    actor: r.actor,
    actorRole: r.actorRole,
    facility: r.facility,
    scope: r.scope,
    action: r.action as AuditAction,
    outcome: r.outcome as AccessEvent["outcome"],
    detail: r.detail,
    seeded: r.seeded === 1,
  };
  return { ...e, message: describe(e) };
}

export async function listAudit(db: TesseraDb, travelerId: string, opts: { after?: number; limit?: number } = {}) {
  const rows = await db
    .select()
    .from(tesseraAudit)
    .where(and(eq(tesseraAudit.travelerId, travelerId), gt(tesseraAudit.seq, opts.after ?? 0)))
    .orderBy(desc(tesseraAudit.seq))
    .limit(opts.limit ?? 200);
  return rows.map(toEvent);
}

/** Events a traveler is notified about: anything a clinician did, never the traveler's own actions. */
export const NOTIFY_ROLES_EXCLUDE = new Set(["traveler", "system"]);
