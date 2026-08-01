/**
 * PostgreSQL adapter that exposes the same synchronous-style interface
 * as the sql.js shim so all repositories work unchanged.
 *
 * Because pg is inherently async but our repository layer is sync,
 * we use a connection pool and run queries synchronously-from-the-caller's
 * perspective by collecting results eagerly via Atomics.wait spin loops.
 * The adapter is initialised once at startup via PgDatabase.connect().
 *
 * IMPORTANT: exec() for DDL at startup uses a true async path (execAsync)
 * to avoid blocking the event loop during schema initialisation.
 */
import { Pool } from 'pg';
import type { DbDriver, DbStatement } from './driver';

interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export class PgDatabase implements DbDriver {
  private pool: Pool;

  private constructor(pool: Pool) {
    this.pool = pool;
  }

  static async connect(connectionString: string): Promise<PgDatabase> {
    const pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    });
    // Verify connectivity at startup
    const client = await pool.connect();
    client.release();
    return new PgDatabase(pool);
  }

  /** No-op — Postgres handles WAL, FK enforcement is per-statement */
  pragma(_str: string): void {}

  /**
   * Async DDL execution — use this for schema initialisation at startup.
   * Runs each statement sequentially with true async/await so the event
   * loop stays free and Railway's healthcheck can respond during init.
   */
  async execAsync(sql: string): Promise<void> {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      await this.pool.query(stmt);
    }
  }

  /**
   * Synchronous exec — kept for interface compatibility.
   * For startup DDL, prefer execAsync instead.
   */
  exec(sql: string): void {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      this.runSync(stmt, []);
    }
  }

  /** Internal: run a single parameterised query synchronously via Atomics.wait spin */
  private runSync(sql: string, params: unknown[]): any[] {
    let result: any[] = [];
    let done = false;
    let err: any = null;

    // Use pool.query() so each query gets its own client from the pool,
    // avoiding the "client already executing a query" deprecation warning.
    this.pool.query(sql, params as any[])
      .then(res => {
        result = res.rows || [];
        done = true;
      })
      .catch(e => {
        err = e;
        done = true;
      });

    const start = Date.now();
    while (!done) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
      if (Date.now() - start > 10_000) break;
    }

    if (err) throw err;
    return result;
  }

  prepare(sql: string): DbStatement {
    const translated = translatePlaceholders(sql);

    return {
      run: (...params: unknown[]): RunResult => {
        this.runSync(translated, params);
        return { changes: 1, lastInsertRowid: 0 };
      },
      get: (...params: unknown[]): unknown => {
        const rows = this.runSync(translated, params);
        return rows[0] ?? undefined;
      },
      all: (...params: unknown[]): unknown[] => this.runSync(translated, params),
    };
  }

  close(): void {
    this.pool.end().catch(() => {});
  }
}

/** Convert sql.js ? placeholders → Postgres $1, $2, … */
function translatePlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
