import { dataSchema,identity,type Passport,type PassportData } from "./passport";
const key="medical-passport.guest.v1";
function read():Passport[]{try{return JSON.parse(localStorage.getItem(key)||"[]");}catch{throw new Error("Browser storage is unavailable. Allow site storage to save your demo card.");}}
function write(cards:Passport[]){try{localStorage.setItem(key,JSON.stringify(cards));}catch{throw new Error("This browser could not save the card. Try a smaller photo or allow site storage.");}}
function validate(input:PassportData){const photo=input.photo;if(photo&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo))throw new Error("Please add your photo again.");if(photo.length>500000)throw new Error("Please choose a smaller photo.");return {...dataSchema.parse({...input,photo:""}),photo};}
export function guestApi(path:string,method:string,input:unknown):unknown{
 const cards=read();const body=input as {id?:string;data?:PassportData;status?:string;dob?:string;name?:string;number?:string;mode?:string};
 if(path==="/api/cards"){
  if(method==="GET")return cards;
  if(method==="POST"){const data=validate(input as PassportData);const now=new Date(),expires=new Date(now),arrival=new Date(now);expires.setFullYear(expires.getFullYear()+3);arrival.setDate(arrival.getDate()+10);const card:Passport={id:crypto.randomUUID(),token:crypto.randomUUID(),number:"MP-"+crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase(),status:"active",created:now.toISOString(),expires:expires.toISOString(),arrival:arrival.toISOString(),data};write([card,...cards]);return card;}
  const card=cards.find(c=>c.id===body.id);if(!card)throw new Error("This card is not saved in this browser.");
  if(method==="DELETE"){write(cards.filter(c=>c.id!==body.id));return {deleted:true};}
  if(method==="PATCH"){const next={...card,...(body.data?{data:validate(body.data)}:{}),...(body.status==="active"||body.status==="disabled"?{status:body.status}:{})};write(cards.map(c=>c.id===card.id?next:c));return next;}
 }
 const active=cards.filter(c=>c.status==="active"&&new Date(c.expires)>new Date());
 if(path==="/api/lookup"){return active.filter(c=>body.mode==="number"?c.number===body.number?.trim().toUpperCase():body.name?.trim().toLowerCase()===identity.name.toLowerCase()&&body.dob===identity.dob).map(c=>({number:c.number,token:c.token,name:identity.name,dob:identity.dob,expires:c.expires}));}
 if(path.startsWith("/api/passport/")){if(body.dob!==identity.dob)throw new Error("That date does not match. Demo date: June 18, 1994.");const card=active.find(c=>c.token===path.split("/").pop());if(!card)throw new Error("This guest passport is unavailable. Open it in the browser where it was created.");const {profile,photo,theme,integrations}=card.data;return {...card,data:{profile,photo,theme,integrations}};}
 throw new Error("This action is unavailable in the guest demo.");
}
