import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCollabService } from '../../lib/host/collab/service.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';
import { createWorkflowService } from '../../lib/host/workflow/service.js';
import { WorkflowError } from '../../lib/host/workflow/types.js';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-workflow-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const workflow = createWorkflowService({ board, workspaceRoot: root, collab });
  return { root, board, project, collab, workflow };
}

function story(board, projectId, ready = false) {
  const milestone = board.createMilestone({ projectId, title: 'MVP' });
  return board.createWorkItem({
    projectId,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: ready ? '分析完成' : '',
    design: ready ? '设计完成' : '',
    acceptance: ready ? ['可登录'] : [],
    milestoneId: milestone.id,
  });
}

test('inspecting a transition lists missing fields, evidence, reviews, and approvals', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id, false);
  const inspection = workflow.inspectGates(item.id, 'ready');
  assert.equal(inspection.allowed, false);
  assert.ok(inspection.missing.some((row) => row.kind === 'field'));
  assert.ok(inspection.stages.length > 0);
});

test('an invalid transition is blocked and missing items are explained', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id, false);
  assert.throws(
    () => workflow.transition(item.id, 'ready', 'dev'),
    (error) => error instanceof WorkflowError && error.code === 'TRANSITION',
  );
});

test('override requires reason and scope, writes audit, and keeps forbidden moves blocked', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id, false);
  assert.throws(
    () => workflow.override(item.id, 'ready', { actor: 'dev', reason: '', scope: 'DoR' }),
    (error) => error instanceof WorkflowError && error.code === 'VALIDATION',
  );
  const overridden = workflow.override(item.id, 'ready', {
    actor: 'dev',
    reason: '紧急演示',
    scope: 'definition-of-ready',
  });
  assert.equal(board.getWorkItem(item.id).status, 'ready');
  assert.equal(overridden.from, 'ready');
  const events = board.listAuditEvents({ projectId: project.id, action: 'work_item.transition_overridden' });
  assert.equal(events.length, 1);
  assert.match(events[0].reason, /紧急演示/);
  board.transitionWorkItem(item.id, 'delivered', {
    actorId: 'dev',
    reason: 'force delivered',
    scope: 'test',
  });
  assert.throws(
    () => workflow.override(item.id, 'inbox', { actor: 'dev', reason: 'rewind', scope: 'lifecycle' }),
    (error) => error instanceof WorkflowError && error.code === 'TRANSITION',
  );
});

test('planning produces steps with dependencies, roles, skills, tools, checks, and handoffs', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id, true);
  const run = workflow.plan(item.id, 'dev');
  assert.equal(run.templateId, 'huntianling.user-story');
  assert.ok(run.steps.length >= 5);
  const implement = run.steps.find((step) => step.templateStepId === 'implement');
  assert.equal(implement.role, 'generator');
  assert.ok(implement.requiredSkills.length > 0);
  assert.ok(implement.allowedTools.length > 0);
  assert.ok(implement.checks.length > 0);
  assert.ok(implement.dependsOn.includes('design'));
  const approve = run.steps.find((step) => step.kind === 'approval-required');
  assert.equal(approve.approvalKind, 'requirement_acceptance');
});

test('starting a plan creates a collaboration task and does not start unapproved steps', () => {
  const { board, project, collab, workflow } = setup();
  const item = story(board, project.id, true);
  const run = workflow.plan(item.id, 'dev');
  const started = workflow.start(run.id, 'dev');
  const analyze = started.steps.find((step) => step.templateStepId === 'analyze');
  assert.equal(analyze.status, 'running');
  assert.equal(typeof analyze.collaborationTaskId, 'string');
  assert.ok(collab.getTask(analyze.collaborationTaskId));
  const approve = started.steps.find((step) => step.templateStepId === 'approve');
  assert.notEqual(approve.status, 'running');
});

test('approvals declare roles, write role-scoped events, and keep dependent steps queued', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id, true);
  const run = workflow.plan(item.id, 'dev');
  const approve = run.steps.find((step) => step.templateStepId === 'approve');
  const approval = workflow.createApproval({
    workItemId: item.id,
    kind: 'requirement_acceptance',
    requester: 'generator',
    requesterRole: 'generator',
    requiredApproverRoles: ['developer'],
    reason: 'delivery gate',
    runId: run.id,
    stepId: approve.id,
  });
  assert.equal(approval.status, 'pending');
  assert.deepEqual(approval.requiredApproverRoles, ['developer']);
  const waiting = workflow.getRun(run.id);
  assert.equal(waiting.steps.find((step) => step.id === approve.id).status, 'waiting_for_approval');
  const started = workflow.start(run.id, 'dev');
  assert.notEqual(started.steps.find((step) => step.id === approve.id).status, 'running');
  const decided = workflow.decideApproval(approval.id, {
    actor: 'dev',
    actorRole: 'developer',
    decision: 'approve',
    reason: '验收通过',
  });
  assert.equal(decided.status, 'approved');
  const events = workflow.listRoleEvents(run.id);
  assert.ok(events.some((event) => event.type === 'approval.requested'));
  assert.ok(events.some((event) => event.type === 'approval.approved'));
  const after = workflow.getRun(run.id);
  assert.notEqual(after.steps.find((step) => step.id === approve.id).status, 'waiting_for_approval');
});

test('a workflow run shows owner, waiting steps, next action, scheduler reasons, and a timeline', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id, true);
  const run = workflow.plan(item.id, 'dev');
  workflow.start(run.id, 'dev');
  const live = workflow.getRun(run.id);
  assert.equal(live.owner, 'dev');
  assert.ok(live.nextAction.length > 0);
  assert.ok(live.steps.some((step) => step.status === 'running'));
  assert.ok(live.steps.some((step) => step.status === 'pending' || step.status === 'scheduled'));
  const decisions = workflow.schedulerDecisions(run.id);
  assert.ok(decisions.length > 0);
  assert.ok(decisions[0].reason.length > 0);
  const timeline = workflow.timeline(run.id);
  assert.ok(timeline.some((event) => event.kind === 'planned' || event.kind === 'started'));
});

test('authorized users can pause, resume, cancel, retry, and reassign steps', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id, true);
  const run = workflow.plan(item.id, 'dev');
  workflow.start(run.id, 'dev');
  const paused = workflow.pause(run.id, 'dev');
  assert.equal(paused.status, 'paused');
  const resumed = workflow.resume(run.id, 'dev');
  assert.notEqual(resumed.status, 'paused');
  const running = resumed.steps.find((step) => step.status === 'running');
  const reassigned = workflow.reassignStep(run.id, running.id, 'generator', 'dev');
  assert.equal(reassigned.steps.find((step) => step.id === running.id).owner, 'generator');
  const cancelled = workflow.cancel(run.id, 'dev');
  assert.equal(cancelled.status, 'cancelled');
  const retry = workflow.retryStep(run.id, running.id, 'dev');
  assert.equal(retry.steps.find((step) => step.id === running.id).status, 'pending');
});

test('built-in capabilities and the default template are versioned and cannot be mutated in place', () => {
  const { project, workflow } = setup();
  const capabilities = workflow.listCapabilities();
  assert.ok(capabilities.every((item) => item.builtin && item.version));
  const original = workflow.getTemplate('huntianling.user-story');
  assert.equal(original.builtin, true);
  assert.equal(original.state, 'published');
  const cloned = workflow.cloneTemplate(original.id, 'dev');
  assert.equal(cloned.builtin, false);
  assert.equal(cloned.clonedFrom, original.id);
  assert.equal(cloned.state, 'draft');
  assert.equal(workflow.getTemplate(original.id).title, original.title);
  const selected = workflow.selectTemplate(project.id, cloned.id);
  assert.equal(selected.id, cloned.id);
  workflow.disableCapability(project.id, 'implementation');
  workflow.enableCapability(project.id, 'implementation');
});

test('customers cannot manage workflow runs or approvals', async (t) => {
  const { root, board, project, workflow } = setup();
  const item = story(board, project.id, true);
  workflow.plan(item.id, 'dev');
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(2) });
  const web = createWebService(
    { board, requirements, workflow },
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
  const planned = await fetch(`${status.url}/api/v1/work-items/${item.id}/workflow/plan`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(planned.status, 403);
  const approval = await fetch(`${status.url}/api/v1/approval-requests`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workItemId: item.id, kind: 'merge', reason: 'nope' }),
  });
  assert.equal(approval.status, 403);
});
