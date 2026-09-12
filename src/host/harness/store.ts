/**
 * JSON persistence for harness comparisons and demonstrations.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { HarnessComparison, HarnessDemonstration, HarnessTrial } from './types.js';

const SCHEMA_VERSION = 1;

export interface HarnessSnapshot {
  readonly schemaVersion: number;
  readonly trials: HarnessTrial[];
  readonly comparisons: HarnessComparison[];
  readonly demonstrations: HarnessDemonstration[];
  readonly promoted: Record<string, number>;
}

export function harnessStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'harness.json');
}

export function loadHarnessSnapshot(workspaceRoot: string): HarnessSnapshot {
  try {
    const raw = readFileSync(harnessStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as HarnessSnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported harness schema ${String(parsed.schemaVersion)}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      trials: (parsed.trials ?? []).map((trial) => ({
        ...trial,
        modelBinding: trial.modelBinding ?? 'deterministic-executor',
        repeatIndex: trial.repeatIndex ?? 0,
      })),
      comparisons: parsed.comparisons ?? [],
      demonstrations: parsed.demonstrations ?? [],
      promoted: parsed.promoted ?? {},
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { schemaVersion: SCHEMA_VERSION, trials: [], comparisons: [], demonstrations: [], promoted: {} };
    }
    throw error;
  }
}

export function saveHarnessSnapshot(workspaceRoot: string, snapshot: HarnessSnapshot): void {
  const path = harnessStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}
