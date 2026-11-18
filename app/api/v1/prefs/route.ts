import { z } from "zod";
import { languageForCountry } from "@/shared/tessera";
import { body, v1json, withTraveler } from "@/lib/tessera/http";
import { destinationSchema, languageSchema, withDestination } from "@/lib/tessera/profile";
import { getTraveler, updateTraveler } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

// Setting the destination country also sets the doctor-facing language, unless a language is given explicitly.
export const PUT = withTraveler(async ({ request, db, traveler }) => {
  const b = await body(
    request,
    z.object({ language: languageSchema.optional(), destinationCountry: destinationSchema.optional(), autoApprove: z.boolean().optional() }),
  );
  if (!b.ok) return b.res;
  const { destinationCountry, autoApprove } = b.data;
  const language = b.data.language ?? (destinationCountry ? languageForCountry(destinationCountry) : undefined);
  const profile = destinationCountry ? withDestination(traveler.profile, destinationCountry) : undefined;
  await updateTraveler(db, traveler.id, { language, autoApprove, profile });
  const t = (await getTraveler(db, traveler.id))!;
  return v1json({ language: t.language, autoApprove: t.autoApprove, destinationCountry: t.profile.basics.destinationCountry ?? null });
});
