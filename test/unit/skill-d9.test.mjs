import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { AgentTaskError } from '../../lib/host/agents/types.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { HUNTIANLING_NODE_PNPM_PROFILE } from '../../lib/host/environment/profile.js';
import { CODING_REQUIRED_SKILL_IDS } from '../../lib/host/skills/coding-pack.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { TECHNOLOGY_PACK_CATEGORIES } from '../../lib/host/skills/technology-packs.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

const RELATED = [
  'tech.frontend-web',
  'tech.backend-service',
  'tech.api-integration',
  'tech.database',
  'tech.mobile',
  'tech.desktop',
  'tech.data-ml',
  'tech.infrastructure',
  'tech.security',
  'tech.qa-automation',
  'tech.documentation',
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

function reactWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d9-ws-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'sample',
    dependencies: { react: '19.0.0', pg: '8.0.0' },
  }));
  writeFileSync(join(root, 'README.md'), '# sample\n');
  return root;
}

test('the catalog lists frontend, backend, database, and related versioned skill packs', () => {
  const skills = createSkillService();
  const packs = skills.listPacks();
  const ids = packs.map((item) => item.id);
  for (const id of RELATED) {
    assert.ok(ids.includes(id), id);
  }
  assert.deepEqual([...TECHNOLOGY_PACK_CATEGORIES], RELATED.map((id) => id.replace('tech.', '')));
  for (const pack of packs) {
    assert.ok(pack.version);
    assert.ok(pack.skills.length > 0);
    for (const skill of pack.skills) {
      assert.equal(HUNTIANLING_NODE_PNPM_PROFILE.requiredSkillIds.includes(skill.id), false, skill.id);
      assert.equal(CODING_REQUIRED_SKILL_IDS.includes(skill.id), false, skill.id);
    }
  }
});

test('a project scan recommends skill packs from the workspace', () => {
  const skills = createSkillService();
  const recommended = skills.recommendPacks(reactWorkspace());
  const ids = recommended.map((item) => item.packId);
  assert.ok(ids.includes('tech.frontend-web'));
  assert.ok(ids.includes('tech.database'));
  assert.ok(ids.includes('tech.documentation'));
  assert.ok(recommended.every((item) => item.version && item.reason));
});

test('a WorkItem can declare required skill packs', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d9-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['can log in'],
    requiredSkillPackIds: ['tech.frontend-web', 'tech.database'],
  });
  assert.deepEqual(item.requiredSkillPackIds, ['tech.frontend-web', 'tech.database']);
  const updated = board.updateWorkItem(item.id, { requiredSkillPackIds: ['tech.frontend-web'] });
  assert.deepEqual(updated.requiredSkillPackIds, ['tech.frontend-web']);
  assert.throws(
    () => board.updateWorkItem(item.id, { requiredSkillPackIds: ['tech.not-a-pack'] }),
    /unknown skill pack/,
  );
  assert.deepEqual(createBoardService(root).getWorkItem(item.id).requiredSkillPackIds, ['tech.frontend-web']);
});

test('installing a pack makes its versioned coverage available to the project', () => {
  const skills = createSkillService();
  const installed = skills.installPack('p1', 'tech.frontend-web');
  assert.equal(installed.packId, 'tech.frontend-web');
  assert.equal(installed.version, '1.0.0');
  assert.equal(skills.installedPacks('p1').some((row) => row.packId === 'tech.frontend-web'), true);
  assert.equal(skills.installedPacks('p2').length, 0);
  const skillId = skills.listPacks().find((item) => item.id === 'tech.frontend-web').skills[0].id;
  assert.equal(skills.isEnabled('p1', skillId), true);
  assert.equal(skills.isEnabled('p2', skillId), false);
  assert.throws(
    () => skills.installPack('p1', 'tech.frontend-web', '9.9.9'),
    /unknown skill pack version/,
  );
});

test('the agent runtime loads only the relevant installed pack skills for the selected task', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d9-'));
  const board = createBoardService(root);
  const skills = createSkillService();
  const project = board.createProject({ name: 'p' });
  skills.installPack(project.id, 'tech.frontend-web');
  skills.installPack(project.id, 'tech.qa-automation');
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '需要登录',
    design: '表单',
    acceptance: ['can log in'],
    requiredSkillPackIds: ['tech.frontend-web', 'tech.qa-automation'],
  });
  const agents = createAgentRuntime({ skills, board });
  const generated = agents.startRun({
    agentId: 'generator',
    executor: 'manual',
    environmentReady: true,
    projectId: project.id,
    workItemId: item.id,
    input: { outcome: '登录', acceptance: ['can log in'] },
  });
  assert.ok(generated.skillIds.includes('tech.frontend-web.implement'));
  assert.equal(generated.skillIds.includes('tech.qa-automation.evaluate'), false);
  const evaluated = agents.startRun({
    agentId: 'evaluator',
    executor: 'manual',
    projectId: project.id,
    workItemId: item.id,
    input: { independent: true, outcome: '登录', acceptance: ['can log in'] },
  });
  assert.ok(evaluated.skillIds.includes('tech.qa-automation.evaluate'));
  assert.equal(evaluated.skillIds.includes('tech.frontend-web.implement'), false);
});

test('a missing required pack blocks the agent run', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d9-'));
  const board = createBoardService(root);
  const skills = createSkillService();
  const project = board.createProject({ name: 'p' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '需要登录',
    design: '表单',
    acceptance: ['can log in'],
    requiredSkillPackIds: ['tech.database'],
  });
  const agents = createAgentRuntime({ skills, board });
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'generator',
        executor: 'manual',
        environmentReady: true,
        projectId: project.id,
        workItemId: item.id,
        input: { outcome: '登录', acceptance: ['can log in'] },
      }),
    (error) => error instanceof AgentTaskError && /skill pack not installed: tech.database/.test(error.message),
  );
});

test('customers cannot install skill packs', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d9-'));
  const board = createBoardService(root);
  const skills = createSkillService();
  const project = board.createProject({ name: 'p' });
  const hash = passwordHash();
  const web = createWebService(
    {
      board,
      requirements: createRequirementManagementService(board),
      skills,
      agents: createAgentRuntime({ skills, board }),
    },
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
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/skill-packs/tech.frontend-web/install`,
    { method: 'POST', headers: { cookie: customerCookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const installed = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/skill-packs/tech.frontend-web/install`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(installed.response.status, 200);
  assert.equal(installed.payload.packId, 'tech.frontend-web');
});
