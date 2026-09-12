import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { AgentTaskError } from '../../lib/host/agents/types.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCollabService } from '../../lib/host/collab/service.js';
import { createDispatchService } from '../../lib/host/dispatch/service.js';
import { resolveDispatchConfig } from '../../lib/host/dispatch/types.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';
import { createWorkflowService } from '../../lib/host/workflow/service.js';
import { WorkflowError } from '../../lib/host/workflow/types.js';

function workspace() {
  return mkdtempSync(join(tmpdir(), 'huntianling-d1-'));
}

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(9),
  });
}

function setup(options = {}) {
  const root = workspace();
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const dispatch = createDispatchService({
    board,
    workspaceRoot: root,
    config: resolveDispatchConfig({ leaseTtlMs: 60_000 }),
    collab,
  });
  const workflow = createWorkflowService({
    board,
    workspaceRoot: root,
    collab,
    dispatch,
    ...(options.skills !== undefined ? { skills: options.skills } : {}),
  });
  const milestone = board.createMilestone({ projectId: project.id, title: 'MVP' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '分析完成',
    design: '设计完成',
    acceptance: ['可登录'],
    milestoneId: milestone.id,
  });
  return { root, board, project, collab, dispatch, workflow, item };
}

function blockedRecognition(reason = 'exclusive lease is held by alice') {
  return {
    id: 'rec-blocked',
    runId: 'run-1',
    stepId: 'step-1',
    actor: 'planner',
    snapshot: {
      workItemId: 'wi-1',
      workItemStatus: 'ready',
      designRevision: 'abc',
      workflowRunStatus: 'planned',
      stepStatus: 'scheduled',
      collaborationTaskStatus: null,
      channelMessageCount: 0,
      milestoneId: null,
      pendingApprovalKinds: [],
      leaseOwners: ['alice'],
      branchOwners: [],
      ciStatus: null,
      evidenceReady: false,
      blockers: [],
      recognizedAt: Date.now(),
    },
    allowed: false,
    allowedActions: [],
    blockedActions: ['start'],
    requiredInputs: [],
    missingApprovals: [],
    missingSkills: [],
    unavailableTools: [],
    heldResources: ['work_item:wi-1'],
    nextSafeAction: 'wait',
    stale: false,
    incomplete: false,
    contradictory: true,
    outsideBoundary: false,
    reason,
    createdAt: Date.now(),
  };
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('a caller reads a workflow run state snapshot including work item, leases, branches, and evidence', () => {
  const { board, project, dispatch, workflow, item } = setup();
  const alice = board.createTeamMember({
    projectId: project.id,
    displayName: 'Alice',
    roleIds: ['developer'],
    skillProfile: ['implementation'],
  });
  dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'work_item',
    resourceId: item.id,
    mode: 'shared_read',
    ownerId: alice.id,
    reason: 'inspect',
    workItemId: item.id,
  });
  const run = workflow.plan(item.id, 'dev');
  const snapshot = workflow.runState(run.id);
  assert.equal(snapshot.workItemId, item.id);
  assert.equal(snapshot.workItemStatus, item.status);
  assert.ok(snapshot.designRevision.length > 0);
  assert.ok(snapshot.leaseOwners.includes(alice.id));
  assert.deepEqual(snapshot.branchOwners, []);
  assert.equal(snapshot.ciStatus, null);
  assert.equal(typeof snapshot.evidenceReady, 'boolean');
  assert.ok(Array.isArray(snapshot.blockers));
});

test('recognizing a ready analyze step allows start and records the snapshot on the step', () => {
  const { workflow, item } = setup();
  const run = workflow.plan(item.id, 'dev');
  const analyze = run.steps.find((step) => step.templateStepId === 'analyze');
  const recognition = workflow.recognizeStep(run.id, analyze.id, 'dev');
  assert.equal(recognition.allowed, true);
  assert.ok(recognition.allowedActions.includes('start'));
  assert.equal(recognition.nextSafeAction, 'start');
  assert.equal(recognition.snapshot.workItemId, item.id);
  const stored = workflow.getRun(run.id).steps.find((step) => step.id === analyze.id);
  assert.equal(stored.lastRecognition.id, recognition.id);
  const started = workflow.start(run.id, 'dev');
  assert.equal(started.steps.find((step) => step.id === analyze.id).status, 'running');
  assert.ok(workflow.listRecognitions(run.id).length >= 2);
});

test('an exclusive lease held by someone else blocks the step and posts a Team Chat event', () => {
  const { board, project, collab, dispatch, workflow, item } = setup();
  const alice = board.createTeamMember({
    projectId: project.id,
    displayName: 'Alice',
    roleIds: ['developer'],
    skillProfile: ['implementation'],
  });
  const run = workflow.plan(item.id, 'dev');
  const analyze = run.steps.find((step) => step.templateStepId === 'analyze');
  dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'work_item',
    resourceId: item.id,
    mode: 'exclusive_write',
    ownerId: alice.id,
    reason: 'editing',
    workItemId: item.id,
  });
  const recognition = workflow.recognizeStep(run.id, analyze.id, 'dev');
  assert.equal(recognition.allowed, false);
  assert.equal(recognition.contradictory, true);
  assert.equal(recognition.nextSafeAction, 'wait');
  assert.match(recognition.reason, /exclusive lease/);
  assert.throws(
    () => workflow.start(run.id, 'dev'),
    (error) => error instanceof WorkflowError && error.code === 'NOT_READY',
  );
  const conversation = collab.listConversations(project.id)[0];
  assert.ok(conversation);
  assert.ok(collab.listMessages(conversation.id).some((message) => (
    message.type === 'note.chat' && String(message.payload.body ?? '').includes('exclusive lease')
  )));
});

test('a missing approval names request-approval as the next safe action', () => {
  const { workflow, item } = setup();
  const run = workflow.plan(item.id, 'dev');
  const approve = run.steps.find((step) => step.templateStepId === 'approve');
  const recognition = workflow.recognizeStep(run.id, approve.id, 'dev');
  assert.equal(recognition.allowed, false);
  assert.equal(recognition.nextSafeAction, 'request-approval');
  assert.ok(recognition.missingApprovals.includes('requirement_acceptance'));
  assert.ok(workflow.listApprovals(item.projectId).some((row) => row.stepId === approve.id));
});

test('a stale snapshot after a design change blocks execution', () => {
  const { board, workflow, item } = setup();
  const run = workflow.plan(item.id, 'dev');
  const analyze = run.steps.find((step) => step.templateStepId === 'analyze');
  const first = workflow.recognizeStep(run.id, analyze.id, 'dev');
  assert.equal(first.allowed, true);
  board.updateWorkItem(item.id, { design: '设计已改' });
  assert.throws(
    () => workflow.start(run.id, 'dev'),
    (error) => error instanceof WorkflowError && error.code === 'NOT_READY' && /stale/.test(error.message),
  );
  const recorded = workflow.getRun(run.id).steps.find((step) => step.id === analyze.id).lastRecognition;
  assert.equal(recorded.stale, true);
  assert.equal(recorded.allowed, false);
  assert.equal(recorded.nextSafeAction, 'revalidate');
});

test('an agent run refuses to start from a blocked recognition', () => {
  const agents = createAgentRuntime({ skills: createSkillService() });
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'planner',
        executor: 'manual',
        input: {
          quotes: [{ text: '客户只看自己的进度', source: 'customer' }],
          goal: 'Customer sees only their progress',
          actors: ['customer'],
          confirmed: true,
          acceptance: ['customer progress is visible'],
        },
        stateRecognition: blockedRecognition(),
      }),
    (error) => error instanceof AgentTaskError && error.code === 'VALIDATION' && /state recognition blocked/.test(error.message),
  );
});

test('customers cannot recognize workflow step state', async (t) => {
  const { board, project, workflow, item } = setup();
  const agents = createAgentRuntime({ skills: createSkillService() });
  const run = workflow.plan(item.id, 'dev');
  const analyze = run.steps.find((step) => step.templateStepId === 'analyze');
  const allowed = workflow.recognizeStep(run.id, analyze.id, 'dev');
  const agentRun = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    input: {
      quotes: [{ text: '客户只看自己的进度', source: 'customer' }],
      goal: 'Customer sees only their progress',
      actors: ['customer'],
      confirmed: true,
      acceptance: ['customer progress is visible'],
    },
    stateRecognition: allowed,
  });
  const hash = passwordHash();
  const web = createWebService(
    {
      board,
      requirements: createRequirementManagementService(board),
      workflow,
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
    `${status.url}/api/v1/workflow-runs/${encodeURIComponent(run.id)}/steps/${encodeURIComponent(analyze.id)}/recognize-state`,
    { method: 'POST', headers: { cookie: customerCookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const snapshot = await json(`${status.url}/api/v1/workflow-runs/${encodeURIComponent(run.id)}/state`, {
    headers: { cookie },
  });
  assert.equal(snapshot.response.status, 200);
  assert.equal(snapshot.payload.workItemId, item.id);
  assert.ok('leaseOwners' in snapshot.payload);
  assert.ok('branchOwners' in snapshot.payload);
  assert.ok('evidenceReady' in snapshot.payload);
  assert.ok('ciStatus' in snapshot.payload);

  const listed = await json(`${status.url}/api/v1/workflow-runs/${encodeURIComponent(run.id)}/recognitions`, {
    headers: { cookie },
  });
  assert.equal(listed.response.status, 200);
  assert.ok(listed.payload.recognitions.length > 0);

  const recognized = await json(
    `${status.url}/api/v1/workflow-runs/${encodeURIComponent(run.id)}/steps/${encodeURIComponent(analyze.id)}/recognize-state`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(recognized.response.status, 201);
  assert.equal(typeof recognized.payload.allowed, 'boolean');

  const stored = await json(
    `${status.url}/api/v1/agent-runs/${encodeURIComponent(agentRun.id)}/state-recognition`,
    { headers: { cookie } },
  );
  assert.equal(stored.response.status, 200);
  assert.equal(stored.payload.recognition.id, allowed.id);
});
