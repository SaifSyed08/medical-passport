import { v1json, withTraveler } from "@/lib/tessera/http";
import { revokeToken } from "@/lib/tessera/tokens";
export { OPTIONS } from "@/lib/tessera/http";

export const POST = withTraveler(async ({ db, token }) => {
  await revokeToken(db, token);
  return v1json({ signedOut: true });
});
