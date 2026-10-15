import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { photos } from "@/db/schema";
import { json, owner } from "@/lib/server";
export async function POST(request:Request) {
  try {
    const user=await owner(request); const bytes=await request.arrayBuffer();
    const b=new Uint8Array(bytes); if(bytes.byteLength>300000 || b[0]!==255 || b[1]!==216 || b[2]!==255) return json({error:"Please choose a photo smaller than 300 KB after resizing."},400);
    if(!env.BUCKET) throw new Error("Storage unavailable");
    const id=crypto.randomUUID(); await env.BUCKET.put(`${user}/${id}`,bytes,{httpMetadata:{contentType:"image/jpeg"}});
    await getDb().insert(photos).values({id,owner:user}); return json({url:`/api/photo/${id}`});
  } catch {return json({error:"Photo upload failed. Please try again."},400);}
}
