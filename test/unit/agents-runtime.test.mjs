import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { AgentTaskError } from '../../lib/host/agents/types.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCollabService } from '../../lib/host/collab/service.js';
import { hasExecutedDeliveryEvidence } from '../../lib/host/board/executed-evidence.js';
import { SKILL_PLANNER_USER_STORY } from '../../lib/host/skills/coding-pack.js';
import { createSkillService } from '../../lib/host/skills/service.js';

function runtime() {
  return createAgentRuntime({ skills: createSkillService() });
}

const original = {
  quotes: [{ text: '客户只看自己的进度', source: 'customer' }],
  goal: 'Customer sees only their progress',
  actors: ['customer'],
  confirmed: true,
  acceptance: ['customer progress is visible'],
};

test('three agent definitions include skills, tools, and schemas', () => {
  const agents = runtime();
  assert.deepEqual(
    agents.definitions().map((item) => item.id).slice(0, 3),
    ['planner', 'generator', 'evaluator'],
  );
  assert.ok(agents.definitions().some((item) => item.id === 'ux-designer'));
  for (const definition of agents.definitions()) {
    assert.ok(definition.version);
    assert.ok(definition.requiredSkillIds.length > 0);
    assert.ok(definition.allowedToolIds.length > 0);
    assert.ok(definition.inputSchema);
    assert.ok(definition.outputSchema);
  }
  assert.deepEqual(agents.baseline().methodIds, ['user-story']);
});

test('planner rejects implementation file paths', () => {
  const agents = runtime();
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'planner',
        executor: 'manual',
        input: { ...original, files: ['src/host/web/page.ts'] },
      }),
    (error) => error instanceof AgentTaskError && error.code === 'VALIDATION',
  );
});

test('user-story method changes planner output', () => {
  const agents = runtime();
  const withoutMethod = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    input: original,
  });
  assert.equal(withoutMethod.output.userStory, undefined);
  assert.equal(withoutMethod.handoff.kind, 'design_ready');
  assert.ok(withoutMethod.skillVersions.length > 0);

  const withMethod = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    methodId: 'user-story',
    input: original,
  });
  assert.equal(withMethod.output.userStory.asA, 'customer');
  assert.equal(withMethod.output.userStory.iWant, original.goal);
  assert.ok(withMethod.output.acceptance.length > 0);
});

test('missing required method skill blocks the planner task', () => {
  const skills = createSkillService();
  skills.disableForProject('p1', SKILL_PLANNER_USER_STORY);
  const agents = createAgentRuntime({ skills });
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'planner',
        executor: 'manual',
        methodId: 'user-story',
        projectId: 'p1',
        input: original,
      }),
    (error) => error instanceof AgentTaskError && error.code === 'MISSING_METHOD',
  );
});

test('agent runtime refuses a collaboration task missing required fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-agent-task-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const incomplete = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: {
      objective: '缺检查的任务',
      assigneeRole: 'planner',
      requiredSkills: ['planner.delivery-contract'],
      allowedTools: ['delivery-contract.write'],
      expectedOutput: 'huntianling.delivery-contract.v1',
    },
  });
  const agents = runtime();
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'planner',
        executor: 'manual',
        input: original,
        collaborationTaskId: incomplete.payload.taskId,
        collab,
      }),
    (error) => error instanceof AgentTaskError && error.code === 'VALIDATION',
  );
  const ready = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: {
      objective: '实现登录壳',
      assigneeRole: 'planner',
      requiredSkills: ['planner.delivery-contract'],
      allowedTools: ['delivery-contract.write'],
      expectedOutput: 'huntianling.delivery-contract.v1',
      checks: ['has-acceptance'],
    },
  });
  const run = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    input: original,
    collaborationTaskId: ready.payload.taskId,
    collab,
  });
  assert.equal(run.status, 'completed');
});

test('generator cannot mark the slice accepted and requires a ready environment', () => {
  const agents = runtime();
  const planned = agents.startRun({ agentId: 'planner', executor: 'manual', input: original });
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'generator',
        executor: 'manual',
        input: planned.output,
      }),
    (error) => error instanceof AgentTaskError && error.code === 'ENVIRONMENT',
  );
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'generator',
        executor: 'manual',
        environmentReady: true,
        input: { ...planned.output, accepted: true },
      }),
    (error) => error instanceof AgentTaskError && error.code === 'SELF_CHECK',
  );
  const generated = agents.startRun({
    agentId: 'generator',
    executor: 'manual',
    environmentReady: true,
    input: planned.output,
  });
  assert.equal(generated.handoff.kind, 'evaluate');
  assert.equal(generated.output.selfCheck.kind, 'self_check');
});

test('evaluator pass cannot be generator self-check and repair routes to generator', () => {
  const agents = runtime();
  const planned = agents.startRun({ agentId: 'planner', executor: 'manual', input: original });
  const generated = agents.startRun({
    agentId: 'generator',
    executor: 'manual',
    environmentReady: true,
    input: planned.output,
  });
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'evaluator',
        executor: 'manual',
        input: {
          ...generated.output,
          independent: true,
          decision: 'pass',
          selfCheck: { kind: 'self_check' },
        },
      }),
    (error) => error instanceof AgentTaskError && error.code === 'SELF_CHECK',
  );
  const passed = agents.startRun({
    agentId: 'evaluator',
    executor: 'manual',
    input: { ...generated.output, independent: true, acceptance: planned.output.acceptance },
  });
  assert.equal(passed.output.independent, true);
  assert.equal(passed.output.decision, 'pass');
  assert.equal(passed.handoff.kind, 'complete');

  const repair = agents.startRun({
    agentId: 'evaluator',
    executor: 'manual',
    input: {
      ...generated.output,
      independent: true,
      acceptance: planned.output.acceptance,
      failedCriteria: planned.output.acceptance,
    },
  });
  assert.equal(repair.output.decision, 'revision-required');
  assert.equal(repair.handoff.kind, 'repair');
  assert.equal(repair.handoff.to, 'generator');
});

test('evaluator persists criterion checks and generator self-check cannot deliver', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-agents-evidence-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '证据写入',
    body: 'Evaluator 写入所属记录。',
    analysis: '需要独立评价。',
    design: '按标准写检查。',
    acceptance: ['customer progress is visible'],
  });
  const agents = createAgentRuntime({ skills: createSkillService(), board });
  const planned = agents.startRun({ agentId: 'planner', executor: 'manual', input: original });
  const generated = agents.startRun({
    agentId: 'generator',
    executor: 'manual',
    environmentReady: true,
    workItemId: story.id,
    input: planned.output,
  });
  const afterSelfCheck = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(afterSelfCheck.checks.some((check) => check.executionKind === 'self_check'), true);
  assert.equal(hasExecutedDeliveryEvidence(afterSelfCheck, story), false);

  const failed = agents.startRun({
    agentId: 'evaluator',
    executor: 'manual',
    workItemId: story.id,
    input: {
      ...generated.output,
      independent: true,
      acceptance: planned.output.acceptance,
      failedCriteria: planned.output.acceptance,
    },
  });
  assert.equal(failed.handoff.kind, 'repair');
  const failing = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(failing.checks.some((check) => check.producer === 'evaluator' && check.status === 'failing'), true);
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);

  agents.startRun({
    agentId: 'evaluator',
    executor: 'manual',
    workItemId: story.id,
    input: {
      ...generated.output,
      independent: true,
      acceptance: planned.output.acceptance,
    },
  });
  const passed = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(hasExecutedDeliveryEvidence(passed, story), true);
  assert.equal(board.transitionWorkItem(story.id, 'delivered').status, 'delivered');
});

test('interrupted handoff can be resumed', () => {
  const agents = runtime();
  const planned = agents.startRun({ agentId: 'planner', executor: 'manual', input: original });
  const interrupted = agents.interruptRun(planned.id);
  assert.equal(interrupted.status, 'interrupted');
  const resumed = agents.resumeRun(planned.id);
  assert.equal(resumed.status, 'completed');
  assert.equal(resumed.handoff.kind, 'design_ready');
});
