import { z } from "zod";
import { NEUTRAL_CARD_MESSAGE } from "@/shared/tessera";
import { body, tessera, v1error, v1json } from "@/lib/tessera/http";
import { languageSchema } from "@/lib/tessera/profile";
import { viewForScan } from "@/lib/tessera/scan";
export { OPTIONS } from "@/lib/tessera/http";

// Public: called by the page a card's QR code opens (/t/{cardId}). No sign-in; the card id plus the
// patient's date of birth unlock the emergency view, and nothing else.
const schema = z.object({ dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), lang: languageSchema.optional(), again: z.boolean().optional() });

export async function POST(request: Request, context: { params: Promise<{ cardId: string }> }) {
  try {
    const { cardId } = await context.params;
    const b = await body(request, schema);
    if (!b.ok) return b.res;
    const { db } = await tessera();
    const r = await viewForScan(db, cardId, b.data.dob, b.data.lang, b.data.again);
    if (r.ok) return v1json(r.view);
    if (r.reason === "locked") return v1error(429, "Too many tries. Wait 15 minutes, then try again.", "locked");
    if (r.reason === "mismatch") return v1error(403, "That date of birth doesn't match this card.", "mismatch");
    return v1error(404, NEUTRAL_CARD_MESSAGE, "unusable");
  } catch (e) {
    console.error("tessera scan error", e instanceof Error ? e.message : e);
    return v1error(500, "Something went wrong. Please try again.", "server_error");
  }
}
