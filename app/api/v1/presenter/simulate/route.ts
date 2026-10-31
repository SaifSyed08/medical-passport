import { z } from "zod";
import { body, v1error, v1flags, v1json, withTraveler } from "@/lib/tessera/http";
import { SCENARIOS, simulate } from "@/lib/tessera/simulate";
export { OPTIONS } from "@/lib/tessera/http";

export const POST = withTraveler(async ({ request, db, traveler }) => {
  if (!v1flags().presenterEnabled) return v1error(404, "Not found.", "not_found");
  const b = await body(request, z.object({ scenario: z.enum(SCENARIOS) }));
  if (!b.ok) return b.res;
  return v1json(await simulate(db, traveler, b.data.scenario));
});
