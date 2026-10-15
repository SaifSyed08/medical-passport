import { getChatGPTUser } from "./chatgpt-auth";
import { Onboarding } from "@/components/onboarding";
export const dynamic = "force-dynamic";
export default async function Page() { return <Onboarding signedIn={!!(await getChatGPTUser())} />; }
