import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { DEMO_NOTICE, NEUTRAL_CARD_MESSAGE } from "@/shared/tessera";
import { appendAudit } from "@/lib/tessera/audit";
import { lookupForScan } from "@/lib/tessera/cards";
import { tessera } from "@/lib/tessera/http";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tessera", robots: { index: false, follow: false }, referrer: "no-referrer" };

// Card landing for clinicians. Placeholder until the clinician flow is built: it shows nothing
// beyond "card detected". Unknown, frozen and voided cards all render the same neutral message.
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
        <span className="wordmark"><span className="brand-icon"><Plus size={20} strokeWidth={2.5} /></span><span>Tessera</span></span>
      </header>
      <main className="gate-panel">
        {usable ? (
          <>
            <p className="eyebrow">Card detected</p>
            <h1>Tessera card</h1>
            <p className="lead">Clinician access is coming soon. In the full flow you&apos;ll confirm the patient&apos;s identity and your own authorization before any information is shown.</p>
          </>
        ) : (
          <>
            <h1>Tessera</h1>
            <p className="lead">{NEUTRAL_CARD_MESSAGE}</p>
          </>
        )}
        <p className="notice">{DEMO_NOTICE}</p>
      </main>
    </div>
  );
}
