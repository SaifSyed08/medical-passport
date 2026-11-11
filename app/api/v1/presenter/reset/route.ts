import { resetDemo } from "@/lib/tessera/seed";
import { resetSeedFlag, v1error, v1flags, v1json, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

export const POST = withTraveler(async ({ d1, db }) => {
  if (!v1flags().presenterEnabled) return v1error(404, "Not found.", "not_found");
  await resetDemo(d1, db);
  resetSeedFlag();
  return v1json({ reset: true });
});
