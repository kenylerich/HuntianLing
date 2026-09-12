import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAuthorityService } from '../../lib/host/authority/service.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCollabService } from '../../lib/host/collab/service.js';
import { createDispatchService } from '../../lib/host/dispatch/service.js';
import { resolveDispatchConfig } from '../../lib/host/dispatch/types.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createScmService } from '../../lib/host/scm/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';
import { createWorkflowService } from '../../lib/host/workflow/service.js';
import { WorkflowError } from '../../lib/host/workflow/types.js';

function gitRunner() {
  return (args) => {
    if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
      return { status: 0, stdout: 'main\n', stderr: '' };
    }
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
      return { status: 0, stdout: 'abc111\n', stderr: '' };
    }
    if (args[0] === 'status' || args[0] === 'remote' || args[0] === 'push' || args[0] === 'add' || args[0] === 'commit') {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'checkout' && args[1] === '-b') {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'diff') {
      return { status: 0, stdout: 'diff --git a/src/a.ts b/src/a.ts\n', stderr: '' };
    }
    if (args[0] === 'rev-list') {
      return { status: 0, stdout: '0\t1\n', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `unknown ${args.join(' ')}` };
  };
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-dispatch-cr6-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const authority = createAuthorityService({ board, workspaceRoot: root });
  const scm = createScmService({
    board,
    authority,
    workspaceRoot: root,
    runner: gitRunner(),
  });
  const dispatch = createDispatchService({
    board,
    workspaceRoot: root,
    config: resolveDispatchConfig({ leaseTtlMs: 60_000 }),
    collab,
    scm,
    authority,
  });
  const alice = board.createTeamMember({
    projectId: project.id,
    displayName: 'Alice',
    roleIds: ['developer'],
    skillProfile: ['implementation'],
    concurrentWorkLimit: 2,
  });
  const bob = board.createTeamMember({
    projectId: project.id,
    displayName: 'Bob',
    roleIds: ['developer'],
    skillProfile: ['implementation'],
    concurrentWorkLimit: 2,
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
  return { root, board, project, collab, authority, scm, dispatch, alice, bob, item };
}

test('a member who owns the WorkItem branch ranks higher in dispatch recommendation', () => {
  const { board, project, scm, dispatch, alice, bob, item } = setup();
  scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: project.id });
  scm.createBranch({ workItemId: item.id, actor: alice.id, role: 'generator' });
  const recommendation = dispatch.recommend(project.id, item.id);
  assert.equal(recommendation.candidates[0].memberId, alice.id);
  assert.ok(recommendation.candidates[0].reasons.includes('branch-owner'));
  assert.equal(recommendation.candidates.some((row) => row.memberId === bob.id && row.reasons.includes('branch-owner')), false);
});

test('pending approvals change dispatch ranking', () => {
  const { board, project, dispatch, alice, bob, item } = setup();
  board.addWorkItemApprover(item.id, alice.id);
  const recommendation = dispatch.recommend(project.id, item.id);
  const aliceRow = recommendation.candidates.find((row) => row.memberId === alice.id);
  const bobRow = recommendation.candidates.find((row) => row.memberId === bob.id);
  assert.ok(aliceRow.reasons.includes('approver'));
  assert.ok(bobRow.reasons.includes('pending-approval'));
  assert.ok(aliceRow.score > bobRow.score);
});

test('transferring work writes a transfer event instead of a new assignment event', () => {
  const { board, project, dispatch, alice, bob, item } = setup();
  dispatch.claim(item.id, alice.id, 'pm');
  const assignedBefore = board.listAuditEvents({ projectId: project.id, action: 'work_item.assigned' }).length;
  const transferred = dispatch.transfer(item.id, bob.id, 'pm');
  assert.equal(transferred.assignee, bob.id);
  assert.equal(board.listAuditEvents({ projectId: project.id, action: 'work_item.transferred' }).length, 1);
  assert.equal(board.listAuditEvents({ projectId: project.id, action: 'work_item.assigned' }).length, assignedBefore);
  assert.equal(
    dispatch.listLeases(project.id).some((lease) => lease.workItemId === item.id && lease.ownerId === bob.id && lease.mode === 'exclusive_write'),
    true,
  );
});

test('Code View shows active lease badges for the WorkItem', async (t) => {
  const { root, board, project, dispatch, item, alice } = setup();
  dispatch.claim(item.id, alice.id, 'pm');
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(6) });
  const web = createWebService(
    { board, requirements, dispatch },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'dev', passwordHash: hash, audience: 'developer' }],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const codeView = await fetch(`${status.url}/api/v1/work-items/${encodeURIComponent(item.id)}/code-view`, {
    headers: { cookie },
  }).then((response) => response.json());
  assert.ok(codeView.leases.some((lease) => lease.mode === 'exclusive_write' && lease.workItemId === item.id));
  const html = await fetch(`${status.url}/developer`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /租约/);
});

test('migration file leases appear as migration conflicts', () => {
  const { project, dispatch, alice, bob } = setup();
  dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'file',
    resourceId: 'db/migrations/001_init.sql',
    mode: 'exclusive_write',
    ownerId: alice.id,
    reason: 'migrate',
  });
  dispatch.acquireLease({
    projectId: project.id,
    resourceType: 'file',
    resourceId: 'db/migrations/002_users.sql',
    mode: 'exclusive_write',
    ownerId: bob.id,
    reason: 'migrate',
  });
  const conflicts = dispatch.listConflicts(project.id);
  assert.ok(conflicts.some((row) => row.mode === 'migration'));
});

test('a workflow step does not start when an exclusive lease or foreign branch ownership blocks it', () => {
  const { board, project, scm, dispatch, alice, bob, item, root } = setup();
  const workflow = createWorkflowService({ board, workspaceRoot: root, dispatch, scm });
  const run = workflow.plan(item.id, 'dev');
  dispatch.claim(item.id, alice.id, 'pm');
  assert.throws(
    () => workflow.start(run.id, bob.id),
    (error) => error instanceof WorkflowError && error.code === 'NOT_READY' && /exclusive lease/.test(error.message),
  );
  dispatch.release(item.id, alice.id);
  scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  scm.createBranch({ workItemId: item.id, actor: alice.id, role: 'generator' });
  const second = workflow.plan(item.id, 'dev');
  assert.throws(
    () => workflow.start(second.id, bob.id),
    (error) => error instanceof WorkflowError && error.code === 'NOT_READY' && /owned by/.test(error.message),
  );
});

test('customers cannot transfer dispatched work', async (t) => {
  const { root, board, project, dispatch, item, alice, bob } = setup();
  dispatch.claim(item.id, alice.id, 'pm');
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(6) });
  const web = createWebService(
    { board, requirements, dispatch },
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
  const customerLogin = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const customerCookie = customerLogin.headers.get('set-cookie')?.split(';')[0];
  const denied = await fetch(`${status.url}/api/v1/work-items/${encodeURIComponent(item.id)}/transfer`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ memberId: bob.id }),
  });
  assert.equal(denied.status, 403);
});
