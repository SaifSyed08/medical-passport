import { env } from "cloudflare:workers";
import { tesseraRecords } from "@/db/schema";
import { nowIso } from "@/lib/tessera/db";
import { v1error, v1json, withTraveler } from "@/lib/tessera/http";
import { randomId } from "@/lib/tessera/tokens";
import { listRecords, MAX_UPLOAD_BYTES, simulatedSummary, toRecord, UPLOAD_TYPES } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

export const GET = withTraveler(async ({ db, traveler }) => v1json(await listRecords(db, traveler.id)));

// Multipart upload: fields `file` and optional `title`. Stored in R2 under tessera/{traveler}/{record}.
export const POST = withTraveler(async ({ request, db, traveler }) => {
  if (!env.BUCKET) return v1error(503, "File storage is unavailable.", "storage_unavailable");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return v1error(400, "Expected a file upload.", "bad_request");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return v1error(400, "Choose a file to upload.", "invalid");
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!UPLOAD_TYPES[type]) return v1error(400, "Upload a PDF, JPEG, PNG or HEIC file.", "invalid");
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return v1error(400, "Files must be under 8 MB.", "invalid");
  const title = (String(form.get("title") ?? "").trim() || file.name || "Uploaded document").slice(0, 120);
  const id = "upl_" + randomId(12);
  const r2Key = `tessera/${traveler.id}/${id}`;
  await env.BUCKET.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
  const row = {
    id, travelerId: traveler.id, kind: "upload", title, date: nowIso().slice(0, 10), facility: null, body: null,
    summary: simulatedSummary(title, type, file.size), simulated: 1, r2Key, contentType: type, size: file.size, created: nowIso(),
  };
  await db.insert(tesseraRecords).values(row);
  return v1json(toRecord(row), 201);
});
