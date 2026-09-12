/**
 * Durable Story delivery runs and checkpoints.
 */

export const STORY_DELIVERY_STEPS = ['plan', 'implement', 'evaluate'] as const;
export type StoryDeliveryStep = (typeof STORY_DELIVERY_STEPS)[number];

export const STORY_DELIVERY_STATUSES = [
  'running',
  'paused',
  'interrupted',
  'completed',
  'cancelled',
  'blocked',
] as const;
export type StoryDeliveryStatus = (typeof STORY_DELIVERY_STATUSES)[number];

export interface DeliveryConfig {
  readonly maxRetries?: number;
  readonly maxSteps?: number;
}

export interface ResolvedDeliveryConfig {
  readonly maxRetries: number;
  readonly maxSteps: number;
}

export function resolveDeliveryConfig(input: DeliveryConfig = {}): ResolvedDeliveryConfig {
  const maxRetries = input.maxRetries ?? 3;
  const maxSteps = input.maxSteps ?? 12;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error('delivery maxRetries must be a non-negative integer');
  }
  if (!Number.isInteger(maxSteps) || maxSteps < 1) {
    throw new Error('delivery maxSteps must be a positive integer');
  }
  return { maxRetries, maxSteps };
}

export interface DeliveryBudgetUsage {
  readonly steps: number;
  readonly retries: number;
}

export interface StoryDeliveryCheckpoint {
  readonly seq: number;
  readonly designRevision: string;
  readonly acceptance: readonly string[];
  readonly completedSteps: readonly StoryDeliveryStep[];
  readonly pendingSteps: readonly StoryDeliveryStep[];
  readonly owner: string;
  readonly blockers: readonly string[];
  readonly decisions: Readonly<Record<string, unknown>>;
  readonly repositoryRevision: string;
  readonly evidenceRefs: readonly string[];
  readonly budgetUsage: DeliveryBudgetUsage;
  readonly nextAction: string;
}

export interface StoryDeliveryEvent {
  readonly id: string;
  readonly key: string;
  readonly type: string;
  readonly runId: string;
  readonly workItemId: string;
  readonly actor: string;
  readonly reason: string;
  readonly at: number;
  readonly seq: number;
  readonly accepted: boolean;
  readonly rejection: string;
}

export interface StoryDeliveryRun {
  readonly id: string;
  readonly projectId: string;
  readonly workItemId: string;
  readonly status: StoryDeliveryStatus;
  readonly environmentReady: boolean;
  readonly agentRunIds: readonly string[];
  readonly checkpoint: StoryDeliveryCheckpoint;
  readonly events: readonly StoryDeliveryEvent[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface StartStoryDeliveryInput {
  readonly workItemId: string;
  readonly actor?: string;
  readonly environmentReady?: boolean;
  readonly reason?: string;
  readonly drive?: boolean;
}

export class DeliveryError extends Error {
  constructor(
    readonly code: 'NOT_READY' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'LIMIT' | 'STALE' | 'DUPLICATE',
    message: string,
  ) {
    super(message);
  }
}
