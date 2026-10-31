import { v1json, withTraveler } from "@/lib/tessera/http";
import { listRequests } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

export const GET = withTraveler(async ({ db, traveler }) => v1json(await listRequests(db, traveler.id)));
