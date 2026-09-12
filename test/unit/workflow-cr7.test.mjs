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
  const root = mkdtempSync(join(tmpdir(), 'huntianling-workflow-cr7-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const workflow = createWorkflowService({ board, workspaceRoot: root, collab });
  return { root, board, project, collab, workflow };
}

function story(board, projectId, ready = true) {
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

function step(overrides) {
  return {
    id: 'custom',
    title: 'Custom',
    kind: 'sequential',
    role: 'developer',
    capabilityId: 'audit',
    requiredSkills: [],
    allowedTools: [],
    checks: [],
    dependsOn: [],
    approvalKind: null,
    targetStatus: null,
    triggerEvent: null,
    intervalMs: null,
    ...overrides,
  };
}

function importFromDefault(workflow, owner, steps, title = 'Custom delivery') {
  const source = workflow.exportTemplate('huntianling.user-story');
  return workflow.importTemplate({
    title,
    owner,
    stages: source.stages,
    steps,
    clonedFrom: source.id,
  });
}

test('replacing a project workflow template shows a preview and writes an audit event', () => {
  const { board, project, workflow } = setup();
  const source = workflow.exportTemplate('huntianling.user-story');
  const custom = importFromDefault(workflow, 'dev', [
    ...source.steps.map((item, index) => (index === 0 ? { ...item, title: 'Analyze deeply' } : item)),
    step({ id: 'heartbeat', title: 'Heartbeat', kind: 'recurring', intervalMs: 0 }),
  ]);
  const preview = workflow.previewReplace(project.id, custom.id);
  assert.equal(preview.fromTemplateId, 'huntianling.user-story');
  assert.equal(preview.toTemplateId, custom.id);
  assert.ok(preview.changedSteps.includes('analyze'));
  assert.ok(preview.addedSteps.includes('heartbeat'));
  const replaced = workflow.replaceTemplate(project.id, {
    templateId: custom.id,
    mode: 'future',
    actor: 'dev',
  });
  assert.equal(replaced.dryRun, false);
  assert.equal(replaced.template.id, custom.id);
  assert.equal(workflow.selectedTemplate(project.id).id, custom.id);
  const events = board.listAuditEvents({ projectId: project.id, action: 'workflow_template.replaced' });
  assert.equal(events.length, 1);
  assert.match(events[0].reason, /huntianling.user-story/);
});

test('future-only replacement leaves active runs on the previous template', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id);
  const run = workflow.plan(item.id, 'dev');
  const source = workflow.exportTemplate('huntianling.user-story');
  const custom = importFromDefault(workflow, 'dev', [
    ...source.steps,
    step({ id: 'extra', title: 'Extra' }),
  ]);
  workflow.replaceTemplate(project.id, { templateId: custom.id, mode: 'future', actor: 'dev' });
  const live = workflow.getRun(run.id);
  assert.equal(live.templateId, 'huntianling.user-story');
  assert.equal(live.steps.some((item) => item.templateStepId === 'extra'), false);
  assert.equal(workflow.selectedTemplate(project.id).id, custom.id);
});

test('active-run migration remaps open runs onto the new template', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id);
  const run = workflow.plan(item.id, 'dev');
  const source = workflow.exportTemplate('huntianling.user-story');
  const custom = importFromDefault(workflow, 'dev', [
    ...source.steps,
    step({ id: 'extra', title: 'Extra', dependsOn: ['deliver'] }),
  ]);
  const replaced = workflow.replaceTemplate(project.id, {
    templateId: custom.id,
    mode: 'migrate-active',
    actor: 'dev',
  });
  assert.deepEqual(replaced.migratedRunIds, [run.id]);
  const live = workflow.getRun(run.id);
  assert.equal(live.templateId, custom.id);
  assert.ok(live.steps.some((item) => item.templateStepId === 'extra'));
  assert.ok(live.steps.some((item) => item.templateStepId === 'analyze'));
});

test('rollback restores the previous template', () => {
  const { project, workflow } = setup();
  const source = workflow.exportTemplate('huntianling.user-story');
  const custom = importFromDefault(workflow, 'dev', source.steps, 'Alt');
  workflow.replaceTemplate(project.id, { templateId: custom.id, mode: 'future', actor: 'dev' });
  const rolled = workflow.rollbackTemplate(project.id, { actor: 'dev' });
  assert.equal(rolled.template.id, 'huntianling.user-story');
  assert.equal(workflow.selectedTemplate(project.id).id, 'huntianling.user-story');
});

test('a built-in capability includes documentation and a conformance fixture', () => {
  const { workflow } = setup();
  const capability = workflow.getCapability('review');
  assert.equal(capability.builtin, true);
  assert.match(capability.documentation, /review/i);
  assert.ok(capability.fixtures.some((item) => item.scenario === 'happy-path'));
  assert.equal(capability.conformance.result, 'pass');
});

test('a recurring step is scheduled again after it completes', () => {
  const { board, project, workflow } = setup();
  const custom = importFromDefault(workflow, 'dev', [
    step({ id: 'heartbeat', title: 'Heartbeat', kind: 'recurring', intervalMs: 0 }),
    step({ id: 'after', title: 'After', dependsOn: ['heartbeat'] }),
  ]);
  workflow.selectTemplate(project.id, custom.id);
  const item = story(board, project.id);
  const planned = workflow.plan(item.id, 'dev');
  const started = workflow.start(planned.id, 'dev');
  const heartbeat = started.steps.find((item) => item.templateStepId === 'heartbeat');
  assert.equal(heartbeat.status, 'running');
  const completed = workflow.completeStep(planned.id, heartbeat.id, 'dev');
  const again = completed.steps.find((item) => item.templateStepId === 'heartbeat');
  assert.equal(again.occurrence, 1);
  assert.equal(again.status, 'scheduled');
  const after = completed.steps.find((item) => item.templateStepId === 'after');
  assert.notEqual(after.status, 'pending');
});

test('an event-triggered step stays queued until its event arrives', () => {
  const { board, project, workflow } = setup();
  const custom = importFromDefault(workflow, 'dev', [
    step({
      id: 'wait-ci',
      title: 'Wait for CI',
      kind: 'event-triggered',
      triggerEvent: 'ci.passed',
    }),
    step({ id: 'after', title: 'After CI', dependsOn: ['wait-ci'] }),
  ]);
  workflow.selectTemplate(project.id, custom.id);
  const item = story(board, project.id);
  const planned = workflow.plan(item.id, 'dev');
  const waiting = planned.steps.find((item) => item.templateStepId === 'wait-ci');
  assert.equal(waiting.status, 'queued');
  assert.throws(
    () => workflow.start(planned.id, 'dev'),
    (error) => error instanceof WorkflowError && error.code === 'NOT_READY',
  );
  const emitted = workflow.emitStepEvent(planned.id, { type: 'ci.passed', actor: 'ci' });
  const ready = emitted.steps.find((item) => item.templateStepId === 'wait-ci');
  assert.equal(ready.status, 'scheduled');
  const started = workflow.start(planned.id, 'dev');
  assert.equal(started.steps.find((item) => item.templateStepId === 'wait-ci').status, 'running');
});

test('a review request can be created and completed as role-scoped events', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id);
  const run = workflow.plan(item.id, 'dev');
  const review = workflow.createReview({
    workItemId: item.id,
    requester: 'dev',
    requesterRole: 'generator',
    requiredReviewerRoles: ['developer'],
    reason: 'code review',
    runId: run.id,
  });
  assert.equal(review.status, 'pending');
  const events = workflow.listRoleEvents(run.id);
  assert.ok(events.some((event) => event.type === 'review.requested'));
  const completed = workflow.completeReview(review.id, {
    actor: 'dev',
    actorRole: 'developer',
    reason: 'lgtm',
  });
  assert.equal(completed.status, 'completed');
  assert.ok(workflow.listRoleEvents(run.id).some((event) => event.type === 'review.completed'));
  assert.equal(workflow.listReviews(project.id).length, 1);
});

test('accepting a handoff changes owner in the same transition', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id);
  const run = workflow.plan(item.id, 'dev');
  workflow.start(run.id, 'dev');
  const live = workflow.getRun(run.id);
  const running = live.steps.find((item) => item.status === 'running');
  const handoff = workflow.requestHandoff(run.id, {
    actor: 'dev',
    fromRole: 'planner',
    toOwner: 'bob',
    toRole: 'developer',
    reason: 'need a human',
    stepId: running.id,
  });
  assert.equal(handoff.status, 'pending');
  const accepted = workflow.acceptHandoff(handoff.id, {
    actor: 'bob',
    actorRole: 'developer',
    reason: 'taking it',
  });
  assert.equal(accepted.status, 'accepted');
  const after = workflow.getRun(run.id);
  assert.equal(after.owner, 'bob');
  assert.equal(after.steps.find((item) => item.id === running.id).owner, 'bob');
  assert.ok(workflow.listRoleEvents(run.id).some((event) => event.type === 'handoff.accepted'));
});

test('rejecting a handoff records the rejection and does not change owner', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id);
  const run = workflow.plan(item.id, 'dev');
  workflow.start(run.id, 'dev');
  const running = workflow.getRun(run.id).steps.find((item) => item.status === 'running');
  const handoff = workflow.requestHandoff(run.id, {
    actor: 'dev',
    fromRole: 'planner',
    toOwner: 'bob',
    toRole: 'developer',
    reason: 'need a human',
    stepId: running.id,
  });
  const rejected = workflow.rejectHandoff(handoff.id, {
    actor: 'bob',
    actorRole: 'developer',
    reason: 'busy',
  });
  assert.equal(rejected.status, 'rejected');
  const after = workflow.getRun(run.id);
  assert.equal(after.steps.find((item) => item.id === running.id).owner, 'dev');
  assert.ok(workflow.listRejections(run.id).some((item) => item.eventType === 'handoff.rejected'));
});

test('a wrong-role handoff does not change state', () => {
  const { board, project, workflow } = setup();
  const item = story(board, project.id);
  const run = workflow.plan(item.id, 'dev');
  workflow.start(run.id, 'dev');
  const running = workflow.getRun(run.id).steps.find((item) => item.status === 'running');
  const handoff = workflow.requestHandoff(run.id, {
    actor: 'dev',
    fromRole: 'planner',
    toOwner: 'bob',
    toRole: 'developer',
    reason: 'need a human',
    stepId: running.id,
  });
  assert.throws(
    () => workflow.acceptHandoff(handoff.id, {
      actor: 'eve',
      actorRole: 'generator',
      reason: 'steal',
    }),
    (error) => error instanceof WorkflowError && error.code === 'AUTHORITY',
  );
  const after = workflow.getRun(run.id);
  assert.equal(after.steps.find((item) => item.id === running.id).owner, 'dev');
  assert.equal(workflow.listHandoffs(run.id)[0].status, 'pending');
  assert.ok(workflow.listRejections(run.id).some((item) => /cannot accept/.test(item.reason)));
});

test('project rollups show overloaded roles and release readiness', () => {
  const { board, project, workflow } = setup();
  board.createTeamMember({
    projectId: project.id,
    displayName: 'Dev',
    roleIds: ['developer'],
    concurrentWorkLimit: 1,
  });
  const empty = workflow.projectRollups(project.id);
  assert.equal(empty.releaseReadiness.ready, true);
  const custom = importFromDefault(workflow, 'dev', [
    step({ id: 'one', title: 'One', role: 'developer' }),
    step({ id: 'two', title: 'Two', role: 'developer' }),
  ]);
  workflow.selectTemplate(project.id, custom.id);
  const item = story(board, project.id);
  const run = workflow.plan(item.id, 'dev');
  workflow.start(run.id, 'dev');
  const rollups = workflow.projectRollups(project.id);
  const developer = rollups.overloadedRoles.find((row) => row.role === 'developer');
  assert.ok(developer);
  assert.equal(developer.overloaded, true);
  assert.equal(developer.activeSteps >= 2, true);
  assert.equal(rollups.releaseReadiness.ready, false);
  assert.ok(rollups.releaseReadiness.reasons.includes('open stories'));
});

test('customers cannot replace templates, manage reviews, or accept handoffs', async (t) => {
  const { root, board, project, workflow } = setup();
  const item = story(board, project.id);
  const run = workflow.plan(item.id, 'dev');
  workflow.start(run.id, 'dev');
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(7) });
  const web = createWebService(
    { board, requirements, workflow },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const customerLogin = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = customerLogin.headers.get('set-cookie')?.split(';')[0];
  const replaced = await fetch(`${status.url}/api/v1/projects/${project.id}/workflow-template/replace`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 'huntianling.user-story', mode: 'future' }),
  });
  assert.equal(replaced.status, 403);
  const review = await fetch(`${status.url}/api/v1/review-requests`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workItemId: item.id, reason: 'nope' }),
  });
  assert.equal(review.status, 403);
  const handoff = await fetch(`${status.url}/api/v1/workflow-runs/${run.id}/handoffs`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ toOwner: 'bob', toRole: 'developer', reason: 'nope' }),
  });
  assert.equal(handoff.status, 403);

  const developerLogin = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const devCookie = developerLogin.headers.get('set-cookie')?.split(';')[0];
  const capability = await fetch(`${status.url}/api/v1/workflow-capabilities/review`, {
    headers: { cookie: devCookie },
  });
  assert.equal(capability.status, 200);
  const payload = await capability.json();
  assert.ok(payload.documentation);
  assert.ok(Array.isArray(payload.fixtures));
  const createdReview = await fetch(`${status.url}/api/v1/review-requests`, {
    method: 'POST',
    headers: { cookie: devCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      workItemId: item.id,
      reason: 'code',
      requiredReviewerRoles: ['developer'],
    }),
  });
  assert.equal(createdReview.status, 201);
  const reviewBody = await createdReview.json();
  const completed = await fetch(`${status.url}/api/v1/review-requests/${reviewBody.id}/complete`, {
    method: 'POST',
    headers: { cookie: devCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ actorRole: 'developer', reason: 'lgtm' }),
  });
  assert.equal(completed.status, 200);
  const rollups = await fetch(`${status.url}/api/v1/projects/${project.id}/workflow-rollups`, {
    headers: { cookie: devCookie },
  });
  assert.equal(rollups.status, 200);
  const rollupBody = await rollups.json();
  assert.ok(Array.isArray(rollupBody.overloadedRoles));
  assert.equal(typeof rollupBody.releaseReadiness.ready, 'boolean');
});
