import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAuthorityService } from '../../lib/host/authority/service.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createScmService } from '../../lib/host/scm/service.js';

function gitRunner() {
  let head = 'abc111';
  return (args) => {
    if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
      return { status: 0, stdout: 'main\n', stderr: '' };
    }
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
      return { status: 0, stdout: `${head}\n`, stderr: '' };
    }
    if (args[0] === 'status' || args[0] === 'remote' || args[0] === 'push' || args[0] === 'add') {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'checkout' && args[1] === '-b') {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'commit') {
      head = 'def222';
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'diff') {
      return {
        status: 0,
        stdout: 'diff --git a/src/login.ts b/src/login.ts\n+export function login() {}\n',
        stderr: '',
      };
    }
    if (args[0] === 'rev-list') {
      return { status: 0, stdout: '0\t1\n', stderr: '' };
    }
    if (args[0] === 'merge-tree') {
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `unknown ${args.join(' ')}` };
  };
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-scm-branches-'));
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
  const scm = createScmService({
    board,
    authority,
    workspaceRoot: root,
    runner: gitRunner(),
  });
  return { root, board, project, story, authority, scm };
}

test('a project can register a local Git repository', () => {
  const { scm, project, root } = setup();
  const repo = scm.registerRepository({
    projectId: project.id,
    name: 'app',
    workspaceRoot: root,
    defaultBranch: 'main',
  });
  assert.equal(repo.provider, 'local-git');
  assert.equal(scm.listRepositories(project.id)[0].id, repo.id);
});

test('creating a WorkItem branch stores name, base, and owner; protected names are rejected', () => {
  const { scm, project, story, root, board } = setup();
  scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  const branch = scm.createBranch({ workItemId: story.id, actor: 'dev', role: 'generator' });
  assert.equal(branch.name, `htl/${story.id}`);
  assert.equal(branch.baseBranch, 'main');
  assert.deepEqual(branch.workItemIds, [story.id]);
  assert.equal(branch.owner, 'dev');
  assert.equal(branch.protection, 'none');
  const locked = createScmService({
    board,
    workspaceRoot: join(root, 'locked'),
    runner: gitRunner(),
    config: { branchNameTemplate: '{workItemId}', protectedBranches: [story.id] },
  });
  locked.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  assert.throws(
    () => locked.createBranch({ workItemId: story.id, actor: 'dev' }),
    /protected/,
  );
});

test('sync and rebase-check record unpushed and conflict-free state', () => {
  const { scm, project, story, root } = setup();
  scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  const branch = scm.createBranch({ workItemId: story.id, actor: 'dev' });
  const synced = scm.syncBranch(branch.id);
  assert.equal(synced.lastSync.unpushed, true);
  assert.equal(synced.lastSync.diverged, false);
  const checked = scm.rebaseCheck(branch.id);
  assert.equal(checked.lastSync.conflict, false);
});

test('changeset commit uses a message template that includes the WorkItem id', () => {
  const { scm, project, story, root } = setup();
  scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  const branch = scm.createBranch({ workItemId: story.id, actor: 'dev' });
  const draft = scm.createChangeset({
    workItemId: story.id,
    branchId: branch.id,
    actor: 'dev',
  });
  assert.equal(draft.status, 'draft');
  assert.ok(draft.files.includes('src/login.ts'));
  const committed = scm.commitChangeset({ changesetId: draft.id, actor: 'dev', role: 'generator' });
  assert.equal(committed.status, 'committed');
  assert.match(committed.message, new RegExp(story.id));
  assert.equal(committed.commitSha, 'def222');
});

test('push, pull request, and merge remain separate and still require approval', () => {
  const { scm, project, story, root, authority } = setup();
  scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  const branch = scm.createBranch({ workItemId: story.id, actor: 'gen-1' });
  assert.throws(
    () => scm.pushBranch({ branchId: branch.id, actor: 'gen-1', role: 'generator' }),
    /requires human approval/,
  );
  const pushApproval = authority.requestApproval({
    projectId: project.id,
    workItemId: story.id,
    role: 'generator',
    action: 'branch_push',
    requester: 'gen-1',
  });
  authority.decideApproval({ approvalId: pushApproval.id, decision: 'granted', actor: 'reviewer' });
  const pushed = scm.pushBranch({
    branchId: branch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: pushApproval.id,
  });
  assert.equal(pushed.workItemIds[0], story.id);

  assert.throws(
    () => scm.openBranchPullRequest({ branchId: branch.id, actor: 'gen-1', role: 'generator' }),
    /requires human approval/,
  );
  const prApproval = authority.requestApproval({
    projectId: project.id,
    workItemId: story.id,
    role: 'generator',
    action: 'pull_request',
    requester: 'gen-1',
  });
  authority.decideApproval({ approvalId: prApproval.id, decision: 'granted', actor: 'reviewer' });
  const pullRequest = scm.openBranchPullRequest({
    branchId: branch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: prApproval.id,
    title: 'Add login',
  });
  assert.equal(pullRequest.status, 'open');
  assert.equal(pullRequest.head, branch.name);

  assert.throws(
    () => scm.mergePullRequest({ pullRequestId: pullRequest.id, actor: 'gen-1', role: 'generator' }),
    /requires human approval/,
  );
  const mergeApproval = authority.requestApproval({
    projectId: project.id,
    workItemId: story.id,
    role: 'generator',
    action: 'merge',
    requester: 'gen-1',
  });
  authority.decideApproval({ approvalId: mergeApproval.id, decision: 'granted', actor: 'reviewer' });
  const merged = scm.mergePullRequest({
    pullRequestId: pullRequest.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: mergeApproval.id,
  });
  assert.equal(merged.status, 'merged');
});

test('Code View shows repositories, branches, commits, diffs, and files', () => {
  const { scm, project, story, root } = setup();
  scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  const branch = scm.createBranch({ workItemId: story.id, actor: 'dev' });
  const draft = scm.createChangeset({ workItemId: story.id, branchId: branch.id, actor: 'dev' });
  scm.commitChangeset({ changesetId: draft.id, actor: 'dev' });
  const view = scm.codeView(story.id);
  assert.equal(view.repositories[0].name, 'app');
  assert.equal(view.branches[0].name, branch.name);
  assert.equal(view.commits[0].sha, 'def222');
  assert.ok(view.diffs[0].patch.includes('login.ts'));
  assert.ok(view.changedFiles.includes('src/login.ts'));
  assert.equal(view.unlinked, false);
});

test('unlinked branches appear in the project unlinked-code list', () => {
  const { scm, project, root } = setup();
  const repo = scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  scm.importUnlinkedBranch({ repositoryId: repo.id, name: 'wip/orphan', actor: 'dev' });
  assert.equal(scm.unlinkedCode(project.id)[0].name, 'wip/orphan');
});
