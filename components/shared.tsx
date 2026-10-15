"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Plus, Radio, Fingerprint, Rotate3D, X } from "lucide-react";
import { date, identity, type PassportData } from "@/lib/passport";
export function Mark() { return <a href="/home" className="wordmark"><span className="brand-icon"><Plus size={20} strokeWidth={2.5}/></span><span>medical passport</span></a>; }
export function Header({professional=false}:{professional?:boolean}) {return <header className="site-header"><Mark/><nav><a href={professional?"/home":"/professional"}>{professional?"My cards":"For professionals"}<ArrowUpRight size={14}/></a><span className="demo-tag">Demo</span></nav></header>;}
export function DemoNote() {return <p className="demo-note">An interactive demo. Use fictional details only. No live health connection or physical order.</p>;}
export function Action({children, onClick, secondary=false, disabled=false, type="button", className=""}:{children:ReactNode;onClick?:()=>void;secondary?:boolean;disabled?:boolean;type?:"button"|"submit";className?:string}) {return <button type={type} disabled={disabled} onClick={onClick} className={`button ${secondary?"secondary":"primary"} ${className}`}>{children}</button>;}
export function Back({onClick}:{onClick:()=>void}) {return <button className="back" onClick={onClick}><ArrowLeft size={16}/> Back</button>;}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) {return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function ErrorNote({message}:{message:string}) {return message?<p role="alert" className="error-note">{message}</p>:null;}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();return ()=>ref.current?.close();},[]);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><button className="icon-button close" aria-label="Close" onClick={onClose}><X size={20}/></button><h2>{title}</h2>{children}</dialog>;
}
export function CheckMark() {return <div className="completion-check"><svg viewBox="0 0 48 48" aria-label="Complete"><circle cx="24" cy="24" r="22"/><path d="m14 24 7 7 14-15"/></svg></div>;}
export function PassportCard({data, number="MP-PREVIEW",expires, interactive=false, celebrate=false}:{data:Pick<PassportData,"theme"|"photo">;number?:string;expires?:string;interactive?:boolean;celebrate?:boolean}) {
  const [rotation,setRotation]=useState({x:0,y:0}); const drag=useRef<{x:number;y:number;rx:number;ry:number}|null>(null); const [touched,setTouched]=useState(false);
  return <div className={`card-stage ${celebrate?"celebrate":""}`}>
    {celebrate&&<div className="card-orbit"/>}
    <div className={`physical-card theme-${data.theme} ${celebrate&&!touched?"card-reveal":""} ${interactive?"interactive":""}`} style={{transform:`rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`}}
      {...(interactive?{tabIndex:0, role:"button", "aria-label":"Rotate passport card. Use arrow keys or drag.",onKeyDown:(e:React.KeyboardEvent)=>{if(["ArrowLeft","ArrowRight","Enter"," "].includes(e.key)){e.preventDefault();setTouched(true);setRotation(r=>({...r,y:r.y+(e.key==="ArrowLeft"?-45:e.key==="ArrowRight"?45:180)}));}},onPointerDown:(e:React.PointerEvent<HTMLDivElement>)=>{setTouched(true);drag.current={x:e.clientX,y:e.clientY,rx:rotation.x,ry:rotation.y};e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:(e:React.PointerEvent)=>{if(drag.current)setRotation({x:Math.max(-35,Math.min(35,drag.current.rx-(e.clientY-drag.current.y)*.35)),y:drag.current.ry+(e.clientX-drag.current.x)*.8});},onPointerUp:()=>{drag.current=null;},onPointerCancel:()=>{drag.current=null;}}:{})}>
      <div className="card-face card-front"><div className="card-top"><span><Plus size={19}/> medical passport</span><Radio size={23}/></div><div className="card-watermark"><Plus strokeWidth={.7}/></div><div className="card-bottom"><div><small>YOUR HEALTH. WITH YOU.</small><strong>{identity.name}</strong><span>{number}</span></div>{data.photo?<img className="card-photo" src={data.photo} alt="Card portrait"/>:<Fingerprint className="card-fingerprint" size={51} strokeWidth={1}/>}</div></div>
      <div className="card-face card-back"><div className="card-top"><span><Plus size={19}/> medical passport</span><Radio size={23}/></div><div className="back-instructions"><strong>A little card.<br/>A clearer picture.</strong><p>Tap with an NFC-enabled phone to view this passport.</p></div><div className="card-back-footer"><span>{number}<br/>VALID THROUGH {expires?date(expires).toUpperCase():"OCT 2029"}</span><small>DEMO · NOT A MEDICAL RECORD<br/>Confirm information with the patient.<br/>Not a substitute for clinical assessment.</small></div></div>
    </div>
    {interactive&&<button className="rotate-hint" onClick={()=>{setTouched(true);setRotation(r=>({x:0,y:r.y+180}));}}><Rotate3D size={16}/> Drag to explore · tap to flip</button>}
  </div>;
}
