import { appendAudit } from "@/lib/tessera/audit";
import { body, v1json, withTraveler } from "@/lib/tessera/http";
import { identitySchema } from "@/lib/tessera/profile";
import { updateIdentity } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

// Name and date of birth shown on the card. The DOB is what a clinician will check against later.
export const PUT = withTraveler(async ({ request, db, traveler }) => {
  const b = await body(request, identitySchema);
  if (!b.ok) return b.res;
  await updateIdentity(db, traveler.id, b.data);
  if (traveler.name || traveler.dob)
    await appendAudit(db, { travelerId: traveler.id, actor: "You", actorRole: "traveler", action: "identity_changed", outcome: "info" });
  return v1json({ name: b.data.name, dob: b.data.dob });
});
