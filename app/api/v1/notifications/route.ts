import { listAudit, NOTIFY_ROLES_EXCLUDE } from "@/lib/tessera/audit";
import { v1json, withTraveler } from "@/lib/tessera/http";
import { listRequests } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

// Polled by the app. `after` is the highest audit seq the app has already seen.
export const GET = withTraveler(async ({ request, db, traveler }) => {
  const after = Math.max(0, Number(new URL(request.url).searchParams.get("after")) || 0);
  const events = (await listAudit(db, traveler.id, { after, limit: 50 })).filter(e => !NOTIFY_ROLES_EXCLUDE.has(e.actorRole));
  const pending = (await listRequests(db, traveler.id)).filter(r => r.status === "pending");
  return v1json({ events, pending });
});
