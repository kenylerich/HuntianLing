/**
 * Board capability — type definitions.
 *
 * WorkItem is the source of truth. Table, board, tree, coverage, and roadmap
 * views project the same items. The hierarchy follows the Azure Boards style:
 * Epic -> Feature -> Requirement/Story -> Task.
 */

import type { RequirementId } from '../agile/types.js';

declare const _boardBrand: unique symbol;
type BoardBranded<T extends string> = string & { readonly [_boardBrand]: T };

export type ProjectId = BoardBranded<'ProjectId'>;
export type MilestoneId = BoardBranded<'MilestoneId'>;
export type LaneId = BoardBranded<'LaneId'>;
export type WorkItemId = BoardBranded<'WorkItemId'>;
export type CardId = WorkItemId;
export type RoleId = BoardBranded<'RoleId'>;
export type AcceptanceCriterionId = BoardBranded<'AcceptanceCriterionId'>;
export type MilestoneDeliverySliceId = BoardBranded<'MilestoneDeliverySliceId'>;
export type TeamMemberId = BoardBranded<'TeamMemberId'>;
export type IntakeSessionId = BoardBranded<'IntakeSessionId'>;
export type IntakeMessageId = BoardBranded<'IntakeMessageId'>;
export type IntakeSourceDocumentId = BoardBranded<'IntakeSourceDocumentId'>;
export type IntakeSourceChunkId = BoardBranded<'IntakeSourceChunkId'>;
export type IntakeCandidateId = BoardBranded<'IntakeCandidateId'>;
export type AuditEventId = BoardBranded<'AuditEventId'>;

export type IntakeSessionStatus =
  | 'collecting'
  | 'ready_for_analysis'
  | 'analyzing'
  | 'candidates_ready'
  | 'approved'
  | 'rejected';
export type IntakeMessageRole = 'user' | 'assistant' | 'system';
export const INTAKE_MESSAGE_KINDS = ['chat', 'clarifying-question', 'follow-up-answer'] as const;
export type IntakeMessageKind = (typeof INTAKE_MESSAGE_KINDS)[number];
export const MKT_FOLLOW_UP_FIELDS = ['goal', 'actors', 'scenarios', 'constraints', 'nonGoals', 'confirm'] as const;
export type MktFollowUpField = (typeof MKT_FOLLOW_UP_FIELDS)[number];
export type IntakeSourceKind =
  | 'text'
  | 'image'
  | 'word'
  | 'pdf'
  | 'markdown'
  | 'plain-text'
  | 'file';
export type IntakeSourceParseStatus = 'pending' | 'parsed' | 'unsupported' | 'failed';
export type IntakeCandidateType = 'epic' | 'feature' | 'requirement' | 'story' | 'task' | 'bug' | 'research';
export type IntakeCandidateStatus = 'draft' | 'approved' | 'rejected';

export interface Role {
  readonly id: RoleId;
  readonly displayName: string;
}

export const DEFAULT_ROLES: readonly Role[] = [
  { id: 'product-owner' as RoleId, displayName: '产品负责人' },
  { id: 'developer' as RoleId, displayName: '开发' },
  { id: 'process-steward' as RoleId, displayName: '流程看护' },
];

export const TEAM_WIP_KINDS = [
  'work-item',
  'collaboration-task',
  'review',
  'repository',
  'ci',
  'environment',
] as const;
export type TeamWipKind = (typeof TEAM_WIP_KINDS)[number];
export const TEAM_WIP_SCOPES = ['member', 'role', 'project', 'member-type'] as const;
export type TeamWipScope = (typeof TEAM_WIP_SCOPES)[number];
export const WIP_RESOURCE_KINDS = ['repository', 'ci', 'environment'] as const;
export type WipResourceKind = (typeof WIP_RESOURCE_KINDS)[number];

export interface TeamWipPolicy {
  readonly id: string;
  readonly kind: TeamWipKind;
  readonly scope: TeamWipScope;
  readonly scopeId: string;
  readonly limit: number;
}

export interface TeamWipPolicyInput {
  readonly kind: TeamWipKind;
  readonly scope: TeamWipScope;
  readonly scopeId: string;
  readonly limit: number;
}

export const READY_CHECK_KINDS = [
  'analysis',
  'design',
  'acceptance',
  'milestone',
  'unblocked',
] as const;
export type ReadyCheckKind = (typeof READY_CHECK_KINDS)[number];

export const DONE_CHECK_KINDS = [
  'executed-evidence',
  'required-checks',
  'review',
  'code',
  'children-complete',
] as const;
export type DoneCheckKind = (typeof DONE_CHECK_KINDS)[number];

export interface ProjectDeliveryPolicy {
  readonly readyChecks: readonly ReadyCheckKind[];
  readonly doneChecks: readonly DoneCheckKind[];
}

export const DEFAULT_READY_CHECKS: readonly ReadyCheckKind[] = READY_CHECK_KINDS;
export const DEFAULT_DONE_CHECKS: readonly DoneCheckKind[] = ['executed-evidence', 'required-checks'];

export const DEFAULT_DELIVERY_POLICY: ProjectDeliveryPolicy = {
  readyChecks: DEFAULT_READY_CHECKS,
  doneChecks: DEFAULT_DONE_CHECKS,
};

export interface DeliveryGateMissing {
  readonly kind: 'field' | 'evidence' | 'lifecycle';
  readonly code: string;
  readonly message: string;
}

export interface DeliveryGateInspection {
  readonly workItemId: WorkItemId;
  readonly from: WorkItemStatus;
  readonly to: WorkItemStatus;
  readonly allowed: boolean;
  readonly missing: readonly DeliveryGateMissing[];
  readonly policy: ProjectDeliveryPolicy;
}

export interface WorkItemWipResource {
  readonly kind: WipResourceKind;
  readonly id: string;
}

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly roles: readonly Role[];
  readonly wipPolicies: readonly TeamWipPolicy[];
  readonly deliveryPolicy: ProjectDeliveryPolicy;
  readonly enabledMethodIds: readonly string[];
  readonly prioritizationMethodId: string | null;
  readonly enabledAgentIds: readonly string[];
  readonly agentCustomizations: readonly AgentCustomization[];
  readonly archivedAt: number | null;
}

export interface AgentCustomization {
  readonly agentId: string;
  readonly allowedToolIds?: readonly string[];
  readonly requiredSkillIds?: readonly string[];
}

export interface AuditEvent {
  readonly id: AuditEventId;
  readonly projectId: ProjectId;
  readonly actorId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly targetLabel: string;
  readonly requestSource: string;
  readonly changedFields: readonly string[];
  readonly reason: string;
  readonly correlationId: string | null;
  readonly createdAt: number;
}

export interface AuditEventCreateInput {
  readonly projectId: ProjectId;
  readonly actorId?: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly targetLabel?: string;
  readonly requestSource?: string;
  readonly changedFields?: readonly string[];
  readonly reason?: string;
  readonly correlationId?: string | null;
}

export interface AuditEventFilter {
  readonly projectId?: ProjectId;
  readonly actorId?: string;
  readonly action?: string | readonly string[];
  readonly targetType?: string;
  readonly targetId?: string;
  readonly from?: number;
  readonly to?: number;
  readonly limit?: number;
}

export const INTAKE_SESSION_STATUSES: readonly IntakeSessionStatus[] = [
  'collecting',
  'ready_for_analysis',
  'analyzing',
  'candidates_ready',
  'approved',
  'rejected',
];

export const INTAKE_MESSAGE_ROLES: readonly IntakeMessageRole[] = [
  'user',
  'assistant',
  'system',
];

export const INTAKE_SOURCE_KINDS: readonly IntakeSourceKind[] = [
  'text',
  'image',
  'word',
  'pdf',
  'markdown',
  'plain-text',
  'file',
];

export const INTAKE_SOURCE_PARSE_STATUSES: readonly IntakeSourceParseStatus[] = [
  'pending',
  'parsed',
  'unsupported',
  'failed',
];

export const INTAKE_CANDIDATE_TYPES: readonly IntakeCandidateType[] = [
  'epic',
  'feature',
  'requirement',
  'story',
  'task',
  'bug',
  'research',
];

export const INTAKE_CANDIDATE_STATUSES: readonly IntakeCandidateStatus[] = [
  'draft',
  'approved',
  'rejected',
];

export interface IntakeSession {
  readonly id: IntakeSessionId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly status: IntakeSessionStatus;
  readonly sourceChannel: string;
  readonly submitter: string;
  readonly messageIds: readonly IntakeMessageId[];
  readonly sourceDocumentIds: readonly IntakeSourceDocumentId[];
  readonly candidateIds: readonly IntakeCandidateId[];
  readonly analysisStatus: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface IntakeSessionCreateInput {
  readonly projectId: ProjectId;
  readonly title: string;
  readonly sourceChannel?: string;
  readonly submitter?: string;
}

export interface IntakeSessionUpdateInput {
  readonly title?: string;
  readonly status?: IntakeSessionStatus;
  readonly sourceChannel?: string;
  readonly submitter?: string;
  readonly analysisStatus?: string;
}

export interface IntakeSessionFilter {
  readonly projectId?: ProjectId;
  readonly status?: IntakeSessionStatus | readonly IntakeSessionStatus[];
}

export interface IntakeMessage {
  readonly id: IntakeMessageId;
  readonly sessionId: IntakeSessionId;
  readonly projectId: ProjectId;
  readonly role: IntakeMessageRole;
  readonly author: string;
  readonly body: string;
  readonly kind: IntakeMessageKind;
  readonly field: MktFollowUpField | null;
  readonly sourceDocumentIds: readonly IntakeSourceDocumentId[];
  readonly createdAt: number;
}

export interface IntakeMessageCreateInput {
  readonly role?: IntakeMessageRole;
  readonly author?: string;
  readonly body?: string;
  readonly kind?: IntakeMessageKind;
  readonly field?: MktFollowUpField;
  readonly sourceDocumentIds?: readonly IntakeSourceDocumentId[];
}

export interface IntakeFollowUpInput {
  readonly field: MktFollowUpField;
  readonly value: string;
  readonly author?: string;
}

export interface IntakeClarifyingQuestion {
  readonly id: IntakeMessageId;
  readonly field: MktFollowUpField;
  readonly prompt: string;
  readonly status: 'open' | 'answered';
}

export interface IntakeMktDraft {
  readonly quotes: readonly { readonly text: string; readonly source: string }[];
  readonly goal: string;
  readonly actors: readonly string[];
  readonly scenarios: readonly string[];
  readonly constraints: readonly string[];
  readonly nonGoals: readonly string[];
  readonly openQuestions: readonly string[];
  readonly confirmed: boolean;
  readonly tracked: boolean;
  readonly missingFields: readonly MktFollowUpField[];
}

export interface IntakeSourceChunk {
  readonly id: IntakeSourceChunkId;
  readonly sourceDocumentId: IntakeSourceDocumentId;
  readonly index: number;
  readonly text: string;
}

export interface IntakeSourceDocument {
  readonly id: IntakeSourceDocumentId;
  readonly sessionId: IntakeSessionId;
  readonly projectId: ProjectId;
  readonly kind: IntakeSourceKind;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly parseStatus: IntakeSourceParseStatus;
  readonly parseError: string;
  readonly extractedText: string;
  readonly storedFileId: string | null;
  readonly chunks: readonly IntakeSourceChunk[];
  readonly createdAt: number;
}

export interface IntakeSourceDocumentCreateInput {
  readonly kind: IntakeSourceKind;
  readonly name: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly parseStatus?: IntakeSourceParseStatus;
  readonly parseError?: string;
  readonly extractedText?: string;
  readonly chunks?: readonly string[];
  readonly content?: Uint8Array;
  readonly understanding?: string;
  readonly uploader?: string;
}

export interface IntakeCandidateSourceRef {
  readonly sourceDocumentId: IntakeSourceDocumentId | null;
  readonly sourceChunkId: IntakeSourceChunkId | null;
  readonly messageId: IntakeMessageId | null;
  readonly quote: string;
  readonly confidence: number;
}

export interface IntakeCandidateRequirement {
  readonly id: IntakeCandidateId;
  readonly sessionId: IntakeSessionId;
  readonly projectId: ProjectId;
  readonly type: IntakeCandidateType;
  readonly title: string;
  readonly body: string;
  readonly analysis: string;
  readonly design: string;
  readonly acceptance: readonly string[];
  readonly parentCandidateId: IntakeCandidateId | null;
  readonly milestoneId: MilestoneId | null;
  readonly sourceRefs: readonly IntakeCandidateSourceRef[];
  readonly confidence: number;
  readonly openQuestions: readonly string[];
  readonly goals: readonly string[];
  readonly actors: readonly string[];
  readonly scenarios: readonly string[];
  readonly constraints: readonly string[];
  readonly risks: readonly string[];
  readonly assumptions: readonly string[];
  readonly status: IntakeCandidateStatus;
  readonly workItemId: WorkItemId | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface IntakeCandidateUpdateInput {
  readonly type?: IntakeCandidateType;
  readonly title?: string;
  readonly body?: string;
  readonly analysis?: string;
  readonly design?: string;
  readonly acceptance?: readonly string[];
  readonly parentCandidateId?: IntakeCandidateId | null;
  readonly milestoneId?: MilestoneId | null;
  readonly sourceRefs?: readonly IntakeCandidateSourceRef[];
  readonly confidence?: number;
  readonly openQuestions?: readonly string[];
  readonly goals?: readonly string[];
  readonly actors?: readonly string[];
  readonly scenarios?: readonly string[];
  readonly constraints?: readonly string[];
  readonly risks?: readonly string[];
  readonly assumptions?: readonly string[];
  readonly status?: IntakeCandidateStatus;
}

export type IntakeAnalyzeMode = 'deterministic' | 'llm';

export interface IntakeAnalyzeInput {
  readonly mode?: IntakeAnalyzeMode;
}

export interface IntakeCandidateFilter {
  readonly projectId?: ProjectId;
  readonly sessionId?: IntakeSessionId;
  readonly status?: IntakeCandidateStatus | readonly IntakeCandidateStatus[];
}

export interface IntakeApprovalInput {
  readonly candidateIds?: readonly IntakeCandidateId[];
  readonly actorId?: string;
}

export interface IntakeApprovalResult {
  readonly session: IntakeSession;
  readonly candidates: readonly IntakeCandidateRequirement[];
  readonly workItems: readonly WorkItem[];
}

export interface IntakeSessionBundle {
  readonly session: IntakeSession;
  readonly messages: readonly IntakeMessage[];
  readonly sourceDocuments: readonly IntakeSourceDocument[];
  readonly candidates: readonly IntakeCandidateRequirement[];
  readonly questions: readonly IntakeClarifyingQuestion[];
  readonly mktDraft: IntakeMktDraft;
}

export type TeamMemberType = 'human' | 'agent' | 'service-account' | 'external-reviewer';
export type TeamMemberStatus = 'active' | 'inactive' | 'suspended' | 'unavailable' | 'observer';
export type WorkflowRunStatus =
  | 'not_started'
  | 'ready'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'in_review'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type WorkflowStepStatus =
  | 'ready'
  | 'queued'
  | 'assigned'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'in_review'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type WorkflowWaitItemType = 'approval' | 'review' | 'input' | 'gate' | 'resource';
export type WorkflowCheckStatus = 'passing' | 'failing' | 'blocked' | 'unknown';
export type WorkflowBoardControl = 'pause' | 'resume' | 'cancel' | 'reassign' | 'retry' | 'rerun';
export type WorkflowBoardLinkKind =
  | 'workflow-map'
  | 'scheduler-timeline'
  | 'test-replay'
  | 'workflow-run'
  | 'workflow-step'
  | 'team-chat-message'
  | 'work-item'
  | 'branch'
  | 'pull-request'
  | 'ci-run'
  | 'code-change'
  | 'security-check'
  | 'reliability-check'
  | 'trust-evidence'
  | 'audit-record';
export type DeliveryEvidenceArea =
  | 'acceptance'
  | 'code'
  | 'review'
  | 'ci'
  | 'evidence'
  | 'governance'
  | 'security'
  | 'reliability'
  | 'trust';
export type DeliveryEvidenceStatus = 'missing' | 'pending' | 'passing' | 'failing' | 'blocked' | 'waived';
export type DeliveryEvidenceProducer = 'evaluator' | 'ci' | 'scm' | 'generator' | 'manual' | 'tool';
export type DeliveryEvidenceExecutionKind = 'executed' | 'self_check' | 'manual';
export type DeliveryEvidenceLinkKind =
  | 'repository'
  | 'branch'
  | 'commit'
  | 'diff'
  | 'changed-file'
  | 'pull-request'
  | 'code-review'
  | 'ci-run'
  | 'ci-artifact'
  | 'coverage-report'
  | 'deployment'
  | 'evidence-record'
  | 'security-finding'
  | 'security-check'
  | 'reliability-check'
  | 'trust-evidence'
  | 'compliance-obligation'
  | 'governance-control'
  | 'audit-record'
  | 'source-document';
export type GovernanceObligationStatus = 'draft' | 'pending_review' | 'approved' | 'active' | 'retired';
export type DeliveryRiskArea = 'security' | 'reliability' | 'trust' | 'governance';
export type DeliveryRiskAcceptanceStatus = 'requested' | 'approved' | 'rejected' | 'expired';

export const TEAM_MEMBER_TYPES: readonly TeamMemberType[] = [
  'human',
  'agent',
  'service-account',
  'external-reviewer',
];

export const TEAM_MEMBER_STATUSES: readonly TeamMemberStatus[] = [
  'active',
  'inactive',
  'suspended',
  'unavailable',
  'observer',
];

export const WORKFLOW_RUN_STATUSES: readonly WorkflowRunStatus[] = [
  'not_started',
  'ready',
  'queued',
  'running',
  'waiting',
  'blocked',
  'in_review',
  'verifying',
  'completed',
  'failed',
  'cancelled',
];

export const WORKFLOW_STEP_STATUSES: readonly WorkflowStepStatus[] = [
  'ready',
  'queued',
  'assigned',
  'running',
  'waiting',
  'blocked',
  'in_review',
  'verifying',
  'completed',
  'failed',
  'cancelled',
];

export const WORKFLOW_WAIT_ITEM_TYPES: readonly WorkflowWaitItemType[] = [
  'approval',
  'review',
  'input',
  'gate',
  'resource',
];

export const WORKFLOW_CHECK_STATUSES: readonly WorkflowCheckStatus[] = [
  'passing',
  'failing',
  'blocked',
  'unknown',
];

export const WORKFLOW_BOARD_CONTROLS: readonly WorkflowBoardControl[] = [
  'pause',
  'resume',
  'cancel',
  'reassign',
  'retry',
  'rerun',
];

export const WORKFLOW_BOARD_LINK_KINDS: readonly WorkflowBoardLinkKind[] = [
  'workflow-map',
  'scheduler-timeline',
  'test-replay',
  'workflow-run',
  'workflow-step',
  'team-chat-message',
  'work-item',
  'branch',
  'pull-request',
  'ci-run',
  'code-change',
  'security-check',
  'reliability-check',
  'trust-evidence',
  'audit-record',
];

export const DELIVERY_EVIDENCE_AREAS: readonly DeliveryEvidenceArea[] = [
  'acceptance',
  'code',
  'review',
  'ci',
  'evidence',
  'governance',
  'security',
  'reliability',
  'trust',
];

export const DELIVERY_EVIDENCE_STATUSES: readonly DeliveryEvidenceStatus[] = [
  'missing',
  'pending',
  'passing',
  'failing',
  'blocked',
  'waived',
];

export const DELIVERY_EVIDENCE_PRODUCERS: readonly DeliveryEvidenceProducer[] = [
  'evaluator',
  'ci',
  'scm',
  'generator',
  'manual',
  'tool',
];

export const DELIVERY_EVIDENCE_EXECUTION_KINDS: readonly DeliveryEvidenceExecutionKind[] = [
  'executed',
  'self_check',
  'manual',
];

export const DELIVERY_EVIDENCE_LINK_KINDS: readonly DeliveryEvidenceLinkKind[] = [
  'repository',
  'branch',
  'commit',
  'diff',
  'changed-file',
  'pull-request',
  'code-review',
  'ci-run',
  'ci-artifact',
  'coverage-report',
  'deployment',
  'evidence-record',
  'security-finding',
  'security-check',
  'reliability-check',
  'trust-evidence',
  'compliance-obligation',
  'governance-control',
  'audit-record',
  'source-document',
];

export const GOVERNANCE_OBLIGATION_STATUSES: readonly GovernanceObligationStatus[] = [
  'draft',
  'pending_review',
  'approved',
  'active',
  'retired',
];

export const DELIVERY_RISK_AREAS: readonly DeliveryRiskArea[] = [
  'security',
  'reliability',
  'trust',
  'governance',
];

export const DELIVERY_RISK_ACCEPTANCE_STATUSES: readonly DeliveryRiskAcceptanceStatus[] = [
  'requested',
  'approved',
  'rejected',
  'expired',
];

export interface TeamMember {
  readonly id: TeamMemberId;
  readonly projectId: ProjectId;
  readonly displayName: string;
  readonly memberType: TeamMemberType;
  readonly status: TeamMemberStatus;
  readonly roleIds: readonly RoleId[];
  readonly permissions: readonly string[];
  readonly capabilityProfile: string;
  readonly skillProfile: readonly string[];
  readonly region: string;
  readonly timezone: string;
  readonly capacityUnits: number;
  readonly concurrentWorkLimit: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface TeamMemberCreateInput {
  readonly projectId: ProjectId;
  readonly displayName: string;
  readonly memberType?: TeamMemberType;
  readonly status?: TeamMemberStatus;
  readonly roleIds?: readonly RoleId[];
  readonly permissions?: readonly string[];
  readonly capabilityProfile?: string;
  readonly skillProfile?: readonly string[];
  readonly region?: string;
  readonly timezone?: string;
  readonly capacityUnits?: number;
  readonly concurrentWorkLimit?: number;
}

export interface TeamMemberUpdateInput {
  readonly displayName?: string;
  readonly memberType?: TeamMemberType;
  readonly status?: TeamMemberStatus;
  readonly roleIds?: readonly RoleId[];
  readonly permissions?: readonly string[];
  readonly capabilityProfile?: string;
  readonly skillProfile?: readonly string[];
  readonly region?: string;
  readonly timezone?: string;
  readonly capacityUnits?: number;
  readonly concurrentWorkLimit?: number;
}

export interface TeamMemberFilter {
  readonly projectId?: ProjectId;
  readonly memberType?: TeamMemberType | readonly TeamMemberType[];
  readonly status?: TeamMemberStatus | readonly TeamMemberStatus[];
  readonly roleId?: RoleId;
}

export interface WorkItemAssignmentInput {
  readonly memberId: TeamMemberId;
  readonly roleId?: RoleId;
  readonly actorId?: string;
  readonly auditAction?: string;
}

export interface WorkflowBoardLink {
  readonly kind: WorkflowBoardLinkKind;
  readonly id: string;
  readonly label: string;
  readonly url: string | null;
}

export interface WorkflowStepSummary {
  readonly id: string;
  readonly title: string;
  readonly status: WorkflowStepStatus;
  readonly owner: string | null;
  readonly roleId: RoleId | null;
  readonly dependsOnStepIds: readonly string[];
  readonly reason: string;
  readonly links: readonly WorkflowBoardLink[];
}

export interface WorkflowWaitItem {
  readonly id: string;
  readonly type: WorkflowWaitItemType;
  readonly title: string;
  readonly status: string;
  readonly roleId: RoleId | null;
  readonly owner: string | null;
  readonly dueAt: number | null;
  readonly links: readonly WorkflowBoardLink[];
}

export interface WorkflowCheckSummary {
  readonly id: string;
  readonly title: string;
  readonly status: WorkflowCheckStatus;
  readonly reason: string;
  readonly links: readonly WorkflowBoardLink[];
}

export interface WorkflowBoardSummary {
  readonly id: WorkItemId;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly workflowRunId: string | null;
  readonly workflowTemplateVersion: string;
  readonly stage: WorkItemStatus;
  readonly runStatus: WorkflowRunStatus;
  readonly activeOwner: string | null;
  readonly activeRoleId: RoleId | null;
  readonly nextAction: string;
  readonly downstreamImpact: string;
  readonly schedulerReason: string;
  readonly runningSteps: readonly WorkflowStepSummary[];
  readonly blockedSteps: readonly WorkflowStepSummary[];
  readonly waitingApprovals: readonly WorkflowWaitItem[];
  readonly waitingReviews: readonly WorkflowWaitItem[];
  readonly failedChecks: readonly WorkflowCheckSummary[];
  readonly controls: readonly WorkflowBoardControl[];
  readonly links: readonly WorkflowBoardLink[];
  readonly updatedAt: number;
}

export interface WorkflowBoardSummaryInput {
  readonly workflowRunId?: string | null;
  readonly workflowTemplateVersion?: string;
  readonly stage?: WorkItemStatus;
  readonly runStatus?: WorkflowRunStatus;
  readonly activeOwner?: string | null;
  readonly activeRoleId?: RoleId | null;
  readonly nextAction?: string;
  readonly downstreamImpact?: string;
  readonly schedulerReason?: string;
  readonly runningSteps?: readonly WorkflowStepSummary[];
  readonly blockedSteps?: readonly WorkflowStepSummary[];
  readonly waitingApprovals?: readonly WorkflowWaitItem[];
  readonly waitingReviews?: readonly WorkflowWaitItem[];
  readonly failedChecks?: readonly WorkflowCheckSummary[];
  readonly controls?: readonly WorkflowBoardControl[];
  readonly links?: readonly WorkflowBoardLink[];
}

export interface WorkflowBoardSummaryFilter {
  readonly projectId?: ProjectId;
  readonly workItemId?: WorkItemId;
  readonly runStatus?: WorkflowRunStatus | readonly WorkflowRunStatus[];
}

export interface StoryPriorityQueueFilter {
  readonly milestoneId?: MilestoneId | null;
}

export interface StoryPriorityQueueItem {
  readonly rank: number;
  readonly workItemId: WorkItemId;
  readonly title: string;
  readonly priority: WorkItemPriority | null;
  readonly status: WorkItemStatus;
  readonly milestoneId: MilestoneId | null;
  readonly ready: boolean;
  readonly skipped: boolean;
  readonly active: boolean;
  readonly blockedReasons: readonly string[];
  readonly schedulerReason: string;
  readonly workflowSummary: WorkflowBoardSummary;
  readonly score: number;
  readonly explanation: string;
  readonly methodId: string | null;
  readonly overridden: boolean;
}

export interface StoryPriorityQueue {
  readonly projectId: ProjectId;
  readonly milestoneId: MilestoneId | null;
  readonly generatedAt: number;
  readonly methodId: string | null;
  readonly items: readonly StoryPriorityQueueItem[];
  readonly readyStoryIds: readonly WorkItemId[];
  readonly skippedStoryIds: readonly WorkItemId[];
  readonly activeStoryIds: readonly WorkItemId[];
  readonly warnings: readonly string[];
}

export interface DeliveryEvidenceLink {
  readonly kind: DeliveryEvidenceLinkKind;
  readonly id: string;
  readonly label: string;
  readonly url: string | null;
  readonly acceptanceCriterionIds: readonly AcceptanceCriterionId[];
}

export interface DeliveryEvidenceCheck {
  readonly id: string;
  readonly area: DeliveryEvidenceArea;
  readonly title: string;
  readonly status: DeliveryEvidenceStatus;
  readonly required: boolean;
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly acceptanceCriterionIds: readonly AcceptanceCriterionId[];
  readonly links: readonly DeliveryEvidenceLink[];
  readonly producer: DeliveryEvidenceProducer;
  readonly executionKind: DeliveryEvidenceExecutionKind;
  readonly designRevision: string;
}

export interface GovernanceObligationSummary {
  readonly id: string;
  readonly title: string;
  readonly jurisdiction: string;
  readonly source: string;
  readonly status: GovernanceObligationStatus;
  readonly owner: string;
  readonly reviewer: string;
  readonly effectiveDate: number | null;
  readonly reviewDate: number | null;
  readonly controlIds: readonly string[];
  readonly links: readonly DeliveryEvidenceLink[];
}

export interface DeliveryRiskAcceptance {
  readonly id: string;
  readonly area: DeliveryRiskArea;
  readonly title: string;
  readonly status: DeliveryRiskAcceptanceStatus;
  readonly approver: string;
  readonly reason: string;
  readonly expiresAt: number | null;
  readonly links: readonly DeliveryEvidenceLink[];
}

export interface DeliveryEvidenceSummary {
  readonly id: WorkItemId;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly codeLinks: readonly DeliveryEvidenceLink[];
  readonly pullRequests: readonly DeliveryEvidenceLink[];
  readonly reviewLinks: readonly DeliveryEvidenceLink[];
  readonly ciRuns: readonly DeliveryEvidenceLink[];
  readonly deploymentLinks: readonly DeliveryEvidenceLink[];
  readonly evidenceLinks: readonly DeliveryEvidenceLink[];
  readonly checks: readonly DeliveryEvidenceCheck[];
  readonly obligations: readonly GovernanceObligationSummary[];
  readonly riskAcceptances: readonly DeliveryRiskAcceptance[];
  readonly provenanceLinks: readonly DeliveryEvidenceLink[];
  readonly notes: string;
  readonly designRevision: string;
  readonly updatedAt: number;
}

export interface DeliveryEvidenceSummaryInput {
  readonly codeLinks?: readonly DeliveryEvidenceLink[];
  readonly pullRequests?: readonly DeliveryEvidenceLink[];
  readonly reviewLinks?: readonly DeliveryEvidenceLink[];
  readonly ciRuns?: readonly DeliveryEvidenceLink[];
  readonly deploymentLinks?: readonly DeliveryEvidenceLink[];
  readonly evidenceLinks?: readonly DeliveryEvidenceLink[];
  readonly checks?: readonly DeliveryEvidenceCheck[];
  readonly obligations?: readonly GovernanceObligationSummary[];
  readonly riskAcceptances?: readonly DeliveryRiskAcceptance[];
  readonly provenanceLinks?: readonly DeliveryEvidenceLink[];
  readonly notes?: string;
  readonly designRevision?: string;
}

export interface DeliveryEvidenceSummaryFilter {
  readonly projectId?: ProjectId;
  readonly workItemId?: WorkItemId;
}

export interface ProjectDeliveryEvidenceRollupFilter {
  readonly milestoneId?: MilestoneId | null;
}

export interface ProjectDeliveryEvidenceRollup {
  readonly projectId: ProjectId;
  readonly milestoneId: MilestoneId | null;
  readonly generatedAt: number;
  readonly totalWorkItems: number;
  readonly workItemIds: readonly WorkItemId[];
  readonly readyWorkItemIds: readonly WorkItemId[];
  readonly blockedWorkItemIds: readonly WorkItemId[];
  readonly workItemsWithCode: number;
  readonly workItemsWithPullRequests: number;
  readonly workItemsWithReviews: number;
  readonly workItemsWithCi: number;
  readonly workItemsWithEvidence: number;
  readonly missingRequiredChecks: number;
  readonly pendingRequiredChecks: number;
  readonly failedRequiredChecks: number;
  readonly openRiskAcceptances: number;
  readonly activeObligations: number;
  readonly unapprovedObligations: number;
  readonly warnings: readonly string[];
}

export interface TeamCapacityMemberSummary {
  readonly member: TeamMember;
  readonly assignedWorkItemIds: readonly WorkItemId[];
  readonly assignedCount: number;
  readonly blockedCount: number;
  readonly availableSlots: number;
  readonly overLimit: boolean;
  readonly unavailable: boolean;
  readonly warnings: readonly string[];
}

export interface TeamCapacitySummary {
  readonly projectId: ProjectId;
  readonly members: readonly TeamCapacityMemberSummary[];
  readonly unassignedWorkItemIds: readonly WorkItemId[];
  readonly totalMembers: number;
  readonly activeMembers: number;
  readonly assignedWorkItems: number;
  readonly unassignedWorkItems: number;
  readonly overloadedMembers: number;
  readonly unavailableMembers: number;
  readonly blockedAssignedWorkItems: number;
  readonly warnings: readonly string[];
}

export type MilestoneStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export const MILESTONE_STATUSES: readonly MilestoneStatus[] = [
  'planned',
  'active',
  'completed',
  'cancelled',
];

export interface Milestone {
  readonly id: MilestoneId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly description: string;
  readonly status: MilestoneStatus;
  readonly startDate: number | null;
  readonly dueDate: number | null;
  readonly goal: string;
}

export interface MilestoneCreateInput {
  readonly projectId: ProjectId;
  readonly title: string;
  readonly description?: string;
  readonly status?: MilestoneStatus;
  readonly startDate?: number | null;
  readonly dueDate?: number | null;
  readonly goal?: string;
}

export interface MilestoneUpdateInput {
  readonly title?: string;
  readonly description?: string;
  readonly status?: MilestoneStatus;
  readonly startDate?: number | null;
  readonly dueDate?: number | null;
  readonly goal?: string;
}

export interface MilestoneFilter {
  readonly projectId?: ProjectId;
  readonly status?: MilestoneStatus | readonly MilestoneStatus[];
}

export interface MilestoneDeliverySlice {
  readonly id: MilestoneDeliverySliceId;
  readonly projectId: ProjectId;
  readonly parentWorkItemId: WorkItemId;
  readonly milestoneId: MilestoneId;
  readonly title: string;
  readonly scope: string;
  readonly acceptanceCriterionIds: readonly AcceptanceCriterionId[];
  readonly expectedEvidence: readonly string[];
  readonly targetStatus: WorkItemStatus;
  readonly owner: string;
  readonly status: WorkItemStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface MilestoneDeliverySliceCreateInput {
  readonly parentWorkItemId: WorkItemId;
  readonly milestoneId: MilestoneId;
  readonly title?: string;
  readonly scope: string;
  readonly acceptanceCriterionIds?: readonly AcceptanceCriterionId[];
  readonly expectedEvidence?: readonly string[];
  readonly targetStatus?: WorkItemStatus;
  readonly owner?: string;
  readonly status?: WorkItemStatus;
}

export interface MilestoneDeliverySliceUpdateInput {
  readonly milestoneId?: MilestoneId;
  readonly title?: string;
  readonly scope?: string;
  readonly acceptanceCriterionIds?: readonly AcceptanceCriterionId[];
  readonly expectedEvidence?: readonly string[];
  readonly targetStatus?: WorkItemStatus;
  readonly owner?: string;
  readonly status?: WorkItemStatus;
}

export interface MilestoneDeliverySliceFilter {
  readonly projectId?: ProjectId;
  readonly parentWorkItemId?: WorkItemId;
  readonly milestoneId?: MilestoneId;
  readonly status?: WorkItemStatus | readonly WorkItemStatus[];
}

export type WorkItemType =
  | 'epic'
  | 'feature'
  | 'requirement'
  | 'story'
  | 'task'
  | 'bug'
  /** @deprecated Use `bug`; retained so older board files still hydrate. */
  | 'defect'
  | 'research'
  | 'discussion'
  | 'meeting'
  | 'decision'
  | 'brainstorm';

export type WorkItemStatus =
  | 'inbox'
  | 'analyzing'
  | 'designing'
  | 'triaged'
  | 'planned'
  | 'ready'
  | 'in_progress'
  | 'in_review'
  | 'verifying'
  | 'gates_passing'
  | 'delivered'
  | 'rejected'
  | 'stopped';

export const WORK_ITEM_STATUSES: readonly WorkItemStatus[] = [
  'inbox',
  'analyzing',
  'designing',
  'triaged',
  'planned',
  'ready',
  'in_progress',
  'in_review',
  'verifying',
  'gates_passing',
  'delivered',
  'rejected',
  'stopped',
];

export type WorkItemPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type WorkItemEstimate = number | null;
export type WorkItemAssignee = string;
export type MoscowClass = 'must' | 'should' | 'could' | 'wont';
export type KanoClass = 'basic' | 'performance' | 'excitement';

export interface RankingInputs {
  readonly moscow?: MoscowClass;
  readonly riceReach?: number;
  readonly riceImpact?: number;
  readonly riceConfidence?: number;
  readonly riceEffort?: number;
  readonly wsjfUserBusinessValue?: number;
  readonly wsjfTimeCriticality?: number;
  readonly wsjfRiskReduction?: number;
  readonly wsjfJobSize?: number;
  readonly kano?: KanoClass;
  readonly riskScore?: number;
}

export interface RankingOverride {
  readonly rank: number;
  readonly reason: string;
  readonly actorId: string;
  readonly at: number;
}
export type BoardGroupBy = 'status' | 'parent' | 'milestone' | 'type' | 'assignee' | 'claimedRole';

export interface AcceptanceCriterion {
  readonly id: AcceptanceCriterionId;
  readonly text: string;
}

export interface WorkItemCreateInput {
  readonly projectId: ProjectId;
  readonly title: string;
  readonly body?: string;
  readonly analysis?: string;
  readonly design?: string;
  readonly sourceInput?: string;
  readonly decompositionReason?: string;
  readonly type?: WorkItemType;
  readonly status?: WorkItemStatus;
  /** @deprecated Use `status`. */
  readonly stateGroup?: WorkItemStatus;
  readonly parentId?: WorkItemId | null;
  readonly milestoneId?: MilestoneId | null;
  readonly acceptance?: readonly string[];
  readonly acceptanceCriteria?: readonly AcceptanceCriterion[];
  readonly coversAcceptanceIds?: readonly AcceptanceCriterionId[];
  readonly dependencyIds?: readonly WorkItemId[];
  readonly blockedByIds?: readonly WorkItemId[];
  readonly evidence?: readonly string[];
  readonly wipResources?: readonly WorkItemWipResource[];
  readonly methodId?: string | null;
  readonly rankingInputs?: RankingInputs;
  readonly requiredSkillPackIds?: readonly string[];
}

export interface WorkItemUpdateInput {
  readonly title?: string;
  readonly body?: string;
  readonly analysis?: string;
  readonly design?: string;
  readonly sourceInput?: string;
  readonly decompositionReason?: string;
  readonly priority?: WorkItemPriority | null;
  readonly estimate?: WorkItemEstimate;
  readonly assignee?: WorkItemAssignee;
  readonly parentId?: WorkItemId | null;
  readonly milestoneId?: MilestoneId | null;
  readonly startDate?: number | null;
  readonly dueDate?: number | null;
  readonly acceptance?: readonly string[];
  readonly acceptanceCriteria?: readonly AcceptanceCriterion[];
  readonly coversAcceptanceIds?: readonly AcceptanceCriterionId[];
  readonly dependencyIds?: readonly WorkItemId[];
  readonly blockedByIds?: readonly WorkItemId[];
  readonly evidence?: readonly string[];
  readonly sourceRequirementId?: RequirementId | null;
  readonly wipResources?: readonly WorkItemWipResource[];
  readonly methodId?: string | null;
  readonly rankingInputs?: RankingInputs;
  readonly rankingOverride?: RankingOverride | null;
  readonly requiredSkillPackIds?: readonly string[];
}

export interface WorkItemFilter {
  readonly projectId?: ProjectId;
  readonly parentId?: WorkItemId | null;
  readonly milestoneId?: MilestoneId | null;
  readonly type?: WorkItemType | readonly WorkItemType[];
  readonly status?: WorkItemStatus | readonly WorkItemStatus[];
  readonly assignee?: WorkItemAssignee;
  readonly claimedRoleId?: RoleId | null;
  readonly includeArchived?: boolean;
}

export interface WorkItem {
  readonly id: WorkItemId;
  readonly projectId: ProjectId;
  readonly type: WorkItemType;
  readonly title: string;
  readonly body: string;
  readonly analysis: string;
  readonly design: string;
  readonly sourceInput: string;
  readonly decompositionReason: string;
  readonly status: WorkItemStatus;
  readonly priority: WorkItemPriority | null;
  readonly estimate: WorkItemEstimate;
  readonly assignee: WorkItemAssignee;
  readonly parentId: WorkItemId | null;
  readonly milestoneId: MilestoneId | null;
  readonly startDate: number | null;
  readonly dueDate: number | null;
  readonly acceptance: readonly string[];
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  readonly coversAcceptanceIds: readonly AcceptanceCriterionId[];
  readonly dependencyIds: readonly WorkItemId[];
  readonly blockedByIds: readonly WorkItemId[];
  readonly evidence: readonly string[];
  readonly sourceRequirementId: RequirementId | null;
  readonly sortOrder: number;
  readonly claimedRoleId: RoleId | null;
  readonly claimedBy: string | null;
  readonly claimedAt: number | null;
  readonly reviewerIds: readonly TeamMemberId[];
  readonly approverIds: readonly TeamMemberId[];
  readonly watcherIds: readonly TeamMemberId[];
  readonly wipResources: readonly WorkItemWipResource[];
  readonly methodId: string | null;
  readonly rankingInputs: RankingInputs;
  readonly rankingOverride: RankingOverride | null;
  readonly requiredSkillPackIds: readonly string[];
  readonly archivedAt: number | null;
}

export interface WorkItemTreeNode {
  readonly item: WorkItem;
  readonly children: readonly WorkItemTreeNode[];
}

export interface BoardViewColumn {
  readonly id: string;
  readonly title: string;
  readonly workItems: readonly WorkItem[];
}

export interface BoardViewQuery extends WorkItemFilter {
  readonly groupBy?: BoardGroupBy;
}

export interface BoardView {
  readonly groupBy: BoardGroupBy;
  readonly columns: readonly BoardViewColumn[];
  readonly workItems: readonly WorkItem[];
}

export interface AcceptanceCoverageSummary {
  readonly rootId: WorkItemId;
  readonly totalCriteria: number;
  readonly coveredCriteria: number;
  readonly uncoveredAcceptanceIds: readonly AcceptanceCriterionId[];
  readonly coveringWorkItemIds: readonly WorkItemId[];
  readonly complete: boolean;
}

export interface MilestoneSummary {
  readonly milestone: Milestone;
  readonly totalWorkItems: number;
  readonly deliveredWorkItems: number;
  readonly openWorkItems: number;
  readonly blockedWorkItems: number;
  readonly percentDelivered: number;
}

export interface MilestoneBoardLane {
  readonly id: string;
  readonly title: string;
  readonly milestone: Milestone | null;
  readonly summary: MilestoneSummary | null;
  readonly workItems: readonly WorkItem[];
}

export interface MilestoneBoard {
  readonly projectId: ProjectId | null;
  readonly lanes: readonly MilestoneBoardLane[];
  readonly workItems: readonly WorkItem[];
}

/** @deprecated Use WorkItem. Kept as a persistence alias for the board store. */
export type Card = WorkItem;
export type StateGroup = WorkItemStatus;

export const SCHEMA_VERSION = 10;
