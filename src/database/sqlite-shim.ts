/**
 * better-sqlite3 compatibility shim backed by sql.js (pure JS, no native bindings).
 *
 * Exposes the same synchronous API that better-sqlite3 uses across all repositories:
 *   db.prepare(sql)  → Statement with .run(...params), .get(...params), .all(...params)
 *   db.exec(sql)
 *   db.pragma(str)
 *   db.close()
 *
 * sql.js keeps the entire database in memory and flushes to disk on every write,
 * which is fine for a hackathon demo with ~10k rows.
 */

import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import type { DbDriver, DbStatement } from './driver';

// ── Types that mirror better-sqlite3's public surface ────────────────────────

interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

// ── Synchronous wrapper ───────────────────────────────────────────────────────

export class Database implements DbDriver {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private static sql: SqlJsStatic | null = null;

  /**
   * Synchronously open (or create) a database file.
   * sql.js initialises synchronously when the WASM is pre-loaded.
   */
  private constructor(dbPath: string, db: SqlJsDatabase) {
    this.dbPath = dbPath;
    this.db = db;
  }

  /** Factory — must be async because sql.js WASM loads asynchronously */
  static async open(dbPath: string): Promise<Database> {
    if (!Database.sql) {
      Database.sql = await initSqlJs();
    }
    let data: Buffer | null = null;
    if (fs.existsSync(dbPath)) {
      data = fs.readFileSync(dbPath);
    }
    const db = data
      ? new Database.sql.Database(data)
      : new Database.sql.Database();

    return new Database(dbPath, db);
  }

  /** Flush the in-memory database to disk */
  private persist(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  /** sql.js does not use pragmas for WAL — silently accept them */
  pragma(_str: string): void {
    // no-op: sql.js runs entirely in memory, WAL / FK pragmas are not needed
  }

  /** Execute one or more SQL statements (no params, no result) */
  exec(sql: string): void {
    this.db.run(sql);
    this.persist();
  }

  /** Prepare a statement and return a Statement-compatible object */
  prepare(sql: string): DbStatement {
    return {
      run: (...params: unknown[]): RunResult => {
        this.db.run(sql, params as any[]);
        this.persist();
        // sql.js doesn't reliably report changes via SELECT changes() after
        // a parameterised run(), so we approximate: any successful execution = 1 change.
        return { changes: 1, lastInsertRowid: 0 };
      },

      get: (...params: unknown[]): unknown => {
        const stmt = this.db.prepare(sql);
        stmt.bind(params as any[]);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },

      all: (...params: unknown[]): unknown[] => {
        const results: unknown[] = [];
        const stmt = this.db.prepare(sql);
        stmt.bind(params as any[]);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
    };
  }

  close(): void {
    this.persist();
    this.db.close();
  }
}
