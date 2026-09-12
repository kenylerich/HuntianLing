/**
 * Live-model harness transport. Tokens stay on the call.
 */

import { spawnSync } from 'node:child_process';

import {
  HarnessError,
  type HarnessLlmRequest,
  type HarnessLlmResponse,
  type HarnessLlmTransport,
} from './types.js';

const DEFAULT_FETCH_SCRIPT = `
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const req = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const init = { method: req.method, headers: req.headers };
if (req.body) init.body = req.body;
const response = await fetch(req.url, init);
const body = await response.text();
process.stdout.write(JSON.stringify({ status: response.status, body }));
`;

export function defaultHarnessLlmTransport(request: HarnessLlmRequest): HarnessLlmResponse {
  const payload = JSON.stringify({
    method: request.method,
    url: request.url,
    headers: request.headers,
    body: request.body,
  });
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', DEFAULT_FETCH_SCRIPT],
    {
      encoding: 'utf8',
      input: payload,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
    },
  );
  if (result.error) throw new HarnessError('NOT_READY', result.error.message);
  if (result.status !== 0) {
    const line = result.stderr.trim().split('\n').filter(Boolean).at(-1);
    throw new HarnessError('NOT_READY', line ?? 'live-model request failed');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new HarnessError('VALIDATION', 'live-model transport returned invalid JSON');
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || typeof (parsed as { status?: unknown }).status !== 'number'
    || typeof (parsed as { body?: unknown }).body !== 'string'
  ) {
    throw new HarnessError('VALIDATION', 'live-model transport returned an invalid response');
  }
  return { status: (parsed as { status: number }).status, body: (parsed as { body: string }).body };
}

export { type HarnessLlmTransport };
