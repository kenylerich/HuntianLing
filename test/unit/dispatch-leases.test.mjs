import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCollabService } from '../../lib/host/collab/service.js';
import { createDispatchService } from '../../lib/host/dispatch/service.js';
import { DispatchError } from '../../lib/host/dispatch/types.js';
import { resolveDispatchConfig } from '../../lib/host/dispatch/types.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-dispatch-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const dispatch = createDispatchService({
    board,
    workspaceRoot: root,
    config: resolveDispatchConfig({ leaseTtlMs: 60_000 }),
    collab,
  });
  const alice = board.createTeamMember({
    projectId: project.id,
    displayName: 'Alice',
    roleIds: ['developer'],
    skillProfile: ['implementation'],
    concurrentWorkLimit: 1,
  });
  const bob = board.createTeamMember({
    projectId: project.id,
    displayName: 'Bob',
    roleIds: ['developer'],
    skillProfile: ['review'],
    concurrentWorkLimit: 1,
  });
  const milestone = board.createMilestone({ projectId: project.id, title: 'MVP' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'ready',
    title: '登录',
    body: '客户能登录',
    analysis: '分析完成',
    design: '设计完成',
    acceptance: ['可登录'],
    milestoneId: milestone.id,
  });
  return { root, board, project, collab, dispatch, alice, bob, item };
}

test('dispatch recommendation ranks eligible members by capacity, WIP, role, and skills', () => {
  const { project, dispatch, item, alice } = setup();
  const recommendation = dispatch.recommend(project.id, item.id);
  assert.equal(recommendation.candidates[0].memberId, alice.id);
  assert.ok(recommendation.candidates[0].reasons.some((reason) => reason.startsWith('slots:')));
});

test('automatic dispatch assigns exclusive work and writes an audit event', () => {
  const { board, project, collab, dispatch, item, alice } = setup();
  const assigned = dispatch.run(project.id, 'pm');
  assert.equal(assigned.length, 1);
  assert.equal(board.getWorkItem(item.id).assignee, alice.id);
  assert.ok(board.listAuditEvents({ projectId: project.id, action: 'work_item.assigned' }).length > 0);
  const leases = dispatch.listLeases(project.id);
  assert.equal(leases.some((lease) => lease.resourceId === item.id && lease.mode === 'exclusive_write'), true);
  const conversation = collab.listConversations(project.id)[0];
  assert.ok(conversation);
  assert.ok(collab.listMessages(conversation.id).some((message) => message.type === 'note.chat'));
});

test('a second member cannot claim the same exclusive WorkItem', () => {
  const { dispatch, item, alice, bob } = setup();
  dispatch.claim(item.id, alice.id, 'pm');
  assert.throws(
    () => dispatch.claim(item.id, bob.id, 'pm'),
    (error) => error instanceof DispatchError && error.code === 'CONFLICT',
  );
});

test('a shared read lease allows a second participant for review work', () => {
  const { project, dispatch, item, alice, bob } = setup();
  const first = dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'work_item',
    resourceId: `${item.id}:review`,
    mode: 'shared_read',
    ownerId: alice.id,
    reason: 'review',
    workItemId: item.id,
  });
  const second = dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'work_item',
    resourceId: `${item.id}:review`,
    mode: 'shared_read',
    ownerId: bob.id,
    reason: 'pair review',
    workItemId: item.id,
  });
  assert.equal(first.mode, 'shared_read');
  assert.equal(second.ownerId, bob.id);
  assert.throws(
    () => dispatch.acquireLease({
      projectId: project.id,
      resourceType: 'work_item',
      resourceId: `${item.id}:review`,
      mode: 'exclusive_write',
      ownerId: alice.id,
      reason: 'take over',
      workItemId: item.id,
    }),
    (error) => error instanceof DispatchError && error.code === 'CONFLICT',
  );
});

test('rebalance releases leases and assignments when work is cancelled', () => {
  const { board, project, dispatch, alice } = setup();
  const cancelled = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'stopped',
    title: '已取消',
    body: '不再做',
    analysis: 'a',
    design: 'd',
    acceptance: ['x'],
  });
  board.updateWorkItem(cancelled.id, { assignee: alice.id });
  dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'work_item',
    resourceId: cancelled.id,
    mode: 'exclusive_write',
    ownerId: alice.id,
    reason: 'stale assignment',
    workItemId: cancelled.id,
  });
  const released = dispatch.rebalance(project.id, 'pm');
  assert.equal(released.some((row) => row.id === cancelled.id), true);
  assert.equal(board.getWorkItem(cancelled.id).assignee, '');
  assert.equal(dispatch.listLeases(project.id).some((lease) => lease.workItemId === cancelled.id), false);
});

test('rebalance releases leases and assignments when work is blocked', () => {
  const { board, project, dispatch, alice } = setup();
  const blocker = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '阻塞',
    body: '先做这个',
    analysis: 'a',
    design: 'd',
    acceptance: ['x'],
  });
  const blocked = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '被阻塞的故事',
    body: '等待前置',
    analysis: 'a',
    design: 'd',
    acceptance: ['x'],
    blockedByIds: [blocker.id],
  });
  board.updateWorkItem(blocked.id, { assignee: alice.id });
  dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'work_item',
    resourceId: blocked.id,
    mode: 'exclusive_write',
    ownerId: alice.id,
    reason: 'stale assignment',
    workItemId: blocked.id,
  });
  const released = dispatch.rebalance(project.id, 'pm');
  assert.equal(released.some((row) => row.id === blocked.id), true);
  assert.equal(board.getWorkItem(blocked.id).assignee, '');
  assert.equal(dispatch.listLeases(project.id).some((lease) => lease.workItemId === blocked.id), false);
});

test('short-lived leases can be acquired, renewed, and released', () => {
  const { project, dispatch, item, alice } = setup();
  const lease = dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'branch',
    resourceId: 'htl/login',
    mode: 'exclusive_write',
    ownerId: alice.id,
    reason: 'implement',
    workItemId: item.id,
    linkedTaskId: 'task-1',
  });
  assert.equal(lease.linkedTaskId, 'task-1');
  const renewed = dispatch.renewLease(lease.id, alice.id);
  assert.ok(renewed.expiresAt >= lease.expiresAt);
  dispatch.releaseLease(lease.id, alice.id);
  assert.equal(dispatch.listLeases(project.id).some((row) => row.id === lease.id), false);
});

test('exclusive write leases block conflicting editors and appear in project conflicts', () => {
  const { project, dispatch, alice } = setup();
  dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'file',
    resourceId: 'src/login.ts',
    mode: 'exclusive_write',
    ownerId: alice.id,
    reason: 'edit',
  });
  dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'file',
    resourceId: 'src/login.ts/util.ts',
    mode: 'exclusive_write',
    ownerId: 'other',
    reason: 'overlap',
  });
  const conflicts = dispatch.listConflicts(project.id);
  assert.ok(conflicts.some((row) => row.mode === 'overlap' || row.resourceType === 'file'));
});

test('WorkItem feedback links to the run and skill versions; accept updates and reject does not', () => {
  const { board, dispatch, item } = setup();
  const agents = createAgentRuntime({ skills: createSkillService(), board });
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
      openQuestions: ['SSO?'],
    },
  });
  const captured = dispatch.captureRun(run);
  assert.equal(captured.agentId, 'planner');
  assert.ok(captured.skillVersions.length > 0);
  assert.equal(captured.runId, run.id);
  assert.ok(captured.openQuestions.includes('SSO?'));
  assert.ok(captured.nextActions.length > 0);
  const listed = dispatch.listFeedback(item.id);
  assert.equal(listed.length, 1);
  const before = board.getWorkItem(item.id).analysis;
  dispatch.decideFeedback(captured.id, { actor: 'dev', decision: 'reject' });
  assert.equal(board.getWorkItem(item.id).analysis, before);
  assert.equal(dispatch.listFeedback(item.id)[0].status, 'rejected');
  const second = dispatch.captureRun(run);
  dispatch.decideFeedback(second.id, { actor: 'dev', decision: 'accept' });
  assert.equal(board.getWorkItem(item.id).analysis, 'Customer can log in');
  assert.ok(board.listAuditEvents({ projectId: item.projectId, action: 'agent_feedback.rejected' }).length > 0);
});

test('unsupported lease types are rejected', () => {
  const { project, dispatch, alice } = setup();
  assert.throws(
    () => dispatch.acquireLease({
      projectId: project.id,
      resourceType: 'unknown',
      resourceId: 'x',
      mode: 'exclusive_write',
      ownerId: alice.id,
      reason: 'edit',
    }),
    (error) => error instanceof DispatchError && error.code === 'VALIDATION',
  );
});

test('developer can recommend dispatch; customers cannot dispatch or decide agent feedback', async (t) => {
  const { root, board, project, dispatch, item } = setup();
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(4) });
  const web = createWebService(
    { board, requirements, dispatch },
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
  const developerLogin = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const developerCookie = developerLogin.headers.get('set-cookie')?.split(';')[0];
  const developerRecommended = await fetch(`${status.url}/api/v1/team/dispatch/recommend`, {
    method: 'POST',
    headers: { cookie: developerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workItemId: item.id }),
  });
  assert.equal(developerRecommended.status, 200);
  const recommendation = await developerRecommended.json();
  assert.ok(recommendation.candidates.length > 0);
  const login = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const recommended = await fetch(`${status.url}/api/v1/team/dispatch/recommend`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workItemId: item.id }),
  });
  assert.equal(recommended.status, 403);
  const decided = await fetch(`${status.url}/api/v1/agent-feedback/x/accept`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(decided.status, 403);
});
