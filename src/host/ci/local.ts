import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { CiCommandResult, CiConfig } from './types.js';

export function resolveCiConfig(config: CiConfig = {}): Required<CiConfig> {
  const result = { localExecution: config.localExecution ?? 'disabled',
    timeoutMs: config.timeoutMs ?? 120_000, outputLimit: config.outputLimit ?? 1_000_000 };
  if (!['enabled', 'disabled'].includes(result.localExecution)) throw new Error('invalid CI localExecution');
  for (const value of [result.timeoutMs, result.outputLimit]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('CI limits must be positive integers');
  }
  return result;
}

/** Execute only declared package scripts in the operator-selected workspace. */
export function runLocalCheck(command: string, root: string, config: Required<CiConfig>): CiCommandResult {
  if (config.localExecution !== 'enabled') return { status: 'skipped', output: 'local CI execution disabled' };
  if (process.platform === 'win32') return { status: 'blocked', output: 'local CI requires a host runner on Windows' };
  const script = /^pnpm run ([a-zA-Z0-9:_-]+)$/.exec(command)?.[1];
  if (script === undefined) return { status: 'blocked', output: 'local CI accepts declared pnpm scripts only' };
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !/KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL/i.test(key)
      && !['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'NODE_V8_COVERAGE'].includes(key)));
  const completed = spawnSync(process.execPath, [fileURLToPath(new URL('./local-worker.js', import.meta.url)),
    root, script, String(config.timeoutMs), String(config.outputLimit)], {
    cwd: root, env, encoding: 'utf8', shell: false, maxBuffer: config.outputLimit * 6 + 4096,
  });
  if (completed.error || completed.status !== 0 || completed.signal) {
    return { status: 'blocked', output: completed.error?.message ?? completed.stderr ?? 'local check worker failed' };
  }
  const result: unknown = JSON.parse(completed.stdout);
  if (typeof result !== 'object' || result === null) throw new Error('invalid local check worker result');
  const row = result as Record<string, unknown>;
  if (!['pass', 'fail', 'blocked'].includes(String(row.status)) || typeof row.output !== 'string'
    || (row.exitCode !== null && typeof row.exitCode !== 'number')
    || (row.signal !== null && typeof row.signal !== 'string') || typeof row.timedOut !== 'boolean') {
    throw new Error('invalid local check worker result');
  }
  return { status: row.status as CiCommandResult['status'], output: row.output,
    exitCode: row.exitCode, signal: row.signal, timedOut: row.timedOut };
}
