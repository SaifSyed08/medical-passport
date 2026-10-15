import { env } from "cloudflare:workers";
import { owner } from "@/lib/server";
export async function GET(_:Request, context:{params:Promise<{id:string}>}) {
  try { const user=await owner(); const {id}=await context.params; if(!/^[a-f0-9-]{36}$/.test(id)) return new Response(null,{status:404}); const photo=await env.BUCKET?.get(`${user}/${id}`); if(!photo)return new Response(null,{status:404}); return new Response(photo.body,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}}); }
  catch {return new Response(null,{status:401});}
}
