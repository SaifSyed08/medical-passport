import { currentCard, toCard } from "@/lib/tessera/cards";
import { publicOrigin, v1error, v1flags, withTraveler } from "@/lib/tessera/http";
import { buildPassContent, passIssuer, WalletNotEnabledError } from "@/lib/tessera/wallet";
export { OPTIONS } from "@/lib/tessera/http";

// Reserved: GET /api/v1/passes/{card_id}.pkpass. Returns 501 JSON until Wallet signing exists.
export const GET = withTraveler<{ file: string }>(async ({ request, db, traveler }, { file }) => {
  const cardId = file.endsWith(".pkpass") ? file.slice(0, -".pkpass".length) : "";
  const card = await currentCard(db, traveler.id);
  if (!card || card.cardId !== cardId) return v1error(404, "Pass not found.", "not_found");
  const notEnabled = () => v1error(501, "Apple Wallet isn't enabled for this demo yet.", "wallet_not_enabled");
  if (!v1flags().walletEnabled) return notEnabled();
  try {
    const pkpass = await passIssuer.issue(buildPassContent(toCard(card, publicOrigin(request)), traveler.name));
    return new Response(pkpass, {
      headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": `attachment; filename="tessera.pkpass"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof WalletNotEnabledError) return notEnabled();
    throw e;
  }
});
