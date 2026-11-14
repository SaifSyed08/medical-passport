import { env } from "cloudflare:workers";
import { v1empty, v1error, withTraveler } from "@/lib/tessera/http";
import { deleteRecord } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

export const DELETE = withTraveler<{ id: string }>(async ({ db, traveler }, { id }) => {
  const r = await deleteRecord(db, env.BUCKET, traveler, id);
  if (r === "not_found") return v1error(404, "Document not found.", "not_found");
  if (r === "not_deletable") return v1error(403, "This record can't be deleted.", "not_deletable");
  return v1empty();
});
