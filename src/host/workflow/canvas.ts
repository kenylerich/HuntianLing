/**
 * Derive a visual canvas from a workflow template and apply canvas edits.
 */

import { BUILTIN_CAPABILITIES } from './catalog.js';
import { createToolRegistry } from '../tools/registry.js';
import {
  APPROVAL_KINDS,
  WORKFLOW_CANVAS_NODE_KINDS,
  WORKFLOW_STEP_KINDS,
  WorkflowError,
  type ApprovalKind,
  type TemplateValidation,
  type TemplateValidationIssue,
  type WorkflowCanvas,
  type WorkflowCanvasEdge,
  type WorkflowCanvasNode,
  type WorkflowCanvasNodeKind,
  type WorkflowTemplate,
  type WorkflowTemplateStep,
} from './types.js';

const COLUMN = 180;
const STAGE_Y = 24;
const STEP_Y = 140;

export function deriveCanvas(template: WorkflowTemplate): WorkflowCanvas {
  const stageNodes: WorkflowCanvasNode[] = template.stages.map((stage, index) => ({
    id: `stage:${stage.id}`,
    kind: 'stage',
    title: stage.title,
    x: index * COLUMN,
    y: STAGE_Y,
    stepId: null,
    stageId: stage.id,
    role: '',
    requiredSkills: [],
    allowedTools: [],
    checks: stage.requiredEvidence,
    dependsOn: [],
    approvalKind: (stage.requiredApprovals[0] ?? null) as ApprovalKind | null,
    mapping: {
      runtimeStage: stage.id,
      runStep: null,
      boardStatus: stage.status,
      teamChatEvent: null,
      evidence: stage.requiredEvidence[0] ?? null,
    },
  }));
  const stepNodes: WorkflowCanvasNode[] = template.steps.map((step, index) => ({
    id: `step:${step.id}`,
    kind: canvasKindForStep(step),
    title: step.title,
    x: index * COLUMN,
    y: STEP_Y,
    stepId: step.id,
    stageId: null,
    role: step.role,
    requiredSkills: step.requiredSkills,
    allowedTools: step.allowedTools,
    checks: step.checks,
    dependsOn: step.dependsOn,
    approvalKind: step.approvalKind,
    mapping: {
      runtimeStage: step.targetStatus,
      runStep: step.id,
      boardStatus: step.targetStatus,
      teamChatEvent: agentRole(step.role) ? 'task.propose' : null,
      evidence: step.checks[0] ?? null,
    },
  }));
  const stepIndex = new Map(template.steps.map((step) => [step.id, `step:${step.id}`]));
  const edges = template.steps.flatMap((step) =>
    step.dependsOn.flatMap((dep) => {
      const from = stepIndex.get(dep);
      const to = stepIndex.get(step.id);
      return from !== undefined && to !== undefined ? [{ from, to, kind: 'depends' as const }] : [];
    }),
  );
  return {
    templateId: template.id,
    templateVersion: template.version,
    nodes: [...stageNodes, ...stepNodes],
    edges,
  };
}

export function overlayCanvas(template: WorkflowTemplate, stored: WorkflowCanvas | undefined): WorkflowCanvas {
  const derived = deriveCanvas(template);
  if (stored === undefined) return derived;
  const byId = new Map(stored.nodes.map((node) => [node.id, node]));
  return {
    templateId: template.id,
    templateVersion: template.version,
    nodes: derived.nodes.map((node) => {
      const overlay = byId.get(node.id);
      if (overlay === undefined) return node;
      return { ...node, x: overlay.x, y: overlay.y };
    }),
    edges: stored.edges.length > 0 ? stored.edges : derived.edges,
  };
}

export function applyCanvasToTemplate(
  template: WorkflowTemplate,
  canvas: WorkflowCanvas,
): WorkflowTemplate {
  const byStep = new Map(
    canvas.nodes.filter((node) => node.stepId !== null).map((node) => [node.stepId as string, node]),
  );
  return {
    ...template,
    steps: template.steps.map((step) => {
      const node = byStep.get(step.id);
      if (node === undefined) return step;
      return {
        ...step,
        title: node.title.trim() === '' ? step.title : node.title,
        role: node.role,
        requiredSkills: node.requiredSkills,
        allowedTools: node.allowedTools,
        checks: node.checks,
        dependsOn: node.dependsOn,
        approvalKind: node.approvalKind,
      };
    }),
  };
}

export function validateTemplate(
  template: WorkflowTemplate,
  extraCapabilityIds: readonly string[] = [],
): TemplateValidation {
  const issues: TemplateValidationIssue[] = [];
  const ids = new Set<string>();
  const tools = createToolRegistry();
  for (const step of template.steps) {
    const nodeId = `step:${step.id}`;
    if (step.id.trim() === '') {
      issues.push({ nodeId, code: 'missing_id', message: 'template step id is required' });
    }
    if (ids.has(step.id)) {
      issues.push({ nodeId, code: 'duplicate_id', message: `duplicate template step id: ${step.id}` });
    }
    ids.add(step.id);
    if (!WORKFLOW_STEP_KINDS.includes(step.kind)) {
      issues.push({ nodeId, code: 'unknown_kind', message: `unknown step kind: ${step.kind}` });
    }
    if (step.role.trim() === '') {
      issues.push({ nodeId, code: 'incomplete', message: `step ${step.id} is missing a role` });
    }
    const knownCapability = BUILTIN_CAPABILITIES.some((item) => item.id === step.capabilityId)
      || extraCapabilityIds.includes(step.capabilityId);
    if (step.capabilityId.trim() === '' || !knownCapability) {
      issues.push({ nodeId, code: 'incomplete', message: `step ${step.id} is missing a valid capability` });
    }
    for (const toolId of step.allowedTools) {
      if (tools.get(toolId as never) === undefined) {
        issues.push({ nodeId, code: 'unknown_tool', message: `step ${step.id} uses unknown tool ${toolId}` });
      }
    }
    if (step.approvalKind !== null && !APPROVAL_KINDS.includes(step.approvalKind)) {
      issues.push({ nodeId, code: 'unknown_approval', message: `step ${step.id} uses unknown approval ${step.approvalKind}` });
    }
  }
  for (const step of template.steps) {
    for (const dep of step.dependsOn) {
      if (!ids.has(dep)) {
        issues.push({
          nodeId: `step:${step.id}`,
          code: 'missing_dependency',
          message: `unknown dependency ${dep} on step ${step.id}`,
        });
      }
    }
  }
  if (hasCycle(template.steps)) {
    issues.push({ nodeId: null, code: 'cycle', message: 'template step dependencies contain a cycle' });
  }
  return { ok: issues.length === 0, issues };
}

export function isCanvasNodeKind(value: string): value is WorkflowCanvasNodeKind {
  return WORKFLOW_CANVAS_NODE_KINDS.includes(value as WorkflowCanvasNodeKind);
}

export function canvasFromUnknown(templateId: string, templateVersion: string, value: unknown): WorkflowCanvas {
  const body = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nodes = Array.isArray(body.nodes) ? body.nodes.map((item, index) => nodeFromUnknown(item, index)) : [];
  const edges = Array.isArray(body.edges) ? body.edges.map((item, index) => edgeFromUnknown(item, index)) : [];
  return { templateId, templateVersion, nodes, edges };
}

function nodeFromUnknown(value: unknown, index: number): WorkflowCanvasNode {
  const node = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  const kind = typeof node.kind === 'string' && isCanvasNodeKind(node.kind) ? node.kind : 'human-step';
  const approval = typeof node.approvalKind === 'string' && APPROVAL_KINDS.includes(node.approvalKind as ApprovalKind)
    ? node.approvalKind as ApprovalKind
    : null;
  const mapping = node.mapping !== null && typeof node.mapping === 'object'
    ? node.mapping as Record<string, unknown>
    : {};
  return {
    id: stringField(node.id, `node-${String(index)}`),
    kind,
    title: stringField(node.title, ''),
    x: typeof node.x === 'number' ? node.x : index * COLUMN,
    y: typeof node.y === 'number' ? node.y : STEP_Y,
    stepId: optionalString(node.stepId),
    stageId: optionalString(node.stageId),
    role: stringField(node.role, ''),
    requiredSkills: stringArray(node.requiredSkills),
    allowedTools: stringArray(node.allowedTools),
    checks: stringArray(node.checks),
    dependsOn: stringArray(node.dependsOn),
    approvalKind: approval,
    mapping: {
      runtimeStage: optionalString(mapping.runtimeStage),
      runStep: optionalString(mapping.runStep),
      boardStatus: optionalString(mapping.boardStatus),
      teamChatEvent: optionalString(mapping.teamChatEvent),
      evidence: optionalString(mapping.evidence),
    },
  };
}

function edgeFromUnknown(value: unknown, index: number): WorkflowCanvasEdge {
  const edge = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  const kind = edge.kind === 'transition' || edge.kind === 'failure' ? edge.kind : 'depends';
  const from = stringField(edge.from, '');
  const to = stringField(edge.to, '');
  if (from === '' || to === '') {
    throw new WorkflowError('VALIDATION', `canvas edge ${String(index)} is missing from/to`);
  }
  return { from, to, kind };
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function canvasKindForStep(step: WorkflowTemplateStep): WorkflowCanvasNodeKind {
  if (step.kind === 'approval-required') return 'approval';
  if (step.kind === 'review-only' || step.kind === 'manual-only') return 'human-step';
  if (agentRole(step.role)) return 'agent-step';
  return 'human-step';
}

function agentRole(role: string): boolean {
  return role === 'planner' || role === 'generator' || role === 'evaluator';
}

function hasCycle(steps: readonly WorkflowTemplateStep[]): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(steps.map((step) => [step.id, step]));
  const walk = (id: string): boolean => {
    if (visited.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    const step = byId.get(id);
    for (const dep of step?.dependsOn ?? []) {
      if (walk(dep)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return steps.some((step) => walk(step.id));
}
