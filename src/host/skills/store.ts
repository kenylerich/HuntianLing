/**
 * JSON persistence for skill-creator drafts, validations, and enabled versions.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { InstalledSkillPackRecord, SkillId, SkillRecord, SkillValidation } from './types.js';

const SCHEMA_VERSION = 1;

export interface SkillsSnapshot {
  readonly schemaVersion: number;
  readonly versions: readonly SkillRecord[];
  readonly drafts: readonly SkillRecord[];
  readonly validations: readonly SkillValidation[];
  readonly creatorEnabled: Readonly<Record<string, readonly string[]>>;
  readonly installedPacks: Readonly<Record<string, readonly InstalledSkillPackRecord[]>>;
}

export function skillsStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'skills.json');
}

export function loadSkillsSnapshot(workspaceRoot: string): SkillsSnapshot {
  try {
    const raw = readFileSync(skillsStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as SkillsSnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported skills schema ${String(parsed.schemaVersion)}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      versions: parsed.versions ?? [],
      drafts: parsed.drafts ?? [],
      validations: parsed.validations ?? [],
      creatorEnabled: parsed.creatorEnabled ?? {},
      installedPacks: parsed.installedPacks ?? {},
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { schemaVersion: SCHEMA_VERSION, versions: [], drafts: [], validations: [], creatorEnabled: {}, installedPacks: {} };
    }
    throw error;
  }
}

export function saveSkillsSnapshot(workspaceRoot: string, snapshot: SkillsSnapshot): void {
  const path = skillsStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...snapshot, schemaVersion: SCHEMA_VERSION }, null, 2)}\n`);
}

export function creatorEnabledMap(
  snapshot: SkillsSnapshot,
): Map<string, Set<SkillId>> {
  const next = new Map<string, Set<SkillId>>();
  for (const [projectId, skillIds] of Object.entries(snapshot.creatorEnabled)) {
    next.set(projectId, new Set(skillIds as SkillId[]));
  }
  return next;
}
