import type { Profile } from "@/shared/tessera";
import { body, v1json, withTraveler } from "@/lib/tessera/http";
import { mergeTranslations, profileSchema } from "@/lib/tessera/profile";
import { getTraveler, updateTraveler } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

export const GET = withTraveler(async ({ traveler }) => v1json(traveler.profile));

export const PUT = withTraveler(async ({ request, db, traveler }) => {
  const b = await body(request, profileSchema);
  if (!b.ok) return b.res;
  const profile = mergeTranslations(traveler.profile, b.data as Profile);
  await updateTraveler(db, traveler.id, { profile });
  return v1json((await getTraveler(db, traveler.id))!.profile);
});
