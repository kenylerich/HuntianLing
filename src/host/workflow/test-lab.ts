/**
 * Workflow Test Lab dry-run simulation for publication evidence.
 */

import type {
  WorkflowNodeType,
  WorkflowTemplate,
  WorkflowTemplateStep,
  WorkflowTestAssertion,
  WorkflowTestReplayFrame,
  WorkflowTestReport,
  WorkflowTestScenario,
} from './types.js';
import { WORKFLOW_TEST_SCENARIOS } from './types.js';

export function isTestLabScenario(value: string): value is WorkflowTestScenario {
  return WORKFLOW_TEST_SCENARIOS.includes(value as WorkflowTestScenario);
}

export function simulateTemplate(
  template: WorkflowTemplate,
  scenario: WorkflowTestScenario,
  customNodes: readonly WorkflowNodeType[] = [],
): { readonly frames: readonly WorkflowTestReplayFrame[]; readonly blocked: boolean } {
  const frames: WorkflowTestReplayFrame[] = [];
  let blocked = false;
  for (const step of template.steps) {
    if (blocked) {
      frames.push({
        stepId: step.id,
        title: step.title,
        status: 'pending',
        allowed: false,
        nextSafeAction: 'wait',
        reason: 'blocked earlier',
      });
      continue;
    }
    const frame = simulateStep(step, scenario, customNodes);
    frames.push(frame);
    if (!frame.allowed) blocked = true;
  }
  return { frames, blocked };
}

export function defaultAssertions(scenario: WorkflowTestScenario): readonly WorkflowTestAssertion[] {
  switch (scenario) {
    case 'happy-path':
      return [{ kind: 'final-status', expected: 'completed' }];
    case 'missing-approval':
      return [{ kind: 'next-safe-action', expected: 'request-approval' }];
    case 'resource-conflict':
      return [{ kind: 'next-safe-action', expected: 'wait' }];
    case 'stale-state':
      return [{ kind: 'next-safe-action', expected: 'revalidate' }];
    case 'missing-evidence':
      return [{ kind: 'required-input', expected: 'executed-evidence' }];
    case 'custom-node':
      return [{ kind: 'custom-node', expected: 'simulated' }];
    default:
      return [{ kind: 'final-status', expected: 'completed' }];
  }
}

export function scoreAssertions(
  scenario: WorkflowTestScenario,
  frames: readonly WorkflowTestReplayFrame[],
  assertions: readonly WorkflowTestAssertion[],
): WorkflowTestReport {
  const checks = assertions.length > 0 ? assertions : defaultAssertions(scenario);
  const passed: string[] = [];
  const failed: string[] = [];
  for (const assertion of checks) {
    const ok = assertionHolds(assertion, frames);
    const label = `${assertion.kind}:${assertion.expected}`;
    if (ok) passed.push(label);
    else failed.push(label);
  }
  return {
    passed,
    failed,
    evidence: `workflow-test-lab:${scenario}`,
  };
}

function simulateStep(
  step: WorkflowTemplateStep,
  scenario: WorkflowTestScenario,
  customNodes: readonly WorkflowNodeType[],
): WorkflowTestReplayFrame {
  if (scenario === 'missing-approval' && step.kind === 'approval-required') {
    return frame(step, false, 'blocked', 'request-approval', `missing ${step.approvalKind ?? 'required'} approval`);
  }
  if (scenario === 'resource-conflict') {
    return frame(step, false, 'blocked', 'wait', 'exclusive lease is held by another owner');
  }
  if (scenario === 'stale-state') {
    return frame(step, false, 'blocked', 'revalidate', 'state snapshot is stale after a design change');
  }
  if (
    scenario === 'missing-evidence'
    && (step.role === 'evaluator' || step.checks.includes('executed-evidence') || step.checks.includes('criterion-evidence'))
  ) {
    return frame(step, false, 'blocked', 'ask', 'executed evidence is missing');
  }
  if (scenario === 'custom-node') {
    const node = customNodes.find((item) => item.id === step.capabilityId);
    if (node?.testFixture !== null && node?.testFixture !== undefined) {
      return frame(step, true, node.testFixture.status, node.testFixture.nextSafeAction, node.testFixture.reason);
    }
  }
  return frame(step, true, 'completed', 'start', 'state is executable');
}

function frame(
  step: WorkflowTemplateStep,
  allowed: boolean,
  status: string,
  nextSafeAction: string,
  reason: string,
): WorkflowTestReplayFrame {
  return {
    stepId: step.id,
    title: step.title,
    status,
    allowed,
    nextSafeAction,
    reason,
  };
}

function assertionHolds(
  assertion: WorkflowTestAssertion,
  frames: readonly WorkflowTestReplayFrame[],
): boolean {
  if (assertion.kind === 'final-status') {
    const blocked = frames.some((frame) => frame.allowed === false);
    return assertion.expected === 'completed' ? !blocked : blocked;
  }
  if (assertion.kind === 'next-safe-action') {
    return frames.some((frame) => frame.nextSafeAction === assertion.expected);
  }
  if (assertion.kind === 'required-input') {
    return frames.some((frame) => frame.reason.includes(assertion.expected) || frame.reason.includes('executed evidence'));
  }
  if (assertion.kind === 'custom-node') {
    return frames.some((frame) => frame.reason === assertion.expected || frame.reason.includes('fixture') || frame.nextSafeAction === 'complete');
  }
  if (assertion.kind === 'custom-event') {
    return frames.some((frame) => frame.reason.includes(assertion.expected));
  }
  return false;
}
