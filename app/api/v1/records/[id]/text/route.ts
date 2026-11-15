import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { tesseraRecords } from "@/db/schema";
import { appendAudit } from "@/lib/tessera/audit";
import { body, v1empty, v1error, v1json, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

// The document scanner (extractor/) stores the text it read off an upload, so the record has real contents
// (the interpreter matches against it). Only the traveler's own uploads; seeded records keep their text.
const textSchema = z.object({ text: z.string().trim().min(1).max(20000) });

// The scanner reads the saved text back instead of reading the file again on a re-run. Still a document read, so it is logged.
export const GET = withTraveler<{ id: string }>(async ({ db, traveler }, { id }) => {
  const where = and(eq(tesseraRecords.id, id), eq(tesseraRecords.travelerId, traveler.id));
  const row = await db.select({ kind: tesseraRecords.kind, title: tesseraRecords.title, body: tesseraRecords.body }).from(tesseraRecords).where(where).get();
  if (!row) return v1error(404, "Document not found.", "not_found");
  if (row.kind !== "upload") return v1error(403, "Only uploaded documents have scanned text.", "not_upload");
  const text = row.body ?? "";
  if (text) await appendAudit(db, { travelerId: traveler.id, actor: "Tessera", actorRole: "system", action: "document_read", outcome: "info", detail: row.title });
  return v1json({ text });
});

export const PUT = withTraveler<{ id: string }>(async ({ request, db, traveler }, { id }) => {
  const b = await body(request, textSchema);
  if (!b.ok) return b.res;
  const where = and(eq(tesseraRecords.id, id), eq(tesseraRecords.travelerId, traveler.id));
  const row = await db.select({ kind: tesseraRecords.kind }).from(tesseraRecords).where(where).get();
  if (!row) return v1error(404, "Document not found.", "not_found");
  if (row.kind !== "upload") return v1error(403, "Only uploaded documents can be updated.", "not_upload");
  await db.update(tesseraRecords).set({ body: b.data.text }).where(where);
  return v1empty();
});
