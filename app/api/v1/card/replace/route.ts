import { replaceCard, toCard } from "@/lib/tessera/cards";
import { publicOrigin, v1json, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

export const POST = withTraveler(async ({ request, db, traveler }) => {
  const card = await replaceCard(db, traveler.id);
  return v1json(toCard(card, publicOrigin(request)));
});
