/**
 * Gate manifest (#48): declarative hook gates loaded from the workspace.
 *
 * `<root>/.huntianling/gates.json` is a JSON array; YAML layering can be
 * added later without changing the store contract. Unknown status names
 * and malformed entries fail loud at load time — misconfiguration never
 * silently disables a gate.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createHookGate } from './hook-gate.js';
import type { TransitionGate } from './gates.js';
import type { WorkItemStatus } from './types.js';

const STATUSES: ReadonlySet<string> = new Set([
  'inbox',
  'triaged',
  'planned',
  'in_progress',
  'verifying',
  'gates_passing',
  'delivered',
  'rejected',
  'stopped',
]);

export function gateManifestPath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'gates.json');
}

export function loadGateManifest(workspaceRoot: string): TransitionGate[] {
  let raw: string;
  try {
    raw = readFileSync(gateManifestPath(workspaceRoot), 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw error;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('gates.json must be an array of gate entries');
  }
  return parsed.map((entry, index) => parseGateEntry(entry, index));
}

function parseGateEntry(entry: unknown, index: number): TransitionGate {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`gates.json[${index}] must be an object`);
  }
  const record = entry as Record<string, unknown>;
  const id = record['id'];
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`gates.json[${index}] is missing a non-empty "id"`);
  }
  const command = record['command'];
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new Error(`gates.json[${index}] (${id}) is missing a "command"`);
  }
  const fromStatus = parseStatus(record['from'], id, 'from');
  const toStatus = parseStatus(record['to'], id, 'to');
  return createHookGate({
    id,
    command,
    ...(fromStatus !== undefined ? { from: fromStatus } : {}),
    ...(toStatus !== undefined ? { to: toStatus } : {}),
    ...(typeof record['timeoutMs'] === 'number' ? { timeoutMs: record['timeoutMs'] } : {}),
    ...(typeof record['cwd'] === 'string' ? { cwd: record['cwd'] } : {}),
  });
}

function parseStatus(
  value: unknown,
  gateId: string,
  field: 'from' | 'to',
): WorkItemStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !STATUSES.has(value)) {
    throw new Error(`gate "${gateId}" has an unknown ${field} status: ${String(value)}`);
  }
  return value as WorkItemStatus;
}
