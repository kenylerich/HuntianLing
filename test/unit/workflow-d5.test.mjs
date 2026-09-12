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

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d5-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const workflow = createWorkflowService({ board, workspaceRoot: root });
  return { root, board, project, workflow };
}

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(15),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('a caller reads a static workflow map with stages, steps, and layer toggles without running it', () => {
  const { workflow } = setup();
  const visualization = workflow.visualizeTemplate('huntianling.user-story');
  assert.ok(visualization.presentations.dependencyGraph.nodes.some((node) => node.kind === 'stage'));
  assert.ok(visualization.presentations.dependencyGraph.nodes.some((node) => node.stepId === 'analyze'));
  assert.ok(workflow.listVisualizationLayers().includes('lifecycle'));
  assert.ok(visualization.layers.some((layer) => layer.id === 'agents' && layer.nodeIds.length > 0));
});

test('the same template is shown as stage swimlane, role swimlane, dependency graph, and outline', () => {
  const { workflow } = setup();
  const visualization = workflow.visualizeTemplate('huntianling.user-story');
  assert.equal(visualization.presentations.stageSwimlane.kind, 'stage-swimlane');
  assert.equal(visualization.presentations.roleSwimlane.kind, 'role-swimlane');
  assert.equal(visualization.presentations.dependencyGraph.kind, 'dependency-graph');
  assert.equal(visualization.presentations.outline.kind, 'outline');
  assert.ok(visualization.presentations.roleSwimlane.lanes.some((lane) => lane.id === 'planner'));
  assert.ok(visualization.presentations.outline.nodes.length > 0);
});

test('validation badges appear on incomplete or invalid nodes', () => {
  const { workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  const canvas = workflow.getCanvas(draft.id);
  const analyze = canvas.nodes.find((node) => node.stepId === 'analyze');
  workflow.saveCanvas(draft.id, {
    ...canvas,
    nodes: canvas.nodes.map((node) => (node.id === analyze.id ? { ...node, role: '' } : node)),
  }, 'dev');
  const visualization = workflow.visualizeTemplate(draft.id);
  assert.ok(visualization.badges.some((badge) => badge.code === 'incomplete' && badge.nodeId === 'step:analyze'));
});

test('two template versions can be compared for added, removed, and changed steps', () => {
  const { workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  const originalVersion = draft.version;
  const canvas = workflow.getCanvas(draft.id);
  const analyze = canvas.nodes.find((node) => node.stepId === 'analyze');
  const saved = workflow.saveCanvas(draft.id, {
    ...canvas,
    nodes: canvas.nodes.map((node) => (node.id === analyze.id ? { ...node, role: 'developer' } : node)),
  }, 'dev');
  const diff = workflow.diffTemplateVersion(draft.id, originalVersion);
  assert.equal(diff.fromVersion, originalVersion);
  assert.equal(diff.toVersion, saved.template.version);
  assert.ok(diff.changed.includes('analyze'));
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.removed, []);
});

test('a test run replays over the same workflow map with frame-by-frame states', () => {
  const { workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  const testCase = workflow.createTestCase({ templateId: draft.id, title: 'happy', scenario: 'happy-path' });
  const run = workflow.runTestCase(draft.id, testCase.id);
  const replay = workflow.getTestReplay(run.id);
  assert.equal(replay.map.kind, 'dependency-graph');
  assert.ok(replay.frames.length > 0);
  assert.ok(replay.highlights.some((item) => item.nodeId.startsWith('step:')));
  assert.equal(replay.templateVersion, draft.version);
  assert.equal(workflow.getTestAssertions(run.id).scenario, 'happy-path');
});

test('the replay report exports as publication evidence', () => {
  const { workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  const testCase = workflow.createTestCase({ templateId: draft.id, title: 'happy', scenario: 'happy-path' });
  const run = workflow.runTestCase(draft.id, testCase.id);
  const exported = workflow.exportTestReplay(run.id);
  assert.equal(exported.format, 'markdown');
  assert.match(exported.body, /happy-path/);
  assert.match(exported.body, /Evidence:/);
  const map = workflow.exportVisualization(draft.id, 'markdown');
  assert.match(map.body, /Analyze/);
});

test('customers cannot export a replay report', async (t) => {
  const { board, project, workflow } = setup();
  const draft = workflow.cloneTemplate('huntianling.user-story', 'dev');
  const testCase = workflow.createTestCase({ templateId: draft.id, title: 'happy', scenario: 'happy-path' });
  const run = workflow.runTestCase(draft.id, testCase.id);
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
  const denied = await json(
    `${status.url}/api/v1/workflow-test-runs/${encodeURIComponent(run.id)}/export-report`,
    { method: 'POST', headers: { cookie: customerCookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const visualization = await json(
    `${status.url}/api/v1/workflow-templates/${encodeURIComponent(draft.id)}/visualization`,
    { headers: { cookie } },
  );
  assert.equal(visualization.response.status, 200);
  assert.ok(visualization.payload.presentations.dependencyGraph);
  const html = await fetch(`${status.url}/developer/workflow-lab`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /查看地图/);
  assert.match(html, /回放/);
});
