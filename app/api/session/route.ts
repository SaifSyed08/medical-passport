import { getChatGPTUser } from "@/app/chatgpt-auth";
import { json } from "@/lib/server";
export async function GET(){return json({signedIn:!!(await getChatGPTUser())});}
