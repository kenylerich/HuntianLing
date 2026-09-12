/**
 * Dispatch policy, resource leases, and Agent feedback records.
 */

import type { ProjectId, TeamMemberId, WorkItemId } from '../board/types.js';

export const LEASE_RESOURCE_TYPES = [
  'work_item',
  'collaboration_task',
  'repository',
  'branch',
  'file',
  'environment',
  'ci_runner',
  'tool',
] as const;
export type LeaseResourceType = (typeof LEASE_RESOURCE_TYPES)[number];

export const LEASE_MODES = ['shared_read', 'exclusive_write'] as const;
export type LeaseMode = (typeof LEASE_MODES)[number];

export const FEEDBACK_STATUSES = ['pending', 'accepted', 'rejected', 'revision_requested'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type DispatchErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'WIP' | 'AUTHORITY';

export class DispatchError extends Error {
  constructor(
    readonly code: DispatchErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface DispatchConfig {
  readonly leaseTtlMs?: number;
}

export interface ResolvedDispatchConfig {
  readonly leaseTtlMs: number;
}

export function resolveDispatchConfig(input: DispatchConfig = {}): ResolvedDispatchConfig {
  const leaseTtlMs = input.leaseTtlMs ?? 15 * 60 * 1000;
  if (!Number.isInteger(leaseTtlMs) || leaseTtlMs < 1_000) {
    throw new Error('dispatch leaseTtlMs must be an integer of at least 1000');
  }
  return { leaseTtlMs };
}

export interface ResourceLease {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly resourceType: LeaseResourceType;
  readonly resourceId: string;
  readonly mode: LeaseMode;
  readonly ownerId: string;
  readonly reason: string;
  readonly linkedTaskId: string | null;
  readonly workItemId: WorkItemId | null;
  readonly expiresAt: number;
  readonly createdAt: number;
}

export interface ResourceConflict {
  readonly resourceType: LeaseResourceType;
  readonly resourceId: string;
  readonly leaseIds: readonly string[];
  readonly owners: readonly string[];
  readonly mode: 'exclusive' | 'overlap' | 'migration';
  readonly message: string;
}

export interface DispatchCandidate {
  readonly memberId: TeamMemberId;
  readonly displayName: string;
  readonly score: number;
  readonly availableSlots: number;
  readonly reasons: readonly string[];
}

export interface DispatchRecommendation {
  readonly workItemId: WorkItemId;
  readonly candidates: readonly DispatchCandidate[];
  readonly ineligible: readonly { readonly memberId: TeamMemberId; readonly reason: string }[];
}

export interface AgentFeedback {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly runId: string;
  readonly agentId: string;
  readonly skillVersions: readonly string[];
  readonly status: FeedbackStatus;
  readonly summary: string;
  readonly openQuestions: readonly string[];
  readonly decisions: readonly string[];
  readonly blockers: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly nextActions: readonly string[];
  readonly proposedAnalysis: string;
  readonly proposedDesign: string;
  readonly proposedAcceptance: readonly string[];
  readonly createdAt: number;
  readonly decidedAt: number | null;
  readonly decidedBy: string | null;
}
