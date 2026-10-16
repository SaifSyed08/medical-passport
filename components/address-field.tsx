"use client";
import { useEffect,useId,useState } from "react";
import { countries,countryCode,regions,searchAddresses,usAbbreviations } from "@/lib/address";
import type { PassportData } from "@/lib/passport";
import { Field } from "./shared";
type Address=PassportData["address"];
type Option={value:string;detail?:string;patch?:Partial<Address>};
export function AddressField({field,label,autoComplete,address,onChange}:{field:keyof Address;label:string;autoComplete:string;address:Address;onChange:(next:Address)=>void}){
 const id=useId(),value=address[field],code=countryCode(address.country);
 const [open,setOpen]=useState(false),[remote,setRemote]=useState<Option[]>([]),[active,setActive]=useState(-1);
 const q=value.trim().toLowerCase();
 const local:Option[]=field==="country"?countries.filter(c=>!q||c.name.toLowerCase().includes(q)||c.code.toLowerCase()===q).map(c=>({value:c.name,detail:c.code})):field==="region"?(regions[code]||[]).filter((r,i)=>!q||r.toLowerCase().includes(q)||(code==="US"&&usAbbreviations[i].toLowerCase()===q)).map(r=>({value:r})): [];
 const options=(local.length?local:remote).slice(0,7);
 useEffect(()=>{setActive(-1);setRemote([]);if(!open||value.trim().length<3||field==="country"||field==="unit"||(field==="region"&&regions[code]))return;
 const controller=new AbortController();const timer=setTimeout(async()=>{try{
  const kind=field==="region"?"region":field==="postal"?"postal":field==="city"?"city":"address";
  const query=field==="postal"?[value,address.city,address.region].filter(Boolean).join(" "):field==="street"?[value,address.city,address.region].filter(Boolean).join(" "):value;
  const results=await searchAddresses(query,controller.signal,kind,code);if(controller.signal.aborted)return;
  const seen=new Set<string>();const next:Option[]=[];
  for(const r of results){const resultValue=r[field];if(!resultValue||seen.has(resultValue)||(field==="postal"&&!resultValue.toLowerCase().startsWith(value.toLowerCase())))continue;seen.add(resultValue);
   next.push({value:resultValue,detail:[r.city,r.region,r.country].filter(Boolean).join(", "),patch:field==="postal"?{...(r.city?{city:r.city}:{}),...(r.region?{region:r.region}:{}),...(r.country?{country:r.country}:{})}:field==="street"?{street:r.street,...(r.city?{city:r.city}:{}),...(r.region?{region:r.region}:{}),...(r.postal?{postal:r.postal}:{}),...(r.country?{country:r.country}:{})}:undefined});
  }setRemote(next);
 }catch{/* Manual values remain valid when the public lookup service is unavailable. */}},650);
 return()=>{clearTimeout(timer);controller.abort();};
 },[value,open,field,code,address.city,address.region]);
 function pick(option:Option){onChange({...address,...option.patch,[field]:option.value});setOpen(false);setActive(-1);}
 return <div className="address-combo"><Field label={label}><input role="combobox" aria-autocomplete="list" aria-expanded={open&&options.length>0} aria-controls={id} aria-activedescendant={active>=0?id+"-"+active:undefined} name={field} autoComplete={autoComplete} required={field!=="unit"} minLength={field==="street"||field==="postal"?3:field==="unit"?0:2} maxLength={field==="street"?160:field==="postal"?20:80} value={value} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onChange={e=>{onChange({...address,[field]:e.target.value});setOpen(true);}} onKeyDown={e=>{if(e.key==="Escape"){setOpen(false);return;}if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setOpen(true);setActive(i=>options.length?(i+(e.key==="ArrowDown"?1:-1)+options.length)%options.length:-1);}if(e.key==="Enter"&&open&&active>=0&&options[active]){e.preventDefault();pick(options[active]);}}}/></Field>
 {open&&options.length>0&&<ul className="address-field-options" id={id} role="listbox" aria-label={label+" suggestions"}>{options.map((o,i)=><li key={o.value} role="option" id={id+"-"+i} aria-selected={active===i}><button type="button" tabIndex={-1} onPointerDown={e=>e.preventDefault()} onClick={()=>pick(o)}>{o.value}{o.detail&&<small>{o.detail}</small>}</button></li>)}</ul>}</div>;
}
