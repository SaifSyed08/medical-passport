import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { passports } from "@/db/schema";
import { identity } from "@/lib/passport";
import { json, owner } from "@/lib/server";
export async function POST(request:Request) {
  try {
    const user=await owner(request); const b=z.object({mode:z.enum(["number","identity"]),number:z.string().max(30),name:z.string().max(120),dob:z.string().max(10)}).parse(await request.json());
    if(b.mode!=="number" && (String(b.name).trim().toLowerCase()!==identity.name.toLowerCase() || b.dob!==identity.dob)) return json([]);
    const rows=await getDb().select().from(passports).where(and(eq(passports.owner,user),eq(passports.status,"active")));
    return json(rows.filter(r=>new Date(r.expires)>new Date() && (b.mode!=="number" || r.number===String(b.number).trim().toUpperCase())).map(r=>({number:r.number,token:r.token,name:identity.name,dob:identity.dob,expires:r.expires})));
  } catch {return json({error:"Please sign in to access the professional demo."},401);}
}
