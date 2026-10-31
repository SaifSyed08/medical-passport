import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import migration from "@/drizzle/0001_tessera.sql?raw";

export type TesseraDb = DrizzleD1Database<typeof schema>;

/**
 * The tessera_* tables are created at runtime from the Drizzle migration, made idempotent,
 * because it is unverified whether the Sites platform applies migrations on deploy.
 */
export const schemaStatements = migration
  .split("--> statement-breakpoint")
  .map(s => s.trim())
  .filter(Boolean)
  .map(s =>
    s
      .replace(/^CREATE TABLE `/, "CREATE TABLE IF NOT EXISTS `")
      .replace(/^CREATE (UNIQUE )?INDEX `/, (_, u = "") => `CREATE ${u}INDEX IF NOT EXISTS \``)
      .replace(/^CREATE TRIGGER `/, "CREATE TRIGGER IF NOT EXISTS `"),
  );

const ready = new WeakMap<D1Database, Promise<void>>();

export function ensureSchema(d1: D1Database): Promise<void> {
  let done = ready.get(d1);
  if (!done) {
    done = d1.batch(schemaStatements.map(s => d1.prepare(s))).then(() => undefined);
    done.catch(() => ready.delete(d1));
    ready.set(d1, done);
  }
  return done;
}

/** Demo reset only. The audit table is append-only, so it is dropped and recreated rather than deleted from. */
export async function dropTesseraTables(d1: D1Database) {
  await d1.batch(
    ["tessera_audit", "tessera_requests", "tessera_records", "tessera_cards", "tessera_travelers"].map(t =>
      d1.prepare(`DROP TABLE IF EXISTS \`${t}\``),
    ),
  );
  ready.delete(d1);
  await ensureSchema(d1);
}

export function tesseraDb(d1: D1Database): TesseraDb {
  return drizzle(d1, { schema });
}

export const nowIso = () => new Date().toISOString();
