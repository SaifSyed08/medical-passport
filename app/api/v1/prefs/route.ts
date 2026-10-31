import { z } from "zod";
import { body, v1json, withTraveler } from "@/lib/tessera/http";
import { getTraveler, updateTraveler } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

export const PUT = withTraveler(async ({ request, db, traveler }) => {
  const b = await body(request, z.object({ language: z.enum(["ja", "en"]).optional(), autoApprove: z.boolean().optional() }));
  if (!b.ok) return b.res;
  await updateTraveler(db, traveler.id, b.data);
  const t = (await getTraveler(db, traveler.id))!;
  return v1json({ language: t.language, autoApprove: t.autoApprove });
});
