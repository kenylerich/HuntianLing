/**
 * PostgreSQL engine for huntianling.database.
 *
 * SQL uses `?` placeholders at the persistence layer; this engine rewrites
 * them to `$1` style for pg. The pg client runs on a worker thread so the
 * DatabaseService API stays synchronous.
 */

import { MessageChannel, receiveMessageOnPort, Worker, type MessagePort } from 'node:worker_threads';

import {
  asSqlRow,
  DatabaseError,
  type DatabaseExecuteResult,
  type PostgresClient,
  type PostgresQueryResult,
  type SqlEngine,
  type SqlValue,
} from './types.js';

const CONNECT_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 30_000;

export function toPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export class PostgresEngine implements SqlEngine {
  private readonly client: PostgresClient;
  private closed = false;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  exec(sql: string): void {
    const statements = splitSqlStatements(sql);
    for (const statement of statements) {
      this.client.query(toPostgresPlaceholders(statement));
    }
  }

  run(sql: string, params: readonly SqlValue[] = []): DatabaseExecuteResult {
    const result = this.client.query(toPostgresPlaceholders(sql), toPgParams(params));
    return { changes: result.rowCount };
  }

  get(sql: string, params: readonly SqlValue[] = []): Record<string, SqlValue> | undefined {
    const result = this.client.query(toPostgresPlaceholders(sql), toPgParams(params));
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return asSqlRow(row);
  }

  all(sql: string, params: readonly SqlValue[] = []): readonly Record<string, SqlValue>[] {
    const result = this.client.query(toPostgresPlaceholders(sql), toPgParams(params));
    return result.rows.map((row) => asSqlRow(row));
  }

  transaction<T>(work: () => T): T {
    this.exec('BEGIN');
    try {
      const result = work();
      this.exec('COMMIT');
      return result;
    } catch (error) {
      this.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.client.end();
  }
}

export function createWorkerPostgresClient(connectionString: string): PostgresClient {
  return new WorkerPostgresClient(connectionString);
}

class WorkerPostgresClient implements PostgresClient {
  private readonly worker: Worker;
  private readonly port: MessagePort;
  private closed = false;

  constructor(connectionString: string) {
    const channel = new MessageChannel();
    const sab = new SharedArrayBuffer(4);
    const lock = new Int32Array(sab);
    this.port = channel.port1;
    this.worker = new Worker(new URL('./postgres-worker.js', import.meta.url), {
      workerData: {
        port: channel.port2,
        connectionString,
        sab,
      },
      transferList: [channel.port2],
    });
    this.worker.on('error', () => undefined);
    const wait = Atomics.wait(lock, 0, 0, CONNECT_TIMEOUT_MS);
    if (wait === 'timed-out') {
      void this.worker.terminate();
      throw new DatabaseError('CONNECTION', 'database postgresql connection failed');
    }
    const ready = receiveMessageOnPort(this.port);
    if (ready?.message?.ok !== true) {
      void this.worker.terminate();
      throw new DatabaseError('CONNECTION', 'database postgresql connection failed');
    }
  }

  query(sql: string, params: readonly unknown[] = []): PostgresQueryResult {
    const message = this.call('query', { sql, params });
    if (message.ok !== true) {
      throw new DatabaseError('VALIDATION', String(message.message ?? 'database postgresql query failed'));
    }
    const rows = Array.isArray(message.rows) ? message.rows : [];
    return {
      rows,
      rowCount: Number(message.rowCount ?? 0),
    };
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.call('close', {});
    } finally {
      void this.worker.terminate();
      this.port.close();
    }
  }

  private call(op: 'query' | 'close', payload: { sql?: string; params?: readonly unknown[] }): WorkerResponse {
    const sab = new SharedArrayBuffer(4);
    const lock = new Int32Array(sab);
    this.port.postMessage({
      op,
      sab,
      ...(payload.sql !== undefined ? { sql: payload.sql } : {}),
      ...(payload.params !== undefined ? { params: payload.params } : {}),
    });
    const wait = Atomics.wait(lock, 0, 0, QUERY_TIMEOUT_MS);
    if (wait === 'timed-out') {
      throw new DatabaseError('CONNECTION', 'database postgresql query timed out');
    }
    const received = receiveMessageOnPort(this.port);
    if (received === undefined) {
      throw new DatabaseError('CONNECTION', 'database postgresql connection failed');
    }
    return received.message as WorkerResponse;
  }
}

interface WorkerResponse {
  readonly ok?: boolean;
  readonly message?: string;
  readonly rows?: readonly Record<string, unknown>[];
  readonly rowCount?: number;
}

function toPgParams(params: readonly SqlValue[]): unknown[] {
  return [...params];
}

function splitSqlStatements(sql: string): readonly string[] {
  return sql
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
