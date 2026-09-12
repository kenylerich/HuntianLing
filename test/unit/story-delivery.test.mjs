import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { hasExecutedDeliveryEvidence } from '../../lib/host/board/executed-evidence.js';
import { createDeliveryService } from '../../lib/host/delivery/service.js';
import { DeliveryError } from '../../lib/host/delivery/types.js';
import { deliveryStorePath } from '../../lib/host/delivery/store.js';
import { createSkillService } from '../../lib/host/skills/service.js';

function workspace() {
  return mkdtempSync(join(tmpdir(), 'huntianling-delivery-'));
}

function countingAgents(board) {
  const inner = createAgentRuntime({ skills: createSkillService(), board });
  const counts = { planner: 0, generator: 0, evaluator: 0 };
  return {
    counts,
    agents: {
      definitions: () => inner.definitions(),
      methods: () => inner.methods(),
      baseline: () => inner.baseline(),
      resolveBinding: (id) => inner.resolveBinding(id),
      startRun(input) {
        counts[input.agentId] += 1;
        return inner.startRun(input);
      },
      interruptRun: (id) => inner.interruptRun(id),
      resumeRun: (id) => inner.resumeRun(id),
      getRun: (id) => inner.getRun(id),
      listRuns: () => inner.listRuns(),
    },
  };
}

function readyStory(board) {
  const project = board.createProject({ name: 'p' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '客户能登录',
    body: '用账号登录系统。',
    analysis: '需要登录入口。',
    design: '账号密码表单。',
    acceptance: ['customer can log in'],
    sourceInput: '我要登录',
    milestoneId: milestone.id,
  });
  return { project, milestone, story };
}

test('a Story that fails Definition of Ready cannot start a delivery run', () => {
  const root = workspace();
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '未就绪',
    body: '缺分析。',
    acceptance: ['x'],
  });
  const { agents } = countingAgents(board);
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  assert.throws(
    () => delivery.start({ workItemId: story.id, environmentReady: true }),
    (error) => error instanceof DeliveryError && error.code === 'NOT_READY',
  );
});

test('start writes a durable checkpoint outside the in-memory runtime', () => {
  const root = workspace();
  const board = createBoardService(root);
  const { story } = readyStory(board);
  const { agents } = countingAgents(board);
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const run = delivery.start({ workItemId: story.id, environmentReady: true });
  assert.equal(run.status, 'running');
  assert.deepEqual(run.checkpoint.pendingSteps, ['plan', 'implement', 'evaluate']);
  assert.equal(existsSync(deliveryStorePath(root)), true);
  const reloaded = createDeliveryService({
    board,
    agents: countingAgents(board).agents,
    workspaceRoot: root,
  });
  assert.equal(reloaded.get(run.id).id, run.id);
  assert.equal(reloaded.get(run.id).checkpoint.nextAction, 'plan');
});

test('interrupt after a persisted step then resume on a new runtime does not re-run that step', () => {
  const root = workspace();
  const board = createBoardService(root);
  const { story } = readyStory(board);
  const first = countingAgents(board);
  const delivery = createDeliveryService({ board, agents: first.agents, workspaceRoot: root });
  const started = delivery.start({ workItemId: story.id, environmentReady: true });
  const planned = delivery.advance(started.id);
  assert.deepEqual(planned.checkpoint.completedSteps, ['plan']);
  assert.equal(first.counts.planner, 1);
  delivery.interrupt(planned.id);

  const second = countingAgents(board);
  const resumedService = createDeliveryService({ board, agents: second.agents, workspaceRoot: root });
  const resumed = resumedService.resume(started.id);
  assert.equal(resumed.status, 'running');
  const implemented = resumedService.advance(resumed.id);
  assert.equal(second.counts.planner, 0);
  assert.equal(second.counts.generator, 1);
  assert.deepEqual(implemented.checkpoint.completedSteps, ['plan', 'implement']);
});

test('duplicate or stale events are rejected and do not change run state', () => {
  const root = workspace();
  const board = createBoardService(root);
  const { story } = readyStory(board);
  const { agents } = countingAgents(board);
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const run = delivery.start({ workItemId: story.id, environmentReady: true });
  const seq = run.checkpoint.seq;
  const duplicate = delivery.ingestEvent({
    runId: run.id,
    key: run.events[0].key,
    type: 'story_delivery.started',
    seq,
  });
  assert.equal(duplicate.status, 'running');
  assert.equal(duplicate.checkpoint.seq, seq);
  assert.equal(duplicate.events.at(-1).accepted, false);
  assert.equal(duplicate.events.at(-1).rejection, 'duplicate event');

  const stale = delivery.ingestEvent({
    runId: run.id,
    key: 'advance:stale-key',
    type: 'step.completed',
    seq: 0,
  });
  assert.equal(stale.status, 'running');
  assert.equal(stale.checkpoint.completedSteps.length, 0);
  assert.equal(stale.events.at(-1).rejection, 'stale event');
});

test('cancel records a visible reason and a recoverable handoff', () => {
  const root = workspace();
  const board = createBoardService(root);
  const { story } = readyStory(board);
  const { agents } = countingAgents(board);
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const run = delivery.start({ workItemId: story.id, environmentReady: true });
  const cancelled = delivery.cancel(run.id, 'stop for now');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.checkpoint.nextAction, 'recover or start a new run');
  assert.equal(cancelled.events.at(-1).reason, 'stop for now');
});

test('retry limits block unbounded repair loops', () => {
  const root = workspace();
  const board = createBoardService(root);
  const { story } = readyStory(board);
  const inner = createAgentRuntime({ skills: createSkillService(), board });
  const agents = {
    ...countingAgents(board).agents,
    startRun(input) {
      if (input.agentId === 'evaluator') {
        return inner.startRun({
          ...input,
          input: { ...input.input, failedCriteria: ['customer can log in'] },
        });
      }
      return inner.startRun(input);
    },
  };
  const delivery = createDeliveryService({
    board,
    agents,
    workspaceRoot: root,
    config: { maxRetries: 0, maxSteps: 12 },
  });
  const run = delivery.start({ workItemId: story.id, environmentReady: true, drive: true });
  assert.equal(run.status, 'blocked');
  assert.ok(run.checkpoint.blockers.includes('retry limit'));
});

test('driving one ready Story records three agents and Evaluator evidence', () => {
  const root = workspace();
  const board = createBoardService(root);
  const { story } = readyStory(board);
  const { agents, counts } = countingAgents(board);
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const run = delivery.start({ workItemId: story.id, environmentReady: true, drive: true });
  assert.equal(run.status, 'completed');
  assert.equal(counts.planner, 1);
  assert.equal(counts.generator, 1);
  assert.equal(counts.evaluator, 1);
  assert.equal(run.checkpoint.decisions.plan.role, 'planner');
  assert.equal(run.checkpoint.decisions.implement.role, 'generator');
  assert.equal(run.checkpoint.decisions.evaluate.decision, 'pass');
  const evidence = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(hasExecutedDeliveryEvidence(evidence, board.getWorkItem(story.id)), true);
});

test('changing analysis after a checkpoint blocks resume', () => {
  const root = workspace();
  const board = createBoardService(root);
  const { story } = readyStory(board);
  const { agents } = countingAgents(board);
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const run = delivery.start({ workItemId: story.id, environmentReady: true });
  delivery.advance(run.id);
  delivery.interrupt(run.id);
  board.updateWorkItem(story.id, { analysis: '范围已变' });
  const resumed = delivery.resume(run.id);
  assert.equal(resumed.status, 'blocked');
  assert.ok(resumed.checkpoint.blockers.includes('stale after design revision'));
});
