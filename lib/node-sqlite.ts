// Kysely driver over Node's built-in `node:sqlite` (zero native dependencies).
//
// Kysely ships battle-tested SQLite dialect code targeting better-sqlite3's
// statement API. This module wraps `node:sqlite`'s DatabaseSync in that same
// shape (`prepare().reader/all/run/get/iterate/close`) so the stock
// `SqliteDialect` works unchanged — locally and in any Node ≥ 22 environment.

import { DatabaseSync } from "node:sqlite";
import { SqliteDialect } from "kysely";

class StatementShim {
  reader: boolean;
  #stmt: ReturnType<DatabaseSync["prepare"]>;

  constructor(stmt: ReturnType<DatabaseSync["prepare"]>, sql: string) {
    this.#stmt = stmt;
    // better-sqlite3 exposes `.reader` (true when the statement returns rows).
    // node:sqlite does not — derive it from the SQL verb. (The portal's query
    // surface is SELECT/INSERT/UPDATE/DELETE/DDL via Kysely; no RETURNING.)
    this.reader = /^\s*(select|with|pragma|explain|values)/i.test(sql);
  }

  // Kysely's SqliteDriver passes the bind-parameter array as a single argument
  // (better-sqlite3 also accepts that shape) — normalize to a flat list.
  #bind(params: unknown[]): unknown[] {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params;
  }

  all(...params: unknown[]) {
    const rows = this.#stmt.all(...(this.#bind(params) as never[])) as Record<string, unknown>[];
    // node:sqlite returns null-prototype rows; copy into plain objects.
    return rows.map((r) => ({ ...r }));
  }

  get(...params: unknown[]) {
    const row = this.#stmt.get(...(this.#bind(params) as never[])) as
      | Record<string, unknown>
      | undefined;
    return row ? { ...row } : undefined;
  }

  run(...params: unknown[]) {
    const result = this.#stmt.run(...(this.#bind(params) as never[]));
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  iterate(...params: unknown[]): IterableIterator<unknown> {
    // Only used by Kysely's streaming API, which the portal doesn't use.
    return this.all(...params)[Symbol.iterator]();
  }
}

class DatabaseShim {
  #db: DatabaseSync;

  constructor(filename: string) {
    this.#db = new DatabaseSync(filename);
    this.#db.exec("PRAGMA journal_mode = WAL");
    this.#db.exec("PRAGMA foreign_keys = ON");
  }

  prepare(sql: string) {
    return new StatementShim(this.#db.prepare(sql), sql);
  }

  exec(sql: string) {
    this.#db.exec(sql);
  }

  close() {
    this.#db.close();
  }
}

export function createSqliteDialect(filename: string): SqliteDialect {
  return new SqliteDialect({
    // Kysely types this as better-sqlite3's Database; the shim satisfies the
    // runtime contract (prepare/.reader/.all/.run/.get/.iterate/close).
    database: new DatabaseShim(filename) as never,
  });
}
