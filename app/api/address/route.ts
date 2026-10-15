import { json, owner } from "@/lib/server";
export async function GET(request:Request) {
  try {
    await owner();const q=new URL(request.url).searchParams.get("q")?.trim()??"";
    if(q.length<4||q.length>180)return json({suggestions:[]});
    const params=new URLSearchParams({q,limit:"5",lang:"en",lat:"30.505",lon:"-97.82",zoom:"10"});
    const response=await fetch(`https://photon.komoot.io/api/?${params}`,{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(7000)});
    if(!response.ok)throw new Error("Unavailable");
    const result=await response.json() as {features?:{properties:Record<string,string>}[]};
    return json({suggestions:(result.features??[]).map(({properties:p})=>({
      street:[p.housenumber,p.street].filter(Boolean).join(" ")||p.name||"",
      city:p.city||p.town||p.village||p.locality||p.district||"",region:p.state||"",postal:p.postcode||"",country:p.country||"",
      unit:"",place:p.name!==p.street?p.name:"",complete:!!(p.housenumber&&p.street&&p.postcode&&(p.city||p.town||p.village)&&p.state),
    })).filter(p=>p.street)});
  } catch {return json({error:"Address search is unavailable. You can enter your address manually."},503);}
}
