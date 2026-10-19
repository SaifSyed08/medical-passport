"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { AddressField } from "./address-field";
import { searchAddresses,countryCode } from "@/lib/address";
import { type PassportData } from "@/lib/passport";
import { Action, Back, Field, PassportCard } from "./shared";

const themes=["midnight","pearl","cobalt","sage"] as const;
export function CardStudio({stage,data,onChange,onBack,onNext,onSave,onUpload,busy,editing}:{stage:"customize"|"address";data:PassportData;onChange:(data:PassportData)=>void;onBack:()=>void;onNext:()=>void;onSave:()=>void;onUpload:(file:File)=>void;busy:boolean;editing:boolean}) {
  const completeAddress=data.address.street.length>=3&&data.address.city.length>=2&&data.address.region.length>=2&&data.address.postal.length>=3&&data.address.country.length>=2;
  const swiped=useRef(false); const selected=themes.indexOf(data.theme); const file=useRef<HTMLInputElement>(null);const pointer=useRef<number|null>(null);const [drag,setDrag]=useState(0);const [checked,setChecked]=useState(false);
  function choose(index:number){onChange({...data,theme:themes[(index+4)%4]});}
  function finish(x:number){if(pointer.current===null)return;const dx=x-pointer.current;pointer.current=null;setDrag(0);swiped.current=Math.abs(dx)>35;if(swiped.current)choose(selected+(dx<0?1:-1));}
  return <section className={`card-studio studio-${stage}`}><h1 key={stage} className="studio-heading">{stage==="customize"?"Customize your card.":"Where should it find you?"}</h1>
    <div className="card-carousel" role="region" aria-roledescription="carousel" aria-label="Card styles" onKeyDown={e=>{if(stage!=="customize")return;if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();choose(selected+(e.key==="ArrowRight"?1:-1));}}}>
      <div className="card-carousel-track" onPointerDown={e=>{if(stage!=="customize"||e.button!==0)return;swiped.current=false;pointer.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(pointer.current!==null)setDrag(Math.max(-110,Math.min(110,e.clientX-pointer.current)));}} onPointerUp={e=>finish(e.clientX)} onPointerCancel={()=>{pointer.current=null;setDrag(0);}}>
        {themes.map((theme,i)=>{let offset=(i-selected+4)%4;if(offset>1)offset-=4;return <div key={theme} className={`carousel-card ${offset===0?"chosen":""}`} style={{"--offset":offset,"--distance":Math.abs(offset),"--drag":`${drag}px`} as React.CSSProperties} aria-hidden={stage==="address"&&offset!==0}><PassportCard data={{...data,theme}}/><button tabIndex={stage==="customize"?0:-1} className="carousel-card-hit" aria-label={`Choose ${theme} card`} aria-pressed={offset===0} onClick={()=>{if(!swiped.current)choose(i);}} disabled={stage!=="customize"}/></div>;})}
      </div>
      {stage==="customize"&&<><button className="carousel-arrow previous" aria-label="Previous card style" onClick={()=>choose(selected-1)}><ChevronLeft size={21}/></button><button className="carousel-arrow next" aria-label="Next card style" onClick={()=>choose(selected+1)}><ChevronRight size={21}/></button></>}
    </div>
    <div className={`studio-customization ${stage==="address"?"departed":""}`} inert={stage==="address"} aria-hidden={stage==="address"}>
      <div className="theme-picker" aria-label="Card style">{themes.map((theme,i)=><button key={theme} aria-pressed={selected===i} className={selected===i?"active":""} onClick={()=>choose(i)}><i className={`swatch theme-${theme}`}><span className="swatch-check"><Check size={16}/></span></i><span>{theme}</span></button>)}</div>
      <div className="photo-controls"><input ref={file} type="file" accept="image/*" hidden onChange={e=>{if(e.target.files?.[0])onUpload(e.target.files[0]);}}/><button className="text-button" disabled={busy} onClick={()=>file.current?.click()}><Upload size={16}/>{busy?"Uploading…":data.photo?"Change photo":"Add a photo"}</button>{data.photo&&<button className="text-button" onClick={()=>onChange({...data,photo:""})}>Remove</button>}</div>
      <div className="flow-actions"><Back onClick={onBack}/><Action disabled={busy} onClick={onNext}>Looks Good! <ArrowRight size={17}/></Action></div><button className="skip-button" onClick={onNext}>Skip customization</button>
    </div>
    {stage==="address"&&<form className="studio-address" onSubmit={e=>{e.preventDefault();onSave();}}><AddressEntry address={data.address} onChange={address=>{setChecked(false);onChange({...data,address});}}/>{completeAddress&&<label className="check-label address-confirm"><input type="checkbox" required checked={checked} onChange={e=>setChecked(e.target.checked)}/> This address looks correct.</label>}<div className="flow-actions"><Back onClick={onBack}/><Action type="submit" disabled={busy||!checked}>{busy?"Saving…":editing?"Save changes":"Complete my passport"}<Check size={17}/></Action></div></form>}
  </section>;
}

type Suggestion=PassportData["address"]&{place:string;complete:boolean};
export function AddressEntry({address,onChange}:{address:PassportData["address"];onChange:(address:PassportData["address"])=>void}) {
  const [searchOpen,setSearchOpen]=useState(false);
  const [manual,setManual]=useState(!!address.street);
  const [active,setActive]=useState(-1);
  const [query,setQuery]=useState("");const [results,setResults]=useState<Suggestion[]>([]);const [searching,setSearching]=useState(false);const [message,setMessage]=useState("");const [picked,setPicked]=useState(!!address.city);
  useEffect(()=>{if(manual||picked||query.trim().length<4){setResults([]);setSearching(false);return;}const controller=new AbortController();const timer=setTimeout(async()=>{setSearching(true);setMessage("");try{const suggestions=await searchAddresses(query.trim(),controller.signal,"address",countryCode(address.country));if(controller.signal.aborted)return;setResults(suggestions);setActive(-1);if(!suggestions.length)setMessage("No matches yet. Try adding your city, or enter it manually.");}catch(e){if(!controller.signal.aborted)setMessage("Address search is unavailable. Enter your address manually.");}finally{if(!controller.signal.aborted)setSearching(false);}},650);return()=>{clearTimeout(timer);controller.abort();};},[query,manual,picked,address.country]);
  const fields=[["street","Street address","address-line1"],["unit","Apartment / suite","address-line2"],["city","City","address-level2"],["region","State / region","address-level1"],["postal","Postal code","postal-code"],["country","Country","country-name"]] as const;
  function pick(result:Suggestion){const {place,complete,...next}=result;onChange(next);setPicked(true);setSearchOpen(false);setQuery(next.street);setResults([]);setMessage("");if(!complete)setManual(true);}
  return <div className={`address-entry ${searchOpen&&!manual?"suggestions-open":""}`} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setSearchOpen(false);}}>
    {!manual&&<><div className="delivery-search"><Field label=""><input name="street-address" autoComplete="shipping street-address" role="combobox" aria-autocomplete="list" onFocus={()=>setSearchOpen(true)} placeholder="Enter a delivery address…" value={picked?address.street:query} onChange={e=>{setResults([]);setSearching(true);setQuery(e.target.value);setSearchOpen(true);setPicked(false);onChange({...address,street:e.target.value,city:"",region:"",postal:""});}} aria-expanded={searchOpen} aria-controls="address-suggestions" onKeyDown={e=>{if(e.key==="Escape")setSearchOpen(false);if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setSearchOpen(true);setActive(a=>(a+(e.key==="ArrowDown"?1:-1)+results.length+1)%(results.length+1));}if(e.key==="Enter"&&searchOpen&&active>=0){e.preventDefault();if(results[active])pick(results[active]);else{setManual(true);setSearchOpen(false);}}}}/></Field>
      {searchOpen&&<ul id="address-suggestions" className="address-suggestions">{(searching||message)&&<li className="address-search-message" role="status">{searching?"Finding addresses…":message}</li>}{results.map((r,i)=><li key={i}><button className={active===i?"active":""} type="button" onPointerDown={e=>{e.preventDefault();pick(r);}} onClick={()=>pick(r)}><span><strong>{r.street}</strong>{r.place&&r.place!==r.street&&<small>{r.place}</small>}</span><small>{[r.city,r.region].filter(Boolean).join(", ")}</small></button></li>)}<li className={results.length?"manual-option separated":"manual-option"}><button type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>{setManual(true);setSearchOpen(false);setMessage("");}}>Enter address manually</button></li></ul>}</div>
      {picked&&<p className="address-selected"><Check size={15}/>{[address.city,address.region,address.postal,address.country].filter(Boolean).join(", ")}</p>}
      
    </>}
    <button type="button" className="text-button demo-address" onClick={()=>{onChange({street:"123 Example Lane",unit:"",city:"Cedar Park",region:"Texas",postal:"78613",country:"United States"});setPicked(true);setQuery("123 Example Lane");setSearchOpen(false);setManual(false);setMessage("");}}>Use demo address</button>{manual&&<button className="text-button manual-toggle" type="button" onClick={()=>{setManual(false);setMessage("");}}>Search for an address</button>}
    {manual&&<div className="address-details">{fields.map(([key,label,autocomplete])=><AddressField key={key} field={key} label={label} autoComplete={autocomplete} address={address} onChange={onChange}/>)}</div>}
    {!manual&&picked&&<Field label="Apartment / suite (optional)"><input autoComplete="address-line2" value={address.unit} maxLength={80} onChange={e=>onChange({...address,unit:e.target.value})}/></Field>}
    {!manual&&<input className="address-validation" tabIndex={-1} aria-label="Select a complete address or enter it manually" required value={address.street.length>=3&&address.city.length>=2&&address.region.length>=2&&address.postal.length>=3&&address.country.length>=2?"complete":""} onChange={()=>{}} onInvalid={()=>setManual(true)}/>}
    
  </div>;
}
