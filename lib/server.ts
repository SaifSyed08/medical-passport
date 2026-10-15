import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { Passport, PassportData } from "./passport";
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export async function owner(request?: Request) {
  if (request && request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(request.url).host) throw new Error("Invalid request origin.");
  }
  const user = await getChatGPTUser(); if (!user) throw new Error("Please sign in to continue."); return user.userId;
}
export function unpack(row: {id:string; token:string; number:string; status:string; created:string; expires:string; arrival:string; data:string}): Passport {
  return { id: row.id, token: row.token, number: row.number, status: row.status, created: row.created, expires: row.expires, arrival: row.arrival, data: JSON.parse(row.data) as PassportData };
}
export function readable(row: Parameters<typeof unpack>[0]) {
  const card = unpack(row); const { profile, photo, theme, integrations } = card.data;
  return { ...card, data: { profile, photo, theme, integrations } };
}
