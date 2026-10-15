import { requireChatGPTUser } from "../../chatgpt-auth";
import { Reader } from "@/components/reader";
export const dynamic = "force-dynamic";
export default async function Page({params}:{params:Promise<{token:string}>}) { const {token}=await params; await requireChatGPTUser(`/card/${token}`); return <Reader token={token} />; }
