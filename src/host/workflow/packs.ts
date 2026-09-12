/**
 * Workflow packs, event/node catalogs, and conformance checks.
 */

import { createToolRegistry } from '../tools/registry.js';
import { BUILTIN_CAPABILITIES } from './catalog.js';
import { ROLE_EVENT_TYPES } from './types.js';
import { validateTemplate } from './canvas.js';
import { simulateTemplate } from './test-lab.js';
import {
  UNSAFE_WORKFLOW_PERMISSIONS,
  WORKFLOW_CANVAS_NODE_KINDS,
  WORKFLOW_EXTENSION_POINTS,
  type ConformanceCheck,
  type ConformanceReport,
  type WorkflowEventType,
  type WorkflowExtensionPackage,
  type WorkflowExtensionPoint,
  type WorkflowNodeType,
  type WorkflowPack,
  type WorkflowTemplate,
} from './types.js';

export const SYSTEM_EVENT_NAMES: readonly string[] = [
  ...ROLE_EVENT_TYPES,
  'workflow.planned',
  'workflow.started',
  'ci.passed',
];

export function builtinEventTypes(): readonly WorkflowEventType[] {
  return SYSTEM_EVENT_NAMES.map((id) => ({
    id,
    origin: 'system' as const,
    version: '1.0.0',
    namespace: 'huntianling',
    packId: null,
    schema: { required: [] },
    producerRoles: ['workflow'],
    targetRoles: ['developer'],
    requiredDecisionRoles: [],
    allowedConsumers: ['workflow'],
    visibility: id.startsWith('approval.') || id.startsWith('review.') || id.startsWith('handoff.') ? 'audit' : 'runtime',
    retention: 'run',
    redaction: 'none',
    audit: true,
  }));
}

export function builtinNodeTypes(): readonly WorkflowNodeType[] {
  return [
    ...WORKFLOW_CANVAS_NODE_KINDS.map((id) => nodeType(id, titleFor(id))),
    nodeType('parallel', 'Parallel branch'),
    nodeType('timer', 'Timer'),
    nodeType('retry', 'Retry'),
    nodeType('resource-lease', 'Resource lease'),
  ];
}

export function isExtensionPoint(value: string): value is WorkflowExtensionPoint {
  return WORKFLOW_EXTENSION_POINTS.includes(value as WorkflowExtensionPoint);
}

export function isValidNamespace(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,31}$/.test(value);
}

export function isNamespacedId(id: string, namespace: string): boolean {
  return id.startsWith(`${namespace}.`) && id.length > namespace.length + 1;
}

export function payloadMatchesSchema(
  payload: Readonly<Record<string, string>>,
  required: readonly string[],
): boolean {
  return required.every((key) => typeof payload[key] === 'string' && payload[key] !== '');
}

export function runConformance(input: {
  readonly pack: WorkflowPack;
  readonly templates: readonly WorkflowTemplate[];
  readonly eventTypes: readonly WorkflowEventType[];
  readonly nodeTypes: readonly WorkflowNodeType[];
  readonly extensions: readonly WorkflowExtensionPackage[];
}): Omit<ConformanceReport, 'id' | 'createdAt'> {
  const checks: ConformanceCheck[] = [];
  const tools = createToolRegistry();
  const builtinNodes = new Set(builtinNodeTypes().map((item) => item.id));
  const declaredNodes = new Set(input.nodeTypes.map((item) => item.id));
  const declaredEvents = new Set(input.eventTypes.map((item) => item.id));

  if (!isValidNamespace(input.pack.namespace)) {
    checks.push({ code: 'namespace', result: 'fail', message: `invalid pack namespace: ${input.pack.namespace}` });
  } else {
    checks.push({ code: 'namespace', result: 'pass', message: 'namespace is valid' });
  }

  for (const event of input.eventTypes) {
    if (SYSTEM_EVENT_NAMES.includes(event.id)) {
      checks.push({ code: 'system-event', result: 'fail', message: `custom event redefines system event ${event.id}` });
    } else if (!isNamespacedId(event.id, input.pack.namespace)) {
      checks.push({ code: 'event-namespace', result: 'fail', message: `event ${event.id} is outside pack namespace ${input.pack.namespace}` });
    }
  }
  for (const node of input.nodeTypes) {
    if (builtinNodes.has(node.id)) {
      checks.push({ code: 'system-node', result: 'fail', message: `custom node redefines built-in node ${node.id}` });
    } else if (!isNamespacedId(node.id, input.pack.namespace)) {
      checks.push({ code: 'node-namespace', result: 'fail', message: `node ${node.id} is outside pack namespace ${input.pack.namespace}` });
    }
    if (node.requiredPermissions.some((item) => (UNSAFE_WORKFLOW_PERMISSIONS as readonly string[]).includes(item))) {
      checks.push({ code: 'unsafe-permission', result: 'fail', message: `node ${node.id} requests an unsafe permission` });
    }
    for (const eventId of node.supportedEvents) {
      if (!SYSTEM_EVENT_NAMES.includes(eventId) && !declaredEvents.has(eventId)) {
        checks.push({ code: 'unknown-event', result: 'fail', message: `node ${node.id} uses unknown event ${eventId}` });
      }
    }
  }

  for (const template of input.templates) {
    const extra = [...declaredNodes];
    const validation = validateTemplate(template, extra);
    for (const issue of validation.issues) {
      if (issue.code === 'unknown_kind') {
        checks.push({ code: 'unknown-node', result: 'fail', message: issue.message });
      } else if (issue.code === 'unknown_tool') {
        checks.push({ code: 'undeclared-tool', result: 'fail', message: issue.message });
      } else if (issue.code !== 'incomplete') {
        checks.push({ code: issue.code, result: 'fail', message: issue.message });
      }
    }
    for (const step of template.steps) {
      if (!builtinNodes.has(step.kind) && !WORKFLOW_CANVAS_NODE_KINDS.includes(step.kind as never)) {
        const knownKind = step.kind === 'sequential' || step.kind === 'parallel' || step.kind === 'exclusive'
          || step.kind === 'review-only' || step.kind === 'approval-required' || step.kind === 'manual-only'
          || step.kind === 'recurring' || step.kind === 'event-triggered';
        if (!knownKind) {
          checks.push({ code: 'unknown-node', result: 'fail', message: `unknown node type ${step.kind}` });
        }
      }
      const builtinCap = BUILTIN_CAPABILITIES.some((item) => item.id === step.capabilityId);
      if (!builtinCap && !declaredNodes.has(step.capabilityId)) {
        checks.push({ code: 'unknown-node', result: 'fail', message: `unknown node type ${step.capabilityId}` });
      }
      for (const toolId of step.allowedTools) {
        if (tools.get(toolId as never) === undefined) {
          checks.push({ code: 'unknown-tool', result: 'fail', message: `unknown tool ${toolId}` });
        } else if (input.pack.requiredTools.length > 0 && !input.pack.requiredTools.includes(toolId)) {
          checks.push({ code: 'undeclared-tool', result: 'fail', message: `undeclared tool ${toolId}` });
        }
      }
      for (const skillId of step.requiredSkills) {
        if (input.pack.requiredSkills.length > 0 && !input.pack.requiredSkills.includes(skillId)) {
          checks.push({ code: 'missing-skill', result: 'fail', message: `missing skill ${skillId}` });
        }
      }
    }
    if (template.steps.length > 0) {
      const simulated = simulateTemplate(template, 'happy-path', input.nodeTypes);
      const blocked = simulated.blocked;
      if (blocked) {
        checks.push({ code: 'conformance-suite', result: 'fail', message: `template ${template.title} failed happy-path dry-run` });
      } else {
        checks.push({ code: 'conformance-suite', result: 'pass', message: `template ${template.title} passed happy-path dry-run` });
      }
    }
  }

  const seen = new Map<string, number>();
  for (const extension of input.extensions) {
    if (!isExtensionPoint(extension.point)) {
      checks.push({ code: 'unknown-extension', result: 'fail', message: `unknown extension point ${extension.point}` });
      continue;
    }
    if (extension.testCases.length === 0) {
      checks.push({ code: 'extension-tests', result: 'fail', message: `extension ${extension.id} lacks test cases` });
    }
    const key = `${extension.point}:${String(extension.order)}`;
    if (seen.has(key)) {
      checks.push({
        code: 'extension-conflict',
        result: 'fail',
        message: `conflicting extensions at ${extension.point} order ${String(extension.order)}`,
      });
    }
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (extension.requiredPermissions.some((item) => (UNSAFE_WORKFLOW_PERMISSIONS as readonly string[]).includes(item))) {
      checks.push({ code: 'unsafe-permission', result: 'fail', message: `extension ${extension.id} requests an unsafe permission` });
    }
  }

  if (checks.every((item) => item.result !== 'fail') && checks.every((item) => item.code !== 'conformance-suite')) {
    checks.push({ code: 'conformance-suite', result: 'pass', message: 'no templates required a dry-run' });
  }

  const failed = checks.some((item) => item.result === 'fail');
  return {
    packId: input.pack.id,
    packVersion: input.pack.version,
    status: failed ? 'failed' : 'passed',
    checks: dedupeChecks(checks),
  };
}

function nodeType(id: string, title: string): WorkflowNodeType {
  return {
    id,
    origin: 'system',
    version: '1.0.0',
    namespace: 'huntianling',
    packId: null,
    title,
    inputSchema: 'huntianling.node.v1',
    outputSchema: 'huntianling.node.v1',
    formSchema: 'huntianling.node-form.v1',
    requiredCapabilities: [],
    requiredPermissions: [],
    supportedEvents: [],
    testFixture: null,
  };
}

function titleFor(id: string): string {
  return id.replace('-', ' ');
}

function dedupeChecks(checks: readonly ConformanceCheck[]): readonly ConformanceCheck[] {
  const seen = new Set<string>();
  const unique: ConformanceCheck[] = [];
  for (const check of checks) {
    const key = `${check.code}:${check.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(check);
  }
  return unique;
}
