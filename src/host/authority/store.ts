/**
 * JSON persistence for authority approvals.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { ApprovalRecord } from './types.js';

const SCHEMA_VERSION = 1;

interface AuthoritySnapshot {
  readonly schemaVersion: number;
  readonly approvals: ApprovalRecord[];
}

export function authorityStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'authority.json');
}

export function loadApprovals(workspaceRoot: string): ApprovalRecord[] {
  try {
    const raw = readFileSync(authorityStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as AuthoritySnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported authority schema ${String(parsed.schemaVersion)}`);
    }
    return parsed.approvals ?? [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw error;
  }
}

export function saveApprovals(workspaceRoot: string, approvals: readonly ApprovalRecord[]): void {
  const path = authorityStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  const snapshot: AuthoritySnapshot = { schemaVersion: SCHEMA_VERSION, approvals: [...approvals] };
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}
