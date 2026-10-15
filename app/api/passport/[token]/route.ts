import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { passports } from "@/db/schema";
import { identity } from "@/lib/passport";
import { json, owner, readable } from "@/lib/server";
export async function POST(request: Request, context: {params:Promise<{token:string}>}) {
  try {
    // This first release is owner-private and fictional. DOB is a demo UX gate, not clinical authentication.
    const user=await owner(request); const {token}=await context.params; const b=z.object({dob:z.string().max(10)}).parse(await request.json());
    if(b.dob!==identity.dob) return json({error:"That date does not match. Demo date: June 18, 1994."},403);
    const row=await getDb().select().from(passports).where(and(eq(passports.token,token),eq(passports.owner,user))).get();
    if(!row || row.status!=="active" || new Date(row.expires)<new Date()) return json({error:"This passport is unavailable, disabled, or expired."},404);
    return json(readable(row));
  } catch {return json({error:"Please sign in to the demo to view this passport."},401);}
}
