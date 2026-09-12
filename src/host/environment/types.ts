/**
 * Versioned project environment profile and prepare results.
 */

import type { SkillGap, SkillId } from '../skills/types.js';
import type { ToolId } from '../tools/types.js';

export type CheckResult = 'pass' | 'fail' | 'blocked' | 'skipped';
export type EnvironmentBlockerKind = 'dependency' | 'tool' | 'skill' | 'permission' | 'credential' | 'uncommitted';
export type EnvironmentFleetKind = 'local' | 'remote';

export interface EnvironmentCommandSpec {
  readonly id: string;
  readonly toolId: ToolId;
  readonly command: string;
  readonly required: boolean;
  readonly probeMeansBlocked?: boolean;
}

export interface EnvironmentProfile {
  readonly id: string;
  readonly version: string;
  readonly runtime: {
    readonly node: string;
    readonly packageManager: 'pnpm';
  };
  readonly commands: readonly EnvironmentCommandSpec[];
  readonly requiredSkillIds: readonly SkillId[];
  readonly requiredToolIds: readonly ToolId[];
  readonly allowedCapabilities: readonly string[];
}

export interface EnvironmentBlocker {
  readonly kind: EnvironmentBlockerKind;
  readonly message: string;
  readonly action: string;
}

export interface EnvironmentPrepareInput {
  readonly workspaceRoot: string;
  readonly profile?: EnvironmentProfile;
  readonly overrides?: { readonly profileVersion?: string };
  readonly host?: { readonly node: string; readonly packageManager: string };
  readonly runner?: (command: string) => { readonly status: CheckResult; readonly output: string };
  readonly env?: NodeJS.ProcessEnv;
  readonly projectId?: string;
  readonly kind?: EnvironmentFleetKind;
}

export interface EnvironmentFleetSlot {
  readonly id: string;
  readonly kind: EnvironmentFleetKind;
  readonly workspaceRoot: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly ready: boolean;
  readonly createdAt: number;
}

export interface UncommittedWorkReport {
  readonly paths: readonly string[];
  readonly preserved: readonly string[];
  readonly atRisk: readonly string[];
}

export interface EnvironmentReplaceInput {
  readonly sourceRoot: string;
  readonly targetRoot: string;
  readonly kind?: EnvironmentFleetKind;
  readonly preserveUncommitted?: boolean;
  readonly acceptUncommittedLoss?: boolean;
  readonly profile?: EnvironmentProfile;
  readonly overrides?: { readonly profileVersion?: string };
  readonly host?: { readonly node: string; readonly packageManager: string };
  readonly runner?: (command: string) => { readonly status: CheckResult; readonly output: string };
  readonly env?: NodeJS.ProcessEnv;
  readonly projectId?: string;
  readonly listUncommitted?: (root: string) => readonly string[];
}

export interface EnvironmentReplaceResult {
  readonly slot: EnvironmentFleetSlot;
  readonly prepare: EnvironmentPrepareResult;
  readonly uncommitted: UncommittedWorkReport;
}

export interface EnvironmentPrepareResult {
  readonly profileId: string;
  readonly profileVersion: string;
  readonly overrides: readonly string[];
  readonly workspaceId: string;
  readonly ready: boolean;
  readonly durationMs: number;
  readonly inventory: {
    readonly node: string;
    readonly packageManager: string;
    readonly packageJson: boolean;
  };
  readonly reused: readonly string[];
  readonly prepared: readonly string[];
  readonly blockers: readonly EnvironmentBlocker[];
  readonly manualSteps: readonly string[];
  readonly baseline: Readonly<Record<string, CheckResult>>;
  readonly skillGaps: readonly SkillGap[];
  readonly credentialPresence: readonly string[];
}

export interface ProjectSkillScan {
  readonly language: string | null;
  readonly framework: string | null;
  readonly packageManager: string | null;
  readonly buildCommand: string | null;
  readonly testCommand: string | null;
  readonly ciConfig: string | null;
  readonly documentation: string | null;
}

export interface SkillCoverageMatrix {
  readonly required: readonly SkillId[];
  readonly available: readonly SkillId[];
  readonly gaps: readonly SkillGap[];
  readonly complete: boolean;
  readonly scan: ProjectSkillScan;
  readonly recommendedPacks: readonly {
    readonly packId: string;
    readonly version: string;
    readonly reason: string;
  }[];
  readonly installedPacks: readonly {
    readonly packId: string;
    readonly version: string;
  }[];
}
