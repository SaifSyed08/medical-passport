import { currentCard, toCard } from "@/lib/tessera/cards";
import { publicOrigin, v1error, v1json, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

export const GET = withTraveler(async ({ request, db, traveler }) => {
  const card = await currentCard(db, traveler.id);
  if (!card) return v1error(404, "No card yet.", "no_card");
  return v1json(toCard(card, publicOrigin(request)));
});
