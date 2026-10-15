import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { passports, photos } from "@/db/schema";
import { dataSchema } from "@/lib/passport";
import { json, owner, unpack } from "@/lib/server";
export async function GET() {
  try { const user = await owner(); return json(await getDb().select().from(passports).where(eq(passports.owner, user)).orderBy(desc(passports.created)).then(rows => rows.map(unpack))); }
  catch (e) { return json({ error: (e as Error).message }, 401); }
}
export async function POST(request: Request) {
  try {
    const user = await owner(request); const data = dataSchema.parse(await request.json());
    if (data.photo) { const p = await getDb().select().from(photos).where(and(eq(photos.id, data.photo.split("/").pop()!), eq(photos.owner, user))).get(); if (!p) return json({error:"Photo unavailable. Please upload it again."},400); }
    const created = new Date(); const expires = new Date(created); expires.setFullYear(expires.getFullYear()+3);
    const arrival = new Date(created); arrival.setDate(arrival.getDate()+10);
    const id = crypto.randomUUID(); const row = {id, owner:user, token:crypto.randomUUID(), number:"MP-"+crypto.randomUUID().replaceAll("-", "").slice(0,10).toUpperCase(), status:"active", data:JSON.stringify(data), created:created.toISOString(), expires:expires.toISOString(), arrival:arrival.toISOString()};
    await getDb().insert(passports).values(row); return json(unpack(row),201);
  } catch (e) { return json({error:e instanceof Error && e.message.includes("sign in") ? e.message : "Please check your details and try again."},400); }
}
export async function PATCH(request: Request) {
  try {
    const user = await owner(request); const b = z.object({id:z.string().uuid(),status:z.enum(["active","disabled"]).optional(),data:dataSchema.optional()}).parse(await request.json());
    const row = await getDb().select().from(passports).where(and(eq(passports.id,b.id),eq(passports.owner,user))).get();
    if (!row) return json({error:"Card not found."},404);
    const update: {status?:string; data?:string} = {};
    if (b.status === "active" || b.status === "disabled") update.status=b.status;
    if (b.data) { const data = dataSchema.parse(b.data); if(data.photo) { const photo = await getDb().select().from(photos).where(and(eq(photos.id,data.photo.split("/").pop()!),eq(photos.owner,user))).get(); if(!photo) return json({error:"Photo not found."},400); } update.data=JSON.stringify(data); }
    await getDb().update(passports).set(update).where(and(eq(passports.id,row.id),eq(passports.owner,user)));
    return json(unpack({...row,...update}));
  } catch { return json({error:"Unable to update. Check your details and try again."},400); }
}
export async function DELETE(request: Request) {
  try {
    const user=await owner(request); const {id}=z.object({id:z.string().uuid()}).parse(await request.json());
    const row=await getDb().select().from(passports).where(and(eq(passports.id,id),eq(passports.owner,user))).get();
    if(!row) return json({error:"Card not found."},404);
    await getDb().delete(passports).where(and(eq(passports.id,id),eq(passports.owner,user)));
    const photo=unpack(row).data.photo.split("/").pop();
    if(photo) { const others=await getDb().select().from(passports).where(eq(passports.owner,user)); if(!others.some(x=>unpack(x).data.photo.endsWith(photo))) { await env.BUCKET?.delete(`${user}/${photo}`); await getDb().delete(photos).where(and(eq(photos.id,photo),eq(photos.owner,user))); } }
    return json({deleted:true});
  } catch {return json({error:"Could not delete this card. Please retry."},400);}
}
