/**
 * Board capability — Service Definition.
 *
 * Provides `huntianling.board` for project, work-item, board-view, status,
 * and role-claim APIs. Persistence is `huntianling.database`.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { TransitionGate } from './gates.js';
import { loadGateManifest } from './gate-manifest.js';
import { BoardStore, type BoardStoreOptions } from './store.js';
import type {
  AcceptanceCoverageSummary,
  AuditEvent,
  AuditEventCreateInput,
  AuditEventFilter,
  BoardView,
  BoardViewQuery,
  Card,
  CardId,
  DeliveryEvidenceSummary,
  DeliveryEvidenceSummaryFilter,
  DeliveryEvidenceSummaryInput,
  IntakeAnalyzeInput,
  IntakeFollowUpInput,
  IntakeApprovalInput,
  IntakeApprovalResult,
  IntakeCandidateFilter,
  IntakeCandidateId,
  IntakeCandidateRequirement,
  IntakeCandidateUpdateInput,
  IntakeMessage,
  IntakeMessageCreateInput,
  IntakeSession,
  IntakeSessionBundle,
  IntakeSessionCreateInput,
  IntakeSessionFilter,
  IntakeSessionId,
  IntakeSessionUpdateInput,
  IntakeSourceDocument,
  IntakeSourceDocumentCreateInput,
  Milestone,
  MilestoneBoard,
  MilestoneCreateInput,
  MilestoneDeliverySlice,
  MilestoneDeliverySliceCreateInput,
  MilestoneDeliverySliceFilter,
  MilestoneDeliverySliceId,
  MilestoneDeliverySliceUpdateInput,
  MilestoneFilter,
  MilestoneId,
  MilestoneSummary,
  MilestoneUpdateInput,
  AgentCustomization,
  Project,
  ProjectDeliveryPolicy,
  DeliveryGateInspection,
  ProjectDeliveryEvidenceRollup,
  ProjectDeliveryEvidenceRollupFilter,
  ProjectId,
  RoleId,
  TeamCapacitySummary,
  TeamMember,
  TeamMemberCreateInput,
  TeamMemberFilter,
  TeamMemberId,
  TeamMemberUpdateInput,
  TeamWipPolicy,
  TeamWipPolicyInput,
  StoryPriorityQueue,
  StoryPriorityQueueFilter,
  WorkItem,
  WorkItemAssignmentInput,
  WorkItemCreateInput,
  WorkItemFilter,
  WorkItemId,
  WorkItemTreeNode,
  WorkItemUpdateInput,
  WorkItemStatus,
  WorkflowBoardSummary,
  WorkflowBoardSummaryFilter,
  WorkflowBoardSummaryInput,
} from './types.js';
import type { DatabaseService } from '../database/types.js';
import type { IntakeConfig } from '../intake/types.js';
import { PRIORITIZATION_METHODS, type PrioritizationMethodDefinition } from './prioritization.js';
import { resolveWorkspaceRoot } from './workspace.js';

export interface BoardService {
  listProjects(filter?: { readonly includeArchived?: boolean }): readonly Project[];
  createProject(input: { name: string; description?: string }): Project;
  updateProject(projectId: ProjectId, input: {
    readonly name?: string;
    readonly description?: string;
    readonly deliveryPolicy?: ProjectDeliveryPolicy;
    readonly enabledMethodIds?: readonly string[];
    readonly prioritizationMethodId?: string | null;
    readonly enabledAgentIds?: readonly string[];
    readonly agentCustomizations?: readonly AgentCustomization[];
  }): Project;
  enableAgent(projectId: ProjectId, agentId: string): Project;
  disableAgent(projectId: ProjectId, agentId: string): Project;
  customizeAgent(projectId: ProjectId, agentId: string, input: {
    readonly allowedToolIds?: readonly string[];
    readonly requiredSkillIds?: readonly string[];
  }): Project;
  prioritizationMethods(): readonly PrioritizationMethodDefinition[];
  overrideStoryRanking(workItemId: WorkItemId, input: {
    readonly rank: number;
    readonly reason: string;
    readonly actorId: string;
  }): WorkItem;
  clearStoryRankingOverride(workItemId: WorkItemId, input: {
    readonly reason: string;
    readonly actorId: string;
  }): WorkItem;
  inspectDeliveryGates(workItemId: WorkItemId, to: WorkItemStatus): DeliveryGateInspection;
  archiveProject(projectId: ProjectId, actor: string): Project;
  restoreProject(projectId: ProjectId, actor: string): Project;
  archiveWorkItem(workItemId: WorkItemId, actor: string): WorkItem;
  restoreWorkItem(workItemId: WorkItemId, actor: string): WorkItem;
  listAuditEvents(filter?: AuditEventFilter): readonly AuditEvent[];
  recordAuditEvent(input: AuditEventCreateInput): AuditEvent;
  listMilestones(filter?: MilestoneFilter): readonly Milestone[];
  getMilestone(milestoneId: MilestoneId): Milestone | undefined;
  createMilestone(input: MilestoneCreateInput): Milestone;
  updateMilestone(milestoneId: MilestoneId, input: MilestoneUpdateInput): Milestone;
  assignWorkItemToMilestone(workItemId: WorkItemId, milestoneId: MilestoneId | null): WorkItem;
  listTeamMembers(filter?: TeamMemberFilter): readonly TeamMember[];
  getTeamMember(memberId: TeamMemberId): TeamMember | undefined;
  createTeamMember(input: TeamMemberCreateInput): TeamMember;
  updateTeamMember(memberId: TeamMemberId, input: TeamMemberUpdateInput): TeamMember;
  addTeamMemberRole(memberId: TeamMemberId, roleId: RoleId): TeamMember;
  removeTeamMemberRole(memberId: TeamMemberId, roleId: RoleId): TeamMember;
  addWorkItemReviewer(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem;
  removeWorkItemReviewer(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem;
  addWorkItemApprover(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem;
  removeWorkItemApprover(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem;
  addWorkItemWatcher(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem;
  removeWorkItemWatcher(workItemId: WorkItemId, memberId: TeamMemberId): WorkItem;
  replaceTeamWipPolicies(projectId: ProjectId, policies: readonly TeamWipPolicyInput[]): Project;
  listTeamWipPolicies(projectId: ProjectId): readonly TeamWipPolicy[];
  assignWorkItem(workItemId: WorkItemId, input: WorkItemAssignmentInput): WorkItem;
  getTeamCapacity(projectId: ProjectId): TeamCapacitySummary;
  listWorkflowBoardSummaries(filter?: WorkflowBoardSummaryFilter): readonly WorkflowBoardSummary[];
  getWorkflowBoardSummary(workItemId: WorkItemId): WorkflowBoardSummary;
  updateWorkflowBoardSummary(workItemId: WorkItemId, input: WorkflowBoardSummaryInput): WorkflowBoardSummary;
  getStoryPriorityQueue(projectId: ProjectId, filter?: StoryPriorityQueueFilter): StoryPriorityQueue;
  listDeliveryEvidenceSummaries(filter?: DeliveryEvidenceSummaryFilter): readonly DeliveryEvidenceSummary[];
  getDeliveryEvidenceSummary(workItemId: WorkItemId): DeliveryEvidenceSummary;
  updateDeliveryEvidenceSummary(workItemId: WorkItemId, input: DeliveryEvidenceSummaryInput): DeliveryEvidenceSummary;
  getProjectDeliveryEvidenceRollup(
    projectId: ProjectId,
    filter?: ProjectDeliveryEvidenceRollupFilter,
  ): ProjectDeliveryEvidenceRollup;
  listIntakeSessions(filter?: IntakeSessionFilter): readonly IntakeSession[];
  getIntakeSession(sessionId: IntakeSessionId): IntakeSession | undefined;
  getIntakeSessionBundle(sessionId: IntakeSessionId): IntakeSessionBundle;
  createIntakeSession(input: IntakeSessionCreateInput): IntakeSession;
  updateIntakeSession(sessionId: IntakeSessionId, input: IntakeSessionUpdateInput): IntakeSession;
  addIntakeMessage(sessionId: IntakeSessionId, input: IntakeMessageCreateInput): IntakeMessage;
  clarifyIntakeSession(sessionId: IntakeSessionId): IntakeSessionBundle;
  answerIntakeFollowUp(sessionId: IntakeSessionId, input: IntakeFollowUpInput): IntakeSessionBundle;
  addIntakeSourceDocument(
    sessionId: IntakeSessionId,
    input: IntakeSourceDocumentCreateInput,
  ): IntakeSourceDocument;
  analyzeIntakeSession(sessionId: IntakeSessionId, input?: IntakeAnalyzeInput): IntakeSessionBundle;
  listIntakeCandidates(filter?: IntakeCandidateFilter): readonly IntakeCandidateRequirement[];
  updateIntakeCandidate(
    candidateId: IntakeCandidateId,
    input: IntakeCandidateUpdateInput,
  ): IntakeCandidateRequirement;
  approveIntakeCandidates(sessionId: IntakeSessionId, input?: IntakeApprovalInput): IntakeApprovalResult;
  listMilestoneDeliverySlices(filter?: MilestoneDeliverySliceFilter): readonly MilestoneDeliverySlice[];
  createMilestoneDeliverySlice(input: MilestoneDeliverySliceCreateInput): MilestoneDeliverySlice;
  updateMilestoneDeliverySlice(
    sliceId: MilestoneDeliverySliceId,
    input: MilestoneDeliverySliceUpdateInput,
  ): MilestoneDeliverySlice;
  listWorkItems(filter?: WorkItemFilter): readonly WorkItem[];
  getWorkItem(workItemId: WorkItemId): WorkItem | undefined;
  createWorkItem(input: WorkItemCreateInput): WorkItem;
  updateWorkItem(workItemId: WorkItemId, input: WorkItemUpdateInput): WorkItem;
  transitionWorkItem(
    workItemId: WorkItemId,
    to: WorkItemStatus,
    override?: { readonly actorId: string; readonly reason: string; readonly scope: string },
  ): WorkItem;
  claimWorkItem(workItemId: WorkItemId, input: { roleId: RoleId; actorId: string }): WorkItem;
  unclaimWorkItem(workItemId: WorkItemId, actorId: string): WorkItem;
  getWorkItemTree(rootId: WorkItemId): WorkItemTreeNode;
  getBoardView(query?: BoardViewQuery): BoardView;
  getAcceptanceCoverage(rootId: WorkItemId): AcceptanceCoverageSummary;
  getMilestoneSummary(milestoneId: MilestoneId): MilestoneSummary;
  getMilestoneBoard(projectId?: ProjectId): MilestoneBoard;
  /** @deprecated Use `listWorkItems`. */
  listCards(projectId?: ProjectId): readonly Card[];
  /** @deprecated Use `getWorkItem`. */
  getCard(cardId: CardId): Card | undefined;
  /** @deprecated Use `createWorkItem`. */
  createCard(input: WorkItemCreateInput): Card;
  /** @deprecated Use `updateWorkItem`. */
  updateCard(cardId: CardId, input: WorkItemUpdateInput): Card;
  /** @deprecated Use `claimWorkItem`. */
  claimCard(cardId: CardId, input: { roleId: RoleId; actorId: string }): Card;
  /** @deprecated Use `unclaimWorkItem`. */
  unclaimCard(cardId: CardId, actorId: string): Card;
  /** @deprecated Use `transitionWorkItem`. */
  transitionCard(cardId: CardId, to: WorkItemStatus): Card;
  registerGate(gate: TransitionGate): void;
}

export function createBoardService(
  workspaceRoot: string,
  options: BoardStoreOptions = {},
): BoardService {
  const store = new BoardStore(workspaceRoot, options);
  for (const gate of loadGateManifest(workspaceRoot)) {
    store.registerGate(gate);
  }
  return {
    listProjects: (filter) => store.listProjects(filter),
    listAuditEvents: (filter) => store.listAuditEvents(filter),
    recordAuditEvent: (input) => store.recordAuditEvent(input),
    listMilestones: (filter) => store.listMilestones(filter),
    getMilestone: (milestoneId) => store.getMilestone(milestoneId),
    createMilestone: (input) => store.createMilestone(input),
    updateMilestone: (milestoneId, input) => store.updateMilestone(milestoneId, input),
    assignWorkItemToMilestone: (workItemId, milestoneId) =>
      store.assignWorkItemToMilestone(workItemId, milestoneId),
    listTeamMembers: (filter) => store.listTeamMembers(filter),
    getTeamMember: (memberId) => store.getTeamMember(memberId),
    createTeamMember: (input) => store.createTeamMember(input),
    updateTeamMember: (memberId, input) => store.updateTeamMember(memberId, input),
    addTeamMemberRole: (memberId, roleId) => store.addTeamMemberRole(memberId, roleId),
    removeTeamMemberRole: (memberId, roleId) => store.removeTeamMemberRole(memberId, roleId),
    addWorkItemReviewer: (workItemId, memberId) => store.addWorkItemReviewer(workItemId, memberId),
    removeWorkItemReviewer: (workItemId, memberId) => store.removeWorkItemReviewer(workItemId, memberId),
    addWorkItemApprover: (workItemId, memberId) => store.addWorkItemApprover(workItemId, memberId),
    removeWorkItemApprover: (workItemId, memberId) => store.removeWorkItemApprover(workItemId, memberId),
    addWorkItemWatcher: (workItemId, memberId) => store.addWorkItemWatcher(workItemId, memberId),
    removeWorkItemWatcher: (workItemId, memberId) => store.removeWorkItemWatcher(workItemId, memberId),
    replaceTeamWipPolicies: (projectId, policies) => store.replaceTeamWipPolicies(projectId, policies),
    listTeamWipPolicies: (projectId) => store.listTeamWipPolicies(projectId),
    assignWorkItem: (workItemId, input) => store.assignWorkItem(workItemId, input),
    getTeamCapacity: (projectId) => store.getTeamCapacity(projectId),
    listWorkflowBoardSummaries: (filter) => store.listWorkflowBoardSummaries(filter),
    getWorkflowBoardSummary: (workItemId) => store.getWorkflowBoardSummary(workItemId),
    updateWorkflowBoardSummary: (workItemId, input) =>
      store.updateWorkflowBoardSummary(workItemId, input),
    getStoryPriorityQueue: (projectId, filter) => store.getStoryPriorityQueue(projectId, filter),
    listDeliveryEvidenceSummaries: (filter) => store.listDeliveryEvidenceSummaries(filter),
    getDeliveryEvidenceSummary: (workItemId) => store.getDeliveryEvidenceSummary(workItemId),
    updateDeliveryEvidenceSummary: (workItemId, input) =>
      store.updateDeliveryEvidenceSummary(workItemId, input),
    getProjectDeliveryEvidenceRollup: (projectId, filter) =>
      store.getProjectDeliveryEvidenceRollup(projectId, filter),
    listIntakeSessions: (filter) => store.listIntakeSessions(filter),
    getIntakeSession: (sessionId) => store.getIntakeSession(sessionId),
    getIntakeSessionBundle: (sessionId) => store.getIntakeSessionBundle(sessionId),
    createIntakeSession: (input) => store.createIntakeSession(input),
    updateIntakeSession: (sessionId, input) => store.updateIntakeSession(sessionId, input),
    addIntakeMessage: (sessionId, input) => store.addIntakeMessage(sessionId, input),
    clarifyIntakeSession: (sessionId) => store.clarifyIntakeSession(sessionId),
    answerIntakeFollowUp: (sessionId, input) => store.answerIntakeFollowUp(sessionId, input),
    addIntakeSourceDocument: (sessionId, input) => store.addIntakeSourceDocument(sessionId, input),
    analyzeIntakeSession: (sessionId, input) => store.analyzeIntakeSession(sessionId, input ?? {}),
    listIntakeCandidates: (filter) => store.listIntakeCandidates(filter),
    updateIntakeCandidate: (candidateId, input) => store.updateIntakeCandidate(candidateId, input),
    approveIntakeCandidates: (sessionId, input) => store.approveIntakeCandidates(sessionId, input),
    listMilestoneDeliverySlices: (filter) => store.listMilestoneDeliverySlices(filter),
    createMilestoneDeliverySlice: (input) => store.createMilestoneDeliverySlice(input),
    updateMilestoneDeliverySlice: (sliceId, input) =>
      store.updateMilestoneDeliverySlice(sliceId, input),
    listWorkItems: (filter) => store.listWorkItems(filter),
    getWorkItem: (workItemId) => store.getWorkItem(workItemId),
    createWorkItem: (input) => store.createWorkItem(input),
    updateWorkItem: (workItemId, input) => store.updateWorkItem(workItemId, input),
    transitionWorkItem: (workItemId, to, override) => store.transitionWorkItem(workItemId, to, override),
    claimWorkItem: (workItemId, input) => store.claimWorkItem(workItemId, input),
    unclaimWorkItem: (workItemId, actorId) => store.unclaimWorkItem(workItemId, actorId),
    getWorkItemTree: (rootId) => store.getWorkItemTree(rootId),
    getBoardView: (query) => store.getBoardView(query),
    getAcceptanceCoverage: (rootId) => store.getAcceptanceCoverage(rootId),
    getMilestoneSummary: (milestoneId) => store.getMilestoneSummary(milestoneId),
    getMilestoneBoard: (projectId) => store.getMilestoneBoard(projectId),
    listCards: (projectId) => store.listCards(projectId),
    getCard: (cardId) => store.getCard(cardId),
    createProject: (input) => store.createProject(input),
    updateProject: (projectId, input) => store.updateProject(projectId, input),
    enableAgent: (projectId, agentId) => store.enableAgent(projectId, agentId),
    disableAgent: (projectId, agentId) => store.disableAgent(projectId, agentId),
    customizeAgent: (projectId, agentId, input) => store.customizeAgent(projectId, agentId, input),
    prioritizationMethods: () => PRIORITIZATION_METHODS,
    overrideStoryRanking: (workItemId, input) => store.overrideStoryRanking(workItemId, input),
    clearStoryRankingOverride: (workItemId, input) => store.clearStoryRankingOverride(workItemId, input),
    inspectDeliveryGates: (workItemId, to) => store.inspectDeliveryGates(workItemId, to),
    archiveProject: (projectId, actor) => store.archiveProject(projectId, actor),
    restoreProject: (projectId, actor) => store.restoreProject(projectId, actor),
    archiveWorkItem: (workItemId, actor) => store.archiveWorkItem(workItemId, actor),
    restoreWorkItem: (workItemId, actor) => store.restoreWorkItem(workItemId, actor),
    createCard: (input) => store.createCard(input),
    updateCard: (cardId, input) => store.updateCard(cardId, input),
    claimCard: (cardId, input) => store.claimCard(cardId, input),
    unclaimCard: (cardId, actorId) => store.unclaimCard(cardId, actorId),
    transitionCard: (cardId, to) => store.transitionCard(cardId, to),
    registerGate: (gate) => {
      store.registerGate(gate);
    },
  };
}

const BoardPlugin: Plugin<IntakeConfig> = {
  name: 'huntianling:board',
  inject: ['huntianling.database'],

  apply(ctx: Context, config: IntakeConfig = {}): void {
    const configured = ctx.get('huntianling.workspaceRoot');
    const root = resolveWorkspaceRoot({
      ...(typeof configured === 'string' ? { explicit: configured } : {}),
      env: process.env,
    });
    const database = ctx.get('huntianling.database') as DatabaseService | undefined;
    const service = createBoardService(root, {
      ...(database !== undefined ? { database } : {}),
      intake: config,
      env: process.env,
    });
    ctx.provide('huntianling.board', service);
  },
};

export default BoardPlugin;
