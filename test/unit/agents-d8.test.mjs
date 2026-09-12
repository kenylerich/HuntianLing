import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { SPECIALIST_AGENT_IDS } from '../../lib/host/agents/types.js';
import { AgentTaskError } from '../../lib/host/agents/types.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { TOOL_EVALUATION_WRITE, TOOL_IMPLEMENTATION_WRITE } from '../../lib/host/tools/registry.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

const SIMILAR = [
  'product-owner',
  'business-analyst',
  'ux-designer',
  'architect',
  'frontend-developer',
  'backend-developer',
  'qa-engineer',
  'devops',
  'security-reviewer',
  'scrum-master',
  'technical-writer',
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

function runtime(board) {
  return createAgentRuntime({ skills: createSkillService(), ...(board !== undefined ? { board } : {}) });
}

function specialistInput(title = '登录') {
  return {
    quotes: [{ text: title, source: 'work-item' }],
    goal: title,
    outcome: title,
    confirmed: true,
    independent: true,
    acceptance: ['can log in'],
    findings: [`${title} reviewed`],
  };
}

test('the catalog lists UX, QA, security, and similar specialist agent definitions with role, responsibilities, allowed task types, allowed tools, required skills, and output expectations', () => {
  const agents = runtime();
  const ids = agents.definitions().map((item) => item.id);
  assert.deepEqual(ids.slice(0, 3), ['planner', 'generator', 'evaluator']);
  for (const id of SIMILAR) {
    assert.ok(ids.includes(id), id);
  }
  assert.deepEqual([...SPECIALIST_AGENT_IDS], SIMILAR);
  for (const id of ['ux-designer', 'qa-engineer', 'security-reviewer']) {
    const definition = agents.definitions().find((item) => item.id === id);
    assert.equal(definition.kind, 'specialist');
    assert.equal(definition.role, id);
    assert.ok(definition.responsibilities.length > 0);
    assert.ok(definition.allowedTaskTypes.length > 0);
    assert.ok(definition.allowedToolIds.length > 0);
    assert.ok(definition.requiredSkillIds.length > 0);
    assert.ok(definition.outputExpectations.length > 0);
    assert.ok(definition.outputSchema);
  }
});

test('a new project enables planner, generator, and evaluator only; specialist agents stay disabled until selected', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d8-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  assert.deepEqual(project.enabledAgentIds, ['planner', 'generator', 'evaluator']);
  for (const id of SIMILAR) {
    assert.equal(project.enabledAgentIds.includes(id), false);
  }
  assert.throws(
    () => board.disableAgent(project.id, 'planner'),
    /cannot disable coding agent/,
  );
});

test('enabling a specialist agent lets a run produce that agent\'s output and attach it to a WorkItem', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d8-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  board.enableAgent(project.id, 'ux-designer');
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['can log in'],
  });
  const agents = runtime(board);
  const run = agents.startRun({
    agentId: 'ux-designer',
    executor: 'manual',
    projectId: project.id,
    workItemId: item.id,
    input: specialistInput(),
  });
  assert.equal(run.status, 'completed');
  assert.equal(run.output.role, 'ux-designer');
  assert.ok(run.output.findings.length > 0);
  assert.ok(board.getWorkItem(item.id).evidence.some((row) => row.startsWith('agent-run:')));
});

test('disabling a specialist agent prevents new runs with that agent', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d8-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const agents = runtime(board);
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'qa-engineer',
        executor: 'manual',
        projectId: project.id,
        input: specialistInput(),
      }),
    (error) => error instanceof AgentTaskError && /not enabled/.test(error.message),
  );
});

test('a project can customize a specialist agent\'s allowed tools within its built-in boundary', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d8-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  board.enableAgent(project.id, 'ux-designer');
  const customized = board.customizeAgent(project.id, 'ux-designer', {
    allowedToolIds: [TOOL_EVALUATION_WRITE],
  });
  assert.deepEqual(
    customized.agentCustomizations.find((row) => row.agentId === 'ux-designer').allowedToolIds,
    [TOOL_EVALUATION_WRITE],
  );
  assert.throws(
    () => board.customizeAgent(project.id, 'ux-designer', { allowedToolIds: [TOOL_IMPLEMENTATION_WRITE] }),
    /cannot add tool/,
  );
  const agents = runtime(board);
  const run = agents.startRun({
    agentId: 'ux-designer',
    executor: 'manual',
    projectId: project.id,
    input: specialistInput(),
  });
  assert.deepEqual([...run.skillIds].filter((id) => id.startsWith('specialist.')), ['specialist.ux-designer']);
  assert.equal(run.status, 'completed');
});

test('agent actions are auditable', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d8-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  board.enableAgent(project.id, 'security-reviewer');
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['can log in'],
  });
  runtime(board).startRun({
    agentId: 'security-reviewer',
    executor: 'manual',
    projectId: project.id,
    workItemId: item.id,
    input: specialistInput(),
  });
  const events = board.listAuditEvents({
    projectId: project.id,
    action: 'agent.run.completed',
    targetId: item.id,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].reason, 'security-reviewer');
  assert.equal(events[0].actorId, 'security-reviewer');
});

test('customers cannot enable specialist agents', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d8-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), skills: createSkillService(), agents: runtime(board) },
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
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/agents/ux-designer/enable`,
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
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/agents/ux-designer/enable`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(enabled.response.status, 200);
  assert.ok(enabled.payload.enabledAgentIds.includes('ux-designer'));
});
