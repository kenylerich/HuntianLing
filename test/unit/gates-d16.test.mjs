import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { hasExecutedDeliveryEvidence } from '../../lib/host/board/executed-evidence.js';
import { createCiService } from '../../lib/host/ci/service.js';
import { createDeliveryService } from '../../lib/host/delivery/service.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { customerProgressForWorkItemRecord } from '../../lib/host/web/customer-progress.js';
import { createWebService } from '../../lib/host/web/server.js';

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

function emptyProject() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d16-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'empty-app',
    scripts: { typecheck: 'exit 1', test: 'exit 1' },
  }));
  const board = createBoardService(root);
  const skills = createSkillService();
  const environment = createEnvironmentService({ skills, board });
  const project = board.createProject({ name: 'Runtime review' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const story = board.createWorkItem({
    projectId: project.id,
    milestoneId: milestone.id,
    type: 'story',
    status: 'verifying',
    title: 'Login application',
    body: 'A customer needs to log in.',
    sourceInput: 'Build a login application.',
    analysis: 'The customer needs authenticated access.',
    design: 'Provide a login form and check credentials.',
    acceptance: ['A running application accepts valid credentials'],
  });
  const agents = createAgentRuntime({ skills, board, environment });
  return { root, board, skills, environment, project, story, agents };
}

test('an empty application with failing checks cannot produce accepted delivery', () => {
  const { root, board, environment, story, agents } = emptyProject();
  const prepared = environment.prepare({ workspaceRoot: root });
  assert.equal(prepared.ready, false);
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const run = delivery.start({ workItemId: story.id, environmentReady: true, drive: true });
  const evidence = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(hasExecutedDeliveryEvidence(evidence, story), false);
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);
  assert.equal(customerProgressForWorkItemRecord(board.getWorkItem(story.id), evidence), 'in_development');
  assert.notEqual(run.checkpoint.decisions.evaluate?.executionKind, 'executed');
});

test('an unconfigured executor cannot produce accepted delivery', () => {
  const { board, story, agents } = emptyProject();
  agents.startRun({
    agentId: 'evaluator',
    executor: 'unconfigured',
    workItemId: story.id,
    input: {
      independent: true,
      outcome: story.title,
      acceptance: story.acceptance,
    },
  });
  const evidence = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(evidence.checks.every((check) => check.executionKind !== 'executed' || check.producer !== 'evaluator'), true);
  assert.equal(hasExecutedDeliveryEvidence(evidence, story), false);
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);
});

test('a simulated evaluator cannot produce accepted delivery', () => {
  const { board, story, agents } = emptyProject();
  const run = agents.startRun({
    agentId: 'evaluator',
    executor: 'manual',
    workItemId: story.id,
    input: {
      independent: true,
      outcome: story.title,
      acceptance: story.acceptance,
    },
  });
  assert.equal(run.output.decision, 'pass');
  assert.equal(run.output.executionKind, 'demonstration');
  const evidence = board.getDeliveryEvidenceSummary(story.id);
  assert.ok(evidence.checks.some((check) => check.producer === 'evaluator' && check.executionKind === 'demonstration'));
  assert.equal(hasExecutedDeliveryEvidence(evidence, story), false);
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);
  assert.equal(customerProgressForWorkItemRecord({ ...story, status: 'delivered' }, evidence), 'in_development');
});

test('demonstration, self-check, manual, and executed evidence stay distinct at the producing service', () => {
  const { root, board, story } = emptyProject();
  const agents = createAgentRuntime({ skills: createSkillService(), board });
  agents.startRun({
    agentId: 'generator',
    executor: 'manual',
    environmentReady: true,
    workItemId: story.id,
    input: { outcome: story.title, acceptance: story.acceptance },
  });
  agents.startRun({
    agentId: 'evaluator',
    executor: 'manual',
    workItemId: story.id,
    input: { independent: true, outcome: story.title, acceptance: story.acceptance },
  });
  const ci = createCiService({ board });
  ci.run({
    workItemId: story.id,
    workspaceRoot: root,
    commands: [{ id: 'typecheck', command: 'node -e "process.exit(1)"', required: true }],
    runner: () => ({ status: 'fail', output: 'failed' }),
  });
  const evidence = board.getDeliveryEvidenceSummary(story.id);
  assert.ok(evidence.checks.some((check) => check.producer === 'generator' && check.executionKind === 'self_check'));
  assert.ok(evidence.checks.some((check) => check.producer === 'evaluator' && check.executionKind === 'demonstration'));
  assert.ok(evidence.checks.some((check) => check.producer === 'ci' && check.executionKind === 'executed' && check.status === 'failing'));
  assert.equal(hasExecutedDeliveryEvidence(evidence, story), false);
});

test('independent: true, environmentReady: true, or a producer label cannot establish executed success', async (t) => {
  const { root, board, story, agents, project } = emptyProject();
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const web = createWebService(
    {
      board,
      requirements: createRequirementManagementService(board),
      agents,
      delivery,
    },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'dev', passwordHash: passwordHash(), audience: 'developer' }],
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
  const evaluated = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/evaluate`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ independent: true }),
    },
  );
  assert.equal(evaluated.response.status, 200);
  assert.equal(evaluated.payload.run.output.executionKind, 'demonstration');
  const patched = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/delivery-evidence`,
    {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        checks: [{
          id: 'fake-executed',
          area: 'acceptance',
          title: 'claimed pass',
          status: 'passing',
          required: true,
          reason: 'caller said so',
          evidenceIds: ['uuid-only'],
          acceptanceCriterionIds: [],
          links: [],
          producer: 'evaluator',
          executionKind: 'executed',
        }],
      }),
    },
  );
  assert.equal(patched.response.status, 200);
  assert.equal(patched.payload.checks.find((check) => check.id === 'fake-executed')?.executionKind, 'demonstration');
  const started = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/story-delivery/start`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ environmentReady: true, drive: true }),
    },
  );
  assert.equal(started.response.status, 201);
  const transition = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/status`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ to: 'delivered' }),
    },
  );
  assert.notEqual(transition.response.status, 200);
  const evidence = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(hasExecutedDeliveryEvidence(evidence, story), false);
  void project;
  void root;
});

test('existing simulated evidence is excluded until revalidated', () => {
  const { board, story } = emptyProject();
  board.updateDeliveryEvidenceSummary(story.id, {
    checks: [{
      id: 'evaluator:legacy',
      area: 'acceptance',
      title: 'legacy simulated pass',
      status: 'passing',
      required: true,
      reason: 'deterministic-evaluator',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: '',
    }],
  });
  const stored = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(stored.checks[0].executionKind, 'demonstration');
  assert.equal(hasExecutedDeliveryEvidence(stored, story), false);
  assert.throws(() => board.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);
});

test('verified CI or Git evidence with provenance can still complete delivery and customer progress', () => {
  const { root, board, story } = emptyProject();
  const ci = createCiService({ board });
  ci.run({
    workItemId: story.id,
    workspaceRoot: root,
    commands: [{ id: 'probe', command: 'node -e "process.exit(0)"', required: true }],
    runner: () => ({ status: 'pass', output: 'ok' }),
  });
  const evidence = board.getDeliveryEvidenceSummary(story.id);
  assert.equal(hasExecutedDeliveryEvidence(evidence, story), true);
  assert.equal(board.transitionWorkItem(story.id, 'delivered').status, 'delivered');
  assert.equal(customerProgressForWorkItemRecord(board.getWorkItem(story.id), evidence), 'delivered');
});

test('the transition API blocks delivered; the customer view is not the only gate', async (t) => {
  const { board, story, agents, project } = emptyProject();
  const web = createWebService(
    {
      board,
      requirements: createRequirementManagementService(board),
      agents,
    },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: passwordHash(), audience: 'developer' },
          { username: 'cust', passwordHash: passwordHash(), audience: 'customer', projectIds: [project.id] },
        ],
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
  await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/evaluate`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ independent: true }),
    },
  );
  const transition = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/status`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ to: 'delivered' }),
    },
  );
  assert.equal(transition.response.status >= 400, true);
  assert.equal(board.getWorkItem(story.id).status, 'verifying');
  const customerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const customerCookie = customerLogin.response.headers.get('set-cookie')?.split(';')[0];
  const customerBoard = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/customer-board`,
    { headers: { cookie: customerCookie } },
  );
  const row = customerBoard.payload.requirements.find((item) => item.id === story.id);
  assert.notEqual(row.progress, 'delivered');
});
