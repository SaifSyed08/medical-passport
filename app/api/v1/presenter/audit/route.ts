import { asc, eq } from "drizzle-orm";
import { tesseraAudit } from "@/db/schema";
import { v1error, v1flags, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`;
};
const COLS = ["seq", "at", "cardId", "actor", "actorRole", "facility", "scope", "action", "outcome", "detail", "seeded"] as const;

export const GET = withTraveler(async ({ db, traveler }) => {
  if (!v1flags().presenterEnabled) return v1error(404, "Not found.", "not_found");
  const rows = await db.select().from(tesseraAudit).where(eq(tesseraAudit.travelerId, traveler.id)).orderBy(asc(tesseraAudit.seq));
  const csv = [COLS.join(","), ...rows.map(r => COLS.map(c => cell(r[c])).join(","))].join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tessera-audit.csv"`, "Cache-Control": "no-store" },
  });
});
