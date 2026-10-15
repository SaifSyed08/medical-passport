"use client";
import { useEffect, useRef } from "react";
import { Activity, Check, ChevronDown, Heart, HeartPulse, Plus, Smartphone, Watch } from "lucide-react";
import { providers, type Provider } from "@/lib/passport";
export function IntegrationPicker({selected,onChange}:{selected:Provider[];onChange:(ids:Provider[])=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const box=ref.current!; let frame=0;
    const render=()=>{const bounds=box.getBoundingClientRect();const center=bounds.top+bounds.height/2;box.querySelectorAll<HTMLElement>(".integration-row").forEach(row=>{const r=row.getBoundingClientRect();const distance=Math.abs(r.top+r.height/2-center);const focus=Math.max(0,1-distance/230);row.style.setProperty("--focus",String(focus));});};
    const scroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(render);};
    box.scrollTop=84;render();box.addEventListener("scroll",scroll,{passive:true});const observer=new ResizeObserver(scroll);observer.observe(box);return()=>{box.removeEventListener("scroll",scroll);observer.disconnect();cancelAnimationFrame(frame);};
  },[]);
  const icons={apple:<Heart fill="currentColor"/>,arc:<img src="/arc-logo.svg" alt="Austin Regional Clinic logo"/>,fitbit:<Activity/>,garmin:<Watch/>,samsung:<HeartPulse/>,healthconnect:<Smartphone/>,mychart:<HeartPulse/>,onemedical:<Plus/>};
  return <div className="integration-wheel"><div ref={ref} className="integration-scroll" aria-label="Health integrations" tabIndex={0}>
    {(Object.keys(providers) as Provider[]).map(id=><div className="integration-row" key={id}><button aria-pressed={selected.includes(id)} className={`integration-pill ${selected.includes(id)?"selected":""}`} onClick={()=>onChange(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])} onFocus={e=>{const box=ref.current!;const row=e.currentTarget.parentElement!;box.scrollTo({top:row.offsetTop-(box.clientHeight-row.offsetHeight)/2,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});}}><span className={`provider-icon ${id}`}>{icons[id]}</span><strong>{providers[id]}</strong><span className="provider-check">{selected.includes(id)?<Check size={17}/>:<Plus size={17}/>}</span></button></div>)}
  </div><button className="integration-scroll-cue" aria-label="Show more integrations" onClick={()=>ref.current?.scrollBy({top:84,behavior:"smooth"})}><ChevronDown size={17}/></button></div>;
}
