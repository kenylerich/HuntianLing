/**
 * Static workflow maps and Test Lab replay views.
 */

import { deriveCanvas, overlayCanvas, validateTemplate } from './canvas.js';
import { VISUALIZATION_LAYER_IDS } from './types.js';
import type {
  TemplateVersionDiff,
  TemplateVersionSnapshot,
  TestReplayView,
  VisualizationBadge,
  VisualizationExport,
  VisualizationInspector,
  VisualizationLayer,
  VisualizationLayerId,
  VisualizationNode,
  VisualizationPresentation,
  WorkflowCanvas,
  WorkflowTemplate,
  WorkflowTemplateStep,
  WorkflowTestCase,
  WorkflowTestRun,
  WorkflowVisualization,
} from './types.js';

const COLUMN = 180;

export function buildVisualization(
  template: WorkflowTemplate,
  canvas: WorkflowCanvas | undefined,
  extraCapabilityIds: readonly string[] = [],
): WorkflowVisualization {
  const map = overlayCanvas(template, canvas);
  const validation = validateTemplate(template, extraCapabilityIds);
  const badges: VisualizationBadge[] = validation.issues
    .filter((issue) => issue.nodeId !== null)
    .map((issue) => ({ nodeId: issue.nodeId as string, code: issue.code, message: issue.message }));
  const byStep = new Map(template.steps.map((step) => [step.id, step]));
  const graphNodes = map.nodes.map((node, index) => toVisNode(node.id, node.title, node.kind, node.kind === 'stage' ? 'stage' : node.role || 'unassigned', node.x, node.y, node.stepId, inspectorFor(node.stepId, byStep, node.title)));
  return {
    templateId: template.id,
    templateVersion: template.version,
    presentations: {
      stageSwimlane: presentation('stage-swimlane', map, byStep, (node, step) => step?.targetStatus ?? node.stageId ?? 'stage'),
      roleSwimlane: presentation('role-swimlane', map, byStep, (node, step) => (node.kind === 'stage' ? 'stage' : step?.role || node.role || 'unassigned')),
      dependencyGraph: {
        kind: 'dependency-graph',
        lanes: [{ id: 'graph', title: 'Graph' }],
        nodes: graphNodes.map((node) => ({ ...node, lane: 'graph' })),
        edges: map.edges.map((edge) => ({ from: edge.from, to: edge.to, kind: edge.kind })),
      },
      outline: {
        kind: 'outline',
        lanes: [{ id: 'outline', title: 'Outline' }],
        nodes: graphNodes.map((node, index) => ({ ...node, lane: 'outline', x: 0, y: index * 28 })),
        edges: map.edges.map((edge) => ({ from: edge.from, to: edge.to, kind: edge.kind })),
      },
    },
    layers: buildLayers(map.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      skills: node.requiredSkills,
      tools: node.allowedTools,
      checks: node.checks,
      evidence: node.mapping.evidence,
      approval: node.approvalKind,
    })), badges),
    badges,
  };
}

export function diffSnapshots(
  from: TemplateVersionSnapshot,
  to: WorkflowTemplate,
): TemplateVersionDiff {
  const fromIds = new Set(from.steps.map((step) => step.id));
  const toIds = new Set(to.steps.map((step) => step.id));
  const added = to.steps.filter((step) => !fromIds.has(step.id)).map((step) => step.id);
  const removed = from.steps.filter((step) => !toIds.has(step.id)).map((step) => step.id);
  const changed: string[] = [];
  const risky: string[] = [];
  for (const step of to.steps) {
    const previous = from.steps.find((item) => item.id === step.id);
    if (previous === undefined) continue;
    if (signature(previous) !== signature(step)) changed.push(step.id);
    if (
      previous.approvalKind !== step.approvalKind
      || previous.capabilityId !== step.capabilityId
      || previous.allowedTools.join(',') !== step.allowedTools.join(',')
    ) {
      risky.push(step.id);
    }
  }
  return {
    fromVersion: from.version,
    toVersion: to.version,
    added,
    removed,
    changed,
    risky,
  };
}

export function buildReplayView(
  template: WorkflowTemplate,
  canvas: WorkflowCanvas | undefined,
  testCase: WorkflowTestCase,
  run: WorkflowTestRun,
): TestReplayView {
  const visualization = buildVisualization(template, canvas);
  const highlights = run.replay.map((frame) => ({
    nodeId: `step:${frame.stepId}`,
    kind: frame.allowed ? 'actual' as const : 'blocked' as const,
  }));
  return {
    testRunId: run.id,
    templateId: template.id,
    templateVersion: run.templateVersion || template.version,
    packVersion: run.packVersion,
    fixtureVersion: run.fixtureVersion || '1.0.0',
    schedulerVersion: run.schedulerVersion || '1.0.0',
    conformanceRunId: run.conformanceRunId,
    scenario: testCase.scenario,
    status: run.status,
    map: visualization.presentations.dependencyGraph,
    frames: run.replay,
    assertions: run.report,
    highlights,
  };
}

export function exportVisualization(
  template: WorkflowTemplate,
  visualization: WorkflowVisualization,
  format: VisualizationExport['format'],
): VisualizationExport {
  if (format === 'dsl') {
    return {
      format,
      body: `${JSON.stringify({ id: template.id, version: template.version, title: template.title, stages: template.stages, steps: template.steps }, null, 2)}\n`,
      templateId: template.id,
      templateVersion: template.version,
    };
  }
  if (format === 'svg') {
    return {
      format,
      body: svgFromPresentation(visualization.presentations.dependencyGraph),
      templateId: template.id,
      templateVersion: template.version,
    };
  }
  const lines = [
    `# ${template.title}`,
    '',
    `Version: ${template.version}`,
    '',
    '## Stages',
    ...template.stages.map((stage) => `- ${stage.id}: ${stage.title} (${stage.status})`),
    '',
    '## Steps',
    ...template.steps.map((step) => `- ${step.id}: ${step.title} [${step.role}] -> ${step.targetStatus ?? 'none'}`),
    '',
    '## Badges',
    ...(visualization.badges.length === 0 ? ['- none'] : visualization.badges.map((badge) => `- ${badge.nodeId}: ${badge.code} ${badge.message}`)),
    '',
  ];
  return {
    format: 'markdown',
    body: `${lines.join('\n')}\n`,
    templateId: template.id,
    templateVersion: template.version,
  };
}

export function exportReplayReport(view: TestReplayView): VisualizationExport {
  const lines = [
    `# Test replay ${view.testRunId}`,
    '',
    `Scenario: ${view.scenario}`,
    `Status: ${view.status}`,
    `Template: ${view.templateId} ${view.templateVersion}`,
    `Fixture: ${view.fixtureVersion}`,
    `Scheduler: ${view.schedulerVersion}`,
    view.packVersion === null ? 'Pack: none' : `Pack: ${view.packVersion}`,
    view.conformanceRunId === null ? 'Conformance: none' : `Conformance: ${view.conformanceRunId}`,
    '',
    '## Assertions',
    ...view.assertions.passed.map((item) => `- pass ${item}`),
    ...view.assertions.failed.map((item) => `- fail ${item}`),
    '',
    '## Frames',
    ...view.frames.map((frame, index) => `- ${String(index)} ${frame.stepId} ${frame.status} ${frame.nextSafeAction} ${frame.reason}`),
    '',
    `Evidence: ${view.assertions.evidence}`,
    '',
  ];
  return {
    format: 'markdown',
    body: `${lines.join('\n')}\n`,
    templateId: view.templateId,
    templateVersion: view.templateVersion,
  };
}

export function snapshotFrom(template: WorkflowTemplate): TemplateVersionSnapshot {
  return {
    templateId: template.id,
    version: template.version,
    title: template.title,
    stages: template.stages,
    steps: template.steps,
    recordedAt: Date.now(),
  };
}

function presentation(
  kind: VisualizationPresentation['kind'],
  map: ReturnType<typeof deriveCanvas>,
  byStep: ReadonlyMap<string, WorkflowTemplateStep>,
  laneOf: (node: WorkflowCanvas['nodes'][number], step: WorkflowTemplateStep | undefined) => string,
): VisualizationPresentation {
  const nodes = map.nodes.map((node, index) => {
    const step = node.stepId === null ? undefined : byStep.get(node.stepId);
    const lane = laneOf(node, step);
    return toVisNode(node.id, node.title, node.kind, lane, (index % 8) * COLUMN, Math.floor(index / 8) * 80, node.stepId, inspectorFor(node.stepId, byStep, node.title));
  });
  const laneIds = [...new Set(nodes.map((node) => node.lane))];
  return {
    kind,
    lanes: laneIds.map((id) => ({ id, title: id })),
    nodes,
    edges: map.edges.map((edge) => ({ from: edge.from, to: edge.to, kind: edge.kind })),
  };
}

function toVisNode(
  id: string,
  title: string,
  kind: string,
  lane: string,
  x: number,
  y: number,
  stepId: string | null,
  inspector: VisualizationInspector,
): VisualizationNode {
  return { id, title, kind, lane, x, y, stepId, inspector };
}

function inspectorFor(
  stepId: string | null,
  byStep: ReadonlyMap<string, WorkflowTemplateStep>,
  title: string,
): VisualizationInspector {
  const step = stepId === null ? undefined : byStep.get(stepId);
  return {
    description: title,
    role: step?.role ?? '',
    skills: step?.requiredSkills ?? [],
    tools: step?.allowedTools ?? [],
    checks: step?.checks ?? [],
    evidence: step?.checks[0] ?? null,
    approvalKind: step?.approvalKind ?? null,
    targetStatus: step?.targetStatus ?? null,
  };
}

function buildLayers(
  nodes: readonly {
    readonly id: string;
    readonly kind: string;
    readonly skills: readonly string[];
    readonly tools: readonly string[];
    readonly checks: readonly string[];
    readonly evidence: string | null;
    readonly approval: string | null;
  }[],
  badges: readonly VisualizationBadge[],
): readonly VisualizationLayer[] {
  const titles: Record<VisualizationLayerId, string> = {
    lifecycle: 'Lifecycle stages',
    agents: 'Agent and Skill binding',
    skills: 'Skills',
    tools: 'Tools',
    events: 'Events',
    gates: 'Gates',
    approvals: 'Approvals',
    evidence: 'Evidence',
    inputs: 'Data inputs',
    documents: 'Source documents',
    compliance: 'Compliance controls',
    risk: 'Risk signals',
  };
  const select = (id: VisualizationLayerId, predicate: (node: (typeof nodes)[number]) => boolean): VisualizationLayer => ({
    id,
    title: titles[id],
    nodeIds: nodes.filter(predicate).map((node) => node.id),
  });
  const badgeNodes = new Set(badges.map((badge) => badge.nodeId));
  return VISUALIZATION_LAYER_IDS.map((id) => {
    switch (id) {
      case 'lifecycle':
        return select(id, (node) => node.kind === 'stage');
      case 'agents':
        return select(id, (node) => node.kind === 'agent-step');
      case 'skills':
        return select(id, (node) => node.skills.length > 0);
      case 'tools':
        return select(id, (node) => node.tools.length > 0);
      case 'events':
        return select(id, (node) => node.kind === 'handoff' || node.kind === 'failure');
      case 'gates':
        return select(id, (node) => node.checks.length > 0);
      case 'approvals':
        return select(id, (node) => node.kind === 'approval' || node.approval !== null);
      case 'evidence':
        return select(id, (node) => node.evidence !== null);
      case 'inputs':
        return select(id, (node) => node.kind !== 'stage');
      case 'documents':
        return select(id, (node) => node.evidence !== null);
      case 'compliance':
        return select(id, (node) => node.kind === 'approval' || node.evidence !== null);
      case 'risk':
        return select(id, (node) => badgeNodes.has(node.id));
      default:
        return select(id, () => false);
    }
  });
}

function signature(step: WorkflowTemplateStep): string {
  return [
    step.title,
    step.kind,
    step.role,
    step.capabilityId,
    step.requiredSkills.join(','),
    step.allowedTools.join(','),
    step.checks.join(','),
    step.dependsOn.join(','),
    step.approvalKind ?? '',
    step.targetStatus ?? '',
  ].join('|');
}

function svgFromPresentation(presentation: VisualizationPresentation): string {
  const boxes = presentation.nodes.map((node) => {
    const fill = node.kind === 'stage' ? '#e8f0fe' : '#ffffff';
    return `<g data-node="${escapeXml(node.id)}"><rect x="${String(node.x)}" y="${String(node.y)}" width="150" height="40" rx="6" fill="${fill}" stroke="#64748b"/><text x="${String(node.x + 8)}" y="${String(node.y + 24)}" font-size="12">${escapeXml(node.title)}</text></g>`;
  });
  const lines = presentation.edges.map((edge) => {
    const from = presentation.nodes.find((node) => node.id === edge.from);
    const to = presentation.nodes.find((node) => node.id === edge.to);
    if (from === undefined || to === undefined) return '';
    return `<line x1="${String(from.x + 70)}" y1="${String(from.y + 20)}" x2="${String(to.x + 70)}" y2="${String(to.y + 20)}" stroke="#94a3b8"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 360" role="img" aria-label="workflow map">${lines.join('')}${boxes.join('')}</svg>\n`;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
