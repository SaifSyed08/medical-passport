import { Reader } from "@/components/reader";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <Reader token={token}/>;}
