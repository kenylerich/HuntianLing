import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDeliveryService } from '../../lib/host/delivery/service.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(5),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function workspace(withPackage = true) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr13-'));
  if (withPackage) writeFileSync(join(root, 'package.json'), '{"name":"sample"}\n');
  return root;
}

function passingRunner(command) {
  if (command.includes('lint') || command.includes('hygiene')) {
    return { status: 'fail', output: 'HUNTIANLING_PROBE: no lint yet' };
  }
  return { status: 'pass', output: 'ok' };
}

function env() {
  return createEnvironmentService({ skills: createSkillService() });
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
  return board.createWorkItem({
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
}

test('a caller lists local and replacement environment fleet slots', () => {
  const service = env();
  const source = workspace();
  const target = workspace(false);
  service.prepare({
    workspaceRoot: source,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  service.replace({
    sourceRoot: source,
    targetRoot: target,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  const fleets = service.listFleets();
  assert.equal(fleets.some((slot) => slot.kind === 'local' && slot.workspaceRoot === source), true);
  assert.equal(fleets.some((slot) => slot.kind === 'remote' && slot.workspaceRoot === target), true);
});

test('a replacement environment is prepared from the same profile', () => {
  const service = env();
  const source = workspace();
  const target = workspace(false);
  const prepared = service.prepare({
    workspaceRoot: source,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  const replaced = service.replace({
    sourceRoot: source,
    targetRoot: target,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  assert.equal(replaced.prepare.profileId, prepared.profileId);
  assert.equal(replaced.prepare.profileVersion, prepared.profileVersion);
  assert.equal(replaced.slot.kind, 'remote');
  assert.equal(replaced.prepare.ready, true);
});

test('uncommitted work is copied onto the replacement environment', () => {
  const service = env();
  const source = workspace();
  writeFileSync(join(source, 'uncommitted-work.txt'), 'keep me\n');
  service.prepare({
    workspaceRoot: source,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  const target = workspace(false);
  const replaced = service.replace({
    sourceRoot: source,
    targetRoot: target,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  assert.ok(replaced.uncommitted.preserved.includes('uncommitted-work.txt'));
  assert.equal(replaced.uncommitted.atRisk.length, 0);
  assert.equal(readFileSync(join(target, 'uncommitted-work.txt'), 'utf8'), 'keep me\n');
});

test('uncommitted work that would be discarded is reported and blocks until loss is accepted', () => {
  const service = env();
  const source = workspace();
  writeFileSync(join(source, 'uncommitted-work.txt'), 'keep me\n');
  service.prepare({
    workspaceRoot: source,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  const blocked = service.replace({
    sourceRoot: source,
    targetRoot: workspace(false),
    preserveUncommitted: false,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  assert.equal(blocked.prepare.ready, false);
  assert.ok(blocked.uncommitted.atRisk.includes('uncommitted-work.txt'));
  assert.ok(blocked.prepare.blockers.some((row) => row.kind === 'uncommitted'));

  const accepted = service.replace({
    sourceRoot: source,
    targetRoot: workspace(false),
    preserveUncommitted: false,
    acceptUncommittedLoss: true,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  assert.equal(accepted.prepare.ready, true);
  assert.ok(accepted.uncommitted.atRisk.includes('uncommitted-work.txt'));
  assert.equal(accepted.uncommitted.preserved.length, 0);
});

test('an interrupted Story delivery run resumes on the replacement environment without re-running a completed Planner step', () => {
  const source = workspace();
  const board = createBoardService(source);
  const story = readyStory(board);
  const first = countingAgents(board);
  const delivery = createDeliveryService({ board, agents: first.agents, workspaceRoot: source });
  const started = delivery.start({ workItemId: story.id, environmentReady: true });
  delivery.advance(started.id);
  assert.equal(first.counts.planner, 1);
  delivery.interrupt(started.id);

  const service = env();
  service.prepare({
    workspaceRoot: source,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  const target = workspace(false);
  service.replace({
    sourceRoot: source,
    targetRoot: target,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  const second = countingAgents(board);
  const resumedService = createDeliveryService({ board, agents: second.agents, workspaceRoot: target });
  const resumed = resumedService.resume(started.id);
  const implemented = resumedService.advance(resumed.id);
  assert.equal(second.counts.planner, 0);
  assert.equal(second.counts.generator, 1);
  assert.deepEqual(implemented.checkpoint.completedSteps, ['plan', 'implement']);
});

test('a failed prerequisite on the replacement still leaves it not ready', () => {
  const service = env();
  const source = workspace(false);
  service.prepare({
    workspaceRoot: source,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  const replaced = service.replace({
    sourceRoot: source,
    targetRoot: workspace(false),
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  assert.equal(replaced.prepare.ready, false);
  assert.ok(replaced.prepare.blockers.some((row) => row.kind === 'dependency'));
});

test('secrets are not persisted in fleet records', () => {
  const service = env();
  const source = workspace();
  service.prepare({
    workspaceRoot: source,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
    env: { DEEPSEEK_API_KEY: 'super-secret' },
  });
  const target = workspace(false);
  const replaced = service.replace({
    sourceRoot: source,
    targetRoot: target,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
    env: { DEEPSEEK_API_KEY: 'super-secret' },
  });
  const persisted = readFileSync(join(target, '.huntianling/environment-profile.json'), 'utf8');
  assert.equal(persisted.includes('super-secret'), false);
  assert.equal(JSON.stringify(replaced.slot).includes('super-secret'), false);
});

test('customers cannot replace environments', async (t) => {
  const root = workspace();
  const board = createBoardService(root);
  const environment = env();
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), environment },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'cust', passwordHash: hash, audience: 'customer' }],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const fleets = await json(`${status.url}/api/v1/environment/fleets`, { headers: { cookie } });
  assert.equal(fleets.response.status, 403);
  const replaced = await json(`${status.url}/api/v1/environment/replace`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ sourceRoot: root, targetRoot: workspace(false) }),
  });
  assert.equal(replaced.response.status, 403);
});
