/**
 * Worker-thread pg client. The parent thread waits on SharedArrayBuffer
 * so huntianling.database can keep a synchronous API.
 */

import { workerData } from 'node:worker_threads';
import pg from 'pg';

interface WorkerInit {
  readonly port: MessagePort;
  readonly connectionString: string;
  readonly sab: SharedArrayBuffer;
}

interface WorkerRequest {
  readonly op: 'query' | 'close';
  readonly sab: SharedArrayBuffer;
  readonly sql?: string;
  readonly params?: readonly unknown[];
}

const init = workerData as WorkerInit;
const lock = new Int32Array(init.sab);
const client = new pg.Client({
  connectionString: init.connectionString,
  connectionTimeoutMillis: 2_000,
});

try {
  await client.connect();
  init.port.postMessage({ ok: true });
} catch (error) {
  init.port.postMessage({
    ok: false,
    message: error instanceof Error ? error.message : String(error),
  });
} finally {
  Atomics.store(lock, 0, 1);
  Atomics.notify(lock, 0);
}

init.port.on('message', (request: WorkerRequest) => {
  void handle(request);
});

async function handle(request: WorkerRequest): Promise<void> {
  const requestLock = new Int32Array(request.sab);
  try {
    if (request.op === 'close') {
      await client.end();
      init.port.postMessage({ ok: true });
      return;
    }
    const result = await client.query(request.sql ?? '', [...(request.params ?? [])]);
    init.port.postMessage({
      ok: true,
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rowCount ?? 0,
    });
  } catch (error) {
    init.port.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    Atomics.store(requestLock, 0, 1);
    Atomics.notify(requestLock, 0);
  }
}
