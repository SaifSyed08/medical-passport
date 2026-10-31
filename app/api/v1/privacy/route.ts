import type { Privacy } from "@/shared/tessera";
import { appendAudit } from "@/lib/tessera/audit";
import { body, v1json, withTraveler } from "@/lib/tessera/http";
import { privacySchema } from "@/lib/tessera/profile";
import { updateTraveler } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

export const GET = withTraveler(async ({ traveler }) => v1json(traveler.privacy));

export const PUT = withTraveler(async ({ request, db, traveler }) => {
  const b = await body(request, privacySchema);
  if (!b.ok) return b.res;
  const privacy = b.data as Privacy;
  await updateTraveler(db, traveler.id, { privacy });
  const changed = (Object.keys(privacy) as (keyof Privacy)[]).filter(k => privacy[k] !== traveler.privacy[k]);
  if (changed.length)
    await appendAudit(db, {
      travelerId: traveler.id, actor: "You", actorRole: "traveler", action: "privacy_changed", outcome: "info",
      detail: changed.map(k => `${k}: ${privacy[k]}`).join(", "),
    });
  return v1json(privacy);
});
