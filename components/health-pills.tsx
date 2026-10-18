"use client";
import { useEffect,useId,useRef,useState } from "react";
import { Plus,X } from "lucide-react";
const vocabulary={
 allergies:["Penicillin","Amoxicillin","Aspirin","Ibuprofen","Latex","Peanuts","Tree nuts","Shellfish","Eggs","Milk","Pollen"],
 conditions:["Asthma","Seasonal allergies","Diabetes","High blood pressure","Migraine","Eczema","Sleep apnea","Hypothyroidism"],
 medications:["Albuterol","Cetirizine","Loratadine","Metformin","Lisinopril","Levothyroxine","Atorvastatin","Omeprazole","Ibuprofen","Acetaminophen"],
};
export function HealthPills({kind,label,value,onChange,maxLength}:{kind:keyof typeof vocabulary;label:string;value:string;onChange:(value:string)=>void;maxLength:number}){
 const input=useRef<HTMLInputElement>(null);const [expanded,setExpanded]=useState(false),[remote,setRemote]=useState<string[]>([]);const id=useId();const [query,setQuery]=useState(""),[open,setOpen]=useState(false),[active,setActive]=useState(-1);
 const items=value.split(/[;\n]/).map(x=>x.trim()).filter(Boolean);
 useEffect(()=>{setRemote([]);if(kind!=="medications"||query.trim().length<2)return;const controller=new AbortController();const timer=setTimeout(async()=>{try{const response=await fetch("https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?maxList=5&terms="+encodeURIComponent(query.trim()),{signal:controller.signal,credentials:"omit",referrerPolicy:"no-referrer"});if(!response.ok)return;const data=await response.json() as [number,string[],unknown,string[][]];if(!controller.signal.aborted)setRemote((data[3]||[]).map((x:string[])=>x[0]));}catch{}},350);return()=>{clearTimeout(timer);controller.abort();};},[query,kind]);
 const options=(remote.length?remote:vocabulary[kind]).filter(x=>query.trim()&&x.toLowerCase().includes(query.trim().toLowerCase())&&!items.some(i=>i.toLowerCase()===x.toLowerCase())).slice(0,5);
 const tooLong=[...items,query.trim()].join("; ").length>maxLength;
 function add(text:string){const clean=text.trim();if(!clean)return;if([...items,clean].join("; ").length>maxLength)return;if(!items.some(x=>x.toLowerCase()===clean.toLowerCase()))onChange([...items,clean].join("; "));setQuery("");setOpen(false);setExpanded(false);setActive(-1);}
 return <section className="health-group" aria-label={label}><h2>{label}</h2><div className="health-pill-list">
 {items.map((item,i)=><span className="health-pill" key={item+i}><span>{item}</span><button type="button" aria-label={"Remove "+item} onClick={()=>onChange(items.filter((_,n)=>n!==i).join("; "))}><X size={13}/></button></span>)}
 {!expanded?<button type="button" className="health-plus" aria-label={"Add "+label.toLowerCase()} onClick={()=>{setExpanded(true);setTimeout(()=>input.current?.focus(),0);}}><Plus size={17}/></button>:<div className="health-add"><input ref={input} aria-label={"Add "+label.toLowerCase()} role="combobox" aria-expanded={open&&options.length>0} aria-controls={id} aria-autocomplete="list" aria-activedescendant={active>=0?id+"-"+active:undefined} placeholder={kind==="medications"?"Add medication…":"+ Add"} value={query} maxLength={maxLength} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(-1);}} onFocus={()=>setOpen(true)} onBlur={()=>{setOpen(false);if(!query)setExpanded(false);}} onKeyDown={e=>{if(e.key==="Escape")setOpen(false);if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setOpen(true);setActive(i=>options.length?(i+(e.key==="ArrowDown"?1:-1)+options.length)%options.length:-1);}if(e.key==="Enter"){e.preventDefault();add(open&&active>=0?options[active]:query);}}}/>{query&&<button type="button" aria-label={"Add entered "+label.toLowerCase()} disabled={tooLong} onClick={()=>add(query)}><Plus size={15}/></button>}
 {open&&options.length>0&&<ul id={id} className="health-options" role="listbox" aria-label={label+" suggestions"}>{options.map((option,i)=><li role="option" id={id+"-"+i} aria-selected={active===i} key={option}><button type="button" tabIndex={-1} onPointerDown={e=>e.preventDefault()} onClick={()=>add(option)}>{option}</button></li>)}</ul>}
 </div>}</div>{tooLong&&<p role="status" className="pill-limit">Please shorten this entry.</p>}</section>;
}
