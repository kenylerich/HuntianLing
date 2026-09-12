import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { AgentTaskError } from '../../lib/host/agents/types.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDispatchService } from '../../lib/host/dispatch/service.js';
import { resolveDispatchConfig } from '../../lib/host/dispatch/types.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-tool-feedback-'));
  writeFileSync(join(root, 'package.json'), '{"name":"sample"}\n');
  const board = createBoardService(root);
  const skills = createSkillService();
  const environment = createEnvironmentService({ skills, board });
  const dispatch = createDispatchService({
    board,
    workspaceRoot: root,
    config: resolveDispatchConfig({ leaseTtlMs: 60_000 }),
  });
  const agents = createAgentRuntime({ skills, board, environment, dispatch });
  const project = board.createProject({ name: 'p' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'MVP' });
  const parent = board.createWorkItem({
    projectId: project.id,
    type: 'feature',
    title: '登录能力',
    body: '史诗',
    analysis: 'a',
    design: 'd',
    acceptance: ['epic ok'],
    milestoneId: milestone.id,
  });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '分析完成',
    design: '设计完成',
    acceptance: ['可登录'],
    parentId: parent.id,
    milestoneId: milestone.id,
  });
  board.createWorkItem({
    projectId: project.id,
    type: 'task',
    title: '实现表单',
    body: '子任务',
    analysis: 'a',
    design: 'd',
    acceptance: ['表单可用'],
    parentId: item.id,
  });
  const session = board.createIntakeSession({ projectId: project.id, title: '登录收集', submitter: 'po' });
  board.addIntakeSourceDocument(session.id, {
    kind: 'markdown',
    name: 'login.md',
    extractedText: '客户要登录',
  });
  environment.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: () => ({ status: 'pass', output: 'ok' }),
  });
  return { root, board, skills, environment, dispatch, agents, project, item };
}

test('inspecting an agent task injects work item context and related records', () => {
  const { agents, dispatch, item } = setup();
  const run = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    workItemId: item.id,
    projectId: item.projectId,
    input: {
      quotes: [{ text: '客户要登录', source: 'customer' }],
      goal: 'Customer can log in',
      confirmed: true,
      acceptance: ['can log in'],
    },
  });
  dispatch.captureRun(run);
  const packet = agents.inspectTask({
    workItemId: item.id,
    agentId: 'evaluator',
    input: { independent: true, acceptance: item.acceptance },
  });
  assert.equal(packet.workItem.id, item.id);
  assert.equal(packet.parent.title, '登录能力');
  assert.ok(packet.children.some((row) => row.title === '实现表单'));
  assert.equal(packet.milestone.title, 'MVP');
  assert.ok(packet.acceptance.includes('可登录'));
  assert.equal(packet.techProfile.id, 'huntianling.node-pnpm');
  assert.ok(packet.sourceDocuments.some((row) => row.title === 'login.md'));
  assert.ok(packet.priorFeedback.some((row) => row.agentId === 'planner'));
  assert.ok(packet.toolPermissions.length > 0);
  assert.ok(Array.isArray(packet.checks));
});

test('missing required information is listed and blocks start', () => {
  const { board, agents, project } = setup();
  const incomplete = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '缺验收',
    body: '还没写验收',
  });
  const packet = agents.inspectTask({
    workItemId: incomplete.id,
    agentId: 'evaluator',
    input: { independent: true },
  });
  assert.equal(packet.ready, false);
  assert.ok(packet.missing.some((row) => row.field === 'acceptance' && row.blocking));
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'evaluator',
        executor: 'manual',
        workItemId: incomplete.id,
        projectId: project.id,
        input: { independent: true, outcome: incomplete.title, acceptance: [] },
      }),
    (error) => error instanceof AgentTaskError && error.code === 'MISSING_INPUT',
  );
});

test('a completed agent run returns structured feedback fields', () => {
  const agents = createAgentRuntime({ skills: createSkillService() });
  const run = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    input: {
      quotes: [{ text: '客户只看自己的进度', source: 'customer' }],
      goal: 'Customer sees only their progress',
      confirmed: true,
      acceptance: ['customer progress is visible'],
      openQuestions: ['SSO?'],
    },
  });
  assert.equal(typeof run.output.feedback, 'string');
  assert.ok(Array.isArray(run.output.assumptions));
  assert.ok(run.output.openQuestions.includes('SSO?'));
  assert.ok(Array.isArray(run.output.evidenceRefs));
  assert.ok(run.output.nextActions.includes('design_ready'));
});

test('customers cannot inspect agent task context', async (t) => {
  const { root, board, project, item, agents } = setup();
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(7) });
  const web = createWebService(
    { board, requirements, agents },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        users: [{ username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] }],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const inspected = await fetch(`${status.url}/api/v1/work-items/${encodeURIComponent(item.id)}/agent-tasks/inspect`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ agentId: 'evaluator' }),
  });
  assert.equal(inspected.status, 403);
});
