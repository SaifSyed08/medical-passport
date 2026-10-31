// Minimal D1Database over node:sqlite so tests exercise the real SQL, schema and triggers.
// Covers only what drizzle-orm/d1 and lib/tessera use: prepare/bind/all/first/run/raw/batch.
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { ensureSchema, tesseraDb } from "@/lib/tessera/db";

class Stmt {
  constructor(private db: DatabaseSync, readonly sql: string, private params: SQLInputValue[] = []) {}
  bind(...params: unknown[]) {
    return new Stmt(this.db, this.sql, params.map(p => (typeof p === "boolean" ? Number(p) : p)) as SQLInputValue[]);
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params), success: true, meta: {} };
  }
  async first(col?: string) {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    return row ? (col ? row[col] : row) : null;
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async raw() {
    const s = this.db.prepare(this.sql);
    s.setReturnArrays(true);
    return s.all(...this.params);
  }
}

export function memoryD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  const d1 = {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(/^\s*(select|with)/i.test(s.sql) ? await s.all() : await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
  return d1 as unknown as D1Database;
}

export async function freshDb() {
  const d1 = memoryD1();
  await ensureSchema(d1);
  return { d1, db: tesseraDb(d1) };
}
