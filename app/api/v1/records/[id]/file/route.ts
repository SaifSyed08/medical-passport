import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { tesseraRecords } from "@/db/schema";
import { v1error, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

export const GET = withTraveler<{ id: string }>(async ({ db, traveler }, { id }) => {
  const row = await db.select().from(tesseraRecords).where(and(eq(tesseraRecords.id, id), eq(tesseraRecords.travelerId, traveler.id))).get();
  const obj = row?.r2Key ? await env.BUCKET?.get(row.r2Key) : null;
  if (!row || !obj) return v1error(404, "File unavailable.", "not_found");
  return new Response(obj.body, {
    headers: { "Content-Type": row.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
});
