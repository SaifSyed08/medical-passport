import type { PassportData } from "./passport";
export type AddressSuggestion=PassportData["address"]&{place:string;complete:boolean};
export type AddressKind="address"|"region"|"postal"|"city";
export function photonParams(q:string,kind:AddressKind="address",country=""){
 const params=new URLSearchParams({q,limit:"7",lang:"en"});
 if(kind==="region")params.set("layer","state");
 if(kind==="city")params.set("layer","city");
 if(country)params.set("countrycode",country);
 if(!country||country==="US"){params.set("lat","30.505");params.set("lon","-97.82");params.set("zoom","9");}
 return params;
}
export function parseAddresses(result:{features?:{properties:Record<string,string>}[]}):AddressSuggestion[]{
 const seen=new Set<string>();
 return (result.features||[]).map(({properties:p})=>({
 street:[p.housenumber,p.street].filter(Boolean).join(" ")||p.name||"",city:p.city||p.town||p.village||p.locality||p.district||"",region:p.state||(p.type==="state"?p.name:"")||"",postal:p.postcode||"",country:p.country||"",unit:"",place:p.name!==p.street?p.name||"":"",complete:!!(p.housenumber&&p.street&&p.postcode&&(p.city||p.town||p.village)&&p.state),
 })).filter(p=>{const key=[p.street,p.city,p.region,p.postal,p.country].join("|");if(seen.has(key))return false;seen.add(key);return true;});
}
export async function searchAddresses(q:string,signal:AbortSignal,kind:AddressKind="address",country=""):Promise<AddressSuggestion[]>{
 const params=new URLSearchParams({q,kind,country});
 try{
  const r=await fetch("/api/address?"+params,{signal:AbortSignal.any([signal,AbortSignal.timeout(4000)]),cache:"no-store"});
  if(!r.ok)throw new Error("Address service unavailable");
  const body=await r.json() as {suggestions:AddressSuggestion[]};
  return body.suggestions;
 }catch(e){
  if(signal.aborted)throw e;
  // The public Photon service may reject hosting-provider IPs. Browser CORS is supported.
  const r=await fetch("https://photon.komoot.io/api/?"+photonParams(q,kind,country),{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),credentials:"omit",referrerPolicy:"no-referrer"});
  if(!r.ok)throw new Error("Address search is unavailable. You can still enter your details manually.");
  return parseAddresses(await r.json());
 }
}
const codes="AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");
const display=new Intl.DisplayNames(["en"],{type:"region"});
export const countries=codes.map(code=>({code,name:display.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name));
export function countryCode(name:string){return countries.find(c=>c.name.toLowerCase()===name.trim().toLowerCase()||c.code===name.trim().toUpperCase())?.code||"";}
export const regions:Record<string,string[]>={
 US:"Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming".split("|"),
 CA:"Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Northwest Territories|Nova Scotia|Nunavut|Ontario|Prince Edward Island|Quebec|Saskatchewan|Yukon".split("|"),
 AU:"Australian Capital Territory|New South Wales|Northern Territory|Queensland|South Australia|Tasmania|Victoria|Western Australia".split("|"),
 GB:["England","Northern Ireland","Scotland","Wales"],
};
export const usAbbreviations="AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
