import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAuthorityService } from '../../lib/host/authority/service.js';
import { AuthorityError } from '../../lib/host/authority/types.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCiService } from '../../lib/host/ci/service.js';
import { createScmService } from '../../lib/host/scm/service.js';

function gitRunner(args) {
  if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
    return { status: 0, stdout: 'main\n', stderr: '' };
  }
  if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
    return { status: 0, stdout: 'abc123\n', stderr: '' };
  }
  if (args[0] === 'status' || args[0] === 'remote' || args[0] === 'push') {
    return { status: 0, stdout: '', stderr: '' };
  }
  return { status: 1, stdout: '', stderr: 'unknown' };
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-authority-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '需要登录',
    design: '表单',
    acceptance: ['can log in'],
  });
  const authority = createAuthorityService({ board, workspaceRoot: root });
  return { root, board, project, story, authority };
}

test('each role stores allowed types, tools, write permissions, and forbidden actions', () => {
  const { authority } = setup();
  const roles = authority.policies().map((item) => item.role);
  assert.deepEqual(roles.slice(0, 5), ['planner', 'generator', 'evaluator', 'scm', 'ci']);
  assert.ok(roles.includes('ux-designer'));
  assert.ok(roles.includes('qa-engineer'));
  assert.ok(roles.includes('security-reviewer'));
  const generator = authority.policyFor('generator');
  assert.ok(generator.allowedActions.includes('code_modify'));
  assert.ok(generator.approvalRequired.includes('branch_push'));
  assert.ok(generator.forbiddenActions.includes('review_approve'));
  assert.ok(generator.writePermissions.includes('git_commit'));
  const planner = authority.policyFor('planner');
  assert.ok(planner.forbiddenActions.includes('branch_push'));
  assert.ok(planner.allowedActions.includes('draft'));
});

test('planner cannot push even with approval', () => {
  const { authority, project, story } = setup();
  assert.throws(
    () =>
      authority.requestApproval({
        projectId: project.id,
        workItemId: story.id,
        role: 'planner',
        action: 'branch_push',
        requester: 'dev',
      }),
    (error) => error instanceof AuthorityError && error.code === 'DENIED',
  );
  assert.equal(
    authority.authorize({
      role: 'planner',
      action: 'branch_push',
      projectId: project.id,
      actor: 'planner-1',
      workItemId: story.id,
    }).decision,
    'deny',
  );
});

test('generator push without approval is denied and audited', () => {
  const { board, project, story, authority, root } = setup();
  const scm = createScmService({ board, authority, runner: gitRunner });
  assert.throws(
    () =>
      scm.push({
        workItemId: story.id,
        workspaceRoot: root,
        role: 'generator',
        actor: 'gen-1',
      }),
    /requires human approval/,
  );
  const events = board.listAuditEvents({ projectId: project.id, action: 'authority.denied' });
  assert.ok(events.length > 0);
});

test('a granted approval from a different human allows generator push', () => {
  const { board, project, story, authority, root } = setup();
  const requested = authority.requestApproval({
    projectId: project.id,
    workItemId: story.id,
    role: 'generator',
    action: 'branch_push',
    requester: 'gen-1',
  });
  assert.throws(
    () => authority.decideApproval({ approvalId: requested.id, decision: 'granted', actor: 'gen-1' }),
    /requester cannot approve/,
  );
  const granted = authority.decideApproval({
    approvalId: requested.id,
    decision: 'granted',
    actor: 'reviewer',
    reason: 'ok to push',
  });
  assert.equal(granted.status, 'granted');
  const scm = createScmService({ board, authority, runner: gitRunner });
  const summary = scm.push({
    workItemId: story.id,
    workspaceRoot: root,
    role: 'generator',
    actor: 'gen-1',
    approvalId: requested.id,
  });
  assert.ok(summary.codeLinks.some((link) => /pushed/.test(link.label)));
  const approved = board.listAuditEvents({ projectId: project.id, action: 'authority.approved' });
  assert.ok(approved.length > 0);
});

test('evaluator can run local CI without approval and cannot trigger production CI without it', () => {
  const { board, story, authority } = setup();
  const ci = createCiService({
    board,
    authority,
    runner: () => ({ status: 'pass', output: 'ok' }),
  });
  const local = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp',
    role: 'evaluator',
    actor: 'eval-1',
    commands: [{ id: 'test', command: 'pnpm run test', required: true }],
  });
  assert.ok(local.checks.some((check) => check.producer === 'ci'));
  assert.throws(
    () =>
      ci.run({
        workItemId: story.id,
        workspaceRoot: '/tmp',
        production: true,
        role: 'evaluator',
        actor: 'eval-1',
        commands: [{ id: 'deploy', command: 'pnpm run test', required: true }],
      }),
    /requires human approval/,
  );
});

test('protected file writes require approval', () => {
  const { authority, project, story } = setup();
  const result = authority.authorize({
    role: 'generator',
    action: 'code_modify',
    projectId: project.id,
    actor: 'gen-1',
    workItemId: story.id,
    path: '.github/workflows/ci.yml',
  });
  assert.equal(result.decision, 'needs_approval');
});
