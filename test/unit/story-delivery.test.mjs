import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { hasExecutedDeliveryEvidence } from '../../lib/host/board/executed-evidence.js';
import { createDeliveryService } from '../../lib/host/delivery/service.js';
import { DeliveryError } from '../../lib/host/delivery/types.js';
import { deliveryStorePath } from '../../lib/host/delivery/store.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
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

function writePackage(root) {
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'delivery-app',
    type: 'module',
    scripts: {
      typecheck: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
      'doc-sync': 'node -e "process.exit(0)"',
      lint: 'node -e "process.exit(0)"',
      hygiene: 'node -e "process.exit(0)"',
    },
  }, null, 2));
}

function preparedDelivery(root) {
  writePackage(root);
  const board = createBoardService(root);
  const { project, story } = readyStory(board);
  const skills = createSkillService();
  const environment = createEnvironmentService({ skills, board });
  environment.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: () => ({ status: 'pass', output: 'ok' }),
    projectId: project.id,
  });
  const agents = createAgentRuntime({ skills, board, environment });
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root, environment });
  return { board, story, agents, delivery };
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
  assert.equal(evidence.checks.some((check) => check.producer === 'evaluator' && check.executionKind === 'demonstration'), true);
  assert.equal(hasExecutedDeliveryEvidence(evidence, board.getWorkItem(story.id)), false);
  assert.throws(
    () => board.transitionWorkItem(story.id, 'delivered'),
    /executed evidence|blocking delivery evidence/,
  );
});

test('a prepared deterministic Story records local artifacts without claiming dsh execution or delivery evidence', () => {
  const root = workspace();
  const { board, story, agents, delivery } = preparedDelivery(root);
  const run = delivery.start({ workItemId: story.id, drive: true });
  assert.equal(run.status, 'completed');
  assert.ok(run.checkpoint.candidateRevision);
  assert.equal(run.checkpoint.artifactRefs.length, 1);
  assert.equal(existsSync(join(root, run.checkpoint.artifactRefs[0])), true);
  assert.equal(run.checkpoint.taskReferences.length, 3);
  assert.equal(run.checkpoint.taskReferences.every((ref) => ref.sessionId.startsWith('local-session:')), true);
  assert.ok(run.checkpoint.taskReferences.every((ref) => ref.toolCallIds.length === 0));
  const plannerRun = agents.getRun(run.agentRunIds[0]);
  assert.equal(plannerRun.methodTrace.methodId, 'user-story');
  assert.equal(plannerRun.methodTrace.sensors.every((sensor) => sensor.status === 'pass'), true);
  const evidence = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(evidence.checks.some((check) => check.producer === 'evaluator' && check.executionKind === 'executed'), false);
  assert.equal(hasExecutedDeliveryEvidence(evidence, board.getWorkItem(story.id)), false);
});

test('a deterministic candidate evaluation exercises bounded repair without authorizing delivery', () => {
  const root = workspace();
  const { board, story, agents, delivery } = preparedDelivery(root);
  const started = delivery.start({ workItemId: story.id });
  delivery.advance(started.id);
  const implemented = delivery.advance(started.id);
  appendFileSync(join(root, implemented.checkpoint.artifactRefs[0]), '\n// changed after generator self-check\n');
  const repair = delivery.advance(started.id);
  assert.equal(repair.status, 'running');
  assert.equal(repair.checkpoint.decisions.evaluate.decision, 'revision-required');
  assert.equal(repair.checkpoint.budgetUsage.retries, 1);
  assert.deepEqual(repair.checkpoint.pendingSteps, ['implement', 'evaluate']);
  const completed = delivery.drive(started.id);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.checkpoint.budgetUsage.retries, 1);
  assert.equal(agents.listRuns().filter((run) => run.agentId === 'generator').length, 2);
  assert.equal(agents.listRuns().filter((run) => run.agentId === 'evaluator').length, 2);
  assert.equal(completed.checkpoint.decisions.evaluate.decision, 'pass');
  assert.equal(hasExecutedDeliveryEvidence(board.getDeliveryEvidenceSummary(story.id), board.getWorkItem(story.id)), false);
});

test('resume blocks when candidate code changed after the checkpoint and before evaluation', () => {
  const root = workspace();
  const { story, delivery } = preparedDelivery(root);
  const started = delivery.start({ workItemId: story.id });
  delivery.advance(started.id);
  const implemented = delivery.advance(started.id);
  appendFileSync(join(root, implemented.checkpoint.artifactRefs[0]), '\n// unexpected local edit\n');
  delivery.interrupt(started.id);
  const resumed = delivery.resume(started.id);
  assert.equal(resumed.status, 'blocked');
  assert.ok(resumed.checkpoint.blockers.includes('candidate revision changed after checkpoint'));
  assert.equal(resumed.checkpoint.nextAction, 'revalidate candidate');
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
