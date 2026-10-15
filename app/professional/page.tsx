import { requireChatGPTUser } from "../chatgpt-auth";
import { Professional } from "@/components/professional";
export const dynamic = "force-dynamic";
export default async function Page() { await requireChatGPTUser("/professional"); return <Professional />; }
