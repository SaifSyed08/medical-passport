import { z } from "zod";
import { body, tessera, v1error, v1json } from "@/lib/tessera/http";
import { DEMO_LOGIN_CODE, JORDAN_ID } from "@/lib/tessera/seed-data";
import { issueToken } from "@/lib/tessera/tokens";
export { OPTIONS } from "@/lib/tessera/http";

// Demo login: there are no real accounts. The code only selects the seeded traveler.
export async function POST(request: Request) {
  try {
    const { db } = await tessera();
    const b = await body(request, z.object({ code: z.string().max(40) }));
    if (!b.ok) return b.res;
    if (b.data.code.trim().toLowerCase() !== DEMO_LOGIN_CODE) return v1error(401, "That demo code didn't work.", "unauthorized");
    const { token, expires } = await issueToken(db, JORDAN_ID);
    return v1json({ token, expires });
  } catch {
    return v1error(500, "Sign-in is unavailable. Please try again.", "server_error");
  }
}
