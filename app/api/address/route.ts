import { json } from "@/lib/server";
import { parseAddresses,photonParams,type AddressKind } from "@/lib/address";
export async function GET(request:Request){
 const url=new URL(request.url),q=url.searchParams.get("q")?.trim()||"";
 if(q.length<3||q.length>180)return json({suggestions:[]});
 const raw=url.searchParams.get("kind"),kind:AddressKind=raw==="region"||raw==="postal"||raw==="city"?raw:"address";
 const country=url.searchParams.get("country")||"";
 if(country&&!/^[A-Z]{2}$/.test(country))return json({suggestions:[]});
 try{
  const response=await fetch("https://photon.komoot.io/api/?"+photonParams(q,kind,country),{headers:{Accept:"application/json"},signal:AbortSignal.timeout(3500)});
  if(!response.ok){console.warn("Address provider returned status",response.status);return json({error:"Address provider unavailable",directFallback:true},503);}
  return json({suggestions:parseAddresses(await response.json())});
 }catch{console.warn("Address provider request failed");return json({error:"Address provider unavailable",directFallback:true},503);}
}
