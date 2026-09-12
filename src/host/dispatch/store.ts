/**
 * JSON persistence for leases and Agent feedback.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { AgentFeedback, ResourceLease } from './types.js';

const SCHEMA_VERSION = 1;

export interface DispatchSnapshot {
  readonly schemaVersion: number;
  readonly leases: ResourceLease[];
  readonly feedback: AgentFeedback[];
}

export function dispatchStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'dispatch.json');
}

export function loadDispatchSnapshot(workspaceRoot: string): DispatchSnapshot {
  try {
    const raw = readFileSync(dispatchStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as DispatchSnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported dispatch schema ${String(parsed.schemaVersion)}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      leases: parsed.leases ?? [],
      feedback: parsed.feedback ?? [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { schemaVersion: SCHEMA_VERSION, leases: [], feedback: [] };
    throw error;
  }
}

export function saveDispatchSnapshot(workspaceRoot: string, snapshot: DispatchSnapshot): void {
  const path = dispatchStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...snapshot, schemaVersion: SCHEMA_VERSION }, null, 2)}\n`);
}
