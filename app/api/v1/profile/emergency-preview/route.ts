import { v1json, withTraveler } from "@/lib/tessera/http";
import { emergencyView } from "@/lib/tessera/profile";
export { OPTIONS } from "@/lib/tessera/http";

// The traveler's own preview of what a verified clinician will see in emergency scope.
export const GET = withTraveler(async ({ request, traveler }) => {
  const q = new URL(request.url).searchParams.get("lang");
  const lang = q === "en" || q === "ja" ? q : traveler.language;
  return v1json(emergencyView(traveler.name, traveler.profile, traveler.privacy, lang));
});
