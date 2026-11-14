import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { tesseraRecords } from "@/db/schema";
import { appendAudit } from "@/lib/tessera/audit";
import { body, v1empty, v1error, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

const acceptedSchema = z.object({ count: z.number().int().min(1).max(60) });

export const POST = withTraveler<{ id: string }>(async ({ request, db, traveler }, { id }) => {
  const b = await body(request, acceptedSchema);
  if (!b.ok) return b.res;
  const row = await db.select().from(tesseraRecords).where(and(eq(tesseraRecords.id, id), eq(tesseraRecords.travelerId, traveler.id))).get();
  if (!row) return v1error(404, "Document not found.", "not_found");
  await appendAudit(db, {
    travelerId: traveler.id, actor: "You", actorRole: "traveler", action: "suggestions_accepted", outcome: "info",
    detail: `${b.data.count} item(s) from ${row.title}`,
  });
  return v1empty();
});
