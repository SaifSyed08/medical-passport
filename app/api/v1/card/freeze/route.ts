import { z } from "zod";
import { setFrozen, toCard } from "@/lib/tessera/cards";
import { body, publicOrigin, v1error, v1json, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

export const POST = withTraveler(async ({ request, db, traveler }) => {
  const b = await body(request, z.object({ frozen: z.boolean() }));
  if (!b.ok) return b.res;
  const card = await setFrozen(db, traveler.id, b.data.frozen);
  if (!card) return v1error(404, "No card yet.", "no_card");
  return v1json(toCard(card, publicOrigin(request)));
});
