/**
 * JSON persistence for tracker bindings, external references, and conflicts.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { ExternalIssueRef, IssueTrackerBinding, SyncConflict } from './types.js';

const SCHEMA_VERSION = 1;

export interface IssueSyncSnapshot {
  readonly schemaVersion: number;
  readonly trackers: readonly IssueTrackerBinding[];
  readonly references: readonly ExternalIssueRef[];
  readonly conflicts: readonly SyncConflict[];
}

export function issueSyncStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'issue-sync.json');
}

export function emptyIssueSyncSnapshot(): IssueSyncSnapshot {
  return { schemaVersion: SCHEMA_VERSION, trackers: [], references: [], conflicts: [] };
}

export function loadIssueSyncSnapshot(workspaceRoot: string): IssueSyncSnapshot {
  try {
    const raw = readFileSync(issueSyncStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as IssueSyncSnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported issue-sync schema ${String(parsed.schemaVersion)}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      trackers: parsed.trackers ?? [],
      references: parsed.references ?? [],
      conflicts: parsed.conflicts ?? [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return emptyIssueSyncSnapshot();
    throw error;
  }
}

export function saveIssueSyncSnapshot(workspaceRoot: string, snapshot: IssueSyncSnapshot): void {
  assertSnapshotHasNoSecrets(snapshot);
  const path = issueSyncStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...snapshot, schemaVersion: SCHEMA_VERSION }, null, 2)}\n`);
}

function assertSnapshotHasNoSecrets(snapshot: IssueSyncSnapshot): void {
  const json = JSON.stringify(snapshot);
  if (/"token"\s*:/.test(json) || /"accessToken"\s*:/.test(json) || /"secret"\s*:/.test(json)) {
    throw new Error('issue-sync snapshot must not persist tokens');
  }
}
