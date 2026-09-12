import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { RequirementManagementService, RequirementChildType } from '../agile/requirements.js';
import { createAgentRuntime, type AgentRuntime } from '../agents/runtime.js';
import type { AuthorityService } from '../authority/service.js';
import { AuthorityError, type AuthorityAction } from '../authority/types.js';
import type { DatabaseService } from '../database/types.js';
import { canvasFromUnknown } from '../workflow/canvas.js';
import type { WorkflowService } from '../workflow/service.js';
import { WorkflowError } from '../workflow/types.js';
import type { DispatchService } from '../dispatch/service.js';
import { DispatchError } from '../dispatch/types.js';
import type { SkillService } from '../skills/service.js';
import { SkillWriteError } from '../skills/types.js';
import { DatabaseError } from '../database/types.js';
import { AgentTaskError, isSpecialistAgentId, type AgentId } from '../agents/types.js';
import { requireAgentId } from '../agents/definitions.js';
import {
  resolveEvidenceExecutionKind,
  resolveEvidenceProducer,
} from '../board/executed-evidence.js';
import type { BoardService } from '../board/plugin.js';
import { createCiService, type CiService } from '../ci/service.js';
import { CiError } from '../ci/types.js';
import type { DeliveryService } from '../delivery/service.js';
import { DeliveryError } from '../delivery/types.js';
import type { HarnessService } from '../harness/service.js';
import { HarnessError } from '../harness/types.js';
import { createCollabService, type CollabService } from '../collab/service.js';
import { createScmService, type ScmService } from '../scm/service.js';
import { ScmError } from '../scm/types.js';
import { ChannelWriteError, type ChannelMessage } from '../collab/types.js';
import { ToolDeniedError, ToolInvokeError } from '../tools/types.js';
import { allowedParentTypes } from '../board/work-item.js';
import {
  isPrioritizationMethodId,
  normalizeRankingInputs,
} from '../board/prioritization.js';
import {
  DONE_CHECK_KINDS,
  READY_CHECK_KINDS,
  DELIVERY_EVIDENCE_AREAS,
  DELIVERY_EVIDENCE_LINK_KINDS,
  DELIVERY_EVIDENCE_STATUSES,
  DELIVERY_RISK_ACCEPTANCE_STATUSES,
  DELIVERY_RISK_AREAS,
  GOVERNANCE_OBLIGATION_STATUSES,
  INTAKE_CANDIDATE_STATUSES,
  INTAKE_CANDIDATE_TYPES,
  INTAKE_MESSAGE_ROLES,
  INTAKE_SESSION_STATUSES,
  INTAKE_SOURCE_KINDS,
  INTAKE_SOURCE_PARSE_STATUSES,
  MILESTONE_STATUSES,
  TEAM_MEMBER_STATUSES,
  TEAM_MEMBER_TYPES,
  TEAM_WIP_KINDS,
  TEAM_WIP_SCOPES,
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
  type AuditEventFilter,
  type BoardGroupBy,
  type BoardViewQuery,
  type BoardViewColumn,
  type DeliveryEvidenceArea,
  type DeliveryEvidenceCheck,
  type DeliveryEvidenceLink,
  type DeliveryEvidenceLinkKind,
  type DeliveryEvidenceStatus,
  type DeliveryEvidenceSummary,
  type DeliveryEvidenceSummaryInput,
  type DeliveryRiskAcceptance,
  type DeliveryRiskAcceptanceStatus,
  type DeliveryRiskArea,
  type GovernanceObligationStatus,
  type GovernanceObligationSummary,
  type IntakeCandidateId,
  type IntakeCandidateRequirement,
  type IntakeCandidateSourceRef,
  type IntakeCandidateStatus,
  type IntakeCandidateType,
  type IntakeCandidateUpdateInput,
  type IntakeMessage,
  type IntakeMessageCreateInput,
  type IntakeMessageId,
  type IntakeMessageRole,
  type IntakeSession,
  type IntakeSessionCreateInput,
  type IntakeSessionId,
  type IntakeSessionStatus,
  type IntakeSessionUpdateInput,
  type IntakeSourceChunk,
  type IntakeSourceDocument,
  type IntakeSourceDocumentCreateInput,
  type IntakeSourceDocumentId,
  type IntakeSourceKind,
  type IntakeSourceParseStatus,
  type IntakeSourceChunkId,
  type Milestone,
  type MilestoneId,
  type MilestoneDeliverySlice,
  type MilestoneDeliverySliceCreateInput,
  type MilestoneDeliverySliceId,
  type MilestoneDeliverySliceUpdateInput,
  type MilestoneSummary,
  type MilestoneStatus,
  type DoneCheckKind,
  type Project,
  type ProjectDeliveryPolicy,
  type ProjectId,
  type ReadyCheckKind,
  type RoleId,
  type TeamCapacityMemberSummary,
  type TeamCapacitySummary,
  type TeamMember,
  type TeamMemberCreateInput,
  type TeamMemberId,
  type TeamMemberStatus,
  type TeamMemberType,
  type TeamMemberUpdateInput,
  type TeamWipKind,
  type TeamWipPolicyInput,
  type TeamWipScope,
  type StoryPriorityQueue,
  type StoryPriorityQueueFilter,
  type WorkItem,
  type WorkItemAssignmentInput,
  type WorkItemCreateInput,
  type WorkItemFilter,
  type WorkItemId,
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkItemTreeNode,
  type WorkItemType,
  type WorkItemUpdateInput,
  type WorkflowBoardControl,
  type WorkflowBoardLink,
  type WorkflowBoardLinkKind,
  type WorkflowBoardSummary,
  type WorkflowBoardSummaryInput,
  type WorkflowCheckStatus,
  type WorkflowCheckSummary,
  type WorkflowRunStatus,
  type WorkflowStepStatus,
  type WorkflowStepSummary,
  type WorkflowWaitItem,
  type WorkflowWaitItemType,
} from '../board/types.js';
import {
  AuthHttpError,
  projectAccessAllowed,
  publicCredentialStatus,
  resolveWebAuthConfig,
  WebAuthManager,
  writeAuthCookie,
  type WebAuthPrincipal,
  type WebAuthRegion,
} from './auth.js';
import { audienceFromShellPath, resolveWebAuthAudience, shellPathForAudience } from './audience.js';
import { createCustomerBoard } from './customer-board.js';
import { createDeveloperBoard } from './developer-board.js';
import { createEnvironmentService } from '../environment/service.js';
import { createSkillService } from '../skills/service.js';
import type { EnvironmentService } from '../environment/service.js';
import { renderBoardPage } from './page.js';
import { renderAudienceDeniedPage, renderAudienceShellPage } from './pages/audience-shell.js';
import { renderAdminPage } from './pages/admin.js';
import { renderCustomerPage } from './pages/customer.js';
import { renderDeveloperPage } from './pages/developer.js';
import { renderWorkflowLabPage } from './pages/workflow-lab.js';
import { renderLoginPage } from './pages/login.js';
import type { ResolvedWebConfig, WebConfig, WebDisplaySurface, WebService, WebStatus } from './types.js';

export interface WebServiceDependencies {
  readonly board: BoardService;
  readonly requirements: RequirementManagementService;
  readonly collab?: CollabService;
  readonly environment?: EnvironmentService;
  readonly scm?: ScmService;
  readonly ci?: CiService;
  readonly agents?: AgentRuntime;
  readonly delivery?: DeliveryService;
  readonly harness?: HarnessService;
  readonly authority?: AuthorityService;
  readonly database?: DatabaseService;
  readonly workflow?: WorkflowService;
  readonly dispatch?: DispatchService;
  readonly skills?: SkillService;
  readonly oauthExchange?: import('./oauth.js').OAuthExchange;
}

const WORK_ITEM_TYPES: readonly WorkItemType[] = [
  'epic',
  'feature',
  'requirement',
  'story',
  'task',
  'bug',
  'defect',
  'research',
  'discussion',
  'meeting',
  'decision',
  'brainstorm',
];

const REQUIREMENT_CHILD_TYPES: readonly RequirementChildType[] = [
  'epic',
  'feature',
  'requirement',
  'story',
  'task',
  'bug',
  'research',
];

const PRIORITIES: readonly WorkItemPriority[] = ['p0', 'p1', 'p2', 'p3'];
const BOARD_GROUPS: readonly BoardGroupBy[] = [
  'status',
  'parent',
  'milestone',
  'type',
  'assignee',
  'claimedRole',
];

interface MainBoardViewDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly groupBy: BoardGroupBy;
  readonly types?: readonly WorkItemType[];
}

interface MainBoardWarning {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'blocking';
  readonly message: string;
}

interface MainBoardCard {
  readonly id: WorkItemId;
  readonly workItem: WorkItem;
  readonly assigneeMember: TeamMember | null;
  readonly parentBreadcrumb: readonly WorkItemCrumb[];
  readonly childRollup: ChildRollup;
  readonly acceptanceRollup: AcceptanceCoverageSummary;
  readonly milestone: Milestone | null;
  readonly workflowSummary: WorkflowBoardSummary;
  readonly evidenceSummary: EvidenceBoardSummary;
  readonly governanceSummary: GovernanceBoardSummary;
  readonly warnings: readonly MainBoardWarning[];
}

interface WorkItemIntakeSourceDocumentSummary {
  readonly id: IntakeSourceDocumentId;
  readonly kind: IntakeSourceKind;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly parseStatus: IntakeSourceParseStatus;
  readonly parseError: string;
  readonly storedFileId: string | null;
  readonly createdAt: number;
}

interface WorkItemIntakeSourceReference {
  readonly sourceRef: IntakeCandidateSourceRef;
  readonly message: IntakeMessage | null;
  readonly sourceDocument: WorkItemIntakeSourceDocumentSummary | null;
  readonly chunk: IntakeSourceChunk | null;
}

interface WorkItemIntakeOrigin {
  readonly session: IntakeSession;
  readonly candidate: IntakeCandidateRequirement;
  readonly sourceRefs: readonly WorkItemIntakeSourceReference[];
}

interface MainBoardColumn {
  readonly id: string;
  readonly title: string;
  readonly cards: readonly MainBoardCard[];
}

interface MainBoardTree {
  readonly roots: readonly MainBoardTreeNode[];
  readonly total: number;
  readonly maxDepth: number;
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardTreeNode {
  readonly card: MainBoardCard;
  readonly children: readonly MainBoardTreeNode[];
}

interface MainBoardCoverage {
  readonly parents: readonly MainBoardCoverageParent[];
  readonly totalCriteria: number;
  readonly coveredCriteria: number;
  readonly uncoveredCriteria: number;
  readonly duplicateCoveredCriteria: number;
  readonly complete: boolean;
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardCoverageParent {
  readonly parent: WorkItemCrumb;
  readonly coverage: AcceptanceCoverageSummary;
  readonly totalCriteria: number;
  readonly coveredCriteria: number;
  readonly uncoveredCriteria: number;
  readonly duplicateCoveredCriteria: number;
  readonly coveringWorkItems: readonly WorkItemCrumb[];
  readonly rows: readonly MainBoardCoverageCriterion[];
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardCoverageCriterion {
  readonly criterionId: AcceptanceCriterionId;
  readonly text: string;
  readonly parent: WorkItemCrumb;
  readonly coveredBy: readonly WorkItemCrumb[];
  readonly evidenceCount: number;
  readonly complete: boolean;
  readonly duplicateCoverage: boolean;
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardMilestoneBoard {
  readonly lanes: readonly MainBoardMilestoneLane[];
  readonly totalSlices: number;
  readonly completedSlices: number;
  readonly openSlices: number;
  readonly blockedSlices: number;
  readonly percentSlicesComplete: number;
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardMilestoneLane {
  readonly id: string;
  readonly title: string;
  readonly milestone: Milestone | null;
  readonly summary: MilestoneSummary | null;
  readonly cards: readonly MainBoardCard[];
  readonly slices: readonly MainBoardDeliverySliceCard[];
  readonly rollup: MainBoardMilestoneLaneRollup;
}

interface MainBoardMilestoneLaneRollup {
  readonly totalWorkItems: number;
  readonly deliveredWorkItems: number;
  readonly openWorkItems: number;
  readonly blockedWorkItems: number;
  readonly totalSlices: number;
  readonly completedSlices: number;
  readonly openSlices: number;
  readonly blockedSlices: number;
  readonly percentDelivered: number;
  readonly percentSlicesComplete: number;
}

interface MainBoardDeliverySliceCard {
  readonly slice: MilestoneDeliverySlice;
  readonly parent: WorkItemCrumb;
  readonly milestone: Milestone;
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  readonly coveringWorkItems: readonly WorkItemCrumb[];
  readonly evidenceCount: number;
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardMilestonePlan {
  readonly parent: MainBoardCard;
  readonly slices: readonly MainBoardDeliverySliceCard[];
  readonly milestoneRollups: readonly MainBoardMilestonePlanRollup[];
  readonly totalSlices: number;
  readonly completedSlices: number;
  readonly openSlices: number;
  readonly blockedSlices: number;
  readonly percentComplete: number;
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardMilestonePlanRollup {
  readonly milestone: Milestone | null;
  readonly workItems: readonly WorkItemCrumb[];
  readonly slices: readonly MainBoardDeliverySliceCard[];
  readonly totalWorkItems: number;
  readonly deliveredWorkItems: number;
  readonly openWorkItems: number;
  readonly blockedWorkItems: number;
  readonly completedSlices: number;
  readonly openSlices: number;
  readonly percentDelivered: number;
}

interface MainBoardTeamBoard {
  readonly capacity: TeamCapacitySummary;
  readonly members: readonly MainBoardTeamMemberLane[];
  readonly unassignedCards: readonly MainBoardCard[];
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardTeamMemberLane {
  readonly member: TeamMember;
  readonly summary: TeamCapacityMemberSummary;
  readonly roleNames: readonly string[];
  readonly assignedCards: readonly MainBoardCard[];
}

interface MainBoardTeamContext {
  readonly members: readonly TeamMember[];
  readonly capacity: TeamCapacitySummary;
}

interface MainBoardWorkflowBoard {
  readonly storyQueue: StoryPriorityQueue;
  readonly lifecycleLanes: readonly MainBoardLifecycleLane[];
  readonly lifecycleCoverage: MainBoardLifecycleCoverage;
  readonly lanes: readonly MainBoardWorkflowLane[];
  readonly summaries: readonly MainBoardWorkflowCard[];
  readonly activeWorkflows: number;
  readonly blockedWorkflows: number;
  readonly waitingApprovals: number;
  readonly waitingReviews: number;
  readonly failedChecks: number;
  readonly warnings: readonly MainBoardWarning[];
}

type MainBoardLifecycleLaneId =
  | 'intake'
  | 'analysis'
  | 'design'
  | 'breakdown'
  | 'planning'
  | 'ready'
  | 'implementation'
  | 'review'
  | 'verification'
  | 'quality-gates'
  | 'delivery'
  | 'exception';

interface MainBoardLifecycleLaneDefinition {
  readonly id: MainBoardLifecycleLaneId;
  readonly title: string;
  readonly description: string;
  readonly owner: string;
  readonly statuses: readonly WorkItemStatus[];
  readonly evidenceAreas: readonly DeliveryEvidenceArea[];
}

interface MainBoardLifecycleLane extends MainBoardLifecycleLaneDefinition {
  readonly cards: readonly MainBoardWorkflowCard[];
  readonly totalCards: number;
  readonly blockedCards: number;
  readonly readyCards: number;
  readonly missingEvidenceCards: number;
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardLifecycleCoverage {
  readonly totalLanes: number;
  readonly occupiedLanes: number;
  readonly totalCards: number;
  readonly blockedCards: number;
  readonly missingEvidenceCards: number;
  readonly mappedStatuses: readonly WorkItemStatus[];
  readonly unmappedStatuses: readonly WorkItemStatus[];
}

interface MainBoardWorkflowLane {
  readonly id: WorkflowRunStatus;
  readonly title: string;
  readonly cards: readonly MainBoardWorkflowCard[];
}

interface MainBoardWorkflowCard {
  readonly card: MainBoardCard;
  readonly summary: WorkflowBoardSummary;
  readonly schedulerReason: string;
  readonly blockedReasonCodes: readonly string[];
}

interface MainBoardEvidenceBoard {
  readonly lanes: readonly MainBoardEvidenceLane[];
  readonly summaries: readonly MainBoardEvidenceCard[];
  readonly rollup: ReturnType<BoardService['getProjectDeliveryEvidenceRollup']>;
  readonly warnings: readonly MainBoardWarning[];
}

interface MainBoardEvidenceLane {
  readonly id: 'blocked' | 'missing' | 'pending' | 'passing';
  readonly title: string;
  readonly cards: readonly MainBoardEvidenceCard[];
}

interface MainBoardEvidenceCard {
  readonly card: MainBoardCard;
  readonly summary: DeliveryEvidenceSummary;
  readonly laneId: MainBoardEvidenceLane['id'];
  readonly blockedReasonCodes: readonly string[];
}

interface WorkItemCrumb {
  readonly id: WorkItemId;
  readonly type: WorkItemType;
  readonly title: string;
}

interface ChildRollup {
  readonly total: number;
  readonly unfinished: number;
  readonly delivered: number;
  readonly blocked: number;
}

interface EvidenceBoardSummary {
  readonly summary: DeliveryEvidenceSummary;
  readonly evidenceCount: number;
  readonly codeLinkCount: number;
  readonly pullRequestCount: number;
  readonly reviewCount: number;
  readonly ciRunCount: number;
  readonly hasAcceptanceEvidence: boolean;
  readonly requiredChecks: number;
  readonly passingChecks: number;
  readonly pendingChecks: number;
  readonly missingRequiredChecks: number;
  readonly failedRequiredChecks: number;
  readonly blockedRequiredChecks: number;
  readonly missingEvidence: readonly string[];
  readonly blockers: readonly DeliveryEvidenceCheck[];
}

interface GovernanceBoardSummary {
  readonly required: boolean;
  readonly blockers: readonly string[];
  readonly obligations: number;
  readonly unapprovedObligations: number;
  readonly openRiskAcceptances: number;
}

interface RequestAuth {
  readonly manager: WebAuthManager;
  readonly principal: WebAuthPrincipal | null;
}

type BusinessCrudOperationKind = 'create' | 'read' | 'update' | 'lifecycle' | 'delete';
type BusinessCrudOperationStatus = 'implemented' | 'partial' | 'planned' | 'not_applicable' | 'forbidden';
type BusinessCrudEntityStatus = 'complete' | 'usable' | 'partial' | 'planned';

interface BusinessCrudOperation {
  readonly kind: BusinessCrudOperationKind;
  readonly status: BusinessCrudOperationStatus;
  readonly label: string;
  readonly endpoints: readonly string[];
  readonly note: string;
}

interface BusinessCrudEntityCoverage {
  readonly id: string;
  readonly areaId: string;
  readonly name: string;
  readonly owner: string;
  readonly record: string;
  readonly implementationStatus: BusinessCrudEntityStatus;
  readonly deletePolicy: string;
  readonly operations: readonly BusinessCrudOperation[];
  readonly gaps: readonly string[];
  readonly recommendedNextSlice: string;
}

interface BusinessCrudCoverage {
  readonly projectId: ProjectId;
  readonly generatedAt: number;
  readonly summary: {
    readonly entities: number;
    readonly complete: number;
    readonly usable: number;
    readonly partial: number;
    readonly planned: number;
    readonly gaps: number;
  };
  readonly entities: readonly BusinessCrudEntityCoverage[];
}

const MAIN_BOARD_VIEWS: readonly MainBoardViewDefinition[] = [
  {
    id: 'requirement-board',
    title: 'Requirement board',
    description: 'Requirements and Stories grouped by lifecycle status.',
    groupBy: 'status',
    types: ['epic', 'feature', 'requirement', 'story', 'task', 'bug', 'research'],
  },
  {
    id: 'tree-board',
    title: 'Tree board',
    description: 'WorkItems grouped by parent so decomposition remains visible.',
    groupBy: 'parent',
  },
  {
    id: 'coverage-board',
    title: 'Coverage board',
    description: 'Acceptance criteria mapped to child WorkItems and evidence gaps.',
    groupBy: 'parent',
    types: ['epic', 'feature', 'requirement', 'story'],
  },
  {
    id: 'milestone-board',
    title: 'Milestone board',
    description: 'WorkItems grouped by delivery Milestone.',
    groupBy: 'milestone',
  },
  {
    id: 'delivery-board',
    title: 'Delivery board',
    description: 'Implementation, review, verification, and delivery work.',
    groupBy: 'status',
    types: ['task', 'bug', 'defect', 'research'],
  },
  {
    id: 'team-board',
    title: 'Team board',
    description: 'WorkItems grouped by assignee for capacity and ownership review.',
    groupBy: 'assignee',
  },
  {
    id: 'role-board',
    title: 'Role board',
    description: 'WorkItems grouped by claimed Project role.',
    groupBy: 'claimedRole',
  },
  {
    id: 'workflow-board',
    title: 'Workflow board',
    description: 'Workflow summaries, waiting approvals, review state, and scheduler reasons.',
    groupBy: 'status',
    types: ['requirement', 'story', 'task', 'bug', 'defect', 'research'],
  },
  {
    id: 'evidence-board',
    title: 'Evidence board',
    description: 'Code, CI, review, evidence, governance, security, reliability, and trust rollups.',
    groupBy: 'status',
    types: ['requirement', 'story', 'task', 'bug', 'defect', 'research'],
  },
];

const CLOSED_STATUSES: readonly WorkItemStatus[] = ['delivered', 'rejected', 'stopped'];
const ACTIVE_WORKFLOW_RUN_STATUSES: readonly WorkflowRunStatus[] = [
  'queued',
  'running',
  'waiting',
  'blocked',
  'in_review',
  'verifying',
];
const WORKFLOW_LANE_DEFINITIONS: readonly { readonly id: WorkflowRunStatus; readonly title: string }[] = [
  { id: 'running', title: 'Running' },
  { id: 'waiting', title: 'Waiting' },
  { id: 'blocked', title: 'Blocked' },
  { id: 'in_review', title: 'In review' },
  { id: 'verifying', title: 'Verifying' },
  { id: 'ready', title: 'Ready' },
  { id: 'queued', title: 'Queued' },
  { id: 'not_started', title: 'Not started' },
  { id: 'failed', title: 'Failed' },
  { id: 'completed', title: 'Completed' },
  { id: 'cancelled', title: 'Cancelled' },
];
const AGILE_LIFECYCLE_LANE_DEFINITIONS: readonly MainBoardLifecycleLaneDefinition[] = [
  {
    id: 'intake',
    title: '需求录入',
    description: '收集 idea、对话和来源材料，形成可澄清的需求入口。',
    owner: '业务/PO',
    statuses: ['inbox'],
    evidenceAreas: [],
  },
  {
    id: 'analysis',
    title: '需求分析',
    description: '澄清业务目标、用户场景、约束、风险和开放问题。',
    owner: 'BA/PO',
    statuses: ['analyzing'],
    evidenceAreas: [],
  },
  {
    id: 'design',
    title: '方案设计',
    description: '形成产品设计、技术设计、交互方案和验收口径。',
    owner: 'UX/Architect',
    statuses: ['designing'],
    evidenceAreas: [],
  },
  {
    id: 'breakdown',
    title: '拆分评审',
    description: '拆成可交付 Story/Task，检查父子关系和验收覆盖。',
    owner: 'PO/BA',
    statuses: ['triaged'],
    evidenceAreas: ['acceptance'],
  },
  {
    id: 'planning',
    title: '里程碑计划',
    description: '绑定 Milestone、Delivery Slice、优先级和容量计划。',
    owner: 'PO/PM',
    statuses: ['planned'],
    evidenceAreas: [],
  },
  {
    id: 'ready',
    title: 'Ready 调度',
    description: 'DoR、依赖、角色、技能、工具和容量满足后进入调度。',
    owner: 'Scrum Master',
    statuses: ['ready'],
    evidenceAreas: [],
  },
  {
    id: 'implementation',
    title: '开发实现',
    description: '开发人员或 Agent 执行任务，并绑定代码与变更证据。',
    owner: 'Developer/Agent',
    statuses: ['in_progress'],
    evidenceAreas: ['code'],
  },
  {
    id: 'review',
    title: '代码评审',
    description: '审查 PR、差异、设计一致性、风险和回归影响。',
    owner: 'Reviewer/Tech Lead',
    statuses: ['in_review'],
    evidenceAreas: ['review'],
  },
  {
    id: 'verification',
    title: 'QA 验证',
    description: '执行验收、测试、缺陷回归和交付范围确认。',
    owner: 'QA',
    statuses: ['verifying'],
    evidenceAreas: ['acceptance', 'ci'],
  },
  {
    id: 'quality-gates',
    title: '安全可靠可信门禁',
    description: '检查 CI、治理、安全、可靠性、可信和风险接受状态。',
    owner: 'Security/Reliability/Compliance',
    statuses: ['gates_passing'],
    evidenceAreas: ['ci', 'governance', 'security', 'reliability', 'trust'],
  },
  {
    id: 'delivery',
    title: '交付完成',
    description: 'DoD 和交付证据满足后，形成可追溯的发布结论。',
    owner: 'Release/PO',
    statuses: ['delivered'],
    evidenceAreas: ['evidence'],
  },
  {
    id: 'exception',
    title: '异常关闭',
    description: '记录拒绝、停止、作废和保留原因，防止无证据关闭。',
    owner: 'PO/Scrum Master',
    statuses: ['rejected', 'stopped'],
    evidenceAreas: [],
  },
];
const EVIDENCE_LANE_DEFINITIONS: readonly Omit<MainBoardEvidenceLane, 'cards'>[] = [
  { id: 'blocked', title: 'Blocked evidence' },
  { id: 'missing', title: 'Missing required evidence' },
  { id: 'pending', title: 'Pending evidence' },
  { id: 'passing', title: 'Evidence ready' },
];

const BUSINESS_CRUD_ENTITIES: readonly BusinessCrudEntityCoverage[] = [
  {
    id: 'project',
    areaId: 'admin',
    name: 'Project',
    owner: '管理员',
    record: '项目、角色和工作区容器',
    implementationStatus: 'usable',
    deletePolicy: 'Project 是数据容器，默认不允许硬删除；需要归档和恢复。',
    operations: [
      crudOperation('create', 'implemented', '新建项目', ['/api/v1/projects', '/api/projects']),
      crudOperation('read', 'implemented', '读取项目和主看板', ['/api/v1/projects', '/api/v1/projects/:id/main-board']),
      crudOperation('update', 'implemented', '编辑项目名称和描述', ['/api/v1/projects/:id']),
      crudOperation('lifecycle', 'implemented', '归档和恢复项目', [
        '/api/v1/projects/:id/archive',
        '/api/v1/projects/:id/restore',
      ]),
      crudOperation('delete', 'forbidden', '业务项目不做普通硬删除', []),
    ],
    gaps: ['Project role management API'],
    recommendedNextSlice: '补项目角色配置更新。',
  },
  {
    id: 'work-item',
    areaId: 'requirements',
    name: 'WorkItem',
    owner: 'PO/BA/敏捷团队',
    record: 'Epic、Feature、Requirement、Story、Task、Bug、Research',
    implementationStatus: 'usable',
    deletePolicy: '需求和任务通过 rejected、stopped 或 delivered 关闭；硬删除会破坏追踪。',
    operations: [
      crudOperation('create', 'implemented', '通过需求服务和版本化接口创建', [
        '/api/v1/work-items',
        '/api/requirements/:type',
        '/api/work-items',
      ]),
      crudOperation('read', 'implemented', '读取详情、树、覆盖度、主看板和追踪', [
        '/api/v1/work-items/:id/board-detail',
        '/api/v1/work-items/:id/traceability',
        '/api/v1/projects/:id/main-board',
      ]),
      crudOperation('update', 'implemented', '编辑分析、设计、父项、优先级、里程碑和验收', [
        '/api/v1/work-items/:id/board-detail',
        '/api/work-items/:id',
      ]),
      crudOperation('lifecycle', 'implemented', '通过状态流转、归档和恢复关闭或推进', [
        '/api/v1/work-items/:id/status',
        '/api/v1/work-items/:id/archive',
        '/api/v1/work-items/:id/restore',
        '/api/work-items/:id/transition',
      ]),
      crudOperation('delete', 'forbidden', '需求生命周期不使用普通 DELETE', []),
    ],
    gaps: ['Archive/restore reason field'],
    recommendedNextSlice: '把关闭原因纳入归档审计。',
  },
  {
    id: 'requirement-hierarchy',
    areaId: 'requirements',
    name: 'Requirement hierarchy',
    owner: 'PO/BA',
    record: '父子需求拆分和验收覆盖',
    implementationStatus: 'usable',
    deletePolicy: '拆分历史必须保留；错误拆分使用重新挂接、拒绝或停止处理。',
    operations: [
      crudOperation('create', 'implemented', '创建各层级需求和拆分子项', [
        '/api/requirements/epics',
        '/api/requirements/features',
        '/api/requirements/requirements',
        '/api/requirements/stories',
        '/api/requirements/:id/split',
      ]),
      crudOperation('read', 'implemented', '读取树和验收覆盖', [
        '/api/requirements/:id/tree',
        '/api/requirements/:id/coverage',
      ]),
      crudOperation('update', 'implemented', '更新需求详情和父项', ['/api/requirements/:id', '/api/v1/work-items/:id/board-detail']),
      crudOperation('lifecycle', 'implemented', '沿用 WorkItem 状态流转和门禁', ['/api/work-items/:id/transition']),
      crudOperation('delete', 'forbidden', '拆分节点不硬删', []),
    ],
    gaps: ['Bulk reparent API', 'Split undo/revision API', 'Decomposition review API'],
    recommendedNextSlice: '补拆分评审、批量挂接和拆分修订记录。',
  },
  {
    id: 'milestone',
    areaId: 'planning',
    name: 'Milestone',
    owner: 'PO/PM',
    record: '交付里程碑、目标、日期和状态',
    implementationStatus: 'usable',
    deletePolicy: '里程碑可取消或归档；已绑定范围的里程碑不应硬删除。',
    operations: [
      crudOperation('create', 'implemented', '新建里程碑', ['/api/v1/projects/:id/milestones', '/api/milestones']),
      crudOperation('read', 'implemented', '读取里程碑、摘要、计划看板', [
        '/api/v1/projects/:id/main-board/milestones',
        '/api/milestones/:id',
        '/api/milestones/:id/summary',
      ]),
      crudOperation('update', 'implemented', '更新标题、目标、日期和状态', ['/api/milestones/:id']),
      crudOperation('lifecycle', 'implemented', '通过 status=cancelled/completed 管理生命周期', ['/api/milestones/:id']),
      crudOperation('delete', 'forbidden', '里程碑不做普通硬删除', []),
    ],
    gaps: ['Versioned milestone update API', 'Milestone archive/restore API', 'Scope movement audit detail'],
    recommendedNextSlice: '补 v1 Milestone PATCH 与归档语义。',
  },
  {
    id: 'delivery-slice',
    areaId: 'planning',
    name: 'Delivery Slice',
    owner: 'PO/PM/交付负责人',
    record: '父需求跨里程碑交付范围',
    implementationStatus: 'usable',
    deletePolicy: '交付切片影响父需求完整性，错误切片应 void/replace 并保留审计。',
    operations: [
      crudOperation('create', 'implemented', '为父需求创建里程碑切片', ['/api/v1/work-items/:id/milestone-slices']),
      crudOperation('read', 'implemented', '读取父需求计划和里程碑切片', [
        '/api/v1/work-items/:id/milestone-plan',
        '/api/v1/milestones/:id/requirement-slices',
      ]),
      crudOperation('update', 'implemented', '更新范围、验收、证据、owner 和状态', [
        '/api/v1/work-items/:id/milestone-slices/:sliceId',
      ]),
      crudOperation('lifecycle', 'implemented', '通过切片 status 对齐目标状态', [
        '/api/v1/work-items/:id/milestone-slices/:sliceId',
      ]),
      crudOperation('delete', 'planned', '需要 void/replace 生命周期，而不是 DELETE', []),
    ],
    gaps: ['Delivery slice void/replace API', 'Slice-level evidence attachment API'],
    recommendedNextSlice: '补切片作废、替换和证据绑定。',
  },
  {
    id: 'intake-session',
    areaId: 'intake',
    name: 'Intake Session',
    owner: '业务/PO',
    record: '需求录入会话、消息、附件和候选需求',
    implementationStatus: 'usable',
    deletePolicy: '录入会话保留原始 idea 证据；关闭使用 approved/rejected/archive。',
    operations: [
      crudOperation('create', 'implemented', '创建项目录入会话', ['/api/v1/projects/:id/intake/sessions']),
      crudOperation('read', 'implemented', '读取会话 bundle 和候选项', [
        '/api/v1/intake/sessions/:id',
        '/api/v1/intake/sessions/:id/candidates',
      ]),
      crudOperation('update', 'implemented', '更新会话标题、状态、来源和分析状态', ['/api/v1/intake/sessions/:id']),
      crudOperation('lifecycle', 'implemented', '批准或拒绝候选需求', ['/api/v1/intake/sessions/:id/approve']),
      crudOperation('delete', 'planned', '需要 archive/redact 策略', []),
    ],
    gaps: ['Intake archive API', 'Source redaction API', 'Attachment parser retry API'],
    recommendedNextSlice: '补录入会话归档、来源材料重解析和敏感内容脱敏。',
  },
  {
    id: 'intake-message',
    areaId: 'intake',
    name: 'Intake Message',
    owner: '业务/PO',
    record: '用户和系统录入消息',
    implementationStatus: 'partial',
    deletePolicy: '消息是原始证据，默认不可改；需要单独的脱敏/撤回记录。',
    operations: [
      crudOperation('create', 'implemented', '追加会话消息', ['/api/v1/intake/sessions/:id/messages']),
      crudOperation('read', 'implemented', '通过会话 bundle 读取', ['/api/v1/intake/sessions/:id']),
      crudOperation('update', 'forbidden', '原始消息不可直接改写', []),
      crudOperation('lifecycle', 'planned', '需要撤回、脱敏和保留策略', []),
      crudOperation('delete', 'forbidden', '普通 DELETE 会破坏来源证据链', []),
    ],
    gaps: ['Message redact API', 'Message withdrawal event'],
    recommendedNextSlice: '补消息脱敏和撤回的审计模型。',
  },
  {
    id: 'source-document',
    areaId: 'intake',
    name: 'Source Document',
    owner: '业务/PO',
    record: '图片、Word、PDF、Markdown、文本和文件来源',
    implementationStatus: 'partial',
    deletePolicy: '来源文件需要保留引用、hash 和解析记录；删除需走保留/脱敏策略。',
    operations: [
      crudOperation('create', 'implemented', '添加来源文档记录', ['/api/v1/intake/sessions/:id/source-documents']),
      crudOperation('read', 'implemented', '通过会话 bundle 和 traceability 读取', [
        '/api/v1/intake/sessions/:id',
        '/api/v1/work-items/:id/traceability',
      ]),
      crudOperation('update', 'planned', '解析状态、hash、存储位置和重试结果需要可更新', []),
      crudOperation('lifecycle', 'planned', '需要重解析、标记 unsupported、脱敏、归档', []),
      crudOperation('delete', 'planned', '需要 retention-aware delete/redact', []),
    ],
    gaps: ['Source document update API', 'Parser retry API', 'Retention/redaction API'],
    recommendedNextSlice: '补文件持久化、解析状态更新和保留策略。',
  },
  {
    id: 'intake-candidate',
    areaId: 'intake',
    name: 'Intake Candidate',
    owner: 'PO/BA',
    record: 'AI 或规则分析生成的候选需求',
    implementationStatus: 'usable',
    deletePolicy: '候选需求通过 draft/approved/rejected 管理，不硬删。',
    operations: [
      crudOperation('create', 'implemented', '分析会话生成候选需求', ['/api/v1/intake/sessions/:id/analyze']),
      crudOperation('read', 'implemented', '列出候选需求', ['/api/v1/intake/sessions/:id/candidates']),
      crudOperation('update', 'implemented', '编辑标题、正文、分析、设计、验收、状态和里程碑', [
        '/api/v1/intake/candidates/:id',
      ]),
      crudOperation('lifecycle', 'implemented', 'draft、approved、rejected 状态可控', [
        '/api/v1/intake/candidates/:id',
        '/api/v1/intake/sessions/:id/approve',
      ]),
      crudOperation('delete', 'forbidden', '候选项保留为来源分析证据', []),
    ],
    gaps: ['Candidate version history', 'Candidate merge/split API'],
    recommendedNextSlice: '补候选需求版本和合并/拆分操作。',
  },
  {
    id: 'team-member',
    areaId: 'team',
    name: 'Team Member',
    owner: 'Scrum Master',
    record: '人类成员、Agent、服务账号和外部评审者',
    implementationStatus: 'usable',
    deletePolicy: '成员通过 inactive/suspended/unavailable 退出协作；历史分配保留。',
    operations: [
      crudOperation('create', 'implemented', '创建项目成员', ['/api/v1/projects/:id/team/members']),
      crudOperation('read', 'implemented', '读取成员和容量', [
        '/api/v1/projects/:id/team/members',
        '/api/v1/projects/:id/team/capacity',
      ]),
      crudOperation('update', 'implemented', '更新角色、权限、技能、容量和地区', ['/api/v1/team/members/:id']),
      crudOperation('lifecycle', 'implemented', '更新成员可用性和状态', ['/api/v1/team/members/:id/availability']),
      crudOperation('delete', 'forbidden', '成员历史不硬删', []),
    ],
    gaps: ['Membership remove reason'],
    recommendedNextSlice: '补成员退出原因。',
  },
  {
    id: 'workflow-summary',
    areaId: 'workflow',
    name: 'Workflow Summary',
    owner: '敏捷团队',
    record: 'WorkItem 的运行摘要、交接、审批和检查状态',
    implementationStatus: 'partial',
    deletePolicy: '运行摘要是交付证据的一部分，只能通过状态和事件演进。',
    operations: [
      crudOperation('create', 'partial', '摘要可按 WorkItem 隐式创建或更新', ['/api/v1/work-items/:id/workflow']),
      crudOperation('read', 'implemented', '读取项目工作流板和 WorkItem 摘要', [
        '/api/v1/projects/:id/main-board/workflow',
        '/api/v1/work-items/:id/workflow',
        '/api/v1/workflow-runs/:id/state',
        '/api/v1/workflow-runs/:id/recognitions',
      ]),
      crudOperation('update', 'implemented', '更新摘要、步骤、等待项、检查和链接', ['/api/v1/work-items/:id/workflow']),
      crudOperation('lifecycle', 'partial', 'pause/resume/cancel/retry 和步骤状态识别', [
        '/api/v1/workflow-runs/:id/start',
        '/api/v1/workflow-runs/:id/steps/:stepId/recognize-state',
      ]),
      crudOperation('delete', 'forbidden', '工作流历史不硬删', []),
    ],
    gaps: ['Workflow run entity APIs', 'Step command APIs', 'Template selection APIs'],
    recommendedNextSlice: '补 workflow-runs 和 workflow-templates 的真实 CRUD。',
  },
  {
    id: 'delivery-evidence',
    areaId: 'evidence',
    name: 'Delivery Evidence',
    owner: 'QA/Reviewer/Release',
    record: '代码、PR、Review、CI、证据、门禁和风险接受',
    implementationStatus: 'partial',
    deletePolicy: '证据使用更正、豁免、撤销和快照；不直接删除历史结论。',
    operations: [
      crudOperation('create', 'partial', '通过 PATCH 写入证据摘要', ['/api/v1/work-items/:id/delivery-evidence']),
      crudOperation('read', 'implemented', '读取项目证据板、rollup 和 WorkItem 证据', [
        '/api/v1/projects/:id/main-board/evidence',
        '/api/v1/projects/:id/delivery-evidence',
        '/api/v1/work-items/:id/delivery-evidence',
      ]),
      crudOperation('update', 'implemented', '更新链接、检查、义务、风险接受和 notes', [
        '/api/v1/work-items/:id/delivery-evidence',
      ]),
      crudOperation('lifecycle', 'partial', '检查状态、风险接受状态和豁免可写，签署报告仍缺', [
        '/api/v1/work-items/:id/delivery-evidence',
      ]),
      crudOperation('delete', 'forbidden', '证据历史不硬删', []),
    ],
    gaps: ['Evidence report CRUD', 'Approval/signature APIs', 'Evidence correction event'],
    recommendedNextSlice: '补证据报告、签署和更正记录。',
  },
  {
    id: 'governance-risk',
    areaId: 'evidence',
    name: 'Governance/Risk',
    owner: '合规/安全/可靠性/可信负责人',
    record: '义务、控制、风险接受、安全、可靠性和可信结论',
    implementationStatus: 'partial',
    deletePolicy: '治理对象需要审批、退休和风险接受，不做无痕删除。',
    operations: [
      crudOperation('create', 'partial', '可通过 evidence summary 写入治理摘要', [
        '/api/v1/work-items/:id/delivery-evidence',
      ]),
      crudOperation('read', 'implemented', '读取合规、安全、可靠性和可信详情', [
        '/api/v1/work-items/:id/compliance',
        '/api/v1/work-items/:id/security',
        '/api/v1/work-items/:id/reliability',
        '/api/v1/work-items/:id/trust',
      ]),
      crudOperation('update', 'partial', '摘要字段可更新，独立控制和审批 API 未实现', [
        '/api/v1/work-items/:id/delivery-evidence',
      ]),
      crudOperation('lifecycle', 'planned', '义务审批、控制退休、风险接受签署仍缺', []),
      crudOperation('delete', 'forbidden', '治理和风险历史不硬删', []),
    ],
    gaps: ['Obligation CRUD', 'Control pack CRUD', 'Risk acceptance approval APIs'],
    recommendedNextSlice: '补治理对象独立 API 和审批事件。',
  },
  {
    id: 'audit-event',
    areaId: 'admin',
    name: 'Audit Event',
    owner: '管理员/审计者',
    record: '重要变化的不可变追踪记录',
    implementationStatus: 'usable',
    deletePolicy: '审计事件不可更新、不可删除；只能按保留策略导出或归档。',
    operations: [
      crudOperation('create', 'implemented', '服务层写路径自动记录，内部也可显式记录', ['huntianling.board.recordAuditEvent']),
      crudOperation('read', 'implemented', '按项目或 WorkItem 查询审计事件', [
        '/api/v1/projects/:id/audit-events',
        '/api/v1/work-items/:id/audit-events',
      ]),
      crudOperation('update', 'forbidden', '审计事件不可变', []),
      crudOperation('lifecycle', 'planned', '保留、导出、归档策略仍缺', []),
      crudOperation('delete', 'forbidden', '审计事件不可删除', []),
    ],
    gaps: ['Audit retention policy', 'Audit export API', 'Auth/SCM/CI audit coverage'],
    recommendedNextSlice: '补审计保留、导出和外部集成审计覆盖。',
  },
  {
    id: 'auth-session',
    areaId: 'admin',
    name: 'Auth Session',
    owner: '管理员/用户',
    record: '浏览器登录会话',
    implementationStatus: 'usable',
    deletePolicy: 'logout 删除当前会话；持久化会话存储仍待数据库实现。',
    operations: [
      crudOperation('create', 'implemented', '密码登录创建 session', ['/api/auth/password/login']),
      crudOperation('read', 'implemented', '读取当前 session', ['/api/auth/session']),
      crudOperation('update', 'not_applicable', 'session 不做普通字段更新', []),
      crudOperation('lifecycle', 'implemented', 'logout 结束会话', ['/api/auth/logout']),
      crudOperation('delete', 'implemented', 'logout 等价撤销当前 session', ['/api/auth/logout']),
    ],
    gaps: ['Persistent session store', 'Session admin revoke API'],
    recommendedNextSlice: '补数据库 session 和管理员撤销。',
  },
  {
    id: 'api-token',
    areaId: 'admin',
    name: 'API Token',
    owner: '管理员/外部调用方',
    record: '外部调用令牌',
    implementationStatus: 'usable',
    deletePolicy: 'DELETE 表示 revoke，不能恢复 raw token。',
    operations: [
      crudOperation('create', 'implemented', '创建 API token', ['/api/auth/api-tokens']),
      crudOperation('read', 'implemented', '列出 token 摘要', ['/api/auth/api-tokens']),
      crudOperation('update', 'not_applicable', 'token 不直接编辑，改权限应重发', []),
      crudOperation('lifecycle', 'implemented', '撤销 token', ['/api/auth/api-tokens/:id']),
      crudOperation('delete', 'implemented', 'DELETE 撤销 token', ['/api/auth/api-tokens/:id']),
    ],
    gaps: ['Token scope update/reissue flow', 'Token audit persistence'],
    recommendedNextSlice: '补 token scope、轮换和审计持久化。',
  },
  {
    id: 'oauth-identity',
    areaId: 'admin',
    name: 'OAuth Identity',
    owner: '管理员/用户',
    record: 'Google、GitHub、WeChat 三方身份',
    implementationStatus: 'planned',
    deletePolicy: '解绑第三方身份必须保留审计和绑定历史。',
    operations: [
      crudOperation('create', 'implemented', 'OAuth/OIDC callback 绑定身份', ['/api/auth/oauth/:provider/callback']),
      crudOperation('read', 'partial', '可读取区域化 provider 列表', ['/api/auth/providers']),
      crudOperation('update', 'planned', '更新绑定状态或用户映射', []),
      crudOperation('lifecycle', 'planned', 'start/callback/unlink 流程', [
        '/api/auth/oauth/:provider/start',
        '/api/auth/oauth/:provider/unlink',
      ]),
      crudOperation('delete', 'implemented', '解绑 provider identity', ['/api/auth/oauth/:provider/unlink']),
    ],
    gaps: ['OAuth state/PKCE store', 'Provider identity records', 'Unlink API'],
    recommendedNextSlice: '补 OAuth start/callback/unlink 和身份绑定存储。',
  },
  {
    id: 'scm-ci-code-view',
    areaId: 'evidence',
    name: 'SCM/CI/Code View',
    owner: '开发/DevOps/QA',
    record: '仓库、分支、提交、PR、CI run 和代码视图',
    implementationStatus: 'usable',
    deletePolicy: '外部代码和 CI 记录作为证据引用，不由本系统硬删除。',
    operations: [
      crudOperation('create', 'implemented', '创建分支、提交关联、PR 和 CI run 触发', [
        '/api/v1/scm/catalog',
        '/api/v1/ci/catalog',
      ]),
      crudOperation('read', 'implemented', '读取 SCM/CI 目录和 Code View', [
        '/api/v1/scm/catalog',
        '/api/v1/ci/catalog',
        '/api/v1/work-items/:id/code-view',
        '/api/v1/milestones/:id/code-view',
        '/api/v1/projects/:id/unlinked-code',
      ]),
      crudOperation('update', 'planned', '同步外部状态和重新绑定 WorkItem', []),
      crudOperation('lifecycle', 'planned', '分支关闭、PR 合并、CI 重跑和证据导入', []),
      crudOperation('delete', 'forbidden', '外部 SCM/CI 事实不由 HuntianLing 删除', []),
    ],
    gaps: ['SCM adapter CRUD', 'CI adapter CRUD', 'Code evidence import API'],
    recommendedNextSlice: '补 Git/Gitea/GitHub/GitLab 和 CI adapter 的读写模型。',
  },
  {
    id: 'agent-skill-tool',
    areaId: 'team',
    name: 'Agent/Skill/Tool',
    owner: '平台管理员/敏捷团队',
    record: 'Agent 注册、Skill 覆盖、工具权限和运行结果',
    implementationStatus: 'usable',
    deletePolicy: 'Agent、Skill 和工具配置使用 enable/disable/archive，不硬删运行历史。',
    operations: [
      crudOperation('create', 'implemented', 'Skill draft 可创建并在校验后启用', ['/api/v1/skills/drafts', '/api/v1/skills/drafts/:id/enable']),
      crudOperation('read', 'implemented', '读取 Agent、Skill、Tool 目录和覆盖', [
        '/api/v1/agents',
        '/api/v1/agent-runs/:id/state-recognition',
        '/api/v1/skills',
        '/api/v1/tools',
        '/api/v1/projects/:id/skill-coverage',
      ]),
      crudOperation('update', 'planned', '更新角色、权限、Skill 版本和校验状态', []),
      crudOperation('lifecycle', 'planned', '启用、禁用、归档、验证、替换', []),
      crudOperation('delete', 'forbidden', '运行历史和能力声明不做无痕删除', []),
    ],
    gaps: ['Custom Agent registry writes', 'Technology skill pack install'],
    recommendedNextSlice: '补第三方 Agent 注册和技术 Skill pack 安装。',
  },
  {
    id: 'team-chat-collaboration',
    areaId: 'workflow',
    name: 'Team Chat / Collaboration Task',
    owner: '敏捷团队',
    record: 'Agent 协作对话、交接和协作任务',
    implementationStatus: 'usable',
    deletePolicy: '协作消息和任务影响交付证据，使用完成、取消、归档和脱敏。',
    operations: [
      crudOperation('create', 'implemented', '创建会话、消息、协作任务、决策和审批', [
        '/api/v1/team/conversations',
        '/api/v1/team/conversations/:id/messages',
        '/api/v1/team/conversations/:id/tasks',
        '/api/v1/team/conversations/:id/decisions',
        '/api/v1/team/conversations/:id/approvals',
      ]),
      crudOperation('read', 'implemented', '读取会话、任务、未解决问题和决策', [
        '/api/v1/team/conversations',
        '/api/v1/team/conversations/:id',
        '/api/v1/agent-collaboration-tasks/:id',
      ]),
      crudOperation('update', 'implemented', '更新协作任务状态、负责人、阻塞和检查', [
        '/api/v1/agent-collaboration-tasks/:id',
      ]),
      crudOperation('lifecycle', 'implemented', '接受、完成、拒绝、取消、拆分和合并', [
        '/api/v1/agent-collaboration-tasks/:id/transfer',
        '/api/v1/agent-collaboration-tasks/:id/complete',
      ]),
      crudOperation('delete', 'forbidden', '协作记录不做普通硬删除', []),
    ],
    gaps: ['Remaining later catalog types', 'Specialist agent roster'],
    recommendedNextSlice: '补其余后续目录类型和专家 Agent 名册。',
  },
  {
    id: 'workflow-template',
    areaId: 'workflow',
    name: 'Workflow Template',
    owner: '流程管理员',
    record: '可视化编排模板、版本、测试和发布状态',
    implementationStatus: 'usable',
    deletePolicy: '模板版本使用 draft/published/deprecated/archived，不删除已运行版本。',
    operations: [
      crudOperation('create', 'partial', '可克隆或导入模板', ['/api/v1/harness/workflows', '/api/v1/harness/workflows/import']),
      crudOperation('read', 'implemented', '读取内置模板、项目选择、画布和静态图', [
        '/api/v1/workflow-templates',
        '/api/v1/workflow-templates/:id',
        '/api/v1/workflow-templates/:id/canvas',
        '/api/v1/workflow-templates/:id/visualization',
        '/api/v1/projects/:id/workflow',
      ]),
      crudOperation('update', 'implemented', '选择项目默认模板并编辑草稿画布', [
        '/api/v1/projects/:id/workflow',
        '/api/v1/projects/:id/workflow-template/select',
        '/api/v1/workflow-templates/:id/canvas',
      ]),
      crudOperation('lifecycle', 'implemented', '校验、Test Lab dry-run、发布和归档', [
        '/api/v1/workflow-templates/:id/validate',
        '/api/v1/workflow-templates/:id/publish',
        '/api/v1/workflow-templates/:id/archive',
        '/api/v1/workflow-templates/:id/test-cases',
        '/api/v1/workflow-templates/:id/test-runs',
        '/api/v1/workflow-test-runs/:id/replay',
        '/api/v1/workflow-test-runs/:id/export-report',
      ]),
      crudOperation('delete', 'forbidden', '已运行模板版本不硬删', []),
    ],
    gaps: ['Per-item template override', 'Live runtime canvas replay'],
    recommendedNextSlice: '补运行时调度可视化。',
  },
];

function crudOperation(
  kind: BusinessCrudOperationKind,
  status: BusinessCrudOperationStatus,
  label: string,
  endpoints: readonly string[],
  note = '',
): BusinessCrudOperation {
  return {
    kind,
    status,
    label,
    endpoints,
    note,
  };
}

function createBusinessCrudCoverage(projectId: ProjectId): BusinessCrudCoverage {
  const summary = BUSINESS_CRUD_ENTITIES.reduce(
    (acc, entity) => {
      acc.entities += 1;
      acc[entity.implementationStatus] += 1;
      acc.gaps += entity.gaps.length;
      return acc;
    },
    {
      entities: 0,
      complete: 0,
      usable: 0,
      partial: 0,
      planned: 0,
      gaps: 0,
    },
  );
  return {
    projectId,
    generatedAt: Date.now(),
    summary,
    entities: BUSINESS_CRUD_ENTITIES,
  };
}

export function resolveWebConfig(
  input: WebConfig = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedWebConfig {
  const host = nonBlank(input.host) ?? nonBlank(env.HUNTIANLING_WEB_HOST) ?? '127.0.0.1';
  const port = input.port ?? parsePort(env.HUNTIANLING_WEB_PORT) ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`invalid web port: ${String(port)}`);
  }
  const publicUrl = trimTrailingSlash(
    nonBlank(input.publicUrl) ?? nonBlank(env.HUNTIANLING_PUBLIC_URL),
  );
  const writeToken = nonBlank(input.writeToken) ?? nonBlank(env.HUNTIANLING_WEB_WRITE_TOKEN);
  return {
    enabled: input.enabled ?? parseBoolean(env.HUNTIANLING_WEB_ENABLED) ?? true,
    autoStart: input.autoStart ?? parseBoolean(env.HUNTIANLING_WEB_AUTO_START) ?? true,
    host,
    port,
    publicUrl,
    writeToken,
    allowUnauthenticatedWrites:
      input.allowUnauthenticatedWrites ??
      parseBoolean(env.HUNTIANLING_WEB_ALLOW_UNAUTHENTICATED_WRITES) ??
      false,
    auth: resolveWebAuthConfig(input.auth, env),
  };
}

export function createWebService(
  deps: WebServiceDependencies,
  input: WebConfig = {},
): WebService {
  const config = resolveWebConfig(input);
  const collab = deps.collab ?? createCollabService({ board: deps.board });
  const skills = deps.skills ?? createSkillService();
  const environment = deps.environment ?? createEnvironmentService({
    skills,
    board: deps.board,
    ...(deps.database !== undefined ? { database: deps.database } : {}),
  });
  const scm = deps.scm ?? createScmService({ board: deps.board });
  const ci = deps.ci ?? createCiService({ board: deps.board });
  const agents = deps.agents ?? createAgentRuntime({
    skills,
    board: deps.board,
    environment,
    ...(deps.dispatch !== undefined ? { dispatch: deps.dispatch } : {}),
  });
  const authManager = new WebAuthManager(
    config.auth,
    deps.database,
    deps.oauthExchange !== undefined ? { oauthExchange: deps.oauthExchange } : {},
  );
  let server: Server | null = null;
  let startTask: Promise<WebStatus> | null = null;

  const service: WebService = {
    start,
    stop,
    status,
    url: currentUrl,
    getSurface,
    boardUrl,
  };

  function start(): Promise<WebStatus> {
    if (!config.enabled) return Promise.resolve(status());
    if (server !== null && currentPort() !== null) return Promise.resolve(status());
    if (startTask !== null) return startTask;

    const resolvedDeps: WebServiceDependencies = {
      ...deps,
      collab,
      environment,
      scm,
      ci,
      agents,
      skills,
      ...(deps.delivery !== undefined ? { delivery: deps.delivery } : {}),
    };
    const nextServer = createServer((req, res) => {
      void handleRequest(resolvedDeps, config, authManager, service, req, res);
    });
    server = nextServer;
    startTask = new Promise<WebStatus>((resolve, reject) => {
      const onError = (error: Error) => {
        nextServer.off('listening', onListening);
        server = null;
        reject(error);
      };
      const onListening = () => {
        nextServer.off('error', onError);
        resolve(status());
      };
      nextServer.once('error', onError);
      nextServer.once('listening', onListening);
      nextServer.listen(config.port, config.host);
    }).finally(() => {
      startTask = null;
    });
    return startTask;
  }

  async function stop(): Promise<void> {
    if (startTask !== null) {
      await startTask.catch(() => undefined);
    }
    const closing = server;
    server = null;
    if (closing === null) return;
    await new Promise<void>((resolve, reject) => {
      closing.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  function status(): WebStatus {
    const externallyReachable = config.publicUrl !== null || isPublicHost(config.host);
    return {
      enabled: config.enabled,
      running: server !== null && currentPort() !== null,
      host: config.host,
      port: currentPort(),
      url: currentUrl(),
      externalWritable:
        externallyReachable &&
        (config.auth.enabled || config.allowUnauthenticatedWrites || config.writeToken !== null),
      authRequired: config.auth.enabled,
    };
  }

  function currentPort(): number | null {
    const address = server?.address();
    if (typeof address === 'object' && address !== null) return address.port;
    if (server !== null && config.port !== 0) return config.port;
    return null;
  }

  function currentUrl(): string | null {
    if (!config.enabled || server === null) return null;
    const port = currentPort();
    if (port === null) return null;
    if (config.publicUrl !== null) return config.publicUrl;
    return `http://${hostForUrl(config.host)}:${String(port)}`;
  }

  function getSurface(): WebDisplaySurface | null {
    const url = currentUrl();
    if (url === null) return null;
    return {
      id: 'huntianling.board',
      title: 'HuntianLing Board',
      kind: 'browser',
      url,
    };
  }

  function boardUrl(query: BoardViewQuery | WorkItemFilter = {}): string | null {
    const root = currentUrl();
    if (root === null) return null;
    const params = new URLSearchParams();
    appendQuery(params, 'projectId', query.projectId);
    appendQuery(params, 'parentId', query.parentId);
    appendQuery(params, 'milestoneId', query.milestoneId);
    appendQuery(params, 'type', query.type);
    appendQuery(params, 'status', query.status);
    appendQuery(params, 'assignee', query.assignee);
    appendQuery(params, 'claimedRoleId', query.claimedRoleId);
    if ('groupBy' in query) appendQuery(params, 'groupBy', query.groupBy);
    const suffix = params.toString();
    return suffix ? `${root}/?${suffix}` : `${root}/`;
  }

  return service;
}

async function handleRequest(
  deps: WebServiceDependencies,
  config: ResolvedWebConfig,
  authManager: WebAuthManager,
  service: WebService,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://huntianling.local');
    if (method === 'OPTIONS') {
      sendEmpty(res, 204);
      return;
    }

    if (url.pathname === '/favicon.ico' && method === 'GET') {
      sendEmpty(res, 204);
      return;
    }

    if (method === 'GET' && !url.pathname.startsWith('/api/')) {
      handleHtmlShell(config, authManager, req, res, url.pathname);
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    const auth: RequestAuth = {
      manager: authManager,
      principal: authManager.authenticate(req, config.writeToken),
    };

    if (url.pathname.startsWith('/api/auth/')) {
      await handleAuthApi(auth, method, url, req, res);
      return;
    }

    if (config.auth.enabled && auth.principal === null) {
      sendJson(res, 401, { error: 'authentication required' });
      return;
    }

    if (isMutating(method) && !canWrite(config, auth.principal, req)) {
      sendJson(res, 403, { error: 'write token required' });
      return;
    }

    await handleApi(deps, service, auth, method, url, req, res);
  } catch (error) {
    if (error instanceof AuthHttpError) {
      sendJson(res, error.statusCode, { error: error.message });
      return;
    }
    if (error instanceof ChannelWriteError) {
      sendJson(res, error.code === 'NOT_FOUND' ? 404 : 400, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof ToolDeniedError) {
      sendJson(res, 403, { error: error.message, code: 'DENIED' });
      return;
    }
    if (error instanceof ToolInvokeError) {
      sendJson(res, 400, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof ScmError || error instanceof CiError) {
      sendJson(res, error.code === 'NOT_FOUND' ? 404 : 400, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof AgentTaskError) {
      sendJson(res, 400, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof DeliveryError) {
      const statusCode = error.code === 'NOT_FOUND' ? 404 : error.code === 'NOT_READY' ? 409 : 400;
      sendJson(res, statusCode, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof HarnessError) {
      const statusCode = error.code === 'NOT_FOUND' ? 404 : error.code === 'NOT_READY' ? 409 : 400;
      sendJson(res, statusCode, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof AuthorityError) {
      const statusCode = error.code === 'NOT_FOUND' ? 404 : error.code === 'APPROVAL_REQUIRED' ? 403 : 400;
      sendJson(res, statusCode, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof DatabaseError) {
      const statusCode = error.code === 'FILE_NOT_FOUND' ? 404 : 400;
      sendJson(res, statusCode, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof WorkflowError) {
      const statusCode = error.code === 'NOT_FOUND' ? 404 : error.code === 'AUTHORITY' ? 403 : error.code === 'NOT_READY' ? 409 : 400;
      sendJson(res, statusCode, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof DispatchError) {
      const statusCode = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : error.code === 'AUTHORITY' ? 403 : 400;
      sendJson(res, statusCode, { error: error.message, code: error.code });
      return;
    }
    if (error instanceof SkillWriteError) {
      const statusCode = error.code === 'GATED' || error.code === 'ENABLE' ? 403 : error.code === 'MISSING_SKILL' ? 404 : 400;
      sendJson(res, statusCode, { error: error.message, code: error.code });
      return;
    }
    const message = error instanceof Error ? error.message : 'request failed';
    sendJson(res, 400, { error: message });
  }
}

async function handleAuthApi(
  auth: RequestAuth,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (url.pathname === '/api/auth/session' && method === 'GET') {
    const providers = auth.manager.providers(authRegionFromUrl(url), requestHost(req));
    const session = auth.manager.currentSession(req);
    sendJson(res, 200, {
      auth: {
        enabled: auth.manager.config.enabled,
        regionMode: auth.manager.config.regionMode,
        providers,
      },
      authenticated: auth.principal !== null,
      principal: auth.principal,
      session,
    });
    return;
  }

  if (url.pathname === '/api/auth/providers' && method === 'GET') {
    sendJson(res, 200, auth.manager.providers(authRegionFromUrl(url), requestHost(req)));
    return;
  }

  const oauthStart = /^\/api\/auth\/oauth\/([^/]+)\/start$/.exec(url.pathname);
  if (oauthStart !== null && method === 'GET') {
    const origin = requestOrigin(req, url);
    const started = auth.manager.startOAuth({
      providerId: decodeURIComponent(oauthStart[1] ?? ''),
      region: authRegionFromUrl(url),
      host: requestHost(req),
      origin,
      bindUserId: auth.principal?.userId ?? null,
    });
    res.writeHead(302, {
      'content-type': 'application/json; charset=utf-8',
      location: started.authorizationUrl,
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ authorizationUrl: started.authorizationUrl, state: started.state }));
    return;
  }

  const oauthCallback = /^\/api\/auth\/oauth\/([^/]+)\/callback$/.exec(url.pathname);
  if (oauthCallback !== null && method === 'GET') {
    const completed = await auth.manager.completeOAuth({
      providerId: decodeURIComponent(oauthCallback[1] ?? ''),
      code: url.searchParams.get('code') ?? '',
      state: url.searchParams.get('state') ?? '',
    });
    writeAuthCookie(res, completed.cookie);
    sendJson(res, 200, {
      authenticated: true,
      session: completed.session,
      principal: completed.session.user,
      identity: completed.identity,
      shellPath: shellPathForAudience(completed.session.user.audience),
    });
    return;
  }

  const oauthUnlink = /^\/api\/auth\/oauth\/([^/]+)\/unlink$/.exec(url.pathname);
  if (oauthUnlink !== null && method === 'POST') {
    if (auth.principal === null) throw new AuthHttpError(401, 'authentication required');
    sendJson(res, 200, auth.manager.unlinkOAuth(req, decodeURIComponent(oauthUnlink[1] ?? '')));
    return;
  }

  if (url.pathname === '/api/auth/password/login' && method === 'POST') {
    const body = await readJsonObject(req);
    const result = auth.manager.login({
      username: requireString(body, 'username'),
      password: requireString(body, 'password'),
      region: optionalAuthRegion(body, 'region') ?? null,
      host: requestHost(req),
    });
    writeAuthCookie(res, result.cookie);
    sendJson(res, 200, {
      authenticated: true,
      session: result.session,
      principal: result.session.user,
      shellPath: shellPathForAudience(result.session.user.audience),
    });
    return;
  }

  if (url.pathname === '/api/auth/password/rotate' && method === 'POST') {
    const body = await readJsonObject(req);
    const rotated = auth.manager.rotatePassword(req, {
      currentPassword: requireString(body, 'currentPassword'),
      newPassword: requireString(body, 'newPassword'),
    });
    sendJson(res, 200, publicCredentialStatus(rotated));
    return;
  }

  if (url.pathname === '/api/auth/logout' && method === 'POST') {
    writeAuthCookie(res, auth.manager.logout(req));
    sendJson(res, 200, { authenticated: false });
    return;
  }

  if (url.pathname === '/api/auth/api-tokens' && method === 'GET') {
    sendJson(res, 200, { apiTokens: auth.manager.listApiTokens(req) });
    return;
  }

  if (url.pathname === '/api/auth/api-tokens' && method === 'POST') {
    const body = await readJsonObject(req);
    const created = auth.manager.createApiToken(req, { name: requireString(body, 'name') });
    sendJson(res, 201, created);
    return;
  }

  const apiToken = /^\/api\/auth\/api-tokens\/([^/]+)$/.exec(url.pathname);
  if (apiToken !== null && method === 'DELETE') {
    const deleted = auth.manager.deleteApiToken(req, idFromMatch<string>(apiToken));
    sendJson(res, deleted ? 200 : 404, deleted ? { deleted: true } : { error: 'api token not found' });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

async function handleApi(
  deps: WebServiceDependencies,
  service: WebService,
  auth: RequestAuth,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (url.pathname === '/api/status' && method === 'GET') {
    sendJson(res, 200, { web: service.status(), surface: service.getSurface() });
    return;
  }

  if (url.pathname.startsWith('/api/v1/')) {
    await handleApiV1(deps, auth, method, url, req, res);
    return;
  }

  if (url.pathname === '/api/projects' && method === 'GET') {
    sendJson(res, 200, { projects: authorizedProjects(deps, auth) });
    return;
  }
  if (url.pathname === '/api/projects' && method === 'POST') {
    const body = await readJsonObject(req);
    sendJson(res, 201, deps.board.createProject(makeProjectInput(body)));
    return;
  }

  if (url.pathname === '/api/milestones' && method === 'GET') {
    const filter = milestoneFilterFromUrl(url);
    if (filter.projectId !== undefined) assertProjectAccess(deps, auth, filter.projectId);
    sendJson(res, 200, {
      milestones: deps.board
        .listMilestones(filter)
        .filter((milestone) => projectAccessAllowed(auth.principal, milestone.projectId)),
    });
    return;
  }
  if (url.pathname === '/api/milestones' && method === 'POST') {
    const body = await readJsonObject(req);
    assertProjectAccess(deps, auth, requireId<ProjectId>(body, 'projectId'));
    sendJson(res, 201, deps.board.createMilestone(makeMilestoneCreateInput(body)));
    return;
  }

  if (url.pathname === '/api/milestone-board' && method === 'GET') {
    const projectId = optionalParam<ProjectId>(url, 'projectId');
    if (projectId !== undefined) assertProjectAccess(deps, auth, projectId);
    else assertUnscopedProjectRead(auth);
    sendJson(res, 200, deps.board.getMilestoneBoard(projectId));
    return;
  }

  const milestoneSummary = /^\/api\/milestones\/([^/]+)\/summary$/.exec(url.pathname);
  if (milestoneSummary !== null && method === 'GET') {
    const milestone = authorizeMilestone(deps, auth, idFromMatch<MilestoneId>(milestoneSummary));
    sendJson(res, 200, deps.board.getMilestoneSummary(milestone.id));
    return;
  }

  const milestoneDetail = /^\/api\/milestones\/([^/]+)$/.exec(url.pathname);
  if (milestoneDetail !== null && method === 'GET') {
    const milestone = deps.board.getMilestone(idFromMatch<MilestoneId>(milestoneDetail));
    if (milestone === undefined) sendJson(res, 404, { error: 'milestone not found' });
    else {
      assertProjectAccess(deps, auth, milestone.projectId);
      sendJson(res, 200, milestone);
    }
    return;
  }
  if (milestoneDetail !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    authorizeMilestone(deps, auth, idFromMatch<MilestoneId>(milestoneDetail));
    sendJson(res, 200, deps.board.updateMilestone(
      idFromMatch<MilestoneId>(milestoneDetail),
      makeMilestoneUpdateInput(body),
    ));
    return;
  }

  if (url.pathname === '/api/board' && method === 'GET') {
    const query = boardQueryFromUrl(url);
    if (query.projectId !== undefined) assertProjectAccess(deps, auth, query.projectId);
    else assertUnscopedProjectRead(auth);
    sendJson(res, 200, deps.board.getBoardView(query));
    return;
  }

  if (url.pathname === '/api/work-items' && method === 'GET') {
    const filter = filterFromUrl(url);
    if (filter.projectId !== undefined) assertProjectAccess(deps, auth, filter.projectId);
    sendJson(res, 200, {
      workItems: deps.board
        .listWorkItems(filter)
        .filter((item) => projectAccessAllowed(auth.principal, item.projectId)),
    });
    return;
  }
  if (url.pathname === '/api/work-items' && method === 'POST') {
    const body = await readJsonObject(req);
    assertProjectAccess(deps, auth, requireId<ProjectId>(body, 'projectId'));
    sendJson(res, 201, deps.board.createWorkItem(makeCreateInput(body)));
    return;
  }

  const workItemTree = /^\/api\/work-items\/([^/]+)\/tree$/.exec(url.pathname);
  if (workItemTree !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemTree));
    sendJson(res, 200, deps.board.getWorkItemTree(item.id));
    return;
  }

  const workItemCoverage = /^\/api\/work-items\/([^/]+)\/coverage$/.exec(url.pathname);
  if (workItemCoverage !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemCoverage));
    sendJson(res, 200, deps.board.getAcceptanceCoverage(item.id));
    return;
  }

  const workItemTransition = /^\/api\/work-items\/([^/]+)\/transition$/.exec(url.pathname);
  if (workItemTransition !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const status = requireStatus(body, 'status');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemTransition));
    sendJson(res, 200, deps.board.transitionWorkItem(item.id, status));
    return;
  }

  const workItemDetail = /^\/api\/work-items\/([^/]+)$/.exec(url.pathname);
  if (workItemDetail !== null && method === 'GET') {
    const item = deps.board.getWorkItem(idFromMatch<WorkItemId>(workItemDetail));
    if (item === undefined) sendJson(res, 404, { error: 'work item not found' });
    else {
      assertProjectAccess(deps, auth, item.projectId);
      sendJson(res, 200, item);
    }
    return;
  }
  if (workItemDetail !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemDetail));
    sendJson(res, 200, deps.board.updateWorkItem(item.id, makeUpdateInput(body)));
    return;
  }

  if (url.pathname === '/api/requirements' && method === 'GET') {
    const filter = filterFromUrl(url);
    if (filter.projectId !== undefined) assertProjectAccess(deps, auth, filter.projectId);
    sendJson(res, 200, {
      requirements: deps.requirements
        .listRequirements(filter)
        .filter((item) => projectAccessAllowed(auth.principal, item.projectId)),
    });
    return;
  }

  if (url.pathname === '/api/requirements/epics' && method === 'POST') {
    const body = await readJsonObject(req);
    assertProjectAccess(deps, auth, requireId<ProjectId>(body, 'projectId'));
    sendJson(res, 201, deps.requirements.createEpic({
      ...makeRequirementFields(body),
      projectId: requireId<ProjectId>(body, 'projectId'),
    }));
    return;
  }

  if (url.pathname === '/api/requirements/features' && method === 'POST') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, requireId<WorkItemId>(body, 'epicId'));
    sendJson(res, 201, deps.requirements.createFeature({
      ...makeRequirementFields(body),
      epicId: requireId<WorkItemId>(body, 'epicId'),
    }));
    return;
  }

  if (url.pathname === '/api/requirements/requirements' && method === 'POST') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, requireId<WorkItemId>(body, 'featureId'));
    sendJson(res, 201, deps.requirements.createRequirement({
      ...makeRequirementFields(body),
      featureId: requireId<WorkItemId>(body, 'featureId'),
    }));
    return;
  }

  if (url.pathname === '/api/requirements/stories' && method === 'POST') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, requireId<WorkItemId>(body, 'featureId'));
    sendJson(res, 201, deps.requirements.createStory({
      ...makeRequirementFields(body),
      featureId: requireId<WorkItemId>(body, 'featureId'),
    }));
    return;
  }

  if (url.pathname === '/api/requirements/tasks' && method === 'POST') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, requireId<WorkItemId>(body, 'parentId'));
    sendJson(res, 201, deps.requirements.createTask(makeExecutionInput(body)));
    return;
  }

  if (url.pathname === '/api/requirements/bugs' && method === 'POST') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, requireId<WorkItemId>(body, 'parentId'));
    sendJson(res, 201, deps.requirements.createBug(makeExecutionInput(body)));
    return;
  }

  if (url.pathname === '/api/requirements/research' && method === 'POST') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, requireId<WorkItemId>(body, 'parentId'));
    sendJson(res, 201, deps.requirements.createResearch(makeExecutionInput(body)));
    return;
  }

  const split = /^\/api\/requirements\/([^/]+)\/split$/.exec(url.pathname);
  if (split !== null && method === 'POST') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(split));
    sendJson(res, 201, deps.requirements.splitRequirement({
      parentId: idFromMatch<WorkItemId>(split),
      children: requireSplitChildren(body),
    }));
    return;
  }

  const requirementTree = /^\/api\/requirements\/([^/]+)\/tree$/.exec(url.pathname);
  if (requirementTree !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(requirementTree));
    sendJson(res, 200, deps.requirements.getRequirementTree(item.id));
    return;
  }

  const requirementCoverage = /^\/api\/requirements\/([^/]+)\/coverage$/.exec(url.pathname);
  if (requirementCoverage !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(requirementCoverage));
    sendJson(res, 200, deps.requirements.getAcceptanceCoverage(item.id));
    return;
  }

  const requirementDetail = /^\/api\/requirements\/([^/]+)$/.exec(url.pathname);
  if (requirementDetail !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(requirementDetail));
    sendJson(res, 200, deps.requirements.updateRequirement(
      idFromMatch<WorkItemId>(requirementDetail),
      makeRequirementUpdate(body),
    ));
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

async function handleApiV1(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (url.pathname === '/api/v1/projects' && method === 'GET') {
    sendJson(res, 200, {
      projects: authorizedProjects(deps, auth, url.searchParams.get('includeArchived') === 'true'),
    });
    return;
  }
  if (url.pathname === '/api/v1/projects' && method === 'POST') {
    const body = await readJsonObject(req);
    const project = deps.board.createProject(makeProjectInput(body));
    if (auth.principal !== null && auth.principal.audience === 'customer') {
      auth.manager.grantProjectAccess(auth.principal.userId, project.id);
    }
    sendJson(res, 201, project);
    return;
  }
  const projectOne = /^\/api\/v1\/projects\/([^/]+)$/.exec(url.pathname);
  if (projectOne !== null && method === 'GET') {
    sendJson(res, 200, authorizeProject(deps, auth, idFromMatch<ProjectId>(projectOne)));
    return;
  }
  if (projectOne !== null && method === 'PATCH') {
    denyCustomer(auth, 'project updates are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectOne));
    const body = await readJsonObject(req);
    const name = optionalString(body, 'name');
    const description = optionalString(body, 'description');
    sendJson(res, 200, deps.board.updateProject(project.id, {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
    }));
    return;
  }
  const projectArchive = /^\/api\/v1\/projects\/([^/]+)\/archive$/.exec(url.pathname);
  if (projectArchive !== null && method === 'POST') {
    denyCustomer(auth, 'project archive is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectArchive));
    sendJson(res, 200, deps.board.archiveProject(project.id, auth.principal?.username ?? 'developer'));
    return;
  }
  const projectRestore = /^\/api\/v1\/projects\/([^/]+)\/restore$/.exec(url.pathname);
  if (projectRestore !== null && method === 'POST') {
    denyCustomer(auth, 'project restore is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectRestore));
    sendJson(res, 200, deps.board.restoreProject(project.id, auth.principal?.username ?? 'developer'));
    return;
  }
  const projectPolicy = /^\/api\/v1\/projects\/([^/]+)\/delivery-policy$/.exec(url.pathname);
  if (projectPolicy !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectPolicy));
    sendJson(res, 200, { projectId: project.id, deliveryPolicy: project.deliveryPolicy });
    return;
  }
  if (projectPolicy !== null && method === 'PATCH') {
    denyCustomer(auth, 'delivery policy is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectPolicy));
    const body = await readJsonObject(req);
    sendJson(res, 200, deps.board.updateProject(project.id, {
      deliveryPolicy: requireDeliveryPolicyBody(body),
    }));
    return;
  }
  const deliveryGates = /^\/api\/v1\/work-items\/([^/]+)\/delivery-gates$/.exec(url.pathname);
  if (deliveryGates !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(deliveryGates));
    const to = (url.searchParams.get('to') ?? 'delivered') as WorkItemStatus;
    sendJson(res, 200, deps.board.inspectDeliveryGates(item.id, to));
    return;
  }
  if (url.pathname === '/api/v1/work-items' && method === 'POST') {
    denyCustomer(auth, 'work item create is not available to customers');
    const body = await readJsonObject(req);
    assertProjectAccess(deps, auth, requireId<ProjectId>(body, 'projectId'));
    sendJson(res, 201, deps.board.createWorkItem(makeCreateInput(body)));
    return;
  }
  const workItemStatus = /^\/api\/v1\/work-items\/([^/]+)\/status$/.exec(url.pathname);
  if (workItemStatus !== null && method === 'POST') {
    denyCustomer(auth, 'work item status is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemStatus));
    const body = await readJsonObject(req);
    sendJson(res, 200, deps.board.transitionWorkItem(item.id, requireStatus(body, 'to')));
    return;
  }
  const workItemArchive = /^\/api\/v1\/work-items\/([^/]+)\/archive$/.exec(url.pathname);
  if (workItemArchive !== null && method === 'POST') {
    denyCustomer(auth, 'work item archive is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemArchive));
    sendJson(res, 200, deps.board.archiveWorkItem(item.id, auth.principal?.username ?? 'developer'));
    return;
  }
  const workItemRestore = /^\/api\/v1\/work-items\/([^/]+)\/restore$/.exec(url.pathname);
  if (workItemRestore !== null && method === 'POST') {
    denyCustomer(auth, 'work item restore is not available to customers');
    const item = deps.board.getWorkItem(idFromMatch<WorkItemId>(workItemRestore));
    if (item === undefined) throw new Error('work item not found');
    assertProjectAccess(deps, auth, item.projectId);
    sendJson(res, 200, deps.board.restoreWorkItem(item.id, auth.principal?.username ?? 'developer'));
    return;
  }

  if (url.pathname.startsWith('/api/v1/admin/')) {
    await handleAdminApi(deps, auth, method, url, req, res);
    return;
  }

  if (await handleDispatchApi(deps, auth, method, url, req, res)) return;
  if (await handleSkillToolApi(deps, auth, method, url, req, res)) return;

  if (
    (
      url.pathname.startsWith('/api/v1/team/')
      && !url.pathname.startsWith('/api/v1/team/dispatch/')
      && !url.pathname.startsWith('/api/v1/team/members')
    )
    || url.pathname.startsWith('/api/v1/agent-collaboration-tasks/')
  ) {
    if (auth.principal?.audience === 'customer') {
      throw new AuthHttpError(403, 'Agent Channel is not available to customers');
    }
    await handleTeamApi(requireCollab(deps), deps, auth, method, url, req, res);
    return;
  }

  const projectAuditEvents = /^\/api\/v1\/projects\/([^/]+)\/audit-events$/.exec(url.pathname);
  if (projectAuditEvents !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectAuditEvents));
    sendJson(res, 200, {
      projectId: project.id,
      auditEvents: deps.board.listAuditEvents({
        projectId: project.id,
        ...auditEventFilterFromUrl(url),
      }),
    });
    return;
  }

  const customerBoard = /^\/api\/v1\/projects\/([^/]+)\/customer-board$/.exec(url.pathname);
  if (customerBoard !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(customerBoard));
    sendJson(res, 200, createCustomerBoard(deps.board, project.id));
    return;
  }

  const developerBoard = /^\/api\/v1\/projects\/([^/]+)\/developer-board$/.exec(url.pathname);
  if (developerBoard !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(developerBoard));
    sendJson(res, 200, createDeveloperBoard(
      deps.board,
      project.id,
      deps.delivery,
      deps.authority,
      deps.scm,
      deps.collab,
      deps.workflow,
      deps.dispatch,
      deps.agents,
    ));
    return;
  }

  if (url.pathname === '/api/v1/environment/prepare' && method === 'POST') {
    denyCustomer(auth, 'environment prepare is not available to customers');
    const body = await readJsonObject(req);
    const workspaceRoot = optionalString(body, 'workspaceRoot') ?? process.cwd();
    sendJson(res, 200, requireEnvironment(deps).prepare({ workspaceRoot }));
    return;
  }
  if (url.pathname === '/api/v1/environment/fleets' && method === 'GET') {
    denyCustomer(auth, 'environment fleets are not available to customers');
    sendJson(res, 200, { fleets: requireEnvironment(deps).listFleets() });
    return;
  }
  if (url.pathname === '/api/v1/environment/replace' && method === 'POST') {
    denyCustomer(auth, 'environment replace is not available to customers');
    const body = await readJsonObject(req);
    const sourceRoot = optionalString(body, 'sourceRoot') ?? optionalString(body, 'workspaceRoot') ?? process.cwd();
    const targetRoot = requireString(body, 'targetRoot');
    const kind = optionalString(body, 'kind');
    const preserveUncommitted = optionalBoolean(body, 'preserveUncommitted');
    const acceptUncommittedLoss = optionalBoolean(body, 'acceptUncommittedLoss');
    sendJson(res, 200, requireEnvironment(deps).replace({
      sourceRoot,
      targetRoot,
      ...(kind === 'local' || kind === 'remote' ? { kind } : {}),
      ...(preserveUncommitted !== undefined ? { preserveUncommitted } : {}),
      ...(acceptUncommittedLoss !== undefined ? { acceptUncommittedLoss } : {}),
    }));
    return;
  }
  const skillCoverage = /^\/api\/v1\/projects\/([^/]+)\/skill-coverage$/.exec(url.pathname);
  if (skillCoverage !== null && method === 'GET') {
    denyCustomer(auth, 'skill coverage is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(skillCoverage));
    const workspaceRoot = url.searchParams.get('workspaceRoot')?.trim() || process.cwd();
    sendJson(res, 200, requireEnvironment(deps).skillCoverage(project.id, workspaceRoot));
    return;
  }

  const projectScm = /^\/api\/v1\/projects\/([^/]+)\/scm$/.exec(url.pathname);
  if (projectScm !== null && method === 'GET') {
    denyCustomer(auth, 'source control is not available to customers');
    authorizeProject(deps, auth, idFromMatch<ProjectId>(projectScm));
    const workspaceRoot = url.searchParams.get('workspaceRoot')?.trim() || process.cwd();
    sendJson(res, 200, requireScm(deps).inspect(workspaceRoot));
    return;
  }

  const workItemScmLink = /^\/api\/v1\/work-items\/([^/]+)\/scm\/link$/.exec(url.pathname);
  if (workItemScmLink !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemScmLink));
    const body = await readJsonObject(req);
    sendJson(res, 200, requireScm(deps).linkHead({
      workItemId: item.id,
      workspaceRoot: optionalString(body, 'workspaceRoot') ?? process.cwd(),
    }));
    return;
  }

  const workItemScmPush = /^\/api\/v1\/work-items\/([^/]+)\/scm\/push$/.exec(url.pathname);
  if (workItemScmPush !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemScmPush));
    const body = await readJsonObject(req);
    const pushApprovalId = optionalString(body, 'approvalId');
    sendJson(res, 200, requireScm(deps).push({
      workItemId: item.id,
      workspaceRoot: optionalString(body, 'workspaceRoot') ?? process.cwd(),
      role: optionalString(body, 'role') ?? 'generator',
      actor: auth.principal?.username ?? 'developer',
      ...(pushApprovalId !== undefined ? { approvalId: pushApprovalId } : {}),
    }));
    return;
  }

  const workItemScmPr = /^\/api\/v1\/work-items\/([^/]+)\/scm\/pull-request$/.exec(url.pathname);
  if (workItemScmPr !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemScmPr));
    const body = await readJsonObject(req);
    const prApprovalId = optionalString(body, 'approvalId');
    const prTitle = optionalString(body, 'title');
    sendJson(res, 200, requireScm(deps).openPullRequest({
      workItemId: item.id,
      role: optionalString(body, 'role') ?? 'generator',
      actor: auth.principal?.username ?? 'developer',
      ...(prApprovalId !== undefined ? { approvalId: prApprovalId } : {}),
      ...(prTitle !== undefined ? { title: prTitle } : {}),
    }));
    return;
  }

  const projectRepos = /^\/api\/v1\/projects\/([^/]+)\/repositories$/.exec(url.pathname);
  if (projectRepos !== null && method === 'GET') {
    denyCustomer(auth, 'source control is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectRepos));
    sendJson(res, 200, { repositories: requireScm(deps).listRepositories(project.id) });
    return;
  }
  if (projectRepos !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectRepos));
    const body = await readJsonObject(req);
    const defaultBranch = optionalString(body, 'defaultBranch');
    const repoRoot = optionalString(body, 'workspaceRoot');
    const provider = optionalString(body, 'provider');
    const owner = optionalString(body, 'owner');
    const repoName = optionalString(body, 'repo');
    const remoteUrl = optionalString(body, 'remoteUrl');
    const apiBaseUrl = optionalString(body, 'apiBaseUrl');
    sendJson(res, 201, requireScm(deps).registerRepository({
      projectId: project.id,
      name: requireString(body, 'name'),
      workspaceRoot: repoRoot !== undefined && repoRoot.trim() !== '' ? repoRoot : process.cwd(),
      ...(defaultBranch !== undefined ? { defaultBranch } : {}),
      ...(provider !== undefined ? { provider } : {}),
      ...(owner !== undefined ? { owner } : {}),
      ...(repoName !== undefined ? { repo: repoName } : {}),
      ...(remoteUrl !== undefined ? { remoteUrl } : {}),
      ...(apiBaseUrl !== undefined ? { apiBaseUrl } : {}),
    }));
    return;
  }

  const workItemBranches = /^\/api\/v1\/work-items\/([^/]+)\/branches$/.exec(url.pathname);
  if (workItemBranches !== null && method === 'GET') {
    denyCustomer(auth, 'source control is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemBranches));
    sendJson(res, 200, { branches: requireScm(deps).listBranches({ workItemId: item.id }) });
    return;
  }
  if (workItemBranches !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemBranches));
    const body = await readJsonObject(req);
    const parentBranchId = optionalString(body, 'parentBranchId');
    sendJson(res, 201, requireScm(deps).createBranch({
      workItemId: item.id,
      actor: auth.principal?.username ?? 'developer',
      role: optionalString(body, 'role') ?? 'generator',
      ...(parentBranchId !== undefined ? { parentBranchId } : {}),
    }));
    return;
  }

  const branchSync = /^\/api\/v1\/branches\/([^/]+)\/sync$/.exec(url.pathname);
  if (branchSync !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    sendJson(res, 200, requireScm(deps).syncBranch(branchSync[1] ?? ''));
    return;
  }
  const branchRebase = /^\/api\/v1\/branches\/([^/]+)\/rebase-check$/.exec(url.pathname);
  if (branchRebase !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    sendJson(res, 200, requireScm(deps).rebaseCheck(branchRebase[1] ?? ''));
    return;
  }
  const branchPush = /^\/api\/v1\/branches\/([^/]+)\/push$/.exec(url.pathname);
  if (branchPush !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const body = await readJsonObject(req);
    const approvalId = optionalString(body, 'approvalId');
    const pushToken = optionalString(body, 'token');
    sendJson(res, 200, requireScm(deps).pushBranch({
      branchId: branchPush[1] ?? '',
      actor: auth.principal?.username ?? 'developer',
      role: optionalString(body, 'role') ?? 'generator',
      ...(approvalId !== undefined ? { approvalId } : {}),
      ...(pushToken !== undefined ? { token: pushToken } : {}),
    }));
    return;
  }
  const branchPr = /^\/api\/v1\/branches\/([^/]+)\/pull-request$/.exec(url.pathname);
  if (branchPr !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const body = await readJsonObject(req);
    const approvalId = optionalString(body, 'approvalId');
    const title = optionalString(body, 'title');
    const prToken = optionalString(body, 'token');
    sendJson(res, 201, requireScm(deps).openBranchPullRequest({
      branchId: branchPr[1] ?? '',
      actor: auth.principal?.username ?? 'developer',
      role: optionalString(body, 'role') ?? 'generator',
      ...(approvalId !== undefined ? { approvalId } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(prToken !== undefined ? { token: prToken } : {}),
    }));
    return;
  }

  const workItemChangesets = /^\/api\/v1\/work-items\/([^/]+)\/changesets$/.exec(url.pathname);
  if (workItemChangesets !== null && method === 'GET') {
    denyCustomer(auth, 'source control is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemChangesets));
    sendJson(res, 200, { changesets: requireScm(deps).listChangesets(item.id) });
    return;
  }
  if (workItemChangesets !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemChangesets));
    const body = await readJsonObject(req);
    const patch = optionalString(body, 'patch');
    sendJson(res, 201, requireScm(deps).createChangeset({
      workItemId: item.id,
      branchId: requireString(body, 'branchId'),
      actor: auth.principal?.username ?? 'developer',
      ...(patch !== undefined ? { patch } : {}),
    }));
    return;
  }

  const changesetCommit = /^\/api\/v1\/changesets\/([^/]+)\/commit$/.exec(url.pathname);
  if (changesetCommit !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    sendJson(res, 200, requireScm(deps).commitChangeset({
      changesetId: changesetCommit[1] ?? '',
      actor: auth.principal?.username ?? 'developer',
      role: 'generator',
    }));
    return;
  }

  const prMerge = /^\/api\/v1\/pull-requests\/([^/]+)\/merge$/.exec(url.pathname);
  if (prMerge !== null && method === 'POST') {
    denyCustomer(auth, 'source control is not available to customers');
    const body = await readJsonObject(req);
    const approvalId = optionalString(body, 'approvalId');
    const mergeToken = optionalString(body, 'token');
    sendJson(res, 200, requireScm(deps).mergePullRequest({
      pullRequestId: prMerge[1] ?? '',
      actor: auth.principal?.username ?? 'developer',
      role: optionalString(body, 'role') ?? 'generator',
      ...(approvalId !== undefined ? { approvalId } : {}),
      ...(mergeToken !== undefined ? { token: mergeToken } : {}),
    }));
    return;
  }

  const workItemCiRun = /^\/api\/v1\/work-items\/([^/]+)\/ci\/run$/.exec(url.pathname);
  if (workItemCiRun !== null && method === 'POST') {
    denyCustomer(auth, 'CI runs are not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemCiRun));
    const body = await readJsonObject(req);
    const production = optionalBoolean(body, 'production');
    const role = optionalString(body, 'role');
    const approvalId = optionalString(body, 'approvalId');
    const ciToken = optionalString(body, 'token');
    const ciProvider = optionalString(body, 'provider');
    const ciOwner = optionalString(body, 'owner');
    const ciRepo = optionalString(body, 'repo');
    const ciWorkflow = optionalString(body, 'workflow');
    const ciRef = optionalString(body, 'ref');
    const ciApiBaseUrl = optionalString(body, 'apiBaseUrl');
    sendJson(res, 200, requireCi(deps).run({
      workItemId: item.id,
      workspaceRoot: optionalString(body, 'workspaceRoot') ?? process.cwd(),
      ...(production !== undefined ? { production } : {}),
      ...(role !== undefined ? { role } : {}),
      actor: auth.principal?.username ?? 'developer',
      ...(approvalId !== undefined ? { approvalId } : {}),
      ...(ciToken !== undefined ? { token: ciToken } : {}),
      ...(ciProvider !== undefined ? { provider: ciProvider } : {}),
      ...(ciOwner !== undefined ? { owner: ciOwner } : {}),
      ...(ciRepo !== undefined ? { repo: ciRepo } : {}),
      ...(ciWorkflow !== undefined ? { workflow: ciWorkflow } : {}),
      ...(ciRef !== undefined ? { ref: ciRef } : {}),
      ...(ciApiBaseUrl !== undefined ? { apiBaseUrl: ciApiBaseUrl } : {}),
    }));
    return;
  }

  const projectCiWorkflows = /^\/api\/v1\/projects\/([^/]+)\/ci\/workflows$/.exec(url.pathname);
  if (projectCiWorkflows !== null && method === 'POST') {
    denyCustomer(auth, 'CI runs are not available to customers');
    authorizeProject(deps, auth, idFromMatch<ProjectId>(projectCiWorkflows));
    const body = await readJsonObject(req);
    const workflowToken = optionalString(body, 'token');
    const workflowApiBaseUrl = optionalString(body, 'apiBaseUrl');
    const workflowRef = optionalString(body, 'ref');
    sendJson(res, 200, {
      workflows: requireCi(deps).listWorkflows({
        provider: requireString(body, 'provider'),
        owner: requireString(body, 'owner'),
        repo: requireString(body, 'repo'),
        role: optionalString(body, 'role') ?? 'ci',
        actor: auth.principal?.username ?? 'developer',
        ...(workflowToken !== undefined ? { token: workflowToken } : {}),
        ...(workflowApiBaseUrl !== undefined ? { apiBaseUrl: workflowApiBaseUrl } : {}),
        ...(workflowRef !== undefined ? { ref: workflowRef } : {}),
      }),
    });
    return;
  }

  const projectAuthority = /^\/api\/v1\/projects\/([^/]+)\/authority$/.exec(url.pathname);
  if (projectAuthority !== null && method === 'GET') {
    denyCustomer(auth, 'authority policy is not available to customers');
    authorizeProject(deps, auth, idFromMatch<ProjectId>(projectAuthority));
    sendJson(res, 200, { roles: requireAuthority(deps).policies() });
    return;
  }

  const projectApprovals = /^\/api\/v1\/projects\/([^/]+)\/authority\/approvals$/.exec(url.pathname);
  if (projectApprovals !== null && method === 'GET') {
    denyCustomer(auth, 'authority policy is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectApprovals));
    sendJson(res, 200, { approvals: requireAuthority(deps).listApprovals({ projectId: project.id }) });
    return;
  }

  if (url.pathname === '/api/v1/authority/approvals' && method === 'POST') {
    denyCustomer(auth, 'authority policy is not available to customers');
    const body = await readJsonObject(req);
    const project = authorizeProject(deps, auth, requireString(body, 'projectId') as ProjectId);
    const workItemId = optionalString(body, 'workItemId');
    const requestReason = optionalString(body, 'reason');
    sendJson(res, 201, requireAuthority(deps).requestApproval({
      projectId: project.id,
      role: requireString(body, 'role'),
      action: requireAuthorityAction(body, 'action'),
      requester: auth.principal?.username ?? 'developer',
      ...(workItemId !== undefined ? { workItemId } : {}),
      ...(requestReason !== undefined ? { reason: requestReason } : {}),
    }));
    return;
  }

  const approvalDecide = /^\/api\/v1\/authority\/approvals\/([^/]+)\/decide$/.exec(url.pathname);
  if (approvalDecide !== null && method === 'POST') {
    denyCustomer(auth, 'authority policy is not available to customers');
    const body = await readJsonObject(req);
    const decision = requireString(body, 'decision');
    if (decision !== 'granted' && decision !== 'rejected') {
      throw new AuthorityError('VALIDATION', 'decision must be granted or rejected');
    }
    const decideReason = optionalString(body, 'reason');
    sendJson(res, 200, requireAuthority(deps).decideApproval({
      approvalId: approvalDecide[1] ?? '',
      decision,
      actor: auth.principal?.username ?? 'developer',
      ...(decideReason !== undefined ? { reason: decideReason } : {}),
    }));
    return;
  }

  const workItemEvaluate = /^\/api\/v1\/work-items\/([^/]+)\/evaluate$/.exec(url.pathname);
  if (workItemEvaluate !== null && method === 'POST') {
    denyCustomer(auth, 'evaluation is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemEvaluate));
    const body = await readJsonObject(req);
    const acceptance = item.acceptance.length > 0
      ? item.acceptance
      : item.acceptanceCriteria.map((criterion) => criterion.text);
    const failedCriteria = optionalStringArray(body, 'failedCriteria');
    const run = requireAgents(deps).startRun({
      agentId: 'evaluator',
      executor: 'manual',
      workItemId: item.id,
      projectId: item.projectId,
      input: {
        independent: body.independent !== false,
        outcome: item.title,
        acceptance,
        ...(failedCriteria !== undefined ? { failedCriteria } : {}),
      },
    });
    const captured = deps.dispatch?.captureRun(run);
    sendJson(res, 200, {
      run,
      evidence: deps.board.getDeliveryEvidenceSummary(item.id),
      ...(captured !== undefined ? { feedback: captured } : {}),
    });
    return;
  }

  const storyDeliveryStart = /^\/api\/v1\/work-items\/([^/]+)\/story-delivery\/start$/.exec(url.pathname);
  if (storyDeliveryStart !== null && method === 'POST') {
    denyCustomer(auth, 'story delivery is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(storyDeliveryStart));
    const body = await readJsonObject(req);
    const environmentReady = optionalBoolean(body, 'environmentReady');
    const drive = optionalBoolean(body, 'drive');
    const reason = optionalString(body, 'reason');
    sendJson(res, 201, requireDelivery(deps).start({
      workItemId: item.id,
      actor: auth.principal?.username ?? 'developer',
      ...(environmentReady !== undefined ? { environmentReady } : {}),
      ...(drive !== undefined ? { drive } : {}),
      ...(reason !== undefined ? { reason } : {}),
    }));
    return;
  }

  const storyDelivery = /^\/api\/v1\/work-items\/([^/]+)\/story-delivery$/.exec(url.pathname);
  if (storyDelivery !== null && method === 'GET') {
    denyCustomer(auth, 'story delivery is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(storyDelivery));
    sendJson(res, 200, { runs: requireDelivery(deps).listForWorkItem(item.id) });
    return;
  }

  const deliveryRun = /^\/api\/v1\/story-delivery-runs\/([^/]+)$/.exec(url.pathname);
  if (deliveryRun !== null && method === 'GET') {
    denyCustomer(auth, 'story delivery is not available to customers');
    const found = requireDelivery(deps).get(deliveryRun[1] ?? '');
    authorizeWorkItem(deps, auth, found.workItemId as WorkItemId);
    sendJson(res, 200, found);
    return;
  }

  const deliveryAdvance = /^\/api\/v1\/story-delivery-runs\/([^/]+)\/advance$/.exec(url.pathname);
  if (deliveryAdvance !== null && method === 'POST') {
    denyCustomer(auth, 'story delivery is not available to customers');
    const found = requireDelivery(deps).get(deliveryAdvance[1] ?? '');
    authorizeWorkItem(deps, auth, found.workItemId as WorkItemId);
    sendJson(res, 200, requireDelivery(deps).advance(found.id, auth.principal?.username ?? 'developer'));
    return;
  }

  const deliveryPause = /^\/api\/v1\/story-delivery-runs\/([^/]+)\/pause$/.exec(url.pathname);
  if (deliveryPause !== null && method === 'POST') {
    denyCustomer(auth, 'story delivery is not available to customers');
    const found = requireDelivery(deps).get(deliveryPause[1] ?? '');
    authorizeWorkItem(deps, auth, found.workItemId as WorkItemId);
    const body = await readJsonObject(req);
    sendJson(res, 200, requireDelivery(deps).pause(
      found.id,
      optionalString(body, 'reason') ?? '',
      auth.principal?.username ?? 'developer',
    ));
    return;
  }

  const deliveryResume = /^\/api\/v1\/story-delivery-runs\/([^/]+)\/resume$/.exec(url.pathname);
  if (deliveryResume !== null && method === 'POST') {
    denyCustomer(auth, 'story delivery is not available to customers');
    const found = requireDelivery(deps).get(deliveryResume[1] ?? '');
    authorizeWorkItem(deps, auth, found.workItemId as WorkItemId);
    sendJson(res, 200, requireDelivery(deps).resume(found.id, auth.principal?.username ?? 'developer'));
    return;
  }

  const deliveryCancel = /^\/api\/v1\/story-delivery-runs\/([^/]+)\/cancel$/.exec(url.pathname);
  if (deliveryCancel !== null && method === 'POST') {
    denyCustomer(auth, 'story delivery is not available to customers');
    const found = requireDelivery(deps).get(deliveryCancel[1] ?? '');
    authorizeWorkItem(deps, auth, found.workItemId as WorkItemId);
    const body = await readJsonObject(req);
    sendJson(res, 200, requireDelivery(deps).cancel(
      found.id,
      optionalString(body, 'reason') ?? '',
      auth.principal?.username ?? 'developer',
    ));
    return;
  }

  const deliveryEvidence = /^\/api\/v1\/story-delivery-runs\/([^/]+)\/evidence$/.exec(url.pathname);
  if (deliveryEvidence !== null && method === 'GET') {
    denyCustomer(auth, 'story delivery is not available to customers');
    const found = requireDelivery(deps).get(deliveryEvidence[1] ?? '');
    const item = authorizeWorkItem(deps, auth, found.workItemId as WorkItemId);
    sendJson(res, 200, {
      run: found,
      evidence: deps.board.getDeliveryEvidenceSummary(item.id),
    });
    return;
  }

  if (url.pathname === '/api/v1/harness/comparisons' && method === 'GET') {
    denyCustomer(auth, 'harness measurement is not available to customers');
    sendJson(res, 200, { comparisons: requireHarness(deps).listComparisons() });
    return;
  }
  if (url.pathname === '/api/v1/harness/comparisons' && method === 'POST') {
    denyCustomer(auth, 'harness measurement is not available to customers');
    const body = await readJsonObject(req);
    const baselineDepth = typeof body.baselineDepth === 'number' ? body.baselineDepth : undefined;
    const candidateDepth = typeof body.candidateDepth === 'number' ? body.candidateDepth : undefined;
    const repeats = typeof body.repeats === 'number' ? body.repeats : undefined;
    const modelBinding = optionalString(body, 'modelBinding');
    const token = optionalString(body, 'token');
    const skillId = optionalString(body, 'skillId');
    sendJson(res, 201, requireHarness(deps).compare({
      ...(skillId !== undefined ? { skillId: skillId as never } : {}),
      ...(baselineDepth !== undefined ? { baselineDepth: baselineDepth as never } : {}),
      ...(candidateDepth !== undefined ? { candidateDepth: candidateDepth as never } : {}),
      ...(repeats !== undefined ? { repeats } : {}),
      ...(modelBinding !== undefined ? { modelBinding: modelBinding as never } : {}),
      ...(token !== undefined ? { token } : {}),
    }));
    return;
  }
  if (url.pathname === '/api/v1/harness/trials' && method === 'POST') {
    denyCustomer(auth, 'harness measurement is not available to customers');
    const body = await readJsonObject(req);
    const repeats = typeof body.repeats === 'number' ? body.repeats : 1;
    const token = optionalString(body, 'token');
    const modelBinding = optionalString(body, 'modelBinding');
    const executor = optionalString(body, 'executor');
    if (repeats > 1) {
      sendJson(res, 201, {
        trials: requireHarness(deps).repeatTrials({
          scenarioId: requireString(body, 'scenarioId'),
          depth: (typeof body.depth === 'number' ? body.depth : 1) as never,
          repeats,
          ...(modelBinding !== undefined ? { modelBinding: modelBinding as never } : {}),
          ...(executor !== undefined ? { executor: executor as never } : {}),
          ...(token !== undefined ? { token } : {}),
        }),
      });
      return;
    }
    sendJson(res, 201, requireHarness(deps).runTrial({
      scenarioId: requireString(body, 'scenarioId'),
      depth: (typeof body.depth === 'number' ? body.depth : 1) as never,
      ...(modelBinding !== undefined ? { modelBinding: modelBinding as never } : {}),
      ...(executor !== undefined ? { executor: executor as never } : {}),
      ...(token !== undefined ? { token } : {}),
    }));
    return;
  }
  const harnessPromote = /^\/api\/v1\/harness\/comparisons\/([^/]+)\/promote$/.exec(url.pathname);
  if (harnessPromote !== null && method === 'POST') {
    denyCustomer(auth, 'harness measurement is not available to customers');
    sendJson(res, 200, requireHarness(deps).promote(harnessPromote[1] ?? ''));
    return;
  }
  if (url.pathname === '/api/v1/harness/demonstrations' && method === 'GET') {
    denyCustomer(auth, 'harness measurement is not available to customers');
    sendJson(res, 200, { demonstrations: requireHarness(deps).listDemonstrations() });
    return;
  }
  if (url.pathname === '/api/v1/harness/demonstrations' && method === 'POST') {
    denyCustomer(auth, 'harness measurement is not available to customers');
    sendJson(res, 201, requireHarness(deps).demonstrateSelfDevelopment({
      owner: auth.principal?.username ?? 'developer',
    }));
    return;
  }

  const mainBoard = /^\/api\/v1\/projects\/([^/]+)\/main-board$/.exec(url.pathname);
  if (mainBoard !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoard));
    sendJson(res, 200, createMainBoardResponse(deps, project.id, url));
    return;
  }

  const mainBoardViews = /^\/api\/v1\/projects\/([^/]+)\/main-board\/views$/.exec(url.pathname);
  if (mainBoardViews !== null && method === 'GET') {
    authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoardViews));
    sendJson(res, 200, { views: MAIN_BOARD_VIEWS });
    return;
  }

  const mainBoardCards = /^\/api\/v1\/projects\/([^/]+)\/main-board\/cards$/.exec(url.pathname);
  if (mainBoardCards !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoardCards));
    sendJson(res, 200, createMainBoardCardsResponse(deps, project.id, url));
    return;
  }

  const mainBoardMilestones = /^\/api\/v1\/projects\/([^/]+)\/main-board\/milestones$/.exec(url.pathname);
  if (mainBoardMilestones !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoardMilestones));
    sendJson(res, 200, createProjectMilestoneBoard(deps, project.id));
    return;
  }

  const mainBoardTree = /^\/api\/v1\/projects\/([^/]+)\/main-board\/tree$/.exec(url.pathname);
  if (mainBoardTree !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoardTree));
    sendJson(res, 200, createProjectTree(deps, project.id));
    return;
  }

  const mainBoardCoverage = /^\/api\/v1\/projects\/([^/]+)\/main-board\/coverage$/.exec(url.pathname);
  if (mainBoardCoverage !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoardCoverage));
    sendJson(res, 200, createProjectCoverage(deps, project.id));
    return;
  }

  const mainBoardTeam = /^\/api\/v1\/projects\/([^/]+)\/main-board\/team$/.exec(url.pathname);
  if (mainBoardTeam !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoardTeam));
    sendJson(res, 200, createProjectTeamBoard(deps, project.id));
    return;
  }

  const mainBoardWorkflow = /^\/api\/v1\/projects\/([^/]+)\/main-board\/workflow$/.exec(url.pathname);
  if (mainBoardWorkflow !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoardWorkflow));
    sendJson(res, 200, createProjectWorkflowBoard(deps, project.id, url));
    return;
  }

  const mainBoardEvidence = /^\/api\/v1\/projects\/([^/]+)\/main-board\/evidence$/.exec(url.pathname);
  if (mainBoardEvidence !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(mainBoardEvidence));
    sendJson(res, 200, createProjectEvidenceBoard(deps, project.id, url));
    return;
  }

  const projectDeliveryEvidence = /^\/api\/v1\/projects\/([^/]+)\/delivery-evidence$/.exec(url.pathname);
  if (projectDeliveryEvidence !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectDeliveryEvidence));
    sendJson(res, 200, {
      projectId: project.id,
      rollup: deps.board.getProjectDeliveryEvidenceRollup(project.id, evidenceRollupFilterFromUrl(url)),
      summaries: projectScopedWorkItems(deps, project.id)
        .filter((item) => matchesEvidenceBoardType(item))
        .map((item) => deps.board.getDeliveryEvidenceSummary(item.id)),
    });
    return;
  }

  const projectUnlinkedCode = /^\/api\/v1\/projects\/([^/]+)\/unlinked-code$/.exec(url.pathname);
  if (projectUnlinkedCode !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectUnlinkedCode));
    sendJson(res, 200, {
      projectId: project.id,
      unlinkedCode: deps.scm?.unlinkedCode(project.id) ?? [],
      adapters: ['local-git'],
      warnings: deps.scm === undefined ? ['scm_adapter_not_configured'] : [],
    });
    return;
  }

  const projectBusinessCrud = /^\/api\/v1\/projects\/([^/]+)\/business-crud$/.exec(url.pathname);
  if (projectBusinessCrud !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectBusinessCrud));
    sendJson(res, 200, createBusinessCrudCoverage(project.id));
    return;
  }

  const workflowRuns = /^\/api\/v1\/projects\/([^/]+)\/workflow-runs$/.exec(url.pathname);
  if (workflowRuns !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(workflowRuns));
    const workflowBoard = createProjectWorkflowBoard(deps, project.id, url);
    sendJson(res, 200, {
      projectId: project.id,
      runs: workflowBoard.summaries.map((item) => item.summary),
      summary: workflowBoard,
    });
    return;
  }

  const storyQueue = /^\/api\/v1\/projects\/([^/]+)\/story-queue$/.exec(url.pathname);
  if (storyQueue !== null && (method === 'GET' || method === 'POST')) {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(storyQueue));
    sendJson(res, 200, {
      ...deps.board.getStoryPriorityQueue(project.id, storyQueueFilterFromUrl(url)),
      recomputed: method === 'POST',
    });
    return;
  }

  const intakeSessions = /^\/api\/v1\/projects\/([^/]+)\/intake\/sessions$/.exec(url.pathname);
  if (intakeSessions !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(intakeSessions));
    sendJson(res, 200, {
      sessions: deps.board.listIntakeSessions({
        projectId: project.id,
        ...intakeSessionFilterFromUrl(url),
      }),
    });
    return;
  }
  if (intakeSessions !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(intakeSessions));
    sendJson(res, 201, deps.board.createIntakeSession({
      ...makeIntakeSessionCreateInput(body),
      projectId: project.id,
    }));
    return;
  }

  const intakeSession = /^\/api\/v1\/intake\/sessions\/([^/]+)$/.exec(url.pathname);
  if (intakeSession !== null && method === 'GET') {
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeSession));
    sendJson(res, 200, deps.board.getIntakeSessionBundle(session.id));
    return;
  }
  if (intakeSession !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeSession));
    sendJson(res, 200, deps.board.updateIntakeSession(session.id, makeIntakeSessionUpdateInput(body)));
    return;
  }

  const intakeMessages = /^\/api\/v1\/intake\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
  if (intakeMessages !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeMessages));
    const message = deps.board.addIntakeMessage(session.id, makeIntakeMessageCreateInput(body));
    const bundle = message.role === 'user' && message.kind === 'chat'
      ? deps.board.clarifyIntakeSession(session.id)
      : deps.board.getIntakeSessionBundle(session.id);
    sendJson(res, 201, {
      ...message,
      questions: bundle.questions,
      mktDraft: bundle.mktDraft,
    });
    return;
  }

  const intakeClarify = /^\/api\/v1\/intake\/sessions\/([^/]+)\/clarify$/.exec(url.pathname);
  if (intakeClarify !== null && method === 'POST') {
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeClarify));
    sendJson(res, 200, deps.board.clarifyIntakeSession(session.id));
    return;
  }

  const intakeFollowUps = /^\/api\/v1\/intake\/sessions\/([^/]+)\/follow-ups$/.exec(url.pathname);
  if (intakeFollowUps !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeFollowUps));
    sendJson(res, 200, deps.board.answerIntakeFollowUp(session.id, {
      field: requireString(body, 'field') as never,
      value: requireString(body, 'value'),
      author: optionalString(body, 'author') ?? auth.principal?.username ?? '',
    }));
    return;
  }

  const intakeSourceDocuments = /^\/api\/v1\/intake\/sessions\/([^/]+)\/source-documents$/.exec(url.pathname);
  if (intakeSourceDocuments !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeSourceDocuments));
    sendJson(res, 201, deps.board.addIntakeSourceDocument(
      session.id,
      makeIntakeSourceDocumentCreateInput(body),
    ));
    return;
  }

  const projectFiles = /^\/api\/v1\/projects\/([^/]+)\/files$/.exec(url.pathname);
  if (projectFiles !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectFiles));
    sendJson(res, 200, { files: requireDatabase(deps).listFiles({ projectId: project.id }) });
    return;
  }
  if (projectFiles !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectFiles));
    const uploader = optionalString(body, 'uploader') ?? auth.principal?.username ?? 'system';
    sendJson(res, 201, requireDatabase(deps).storeFile({
      projectId: project.id,
      originalFilename: requireString(body, 'originalFilename'),
      mimeType: requireString(body, 'mimeType'),
      uploader,
      bytes: decodeBase64Bytes(requireString(body, 'contentBase64')),
    }));
    return;
  }

  const storedFile = /^\/api\/v1\/files\/([^/]+)$/.exec(url.pathname);
  if (storedFile !== null && method === 'GET') {
    const file = requireDatabase(deps).getFile(idFromMatch(storedFile));
    if (file === undefined) throw new DatabaseError('FILE_NOT_FOUND', `stored file not found: ${idFromMatch(storedFile)}`);
    authorizeProject(deps, auth, file.projectId as ProjectId);
    sendJson(res, 200, file);
    return;
  }

  const storedFileContent = /^\/api\/v1\/files\/([^/]+)\/content$/.exec(url.pathname);
  if (storedFileContent !== null && method === 'GET') {
    const database = requireDatabase(deps);
    const file = database.getFile(idFromMatch(storedFileContent));
    if (file === undefined) {
      throw new DatabaseError('FILE_NOT_FOUND', `stored file not found: ${idFromMatch(storedFileContent)}`);
    }
    authorizeProject(deps, auth, file.projectId as ProjectId);
    sendBytes(res, 200, file.mimeType, database.readFileBytes(file.id));
    return;
  }

  const intakeAnalyze = /^\/api\/v1\/intake\/sessions\/([^/]+)\/analyze$/.exec(url.pathname);
  if (intakeAnalyze !== null && method === 'POST') {
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeAnalyze));
    const body = await readJsonObject(req);
    const mode = optionalString(body, 'mode');
    if (mode !== undefined && mode !== 'deterministic' && mode !== 'llm') {
      throw new Error('intake analysis mode must be deterministic or llm');
    }
    sendJson(res, 200, deps.board.analyzeIntakeSession(
      session.id,
      mode === undefined ? {} : { mode },
    ));
    return;
  }

  const intakeCandidates = /^\/api\/v1\/intake\/sessions\/([^/]+)\/candidates$/.exec(url.pathname);
  if (intakeCandidates !== null && method === 'GET') {
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeCandidates));
    sendJson(res, 200, {
      candidates: deps.board.listIntakeCandidates({
        sessionId: session.id,
        ...intakeCandidateFilterFromUrl(url),
      }),
    });
    return;
  }

  const intakeCandidate = /^\/api\/v1\/intake\/candidates\/([^/]+)$/.exec(url.pathname);
  if (intakeCandidate !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    const candidateId = idFromMatch<IntakeCandidateId>(intakeCandidate);
    const candidate = deps.board.listIntakeCandidates().find((item) => item.id === candidateId);
    if (candidate === undefined) throw new Error(`intake candidate not found: ${candidateId}`);
    assertProjectAccess(deps, auth, candidate.projectId);
    sendJson(res, 200, deps.board.updateIntakeCandidate(candidate.id, makeIntakeCandidateUpdateInput(body)));
    return;
  }

  const intakeApprove = /^\/api\/v1\/intake\/sessions\/([^/]+)\/approve$/.exec(url.pathname);
  if (intakeApprove !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const session = authorizeIntakeSession(deps, auth, idFromMatch<IntakeSessionId>(intakeApprove));
    const candidateIds = optionalIdArray<IntakeCandidateId>(body, 'candidateIds');
    const actorId = optionalString(body, 'actorId');
    sendJson(res, 200, deps.board.approveIntakeCandidates(session.id, {
      ...(candidateIds !== undefined ? { candidateIds } : {}),
      ...(actorId !== undefined ? { actorId } : {}),
    }));
    return;
  }

  const teamMembers = /^\/api\/v1\/projects\/([^/]+)\/team\/members$/.exec(url.pathname);
  if (teamMembers !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(teamMembers));
    sendJson(res, 200, {
      members: deps.board.listTeamMembers({ projectId: project.id }),
      capacity: deps.board.getTeamCapacity(project.id),
    });
    return;
  }
  if (teamMembers !== null && method === 'POST') {
    denyCustomer(auth, 'team roster is not available to customers');
    const body = await readJsonObject(req);
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(teamMembers));
    sendJson(res, 201, deps.board.createTeamMember(makeTeamMemberCreateInput(project.id, body)));
    return;
  }

  const teamCapacity = /^\/api\/v1\/projects\/([^/]+)\/team\/capacity$/.exec(url.pathname);
  if (teamCapacity !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(teamCapacity));
    sendJson(res, 200, deps.board.getTeamCapacity(project.id));
    return;
  }

  const teamMember = /^\/api\/v1\/team\/members\/([^/]+)$/.exec(url.pathname);
  if (teamMember !== null && method === 'PATCH') {
    denyCustomer(auth, 'team roster is not available to customers');
    const body = await readJsonObject(req);
    const member = deps.board.getTeamMember(idFromMatch<TeamMemberId>(teamMember));
    if (member === undefined) throw new Error(`team member not found: ${idFromMatch<TeamMemberId>(teamMember)}`);
    assertProjectAccess(deps, auth, member.projectId);
    sendJson(res, 200, deps.board.updateTeamMember(member.id, makeTeamMemberUpdateInput(body)));
    return;
  }

  const teamMemberAvailability = /^\/api\/v1\/team\/members\/([^/]+)\/availability$/.exec(url.pathname);
  if (teamMemberAvailability !== null && method === 'PATCH') {
    denyCustomer(auth, 'team roster is not available to customers');
    const body = await readJsonObject(req);
    const member = deps.board.getTeamMember(idFromMatch<TeamMemberId>(teamMemberAvailability));
    if (member === undefined) {
      throw new Error(`team member not found: ${idFromMatch<TeamMemberId>(teamMemberAvailability)}`);
    }
    assertProjectAccess(deps, auth, member.projectId);
    sendJson(res, 200, deps.board.updateTeamMember(member.id, makeTeamMemberUpdateInput(body)));
    return;
  }

  const teamMemberRoles = /^\/api\/v1\/team\/members\/([^/]+)\/roles$/.exec(url.pathname);
  if (teamMemberRoles !== null && method === 'POST') {
    denyCustomer(auth, 'team roster is not available to customers');
    const member = deps.board.getTeamMember(idFromMatch<TeamMemberId>(teamMemberRoles));
    if (member === undefined) throw new Error(`team member not found: ${idFromMatch<TeamMemberId>(teamMemberRoles)}`);
    assertProjectAccess(deps, auth, member.projectId);
    const body = await readJsonObject(req);
    sendJson(res, 200, deps.board.addTeamMemberRole(member.id, requireId<RoleId>(body, 'roleId')));
    return;
  }
  const teamMemberRole = /^\/api\/v1\/team\/members\/([^/]+)\/roles\/([^/]+)$/.exec(url.pathname);
  if (teamMemberRole !== null && method === 'DELETE') {
    denyCustomer(auth, 'team roster is not available to customers');
    const member = deps.board.getTeamMember(teamMemberRole[1] as TeamMemberId);
    if (member === undefined) throw new Error(`team member not found: ${teamMemberRole[1] ?? ''}`);
    assertProjectAccess(deps, auth, member.projectId);
    sendJson(res, 200, deps.board.removeTeamMemberRole(member.id, (teamMemberRole[2] ?? '') as RoleId));
    return;
  }

  const teamWipPolicies = /^\/api\/v1\/projects\/([^/]+)\/team\/wip-policies$/.exec(url.pathname);
  if (teamWipPolicies !== null && method === 'GET') {
    denyCustomer(auth, 'team roster is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(teamWipPolicies));
    sendJson(res, 200, { policies: deps.board.listTeamWipPolicies(project.id) });
    return;
  }
  if (teamWipPolicies !== null && method === 'PATCH') {
    denyCustomer(auth, 'team roster is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(teamWipPolicies));
    const body = await readJsonObject(req);
    sendJson(res, 200, deps.board.replaceTeamWipPolicies(project.id, requireWipPolicies(body)));
    return;
  }

  const workItemAssignment = /^\/api\/v1\/work-items\/([^/]+)\/assignments$/.exec(url.pathname);
  if (workItemAssignment !== null && method === 'POST') {
    denyCustomer(auth, 'team roster is not available to customers');
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemAssignment));
    sendJson(res, 200, deps.board.assignWorkItem(item.id, makeWorkItemAssignmentInput(body)));
    return;
  }

  const workItemReviewers = /^\/api\/v1\/work-items\/([^/]+)\/reviewers$/.exec(url.pathname);
  if (workItemReviewers !== null && method === 'POST') {
    denyCustomer(auth, 'team roster is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemReviewers));
    const body = await readJsonObject(req);
    sendJson(res, 200, deps.board.addWorkItemReviewer(item.id, requireId<TeamMemberId>(body, 'memberId')));
    return;
  }
  const workItemReviewer = /^\/api\/v1\/work-items\/([^/]+)\/reviewers\/([^/]+)$/.exec(url.pathname);
  if (workItemReviewer !== null && method === 'DELETE') {
    denyCustomer(auth, 'team roster is not available to customers');
    const item = authorizeWorkItem(deps, auth, (workItemReviewer[1] ?? '') as WorkItemId);
    sendJson(res, 200, deps.board.removeWorkItemReviewer(item.id, (workItemReviewer[2] ?? '') as TeamMemberId));
    return;
  }
  const workItemApprovers = /^\/api\/v1\/work-items\/([^/]+)\/approvers$/.exec(url.pathname);
  if (workItemApprovers !== null && method === 'POST') {
    denyCustomer(auth, 'team roster is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemApprovers));
    const body = await readJsonObject(req);
    sendJson(res, 200, deps.board.addWorkItemApprover(item.id, requireId<TeamMemberId>(body, 'memberId')));
    return;
  }
  const workItemApprover = /^\/api\/v1\/work-items\/([^/]+)\/approvers\/([^/]+)$/.exec(url.pathname);
  if (workItemApprover !== null && method === 'DELETE') {
    denyCustomer(auth, 'team roster is not available to customers');
    const item = authorizeWorkItem(deps, auth, (workItemApprover[1] ?? '') as WorkItemId);
    sendJson(res, 200, deps.board.removeWorkItemApprover(item.id, (workItemApprover[2] ?? '') as TeamMemberId));
    return;
  }
  const workItemWatchers = /^\/api\/v1\/work-items\/([^/]+)\/watchers$/.exec(url.pathname);
  if (workItemWatchers !== null && method === 'POST') {
    denyCustomer(auth, 'team roster is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemWatchers));
    const body = await readJsonObject(req);
    sendJson(res, 200, deps.board.addWorkItemWatcher(item.id, requireId<TeamMemberId>(body, 'memberId')));
    return;
  }
  const workItemWatcher = /^\/api\/v1\/work-items\/([^/]+)\/watchers\/([^/]+)$/.exec(url.pathname);
  if (workItemWatcher !== null && method === 'DELETE') {
    denyCustomer(auth, 'team roster is not available to customers');
    const item = authorizeWorkItem(deps, auth, (workItemWatcher[1] ?? '') as WorkItemId);
    sendJson(res, 200, deps.board.removeWorkItemWatcher(item.id, (workItemWatcher[2] ?? '') as TeamMemberId));
    return;
  }

  const workItemWorkflow = /^\/api\/v1\/work-items\/([^/]+)\/workflow$/.exec(url.pathname);
  if (workItemWorkflow !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemWorkflow));
    const engine = deps.workflow;
    const run = engine?.listRuns(item.projectId).find((itemRun) => itemRun.workItemId === item.id);
    sendJson(res, 200, {
      ...deps.board.getWorkflowBoardSummary(item.id),
      ...(run !== undefined ? { run } : {}),
    });
    return;
  }
  if (workItemWorkflow !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemWorkflow));
    sendJson(res, 200, deps.board.updateWorkflowBoardSummary(item.id, makeWorkflowBoardSummaryInput(body)));
    return;
  }

  if (await handleWorkflowApi(deps, auth, method, url, req, res)) return;

  const workItemWorkflowSummary = /^\/api\/v1\/work-items\/([^/]+)\/workflow-board-summary$/.exec(url.pathname);
  if (workItemWorkflowSummary !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemWorkflowSummary));
    sendJson(res, 200, deps.board.getWorkflowBoardSummary(item.id));
    return;
  }
  if (workItemWorkflowSummary !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemWorkflowSummary));
    sendJson(res, 200, deps.board.updateWorkflowBoardSummary(item.id, makeWorkflowBoardSummaryInput(body)));
    return;
  }

  const workItemCodeView = /^\/api\/v1\/work-items\/([^/]+)\/code-view$/.exec(url.pathname);
  if (workItemCodeView !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemCodeView));
    sendJson(res, 200, createWorkItemCodeView(deps, item.id));
    return;
  }

  const workItemAuditEvents = /^\/api\/v1\/work-items\/([^/]+)\/audit-events$/.exec(url.pathname);
  if (workItemAuditEvents !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemAuditEvents));
    sendJson(res, 200, {
      projectId: item.projectId,
      workItemId: item.id,
      auditEvents: deps.board.listAuditEvents({
        projectId: item.projectId,
        ...auditEventFilterFromUrl(url),
        targetType: 'work_item',
        targetId: item.id,
      }),
    });
    return;
  }

  const workItemEvidence = /^\/api\/v1\/work-items\/([^/]+)\/(?:delivery-evidence|evidence)$/.exec(url.pathname);
  if (workItemEvidence !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemEvidence));
    sendJson(res, 200, deps.board.getDeliveryEvidenceSummary(item.id));
    return;
  }
  if (workItemEvidence !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemEvidence));
    sendJson(res, 200, deps.board.updateDeliveryEvidenceSummary(item.id, makeDeliveryEvidenceSummaryInput(body)));
    return;
  }

  const workItemGovernance = /^\/api\/v1\/work-items\/([^/]+)\/(?:compliance|governance)$/.exec(url.pathname);
  if (workItemGovernance !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemGovernance));
    sendJson(res, 200, createGovernanceDetail(deps, item.id));
    return;
  }

  const workItemRiskView = /^\/api\/v1\/work-items\/([^/]+)\/(security|reliability|trust)$/.exec(url.pathname);
  if (workItemRiskView !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemRiskView));
    const area = idFromMatchAt<DeliveryRiskArea>(workItemRiskView, 2);
    sendJson(res, 200, createRiskAreaDetail(deps, item.id, area));
    return;
  }

  const milestonePlan = /^\/api\/v1\/work-items\/([^/]+)\/milestone-plan$/.exec(url.pathname);
  if (milestonePlan !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(milestonePlan));
    sendJson(res, 200, createWorkItemMilestonePlan(deps, item.id));
    return;
  }

  const createMilestoneSlice = /^\/api\/v1\/work-items\/([^/]+)\/milestone-slices$/.exec(url.pathname);
  if (createMilestoneSlice !== null && method === 'POST') {
    const body = await readJsonObject(req);
    authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(createMilestoneSlice));
    sendJson(res, 201, deps.board.createMilestoneDeliverySlice(
      makeMilestoneDeliverySliceCreateInput(idFromMatch<WorkItemId>(createMilestoneSlice), body),
    ));
    return;
  }

  const updateMilestoneSlice = /^\/api\/v1\/work-items\/([^/]+)\/milestone-slices\/([^/]+)$/.exec(url.pathname);
  if (updateMilestoneSlice !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    const workItemId = idFromMatch<WorkItemId>(updateMilestoneSlice);
    authorizeWorkItem(deps, auth, workItemId);
    const sliceId = idFromMatchAt<MilestoneDeliverySliceId>(updateMilestoneSlice, 2);
    const existing = deps.board
      .listMilestoneDeliverySlices({ parentWorkItemId: workItemId })
      .find((slice) => slice.id === sliceId);
    if (existing === undefined) {
      throw new Error(`milestone delivery slice ${sliceId} does not belong to work item ${workItemId}`);
    }
    const slice = deps.board.updateMilestoneDeliverySlice(sliceId, makeMilestoneDeliverySliceUpdateInput(body));
    sendJson(res, 200, slice);
    return;
  }

  const milestoneRequirementSlices = /^\/api\/v1\/milestones\/([^/]+)\/requirement-slices$/.exec(url.pathname);
  if (milestoneRequirementSlices !== null && method === 'GET') {
    const milestone = authorizeMilestone(deps, auth, idFromMatch<MilestoneId>(milestoneRequirementSlices));
    sendJson(res, 200, createMilestoneRequirementSlices(deps, milestone.id));
    return;
  }

  const milestoneCodeView = /^\/api\/v1\/milestones\/([^/]+)\/code-view$/.exec(url.pathname);
  if (milestoneCodeView !== null && method === 'GET') {
    const milestone = authorizeMilestone(deps, auth, idFromMatch<MilestoneId>(milestoneCodeView));
    sendJson(res, 200, createMilestoneCodeView(deps, milestone.id));
    return;
  }

  const boardDetail = /^\/api\/v1\/work-items\/([^/]+)\/board-detail$/.exec(url.pathname);
  if (boardDetail !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(boardDetail));
    sendJson(res, 200, createBoardDetailResponse(deps, item.id));
    return;
  }
  if (boardDetail !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(boardDetail));
    deps.board.updateWorkItem(item.id, makeUpdateInput(body));
    sendJson(res, 200, createBoardDetailResponse(deps, item.id));
    return;
  }

  const traceability = /^\/api\/v1\/work-items\/([^/]+)\/traceability$/.exec(url.pathname);
  if (traceability !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(traceability));
    sendJson(res, 200, createTraceabilityResponse(deps, item.id));
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

function createMainBoardResponse(
  deps: WebServiceDependencies,
  projectId: ProjectId,
  url: URL,
) {
  const project = requireProject(deps, projectId);
  const view = mainBoardViewFromUrl(url);
  const workItems = projectScopedWorkItems(deps, projectId);
  const cards = createMainBoardCards(deps, projectId, view);
  const columns = createMainBoardColumns(deps, projectId, view, cards);
  const milestones = deps.board.listMilestones({ projectId });
  const teamMembers = deps.board.listTeamMembers({ projectId });
  return {
    project,
    view,
    views: MAIN_BOARD_VIEWS,
    milestones,
    teamMembers,
    milestoneSummaries: milestones.map((milestone) => deps.board.getMilestoneSummary(milestone.id)),
    workItems,
    cards,
    columns,
    milestoneBoard: createProjectMilestoneBoard(deps, projectId),
    teamBoard: createProjectTeamBoard(deps, projectId),
    workflowBoard: createProjectWorkflowBoard(deps, projectId, url),
    storyQueue: deps.board.getStoryPriorityQueue(projectId, storyQueueFilterFromUrl(url)),
    evidenceBoard: createProjectEvidenceBoard(deps, projectId, url),
    tree: createProjectTree(deps, projectId),
    coverage: createProjectCoverage(deps, projectId),
    boardHealth: createBoardHealth(cards),
  };
}

function createMainBoardCardsResponse(
  deps: WebServiceDependencies,
  projectId: ProjectId,
  url: URL,
) {
  const view = mainBoardViewFromUrl(url);
  requireProject(deps, projectId);
  return {
    view,
    cards: createMainBoardCards(deps, projectId, view),
  };
}

function createBoardDetailResponse(
  deps: WebServiceDependencies,
  workItemId: WorkItemId,
) {
  const workItem = requireWorkItem(deps, workItemId);
  const project = requireProject(deps, workItem.projectId);
  const card = createMainBoardCard(
    deps,
    workItem,
    projectScopedWorkItems(deps, workItem.projectId),
    projectScopedMilestones(deps, workItem.projectId),
  );
  const children = projectScopedWorkItems(deps, workItem.projectId)
    .filter((item) => item.parentId === workItem.id)
    .map((item) => createWorkItemCrumb(item));
  const milestonePlan = createWorkItemMilestonePlan(deps, workItem.id);
  const teamMembers = deps.board.listTeamMembers({ projectId: workItem.projectId });
  const intakeOrigin = createWorkItemIntakeOrigin(deps, workItem);
  const sourceSummary = intakeOrigin === null
    ? summarizeText(`${workItem.sourceInput}\n${workItem.decompositionReason}`)
    : `${String(intakeOrigin.sourceRefs.length)} source reference(s)`;
  return {
    project,
    card,
    teamMembers,
    assignedMember: card.assigneeMember,
    children,
    milestonePlan,
    intakeOrigin,
    collaborationTasks: deps.collab?.listOpenTasks(workItem.projectId, workItem.id) ?? [],
    unresolvedQuestions: deps.collab?.listUnresolvedQuestions(workItem.projectId, workItem.id) ?? [],
    channelDecisions: deps.collab?.listDecisions(workItem.projectId, workItem.id) ?? [],
    agentFeedback: deps.dispatch?.listFeedback(workItem.id) ?? [],
    resourceLeases: deps.dispatch?.listLeases(workItem.projectId).filter((lease) => lease.workItemId === workItem.id) ?? [],
    editableFields: [
      'title',
      'body',
      'analysis',
      'design',
      'sourceInput',
      'decompositionReason',
      'priority',
      'estimate',
      'assignee',
      'assignment',
      'parentId',
      'milestoneId',
      'acceptanceCriteria',
    ],
    tabSummaries: {
      summary: summarizeText(workItem.body),
      analysis: summarizeText(workItem.analysis),
      design: summarizeText(workItem.design),
      acceptance: `${String(card.acceptanceRollup.coveredCriteria)}/${String(card.acceptanceRollup.totalCriteria)}`,
      children: `${String(card.childRollup.unfinished)} unfinished of ${String(card.childRollup.total)}`,
      milestones: `${String(milestonePlan.openSlices)} open slice(s)`,
      source: sourceSummary,
      team: card.assigneeMember?.displayName ?? 'Unassigned',
      workflow: card.workflowSummary.nextAction,
      evidence: `${String(card.evidenceSummary.evidenceCount)} evidence item(s)`,
      governance: card.governanceSummary.blockers.length === 0 ? 'No active blockers' : 'Blocked',
    },
  };
}

function createTraceabilityResponse(
  deps: WebServiceDependencies,
  workItemId: WorkItemId,
) {
  const root = requireWorkItem(deps, workItemId);
  const projectWorkItems = projectScopedWorkItems(deps, root.projectId);
  const milestones = projectScopedMilestones(deps, root.projectId);
  const card = createMainBoardCard(deps, root, projectWorkItems, milestones);
  const tree = deps.board.getWorkItemTree(workItemId);
  const treeItems = flattenTree(tree);
  const descendants = treeItems.slice(1).map((item) => createWorkItemCrumb(item));
  const intakeOrigins = treeItems
    .map((item) => createWorkItemIntakeOrigin(deps, item))
    .filter((origin): origin is WorkItemIntakeOrigin => origin !== null);
  return {
    root: card,
    tree,
    descendants,
    intakeOrigins,
    warnings: card.warnings,
  };
}

function createWorkItemIntakeOrigin(
  deps: WebServiceDependencies,
  workItem: WorkItem,
): WorkItemIntakeOrigin | null {
  const candidate = deps.board
    .listIntakeCandidates({ projectId: workItem.projectId })
    .find((item) => item.workItemId === workItem.id);
  if (candidate === undefined) return null;
  const bundle = deps.board.getIntakeSessionBundle(candidate.sessionId);
  const messagesById = new Map(bundle.messages.map((message) => [message.id, message]));
  const sourceDocumentsById = new Map(bundle.sourceDocuments.map((sourceDocument) => [
    sourceDocument.id,
    sourceDocument,
  ]));
  const sourceRefs = candidate.sourceRefs.map((sourceRef) => {
    const sourceDocument = sourceRef.sourceDocumentId === null
      ? null
      : sourceDocumentsById.get(sourceRef.sourceDocumentId) ?? null;
    const chunk = sourceDocument === null || sourceRef.sourceChunkId === null
      ? null
      : sourceDocument.chunks.find((item) => item.id === sourceRef.sourceChunkId) ?? null;
    return {
      sourceRef,
      message: sourceRef.messageId === null ? null : messagesById.get(sourceRef.messageId) ?? null,
      sourceDocument: sourceDocument === null ? null : summarizeWorkItemIntakeSourceDocument(sourceDocument),
      chunk,
    };
  });
  return {
    session: bundle.session,
    candidate,
    sourceRefs,
  };
}

function summarizeWorkItemIntakeSourceDocument(
  sourceDocument: IntakeSourceDocument,
): WorkItemIntakeSourceDocumentSummary {
  return {
    id: sourceDocument.id,
    kind: sourceDocument.kind,
    name: sourceDocument.name,
    mimeType: sourceDocument.mimeType,
    size: sourceDocument.size,
    parseStatus: sourceDocument.parseStatus,
    parseError: sourceDocument.parseError,
    storedFileId: sourceDocument.storedFileId,
    createdAt: sourceDocument.createdAt,
  };
}

function createProjectMilestoneBoard(
  deps: WebServiceDependencies,
  projectId: ProjectId,
): MainBoardMilestoneBoard {
  requireProject(deps, projectId);
  const workItems = projectScopedWorkItems(deps, projectId);
  const milestones = projectScopedMilestones(deps, projectId);
  const team = createTeamContext(deps, projectId);
  const cards = workItems.map((item) => createMainBoardCard(deps, item, workItems, milestones, team));
  const cardsByMilestone = new Map<MilestoneId | null, MainBoardCard[]>();
  for (const card of cards) {
    cardsByMilestone.set(card.workItem.milestoneId, [
      ...(cardsByMilestone.get(card.workItem.milestoneId) ?? []),
      card,
    ]);
  }

  const workItemById = new Map(workItems.map((item) => [item.id, item]));
  const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  const sliceCards = deps.board
    .listMilestoneDeliverySlices({ projectId })
    .map((slice) => createDeliverySliceCard(deps, slice, workItemById, milestoneById));
  const slicesByMilestone = new Map<MilestoneId, MainBoardDeliverySliceCard[]>();
  for (const slice of sliceCards) {
    slicesByMilestone.set(slice.slice.milestoneId, [
      ...(slicesByMilestone.get(slice.slice.milestoneId) ?? []),
      slice,
    ]);
  }

  const lanes: MainBoardMilestoneLane[] = milestones.map((milestone) =>
    createMilestoneLane(
      milestone.id,
      milestone.title,
      milestone,
      deps.board.getMilestoneSummary(milestone.id),
      cardsByMilestone.get(milestone.id) ?? [],
      slicesByMilestone.get(milestone.id) ?? [],
    ),
  );
  const unassignedCards = cardsByMilestone.get(null) ?? [];
  if (unassignedCards.length > 0) {
    lanes.push(createMilestoneLane(
      'no-milestone',
      'No milestone',
      null,
      null,
      unassignedCards,
      [],
    ));
  }
  const completedSlices = sliceCards.filter((item) => isDeliverySliceComplete(item.slice)).length;
  const blockedSlices = sliceCards.filter((item) =>
    item.warnings.some((warning) => warning.severity === 'blocking'),
  ).length;
  return {
    lanes,
    totalSlices: sliceCards.length,
    completedSlices,
    openSlices: sliceCards.length - completedSlices,
    blockedSlices,
    percentSlicesComplete: percent(sliceCards.length, completedSlices),
    warnings: sliceCards.flatMap((item) => item.warnings),
  };
}

function createProjectTeamBoard(
  deps: WebServiceDependencies,
  projectId: ProjectId,
): MainBoardTeamBoard {
  const project = requireProject(deps, projectId);
  const workItems = projectScopedWorkItems(deps, projectId);
  const milestones = projectScopedMilestones(deps, projectId);
  const team = createTeamContext(deps, projectId);
  const cardsById = new Map(workItems.map((item) => [
    item.id,
    createMainBoardCard(deps, item, workItems, milestones, team),
  ]));
  const roleNamesById = new Map(project.roles.map((role) => [role.id, role.displayName]));
  const members = team.capacity.members.map((summary) => ({
    member: summary.member,
    summary,
    roleNames: summary.member.roleIds.map((roleId) => roleNamesById.get(roleId) ?? roleId),
    assignedCards: summary.assignedWorkItemIds
      .map((id) => cardsById.get(id))
      .filter((item): item is MainBoardCard => item !== undefined),
  }));
  const unassignedCards = team.capacity.unassignedWorkItemIds
    .map((id) => cardsById.get(id))
    .filter((item): item is MainBoardCard => item !== undefined);
  return {
    capacity: team.capacity,
    members,
    unassignedCards,
    warnings: team.capacity.warnings.map(createTeamWarning),
  };
}

function createProjectWorkflowBoard(
  deps: WebServiceDependencies,
  projectId: ProjectId,
  url: URL,
): MainBoardWorkflowBoard {
  requireProject(deps, projectId);
  const projectWorkItems = projectScopedWorkItems(deps, projectId);
  const workItems = projectWorkItems
    .filter((item) => ['requirement', 'story', 'task', 'bug', 'defect', 'research'].includes(item.type));
  const milestones = projectScopedMilestones(deps, projectId);
  const team = createTeamContext(deps, projectId);
  const summaries = workItems.map((item) => {
    const card = createMainBoardCard(deps, item, projectWorkItems, milestones, team);
    const blockedReasonCodes = workflowBlockedReasonCodes(card.workflowSummary);
    return {
      card,
      summary: card.workflowSummary,
      schedulerReason: card.workflowSummary.schedulerReason || card.workflowSummary.nextAction,
      blockedReasonCodes,
    };
  });
  const byStatus = new Map<WorkflowRunStatus, MainBoardWorkflowCard[]>();
  for (const item of summaries) {
    byStatus.set(item.summary.runStatus, [...(byStatus.get(item.summary.runStatus) ?? []), item]);
  }
  const lifecycleLanes = createAgileLifecycleLanes(summaries);
  const lanes = WORKFLOW_LANE_DEFINITIONS
    .map((lane) => ({
      ...lane,
      cards: byStatus.get(lane.id) ?? [],
    }))
    .filter((lane) => lane.cards.length > 0 || ['running', 'waiting', 'blocked', 'ready'].includes(lane.id));
  return {
    storyQueue: deps.board.getStoryPriorityQueue(projectId, storyQueueFilterFromUrl(url)),
    lifecycleLanes,
    lifecycleCoverage: createAgileLifecycleCoverage(lifecycleLanes),
    lanes,
    summaries,
    activeWorkflows: summaries.filter((item) => ACTIVE_WORKFLOW_RUN_STATUSES.includes(item.summary.runStatus)).length,
    blockedWorkflows: summaries.filter((item) =>
      item.summary.runStatus === 'blocked' || item.summary.blockedSteps.length > 0,
    ).length,
    waitingApprovals: summaries.reduce((total, item) => total + item.summary.waitingApprovals.length, 0),
    waitingReviews: summaries.reduce((total, item) => total + item.summary.waitingReviews.length, 0),
    failedChecks: summaries.reduce((total, item) => total + item.summary.failedChecks.length, 0),
    warnings: summaries.flatMap((item) => workflowWarnings(item.summary)),
  };
}

function createAgileLifecycleLanes(
  summaries: readonly MainBoardWorkflowCard[],
): readonly MainBoardLifecycleLane[] {
  return AGILE_LIFECYCLE_LANE_DEFINITIONS.map((lane) => {
    const cards = summaries
      .filter((item) => lane.statuses.includes(item.card.workItem.status))
      .sort(compareWorkflowCardsByPriority);
    const blockedCards = cards.filter(hasWorkflowBlocker).length;
    const readyCards = cards.filter((item) => item.summary.runStatus === 'ready').length;
    const missingEvidenceCards = cards.filter((item) => hasLifecycleEvidenceGap(item, lane.evidenceAreas)).length;
    return {
      ...lane,
      cards,
      totalCards: cards.length,
      blockedCards,
      readyCards,
      missingEvidenceCards,
      warnings: createAgileLifecycleLaneWarnings(lane, blockedCards, missingEvidenceCards),
    };
  });
}

function compareWorkflowCardsByPriority(
  left: MainBoardWorkflowCard,
  right: MainBoardWorkflowCard,
): number {
  const priorityOrder: Record<WorkItemPriority, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };
  return (priorityOrder[left.card.workItem.priority ?? 'p3'] ?? 9)
    - (priorityOrder[right.card.workItem.priority ?? 'p3'] ?? 9)
    || left.card.workItem.title.localeCompare(right.card.workItem.title);
}

function hasWorkflowBlocker(item: MainBoardWorkflowCard): boolean {
  return item.blockedReasonCodes.length > 0 ||
    item.summary.runStatus === 'blocked' ||
    item.summary.blockedSteps.length > 0 ||
    item.summary.failedChecks.length > 0;
}

function hasLifecycleEvidenceGap(
  item: MainBoardWorkflowCard,
  evidenceAreas: readonly DeliveryEvidenceArea[],
): boolean {
  if (evidenceAreas.length === 0) return false;
  const gapStatuses: readonly DeliveryEvidenceStatus[] = ['missing', 'failing', 'blocked'];
  return item.card.evidenceSummary.summary.checks.some((check) =>
    evidenceAreas.includes(check.area) &&
    check.required &&
    gapStatuses.includes(check.status)
  );
}

function createAgileLifecycleLaneWarnings(
  lane: MainBoardLifecycleLaneDefinition,
  blockedCards: number,
  missingEvidenceCards: number,
): readonly MainBoardWarning[] {
  const warnings: MainBoardWarning[] = [];
  if (blockedCards > 0) {
    warnings.push({
      code: 'workflow_lifecycle_blocked',
      severity: 'blocking',
      message: `${lane.title} has ${blockedCards} blocked work item(s).`,
    });
  }
  if (missingEvidenceCards > 0) {
    warnings.push({
      code: 'workflow_lifecycle_evidence_gap',
      severity: 'blocking',
      message: `${lane.title} has ${missingEvidenceCards} work item(s) with required evidence gaps.`,
    });
  }
  return warnings;
}

function createAgileLifecycleCoverage(
  lanes: readonly MainBoardLifecycleLane[],
): MainBoardLifecycleCoverage {
  const mappedStatuses = uniqueWorkItemStatuses(lanes.flatMap((lane) => lane.statuses));
  return {
    totalLanes: lanes.length,
    occupiedLanes: lanes.filter((lane) => lane.totalCards > 0).length,
    totalCards: lanes.reduce((total, lane) => total + lane.totalCards, 0),
    blockedCards: lanes.reduce((total, lane) => total + lane.blockedCards, 0),
    missingEvidenceCards: lanes.reduce((total, lane) => total + lane.missingEvidenceCards, 0),
    mappedStatuses,
    unmappedStatuses: WORK_ITEM_STATUSES.filter((status) => !mappedStatuses.includes(status)),
  };
}

function uniqueWorkItemStatuses(statuses: readonly WorkItemStatus[]): readonly WorkItemStatus[] {
  return WORK_ITEM_STATUSES.filter((status) => statuses.includes(status));
}

function createProjectEvidenceBoard(
  deps: WebServiceDependencies,
  projectId: ProjectId,
  url: URL,
): MainBoardEvidenceBoard {
  requireProject(deps, projectId);
  const projectWorkItems = projectScopedWorkItems(deps, projectId);
  const workItems = projectWorkItems.filter(matchesEvidenceBoardType);
  const milestones = projectScopedMilestones(deps, projectId);
  const team = createTeamContext(deps, projectId);
  const summaries = workItems.map((item) => {
    const card = createMainBoardCard(deps, item, projectWorkItems, milestones, team);
    const laneId = evidenceLaneForSummary(card.evidenceSummary, card.governanceSummary);
    return {
      card,
      summary: card.evidenceSummary.summary,
      laneId,
      blockedReasonCodes: deliveryEvidenceBlockedReasonCodes(card.evidenceSummary, card.governanceSummary),
    };
  });
  const byLane = new Map<MainBoardEvidenceLane['id'], MainBoardEvidenceCard[]>();
  for (const item of summaries) {
    byLane.set(item.laneId, [...(byLane.get(item.laneId) ?? []), item]);
  }
  const lanes = EVIDENCE_LANE_DEFINITIONS.map((lane) => ({
    ...lane,
    cards: byLane.get(lane.id) ?? [],
  })).filter((lane) => lane.cards.length > 0 || lane.id !== 'passing');
  return {
    lanes,
    summaries,
    rollup: deps.board.getProjectDeliveryEvidenceRollup(projectId, evidenceRollupFilterFromUrl(url)),
    warnings: summaries.flatMap((item) =>
      deliveryEvidenceWarnings(item.card.evidenceSummary, item.card.governanceSummary),
    ),
  };
}

function matchesEvidenceBoardType(item: WorkItem): boolean {
  return ['requirement', 'story', 'task', 'bug', 'defect', 'research'].includes(item.type);
}

function evidenceLaneForSummary(
  evidence: EvidenceBoardSummary,
  governance: GovernanceBoardSummary,
): MainBoardEvidenceLane['id'] {
  if (
    evidence.failedRequiredChecks > 0 ||
    evidence.blockedRequiredChecks > 0 ||
    governance.blockers.length > 0
  ) {
    return 'blocked';
  }
  if (evidence.missingRequiredChecks > 0) return 'missing';
  if (evidence.pendingChecks > 0) return 'pending';
  return 'passing';
}

function deliveryEvidenceBlockedReasonCodes(
  evidence: EvidenceBoardSummary,
  governance: GovernanceBoardSummary,
): readonly string[] {
  return [
    ...evidence.blockers.map(deliveryEvidenceWarningCode),
    ...(governance.unapprovedObligations > 0 ? ['compliance_review_pending'] : []),
    ...(governance.openRiskAcceptances > 0 ? ['risk_acceptance_open'] : []),
  ];
}

function deliveryEvidenceWarnings(
  evidence: EvidenceBoardSummary,
  governance: GovernanceBoardSummary,
): readonly MainBoardWarning[] {
  const warnings: MainBoardWarning[] = evidence.blockers.map((check) => ({
    code: deliveryEvidenceWarningCode(check),
    severity: check.status === 'pending' ? 'warning' : 'blocking',
    message: `Delivery check is ${check.status}: ${check.title}.`,
  }));
  if (governance.unapprovedObligations > 0) {
    warnings.push({
      code: 'compliance_review_pending',
      severity: 'blocking',
      message: 'Compliance obligations are waiting for approval before they can become policy.',
    });
  }
  if (governance.openRiskAcceptances > 0) {
    warnings.push({
      code: 'risk_acceptance_open',
      severity: 'blocking',
      message: 'Residual risk acceptances are open or expired.',
    });
  }
  return warnings;
}

function deliveryEvidenceWarningCode(check: DeliveryEvidenceCheck): string {
  if (check.status === 'pending') return `pending_${check.area}_evidence`;
  return `missing_${check.area}_evidence`;
}

function createWorkItemCodeView(
  deps: WebServiceDependencies,
  workItemId: WorkItemId,
) {
  const item = requireWorkItem(deps, workItemId);
  const summary = deps.board.getDeliveryEvidenceSummary(item.id);
  const managed = deps.scm?.codeView(item.id);
  const managedRepos = managed?.repositories ?? [];
  const managedBranches = managed?.branches ?? [];
  const managedCommits = managed?.commits ?? [];
  const managedDiffs = managed?.diffs ?? [];
  const managedFiles = managed?.changedFiles ?? [];
  const managedPrs = managed?.pullRequests ?? [];
  return {
    workItem: createWorkItemCrumb(item),
    acceptanceCoverage: deps.board.getAcceptanceCoverage(item.id),
    repositories: managedRepos.length > 0
      ? managedRepos
      : summary.codeLinks.filter((link) => link.kind === 'repository'),
    branches: managedBranches.length > 0
      ? managedBranches
      : summary.codeLinks.filter((link) => link.kind === 'branch'),
    commits: managedCommits.length > 0
      ? managedCommits
      : summary.codeLinks.filter((link) => link.kind === 'commit'),
    diffs: managedDiffs.length > 0
      ? managedDiffs
      : summary.codeLinks.filter((link) => link.kind === 'diff'),
    changedFiles: managedFiles.length > 0
      ? managedFiles
      : summary.codeLinks.filter((link) => link.kind === 'changed-file'),
    pullRequests: managedPrs.length > 0
      ? managedPrs
      : summary.pullRequests,
    reviews: summary.reviewLinks,
    ciRuns: summary.ciRuns,
    deploymentLinks: summary.deploymentLinks,
    checks: summary.checks,
    unlinkedCode: managed?.unlinked === true ? ['no-managed-branch'] : [],
    leases: (deps.dispatch?.listLeases(item.projectId) ?? []).filter((lease) => lease.workItemId === item.id),
    warnings: deliveryEvidenceWarnings(
      createEvidenceSummary(deps, item, deps.board.getAcceptanceCoverage(item.id)),
      createGovernanceSummary(summary),
    ),
  };
}

function createMilestoneCodeView(
  deps: WebServiceDependencies,
  milestoneId: MilestoneId,
) {
  const milestone = deps.board.getMilestone(milestoneId);
  if (milestone === undefined) throw new Error(`milestone not found: ${milestoneId}`);
  const directWorkItems = deps.board.listWorkItems({ milestoneId });
  const workItemsById = new Map(directWorkItems.map((item) => [item.id, item]));
  for (const slice of deps.board.listMilestoneDeliverySlices({ milestoneId })) {
    const parent = deps.board.getWorkItem(slice.parentWorkItemId);
    if (parent !== undefined) workItemsById.set(parent.id, parent);
  }
  return {
    milestone,
    rollup: deps.board.getProjectDeliveryEvidenceRollup(milestone.projectId, { milestoneId }),
    workItems: sortWorkItems([...workItemsById.values()]).map((item) => createWorkItemCodeView(deps, item.id)),
  };
}

function createGovernanceDetail(
  deps: WebServiceDependencies,
  workItemId: WorkItemId,
) {
  const item = requireWorkItem(deps, workItemId);
  const summary = deps.board.getDeliveryEvidenceSummary(item.id);
  return {
    workItem: createWorkItemCrumb(item),
    obligations: summary.obligations,
    governanceChecks: summary.checks.filter((check) => check.area === 'governance'),
    securityChecks: summary.checks.filter((check) => check.area === 'security'),
    reliabilityChecks: summary.checks.filter((check) => check.area === 'reliability'),
    trustChecks: summary.checks.filter((check) => check.area === 'trust'),
    riskAcceptances: summary.riskAcceptances,
    blockers: createGovernanceSummary(summary).blockers,
  };
}

function createRiskAreaDetail(
  deps: WebServiceDependencies,
  workItemId: WorkItemId,
  area: DeliveryRiskArea,
) {
  const item = requireWorkItem(deps, workItemId);
  const summary = deps.board.getDeliveryEvidenceSummary(item.id);
  return {
    workItem: createWorkItemCrumb(item),
    area,
    checks: summary.checks.filter((check) => check.area === area),
    riskAcceptances: summary.riskAcceptances.filter((riskAcceptance) => riskAcceptance.area === area),
    evidenceLinks: summary.evidenceLinks.filter((link) =>
      link.kind === `${area}-check` || link.kind === 'evidence-record',
    ),
    provenanceLinks: area === 'trust' ? summary.provenanceLinks : [],
  };
}

function workflowBlockedReasonCodes(summary: WorkflowBoardSummary): readonly string[] {
  const codes: string[] = [];
  if (summary.waitingApprovals.length > 0) codes.push('workflow_waiting_approvals');
  if (summary.waitingReviews.length > 0) codes.push('workflow_waiting_reviews');
  if (summary.blockedSteps.length > 0) codes.push('workflow_blocked_steps');
  if (summary.failedChecks.length > 0) codes.push('workflow_failed_checks');
  return codes;
}

function workflowWarnings(summary: WorkflowBoardSummary): readonly MainBoardWarning[] {
  return workflowBlockedReasonCodes(summary).map((code) => ({
    code,
    severity: code === 'workflow_failed_checks' || code === 'workflow_blocked_steps' ? 'blocking' : 'warning',
    message: workflowWarningMessage(code),
  }));
}

function workflowWarningMessage(code: string): string {
  switch (code) {
    case 'workflow_waiting_approvals':
      return 'Workflow is waiting for approval.';
    case 'workflow_waiting_reviews':
      return 'Workflow is waiting for review.';
    case 'workflow_blocked_steps':
      return 'Workflow has blocked steps.';
    case 'workflow_failed_checks':
      return 'Workflow has failed checks.';
    default:
      return code;
  }
}

function createTeamContext(
  deps: WebServiceDependencies,
  projectId: ProjectId,
): MainBoardTeamContext {
  return {
    members: deps.board.listTeamMembers({ projectId }),
    capacity: deps.board.getTeamCapacity(projectId),
  };
}

function createTeamWarning(code: string): MainBoardWarning {
  switch (code) {
    case 'unassigned_work':
      return {
        code,
        severity: 'info',
        message: 'Open WorkItems are waiting for an owner.',
      };
    case 'unknown_assignee':
      return {
        code,
        severity: 'warning',
        message: 'Open WorkItems reference assignees outside the Project team.',
      };
    case 'member_over_wip_limit':
      return {
        code,
        severity: 'warning',
        message: 'At least one team member is over their WIP limit.',
      };
    case 'member_unavailable_with_work':
      return {
        code,
        severity: 'blocking',
        message: 'Unavailable team members still own open WorkItems.',
      };
    default:
      return {
        code,
        severity: 'info',
        message: code,
      };
  }
}

function createMilestoneLane(
  id: string,
  title: string,
  milestone: Milestone | null,
  summary: MilestoneSummary | null,
  cards: readonly MainBoardCard[],
  slices: readonly MainBoardDeliverySliceCard[],
): MainBoardMilestoneLane {
  const completedSlices = slices.filter((item) => isDeliverySliceComplete(item.slice)).length;
  const blockedSlices = slices.filter((item) =>
    item.warnings.some((warning) => warning.severity === 'blocking'),
  ).length;
  return {
    id,
    title,
    milestone,
    summary,
    cards,
    slices,
    rollup: {
      totalWorkItems: cards.length,
      deliveredWorkItems: cards.filter((card) => card.workItem.status === 'delivered').length,
      openWorkItems: cards.filter((card) => !CLOSED_STATUSES.includes(card.workItem.status)).length,
      blockedWorkItems: cards.filter((card) => card.workItem.blockedByIds.length > 0).length,
      totalSlices: slices.length,
      completedSlices,
      openSlices: slices.length - completedSlices,
      blockedSlices,
      percentDelivered: percent(cards.length, cards.filter((card) => card.workItem.status === 'delivered').length),
      percentSlicesComplete: percent(slices.length, completedSlices),
    },
  };
}

function createWorkItemMilestonePlan(
  deps: WebServiceDependencies,
  workItemId: WorkItemId,
): MainBoardMilestonePlan {
  const parent = requireWorkItem(deps, workItemId);
  const projectWorkItems = projectScopedWorkItems(deps, parent.projectId);
  const milestones = projectScopedMilestones(deps, parent.projectId);
  const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  const workItemById = new Map(projectWorkItems.map((item) => [item.id, item]));
  const subtree = flattenTree(deps.board.getWorkItemTree(parent.id))
    .filter((item) => item.projectId === parent.projectId);
  const subtreeIds = new Set(subtree.map((item) => item.id));
  const slices = deps.board
    .listMilestoneDeliverySlices({ projectId: parent.projectId })
    .filter((slice) => subtreeIds.has(slice.parentWorkItemId))
    .map((slice) => createDeliverySliceCard(deps, slice, workItemById, milestoneById));
  const milestoneIds = new Set<MilestoneId>();
  for (const item of subtree) {
    if (item.milestoneId !== null) milestoneIds.add(item.milestoneId);
  }
  for (const slice of slices) milestoneIds.add(slice.slice.milestoneId);
  const milestoneRollups = milestones
    .filter((milestone) => milestoneIds.has(milestone.id))
    .map((milestone) => createMilestonePlanRollup(milestone, subtree, slices));
  const unplannedItems = subtree.filter((item) => item.milestoneId === null);
  if (unplannedItems.length > 0) {
    milestoneRollups.push(createMilestonePlanRollup(null, subtree, slices));
  }
  const completedSlices = slices.filter((item) => isDeliverySliceComplete(item.slice)).length;
  const blockedSlices = slices.filter((item) =>
    item.warnings.some((warning) => warning.severity === 'blocking'),
  ).length;
  const card = createMainBoardCard(deps, parent, projectWorkItems, milestones);
  const openSlices = slices.length - completedSlices;
  const warnings = [
    ...card.warnings,
    ...slices.flatMap((item) => item.warnings),
    ...(openSlices > 0 && parent.status === 'delivered'
      ? [{
        code: 'open_milestone_slices',
        severity: 'blocking' as const,
        message: 'A delivered parent still has open Milestone delivery slices.',
      }]
      : []),
  ];
  return {
    parent: card,
    slices,
    milestoneRollups,
    totalSlices: slices.length,
    completedSlices,
    openSlices,
    blockedSlices,
    percentComplete: percent(slices.length, completedSlices),
    warnings,
  };
}

function createMilestonePlanRollup(
  milestone: Milestone | null,
  subtree: readonly WorkItem[],
  slices: readonly MainBoardDeliverySliceCard[],
): MainBoardMilestonePlanRollup {
  const workItems = subtree.filter((item) => item.milestoneId === (milestone?.id ?? null));
  const milestoneSlices = milestone === null
    ? []
    : slices.filter((slice) => slice.slice.milestoneId === milestone.id);
  const deliveredWorkItems = workItems.filter((item) => item.status === 'delivered').length;
  const completedSlices = milestoneSlices.filter((slice) => isDeliverySliceComplete(slice.slice)).length;
  return {
    milestone,
    workItems: workItems.map((item) => createWorkItemCrumb(item)),
    slices: milestoneSlices,
    totalWorkItems: workItems.length,
    deliveredWorkItems,
    openWorkItems: workItems.length - deliveredWorkItems,
    blockedWorkItems: workItems.filter((item) => item.blockedByIds.length > 0).length,
    completedSlices,
    openSlices: milestoneSlices.length - completedSlices,
    percentDelivered: percent(workItems.length, deliveredWorkItems),
  };
}

function createMilestoneRequirementSlices(
  deps: WebServiceDependencies,
  milestoneId: MilestoneId,
) {
  const milestone = deps.board.getMilestone(milestoneId);
  if (milestone === undefined) throw new Error(`milestone not found: ${milestoneId}`);
  const projectWorkItems = projectScopedWorkItems(deps, milestone.projectId);
  const milestones = projectScopedMilestones(deps, milestone.projectId);
  const workItemById = new Map(projectWorkItems.map((item) => [item.id, item]));
  const milestoneById = new Map(milestones.map((item) => [item.id, item]));
  return {
    milestone,
    summary: deps.board.getMilestoneSummary(milestone.id),
    workItems: deps.board.listWorkItems({ milestoneId }),
    slices: deps.board
      .listMilestoneDeliverySlices({ milestoneId })
      .map((slice) => createDeliverySliceCard(deps, slice, workItemById, milestoneById)),
  };
}

function createDeliverySliceCard(
  deps: WebServiceDependencies,
  slice: MilestoneDeliverySlice,
  projectWorkItemById: ReadonlyMap<WorkItemId, WorkItem>,
  milestoneById: ReadonlyMap<MilestoneId, Milestone>,
): MainBoardDeliverySliceCard {
  const parent = projectWorkItemById.get(slice.parentWorkItemId);
  if (parent === undefined) throw new Error(`work item not found: ${slice.parentWorkItemId}`);
  const milestone = milestoneById.get(slice.milestoneId);
  if (milestone === undefined) throw new Error(`milestone not found: ${slice.milestoneId}`);
  const scopedCriterionIds = new Set(slice.acceptanceCriterionIds);
  const acceptanceCriteria = parent.acceptanceCriteria.filter((criterion) =>
    scopedCriterionIds.has(criterion.id),
  );
  const descendants = flattenTree(deps.board.getWorkItemTree(parent.id))
    .slice(1)
    .filter((item) => item.projectId === parent.projectId && item.milestoneId === slice.milestoneId);
  const coveringWorkItems = descendants.filter((item) =>
    scopedCriterionIds.size === 0
      ? item.evidence.length > 0
      : item.coversAcceptanceIds.some((criterionId) => scopedCriterionIds.has(criterionId)),
  );
  const evidenceCount = coveringWorkItems.reduce((total, item) => total + item.evidence.length, 0);
  return {
    slice,
    parent: createWorkItemCrumb(parent),
    milestone,
    acceptanceCriteria,
    coveringWorkItems: coveringWorkItems.map((item) => createWorkItemCrumb(item)),
    evidenceCount,
    warnings: createDeliverySliceWarnings(slice, parent, evidenceCount),
  };
}

function createDeliverySliceWarnings(
  slice: MilestoneDeliverySlice,
  parent: WorkItem,
  evidenceCount: number,
): readonly MainBoardWarning[] {
  const warnings: MainBoardWarning[] = [];
  if (parent.acceptanceCriteria.length > 0 && slice.acceptanceCriterionIds.length === 0) {
    warnings.push({
      code: 'slice_without_acceptance_scope',
      severity: 'warning',
      message: 'The delivery slice has no acceptance criterion scope.',
    });
  }
  if (slice.expectedEvidence.length > evidenceCount) {
    warnings.push({
      code: 'slice_missing_evidence',
      severity: 'warning',
      message: 'The delivery slice has less evidence than expected.',
    });
  }
  if (!isDeliverySliceComplete(slice)) {
    warnings.push({
      code: 'open_milestone_slices',
      severity: 'info',
      message: 'The delivery slice has not reached its target status.',
    });
  }
  return warnings;
}

function isDeliverySliceComplete(slice: MilestoneDeliverySlice): boolean {
  return slice.status === slice.targetStatus;
}

function createProjectTree(
  deps: WebServiceDependencies,
  projectId: ProjectId,
): MainBoardTree {
  requireProject(deps, projectId);
  const workItems = projectScopedWorkItems(deps, projectId);
  const milestones = projectScopedMilestones(deps, projectId);
  const byId = new Map(workItems.map((item) => [item.id, item]));
  const byParent = new Map<WorkItemId | null, WorkItem[]>();
  for (const item of workItems) {
    const parentId = item.parentId !== null && byId.has(item.parentId) ? item.parentId : null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), item]);
  }
  for (const [parentId, children] of byParent.entries()) {
    byParent.set(parentId, sortWorkItems(children));
  }

  const visited = new Set<WorkItemId>();
  const roots = (byParent.get(null) ?? [])
    .map((item) => createProjectTreeNode(deps, item, projectId, byParent, workItems, milestones, visited, new Set()));
  const extraRoots: MainBoardTreeNode[] = [];
  for (const item of workItems) {
    if (visited.has(item.id)) continue;
    extraRoots.push(createProjectTreeNode(deps, item, projectId, byParent, workItems, milestones, visited, new Set()));
  }
  const allRoots = [...roots, ...extraRoots];
  const maxDepth = allRoots.reduce((depth, node) => Math.max(depth, treeDepth(node)), 0);
  const warnings = [
    ...workItems.flatMap((item) => createHierarchyWarnings(item, workItems)),
    ...(extraRoots.length === 0 ? [] : [{
      code: 'tree_cycle',
      severity: 'warning' as const,
      message: 'Some WorkItems contain a parent cycle and are shown as separate roots.',
    }]),
  ];
  return {
    roots: allRoots,
    total: workItems.length,
    maxDepth,
    warnings,
  };
}

function createProjectTreeNode(
  deps: WebServiceDependencies,
  item: WorkItem,
  projectId: ProjectId,
  byParent: ReadonlyMap<WorkItemId | null, readonly WorkItem[]>,
  projectWorkItems: readonly WorkItem[],
  milestones: readonly Milestone[],
  visited: Set<WorkItemId>,
  ancestors: Set<WorkItemId>,
): MainBoardTreeNode {
  visited.add(item.id);
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(item.id);
  const children = (byParent.get(item.id) ?? [])
    .filter((child) => child.projectId === projectId && !nextAncestors.has(child.id))
    .map((child) =>
      createProjectTreeNode(
        deps,
        child,
        projectId,
        byParent,
        projectWorkItems,
        milestones,
        visited,
        nextAncestors,
      ),
    );
  return {
    card: createMainBoardCard(deps, item, projectWorkItems, milestones),
    children,
  };
}

function treeDepth(node: MainBoardTreeNode): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(treeDepth));
}

function createProjectCoverage(
  deps: WebServiceDependencies,
  projectId: ProjectId,
): MainBoardCoverage {
  requireProject(deps, projectId);
  const workItems = projectScopedWorkItems(deps, projectId);
  const byId = new Map(workItems.map((item) => [item.id, item]));
  const parents = workItems
    .filter((item) => item.acceptanceCriteria.length > 0)
    .map((item) => createCoverageParent(deps, item, byId));
  const totalCriteria = parents.reduce((total, parent) => total + parent.totalCriteria, 0);
  const coveredCriteria = parents.reduce((total, parent) => total + parent.coveredCriteria, 0);
  const uncoveredCriteria = totalCriteria - coveredCriteria;
  const duplicateCoveredCriteria = parents.reduce(
    (total, parent) => total + parent.duplicateCoveredCriteria,
    0,
  );
  return {
    parents,
    totalCriteria,
    coveredCriteria,
    uncoveredCriteria,
    duplicateCoveredCriteria,
    complete: totalCriteria > 0 && uncoveredCriteria === 0,
    warnings: parents.flatMap((parent) => parent.warnings),
  };
}

function createCoverageParent(
  deps: WebServiceDependencies,
  parent: WorkItem,
  projectWorkItemById: ReadonlyMap<WorkItemId, WorkItem>,
): MainBoardCoverageParent {
  const tree = deps.board.getWorkItemTree(parent.id);
  const descendants = flattenTree(tree)
    .slice(1)
    .filter((item) => item.projectId === parent.projectId);
  const rows = parent.acceptanceCriteria.map((criterion) =>
    createCoverageCriterion(parent, criterion, descendants),
  );
  const coverage = deps.board.getAcceptanceCoverage(parent.id);
  const coveringWorkItems = coverage.coveringWorkItemIds
    .map((id) => projectWorkItemById.get(id))
    .filter((item): item is WorkItem => item !== undefined)
    .map((item) => createWorkItemCrumb(item));
  const uncoveredCriteria = rows.filter((row) => !row.complete).length;
  const duplicateCoveredCriteria = rows.filter((row) => row.duplicateCoverage).length;
  const warnings: MainBoardWarning[] = [
    ...(uncoveredCriteria === 0 ? [] : [{
      code: 'uncovered_acceptance',
      severity: 'blocking' as const,
      message: `${parent.title} has ${String(uncoveredCriteria)} uncovered acceptance criterion.`,
    }]),
    ...(duplicateCoveredCriteria === 0 ? [] : [{
      code: 'duplicate_acceptance_coverage',
      severity: 'warning' as const,
      message: `${parent.title} has ${String(duplicateCoveredCriteria)} duplicate acceptance coverage row.`,
    }]),
    ...rows.flatMap((row) => row.warnings),
  ];
  return {
    parent: createWorkItemCrumb(parent),
    coverage,
    totalCriteria: rows.length,
    coveredCriteria: rows.length - uncoveredCriteria,
    uncoveredCriteria,
    duplicateCoveredCriteria,
    coveringWorkItems,
    rows,
    warnings,
  };
}

function createCoverageCriterion(
  parent: WorkItem,
  criterion: AcceptanceCriterion,
  descendants: readonly WorkItem[],
): MainBoardCoverageCriterion {
  const coveredBy = descendants.filter((item) => item.coversAcceptanceIds.includes(criterion.id));
  const duplicateCoverage = coveredBy.length > 1;
  return {
    criterionId: criterion.id,
    text: criterion.text,
    parent: createWorkItemCrumb(parent),
    coveredBy: coveredBy.map((item) => createWorkItemCrumb(item)),
    evidenceCount: coveredBy.reduce((total, item) => total + item.evidence.length, 0),
    complete: coveredBy.length > 0,
    duplicateCoverage,
    warnings: duplicateCoverage ? [{
      code: 'duplicate_acceptance_coverage',
      severity: 'warning',
      message: `${criterion.text} is covered by ${String(coveredBy.length)} WorkItems.`,
    }] : [],
  };
}

function authorizedProjects(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  includeArchived = false,
): readonly Project[] {
  return deps.board
    .listProjects({ includeArchived })
    .filter((project) => projectAccessAllowed(auth.principal, project.id));
}

function authorizeProject(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  projectId: ProjectId,
): Project {
  const project = requireProject(deps, projectId);
  assertProjectAccess(deps, auth, project.id);
  return project;
}

function assertProjectAccess(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  projectId: ProjectId,
): void {
  requireProject(deps, projectId);
  if (!projectAccessAllowed(auth.principal, projectId)) {
    throw new AuthHttpError(403, 'project access denied');
  }
}

function assertUnscopedProjectRead(auth: RequestAuth): void {
  if (auth.principal !== null && auth.principal.projectIds.length > 0) {
    throw new AuthHttpError(403, 'project access denied');
  }
}

function authorizeWorkItem(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  workItemId: WorkItemId,
): WorkItem {
  const item = requireWorkItem(deps, workItemId);
  assertProjectAccess(deps, auth, item.projectId);
  return item;
}

function authorizeMilestone(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  milestoneId: MilestoneId,
): Milestone {
  const milestone = deps.board.getMilestone(milestoneId);
  if (milestone === undefined) throw new Error(`milestone not found: ${milestoneId}`);
  assertProjectAccess(deps, auth, milestone.projectId);
  return milestone;
}

function authorizeIntakeSession(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  sessionId: IntakeSessionId,
): IntakeSession {
  const session = deps.board.getIntakeSession(sessionId);
  if (session === undefined) throw new Error(`intake session not found: ${sessionId}`);
  assertProjectAccess(deps, auth, session.projectId);
  return session;
}

function requireProject(deps: WebServiceDependencies, projectId: ProjectId): Project {
  const project = deps.board.listProjects({ includeArchived: true }).find((item) => item.id === projectId);
  if (project === undefined) throw new Error(`project not found: ${projectId}`);
  return project;
}

function requireWorkItem(deps: WebServiceDependencies, workItemId: WorkItemId): WorkItem {
  const item = deps.board.getWorkItem(workItemId);
  if (item === undefined) throw new Error(`work item not found: ${workItemId}`);
  return item;
}

function mainBoardViewFromUrl(url: URL): MainBoardViewDefinition {
  const requested = url.searchParams.get('viewId') ?? 'requirement-board';
  const view = MAIN_BOARD_VIEWS.find((item) => item.id === requested);
  if (view === undefined) throw new Error(`invalid viewId: ${requested}`);
  return view;
}

function createMainBoardCards(
  deps: WebServiceDependencies,
  projectId: ProjectId,
  view: MainBoardViewDefinition,
): readonly MainBoardCard[] {
  const workItems = deps.board.listWorkItems({
    projectId,
    ...(view.types !== undefined ? { type: view.types } : {}),
  });
  const projectWorkItems = projectScopedWorkItems(deps, projectId);
  const milestones = projectScopedMilestones(deps, projectId);
  const team = createTeamContext(deps, projectId);
  return workItems.map((item) => createMainBoardCard(deps, item, projectWorkItems, milestones, team));
}

function createMainBoardColumns(
  deps: WebServiceDependencies,
  projectId: ProjectId,
  view: MainBoardViewDefinition,
  cards: readonly MainBoardCard[],
): readonly MainBoardColumn[] {
  const board = deps.board.getBoardView({
    projectId,
    groupBy: view.groupBy,
    ...(view.types !== undefined ? { type: view.types } : {}),
  });
  const cardById = new Map(cards.map((card) => [card.id, card]));
  return board.columns.map((column) => ({
    id: column.id,
    title: column.title,
    cards: cardsForColumn(column, cardById),
  }));
}

function cardsForColumn(
  column: BoardViewColumn,
  cardById: ReadonlyMap<WorkItemId, MainBoardCard>,
): readonly MainBoardCard[] {
  return column.workItems
    .map((item) => cardById.get(item.id))
    .filter((item): item is MainBoardCard => item !== undefined);
}

function createMainBoardCard(
  deps: WebServiceDependencies,
  workItem: WorkItem,
  projectWorkItems: readonly WorkItem[],
  milestones: readonly Milestone[],
  teamContext: MainBoardTeamContext = createTeamContext(deps, workItem.projectId),
): MainBoardCard {
  const childRollup = createChildRollup(workItem, projectWorkItems);
  const acceptanceRollup = deps.board.getAcceptanceCoverage(workItem.id);
  const milestone = workItem.milestoneId === null
    ? null
    : milestones.find((item) => item.id === workItem.milestoneId) ?? null;
  const assigneeMember = workItem.assignee.trim() === ''
    ? null
    : teamContext.members.find((member) => member.id === workItem.assignee) ?? null;
  const evidenceSummary = createEvidenceSummary(deps, workItem, acceptanceRollup);
  const workflowSummary = createWorkflowSummary(deps, workItem, assigneeMember);
  const governanceSummary = createGovernanceSummary(evidenceSummary.summary);
  const deliverySlices = deps.board.listMilestoneDeliverySlices({ parentWorkItemId: workItem.id });
  const warnings = createMainBoardWarnings(
    workItem,
    projectWorkItems,
    childRollup,
    acceptanceRollup,
    milestone,
    evidenceSummary,
    deliverySlices,
    workflowSummary,
    assigneeMember,
    teamContext.capacity,
  );
  return {
    id: workItem.id,
    workItem,
    assigneeMember,
    parentBreadcrumb: createParentBreadcrumb(workItem, projectWorkItems),
    childRollup,
    acceptanceRollup,
    milestone,
    workflowSummary,
    evidenceSummary,
    governanceSummary,
    warnings,
  };
}

function projectScopedWorkItems(deps: WebServiceDependencies, projectId: ProjectId): readonly WorkItem[] {
  return deps.board.listWorkItems({ projectId });
}

function projectScopedMilestones(deps: WebServiceDependencies, projectId: ProjectId): readonly Milestone[] {
  return deps.board.listMilestones({ projectId });
}

function createChildRollup(
  parent: WorkItem,
  projectWorkItems: readonly WorkItem[],
): ChildRollup {
  const children = projectWorkItems.filter((item) => item.parentId === parent.id);
  const delivered = children.filter((item) => item.status === 'delivered').length;
  const blocked = children.filter((item) => item.blockedByIds.length > 0).length;
  return {
    total: children.length,
    unfinished: children.filter((item) => !CLOSED_STATUSES.includes(item.status)).length,
    delivered,
    blocked,
  };
}

function createParentBreadcrumb(
  item: WorkItem,
  projectWorkItems: readonly WorkItem[],
): readonly WorkItemCrumb[] {
  const byId = new Map(projectWorkItems.map((workItem) => [workItem.id, workItem]));
  const ancestors: WorkItemCrumb[] = [];
  const seen = new Set<WorkItemId>();
  let nextId = item.parentId;
  while (nextId !== null) {
    if (seen.has(nextId)) break;
    seen.add(nextId);
    const parent = byId.get(nextId);
    if (parent === undefined) break;
    ancestors.unshift(createWorkItemCrumb(parent));
    nextId = parent.parentId;
  }
  return ancestors;
}

function createWorkItemCrumb(item: WorkItem): WorkItemCrumb {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
  };
}

function createEvidenceSummary(
  deps: WebServiceDependencies,
  item: WorkItem,
  acceptanceRollup: AcceptanceCoverageSummary,
): EvidenceBoardSummary {
  const summary = deps.board.getDeliveryEvidenceSummary(item.id);
  const requiredChecks = summary.checks.filter((check) => check.required);
  const blockers = requiredChecks.filter((check) =>
    check.status === 'missing' ||
    check.status === 'failing' ||
    check.status === 'blocked' ||
    check.status === 'pending',
  );
  const missingEvidence: string[] = [];
  if (acceptanceRollup.totalCriteria > 0 && !acceptanceRollup.complete) {
    missingEvidence.push('acceptance evidence');
  }
  for (const check of blockers) {
    missingEvidence.push(`${check.area} evidence`);
  }
  const evidenceCount =
    summary.codeLinks.length +
    summary.pullRequests.length +
    summary.reviewLinks.length +
    summary.ciRuns.length +
    summary.deploymentLinks.length +
    summary.evidenceLinks.length +
    summary.provenanceLinks.length;
  return {
    summary,
    evidenceCount,
    codeLinkCount: summary.codeLinks.length,
    pullRequestCount: summary.pullRequests.length,
    reviewCount: summary.reviewLinks.length,
    ciRunCount: summary.ciRuns.length,
    hasAcceptanceEvidence: acceptanceRollup.complete,
    requiredChecks: requiredChecks.length,
    passingChecks: requiredChecks.filter((check) => check.status === 'passing' || check.status === 'waived').length,
    pendingChecks: requiredChecks.filter((check) => check.status === 'pending').length,
    missingRequiredChecks: requiredChecks.filter((check) => check.status === 'missing').length,
    failedRequiredChecks: requiredChecks.filter((check) => check.status === 'failing').length,
    blockedRequiredChecks: requiredChecks.filter((check) => check.status === 'blocked').length,
    missingEvidence: [...new Set(missingEvidence)],
    blockers,
  };
}

function createWorkflowSummary(
  deps: WebServiceDependencies,
  item: WorkItem,
  assigneeMember: TeamMember | null,
): WorkflowBoardSummary {
  const stored = deps.board.getWorkflowBoardSummary(item.id);
  if (stored.activeOwner !== null) return stored;
  return {
    ...stored,
    activeOwner: item.claimedBy || assigneeMember?.displayName || item.assignee || null,
  };
}

function createGovernanceSummary(summary: DeliveryEvidenceSummary): GovernanceBoardSummary {
  const governanceChecks = summary.checks.filter((check) =>
    ['governance', 'security', 'reliability', 'trust'].includes(check.area),
  );
  const unapprovedObligations = summary.obligations.filter((obligation) =>
    obligation.status === 'draft' || obligation.status === 'pending_review',
  );
  const openRiskAcceptances = summary.riskAcceptances.filter((riskAcceptance) =>
    riskAcceptance.status === 'requested' || riskAcceptance.status === 'expired',
  );
  const checkBlockers = governanceChecks.filter((check) =>
    check.required &&
    (check.status === 'missing' || check.status === 'failing' || check.status === 'blocked'),
  );
  return {
    required: summary.obligations.length > 0 || governanceChecks.length > 0 || summary.riskAcceptances.length > 0,
    blockers: [
      ...unapprovedObligations.map((obligation) => obligation.title),
      ...openRiskAcceptances.map((riskAcceptance) => riskAcceptance.title),
      ...checkBlockers.map((check) => check.title),
    ],
    obligations: summary.obligations.length,
    unapprovedObligations: unapprovedObligations.length,
    openRiskAcceptances: openRiskAcceptances.length,
  };
}

function createHierarchyWarnings(
  item: WorkItem,
  projectWorkItems: readonly WorkItem[],
): readonly MainBoardWarning[] {
  const allowedParents = allowedParentTypes(item.type);
  if (item.parentId === null) {
    if (allowedParents.length === 0) return [];
    return [{
      code: 'orphan_without_parent',
      severity: 'warning',
      message: `${item.title} has no parent, but ${item.type} normally belongs under ${allowedParents.join(' or ')}.`,
    }];
  }
  const parent = projectWorkItems.find((workItem) => workItem.id === item.parentId);
  if (parent === undefined) {
    return [{
      code: 'missing_parent',
      severity: 'blocking',
      message: `${item.title} references missing parent ${item.parentId}.`,
    }];
  }
  if (allowedParents.length > 0 && !allowedParents.includes(parent.type)) {
    return [{
      code: 'invalid_parent_type',
      severity: 'blocking',
      message: `${item.type} cannot use ${parent.type} as parent.`,
    }];
  }
  return [];
}

function createMainBoardWarnings(
  item: WorkItem,
  projectWorkItems: readonly WorkItem[],
  childRollup: ChildRollup,
  acceptanceRollup: AcceptanceCoverageSummary,
  milestone: Milestone | null,
  evidenceSummary: EvidenceBoardSummary,
  deliverySlices: readonly MilestoneDeliverySlice[],
  workflowSummary: WorkflowBoardSummary,
  assigneeMember: TeamMember | null,
  teamCapacity: TeamCapacitySummary,
): readonly MainBoardWarning[] {
  const warnings: MainBoardWarning[] = [...createHierarchyWarnings(item, projectWorkItems)];
  const open = !CLOSED_STATUSES.includes(item.status);
  if (['requirement', 'story'].includes(item.type) && item.analysis.trim() === '') {
    warnings.push({
      code: 'missing_analysis',
      severity: 'warning',
      message: 'Requirement analysis is missing.',
    });
  }
  if (['requirement', 'story'].includes(item.type) && item.design.trim() === '') {
    warnings.push({
      code: 'missing_design',
      severity: 'warning',
      message: 'Requirement design is missing.',
    });
  }
  if (acceptanceRollup.totalCriteria > 0 && acceptanceRollup.uncoveredAcceptanceIds.length > 0) {
    warnings.push({
      code: 'uncovered_acceptance',
      severity: 'blocking',
      message: 'Acceptance criteria are not fully covered by child work.',
    });
  }
  if (item.blockedByIds.length > 0) {
    warnings.push({
      code: 'blocked_dependency',
      severity: 'blocking',
      message: 'The WorkItem has unresolved blockers.',
    });
  }
  if (
    childRollup.total > 0 &&
    childRollup.unfinished > 0 &&
    item.status === 'delivered'
  ) {
    warnings.push({
      code: 'unfinished_children',
      severity: 'blocking',
      message: 'A delivered parent still has unfinished children.',
    });
  }
  if (item.milestoneId !== null && milestone === null) {
    warnings.push({
      code: 'missing_milestone',
      severity: 'blocking',
      message: 'The assigned Milestone cannot be found in this Project.',
    });
  }
  if (
    item.status === 'delivered' &&
    deliverySlices.some((slice) => !isDeliverySliceComplete(slice))
  ) {
    warnings.push({
      code: 'open_milestone_slices',
      severity: 'blocking',
      message: 'A delivered parent still has open Milestone delivery slices.',
    });
  }
  if (open && item.assignee.trim() === '') {
    warnings.push({
      code: 'unassigned_work',
      severity: 'info',
      message: 'The WorkItem has no team assignee.',
    });
  }
  if (open && item.assignee.trim() !== '' && assigneeMember === null) {
    warnings.push({
      code: 'unknown_assignee',
      severity: 'warning',
      message: 'The WorkItem assignee is not a Project team member.',
    });
  }
  if (open && assigneeMember !== null && assigneeMember.status !== 'active') {
    warnings.push({
      code: 'assignee_unavailable',
      severity: 'blocking',
      message: 'The assigned team member is not available for active delivery.',
    });
  }
  const capacity = teamCapacity.members.find((member) => member.member.id === item.assignee);
  if (open && capacity?.overLimit) {
    warnings.push({
      code: 'member_over_wip_limit',
      severity: 'warning',
      message: 'The assigned team member is over their WIP limit.',
    });
  }
  if (workflowSummary.waitingApprovals.length > 0) {
    warnings.push({
      code: 'workflow_waiting_approvals',
      severity: 'warning',
      message: 'The workflow is waiting for approval.',
    });
  }
  if (workflowSummary.waitingReviews.length > 0) {
    warnings.push({
      code: 'workflow_waiting_reviews',
      severity: 'warning',
      message: 'The workflow is waiting for review.',
    });
  }
  if (workflowSummary.blockedSteps.length > 0) {
    warnings.push({
      code: 'workflow_blocked_steps',
      severity: 'blocking',
      message: 'The workflow has blocked steps.',
    });
  }
  if (workflowSummary.failedChecks.length > 0) {
    warnings.push({
      code: 'workflow_failed_checks',
      severity: 'blocking',
      message: 'The workflow has failed checks.',
    });
  }
  for (const warning of deliveryEvidenceWarnings(
    evidenceSummary,
    createGovernanceSummary(evidenceSummary.summary),
  )) {
    warnings.push(warning);
  }
  const blockerLabels = new Set(evidenceSummary.blockers.map((check) => `${check.area} evidence`));
  for (const missing of evidenceSummary.missingEvidence) {
    if (blockerLabels.has(missing)) continue;
    warnings.push({
      code: `missing_${missing.replaceAll(' ', '_')}`,
      severity: 'warning',
      message: `Missing ${missing}.`,
    });
  }
  return warnings;
}

function createBoardHealth(cards: readonly MainBoardCard[]) {
  const total = cards.length;
  const delivered = cards.filter((card) => card.workItem.status === 'delivered').length;
  const blocked = cards.filter((card) =>
    card.warnings.some((warning) => warning.severity === 'blocking'),
  ).length;
  const uncovered = cards.filter((card) =>
    card.acceptanceRollup.totalCriteria > 0 && !card.acceptanceRollup.complete,
  ).length;
  const missingAnalysis = cards.filter((card) =>
    card.warnings.some((warning) => warning.code === 'missing_analysis'),
  ).length;
  const missingDesign = cards.filter((card) =>
    card.warnings.some((warning) => warning.code === 'missing_design'),
  ).length;
  const withoutMilestone = cards.filter((card) => card.workItem.milestoneId === null).length;
  return {
    total,
    delivered,
    blocked,
    uncovered,
    missingAnalysis,
    missingDesign,
    withoutMilestone,
    percentDelivered: percent(total, delivered),
  };
}

function percent(total: number, value: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function summarizeText(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return 'Not filled';
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function flattenTree(tree: WorkItemTreeNode): WorkItem[] {
  return [tree.item, ...tree.children.flatMap(flattenTree)];
}

function sortWorkItems(items: readonly WorkItem[]): WorkItem[] {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

function makeProjectInput(payload: Record<string, unknown>): { name: string; description?: string } {
  const description = optionalString(payload, 'description');
  return {
    name: requireString(payload, 'name'),
    ...(description !== undefined ? { description } : {}),
  };
}

function makeMilestoneCreateInput(payload: Record<string, unknown>) {
  const description = optionalString(payload, 'description');
  const status = optionalMilestoneStatus(payload, 'status');
  const startDate = optionalNumberOrNull(payload, 'startDate');
  const dueDate = optionalNumberOrNull(payload, 'dueDate');
  const goal = optionalString(payload, 'goal');
  return {
    projectId: requireId<ProjectId>(payload, 'projectId'),
    title: requireString(payload, 'title'),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(goal !== undefined ? { goal } : {}),
  };
}

function makeMilestoneUpdateInput(payload: Record<string, unknown>) {
  const title = optionalString(payload, 'title');
  const description = optionalString(payload, 'description');
  const status = optionalMilestoneStatus(payload, 'status');
  const startDate = optionalNumberOrNull(payload, 'startDate');
  const dueDate = optionalNumberOrNull(payload, 'dueDate');
  const goal = optionalString(payload, 'goal');
  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(goal !== undefined ? { goal } : {}),
  };
}

function makeTeamMemberCreateInput(
  projectId: ProjectId,
  payload: Record<string, unknown>,
): TeamMemberCreateInput {
  const memberType = optionalTeamMemberType(payload, 'memberType');
  const status = optionalTeamMemberStatus(payload, 'status');
  const roleIds = optionalIdArray<RoleId>(payload, 'roleIds');
  const permissions = optionalStringArray(payload, 'permissions');
  const capabilityProfile = optionalString(payload, 'capabilityProfile');
  const skillProfile = optionalStringArray(payload, 'skillProfile');
  const region = optionalString(payload, 'region');
  const timezone = optionalString(payload, 'timezone');
  const capacityUnits = optionalNumber(payload, 'capacityUnits');
  const concurrentWorkLimit = optionalNumber(payload, 'concurrentWorkLimit');
  return {
    projectId,
    displayName: requireString(payload, 'displayName'),
    ...(memberType !== undefined ? { memberType } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(roleIds !== undefined ? { roleIds } : {}),
    ...(permissions !== undefined ? { permissions } : {}),
    ...(capabilityProfile !== undefined ? { capabilityProfile } : {}),
    ...(skillProfile !== undefined ? { skillProfile } : {}),
    ...(region !== undefined ? { region } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
    ...(capacityUnits !== undefined ? { capacityUnits } : {}),
    ...(concurrentWorkLimit !== undefined ? { concurrentWorkLimit } : {}),
  };
}

function makeTeamMemberUpdateInput(payload: Record<string, unknown>): TeamMemberUpdateInput {
  const displayName = optionalString(payload, 'displayName');
  const memberType = optionalTeamMemberType(payload, 'memberType');
  const status = optionalTeamMemberStatus(payload, 'status');
  const roleIds = optionalIdArray<RoleId>(payload, 'roleIds');
  const permissions = optionalStringArray(payload, 'permissions');
  const capabilityProfile = optionalString(payload, 'capabilityProfile');
  const skillProfile = optionalStringArray(payload, 'skillProfile');
  const region = optionalString(payload, 'region');
  const timezone = optionalString(payload, 'timezone');
  const capacityUnits = optionalNumber(payload, 'capacityUnits');
  const concurrentWorkLimit = optionalNumber(payload, 'concurrentWorkLimit');
  return {
    ...(displayName !== undefined ? { displayName } : {}),
    ...(memberType !== undefined ? { memberType } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(roleIds !== undefined ? { roleIds } : {}),
    ...(permissions !== undefined ? { permissions } : {}),
    ...(capabilityProfile !== undefined ? { capabilityProfile } : {}),
    ...(skillProfile !== undefined ? { skillProfile } : {}),
    ...(region !== undefined ? { region } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
    ...(capacityUnits !== undefined ? { capacityUnits } : {}),
    ...(concurrentWorkLimit !== undefined ? { concurrentWorkLimit } : {}),
  };
}

function requireWipPolicies(payload: Record<string, unknown>): readonly TeamWipPolicyInput[] {
  const raw = payload.policies;
  if (!Array.isArray(raw)) throw new Error('policies must be an array');
  return raw.map((row, index) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`policies[${String(index)}] must be an object`);
    }
    const item = row as Record<string, unknown>;
    const kind = item.kind;
    const scope = item.scope;
    if (typeof kind !== 'string' || !TEAM_WIP_KINDS.includes(kind as TeamWipKind)) {
      throw new Error(`policies[${String(index)}].kind is invalid`);
    }
    if (typeof scope !== 'string' || !TEAM_WIP_SCOPES.includes(scope as TeamWipScope)) {
      throw new Error(`policies[${String(index)}].scope is invalid`);
    }
    const scopeId = item.scopeId;
    const limit = item.limit;
    if (typeof scopeId !== 'string' || scopeId.trim() === '') {
      throw new Error(`policies[${String(index)}].scopeId is required`);
    }
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      throw new Error(`policies[${String(index)}].limit must be a number`);
    }
    return { kind: kind as TeamWipKind, scope: scope as TeamWipScope, scopeId, limit };
  });
}

function makeWorkItemAssignmentInput(payload: Record<string, unknown>): WorkItemAssignmentInput {
  const roleId = optionalId<RoleId>(payload, 'roleId');
  const actorId = optionalString(payload, 'actorId');
  return {
    memberId: requireId<TeamMemberId>(payload, 'memberId'),
    ...(roleId !== undefined ? { roleId } : {}),
    ...(actorId !== undefined ? { actorId } : {}),
  };
}

function makeWorkflowBoardSummaryInput(payload: Record<string, unknown>): WorkflowBoardSummaryInput {
  const workflowRunId = optionalNullableString(payload, 'workflowRunId');
  const workflowTemplateVersion = optionalString(payload, 'workflowTemplateVersion');
  const stage = optionalStatus(payload, 'stage');
  const runStatus = optionalWorkflowRunStatus(payload, 'runStatus');
  const activeOwner = optionalNullableString(payload, 'activeOwner');
  const activeRoleId = optionalNullableId<RoleId>(payload, 'activeRoleId');
  const nextAction = optionalString(payload, 'nextAction');
  const downstreamImpact = optionalString(payload, 'downstreamImpact');
  const schedulerReason = optionalString(payload, 'schedulerReason');
  const runningSteps = optionalWorkflowSteps(payload, 'runningSteps');
  const blockedSteps = optionalWorkflowSteps(payload, 'blockedSteps');
  const waitingApprovals = optionalWorkflowWaitItems(payload, 'waitingApprovals');
  const waitingReviews = optionalWorkflowWaitItems(payload, 'waitingReviews');
  const failedChecks = optionalWorkflowChecks(payload, 'failedChecks');
  const controls = optionalWorkflowControls(payload, 'controls');
  const links = optionalWorkflowLinks(payload, 'links');
  return {
    ...(workflowRunId !== undefined ? { workflowRunId } : {}),
    ...(workflowTemplateVersion !== undefined ? { workflowTemplateVersion } : {}),
    ...(stage !== undefined ? { stage } : {}),
    ...(runStatus !== undefined ? { runStatus } : {}),
    ...(activeOwner !== undefined ? { activeOwner } : {}),
    ...(activeRoleId !== undefined ? { activeRoleId } : {}),
    ...(nextAction !== undefined ? { nextAction } : {}),
    ...(downstreamImpact !== undefined ? { downstreamImpact } : {}),
    ...(schedulerReason !== undefined ? { schedulerReason } : {}),
    ...(runningSteps !== undefined ? { runningSteps } : {}),
    ...(blockedSteps !== undefined ? { blockedSteps } : {}),
    ...(waitingApprovals !== undefined ? { waitingApprovals } : {}),
    ...(waitingReviews !== undefined ? { waitingReviews } : {}),
    ...(failedChecks !== undefined ? { failedChecks } : {}),
    ...(controls !== undefined ? { controls } : {}),
    ...(links !== undefined ? { links } : {}),
  };
}

function makeDeliveryEvidenceSummaryInput(payload: Record<string, unknown>): DeliveryEvidenceSummaryInput {
  const codeLinks = optionalDeliveryEvidenceLinks(payload, 'codeLinks');
  const pullRequests = optionalDeliveryEvidenceLinks(payload, 'pullRequests');
  const reviewLinks = optionalDeliveryEvidenceLinks(payload, 'reviewLinks');
  const ciRuns = optionalDeliveryEvidenceLinks(payload, 'ciRuns');
  const deploymentLinks = optionalDeliveryEvidenceLinks(payload, 'deploymentLinks');
  const evidenceLinks = optionalDeliveryEvidenceLinks(payload, 'evidenceLinks');
  const checks = optionalDeliveryEvidenceChecks(payload, 'checks');
  const obligations = optionalGovernanceObligations(payload, 'obligations');
  const riskAcceptances = optionalRiskAcceptances(payload, 'riskAcceptances');
  const provenanceLinks = optionalDeliveryEvidenceLinks(payload, 'provenanceLinks');
  const notes = optionalString(payload, 'notes');
  const designRevision = optionalString(payload, 'designRevision');
  return {
    ...(codeLinks !== undefined ? { codeLinks } : {}),
    ...(pullRequests !== undefined ? { pullRequests } : {}),
    ...(reviewLinks !== undefined ? { reviewLinks } : {}),
    ...(ciRuns !== undefined ? { ciRuns } : {}),
    ...(deploymentLinks !== undefined ? { deploymentLinks } : {}),
    ...(evidenceLinks !== undefined ? { evidenceLinks } : {}),
    ...(checks !== undefined ? { checks } : {}),
    ...(obligations !== undefined ? { obligations } : {}),
    ...(riskAcceptances !== undefined ? { riskAcceptances } : {}),
    ...(provenanceLinks !== undefined ? { provenanceLinks } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(designRevision !== undefined ? { designRevision } : {}),
  };
}

function optionalDeliveryEvidenceLinks(
  payload: Record<string, unknown>,
  key: string,
): readonly DeliveryEvidenceLink[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const url = optionalNullableString(item, 'url');
    const acceptanceCriterionIds = optionalIdArray<AcceptanceCriterionId>(item, 'acceptanceCriterionIds');
    return {
      kind: requireDeliveryEvidenceLinkKind(item, 'kind'),
      id: requireString(item, 'id'),
      label: requireString(item, 'label'),
      url: url ?? null,
      acceptanceCriterionIds: acceptanceCriterionIds ?? [],
    };
  });
}

function optionalDeliveryEvidenceChecks(
  payload: Record<string, unknown>,
  key: string,
): readonly DeliveryEvidenceCheck[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const reason = optionalString(item, 'reason');
    const evidenceIds = optionalStringArray(item, 'evidenceIds');
    const acceptanceCriterionIds = optionalIdArray<AcceptanceCriterionId>(item, 'acceptanceCriterionIds');
    const links = optionalDeliveryEvidenceLinks(item, 'links');
    const producer = resolveEvidenceProducer(item.producer);
    const executionKind = resolveEvidenceExecutionKind(item.executionKind, producer);
    const designRevision = optionalString(item, 'designRevision');
    return {
      id: requireString(item, 'id'),
      area: requireDeliveryEvidenceArea(item, 'area'),
      title: requireString(item, 'title'),
      status: requireDeliveryEvidenceStatus(item, 'status'),
      required: optionalBoolean(item, 'required') ?? true,
      reason: reason ?? '',
      evidenceIds: evidenceIds ?? [],
      acceptanceCriterionIds: acceptanceCriterionIds ?? [],
      links: links ?? [],
      producer,
      executionKind,
      designRevision: designRevision ?? '',
    };
  });
}

function optionalGovernanceObligations(
  payload: Record<string, unknown>,
  key: string,
): readonly GovernanceObligationSummary[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const effectiveDate = optionalNumberOrNull(item, 'effectiveDate');
    const reviewDate = optionalNumberOrNull(item, 'reviewDate');
    const controlIds = optionalStringArray(item, 'controlIds');
    const links = optionalDeliveryEvidenceLinks(item, 'links');
    return {
      id: requireString(item, 'id'),
      title: requireString(item, 'title'),
      jurisdiction: optionalString(item, 'jurisdiction') ?? '',
      source: optionalString(item, 'source') ?? '',
      status: requireGovernanceObligationStatus(item, 'status'),
      owner: optionalString(item, 'owner') ?? '',
      reviewer: optionalString(item, 'reviewer') ?? '',
      effectiveDate: effectiveDate ?? null,
      reviewDate: reviewDate ?? null,
      controlIds: controlIds ?? [],
      links: links ?? [],
    };
  });
}

function optionalRiskAcceptances(
  payload: Record<string, unknown>,
  key: string,
): readonly DeliveryRiskAcceptance[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const expiresAt = optionalNumberOrNull(item, 'expiresAt');
    const links = optionalDeliveryEvidenceLinks(item, 'links');
    return {
      id: requireString(item, 'id'),
      area: requireDeliveryRiskArea(item, 'area'),
      title: requireString(item, 'title'),
      status: requireDeliveryRiskAcceptanceStatus(item, 'status'),
      approver: optionalString(item, 'approver') ?? '',
      reason: optionalString(item, 'reason') ?? '',
      expiresAt: expiresAt ?? null,
      links: links ?? [],
    };
  });
}

function optionalWorkflowSteps(
  payload: Record<string, unknown>,
  key: string,
): readonly WorkflowStepSummary[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const owner = optionalNullableString(item, 'owner');
    const roleId = optionalNullableId<RoleId>(item, 'roleId');
    const dependsOnStepIds = optionalStringArray(item, 'dependsOnStepIds');
    const reason = optionalString(item, 'reason');
    const links = optionalWorkflowLinks(item, 'links');
    return {
      id: requireString(item, 'id'),
      title: requireString(item, 'title'),
      status: requireWorkflowStepStatus(item, 'status'),
      owner: owner ?? null,
      roleId: roleId ?? null,
      dependsOnStepIds: dependsOnStepIds ?? [],
      reason: reason ?? '',
      links: links ?? [],
    };
  });
}

function optionalWorkflowWaitItems(
  payload: Record<string, unknown>,
  key: string,
): readonly WorkflowWaitItem[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const roleId = optionalNullableId<RoleId>(item, 'roleId');
    const owner = optionalNullableString(item, 'owner');
    const dueAt = optionalNumberOrNull(item, 'dueAt');
    const links = optionalWorkflowLinks(item, 'links');
    return {
      id: requireString(item, 'id'),
      type: requireWorkflowWaitItemType(item, 'type'),
      title: requireString(item, 'title'),
      status: optionalString(item, 'status') ?? 'waiting',
      roleId: roleId ?? null,
      owner: owner ?? null,
      dueAt: dueAt ?? null,
      links: links ?? [],
    };
  });
}

function optionalWorkflowChecks(
  payload: Record<string, unknown>,
  key: string,
): readonly WorkflowCheckSummary[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const reason = optionalString(item, 'reason');
    const links = optionalWorkflowLinks(item, 'links');
    return {
      id: requireString(item, 'id'),
      title: requireString(item, 'title'),
      status: requireWorkflowCheckStatus(item, 'status'),
      reason: reason ?? '',
      links: links ?? [],
    };
  });
}

function optionalWorkflowControls(
  payload: Record<string, unknown>,
  key: string,
): readonly WorkflowBoardControl[] | undefined {
  const values = optionalStringArray(payload, key);
  if (values === undefined) return undefined;
  return values.map((value) => {
    if (!WORKFLOW_BOARD_CONTROLS.includes(value as WorkflowBoardControl)) {
      throw new Error(`invalid ${key}`);
    }
    return value as WorkflowBoardControl;
  });
}

function optionalWorkflowLinks(
  payload: Record<string, unknown>,
  key: string,
): readonly WorkflowBoardLink[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const url = optionalNullableString(item, 'url');
    return {
      kind: requireWorkflowLinkKind(item, 'kind'),
      id: requireString(item, 'id'),
      label: requireString(item, 'label'),
      url: url ?? null,
    };
  });
}

function optionalIntakeSourceRefs(
  payload: Record<string, unknown>,
  key: string,
): readonly IntakeCandidateSourceRef[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${key}[${String(index)}] must be an object`);
    const sourceDocumentId = optionalNullableId<IntakeSourceDocumentId>(item, 'sourceDocumentId');
    const sourceChunkId = optionalNullableId<IntakeSourceChunkId>(item, 'sourceChunkId');
    const messageId = optionalNullableId<IntakeMessageId>(item, 'messageId');
    const confidence = optionalNumber(item, 'confidence');
    return {
      sourceDocumentId: sourceDocumentId ?? null,
      sourceChunkId: sourceChunkId ?? null,
      messageId: messageId ?? null,
      quote: optionalString(item, 'quote') ?? '',
      confidence: confidence ?? 0.5,
    };
  });
}

function makeMilestoneDeliverySliceCreateInput(
  parentWorkItemId: WorkItemId,
  payload: Record<string, unknown>,
): MilestoneDeliverySliceCreateInput {
  const title = optionalString(payload, 'title');
  const acceptanceCriterionIds = optionalIdArray<AcceptanceCriterionId>(payload, 'acceptanceCriterionIds');
  const expectedEvidence = optionalStringArray(payload, 'expectedEvidence');
  const targetStatus = optionalStatus(payload, 'targetStatus');
  const owner = optionalString(payload, 'owner');
  const status = optionalStatus(payload, 'status');
  return {
    parentWorkItemId,
    milestoneId: requireId<MilestoneId>(payload, 'milestoneId'),
    ...(title !== undefined ? { title } : {}),
    scope: requireString(payload, 'scope'),
    ...(acceptanceCriterionIds !== undefined ? { acceptanceCriterionIds } : {}),
    ...(expectedEvidence !== undefined ? { expectedEvidence } : {}),
    ...(targetStatus !== undefined ? { targetStatus } : {}),
    ...(owner !== undefined ? { owner } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

function makeMilestoneDeliverySliceUpdateInput(
  payload: Record<string, unknown>,
): MilestoneDeliverySliceUpdateInput {
  const milestoneId = optionalId<MilestoneId>(payload, 'milestoneId');
  const title = optionalString(payload, 'title');
  const scope = optionalString(payload, 'scope');
  const acceptanceCriterionIds = optionalIdArray<AcceptanceCriterionId>(payload, 'acceptanceCriterionIds');
  const expectedEvidence = optionalStringArray(payload, 'expectedEvidence');
  const targetStatus = optionalStatus(payload, 'targetStatus');
  const owner = optionalString(payload, 'owner');
  const status = optionalStatus(payload, 'status');
  return {
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(scope !== undefined ? { scope } : {}),
    ...(acceptanceCriterionIds !== undefined ? { acceptanceCriterionIds } : {}),
    ...(expectedEvidence !== undefined ? { expectedEvidence } : {}),
    ...(targetStatus !== undefined ? { targetStatus } : {}),
    ...(owner !== undefined ? { owner } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

function makeIntakeSessionCreateInput(
  payload: Record<string, unknown>,
): Omit<IntakeSessionCreateInput, 'projectId'> {
  const sourceChannel = optionalString(payload, 'sourceChannel');
  const submitter = optionalString(payload, 'submitter');
  return {
    title: requireString(payload, 'title'),
    ...(sourceChannel !== undefined ? { sourceChannel } : {}),
    ...(submitter !== undefined ? { submitter } : {}),
  };
}

function makeIntakeSessionUpdateInput(payload: Record<string, unknown>): IntakeSessionUpdateInput {
  const title = optionalString(payload, 'title');
  const status = optionalIntakeSessionStatus(payload, 'status');
  const sourceChannel = optionalString(payload, 'sourceChannel');
  const submitter = optionalString(payload, 'submitter');
  const analysisStatus = optionalString(payload, 'analysisStatus');
  return {
    ...(title !== undefined ? { title } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(sourceChannel !== undefined ? { sourceChannel } : {}),
    ...(submitter !== undefined ? { submitter } : {}),
    ...(analysisStatus !== undefined ? { analysisStatus } : {}),
  };
}

function makeIntakeMessageCreateInput(payload: Record<string, unknown>): IntakeMessageCreateInput {
  const role = optionalIntakeMessageRole(payload, 'role');
  const author = optionalString(payload, 'author');
  const body = optionalString(payload, 'body');
  const kind = optionalString(payload, 'kind');
  const field = optionalString(payload, 'field');
  const sourceDocumentIds = optionalIdArray<IntakeSourceDocumentId>(payload, 'sourceDocumentIds');
  return {
    ...(role !== undefined ? { role } : {}),
    ...(author !== undefined ? { author } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(kind !== undefined ? { kind: kind as never } : {}),
    ...(field !== undefined ? { field: field as never } : {}),
    ...(sourceDocumentIds !== undefined ? { sourceDocumentIds } : {}),
  };
}

function makeIntakeSourceDocumentCreateInput(
  payload: Record<string, unknown>,
): IntakeSourceDocumentCreateInput {
  const mimeType = optionalString(payload, 'mimeType');
  const size = optionalNumber(payload, 'size');
  const parseStatus = optionalIntakeSourceParseStatus(payload, 'parseStatus');
  const parseError = optionalString(payload, 'parseError');
  const extractedText = optionalString(payload, 'extractedText');
  const understanding = optionalString(payload, 'understanding');
  const chunks = optionalStringArray(payload, 'chunks');
  const uploader = optionalString(payload, 'uploader');
  const contentBase64 = optionalString(payload, 'contentBase64');
  const content = contentBase64 !== undefined ? decodeBase64Bytes(contentBase64) : undefined;
  return {
    kind: requireIntakeSourceKind(payload, 'kind'),
    name: requireString(payload, 'name'),
    ...(mimeType !== undefined ? { mimeType } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(parseStatus !== undefined ? { parseStatus } : {}),
    ...(parseError !== undefined ? { parseError } : {}),
    ...(extractedText !== undefined ? { extractedText } : {}),
    ...(understanding !== undefined ? { understanding } : {}),
    ...(chunks !== undefined ? { chunks } : {}),
    ...(uploader !== undefined ? { uploader } : {}),
    ...(content !== undefined ? { content } : {}),
  };
}

function makeIntakeCandidateUpdateInput(
  payload: Record<string, unknown>,
): IntakeCandidateUpdateInput {
  const type = optionalIntakeCandidateType(payload, 'type');
  const title = optionalString(payload, 'title');
  const body = optionalString(payload, 'body');
  const analysis = optionalString(payload, 'analysis');
  const design = optionalString(payload, 'design');
  const acceptance = optionalStringArray(payload, 'acceptance');
  const parentCandidateId = optionalNullableId<IntakeCandidateId>(payload, 'parentCandidateId');
  const milestoneId = optionalNullableId<MilestoneId>(payload, 'milestoneId');
  const sourceRefs = optionalIntakeSourceRefs(payload, 'sourceRefs');
  const confidence = optionalNumber(payload, 'confidence');
  const openQuestions = optionalStringArray(payload, 'openQuestions');
  const status = optionalIntakeCandidateStatus(payload, 'status');
  return {
    ...(type !== undefined ? { type } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(analysis !== undefined ? { analysis } : {}),
    ...(design !== undefined ? { design } : {}),
    ...(acceptance !== undefined ? { acceptance } : {}),
    ...(parentCandidateId !== undefined ? { parentCandidateId } : {}),
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    ...(sourceRefs !== undefined ? { sourceRefs } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(openQuestions !== undefined ? { openQuestions } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

function makeCreateInput(payload: Record<string, unknown>): WorkItemCreateInput {
  const body = optionalString(payload, 'body');
  const analysis = optionalString(payload, 'analysis');
  const design = optionalString(payload, 'design');
  const sourceInput = optionalString(payload, 'sourceInput');
  const decompositionReason = optionalString(payload, 'decompositionReason');
  const type = optionalWorkItemType(payload, 'type');
  const status = optionalStatus(payload, 'status');
  const parentId = optionalNullableId<WorkItemId>(payload, 'parentId');
  const milestoneId = optionalNullableId<MilestoneId>(payload, 'milestoneId');
  const acceptance = optionalStringArray(payload, 'acceptance');
  const acceptanceCriteria = optionalAcceptanceCriteria(payload);
  const coversAcceptanceIds = optionalIdArray<AcceptanceCriterionId>(payload, 'coversAcceptanceIds');
  const dependencyIds = optionalIdArray<WorkItemId>(payload, 'dependencyIds');
  const blockedByIds = optionalIdArray<WorkItemId>(payload, 'blockedByIds');
  const evidence = optionalStringArray(payload, 'evidence');
  const methodId = optionalString(payload, 'methodId');
  const rankingInputs = Object.hasOwn(payload, 'rankingInputs')
    ? normalizeRankingInputs(payload.rankingInputs)
    : undefined;
  const requiredSkillPackIds = optionalStringArray(payload, 'requiredSkillPackIds');
  return {
    projectId: requireId<ProjectId>(payload, 'projectId'),
    title: requireString(payload, 'title'),
    ...(body !== undefined ? { body } : {}),
    ...(analysis !== undefined ? { analysis } : {}),
    ...(design !== undefined ? { design } : {}),
    ...(sourceInput !== undefined ? { sourceInput } : {}),
    ...(decompositionReason !== undefined ? { decompositionReason } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    ...(acceptance !== undefined ? { acceptance } : {}),
    ...(acceptanceCriteria !== undefined ? { acceptanceCriteria } : {}),
    ...(coversAcceptanceIds !== undefined ? { coversAcceptanceIds } : {}),
    ...(dependencyIds !== undefined ? { dependencyIds } : {}),
    ...(blockedByIds !== undefined ? { blockedByIds } : {}),
    ...(evidence !== undefined ? { evidence } : {}),
    ...(methodId !== undefined ? { methodId } : {}),
    ...(rankingInputs !== undefined ? { rankingInputs } : {}),
    ...(requiredSkillPackIds !== undefined ? { requiredSkillPackIds } : {}),
  };
}

function makeUpdateInput(payload: Record<string, unknown>): WorkItemUpdateInput {
  const title = optionalString(payload, 'title');
  const body = optionalString(payload, 'body');
  const analysis = optionalString(payload, 'analysis');
  const design = optionalString(payload, 'design');
  const sourceInput = optionalString(payload, 'sourceInput');
  const decompositionReason = optionalString(payload, 'decompositionReason');
  const priority = optionalPriority(payload);
  const estimate = optionalNumberOrNull(payload, 'estimate');
  const assignee = optionalString(payload, 'assignee');
  const parentId = optionalNullableId<WorkItemId>(payload, 'parentId');
  const milestoneId = optionalNullableId<MilestoneId>(payload, 'milestoneId');
  const startDate = optionalNumberOrNull(payload, 'startDate');
  const dueDate = optionalNumberOrNull(payload, 'dueDate');
  const acceptance = optionalStringArray(payload, 'acceptance');
  const acceptanceCriteria = optionalAcceptanceCriteria(payload);
  const coversAcceptanceIds = optionalIdArray<AcceptanceCriterionId>(payload, 'coversAcceptanceIds');
  const dependencyIds = optionalIdArray<WorkItemId>(payload, 'dependencyIds');
  const blockedByIds = optionalIdArray<WorkItemId>(payload, 'blockedByIds');
  const evidence = optionalStringArray(payload, 'evidence');
  const methodId = optionalString(payload, 'methodId');
  const rankingInputs = Object.hasOwn(payload, 'rankingInputs')
    ? normalizeRankingInputs(payload.rankingInputs)
    : undefined;
  const requiredSkillPackIds = optionalStringArray(payload, 'requiredSkillPackIds');
  return {
    ...(title !== undefined ? { title } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(analysis !== undefined ? { analysis } : {}),
    ...(design !== undefined ? { design } : {}),
    ...(sourceInput !== undefined ? { sourceInput } : {}),
    ...(decompositionReason !== undefined ? { decompositionReason } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(estimate !== undefined ? { estimate } : {}),
    ...(assignee !== undefined ? { assignee } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(acceptance !== undefined ? { acceptance } : {}),
    ...(acceptanceCriteria !== undefined ? { acceptanceCriteria } : {}),
    ...(coversAcceptanceIds !== undefined ? { coversAcceptanceIds } : {}),
    ...(dependencyIds !== undefined ? { dependencyIds } : {}),
    ...(blockedByIds !== undefined ? { blockedByIds } : {}),
    ...(evidence !== undefined ? { evidence } : {}),
    ...(methodId !== undefined ? { methodId } : {}),
    ...(rankingInputs !== undefined ? { rankingInputs } : {}),
    ...(requiredSkillPackIds !== undefined ? { requiredSkillPackIds } : {}),
  };
}

function makeRequirementFields(payload: Record<string, unknown>) {
  const body = optionalString(payload, 'body');
  const analysis = optionalString(payload, 'analysis');
  const design = optionalString(payload, 'design');
  const sourceInput = optionalString(payload, 'sourceInput');
  const decompositionReason = optionalString(payload, 'decompositionReason');
  const milestoneId = optionalNullableId<MilestoneId>(payload, 'milestoneId');
  const acceptance = optionalStringArray(payload, 'acceptance');
  const acceptanceCriteria = optionalAcceptanceCriteria(payload);
  return {
    title: requireString(payload, 'title'),
    ...(body !== undefined ? { body } : {}),
    ...(analysis !== undefined ? { analysis } : {}),
    ...(design !== undefined ? { design } : {}),
    ...(sourceInput !== undefined ? { sourceInput } : {}),
    ...(decompositionReason !== undefined ? { decompositionReason } : {}),
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    ...(acceptance !== undefined ? { acceptance } : {}),
    ...(acceptanceCriteria !== undefined ? { acceptanceCriteria } : {}),
  };
}

function makeRequirementUpdate(payload: Record<string, unknown>) {
  const title = optionalString(payload, 'title');
  const body = optionalString(payload, 'body');
  const analysis = optionalString(payload, 'analysis');
  const design = optionalString(payload, 'design');
  const sourceInput = optionalString(payload, 'sourceInput');
  const decompositionReason = optionalString(payload, 'decompositionReason');
  const milestoneId = optionalNullableId<MilestoneId>(payload, 'milestoneId');
  const acceptance = optionalStringArray(payload, 'acceptance');
  const acceptanceCriteria = optionalAcceptanceCriteria(payload);
  return {
    ...(title !== undefined ? { title } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(analysis !== undefined ? { analysis } : {}),
    ...(design !== undefined ? { design } : {}),
    ...(sourceInput !== undefined ? { sourceInput } : {}),
    ...(decompositionReason !== undefined ? { decompositionReason } : {}),
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    ...(acceptance !== undefined ? { acceptance } : {}),
    ...(acceptanceCriteria !== undefined ? { acceptanceCriteria } : {}),
  };
}

function makeExecutionInput(payload: Record<string, unknown>) {
  const body = optionalString(payload, 'body');
  const sourceInput = optionalString(payload, 'sourceInput');
  const decompositionReason = optionalString(payload, 'decompositionReason');
  const milestoneId = optionalNullableId<MilestoneId>(payload, 'milestoneId');
  const coversAcceptanceIds = optionalIdArray<AcceptanceCriterionId>(payload, 'coversAcceptanceIds');
  const dependencyIds = optionalIdArray<WorkItemId>(payload, 'dependencyIds');
  const blockedByIds = optionalIdArray<WorkItemId>(payload, 'blockedByIds');
  const evidence = optionalStringArray(payload, 'evidence');
  return {
    parentId: requireId<WorkItemId>(payload, 'parentId'),
    title: requireString(payload, 'title'),
    ...(body !== undefined ? { body } : {}),
    ...(sourceInput !== undefined ? { sourceInput } : {}),
    ...(decompositionReason !== undefined ? { decompositionReason } : {}),
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    ...(coversAcceptanceIds !== undefined ? { coversAcceptanceIds } : {}),
    ...(dependencyIds !== undefined ? { dependencyIds } : {}),
    ...(blockedByIds !== undefined ? { blockedByIds } : {}),
    ...(evidence !== undefined ? { evidence } : {}),
  };
}

function requireSplitChildren(payload: Record<string, unknown>) {
  const value = payload.children;
  if (!Array.isArray(value)) throw new Error('children must be an array');
  return value.map((child, index) => {
    if (!isRecord(child)) throw new Error(`children[${String(index)}] must be an object`);
    const type = requireRequirementChildType(child, 'type');
    return {
      ...makeRequirementFields(child),
      type,
      ...executionLinks(child),
    };
  });
}

function executionLinks(payload: Record<string, unknown>) {
  const coversAcceptanceIds = optionalIdArray<AcceptanceCriterionId>(payload, 'coversAcceptanceIds');
  const dependencyIds = optionalIdArray<WorkItemId>(payload, 'dependencyIds');
  const blockedByIds = optionalIdArray<WorkItemId>(payload, 'blockedByIds');
  const evidence = optionalStringArray(payload, 'evidence');
  return {
    ...(coversAcceptanceIds !== undefined ? { coversAcceptanceIds } : {}),
    ...(dependencyIds !== undefined ? { dependencyIds } : {}),
    ...(blockedByIds !== undefined ? { blockedByIds } : {}),
    ...(evidence !== undefined ? { evidence } : {}),
  };
}

function boardQueryFromUrl(url: URL): BoardViewQuery {
  const groupBy = optionalGroupBy(url.searchParams.get('groupBy'));
  return {
    ...filterFromUrl(url),
    ...(groupBy !== undefined ? { groupBy } : {}),
  };
}

function filterFromUrl(url: URL): WorkItemFilter {
  const projectId = optionalParam<ProjectId>(url, 'projectId');
  const parentId = parentParam(url);
  const milestoneId = milestoneParam(url);
  const type = optionalRepeatedParam<WorkItemType>(url, 'type', WORK_ITEM_TYPES);
  const status = optionalRepeatedParam<WorkItemStatus>(url, 'status', WORK_ITEM_STATUSES);
  const assignee = optionalParam<string>(url, 'assignee');
  const claimedRoleId = claimedRoleParam(url);
  return {
    ...(projectId !== undefined ? { projectId } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(milestoneId !== undefined ? { milestoneId } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(assignee !== undefined ? { assignee } : {}),
    ...(claimedRoleId !== undefined ? { claimedRoleId } : {}),
  };
}

function milestoneFilterFromUrl(url: URL) {
  const projectId = optionalParam<ProjectId>(url, 'projectId');
  const status = optionalRepeatedParam<MilestoneStatus>(url, 'status', MILESTONE_STATUSES);
  return {
    ...(projectId !== undefined ? { projectId } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

function intakeSessionFilterFromUrl(url: URL) {
  const status = optionalRepeatedParam<IntakeSessionStatus>(url, 'status', INTAKE_SESSION_STATUSES);
  return {
    ...(status !== undefined ? { status } : {}),
  };
}

function intakeCandidateFilterFromUrl(url: URL) {
  const status = optionalRepeatedParam<IntakeCandidateStatus>(url, 'status', INTAKE_CANDIDATE_STATUSES);
  return {
    ...(status !== undefined ? { status } : {}),
  };
}

function auditEventFilterFromUrl(url: URL): Omit<AuditEventFilter, 'projectId'> {
  const actorId = optionalParam<string>(url, 'actorId');
  const targetType = optionalParam<string>(url, 'targetType');
  const targetId = optionalParam<string>(url, 'targetId');
  const action = optionalStringRepeatedParam(url, 'action');
  const from = optionalNumberParam(url, 'from');
  const to = optionalNumberParam(url, 'to');
  const limit = optionalIntegerParam(url, 'limit');
  return {
    ...(actorId !== undefined ? { actorId } : {}),
    ...(targetType !== undefined ? { targetType } : {}),
    ...(targetId !== undefined ? { targetId } : {}),
    ...(action !== undefined ? { action } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function optionalRepeatedParam<T extends string>(
  url: URL,
  key: string,
  allowed: readonly T[],
): T | readonly T[] | undefined {
  const values = url.searchParams.getAll(key).filter((value) => value !== '');
  if (values.length === 0) return undefined;
  const typed = values.map((value) => {
    if (!allowed.includes(value as T)) throw new Error(`invalid ${key}: ${value}`);
    return value as T;
  });
  return typed.length === 1 ? typed[0] : typed;
}

function optionalStringRepeatedParam(
  url: URL,
  key: string,
): string | readonly string[] | undefined {
  const values = url.searchParams.getAll(key)
    .map((value) => value.trim())
    .filter((value) => value !== '');
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function parentParam(url: URL): WorkItemId | null | undefined {
  const value = url.searchParams.get('parentId');
  if (value === null) return undefined;
  if (value === '' || value === 'null' || value === 'root') return null;
  return value as WorkItemId;
}

function milestoneParam(url: URL): MilestoneId | null | undefined {
  const value = url.searchParams.get('milestoneId');
  if (value === null) return undefined;
  if (value === '' || value === 'null' || value === 'no-milestone') return null;
  return value as MilestoneId;
}

function storyQueueFilterFromUrl(url: URL): StoryPriorityQueueFilter {
  if (!url.searchParams.has('milestoneId')) return {};
  return { milestoneId: milestoneParam(url) ?? null };
}

function evidenceRollupFilterFromUrl(url: URL) {
  if (!url.searchParams.has('milestoneId')) return {};
  return { milestoneId: milestoneParam(url) ?? null };
}

function claimedRoleParam(url: URL): RoleId | null | undefined {
  const value = url.searchParams.get('claimedRoleId');
  if (value === null) return undefined;
  if (value === '' || value === 'null' || value === 'unclaimed') return null;
  return value as RoleId;
}

function optionalParam<T extends string>(url: URL, key: string): T | undefined {
  const value = url.searchParams.get(key);
  return value === null || value === '' ? undefined : value as T;
}

function optionalNumberParam(url: URL, key: string): number | undefined {
  const value = url.searchParams.get(key);
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid ${key}: ${value}`);
  return parsed;
}

function optionalIntegerParam(url: URL, key: string): number | undefined {
  const value = optionalNumberParam(url, key);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0) throw new Error(`invalid ${key}: ${String(value)}`);
  return value;
}

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: string | readonly string[] | null | undefined,
): void {
  if (value === undefined) return;
  if (value === null) {
    params.set(key, 'null');
    return;
  }
  if (typeof value === 'string') {
    params.set(key, value);
    return;
  }
  for (const item of value) params.append(key, item);
}

function idFromMatch<T extends string>(match: RegExpExecArray): T {
  const value = match[1];
  if (value === undefined) throw new Error('missing id');
  return decodeURIComponent(value) as T;
}

function idFromMatchAt<T extends string>(match: RegExpExecArray, index: number): T {
  const value = match[index];
  if (value === undefined) throw new Error('missing id');
  return decodeURIComponent(value) as T;
}

async function readJsonObject(req: IncomingMessage): Promise<Record<string, unknown>> {
  let text = '';
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    text += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    if (text.length > 1_000_000) throw new Error('request body too large');
  }
  if (text.trim() === '') return {};
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) throw new Error('JSON body must be an object');
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function requirePositiveInteger(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
}

function optionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function optionalNullableString(
  payload: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${key} must be a string or null`);
  return value;
}

function requireId<T extends string>(payload: Record<string, unknown>, key: string): T {
  return requireString(payload, key) as T;
}

function optionalId<T extends string>(payload: Record<string, unknown>, key: string): T | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value as T;
}

function optionalNullableId<T extends string>(
  payload: Record<string, unknown>,
  key: string,
): T | null | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${key} must be a string or null`);
  if (value === '') return null;
  return value as T;
}

function optionalStringArray(
  payload: Record<string, unknown>,
  key: string,
): readonly string[] | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${key} must be an array of strings`);
  }
  return value;
}

function optionalIdArray<T extends string>(
  payload: Record<string, unknown>,
  key: string,
): readonly T[] | undefined {
  const values = optionalStringArray(payload, key);
  return values?.map((value) => value as T);
}

function optionalAcceptanceCriteria(
  payload: Record<string, unknown>,
): readonly AcceptanceCriterion[] | undefined {
  const value = payload.acceptanceCriteria;
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('acceptanceCriteria must be an array');
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`acceptanceCriteria[${String(index)}] must be an object`);
    return {
      id: requireString(item, 'id') as AcceptanceCriterionId,
      text: requireString(item, 'text'),
    };
  });
}

function optionalWorkItemType(
  payload: Record<string, unknown>,
  key: string,
): WorkItemType | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !WORK_ITEM_TYPES.includes(value as WorkItemType)) {
    throw new Error(`invalid ${key}`);
  }
  return value as WorkItemType;
}

function optionalTeamMemberType(
  payload: Record<string, unknown>,
  key: string,
): TeamMemberType | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !TEAM_MEMBER_TYPES.includes(value as TeamMemberType)) {
    throw new Error(`invalid ${key}`);
  }
  return value as TeamMemberType;
}

function optionalTeamMemberStatus(
  payload: Record<string, unknown>,
  key: string,
): TeamMemberStatus | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !TEAM_MEMBER_STATUSES.includes(value as TeamMemberStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as TeamMemberStatus;
}

function optionalIntakeSessionStatus(
  payload: Record<string, unknown>,
  key: string,
): IntakeSessionStatus | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !INTAKE_SESSION_STATUSES.includes(value as IntakeSessionStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as IntakeSessionStatus;
}

function optionalIntakeMessageRole(
  payload: Record<string, unknown>,
  key: string,
): IntakeMessageRole | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !INTAKE_MESSAGE_ROLES.includes(value as IntakeMessageRole)) {
    throw new Error(`invalid ${key}`);
  }
  return value as IntakeMessageRole;
}

function requireIntakeSourceKind(
  payload: Record<string, unknown>,
  key: string,
): IntakeSourceKind {
  const value = requireString(payload, key);
  if (!INTAKE_SOURCE_KINDS.includes(value as IntakeSourceKind)) {
    throw new Error(`invalid ${key}`);
  }
  return value as IntakeSourceKind;
}

function optionalIntakeSourceParseStatus(
  payload: Record<string, unknown>,
  key: string,
): IntakeSourceParseStatus | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !INTAKE_SOURCE_PARSE_STATUSES.includes(value as IntakeSourceParseStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as IntakeSourceParseStatus;
}

function optionalIntakeCandidateType(
  payload: Record<string, unknown>,
  key: string,
): IntakeCandidateType | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !INTAKE_CANDIDATE_TYPES.includes(value as IntakeCandidateType)) {
    throw new Error(`invalid ${key}`);
  }
  return value as IntakeCandidateType;
}

function optionalIntakeCandidateStatus(
  payload: Record<string, unknown>,
  key: string,
): IntakeCandidateStatus | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !INTAKE_CANDIDATE_STATUSES.includes(value as IntakeCandidateStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as IntakeCandidateStatus;
}

function requireDeliveryEvidenceArea(
  payload: Record<string, unknown>,
  key: string,
): DeliveryEvidenceArea {
  const value = requireString(payload, key);
  if (!DELIVERY_EVIDENCE_AREAS.includes(value as DeliveryEvidenceArea)) {
    throw new Error(`invalid ${key}`);
  }
  return value as DeliveryEvidenceArea;
}

function requireDeliveryEvidenceStatus(
  payload: Record<string, unknown>,
  key: string,
): DeliveryEvidenceStatus {
  const value = requireString(payload, key);
  if (!DELIVERY_EVIDENCE_STATUSES.includes(value as DeliveryEvidenceStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as DeliveryEvidenceStatus;
}

function requireDeliveryEvidenceLinkKind(
  payload: Record<string, unknown>,
  key: string,
): DeliveryEvidenceLinkKind {
  const value = requireString(payload, key);
  if (!DELIVERY_EVIDENCE_LINK_KINDS.includes(value as DeliveryEvidenceLinkKind)) {
    throw new Error(`invalid ${key}`);
  }
  return value as DeliveryEvidenceLinkKind;
}

function requireGovernanceObligationStatus(
  payload: Record<string, unknown>,
  key: string,
): GovernanceObligationStatus {
  const value = requireString(payload, key);
  if (!GOVERNANCE_OBLIGATION_STATUSES.includes(value as GovernanceObligationStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as GovernanceObligationStatus;
}

function requireDeliveryRiskArea(
  payload: Record<string, unknown>,
  key: string,
): DeliveryRiskArea {
  const value = requireString(payload, key);
  if (!DELIVERY_RISK_AREAS.includes(value as DeliveryRiskArea)) {
    throw new Error(`invalid ${key}`);
  }
  return value as DeliveryRiskArea;
}

function requireDeliveryRiskAcceptanceStatus(
  payload: Record<string, unknown>,
  key: string,
): DeliveryRiskAcceptanceStatus {
  const value = requireString(payload, key);
  if (!DELIVERY_RISK_ACCEPTANCE_STATUSES.includes(value as DeliveryRiskAcceptanceStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as DeliveryRiskAcceptanceStatus;
}

function optionalWorkflowRunStatus(
  payload: Record<string, unknown>,
  key: string,
): WorkflowRunStatus | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !WORKFLOW_RUN_STATUSES.includes(value as WorkflowRunStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as WorkflowRunStatus;
}

function requireWorkflowStepStatus(
  payload: Record<string, unknown>,
  key: string,
): WorkflowStepStatus {
  const value = requireString(payload, key);
  if (!WORKFLOW_STEP_STATUSES.includes(value as WorkflowStepStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as WorkflowStepStatus;
}

function requireWorkflowWaitItemType(
  payload: Record<string, unknown>,
  key: string,
): WorkflowWaitItemType {
  const value = requireString(payload, key);
  if (!WORKFLOW_WAIT_ITEM_TYPES.includes(value as WorkflowWaitItemType)) {
    throw new Error(`invalid ${key}`);
  }
  return value as WorkflowWaitItemType;
}

function requireWorkflowCheckStatus(
  payload: Record<string, unknown>,
  key: string,
): WorkflowCheckStatus {
  const value = requireString(payload, key);
  if (!WORKFLOW_CHECK_STATUSES.includes(value as WorkflowCheckStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as WorkflowCheckStatus;
}

function requireWorkflowLinkKind(
  payload: Record<string, unknown>,
  key: string,
): WorkflowBoardLinkKind {
  const value = requireString(payload, key);
  if (!WORKFLOW_BOARD_LINK_KINDS.includes(value as WorkflowBoardLinkKind)) {
    throw new Error(`invalid ${key}`);
  }
  return value as WorkflowBoardLinkKind;
}

function requireRequirementChildType(
  payload: Record<string, unknown>,
  key: string,
): RequirementChildType {
  const value = requireString(payload, key);
  if (!REQUIREMENT_CHILD_TYPES.includes(value as RequirementChildType)) {
    throw new Error(`invalid ${key}`);
  }
  return value as RequirementChildType;
}

function requireStatus(payload: Record<string, unknown>, key: string): WorkItemStatus {
  const value = requireString(payload, key);
  if (!WORK_ITEM_STATUSES.includes(value as WorkItemStatus)) throw new Error(`invalid ${key}`);
  return value as WorkItemStatus;
}

function requireDeliveryPolicyBody(payload: Record<string, unknown>): ProjectDeliveryPolicy {
  const source = asObject(payload.deliveryPolicy ?? payload);
  const readyChecks = asStringArray(source.readyChecks);
  const doneChecks = asStringArray(source.doneChecks);
  if (readyChecks.some((item) => !(READY_CHECK_KINDS as readonly string[]).includes(item))) {
    throw new Error('delivery policy readyChecks contains an unknown check');
  }
  if (doneChecks.some((item) => !(DONE_CHECK_KINDS as readonly string[]).includes(item))) {
    throw new Error('delivery policy doneChecks contains an unknown check');
  }
  return {
    readyChecks: readyChecks as ReadyCheckKind[],
    doneChecks: doneChecks as DoneCheckKind[],
  };
}

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('delivery policy checks must be string arrays');
  }
  return value;
}

function optionalStatus(payload: Record<string, unknown>, key: string): WorkItemStatus | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !WORK_ITEM_STATUSES.includes(value as WorkItemStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as WorkItemStatus;
}

function optionalMilestoneStatus(
  payload: Record<string, unknown>,
  key: string,
): MilestoneStatus | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !MILESTONE_STATUSES.includes(value as MilestoneStatus)) {
    throw new Error(`invalid ${key}`);
  }
  return value as MilestoneStatus;
}

function optionalPriority(payload: Record<string, unknown>): WorkItemPriority | null | undefined {
  const value = payload.priority;
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || !PRIORITIES.includes(value as WorkItemPriority)) {
    throw new Error('invalid priority');
  }
  return value as WorkItemPriority;
}

function optionalNumberOrNull(
  payload: Record<string, unknown>,
  key: string,
): number | null | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} must be a number`);
  return value;
}

function optionalNumber(
  payload: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} must be a number`);
  return value;
}

function optionalBoolean(
  payload: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean`);
  return value;
}

function optionalGroupBy(value: string | null): BoardGroupBy | undefined {
  if (value === null || value === '') return undefined;
  if (!BOARD_GROUPS.includes(value as BoardGroupBy)) throw new Error(`invalid groupBy: ${value}`);
  return value as BoardGroupBy;
}

function authRegionFromUrl(url: URL): WebAuthRegion | null {
  return authRegion(url.searchParams.get('region'));
}

function requestHost(req: IncomingMessage): string | null {
  const forwarded = req.headers['x-forwarded-host'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') return forwarded.split(',')[0]?.trim() ?? null;
  const host = req.headers.host;
  return typeof host === 'string' && host.trim() !== '' ? host : null;
}

function requestOrigin(req: IncomingMessage, url: URL): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = typeof protoHeader === 'string' && protoHeader.trim() !== '' ? protoHeader.split(',')[0]?.trim() : url.protocol.replace(':', '');
  const host = requestHost(req) ?? url.host;
  return `${proto}://${host}`;
}

function optionalAuthRegion(
  payload: Record<string, unknown>,
  key: string,
): WebAuthRegion | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  const region = authRegion(value);
  if (region === null) throw new Error(`invalid ${key}`);
  return region;
}

function authRegion(value: string | null): WebAuthRegion | null {
  if (value === null || value === '') return null;
  if (value === 'cn' || value === 'global' || value === 'auto') return value;
  throw new Error(`invalid auth region: ${value}`);
}

function isMutating(method: string): boolean {
  return method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
}

function canWrite(
  config: ResolvedWebConfig,
  principal: WebAuthPrincipal | null,
  req: IncomingMessage,
): boolean {
  if (config.auth.enabled) return principal !== null;
  if (config.writeToken !== null) {
    const authorization = req.headers.authorization;
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;
    const rawHeader = req.headers['x-huntianling-token'];
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    return bearer === config.writeToken || header === config.writeToken;
  }
  if (config.publicUrl !== null || isPublicHost(config.host)) return config.allowUnauthenticatedWrites;
  return true;
}

export function isPublicHost(host: string): boolean {
  return host === '0.0.0.0' || host === '::' || host === '[::]';
}

function hostForUrl(host: string): string {
  if (host === '0.0.0.0') return '127.0.0.1';
  if (host === '::' || host === '[::]') return '[::1]';
  if (host.includes(':') && !host.startsWith('[')) return `[${host}]`;
  return host;
}

function assertAdmin(auth: RequestAuth): void {
  if (auth.principal === null) throw new AuthHttpError(401, 'authentication required');
  if (auth.principal.audience !== 'admin') {
    throw new AuthHttpError(403, 'admin access denied');
  }
}

async function handleAdminApi(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  assertAdmin(auth);
  if (url.pathname === '/api/v1/admin/users' && method === 'GET') {
    sendJson(res, 200, { users: auth.manager.listDirectory() });
    return;
  }
  if (url.pathname === '/api/v1/admin/users' && method === 'POST') {
    const body = await readJsonObject(req);
    const displayName = optionalString(body, 'displayName');
    const projectIds = optionalStringArray(body, 'projectIds');
    sendJson(res, 201, auth.manager.createDirectoryUser({
      username: requireString(body, 'username'),
      password: requireString(body, 'password'),
      audience: resolveWebAuthAudience(optionalString(body, 'audience') ?? 'developer'),
      ...(displayName !== undefined ? { displayName } : {}),
      ...(projectIds !== undefined ? { projectIds: projectIds as ProjectId[] } : {}),
    }));
    return;
  }
  if (url.pathname === '/api/v1/admin/auth-events' && method === 'GET') {
    sendJson(res, 200, { events: auth.manager.listAuthEvents() });
    return;
  }
  const audience = /^\/api\/v1\/admin\/users\/([^/]+)\/audience$/.exec(url.pathname);
  if (audience !== null && method === 'PATCH') {
    const body = await readJsonObject(req);
    auth.manager.setAudience(decodeURIComponent(audience[1] ?? ''), resolveWebAuthAudience(requireString(body, 'audience')));
    sendJson(res, 200, { users: auth.manager.listDirectory() });
    return;
  }
  const membership = /^\/api\/v1\/admin\/users\/([^/]+)\/projects$/.exec(url.pathname);
  if (membership !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const project = authorizeProject(deps, auth, requireId<ProjectId>(body, 'projectId'));
    const username = decodeURIComponent(membership[1] ?? '');
    auth.manager.grantProjectAccess(username, project.id);
    deps.board.recordAuditEvent({
      projectId: project.id,
      actorId: auth.principal?.username ?? 'admin',
      action: 'membership.grant',
      targetType: 'user',
      targetId: username,
      targetLabel: username,
      requestSource: 'admin',
      changedFields: ['projectIds'],
      reason: 'admin grant',
    });
    sendJson(res, 200, { users: auth.manager.listDirectory() });
    return;
  }
  const credential = /^\/api\/v1\/admin\/users\/([^/]+)\/credential$/.exec(url.pathname);
  if (credential !== null && method === 'POST') {
    const body = await readJsonObject(req);
    const username = decodeURIComponent(credential[1] ?? '');
    const enabled = body.enabled;
    if (typeof enabled !== 'boolean') throw new AuthHttpError(400, 'enabled must be a boolean');
    sendJson(res, 200, publicCredentialStatus(auth.manager.setCredentialEnabled(username, enabled)));
    return;
  }
  if (url.pathname === '/api/v1/admin/access' && method === 'GET') {
    sendJson(res, 200, auth.manager.accessSettings());
    return;
  }
  if (url.pathname === '/api/v1/admin/environment' && method === 'GET') {
    const environment = requireEnvironment(deps);
    sendJson(res, 200, {
      profile: environment.profile(),
      lastPrepare: environment.lastPrepare(),
    });
    return;
  }
  if (url.pathname === '/api/v1/admin/audit' && method === 'GET') {
    const projectId = url.searchParams.get('projectId');
    if (projectId === null || projectId.trim() === '') {
      throw new ChannelWriteError('VALIDATION', 'projectId is required');
    }
    const project = authorizeProject(deps, auth, projectId as ProjectId);
    sendJson(res, 200, {
      projectId: project.id,
      auditEvents: deps.board.listAuditEvents({ projectId: project.id }),
    });
    return;
  }
  sendJson(res, 404, { error: 'not found' });
}

function requireEnvironment(deps: WebServiceDependencies): EnvironmentService {
  if (deps.environment === undefined) throw new Error('huntianling.environment is required');
  return deps.environment;
}

function requireScm(deps: WebServiceDependencies): ScmService {
  if (deps.scm === undefined) throw new Error('huntianling.scm is required');
  return deps.scm;
}

function requireCi(deps: WebServiceDependencies): CiService {
  if (deps.ci === undefined) throw new Error('huntianling.ci is required');
  return deps.ci;
}

function requireAgents(deps: WebServiceDependencies): AgentRuntime {
  if (deps.agents === undefined) throw new Error('huntianling.agents is required');
  return deps.agents;
}

function requireDelivery(deps: WebServiceDependencies): DeliveryService {
  if (deps.delivery === undefined) throw new Error('huntianling.delivery is required');
  return deps.delivery;
}

function requireHarness(deps: WebServiceDependencies): HarnessService {
  if (deps.harness === undefined) throw new Error('huntianling.harness is required');
  return deps.harness;
}

function requireAuthority(deps: WebServiceDependencies): AuthorityService {
  if (deps.authority === undefined) throw new Error('huntianling.authority is required');
  return deps.authority;
}

function requireAuthorityAction(payload: Record<string, unknown>, key: string): AuthorityAction {
  const value = requireString(payload, key);
  const actions = [
    'read',
    'draft',
    'code_modify',
    'git_commit',
    'branch_push',
    'pull_request',
    'ci_trigger',
    'production_deploy',
    'review_approve',
    'merge',
    'protected_file_write',
  ] as const;
  if (!(actions as readonly string[]).includes(value)) {
    throw new AuthorityError('VALIDATION', `invalid authority action: ${value}`);
  }
  return value as AuthorityAction;
}

function denyCustomer(auth: RequestAuth, message: string): void {
  if (auth.principal?.audience === 'customer') {
    throw new AuthHttpError(403, message);
  }
}

function requireCollab(deps: WebServiceDependencies): CollabService {
  if (deps.collab === undefined) throw new Error('huntianling.collab is required');
  return deps.collab;
}

function requireWorkflow(deps: WebServiceDependencies): WorkflowService {
  if (deps.workflow === undefined) throw new WorkflowError('NOT_FOUND', 'huntianling.workflow is required');
  return deps.workflow;
}

function requireDispatch(deps: WebServiceDependencies): DispatchService {
  if (deps.dispatch === undefined) throw new DispatchError('NOT_FOUND', 'huntianling.dispatch is required');
  return deps.dispatch;
}

async function handleDispatchApi(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const claim = /^\/api\/v1\/work-items\/([^/]+)\/claim$/.exec(url.pathname);
  if (claim !== null && method === 'POST') {
    denyCustomer(auth, 'dispatch is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(claim));
    const body = await readJsonObject(req);
    sendJson(res, 200, requireDispatch(deps).claim(
      item.id,
      requireString(body, 'memberId') as TeamMemberId,
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const release = /^\/api\/v1\/work-items\/([^/]+)\/release$/.exec(url.pathname);
  if (release !== null && method === 'POST') {
    denyCustomer(auth, 'dispatch is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(release));
    sendJson(res, 200, requireDispatch(deps).release(item.id, auth.principal?.username ?? 'developer'));
    return true;
  }
  const transfer = /^\/api\/v1\/work-items\/([^/]+)\/transfer$/.exec(url.pathname);
  if (transfer !== null && method === 'POST') {
    denyCustomer(auth, 'dispatch is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(transfer));
    const body = await readJsonObject(req);
    sendJson(res, 200, requireDispatch(deps).transfer(
      item.id,
      requireString(body, 'memberId') as TeamMemberId,
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  if (url.pathname === '/api/v1/team/dispatch/recommend' && method === 'POST') {
    denyCustomer(auth, 'dispatch is not available to customers');
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, requireString(body, 'workItemId') as WorkItemId);
    sendJson(res, 200, requireDispatch(deps).recommend(item.projectId, item.id));
    return true;
  }
  if (url.pathname === '/api/v1/team/dispatch/run' && method === 'POST') {
    denyCustomer(auth, 'dispatch is not available to customers');
    const body = await readJsonObject(req);
    const project = authorizeProject(deps, auth, requireString(body, 'projectId') as ProjectId);
    sendJson(res, 200, {
      assigned: requireDispatch(deps).run(project.id, auth.principal?.username ?? 'developer'),
    });
    return true;
  }
  if (url.pathname === '/api/v1/resource-leases' && method === 'POST') {
    denyCustomer(auth, 'leases are not available to customers');
    const body = await readJsonObject(req);
    const project = authorizeProject(deps, auth, requireString(body, 'projectId') as ProjectId);
    const workItemId = optionalString(body, 'workItemId');
    const linkedTaskId = optionalString(body, 'linkedTaskId');
    sendJson(res, 201, requireDispatch(deps).acquireLease({
      projectId: project.id,
      resourceType: requireString(body, 'resourceType') as never,
      resourceId: requireString(body, 'resourceId'),
      mode: requireString(body, 'mode') as never,
      ownerId: optionalString(body, 'ownerId') ?? auth.principal?.username ?? 'developer',
      reason: requireString(body, 'reason'),
      ...(workItemId !== undefined ? { workItemId: workItemId as WorkItemId } : {}),
      ...(linkedTaskId !== undefined ? { linkedTaskId } : {}),
    }));
    return true;
  }
  if (url.pathname === '/api/v1/resource-leases' && method === 'GET') {
    const projectId = url.searchParams.get('projectId');
    if (projectId === null || projectId.trim() === '') throw new DispatchError('VALIDATION', 'projectId is required');
    authorizeProject(deps, auth, projectId as ProjectId);
    sendJson(res, 200, { leases: requireDispatch(deps).listLeases(projectId as ProjectId) });
    return true;
  }
  const renewLease = /^\/api\/v1\/resource-leases\/([^/]+)\/renew$/.exec(url.pathname);
  if (renewLease !== null && method === 'POST') {
    denyCustomer(auth, 'leases are not available to customers');
    sendJson(res, 200, requireDispatch(deps).renewLease(
      idFromMatch(renewLease),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const releaseLease = /^\/api\/v1\/resource-leases\/([^/]+)\/release$/.exec(url.pathname);
  if (releaseLease !== null && method === 'POST') {
    denyCustomer(auth, 'leases are not available to customers');
    sendJson(res, 200, requireDispatch(deps).releaseLease(
      idFromMatch(releaseLease),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const conflicts = /^\/api\/v1\/projects\/([^/]+)\/conflicts$/.exec(url.pathname);
  if (conflicts !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(conflicts));
    sendJson(res, 200, { conflicts: requireDispatch(deps).listConflicts(project.id) });
    return true;
  }
  const rebalance = /^\/api\/v1\/projects\/([^/]+)\/dispatch\/rebalance$/.exec(url.pathname);
  if (rebalance !== null && method === 'POST') {
    denyCustomer(auth, 'dispatch is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(rebalance));
    sendJson(res, 200, {
      released: requireDispatch(deps).rebalance(project.id, auth.principal?.username ?? 'developer'),
    });
    return true;
  }
  const feedbackDecide = /^\/api\/v1\/agent-feedback\/([^/]+)\/(accept|reject|revision)$/.exec(url.pathname);
  if (feedbackDecide !== null && method === 'POST') {
    denyCustomer(auth, 'agent feedback is not available to customers');
    const decision = feedbackDecide[2] === 'revision' ? 'request-revision' : feedbackDecide[2];
    sendJson(res, 200, requireDispatch(deps).decideFeedback(idFromMatch(feedbackDecide), {
      actor: auth.principal?.username ?? 'developer',
      decision: decision as 'accept' | 'reject' | 'request-revision',
    }));
    return true;
  }
  return false;
}

function requireSkills(deps: WebServiceDependencies): SkillService {
  if (deps.skills === undefined) throw new SkillWriteError('MISSING_SKILL', 'huntianling.skills is required');
  return deps.skills;
}

async function handleSkillToolApi(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (url.pathname === '/api/v1/agents' && method === 'GET') {
    denyCustomer(auth, 'agent catalog is not available to customers');
    sendJson(res, 200, { agents: requireAgents(deps).definitions() });
    return true;
  }
  if (url.pathname === '/api/v1/skill-packs' && method === 'GET') {
    denyCustomer(auth, 'skill packs are not available to customers');
    sendJson(res, 200, { packs: requireSkills(deps).listPacks() });
    return true;
  }
  const projectSkillPacks = /^\/api\/v1\/projects\/([^/]+)\/skill-packs$/.exec(url.pathname);
  if (projectSkillPacks !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectSkillPacks));
    const workspaceRoot = url.searchParams.get('workspaceRoot')?.trim() || process.cwd();
    sendJson(res, 200, {
      packs: requireSkills(deps).listPacks(),
      installed: requireSkills(deps).installedPacks(project.id),
      recommended: requireSkills(deps).recommendPacks(workspaceRoot),
    });
    return true;
  }
  const packToggle = /^\/api\/v1\/projects\/([^/]+)\/skill-packs\/([^/]+)\/(install|uninstall)$/.exec(url.pathname);
  if (packToggle !== null && method === 'POST') {
    denyCustomer(auth, 'skill packs are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(packToggle));
    const packId = idFromMatchAt(packToggle, 2);
    if (packToggle[3] === 'uninstall') {
      requireSkills(deps).uninstallPack(project.id, packId);
      sendJson(res, 200, { installed: requireSkills(deps).installedPacks(project.id) });
      return true;
    }
    const body = await readJsonObject(req);
    const version = optionalString(body, 'version');
    sendJson(res, 200, requireSkills(deps).installPack(project.id, packId, ...(version !== undefined ? [version] : [])));
    return true;
  }
  const projectAgents = /^\/api\/v1\/projects\/([^/]+)\/agents$/.exec(url.pathname);
  if (projectAgents !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectAgents));
    sendJson(res, 200, {
      enabledAgentIds: project.enabledAgentIds,
      customizations: project.agentCustomizations,
      agents: requireAgents(deps).definitions(),
    });
    return true;
  }
  const agentToggle = /^\/api\/v1\/projects\/([^/]+)\/agents\/([^/]+)\/(enable|disable)$/.exec(url.pathname);
  if (agentToggle !== null && method === 'POST') {
    denyCustomer(auth, 'agent roster is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(agentToggle));
    const agentId = requireAgentId(idFromMatchAt(agentToggle, 2));
    sendJson(res, 200, agentToggle[3] === 'disable'
      ? deps.board.disableAgent(project.id, agentId)
      : deps.board.enableAgent(project.id, agentId));
    return true;
  }
  const agentCustomize = /^\/api\/v1\/projects\/([^/]+)\/agents\/([^/]+)\/customize$/.exec(url.pathname);
  if (agentCustomize !== null && method === 'POST') {
    denyCustomer(auth, 'agent roster is not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(agentCustomize));
    const agentId = requireAgentId(idFromMatchAt(agentCustomize, 2));
    const body = await readJsonObject(req);
    const allowedToolIds = optionalStringArray(body, 'allowedToolIds');
    const requiredSkillIds = optionalStringArray(body, 'requiredSkillIds');
    sendJson(res, 200, deps.board.customizeAgent(project.id, agentId, {
      ...(allowedToolIds !== undefined ? { allowedToolIds } : {}),
      ...(requiredSkillIds !== undefined ? { requiredSkillIds } : {}),
    }));
    return true;
  }
  const specialistRun = /^\/api\/v1\/work-items\/([^/]+)\/agents\/([^/]+)\/run$/.exec(url.pathname);
  if (specialistRun !== null && method === 'POST') {
    denyCustomer(auth, 'agent roster is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(specialistRun));
    const agentId = requireAgentId(idFromMatchAt(specialistRun, 2));
    if (!isSpecialistAgentId(agentId)) {
      throw new AgentTaskError('BINDING', `coding agent ${agentId} cannot use the specialist run route`);
    }
    const body = await readJsonObject(req);
    const findings = optionalStringArray(body, 'findings');
    const run = requireAgents(deps).startRun({
      agentId,
      executor: 'manual',
      projectId: item.projectId,
      workItemId: item.id,
      input: {
        quotes: [{ text: item.body || item.title, source: 'work-item' }],
        goal: item.title,
        outcome: item.title,
        confirmed: true,
        independent: true,
        acceptance: item.acceptance.length > 0 ? item.acceptance : ['the agreed acceptance can be verified'],
        ...(findings !== undefined ? { findings } : {}),
      },
    });
    sendJson(res, 200, { run, workItem: deps.board.getWorkItem(item.id) });
    return true;
  }
  if (url.pathname === '/api/v1/methods' && method === 'GET') {
    denyCustomer(auth, 'method catalog is not available to customers');
    sendJson(res, 200, { methods: requireAgents(deps).methods(), baseline: requireAgents(deps).baseline() });
    return true;
  }
  if (url.pathname === '/api/v1/prioritization-methods' && method === 'GET') {
    denyCustomer(auth, 'prioritization methods are not available to customers');
    sendJson(res, 200, { methods: deps.board.prioritizationMethods() });
    return true;
  }
  const projectPrioritization = /^\/api\/v1\/projects\/([^/]+)\/prioritization$/.exec(url.pathname);
  if (projectPrioritization !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectPrioritization));
    sendJson(res, 200, {
      methodId: project.prioritizationMethodId,
      methods: deps.board.prioritizationMethods(),
    });
    return true;
  }
  if (projectPrioritization !== null && method === 'PUT') {
    denyCustomer(auth, 'prioritization methods are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectPrioritization));
    const body = await readJsonObject(req);
    const methodId = optionalNullableString(body, 'methodId') ?? null;
    if (methodId !== null && !isPrioritizationMethodId(methodId)) {
      throw new Error(`unknown prioritization method: ${methodId}`);
    }
    sendJson(res, 200, deps.board.updateProject(project.id, { prioritizationMethodId: methodId }));
    return true;
  }
  const rankingOverride = /^\/api\/v1\/work-items\/([^/]+)\/ranking-override$/.exec(url.pathname);
  if (rankingOverride !== null && method === 'POST') {
    denyCustomer(auth, 'ranking override is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(rankingOverride));
    const body = await readJsonObject(req);
    sendJson(res, 200, deps.board.overrideStoryRanking(item.id, {
      rank: requirePositiveInteger(body, 'rank'),
      reason: requireString(body, 'reason'),
      actorId: auth.principal?.username ?? 'developer',
    }));
    return true;
  }
  const projectMethods = /^\/api\/v1\/projects\/([^/]+)\/methods$/.exec(url.pathname);
  if (projectMethods !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectMethods));
    sendJson(res, 200, {
      enabledMethodIds: project.enabledMethodIds,
      methods: requireAgents(deps).methods(),
    });
    return true;
  }
  const methodToggle = /^\/api\/v1\/projects\/([^/]+)\/methods\/([^/]+)\/(enable|disable)$/.exec(url.pathname);
  if (methodToggle !== null && method === 'POST') {
    denyCustomer(auth, 'method packs are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(methodToggle));
    const methodId = idFromMatchAt(methodToggle, 2);
    if (requireAgents(deps).methods().every((item) => item.id !== methodId)) {
      throw new AgentTaskError('MISSING_METHOD', `unknown method: ${methodId}`);
    }
    const enabled = new Set(project.enabledMethodIds);
    if (methodToggle[3] === 'disable') enabled.delete(methodId);
    else enabled.add(methodId);
    sendJson(res, 200, deps.board.updateProject(project.id, { enabledMethodIds: [...enabled] }));
    return true;
  }
  const workItemPlan = /^\/api\/v1\/work-items\/([^/]+)\/plan$/.exec(url.pathname);
  if (workItemPlan !== null && method === 'POST') {
    denyCustomer(auth, 'method packs are not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workItemPlan));
    const body = await readJsonObject(req);
    const methodId = requireString(body, 'methodId');
    const run = requireAgents(deps).startRun({
      agentId: 'planner',
      executor: 'manual',
      projectId: item.projectId,
      workItemId: item.id,
      methodId,
      input: {
        quotes: [{ text: item.body || item.title, source: 'work-item' }],
        goal: item.title,
        actors: ['user'],
        confirmed: true,
        acceptance: item.acceptance.length > 0 ? item.acceptance : ['the agreed acceptance can be verified'],
      },
    });
    sendJson(res, 200, { run, workItem: deps.board.getWorkItem(item.id) });
    return true;
  }
  const agentRunRecognition = /^\/api\/v1\/agent-runs\/([^/]+)\/state-recognition$/.exec(url.pathname);
  if (agentRunRecognition !== null && method === 'GET') {
    denyCustomer(auth, 'agent runs are not available to customers');
    const run = requireAgents(deps).getRun(idFromMatch(agentRunRecognition));
    if (run === undefined) {
      sendJson(res, 404, { error: 'agent run not found' });
      return true;
    }
    sendJson(res, 200, { recognition: run.stateRecognition });
    return true;
  }
  if (url.pathname === '/api/v1/skills' && method === 'GET') {
    denyCustomer(auth, 'skill catalog is not available to customers');
    sendJson(res, 200, { skills: requireSkills(deps).list() });
    return true;
  }
  if (url.pathname === '/api/v1/tools' && method === 'GET') {
    denyCustomer(auth, 'tool catalog is not available to customers');
    const tools = requireEnvironment(deps).tools();
    sendJson(res, 200, { tools: tools.list(), categories: tools.categories() });
    return true;
  }
  if (url.pathname === '/api/v1/tools/evidence' && method === 'GET') {
    denyCustomer(auth, 'tool evidence is not available to customers');
    sendJson(res, 200, { evidence: requireEnvironment(deps).tools().evidence() });
    return true;
  }
  if (url.pathname === '/api/v1/tools/invoke' && method === 'POST') {
    denyCustomer(auth, 'tool invoke is not available to customers');
    const body = await readJsonObject(req);
    const workItemId = optionalString(body, 'workItemId');
    const affectsDelivery = optionalBoolean(body, 'affectsDelivery');
    sendJson(res, 200, requireEnvironment(deps).invokeTool({
      toolId: requireString(body, 'toolId') as never,
      role: optionalString(body, 'role') ?? 'generator',
      taskType: optionalString(body, 'taskType') ?? 'implement',
      ...(workItemId !== undefined ? { workItemId } : {}),
      input: asObject(body.input ?? body),
      ...(affectsDelivery !== undefined ? { affectsDelivery } : {}),
    }));
    return true;
  }
  if (url.pathname === '/api/v1/scm/catalog' && method === 'GET') {
    denyCustomer(auth, 'source control catalog is not available to customers');
    sendJson(res, 200, { providers: ['local', 'github', 'gitea', 'gitlab'] });
    return true;
  }
  if (url.pathname === '/api/v1/ci/catalog' && method === 'GET') {
    denyCustomer(auth, 'ci catalog is not available to customers');
    sendJson(res, 200, { providers: ['local', 'github-actions', 'gitea-actions', 'gitlab-ci'] });
    return true;
  }
  const inspectTask = /^\/api\/v1\/work-items\/([^/]+)\/agent-tasks\/inspect$/.exec(url.pathname);
  if (inspectTask !== null && method === 'POST') {
    denyCustomer(auth, 'agent task inspect is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(inspectTask));
    const body = await readJsonObject(req);
    const agentId = requireString(body, 'agentId') as AgentId;
    const methodId = optionalString(body, 'methodId');
    const environmentReady = optionalBoolean(body, 'environmentReady');
    sendJson(res, 200, requireAgents(deps).inspectTask({
      workItemId: item.id,
      agentId,
      ...(methodId !== undefined ? { methodId } : {}),
      ...(environmentReady !== undefined ? { environmentReady } : {}),
      input: body.input,
    }));
    return true;
  }
  if (url.pathname === '/api/v1/skills/templates' && method === 'GET') {
    denyCustomer(auth, 'skill templates are not available to customers');
    sendJson(res, 200, { templates: requireSkills(deps).listTemplates() });
    return true;
  }
  if (url.pathname === '/api/v1/skills/drafts' && method === 'GET') {
    denyCustomer(auth, 'skill drafts are not available to customers');
    sendJson(res, 200, { drafts: requireSkills(deps).listDrafts() });
    return true;
  }
  if (url.pathname === '/api/v1/skills/drafts' && method === 'POST') {
    denyCustomer(auth, 'skill drafts are not available to customers');
    const body = await readJsonObject(req);
    const name = optionalString(body, 'name');
    const description = optionalString(body, 'description');
    sendJson(res, 201, requireSkills(deps).draftSkill({
      templateId: requireString(body, 'templateId'),
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
    }));
    return true;
  }
  const validateDraft = /^\/api\/v1\/skills\/drafts\/([^/]+)\/validate$/.exec(url.pathname);
  if (validateDraft !== null && method === 'POST') {
    denyCustomer(auth, 'skill drafts are not available to customers');
    sendJson(res, 200, requireSkills(deps).validateDraft(idFromMatch(validateDraft) as never));
    return true;
  }
  const enableDraft = /^\/api\/v1\/skills\/drafts\/([^/]+)\/enable$/.exec(url.pathname);
  if (enableDraft !== null && method === 'POST') {
    denyCustomer(auth, 'skill drafts are not available to customers');
    const body = await readJsonObject(req);
    sendJson(res, 200, requireSkills(deps).enableDraft(
      idFromMatch(enableDraft) as never,
      requireString(body, 'projectId'),
    ));
    return true;
  }
  if (url.pathname === '/api/v1/agent-skill-validations' && method === 'GET') {
    denyCustomer(auth, 'skill validations are not available to customers');
    const skillId = url.searchParams.get('skillId');
    sendJson(res, 200, {
      validations: requireSkills(deps).listValidations(skillId === null || skillId.trim() === '' ? undefined : skillId as never),
    });
    return true;
  }
  return false;
}

async function handleWorkflowApi(
  deps: WebServiceDependencies,
  auth: RequestAuth,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const workflowGates = /^\/api\/v1\/work-items\/([^/]+)\/workflow\/gates$/.exec(url.pathname);
  if (workflowGates !== null && method === 'GET') {
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workflowGates));
    const to = (url.searchParams.get('to') ?? 'ready') as WorkItemStatus;
    sendJson(res, 200, requireWorkflow(deps).inspectGates(item.id, to));
    return true;
  }
  const workflowTransition = /^\/api\/v1\/work-items\/([^/]+)\/workflow\/transition$/.exec(url.pathname);
  if (workflowTransition !== null && method === 'POST') {
    denyCustomer(auth, 'workflow transitions are not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workflowTransition));
    const body = await readJsonObject(req);
    sendJson(res, 200, requireWorkflow(deps).transition(
      item.id,
      requireString(body, 'to') as WorkItemStatus,
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const workflowOverride = /^\/api\/v1\/work-items\/([^/]+)\/workflow\/override$/.exec(url.pathname);
  if (workflowOverride !== null && method === 'POST') {
    denyCustomer(auth, 'workflow override is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workflowOverride));
    const body = await readJsonObject(req);
    sendJson(res, 200, requireWorkflow(deps).override(item.id, requireString(body, 'to') as WorkItemStatus, {
      actor: auth.principal?.username ?? 'developer',
      reason: requireString(body, 'reason'),
      scope: requireString(body, 'scope'),
    }));
    return true;
  }
  const workflowPlan = /^\/api\/v1\/work-items\/([^/]+)\/workflow\/plan$/.exec(url.pathname);
  if (workflowPlan !== null && method === 'POST') {
    denyCustomer(auth, 'workflow planning is not available to customers');
    const item = authorizeWorkItem(deps, auth, idFromMatch<WorkItemId>(workflowPlan));
    sendJson(res, 201, requireWorkflow(deps).plan(item.id, auth.principal?.username ?? 'developer'));
    return true;
  }
  const workflowRunStart = /^\/api\/v1\/workflow-runs\/([^/]+)\/start$/.exec(url.pathname);
  if (workflowRunStart !== null && method === 'POST') {
    denyCustomer(auth, 'workflow runs are not available to customers');
    sendJson(res, 200, requireWorkflow(deps).start(idFromMatch(workflowRunStart), auth.principal?.username ?? 'developer'));
    return true;
  }
  const workflowRun = /^\/api\/v1\/workflow-runs\/([^/]+)$/.exec(url.pathname);
  if (workflowRun !== null && method === 'GET') {
    const run = requireWorkflow(deps).getRun(idFromMatch(workflowRun));
    if (run === undefined) throw new WorkflowError('NOT_FOUND', 'workflow run not found');
    authorizeProject(deps, auth, run.projectId);
    sendJson(res, 200, run);
    return true;
  }
  const workflowRunState = /^\/api\/v1\/workflow-runs\/([^/]+)\/state$/.exec(url.pathname);
  if (workflowRunState !== null && method === 'GET') {
    const run = requireWorkflow(deps).getRun(idFromMatch(workflowRunState));
    if (run === undefined) throw new WorkflowError('NOT_FOUND', 'workflow run not found');
    authorizeProject(deps, auth, run.projectId);
    sendJson(res, 200, requireWorkflow(deps).runState(run.id));
    return true;
  }
  const workflowRecognitions = /^\/api\/v1\/workflow-runs\/([^/]+)\/recognitions$/.exec(url.pathname);
  if (workflowRecognitions !== null && method === 'GET') {
    const run = requireWorkflow(deps).getRun(idFromMatch(workflowRecognitions));
    if (run === undefined) throw new WorkflowError('NOT_FOUND', 'workflow run not found');
    authorizeProject(deps, auth, run.projectId);
    sendJson(res, 200, { recognitions: requireWorkflow(deps).listRecognitions(run.id) });
    return true;
  }
  const workflowRecognize = /^\/api\/v1\/workflow-runs\/([^/]+)\/steps\/([^/]+)\/recognize-state$/.exec(url.pathname);
  if (workflowRecognize !== null && method === 'POST') {
    denyCustomer(auth, 'workflow state recognition is not available to customers');
    const run = requireWorkflow(deps).getRun(idFromMatchAt(workflowRecognize, 1));
    if (run === undefined) throw new WorkflowError('NOT_FOUND', 'workflow run not found');
    authorizeProject(deps, auth, run.projectId);
    sendJson(res, 201, requireWorkflow(deps).recognizeStep(
      run.id,
      idFromMatchAt(workflowRecognize, 2),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const workflowPause = /^\/api\/v1\/workflow-runs\/([^/]+)\/pause$/.exec(url.pathname);
  if (workflowPause !== null && method === 'POST') {
    denyCustomer(auth, 'workflow runs are not available to customers');
    sendJson(res, 200, requireWorkflow(deps).pause(idFromMatch(workflowPause), auth.principal?.username ?? 'developer'));
    return true;
  }
  const workflowResume = /^\/api\/v1\/workflow-runs\/([^/]+)\/resume$/.exec(url.pathname);
  if (workflowResume !== null && method === 'POST') {
    denyCustomer(auth, 'workflow runs are not available to customers');
    sendJson(res, 200, requireWorkflow(deps).resume(idFromMatch(workflowResume), auth.principal?.username ?? 'developer'));
    return true;
  }
  const workflowCancel = /^\/api\/v1\/workflow-runs\/([^/]+)\/cancel$/.exec(url.pathname);
  if (workflowCancel !== null && method === 'POST') {
    denyCustomer(auth, 'workflow runs are not available to customers');
    sendJson(res, 200, requireWorkflow(deps).cancel(idFromMatch(workflowCancel), auth.principal?.username ?? 'developer'));
    return true;
  }
  const workflowSchedule = /^\/api\/v1\/workflow-runs\/([^/]+)\/schedule$/.exec(url.pathname);
  if (workflowSchedule !== null && method === 'GET') {
    sendJson(res, 200, { steps: requireWorkflow(deps).schedule(idFromMatch(workflowSchedule)) });
    return true;
  }
  const workflowRecompute = /^\/api\/v1\/workflow-runs\/([^/]+)\/schedule\/recompute$/.exec(url.pathname);
  if (workflowRecompute !== null && method === 'POST') {
    denyCustomer(auth, 'workflow runs are not available to customers');
    sendJson(res, 200, requireWorkflow(deps).recompute(idFromMatch(workflowRecompute)));
    return true;
  }
  const workflowTimeline = /^\/api\/v1\/workflow-runs\/([^/]+)\/timeline$/.exec(url.pathname);
  if (workflowTimeline !== null && method === 'GET') {
    sendJson(res, 200, { events: requireWorkflow(deps).timeline(idFromMatch(workflowTimeline)) });
    return true;
  }
  const workflowDecisions = /^\/api\/v1\/workflow-runs\/([^/]+)\/scheduler-decisions$/.exec(url.pathname);
  if (workflowDecisions !== null && method === 'GET') {
    sendJson(res, 200, { decisions: requireWorkflow(deps).schedulerDecisions(idFromMatch(workflowDecisions)) });
    return true;
  }
  const workflowRetry = /^\/api\/v1\/workflow-runs\/([^/]+)\/steps\/([^/]+)\/retry$/.exec(url.pathname);
  if (workflowRetry !== null && method === 'POST') {
    denyCustomer(auth, 'workflow runs are not available to customers');
    sendJson(res, 200, requireWorkflow(deps).retryStep(
      idFromMatchAt(workflowRetry, 1),
      idFromMatchAt(workflowRetry, 2),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const workflowReassign = /^\/api\/v1\/workflow-runs\/([^/]+)\/steps\/([^/]+)\/reassign$/.exec(url.pathname);
  if (workflowReassign !== null && method === 'POST') {
    denyCustomer(auth, 'workflow runs are not available to customers');
    const body = await readJsonObject(req);
    sendJson(res, 200, requireWorkflow(deps).reassignStep(
      idFromMatchAt(workflowReassign, 1),
      idFromMatchAt(workflowReassign, 2),
      requireString(body, 'owner'),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  if (url.pathname === '/api/v1/approval-requests' && method === 'POST') {
    denyCustomer(auth, 'approvals are not available to customers');
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, requireString(body, 'workItemId') as WorkItemId);
    sendJson(res, 201, requireWorkflow(deps).createApproval({
      workItemId: item.id,
      kind: requireString(body, 'kind') as never,
      requester: auth.principal?.username ?? 'developer',
      requesterRole: optionalString(body, 'requesterRole') ?? 'developer',
      requiredApproverRoles: optionalStringArray(body, 'requiredApproverRoles') ?? ['developer'],
      reason: requireString(body, 'reason'),
    }));
    return true;
  }
  if (url.pathname === '/api/v1/approval-requests' && method === 'GET') {
    const projectId = url.searchParams.get('projectId');
    if (projectId === null || projectId.trim() === '') throw new WorkflowError('VALIDATION', 'projectId is required');
    authorizeProject(deps, auth, projectId as ProjectId);
    sendJson(res, 200, { approvals: requireWorkflow(deps).listApprovals(projectId as ProjectId) });
    return true;
  }
  const approvalDecide = /^\/api\/v1\/approval-requests\/([^/]+)\/(approve|reject|request-revision|delegate)$/.exec(url.pathname);
  if (approvalDecide !== null && method === 'POST') {
    denyCustomer(auth, 'approvals are not available to customers');
    const body = await readJsonObject(req);
    const decision = approvalDecide[2] === 'request-revision' ? 'request-revision' : approvalDecide[2];
    const delegateRole = optionalString(body, 'delegateRole');
    sendJson(res, 200, requireWorkflow(deps).decideApproval(idFromMatch(approvalDecide), {
      actor: auth.principal?.username ?? 'developer',
      actorRole: optionalString(body, 'actorRole') ?? 'developer',
      decision: decision as 'approve' | 'reject' | 'request-revision' | 'delegate',
      reason: optionalString(body, 'reason') ?? decision ?? 'decided',
      ...(delegateRole !== undefined ? { delegateRole } : {}),
    }));
    return true;
  }
  if ((url.pathname === '/api/v1/harness/workflows' || url.pathname === '/api/v1/workflow-templates') && method === 'GET') {
    sendJson(res, 200, { templates: requireWorkflow(deps).listTemplates() });
    return true;
  }
  const workflowTemplateOne = /^\/api\/v1\/workflow-templates\/([^/]+)$/.exec(url.pathname);
  if (workflowTemplateOne !== null && method === 'GET') {
    sendJson(res, 200, requireWorkflow(deps).getTemplate(idFromMatch(workflowTemplateOne)));
    return true;
  }
  const workflowCanvas = /^\/api\/v1\/workflow-templates\/([^/]+)\/canvas$/.exec(url.pathname);
  if (workflowCanvas !== null && method === 'GET') {
    sendJson(res, 200, requireWorkflow(deps).getCanvas(idFromMatch(workflowCanvas)));
    return true;
  }
  const visualizationLayers = /^\/api\/v1\/workflow-templates\/([^/]+)\/visualization\/layers$/.exec(url.pathname);
  if (visualizationLayers !== null && method === 'GET') {
    sendJson(res, 200, { layers: requireWorkflow(deps).listVisualizationLayers() });
    return true;
  }
  const visualizationExport = /^\/api\/v1\/workflow-templates\/([^/]+)\/visualization\/export$/.exec(url.pathname);
  if (visualizationExport !== null && method === 'POST') {
    denyCustomer(auth, 'workflow visualization export is not available to customers');
    const body = await readJsonObject(req);
    const format = optionalString(body, 'format') ?? 'markdown';
    sendJson(res, 200, requireWorkflow(deps).exportVisualization(
      idFromMatch(visualizationExport),
      format === 'dsl' || format === 'svg' ? format : 'markdown',
    ));
    return true;
  }
  const visualization = /^\/api\/v1\/workflow-templates\/([^/]+)\/visualization$/.exec(url.pathname);
  if (visualization !== null && method === 'GET') {
    sendJson(res, 200, requireWorkflow(deps).visualizeTemplate(idFromMatch(visualization)));
    return true;
  }
  const templateDiff = /^\/api\/v1\/workflow-templates\/([^/]+)\/versions\/([^/]+)\/diff$/.exec(url.pathname);
  if (templateDiff !== null && method === 'GET') {
    sendJson(res, 200, requireWorkflow(deps).diffTemplateVersion(
      idFromMatchAt(templateDiff, 1),
      idFromMatchAt(templateDiff, 2),
    ));
    return true;
  }
  const testReplay = /^\/api\/v1\/workflow-test-runs\/([^/]+)\/replay$/.exec(url.pathname);
  if (testReplay !== null && method === 'GET') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    sendJson(res, 200, requireWorkflow(deps).getTestReplay(idFromMatch(testReplay)));
    return true;
  }
  const testTimeline = /^\/api\/v1\/workflow-test-runs\/([^/]+)\/timeline$/.exec(url.pathname);
  if (testTimeline !== null && method === 'GET') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    const view = requireWorkflow(deps).getTestReplay(idFromMatch(testTimeline));
    sendJson(res, 200, {
      frames: view.frames.map((frame, index) => ({ index, ...frame })),
    });
    return true;
  }
  const testAssertions = /^\/api\/v1\/workflow-test-runs\/([^/]+)\/assertions$/.exec(url.pathname);
  if (testAssertions !== null && method === 'GET') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    sendJson(res, 200, requireWorkflow(deps).getTestAssertions(idFromMatch(testAssertions)));
    return true;
  }
  const testExport = /^\/api\/v1\/workflow-test-runs\/([^/]+)\/export-report$/.exec(url.pathname);
  if (testExport !== null && method === 'POST') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    sendJson(res, 200, requireWorkflow(deps).exportTestReplay(idFromMatch(testExport)));
    return true;
  }
  if (workflowCanvas !== null && method === 'PUT') {
    denyCustomer(auth, 'workflow canvas is not available to customers');
    const templateId = idFromMatch(workflowCanvas);
    const template = requireWorkflow(deps).getTemplate(templateId);
    const body = await readJsonObject(req);
    sendJson(res, 200, requireWorkflow(deps).saveCanvas(
      templateId,
      canvasFromUnknown(templateId, template.version, body),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const workflowValidate = /^\/api\/v1\/workflow-templates\/([^/]+)\/validate$/.exec(url.pathname);
  if (workflowValidate !== null && method === 'POST') {
    denyCustomer(auth, 'workflow validation is not available to customers');
    sendJson(res, 200, requireWorkflow(deps).validateDraft(idFromMatch(workflowValidate)));
    return true;
  }
  const workflowPublish = /^\/api\/v1\/workflow-templates\/([^/]+)\/publish$/.exec(url.pathname);
  if (workflowPublish !== null && method === 'POST') {
    denyCustomer(auth, 'workflow publish is not available to customers');
    sendJson(res, 200, requireWorkflow(deps).publishTemplate(
      idFromMatch(workflowPublish),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const workflowArchive = /^\/api\/v1\/workflow-templates\/([^/]+)\/archive$/.exec(url.pathname);
  if (workflowArchive !== null && method === 'POST') {
    denyCustomer(auth, 'workflow archive is not available to customers');
    sendJson(res, 200, requireWorkflow(deps).archiveTemplate(
      idFromMatch(workflowArchive),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const workflowTestCases = /^\/api\/v1\/workflow-templates\/([^/]+)\/test-cases$/.exec(url.pathname);
  if (workflowTestCases !== null && method === 'GET') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    sendJson(res, 200, { testCases: requireWorkflow(deps).listTestCases(idFromMatch(workflowTestCases)) });
    return true;
  }
  if (workflowTestCases !== null && method === 'POST') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    const body = await readJsonObject(req);
    sendJson(res, 201, requireWorkflow(deps).createTestCase({
      templateId: idFromMatch(workflowTestCases),
      title: requireString(body, 'title'),
      scenario: requireString(body, 'scenario') as never,
    }));
    return true;
  }
  const workflowTestRuns = /^\/api\/v1\/workflow-templates\/([^/]+)\/test-runs$/.exec(url.pathname);
  if (workflowTestRuns !== null && method === 'GET') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    sendJson(res, 200, { runs: requireWorkflow(deps).listTestRuns(idFromMatch(workflowTestRuns)) });
    return true;
  }
  if (workflowTestRuns !== null && method === 'POST') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    const body = await readJsonObject(req);
    sendJson(res, 201, requireWorkflow(deps).runTestCase(
      idFromMatch(workflowTestRuns),
      requireString(body, 'testCaseId'),
    ));
    return true;
  }
  const workflowTestRunOne = /^\/api\/v1\/workflow-test-runs\/([^/]+)$/.exec(url.pathname);
  if (workflowTestRunOne !== null && method === 'GET') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    const run = requireWorkflow(deps).getTestRun(idFromMatch(workflowTestRunOne));
    if (run === undefined) throw new WorkflowError('NOT_FOUND', 'workflow test run not found');
    sendJson(res, 200, run);
    return true;
  }
  const workflowTestReport = /^\/api\/v1\/workflow-test-runs\/([^/]+)\/report$/.exec(url.pathname);
  if (workflowTestReport !== null && method === 'GET') {
    denyCustomer(auth, 'workflow test lab is not available to customers');
    const run = requireWorkflow(deps).getTestRun(idFromMatch(workflowTestReport));
    if (run === undefined) throw new WorkflowError('NOT_FOUND', 'workflow test run not found');
    sendJson(res, 200, { replay: run.replay, report: run.report, status: run.status, scenario: run.scenario });
    return true;
  }
  if (url.pathname === '/api/v1/workflow-event-types' && method === 'GET') {
    sendJson(res, 200, { eventTypes: requireWorkflow(deps).listEventTypes() });
    return true;
  }
  if (url.pathname === '/api/v1/workflow-event-types' && method === 'POST') {
    denyCustomer(auth, 'workflow event types are not available to customers');
    const body = await readJsonObject(req);
    const namespace = optionalString(body, 'namespace');
    const visibility = optionalString(body, 'visibility');
    sendJson(res, 201, requireWorkflow(deps).registerEventType({
      id: requireString(body, 'id'),
      ...(namespace !== undefined ? { namespace } : {}),
      schemaRequired: optionalStringArray(body, 'schemaRequired') ?? [],
      ...(visibility !== undefined ? { visibility: visibility as never } : {}),
    }));
    return true;
  }
  if (url.pathname === '/api/v1/workflow-events' && method === 'POST') {
    denyCustomer(auth, 'workflow events are not available to customers');
    const body = await readJsonObject(req);
    const runId = optionalString(body, 'runId');
    const payload = body.payload !== null && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? Object.fromEntries(Object.entries(body.payload as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {};
    sendJson(res, 201, requireWorkflow(deps).emitCatalogEvent({
      type: requireString(body, 'type'),
      actor: auth.principal?.username ?? 'developer',
      payload,
      ...(runId !== undefined ? { runId } : {}),
    }));
    return true;
  }
  if (url.pathname === '/api/v1/workflow-node-types' && method === 'GET') {
    sendJson(res, 200, { nodeTypes: requireWorkflow(deps).listNodeTypes() });
    return true;
  }
  if (url.pathname === '/api/v1/workflow-extension-points' && method === 'GET') {
    sendJson(res, 200, { extensionPoints: requireWorkflow(deps).listExtensionPoints() });
    return true;
  }
  if (url.pathname === '/api/v1/workflow-packs/import' && method === 'POST') {
    denyCustomer(auth, 'workflow packs are not available to customers');
    const body = await readJsonObject(req);
    const version = optionalString(body, 'version');
    sendJson(res, 201, requireWorkflow(deps).importPack({
      namespace: requireString(body, 'namespace'),
      title: requireString(body, 'title'),
      ...(version !== undefined ? { version } : {}),
      requiredSkills: optionalStringArray(body, 'requiredSkills') ?? [],
      requiredTools: optionalStringArray(body, 'requiredTools') ?? [],
      templates: Array.isArray(body.templates) ? body.templates as never : [],
      eventTypes: Array.isArray(body.eventTypes) ? body.eventTypes as never : [],
      nodeTypes: Array.isArray(body.nodeTypes) ? body.nodeTypes as never : [],
      extensions: Array.isArray(body.extensions) ? body.extensions as never : [],
    }));
    return true;
  }
  const packConformance = /^\/api\/v1\/workflow-packs\/([^/]+)\/conformance$/.exec(url.pathname);
  if (packConformance !== null && method === 'POST') {
    denyCustomer(auth, 'workflow packs are not available to customers');
    sendJson(res, 201, requireWorkflow(deps).runPackConformance(idFromMatch(packConformance)));
    return true;
  }
  const packConformanceOne = /^\/api\/v1\/workflow-packs\/([^/]+)\/conformance\/([^/]+)$/.exec(url.pathname);
  if (packConformanceOne !== null && method === 'GET') {
    sendJson(res, 200, requireWorkflow(deps).getConformance(idFromMatchAt(packConformanceOne, 2)));
    return true;
  }
  const enablePack = /^\/api\/v1\/projects\/([^/]+)\/workflow-packs\/([^/]+)\/enable$/.exec(url.pathname);
  if (enablePack !== null && method === 'POST') {
    denyCustomer(auth, 'workflow packs are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(enablePack));
    sendJson(res, 200, requireWorkflow(deps).enablePack(
      project.id,
      idFromMatchAt(enablePack, 2),
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const projectWorkflow = /^\/api\/v1\/projects\/([^/]+)\/workflow$/.exec(url.pathname);
  if (projectWorkflow !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectWorkflow));
    const template = requireWorkflow(deps).selectedTemplate(project.id);
    sendJson(res, 200, { template });
    return true;
  }
  if (projectWorkflow !== null && (method === 'PATCH' || method === 'POST')) {
    denyCustomer(auth, 'workflow templates are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(projectWorkflow));
    const body = await readJsonObject(req);
    sendJson(res, method === 'POST' ? 201 : 200, requireWorkflow(deps).selectTemplate(
      project.id,
      requireString(body, 'templateId'),
    ));
    return true;
  }
  if (url.pathname === '/api/v1/harness/workflows' && method === 'POST') {
    denyCustomer(auth, 'workflow templates are not available to customers');
    const body = await readJsonObject(req);
    sendJson(res, 201, requireWorkflow(deps).cloneTemplate(
      optionalString(body, 'templateId') ?? 'huntianling.user-story',
      auth.principal?.username ?? 'developer',
    ));
    return true;
  }
  const cloneTemplate = /^\/api\/v1\/harness\/workflows\/([^/]+)\/clone$/.exec(url.pathname);
  if (cloneTemplate !== null && method === 'POST') {
    denyCustomer(auth, 'workflow templates are not available to customers');
    sendJson(res, 201, requireWorkflow(deps).cloneTemplate(idFromMatch(cloneTemplate), auth.principal?.username ?? 'developer'));
    return true;
  }
  const selectTemplate = /^\/api\/v1\/projects\/([^/]+)\/workflow-template\/select$/.exec(url.pathname);
  if (selectTemplate !== null && method === 'POST') {
    denyCustomer(auth, 'workflow templates are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(selectTemplate));
    const body = await readJsonObject(req);
    sendJson(res, 200, requireWorkflow(deps).selectTemplate(project.id, requireString(body, 'templateId')));
    return true;
  }
  const replaceTemplate = /^\/api\/v1\/projects\/([^/]+)\/workflow-template\/replace$/.exec(url.pathname);
  if (replaceTemplate !== null && method === 'POST') {
    denyCustomer(auth, 'workflow templates are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(replaceTemplate));
    const body = await readJsonObject(req);
    const workItemIds = optionalStringArray(body, 'workItemIds');
    sendJson(res, 200, requireWorkflow(deps).replaceTemplate(project.id, {
      templateId: requireString(body, 'templateId'),
      mode: requireString(body, 'mode') as never,
      actor: auth.principal?.username ?? 'developer',
      dryRun: body.dryRun === true,
      ...(workItemIds !== undefined ? { workItemIds: workItemIds as never } : {}),
    }));
    return true;
  }
  const rollbackTemplate = /^\/api\/v1\/projects\/([^/]+)\/workflow-template\/rollback$/.exec(url.pathname);
  if (rollbackTemplate !== null && method === 'POST') {
    denyCustomer(auth, 'workflow templates are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(rollbackTemplate));
    const body = await readJsonObject(req);
    const mode = optionalString(body, 'mode');
    sendJson(res, 200, requireWorkflow(deps).rollbackTemplate(project.id, {
      actor: auth.principal?.username ?? 'developer',
      ...(mode !== undefined ? { mode: mode as never } : {}),
    }));
    return true;
  }
  if (url.pathname === '/api/v1/harness/workflows/import' && method === 'POST') {
    denyCustomer(auth, 'workflow templates are not available to customers');
    const body = await readJsonObject(req);
    const clonedFrom = optionalString(body, 'clonedFrom');
    const version = optionalString(body, 'version');
    sendJson(res, 201, requireWorkflow(deps).importTemplate({
      title: requireString(body, 'title'),
      owner: auth.principal?.username ?? 'developer',
      stages: Array.isArray(body.stages) ? body.stages as never : [],
      steps: Array.isArray(body.steps) ? body.steps as never : [],
      ...(clonedFrom !== undefined ? { clonedFrom } : {}),
      ...(version !== undefined ? { version } : {}),
    }));
    return true;
  }
  const exportTemplate = /^\/api\/v1\/harness\/workflows\/([^/]+)\/export$/.exec(url.pathname);
  if (exportTemplate !== null && method === 'GET') {
    sendJson(res, 200, { template: requireWorkflow(deps).exportTemplate(idFromMatch(exportTemplate)) });
    return true;
  }
  if (url.pathname === '/api/v1/workflow-capabilities/builtin' && method === 'GET') {
    sendJson(res, 200, { capabilities: requireWorkflow(deps).listCapabilities() });
    return true;
  }
  const capabilityOne = /^\/api\/v1\/workflow-capabilities\/([^/]+)$/.exec(url.pathname);
  if (capabilityOne !== null && method === 'GET') {
    sendJson(res, 200, requireWorkflow(deps).getCapability(idFromMatch(capabilityOne)));
    return true;
  }
  const capabilityToggle = /^\/api\/v1\/projects\/([^/]+)\/workflow-capabilities\/([^/]+)\/(enable|disable)$/.exec(url.pathname);
  if (capabilityToggle !== null && method === 'POST') {
    denyCustomer(auth, 'workflow capabilities are not available to customers');
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(capabilityToggle));
    const capabilityId = idFromMatchAt(capabilityToggle, 2);
    const disabled = capabilityToggle[3] === 'disable'
      ? requireWorkflow(deps).disableCapability(project.id, capabilityId)
      : requireWorkflow(deps).enableCapability(project.id, capabilityId);
    sendJson(res, 200, { disabledCapabilityIds: disabled });
    return true;
  }
  const roleEvents = /^\/api\/v1\/workflow-runs\/([^/]+)\/role-events$/.exec(url.pathname);
  if (roleEvents !== null && method === 'GET') {
    sendJson(res, 200, { events: requireWorkflow(deps).listRoleEvents(idFromMatch(roleEvents)) });
    return true;
  }
  const runEvents = /^\/api\/v1\/workflow-runs\/([^/]+)\/events$/.exec(url.pathname);
  if (runEvents !== null && method === 'POST') {
    denyCustomer(auth, 'workflow runs are not available to customers');
    const body = await readJsonObject(req);
    const actorRole = optionalString(body, 'actorRole');
    sendJson(res, 200, requireWorkflow(deps).emitStepEvent(idFromMatch(runEvents), {
      type: requireString(body, 'type'),
      actor: auth.principal?.username ?? 'developer',
      ...(actorRole !== undefined ? { actorRole } : {}),
    }));
    return true;
  }
  if (runEvents !== null && method === 'GET') {
    const runId = idFromMatch(runEvents);
    sendJson(res, 200, {
      events: requireWorkflow(deps).listRoleEvents(runId),
      rejections: requireWorkflow(deps).listRejections(runId),
    });
    return true;
  }
  const stateTransitions = /^\/api\/v1\/workflow-runs\/([^/]+)\/state-transitions$/.exec(url.pathname);
  if (stateTransitions !== null && method === 'GET') {
    sendJson(res, 200, { rejections: requireWorkflow(deps).listRejections(idFromMatch(stateTransitions)) });
    return true;
  }
  const runHandoffs = /^\/api\/v1\/workflow-runs\/([^/]+)\/handoffs$/.exec(url.pathname);
  if (runHandoffs !== null && method === 'POST') {
    denyCustomer(auth, 'workflow handoffs are not available to customers');
    const body = await readJsonObject(req);
    const stepId = optionalString(body, 'stepId');
    sendJson(res, 201, requireWorkflow(deps).requestHandoff(idFromMatch(runHandoffs), {
      actor: auth.principal?.username ?? 'developer',
      fromRole: optionalString(body, 'fromRole') ?? 'developer',
      toOwner: requireString(body, 'toOwner'),
      toRole: requireString(body, 'toRole'),
      reason: requireString(body, 'reason'),
      ...(stepId !== undefined ? { stepId } : {}),
    }));
    return true;
  }
  const handoffDecide = /^\/api\/v1\/workflow-handoffs\/([^/]+)\/(accept|reject)$/.exec(url.pathname);
  if (handoffDecide !== null && method === 'POST') {
    denyCustomer(auth, 'workflow handoffs are not available to customers');
    const body = await readJsonObject(req);
    const input = {
      actor: auth.principal?.username ?? 'developer',
      actorRole: optionalString(body, 'actorRole') ?? 'developer',
      reason: optionalString(body, 'reason') ?? (handoffDecide[2] ?? 'decided'),
    };
    sendJson(
      res,
      200,
      handoffDecide[2] === 'accept'
        ? requireWorkflow(deps).acceptHandoff(idFromMatch(handoffDecide), input)
        : requireWorkflow(deps).rejectHandoff(idFromMatch(handoffDecide), input),
    );
    return true;
  }
  if (url.pathname === '/api/v1/review-requests' && method === 'POST') {
    denyCustomer(auth, 'reviews are not available to customers');
    const body = await readJsonObject(req);
    const item = authorizeWorkItem(deps, auth, requireString(body, 'workItemId') as WorkItemId);
    const runId = optionalString(body, 'runId');
    const stepId = optionalString(body, 'stepId');
    sendJson(res, 201, requireWorkflow(deps).createReview({
      workItemId: item.id,
      requester: auth.principal?.username ?? 'developer',
      requesterRole: optionalString(body, 'requesterRole') ?? 'developer',
      requiredReviewerRoles: optionalStringArray(body, 'requiredReviewerRoles') ?? ['developer'],
      reason: requireString(body, 'reason'),
      ...(runId !== undefined ? { runId } : {}),
      ...(stepId !== undefined ? { stepId } : {}),
    }));
    return true;
  }
  if (url.pathname === '/api/v1/review-requests' && method === 'GET') {
    const projectId = url.searchParams.get('projectId');
    if (projectId === null || projectId.trim() === '') throw new WorkflowError('VALIDATION', 'projectId is required');
    authorizeProject(deps, auth, projectId as ProjectId);
    sendJson(res, 200, { reviews: requireWorkflow(deps).listReviews(projectId as ProjectId) });
    return true;
  }
  const completeReview = /^\/api\/v1\/review-requests\/([^/]+)\/complete$/.exec(url.pathname);
  if (completeReview !== null && method === 'POST') {
    denyCustomer(auth, 'reviews are not available to customers');
    const body = await readJsonObject(req);
    sendJson(res, 200, requireWorkflow(deps).completeReview(idFromMatch(completeReview), {
      actor: auth.principal?.username ?? 'developer',
      actorRole: optionalString(body, 'actorRole') ?? 'developer',
      reason: optionalString(body, 'reason') ?? 'completed',
    }));
    return true;
  }
  const workflowRollups = /^\/api\/v1\/projects\/([^/]+)\/workflow-rollups$/.exec(url.pathname);
  if (workflowRollups !== null && method === 'GET') {
    const project = authorizeProject(deps, auth, idFromMatch<ProjectId>(workflowRollups));
    sendJson(res, 200, requireWorkflow(deps).projectRollups(project.id));
    return true;
  }
  return false;
}

async function handleTeamApi(
  collab: CollabService,
  deps: WebServiceDependencies,
  auth: RequestAuth,
  method: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (url.pathname === '/api/v1/team/conversations' && method === 'POST') {
    const body = await readJsonObject(req);
    const project = authorizeProject(deps, auth, requireString(body, 'projectId') as ProjectId);
    sendJson(res, 201, collab.createConversation({
      projectId: project.id,
      title: optionalString(body, 'title') ?? 'Agent Channel',
    }));
    return;
  }
  if (url.pathname === '/api/v1/team/conversations' && method === 'GET') {
    const projectId = url.searchParams.get('projectId');
    if (projectId === null || projectId.trim() === '') {
      throw new ChannelWriteError('VALIDATION', 'projectId is required');
    }
    authorizeProject(deps, auth, projectId as ProjectId);
    sendJson(res, 200, { conversations: collab.listConversations(projectId as ProjectId) });
    return;
  }
  const conversation = /^\/api\/v1\/team\/conversations\/([^/]+)$/.exec(url.pathname);
  if (conversation !== null && method === 'GET') {
    const found = collab.getConversation(conversation[1] ?? '');
    if (found === undefined) throw new ChannelWriteError('NOT_FOUND', 'conversation not found');
    authorizeProject(deps, auth, found.projectId);
    sendJson(res, 200, {
      conversation: found,
      messages: collab.listMessages(found.id),
      tasks: collab.listTasks(found.id),
      events: collab.listEvents(found.id),
      decisions: collab.listDecisions(found.projectId).filter((item) => item.conversationId === found.id),
      approvals: collab.listApprovals({ projectId: found.projectId }).filter((item) => item.conversationId === found.id),
      unresolvedQuestions: collab.listUnresolvedQuestions(found.projectId).filter((item) => item.conversationId === found.id),
    });
    return;
  }
  const conversationMessages = /^\/api\/v1\/team\/conversations\/([^/]+)\/messages$/.exec(url.pathname);
  if (conversationMessages !== null && method === 'POST') {
    const found = collab.getConversation(conversationMessages[1] ?? '');
    if (found === undefined) throw new ChannelWriteError('NOT_FOUND', 'conversation not found');
    authorizeProject(deps, auth, found.projectId);
    const body = await readJsonObject(req);
    const fromBody = asObject(body.from);
    sendJson(res, 201, collab.postMessage(found.id, {
      type: body.type,
      from: {
        kind: fromBody.kind === 'agent' || fromBody.kind === 'system' ? fromBody.kind : 'human',
        role: typeof fromBody.role === 'string' ? fromBody.role : 'developer',
      },
      payload: asObject(body.payload ?? {}),
      ...(typeof body.inReplyTo === 'string' ? { inReplyTo: body.inReplyTo } : {}),
      ...(typeof body.refs === 'object' && body.refs !== null && !Array.isArray(body.refs)
        ? { refs: body.refs as ChannelMessageRefs }
        : {}),
    }));
    return;
  }
  const conversationTasks = /^\/api\/v1\/team\/conversations\/([^/]+)\/tasks$/.exec(url.pathname);
  if (conversationTasks !== null && method === 'GET') {
    const found = collab.getConversation(conversationTasks[1] ?? '');
    if (found === undefined) throw new ChannelWriteError('NOT_FOUND', 'conversation not found');
    authorizeProject(deps, auth, found.projectId);
    sendJson(res, 200, { tasks: collab.listTasks(found.id) });
    return;
  }
  if (conversationTasks !== null && method === 'POST') {
    const found = collab.getConversation(conversationTasks[1] ?? '');
    if (found === undefined) throw new ChannelWriteError('NOT_FOUND', 'conversation not found');
    authorizeProject(deps, auth, found.projectId);
    const body = await readJsonObject(req);
    const refs = channelRefsFromBody(body);
    sendJson(res, 201, collab.postMessage(found.id, {
      type: 'task.propose',
      from: channelActorFromBody(body),
      payload: asObject(body.payload ?? body),
      ...(refs !== undefined ? { refs } : {}),
    }));
    return;
  }

  const conversationDecisions = /^\/api\/v1\/team\/conversations\/([^/]+)\/decisions$/.exec(url.pathname);
  if (conversationDecisions !== null && method === 'POST') {
    const found = collab.getConversation(conversationDecisions[1] ?? '');
    if (found === undefined) throw new ChannelWriteError('NOT_FOUND', 'conversation not found');
    authorizeProject(deps, auth, found.projectId);
    const body = await readJsonObject(req);
    const refs = channelRefsFromBody(body);
    sendJson(res, 201, collab.postMessage(found.id, {
      type: 'decision.record',
      from: channelActorFromBody(body),
      payload: asObject(body.payload ?? body),
      ...(refs !== undefined ? { refs } : {}),
    }));
    return;
  }

  const conversationApprovals = /^\/api\/v1\/team\/conversations\/([^/]+)\/approvals$/.exec(url.pathname);
  if (conversationApprovals !== null && method === 'POST') {
    const found = collab.getConversation(conversationApprovals[1] ?? '');
    if (found === undefined) throw new ChannelWriteError('NOT_FOUND', 'conversation not found');
    authorizeProject(deps, auth, found.projectId);
    const body = await readJsonObject(req);
    const payload = asObject(body.payload ?? body);
    const status = optionalString(payload, 'status') ?? optionalString(body, 'status') ?? 'requested';
    const type = status === 'granted' ? 'approval.granted' : status === 'rejected' ? 'approval.rejected' : 'approval.request';
    const refs = channelRefsFromBody(body);
    sendJson(res, 201, collab.postMessage(found.id, {
      type,
      from: channelActorFromBody(body),
      payload,
      ...(refs !== undefined ? { refs } : {}),
    }));
    return;
  }

  const collabTask = /^\/api\/v1\/agent-collaboration-tasks\/([^/]+)$/.exec(url.pathname);
  if (collabTask !== null && method === 'GET') {
    const task = collab.getTask(idFromMatch(collabTask));
    if (task === undefined) throw new ChannelWriteError('NOT_FOUND', 'collaboration task not found');
    authorizeProject(deps, auth, task.projectId);
    sendJson(res, 200, task);
    return;
  }
  if (collabTask !== null && method === 'PATCH') {
    const task = collab.getTask(idFromMatch(collabTask));
    if (task === undefined) throw new ChannelWriteError('NOT_FOUND', 'collaboration task not found');
    authorizeProject(deps, auth, task.projectId);
    const body = await readJsonObject(req);
    const priority = optionalString(body, 'priority');
    const assignee = optionalString(body, 'assignee');
    const dueMilestoneId = optionalString(body, 'dueMilestoneId');
    const dueDate = optionalNumber(body, 'dueDate');
    sendJson(res, 200, collab.updateTaskFields(task.id, {
      ...(priority !== undefined ? { priority } : {}),
      ...(assignee !== undefined ? { assignee } : {}),
      ...(dueMilestoneId !== undefined ? { dueMilestoneId } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
    }));
    return;
  }

  const collabTaskMessages = /^\/api\/v1\/agent-collaboration-tasks\/([^/]+)\/messages$/.exec(url.pathname);
  if (collabTaskMessages !== null && method === 'POST') {
    const task = collab.getTask(idFromMatch(collabTaskMessages));
    if (task === undefined) throw new ChannelWriteError('NOT_FOUND', 'collaboration task not found');
    authorizeProject(deps, auth, task.projectId);
    const body = await readJsonObject(req);
    sendJson(res, 201, collab.postMessage(task.conversationId, {
      type: body.type,
      from: channelActorFromBody(body),
      payload: { ...asObject(body.payload ?? {}), taskId: task.id },
    }));
    return;
  }

  const collabTaskTransfer = /^\/api\/v1\/agent-collaboration-tasks\/([^/]+)\/transfer$/.exec(url.pathname);
  if (collabTaskTransfer !== null && method === 'POST') {
    const task = collab.getTask(idFromMatch(collabTaskTransfer));
    if (task === undefined) throw new ChannelWriteError('NOT_FOUND', 'collaboration task not found');
    authorizeProject(deps, auth, task.projectId);
    const body = await readJsonObject(req);
    sendJson(res, 201, collab.postMessage(task.conversationId, {
      type: 'task.transfer',
      from: channelActorFromBody(body),
      payload: { ...asObject(body), taskId: task.id },
    }));
    return;
  }

  const collabTaskComplete = /^\/api\/v1\/agent-collaboration-tasks\/([^/]+)\/complete$/.exec(url.pathname);
  if (collabTaskComplete !== null && method === 'POST') {
    const task = collab.getTask(idFromMatch(collabTaskComplete));
    if (task === undefined) throw new ChannelWriteError('NOT_FOUND', 'collaboration task not found');
    authorizeProject(deps, auth, task.projectId);
    const body = await readJsonObject(req);
    sendJson(res, 201, collab.postMessage(task.conversationId, {
      type: 'task.complete',
      from: channelActorFromBody(body),
      payload: { taskId: task.id },
    }));
    return;
  }
  sendJson(res, 404, { error: 'not found' });
}

function channelActorFromBody(body: Record<string, unknown>): ChannelMessage['from'] {
  const fromBody = asObject(body.from);
  return {
    kind: fromBody.kind === 'agent' || fromBody.kind === 'system' ? fromBody.kind : 'human',
    role: typeof fromBody.role === 'string' ? fromBody.role : 'developer',
  };
}

function channelRefsFromBody(body: Record<string, unknown>): ChannelMessageRefs | undefined {
  if (typeof body.refs !== 'object' || body.refs === null || Array.isArray(body.refs)) return undefined;
  return body.refs as ChannelMessageRefs;
}

type ChannelMessageRefs = {
  readonly workItemId?: import('../board/types.js').WorkItemId;
  readonly milestoneId?: string;
  readonly taskId?: string;
  readonly branchId?: string;
  readonly pullRequestId?: string;
  readonly ciRunId?: string;
  readonly sourceDocumentId?: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function nonBlank(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function trimTrailingSlash(value: string | null): string | null {
  if (value === null) return null;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function parsePort(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const port = Number(value);
  if (!Number.isInteger(port)) throw new Error(`invalid web port: ${value}`);
  return port;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  throw new Error(`invalid boolean value: ${value}`);
}

function handleHtmlShell(
  config: ResolvedWebConfig,
  authManager: WebAuthManager,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): void {
  const session = authManager.currentSession(req);
  if (!config.auth.enabled) {
    if (pathname === '/' || pathname === '/board') {
      sendHtml(res, renderBoardPage());
      return;
    }
    if (audienceFromShellPath(pathname) === 'developer') {
      sendHtml(res, pathname === '/developer/workflow-lab' ? renderWorkflowLabPage() : renderDeveloperPage());
      return;
    }
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  if (pathname === '/login') {
    if (session !== null) {
      sendRedirect(res, shellPathForAudience(session.user.audience));
      return;
    }
    sendHtml(res, renderLoginPage());
    return;
  }

  if (session === null) {
    if (pathname === '/' || audienceFromShellPath(pathname) !== null) {
      sendRedirect(res, '/login');
      return;
    }
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  if (pathname === '/') {
    sendRedirect(res, shellPathForAudience(session.user.audience));
    return;
  }

  const wanted = audienceFromShellPath(pathname);
  if (wanted === null) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }
  if (wanted !== session.user.audience) {
    sendHtml(res, renderAudienceDeniedPage(session.user.audience), 403);
    return;
  }
  if (wanted === 'developer') {
    if (pathname === '/board') {
      sendHtml(res, renderBoardPage());
      return;
    }
    if (pathname === '/developer/workflow-lab') {
      sendHtml(res, renderWorkflowLabPage());
      return;
    }
    sendHtml(res, renderDeveloperPage());
    return;
  }
  if (wanted === 'customer') {
    sendHtml(res, renderCustomerPage());
    return;
  }
  if (wanted === 'admin') {
    sendHtml(res, renderAdminPage());
    return;
  }
  sendHtml(res, renderAudienceShellPage(wanted));
}

function sendRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, {
    location,
    'cache-control': 'no-store',
  });
  res.end();
}

function sendHtml(res: ServerResponse, body: string, statusCode = 200): void {
  res.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sendBytes(
  res: ServerResponse,
  statusCode: number,
  mimeType: string,
  body: Uint8Array,
): void {
  res.writeHead(statusCode, {
    'content-type': mimeType,
    'cache-control': 'no-store',
    'content-length': String(body.byteLength),
  });
  res.end(Buffer.from(body));
}

function requireDatabase(deps: WebServiceDependencies): DatabaseService {
  if (deps.database === undefined) {
    throw new DatabaseError('INVALID_CONFIG', 'huntianling.database is required');
  }
  return deps.database;
}

function decodeBase64Bytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function sendEmpty(res: ServerResponse, statusCode: number): void {
  res.writeHead(statusCode, {
    'cache-control': 'no-store',
  });
  res.end();
}
