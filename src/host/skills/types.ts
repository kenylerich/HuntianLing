/**
 * Skill registry, capability boundary, and depth profiles.
 */

declare const _skillBrand: unique symbol;
type SkillBranded<T extends string> = string & { readonly [_skillBrand]: T };

export type SkillId = SkillBranded<'SkillId'>;
export type SkillPackId = SkillBranded<'SkillPackId'>;

export type SkillRole = 'mkt' | 'planner' | 'generator' | 'evaluator';
export type SkillValidationStatus = 'valid' | 'invalid' | 'unvalidated';
export const AGILE_SKILL_KINDS = [
  'requirement-intake',
  'analysis',
  'story-splitting',
  'acceptance-criteria',
  'prioritization',
  'sprint-planning',
  'ux-review',
  'architecture',
  'implementation-planning',
  'code-review',
  'test-design',
  'qa-verification',
  'security-review',
  'release',
  'documentation',
  'retrospective-analysis',
] as const;
export type AgileSkillKind = (typeof AGILE_SKILL_KINDS)[number];
export type SkillGapKind = 'missing' | 'unvalidated' | 'outdated' | 'disabled' | 'blocked-by-tool';
export type SkillExecutor = 'manual' | 'external-agent' | 'huntianling-runtime';
export type SkillDepthId = 0 | 1 | 2 | 3 | 4;
export type SkillDepthActor = 'human' | 'model' | 'tool';

export interface SkillDepthStep {
  readonly name: string;
  readonly actor: SkillDepthActor;
}

export interface SkillDepthLevel {
  readonly id: SkillDepthId;
  readonly label: string;
  readonly steps: readonly SkillDepthStep[];
}

export interface SkillDepthProfile {
  readonly defaultLevel: SkillDepthId;
  readonly levels: readonly SkillDepthLevel[];
}

export interface SkillCapabilityBoundary {
  readonly roles: readonly SkillRole[];
  readonly taskTypes: readonly string[];
  readonly artifacts: readonly string[];
  readonly requiredTools: readonly string[];
  readonly outputSchema: string;
  readonly doesNotCover: readonly string[];
}

export interface SkillValidation {
  readonly id: string;
  readonly skillId: SkillId;
  readonly version: string;
  readonly status: Exclude<SkillValidationStatus, 'unvalidated'>;
  readonly issues: readonly string[];
  readonly source: 'skill-creator';
  readonly createdAt: number;
}

export interface SkillRecord {
  readonly id: SkillId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly supportedRoles: readonly SkillRole[];
  readonly supportedTaskTypes: readonly string[];
  readonly requiredTools: readonly string[];
  readonly validationStatus: SkillValidationStatus;
  readonly createdThroughSkillCreator: boolean;
  readonly boundary: SkillCapabilityBoundary;
  readonly depth: SkillDepthProfile;
  readonly guide: string;
  readonly examples: {
    readonly pass: unknown;
    readonly fail: unknown;
  };
}

export interface SkillGap {
  readonly skillId: SkillId;
  readonly kind: SkillGapKind;
  readonly message: string;
}

export interface InstalledSkillPackRecord {
  readonly packId: SkillPackId;
  readonly version: string;
}

export interface OriginalRequirementQuote {
  readonly text: string;
  readonly source: string;
}

export interface OriginalRequirementWriteInput {
  readonly quotes: readonly OriginalRequirementQuote[];
  readonly goal: string;
  readonly actors?: readonly string[];
  readonly scenarios?: readonly string[];
  readonly constraints?: readonly string[];
  readonly nonGoals?: readonly string[];
  readonly openQuestions?: readonly string[];
  readonly confirmed: boolean;
  readonly sessionId?: string;
  readonly projectId?: string;
}

export interface OriginalRequirementRecord {
  readonly id: string;
  readonly quotes: readonly OriginalRequirementQuote[];
  readonly goal: string;
  readonly actors: readonly string[];
  readonly scenarios: readonly string[];
  readonly constraints: readonly string[];
  readonly nonGoals: readonly string[];
  readonly openQuestions: readonly string[];
  readonly confirmed: boolean;
  readonly tracked: boolean;
  readonly skillIds: readonly SkillId[];
  readonly skillVersions: readonly string[];
  readonly depthLevel: SkillDepthId;
  readonly executor: SkillExecutor;
}

export interface MktWriteOptions {
  readonly depth?: SkillDepthId;
  readonly executor: SkillExecutor;
  readonly failureKey?: string;
  readonly projectId?: string;
  readonly allowUncalibrated?: boolean;
}

export class SkillWriteError extends Error {
  readonly code: 'VALIDATION' | 'MISSING_SKILL' | 'DEPTH_DOWNGRADE' | 'STOPPED' | 'NOT_CALIBRATED' | 'ENABLE' | 'GATED';
  readonly nextDepth?: SkillDepthId;
  readonly gaps?: readonly SkillGap[];

  constructor(
    code: 'VALIDATION' | 'MISSING_SKILL' | 'DEPTH_DOWNGRADE' | 'STOPPED' | 'NOT_CALIBRATED' | 'ENABLE' | 'GATED',
    message: string,
    extras: { readonly nextDepth?: SkillDepthId; readonly gaps?: readonly SkillGap[] } = {},
  ) {
    super(message);
    this.code = code;
    if (extras.nextDepth !== undefined) this.nextDepth = extras.nextDepth;
    if (extras.gaps !== undefined) this.gaps = extras.gaps;
  }
}
