import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';
import { createWorkflowService } from '../../lib/host/workflow/service.js';

const BUILTIN_IDS = [
  'huntianling.user-story',
  'huntianling.scrum',
  'huntianling.kanban',
  'huntianling.hotfix',
  'huntianling.research',
];

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d2-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const workflow = createWorkflowService({ board, workspaceRoot: root });
  return { root, board, project, workflow };
}

function story(board, projectId) {
  const milestone = board.createMilestone({ projectId, title: 'MVP' });
  return board.createWorkItem({
    projectId,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '分析完成',
    design: '设计完成',
    acceptance: ['可登录'],
    milestoneId: milestone.id,
  });
}

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(11),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function planOn(workflow, board, projectId, templateId) {
  workflow.selectTemplate(projectId, templateId);
  const item = story(board, projectId);
  return { item, run: workflow.plan(item.id, 'dev') };
}

test('the catalog lists user-story, Scrum, Kanban, hotfix, and research built-in templates', () => {
  const { workflow } = setup();
  const templates = workflow.listTemplates();
  for (const id of BUILTIN_IDS) {
    const template = templates.find((item) => item.id === id);
    assert.ok(template, id);
    assert.equal(template.builtin, true);
    assert.equal(template.state, 'published');
    assert.ok(template.version);
    assert.ok(template.stages.length > 0);
    assert.ok(template.steps.length > 0);
  }
});

test('selecting Scrum plans a new WorkItem with Scrum steps', () => {
  const { board, project, workflow } = setup();
  const { run } = planOn(workflow, board, project.id, 'huntianling.scrum');
  assert.equal(run.templateId, 'huntianling.scrum');
  assert.ok(run.steps.some((step) => step.templateStepId === 'sprint-review'));
  assert.ok(run.steps.some((step) => step.templateStepId === 'analyze'));
});

test('selecting Kanban plans a new WorkItem with Kanban steps', () => {
  const { board, project, workflow } = setup();
  const { run } = planOn(workflow, board, project.id, 'huntianling.kanban');
  assert.equal(run.templateId, 'huntianling.kanban');
  assert.ok(run.steps.some((step) => step.templateStepId === 'pull'));
  assert.equal(run.steps.some((step) => step.kind === 'approval-required'), false);
});

test('selecting hotfix plans a new WorkItem with hotfix steps', () => {
  const { board, project, workflow } = setup();
  const { run } = planOn(workflow, board, project.id, 'huntianling.hotfix');
  assert.equal(run.templateId, 'huntianling.hotfix');
  assert.ok(run.steps.some((step) => step.templateStepId === 'reproduce'));
  assert.ok(run.steps.some((step) => step.templateStepId === 'patch'));
  assert.equal(run.steps.some((step) => step.templateStepId === 'analyze'), false);
});

test('selecting research plans a new WorkItem with research steps', () => {
  const { board, project, workflow } = setup();
  const { run } = planOn(workflow, board, project.id, 'huntianling.research');
  assert.equal(run.templateId, 'huntianling.research');
  assert.ok(run.steps.some((step) => step.templateStepId === 'investigate'));
  assert.ok(run.steps.some((step) => step.templateStepId === 'conclude'));
  assert.equal(run.steps.some((step) => step.templateStepId === 'implement'), false);
});

test('an existing open run keeps its previous template after the project selects another', () => {
  const { board, project, workflow } = setup();
  const first = story(board, project.id);
  const original = workflow.plan(first.id, 'dev');
  assert.equal(original.templateId, 'huntianling.user-story');
  workflow.selectTemplate(project.id, 'huntianling.kanban');
  assert.equal(workflow.getRun(original.id).templateId, 'huntianling.user-story');
  const second = story(board, project.id);
  const next = workflow.plan(second.id, 'dev');
  assert.equal(next.templateId, 'huntianling.kanban');
  assert.notEqual(next.id, original.id);
});

test('customers cannot select a project workflow template', async (t) => {
  const { board, project, workflow } = setup();
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), workflow },
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
  const denied = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/workflow`, {
    method: 'PATCH',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 'huntianling.scrum' }),
  });
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const listed = await json(`${status.url}/api/v1/workflow-templates`, { headers: { cookie } });
  assert.equal(listed.response.status, 200);
  assert.ok(BUILTIN_IDS.every((id) => listed.payload.templates.some((item) => item.id === id)));

  const selected = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/workflow`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 'huntianling.hotfix' }),
  });
  assert.equal(selected.response.status, 200);
  assert.equal(selected.payload.id, 'huntianling.hotfix');

  const current = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/workflow`, {
    headers: { cookie },
  });
  assert.equal(current.payload.template.id, 'huntianling.hotfix');
});
