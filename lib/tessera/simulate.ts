// Presenter-only stand-in for the deferred clinician flow. It writes the same audit events and
// requests the real flow will write, so the traveler app can be demonstrated end to end.
import { appendAudit } from "./audit";
import { currentCard, lookupForScan } from "./cards";
import type { TesseraDb } from "./db";
import { tanaka, unverified, type DemoClinician } from "./seed-data";
import { createFullRequest, type Traveler } from "./traveler";

export const SCENARIOS = ["emergency_view", "wrong_dob", "unverified_clinician", "full_request"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export async function simulate(db: TesseraDb, traveler: Traveler, scenario: Scenario) {
  const card = await currentCard(db, traveler.id);
  // Use the scan path so frozen cards fail exactly like a real scan would.
  const scan = card ? await lookupForScan(db, card.cardId) : { usable: false as const };
  const clinician: DemoClinician = scenario === "unverified_clinician" ? unverified : tanaka;
  if (!scan.usable || !card) return { ok: false, result: "card_unusable" };
  const log = (action: Parameters<typeof appendAudit>[1]["action"], outcome: "success" | "failure" | "denied" | "info", scope: string | null = null, detail: string | null = "Presenter simulation") =>
    appendAudit(db, { travelerId: traveler.id, cardId: card.cardId, actor: clinician.name, actorRole: clinician.role, facility: clinician.facility, scope, action, outcome, detail });

  await log("scan", "success");
  if (scenario === "wrong_dob") {
    await log("id_match", "failure");
    return { ok: true, result: "id_mismatch" };
  }
  await log("id_match", "success");
  if (!clinician.verified) {
    await log("sign_in", "denied", null, "Clinician account is not verified");
    return { ok: true, result: "clinician_denied" };
  }
  await log("sign_in", "success");
  await log("profile_view", "success", "emergency");
  if (scenario === "full_request") {
    const req = await createFullRequest(db, traveler, clinician, "Patient admitted; reviewing prior admissions and discharge summaries.");
    return { ok: true, result: "full_requested", request: req };
  }
  return { ok: true, result: "emergency_viewed" };
}
