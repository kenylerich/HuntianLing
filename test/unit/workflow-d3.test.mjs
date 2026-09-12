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
import { WorkflowError } from '../../lib/host/workflow/types.js';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d3-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const workflow = createWorkflowService({ board, workspaceRoot: root });
  return { root, board, project, workflow };
}

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(13),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('a caller reads a canvas of stages and steps for a template', () => {
  const { workflow } = setup();
  const canvas = workflow.getCanvas('huntianling.user-story');
  assert.ok(canvas.nodes.some((node) => node.kind === 'stage'));
  assert.ok(canvas.nodes.some((node) => node.stepId === 'analyze' && node.kind === 'agent-step'));
  assert.ok(canvas.nodes.some((node) => node.kind === 'approval'));
  assert.ok(canvas.edges.some((edge) => edge.kind === 'depends'));
  assert.ok(canvas.nodes.every((node) => node.mapping));
});

test('editing a draft canvas node updates the template step and reports invalid nodes', () => {
  const { workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  const canvas = workflow.getCanvas(draft.id);
  const analyze = canvas.nodes.find((node) => node.stepId === 'analyze');
  const saved = workflow.saveCanvas(draft.id, {
    ...canvas,
    nodes: canvas.nodes.map((node) => (node.id === analyze.id ? { ...node, role: '' } : node)),
  }, 'dev');
  assert.equal(saved.template.steps.find((step) => step.id === 'analyze').role, '');
  assert.equal(saved.validation.ok, false);
  assert.ok(saved.validation.issues.some((issue) => issue.code === 'incomplete'));
});

test('builtin templates cannot be overwritten on the canvas', () => {
  const { workflow } = setup();
  const canvas = workflow.getCanvas('huntianling.user-story');
  assert.throws(
    () => workflow.saveCanvas('huntianling.user-story', canvas, 'dev'),
    (error) => error instanceof WorkflowError && error.code === 'BUILTIN',
  );
});

test('validate reports a missing dependency before publish', () => {
  const { workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  const canvas = workflow.getCanvas(draft.id);
  const analyze = canvas.nodes.find((node) => node.stepId === 'analyze');
  const saved = workflow.saveCanvas(draft.id, {
    ...canvas,
    nodes: canvas.nodes.map((node) => (node.id === analyze.id ? { ...node, dependsOn: ['missing-step'] } : node)),
  }, 'dev');
  assert.equal(saved.validation.ok, false);
  assert.ok(saved.validation.issues.some((issue) => issue.code === 'missing_dependency'));
  assert.throws(
    () => workflow.publishTemplate(draft.id, 'dev'),
    (error) => error instanceof WorkflowError && /unknown dependency/.test(error.message),
  );
});

test('Test Lab dry-runs happy-path, missing-approval, resource-conflict, stale-state, and missing-evidence', () => {
  const { workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  const expected = {
    'happy-path': { status: 'passed', action: 'start' },
    'missing-approval': { status: 'passed', action: 'request-approval' },
    'resource-conflict': { status: 'passed', action: 'wait' },
    'stale-state': { status: 'passed', action: 'revalidate' },
    'missing-evidence': { status: 'passed', action: 'ask' },
  };
  for (const [scenario, want] of Object.entries(expected)) {
    const testCase = workflow.createTestCase({ templateId: draft.id, title: scenario, scenario });
    const run = workflow.runTestCase(draft.id, testCase.id);
    assert.equal(run.status, want.status, scenario);
    assert.ok(run.replay.some((frame) => frame.nextSafeAction === want.action), scenario);
    assert.ok(run.report.evidence.includes('workflow-test-lab'));
  }
});

test('publish is blocked until a passing happy-path test run exists', () => {
  const { workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  assert.throws(
    () => workflow.publishTemplate(draft.id, 'dev'),
    (error) => error instanceof WorkflowError && /happy-path test case/.test(error.message),
  );
  const conflict = workflow.createTestCase({
    templateId: draft.id,
    title: 'conflict only',
    scenario: 'resource-conflict',
  });
  workflow.runTestCase(draft.id, conflict.id);
  assert.throws(
    () => workflow.publishTemplate(draft.id, 'dev'),
    (error) => error instanceof WorkflowError && /happy-path/.test(error.message),
  );
  const happy = workflow.createTestCase({ templateId: draft.id, title: 'happy', scenario: 'happy-path' });
  const run = workflow.runTestCase(draft.id, happy.id);
  assert.equal(run.status, 'passed');
  const published = workflow.publishTemplate(draft.id, 'dev');
  assert.equal(published.state, 'published');
});

test('customers cannot edit the canvas or run the Test Lab', async (t) => {
  const { board, project, workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
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
  const deniedCanvas = await json(
    `${status.url}/api/v1/workflow-templates/${encodeURIComponent(draft.id)}/canvas`,
    { method: 'PUT', headers: { cookie: customerCookie, 'content-type': 'application/json' }, body: JSON.stringify({ nodes: [] }) },
  );
  assert.equal(deniedCanvas.response.status, 403);
  const deniedLab = await json(
    `${status.url}/api/v1/workflow-templates/${encodeURIComponent(draft.id)}/test-runs`,
    { method: 'POST', headers: { cookie: customerCookie, 'content-type': 'application/json' }, body: JSON.stringify({ testCaseId: 'x' }) },
  );
  assert.equal(deniedLab.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const canvas = await json(
    `${status.url}/api/v1/workflow-templates/${encodeURIComponent(draft.id)}/canvas`,
    { headers: { cookie } },
  );
  assert.equal(canvas.response.status, 200);
  assert.ok(canvas.payload.nodes.length > 0);
  const html = await fetch(`${status.url}/developer/workflow-lab`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /工作流画布/);
  assert.match(html, /Test Lab/);
  assert.match(html, /aria-label="workflow canvas"/);
});
