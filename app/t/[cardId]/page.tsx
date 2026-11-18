import type { Metadata } from "next";
import { DEMO_NOTICE, NEUTRAL_CARD_MESSAGE } from "@/shared/tessera";
import { appendAudit } from "@/lib/tessera/audit";
import { lookupForScan } from "@/lib/tessera/cards";
import { tessera } from "@/lib/tessera/http";
import { ParityMark } from "@/components/tessera-mark";
import { TesseraScan } from "@/components/tessera-scan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parity", robots: { index: false, follow: false }, referrer: "no-referrer" };

// Card landing for clinicians. A usable card asks for the patient's date of birth, then shows the
// emergency profile (components/tessera-scan.tsx). Unknown, frozen and voided cards all render the same neutral message.
export default async function Page({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  let usable = false;
  try {
    const { db } = await tessera();
    const scan = await lookupForScan(db, cardId);
    if (scan.usable) {
      usable = true;
      await appendAudit(db, {
        travelerId: scan.card.travelerId, cardId: scan.card.cardId, actor: "Someone", actorRole: "unknown",
        action: "scan", outcome: "success", detail: "Card link opened",
      });
    }
  } catch {
    usable = false;
  }
  return (
    <div className="reader-shell">
      <header className="site-header">
        <span className="wordmark"><ParityMark className="brand-mark" /><span>Parity</span></span>
      </header>
      {usable ? (
        <TesseraScan cardId={cardId} />
      ) : (
        <main className="gate-panel">
          <h1>Parity</h1>
          <p className="lead">{NEUTRAL_CARD_MESSAGE}</p>
          <p className="notice">{DEMO_NOTICE}</p>
        </main>
      )}
    </div>
  );
}
