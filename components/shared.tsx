"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Plus, Radio, Fingerprint, Rotate3D, X } from "lucide-react";
import { date, identity, isGuest, type PassportData } from "@/lib/passport";
export function Mark() { return <a href="/home" className="wordmark"><span className="brand-icon"><Plus size={20} strokeWidth={2.5}/></span><span>medical passport</span></a>; }
export function Header({professional=false}:{professional?:boolean}) {return <header className="site-header"><Mark/><nav>{professional&&<a href="/home">My cards<ArrowUpRight size={14}/></a>}</nav></header>;}
export function DemoNote() {const [guest,setGuest]=useState(false);useEffect(()=>{isGuest().then(setGuest).catch(()=>{});},[]);return <details className="prototype-note"><summary>Prototype · fictional records</summary>{guest&&<p className="guest-storage-note">Guest cards stay in this browser. Clearing site data removes them; links do not transfer them to other devices.</p>}<p>Use fictional details only. Connections, shipping, text updates, and record assistance are simulated. No physical order or texts are sent.</p><p>Address data: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://photon.komoot.io/">Photon</a>.</p></details>;}
export function Action({children, onClick, secondary=false, disabled=false, type="button", className=""}:{children:ReactNode;onClick?:()=>void;secondary?:boolean;disabled?:boolean;type?:"button"|"submit";className?:string}) {return <button type={type} disabled={disabled} onClick={onClick} className={`button ${secondary?"secondary":"primary"} ${className}`}>{children}</button>;}
export function Back({onClick}:{onClick:()=>void}) {return <button type="button" className="back" onClick={onClick}><ArrowLeft size={16}/> Back</button>;}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) {return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function ErrorNote({message}:{message:string}) {return message?<p role="alert" className="error-note">{message}</p>:null;}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();return ()=>ref.current?.close();},[]);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><button className="icon-button close" aria-label="Close" onClick={onClose}><X size={20}/></button><h2>{title}</h2>{children}</dialog>;
}
export function CheckMark() {return <div className="completion-check"><svg viewBox="0 0 48 48" aria-label="Complete"><circle cx="24" cy="24" r="22"/><path d="m14 24 7 7 14-15"/></svg></div>;}
export function PassportCard({data, number="MP-PREVIEW",expires, interactive=false, celebrate=false}:{data:Pick<PassportData,"theme"|"photo">;number?:string;expires?:string;interactive?:boolean;celebrate?:boolean}) {
  const element=useRef<HTMLDivElement>(null);
  const physics=useRef({x:celebrate?-3:0,y:0,speed:celebrate?18:0});
  const drag=useRef<{x:number;y:number;rx:number;ry:number;time:number}|null>(null);
  const [spinning,setSpinning]=useState(celebrate);
  function render(){const p=physics.current;if(element.current)element.current.style.transform=`rotateX(${p.x}deg) rotateY(${p.y}deg)`;}
  function stop(){physics.current.speed=0;setSpinning(false);}
  useEffect(()=>{if(!interactive)return;const media=matchMedia("(prefers-reduced-motion: reduce)");if(media.matches){physics.current.speed=0;setSpinning(false);}let frame=0,last=performance.now();const start=last+(celebrate&&!media.matches?1700:0);const animate=(now:number)=>{const dt=Math.min(now-last,40)/1000;last=now;if(!drag.current){if(now>=start)physics.current.y+=physics.current.speed*dt;render();}frame=requestAnimationFrame(animate);};frame=requestAnimationFrame(animate);const reduce=()=>{if(media.matches)stop();};media.addEventListener("change",reduce);return()=>{cancelAnimationFrame(frame);media.removeEventListener("change",reduce);};},[interactive]);
  function release(){const d=drag.current;if(!d)return;const distance=physics.current.y-d.ry;const elapsed=Math.max(.15,(performance.now()-d.time)/1000);const speed=Math.abs(distance)>24?Math.max(-90,Math.min(90,distance/elapsed)):0;physics.current.speed=matchMedia("(prefers-reduced-motion: reduce)").matches?0:speed;setSpinning(physics.current.speed!==0);drag.current=null;}
  return <div className={`card-stage ${celebrate?"celebrate":""}`}>
    {celebrate&&<div className="completion-orbit" aria-hidden="true"><svg viewBox="0 0 320 320"><circle cx="160" cy="160" r="154"/><path d="m92 160 47 47 90-94"/></svg></div>}
    <div className="card-arrival"><div ref={element} className={`physical-card theme-${data.theme} ${interactive?"interactive":""}`}
      {...(interactive?{tabIndex:0,role:"button","aria-label":"Rotate passport card. Use arrow keys or drag.",onKeyDown:(e:React.KeyboardEvent)=>{if(["ArrowLeft","ArrowRight","Enter"," "].includes(e.key)){e.preventDefault();stop();physics.current.y+=e.key==="ArrowLeft"?-45:e.key==="ArrowRight"?45:180;render();}},onPointerDown:(e:React.PointerEvent<HTMLDivElement>)=>{if(e.button!==0)return;stop();drag.current={x:e.clientX,y:e.clientY,rx:physics.current.x,ry:physics.current.y,time:performance.now()};e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:(e:React.PointerEvent)=>{if(drag.current){physics.current.x=Math.max(-35,Math.min(35,drag.current.rx-(e.clientY-drag.current.y)*.35));physics.current.y=drag.current.ry+(e.clientX-drag.current.x)*.8;render();}},onPointerUp:release,onPointerCancel:()=>{drag.current=null;stop();}}:{})}>
      {["top","bottom","left","right"].map(edge=><div key={edge} aria-hidden="true" className={`card-edge edge-${edge}`}/>)}
      <div className="card-face card-front"><div className="card-top"><span><Plus size={19}/> medical passport</span><Radio size={23}/></div><div className="card-watermark"><Plus strokeWidth={.7}/></div><div className="card-bottom"><div><strong>{identity.name}</strong><span>{number}</span></div>{data.photo?<img className="card-photo" src={data.photo} alt="Card portrait"/>:<Fingerprint className="card-fingerprint" size={51} strokeWidth={1}/>}</div></div>
      <div className="card-face card-back"><div className="card-top"><span><Plus size={19}/> medical passport</span><Radio size={23}/></div><div className="back-instructions"><strong>A little card.<br/>A clearer picture.</strong><p>Tap with an NFC-enabled phone to view this passport.</p></div><div className="card-back-footer"><span>{number}<br/>VALID THROUGH {expires?date(expires).toUpperCase():"OCT 2029"}</span><small>DEMO · NOT A MEDICAL RECORD<br/>Confirm information with the patient.<br/>Not a substitute for clinical assessment.</small></div></div>
    </div>
    </div>
    {interactive&&<button className="sr-only" onClick={()=>{physics.current.speed=spinning?0:18;setSpinning(!spinning);}}>{spinning?"Pause card rotation":"Resume card rotation"}</button>}
  </div>;
}

