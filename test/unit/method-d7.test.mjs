import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { PRIORITIZATION_METHOD_IDS } from '../../lib/host/board/prioritization.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

const PACKS = [
  'moscow',
  'rice',
  'wsjf',
  'kano',
  'risk-first',
  'dependency-first',
  'milestone-first',
];

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(16),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function story(board, projectId, title, rankingInputs = {}) {
  return board.createWorkItem({
    projectId,
    type: 'story',
    title,
    body: title,
    acceptance: ['can be ranked'],
    rankingInputs,
  });
}

test('the catalog lists moscow, rice, wsjf, kano, risk-first, dependency-first, and milestone-first', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d7-'));
  const board = createBoardService(root);
  const ids = board.prioritizationMethods().map((item) => item.id);
  assert.deepEqual(ids, PACKS);
  assert.deepEqual([...PRIORITIZATION_METHOD_IDS], PACKS);
});

test('a project can select a prioritization method', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d7-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  assert.equal(project.prioritizationMethodId, null);
  const updated = board.updateProject(project.id, { prioritizationMethodId: 'rice' });
  assert.equal(updated.prioritizationMethodId, 'rice');
  assert.equal(createBoardService(root).listProjects()[0].prioritizationMethodId, 'rice');
  assert.throws(
    () => board.updateProject(project.id, { prioritizationMethodId: 'not-a-pack' }),
    /unknown prioritization method/,
  );
});

test('a WorkItem stores the inputs needed by the selected method', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d7-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const item = story(board, project.id, '登录', {
    riceReach: 10,
    riceImpact: 3,
    riceConfidence: 0.8,
    riceEffort: 2,
  });
  assert.equal(item.rankingInputs.riceReach, 10);
  assert.equal(item.rankingInputs.riceEffort, 2);
  const updated = board.updateWorkItem(item.id, {
    rankingInputs: { moscow: 'must', riskScore: 9 },
  });
  assert.equal(updated.rankingInputs.moscow, 'must');
  assert.equal(updated.rankingInputs.riskScore, 9);
  assert.equal(createBoardService(root).getWorkItem(item.id).rankingInputs.moscow, 'must');
});

test('ranking output is explainable and traceable to inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d7-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  board.updateProject(project.id, { prioritizationMethodId: 'rice' });
  const low = story(board, project.id, '低分', {
    riceReach: 1,
    riceImpact: 1,
    riceConfidence: 1,
    riceEffort: 2,
  });
  const high = story(board, project.id, '高分', {
    riceReach: 10,
    riceImpact: 3,
    riceConfidence: 1,
    riceEffort: 2,
  });
  const queue = board.getStoryPriorityQueue(project.id);
  assert.equal(queue.methodId, 'rice');
  assert.deepEqual(queue.items.map((item) => item.workItemId), [high.id, low.id]);
  assert.equal(queue.items[0].score, 15);
  assert.match(queue.items[0].explanation, /RICE 15 = \(10 × 3 × 1\) \/ 2/);
  assert.equal(queue.items[1].score, 0.5);
  assert.match(queue.items[1].explanation, /RICE 0.5 = \(1 × 1 × 1\) \/ 2/);

  board.updateWorkItem(high.id, {
    rankingInputs: { wsjfUserBusinessValue: 1, wsjfTimeCriticality: 1, wsjfRiskReduction: 1, wsjfJobSize: 3, kano: 'excitement', riskScore: 1 },
  });
  board.updateWorkItem(low.id, {
    rankingInputs: { wsjfUserBusinessValue: 8, wsjfTimeCriticality: 2, wsjfRiskReduction: 2, wsjfJobSize: 1, kano: 'basic', riskScore: 9 },
    dependencyIds: [high.id],
  });
  board.updateProject(project.id, { prioritizationMethodId: 'wsjf' });
  const wsjf = board.getStoryPriorityQueue(project.id);
  assert.deepEqual(wsjf.items.map((item) => item.workItemId), [low.id, high.id]);
  assert.match(wsjf.items[0].explanation, /WSJF 12 = \(8 \+ 2 \+ 2\) \/ 1/);

  board.updateProject(project.id, { prioritizationMethodId: 'kano' });
  const kano = board.getStoryPriorityQueue(project.id);
  assert.equal(kano.items[0].workItemId, low.id);
  assert.match(kano.items[0].explanation, /Kano basic/);

  board.updateProject(project.id, { prioritizationMethodId: 'risk-first' });
  const risk = board.getStoryPriorityQueue(project.id);
  assert.equal(risk.items[0].workItemId, low.id);
  assert.match(risk.items[0].explanation, /risk-first 9/);

  board.updateProject(project.id, { prioritizationMethodId: 'dependency-first' });
  const dependency = board.getStoryPriorityQueue(project.id);
  assert.equal(dependency.items[0].workItemId, high.id);
  assert.match(dependency.items[0].explanation, /dependency-first dependents 1, blockers 0/);
});

test('ranked Story output feeds the Story priority queue', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d7-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const later = board.createMilestone({
    projectId: project.id,
    title: 'GA',
    dueDate: 200,
  });
  const earlier = board.createMilestone({
    projectId: project.id,
    title: 'MVP',
    dueDate: 50,
  });
  const ga = story(board, project.id, 'GA 故事');
  board.updateWorkItem(ga.id, { milestoneId: later.id });
  const mvp = story(board, project.id, 'MVP 故事');
  board.updateWorkItem(mvp.id, { milestoneId: earlier.id });
  assert.deepEqual(
    board.getStoryPriorityQueue(project.id).items.map((item) => item.workItemId),
    [ga.id, mvp.id],
  );
  board.updateProject(project.id, { prioritizationMethodId: 'milestone-first' });
  const queue = board.getStoryPriorityQueue(project.id);
  assert.deepEqual(queue.items.map((item) => item.workItemId), [mvp.id, ga.id]);
  assert.match(queue.items[0].explanation, /milestone-first MVP due 50/);
});

test('users can override ranking with an audit reason', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d7-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  board.updateProject(project.id, { prioritizationMethodId: 'moscow' });
  const could = story(board, project.id, 'Could', { moscow: 'could' });
  const must = story(board, project.id, 'Must', { moscow: 'must' });
  assert.deepEqual(
    board.getStoryPriorityQueue(project.id).items.map((item) => item.workItemId),
    [must.id, could.id],
  );
  assert.throws(
    () => board.overrideStoryRanking(could.id, { rank: 1, reason: '   ', actorId: 'po' }),
    /audit reason/,
  );
  const overridden = board.overrideStoryRanking(could.id, {
    rank: 1,
    reason: 'launch blocker',
    actorId: 'po',
  });
  assert.equal(overridden.rankingOverride.reason, 'launch blocker');
  const queue = board.getStoryPriorityQueue(project.id);
  assert.deepEqual(queue.items.map((item) => item.workItemId), [could.id, must.id]);
  assert.equal(queue.items[0].overridden, true);
  assert.match(queue.items[0].explanation, /override rank 1: launch blocker/);
  const events = board.listAuditEvents({
    projectId: project.id,
    action: 'work_item.ranking_overridden',
    targetId: could.id,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].reason, 'launch blocker');
  assert.equal(events[0].actorId, 'po');
});

test('customers cannot select a prioritization method', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d7-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
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
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const customerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const customerCookie = customerLogin.response.headers.get('set-cookie')?.split(';')[0];
  const denied = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/prioritization`,
    {
      method: 'PUT',
      headers: { cookie: customerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ methodId: 'wsjf' }),
    },
  );
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const selected = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/prioritization`,
    {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ methodId: 'wsjf' }),
    },
  );
  assert.equal(selected.response.status, 200);
  assert.equal(selected.payload.prioritizationMethodId, 'wsjf');
});
