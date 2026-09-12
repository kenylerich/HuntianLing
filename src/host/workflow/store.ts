/**
 * JSON persistence for workflow templates, runs, approvals, and events.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type {
  ApprovalRequest,
  ProjectWorkflowSelection,
  ReviewRequest,
  RoleScopedEvent,
  SchedulerDecision,
  TransitionRejection,
  WorkflowHandoff,
  WorkflowRun,
  WorkflowTemplate,
  WorkflowTimelineEvent,
  StepStateRecognition,
  WorkflowCanvas,
  WorkflowTestCase,
  WorkflowTestRun,
  WorkflowPack,
  ConformanceReport,
  WorkflowEventType,
  WorkflowNodeType,
  WorkflowExtensionPackage,
  WorkflowCatalogEvent,
  EnabledWorkflowPack,
  TemplateVersionSnapshot,
} from './types.js';

const SCHEMA_VERSION = 1;

export interface WorkflowSnapshot {
  readonly schemaVersion: number;
  readonly templates: WorkflowTemplate[];
  readonly selections: ProjectWorkflowSelection[];
  readonly runs: WorkflowRun[];
  readonly approvals: ApprovalRequest[];
  readonly events: RoleScopedEvent[];
  readonly decisions: SchedulerDecision[];
  readonly timeline: WorkflowTimelineEvent[];
  readonly reviews: ReviewRequest[];
  readonly handoffs: WorkflowHandoff[];
  readonly rejections: TransitionRejection[];
  readonly recognitions: StepStateRecognition[];
  readonly canvases: WorkflowCanvas[];
  readonly testCases: WorkflowTestCase[];
  readonly testRuns: WorkflowTestRun[];
  readonly packs: WorkflowPack[];
  readonly conformanceReports: ConformanceReport[];
  readonly eventTypes: WorkflowEventType[];
  readonly nodeTypes: WorkflowNodeType[];
  readonly extensions: WorkflowExtensionPackage[];
  readonly catalogEvents: WorkflowCatalogEvent[];
  readonly enabledPacks: EnabledWorkflowPack[];
  readonly templateSnapshots: TemplateVersionSnapshot[];
}

export function workflowStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'workflow.json');
}

export function loadWorkflowSnapshot(workspaceRoot: string): WorkflowSnapshot | undefined {
  try {
    const raw = readFileSync(workflowStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as WorkflowSnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported workflow schema ${String(parsed.schemaVersion)}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      templates: parsed.templates ?? [],
      selections: parsed.selections ?? [],
      runs: parsed.runs ?? [],
      approvals: parsed.approvals ?? [],
      events: parsed.events ?? [],
      decisions: parsed.decisions ?? [],
      timeline: parsed.timeline ?? [],
      reviews: parsed.reviews ?? [],
      handoffs: parsed.handoffs ?? [],
      rejections: parsed.rejections ?? [],
      recognitions: parsed.recognitions ?? [],
      canvases: parsed.canvases ?? [],
      testCases: parsed.testCases ?? [],
      testRuns: parsed.testRuns ?? [],
      packs: parsed.packs ?? [],
      conformanceReports: parsed.conformanceReports ?? [],
      eventTypes: parsed.eventTypes ?? [],
      nodeTypes: parsed.nodeTypes ?? [],
      extensions: parsed.extensions ?? [],
      catalogEvents: parsed.catalogEvents ?? [],
      enabledPacks: parsed.enabledPacks ?? [],
      templateSnapshots: parsed.templateSnapshots ?? [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    throw error;
  }
}

export function saveWorkflowSnapshot(workspaceRoot: string, snapshot: WorkflowSnapshot): void {
  const path = workflowStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...snapshot, schemaVersion: SCHEMA_VERSION }, null, 2)}\n`);
}
