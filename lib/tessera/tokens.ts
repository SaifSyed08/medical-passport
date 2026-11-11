import { and, eq, gt, isNull } from "drizzle-orm";
import { tesseraTokens } from "@/db/schema";
import { nowIso, type TesseraDb } from "./db";

export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function randomId(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Returns the raw token once. Only its SHA-256 hash is stored. */
export async function issueToken(db: TesseraDb, travelerId: string, now = Date.now()) {
  const token = randomId(32);
  const expires = new Date(now + TOKEN_TTL_MS).toISOString();
  await db.insert(tesseraTokens).values({
    hash: await sha256Hex(token),
    travelerId,
    created: new Date(now).toISOString(),
    expires,
  });
  return { token, expires };
}

export function bearer(header: string | null): string | null {
  const m = header?.match(/^Bearer ([A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : null;
}

export async function authenticate(db: TesseraDb, token: string | null, now = Date.now()): Promise<string | null> {
  if (!token) return null;
  const row = await db
    .select({ travelerId: tesseraTokens.travelerId })
    .from(tesseraTokens)
    .where(
      and(
        eq(tesseraTokens.hash, await sha256Hex(token)),
        isNull(tesseraTokens.revoked),
        gt(tesseraTokens.expires, new Date(now).toISOString()),
      ),
    )
    .get();
  return row?.travelerId ?? null;
}

export async function revokeToken(db: TesseraDb, token: string) {
  await db.update(tesseraTokens).set({ revoked: nowIso() }).where(eq(tesseraTokens.hash, await sha256Hex(token)));
}
