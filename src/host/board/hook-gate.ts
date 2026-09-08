/**
 * Hook gate (#46): run one executable as a transition gate.
 *
 * The script receives the transition context as JSON on stdin and speaks
 * through its exit code: 0 passes, anything else blocks. The last stderr
 * line becomes the recorded reason. Any language works; the plugin never
 * interprets the script beyond spawn/exit-code. A spawn failure or
 * timeout counts as a failure and never silently passes.
 */

import { spawnSync } from 'node:child_process';

import type { TransitionGate } from './gates.js';
import type { Card, WorkItemStatus } from './types.js';

export interface HookGateOptions {
  readonly id: string;
  /** Executable path or argv string; resolved through the shell like a Git hook. */
  readonly command: string;
  readonly from?: WorkItemStatus;
  readonly to?: WorkItemStatus;
  readonly timeoutMs?: number;
  readonly cwd?: string;
  readonly env?: Record<string, string>;
}

export const DEFAULT_HOOK_TIMEOUT_MS = 30_000;

export function createHookGate(options: HookGateOptions): TransitionGate {
  const timeoutMs = options.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS;
  return {
    id: options.id,
    ...(options.from !== undefined ? { from: options.from } : {}),
    ...(options.to !== undefined ? { to: options.to } : {}),
    run(card: Card, from: WorkItemStatus, to: WorkItemStatus): { ok: boolean; reason?: string } {
      const payload = JSON.stringify({ card, from, to, gateId: options.id });
      const outcome = spawnSync(options.command, {
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        env: options.env === undefined ? process.env : { ...process.env, ...options.env },
        input: payload,
        timeout: timeoutMs,
        shell: process.platform === 'win32',
        encoding: 'utf8',
      });
      if (outcome.error?.message.includes('ETIMEDOUT') ?? outcome.signal === 'SIGTERM') {
        return { ok: false, reason: `hook timed out after ${String(timeoutMs)}ms` };
      }
      if (outcome.error !== undefined) {
        return { ok: false, reason: `hook failed to run: ${outcome.error.message}` };
      }
      if (outcome.status === 0) return { ok: true };
      const detail = (outcome.stderr ?? '').trim().split('\n').at(-1) ?? '';
      return {
        ok: false,
        reason: detail.length > 0 ? detail : `hook exited ${String(outcome.status)}`,
      };
    },
  };
}
