import { requireChatGPTUser } from "../chatgpt-auth";
import { Dashboard } from "@/components/dashboard";
export const dynamic = "force-dynamic";
export default async function Page() { await requireChatGPTUser("/home"); return <Dashboard />; }
