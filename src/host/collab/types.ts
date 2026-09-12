/**
 * Agent Channel envelope, first-slice types, later catalog types, tasks, and events.
 */

import type { ProjectId, WorkItemId } from '../board/types.js';

export const FIRST_SLICE_MESSAGE_TYPES = [
  'note.chat',
  'task.propose',
  'task.accept',
  'task.decline',
  'task.question',
  'task.answer',
  'task.transfer',
  'task.block',
  'task.unblock',
  'task.complete',
  'task.cancel',
  'progress.update',
  'report.findings',
  'handoff.request',
  'handoff.accept',
  'handoff.decline',
  'question.ask',
  'question.answer',
  'blocker.raise',
  'blocker.resolve',
  'human.redirect',
  'human.stop',
  'customer.question_needed',
] as const;

export const LATER_CATALOG_MESSAGE_TYPES = [
  'task.split',
  'task.merge',
  'decision.record',
  'approval.request',
  'approval.granted',
  'approval.rejected',
] as const;

export const CHANNEL_MESSAGE_TYPES = [
  ...FIRST_SLICE_MESSAGE_TYPES,
  ...LATER_CATALOG_MESSAGE_TYPES,
] as const;

export type FirstSliceMessageType = (typeof FIRST_SLICE_MESSAGE_TYPES)[number];
export type LaterCatalogMessageType = (typeof LATER_CATALOG_MESSAGE_TYPES)[number];
export type ChannelMessageType = (typeof CHANNEL_MESSAGE_TYPES)[number];

export const HANDOFF_KINDS = [
  'collect_complete',
  'design_ready',
  'implement',
  'evaluate',
  'repair',
  'clarify',
  'complete',
] as const;

export type ChannelHandoffKind = (typeof HANDOFF_KINDS)[number];

export type CollaborationTaskStatus =
  | 'proposed'
  | 'accepted'
  | 'in_progress'
  | 'waiting_for_input'
  | 'blocked'
  | 'ready_for_review'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type ChannelActorKind = 'human' | 'agent' | 'system';

export interface ChannelActor {
  readonly kind: ChannelActorKind;
  readonly role: string;
  readonly memberId?: string;
  readonly agentRunId?: string;
  readonly skillIds?: readonly string[];
  readonly depth?: number;
}

export interface ChannelRefs {
  readonly workItemId?: WorkItemId;
  readonly milestoneId?: string;
  readonly taskId?: string;
  readonly runId?: string;
  readonly skillId?: string;
  readonly evidenceId?: string;
  readonly mktSessionId?: string;
  readonly branchId?: string;
  readonly pullRequestId?: string;
  readonly ciRunId?: string;
  readonly sourceDocumentId?: string;
}

export interface ChannelMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly projectId: ProjectId;
  readonly schemaVersion: 1;
  readonly type: ChannelMessageType;
  readonly createdAt: number;
  readonly from: ChannelActor;
  readonly to: { readonly kind: 'channel' | 'role' | 'member'; readonly role?: string; readonly memberId?: string };
  readonly threadId: string | null;
  readonly inReplyTo: string | null;
  readonly refs: ChannelRefs;
  readonly visibility: 'developer';
  readonly payload: Record<string, unknown>;
}

export interface ChannelConversation {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly createdAt: number;
}

export type CollaborationAssigneeKind = 'agent' | 'human';

export interface CollaborationTaskContext {
  readonly workItemId: WorkItemId | null;
  readonly milestoneId: string | null;
  readonly branchId: string | null;
  readonly pullRequestId: string | null;
  readonly ciRunId: string | null;
  readonly sourceDocumentId: string | null;
}

export interface CollaborationTask {
  readonly id: string;
  readonly conversationId: string;
  readonly projectId: ProjectId;
  readonly status: CollaborationTaskStatus;
  readonly requester: string;
  readonly ownerRole: string;
  readonly assigneeKind: CollaborationAssigneeKind;
  readonly assignee: string;
  readonly objective: string;
  readonly inputs: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly allowedTools: readonly string[];
  readonly expectedOutput: string;
  readonly checks: readonly string[];
  readonly dueMilestoneId: string | null;
  readonly dueDate: number | null;
  readonly priority: string | null;
  readonly blockers: readonly string[];
  readonly contextTags: CollaborationTaskContext;
  readonly workItemId: WorkItemId | null;
  readonly parentTaskId: string | null;
  readonly mergedFromTaskIds: readonly string[];
}

export interface ChannelDecision {
  readonly id: string;
  readonly conversationId: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId | null;
  readonly taskId: string | null;
  readonly body: string;
  readonly actor: string;
  readonly createdAt: number;
  readonly messageId: string;
}

export type ChannelApprovalStatus = 'requested' | 'granted' | 'rejected';

export interface ChannelApproval {
  readonly id: string;
  readonly conversationId: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId | null;
  readonly taskId: string;
  readonly status: ChannelApprovalStatus;
  readonly actor: string;
  readonly reason: string;
  readonly createdAt: number;
  readonly messageId: string;
}

export interface UnresolvedChannelQuestion {
  readonly id: string;
  readonly conversationId: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId | null;
  readonly taskId: string | null;
  readonly type: 'question.ask' | 'task.question';
  readonly body: string;
  readonly createdAt: number;
}

export interface CollabEvent {
  readonly id: string;
  readonly conversationId: string;
  readonly projectId: ProjectId;
  readonly actor: string;
  readonly actorRole: string;
  readonly targetType: 'task' | 'handoff' | 'message' | 'decision' | 'approval';
  readonly targetId: string;
  readonly reason: string;
  readonly createdAt: number;
  readonly correlationId: string | null;
  readonly accepted: boolean;
}

export class ChannelWriteError extends Error {
  constructor(readonly code: 'UNKNOWN_TYPE' | 'VALIDATION' | 'TRANSITION' | 'NOT_FOUND', message: string) {
    super(message);
  }
}
