/**
 * Board store under a workspace root.
 *
 * Work items are stored as a flat list with parent links. Role claim mutates
 * claimedRoleId / claimedBy / claimedAt. Persistence uses `huntianling.database`
 * (SQLite). Existing `<root>/.huntianling/board.json` is imported once.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  applyAgentCustomization,
  definitionFor,
  requireAgentId,
} from '../agents/definitions.js';
import { isTechnologyPackId } from '../skills/technology-packs.js';
import {
  DEFAULT_ENABLED_AGENT_IDS,
  isCodingAgentId,
} from '../agents/types.js';
import type { AgentCustomization } from './types.js';
import {
  normalizeRankingInputs,
  normalizeRankingOverride,
  rankStories,
  requirePrioritizationMethodId,
} from './prioritization.js';
import { createDatabaseService } from '../database/service.js';
import type { BoardDocument, DatabaseService } from '../database/types.js';
import { extractIntakeSource, type ImageUnderstandingAdapter } from '../intake/extract.js';
import { createHostedIntakeAdapters } from '../intake/hosted.js';
import type { IntakeConfig, IntakeHostedTransport, IntakeOcrAdapter } from '../intake/types.js';
import { buildIntakeCandidates, type IntakeLlmExtractor } from '../intake/candidates.js';
import {
  assertFollowUpValue,
  collectMktDraft,
  isMktFollowUpField,
  listClarifyingQuestions,
  questionsToAsk,
} from '../intake/clarify.js';

import {
  DEFAULT_DELIVERY_POLICY,
  DEFAULT_ROLES,
  DONE_CHECK_KINDS,
  READY_CHECK_KINDS,
  DELIVERY_EVIDENCE_AREAS,
  DELIVERY_EVIDENCE_EXECUTION_KINDS,
  DELIVERY_EVIDENCE_LINK_KINDS,
  DELIVERY_EVIDENCE_PRODUCERS,
  DELIVERY_EVIDENCE_STATUSES,
  DELIVERY_RISK_ACCEPTANCE_STATUSES,
  DELIVERY_RISK_AREAS,
  GOVERNANCE_OBLIGATION_STATUSES,
  INTAKE_CANDIDATE_STATUSES,
  INTAKE_CANDIDATE_TYPES,
  INTAKE_MESSAGE_KINDS,
  INTAKE_MESSAGE_ROLES,
  INTAKE_SESSION_STATUSES,
  INTAKE_SOURCE_KINDS,
  INTAKE_SOURCE_PARSE_STATUSES,
  MILESTONE_STATUSES,
  SCHEMA_VERSION,
  TEAM_MEMBER_STATUSES,
  TEAM_MEMBER_TYPES,
  TEAM_WIP_KINDS,
  TEAM_WIP_SCOPES,
  WIP_RESOURCE_KINDS,
  WORKFLOW_BOARD_CONTROLS,
  WORKFLOW_BOARD_LINK_KINDS,
  WORKFLOW_CHECK_STATUSES,
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_STEP_STATUSES,
  WORKFLOW_WAIT_ITEM_TYPES,
  WORK_ITEM_STATUSES,
  type AcceptanceCoverageSummary,
  type AcceptanceCriterion,
  type AcceptanceCriterionId,
  type AuditEvent,
  type AuditEventCreateInput,
  type AuditEventFilter,
  type AuditEventId,
  type BoardGroupBy,
  type BoardView,
  type BoardViewColumn,
  type BoardViewQuery,
  type Card,
  type CardId,
  type DeliveryEvidenceCheck,
  type DeliveryEvidenceLink,
  type DeliveryEvidenceSummary,
  type DeliveryEvidenceSummaryFilter,
  type DeliveryEvidenceSummaryInput,
  type DeliveryEvidenceStatus,
  type DeliveryRiskAcceptance,
  type IntakeApprovalInput,
  type IntakeApprovalResult,
  type IntakeCandidateFilter,
  type IntakeCandidateId,
  type IntakeCandidateRequirement,
  type IntakeAnalyzeInput,
  type IntakeCandidateSourceRef,
  type IntakeCandidateStatus,
  type IntakeCandidateType,
  type IntakeCandidateUpdateInput,
  type IntakeFollowUpInput,
  type IntakeMessage,
  type IntakeMessageCreateInput,
  type IntakeMessageId,
  type IntakeMessageRole,
  type IntakeSession,
  type IntakeSessionBundle,
  type IntakeSessionCreateInput,
  type IntakeSessionFilter,
  type IntakeSessionId,
  type IntakeSessionStatus,
  type IntakeSessionUpdateInput,
  type IntakeSourceChunk,
  type IntakeSourceChunkId,
  type IntakeSourceDocument,
  type IntakeSourceDocumentCreateInput,
  type IntakeSourceDocumentId,
  type IntakeSourceKind,
  type IntakeSourceParseStatus,
  type Milestone,
  type MilestoneBoard,
  type MilestoneBoardLane,
  type MilestoneCreateInput,
  type MilestoneDeliverySlice,
  type MilestoneDeliverySliceCreateInput,
  type MilestoneDeliverySliceFilter,
  type MilestoneDeliverySliceId,
  type MilestoneDeliverySliceUpdateInput,
  type MilestoneFilter,
  type MilestoneId,
  type MilestoneStatus,
  type MilestoneSummary,
  type MilestoneUpdateInput,
  type DeliveryGateInspection,
  type DeliveryGateMissing,
  type Project,
  type ProjectDeliveryEvidenceRollup,
  type ProjectDeliveryEvidenceRollupFilter,
  type DoneCheckKind,
  type ProjectDeliveryPolicy,
  type ProjectId,
  type ReadyCheckKind,
  type RoleId,
  type GovernanceObligationSummary,
  type TeamCapacitySummary,
  type TeamMember,
  type TeamMemberCreateInput,
  type TeamMemberFilter,
  type TeamMemberId,
  type TeamMemberUpdateInput,
  type TeamWipKind,
  type TeamWipPolicy,
  type TeamWipPolicyInput,
  type WipResourceKind,
  type WorkItemWipResource,
  type RankingOverride,
  type StoryPriorityQueue,
  type StoryPriorityQueueFilter,
  type WorkItem,
  type WorkItemAssignmentInput,
  type WorkItemCreateInput,
  type WorkItemFilter,
  type WorkItemId,
  type WorkItemPriority,
  type WorkItemTreeNode,
  type WorkItemUpdateInput,
  type WorkItemStatus,
  type WorkflowBoardLink,
  type WorkflowBoardControl,
  type WorkflowBoardSummary,
  type WorkflowBoardSummaryFilter,
  type WorkflowBoardSummaryInput,
  type WorkflowCheckSummary,
  type WorkflowRunStatus,
  type WorkflowStepSummary,
  type WorkflowWaitItem,
} from './types.js';
import {
  resolveEvidenceExecutionKind,
  resolveEvidenceProducer,
  staleExecutedChecks,
  workItemDesignRevision,
} from './executed-evidence.js';
import { runTransitionGates, type TransitionGate } from './gates.js';
import {
  isForbiddenTransition,
  resolveDeliveryPolicy,
  validateDefinitionOfDone,
  validateDefinitionOfReady,
  validateWorkItemHierarchy,
  validateWorkItemTransition,
  type WorkItemError,
} from './work-item.js';

export interface BoardSnapshot {
  readonly schemaVersion: number;
  readonly projects: Project[];
  readonly teamMembers: TeamMember[];
  readonly milestones: Milestone[];
  readonly deliverySlices: MilestoneDeliverySlice[];
  readonly workflowSummaries: WorkflowBoardSummary[];
  readonly deliveryEvidenceSummaries: DeliveryEvidenceSummary[];
  readonly intakeSessions: IntakeSession[];
  readonly intakeMessages: IntakeMessage[];
  readonly intakeSourceDocuments: IntakeSourceDocument[];
  readonly intakeCandidates: IntakeCandidateRequirement[];
  readonly auditEvents: AuditEvent[];
  readonly cards: Card[];
}

type StoredCard = Partial<Card> & {
  readonly id?: WorkItemId;
  readonly projectId?: ProjectId;
  readonly title?: string;
  readonly stateGroup?: WorkItemStatus;
};

type StoredMilestoneDeliverySlice = Partial<MilestoneDeliverySlice> & {
  readonly id?: MilestoneDeliverySliceId;
  readonly projectId?: ProjectId;
  readonly parentWorkItemId?: WorkItemId;
  readonly milestoneId?: MilestoneId;
};

interface StoredBoardSnapshot {
  readonly schemaVersion?: number;
  readonly projects?: Project[];
  readonly teamMembers?: TeamMember[];
  readonly milestones?: Milestone[];
  readonly deliverySlices?: StoredMilestoneDeliverySlice[];
  readonly workflowSummaries?: StoredWorkflowBoardSummary[];
  readonly deliveryEvidenceSummaries?: StoredDeliveryEvidenceSummary[];
  readonly intakeSessions?: StoredIntakeSession[];
  readonly intakeMessages?: StoredIntakeMessage[];
  readonly intakeSourceDocuments?: StoredIntakeSourceDocument[];
  readonly intakeCandidates?: StoredIntakeCandidateRequirement[];
  readonly auditEvents?: StoredAuditEvent[];
  readonly cards?: StoredCard[];
}

type StoredWorkflowBoardSummary = Partial<WorkflowBoardSummary> & {
  readonly id?: WorkItemId;
  readonly projectId?: ProjectId;
  readonly workItemId?: WorkItemId;
};

type StoredDeliveryEvidenceSummary = Partial<DeliveryEvidenceSummary> & {
  readonly id?: WorkItemId;
  readonly projectId?: ProjectId;
  readonly workItemId?: WorkItemId;
};

type StoredIntakeSession = Partial<IntakeSession> & {
  readonly id?: IntakeSessionId;
  readonly projectId?: ProjectId;
};

type StoredIntakeMessage = Partial<IntakeMessage> & {
  readonly id?: IntakeMessageId;
  readonly sessionId?: IntakeSessionId;
  readonly projectId?: ProjectId;
};

type StoredIntakeSourceDocument = Partial<IntakeSourceDocument> & {
  readonly id?: IntakeSourceDocumentId;
  readonly sessionId?: IntakeSessionId;
  readonly projectId?: ProjectId;
};

type StoredIntakeSourceChunk = Partial<IntakeSourceChunk> & {
  readonly id?: IntakeSourceChunkId;
  readonly sourceDocumentId?: IntakeSourceDocumentId;
};

type StoredIntakeCandidateRequirement = Partial<IntakeCandidateRequirement> & {
  readonly id?: IntakeCandidateId;
  readonly sessionId?: IntakeSessionId;
  readonly projectId?: ProjectId;
};

type StoredIntakeCandidateSourceRef = Partial<IntakeCandidateSourceRef>;

type StoredAuditEvent = Partial<AuditEvent> & {
  readonly id?: AuditEventId;
  readonly projectId?: ProjectId;
};

const EMPTY: BoardSnapshot = {
  schemaVersion: SCHEMA_VERSION,
  projects: [],
  teamMembers: [],
  milestones: [],
  deliverySlices: [],
  workflowSummaries: [],
  deliveryEvidenceSummaries: [],
  intakeSessions: [],
  intakeMessages: [],
  intakeSourceDocuments: [],
  intakeCandidates: [],
  auditEvents: [],
  cards: [],
};

const DELIVERY_SLICE_PARENT_TYPES = ['epic', 'feature', 'requirement', 'story'] as const;
const CLOSED_WORK_ITEM_STATUSES: readonly WorkItemStatus[] = ['delivered', 'rejected', 'stopped'];
const TEXT_INTAKE_SOURCE_KINDS: readonly IntakeSourceKind[] = ['text', 'markdown', 'plain-text'];
const PENDING_INTAKE_SOURCE_KINDS: readonly IntakeSourceKind[] = ['image', 'word', 'pdf'];
const MAX_INTAKE_TEXT_LENGTH = 20_000;
const MAX_INTAKE_QUOTE_LENGTH = 180;

function summarizeIntakeCandidateSourceInput(candidate: IntakeCandidateRequirement): string {
  const quotes = candidate.sourceRefs
    .map((ref) => ref.quote.trim())
    .filter(Boolean);
  if (quotes.length === 0) return '';
  return quotes
    .slice(0, 3)
    .map((quote) => quote.length > MAX_INTAKE_QUOTE_LENGTH
      ? `${quote.slice(0, MAX_INTAKE_QUOTE_LENGTH - 3)}...`
      : quote)
    .join('\n');
}

function intakeCandidateDecompositionReason(candidate: IntakeCandidateRequirement): string {
  const parentText = candidate.parentCandidateId === null
    ? '作为根级候选需求批准生成'
    : `由父候选需求 ${candidate.parentCandidateId} 拆分生成`;
  return `${parentText}，保留 ${String(candidate.sourceRefs.length)} 条来源引用，置信度 ${String(Math.round(candidate.confidence * 100))}%。`;
}

function formatTransitionError(
  error: WorkItemError | { readonly kind: 'forbidden_transition'; readonly from: WorkItemStatus; readonly to: WorkItemStatus },
): string {
  switch (error.kind) {
    case 'forbidden_transition':
      return `forbidden transition: ${error.from} → ${error.to}`;
    case 'missing_acceptance_for_requirement':
      return `requirement ${error.id} cannot leave inbox without acceptance`;
    case 'missing_analysis_for_ready':
      return `card ${error.id} cannot become ready without analysis`;
    case 'missing_design_for_ready':
      return `card ${error.id} cannot become ready without design`;
    case 'missing_milestone_for_ready':
      return `card ${error.id} cannot become ready without a milestone`;
    case 'blocked_work_items_for_ready':
      return `card ${error.id} cannot become ready while blockers are open`;
    case 'missing_executed_evidence_for_done':
      return `work item ${error.id} cannot be delivered without executed evidence`;
    case 'missing_review_for_done':
      return `work item ${error.id} cannot be delivered without review evidence`;
    case 'missing_code_for_done':
      return `work item ${error.id} cannot be delivered without linked code`;
    case 'unfinished_children_for_done':
      return `work item ${error.id} cannot be delivered while child work is unfinished`;
    case 'not_ready_for_development':
      return `card ${error.id} must be ready before development starts`;
    case 'missing_title':
      return `card ${error.id} is missing a title`;
    case 'missing_body':
      return `card ${error.id} is missing a body`;
    case 'cycle_in_parent_chain':
      return `card ${error.id} parent chain cycles`;
    case 'invalid_parent_type':
      return `${error.childType} ${error.id} cannot use ${error.parentType} ${error.parentId} as parent`;
    case 'cross_project_parent':
      return `card ${error.id} cannot use parent ${error.parentId} from another project`;
    default: {
      const _never: never = error;
      return `transition rejected: ${JSON.stringify(_never)}`;
    }
  }
}

export function boardFilePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'board.json');
}

function sortByOrder(items: readonly WorkItem[]): WorkItem[] {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

function matchesOne<T>(actual: T, expected: T | readonly T[] | undefined): boolean {
  if (expected === undefined) return true;
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

function matchesFilter(item: WorkItem, filter: WorkItemFilter): boolean {
  if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
  if (Object.hasOwn(filter, 'parentId') && item.parentId !== filter.parentId) return false;
  if (Object.hasOwn(filter, 'milestoneId') && item.milestoneId !== filter.milestoneId) return false;
  if (!matchesOne(item.type, filter.type)) return false;
  if (!matchesOne(item.status, filter.status)) return false;
  if (filter.assignee !== undefined && item.assignee !== filter.assignee) return false;
  if (
    Object.hasOwn(filter, 'claimedRoleId') &&
    item.claimedRoleId !== filter.claimedRoleId
  ) {
    return false;
  }
  if (filter.includeArchived !== true && item.archivedAt !== null) return false;
  return true;
}

function matchesMilestoneFilter(item: Milestone, filter: MilestoneFilter): boolean {
  if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
  if (!matchesOne(item.status, filter.status)) return false;
  return true;
}

function matchesTeamMemberFilter(item: TeamMember, filter: TeamMemberFilter): boolean {
  if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
  if (!matchesOne(item.memberType, filter.memberType)) return false;
  if (!matchesOne(item.status, filter.status)) return false;
  if (filter.roleId !== undefined && !item.roleIds.includes(filter.roleId)) return false;
  return true;
}

function matchesMilestoneDeliverySliceFilter(
  item: MilestoneDeliverySlice,
  filter: MilestoneDeliverySliceFilter,
): boolean {
  if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
  if (filter.parentWorkItemId !== undefined && item.parentWorkItemId !== filter.parentWorkItemId) return false;
  if (filter.milestoneId !== undefined && item.milestoneId !== filter.milestoneId) return false;
  if (!matchesOne(item.status, filter.status)) return false;
  return true;
}

function matchesWorkflowBoardSummaryFilter(
  item: WorkflowBoardSummary,
  filter: WorkflowBoardSummaryFilter,
): boolean {
  if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
  if (filter.workItemId !== undefined && item.workItemId !== filter.workItemId) return false;
  if (!matchesOne(item.runStatus, filter.runStatus)) return false;
  return true;
}

function matchesDeliveryEvidenceSummaryFilter(
  item: DeliveryEvidenceSummary,
  filter: DeliveryEvidenceSummaryFilter,
): boolean {
  if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
  if (filter.workItemId !== undefined && item.workItemId !== filter.workItemId) return false;
  return true;
}

function matchesIntakeSessionFilter(item: IntakeSession, filter: IntakeSessionFilter): boolean {
  if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
  if (!matchesOne(item.status, filter.status)) return false;
  return true;
}

function matchesIntakeCandidateFilter(
  item: IntakeCandidateRequirement,
  filter: IntakeCandidateFilter,
): boolean {
  if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
  if (filter.sessionId !== undefined && item.sessionId !== filter.sessionId) return false;
  if (!matchesOne(item.status, filter.status)) return false;
  return true;
}

function validateMilestoneDates(input: {
  readonly startDate?: number | null;
  readonly dueDate?: number | null;
}): void {
  if (
    input.startDate !== undefined &&
    input.startDate !== null &&
    (!Number.isFinite(input.startDate) || input.startDate < 0)
  ) {
    throw new Error('milestone startDate must be a positive timestamp');
  }
  if (
    input.dueDate !== undefined &&
    input.dueDate !== null &&
    (!Number.isFinite(input.dueDate) || input.dueDate < 0)
  ) {
    throw new Error('milestone dueDate must be a positive timestamp');
  }
  if (
    input.startDate !== undefined &&
    input.startDate !== null &&
    input.dueDate !== undefined &&
    input.dueDate !== null &&
    input.startDate > input.dueDate
  ) {
    throw new Error('milestone startDate cannot be after dueDate');
  }
}

function normalizeAcceptance(
  id: WorkItemId,
  input: {
    readonly acceptance?: readonly string[];
    readonly acceptanceCriteria?: readonly AcceptanceCriterion[];
  },
): Pick<WorkItem, 'acceptance' | 'acceptanceCriteria'> {
  if (input.acceptanceCriteria !== undefined) {
    const acceptanceCriteria = [...input.acceptanceCriteria];
    return {
      acceptance: input.acceptance ? [...input.acceptance] : acceptanceCriteria.map((item) => item.text),
      acceptanceCriteria,
    };
  }
  const acceptance = input.acceptance ? [...input.acceptance] : [];
  return {
    acceptance,
    acceptanceCriteria: acceptance.map((text, index) => ({
      id: `${id}:ac-${index + 1}` as AcceptanceCriterionId,
      text,
    })),
  };
}

function normalizeAcceptanceUpdate(
  id: WorkItemId,
  existing: Pick<WorkItem, 'acceptance' | 'acceptanceCriteria'>,
  input: {
    readonly acceptance?: readonly string[];
    readonly acceptanceCriteria?: readonly AcceptanceCriterion[];
  },
): Pick<WorkItem, 'acceptance' | 'acceptanceCriteria'> {
  if (input.acceptance === undefined && input.acceptanceCriteria === undefined) return existing;
  return normalizeAcceptance(id, input);
}

function groupKey(item: WorkItem, groupBy: BoardGroupBy): string {
  switch (groupBy) {
    case 'status':
      return item.status;
    case 'parent':
      return item.parentId ?? 'root';
    case 'milestone':
      return item.milestoneId ?? 'no-milestone';
    case 'type':
      return item.type;
    case 'assignee':
      return item.assignee || 'unassigned';
    case 'claimedRole':
      return item.claimedRoleId ?? 'unclaimed';
    default: {
      const _never: never = groupBy;
      return _never;
    }
  }
}

function percentDelivered(total: number, delivered: number): number {
  if (total === 0) return 0;
  return Math.round((delivered / total) * 100);
}

function isOpenWorkItem(item: WorkItem): boolean {
  return !CLOSED_WORK_ITEM_STATUSES.includes(item.status);
}

function priorityScore(priority: WorkItemPriority | null): number {
  switch (priority) {
    case 'p0':
      return 0;
    case 'p1':
      return 1;
    case 'p2':
      return 2;
    case 'p3':
      return 3;
    case null:
      return 4;
    default: {
      const _never: never = priority;
      return _never;
    }
  }
}

function compareStoryQueueItems(left: WorkItem, right: WorkItem): number {
  const priority = priorityScore(left.priority) - priorityScore(right.priority);
  if (priority !== 0) return priority;
  const leftDue = left.dueDate ?? Number.MAX_SAFE_INTEGER;
  const rightDue = right.dueDate ?? Number.MAX_SAFE_INTEGER;
  if (leftDue !== rightDue) return leftDue - rightDue;
  return left.sortOrder - right.sortOrder;
}

function isActiveWorkflowRun(status: WorkflowRunStatus): boolean {
  return ['queued', 'running', 'waiting', 'blocked', 'in_review', 'verifying'].includes(status);
}

function defaultNextActionForStatus(status: WorkItemStatus): string {
  switch (status) {
    case 'inbox':
      return 'Triage requirement';
    case 'analyzing':
      return 'Complete analysis';
    case 'designing':
      return 'Complete design';
    case 'triaged':
      return 'Prioritize and plan';
    case 'planned':
      return 'Check readiness';
    case 'ready':
      return 'Start delivery';
    case 'in_progress':
      return 'Continue implementation';
    case 'in_review':
      return 'Complete review';
    case 'verifying':
      return 'Attach verification evidence';
    case 'gates_passing':
      return 'Evaluate delivery gates';
    case 'delivered':
      return 'Monitor release evidence';
    case 'rejected':
      return 'No delivery action';
    case 'stopped':
      return 'No delivery action';
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function defaultWorkflowRunStatusForWorkItem(status: WorkItemStatus): WorkflowRunStatus {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'in_progress':
      return 'running';
    case 'in_review':
      return 'in_review';
    case 'verifying':
    case 'gates_passing':
      return 'verifying';
    case 'delivered':
      return 'completed';
    case 'rejected':
    case 'stopped':
      return 'cancelled';
    case 'inbox':
    case 'analyzing':
    case 'designing':
    case 'triaged':
    case 'planned':
      return 'not_started';
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function defaultWorkflowControlsForStatus(status: WorkItemStatus): readonly WorkflowBoardControl[] {
  if (CLOSED_WORK_ITEM_STATUSES.includes(status)) return [];
  if (['in_progress', 'in_review', 'verifying', 'gates_passing'].includes(status)) {
    return ['pause', 'cancel', 'reassign', 'retry'];
  }
  return ['resume', 'cancel', 'reassign'];
}

function deliveryCheckBlocks(check: DeliveryEvidenceCheck): boolean {
  return check.required && ['missing', 'failing', 'blocked'].includes(check.status);
}

function deliveryCheckPending(check: DeliveryEvidenceCheck): boolean {
  return check.required && check.status === 'pending';
}

function deliveryCheckSatisfied(check: DeliveryEvidenceCheck): boolean {
  return !check.required || check.status === 'passing' || check.status === 'waived';
}

function deliveryEvidenceWarningCode(check: DeliveryEvidenceCheck): string {
  const suffix = check.status === 'pending' ? 'pending' : 'missing';
  return `${suffix}_${check.area}_evidence`;
}

function riskAcceptanceOpen(item: DeliveryRiskAcceptance): boolean {
  return item.status === 'requested' || item.status === 'expired';
}

function obligationUnapproved(item: GovernanceObligationSummary): boolean {
  return item.status === 'draft' || item.status === 'pending_review';
}

function migrateSnapshot(parsed: StoredBoardSnapshot): BoardSnapshot {
  const schemaVersion = parsed.schemaVersion ?? 1;
  if (schemaVersion > SCHEMA_VERSION) {
    throw new Error(`unsupported board schema ${String(schemaVersion)}`);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    projects: (parsed.projects ?? []).map(normalizeStoredProject),
    teamMembers: parsed.teamMembers ?? [],
    milestones: parsed.milestones ?? [],
    deliverySlices: (parsed.deliverySlices ?? []).map(normalizeStoredMilestoneDeliverySlice),
    workflowSummaries: (parsed.workflowSummaries ?? []).map(normalizeStoredWorkflowBoardSummary),
    deliveryEvidenceSummaries: (parsed.deliveryEvidenceSummaries ?? []).map(normalizeStoredDeliveryEvidenceSummary),
    intakeSessions: (parsed.intakeSessions ?? []).map(normalizeStoredIntakeSession),
    intakeMessages: (parsed.intakeMessages ?? []).map(normalizeStoredIntakeMessage),
    intakeSourceDocuments: (parsed.intakeSourceDocuments ?? []).map(normalizeStoredIntakeSourceDocument),
    intakeCandidates: (parsed.intakeCandidates ?? []).map(normalizeStoredIntakeCandidateRequirement),
    auditEvents: (parsed.auditEvents ?? []).map(normalizeStoredAuditEvent),
    cards: (parsed.cards ?? []).map(normalizeStoredCard),
  };
}

function normalizeStoredCard(card: StoredCard): Card {
  if (card.id === undefined) throw new Error('board card is missing an id');
  if (card.projectId === undefined) throw new Error(`card ${card.id} is missing a projectId`);
  return {
    id: card.id,
    projectId: card.projectId,
    title: card.title ?? '',
    body: card.body ?? '',
    analysis: card.analysis ?? '',
    design: card.design ?? '',
    sourceInput: card.sourceInput ?? '',
    decompositionReason: card.decompositionReason ?? '',
    type: card.type ?? 'requirement',
    status: card.status ?? card.stateGroup ?? 'inbox',
    priority: card.priority ?? null,
    estimate: card.estimate ?? null,
    assignee: card.assignee ?? '',
    parentId: card.parentId ?? null,
    milestoneId: card.milestoneId ?? null,
    startDate: card.startDate ?? null,
    dueDate: card.dueDate ?? null,
    acceptance: card.acceptance ?? [],
    acceptanceCriteria: card.acceptanceCriteria ?? [],
    coversAcceptanceIds: card.coversAcceptanceIds ?? [],
    dependencyIds: card.dependencyIds ?? [],
    blockedByIds: card.blockedByIds ?? [],
    evidence: card.evidence ?? [],
    sourceRequirementId: card.sourceRequirementId ?? null,
    sortOrder: card.sortOrder ?? 0,
    claimedRoleId: card.claimedRoleId ?? null,
    claimedBy: card.claimedBy ?? null,
    claimedAt: card.claimedAt ?? null,
    reviewerIds: (card.reviewerIds ?? []) as TeamMemberId[],
    approverIds: (card.approverIds ?? []) as TeamMemberId[],
    watcherIds: (card.watcherIds ?? []) as TeamMemberId[],
    wipResources: normalizeWipResources(card.wipResources),
    methodId: card.methodId ?? null,
    rankingInputs: normalizeRankingInputs(card.rankingInputs),
    rankingOverride: normalizeRankingOverride(card.rankingOverride),
    requiredSkillPackIds: normalizeSkillPackIds(card.requiredSkillPackIds),
    archivedAt: card.archivedAt ?? null,
  };
}

function normalizeStoredProject(project: Project): Project {
  return {
    ...project,
    wipPolicies: (project.wipPolicies ?? []).map(normalizeWipPolicy),
    deliveryPolicy: normalizeDeliveryPolicy(project.deliveryPolicy),
    enabledMethodIds: project.enabledMethodIds ?? ['user-story'],
    prioritizationMethodId: project.prioritizationMethodId ?? null,
    enabledAgentIds: normalizeEnabledAgentIds(project.enabledAgentIds, false),
    agentCustomizations: (project.agentCustomizations ?? []).map(normalizeAgentCustomization),
    archivedAt: project.archivedAt ?? null,
  };
}

function normalizeSkillPackIds(ids: readonly string[] | undefined): string[] {
  const list = [...(ids ?? [])];
  for (const id of list) {
    if (!isTechnologyPackId(id)) throw new Error(`unknown skill pack: ${id}`);
  }
  return list;
}

function normalizeEnabledAgentIds(ids: readonly string[] | undefined, strict: boolean): string[] {
  if (ids === undefined) return [...DEFAULT_ENABLED_AGENT_IDS];
  const selected = [...new Set(ids.map(requireAgentId))];
  for (const id of DEFAULT_ENABLED_AGENT_IDS) {
    if (!selected.includes(id)) {
      if (strict) throw new Error(`cannot disable coding agent: ${id}`);
      selected.push(id);
    }
  }
  const coding = DEFAULT_ENABLED_AGENT_IDS.filter((id) => selected.includes(id));
  const rest = selected.filter((id) => !isCodingAgentId(id));
  return [...coding, ...rest];
}

function normalizeAgentCustomization(value: AgentCustomization): AgentCustomization {
  const definition = definitionFor(requireAgentId(value.agentId));
  if (definition === undefined) throw new Error(`unknown agent: ${value.agentId}`);
  const applied = applyAgentCustomization(definition, value);
  return {
    agentId: definition.id,
    ...(value.allowedToolIds !== undefined ? { allowedToolIds: [...applied.allowedToolIds] } : {}),
    ...(value.requiredSkillIds !== undefined ? { requiredSkillIds: [...applied.requiredSkillIds] } : {}),
  };
}

function normalizeDeliveryPolicy(policy: ProjectDeliveryPolicy | undefined): ProjectDeliveryPolicy {
  if (policy === undefined) return DEFAULT_DELIVERY_POLICY;
  return resolveDeliveryPolicy({
    readyChecks: (policy.readyChecks ?? []).filter((item): item is ReadyCheckKind =>
      (READY_CHECK_KINDS as readonly string[]).includes(item),
    ),
    doneChecks: (policy.doneChecks ?? []).filter((item): item is DoneCheckKind =>
      (DONE_CHECK_KINDS as readonly string[]).includes(item),
    ),
  });
}

function normalizeWipPolicy(policy: TeamWipPolicy): TeamWipPolicy {
  return {
    id: policy.id,
    kind: policy.kind,
    scope: policy.scope,
    scopeId: policy.scopeId,
    limit: policy.limit,
  };
}

function normalizeWipResources(value: readonly WorkItemWipResource[] | undefined): readonly WorkItemWipResource[] {
  return (value ?? []).flatMap((resource) => {
    if (!WIP_RESOURCE_KINDS.includes(resource.kind) || resource.id.trim() === '') return [];
    return [{ kind: resource.kind, id: resource.id.trim() }];
  });
}

function wipPolicyWarningCode(policy: TeamWipPolicy): string {
  if (policy.kind === 'work-item' && policy.scope === 'role') return 'role_over_wip_limit';
  if (policy.kind === 'work-item' && policy.scope === 'member-type') return 'member_type_over_wip_limit';
  if (policy.kind === 'repository') return 'repository_over_wip_limit';
  if (policy.kind === 'ci') return 'ci_over_wip_limit';
  if (policy.kind === 'environment') return 'environment_over_wip_limit';
  if (policy.kind === 'review') return 'review_over_wip_limit';
  return 'wip_policy_exceeded';
}

function normalizeStoredWorkflowBoardSummary(
  summary: StoredWorkflowBoardSummary,
): WorkflowBoardSummary {
  if (summary.id === undefined) throw new Error('workflow board summary is missing an id');
  if (summary.projectId === undefined) {
    throw new Error(`workflow board summary ${summary.id} is missing a projectId`);
  }
  if (summary.workItemId === undefined) {
    throw new Error(`workflow board summary ${summary.id} is missing a workItemId`);
  }
  return {
    id: summary.id,
    projectId: summary.projectId,
    workItemId: summary.workItemId,
    workflowRunId: summary.workflowRunId ?? null,
    workflowTemplateVersion: summary.workflowTemplateVersion ?? '',
    stage: summary.stage ?? 'inbox',
    runStatus: summary.runStatus ?? 'not_started',
    activeOwner: summary.activeOwner ?? null,
    activeRoleId: summary.activeRoleId ?? null,
    nextAction: summary.nextAction ?? '',
    downstreamImpact: summary.downstreamImpact ?? '',
    schedulerReason: summary.schedulerReason ?? '',
    runningSteps: summary.runningSteps ?? [],
    blockedSteps: summary.blockedSteps ?? [],
    waitingApprovals: summary.waitingApprovals ?? [],
    waitingReviews: summary.waitingReviews ?? [],
    failedChecks: summary.failedChecks ?? [],
    controls: summary.controls ?? [],
    links: summary.links ?? [],
    updatedAt: summary.updatedAt ?? 0,
  };
}

function normalizeStoredDeliveryEvidenceSummary(
  summary: StoredDeliveryEvidenceSummary,
): DeliveryEvidenceSummary {
  if (summary.id === undefined) throw new Error('delivery evidence summary is missing an id');
  if (summary.projectId === undefined) {
    throw new Error(`delivery evidence summary ${summary.id} is missing a projectId`);
  }
  if (summary.workItemId === undefined) {
    throw new Error(`delivery evidence summary ${summary.id} is missing a workItemId`);
  }
  return {
    id: summary.id,
    projectId: summary.projectId,
    workItemId: summary.workItemId,
    codeLinks: summary.codeLinks ?? [],
    pullRequests: summary.pullRequests ?? [],
    reviewLinks: summary.reviewLinks ?? [],
    ciRuns: summary.ciRuns ?? [],
    deploymentLinks: summary.deploymentLinks ?? [],
    evidenceLinks: summary.evidenceLinks ?? [],
    checks: (summary.checks ?? []).map(normalizeStoredDeliveryEvidenceCheck),
    obligations: summary.obligations ?? [],
    riskAcceptances: summary.riskAcceptances ?? [],
    provenanceLinks: summary.provenanceLinks ?? [],
    notes: summary.notes ?? '',
    designRevision: summary.designRevision ?? '',
    updatedAt: summary.updatedAt ?? 0,
  };
}

function normalizeStoredDeliveryEvidenceCheck(check: DeliveryEvidenceCheck): DeliveryEvidenceCheck {
  const producer = resolveEvidenceProducer(check.producer);
  return {
    ...check,
    evidenceIds: check.evidenceIds ?? [],
    acceptanceCriterionIds: check.acceptanceCriterionIds ?? [],
    links: check.links ?? [],
    producer,
    executionKind: resolveEvidenceExecutionKind(check.executionKind, producer),
    designRevision: check.designRevision ?? '',
  };
}

function normalizeStoredMilestoneDeliverySlice(
  slice: StoredMilestoneDeliverySlice,
): MilestoneDeliverySlice {
  if (slice.id === undefined) throw new Error('milestone delivery slice is missing an id');
  if (slice.projectId === undefined) throw new Error(`milestone delivery slice ${slice.id} is missing a projectId`);
  if (slice.parentWorkItemId === undefined) {
    throw new Error(`milestone delivery slice ${slice.id} is missing a parentWorkItemId`);
  }
  if (slice.milestoneId === undefined) {
    throw new Error(`milestone delivery slice ${slice.id} is missing a milestoneId`);
  }
  return {
    id: slice.id,
    projectId: slice.projectId,
    parentWorkItemId: slice.parentWorkItemId,
    milestoneId: slice.milestoneId,
    title: slice.title ?? '',
    scope: slice.scope ?? '',
    acceptanceCriterionIds: slice.acceptanceCriterionIds ?? [],
    expectedEvidence: slice.expectedEvidence ?? [],
    targetStatus: slice.targetStatus ?? 'delivered',
    owner: slice.owner ?? '',
    status: slice.status ?? 'planned',
    createdAt: slice.createdAt ?? 0,
    updatedAt: slice.updatedAt ?? slice.createdAt ?? 0,
  };
}

function normalizeStoredIntakeSession(session: StoredIntakeSession): IntakeSession {
  if (session.id === undefined) throw new Error('intake session is missing an id');
  if (session.projectId === undefined) throw new Error(`intake session ${session.id} is missing a projectId`);
  const status = session.status ?? 'collecting';
  if (!INTAKE_SESSION_STATUSES.includes(status)) throw new Error(`invalid intake session status: ${status}`);
  return {
    id: session.id,
    projectId: session.projectId,
    title: session.title ?? '',
    status,
    sourceChannel: session.sourceChannel ?? '',
    submitter: session.submitter ?? '',
    messageIds: session.messageIds ?? [],
    sourceDocumentIds: session.sourceDocumentIds ?? [],
    candidateIds: session.candidateIds ?? [],
    analysisStatus: session.analysisStatus ?? '',
    createdAt: session.createdAt ?? 0,
    updatedAt: session.updatedAt ?? session.createdAt ?? 0,
  };
}

function normalizeStoredIntakeMessage(message: StoredIntakeMessage): IntakeMessage {
  if (message.id === undefined) throw new Error('intake message is missing an id');
  if (message.sessionId === undefined) throw new Error(`intake message ${message.id} is missing a sessionId`);
  if (message.projectId === undefined) throw new Error(`intake message ${message.id} is missing a projectId`);
  const role = message.role ?? 'user';
  if (!INTAKE_MESSAGE_ROLES.includes(role)) throw new Error(`invalid intake message role: ${role}`);
  const kind = message.kind ?? 'chat';
  if (!INTAKE_MESSAGE_KINDS.includes(kind)) throw new Error(`invalid intake message kind: ${kind}`);
  const field = message.field ?? null;
  if (field !== null && !isMktFollowUpField(field)) throw new Error(`invalid intake follow-up field: ${field}`);
  return {
    id: message.id,
    sessionId: message.sessionId,
    projectId: message.projectId,
    role,
    author: message.author ?? '',
    body: message.body ?? '',
    kind,
    field,
    sourceDocumentIds: message.sourceDocumentIds ?? [],
    createdAt: message.createdAt ?? 0,
  };
}

function normalizeStoredIntakeSourceDocument(
  source: StoredIntakeSourceDocument,
): IntakeSourceDocument {
  if (source.id === undefined) throw new Error('intake source document is missing an id');
  if (source.sessionId === undefined) {
    throw new Error(`intake source document ${source.id} is missing a sessionId`);
  }
  if (source.projectId === undefined) {
    throw new Error(`intake source document ${source.id} is missing a projectId`);
  }
  const id = source.id;
  const kind = source.kind ?? 'file';
  if (!INTAKE_SOURCE_KINDS.includes(kind)) throw new Error(`invalid intake source kind: ${kind}`);
  const parseStatus = source.parseStatus ?? 'pending';
  if (!INTAKE_SOURCE_PARSE_STATUSES.includes(parseStatus)) {
    throw new Error(`invalid intake source parseStatus: ${parseStatus}`);
  }
  return {
    id,
    sessionId: source.sessionId,
    projectId: source.projectId,
    kind,
    name: source.name ?? '',
    mimeType: source.mimeType ?? '',
    size: source.size ?? 0,
    parseStatus,
    parseError: source.parseError ?? '',
    extractedText: source.extractedText ?? '',
    storedFileId: source.storedFileId ?? null,
    chunks: (source.chunks ?? []).map((chunk, index) =>
      normalizeStoredIntakeSourceChunk(id, chunk, index),
    ),
    createdAt: source.createdAt ?? 0,
  };
}

function normalizeStoredIntakeSourceChunk(
  sourceDocumentId: IntakeSourceDocumentId,
  chunk: StoredIntakeSourceChunk,
  index: number,
): IntakeSourceChunk {
  return {
    id: chunk.id ?? `${sourceDocumentId}:chunk-${String(index + 1)}` as IntakeSourceChunkId,
    sourceDocumentId,
    index: chunk.index ?? index,
    text: chunk.text ?? '',
  };
}

function stringList(value: readonly string[] | undefined): readonly string[] {
  return value ?? [];
}

function normalizeStoredIntakeCandidateRequirement(
  candidate: StoredIntakeCandidateRequirement,
): IntakeCandidateRequirement {
  if (candidate.id === undefined) throw new Error('intake candidate is missing an id');
  if (candidate.sessionId === undefined) throw new Error(`intake candidate ${candidate.id} is missing a sessionId`);
  if (candidate.projectId === undefined) throw new Error(`intake candidate ${candidate.id} is missing a projectId`);
  const type = candidate.type ?? 'story';
  if (!INTAKE_CANDIDATE_TYPES.includes(type)) throw new Error(`invalid intake candidate type: ${type}`);
  const status = candidate.status ?? 'draft';
  if (!INTAKE_CANDIDATE_STATUSES.includes(status)) throw new Error(`invalid intake candidate status: ${status}`);
  return {
    id: candidate.id,
    sessionId: candidate.sessionId,
    projectId: candidate.projectId,
    type,
    title: candidate.title ?? '',
    body: candidate.body ?? '',
    analysis: candidate.analysis ?? '',
    design: candidate.design ?? '',
    acceptance: candidate.acceptance ?? [],
    parentCandidateId: candidate.parentCandidateId ?? null,
    milestoneId: candidate.milestoneId ?? null,
    sourceRefs: (candidate.sourceRefs ?? []).map(normalizeStoredIntakeCandidateSourceRef),
    confidence: normalizeConfidence(candidate.confidence ?? 0.5),
    openQuestions: candidate.openQuestions ?? [],
    goals: stringList(candidate.goals),
    actors: stringList(candidate.actors),
    scenarios: stringList(candidate.scenarios),
    constraints: stringList(candidate.constraints),
    risks: stringList(candidate.risks),
    assumptions: stringList(candidate.assumptions),
    status,
    workItemId: candidate.workItemId ?? null,
    createdAt: candidate.createdAt ?? 0,
    updatedAt: candidate.updatedAt ?? candidate.createdAt ?? 0,
  };
}

function normalizeStoredIntakeCandidateSourceRef(
  ref: StoredIntakeCandidateSourceRef,
): IntakeCandidateSourceRef {
  return {
    sourceDocumentId: ref.sourceDocumentId ?? null,
    sourceChunkId: ref.sourceChunkId ?? null,
    messageId: ref.messageId ?? null,
    quote: ref.quote ?? '',
    confidence: normalizeConfidence(ref.confidence ?? 0.5),
  };
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) throw new Error('confidence must be a finite number');
  return Math.max(0, Math.min(1, value));
}

function normalizeStoredAuditEvent(event: StoredAuditEvent): AuditEvent {
  if (event.id === undefined) throw new Error('audit event is missing an id');
  if (event.projectId === undefined) throw new Error(`audit event ${event.id} is missing a projectId`);
  const createdAt = event.createdAt ?? 0;
  if (!Number.isFinite(createdAt)) throw new Error(`audit event ${event.id} has invalid createdAt`);
  return {
    id: event.id,
    projectId: event.projectId,
    actorId: event.actorId ?? 'system',
    action: event.action ?? 'unknown',
    targetType: event.targetType ?? 'unknown',
    targetId: event.targetId ?? '',
    targetLabel: event.targetLabel ?? '',
    requestSource: event.requestSource ?? 'board-store',
    changedFields: [...new Set(event.changedFields ?? [])].sort(),
    reason: event.reason ?? '',
    correlationId: event.correlationId ?? null,
    createdAt,
  };
}

function changedInputFields(input: object): readonly string[] {
  return Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([field]) => field)
    .sort();
}

function matchesAuditEventFilter(event: AuditEvent, filter: AuditEventFilter): boolean {
  if (filter.projectId !== undefined && event.projectId !== filter.projectId) return false;
  if (filter.actorId !== undefined && event.actorId !== filter.actorId) return false;
  if (filter.targetType !== undefined && event.targetType !== filter.targetType) return false;
  if (filter.targetId !== undefined && event.targetId !== filter.targetId) return false;
  if (filter.from !== undefined && event.createdAt < filter.from) return false;
  if (filter.to !== undefined && event.createdAt > filter.to) return false;
  if (filter.action !== undefined) {
    const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
    if (!actions.includes(event.action)) return false;
  }
  return true;
}

function clampIntakeText(value: string): string {
  return value.length > MAX_INTAKE_TEXT_LENGTH ? value.slice(0, MAX_INTAKE_TEXT_LENGTH) : value;
}

function defaultIntakeParseStatus(
  kind: IntakeSourceKind,
  extractedText: string,
): IntakeSourceParseStatus {
  if (extractedText.trim().length > 0) return 'parsed';
  if (PENDING_INTAKE_SOURCE_KINDS.includes(kind)) return 'pending';
  if (TEXT_INTAKE_SOURCE_KINDS.includes(kind)) return 'failed';
  return 'unsupported';
}

function createIntakeSourceChunks(
  sourceDocumentId: IntakeSourceDocumentId,
  extractedText: string,
  chunks: readonly string[] | undefined,
): readonly IntakeSourceChunk[] {
  const texts = chunks !== undefined ? chunks : splitIntakeText(extractedText);
  return texts
    .map((text) => clampIntakeText(text).trim())
    .filter((text) => text.length > 0)
    .map((text, index) => ({
      id: `${sourceDocumentId}:chunk-${String(index + 1)}` as IntakeSourceChunkId,
      sourceDocumentId,
      index,
      text,
    }));
}

function splitIntakeText(text: string): readonly string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  const chunks: string[] = [];
  for (let index = 0; index < trimmed.length; index += 2_000) {
    chunks.push(trimmed.slice(index, index + 2_000));
  }
  return chunks;
}

function compactIntakeTitle(value: string, fallback: string): string {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*#\d.)]+/, '').trim())
    .find((line) => line.length > 0);
  const title = firstLine ?? fallback;
  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

function compactIntakeQuote(value: string): string {
  const quote = value.replace(/\s+/g, ' ').trim();
  return quote.length > MAX_INTAKE_QUOTE_LENGTH
    ? `${quote.slice(0, MAX_INTAKE_QUOTE_LENGTH - 3)}...`
    : quote;
}

function extractAcceptanceFromText(text: string): readonly string[] {
  const candidates = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*#\d.)]+/, '').trim())
    .filter((line) => line.length >= 6)
    .filter((line) =>
      /验收|标准|必须|需要|能够|可以|should|must|acceptance|criteria|requirement/i.test(line),
    )
    .slice(0, 5);
  if (candidates.length > 0) return candidates;
  return [
    '产品负责人可以确认需求目标和业务范围。',
    '拆分出的 Story 可以覆盖核心用户场景。',
    '交付证据可以回链到来源材料和验收标准。',
  ];
}

export interface BoardStoreOptions {
  readonly database?: DatabaseService;
  readonly intakeLlm?: IntakeLlmExtractor;
  readonly imageUnderstanding?: ImageUnderstandingAdapter;
  readonly ocr?: IntakeOcrAdapter;
  readonly intake?: IntakeConfig;
  readonly hosted?: IntakeHostedTransport;
  readonly env?: NodeJS.ProcessEnv;
}

export class BoardStore {
  private snapshot: BoardSnapshot;
  private gates: TransitionGate[] = [];
  private readonly database: DatabaseService;
  private readonly intakeLlm: IntakeLlmExtractor | undefined;
  private readonly imageUnderstanding: ImageUnderstandingAdapter | undefined;
  private readonly ocr: IntakeOcrAdapter | undefined;

  constructor(
    private readonly workspaceRoot: string,
    options: BoardStoreOptions = {},
  ) {
    this.database = options.database ?? createDatabaseService({ workspaceRoot });
    const hosted = createHostedIntakeAdapters({
      ...(options.intake !== undefined ? { config: options.intake } : {}),
      ...(options.env !== undefined ? { env: options.env } : {}),
      ...(options.hosted !== undefined ? { hosted: options.hosted } : {}),
    });
    this.intakeLlm = options.intakeLlm ?? hosted.llm;
    this.imageUnderstanding = options.imageUnderstanding;
    this.ocr = options.ocr ?? hosted.ocr;
    this.snapshot = this.read();
  }

  registerGate(gate: TransitionGate): void {
    this.gates = [...this.gates, gate];
  }

  listProjects(filter: { readonly includeArchived?: boolean } = {}): readonly Project[] {
    if (filter.includeArchived === true) return this.snapshot.projects;
    return this.snapshot.projects.filter((project) => project.archivedAt === null);
  }

  listAuditEvents(filter: AuditEventFilter = {}): readonly AuditEvent[] {
    if (filter.projectId !== undefined) this.requireProject(filter.projectId);
    if (filter.limit !== undefined && (!Number.isInteger(filter.limit) || filter.limit < 0)) {
      throw new Error('audit event limit must be a non-negative integer');
    }
    return [...this.snapshot.auditEvents]
      .filter((event) => matchesAuditEventFilter(event, filter))
      .sort((left, right) => {
        if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
        return right.id.localeCompare(left.id);
      })
      .slice(0, filter.limit ?? undefined);
  }

  recordAuditEvent(input: AuditEventCreateInput): AuditEvent {
    const event = this.appendAuditEvent(input);
    this.write();
    return event;
  }

  listMilestones(filter: MilestoneFilter = {}): readonly Milestone[] {
    return [...this.snapshot.milestones]
      .filter((item) => matchesMilestoneFilter(item, filter))
      .sort((left, right) => {
        const leftDate = left.dueDate ?? Number.MAX_SAFE_INTEGER;
        const rightDate = right.dueDate ?? Number.MAX_SAFE_INTEGER;
        if (leftDate !== rightDate) return leftDate - rightDate;
        return left.title.localeCompare(right.title);
      });
  }

  getMilestone(milestoneId: MilestoneId): Milestone | undefined {
    return this.snapshot.milestones.find((item) => item.id === milestoneId);
  }

  createMilestone(input: MilestoneCreateInput): Milestone {
    this.requireProject(input.projectId);
    if (input.title.trim().length === 0) throw new Error('milestone title is required');
    validateMilestoneDates(input);
    const milestone: Milestone = {
      id: randomUUID() as MilestoneId,
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 'planned',
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      goal: input.goal ?? '',
    };
    this.snapshot = {
      ...this.snapshot,
      milestones: [...this.snapshot.milestones, milestone],
    };
    this.appendAuditEvent({
      projectId: milestone.projectId,
      action: 'milestone.created',
      targetType: 'milestone',
      targetId: milestone.id,
      targetLabel: milestone.title,
      changedFields: ['title', 'description', 'status', 'startDate', 'dueDate', 'goal'],
    });
    this.write();
    return milestone;
  }

  updateMilestone(milestoneId: MilestoneId, input: MilestoneUpdateInput): Milestone {
    const milestone = this.requireMilestone(milestoneId);
    if (input.title !== undefined && input.title.trim().length === 0) {
      throw new Error('milestone title is required');
    }
    const next: Milestone = {
      ...milestone,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
    };
    if (!MILESTONE_STATUSES.includes(next.status)) throw new Error(`invalid milestone status: ${next.status}`);
    validateMilestoneDates(next);
    this.snapshot = {
      ...this.snapshot,
      milestones: this.snapshot.milestones.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.projectId,
      action: 'milestone.updated',
      targetType: 'milestone',
      targetId: next.id,
      targetLabel: next.title,
      changedFields: changedInputFields(input),
    });
    this.write();
    return next;
  }

  listTeamMembers(filter: TeamMemberFilter = {}): readonly TeamMember[] {
    return [...this.snapshot.teamMembers]
      .filter((item) => matchesTeamMemberFilter(item, filter))
      .sort((left, right) => {
        if (left.status !== right.status) return left.status.localeCompare(right.status);
        if (left.memberType !== right.memberType) return left.memberType.localeCompare(right.memberType);
        return left.displayName.localeCompare(right.displayName);
      });
  }

  getTeamMember(memberId: TeamMemberId): TeamMember | undefined {
    return this.snapshot.teamMembers.find((item) => item.id === memberId);
  }

  createTeamMember(input: TeamMemberCreateInput): TeamMember {
    const project = this.requireProject(input.projectId);
    this.validateTeamMemberInput(input, project);
    const now = Date.now();
    const member: TeamMember = {
      id: randomUUID() as TeamMemberId,
      projectId: input.projectId,
      displayName: input.displayName,
      memberType: input.memberType ?? 'human',
      status: input.status ?? 'active',
      roleIds: input.roleIds ? [...input.roleIds] : [],
      permissions: input.permissions ? [...input.permissions] : [],
      capabilityProfile: input.capabilityProfile ?? '',
      skillProfile: input.skillProfile ? [...input.skillProfile] : [],
      region: input.region ?? '',
      timezone: input.timezone ?? '',
      capacityUnits: input.capacityUnits ?? 1,
      concurrentWorkLimit: input.concurrentWorkLimit ?? 1,
      createdAt: now,
      updatedAt: now,
    };
    this.snapshot = {
      ...this.snapshot,
      teamMembers: [...this.snapshot.teamMembers, member],
    };
    this.appendAuditEvent({
      projectId: member.projectId,
      action: 'team_member.created',
      targetType: 'team_member',
      targetId: member.id,
      targetLabel: member.displayName,
      changedFields: [
        'displayName',
        'memberType',
        'status',
        'roleIds',
        'permissions',
        'capabilityProfile',
        'skillProfile',
        'region',
        'timezone',
        'capacityUnits',
        'concurrentWorkLimit',
      ],
    });
    this.write();
    return member;
  }

  updateTeamMember(memberId: TeamMemberId, input: TeamMemberUpdateInput): TeamMember {
    const member = this.requireTeamMember(memberId);
    const project = this.requireProject(member.projectId);
    this.validateTeamMemberInput(input, project);
    const next: TeamMember = {
      ...member,
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.memberType !== undefined ? { memberType: input.memberType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.roleIds !== undefined ? { roleIds: [...input.roleIds] } : {}),
      ...(input.permissions !== undefined ? { permissions: [...input.permissions] } : {}),
      ...(input.capabilityProfile !== undefined ? { capabilityProfile: input.capabilityProfile } : {}),
      ...(input.skillProfile !== undefined ? { skillProfile: [...input.skillProfile] } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.capacityUnits !== undefined ? { capacityUnits: input.capacityUnits } : {}),
      ...(input.concurrentWorkLimit !== undefined
        ? { concurrentWorkLimit: input.concurrentWorkLimit }
        : {}),
      updatedAt: Date.now(),
    };
    this.snapshot = {
      ...this.snapshot,
      teamMembers: this.snapshot.teamMembers.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.projectId,
      action: 'team_member.updated',
      targetType: 'team_member',
      targetId: next.id,
      targetLabel: next.displayName,
      changedFields: changedInputFields(input),
    });
    this.write();
    return next;
  }

  addTeamMemberRole(memberId: TeamMemberId, roleId: RoleId): TeamMember {
    const member = this.requireTeamMember(memberId);
    this.validateProjectRole(member.projectId, roleId);
    if (member.roleIds.includes(roleId)) {
      throw new Error(`team member ${member.id} already has role ${roleId}`);
    }
    this.appendAuditEvent({
      projectId: member.projectId,
      action: 'team_member.role_added',
      targetType: 'team_member',
      targetId: member.id,
      targetLabel: member.displayName,
      changedFields: ['roleIds'],
    });
    return this.updateTeamMember(member.id, { roleIds: [...member.roleIds, roleId] });
  }

  removeTeamMemberRole(memberId: TeamMemberId, roleId: RoleId): TeamMember {
    const member = this.requireTeamMember(memberId);
    if (!member.roleIds.includes(roleId)) {
      throw new Error(`team member ${member.id} does not have role ${roleId}`);
    }
    this.appendAuditEvent({
      projectId: member.projectId,
      action: 'team_member.role_removed',
      targetType: 'team_member',
      targetId: member.id,
      targetLabel: member.displayName,
      changedFields: ['roleIds'],
    });
    return this.updateTeamMember(member.id, { roleIds: member.roleIds.filter((id) => id !== roleId) });
  }

  addWorkItemReviewer(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem {
    return this.addWorkItemParticipant(workItemId, memberId, 'reviewerIds', 'active');
  }

  removeWorkItemReviewer(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem {
    return this.removeWorkItemParticipant(workItemId, memberId, 'reviewerIds');
  }

  addWorkItemApprover(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem {
    return this.addWorkItemParticipant(workItemId, memberId, 'approverIds', 'active');
  }

  removeWorkItemApprover(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem {
    return this.removeWorkItemParticipant(workItemId, memberId, 'approverIds');
  }

  addWorkItemWatcher(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem {
    return this.addWorkItemParticipant(workItemId, memberId, 'watcherIds');
  }

  removeWorkItemWatcher(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem {
    return this.removeWorkItemParticipant(workItemId, memberId, 'watcherIds');
  }

  replaceTeamWipPolicies(projectId: ProjectId, policies: readonly TeamWipPolicyInput[]): Project {
    const project = this.requireProject(projectId);
    const nextPolicies = policies.map((policy) => this.validateWipPolicy(project, policy));
    const next: Project = { ...project, wipPolicies: nextPolicies };
    this.snapshot = {
      ...this.snapshot,
      projects: this.snapshot.projects.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.id,
      action: 'team.wip_policies.replaced',
      targetType: 'project',
      targetId: next.id,
      targetLabel: next.name,
      changedFields: ['wipPolicies'],
    });
    this.write();
    return next;
  }

  listTeamWipPolicies(projectId: ProjectId): readonly TeamWipPolicy[] {
    return this.requireProject(projectId).wipPolicies;
  }

  assignWorkItem(workItemId: WorkItemId, input: WorkItemAssignmentInput): WorkItem {
    const card = this.requireCard(workItemId);
    const member = this.requireTeamMember(input.memberId);
    if (member.projectId !== card.projectId) {
      throw new Error(`team member ${member.id} belongs to another project`);
    }
    if (member.status !== 'active') {
      throw new Error(`team member ${member.id} is not active`);
    }
    if (input.roleId !== undefined && !member.roleIds.includes(input.roleId)) {
      throw new Error(`team member ${member.id} does not have role ${input.roleId}`);
    }
    const roleId = input.roleId ?? (member.roleIds.length === 1 ? member.roleIds[0] : undefined);
    this.assertDeveloperWorkReady(card, roleId);
    const assignedOpenItems = this.openWorkItemsAssignedTo(member.id, member.projectId)
      .filter((item) => item.id !== card.id);
    if (assignedOpenItems.length >= member.concurrentWorkLimit) {
      throw new Error(`team member ${member.id} exceeds WIP limit`);
    }
    this.assertWipPolicies(card, member, roleId, 'work-item');
    const next: Card = {
      ...card,
      assignee: member.id,
      ...(input.roleId !== undefined ? { claimedRoleId: input.roleId } : {}),
      ...(input.actorId !== undefined ? { claimedBy: input.actorId, claimedAt: Date.now() } : {}),
    };
    return this.replaceCard(next, {
      projectId: card.projectId,
      ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
      action: input.auditAction ?? 'work_item.assigned',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: [
        'assignee',
        ...(input.roleId !== undefined ? ['claimedRoleId'] : []),
        ...(input.actorId !== undefined ? ['claimedBy', 'claimedAt'] : []),
      ],
    });
  }

  getTeamCapacity(projectId: ProjectId): TeamCapacitySummary {
    this.requireProject(projectId);
    const members = this.listTeamMembers({ projectId });
    const workItems = this.listWorkItems({ projectId });
    const openItems = workItems.filter(isOpenWorkItem);
    const memberIds = new Set(members.map((item) => item.id));
    const summaries = members.map((member) => {
      const assigned = openItems.filter((item) => item.assignee === member.id);
      const warnings: string[] = [];
      const unavailable = member.status !== 'active';
      const overLimit = assigned.length > member.concurrentWorkLimit;
      if (overLimit) warnings.push('member_over_wip_limit');
      if (unavailable && assigned.length > 0) warnings.push('member_unavailable_with_work');
      return {
        member,
        assignedWorkItemIds: assigned.map((item) => item.id),
        assignedCount: assigned.length,
        blockedCount: assigned.filter((item) => item.blockedByIds.length > 0).length,
        availableSlots: Math.max(0, member.concurrentWorkLimit - assigned.length),
        overLimit,
        unavailable,
        warnings,
      };
    });
    const unassigned = openItems.filter((item) => item.assignee.trim().length === 0);
    const unknownAssignee = openItems.filter((item) =>
      item.assignee.trim().length > 0 && !memberIds.has(item.assignee as TeamMemberId),
    );
    const warnings = [
      ...(unassigned.length > 0 ? ['unassigned_work'] : []),
      ...(unknownAssignee.length > 0 ? ['unknown_assignee'] : []),
      ...summaries.flatMap((summary) => summary.warnings),
      ...this.wipPolicyWarnings(projectId, openItems),
    ];
    return {
      projectId,
      members: summaries,
      unassignedWorkItemIds: unassigned.map((item) => item.id),
      totalMembers: members.length,
      activeMembers: members.filter((member) => member.status === 'active').length,
      assignedWorkItems: summaries.reduce((total, item) => total + item.assignedCount, 0),
      unassignedWorkItems: unassigned.length,
      overloadedMembers: summaries.filter((item) => item.overLimit).length,
      unavailableMembers: summaries.filter((item) => item.unavailable).length,
      blockedAssignedWorkItems: summaries.reduce((total, item) => total + item.blockedCount, 0),
      warnings: [...new Set(warnings)],
    };
  }

  listWorkflowBoardSummaries(
    filter: WorkflowBoardSummaryFilter = {},
  ): readonly WorkflowBoardSummary[] {
    return [...this.snapshot.workflowSummaries]
      .filter((item) => matchesWorkflowBoardSummaryFilter(item, filter))
      .sort((left, right) => left.updatedAt - right.updatedAt);
  }

  getWorkflowBoardSummary(workItemId: WorkItemId): WorkflowBoardSummary {
    const item = this.requireCard(workItemId);
    return this.snapshot.workflowSummaries.find((summary) => summary.workItemId === item.id)
      ?? this.createDefaultWorkflowBoardSummary(item);
  }

  updateWorkflowBoardSummary(
    workItemId: WorkItemId,
    input: WorkflowBoardSummaryInput,
  ): WorkflowBoardSummary {
    const item = this.requireCard(workItemId);
    this.validateWorkflowBoardSummaryInput(item.projectId, input);
    const existing = this.snapshot.workflowSummaries.find((summary) => summary.workItemId === item.id)
      ?? this.createDefaultWorkflowBoardSummary(item);
    const next: WorkflowBoardSummary = {
      ...existing,
      projectId: item.projectId,
      workItemId: item.id,
      ...(input.workflowRunId !== undefined ? { workflowRunId: input.workflowRunId } : {}),
      ...(input.workflowTemplateVersion !== undefined
        ? { workflowTemplateVersion: input.workflowTemplateVersion }
        : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.runStatus !== undefined ? { runStatus: input.runStatus } : {}),
      ...(input.activeOwner !== undefined ? { activeOwner: input.activeOwner } : {}),
      ...(input.activeRoleId !== undefined ? { activeRoleId: input.activeRoleId } : {}),
      ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
      ...(input.downstreamImpact !== undefined ? { downstreamImpact: input.downstreamImpact } : {}),
      ...(input.schedulerReason !== undefined ? { schedulerReason: input.schedulerReason } : {}),
      ...(input.runningSteps !== undefined ? { runningSteps: this.copyWorkflowSteps(input.runningSteps) } : {}),
      ...(input.blockedSteps !== undefined ? { blockedSteps: this.copyWorkflowSteps(input.blockedSteps) } : {}),
      ...(input.waitingApprovals !== undefined
        ? { waitingApprovals: this.copyWorkflowWaitItems(input.waitingApprovals) }
        : {}),
      ...(input.waitingReviews !== undefined
        ? { waitingReviews: this.copyWorkflowWaitItems(input.waitingReviews) }
        : {}),
      ...(input.failedChecks !== undefined ? { failedChecks: this.copyWorkflowChecks(input.failedChecks) } : {}),
      ...(input.controls !== undefined ? { controls: [...input.controls] } : {}),
      ...(input.links !== undefined ? { links: this.copyWorkflowLinks(input.links) } : {}),
      updatedAt: Date.now(),
    };
    const exists = this.snapshot.workflowSummaries.some((summary) => summary.workItemId === item.id);
    this.snapshot = {
      ...this.snapshot,
      workflowSummaries: exists
        ? this.snapshot.workflowSummaries.map((summary) => (summary.workItemId === item.id ? next : summary))
        : [...this.snapshot.workflowSummaries, next],
    };
    this.appendAuditEvent({
      projectId: item.projectId,
      action: 'workflow_summary.updated',
      targetType: 'workflow_summary',
      targetId: item.id,
      targetLabel: item.title,
      changedFields: changedInputFields(input),
    });
    this.write();
    return next;
  }

  getStoryPriorityQueue(
    projectId: ProjectId,
    filter: StoryPriorityQueueFilter = {},
  ): StoryPriorityQueue {
    const project = this.requireProject(projectId);
    const milestoneId = Object.hasOwn(filter, 'milestoneId') ? filter.milestoneId ?? null : null;
    const stories = this.listWorkItems({
      projectId,
      type: 'story',
      ...(Object.hasOwn(filter, 'milestoneId') ? { milestoneId: filter.milestoneId ?? null } : {}),
    }).filter((item) => !CLOSED_WORK_ITEM_STATUSES.includes(item.status));
    const milestones = new Map(
      this.listMilestones({ projectId }).map((milestone) => [milestone.id, milestone] as const),
    );
    const ranked = rankStories({
      methodId: project.prioritizationMethodId,
      stories,
      milestones,
    });
    const items = ranked.map((row, index) => {
      const item = row.item;
      const workflowSummary = this.getWorkflowBoardSummary(item.id);
      const blockedReasons = this.storyBlockedReasons(item, workflowSummary);
      const ready = blockedReasons.length === 0;
      const active = isActiveWorkflowRun(workflowSummary.runStatus);
      const schedulerReason = workflowSummary.schedulerReason.trim() !== ''
        ? workflowSummary.schedulerReason
        : ready
          ? 'Story is ready for an end-to-end delivery run.'
          : `Skipped: ${blockedReasons.join(', ')}`;
      return {
        rank: index + 1,
        workItemId: item.id,
        title: item.title,
        priority: item.priority,
        status: item.status,
        milestoneId: item.milestoneId,
        ready,
        skipped: !ready,
        active,
        blockedReasons,
        schedulerReason,
        workflowSummary,
        score: row.score,
        explanation: row.explanation,
        methodId: row.methodId,
        overridden: row.overridden,
      };
    });
    return {
      projectId,
      milestoneId,
      generatedAt: Date.now(),
      methodId: project.prioritizationMethodId,
      items,
      readyStoryIds: items.filter((item) => item.ready).map((item) => item.workItemId),
      skippedStoryIds: items.filter((item) => item.skipped).map((item) => item.workItemId),
      activeStoryIds: items.filter((item) => item.active).map((item) => item.workItemId),
      warnings: [...new Set(items.flatMap((item) => item.blockedReasons))],
    };
  }

  listDeliveryEvidenceSummaries(
    filter: DeliveryEvidenceSummaryFilter = {},
  ): readonly DeliveryEvidenceSummary[] {
    return [...this.snapshot.deliveryEvidenceSummaries]
      .filter((item) => matchesDeliveryEvidenceSummaryFilter(item, filter))
      .sort((left, right) => left.updatedAt - right.updatedAt);
  }

  getDeliveryEvidenceSummary(workItemId: WorkItemId): DeliveryEvidenceSummary {
    const item = this.requireCard(workItemId);
    return this.snapshot.deliveryEvidenceSummaries.find((summary) => summary.workItemId === item.id)
      ?? this.createDefaultDeliveryEvidenceSummary(item);
  }

  updateDeliveryEvidenceSummary(
    workItemId: WorkItemId,
    input: DeliveryEvidenceSummaryInput,
  ): DeliveryEvidenceSummary {
    const item = this.requireCard(workItemId);
    this.validateDeliveryEvidenceSummaryInput(item.projectId, item, input);
    const existing = this.snapshot.deliveryEvidenceSummaries.find((summary) => summary.workItemId === item.id)
      ?? this.createDefaultDeliveryEvidenceSummary(item);
    const next: DeliveryEvidenceSummary = {
      ...existing,
      projectId: item.projectId,
      workItemId: item.id,
      ...(input.codeLinks !== undefined ? { codeLinks: this.copyDeliveryEvidenceLinks(input.codeLinks, item) } : {}),
      ...(input.pullRequests !== undefined
        ? { pullRequests: this.copyDeliveryEvidenceLinks(input.pullRequests, item) }
        : {}),
      ...(input.reviewLinks !== undefined
        ? { reviewLinks: this.copyDeliveryEvidenceLinks(input.reviewLinks, item) }
        : {}),
      ...(input.ciRuns !== undefined ? { ciRuns: this.copyDeliveryEvidenceLinks(input.ciRuns, item) } : {}),
      ...(input.deploymentLinks !== undefined
        ? { deploymentLinks: this.copyDeliveryEvidenceLinks(input.deploymentLinks, item) }
        : {}),
      ...(input.evidenceLinks !== undefined
        ? { evidenceLinks: this.copyDeliveryEvidenceLinks(input.evidenceLinks, item) }
        : {}),
      ...(input.checks !== undefined ? { checks: this.copyDeliveryEvidenceChecks(input.checks, item) } : {}),
      ...(input.obligations !== undefined
        ? { obligations: this.copyGovernanceObligations(input.obligations) }
        : {}),
      ...(input.riskAcceptances !== undefined
        ? { riskAcceptances: this.copyRiskAcceptances(input.riskAcceptances) }
        : {}),
      ...(input.provenanceLinks !== undefined
        ? { provenanceLinks: this.copyDeliveryEvidenceLinks(input.provenanceLinks, item) }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.designRevision !== undefined ? { designRevision: input.designRevision } : {}),
      updatedAt: Date.now(),
    };
    const exists = this.snapshot.deliveryEvidenceSummaries.some((summary) => summary.workItemId === item.id);
    this.snapshot = {
      ...this.snapshot,
      deliveryEvidenceSummaries: exists
        ? this.snapshot.deliveryEvidenceSummaries.map((summary) =>
          summary.workItemId === item.id ? next : summary,
        )
        : [...this.snapshot.deliveryEvidenceSummaries, next],
    };
    this.appendAuditEvent({
      projectId: item.projectId,
      action: 'delivery_evidence.updated',
      targetType: 'delivery_evidence',
      targetId: item.id,
      targetLabel: item.title,
      changedFields: changedInputFields(input),
    });
    this.write();
    return next;
  }

  getProjectDeliveryEvidenceRollup(
    projectId: ProjectId,
    filter: ProjectDeliveryEvidenceRollupFilter = {},
  ): ProjectDeliveryEvidenceRollup {
    this.requireProject(projectId);
    const workItems = this.deliveryEvidenceRollupWorkItems(projectId, filter);
    const summaries = workItems.map((item) => this.getDeliveryEvidenceSummary(item.id));
    const requiredChecks = summaries.flatMap((summary) => summary.checks.filter((check) => check.required));
    const blockedWorkItemIds = workItems
      .filter((item) => this.deliveryEvidenceBlocks(item).length > 0)
      .map((item) => item.id);
    const readyWorkItemIds = workItems
      .filter((item) => {
        const summary = this.getDeliveryEvidenceSummary(item.id);
        return summary.checks.some((check) => check.required) && summary.checks.every(deliveryCheckSatisfied);
      })
      .map((item) => item.id);
    const warnings = [
      ...summaries.flatMap((summary) =>
        summary.checks
          .filter((check) => deliveryCheckBlocks(check) || deliveryCheckPending(check))
          .map(deliveryEvidenceWarningCode),
      ),
      ...(summaries.some((summary) => summary.obligations.some(obligationUnapproved))
        ? ['compliance_review_pending']
        : []),
      ...(summaries.some((summary) => summary.riskAcceptances.some(riskAcceptanceOpen))
        ? ['risk_acceptance_open']
        : []),
    ];
    return {
      projectId,
      milestoneId: Object.hasOwn(filter, 'milestoneId') ? filter.milestoneId ?? null : null,
      generatedAt: Date.now(),
      totalWorkItems: workItems.length,
      workItemIds: workItems.map((item) => item.id),
      readyWorkItemIds,
      blockedWorkItemIds,
      workItemsWithCode: summaries.filter((summary) => summary.codeLinks.length > 0).length,
      workItemsWithPullRequests: summaries.filter((summary) => summary.pullRequests.length > 0).length,
      workItemsWithReviews: summaries.filter((summary) => summary.reviewLinks.length > 0).length,
      workItemsWithCi: summaries.filter((summary) => summary.ciRuns.length > 0).length,
      workItemsWithEvidence: summaries.filter((summary) =>
        summary.evidenceLinks.length > 0 ||
        summary.codeLinks.length > 0 ||
        summary.pullRequests.length > 0 ||
        summary.reviewLinks.length > 0 ||
        summary.ciRuns.length > 0 ||
        summary.deploymentLinks.length > 0 ||
        summary.provenanceLinks.length > 0,
      ).length,
      missingRequiredChecks: requiredChecks.filter((check) => check.status === 'missing').length,
      pendingRequiredChecks: requiredChecks.filter((check) => check.status === 'pending').length,
      failedRequiredChecks: requiredChecks.filter((check) =>
        check.status === 'failing' || check.status === 'blocked',
      ).length,
      openRiskAcceptances: summaries.reduce(
        (total, summary) => total + summary.riskAcceptances.filter(riskAcceptanceOpen).length,
        0,
      ),
      activeObligations: summaries.reduce(
        (total, summary) =>
          total + summary.obligations.filter((obligation) =>
            obligation.status === 'approved' || obligation.status === 'active',
          ).length,
        0,
      ),
      unapprovedObligations: summaries.reduce(
        (total, summary) => total + summary.obligations.filter(obligationUnapproved).length,
        0,
      ),
      warnings: [...new Set(warnings)],
    };
  }

  listIntakeSessions(filter: IntakeSessionFilter = {}): readonly IntakeSession[] {
    return [...this.snapshot.intakeSessions]
      .filter((item) => matchesIntakeSessionFilter(item, filter))
      .sort((left, right) => {
        if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
        return right.createdAt - left.createdAt;
      });
  }

  getIntakeSession(sessionId: IntakeSessionId): IntakeSession | undefined {
    return this.snapshot.intakeSessions.find((session) => session.id === sessionId);
  }

  getIntakeSessionBundle(sessionId: IntakeSessionId): IntakeSessionBundle {
    const session = this.requireIntakeSession(sessionId);
    const messages = this.sessionMessages(session);
    const sourceDocuments = this.sessionSourceDocuments(session);
    return {
      session,
      messages,
      sourceDocuments,
      candidates: this.sessionCandidates(session),
      questions: listClarifyingQuestions(messages),
      mktDraft: collectMktDraft(messages, sourceDocuments),
    };
  }

  clarifyIntakeSession(sessionId: IntakeSessionId): IntakeSessionBundle {
    const session = this.requireIntakeSession(sessionId);
    const pending = questionsToAsk(this.sessionMessages(session), this.sessionSourceDocuments(session));
    for (const question of pending) {
      this.addIntakeMessage(session.id, {
        role: 'assistant',
        author: 'mkt',
        kind: 'clarifying-question',
        field: question.field,
        body: question.prompt,
      });
    }
    return this.getIntakeSessionBundle(session.id);
  }

  answerIntakeFollowUp(sessionId: IntakeSessionId, input: IntakeFollowUpInput): IntakeSessionBundle {
    if (!isMktFollowUpField(input.field)) throw new Error(`invalid intake follow-up field: ${input.field}`);
    const value = assertFollowUpValue(input.field, input.value);
    this.addIntakeMessage(sessionId, {
      role: 'user',
      author: input.author ?? '',
      kind: 'follow-up-answer',
      field: input.field,
      body: value,
    });
    return this.clarifyIntakeSession(sessionId);
  }

  createIntakeSession(input: IntakeSessionCreateInput): IntakeSession {
    this.requireProject(input.projectId);
    this.assertNonBlank(input.title, 'intake session title');
    const now = Date.now();
    const session: IntakeSession = {
      id: randomUUID() as IntakeSessionId,
      projectId: input.projectId,
      title: input.title,
      status: 'collecting',
      sourceChannel: input.sourceChannel ?? 'web-chat',
      submitter: input.submitter ?? '',
      messageIds: [],
      sourceDocumentIds: [],
      candidateIds: [],
      analysisStatus: '',
      createdAt: now,
      updatedAt: now,
    };
    this.snapshot = {
      ...this.snapshot,
      intakeSessions: [...this.snapshot.intakeSessions, session],
    };
    this.appendAuditEvent({
      projectId: session.projectId,
      action: 'intake_session.created',
      targetType: 'intake_session',
      targetId: session.id,
      targetLabel: session.title,
      changedFields: ['title', 'sourceChannel', 'submitter', 'status'],
    });
    this.write();
    return session;
  }

  updateIntakeSession(
    sessionId: IntakeSessionId,
    input: IntakeSessionUpdateInput,
  ): IntakeSession {
    const session = this.requireIntakeSession(sessionId);
    if (input.title !== undefined) this.assertNonBlank(input.title, 'intake session title');
    if (input.status !== undefined && !INTAKE_SESSION_STATUSES.includes(input.status)) {
      throw new Error(`invalid intake session status: ${input.status}`);
    }
    const next: IntakeSession = {
      ...session,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.sourceChannel !== undefined ? { sourceChannel: input.sourceChannel } : {}),
      ...(input.submitter !== undefined ? { submitter: input.submitter } : {}),
      ...(input.analysisStatus !== undefined ? { analysisStatus: input.analysisStatus } : {}),
      updatedAt: Date.now(),
    };
    this.snapshot = {
      ...this.snapshot,
      intakeSessions: this.snapshot.intakeSessions.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.projectId,
      action: 'intake_session.updated',
      targetType: 'intake_session',
      targetId: next.id,
      targetLabel: next.title,
      changedFields: changedInputFields(input),
    });
    this.write();
    return next;
  }

  addIntakeMessage(
    sessionId: IntakeSessionId,
    input: IntakeMessageCreateInput,
  ): IntakeMessage {
    const session = this.requireIntakeSession(sessionId);
    const role = input.role ?? 'user';
    if (!INTAKE_MESSAGE_ROLES.includes(role)) throw new Error(`invalid intake message role: ${role}`);
    const sourceDocumentIds = input.sourceDocumentIds ? [...input.sourceDocumentIds] : [];
    for (const sourceDocumentId of sourceDocumentIds) {
      this.requireIntakeSourceDocumentInSession(session, sourceDocumentId);
    }
    const body = input.body ?? '';
    if (body.trim().length === 0 && sourceDocumentIds.length === 0) {
      throw new Error('intake message body or sourceDocumentIds is required');
    }
    const kind = input.kind ?? 'chat';
    if (!INTAKE_MESSAGE_KINDS.includes(kind)) throw new Error(`invalid intake message kind: ${kind}`);
    const field = input.field ?? null;
    if (field !== null && !isMktFollowUpField(field)) throw new Error(`invalid intake follow-up field: ${field}`);
    if (kind !== 'chat' && field === null) throw new Error('follow-up field is required');
    if (kind === 'clarifying-question' && role !== 'assistant') {
      throw new Error('clarifying questions must be assistant messages');
    }
    if (kind === 'follow-up-answer' && role !== 'user') {
      throw new Error('follow-up answers must be user messages');
    }
    const message: IntakeMessage = {
      id: randomUUID() as IntakeMessageId,
      sessionId: session.id,
      projectId: session.projectId,
      role,
      author: input.author ?? '',
      body,
      kind,
      field,
      sourceDocumentIds,
      createdAt: Date.now(),
    };
    const nextSession: IntakeSession = {
      ...session,
      status: session.status === 'collecting' ? 'ready_for_analysis' : session.status,
      messageIds: [...new Set([...session.messageIds, message.id])],
      sourceDocumentIds: [...new Set([...session.sourceDocumentIds, ...sourceDocumentIds])],
      updatedAt: message.createdAt,
    };
    this.snapshot = {
      ...this.snapshot,
      intakeMessages: [...this.snapshot.intakeMessages, message],
      intakeSessions: this.snapshot.intakeSessions.map((item) =>
        item.id === nextSession.id ? nextSession : item,
      ),
    };
    this.appendAuditEvent({
      projectId: message.projectId,
      actorId: message.author,
      action: 'intake_message.created',
      targetType: 'intake_message',
      targetId: message.id,
      targetLabel: session.title,
      changedFields: ['body', 'role', 'sourceDocumentIds'],
    });
    this.write();
    return message;
  }

  addIntakeSourceDocument(
    sessionId: IntakeSessionId,
    input: IntakeSourceDocumentCreateInput,
  ): IntakeSourceDocument {
    const session = this.requireIntakeSession(sessionId);
    if (!INTAKE_SOURCE_KINDS.includes(input.kind)) throw new Error(`invalid intake source kind: ${input.kind}`);
    this.assertNonBlank(input.name, 'intake source document name');
    const size = input.size ?? 0;
    if (!Number.isFinite(size) || size < 0) throw new Error('intake source document size must be a positive number');
    const extracted = extractIntakeSource({
      kind: input.kind,
      name: input.name,
      ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
      ...(input.content !== undefined ? { bytes: input.content } : {}),
      ...(input.extractedText !== undefined ? { extractedText: input.extractedText } : {}),
      ...(input.understanding !== undefined ? { understanding: input.understanding } : {}),
      ...(this.imageUnderstanding !== undefined ? { imageUnderstanding: this.imageUnderstanding } : {}),
      ...(this.ocr !== undefined ? { ocr: this.ocr } : {}),
    });
    const extractedText = clampIntakeText(extracted.text);
    const parseStatus = input.parseStatus ?? extracted.status;
    const parseError = input.parseError ?? extracted.error;
    if (!INTAKE_SOURCE_PARSE_STATUSES.includes(parseStatus)) {
      throw new Error(`invalid intake source parseStatus: ${parseStatus}`);
    }
    const id = randomUUID() as IntakeSourceDocumentId;
    const chunks = createIntakeSourceChunks(id, extractedText, input.chunks);
    let storedFileId: string | null = null;
    let storedSize = size;
    if (input.content !== undefined) {
      const mimeType = input.mimeType ?? 'text/plain';
      const stored = this.database.storeFile({
        projectId: session.projectId,
        originalFilename: input.name,
        mimeType,
        uploader: input.uploader ?? 'system',
        bytes: input.content,
        ...(extractedText.length > 0 ? { extractedText } : {}),
      });
      storedFileId = stored.id;
      storedSize = stored.size;
    }
    const sourceDocument: IntakeSourceDocument = {
      id,
      sessionId: session.id,
      projectId: session.projectId,
      kind: input.kind,
      name: input.name,
      mimeType: input.mimeType ?? '',
      size: storedSize,
      parseStatus,
      parseError,
      extractedText,
      storedFileId,
      chunks,
      createdAt: Date.now(),
    };
    const nextSession: IntakeSession = {
      ...session,
      status: session.status === 'collecting' ? 'ready_for_analysis' : session.status,
      sourceDocumentIds: [...new Set([...session.sourceDocumentIds, sourceDocument.id])],
      updatedAt: sourceDocument.createdAt,
    };
    this.snapshot = {
      ...this.snapshot,
      intakeSourceDocuments: [...this.snapshot.intakeSourceDocuments, sourceDocument],
      intakeSessions: this.snapshot.intakeSessions.map((item) =>
        item.id === nextSession.id ? nextSession : item,
      ),
    };
    this.appendAuditEvent({
      projectId: sourceDocument.projectId,
      action: 'intake_source_document.created',
      targetType: 'intake_source_document',
      targetId: sourceDocument.id,
      targetLabel: sourceDocument.name,
      changedFields: ['kind', 'name', 'mimeType', 'size', 'parseStatus', 'extractedText'],
    });
    this.write();
    return sourceDocument;
  }

  analyzeIntakeSession(sessionId: IntakeSessionId, input: IntakeAnalyzeInput = {}): IntakeSessionBundle {
    const session = this.requireIntakeSession(sessionId);
    const now = Date.now();
    const generated = this.generateIntakeCandidates(session, now, input.mode ?? 'deterministic');
    const retained = this.snapshot.intakeCandidates.filter((candidate) =>
      candidate.sessionId === session.id && candidate.status !== 'draft',
    );
    const otherCandidates = this.snapshot.intakeCandidates.filter((candidate) => candidate.sessionId !== session.id);
    const nextSession: IntakeSession = {
      ...session,
      status: 'candidates_ready',
      candidateIds: [...retained.map((candidate) => candidate.id), ...generated.map((candidate) => candidate.id)],
      analysisStatus: 'completed',
      updatedAt: now,
    };
    this.snapshot = {
      ...this.snapshot,
      intakeCandidates: [...otherCandidates, ...retained, ...generated],
      intakeSessions: this.snapshot.intakeSessions.map((item) => (item.id === nextSession.id ? nextSession : item)),
    };
    this.appendAuditEvent({
      projectId: session.projectId,
      action: 'intake_session.analyzed',
      targetType: 'intake_session',
      targetId: session.id,
      targetLabel: session.title,
      changedFields: ['status', 'analysisStatus', 'candidateIds'],
    });
    this.write();
    return this.getIntakeSessionBundle(session.id);
  }

  listIntakeCandidates(filter: IntakeCandidateFilter = {}): readonly IntakeCandidateRequirement[] {
    return [...this.snapshot.intakeCandidates]
      .filter((item) => matchesIntakeCandidateFilter(item, filter))
      .sort((left, right) => {
        const depth = this.intakeCandidateDepth(left) - this.intakeCandidateDepth(right);
        if (depth !== 0) return depth;
        return left.createdAt - right.createdAt;
      });
  }

  updateIntakeCandidate(
    candidateId: IntakeCandidateId,
    input: IntakeCandidateUpdateInput,
  ): IntakeCandidateRequirement {
    const candidate = this.requireIntakeCandidate(candidateId);
    if (input.type !== undefined && !INTAKE_CANDIDATE_TYPES.includes(input.type)) {
      throw new Error(`invalid intake candidate type: ${input.type}`);
    }
    if (input.status !== undefined && !INTAKE_CANDIDATE_STATUSES.includes(input.status)) {
      throw new Error(`invalid intake candidate status: ${input.status}`);
    }
    if (input.title !== undefined) this.assertNonBlank(input.title, 'intake candidate title');
    if (input.parentCandidateId !== undefined && input.parentCandidateId !== null) {
      this.requireIntakeCandidateInSession(candidate.sessionId, input.parentCandidateId);
    }
    if (input.milestoneId !== undefined && input.milestoneId !== null) {
      const milestone = this.requireMilestone(input.milestoneId);
      if (milestone.projectId !== candidate.projectId) {
        throw new Error(`intake candidate cannot use milestone ${milestone.id} from another project`);
      }
    }
    const next: IntakeCandidateRequirement = {
      ...candidate,
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.analysis !== undefined ? { analysis: input.analysis } : {}),
      ...(input.design !== undefined ? { design: input.design } : {}),
      ...(input.acceptance !== undefined ? { acceptance: [...input.acceptance] } : {}),
      ...(input.goals !== undefined ? { goals: [...input.goals] } : {}),
      ...(input.actors !== undefined ? { actors: [...input.actors] } : {}),
      ...(input.scenarios !== undefined ? { scenarios: [...input.scenarios] } : {}),
      ...(input.constraints !== undefined ? { constraints: [...input.constraints] } : {}),
      ...(input.risks !== undefined ? { risks: [...input.risks] } : {}),
      ...(input.assumptions !== undefined ? { assumptions: [...input.assumptions] } : {}),
      ...(input.parentCandidateId !== undefined ? { parentCandidateId: input.parentCandidateId } : {}),
      ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
      ...(input.sourceRefs !== undefined
        ? { sourceRefs: this.copyIntakeSourceRefs(candidate.sessionId, input.sourceRefs) }
        : {}),
      ...(input.confidence !== undefined ? { confidence: normalizeConfidence(input.confidence) } : {}),
      ...(input.openQuestions !== undefined ? { openQuestions: [...input.openQuestions] } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: Date.now(),
    };
    this.validateIntakeCandidateHierarchy(next);
    this.snapshot = {
      ...this.snapshot,
      intakeCandidates: this.snapshot.intakeCandidates.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.projectId,
      action: 'intake_candidate.updated',
      targetType: 'intake_candidate',
      targetId: next.id,
      targetLabel: next.title,
      changedFields: changedInputFields(input),
    });
    this.write();
    return next;
  }

  approveIntakeCandidates(
    sessionId: IntakeSessionId,
    input: IntakeApprovalInput = {},
  ): IntakeApprovalResult {
    const session = this.requireIntakeSession(sessionId);
    const candidates = this.sessionCandidates(session);
    const selectedIds = this.resolveApprovalCandidateIds(session, input.candidateIds);
    if (selectedIds.size === 0) {
      throw new Error('at least one intake candidate must be selected for approval');
    }
    const selectedCandidates = candidates.filter((candidate) => selectedIds.has(candidate.id));
    if (!selectedCandidates.some((candidate) => candidate.status !== 'rejected')) {
      throw new Error('at least one selected intake candidate must be approvable');
    }
    const workItemByCandidate = new Map<IntakeCandidateId, WorkItemId>();
    const approvedUpdates = new Map<IntakeCandidateId, WorkItemId>();
    const workItems: WorkItem[] = [];
    for (const candidate of candidates) {
      if (candidate.workItemId !== null) workItemByCandidate.set(candidate.id, candidate.workItemId);
    }
    for (const candidate of candidates.filter((item) => selectedIds.has(item.id))) {
      if (candidate.status === 'rejected') continue;
      if (candidate.workItemId !== null) {
        workItems.push(this.requireCard(candidate.workItemId));
        continue;
      }
      const parentId = candidate.parentCandidateId === null
        ? null
        : workItemByCandidate.get(candidate.parentCandidateId) ?? null;
      if (candidate.parentCandidateId !== null && parentId === null) {
        throw new Error(`intake candidate ${candidate.id} parent is not approved`);
      }
      const workItem = this.createWorkItem({
        projectId: candidate.projectId,
        type: candidate.type,
        parentId,
        milestoneId: candidate.milestoneId,
        title: candidate.title,
        body: candidate.body,
        analysis: candidate.analysis,
        design: candidate.design,
        sourceInput: summarizeIntakeCandidateSourceInput(candidate),
        decompositionReason: intakeCandidateDecompositionReason(candidate),
        acceptance: candidate.acceptance,
      });
      workItemByCandidate.set(candidate.id, workItem.id);
      approvedUpdates.set(candidate.id, workItem.id);
      workItems.push(workItem);
    }
    const updatedAt = Date.now();
    const nextCandidates = this.snapshot.intakeCandidates.map((candidate) => {
      const workItemId = approvedUpdates.get(candidate.id);
      if (workItemId === undefined) return candidate;
      return {
        ...candidate,
        status: 'approved' as IntakeCandidateStatus,
        workItemId,
        updatedAt,
      };
    });
    const sessionCandidates = nextCandidates.filter((candidate) => candidate.sessionId === session.id);
    const hasDraftCandidates = sessionCandidates.some((candidate) => candidate.status === 'draft');
    const hasApprovedCandidates = sessionCandidates.some((candidate) => candidate.status === 'approved');
    const approvalActor = input.actorId ? ` by ${input.actorId}` : '';
    const nextSession: IntakeSession = {
      ...session,
      status: hasDraftCandidates ? 'candidates_ready' : hasApprovedCandidates ? 'approved' : 'rejected',
      analysisStatus: hasDraftCandidates ? `partially approved${approvalActor}` : `approved${approvalActor}`,
      updatedAt,
    };
    this.snapshot = {
      ...this.snapshot,
      intakeCandidates: nextCandidates,
      intakeSessions: this.snapshot.intakeSessions.map((item) => (item.id === nextSession.id ? nextSession : item)),
    };
    this.appendAuditEvent({
      projectId: session.projectId,
      ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
      action: 'intake_candidates.approved',
      targetType: 'intake_session',
      targetId: session.id,
      targetLabel: session.title,
      changedFields: ['status', 'analysisStatus', 'workItemId'],
      reason: `approved ${String(workItems.length)} work item(s)`,
    });
    this.write();
    return {
      session: nextSession,
      candidates: nextCandidates.filter((candidate) => candidate.sessionId === session.id),
      workItems,
    };
  }

  listMilestoneDeliverySlices(
    filter: MilestoneDeliverySliceFilter = {},
  ): readonly MilestoneDeliverySlice[] {
    return [...this.snapshot.deliverySlices]
      .filter((item) => matchesMilestoneDeliverySliceFilter(item, filter))
      .sort((left, right) => {
        if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
        return left.title.localeCompare(right.title);
      });
  }

  createMilestoneDeliverySlice(
    input: MilestoneDeliverySliceCreateInput,
  ): MilestoneDeliverySlice {
    const parent = this.requireCard(input.parentWorkItemId);
    const milestone = this.requireMilestone(input.milestoneId);
    this.validateMilestoneDeliverySliceParent(parent);
    this.validateMilestoneDeliverySliceProject(parent, milestone);
    this.validateAcceptanceCriterionScope(parent, input.acceptanceCriterionIds ?? []);
    this.validateMilestoneDeliverySliceText(input);
    this.validateWorkItemStatus(input.targetStatus ?? 'delivered', 'targetStatus');
    this.validateWorkItemStatus(input.status ?? 'planned', 'status');

    const now = Date.now();
    const slice: MilestoneDeliverySlice = {
      id: randomUUID() as MilestoneDeliverySliceId,
      projectId: parent.projectId,
      parentWorkItemId: parent.id,
      milestoneId: milestone.id,
      title: input.title ?? `${parent.title} / ${milestone.title}`,
      scope: input.scope,
      acceptanceCriterionIds: input.acceptanceCriterionIds ? [...input.acceptanceCriterionIds] : [],
      expectedEvidence: input.expectedEvidence ? [...input.expectedEvidence] : [],
      targetStatus: input.targetStatus ?? 'delivered',
      owner: input.owner ?? '',
      status: input.status ?? 'planned',
      createdAt: now,
      updatedAt: now,
    };
    this.snapshot = {
      ...this.snapshot,
      deliverySlices: [...this.snapshot.deliverySlices, slice],
    };
    this.appendAuditEvent({
      projectId: slice.projectId,
      action: 'milestone_delivery_slice.created',
      targetType: 'milestone_delivery_slice',
      targetId: slice.id,
      targetLabel: slice.title,
      changedFields: [
        'parentWorkItemId',
        'milestoneId',
        'title',
        'scope',
        'acceptanceCriterionIds',
        'expectedEvidence',
        'targetStatus',
        'owner',
        'status',
      ],
    });
    this.write();
    return slice;
  }

  updateMilestoneDeliverySlice(
    sliceId: MilestoneDeliverySliceId,
    input: MilestoneDeliverySliceUpdateInput,
  ): MilestoneDeliverySlice {
    const slice = this.requireMilestoneDeliverySlice(sliceId);
    const parent = this.requireCard(slice.parentWorkItemId);
    const milestone = this.requireMilestone(input.milestoneId ?? slice.milestoneId);
    const acceptanceCriterionIds = input.acceptanceCriterionIds ?? slice.acceptanceCriterionIds;
    this.validateMilestoneDeliverySliceParent(parent);
    this.validateMilestoneDeliverySliceProject(parent, milestone);
    this.validateAcceptanceCriterionScope(parent, acceptanceCriterionIds);
    this.validateMilestoneDeliverySliceText({
      scope: input.scope ?? slice.scope,
      ...(input.title !== undefined ? { title: input.title } : {}),
    });
    this.validateWorkItemStatus(input.targetStatus ?? slice.targetStatus, 'targetStatus');
    this.validateWorkItemStatus(input.status ?? slice.status, 'status');

    const next: MilestoneDeliverySlice = {
      ...slice,
      ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.acceptanceCriterionIds !== undefined
        ? { acceptanceCriterionIds: [...input.acceptanceCriterionIds] }
        : {}),
      ...(input.expectedEvidence !== undefined ? { expectedEvidence: [...input.expectedEvidence] } : {}),
      ...(input.targetStatus !== undefined ? { targetStatus: input.targetStatus } : {}),
      ...(input.owner !== undefined ? { owner: input.owner } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      projectId: parent.projectId,
      updatedAt: Date.now(),
    };
    this.snapshot = {
      ...this.snapshot,
      deliverySlices: this.snapshot.deliverySlices.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.projectId,
      action: 'milestone_delivery_slice.updated',
      targetType: 'milestone_delivery_slice',
      targetId: next.id,
      targetLabel: next.title,
      changedFields: changedInputFields(input),
    });
    this.write();
    return next;
  }

  listWorkItems(filter: WorkItemFilter = {}): readonly WorkItem[] {
    return sortByOrder(this.snapshot.cards.filter((item) => matchesFilter(item, filter)));
  }

  listCards(projectId?: ProjectId): readonly Card[] {
    if (projectId === undefined) return this.listWorkItems();
    return this.listWorkItems({ projectId });
  }

  getWorkItem(workItemId: WorkItemId): WorkItem | undefined {
    return this.snapshot.cards.find((card) => card.id === workItemId);
  }

  getCard(cardId: CardId): Card | undefined {
    return this.getWorkItem(cardId);
  }

  createProject(input: { name: string; description?: string }): Project {
    const project: Project = {
      id: randomUUID() as ProjectId,
      name: input.name,
      description: input.description ?? '',
      roles: [...DEFAULT_ROLES],
      wipPolicies: [],
      deliveryPolicy: DEFAULT_DELIVERY_POLICY,
      enabledMethodIds: ['user-story'],
      prioritizationMethodId: null,
      enabledAgentIds: [...DEFAULT_ENABLED_AGENT_IDS],
      agentCustomizations: [],
      archivedAt: null,
    };
    this.snapshot = {
      ...this.snapshot,
      projects: [...this.snapshot.projects, project],
    };
    this.appendAuditEvent({
      projectId: project.id,
      action: 'project.created',
      targetType: 'project',
      targetId: project.id,
      targetLabel: project.name,
      changedFields: ['name', 'description', 'roles'],
    });
    this.write();
    return project;
  }

  updateProject(projectId: ProjectId, input: {
    readonly name?: string;
    readonly description?: string;
    readonly deliveryPolicy?: ProjectDeliveryPolicy;
    readonly enabledMethodIds?: readonly string[];
    readonly prioritizationMethodId?: string | null;
    readonly enabledAgentIds?: readonly string[];
    readonly agentCustomizations?: readonly AgentCustomization[];
  }): Project {
    const project = this.requireProject(projectId);
    if (project.archivedAt !== null) throw new Error(`project ${projectId} is archived`);
    const name = input.name !== undefined ? input.name.trim() : project.name;
    if (name.length === 0) throw new Error('project name is required');
    const prioritizationMethodId = input.prioritizationMethodId === undefined
      ? undefined
      : input.prioritizationMethodId === null
        ? null
        : requirePrioritizationMethodId(input.prioritizationMethodId);
    const next: Project = {
      ...project,
      name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.deliveryPolicy !== undefined ? { deliveryPolicy: this.requireDeliveryPolicy(input.deliveryPolicy) } : {}),
      ...(input.enabledMethodIds !== undefined ? { enabledMethodIds: [...input.enabledMethodIds] } : {}),
      ...(prioritizationMethodId !== undefined ? { prioritizationMethodId } : {}),
      ...(input.enabledAgentIds !== undefined ? { enabledAgentIds: normalizeEnabledAgentIds(input.enabledAgentIds, true) } : {}),
      ...(input.agentCustomizations !== undefined
        ? { agentCustomizations: input.agentCustomizations.map(normalizeAgentCustomization) }
        : {}),
    };
    this.snapshot = {
      ...this.snapshot,
      projects: this.snapshot.projects.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.id,
      action: 'project.updated',
      targetType: 'project',
      targetId: next.id,
      targetLabel: next.name,
      changedFields: [
        ...(input.name !== undefined ? ['name'] : []),
        ...(input.description !== undefined ? ['description'] : []),
        ...(input.deliveryPolicy !== undefined ? ['deliveryPolicy'] : []),
        ...(input.enabledMethodIds !== undefined ? ['enabledMethodIds'] : []),
        ...(input.prioritizationMethodId !== undefined ? ['prioritizationMethodId'] : []),
        ...(input.enabledAgentIds !== undefined ? ['enabledAgentIds'] : []),
        ...(input.agentCustomizations !== undefined ? ['agentCustomizations'] : []),
      ],
    });
    this.write();
    return next;
  }

  enableAgent(projectId: ProjectId, agentId: string): Project {
    const project = this.requireProject(projectId);
    const id = requireAgentId(agentId);
    if (project.enabledAgentIds.includes(id)) return project;
    return this.updateProject(projectId, { enabledAgentIds: [...project.enabledAgentIds, id] });
  }

  disableAgent(projectId: ProjectId, agentId: string): Project {
    const id = requireAgentId(agentId);
    if (isCodingAgentId(id)) throw new Error(`cannot disable coding agent: ${id}`);
    const project = this.requireProject(projectId);
    return this.updateProject(projectId, {
      enabledAgentIds: project.enabledAgentIds.filter((item) => item !== id),
    });
  }

  customizeAgent(projectId: ProjectId, agentId: string, input: {
    readonly allowedToolIds?: readonly string[];
    readonly requiredSkillIds?: readonly string[];
  }): Project {
    const project = this.requireProject(projectId);
    const id = requireAgentId(agentId);
    const nextCustomization: AgentCustomization = {
      agentId: id,
      ...(input.allowedToolIds !== undefined ? { allowedToolIds: [...input.allowedToolIds] } : {}),
      ...(input.requiredSkillIds !== undefined ? { requiredSkillIds: [...input.requiredSkillIds] } : {}),
    };
    normalizeAgentCustomization(nextCustomization);
    const others = project.agentCustomizations.filter((row) => row.agentId !== id);
    return this.updateProject(projectId, { agentCustomizations: [...others, nextCustomization] });
  }

  inspectDeliveryGates(workItemId: WorkItemId, to: WorkItemStatus): DeliveryGateInspection {
    const item = this.requireCard(workItemId);
    const policy = this.requireProject(item.projectId).deliveryPolicy;
    const missing: DeliveryGateMissing[] = [];
    const error = validateWorkItemTransition(item, to, this.doneContext(item, policy));
    if (error !== null) {
      missing.push({
        kind: error.kind === 'forbidden_transition'
          ? 'lifecycle'
          : error.kind.endsWith('_for_done')
            ? 'evidence'
            : 'field',
        code: error.kind,
        message: formatTransitionError(error),
      });
    }
    if (to === 'delivered') {
      for (const blocker of this.deliveryEvidenceBlocks(item)) {
        missing.push({
          kind: 'evidence',
          code: 'blocking_delivery_evidence',
          message: `blocking delivery evidence: ${blocker}`,
        });
      }
    }
    return {
      workItemId: item.id,
      from: item.status,
      to,
      allowed: missing.length === 0,
      missing,
      policy,
    };
  }

  archiveProject(projectId: ProjectId, actor: string): Project {
    const project = this.requireProject(projectId);
    if (project.archivedAt !== null) throw new Error(`project ${projectId} is already archived`);
    const next: Project = { ...project, archivedAt: Date.now() };
    this.snapshot = {
      ...this.snapshot,
      projects: this.snapshot.projects.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.id,
      actorId: actor,
      action: 'project.archived',
      targetType: 'project',
      targetId: next.id,
      targetLabel: next.name,
      changedFields: ['archivedAt'],
    });
    this.write();
    return next;
  }

  restoreProject(projectId: ProjectId, actor: string): Project {
    const project = this.snapshot.projects.find((item) => item.id === projectId);
    if (project === undefined) throw new Error(`project not found: ${projectId}`);
    if (project.archivedAt === null) throw new Error(`project ${projectId} is not archived`);
    const next: Project = { ...project, archivedAt: null };
    this.snapshot = {
      ...this.snapshot,
      projects: this.snapshot.projects.map((item) => (item.id === next.id ? next : item)),
    };
    this.appendAuditEvent({
      projectId: next.id,
      actorId: actor,
      action: 'project.restored',
      targetType: 'project',
      targetId: next.id,
      targetLabel: next.name,
      changedFields: ['archivedAt'],
    });
    this.write();
    return next;
  }

  archiveWorkItem(workItemId: WorkItemId, actor: string): WorkItem {
    const card = this.requireCard(workItemId);
    if (card.archivedAt !== null) throw new Error(`work item ${workItemId} is already archived`);
    return this.replaceCard({ ...card, archivedAt: Date.now() }, {
      projectId: card.projectId,
      actorId: actor,
      action: 'work_item.archived',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: ['archivedAt'],
    });
  }

  restoreWorkItem(workItemId: WorkItemId, actor: string): WorkItem {
    const card = this.snapshot.cards.find((item) => item.id === workItemId);
    if (card === undefined) throw new Error(`work item not found: ${workItemId}`);
    if (card.archivedAt === null) throw new Error(`work item ${workItemId} is not archived`);
    return this.replaceCard({ ...card, archivedAt: null }, {
      projectId: card.projectId,
      actorId: actor,
      action: 'work_item.restored',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: ['archivedAt'],
    });
  }

  createWorkItem(input: WorkItemCreateInput): WorkItem {
    const project = this.snapshot.projects.find((item) => item.id === input.projectId);
    if (!project) throw new Error(`project not found: ${input.projectId}`);
    const siblings = this.snapshot.cards.filter((card) => card.projectId === input.projectId);
    const sortOrder = siblings.reduce((max, card) => Math.max(max, card.sortOrder), 0) + 10000;
    const id = randomUUID() as WorkItemId;
    const parent = input.parentId ? this.getWorkItem(input.parentId) : undefined;
    const milestoneId = input.milestoneId !== undefined ? input.milestoneId : parent?.milestoneId ?? null;
    const acceptance = normalizeAcceptance(id, input);
    const card: Card = {
      id,
      projectId: input.projectId,
      title: input.title,
      body: input.body ?? '',
      analysis: input.analysis ?? '',
      design: input.design ?? '',
      sourceInput: input.sourceInput ?? '',
      decompositionReason: input.decompositionReason ?? '',
      type: input.type ?? 'requirement',
      status: input.status ?? input.stateGroup ?? 'inbox',
      priority: null,
      estimate: null,
      assignee: '',
      parentId: input.parentId ?? null,
      milestoneId,
      startDate: null,
      dueDate: null,
      acceptance: acceptance.acceptance,
      acceptanceCriteria: acceptance.acceptanceCriteria,
      coversAcceptanceIds: input.coversAcceptanceIds ? [...input.coversAcceptanceIds] : [],
      dependencyIds: input.dependencyIds ? [...input.dependencyIds] : [],
      blockedByIds: input.blockedByIds ? [...input.blockedByIds] : [],
      evidence: input.evidence ? [...input.evidence] : [],
      sourceRequirementId: null,
      sortOrder,
      claimedRoleId: null,
      claimedBy: null,
      claimedAt: null,
      reviewerIds: [],
      approverIds: [],
      watcherIds: [],
      wipResources: input.wipResources ? normalizeWipResources(input.wipResources) : [],
      methodId: input.methodId ?? null,
      rankingInputs: normalizeRankingInputs(input.rankingInputs),
      rankingOverride: null,
      requiredSkillPackIds: normalizeSkillPackIds(input.requiredSkillPackIds),
      archivedAt: null,
    };
    const hierarchyError = validateWorkItemHierarchy(
      card,
      (id) => this.snapshot.cards.find((item) => item.id === id) ?? null,
    );
    if (hierarchyError !== null) {
      throw new Error(formatTransitionError(hierarchyError));
    }
    this.validateMilestoneAssignment(card);
    if (card.status === 'ready') {
      const readyError = validateDefinitionOfReady(card, this.requireProject(card.projectId).deliveryPolicy);
      if (readyError !== null) {
        throw new Error(formatTransitionError(readyError));
      }
    }
    if (card.status === 'in_progress') {
      throw new Error(formatTransitionError({
        kind: 'not_ready_for_development',
        id: card.id,
        status: card.status,
      }));
    }
    this.snapshot = {
      ...this.snapshot,
      cards: [...this.snapshot.cards, card],
    };
    this.appendAuditEvent({
      projectId: card.projectId,
      action: 'work_item.created',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: [
        'title',
        'body',
        'analysis',
        'design',
        'sourceInput',
        'decompositionReason',
        'type',
        'status',
        'parentId',
        'milestoneId',
        'acceptance',
        'acceptanceCriteria',
        'coversAcceptanceIds',
        'dependencyIds',
        'blockedByIds',
        'evidence',
      ],
    });
    this.write();
    return card;
  }

  createCard(input: WorkItemCreateInput): Card {
    return this.createWorkItem(input);
  }

  updateWorkItem(workItemId: WorkItemId, input: WorkItemUpdateInput): WorkItem {
    const card = this.requireCard(workItemId);
    const acceptance = normalizeAcceptanceUpdate(card.id, card, input);
    const next: Card = {
      ...card,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.analysis !== undefined ? { analysis: input.analysis } : {}),
      ...(input.design !== undefined ? { design: input.design } : {}),
      ...(input.sourceInput !== undefined ? { sourceInput: input.sourceInput } : {}),
      ...(input.decompositionReason !== undefined ? { decompositionReason: input.decompositionReason } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.estimate !== undefined ? { estimate: input.estimate } : {}),
      ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      acceptance: acceptance.acceptance,
      acceptanceCriteria: acceptance.acceptanceCriteria,
      ...(input.coversAcceptanceIds !== undefined
        ? { coversAcceptanceIds: [...input.coversAcceptanceIds] }
        : {}),
      ...(input.dependencyIds !== undefined ? { dependencyIds: [...input.dependencyIds] } : {}),
      ...(input.blockedByIds !== undefined ? { blockedByIds: [...input.blockedByIds] } : {}),
      ...(input.evidence !== undefined ? { evidence: [...input.evidence] } : {}),
      ...(input.sourceRequirementId !== undefined
        ? { sourceRequirementId: input.sourceRequirementId }
        : {}),
      ...(input.wipResources !== undefined ? { wipResources: normalizeWipResources(input.wipResources) } : {}),
      ...(input.methodId !== undefined ? { methodId: input.methodId } : {}),
      ...(input.rankingInputs !== undefined ? { rankingInputs: normalizeRankingInputs(input.rankingInputs) } : {}),
      ...(input.rankingOverride !== undefined ? { rankingOverride: normalizeRankingOverride(input.rankingOverride) } : {}),
      ...(input.requiredSkillPackIds !== undefined ? { requiredSkillPackIds: normalizeSkillPackIds(input.requiredSkillPackIds) } : {}),
    };
    const hierarchyError = validateWorkItemHierarchy(
      next,
      (id) => this.snapshot.cards.find((item) => item.id === id) ?? null,
    );
    if (hierarchyError !== null) {
      throw new Error(formatTransitionError(hierarchyError));
    }
    this.validateMilestoneAssignment(next);
    if (next.status === 'ready' || next.status === 'in_progress') {
      const readyError = validateDefinitionOfReady(next, this.requireProject(next.projectId).deliveryPolicy);
      if (readyError !== null) {
        throw new Error(formatTransitionError(readyError));
      }
    }
    const updated = this.replaceCard(next, {
      projectId: next.projectId,
      action: 'work_item.updated',
      targetType: 'work_item',
      targetId: next.id,
      targetLabel: next.title,
      changedFields: changedInputFields(input),
    });
    if (input.milestoneId !== undefined && input.milestoneId !== card.milestoneId && card.parentId !== null) {
      const parent = this.getWorkItem(card.parentId);
      if (parent !== undefined) {
        this.appendAuditEvent({
          projectId: parent.projectId,
          action: 'parent_plan.updated',
          targetType: 'work_item',
          targetId: parent.id,
          targetLabel: parent.title,
          changedFields: ['milestoneId'],
          reason: `child ${card.id} moved from ${card.milestoneId ?? 'none'} to ${input.milestoneId ?? 'none'}`,
        });
        this.write();
      }
    }
    this.invalidateStaleDeliveryEvidence(card, updated);
    return updated;
  }

  overrideStoryRanking(workItemId: WorkItemId, input: {
    readonly rank: number;
    readonly reason: string;
    readonly actorId: string;
  }): WorkItem {
    const card = this.requireCard(workItemId);
    const reason = input.reason.trim();
    if (reason.length === 0) throw new Error('ranking override requires an audit reason');
    if (!Number.isInteger(input.rank) || input.rank < 1) {
      throw new Error('ranking override rank must be a positive integer');
    }
    const rankingOverride: RankingOverride = {
      rank: input.rank,
      reason,
      actorId: input.actorId,
      at: Date.now(),
    };
    return this.replaceCard({ ...card, rankingOverride }, {
      projectId: card.projectId,
      actorId: input.actorId,
      action: 'work_item.ranking_overridden',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: ['rankingOverride'],
      reason,
    });
  }

  clearStoryRankingOverride(workItemId: WorkItemId, input: {
    readonly reason: string;
    readonly actorId: string;
  }): WorkItem {
    const card = this.requireCard(workItemId);
    const reason = input.reason.trim();
    if (reason.length === 0) throw new Error('ranking override requires an audit reason');
    return this.replaceCard({ ...card, rankingOverride: null }, {
      projectId: card.projectId,
      actorId: input.actorId,
      action: 'work_item.ranking_override_cleared',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: ['rankingOverride'],
      reason,
    });
  }

  updateCard(cardId: CardId, input: WorkItemUpdateInput): Card {
    return this.updateWorkItem(cardId, input);
  }

  assignWorkItemToMilestone(workItemId: WorkItemId, milestoneId: MilestoneId | null): WorkItem {
    return this.updateWorkItem(workItemId, { milestoneId });
  }

  /**
   * Claim a card for a project role. Another role must unclaim first.
   * The same actor may reclaim to switch role on an already-owned card.
   */
  claimCard(cardId: CardId, input: { roleId: RoleId; actorId: string }): Card {
    const card = this.requireCard(cardId);
    const project = this.snapshot.projects.find((item) => item.id === card.projectId);
    if (!project) throw new Error(`project not found: ${card.projectId}`);
    const role = project.roles.find((item) => item.id === input.roleId);
    if (!role) throw new Error(`role not found: ${input.roleId}`);
    this.assertDeveloperWorkReady(card, input.roleId);
    if (card.claimedBy !== null && card.claimedBy !== input.actorId) {
      throw new Error(`card already claimed by ${card.claimedBy}`);
    }
    return this.replaceCard({
      ...card,
      claimedRoleId: input.roleId,
      claimedBy: input.actorId,
      claimedAt: Date.now(),
    }, {
      projectId: card.projectId,
      actorId: input.actorId,
      action: 'work_item.claimed',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: ['claimedRoleId', 'claimedBy', 'claimedAt'],
    });
  }

  claimWorkItem(workItemId: WorkItemId, input: { roleId: RoleId; actorId: string }): WorkItem {
    return this.claimCard(workItemId, input);
  }

  /**
   * The only write path for status (#52). UI and hooks must call this;
   * patching `status` on disk is ignored on the next load only if we
   * never expose a setter — callers go through this method.
   */
  transitionCard(
    cardId: CardId,
    to: WorkItemStatus,
    override?: { readonly actorId: string; readonly reason: string; readonly scope: string },
  ): Card {
    const card = this.requireCard(cardId);
    if (card.status === to) return card;
    if (override !== undefined) {
      if (isForbiddenTransition(card.status, to)) {
        throw new Error(formatTransitionError({ kind: 'forbidden_transition', from: card.status, to }));
      }
    } else {
      const policy = this.requireProject(card.projectId).deliveryPolicy;
      const error = validateWorkItemTransition(card, to, this.doneContext(card, policy));
      if (error !== null) {
        throw new Error(formatTransitionError(error));
      }
      this.assertMilestoneDeliverySlicesComplete(card, to);
      this.assertDeliveryEvidenceReady(card, to, policy);
      const gate = runTransitionGates(this.gates, card, card.status, to);
      if (!gate.ok) {
        throw new Error(`gate ${gate.id} blocked ${card.status} → ${to}: ${gate.reason}`);
      }
    }
    return this.replaceCard({ ...card, status: to }, {
      projectId: card.projectId,
      ...(override !== undefined ? { actorId: override.actorId } : {}),
      action: override !== undefined ? 'work_item.transition_overridden' : 'work_item.transitioned',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: ['status'],
      reason: override !== undefined
        ? `${card.status} -> ${to}; override ${override.scope}: ${override.reason}`
        : `${card.status} -> ${to}`,
    });
  }

  transitionWorkItem(
    workItemId: WorkItemId,
    to: WorkItemStatus,
    override?: { readonly actorId: string; readonly reason: string; readonly scope: string },
  ): WorkItem {
    return this.transitionCard(workItemId, to, override);
  }

  private assertDeveloperWorkReady(card: Card, roleId: RoleId | undefined): void {
    if (roleId !== 'developer') return;
    if (card.status !== 'ready' && card.status !== 'in_progress') {
      throw new Error(`card ${card.id} must be ready before developer can claim it`);
    }
    const readyError = validateDefinitionOfReady(card, this.requireProject(card.projectId).deliveryPolicy);
    if (readyError !== null) {
      throw new Error(formatTransitionError(readyError));
    }
  }

  unclaimCard(cardId: CardId, actorId: string): Card {
    const card = this.requireCard(cardId);
    if (card.claimedBy === null) return card;
    if (card.claimedBy !== actorId) {
      throw new Error(`only ${card.claimedBy} can unclaim this card`);
    }
    return this.replaceCard({
      ...card,
      claimedRoleId: null,
      claimedBy: null,
      claimedAt: null,
    }, {
      projectId: card.projectId,
      actorId,
      action: 'work_item.released',
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: ['claimedRoleId', 'claimedBy', 'claimedAt'],
    });
  }

  unclaimWorkItem(workItemId: WorkItemId, actorId: string): WorkItem {
    return this.unclaimCard(workItemId, actorId);
  }

  getWorkItemTree(rootId: WorkItemId): WorkItemTreeNode {
    const root = this.requireCard(rootId);
    return this.buildTree(root, new Set());
  }

  getBoardView(query: BoardViewQuery = {}): BoardView {
    const groupBy = query.groupBy ?? 'status';
    const workItems = this.listWorkItems(query);
    const groups = new Map<string, WorkItem[]>();
    if (groupBy === 'status') {
      for (const status of WORK_ITEM_STATUSES) groups.set(status, []);
    } else if (groupBy === 'claimedRole' && query.projectId !== undefined) {
      const project = this.requireProject(query.projectId);
      for (const role of project.roles) groups.set(role.id, []);
      groups.set('unclaimed', []);
    }
    for (const item of workItems) {
      const key = groupKey(item, groupBy);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const columns: BoardViewColumn[] = [...groups.entries()].map(([id, items]) => ({
      id,
      title: this.groupTitle(id, groupBy, query.projectId),
      workItems: sortByOrder(items),
    }));
    return { groupBy, columns, workItems };
  }

  getAcceptanceCoverage(rootId: WorkItemId): AcceptanceCoverageSummary {
    const root = this.requireCard(rootId);
    const criteria = root.acceptanceCriteria;
    const criterionIds = new Set(criteria.map((item) => item.id));
    const covered = new Set<AcceptanceCriterionId>();
    const coveringWorkItems = new Set<WorkItemId>();
    for (const item of this.descendantsOf(root.id, new Set())) {
      for (const criterionId of item.coversAcceptanceIds) {
        if (!criterionIds.has(criterionId)) continue;
        covered.add(criterionId);
        coveringWorkItems.add(item.id);
      }
    }
    return {
      rootId,
      totalCriteria: criterionIds.size,
      coveredCriteria: covered.size,
      uncoveredAcceptanceIds: criteria
        .map((item) => item.id)
        .filter((id) => !covered.has(id)),
      coveringWorkItemIds: [...coveringWorkItems],
      complete: criterionIds.size > 0 && criterionIds.size === covered.size,
    };
  }

  getMilestoneSummary(milestoneId: MilestoneId): MilestoneSummary {
    const milestone = this.requireMilestone(milestoneId);
    const workItems = this.listWorkItems({ milestoneId });
    const deliveredWorkItems = workItems.filter((item) => item.status === 'delivered').length;
    const blockedWorkItems = workItems.filter((item) => item.blockedByIds.length > 0).length;
    return {
      milestone,
      totalWorkItems: workItems.length,
      deliveredWorkItems,
      openWorkItems: workItems.length - deliveredWorkItems,
      blockedWorkItems,
      percentDelivered: percentDelivered(workItems.length, deliveredWorkItems),
    };
  }

  getMilestoneBoard(projectId?: ProjectId): MilestoneBoard {
    const milestones = this.listMilestones({ ...(projectId !== undefined ? { projectId } : {}) });
    const workItems = this.listWorkItems({ ...(projectId !== undefined ? { projectId } : {}) });
    const lanes: MilestoneBoardLane[] = milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      milestone,
      summary: this.getMilestoneSummary(milestone.id),
      workItems: workItems.filter((item) => item.milestoneId === milestone.id),
    }));
    const unassigned = workItems.filter((item) => item.milestoneId === null);
    return {
      projectId: projectId ?? null,
      lanes: [
        ...lanes,
        {
          id: 'no-milestone',
          title: 'No milestone',
          milestone: null,
          summary: null,
          workItems: unassigned,
        },
      ],
      workItems,
    };
  }

  private requireCard(cardId: CardId): Card {
    const card = this.getCard(cardId);
    if (!card) throw new Error(`card not found: ${cardId}`);
    return card;
  }

  private requireProject(projectId: ProjectId): Project {
    const project = this.snapshot.projects.find((item) => item.id === projectId);
    if (!project) throw new Error(`project not found: ${projectId}`);
    return project;
  }

  private requireMilestone(milestoneId: MilestoneId): Milestone {
    const milestone = this.getMilestone(milestoneId);
    if (!milestone) throw new Error(`milestone not found: ${milestoneId}`);
    return milestone;
  }

  private requireMilestoneDeliverySlice(sliceId: MilestoneDeliverySliceId): MilestoneDeliverySlice {
    const slice = this.snapshot.deliverySlices.find((item) => item.id === sliceId);
    if (!slice) throw new Error(`milestone delivery slice not found: ${sliceId}`);
    return slice;
  }

  private requireTeamMember(memberId: TeamMemberId): TeamMember {
    const member = this.getTeamMember(memberId);
    if (!member) throw new Error(`team member not found: ${memberId}`);
    return member;
  }

  private requireIntakeSession(sessionId: IntakeSessionId): IntakeSession {
    const session = this.getIntakeSession(sessionId);
    if (session === undefined) throw new Error(`intake session not found: ${sessionId}`);
    return session;
  }

  private requireIntakeCandidate(candidateId: IntakeCandidateId): IntakeCandidateRequirement {
    const candidate = this.snapshot.intakeCandidates.find((item) => item.id === candidateId);
    if (candidate === undefined) throw new Error(`intake candidate not found: ${candidateId}`);
    return candidate;
  }

  private requireIntakeCandidateInSession(
    sessionId: IntakeSessionId,
    candidateId: IntakeCandidateId,
  ): IntakeCandidateRequirement {
    const candidate = this.requireIntakeCandidate(candidateId);
    if (candidate.sessionId !== sessionId) {
      throw new Error(`intake candidate ${candidateId} belongs to another session`);
    }
    return candidate;
  }

  private requireIntakeSourceDocumentInSession(
    session: IntakeSession,
    sourceDocumentId: IntakeSourceDocumentId,
  ): IntakeSourceDocument {
    const sourceDocument = this.snapshot.intakeSourceDocuments.find((item) => item.id === sourceDocumentId);
    if (sourceDocument === undefined) {
      throw new Error(`intake source document not found: ${sourceDocumentId}`);
    }
    if (sourceDocument.sessionId !== session.id || sourceDocument.projectId !== session.projectId) {
      throw new Error(`intake source document ${sourceDocumentId} belongs to another session`);
    }
    return sourceDocument;
  }

  private sessionMessages(session: IntakeSession): readonly IntakeMessage[] {
    const order = new Map(session.messageIds.map((id, index) => [id, index]));
    return this.snapshot.intakeMessages
      .filter((message) => message.sessionId === session.id)
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }

  private sessionSourceDocuments(session: IntakeSession): readonly IntakeSourceDocument[] {
    const order = new Map(session.sourceDocumentIds.map((id, index) => [id, index]));
    return this.snapshot.intakeSourceDocuments
      .filter((sourceDocument) => sourceDocument.sessionId === session.id)
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }

  private sessionCandidates(session: IntakeSession): readonly IntakeCandidateRequirement[] {
    return this.listIntakeCandidates({ sessionId: session.id });
  }

  private copyIntakeSourceRefs(
    sessionId: IntakeSessionId,
    refs: readonly IntakeCandidateSourceRef[],
  ): readonly IntakeCandidateSourceRef[] {
    const session = this.requireIntakeSession(sessionId);
    const messageIds = new Set(this.sessionMessages(session).map((message) => message.id));
    const sourceDocuments = this.sessionSourceDocuments(session);
    const sourceDocumentIds = new Set(sourceDocuments.map((sourceDocument) => sourceDocument.id));
    const sourceChunkIds = new Set(sourceDocuments.flatMap((sourceDocument) =>
      sourceDocument.chunks.map((chunk) => chunk.id),
    ));
    return refs.map((ref) => {
      if (ref.messageId !== null && !messageIds.has(ref.messageId)) {
        throw new Error(`intake source ref message not found: ${ref.messageId}`);
      }
      if (ref.sourceDocumentId !== null && !sourceDocumentIds.has(ref.sourceDocumentId)) {
        throw new Error(`intake source ref document not found: ${ref.sourceDocumentId}`);
      }
      if (ref.sourceChunkId !== null && !sourceChunkIds.has(ref.sourceChunkId)) {
        throw new Error(`intake source ref chunk not found: ${ref.sourceChunkId}`);
      }
      return {
        sourceDocumentId: ref.sourceDocumentId,
        sourceChunkId: ref.sourceChunkId,
        messageId: ref.messageId,
        quote: ref.quote,
        confidence: normalizeConfidence(ref.confidence),
      };
    });
  }

  private validateIntakeCandidateHierarchy(candidate: IntakeCandidateRequirement): void {
    let parentId = candidate.parentCandidateId;
    const visited = new Set<IntakeCandidateId>([candidate.id]);
    while (parentId !== null) {
      if (visited.has(parentId)) throw new Error(`intake candidate ${candidate.id} parent chain cycles`);
      visited.add(parentId);
      const parent = this.requireIntakeCandidateInSession(candidate.sessionId, parentId);
      if (parent.projectId !== candidate.projectId) {
        throw new Error(`intake candidate ${candidate.id} parent belongs to another project`);
      }
      parentId = parent.parentCandidateId;
    }
  }

  private generateIntakeCandidates(
    session: IntakeSession,
    createdAt: number,
    mode: IntakeAnalyzeInput['mode'] = 'deterministic',
  ): readonly IntakeCandidateRequirement[] {
    const messages = this.sessionMessages(session);
    const sourceDocuments = this.sessionSourceDocuments(session);
    return buildIntakeCandidates({
      session,
      messages,
      sourceDocuments,
      createdAt,
      sourceRefs: this.intakeSourceRefs(messages, sourceDocuments),
      mode: mode ?? 'deterministic',
      ...(this.intakeLlm !== undefined ? { llm: this.intakeLlm } : {}),
      compactTitle: compactIntakeTitle,
      clampText: clampIntakeText,
    });
  }

  private intakeSourceRefs(
    messages: readonly IntakeMessage[],
    sourceDocuments: readonly IntakeSourceDocument[],
  ): readonly IntakeCandidateSourceRef[] {
    const messageRefs = messages
      .filter((message) => message.body.trim().length > 0)
      .slice(0, 3)
      .map((message) => ({
        sourceDocumentId: null,
        sourceChunkId: null,
        messageId: message.id,
        quote: compactIntakeQuote(message.body),
        confidence: 0.64,
      }));
    const chunkRefs = sourceDocuments
      .flatMap((sourceDocument) =>
        sourceDocument.chunks.slice(0, 2).map((chunk) => ({
          sourceDocumentId: sourceDocument.id,
          sourceChunkId: chunk.id,
          messageId: null,
          quote: compactIntakeQuote(chunk.text),
          confidence: 0.58,
        })),
      )
      .slice(0, 4);
    const pendingRefs = sourceDocuments
      .filter((sourceDocument) => sourceDocument.parseStatus !== 'parsed')
      .slice(0, 3)
      .map((sourceDocument) => ({
        sourceDocumentId: sourceDocument.id,
        sourceChunkId: null,
        messageId: null,
        quote: `${sourceDocument.name} (${sourceDocument.parseStatus})`,
        confidence: 0.3,
      }));
    return [...messageRefs, ...chunkRefs, ...pendingRefs];
  }

  private intakeCandidateDepth(candidate: IntakeCandidateRequirement): number {
    let depth = 0;
    let parentId = candidate.parentCandidateId;
    const visited = new Set<IntakeCandidateId>([candidate.id]);
    while (parentId !== null) {
      if (visited.has(parentId)) throw new Error(`intake candidate ${candidate.id} parent chain cycles`);
      visited.add(parentId);
      const parent = this.snapshot.intakeCandidates.find((item) => item.id === parentId);
      if (parent === undefined) break;
      depth += 1;
      parentId = parent.parentCandidateId;
    }
    return depth;
  }

  private resolveApprovalCandidateIds(
    session: IntakeSession,
    candidateIds: readonly IntakeCandidateId[] | undefined,
  ): ReadonlySet<IntakeCandidateId> {
    const candidates = this.sessionCandidates(session);
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const selected = new Set(candidateIds ?? candidates
      .filter((candidate) => candidate.status === 'draft')
      .map((candidate) => candidate.id));
    for (const candidateId of selected) {
      if (!byId.has(candidateId)) throw new Error(`intake candidate ${candidateId} does not belong to session ${session.id}`);
    }
    for (const candidateId of [...selected]) {
      let parentId = byId.get(candidateId)?.parentCandidateId ?? null;
      while (parentId !== null) {
        selected.add(parentId);
        parentId = byId.get(parentId)?.parentCandidateId ?? null;
      }
    }
    return selected;
  }

  private createDefaultWorkflowBoardSummary(item: WorkItem): WorkflowBoardSummary {
    return {
      id: item.id,
      projectId: item.projectId,
      workItemId: item.id,
      workflowRunId: null,
      workflowTemplateVersion: '',
      stage: item.status,
      runStatus: defaultWorkflowRunStatusForWorkItem(item.status),
      activeOwner: item.claimedBy || item.assignee || null,
      activeRoleId: item.claimedRoleId,
      nextAction: defaultNextActionForStatus(item.status),
      downstreamImpact: '',
      schedulerReason: item.blockedByIds.length > 0 ? 'Blocked by dependent WorkItems.' : '',
      runningSteps: [],
      blockedSteps: [],
      waitingApprovals: [],
      waitingReviews: [],
      failedChecks: [],
      controls: defaultWorkflowControlsForStatus(item.status),
      links: [],
      updatedAt: 0,
    };
  }

  private createDefaultDeliveryEvidenceSummary(item: WorkItem): DeliveryEvidenceSummary {
    const coverage = item.acceptanceCriteria.length > 0
      ? this.getAcceptanceCoverage(item.id)
      : null;
    const evidenceLinks = item.evidence.map((label, index) => ({
      kind: 'evidence-record' as const,
      id: `${item.id}:evidence-${String(index + 1)}`,
      label,
      url: null,
      acceptanceCriterionIds: [],
    }));
    const checks: DeliveryEvidenceCheck[] = [];
    if (coverage !== null) {
      checks.push({
        id: 'acceptance-coverage',
        area: 'acceptance',
        title: 'Acceptance coverage',
        status: coverage.complete ? 'passing' : 'missing',
        required: true,
        reason: coverage.complete
          ? 'All acceptance criteria have covering child work.'
          : 'One or more acceptance criteria are not covered by child WorkItems.',
        evidenceIds: [],
        acceptanceCriterionIds: coverage.uncoveredAcceptanceIds,
        links: [],
        producer: 'manual',
        executionKind: 'manual',
        designRevision: '',
      });
    }
    if (['in_review', 'verifying', 'gates_passing', 'delivered'].includes(item.status)) {
      checks.push({
        id: 'delivery-evidence',
        area: 'evidence',
        title: 'Delivery evidence',
        status: evidenceLinks.length > 0 ? 'passing' : 'missing',
        required: true,
        reason: evidenceLinks.length > 0
          ? 'Delivery evidence is attached to the WorkItem.'
          : 'Delivery evidence is required for review, verification, gate, or delivered states.',
        evidenceIds: evidenceLinks.map((link) => link.id),
        acceptanceCriterionIds: [],
        links: evidenceLinks,
        producer: 'manual',
        executionKind: 'manual',
        designRevision: '',
      });
    }
    return {
      id: item.id,
      projectId: item.projectId,
      workItemId: item.id,
      codeLinks: [],
      pullRequests: [],
      reviewLinks: [],
      ciRuns: [],
      deploymentLinks: [],
      evidenceLinks,
      checks,
      obligations: [],
      riskAcceptances: [],
      provenanceLinks: [],
      notes: '',
      designRevision: '',
      updatedAt: 0,
    };
  }

  private validateWorkflowBoardSummaryInput(
    projectId: ProjectId,
    input: WorkflowBoardSummaryInput,
  ): void {
    if (input.stage !== undefined) this.validateWorkItemStatus(input.stage, 'workflow stage');
    if (input.runStatus !== undefined && !WORKFLOW_RUN_STATUSES.includes(input.runStatus)) {
      throw new Error(`invalid workflow runStatus: ${input.runStatus}`);
    }
    if (input.activeRoleId !== undefined && input.activeRoleId !== null) {
      this.validateProjectRole(projectId, input.activeRoleId);
    }
    if (input.controls !== undefined) {
      for (const control of input.controls) {
        if (!WORKFLOW_BOARD_CONTROLS.includes(control)) {
          throw new Error(`invalid workflow control: ${control}`);
        }
      }
    }
    if (input.runningSteps !== undefined) this.copyWorkflowSteps(input.runningSteps, projectId);
    if (input.blockedSteps !== undefined) this.copyWorkflowSteps(input.blockedSteps, projectId);
    if (input.waitingApprovals !== undefined) this.copyWorkflowWaitItems(input.waitingApprovals, projectId);
    if (input.waitingReviews !== undefined) this.copyWorkflowWaitItems(input.waitingReviews, projectId);
    if (input.failedChecks !== undefined) this.copyWorkflowChecks(input.failedChecks);
    if (input.links !== undefined) this.copyWorkflowLinks(input.links);
  }

  private validateDeliveryEvidenceSummaryInput(
    projectId: ProjectId,
    item: WorkItem,
    input: DeliveryEvidenceSummaryInput,
  ): void {
    this.requireProject(projectId);
    if (input.codeLinks !== undefined) this.copyDeliveryEvidenceLinks(input.codeLinks, item);
    if (input.pullRequests !== undefined) this.copyDeliveryEvidenceLinks(input.pullRequests, item);
    if (input.reviewLinks !== undefined) this.copyDeliveryEvidenceLinks(input.reviewLinks, item);
    if (input.ciRuns !== undefined) this.copyDeliveryEvidenceLinks(input.ciRuns, item);
    if (input.deploymentLinks !== undefined) this.copyDeliveryEvidenceLinks(input.deploymentLinks, item);
    if (input.evidenceLinks !== undefined) this.copyDeliveryEvidenceLinks(input.evidenceLinks, item);
    if (input.checks !== undefined) this.copyDeliveryEvidenceChecks(input.checks, item);
    if (input.obligations !== undefined) this.copyGovernanceObligations(input.obligations);
    if (input.riskAcceptances !== undefined) this.copyRiskAcceptances(input.riskAcceptances);
    if (input.provenanceLinks !== undefined) this.copyDeliveryEvidenceLinks(input.provenanceLinks, item);
  }

  private copyWorkflowSteps(
    steps: readonly WorkflowStepSummary[],
    projectId?: ProjectId,
  ): readonly WorkflowStepSummary[] {
    return steps.map((step) => {
      this.assertNonBlank(step.id, 'workflow step id');
      this.assertNonBlank(step.title, 'workflow step title');
      if (!WORKFLOW_STEP_STATUSES.includes(step.status)) {
        throw new Error(`invalid workflow step status: ${step.status}`);
      }
      if (projectId !== undefined && step.roleId !== null) {
        this.validateProjectRole(projectId, step.roleId);
      }
      return {
        id: step.id,
        title: step.title,
        status: step.status,
        owner: step.owner,
        roleId: step.roleId,
        dependsOnStepIds: [...step.dependsOnStepIds],
        reason: step.reason,
        links: this.copyWorkflowLinks(step.links),
      };
    });
  }

  private copyWorkflowWaitItems(
    items: readonly WorkflowWaitItem[],
    projectId?: ProjectId,
  ): readonly WorkflowWaitItem[] {
    return items.map((item) => {
      this.assertNonBlank(item.id, 'workflow wait item id');
      this.assertNonBlank(item.title, 'workflow wait item title');
      if (!WORKFLOW_WAIT_ITEM_TYPES.includes(item.type)) {
        throw new Error(`invalid workflow wait item type: ${item.type}`);
      }
      if (item.dueAt !== null && (!Number.isFinite(item.dueAt) || item.dueAt < 0)) {
        throw new Error('workflow wait item dueAt must be a positive timestamp');
      }
      if (projectId !== undefined && item.roleId !== null) {
        this.validateProjectRole(projectId, item.roleId);
      }
      return {
        id: item.id,
        type: item.type,
        title: item.title,
        status: item.status,
        roleId: item.roleId,
        owner: item.owner,
        dueAt: item.dueAt,
        links: this.copyWorkflowLinks(item.links),
      };
    });
  }

  private copyWorkflowChecks(
    checks: readonly WorkflowCheckSummary[],
  ): readonly WorkflowCheckSummary[] {
    return checks.map((check) => {
      this.assertNonBlank(check.id, 'workflow check id');
      this.assertNonBlank(check.title, 'workflow check title');
      if (!WORKFLOW_CHECK_STATUSES.includes(check.status)) {
        throw new Error(`invalid workflow check status: ${check.status}`);
      }
      return {
        id: check.id,
        title: check.title,
        status: check.status,
        reason: check.reason,
        links: this.copyWorkflowLinks(check.links),
      };
    });
  }

  private copyWorkflowLinks(links: readonly WorkflowBoardLink[]): readonly WorkflowBoardLink[] {
    return links.map((link) => {
      if (!WORKFLOW_BOARD_LINK_KINDS.includes(link.kind)) {
        throw new Error(`invalid workflow link kind: ${link.kind}`);
      }
      this.assertNonBlank(link.id, 'workflow link id');
      this.assertNonBlank(link.label, 'workflow link label');
      if (link.url !== null && typeof link.url !== 'string') {
        throw new Error('workflow link url must be a string or null');
      }
      return {
        kind: link.kind,
        id: link.id,
        label: link.label,
        url: link.url,
      };
    });
  }

  private copyDeliveryEvidenceLinks(
    links: readonly DeliveryEvidenceLink[],
    item?: WorkItem,
  ): readonly DeliveryEvidenceLink[] {
    const criterionIds = item === undefined
      ? null
      : new Set(item.acceptanceCriteria.map((criterion) => criterion.id));
    const itemId = item?.id ?? 'unknown';
    return links.map((link) => {
      if (!DELIVERY_EVIDENCE_LINK_KINDS.includes(link.kind)) {
        throw new Error(`invalid delivery evidence link kind: ${link.kind}`);
      }
      this.assertNonBlank(link.id, 'delivery evidence link id');
      this.assertNonBlank(link.label, 'delivery evidence link label');
      if (link.url !== null && typeof link.url !== 'string') {
        throw new Error('delivery evidence link url must be a string or null');
      }
      for (const criterionId of link.acceptanceCriterionIds) {
        if (criterionIds !== null && !criterionIds.has(criterionId)) {
          throw new Error(`delivery evidence link criterion ${criterionId} is not on work item ${itemId}`);
        }
      }
      return {
        kind: link.kind,
        id: link.id,
        label: link.label,
        url: link.url,
        acceptanceCriterionIds: [...link.acceptanceCriterionIds],
      };
    });
  }

  private copyDeliveryEvidenceChecks(
    checks: readonly DeliveryEvidenceCheck[],
    item: WorkItem,
  ): readonly DeliveryEvidenceCheck[] {
    const criterionIds = new Set(item.acceptanceCriteria.map((criterion) => criterion.id));
    return checks.map((check) => {
      this.assertNonBlank(check.id, 'delivery evidence check id');
      this.assertNonBlank(check.title, 'delivery evidence check title');
      if (!DELIVERY_EVIDENCE_AREAS.includes(check.area)) {
        throw new Error(`invalid delivery evidence check area: ${check.area}`);
      }
      if (!DELIVERY_EVIDENCE_STATUSES.includes(check.status)) {
        throw new Error(`invalid delivery evidence check status: ${check.status}`);
      }
      const producer = resolveEvidenceProducer(check.producer);
      const executionKind = resolveEvidenceExecutionKind(check.executionKind, producer);
      if (!DELIVERY_EVIDENCE_PRODUCERS.includes(producer)) {
        throw new Error(`invalid delivery evidence check producer: ${producer}`);
      }
      if (!DELIVERY_EVIDENCE_EXECUTION_KINDS.includes(executionKind)) {
        throw new Error(`invalid delivery evidence check executionKind: ${executionKind}`);
      }
      if (typeof check.required !== 'boolean') {
        throw new Error('delivery evidence check required must be a boolean');
      }
      for (const criterionId of check.acceptanceCriterionIds) {
        if (!criterionIds.has(criterionId)) {
          throw new Error(`delivery evidence check criterion ${criterionId} is not on work item ${item.id}`);
        }
      }
      return {
        id: check.id,
        area: check.area,
        title: check.title,
        status: check.status,
        required: check.required,
        reason: check.reason,
        evidenceIds: [...check.evidenceIds],
        acceptanceCriterionIds: [...check.acceptanceCriterionIds],
        links: this.copyDeliveryEvidenceLinks(check.links, item),
        producer,
        executionKind,
        designRevision: check.designRevision ?? '',
      };
    });
  }

  private invalidateStaleDeliveryEvidence(previous: WorkItem, next: WorkItem): void {
    if (workItemDesignRevision(previous) === workItemDesignRevision(next)) return;
    const stored = this.snapshot.deliveryEvidenceSummaries.find((summary) => summary.workItemId === next.id);
    if (stored === undefined || stored.designRevision === '') return;
    if (stored.designRevision === workItemDesignRevision(next)) return;
    this.updateDeliveryEvidenceSummary(next.id, {
      checks: staleExecutedChecks(stored.checks),
    });
  }

  private copyGovernanceObligations(
    obligations: readonly GovernanceObligationSummary[],
  ): readonly GovernanceObligationSummary[] {
    return obligations.map((obligation) => {
      this.assertNonBlank(obligation.id, 'governance obligation id');
      this.assertNonBlank(obligation.title, 'governance obligation title');
      if (!GOVERNANCE_OBLIGATION_STATUSES.includes(obligation.status)) {
        throw new Error(`invalid governance obligation status: ${obligation.status}`);
      }
      this.validateTimestampOrNull(obligation.effectiveDate, 'governance obligation effectiveDate');
      this.validateTimestampOrNull(obligation.reviewDate, 'governance obligation reviewDate');
      return {
        id: obligation.id,
        title: obligation.title,
        jurisdiction: obligation.jurisdiction,
        source: obligation.source,
        status: obligation.status,
        owner: obligation.owner,
        reviewer: obligation.reviewer,
        effectiveDate: obligation.effectiveDate,
        reviewDate: obligation.reviewDate,
        controlIds: [...obligation.controlIds],
        links: this.copyDeliveryEvidenceLinks(obligation.links),
      };
    });
  }

  private copyRiskAcceptances(
    riskAcceptances: readonly DeliveryRiskAcceptance[],
  ): readonly DeliveryRiskAcceptance[] {
    return riskAcceptances.map((riskAcceptance) => {
      this.assertNonBlank(riskAcceptance.id, 'risk acceptance id');
      this.assertNonBlank(riskAcceptance.title, 'risk acceptance title');
      if (!DELIVERY_RISK_AREAS.includes(riskAcceptance.area)) {
        throw new Error(`invalid risk acceptance area: ${riskAcceptance.area}`);
      }
      if (!DELIVERY_RISK_ACCEPTANCE_STATUSES.includes(riskAcceptance.status)) {
        throw new Error(`invalid risk acceptance status: ${riskAcceptance.status}`);
      }
      this.validateTimestampOrNull(riskAcceptance.expiresAt, 'risk acceptance expiresAt');
      return {
        id: riskAcceptance.id,
        area: riskAcceptance.area,
        title: riskAcceptance.title,
        status: riskAcceptance.status,
        approver: riskAcceptance.approver,
        reason: riskAcceptance.reason,
        expiresAt: riskAcceptance.expiresAt,
        links: this.copyDeliveryEvidenceLinks(riskAcceptance.links),
      };
    });
  }

  private deliveryEvidenceBlocks(item: WorkItem): readonly string[] {
    const stored = this.snapshot.deliveryEvidenceSummaries.find((summary) => summary.workItemId === item.id);
    if (stored === undefined) return [];
    const blocked = stored.checks
      .filter(deliveryCheckBlocks)
      .map((check) => check.title);
    const unapproved = stored.obligations
      .filter(obligationUnapproved)
      .map((obligation) => obligation.title);
    const openRisk = stored.riskAcceptances
      .filter(riskAcceptanceOpen)
      .map((riskAcceptance) => riskAcceptance.title);
    return [...blocked, ...unapproved, ...openRisk];
  }

  private deliveryEvidenceRollupWorkItems(
    projectId: ProjectId,
    filter: ProjectDeliveryEvidenceRollupFilter,
  ): readonly WorkItem[] {
    const direct = this.listWorkItems({
      projectId,
      ...(Object.hasOwn(filter, 'milestoneId') ? { milestoneId: filter.milestoneId ?? null } : {}),
    });
    if (!Object.hasOwn(filter, 'milestoneId') || filter.milestoneId === null || filter.milestoneId === undefined) {
      return direct;
    }
    const byId = new Map(direct.map((item) => [item.id, item]));
    for (const slice of this.snapshot.deliverySlices) {
      if (slice.projectId !== projectId || slice.milestoneId !== filter.milestoneId) continue;
      const parent = this.snapshot.cards.find((item) => item.id === slice.parentWorkItemId);
      if (parent !== undefined) byId.set(parent.id, parent);
    }
    return sortByOrder([...byId.values()]);
  }

  private storyBlockedReasons(
    item: WorkItem,
    summary: WorkflowBoardSummary,
  ): readonly string[] {
    const reasons: string[] = [];
    if (!['ready', 'in_progress', 'in_review', 'verifying', 'gates_passing'].includes(item.status)) {
      reasons.push('not_ready_status');
    }
    if (item.blockedByIds.length > 0) reasons.push('blocked_by_work_items');
    if (item.analysis.trim() === '') reasons.push('missing_analysis');
    if (item.design.trim() === '') reasons.push('missing_design');
    if (item.acceptanceCriteria.length === 0) reasons.push('missing_acceptance');
    if (item.milestoneId === null) reasons.push('missing_milestone');
    const assignee = item.assignee.trim();
    if (assignee === '') {
      reasons.push('missing_assignee');
    } else {
      const member = this.snapshot.teamMembers.find((candidate) => candidate.id === assignee);
      if (member === undefined) {
        reasons.push('unknown_assignee');
      } else if (member.status !== 'active') {
        reasons.push('assignee_unavailable');
      } else if (this.openWorkItemsAssignedTo(member.id, item.projectId).length > member.concurrentWorkLimit) {
        reasons.push('assignee_over_wip_limit');
      }
    }
    if (summary.waitingApprovals.length > 0) reasons.push('waiting_approvals');
    if (summary.waitingReviews.length > 0) reasons.push('waiting_reviews');
    if (summary.blockedSteps.length > 0) reasons.push('blocked_workflow_steps');
    if (summary.failedChecks.length > 0) reasons.push('failed_checks');
    return [...new Set(reasons)];
  }

  private addWorkItemParticipant(
    workItemId: WorkItemId,
    memberId: TeamMemberId,
    field: 'reviewerIds' | 'approverIds' | 'watcherIds',
    requiredStatus?: TeamMember['status'],
  ): WorkItem {
    const card = this.requireCard(workItemId);
    const member = this.requireTeamMember(memberId);
    if (member.projectId !== card.projectId) {
      throw new Error(`team member ${member.id} belongs to another project`);
    }
    if (requiredStatus !== undefined && member.status !== requiredStatus) {
      throw new Error(`team member ${member.id} is not ${requiredStatus}`);
    }
    if (card[field].includes(member.id)) {
      throw new Error(`team member ${member.id} is already a ${field.replace('Ids', '')}`);
    }
    if (field === 'reviewerIds') {
      this.assertWipPolicies(card, member, undefined, 'review');
    }
    const next: Card = { ...card, [field]: [...card[field], member.id] };
    return this.replaceCard(next, {
      projectId: card.projectId,
      action: `work_item.${field.replace('Ids', '')}.added`,
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: [field],
    });
  }

  private removeWorkItemParticipant(
    workItemId: WorkItemId,
    memberId: TeamMemberId,
    field: 'reviewerIds' | 'approverIds' | 'watcherIds',
  ): WorkItem {
    const card = this.requireCard(workItemId);
    if (!card[field].includes(memberId)) {
      throw new Error(`team member ${memberId} is not a ${field.replace('Ids', '')}`);
    }
    const next: Card = { ...card, [field]: card[field].filter((id) => id !== memberId) };
    return this.replaceCard(next, {
      projectId: card.projectId,
      action: `work_item.${field.replace('Ids', '')}.removed`,
      targetType: 'work_item',
      targetId: card.id,
      targetLabel: card.title,
      changedFields: [field],
    });
  }

  private validateWipPolicy(project: Project, input: TeamWipPolicyInput): TeamWipPolicy {
    if (!TEAM_WIP_KINDS.includes(input.kind)) {
      throw new Error(`unknown wip policy kind: ${input.kind}`);
    }
    if (!TEAM_WIP_SCOPES.includes(input.scope)) {
      throw new Error(`unknown wip policy scope: ${input.scope}`);
    }
    if (input.scopeId.trim() === '') {
      throw new Error('wip policy scopeId is required');
    }
    this.validatePositiveNumber(input.limit, 'wip policy limit');
    if (input.scope === 'role') {
      this.validateProjectRole(project.id, input.scopeId as RoleId);
    }
    if (input.scope === 'member-type' && !TEAM_MEMBER_TYPES.includes(input.scopeId as TeamMember['memberType'])) {
      throw new Error(`invalid team member type: ${input.scopeId}`);
    }
    return {
      id: randomUUID(),
      kind: input.kind,
      scope: input.scope,
      scopeId: input.scopeId.trim(),
      limit: input.limit,
    };
  }

  private assertWipPolicies(
    item: WorkItem,
    member: TeamMember,
    roleId: RoleId | undefined,
    kind: TeamWipKind,
  ): void {
    const project = this.requireProject(item.projectId);
    const openItems = this.listWorkItems({ projectId: item.projectId }).filter(isOpenWorkItem);
    for (const policy of project.wipPolicies) {
      if (policy.kind !== kind && !(kind === 'work-item' && (policy.kind === 'repository' || policy.kind === 'ci' || policy.kind === 'environment'))) {
        continue;
      }
      if (!this.policyApplies(policy, item, member, roleId, kind)) continue;
      const count = this.countPolicyUsage(policy, openItems, item.id, member.id);
      if (count >= policy.limit) {
        throw new Error(
          `WIP policy ${policy.kind}/${policy.scope}:${policy.scopeId} exceeds limit ${String(policy.limit)}`,
        );
      }
    }
  }

  private policyApplies(
    policy: TeamWipPolicy,
    item: WorkItem,
    member: TeamMember,
    roleId: RoleId | undefined,
    kind: TeamWipKind,
  ): boolean {
    if (policy.kind === 'review') return kind === 'review';
    if (policy.kind === 'collaboration-task') return false;
    if (policy.kind === 'repository' || policy.kind === 'ci' || policy.kind === 'environment') {
      return item.wipResources.some((resource) => resource.kind === policy.kind && resource.id === policy.scopeId);
    }
    if (policy.scope === 'role') return roleId === policy.scopeId;
    if (policy.scope === 'member-type') return member.memberType === policy.scopeId;
    if (policy.scope === 'member') return member.id === policy.scopeId;
    return true;
  }

  private countPolicyUsage(
    policy: TeamWipPolicy,
    openItems: readonly WorkItem[],
    excludeWorkItemId: WorkItemId,
    memberId: TeamMemberId,
  ): number {
    const items = openItems.filter((item) => item.id !== excludeWorkItemId);
    if (policy.kind === 'review') {
      return items.filter((item) => item.reviewerIds.includes(memberId)).length;
    }
    if (policy.kind === 'repository' || policy.kind === 'ci' || policy.kind === 'environment') {
      return items.filter((item) =>
        item.wipResources.some((resource) => resource.kind === policy.kind && resource.id === policy.scopeId),
      ).length;
    }
    if (policy.scope === 'role') {
      return items.filter((item) => item.claimedRoleId === policy.scopeId).length;
    }
    if (policy.scope === 'member-type') {
      return items.filter((item) => {
        const assigned = this.snapshot.teamMembers.find((member) => member.id === item.assignee);
        return assigned?.memberType === policy.scopeId;
      }).length;
    }
    if (policy.scope === 'member') {
      return items.filter((item) => item.assignee === policy.scopeId).length;
    }
    return items.filter((item) => item.assignee.trim() !== '').length;
  }

  private wipPolicyWarnings(projectId: ProjectId, openItems: readonly WorkItem[]): readonly string[] {
    const project = this.requireProject(projectId);
    const warnings: string[] = [];
    for (const policy of project.wipPolicies) {
      const count = this.countPolicyUsage(policy, openItems, '' as WorkItemId, '' as TeamMemberId);
      if (count >= policy.limit) warnings.push(wipPolicyWarningCode(policy));
    }
    return [...new Set(warnings)];
  }

  private validateProjectRole(projectId: ProjectId, roleId: RoleId): void {
    const project = this.requireProject(projectId);
    if (!project.roles.some((role) => role.id === roleId)) {
      throw new Error(`role not found: ${roleId}`);
    }
  }

  private validateTeamMemberInput(
    input: TeamMemberCreateInput | TeamMemberUpdateInput,
    project: Project,
  ): void {
    if (
      Object.hasOwn(input, 'displayName') &&
      (input.displayName === undefined || input.displayName.trim().length === 0)
    ) {
      throw new Error('team member displayName is required');
    }
    if (input.memberType !== undefined && !TEAM_MEMBER_TYPES.includes(input.memberType)) {
      throw new Error(`invalid team member type: ${input.memberType}`);
    }
    if (input.status !== undefined && !TEAM_MEMBER_STATUSES.includes(input.status)) {
      throw new Error(`invalid team member status: ${input.status}`);
    }
    if (input.capacityUnits !== undefined) {
      this.validatePositiveNumber(input.capacityUnits, 'team member capacityUnits');
    }
    if (input.concurrentWorkLimit !== undefined) {
      this.validatePositiveNumber(input.concurrentWorkLimit, 'team member concurrentWorkLimit');
    }
    if (input.roleIds !== undefined) {
      const roleIds = new Set(project.roles.map((role) => role.id));
      for (const roleId of input.roleIds) {
        if (!roleIds.has(roleId)) throw new Error(`role not found: ${roleId}`);
      }
    }
  }

  private validatePositiveNumber(value: number, field: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${field} must be a positive number`);
    }
  }

  private validateTimestampOrNull(value: number | null, field: string): void {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${field} must be a positive timestamp or null`);
    }
  }

  private assertNonBlank(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${field} is required`);
    }
  }

  private openWorkItemsAssignedTo(
    memberId: TeamMemberId,
    projectId: ProjectId,
  ): readonly WorkItem[] {
    return this.snapshot.cards.filter((item) =>
      item.projectId === projectId && item.assignee === memberId && isOpenWorkItem(item),
    );
  }

  private validateMilestoneAssignment(item: WorkItem): void {
    if (item.milestoneId === null) return;
    const milestone = this.requireMilestone(item.milestoneId);
    if (milestone.projectId !== item.projectId) {
      throw new Error(`work item ${item.id} cannot use milestone ${milestone.id} from another project`);
    }
  }

  private validateMilestoneDeliverySliceParent(parent: WorkItem): void {
    if (!DELIVERY_SLICE_PARENT_TYPES.includes(parent.type as typeof DELIVERY_SLICE_PARENT_TYPES[number])) {
      throw new Error(`delivery slice parent must be an Epic, Feature, Requirement, or Story: ${parent.id}`);
    }
  }

  private validateMilestoneDeliverySliceProject(parent: WorkItem, milestone: Milestone): void {
    if (milestone.projectId !== parent.projectId) {
      throw new Error(`delivery slice cannot use milestone ${milestone.id} from another project`);
    }
  }

  private validateAcceptanceCriterionScope(
    parent: WorkItem,
    acceptanceCriterionIds: readonly AcceptanceCriterionId[],
  ): void {
    const validIds = new Set(parent.acceptanceCriteria.map((criterion) => criterion.id));
    for (const criterionId of acceptanceCriterionIds) {
      if (!validIds.has(criterionId)) {
        throw new Error(`delivery slice acceptance criterion ${criterionId} is not on parent ${parent.id}`);
      }
    }
  }

  private validateMilestoneDeliverySliceText(input: {
    readonly title?: string;
    readonly scope: string;
  }): void {
    if (input.scope.trim().length === 0) throw new Error('delivery slice scope is required');
    if (input.title !== undefined && input.title.trim().length === 0) {
      throw new Error('delivery slice title is required');
    }
  }

  private validateWorkItemStatus(status: WorkItemStatus, field: string): void {
    if (!WORK_ITEM_STATUSES.includes(status)) {
      throw new Error(`invalid delivery slice ${field}: ${status}`);
    }
  }

  private assertMilestoneDeliverySlicesComplete(item: WorkItem, to: WorkItemStatus): void {
    if (to !== 'delivered') return;
    const openSlices = this.snapshot.deliverySlices.filter((slice) =>
      slice.parentWorkItemId === item.id && slice.status !== slice.targetStatus,
    );
    if (openSlices.length === 0) return;
    throw new Error(`work item ${item.id} has incomplete milestone delivery slices`);
  }

  private assertDeliveryEvidenceReady(item: WorkItem, to: WorkItemStatus, policy: ProjectDeliveryPolicy): void {
    if (to !== 'delivered') return;
    const doneError = validateDefinitionOfDone(item, this.doneContext(item, policy));
    if (doneError !== null) {
      throw new Error(formatTransitionError(doneError));
    }
    const blockers = this.deliveryEvidenceBlocks(item);
    if (blockers.length === 0) return;
    throw new Error(`work item ${item.id} has blocking delivery evidence: ${blockers.join(', ')}`);
  }

  private doneContext(item: WorkItem, policy: ProjectDeliveryPolicy) {
    return {
      policy,
      evidence: this.snapshot.deliveryEvidenceSummaries.find((summary) => summary.workItemId === item.id) ?? null,
      children: this.childrenOf(item.id),
    };
  }

  private requireDeliveryPolicy(policy: ProjectDeliveryPolicy): ProjectDeliveryPolicy {
    const readyChecks = policy.readyChecks.filter((item) => (READY_CHECK_KINDS as readonly string[]).includes(item));
    const doneChecks = policy.doneChecks.filter((item) => (DONE_CHECK_KINDS as readonly string[]).includes(item));
    if (readyChecks.length !== policy.readyChecks.length) {
      throw new Error('delivery policy readyChecks contains an unknown check');
    }
    if (doneChecks.length !== policy.doneChecks.length) {
      throw new Error('delivery policy doneChecks contains an unknown check');
    }
    return resolveDeliveryPolicy({ readyChecks, doneChecks });
  }

  private groupTitle(id: string, groupBy: BoardGroupBy, projectId?: ProjectId): string {
    if (groupBy === 'milestone') {
      return id === 'no-milestone' ? 'No milestone' : this.getMilestone(id as MilestoneId)?.title ?? id;
    }
    if (groupBy === 'parent') {
      return id === 'root' ? 'Root' : this.getWorkItem(id as WorkItemId)?.title ?? id;
    }
    if (groupBy === 'claimedRole') {
      if (id === 'unclaimed') return 'Unclaimed';
      const projects = projectId === undefined
        ? this.snapshot.projects
        : this.snapshot.projects.filter((project) => project.id === projectId);
      return projects
        .flatMap((project) => project.roles)
        .find((role) => role.id === id)?.displayName ?? id;
    }
    return id;
  }

  private childrenOf(parentId: WorkItemId): WorkItem[] {
    return sortByOrder(this.snapshot.cards.filter((item) => item.parentId === parentId));
  }

  private buildTree(item: WorkItem, ancestors: ReadonlySet<WorkItemId>): WorkItemTreeNode {
    if (ancestors.has(item.id)) throw new Error(`card ${item.id} parent chain cycles`);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(item.id);
    return {
      item,
      children: this.childrenOf(item.id).map((child) => this.buildTree(child, nextAncestors)),
    };
  }

  private descendantsOf(rootId: WorkItemId, ancestors: ReadonlySet<WorkItemId>): WorkItem[] {
    if (ancestors.has(rootId)) throw new Error(`card ${rootId} parent chain cycles`);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(rootId);
    const children = this.childrenOf(rootId);
    return children.flatMap((child) => [
      child,
      ...this.descendantsOf(child.id, nextAncestors),
    ]);
  }

  private appendAuditEvent(input: AuditEventCreateInput): AuditEvent {
    this.requireProject(input.projectId);
    if (input.action.trim().length === 0) throw new Error('audit action is required');
    if (input.targetType.trim().length === 0) throw new Error('audit targetType is required');
    if (input.targetId.trim().length === 0) throw new Error('audit targetId is required');
    const event: AuditEvent = {
      id: randomUUID() as AuditEventId,
      projectId: input.projectId,
      actorId: input.actorId?.trim() || 'system',
      action: input.action.trim(),
      targetType: input.targetType.trim(),
      targetId: input.targetId.trim(),
      targetLabel: input.targetLabel?.trim() ?? '',
      requestSource: input.requestSource?.trim() || 'board-store',
      changedFields: [...new Set(input.changedFields ?? [])]
        .map((field) => field.trim())
        .filter((field) => field.length > 0)
        .sort(),
      reason: input.reason?.trim() ?? '',
      correlationId: input.correlationId ?? null,
      createdAt: Date.now(),
    };
    this.snapshot = {
      ...this.snapshot,
      auditEvents: [...this.snapshot.auditEvents, event],
    };
    return event;
  }

  private replaceCard(next: Card, auditEvent?: AuditEventCreateInput): Card {
    this.snapshot = {
      ...this.snapshot,
      cards: this.snapshot.cards.map((card) => (card.id === next.id ? next : card)),
    };
    if (auditEvent !== undefined) this.appendAuditEvent(auditEvent);
    this.write();
    return next;
  }

  private read(): BoardSnapshot {
    this.database.migrate();
    const fromDatabase = this.database.loadBoardSnapshot();
    if (fromDatabase !== undefined) {
      return migrateSnapshot(fromDatabase as unknown as StoredBoardSnapshot);
    }
    const imported = this.readJsonSnapshot();
    if (imported !== undefined) {
      this.database.saveBoardSnapshot(imported as unknown as BoardDocument);
      return imported;
    }
    return {
      ...EMPTY,
      projects: [],
      milestones: [],
      deliverySlices: [],
      workflowSummaries: [],
      deliveryEvidenceSummaries: [],
      intakeSessions: [],
      intakeMessages: [],
      intakeSourceDocuments: [],
      intakeCandidates: [],
      auditEvents: [],
      cards: [],
    };
  }

  private readJsonSnapshot(): BoardSnapshot | undefined {
    try {
      const raw = readFileSync(boardFilePath(this.workspaceRoot), 'utf8');
      const parsed = JSON.parse(raw) as StoredBoardSnapshot;
      return migrateSnapshot(parsed);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return undefined;
      throw error;
    }
  }

  private write(): void {
    this.database.saveBoardSnapshot(this.snapshot as unknown as BoardDocument);
  }
}
