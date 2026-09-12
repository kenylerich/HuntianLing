/**
 * JSON persistence for Story delivery runs.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { StoryDeliveryRun } from './types.js';

const SCHEMA_VERSION = 1;

interface DeliverySnapshot {
  readonly schemaVersion: number;
  readonly runs: StoryDeliveryRun[];
}

export function deliveryStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'story-delivery.json');
}

export function loadDeliveryRuns(workspaceRoot: string): StoryDeliveryRun[] {
  try {
    const raw = readFileSync(deliveryStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as DeliverySnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported story delivery schema ${String(parsed.schemaVersion)}`);
    }
    return parsed.runs ?? [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw error;
  }
}

export function saveDeliveryRuns(workspaceRoot: string, runs: readonly StoryDeliveryRun[]): void {
  const path = deliveryStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  const snapshot: DeliverySnapshot = { schemaVersion: SCHEMA_VERSION, runs: [...runs] };
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}
