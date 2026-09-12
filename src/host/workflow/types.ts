/**
 * Workflow templates, runs, stage gates, approvals, and scheduler records.
 */

import type { ProjectId, WorkItemId, WorkItemStatus } from '../board/types.js';

export const WORKFLOW_TEMPLATE_STATES = ['draft', 'review', 'published', 'deprecated', 'archived'] as const;
export type WorkflowTemplateState = (typeof WORKFLOW_TEMPLATE_STATES)[number];

export const WORKFLOW_STEP_KINDS = [
  'sequential',
  'parallel',
  'exclusive',
  'review-only',
  'approval-required',
  'manual-only',
  'recurring',
  'event-triggered',
] as const;
export type WorkflowStepKind = (typeof WORKFLOW_STEP_KINDS)[number];

export const TEMPLATE_REPLACE_MODES = ['future', 'selected', 'migrate-active'] as const;
export type TemplateReplaceMode = (typeof TEMPLATE_REPLACE_MODES)[number];

export const REVIEW_REQUEST_STATUSES = ['pending', 'completed', 'cancelled'] as const;
export type ReviewRequestStatus = (typeof REVIEW_REQUEST_STATUSES)[number];

export const HANDOFF_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const WORKFLOW_STEP_STATUSES = [
  'pending',
  'ready',
  'queued',
  'scheduled',
  'running',
  'waiting_for_input',
  'waiting_for_approval',
  'blocked',
  'retrying',
  'completed',
  'failed',
  'skipped',
  'cancelled',
] as const;
export type WorkflowStepStatus = (typeof WORKFLOW_STEP_STATUSES)[number];

export const WORKFLOW_RUN_STATUSES = [
  'planned',
  'running',
  'paused',
  'blocked',
  'waiting_for_approval',
  'completed',
  'cancelled',
  'failed',
] as const;
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];

export const APPROVAL_KINDS = [
  'requirement_acceptance',
  'scope_change',
  'risk_acceptance',
  'code_push',
  'pull_request',
  'merge',
  'release',
  'production_deploy',
  'compliance_exception',
  'security_exception',
] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'revision_requested',
  'delegated',
  'expired',
  'cancelled',
] as const;
export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];

export const ROLE_EVENT_TYPES = [
  'approval.requested',
  'approval.assigned',
  'approval.approved',
  'approval.rejected',
  'approval.revision_requested',
  'approval.delegated',
  'approval.expired',
  'approval.cancelled',
  'approval.escalated',
  'review.requested',
  'review.assigned',
  'review.started',
  'review.commented',
  'review.approved',
  'review.changes_requested',
  'review.rejected',
  'review.completed',
  'review.cancelled',
  'handoff.requested',
  'handoff.accepted',
  'handoff.rejected',
] as const;
export type RoleEventType = (typeof ROLE_EVENT_TYPES)[number];

export type WorkflowErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'TRANSITION'
  | 'BUILTIN'
  | 'APPROVAL'
  | 'AUTHORITY'
  | 'NOT_READY';

export class WorkflowError extends Error {
  constructor(
    readonly code: WorkflowErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface WorkflowCapabilityFixture {
  readonly id: string;
  readonly scenario: string;
  readonly input: Readonly<Record<string, string>>;
  readonly expected: Readonly<Record<string, string>>;
}

export interface WorkflowCapability {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly builtin: boolean;
  readonly area: string;
  readonly documentation: string;
  readonly fixtures: readonly WorkflowCapabilityFixture[];
  readonly conformance: {
    readonly schema: string;
    readonly result: 'pass' | 'pending';
  };
}

export interface WorkflowStage {
  readonly id: string;
  readonly title: string;
  readonly status: WorkItemStatus;
  readonly requiredFields: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredReviews: readonly string[];
  readonly requiredApprovals: readonly ApprovalKind[];
}

export interface WorkflowTemplateStep {
  readonly id: string;
  readonly title: string;
  readonly kind: WorkflowStepKind;
  readonly role: string;
  readonly capabilityId: string;
  readonly requiredSkills: readonly string[];
  readonly allowedTools: readonly string[];
  readonly checks: readonly string[];
  readonly dependsOn: readonly string[];
  readonly approvalKind: ApprovalKind | null;
  readonly targetStatus: WorkItemStatus | null;
  readonly triggerEvent: string | null;
  readonly intervalMs: number | null;
}

export interface WorkflowTemplate {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly state: WorkflowTemplateState;
  readonly builtin: boolean;
  readonly owner: string;
  readonly clonedFrom: string | null;
  readonly stages: readonly WorkflowStage[];
  readonly steps: readonly WorkflowTemplateStep[];
}

export const WORKFLOW_CANVAS_NODE_KINDS = [
  'stage',
  'agent-step',
  'human-step',
  'gate',
  'approval',
  'handoff',
  'failure',
] as const;
export type WorkflowCanvasNodeKind = (typeof WORKFLOW_CANVAS_NODE_KINDS)[number];

export interface WorkflowCanvasNodeMapping {
  readonly runtimeStage: string | null;
  readonly runStep: string | null;
  readonly boardStatus: string | null;
  readonly teamChatEvent: string | null;
  readonly evidence: string | null;
}

export interface WorkflowCanvasNode {
  readonly id: string;
  readonly kind: WorkflowCanvasNodeKind;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly stepId: string | null;
  readonly stageId: string | null;
  readonly role: string;
  readonly requiredSkills: readonly string[];
  readonly allowedTools: readonly string[];
  readonly checks: readonly string[];
  readonly dependsOn: readonly string[];
  readonly approvalKind: ApprovalKind | null;
  readonly mapping: WorkflowCanvasNodeMapping;
}

export interface WorkflowCanvasEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'depends' | 'transition' | 'failure';
}

export interface WorkflowCanvas {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly nodes: readonly WorkflowCanvasNode[];
  readonly edges: readonly WorkflowCanvasEdge[];
}

export interface TemplateValidationIssue {
  readonly nodeId: string | null;
  readonly code: string;
  readonly message: string;
}

export interface TemplateValidation {
  readonly ok: boolean;
  readonly issues: readonly TemplateValidationIssue[];
}

export const WORKFLOW_TEST_SCENARIOS = [
  'happy-path',
  'missing-approval',
  'resource-conflict',
  'stale-state',
  'missing-evidence',
  'custom-node',
] as const;
export type WorkflowTestScenario = (typeof WORKFLOW_TEST_SCENARIOS)[number];

export interface WorkflowTestAssertion {
  readonly kind: string;
  readonly expected: string;
}

export interface WorkflowTestCase {
  readonly id: string;
  readonly templateId: string;
  readonly title: string;
  readonly scenario: WorkflowTestScenario;
  readonly assertions: readonly WorkflowTestAssertion[];
  readonly createdAt: number;
}

export interface WorkflowTestReplayFrame {
  readonly stepId: string;
  readonly title: string;
  readonly status: string;
  readonly allowed: boolean;
  readonly nextSafeAction: string;
  readonly reason: string;
}

export interface WorkflowTestReport {
  readonly passed: readonly string[];
  readonly failed: readonly string[];
  readonly evidence: string;
}

export interface WorkflowTestRun {
  readonly id: string;
  readonly templateId: string;
  readonly testCaseId: string;
  readonly scenario: WorkflowTestScenario;
  readonly status: 'passed' | 'failed';
  readonly replay: readonly WorkflowTestReplayFrame[];
  readonly report: WorkflowTestReport;
  readonly createdAt: number;
  readonly templateVersion: string;
  readonly packVersion: string | null;
  readonly fixtureVersion: string;
  readonly schedulerVersion: string;
  readonly conformanceRunId: string | null;
}

export const VISUALIZATION_LAYER_IDS = [
  'lifecycle',
  'agents',
  'skills',
  'tools',
  'events',
  'gates',
  'approvals',
  'evidence',
  'inputs',
  'documents',
  'compliance',
  'risk',
] as const;
export type VisualizationLayerId = (typeof VISUALIZATION_LAYER_IDS)[number];

export interface VisualizationLane {
  readonly id: string;
  readonly title: string;
}

export interface VisualizationNode {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly lane: string;
  readonly x: number;
  readonly y: number;
  readonly stepId: string | null;
  readonly inspector: VisualizationInspector;
}

export interface VisualizationInspector {
  readonly description: string;
  readonly role: string;
  readonly skills: readonly string[];
  readonly tools: readonly string[];
  readonly checks: readonly string[];
  readonly evidence: string | null;
  readonly approvalKind: string | null;
  readonly targetStatus: string | null;
}

export interface VisualizationEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
}

export interface VisualizationPresentation {
  readonly kind: 'stage-swimlane' | 'role-swimlane' | 'dependency-graph' | 'outline';
  readonly lanes: readonly VisualizationLane[];
  readonly nodes: readonly VisualizationNode[];
  readonly edges: readonly VisualizationEdge[];
}

export interface VisualizationLayer {
  readonly id: VisualizationLayerId;
  readonly title: string;
  readonly nodeIds: readonly string[];
}

export interface VisualizationBadge {
  readonly nodeId: string;
  readonly code: string;
  readonly message: string;
}

export interface WorkflowVisualization {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly presentations: {
    readonly stageSwimlane: VisualizationPresentation;
    readonly roleSwimlane: VisualizationPresentation;
    readonly dependencyGraph: VisualizationPresentation;
    readonly outline: VisualizationPresentation;
  };
  readonly layers: readonly VisualizationLayer[];
  readonly badges: readonly VisualizationBadge[];
}

export interface TemplateVersionSnapshot {
  readonly templateId: string;
  readonly version: string;
  readonly title: string;
  readonly stages: WorkflowTemplate['stages'];
  readonly steps: readonly WorkflowTemplateStep[];
  readonly recordedAt: number;
}

export interface TemplateVersionDiff {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
  readonly risky: readonly string[];
}

export interface TestReplayView {
  readonly testRunId: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly packVersion: string | null;
  readonly fixtureVersion: string;
  readonly schedulerVersion: string;
  readonly conformanceRunId: string | null;
  readonly scenario: WorkflowTestScenario;
  readonly status: 'passed' | 'failed';
  readonly map: VisualizationPresentation;
  readonly frames: readonly WorkflowTestReplayFrame[];
  readonly assertions: WorkflowTestReport;
  readonly highlights: readonly { readonly nodeId: string; readonly kind: 'actual' | 'blocked' }[];
}

export interface VisualizationExport {
  readonly format: 'markdown' | 'dsl' | 'svg';
  readonly body: string;
  readonly templateId: string;
  readonly templateVersion: string;
}

export const WORKFLOW_EVENT_VISIBILITIES = ['runtime', 'team-chat', 'board', 'audit'] as const;
export type WorkflowEventVisibility = (typeof WORKFLOW_EVENT_VISIBILITIES)[number];

export const WORKFLOW_EXTENSION_POINTS = [
  'template-validation',
  'plan-generation',
  'dispatch-recommendation',
  'step-start',
  'step-completion',
  'gate-evaluation',
  'evidence-ingestion',
  'approval-request',
  'event-emission',
  'failure-handling',
  'report-generation',
] as const;
export type WorkflowExtensionPoint = (typeof WORKFLOW_EXTENSION_POINTS)[number];

export const UNSAFE_WORKFLOW_PERMISSIONS = [
  'bypass-gate',
  'bypass-approval',
  'bypass-lease',
  'bypass-audit',
  'bypass-evidence',
] as const;

export interface WorkflowEventType {
  readonly id: string;
  readonly origin: 'system' | 'custom';
  readonly version: string;
  readonly namespace: string;
  readonly packId: string | null;
  readonly schema: { readonly required: readonly string[] };
  readonly producerRoles: readonly string[];
  readonly targetRoles: readonly string[];
  readonly requiredDecisionRoles: readonly string[];
  readonly allowedConsumers: readonly string[];
  readonly visibility: WorkflowEventVisibility;
  readonly retention: string;
  readonly redaction: string;
  readonly audit: boolean;
}

export interface WorkflowCatalogEvent {
  readonly id: string;
  readonly type: string;
  readonly version: string;
  readonly runId: string | null;
  readonly payload: Readonly<Record<string, string>>;
  readonly actor: string;
  readonly createdAt: number;
}

export interface WorkflowNodeType {
  readonly id: string;
  readonly origin: 'system' | 'custom';
  readonly version: string;
  readonly namespace: string;
  readonly packId: string | null;
  readonly title: string;
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly formSchema: string;
  readonly requiredCapabilities: readonly string[];
  readonly requiredPermissions: readonly string[];
  readonly supportedEvents: readonly string[];
  readonly testFixture: {
    readonly status: string;
    readonly nextSafeAction: string;
    readonly reason: string;
  } | null;
}

export interface WorkflowExtensionPackage {
  readonly id: string;
  readonly version: string;
  readonly packId: string | null;
  readonly point: WorkflowExtensionPoint;
  readonly order: number;
  readonly scope: string;
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly sideEffects: readonly string[];
  readonly requiredPermissions: readonly string[];
  readonly timeoutMs: number;
  readonly retryPolicy: string;
  readonly idempotent: boolean;
  readonly testCases: readonly string[];
}

export interface WorkflowPack {
  readonly id: string;
  readonly version: string;
  readonly namespace: string;
  readonly title: string;
  readonly supportedWorkItemTypes: readonly string[];
  readonly requiredAgents: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly requiredTools: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly approvalPoints: readonly string[];
  readonly unsupportedScenarios: readonly string[];
  readonly templateIds: readonly string[];
  readonly eventTypeIds: readonly string[];
  readonly nodeTypeIds: readonly string[];
  readonly extensionIds: readonly string[];
  readonly createdAt: number;
}

export interface ConformanceCheck {
  readonly code: string;
  readonly result: 'pass' | 'fail' | 'warning';
  readonly message: string;
}

export interface ConformanceReport {
  readonly id: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly status: 'passed' | 'failed';
  readonly checks: readonly ConformanceCheck[];
  readonly createdAt: number;
}

export interface EnabledWorkflowPack {
  readonly projectId: ProjectId;
  readonly packId: string;
  readonly packVersion: string;
  readonly enabledAt: number;
}

export interface WorkflowPlanStep {
  readonly id: string;
  readonly templateStepId: string;
  readonly title: string;
  readonly kind: WorkflowStepKind;
  readonly role: string;
  readonly capabilityId: string;
  readonly requiredSkills: readonly string[];
  readonly allowedTools: readonly string[];
  readonly checks: readonly string[];
  readonly dependsOn: readonly string[];
  readonly approvalKind: ApprovalKind | null;
  readonly targetStatus: WorkItemStatus | null;
  readonly status: WorkflowStepStatus;
  readonly owner: string;
  readonly collaborationTaskId: string | null;
  readonly approvalId: string | null;
  readonly reason: string;
  readonly triggerEvent: string | null;
  readonly intervalMs: number | null;
  readonly occurrence: number;
  readonly lastCompletedAt: number | null;
  readonly lastRecognition: StepStateRecognition | null;
}

export interface WorkflowStateSnapshot {
  readonly workItemId: WorkItemId;
  readonly workItemStatus: string;
  readonly designRevision: string;
  readonly workflowRunStatus: WorkflowRunStatus;
  readonly stepStatus: WorkflowStepStatus | null;
  readonly collaborationTaskStatus: string | null;
  readonly channelMessageCount: number;
  readonly milestoneId: string | null;
  readonly pendingApprovalKinds: readonly string[];
  readonly leaseOwners: readonly string[];
  readonly branchOwners: readonly string[];
  readonly ciStatus: string | null;
  readonly evidenceReady: boolean;
  readonly blockers: readonly string[];
  readonly recognizedAt: number;
}

export interface StepStateRecognition {
  readonly id: string;
  readonly runId: string;
  readonly stepId: string;
  readonly actor: string;
  readonly snapshot: WorkflowStateSnapshot;
  readonly allowed: boolean;
  readonly allowedActions: readonly string[];
  readonly blockedActions: readonly string[];
  readonly requiredInputs: readonly string[];
  readonly missingApprovals: readonly string[];
  readonly missingSkills: readonly string[];
  readonly unavailableTools: readonly string[];
  readonly heldResources: readonly string[];
  readonly nextSafeAction: string;
  readonly stale: boolean;
  readonly incomplete: boolean;
  readonly contradictory: boolean;
  readonly outsideBoundary: boolean;
  readonly reason: string;
  readonly createdAt: number;
}

export interface WorkflowRun {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly status: WorkflowRunStatus;
  readonly owner: string;
  readonly steps: readonly WorkflowPlanStep[];
  readonly nextAction: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface SchedulerDecision {
  readonly id: string;
  readonly runId: string;
  readonly stepId: string;
  readonly at: number;
  readonly fromStatus: WorkflowStepStatus;
  readonly toStatus: WorkflowStepStatus;
  readonly reason: string;
}

export interface WorkflowTimelineEvent {
  readonly id: string;
  readonly runId: string;
  readonly stepId: string | null;
  readonly at: number;
  readonly kind: string;
  readonly message: string;
}

export interface ApprovalRequest {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly runId: string | null;
  readonly stepId: string | null;
  readonly kind: ApprovalKind;
  readonly requester: string;
  readonly requesterRole: string;
  readonly requiredApproverRoles: readonly string[];
  readonly allowedDecisionRoles: readonly string[];
  readonly quorum: number;
  readonly status: ApprovalRequestStatus;
  readonly reason: string;
  readonly decidedBy: string | null;
  readonly decidedRole: string | null;
  readonly decidedReason: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface RoleScopedEvent {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly runId: string | null;
  readonly stepId: string | null;
  readonly type: RoleEventType;
  readonly actor: string;
  readonly actorRole: string;
  readonly targetRole: string;
  readonly approvalId: string | null;
  readonly reason: string;
  readonly createdAt: number;
  readonly correlationId: string;
}

export interface GateMissingItem {
  readonly kind: 'field' | 'evidence' | 'approval' | 'review' | 'gate' | 'lifecycle';
  readonly code: string;
  readonly message: string;
}

export interface GateInspection {
  readonly workItemId: WorkItemId;
  readonly from: WorkItemStatus;
  readonly to: WorkItemStatus;
  readonly allowed: boolean;
  readonly missing: readonly GateMissingItem[];
  readonly stages: readonly WorkflowStage[];
}

export interface ProjectWorkflowSelection {
  readonly projectId: ProjectId;
  readonly templateId: string;
  readonly disabledCapabilityIds: readonly string[];
  readonly previousTemplateId: string | null;
  readonly lastReplaceMode: TemplateReplaceMode | null;
}

export interface TemplateReplacePreview {
  readonly fromTemplateId: string;
  readonly fromVersion: string;
  readonly toTemplateId: string;
  readonly toVersion: string;
  readonly changedStages: readonly string[];
  readonly addedSteps: readonly string[];
  readonly removedSteps: readonly string[];
  readonly changedSteps: readonly string[];
  readonly changedGates: readonly string[];
  readonly changedApprovals: readonly string[];
  readonly changedBindings: readonly string[];
  readonly activeRunIds: readonly string[];
  readonly impact: string;
}

export interface TemplateReplaceResult {
  readonly template: WorkflowTemplate;
  readonly preview: TemplateReplacePreview;
  readonly migratedRunIds: readonly string[];
  readonly dryRun: boolean;
}

export interface ReviewRequest {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly runId: string | null;
  readonly stepId: string | null;
  readonly requester: string;
  readonly requesterRole: string;
  readonly requiredReviewerRoles: readonly string[];
  readonly status: ReviewRequestStatus;
  readonly reason: string;
  readonly completedBy: string | null;
  readonly completedRole: string | null;
  readonly completedReason: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface WorkflowHandoff {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly runId: string;
  readonly stepId: string | null;
  readonly fromOwner: string;
  readonly fromRole: string;
  readonly toOwner: string;
  readonly toRole: string;
  readonly status: HandoffStatus;
  readonly reason: string;
  readonly decidedBy: string | null;
  readonly decidedReason: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface TransitionRejection {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId | null;
  readonly runId: string;
  readonly stepId: string | null;
  readonly at: number;
  readonly actor: string;
  readonly actorRole: string;
  readonly eventType: string;
  readonly reason: string;
  readonly currentState: string;
}

export interface OverloadedRoleRollup {
  readonly role: string;
  readonly activeSteps: number;
  readonly memberCount: number;
  readonly capacity: number;
  readonly overloaded: boolean;
}

export interface ReleaseReadinessRollup {
  readonly ready: boolean;
  readonly openRuns: number;
  readonly blockedRuns: number;
  readonly pendingApprovals: number;
  readonly pendingReviews: number;
  readonly pendingHandoffs: number;
  readonly missingEvidence: number;
  readonly openStories: number;
  readonly reasons: readonly string[];
}

export interface WorkflowRollups {
  readonly projectId: ProjectId;
  readonly overloadedRoles: readonly OverloadedRoleRollup[];
  readonly releaseReadiness: ReleaseReadinessRollup;
}
