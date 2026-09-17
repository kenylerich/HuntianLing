/**
 * SQLite engine for huntianling.database using node:sqlite.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { resolveUnderRoot } from './files.js';
import {
  asSqlRow,
  type DatabaseExecuteResult,
  type SqlEngine,
  type SqlValue,
} from './types.js';

export { DATABASE_SCHEMA_VERSION } from './persistence.js';

export class SqliteEngine implements SqlEngine {
  private readonly db: DatabaseSync;
  private closed = false;

  constructor(workspaceRoot: string, sqlitePath: string) {
    const resolved = resolveSqlitePath(workspaceRoot, sqlitePath);
    if (resolved !== ':memory:') {
      mkdirSync(dirname(resolved), { recursive: true });
    }
    this.db = new DatabaseSync(resolved);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA busy_timeout = 5000');
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  run(sql: string, params: readonly SqlValue[] = []): DatabaseExecuteResult {
    const result = this.db.prepare(sql).run(...toSqlParams(params));
    return { changes: Number(result.changes) };
  }

  get(sql: string, params: readonly SqlValue[] = []): Record<string, SqlValue> | undefined {
    const row = this.db.prepare(sql).get(...toSqlParams(params));
    if (row === undefined) return undefined;
    return asSqlRow(row as Record<string, unknown>);
  }

  all(sql: string, params: readonly SqlValue[] = []): readonly Record<string, SqlValue>[] {
    const rows = this.db.prepare(sql).all(...toSqlParams(params));
    return rows.map((row) => asSqlRow(row as Record<string, unknown>));
  }

  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}

function resolveSqlitePath(workspaceRoot: string, sqlitePath: string): string {
  if (sqlitePath === ':memory:') return ':memory:';
  return resolveUnderRoot(workspaceRoot, sqlitePath, 'sqlite path');
}

function toSqlParams(params: readonly SqlValue[]): SQLInputValue[] {
  return [...params];
}
