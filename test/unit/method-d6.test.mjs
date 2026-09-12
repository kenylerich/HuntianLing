import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { AgentTaskError } from '../../lib/host/agents/types.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { HUNTIANLING_NODE_PNPM_PROFILE } from '../../lib/host/environment/profile.js';
import { DESIGN_METHOD_SKILLS, SKILL_PLANNER_BDD } from '../../lib/host/skills/design-methods.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

const EXTRA_METHODS = [
  'use-case',
  'bdd',
  'example-mapping',
  'event-storming',
  'ddd',
  'api-design',
  'adr',
  'threat-modeling',
];

function plannerInput() {
  return {
    quotes: [{ text: '客户只看自己的进度', source: 'customer' }],
    goal: 'Customer sees only their progress',
    actors: ['customer'],
    confirmed: true,
    acceptance: ['customer progress is visible'],
  };
}

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

test('the catalog lists user-story plus use-case, bdd, example-mapping, event-storming, ddd, api-design, adr, and threat-modeling', () => {
  const agents = createAgentRuntime({ skills: createSkillService() });
  const ids = agents.methods().map((item) => item.id);
  assert.ok(ids.includes('user-story'));
  for (const id of EXTRA_METHODS) {
    assert.ok(ids.includes(id), id);
  }
  assert.deepEqual(agents.baseline().methodIds, ['user-story']);
  for (const skill of DESIGN_METHOD_SKILLS) {
    assert.equal(HUNTIANLING_NODE_PNPM_PROFILE.requiredSkillIds.includes(skill.id), false, skill.id);
  }
});

test('a new project has user-story enabled and the extra packs disabled until selected', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d6-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  assert.deepEqual(project.enabledMethodIds, ['user-story']);
  for (const id of EXTRA_METHODS) {
    assert.equal(project.enabledMethodIds.includes(id), false);
  }
  const reloaded = createBoardService(root).listProjects()[0];
  assert.deepEqual(reloaded.enabledMethodIds, ['user-story']);
});

test('enabling a method pack lets a planner run produce that method\'s output fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d6-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  board.updateProject(project.id, { enabledMethodIds: ['user-story', 'bdd'] });
  const agents = createAgentRuntime({ skills: createSkillService(), board });
  const run = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    projectId: project.id,
    methodId: 'bdd',
    input: plannerInput(),
  });
  assert.equal(run.status, 'completed');
  assert.equal(run.output.bdd.feature, plannerInput().goal);
  assert.ok(run.output.bdd.scenarios.length > 0);
});

test('a WorkItem records the method pack that produced it', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d6-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  board.updateProject(project.id, { enabledMethodIds: ['user-story', 'use-case'] });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['可登录'],
  });
  const agents = createAgentRuntime({ skills: createSkillService(), board });
  agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    projectId: project.id,
    workItemId: item.id,
    methodId: 'use-case',
    input: plannerInput(),
  });
  assert.equal(board.getWorkItem(item.id).methodId, 'use-case');
  const reloaded = createBoardService(root);
  assert.equal(reloaded.getWorkItem(item.id).methodId, 'use-case');
});

test('missing method skills are reported as skill gaps and block the planner run', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d6-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  board.updateProject(project.id, { enabledMethodIds: ['user-story', 'bdd'] });
  const skills = createSkillService();
  skills.disableForProject(project.id, SKILL_PLANNER_BDD);
  const agents = createAgentRuntime({ skills, board });
  const gaps = agents.methodGaps(project.id, 'bdd');
  assert.ok(gaps.some((gap) => gap.kind === 'disabled' && gap.skillId === SKILL_PLANNER_BDD));
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'planner',
        executor: 'manual',
        projectId: project.id,
        methodId: 'bdd',
        input: plannerInput(),
      }),
    (error) => error instanceof AgentTaskError && error.code === 'MISSING_METHOD',
  );
});

test('disabling a pack prevents new planner runs with that method', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d6-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const agents = createAgentRuntime({ skills: createSkillService(), board });
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'planner',
        executor: 'manual',
        projectId: project.id,
        methodId: 'adr',
        input: plannerInput(),
      }),
    (error) => error instanceof AgentTaskError && /not enabled/.test(error.message),
  );
});

test('customers cannot enable method packs', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d6-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const skills = createSkillService();
  const agents = createAgentRuntime({ skills, board });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), skills, agents },
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
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/methods/bdd/enable`,
    { method: 'POST', headers: { cookie: customerCookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const enabled = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/methods/api-design/enable`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(enabled.response.status, 200);
  assert.ok(enabled.payload.enabledMethodIds.includes('api-design'));
});
