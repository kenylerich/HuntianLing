import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { DEFAULT_DELIVERY_POLICY } from '../../lib/host/board/types.js';
import { createDeliveryService } from '../../lib/host/delivery/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(2),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function setupBoard() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr12-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'MVP' });
  return { root, board, project, milestone };
}

function readyStory(board, project, milestone, extras = {}) {
  return board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '分析完成',
    design: '设计完成',
    acceptance: ['可登录'],
    milestoneId: milestone.id,
    ...extras,
  });
}

function attachExecutedEvidence(board, item, designRevision = '') {
  board.updateDeliveryEvidenceSummary(item.id, {
    ...(designRevision !== '' ? { designRevision } : {}),
    checks: [{
      id: 'evaluator:可登录',
      area: 'acceptance',
      title: '可登录',
      status: 'passing',
      required: true,
      reason: 'executed',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision,
    }],
  });
}

test('a project returns its Definition of Ready and Definition of Done policy', async (t) => {
  const { board, project } = setupBoard();
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'dev', passwordHash: hash, audience: 'developer' }],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const policy = await json(`${status.url}/api/v1/projects/${project.id}/delivery-policy`, { headers: { cookie } });
  assert.equal(policy.response.status, 200);
  assert.deepEqual(policy.payload.deliveryPolicy, DEFAULT_DELIVERY_POLICY);
});

test('a developer updates which Ready and Done checks the project requires', async (t) => {
  const { board, project } = setupBoard();
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'dev', passwordHash: hash, audience: 'developer' }],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const updated = await json(`${status.url}/api/v1/projects/${project.id}/delivery-policy`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      readyChecks: ['design', 'acceptance'],
      doneChecks: ['executed-evidence', 'children-complete'],
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.payload.deliveryPolicy.readyChecks, ['design', 'acceptance']);
  assert.ok(updated.payload.deliveryPolicy.doneChecks.includes('executed-evidence'));
  assert.ok(updated.payload.deliveryPolicy.doneChecks.includes('children-complete'));
});

test('a story cannot become ready when a configured Ready check is missing', () => {
  const { board, project, milestone } = setupBoard();
  const story = readyStory(board, project, milestone, { analysis: '', status: 'planned' });
  assert.throws(() => board.transitionWorkItem(story.id, 'ready'), /without analysis/);
  board.updateProject(project.id, {
    deliveryPolicy: { readyChecks: ['design', 'acceptance', 'milestone', 'unblocked'], doneChecks: ['executed-evidence'] },
  });
  assert.equal(board.transitionWorkItem(story.id, 'ready').status, 'ready');
});

test('a story without executed evidence cannot transition to delivered', () => {
  const { board, project, milestone } = setupBoard();
  const story = readyStory(board, project, milestone, { status: 'verifying' });
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'), /executed evidence/);
});

test('stale or failed required evidence still blocks delivered', () => {
  const { board, project, milestone } = setupBoard();
  const story = readyStory(board, project, milestone, { status: 'verifying' });
  attachExecutedEvidence(board, story, 'keep-until-update');
  board.updateWorkItem(story.id, { design: '改过的设计' });
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);
});

test('a configured extra Done check such as unfinished children blocks delivered', () => {
  const { board, project, milestone } = setupBoard();
  board.updateProject(project.id, {
    deliveryPolicy: {
      readyChecks: [...DEFAULT_DELIVERY_POLICY.readyChecks],
      doneChecks: ['executed-evidence', 'children-complete'],
    },
  });
  const story = readyStory(board, project, milestone, { status: 'verifying' });
  board.createWorkItem({
    projectId: project.id,
    type: 'task',
    title: '子任务',
    body: '未完成',
    parentId: story.id,
    acceptance: ['做完'],
  });
  attachExecutedEvidence(board, story);
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'), /child work is unfinished/);
});

test('inspecting delivery gates names the missing Ready or Done pieces', async (t) => {
  const { board, project, milestone } = setupBoard();
  const story = readyStory(board, project, milestone, { analysis: '', status: 'planned' });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'dev', passwordHash: hash, audience: 'developer' }],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const ready = await json(`${status.url}/api/v1/work-items/${story.id}/delivery-gates?to=ready`, { headers: { cookie } });
  assert.equal(ready.payload.allowed, false);
  assert.ok(ready.payload.missing.some((row) => row.code === 'missing_analysis_for_ready'));
  const delivered = await json(`${status.url}/api/v1/work-items/${story.id}/delivery-gates?to=delivered`, { headers: { cookie } });
  assert.equal(delivered.payload.allowed, false);
  assert.ok(delivered.payload.missing.some((row) => row.code === 'missing_executed_evidence_for_done'));
});

test('Story delivery start uses the project Ready policy', () => {
  const { root, board, project, milestone } = setupBoard();
  board.updateProject(project.id, {
    deliveryPolicy: {
      readyChecks: ['design', 'acceptance', 'milestone', 'unblocked'],
      doneChecks: ['executed-evidence'],
    },
  });
  const story = readyStory(board, project, milestone, { analysis: '', status: 'ready' });
  const delivery = createDeliveryService({
    board,
    agents: createAgentRuntime({ skills: createSkillService(), board }),
    workspaceRoot: root,
  });
  const run = delivery.start({ workItemId: story.id, actor: 'dev' });
  assert.equal(run.status, 'running');
});

test('customers cannot change the project Ready or Done policy', async (t) => {
  const { board, project } = setupBoard();
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
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
  const patched = await json(`${status.url}/api/v1/projects/${project.id}/delivery-policy`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ readyChecks: ['design'], doneChecks: ['executed-evidence'] }),
  });
  assert.equal(patched.response.status, 403);
});
