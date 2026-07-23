/**
 * Minimal interface that both the sql.js shim and the Postgres adapter satisfy.
 * All repositories and services depend only on this interface, not on the
 * concrete driver implementations.
 */
export interface DbDriver {
  pragma(str: string): void;
  exec(sql: string): void;
  prepare(sql: string): DbStatement;
  close(): void;
}

export interface DbStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
