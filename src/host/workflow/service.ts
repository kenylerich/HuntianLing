/**
 * Workflow engine: gates, plans, approvals, scheduling, and run control.
 */

import { randomUUID } from 'node:crypto';

import type { AgentRuntime } from '../agents/runtime.js';
import type { BoardService } from '../board/plugin.js';
import type { ProjectId, RoleId, WorkItemId, WorkItemStatus } from '../board/types.js';
import { hasExecutedDeliveryEvidence } from '../board/executed-evidence.js';
import { validateWorkItemTransition } from '../board/work-item.js';
import type { CollabService } from '../collab/service.js';
import type { DispatchService } from '../dispatch/service.js';
import type { ScmService } from '../scm/service.js';
import type { SkillService } from '../skills/service.js';
import { applyCanvasToTemplate, overlayCanvas, validateTemplate } from './canvas.js';
import { BUILTIN_CAPABILITIES, BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_ID } from './catalog.js';
import {
  builtinEventTypes,
  builtinNodeTypes,
  isNamespacedId,
  isValidNamespace,
  payloadMatchesSchema,
  runConformance,
  SYSTEM_EVENT_NAMES,
} from './packs.js';
import { buildRunSnapshot, recognizeStepState } from './recognize.js';
import { loadWorkflowSnapshot, saveWorkflowSnapshot, type WorkflowSnapshot } from './store.js';
import { defaultAssertions, isTestLabScenario, scoreAssertions, simulateTemplate } from './test-lab.js';
import {
  buildReplayView,
  buildVisualization,
  diffSnapshots,
  exportReplayReport,
  exportVisualization,
  snapshotFrom,
} from './visualization.js';
import {
  TEMPLATE_REPLACE_MODES,
  WORKFLOW_STEP_KINDS,
  WorkflowError,
  type ApprovalKind,
  type ApprovalRequest,
  type GateInspection,
  type GateMissingItem,
  type ProjectWorkflowSelection,
  type ReviewRequest,
  type RoleEventType,
  type RoleScopedEvent,
  type SchedulerDecision,
  type TemplateReplaceMode,
  type TemplateReplacePreview,
  type TemplateReplaceResult,
  type TemplateValidation,
  type TransitionRejection,
  type WorkflowCanvas,
  type WorkflowCapability,
  type WorkflowHandoff,
  type WorkflowPlanStep,
  type WorkflowRollups,
  type WorkflowRun,
  type WorkflowRunStatus,
  type WorkflowStepStatus,
  type StepStateRecognition,
  type WorkflowStateSnapshot,
  type WorkflowTemplate,
  type WorkflowTemplateStep,
  type WorkflowTestCase,
  type WorkflowTestRun,
  type WorkflowTestScenario,
  type WorkflowTimelineEvent,
  type WorkflowPack,
  type ConformanceReport,
  type WorkflowEventType,
  type WorkflowNodeType,
  type WorkflowExtensionPackage,
  type WorkflowExtensionPoint,
  type WorkflowCatalogEvent,
  type EnabledWorkflowPack,
  type WorkflowVisualization,
  type TemplateVersionDiff,
  type TestReplayView,
  type VisualizationExport,
  type TemplateVersionSnapshot,
  VISUALIZATION_LAYER_IDS,
  WORKFLOW_EXTENSION_POINTS,
} from './types.js';

export interface WorkflowService {
  listCapabilities(): readonly WorkflowCapability[];
  getCapability(capabilityId: string): WorkflowCapability;
  enableCapability(projectId: ProjectId, capabilityId: string): readonly string[];
  disableCapability(projectId: ProjectId, capabilityId: string): readonly string[];
  listTemplates(): readonly WorkflowTemplate[];
  getTemplate(templateId: string): WorkflowTemplate;
  cloneTemplate(templateId: string, owner: string): WorkflowTemplate;
  exportTemplate(templateId: string): WorkflowTemplate;
  importTemplate(input: {
    readonly title: string;
    readonly owner: string;
    readonly stages: WorkflowTemplate['stages'];
    readonly steps: readonly WorkflowTemplateStep[];
    readonly clonedFrom?: string | null;
    readonly version?: string;
  }): WorkflowTemplate;
  getCanvas(templateId: string): WorkflowCanvas;
  saveCanvas(templateId: string, canvas: WorkflowCanvas, actor: string): {
    readonly template: WorkflowTemplate;
    readonly canvas: WorkflowCanvas;
    readonly validation: TemplateValidation;
  };
  validateDraft(templateId: string): TemplateValidation;
  publishTemplate(templateId: string, actor: string): WorkflowTemplate;
  archiveTemplate(templateId: string, actor: string): WorkflowTemplate;
  createTestCase(input: {
    readonly templateId: string;
    readonly title: string;
    readonly scenario: WorkflowTestScenario;
    readonly assertions?: WorkflowTestCase['assertions'];
  }): WorkflowTestCase;
  listTestCases(templateId: string): readonly WorkflowTestCase[];
  runTestCase(templateId: string, testCaseId: string): WorkflowTestRun;
  getTestRun(runId: string): WorkflowTestRun | undefined;
  listTestRuns(templateId: string): readonly WorkflowTestRun[];
  visualizeTemplate(templateId: string): WorkflowVisualization;
  listVisualizationLayers(): readonly string[];
  exportVisualization(templateId: string, format: VisualizationExport['format']): VisualizationExport;
  diffTemplateVersion(templateId: string, version: string): TemplateVersionDiff;
  getTestReplay(runId: string): TestReplayView;
  getTestAssertions(runId: string): WorkflowTestRun['report'] & { readonly scenario: WorkflowTestScenario };
  exportTestReplay(runId: string): VisualizationExport;
  listEventTypes(): readonly WorkflowEventType[];
  registerEventType(input: {
    readonly id: string;
    readonly namespace?: string;
    readonly schemaRequired?: readonly string[];
    readonly visibility?: WorkflowEventType['visibility'];
  }): WorkflowEventType;
  emitCatalogEvent(input: {
    readonly type: string;
    readonly actor: string;
    readonly payload?: Readonly<Record<string, string>>;
    readonly runId?: string;
  }): WorkflowCatalogEvent;
  listCatalogEvents(runId?: string): readonly WorkflowCatalogEvent[];
  listNodeTypes(projectId?: ProjectId): readonly WorkflowNodeType[];
  listExtensionPoints(): readonly WorkflowExtensionPoint[];
  listExtensionPackages(): readonly WorkflowExtensionPackage[];
  importPack(input: {
    readonly namespace: string;
    readonly title: string;
    readonly version?: string;
    readonly requiredSkills?: readonly string[];
    readonly requiredTools?: readonly string[];
    readonly requiredAgents?: readonly string[];
    readonly requiredEvidence?: readonly string[];
    readonly approvalPoints?: readonly string[];
    readonly unsupportedScenarios?: readonly string[];
    readonly supportedWorkItemTypes?: readonly string[];
    readonly templates?: readonly {
      readonly title: string;
      readonly stages: WorkflowTemplate['stages'];
      readonly steps: readonly WorkflowTemplateStep[];
    }[];
    readonly eventTypes?: readonly {
      readonly id: string;
      readonly schemaRequired?: readonly string[];
      readonly visibility?: WorkflowEventType['visibility'];
    }[];
    readonly nodeTypes?: readonly {
      readonly id: string;
      readonly title: string;
      readonly requiredPermissions?: readonly string[];
      readonly supportedEvents?: readonly string[];
      readonly requiredCapabilities?: readonly string[];
      readonly testFixture?: WorkflowNodeType['testFixture'];
    }[];
    readonly extensions?: readonly {
      readonly point: WorkflowExtensionPoint;
      readonly order?: number;
      readonly testCases?: readonly string[];
      readonly requiredPermissions?: readonly string[];
    }[];
  }): WorkflowPack;
  listPacks(): readonly WorkflowPack[];
  getPack(packId: string): WorkflowPack;
  runPackConformance(packId: string): ConformanceReport;
  getConformance(reportId: string): ConformanceReport;
  enablePack(projectId: ProjectId, packId: string, actor: string): EnabledWorkflowPack;
  listEnabledPacks(projectId: ProjectId): readonly EnabledWorkflowPack[];
  selectTemplate(projectId: ProjectId, templateId: string): WorkflowTemplate;
  selectedTemplate(projectId: ProjectId): WorkflowTemplate;
  previewReplace(projectId: ProjectId, templateId: string): TemplateReplacePreview;
  replaceTemplate(
    projectId: ProjectId,
    input: {
      readonly templateId: string;
      readonly mode: TemplateReplaceMode;
      readonly actor: string;
      readonly workItemIds?: readonly WorkItemId[];
      readonly dryRun?: boolean;
    },
  ): TemplateReplaceResult;
  rollbackTemplate(
    projectId: ProjectId,
    input: { readonly actor: string; readonly mode?: TemplateReplaceMode },
  ): TemplateReplaceResult;
  inspectGates(workItemId: WorkItemId, to: WorkItemStatus): GateInspection;
  transition(workItemId: WorkItemId, to: WorkItemStatus, actor: string): GateInspection;
  override(
    workItemId: WorkItemId,
    to: WorkItemStatus,
    input: { readonly actor: string; readonly reason: string; readonly scope: string },
  ): GateInspection;
  plan(workItemId: WorkItemId, actor: string): WorkflowRun;
  start(runId: string, actor: string): WorkflowRun;
  pause(runId: string, actor: string): WorkflowRun;
  resume(runId: string, actor: string): WorkflowRun;
  cancel(runId: string, actor: string): WorkflowRun;
  retryStep(runId: string, stepId: string, actor: string): WorkflowRun;
  reassignStep(runId: string, stepId: string, owner: string, actor: string): WorkflowRun;
  completeStep(runId: string, stepId: string, actor: string): WorkflowRun;
  emitStepEvent(
    runId: string,
    input: { readonly type: string; readonly actor: string; readonly actorRole?: string },
  ): WorkflowRun;
  getRun(runId: string): WorkflowRun | undefined;
  listRuns(projectId: ProjectId): readonly WorkflowRun[];
  runState(runId: string): WorkflowStateSnapshot;
  recognizeStep(runId: string, stepId: string, actor: string): StepStateRecognition;
  listRecognitions(runId: string): readonly StepStateRecognition[];
  schedule(runId: string): readonly WorkflowPlanStep[];
  recompute(runId: string): WorkflowRun;
  timeline(runId: string): readonly WorkflowTimelineEvent[];
  schedulerDecisions(runId: string): readonly SchedulerDecision[];
  createApproval(input: {
    readonly workItemId: WorkItemId;
    readonly kind: ApprovalKind;
    readonly requester: string;
    readonly requesterRole: string;
    readonly requiredApproverRoles: readonly string[];
    readonly reason: string;
    readonly runId?: string;
    readonly stepId?: string;
  }): ApprovalRequest;
  decideApproval(
    approvalId: string,
    input: {
      readonly actor: string;
      readonly actorRole: string;
      readonly decision: 'approve' | 'reject' | 'request-revision' | 'delegate';
      readonly reason: string;
      readonly delegateRole?: string;
    },
  ): ApprovalRequest;
  listApprovals(projectId: ProjectId): readonly ApprovalRequest[];
  listRoleEvents(runId: string): readonly RoleScopedEvent[];
  createReview(input: {
    readonly workItemId: WorkItemId;
    readonly requester: string;
    readonly requesterRole: string;
    readonly requiredReviewerRoles: readonly string[];
    readonly reason: string;
    readonly runId?: string;
    readonly stepId?: string;
  }): ReviewRequest;
  completeReview(
    reviewId: string,
    input: { readonly actor: string; readonly actorRole: string; readonly reason: string },
  ): ReviewRequest;
  listReviews(projectId: ProjectId): readonly ReviewRequest[];
  requestHandoff(
    runId: string,
    input: {
      readonly actor: string;
      readonly fromRole: string;
      readonly toOwner: string;
      readonly toRole: string;
      readonly reason: string;
      readonly stepId?: string;
    },
  ): WorkflowHandoff;
  acceptHandoff(
    handoffId: string,
    input: { readonly actor: string; readonly actorRole: string; readonly reason: string },
  ): WorkflowHandoff;
  rejectHandoff(
    handoffId: string,
    input: { readonly actor: string; readonly actorRole: string; readonly reason: string },
  ): WorkflowHandoff;
  listHandoffs(runId: string): readonly WorkflowHandoff[];
  listRejections(runId: string): readonly TransitionRejection[];
  projectRollups(projectId: ProjectId): WorkflowRollups;
}

export function createWorkflowService(deps: {
  readonly board: BoardService;
  readonly workspaceRoot: string;
  readonly collab?: CollabService;
  readonly agents?: AgentRuntime;
  readonly dispatch?: DispatchService;
  readonly scm?: ScmService;
  readonly skills?: SkillService;
}): WorkflowService {
  const loaded = loadWorkflowSnapshot(deps.workspaceRoot);
  let templates: WorkflowTemplate[] = mergeBuiltinTemplates(loaded?.templates ?? []).map(normalizeTemplate);
  let selections = (loaded?.selections ?? []).map(normalizeSelection);
  let runs: WorkflowRun[] = (loaded?.runs ?? []).map(normalizeRun);
  let approvals: ApprovalRequest[] = [...(loaded?.approvals ?? [])];
  let events: RoleScopedEvent[] = [...(loaded?.events ?? [])];
  let decisions: SchedulerDecision[] = [...(loaded?.decisions ?? [])];
  let timeline: WorkflowTimelineEvent[] = [...(loaded?.timeline ?? [])];
  let reviews: ReviewRequest[] = [...(loaded?.reviews ?? [])];
  let handoffs: WorkflowHandoff[] = [...(loaded?.handoffs ?? [])];
  let rejections: TransitionRejection[] = [...(loaded?.rejections ?? [])];
  let recognitions: StepStateRecognition[] = [...(loaded?.recognitions ?? [])];
  let canvases: WorkflowCanvas[] = [...(loaded?.canvases ?? [])];
  let testCases: WorkflowTestCase[] = [...(loaded?.testCases ?? [])];
  let testRuns: WorkflowTestRun[] = [...(loaded?.testRuns ?? [])];
  let packs: WorkflowPack[] = [...(loaded?.packs ?? [])];
  let conformanceReports: ConformanceReport[] = [...(loaded?.conformanceReports ?? [])];
  let eventTypes: WorkflowEventType[] = [...(loaded?.eventTypes ?? [])];
  let nodeTypes: WorkflowNodeType[] = [...(loaded?.nodeTypes ?? [])];
  let extensionPackages: WorkflowExtensionPackage[] = [...(loaded?.extensions ?? [])];
  let catalogEvents: WorkflowCatalogEvent[] = [...(loaded?.catalogEvents ?? [])];
  let enabledPacks: EnabledWorkflowPack[] = [...(loaded?.enabledPacks ?? [])];
  let templateSnapshots: TemplateVersionSnapshot[] = [...(loaded?.templateSnapshots ?? [])];

  const service: WorkflowService = {
    listCapabilities() {
      return BUILTIN_CAPABILITIES;
    },
    getCapability(capabilityId) {
      return requireCapability(capabilityId);
    },
    enableCapability(projectId, capabilityId) {
      requireCapability(capabilityId);
      const current = selectionFor(projectId);
      const disabledCapabilityIds = current.disabledCapabilityIds.filter((id) => id !== capabilityId);
      writeSelection({ ...current, disabledCapabilityIds });
      persist();
      return disabledCapabilityIds;
    },
    disableCapability(projectId, capabilityId) {
      requireCapability(capabilityId);
      const current = selectionFor(projectId);
      const disabledCapabilityIds = [...new Set([...current.disabledCapabilityIds, capabilityId])];
      writeSelection({ ...current, disabledCapabilityIds });
      persist();
      return disabledCapabilityIds;
    },
    listTemplates() {
      return templates;
    },
    getTemplate(templateId) {
      return requireTemplate(templateId);
    },
    cloneTemplate(templateId, owner) {
      const source = requireTemplate(templateId);
      const cloned: WorkflowTemplate = {
        ...source,
        id: randomUUID(),
        version: source.version,
        title: `${source.title} copy`,
        state: 'draft',
        builtin: false,
        owner,
        clonedFrom: source.id,
      };
      templates = [...templates, cloned];
      recordSnapshot(cloned);
      persist();
      return cloned;
    },
    exportTemplate(templateId) {
      return requireTemplate(templateId);
    },
    importTemplate(input) {
      if (input.title.trim() === '') throw new WorkflowError('VALIDATION', 'template title is required');
      if (input.steps.length === 0) throw new WorkflowError('VALIDATION', 'template steps cannot be empty');
      validateImportedSteps(input.steps);
      const imported: WorkflowTemplate = normalizeTemplate({
        id: randomUUID(),
        version: input.version ?? '1.0.0',
        title: input.title,
        state: 'draft',
        builtin: false,
        owner: input.owner,
        clonedFrom: input.clonedFrom ?? null,
        stages: input.stages,
        steps: input.steps,
      });
      templates = [...templates, imported];
      recordSnapshot(imported);
      persist();
      return imported;
    },
    getCanvas(templateId) {
      const template = requireTemplate(templateId);
      return overlayCanvas(template, canvases.find((item) => item.templateId === templateId));
    },
    saveCanvas(templateId, canvas, actor) {
      const template = assertMutableTemplate(templateId);
      const nextTemplate = {
        ...applyCanvasToTemplate(template, canvas),
        version: bumpPatch(template.version),
        owner: actor.trim() === '' ? template.owner : actor,
      };
      const validation = validateTemplate(nextTemplate, conformedNodeTypeIds());
      writeTemplate(nextTemplate);
      const stored: WorkflowCanvas = {
        ...canvas,
        templateId,
        templateVersion: nextTemplate.version,
      };
      canvases = [...canvases.filter((item) => item.templateId !== templateId), stored];
      recordSnapshot(nextTemplate);
      persist();
      return {
        template: nextTemplate,
        canvas: overlayCanvas(nextTemplate, stored),
        validation,
      };
    },
    validateDraft(templateId) {
      return validateTemplate(requireTemplate(templateId), conformedNodeTypeIds());
    },
    publishTemplate(templateId, actor) {
      const template = assertMutableTemplate(templateId);
      if (template.state === 'archived' || template.state === 'deprecated') {
        throw new WorkflowError('VALIDATION', `template ${templateId} cannot be published`);
      }
      const validation = validateTemplate(template, conformedNodeTypeIds());
      if (!validation.ok) {
        throw new WorkflowError('VALIDATION', validation.issues[0]?.message ?? 'template is invalid');
      }
      const happy = testCases.filter((item) => item.templateId === templateId && item.scenario === 'happy-path');
      if (happy.length === 0) {
        throw new WorkflowError('VALIDATION', 'publish requires a happy-path test case');
      }
      const passed = testRuns.some(
        (item) => item.templateId === templateId && item.scenario === 'happy-path' && item.status === 'passed',
      );
      if (!passed) {
        throw new WorkflowError('VALIDATION', 'publish requires a passing happy-path test run');
      }
      const published: WorkflowTemplate = {
        ...template,
        state: 'published',
        version: bumpPatch(template.version),
        owner: actor.trim() === '' ? template.owner : actor,
      };
      writeTemplate(published);
      recordSnapshot(published);
      persist();
      return published;
    },
    archiveTemplate(templateId, actor) {
      const template = assertMutableTemplate(templateId);
      if (runs.some((run) => run.templateId === templateId && isOpenRun(run.status))) {
        throw new WorkflowError('VALIDATION', `template ${templateId} is still used by an active run`);
      }
      const archived: WorkflowTemplate = {
        ...template,
        state: 'archived',
        owner: actor.trim() === '' ? template.owner : actor,
      };
      writeTemplate(archived);
      persist();
      return archived;
    },
    createTestCase(input) {
      requireTemplate(input.templateId);
      if (!isTestLabScenario(input.scenario)) {
        throw new WorkflowError('VALIDATION', `unsupported test scenario: ${input.scenario}`);
      }
      const title = input.title.trim();
      if (title === '') throw new WorkflowError('VALIDATION', 'test case title is required');
      const created: WorkflowTestCase = {
        id: randomUUID(),
        templateId: input.templateId,
        title,
        scenario: input.scenario,
        assertions: input.assertions ?? defaultAssertions(input.scenario),
        createdAt: Date.now(),
      };
      testCases = [...testCases, created];
      persist();
      return created;
    },
    listTestCases(templateId) {
      requireTemplate(templateId);
      return testCases.filter((item) => item.templateId === templateId);
    },
    runTestCase(templateId, testCaseId) {
      const template = requireTemplate(templateId);
      const testCase = testCases.find((item) => item.id === testCaseId && item.templateId === templateId);
      if (testCase === undefined) throw new WorkflowError('NOT_FOUND', `test case not found: ${testCaseId}`);
      const simulated = simulateTemplate(template, testCase.scenario, nodeTypes.filter((item) => item.origin === 'custom'));
      const report = scoreAssertions(testCase.scenario, simulated.frames, testCase.assertions);
      const pack = packs.find((item) => item.id === template.clonedFrom);
      const conformance = [...conformanceReports].reverse().find((item) => item.packId === (pack?.id ?? ''));
      const run: WorkflowTestRun = {
        id: randomUUID(),
        templateId,
        testCaseId,
        scenario: testCase.scenario,
        status: report.failed.length === 0 ? 'passed' : 'failed',
        replay: simulated.frames,
        report,
        createdAt: Date.now(),
        templateVersion: template.version,
        packVersion: pack?.version ?? null,
        fixtureVersion: '1.0.0',
        schedulerVersion: '1.0.0',
        conformanceRunId: conformance?.id ?? null,
      };
      testRuns = [...testRuns, run];
      persist();
      return run;
    },
    getTestRun(runId) {
      return testRuns.find((item) => item.id === runId);
    },
    listTestRuns(templateId) {
      requireTemplate(templateId);
      return testRuns.filter((item) => item.templateId === templateId);
    },
    visualizeTemplate(templateId) {
      const template = requireTemplate(templateId);
      recordSnapshot(template);
      persist();
      return buildVisualization(
        template,
        canvases.find((item) => item.templateId === templateId),
        conformedNodeTypeIds(),
      );
    },
    listVisualizationLayers() {
      return VISUALIZATION_LAYER_IDS;
    },
    exportVisualization(templateId, format) {
      const visualization = service.visualizeTemplate(templateId);
      return exportVisualization(requireTemplate(templateId), visualization, format);
    },
    diffTemplateVersion(templateId, version) {
      const template = requireTemplate(templateId);
      const from = templateSnapshots.find((item) => item.templateId === templateId && item.version === version);
      if (from === undefined) throw new WorkflowError('NOT_FOUND', `template version not found: ${version}`);
      return diffSnapshots(from, template);
    },
    getTestReplay(runId) {
      const run = requireTestRun(runId);
      const template = requireTemplate(run.templateId);
      const testCase = testCases.find((item) => item.id === run.testCaseId);
      if (testCase === undefined) throw new WorkflowError('NOT_FOUND', `test case not found: ${run.testCaseId}`);
      return buildReplayView(template, canvases.find((item) => item.templateId === template.id), testCase, normalizeTestRun(run));
    },
    getTestAssertions(runId) {
      const run = requireTestRun(runId);
      return { ...run.report, scenario: run.scenario };
    },
    exportTestReplay(runId) {
      return exportReplayReport(service.getTestReplay(runId));
    },
    listEventTypes() {
      return [...builtinEventTypes(), ...eventTypes];
    },
    registerEventType(input) {
      const id = input.id.trim();
      if (id === '') throw new WorkflowError('VALIDATION', 'event type id is required');
      if (SYSTEM_EVENT_NAMES.includes(id)) {
        throw new WorkflowError('VALIDATION', `custom event cannot redefine system event ${id}`);
      }
      const namespace = input.namespace?.trim() || id.split('.')[0] || '';
      if (!isValidNamespace(namespace) || !isNamespacedId(id, namespace)) {
        throw new WorkflowError('VALIDATION', `event ${id} must use a pack or project namespace`);
      }
      if (eventTypes.some((item) => item.id === id) || SYSTEM_EVENT_NAMES.includes(id)) {
        throw new WorkflowError('VALIDATION', `event type already exists: ${id}`);
      }
      const created: WorkflowEventType = {
        id,
        origin: 'custom',
        version: '1.0.0',
        namespace,
        packId: null,
        schema: { required: input.schemaRequired ?? [] },
        producerRoles: ['developer'],
        targetRoles: ['developer'],
        requiredDecisionRoles: [],
        allowedConsumers: ['workflow'],
        visibility: input.visibility ?? 'runtime',
        retention: 'run',
        redaction: 'none',
        audit: true,
      };
      eventTypes = [...eventTypes, created];
      persist();
      return created;
    },
    emitCatalogEvent(input) {
      const type = input.type.trim();
      const catalog = service.listEventTypes().find((item) => item.id === type);
      if (catalog === undefined) throw new WorkflowError('VALIDATION', `unknown event type: ${type}`);
      const payload = input.payload ?? {};
      if (!payloadMatchesSchema(payload, catalog.schema.required)) {
        throw new WorkflowError('VALIDATION', `event ${type} does not match its declared schema`);
      }
      if (input.runId !== undefined) requireRun(input.runId);
      const emitted: WorkflowCatalogEvent = {
        id: randomUUID(),
        type,
        version: catalog.version,
        runId: input.runId ?? null,
        payload,
        actor: input.actor,
        createdAt: Date.now(),
      };
      catalogEvents = [...catalogEvents, emitted];
      persist();
      return emitted;
    },
    listCatalogEvents(runId) {
      if (runId === undefined) return catalogEvents;
      return catalogEvents.filter((item) => item.runId === runId);
    },
    listNodeTypes() {
      return [
        ...builtinNodeTypes(),
        ...nodeTypes.filter((item) => item.origin === 'custom' && packHasPassed(item.packId)),
      ];
    },
    listExtensionPoints() {
      return WORKFLOW_EXTENSION_POINTS;
    },
    listExtensionPackages() {
      return extensionPackages;
    },
    importPack(input) {
      if (!isValidNamespace(input.namespace)) {
        throw new WorkflowError('VALIDATION', `invalid pack namespace: ${input.namespace}`);
      }
      const title = input.title.trim();
      if (title === '') throw new WorkflowError('VALIDATION', 'pack title is required');
      const packId = randomUUID();
      const version = input.version ?? '1.0.0';
      const importedTemplates: WorkflowTemplate[] = [];
      for (const spec of input.templates ?? []) {
        const imported = service.importTemplate({
          title: spec.title,
          owner: input.namespace,
          stages: spec.stages,
          steps: spec.steps,
          clonedFrom: packId,
        });
        importedTemplates.push(imported);
      }
      const importedEvents: WorkflowEventType[] = (input.eventTypes ?? []).map((spec) => ({
        id: spec.id,
        origin: 'custom' as const,
        version,
        namespace: input.namespace,
        packId,
        schema: { required: spec.schemaRequired ?? [] },
        producerRoles: ['developer'],
        targetRoles: ['developer'],
        requiredDecisionRoles: [],
        allowedConsumers: ['workflow'],
        visibility: spec.visibility ?? 'runtime',
        retention: 'run',
        redaction: 'none',
        audit: true,
      }));
      const importedNodes: WorkflowNodeType[] = (input.nodeTypes ?? []).map((spec) => ({
        id: spec.id,
        origin: 'custom' as const,
        version,
        namespace: input.namespace,
        packId,
        title: spec.title,
        inputSchema: `${spec.id}.in.v1`,
        outputSchema: `${spec.id}.out.v1`,
        formSchema: `${spec.id}.form.v1`,
        requiredCapabilities: spec.requiredCapabilities ?? [],
        requiredPermissions: spec.requiredPermissions ?? [],
        supportedEvents: spec.supportedEvents ?? [],
        testFixture: spec.testFixture ?? { status: 'completed', nextSafeAction: 'complete', reason: 'simulated' },
      }));
      const importedExtensions: WorkflowExtensionPackage[] = (input.extensions ?? []).map((spec, index) => ({
        id: randomUUID(),
        version,
        packId,
        point: spec.point,
        order: spec.order ?? 100 + index,
        scope: 'template',
        inputSchema: `${spec.point}.in.v1`,
        outputSchema: `${spec.point}.out.v1`,
        sideEffects: [],
        requiredPermissions: spec.requiredPermissions ?? [],
        timeoutMs: 1_000,
        retryPolicy: 'none',
        idempotent: true,
        testCases: spec.testCases ?? ['happy-path'],
      }));
      const pack: WorkflowPack = {
        id: packId,
        version,
        namespace: input.namespace,
        title,
        supportedWorkItemTypes: input.supportedWorkItemTypes ?? ['story'],
        requiredAgents: input.requiredAgents ?? [],
        requiredSkills: input.requiredSkills ?? [],
        requiredTools: input.requiredTools ?? [],
        requiredEvidence: input.requiredEvidence ?? [],
        approvalPoints: input.approvalPoints ?? [],
        unsupportedScenarios: input.unsupportedScenarios ?? [],
        templateIds: importedTemplates.map((item) => item.id),
        eventTypeIds: importedEvents.map((item) => item.id),
        nodeTypeIds: importedNodes.map((item) => item.id),
        extensionIds: importedExtensions.map((item) => item.id),
        createdAt: Date.now(),
      };
      packs = [...packs, pack];
      eventTypes = [...eventTypes, ...importedEvents];
      nodeTypes = [...nodeTypes, ...importedNodes];
      extensionPackages = [...extensionPackages, ...importedExtensions];
      persist();
      return pack;
    },
    listPacks() {
      return packs;
    },
    getPack(packId) {
      return requirePack(packId);
    },
    runPackConformance(packId) {
      const pack = requirePack(packId);
      const reportBody = runConformance({
        pack,
        templates: templates.filter((item) => pack.templateIds.includes(item.id)),
        eventTypes: eventTypes.filter((item) => item.packId === packId),
        nodeTypes: nodeTypes.filter((item) => item.packId === packId),
        extensions: extensionPackages.filter((item) => item.packId === packId),
      });
      const report: ConformanceReport = {
        id: randomUUID(),
        ...reportBody,
        createdAt: Date.now(),
      };
      conformanceReports = [...conformanceReports, report];
      persist();
      return report;
    },
    getConformance(reportId) {
      const found = conformanceReports.find((item) => item.id === reportId);
      if (found === undefined) throw new WorkflowError('NOT_FOUND', `conformance report not found: ${reportId}`);
      return found;
    },
    enablePack(projectId, packId, actor) {
      deps.board.listProjects().find((project) => project.id === projectId)
        ?? fail(`project not found: ${projectId}`);
      const pack = requirePack(packId);
      const latest = [...conformanceReports].reverse().find((item) => item.packId === packId);
      if (latest === undefined || latest.status !== 'passed') {
        throw new WorkflowError('VALIDATION', `pack ${packId} has not passed conformance`);
      }
      const incoming = extensionPackages.filter((item) => item.packId === packId);
      const activePackIds = new Set(enabledPacks.filter((item) => item.projectId === projectId).map((item) => item.packId));
      const active = extensionPackages.filter((item) => item.packId !== null && activePackIds.has(item.packId));
      for (const extension of incoming) {
        const conflict = active.find((item) => item.point === extension.point && item.order === extension.order);
        if (conflict !== undefined) {
          throw new WorkflowError(
            'VALIDATION',
            `conflicting extensions at ${extension.point} order ${String(extension.order)}`,
          );
        }
      }
      const enabled: EnabledWorkflowPack = {
        projectId,
        packId,
        packVersion: pack.version,
        enabledAt: Date.now(),
      };
      enabledPacks = [...enabledPacks.filter((item) => !(item.projectId === projectId && item.packId === packId)), enabled];
      deps.board.recordAuditEvent({
        projectId,
        actorId: actor,
        action: 'workflow_pack.enabled',
        targetType: 'workflow_pack',
        targetId: packId,
        targetLabel: pack.title,
        changedFields: ['packId'],
        reason: `conformance ${latest.id}`,
      });
      persist();
      return enabled;
    },
    listEnabledPacks(projectId) {
      return enabledPacks.filter((item) => item.projectId === projectId);
    },
    previewReplace(projectId, templateId) {
      return buildReplacePreview(projectId, templateId);
    },
    replaceTemplate(projectId, input) {
      return applyTemplateReplace(projectId, {
        templateId: input.templateId,
        mode: input.mode,
        actor: input.actor,
        dryRun: input.dryRun === true,
        ...(input.workItemIds !== undefined ? { workItemIds: input.workItemIds } : {}),
      });
    },
    rollbackTemplate(projectId, input) {
      const current = selectionFor(projectId);
      if (current.previousTemplateId === null) {
        throw new WorkflowError('VALIDATION', `project ${projectId} has no previous workflow template`);
      }
      return applyTemplateReplace(projectId, {
        templateId: current.previousTemplateId,
        mode: input.mode ?? current.lastReplaceMode ?? 'future',
        actor: input.actor,
        dryRun: false,
        rollback: true,
      });
    },
    selectTemplate(projectId, templateId) {
      const template = requireTemplate(templateId);
      if (template.state === 'archived' || template.state === 'deprecated') {
        throw new WorkflowError('VALIDATION', `template ${templateId} is not selectable`);
      }
      if (template.state !== 'published' && template.builtin === false && template.state !== 'draft') {
        throw new WorkflowError('VALIDATION', `template ${templateId} is not selectable`);
      }
      deps.board.listProjects().find((project) => project.id === projectId)
        ?? fail(`project not found: ${projectId}`);
      const current = selectionFor(projectId);
      writeSelection({
        ...current,
        templateId,
        previousTemplateId: current.templateId === templateId ? current.previousTemplateId : current.templateId,
      });
      deps.board.recordAuditEvent({
        projectId,
        action: 'workflow_template.selected',
        targetType: 'workflow_template',
        targetId: templateId,
        targetLabel: template.title,
        changedFields: ['templateId'],
      });
      persist();
      return template;
    },
    selectedTemplate(projectId) {
      return requireTemplate(selectionFor(projectId).templateId);
    },
    inspectGates(workItemId, to) {
      return inspect(workItemId, to);
    },
    transition(workItemId, to, actor) {
      const inspection = inspect(workItemId, to);
      if (!inspection.allowed) {
        throw new WorkflowError('TRANSITION', inspection.missing.map((item) => item.message).join('; ') || 'transition blocked');
      }
      deps.board.transitionWorkItem(workItemId, to);
      syncRunAfterTransition(workItemId, actor, `transitioned to ${to}`);
      persist();
      return inspect(workItemId, to);
    },
    override(workItemId, to, input) {
      if (input.reason.trim() === '' || input.scope.trim() === '') {
        throw new WorkflowError('VALIDATION', 'override requires reason and scope');
      }
      const item = requireWorkItem(workItemId);
      const inspection = inspect(workItemId, to);
      const forbidden = inspection.missing.find((row) => row.kind === 'lifecycle');
      if (forbidden !== undefined) {
        throw new WorkflowError('TRANSITION', forbidden.message);
      }
      try {
        deps.board.transitionWorkItem(workItemId, to, {
          actorId: input.actor,
          reason: input.reason,
          scope: input.scope,
        });
      } catch (error) {
        throw new WorkflowError('TRANSITION', error instanceof Error ? error.message : 'override blocked');
      }
      syncRunAfterTransition(workItemId, input.actor, `override ${item.status} -> ${to}: ${input.reason}`);
      persist();
      return inspect(workItemId, to);
    },
    plan(workItemId, actor) {
      const item = requireWorkItem(workItemId);
      const existing = runs.find((run) => run.workItemId === workItemId && isOpenRun(run.status));
      if (existing !== undefined) return existing;
      const template = service.selectedTemplate(item.projectId);
      const now = Date.now();
      const steps = template.steps.map((step) => ({
        id: randomUUID(),
        templateStepId: step.id,
        title: step.title,
        kind: step.kind,
        role: step.role,
        capabilityId: step.capabilityId,
        requiredSkills: step.requiredSkills,
        allowedTools: step.allowedTools,
        checks: step.checks,
        dependsOn: step.dependsOn,
        approvalKind: step.approvalKind,
        targetStatus: step.targetStatus,
        status: 'pending' as const,
        owner: step.role,
        collaborationTaskId: null,
        approvalId: null,
        reason: 'waiting for dependencies',
        triggerEvent: step.triggerEvent,
        intervalMs: step.intervalMs,
        occurrence: 0,
        lastCompletedAt: null,
        lastRecognition: null,
      }));
      const run: WorkflowRun = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId,
        templateId: template.id,
        templateVersion: template.version,
        status: 'planned',
        owner: actor,
        steps,
        nextAction: 'Start the first ready step',
        createdAt: now,
        updatedAt: now,
      };
      runs = [...runs, run];
      appendTimeline(run.id, null, now, 'planned', `plan created by ${actor}`);
      const scheduled = recomputeRun(run.id);
      persist();
      return scheduled;
    },
    start(runId, actor) {
      const run = requireRun(runId);
      const ready = run.steps.find((step) => step.status === 'scheduled' || step.status === 'ready' || step.status === 'queued');
      if (ready === undefined) {
        throw new WorkflowError('VALIDATION', 'no schedulable step is ready');
      }
      if (ready.status === 'waiting_for_approval' || ready.status === 'blocked') {
        throw new WorkflowError('APPROVAL', `step ${ready.id} cannot start: ${ready.reason}`);
      }
      if (ready.kind === 'event-triggered' && ready.status !== 'scheduled' && ready.status !== 'ready') {
        throw new WorkflowError('NOT_READY', `step ${ready.id} is waiting for event ${ready.triggerEvent ?? ''}`);
      }
      const recognition = service.recognizeStep(runId, ready.id, actor);
      if (!recognition.allowed) {
        throw new WorkflowError('NOT_READY', recognition.reason);
      }
      assertOrchestrationReady(requireRun(runId), ready, actor);
      startStep(requireRun(runId), ready, actor);
      persist();
      return requireRun(runId);
    },
    pause(runId, actor) {
      return setRunStatus(runId, 'paused', actor, 'paused');
    },
    resume(runId, actor) {
      const run = requireRun(runId);
      if (run.status !== 'paused') throw new WorkflowError('VALIDATION', `run ${runId} is not paused`);
      replaceRun({ ...run, status: 'running', owner: actor, updatedAt: Date.now() });
      appendTimeline(run.id, null, Date.now(), 'resumed', `resumed by ${actor}`);
      persist();
      return recomputeRun(runId);
    },
    cancel(runId, actor) {
      const run = requireRun(runId);
      const steps = run.steps.map((step) =>
        isTerminalStep(step.status) ? step : { ...step, status: 'cancelled' as const, reason: `cancelled by ${actor}` },
      );
      replaceRun({ ...run, status: 'cancelled', steps, owner: actor, nextAction: 'No further action', updatedAt: Date.now() });
      appendTimeline(run.id, null, Date.now(), 'cancelled', `cancelled by ${actor}`);
      persist();
      return requireRun(runId);
    },
    retryStep(runId, stepId, actor) {
      const run = requireRun(runId);
      const step = run.steps.find((item) => item.id === stepId);
      if (step === undefined) throw new WorkflowError('NOT_FOUND', `step not found: ${stepId}`);
      if (step.status !== 'failed' && step.status !== 'blocked' && step.status !== 'cancelled') {
        throw new WorkflowError('VALIDATION', `step ${stepId} cannot be retried`);
      }
      patchStep(runId, stepId, { status: 'pending', reason: `retry by ${actor}` });
      recordDecision(runId, stepId, step.status, 'pending', `retry by ${actor}`);
      persist();
      return recomputeRun(runId);
    },
    reassignStep(runId, stepId, owner, actor) {
      if (owner.trim() === '') throw new WorkflowError('VALIDATION', 'owner is required');
      const run = requireRun(runId);
      const step = run.steps.find((item) => item.id === stepId);
      if (step === undefined) throw new WorkflowError('NOT_FOUND', `step not found: ${stepId}`);
      patchStep(runId, stepId, { owner, reason: `reassigned by ${actor}` });
      appendTimeline(runId, stepId, Date.now(), 'reassigned', `${step.owner} -> ${owner}`);
      persist();
      return requireRun(runId);
    },
    completeStep(runId, stepId, actor) {
      const run = requireRun(runId);
      const step = run.steps.find((item) => item.id === stepId);
      if (step === undefined) throw new WorkflowError('NOT_FOUND', `step not found: ${stepId}`);
      if (step.status !== 'running' && step.status !== 'retrying') {
        throw new WorkflowError('VALIDATION', `step ${stepId} is not running`);
      }
      finishStep(run, step, actor, `completed by ${actor}`);
      persist();
      return requireRun(runId);
    },
    emitStepEvent(runId, input) {
      const run = requireRun(runId);
      const type = input.type.trim();
      if (type === '') throw new WorkflowError('VALIDATION', 'event type is required');
      const actorRole = input.actorRole ?? 'developer';
      const matching = run.steps.filter(
        (step) => step.kind === 'event-triggered' && step.triggerEvent === type,
      );
      if (matching.length === 0) {
        recordRejection({
          projectId: run.projectId,
          workItemId: run.workItemId,
          runId,
          stepId: null,
          actor: input.actor,
          actorRole,
          eventType: type,
          reason: `no event-triggered step waits for ${type}`,
          currentState: run.status,
        });
        persist();
        return requireRun(runId);
      }
      let changed = false;
      for (const step of matching) {
        if (step.status === 'queued' || step.status === 'pending' || step.status === 'waiting_for_input') {
          patchStep(runId, step.id, { status: 'scheduled', reason: `event ${type}` });
          recordDecision(runId, step.id, step.status, 'scheduled', `event ${type}`);
          changed = true;
        } else {
          recordRejection({
            projectId: run.projectId,
            workItemId: run.workItemId,
            runId,
            stepId: step.id,
            actor: input.actor,
            actorRole,
            eventType: type,
            reason: `duplicate or stale event ${type} for step ${step.templateStepId}`,
            currentState: step.status,
          });
        }
      }
      if (changed) {
        appendTimeline(runId, matching[0]?.id ?? null, Date.now(), 'event', `${type} by ${input.actor}`);
        recomputeRun(runId);
      }
      persist();
      return requireRun(runId);
    },
    getRun(runId) {
      return runs.find((run) => run.id === runId);
    },
    listRuns(projectId) {
      return runs.filter((run) => run.projectId === projectId);
    },
    runState(runId) {
      const run = requireRun(runId);
      const pendingApprovalKinds = approvals
        .filter((item) => item.runId === runId && (item.status === 'pending' || item.status === 'delegated'))
        .map((item) => item.kind);
      return {
        ...buildRunSnapshot(recognizeDeps(), run, currentStep(run)),
        pendingApprovalKinds,
      };
    },
    recognizeStep(runId, stepId, actor) {
      const run = requireRun(runId);
      const step = run.steps.find((item) => item.id === stepId);
      if (step === undefined) throw new WorkflowError('NOT_FOUND', `step not found: ${stepId}`);
      const pendingApprovalKinds = approvals
        .filter((item) => item.runId === runId && item.stepId === stepId && item.status === 'approved')
        .map((item) => item.kind);
      const previous = step.lastRecognition;
      const recognition = recognizeStepState(
        recognizeDeps(),
        run,
        step,
        actor,
        pendingApprovalKinds,
        previous,
      );
      recognitions = [...recognitions, recognition];
      patchStep(runId, stepId, { lastRecognition: recognition });
      if (!recognition.allowed) {
        patchStep(runId, stepId, {
          lastRecognition: recognition,
          status: step.status === 'running' ? 'blocked' : step.status,
          reason: recognition.reason,
        });
        emitRecognitionChat(run, step, recognition);
        if (recognition.nextSafeAction === 'request-approval' && step.approvalKind !== null) {
          const existing = approvals.find(
            (item) => item.stepId === step.id && (item.status === 'pending' || item.status === 'delegated'),
          );
          if (existing === undefined) {
            service.createApproval({
              workItemId: run.workItemId,
              kind: step.approvalKind,
              requester: actor,
              requesterRole: actor,
              requiredApproverRoles: ['developer'],
              reason: recognition.reason,
              runId: run.id,
              stepId: step.id,
            });
          }
        }
      } else if (previous !== null && previous.nextSafeAction !== recognition.nextSafeAction) {
        emitRecognitionChat(run, step, recognition);
      }
      persist();
      return recognition;
    },
    listRecognitions(runId) {
      requireRun(runId);
      return recognitions.filter((item) => item.runId === runId);
    },
    schedule(runId) {
      return requireRun(runId).steps;
    },
    recompute(runId) {
      const next = recomputeRun(runId);
      persist();
      return next;
    },
    timeline(runId) {
      requireRun(runId);
      return timeline.filter((event) => event.runId === runId);
    },
    schedulerDecisions(runId) {
      requireRun(runId);
      return decisions.filter((item) => item.runId === runId);
    },
    createApproval(input) {
      const item = requireWorkItem(input.workItemId);
      if (input.requiredApproverRoles.length === 0) {
        throw new WorkflowError('VALIDATION', 'requiredApproverRoles cannot be empty');
      }
      const now = Date.now();
      const approval: ApprovalRequest = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId: item.id,
        runId: input.runId ?? null,
        stepId: input.stepId ?? null,
        kind: input.kind,
        requester: input.requester,
        requesterRole: input.requesterRole,
        requiredApproverRoles: input.requiredApproverRoles,
        allowedDecisionRoles: input.requiredApproverRoles,
        quorum: 1,
        status: 'pending',
        reason: input.reason,
        decidedBy: null,
        decidedRole: null,
        decidedReason: '',
        createdAt: now,
        updatedAt: now,
      };
      approvals = [...approvals, approval];
      emitRoleEvent({
        projectId: item.projectId,
        workItemId: item.id,
        runId: approval.runId,
        stepId: approval.stepId,
        type: 'approval.requested',
        actor: input.requester,
        actorRole: input.requesterRole,
        targetRole: input.requiredApproverRoles[0] ?? input.requesterRole,
        approvalId: approval.id,
        reason: input.reason,
        correlationId: approval.id,
      });
      emitRoleEvent({
        projectId: item.projectId,
        workItemId: item.id,
        runId: approval.runId,
        stepId: approval.stepId,
        type: 'approval.assigned',
        actor: input.requester,
        actorRole: input.requesterRole,
        targetRole: input.requiredApproverRoles[0] ?? input.requesterRole,
        approvalId: approval.id,
        reason: 'assigned',
        correlationId: approval.id,
      });
      if (input.runId !== undefined && input.stepId !== undefined) {
        patchStep(input.runId, input.stepId, {
          approvalId: approval.id,
          status: 'waiting_for_approval',
          reason: 'waiting for approval',
        });
        replaceRunStatus(input.runId, 'waiting_for_approval');
      }
      postChannel(item.projectId, item.id, `approval.requested ${input.kind}`, input.requesterRole);
      persist();
      return approval;
    },
    decideApproval(approvalId, input) {
      const approval = approvals.find((item) => item.id === approvalId);
      if (approval === undefined) throw new WorkflowError('NOT_FOUND', `approval not found: ${approvalId}`);
      if (approval.status !== 'pending' && approval.status !== 'delegated' && approval.status !== 'revision_requested') {
        throw new WorkflowError('APPROVAL', `approval ${approvalId} is not open`);
      }
      if (!approval.allowedDecisionRoles.includes(input.actorRole)) {
        throw new WorkflowError('AUTHORITY', `role ${input.actorRole} cannot decide this approval`);
      }
      const status =
        input.decision === 'approve'
          ? 'approved'
          : input.decision === 'reject'
            ? 'rejected'
            : input.decision === 'delegate'
              ? 'delegated'
              : 'revision_requested';
      const eventType: RoleEventType =
        input.decision === 'approve'
          ? 'approval.approved'
          : input.decision === 'reject'
            ? 'approval.rejected'
            : input.decision === 'delegate'
              ? 'approval.delegated'
              : 'approval.revision_requested';
      const next: ApprovalRequest = {
        ...approval,
        status,
        decidedBy: input.actor,
        decidedRole: input.actorRole,
        decidedReason: input.reason,
        allowedDecisionRoles:
          input.decision === 'delegate' && input.delegateRole !== undefined
            ? [input.delegateRole]
            : approval.allowedDecisionRoles,
        updatedAt: Date.now(),
      };
      approvals = approvals.map((item) => (item.id === approvalId ? next : item));
      emitRoleEvent({
        projectId: next.projectId,
        workItemId: next.workItemId,
        runId: next.runId,
        stepId: next.stepId,
        type: eventType,
        actor: input.actor,
        actorRole: input.actorRole,
        targetRole: next.allowedDecisionRoles[0] ?? input.actorRole,
        approvalId: next.id,
        reason: input.reason,
        correlationId: next.id,
      });
      if (next.runId !== null && next.stepId !== null) {
        if (status === 'approved') {
          patchStep(next.runId, next.stepId, { status: 'ready', reason: 'approval granted' });
          recomputeRun(next.runId);
        } else if (status === 'rejected') {
          patchStep(next.runId, next.stepId, { status: 'blocked', reason: input.reason });
          replaceRunStatus(next.runId, 'blocked');
        }
      }
      postChannel(approval.projectId, approval.workItemId, `${eventType} ${approval.kind}`, input.actorRole);
      persist();
      return next;
    },
    listApprovals(projectId) {
      return approvals.filter((item) => item.projectId === projectId);
    },
    listRoleEvents(runId) {
      requireRun(runId);
      return events.filter((event) => event.runId === runId);
    },
    createReview(input) {
      const item = requireWorkItem(input.workItemId);
      if (input.requiredReviewerRoles.length === 0) {
        throw new WorkflowError('VALIDATION', 'requiredReviewerRoles cannot be empty');
      }
      const now = Date.now();
      const review: ReviewRequest = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId: item.id,
        runId: input.runId ?? null,
        stepId: input.stepId ?? null,
        requester: input.requester,
        requesterRole: input.requesterRole,
        requiredReviewerRoles: input.requiredReviewerRoles,
        status: 'pending',
        reason: input.reason,
        completedBy: null,
        completedRole: null,
        completedReason: '',
        createdAt: now,
        updatedAt: now,
      };
      reviews = [...reviews, review];
      emitRoleEvent({
        projectId: item.projectId,
        workItemId: item.id,
        runId: review.runId,
        stepId: review.stepId,
        type: 'review.requested',
        actor: input.requester,
        actorRole: input.requesterRole,
        targetRole: input.requiredReviewerRoles[0] ?? input.requesterRole,
        approvalId: null,
        reason: input.reason,
        correlationId: review.id,
      });
      emitRoleEvent({
        projectId: item.projectId,
        workItemId: item.id,
        runId: review.runId,
        stepId: review.stepId,
        type: 'review.assigned',
        actor: input.requester,
        actorRole: input.requesterRole,
        targetRole: input.requiredReviewerRoles[0] ?? input.requesterRole,
        approvalId: null,
        reason: 'assigned',
        correlationId: review.id,
      });
      if (input.runId !== undefined && input.stepId !== undefined) {
        patchStep(input.runId, input.stepId, {
          status: 'waiting_for_input',
          reason: 'waiting for review',
        });
      }
      postChannel(item.projectId, item.id, `review.requested ${input.reason}`, input.requesterRole);
      persist();
      return review;
    },
    completeReview(reviewId, input) {
      const review = reviews.find((item) => item.id === reviewId);
      if (review === undefined) throw new WorkflowError('NOT_FOUND', `review not found: ${reviewId}`);
      if (review.status !== 'pending') {
        throw new WorkflowError('VALIDATION', `review ${reviewId} is not pending`);
      }
      if (!review.requiredReviewerRoles.includes(input.actorRole)) {
        recordRejection({
          projectId: review.projectId,
          workItemId: review.workItemId,
          runId: review.runId ?? '',
          stepId: review.stepId,
          actor: input.actor,
          actorRole: input.actorRole,
          eventType: 'review.completed',
          reason: `role ${input.actorRole} cannot complete this review`,
          currentState: review.status,
        });
        persist();
        throw new WorkflowError('AUTHORITY', `role ${input.actorRole} cannot complete this review`);
      }
      const next: ReviewRequest = {
        ...review,
        status: 'completed',
        completedBy: input.actor,
        completedRole: input.actorRole,
        completedReason: input.reason,
        updatedAt: Date.now(),
      };
      reviews = reviews.map((item) => (item.id === reviewId ? next : item));
      emitRoleEvent({
        projectId: next.projectId,
        workItemId: next.workItemId,
        runId: next.runId,
        stepId: next.stepId,
        type: 'review.completed',
        actor: input.actor,
        actorRole: input.actorRole,
        targetRole: input.actorRole,
        approvalId: null,
        reason: input.reason,
        correlationId: next.id,
      });
      if (next.runId !== null && next.stepId !== null) {
        const run = requireRun(next.runId);
        const step = run.steps.find((item) => item.id === next.stepId);
        if (step !== undefined && (step.status === 'waiting_for_input' || step.kind === 'review-only')) {
          finishStep(run, step, input.actor, input.reason);
        }
      }
      postChannel(next.projectId, next.workItemId, `review.completed ${input.reason}`, input.actorRole);
      persist();
      return next;
    },
    listReviews(projectId) {
      return reviews.filter((item) => item.projectId === projectId);
    },
    requestHandoff(runId, input) {
      if (input.toOwner.trim() === '' || input.toRole.trim() === '') {
        throw new WorkflowError('VALIDATION', 'handoff target owner and role are required');
      }
      const run = requireRun(runId);
      const step = input.stepId === undefined
        ? run.steps.find((item) => item.status === 'running') ?? run.steps[0]
        : run.steps.find((item) => item.id === input.stepId);
      if (step === undefined) throw new WorkflowError('NOT_FOUND', `step not found: ${input.stepId ?? ''}`);
      const now = Date.now();
      const handoff: WorkflowHandoff = {
        id: randomUUID(),
        projectId: run.projectId,
        workItemId: run.workItemId,
        runId,
        stepId: step.id,
        fromOwner: step.owner,
        fromRole: input.fromRole,
        toOwner: input.toOwner,
        toRole: input.toRole,
        status: 'pending',
        reason: input.reason,
        decidedBy: null,
        decidedReason: '',
        createdAt: now,
        updatedAt: now,
      };
      handoffs = [...handoffs, handoff];
      emitRoleEvent({
        projectId: run.projectId,
        workItemId: run.workItemId,
        runId,
        stepId: step.id,
        type: 'handoff.requested',
        actor: input.actor,
        actorRole: input.fromRole,
        targetRole: input.toRole,
        approvalId: null,
        reason: input.reason,
        correlationId: handoff.id,
      });
      postChannel(run.projectId, run.workItemId, `handoff.requested ${step.title} -> ${input.toOwner}`, input.fromRole);
      persist();
      return handoff;
    },
    acceptHandoff(handoffId, input) {
      const handoff = requireHandoff(handoffId);
      if (handoff.status !== 'pending') {
        recordRejection({
          projectId: handoff.projectId,
          workItemId: handoff.workItemId,
          runId: handoff.runId,
          stepId: handoff.stepId,
          actor: input.actor,
          actorRole: input.actorRole,
          eventType: 'handoff.accepted',
          reason: `handoff ${handoffId} is ${handoff.status}`,
          currentState: handoff.status,
        });
        persist();
        throw new WorkflowError('VALIDATION', `handoff ${handoffId} is not pending`);
      }
      if (input.actor !== handoff.toOwner && input.actorRole !== handoff.toRole) {
        recordRejection({
          projectId: handoff.projectId,
          workItemId: handoff.workItemId,
          runId: handoff.runId,
          stepId: handoff.stepId,
          actor: input.actor,
          actorRole: input.actorRole,
          eventType: 'handoff.accepted',
          reason: `role ${input.actorRole} cannot accept this handoff`,
          currentState: handoff.status,
        });
        persist();
        throw new WorkflowError('AUTHORITY', `role ${input.actorRole} cannot accept this handoff`);
      }
      const next: WorkflowHandoff = {
        ...handoff,
        status: 'accepted',
        decidedBy: input.actor,
        decidedReason: input.reason,
        updatedAt: Date.now(),
      };
      handoffs = handoffs.map((item) => (item.id === handoffId ? next : item));
      if (handoff.stepId !== null) {
        patchStep(handoff.runId, handoff.stepId, { owner: handoff.toOwner, reason: `handoff accepted by ${input.actor}` });
      }
      replaceRun({ ...requireRun(handoff.runId), owner: handoff.toOwner, updatedAt: Date.now() });
      emitRoleEvent({
        projectId: handoff.projectId,
        workItemId: handoff.workItemId,
        runId: handoff.runId,
        stepId: handoff.stepId,
        type: 'handoff.accepted',
        actor: input.actor,
        actorRole: input.actorRole,
        targetRole: handoff.toRole,
        approvalId: null,
        reason: input.reason,
        correlationId: handoff.id,
      });
      appendTimeline(handoff.runId, handoff.stepId, Date.now(), 'handoff', `${handoff.fromOwner} -> ${handoff.toOwner}`);
      persist();
      return next;
    },
    rejectHandoff(handoffId, input) {
      const handoff = requireHandoff(handoffId);
      if (handoff.status !== 'pending') {
        throw new WorkflowError('VALIDATION', `handoff ${handoffId} is not pending`);
      }
      const next: WorkflowHandoff = {
        ...handoff,
        status: 'rejected',
        decidedBy: input.actor,
        decidedReason: input.reason,
        updatedAt: Date.now(),
      };
      handoffs = handoffs.map((item) => (item.id === handoffId ? next : item));
      recordRejection({
        projectId: handoff.projectId,
        workItemId: handoff.workItemId,
        runId: handoff.runId,
        stepId: handoff.stepId,
        actor: input.actor,
        actorRole: input.actorRole,
        eventType: 'handoff.rejected',
        reason: input.reason,
        currentState: requireRun(handoff.runId).status,
      });
      emitRoleEvent({
        projectId: handoff.projectId,
        workItemId: handoff.workItemId,
        runId: handoff.runId,
        stepId: handoff.stepId,
        type: 'handoff.rejected',
        actor: input.actor,
        actorRole: input.actorRole,
        targetRole: handoff.toRole,
        approvalId: null,
        reason: input.reason,
        correlationId: handoff.id,
      });
      persist();
      return next;
    },
    listHandoffs(runId) {
      requireRun(runId);
      return handoffs.filter((item) => item.runId === runId);
    },
    listRejections(runId) {
      requireRun(runId);
      return rejections.filter((item) => item.runId === runId);
    },
    projectRollups(projectId) {
      deps.board.listProjects().find((project) => project.id === projectId)
        ?? fail(`project not found: ${projectId}`);
      return buildRollups(projectId);
    },
  };
  return service;

  function recognizeDeps() {
    return {
      board: deps.board,
      ...(deps.collab !== undefined ? { collab: deps.collab } : {}),
      ...(deps.dispatch !== undefined ? { dispatch: deps.dispatch } : {}),
      ...(deps.scm !== undefined ? { scm: deps.scm } : {}),
      ...(deps.skills !== undefined ? { skills: deps.skills } : {}),
    };
  }

  function currentStep(run: WorkflowRun): WorkflowPlanStep | null {
    return run.steps.find((step) =>
      step.status === 'running'
      || step.status === 'scheduled'
      || step.status === 'ready'
      || step.status === 'queued'
      || step.status === 'blocked'
      || step.status === 'waiting_for_approval',
    ) ?? run.steps[0] ?? null;
  }

  function emitRecognitionChat(run: WorkflowRun, step: WorkflowPlanStep, recognition: StepStateRecognition): void {
    const body = recognition.allowed
      ? `state recognition changed next action to ${recognition.nextSafeAction} for ${step.title}`
      : `state recognition blocked ${step.title}: ${recognition.reason}; next safe action is ${recognition.nextSafeAction}`;
    postChannel(run.projectId, run.workItemId, body, 'workflow');
  }

  function persist(): void {
    const snapshot: WorkflowSnapshot = {
      schemaVersion: 1,
      templates: templates.filter((item) => item.builtin === false),
      selections,
      runs,
      approvals,
      events,
      decisions,
      timeline,
      reviews,
      handoffs,
      rejections,
      recognitions,
      canvases,
      testCases,
      testRuns,
      packs,
      conformanceReports,
      eventTypes,
      nodeTypes,
      extensions: extensionPackages,
      catalogEvents,
      enabledPacks,
      templateSnapshots,
    };
    saveWorkflowSnapshot(deps.workspaceRoot, snapshot);
  }

  function recordSnapshot(template: WorkflowTemplate): void {
    if (templateSnapshots.some((item) => item.templateId === template.id && item.version === template.version)) {
      return;
    }
    templateSnapshots = [...templateSnapshots, snapshotFrom(template)];
  }

  function requireTestRun(runId: string): WorkflowTestRun {
    const run = testRuns.find((item) => item.id === runId);
    if (run === undefined) throw new WorkflowError('NOT_FOUND', `workflow test run not found: ${runId}`);
    return normalizeTestRun(run);
  }

  function normalizeTestRun(run: WorkflowTestRun): WorkflowTestRun {
    return {
      ...run,
      templateVersion: run.templateVersion ?? '',
      packVersion: run.packVersion ?? null,
      fixtureVersion: run.fixtureVersion ?? '1.0.0',
      schedulerVersion: run.schedulerVersion ?? '1.0.0',
      conformanceRunId: run.conformanceRunId ?? null,
    };
  }

  function requirePack(packId: string): WorkflowPack {
    const found = packs.find((item) => item.id === packId);
    if (found === undefined) throw new WorkflowError('NOT_FOUND', `workflow pack not found: ${packId}`);
    return found;
  }

  function packHasPassed(packId: string | null): boolean {
    if (packId === null) return true;
    const latest = [...conformanceReports].reverse().find((item) => item.packId === packId);
    return latest !== undefined && latest.status === 'passed';
  }

  function conformedNodeTypeIds(): readonly string[] {
    return nodeTypes.filter((item) => item.origin === 'custom' && packHasPassed(item.packId)).map((item) => item.id);
  }

  function assertMutableTemplate(templateId: string): WorkflowTemplate {
    const template = requireTemplate(templateId);
    if (template.builtin) {
      throw new WorkflowError('BUILTIN', `built-in template ${templateId} cannot be edited in place`);
    }
    if (template.state === 'archived') {
      throw new WorkflowError('VALIDATION', `template ${templateId} is archived`);
    }
    return template;
  }

  function writeTemplate(next: WorkflowTemplate): void {
    templates = templates.map((item) => (item.id === next.id ? next : item));
  }

  function bumpPatch(version: string): string {
    const parts = version.split('.');
    const major = Number(parts[0] ?? 1);
    const minor = Number(parts[1] ?? 0);
    const patch = Number(parts[2] ?? 0);
    return `${Number.isFinite(major) ? major : 1}.${Number.isFinite(minor) ? minor : 0}.${(Number.isFinite(patch) ? patch : 0) + 1}`;
  }

  function requireCapability(capabilityId: string): WorkflowCapability {
    const found = BUILTIN_CAPABILITIES.find((item) => item.id === capabilityId);
    if (found === undefined) throw new WorkflowError('NOT_FOUND', `capability not found: ${capabilityId}`);
    return found;
  }

  function requireTemplate(templateId: string): WorkflowTemplate {
    const found = templates.find((item) => item.id === templateId);
    if (found === undefined) throw new WorkflowError('NOT_FOUND', `template not found: ${templateId}`);
    return found;
  }

  function requireWorkItem(workItemId: WorkItemId) {
    const item = deps.board.getWorkItem(workItemId);
    if (item === undefined) throw new WorkflowError('NOT_FOUND', `work item not found: ${workItemId}`);
    return item;
  }

  function requireRun(runId: string): WorkflowRun {
    const run = runs.find((item) => item.id === runId);
    if (run === undefined) throw new WorkflowError('NOT_FOUND', `workflow run not found: ${runId}`);
    return run;
  }

  function selectionFor(projectId: ProjectId) {
    return (
      normalizeSelection(
        selections.find((item) => item.projectId === projectId) ?? {
          projectId,
          templateId: DEFAULT_TEMPLATE_ID,
          disabledCapabilityIds: [],
          previousTemplateId: null,
          lastReplaceMode: null,
        },
      )
    );
  }

  function writeSelection(next: {
    readonly projectId: ProjectId;
    readonly templateId: string;
    readonly disabledCapabilityIds: readonly string[];
    readonly previousTemplateId: string | null;
    readonly lastReplaceMode: TemplateReplaceMode | null;
  }): void {
    const index = selections.findIndex((item) => item.projectId === next.projectId);
    if (index < 0) {
      selections = [...selections, next];
      return;
    }
    selections = selections.map((item, current) => (current === index ? next : item));
  }

  function inspect(workItemId: WorkItemId, to: WorkItemStatus): GateInspection {
    const item = requireWorkItem(workItemId);
    const template = service.selectedTemplate(item.projectId);
    const missing: GateMissingItem[] = [];
    const policy = deps.board.listProjects({ includeArchived: true }).find((project) => project.id === item.projectId)?.deliveryPolicy;
    const evidence = deps.board.getDeliveryEvidenceSummary(item.id);
    const children = deps.board.listWorkItems({ projectId: item.projectId }).filter((child) => child.parentId === item.id);
    const error = validateWorkItemTransition(item, to, {
      evidence,
      children,
      ...(policy !== undefined ? { policy } : {}),
    });
    if (error !== null) {
      missing.push({
        kind: error.kind === 'forbidden_transition'
          ? 'lifecycle'
          : error.kind.endsWith('_for_done')
            ? 'evidence'
            : 'field',
        code: error.kind,
        message: explain(error),
      });
    }
    const stage = template.stages.find((itemStage) => itemStage.status === to);
    if (stage !== undefined) {
      for (const field of stage.requiredFields) {
        if (!hasField(item, field)) {
          missing.push({ kind: 'field', code: `missing_${field}`, message: `missing field ${field}` });
        }
      }
      if (stage.requiredEvidence.includes('evaluator')) {
        const evidence = deps.board.getDeliveryEvidenceSummary(item.id);
        if (!hasExecutedDeliveryEvidence(evidence, item)) {
          missing.push({ kind: 'evidence', code: 'missing_evaluator_evidence', message: 'missing executed evaluator evidence' });
        }
      }
      if (stage.requiredReviews.length > 0) {
        const openReviews = events.filter(
          (event) => event.workItemId === item.id && event.type === 'review.requested',
        );
        const completed = events.filter(
          (event) => event.workItemId === item.id && (event.type === 'review.completed' || event.type === 'review.approved'),
        );
        if (openReviews.length > completed.length && to === 'delivered') {
          missing.push({ kind: 'review', code: 'missing_review', message: 'required review is incomplete' });
        }
      }
      for (const kind of stage.requiredApprovals) {
        const granted = approvals.some(
          (approval) =>
            approval.workItemId === item.id &&
            approval.kind === kind &&
            approval.status === 'approved',
        );
        if (!granted) {
          missing.push({ kind: 'approval', code: `missing_${kind}`, message: `missing ${kind} approval` });
        }
      }
    }
    const unique = uniqueMissing(missing);
    return {
      workItemId: item.id,
      from: item.status,
      to,
      allowed: unique.length === 0,
      missing: unique,
      stages: template.stages,
    };
  }

  function assertOrchestrationReady(run: WorkflowRun, step: WorkflowPlanStep, actor: string): void {
    const item = deps.board.getWorkItem(run.workItemId);
    if (item === undefined) return;
    if (item.assignee.trim() !== '') {
      const capacity = deps.board.getTeamCapacity(item.projectId);
      const summary = capacity.members.find((row) => row.member.id === item.assignee);
      if (summary?.overLimit === true) {
        throw new WorkflowError('NOT_READY', `assignee exceeds WIP limit before starting ${step.id}`);
      }
    }
    if (deps.dispatch !== undefined) {
      const exclusive = deps.dispatch.listLeases(item.projectId).filter(
        (lease) =>
          lease.workItemId === item.id &&
          lease.mode === 'exclusive_write' &&
          lease.ownerId !== actor &&
          lease.ownerId !== step.owner,
      );
      if (exclusive.length > 0) {
        throw new WorkflowError('NOT_READY', `exclusive lease is held by ${exclusive[0]?.ownerId ?? 'another owner'}`);
      }
    }
    if (deps.scm !== undefined) {
      const foreign = deps.scm.listBranches({ workItemId: item.id }).filter((branch) => {
        const owner = branch.owner.trim();
        return owner !== '' && owner !== actor && owner !== item.assignee && owner !== step.owner;
      });
      if (foreign.length > 0) {
        throw new WorkflowError(
          'NOT_READY',
          `branch ${foreign[0]?.name ?? ''} is owned by ${foreign[0]?.owner ?? 'another member'}`,
        );
      }
    }
  }

  function startStep(run: WorkflowRun, step: WorkflowPlanStep, actor: string): void {
    if (step.kind === 'review-only') {
      const existing = reviews.find(
        (item) => item.stepId === step.id && item.status === 'pending',
      );
      if (existing === undefined) {
        service.createReview({
          workItemId: run.workItemId,
          requester: actor,
          requesterRole: actor,
          requiredReviewerRoles: ['developer'],
          reason: step.title,
          runId: run.id,
          stepId: step.id,
        });
        return;
      }
      throw new WorkflowError('VALIDATION', `step ${step.id} is waiting for review`);
    }
    if (step.kind === 'approval-required') {
      const existing = approvals.find(
        (item) => item.stepId === step.id && (item.status === 'pending' || item.status === 'delegated' || item.status === 'revision_requested'),
      );
      if (existing === undefined) {
        service.createApproval({
          workItemId: run.workItemId,
          kind: step.approvalKind ?? 'requirement_acceptance',
          requester: actor,
          requesterRole: actor,
          requiredApproverRoles: ['developer'],
          reason: step.title,
          runId: run.id,
          stepId: step.id,
        });
        return;
      }
      throw new WorkflowError('APPROVAL', `step ${step.id} is waiting for approval`);
    }
    let collaborationTaskId = step.collaborationTaskId;
    if (deps.collab !== undefined && (step.role === 'planner' || step.role === 'generator' || step.role === 'evaluator')) {
      const conversation = deps.collab.listConversations(run.projectId)[0]
        ?? deps.collab.createConversation({ projectId: run.projectId, title: 'Agent Channel' });
      const message = deps.collab.postMessage(conversation.id, {
        type: 'task.propose',
        from: { kind: 'system', role: 'workflow' },
        payload: {
          objective: step.title,
          assigneeRole: step.role,
          requiredSkills: step.requiredSkills.length > 0 ? step.requiredSkills : ['planner.delivery-contract'],
          allowedTools: step.allowedTools.length > 0 ? step.allowedTools : ['delivery-contract.write'],
          expectedOutput: step.title,
          checks: step.checks.length > 0 ? step.checks : ['has-acceptance'],
        },
        refs: { workItemId: run.workItemId, taskId: step.id },
      });
      collaborationTaskId = String(message.payload.taskId ?? '');
    }
    patchStep(run.id, step.id, {
      status: 'running',
      owner: actor,
      collaborationTaskId,
      reason: 'started',
    });
    recordDecision(run.id, step.id, step.status, 'running', 'dependencies and gates allow start');
    replaceRun({ ...requireRun(run.id), status: 'running', owner: actor, nextAction: `Complete ${step.title}`, updatedAt: Date.now() });
    appendTimeline(run.id, step.id, Date.now(), 'started', `${step.title} started by ${actor}`);
    syncSummary(requireRun(run.id));
  }

  function recomputeRun(runId: string): WorkflowRun {
    const run = requireRun(runId);
    if (run.status === 'cancelled' || run.status === 'completed' || run.status === 'paused') return run;
    const byTemplate = new Map(run.steps.map((step) => [step.templateStepId, step]));
    const nextSteps = run.steps.map((step) => {
      if (isTerminalStep(step.status) || step.status === 'running' || step.status === 'retrying') return step;
      const depsReady = step.dependsOn.every((id) => dependencySatisfied(byTemplate.get(id)));
      if (!depsReady) {
        return maybeStatus(run.id, step, 'pending', 'waiting for dependencies');
      }
      if (step.kind === 'recurring' && step.occurrence > 0 && step.intervalMs !== null && step.intervalMs > 0) {
        const elapsed = Date.now() - (step.lastCompletedAt ?? 0);
        if (elapsed < step.intervalMs) {
          return maybeStatus(run.id, step, 'pending', 'waiting for recurrence interval');
        }
        return maybeStatus(run.id, step, 'scheduled', `recurring occurrence ${step.occurrence + 1}`);
      }
      if (step.kind === 'event-triggered') {
        if (step.status === 'scheduled' || step.status === 'ready') return step;
        return maybeStatus(run.id, step, 'queued', `waiting for event ${step.triggerEvent ?? ''}`);
      }
      if (step.kind === 'review-only') {
        const pendingReview = reviews.some((review) => review.stepId === step.id && review.status === 'pending');
        if (pendingReview) return maybeStatus(run.id, step, 'waiting_for_input', 'waiting for review');
      }
      if (step.kind === 'approval-required') {
        const granted = approvals.some(
          (approval) => approval.stepId === step.id && approval.status === 'approved',
        );
        const pending = approvals.some(
          (approval) => approval.stepId === step.id && (approval.status === 'pending' || approval.status === 'delegated' || approval.status === 'revision_requested'),
        );
        if (granted) return maybeStatus(run.id, step, 'ready', 'approval granted');
        if (pending) return maybeStatus(run.id, step, 'waiting_for_approval', 'waiting for approval');
        return maybeStatus(run.id, step, 'queued', 'approval required before start');
      }
      const disabled = selectionFor(run.projectId).disabledCapabilityIds.includes(step.capabilityId);
      if (disabled) return maybeStatus(run.id, step, 'blocked', `capability ${step.capabilityId} is disabled`);
      return maybeStatus(run.id, step, 'scheduled', 'dependencies satisfied');
    });
    const waiting = nextSteps.some((step) => step.status === 'waiting_for_approval');
    const blocked = nextSteps.some((step) => step.status === 'blocked');
    const allDone = nextSteps.every((step) => step.status === 'completed' || step.status === 'skipped');
    const status: WorkflowRunStatus = allDone
      ? 'completed'
      : blocked
        ? 'blocked'
        : waiting
          ? 'waiting_for_approval'
          : 'running';
    const nextReady = nextSteps.find((step) => step.status === 'scheduled' || step.status === 'ready' || step.status === 'queued');
    const next: WorkflowRun = {
      ...run,
      steps: nextSteps,
      status: run.status === 'planned' && status === 'running' ? 'planned' : status,
      nextAction: nextReady !== undefined ? `Start ${nextReady.title}` : allDone ? 'Workflow complete' : 'Wait for approvals or blockers',
      updatedAt: Date.now(),
    };
    replaceRun(next);
    syncSummary(next);
    return next;
  }

  function maybeStatus(
    runId: string,
    step: WorkflowPlanStep,
    status: WorkflowStepStatus,
    reason: string,
  ): WorkflowPlanStep {
    if (step.status === status && step.reason === reason) return step;
    recordDecision(runId, step.id, step.status, status, reason);
    return { ...step, status, reason };
  }

  function patchStep(runId: string, stepId: string, patch: Partial<WorkflowPlanStep>): void {
    const run = requireRun(runId);
    replaceRun({
      ...run,
      steps: run.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
      updatedAt: Date.now(),
    });
  }

  function replaceRun(next: WorkflowRun): void {
    runs = runs.map((item) => (item.id === next.id ? next : item));
  }

  function replaceRunStatus(runId: string, status: WorkflowRunStatus): void {
    const run = requireRun(runId);
    replaceRun({ ...run, status, updatedAt: Date.now() });
  }

  function setRunStatus(runId: string, status: WorkflowRunStatus, actor: string, kind: string): WorkflowRun {
    const run = requireRun(runId);
    replaceRun({ ...run, status, owner: actor, updatedAt: Date.now() });
    appendTimeline(run.id, null, Date.now(), kind, `${kind} by ${actor}`);
    persist();
    return requireRun(runId);
  }

  function recordDecision(
    runId: string,
    stepId: string,
    fromStatus: WorkflowStepStatus,
    toStatus: WorkflowStepStatus,
    reason: string,
  ): void {
    if (fromStatus === toStatus) return;
    decisions = [
      ...decisions,
      {
        id: randomUUID(),
        runId,
        stepId,
        at: Date.now(),
        fromStatus,
        toStatus,
        reason,
      },
    ];
  }

  function appendTimeline(
    runId: string,
    stepId: string | null,
    at: number,
    kind: string,
    message: string,
  ): void {
    timeline = [...timeline, { id: randomUUID(), runId, stepId, at, kind, message }];
  }

  function emitRoleEvent(input: {
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
    readonly correlationId: string;
  }): void {
    events = [
      ...events,
      {
        id: randomUUID(),
        projectId: input.projectId,
        workItemId: input.workItemId,
        runId: input.runId,
        stepId: input.stepId,
        type: input.type,
        actor: input.actor,
        actorRole: input.actorRole,
        targetRole: input.targetRole,
        approvalId: input.approvalId,
        reason: input.reason,
        createdAt: Date.now(),
        correlationId: input.correlationId,
      },
    ];
  }

  function finishStep(run: WorkflowRun, step: WorkflowPlanStep, actor: string, message: string): void {
    const now = Date.now();
    const live = requireRun(run.id);
    if (step.kind === 'recurring' && isOpenRun(live.status)) {
      const occurrence = step.occurrence + 1;
      const nextStatus: WorkflowStepStatus = step.intervalMs !== null && step.intervalMs > 0 ? 'pending' : 'scheduled';
      patchStep(run.id, step.id, {
        status: nextStatus,
        occurrence,
        lastCompletedAt: now,
        reason: `recurring occurrence ${occurrence}`,
      });
      recordDecision(run.id, step.id, step.status, nextStatus, message);
    } else {
      patchStep(run.id, step.id, {
        status: 'completed',
        lastCompletedAt: now,
        reason: message,
      });
      recordDecision(run.id, step.id, step.status, 'completed', message);
    }
    appendTimeline(run.id, step.id, now, 'completed', `${actor}: ${message}`);
    recomputeRun(run.id);
  }

  function buildReplacePreview(projectId: ProjectId, templateId: string): TemplateReplacePreview {
    const from = service.selectedTemplate(projectId);
    const to = requireTemplate(templateId);
    const fromSteps = new Map(from.steps.map((step) => [step.id, step]));
    const toSteps = new Map(to.steps.map((step) => [step.id, step]));
    const addedSteps = to.steps.filter((step) => !fromSteps.has(step.id)).map((step) => step.id);
    const removedSteps = from.steps.filter((step) => !toSteps.has(step.id)).map((step) => step.id);
    const changedSteps = to.steps
      .filter((step) => {
        const previous = fromSteps.get(step.id);
        return previous !== undefined && JSON.stringify(stepSignature(previous)) !== JSON.stringify(stepSignature(step));
      })
      .map((step) => step.id);
    const fromStages = new Map(from.stages.map((stage) => [stage.id, stage]));
    const changedStages = [
      ...to.stages
        .filter((stage) => JSON.stringify(fromStages.get(stage.id) ?? null) !== JSON.stringify(stage))
        .map((stage) => stage.id),
      ...from.stages.filter((stage) => to.stages.every((item) => item.id !== stage.id)).map((stage) => stage.id),
    ];
    const changedGates = to.stages
      .filter((stage) => {
        const previous = fromStages.get(stage.id);
        if (previous === undefined) return true;
        return JSON.stringify({
          requiredFields: previous.requiredFields,
          requiredEvidence: previous.requiredEvidence,
          requiredReviews: previous.requiredReviews,
          requiredApprovals: previous.requiredApprovals,
        }) !== JSON.stringify({
          requiredFields: stage.requiredFields,
          requiredEvidence: stage.requiredEvidence,
          requiredReviews: stage.requiredReviews,
          requiredApprovals: stage.requiredApprovals,
        });
      })
      .map((stage) => stage.id);
    const changedApprovals = to.steps
      .filter((step) => fromSteps.get(step.id)?.approvalKind !== step.approvalKind)
      .map((step) => step.id);
    const changedBindings = to.steps
      .filter((step) => {
        const previous = fromSteps.get(step.id);
        if (previous === undefined) return true;
        return previous.role !== step.role
          || previous.capabilityId !== step.capabilityId
          || JSON.stringify(previous.requiredSkills) !== JSON.stringify(step.requiredSkills)
          || JSON.stringify(previous.allowedTools) !== JSON.stringify(step.allowedTools);
      })
      .map((step) => step.id);
    const activeRunIds = runs
      .filter((run) => run.projectId === projectId && isOpenRun(run.status))
      .map((run) => run.id);
    return {
      fromTemplateId: from.id,
      fromVersion: from.version,
      toTemplateId: to.id,
      toVersion: to.version,
      changedStages,
      addedSteps,
      removedSteps,
      changedSteps,
      changedGates,
      changedApprovals,
      changedBindings,
      activeRunIds,
      impact: activeRunIds.length === 0 ? 'no active runs' : `${String(activeRunIds.length)} active run(s) may be affected`,
    };
  }

  function applyTemplateReplace(
    projectId: ProjectId,
    input: {
      readonly templateId: string;
      readonly mode: TemplateReplaceMode;
      readonly actor: string;
      readonly workItemIds?: readonly WorkItemId[];
      readonly dryRun: boolean;
      readonly rollback?: boolean;
    },
  ): TemplateReplaceResult {
    if (!TEMPLATE_REPLACE_MODES.includes(input.mode)) {
      throw new WorkflowError('VALIDATION', `invalid replace mode: ${input.mode}`);
    }
    deps.board.listProjects().find((project) => project.id === projectId)
      ?? fail(`project not found: ${projectId}`);
    const current = selectionFor(projectId);
    const from = requireTemplate(current.templateId);
    const to = requireTemplate(input.templateId);
    if (from.id === to.id) {
      throw new WorkflowError('VALIDATION', 'replacement template is already selected');
    }
    const preview = buildReplacePreview(projectId, to.id);
    if (input.dryRun) {
      return { template: to, preview, migratedRunIds: [], dryRun: true };
    }
    let migratedRunIds: string[] = [];
    if (input.mode === 'selected') {
      const ids = input.workItemIds ?? [];
      if (ids.length === 0) throw new WorkflowError('VALIDATION', 'selected replacement requires workItemIds');
      migratedRunIds = migrateOpenRuns(from, to, (run) => run.projectId === projectId && ids.includes(run.workItemId));
    } else if (input.mode === 'migrate-active') {
      migratedRunIds = migrateOpenRuns(from, to, (run) => run.projectId === projectId);
    }
    writeSelection({
      ...current,
      templateId: to.id,
      previousTemplateId: from.id,
      lastReplaceMode: input.mode,
    });
    deps.board.recordAuditEvent({
      projectId,
      actorId: input.actor,
      action: input.rollback === true ? 'workflow_template.rollback' : 'workflow_template.replaced',
      targetType: 'workflow_template',
      targetId: to.id,
      targetLabel: to.title,
      changedFields: ['templateId', 'mode'],
      reason: `${from.id} -> ${to.id} (${input.mode})`,
    });
    persist();
    return { template: to, preview, migratedRunIds, dryRun: false };
  }

  function migrateOpenRuns(
    from: WorkflowTemplate,
    to: WorkflowTemplate,
    include: (run: WorkflowRun) => boolean,
  ): string[] {
    const migrated: string[] = [];
    for (const run of runs.filter((item) => isOpenRun(item.status) && include(item))) {
      const byTemplate = new Map(run.steps.map((step) => [step.templateStepId, step]));
      for (const step of run.steps) {
        if (
          !isTerminalStep(step.status)
          && step.status !== 'pending'
          && to.steps.every((item) => item.id !== step.templateStepId)
        ) {
          throw new WorkflowError(
            'TRANSITION',
            `cannot migrate active step ${step.templateStepId} off template ${from.id}`,
          );
        }
      }
      const nextSteps = to.steps.map((templateStep) => {
        const existing = byTemplate.get(templateStep.id);
        if (existing !== undefined) {
          return {
            ...existing,
            title: templateStep.title,
            kind: templateStep.kind,
            role: templateStep.role,
            capabilityId: templateStep.capabilityId,
            requiredSkills: templateStep.requiredSkills,
            allowedTools: templateStep.allowedTools,
            checks: templateStep.checks,
            dependsOn: templateStep.dependsOn,
            approvalKind: templateStep.approvalKind,
            targetStatus: templateStep.targetStatus,
            triggerEvent: templateStep.triggerEvent,
            intervalMs: templateStep.intervalMs,
          };
        }
        return {
          id: randomUUID(),
          templateStepId: templateStep.id,
          title: templateStep.title,
          kind: templateStep.kind,
          role: templateStep.role,
          capabilityId: templateStep.capabilityId,
          requiredSkills: templateStep.requiredSkills,
          allowedTools: templateStep.allowedTools,
          checks: templateStep.checks,
          dependsOn: templateStep.dependsOn,
          approvalKind: templateStep.approvalKind,
          targetStatus: templateStep.targetStatus,
          status: 'pending' as const,
          owner: templateStep.role,
          collaborationTaskId: null,
          approvalId: null,
          reason: 'added by template replacement',
          triggerEvent: templateStep.triggerEvent,
          intervalMs: templateStep.intervalMs,
          occurrence: 0,
          lastCompletedAt: null,
          lastRecognition: null,
        };
      });
      replaceRun({
        ...run,
        templateId: to.id,
        templateVersion: to.version,
        steps: nextSteps,
        updatedAt: Date.now(),
      });
      appendTimeline(run.id, null, Date.now(), 'migrated', `${from.id} -> ${to.id}`);
      recomputeRun(run.id);
      migrated.push(run.id);
    }
    return migrated;
  }

  function requireHandoff(handoffId: string): WorkflowHandoff {
    const found = handoffs.find((item) => item.id === handoffId);
    if (found === undefined) throw new WorkflowError('NOT_FOUND', `handoff not found: ${handoffId}`);
    return found;
  }

  function recordRejection(input: {
    readonly projectId: ProjectId;
    readonly workItemId: WorkItemId | null;
    readonly runId: string;
    readonly stepId: string | null;
    readonly actor: string;
    readonly actorRole: string;
    readonly eventType: string;
    readonly reason: string;
    readonly currentState: string;
  }): void {
    rejections = [
      ...rejections,
      {
        id: randomUUID(),
        projectId: input.projectId,
        workItemId: input.workItemId,
        runId: input.runId,
        stepId: input.stepId,
        at: Date.now(),
        actor: input.actor,
        actorRole: input.actorRole,
        eventType: input.eventType,
        reason: input.reason,
        currentState: input.currentState,
      },
    ];
  }

  function buildRollups(projectId: ProjectId): WorkflowRollups {
    const members = deps.board.listTeamMembers({ projectId });
    const openRuns = runs.filter((run) => run.projectId === projectId && isOpenRun(run.status));
    const activeSteps = openRuns.flatMap((run) => run.steps.filter((step) => isActiveLoad(step.status)));
    const roles = [...new Set(activeSteps.map((step) => step.role))];
    const overloadedRoles = roles.flatMap((role) => {
      const holders = members.filter(
        (member) => member.status === 'active' && member.roleIds.includes(role as RoleId),
      );
      if (holders.length === 0) return [];
      const capacity = holders.reduce((total, member) => total + member.concurrentWorkLimit, 0);
      const active = activeSteps.filter((step) => step.role === role).length;
      return [{
        role,
        activeSteps: active,
        memberCount: holders.length,
        capacity,
        overloaded: active > capacity,
      }];
    });
    const pendingApprovals = approvals.filter(
      (item) =>
        item.projectId === projectId
        && (item.status === 'pending' || item.status === 'delegated' || item.status === 'revision_requested'),
    ).length;
    const pendingReviews = reviews.filter((item) => item.projectId === projectId && item.status === 'pending').length;
    const pendingHandoffs = handoffs.filter((item) => item.projectId === projectId && item.status === 'pending').length;
    const blockedRuns = openRuns.filter((run) => run.status === 'blocked').length;
    const items = deps.board.listWorkItems({ projectId });
    const openStories = items.filter(
      (item) =>
        (item.type === 'requirement' || item.type === 'story')
        && item.status !== 'delivered'
        && item.status !== 'rejected'
        && item.status !== 'stopped',
    );
    let missingEvidence = 0;
    for (const item of items) {
      if (item.status === 'in_review' || item.status === 'verifying' || item.status === 'gates_passing') {
        const evidence = deps.board.getDeliveryEvidenceSummary(item.id);
        if (!hasExecutedDeliveryEvidence(evidence, item)) missingEvidence += 1;
      }
    }
    const reasons: string[] = [];
    if (blockedRuns > 0) reasons.push('blocked runs');
    if (pendingApprovals > 0) reasons.push('pending approvals');
    if (pendingReviews > 0) reasons.push('pending reviews');
    if (pendingHandoffs > 0) reasons.push('pending handoffs');
    if (missingEvidence > 0) reasons.push('missing evidence');
    if (openStories.length > 0) reasons.push('open stories');
    return {
      projectId,
      overloadedRoles,
      releaseReadiness: {
        ready: reasons.length === 0,
        openRuns: openRuns.length,
        blockedRuns,
        pendingApprovals,
        pendingReviews,
        pendingHandoffs,
        missingEvidence,
        openStories: openStories.length,
        reasons,
      },
    };
  }

  function postChannel(projectId: ProjectId, workItemId: WorkItemId, body: string, role: string): void {
    if (deps.collab === undefined) return;
    const conversation = deps.collab.listConversations(projectId)[0]
      ?? deps.collab.createConversation({ projectId, title: 'Agent Channel' });
    deps.collab.postMessage(conversation.id, {
      type: 'note.chat',
      from: { kind: 'system', role },
      payload: { body },
      refs: { workItemId },
    });
  }

  function syncRunAfterTransition(workItemId: WorkItemId, actor: string, message: string): void {
    const run = runs.find((item) => item.workItemId === workItemId && isOpenRun(item.status));
    if (run === undefined) return;
    const current = requireWorkItem(workItemId);
    const matching = run.steps.find((step) => step.targetStatus === current.status && step.status === 'running');
    if (matching !== undefined) {
      finishStep(run, matching, actor, message);
      return;
    }
    appendTimeline(run.id, null, Date.now(), 'transition', `${actor}: ${message}`);
    recomputeRun(run.id);
  }

  function syncSummary(run: WorkflowRun): void {
    const toBoardStep = (step: WorkflowPlanStep) => ({
      id: step.id,
      title: step.title,
      status: toBoardStepStatus(step.status),
      owner: step.owner,
      roleId: null,
      dependsOnStepIds: run.steps
        .filter((item) => step.dependsOn.includes(item.templateStepId))
        .map((item) => item.id),
      reason: step.reason,
      links: [],
    });
    deps.board.updateWorkflowBoardSummary(run.workItemId, {
      workflowRunId: run.id,
      workflowTemplateVersion: run.templateVersion,
      stage: requireWorkItem(run.workItemId).status,
      runStatus: toBoardRunStatus(run.status),
      activeOwner: run.owner,
      nextAction: run.nextAction,
      runningSteps: run.steps.filter((step) => step.status === 'running').map(toBoardStep),
      blockedSteps: run.steps
        .filter((step) => step.status === 'blocked' || step.status === 'waiting_for_approval')
        .map(toBoardStep),
      controls: ['pause', 'resume', 'cancel', 'reassign', 'retry'],
    });
  }
}

function mergeBuiltinTemplates(stored: readonly WorkflowTemplate[]): WorkflowTemplate[] {
  const builtinIds = new Set(BUILTIN_TEMPLATES.map((item) => item.id));
  const custom = stored.filter((item) => item.builtin === false && !builtinIds.has(item.id));
  return [...BUILTIN_TEMPLATES, ...custom];
}

function normalizeTemplate(template: WorkflowTemplate): WorkflowTemplate {
  return {
    ...template,
    steps: template.steps.map((step) => ({
      ...step,
      triggerEvent: step.triggerEvent ?? null,
      intervalMs: step.intervalMs ?? null,
    })),
  };
}

function normalizePlanStep(step: WorkflowPlanStep): WorkflowPlanStep {
  return {
    ...step,
    triggerEvent: step.triggerEvent ?? null,
    intervalMs: step.intervalMs ?? null,
    occurrence: step.occurrence ?? 0,
    lastCompletedAt: step.lastCompletedAt ?? null,
    lastRecognition: step.lastRecognition ?? null,
  };
}

function normalizeRun(run: WorkflowRun): WorkflowRun {
  return { ...run, steps: run.steps.map(normalizePlanStep) };
}

function normalizeSelection(selection: ProjectWorkflowSelection): ProjectWorkflowSelection {
  return {
    ...selection,
    previousTemplateId: selection.previousTemplateId ?? null,
    lastReplaceMode: selection.lastReplaceMode ?? null,
  };
}

function validateImportedSteps(steps: readonly WorkflowTemplateStep[]): void {
  const ids = new Set<string>();
  for (const step of steps) {
    if (step.id.trim() === '') throw new WorkflowError('VALIDATION', 'template step id is required');
    if (ids.has(step.id)) throw new WorkflowError('VALIDATION', `duplicate template step id: ${step.id}`);
    ids.add(step.id);
    if (!WORKFLOW_STEP_KINDS.includes(step.kind)) {
      throw new WorkflowError('VALIDATION', `unknown step kind: ${step.kind}`);
    }
  }
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      if (!ids.has(dep)) throw new WorkflowError('VALIDATION', `unknown dependency ${dep} on step ${step.id}`);
    }
  }
}

function stepSignature(step: WorkflowTemplateStep): unknown {
  return {
    title: step.title,
    kind: step.kind,
    role: step.role,
    capabilityId: step.capabilityId,
    requiredSkills: step.requiredSkills,
    allowedTools: step.allowedTools,
    checks: step.checks,
    dependsOn: step.dependsOn,
    approvalKind: step.approvalKind,
    targetStatus: step.targetStatus,
    triggerEvent: step.triggerEvent,
    intervalMs: step.intervalMs,
  };
}

function dependencySatisfied(step: WorkflowPlanStep | undefined): boolean {
  if (step === undefined) return false;
  if (step.kind === 'recurring') return step.occurrence > 0 || step.status === 'completed';
  return step.status === 'completed';
}

function isActiveLoad(status: WorkflowStepStatus): boolean {
  return (
    status === 'running'
    || status === 'queued'
    || status === 'scheduled'
    || status === 'ready'
    || status === 'waiting_for_approval'
    || status === 'waiting_for_input'
    || status === 'retrying'
  );
}

function isOpenRun(status: WorkflowRunStatus): boolean {
  return status === 'planned' || status === 'running' || status === 'paused' || status === 'blocked' || status === 'waiting_for_approval';
}

function isTerminalStep(status: WorkflowStepStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'skipped' || status === 'cancelled';
}

function hasField(item: { readonly title: string; readonly body: string; readonly analysis: string; readonly design: string; readonly acceptance: readonly string[]; readonly milestoneId: string | null; readonly blockedByIds: readonly string[] }, field: string): boolean {
  switch (field) {
    case 'title':
      return item.title.trim() !== '';
    case 'body':
      return item.body.trim() !== '';
    case 'analysis':
      return item.analysis.trim() !== '';
    case 'design':
      return item.design.trim() !== '';
    case 'acceptance':
      return item.acceptance.length > 0;
    case 'milestoneId':
      return item.milestoneId !== null;
    default:
      return true;
  }
}

function uniqueMissing(items: readonly GateMissingItem[]): readonly GateMissingItem[] {
  const seen = new Set<string>();
  const next: GateMissingItem[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
}

function explain(error: { readonly kind: string }): string {
  return error.kind.replaceAll('_', ' ');
}

function fail(message: string): never {
  throw new WorkflowError('NOT_FOUND', message);
}

function toBoardRunStatus(
  status: WorkflowRunStatus,
): 'not_started' | 'ready' | 'queued' | 'running' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'cancelled' {
  switch (status) {
    case 'planned':
      return 'not_started';
    case 'paused':
    case 'waiting_for_approval':
      return 'waiting';
    case 'running':
      return 'running';
    case 'blocked':
      return 'blocked';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function toBoardStepStatus(
  status: WorkflowStepStatus,
): 'ready' | 'queued' | 'assigned' | 'running' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'cancelled' {
  switch (status) {
    case 'pending':
    case 'ready':
    case 'scheduled':
      return 'ready';
    case 'queued':
      return 'queued';
    case 'running':
    case 'retrying':
      return 'running';
    case 'waiting_for_input':
    case 'waiting_for_approval':
      return 'waiting';
    case 'blocked':
      return 'blocked';
    case 'completed':
    case 'skipped':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default: {
      const _never: never = status;
      return _never;
    }
  }
}
