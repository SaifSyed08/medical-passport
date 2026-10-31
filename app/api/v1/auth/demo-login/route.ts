import { z } from "zod";
import { body, tessera, v1error, v1json } from "@/lib/tessera/http";
import { BLANK_LOGIN_CODE, DEMO_LOGIN_CODE, JORDAN_ID } from "@/lib/tessera/seed-data";
import { issueToken } from "@/lib/tessera/tokens";
import { createBlankTraveler } from "@/lib/tessera/traveler";
export { OPTIONS } from "@/lib/tessera/http";

// Demo login: there are no real accounts. "jordan-rivera" signs in as the seeded sample traveler;
// "blank" creates a fresh empty traveler (one per user-test participant).
export async function POST(request: Request) {
  try {
    const { db } = await tessera();
    const b = await body(request, z.object({ code: z.string().max(40) }));
    if (!b.ok) return b.res;
    const code = b.data.code.trim().toLowerCase();
    let travelerId: string;
    if (code === DEMO_LOGIN_CODE) travelerId = JORDAN_ID;
    else if (code === BLANK_LOGIN_CODE) travelerId = await createBlankTraveler(db);
    else return v1error(401, "That demo code didn't work.", "unauthorized");
    const { token, expires } = await issueToken(db, travelerId);
    return v1json({ token, expires });
  } catch {
    return v1error(500, "Sign-in is unavailable. Please try again.", "server_error");
  }
}
