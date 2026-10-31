import { listAudit } from "@/lib/tessera/audit";
import { v1json, withTraveler } from "@/lib/tessera/http";
export { OPTIONS } from "@/lib/tessera/http";

export const GET = withTraveler(async ({ db, traveler }) => v1json(await listAudit(db, traveler.id)));
