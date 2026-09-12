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
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d4-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const workflow = createWorkflowService({ board, workspaceRoot: root });
  return { root, board, project, workflow };
}

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(14),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function validPack(workflow, overrides = {}) {
  const namespace = overrides.namespace ?? 'acme';
  const source = workflow.exportTemplate('huntianling.user-story');
  const lint = {
    ...source.steps[0],
    id: 'lint',
    title: 'Lint',
    capabilityId: `${namespace}.lint`,
    dependsOn: [],
    requiredSkills: ['planner.delivery-contract'],
    allowedTools: ['delivery-contract.write'],
  };
  return {
    namespace,
    title: `${namespace} pack`,
    requiredSkills: ['planner.delivery-contract', 'generator.implement', 'evaluator.evaluate'],
    requiredTools: ['delivery-contract.write', 'implementation.write', 'evaluation.write'],
    templates: [{ title: `${namespace} story`, stages: source.stages, steps: [...source.steps, lint] }],
    eventTypes: [{ id: `${namespace}.ready`, schemaRequired: ['body'] }],
    nodeTypes: [{
      id: `${namespace}.lint`,
      title: 'Lint',
      testFixture: { status: 'completed', nextSafeAction: 'complete', reason: 'simulated' },
    }],
    extensions: [{ point: 'step-start', order: 10, testCases: ['happy-path'] }],
    ...overrides,
  };
}

test('the catalog lists built-in node types and system event types', () => {
  const { workflow } = setup();
  const nodes = workflow.listNodeTypes();
  assert.ok(nodes.some((item) => item.id === 'stage' && item.origin === 'system'));
  assert.ok(nodes.some((item) => item.id === 'agent-step'));
  assert.ok(nodes.some((item) => item.id === 'approval'));
  const events = workflow.listEventTypes();
  assert.ok(events.some((item) => item.id === 'approval.requested' && item.origin === 'system'));
  assert.ok(workflow.listExtensionPoints().includes('step-start'));
});

test('importing a namespaced pack records its templates, custom events, custom nodes, and extension packages', () => {
  const { workflow } = setup();
  const pack = workflow.importPack(validPack(workflow));
  assert.equal(pack.namespace, 'acme');
  assert.equal(pack.templateIds.length, 1);
  assert.ok(pack.eventTypeIds.includes('acme.ready'));
  assert.ok(pack.nodeTypeIds.includes('acme.lint'));
  assert.equal(pack.extensionIds.length, 1);
  assert.ok(workflow.listEventTypes().some((item) => item.id === 'acme.ready' && item.origin === 'custom'));
  assert.equal(workflow.listExtensionPackages().some((item) => item.packId === pack.id), true);
});

test('conformance fails when a pack uses an unknown node type or an undeclared tool', () => {
  const { workflow } = setup();
  const source = workflow.exportTemplate('huntianling.user-story');
  const unknownNode = workflow.importPack(validPack(workflow, {
    templates: [{
      title: 'Ghost',
      stages: source.stages,
      steps: [{ ...source.steps[0], capabilityId: 'ghost.node' }],
    }],
    nodeTypes: [],
  }));
  const unknownReport = workflow.runPackConformance(unknownNode.id);
  assert.equal(unknownReport.status, 'failed');
  assert.ok(unknownReport.checks.some((item) => item.code === 'unknown-node' && item.result === 'fail'));

  const undeclared = workflow.importPack(validPack(workflow, {
    namespace: 'tools',
    eventTypes: [{ id: 'tools.ready' }],
    nodeTypes: [{ id: 'tools.lint', title: 'Lint' }],
    requiredTools: ['delivery-contract.write'],
    templates: [{
      title: 'Undeclared',
      stages: source.stages,
      steps: [{ ...source.steps[0], allowedTools: ['implementation.write'] }],
    }],
  }));
  const toolReport = workflow.runPackConformance(undeclared.id);
  assert.equal(toolReport.status, 'failed');
  assert.ok(toolReport.checks.some((item) => item.code === 'undeclared-tool' && item.result === 'fail'));
});

test('a pack cannot be enabled for a project until conformance passes; conflicting extensions fail with an explicit conflict', () => {
  const { board, project, workflow } = setup();
  const pending = workflow.importPack(validPack(workflow));
  assert.throws(
    () => workflow.enablePack(project.id, pending.id, 'dev'),
    (error) => error instanceof WorkflowError && /conformance/.test(error.message),
  );
  const passed = workflow.runPackConformance(pending.id);
  assert.equal(passed.status, 'passed');
  const enabled = workflow.enablePack(project.id, pending.id, 'dev');
  assert.equal(enabled.packId, pending.id);
  assert.ok(board.listAuditEvents({ projectId: project.id, action: 'workflow_pack.enabled' }).length > 0);

  const rival = workflow.importPack(validPack(workflow, {
    namespace: 'beta',
    eventTypes: [{ id: 'beta.ready' }],
    nodeTypes: [{ id: 'beta.lint', title: 'Lint' }],
    extensions: [{ point: 'step-start', order: 10, testCases: ['happy-path'] }],
  }));
  const rivalReport = workflow.runPackConformance(rival.id);
  assert.equal(rivalReport.status, 'passed');
  assert.throws(
    () => workflow.enablePack(project.id, rival.id, 'dev'),
    (error) => error instanceof WorkflowError && /conflicting extensions/.test(error.message),
  );
});

test('custom events require a pack or project namespace and cannot redefine system events', () => {
  const { workflow } = setup();
  assert.throws(
    () => workflow.registerEventType({ id: 'approval.requested' }),
    (error) => error instanceof WorkflowError && /system event/.test(error.message),
  );
  assert.throws(
    () => workflow.registerEventType({ id: 'ready' }),
    (error) => error instanceof WorkflowError && /namespace/.test(error.message),
  );
  const created = workflow.registerEventType({
    id: 'project.ready',
    schemaRequired: ['body'],
  });
  assert.equal(created.origin, 'custom');
  assert.throws(
    () => workflow.emitCatalogEvent({ type: 'project.ready', actor: 'dev', payload: {} }),
    (error) => error instanceof WorkflowError && /schema/.test(error.message),
  );
  const emitted = workflow.emitCatalogEvent({
    type: 'project.ready',
    actor: 'dev',
    payload: { body: 'ok' },
  });
  assert.equal(emitted.type, 'project.ready');
});

test('custom nodes appear in the designer catalog only after conformance, and Test Lab simulates them from fixtures', () => {
  const { workflow } = setup();
  const pack = workflow.importPack(validPack(workflow));
  assert.equal(workflow.listNodeTypes().some((item) => item.id === 'acme.lint'), false);
  const report = workflow.runPackConformance(pack.id);
  assert.equal(report.status, 'passed');
  assert.ok(workflow.listNodeTypes().some((item) => item.id === 'acme.lint' && item.origin === 'custom'));
  const templateId = pack.templateIds[0];
  const testCase = workflow.createTestCase({
    templateId,
    title: 'custom node',
    scenario: 'custom-node',
  });
  const run = workflow.runTestCase(templateId, testCase.id);
  assert.equal(run.status, 'passed');
  assert.ok(run.replay.some((frame) => frame.reason === 'simulated' && frame.nextSafeAction === 'complete'));
});

test('customers cannot import packs or register custom events', async (t) => {
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
  const deniedPack = await json(`${status.url}/api/v1/workflow-packs/import`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ namespace: 'acme', title: 'nope' }),
  });
  assert.equal(deniedPack.response.status, 403);
  const deniedEvent = await json(`${status.url}/api/v1/workflow-event-types`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'project.ready' }),
  });
  assert.equal(deniedEvent.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const listed = await json(`${status.url}/api/v1/workflow-node-types`, { headers: { cookie } });
  assert.equal(listed.response.status, 200);
  assert.ok(listed.payload.nodeTypes.some((item) => item.origin === 'system'));
});
