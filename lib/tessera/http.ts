import { env } from "cloudflare:workers";
import type { ZodType } from "zod";
import { ensureSchema, tesseraDb, type TesseraDb } from "./db";
import { flags } from "./flags";
import { seedIfMissing } from "./seed";
import { authenticate, bearer } from "./tokens";
import { getTraveler, type Traveler } from "./traveler";

// /api/v1 uses bearer tokens only (no cookies), so any origin may call it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "600",
};
const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export const v1json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { ...NO_STORE, ...CORS } });
export const v1error = (status: number, error: string, code?: string) => v1json(code ? { error, code } : { error }, status);
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
export const v1flags = () => flags(env as Parameters<typeof flags>[0]);

let seeded: Promise<unknown> | undefined;

export async function tessera(): Promise<{ d1: D1Database; db: TesseraDb }> {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  await ensureSchema(env.DB);
  const db = tesseraDb(env.DB);
  seeded ??= seedIfMissing(db).catch(e => {
    seeded = undefined;
    throw e;
  });
  await seeded;
  return { d1: env.DB, db };
}
export const resetSeedFlag = () => (seeded = undefined);

/** Public origin used to build card URLs. Prefer an explicit setting; fall back to the request. */
export function publicOrigin(request: Request) {
  const configured = (env as { TESSERA_PUBLIC_URL?: string }).TESSERA_PUBLIC_URL;
  return configured || new URL(request.url).origin;
}

export type Ctx = { request: Request; db: TesseraDb; d1: D1Database; traveler: Traveler; token: string };

/** Wraps a traveler-authenticated handler. Unauthenticated callers get one generic 401. */
export function withTraveler<P = unknown>(handler: (ctx: Ctx, params: P) => Promise<Response>) {
  return async (request: Request, context?: { params: Promise<P> }) => {
    try {
      const { db, d1 } = await tessera();
      const token = bearer(request.headers.get("authorization"));
      const id = await authenticate(db, token);
      const traveler = id ? await getTraveler(db, id) : null;
      if (!traveler || !token) return v1error(401, "Please sign in again.", "unauthorized");
      return await handler({ request, db, d1, traveler, token }, (await context?.params) as P);
    } catch (e) {
      console.error("tessera v1 error", e instanceof Error ? e.message : e);
      return v1error(500, "Something went wrong. Please try again.", "server_error");
    }
  };
}

export async function body<T>(request: Request, schema: ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, res: v1error(400, "Expected a JSON body.", "bad_request") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, res: v1error(400, issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request.", "invalid") };
  }
  return { ok: true, data: parsed.data };
}
