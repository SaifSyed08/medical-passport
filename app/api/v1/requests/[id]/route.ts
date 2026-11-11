import { z } from "zod";
import { body, v1error, v1json, withTraveler } from "@/lib/tessera/http";
import { decideRequest } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

// The app asks for biometric confirmation before calling this. The server can't verify that step.
export const POST = withTraveler<{ id: string }>(async ({ request, db, traveler }, { id }) => {
  const b = await body(request, z.object({ decision: z.enum(["approved", "denied"]) }));
  if (!b.ok) return b.res;
  const r = await decideRequest(db, traveler.id, id, b.data.decision);
  if (!r) return v1error(404, "Request not found.", "not_found");
  return v1json(r);
});
