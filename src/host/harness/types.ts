/**
 * Harness measurement, Skill-depth comparison, and self-development records.
 */

import type { SkillDepthId, SkillExecutor, SkillId } from '../skills/types.js';

export type HarnessTrialMode = 'fresh' | 'replay';
export type HarnessTrialKind = 'pass' | 'fail' | 'cancel';
export type HarnessTrialOutcome = 'accepted' | 'rejected' | 'cancelled' | 'failed';
export type HarnessModelBinding = 'deterministic-executor' | 'live-model';

export interface HarnessConfig {
  readonly minAcceptedScopeRate?: number;
  readonly maxEscapedDefects?: number;
  readonly maxFalseRejections?: number;
  readonly llmUrl?: string;
  readonly llmModel?: string;
}

export interface ResolvedHarnessConfig {
  readonly minAcceptedScopeRate: number;
  readonly maxEscapedDefects: number;
  readonly maxFalseRejections: number;
}

export function resolveHarnessConfig(input: HarnessConfig = {}): ResolvedHarnessConfig {
  const minAcceptedScopeRate = input.minAcceptedScopeRate ?? 1;
  const maxEscapedDefects = input.maxEscapedDefects ?? 0;
  const maxFalseRejections = input.maxFalseRejections ?? 0;
  if (!(minAcceptedScopeRate >= 0 && minAcceptedScopeRate <= 1)) {
    throw new Error('harness minAcceptedScopeRate must be between 0 and 1');
  }
  if (!Number.isInteger(maxEscapedDefects) || maxEscapedDefects < 0) {
    throw new Error('harness maxEscapedDefects must be a non-negative integer');
  }
  if (!Number.isInteger(maxFalseRejections) || maxFalseRejections < 0) {
    throw new Error('harness maxFalseRejections must be a non-negative integer');
  }
  return { minAcceptedScopeRate, maxEscapedDefects, maxFalseRejections };
}

export interface HarnessScenario {
  readonly id: string;
  readonly skillId: SkillId;
  readonly title: string;
  readonly kind: HarnessTrialKind;
  readonly input: unknown;
  readonly expectedOutcome: HarnessTrialOutcome;
  readonly modelBinding: HarnessModelBinding;
  readonly budget: { readonly maxRepairRounds: number };
}

export interface HarnessTrial {
  readonly id: string;
  readonly scenarioId: string;
  readonly skillId: SkillId;
  readonly depth: SkillDepthId;
  readonly mode: HarnessTrialMode;
  readonly kind: HarnessTrialKind;
  readonly outcome: HarnessTrialOutcome;
  readonly acceptedScopeComplete: boolean;
  readonly escapedDefects: number;
  readonly falseRejections: number;
  readonly repairRounds: number;
  readonly humanInterventionMs: number | null;
  readonly recoverySuccess: boolean | null;
  readonly elapsedMs: number;
  readonly tokenCost: number | null;
  readonly toolCost: number | null;
  readonly artifacts: readonly string[];
  readonly error: string | null;
  readonly executor: SkillExecutor;
  readonly modelBinding: HarnessModelBinding;
  readonly repeatIndex: number;
}

export interface HarnessComparison {
  readonly id: string;
  readonly skillId: SkillId;
  readonly changedMechanism: 'skill-depth';
  readonly baselineDepth: SkillDepthId;
  readonly candidateDepth: SkillDepthId;
  readonly threshold: ResolvedHarnessConfig;
  readonly baselineTrials: readonly HarnessTrial[];
  readonly candidateTrials: readonly HarnessTrial[];
  readonly acceptedScopeRate: number;
  readonly escapedDefects: number;
  readonly falseRejections: number;
  readonly meetsThreshold: boolean;
  readonly promoted: boolean;
  readonly createdAt: number;
}

export interface DemonstrationStep {
  readonly name: string;
  readonly executor: SkillExecutor;
  readonly result: string;
}

export interface HarnessDemonstration {
  readonly id: string;
  readonly reqIds: readonly string[];
  readonly outcome: string;
  readonly owner: string;
  readonly milestoneTitle: string;
  readonly workItemId: string;
  readonly storyDeliveryRunId: string;
  readonly customerProgress: 'submitted' | 'waiting_on_customer' | 'in_analysis' | 'in_development' | 'delivered';
  readonly gates: Readonly<Record<string, string>>;
  readonly steps: readonly DemonstrationStep[];
  readonly gaps: readonly string[];
  readonly selfHarnessSliceRefs: readonly string[];
  readonly freshProjectReady: boolean;
  readonly createdAt: number;
}

export interface HarnessLlmRequest {
  readonly method: 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface HarnessLlmResponse {
  readonly status: number;
  readonly body: string;
}

export type HarnessLlmTransport = (request: HarnessLlmRequest) => HarnessLlmResponse;

export class HarnessError extends Error {
  constructor(
    readonly code: 'VALIDATION' | 'NOT_FOUND' | 'THRESHOLD' | 'NOT_READY',
    message: string,
  ) {
    super(message);
  }
}

export function resolveHarnessLlmEndpoint(
  config: HarnessConfig = {},
  env: NodeJS.ProcessEnv = {},
): { readonly url: string | null; readonly model: string } {
  const url = firstNonBlank(config.llmUrl, env.HUNTIANLING_HARNESS_LLM_URL, env.HUNTIANLING_INTAKE_LLM_URL);
  const model = firstNonBlank(config.llmModel, env.HUNTIANLING_HARNESS_LLM_MODEL, env.HUNTIANLING_INTAKE_LLM_MODEL)
    ?? 'deepseek-chat';
  return { url, model };
}

export function resolveHarnessLlmToken(requestToken: string | undefined, env: NodeJS.ProcessEnv): string {
  const fromRequest = requestToken?.trim();
  if (fromRequest !== undefined && fromRequest !== '') return fromRequest;
  const keys = ['HUNTIANLING_HARNESS_LLM_TOKEN', 'HUNTIANLING_INTAKE_LLM_TOKEN', 'DEEPSEEK_API_KEY'] as const;
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value !== undefined && value !== '') return value;
  }
  throw new HarnessError('NOT_READY', `live-model token is required (request or ${keys.join('/')})`);
}

function firstNonBlank(...values: readonly (string | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed !== undefined && trimmed !== '') return trimmed;
  }
  return null;
}
