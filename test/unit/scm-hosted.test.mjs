import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAuthorityService } from '../../lib/host/authority/service.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createScmService } from '../../lib/host/scm/service.js';
import { ScmError } from '../../lib/host/scm/types.js';
import { scmStorePath } from '../../lib/host/scm/store.js';

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
      return { status: 0, stdout: 'diff --git a/src/login.ts b/src/login.ts\n', stderr: '' };
    }
    if (args[0] === 'rev-list') {
      return { status: 0, stdout: '0\t1\n', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `unknown ${args.join(' ')}` };
  };
}

function recordingTransport() {
  const calls = [];
  const transport = (request) => {
    calls.push(request);
    if (request.method === 'POST' && request.url.includes('/git/refs') && !request.url.includes('/heads/')) {
      return { status: 201, body: JSON.stringify({ ref: 'refs/heads/x' }) };
    }
    if (request.method === 'POST' && request.url.includes('/repository/branches') && !request.url.includes('/repository/branches/')) {
      return { status: 201, body: JSON.stringify({ name: 'branch' }) };
    }
    if (request.method === 'POST' && request.url.includes('/merge_requests') && request.url.includes('/projects/')) {
      return { status: 201, body: JSON.stringify({ iid: 7, web_url: 'https://gitlab.example/group/app/-/merge_requests/7' }) };
    }
    if (request.method === 'POST' && /\/pulls$/.test(request.url) && request.url.includes('gitea.example')) {
      return { status: 201, body: JSON.stringify({ number: 4, html_url: 'https://gitea.example/acme/app/pulls/4' }) };
    }
    if (request.method === 'POST' && /\/pulls$/.test(request.url)) {
      return { status: 201, body: JSON.stringify({ number: 3, html_url: 'https://github.com/acme/app/pull/3' }) };
    }
    if (request.method === 'PUT' && request.url.endsWith('/merge') && request.url.includes('/pulls/')) {
      return { status: 200, body: JSON.stringify({ sha: 'merge111', merged: true }) };
    }
    if (request.method === 'POST' && request.url.endsWith('/merge') && request.url.includes('/pulls/')) {
      return { status: 200, body: JSON.stringify({ sha: 'merge222' }) };
    }
    if (request.method === 'PUT' && request.url.includes('/merge_requests/') && request.url.endsWith('/merge')) {
      return { status: 200, body: JSON.stringify({ merge_commit_sha: 'merge333' }) };
    }
    return { status: 500, body: `unexpected ${request.method} ${request.url}` };
  };
  return { calls, transport };
}

function setup(transport, env = {}) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-scm-hosted-'));
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
    hosted: transport,
    env,
  });
  return { root, board, project, story, authority, scm };
}

function grant(authority, projectId, workItemId, action) {
  const approval = authority.requestApproval({
    projectId,
    workItemId,
    role: 'generator',
    action,
    requester: 'gen-1',
  });
  authority.decideApproval({ approvalId: approval.id, decision: 'granted', actor: 'reviewer' });
  return approval.id;
}

function registerGithub(scm, projectId, root) {
  return scm.registerRepository({
    projectId,
    name: 'app',
    workspaceRoot: root,
    provider: 'github',
    owner: 'acme',
    repo: 'app',
    remoteUrl: 'https://github.com/acme/app.git',
  });
}

test('a project can register GitHub, Gitea, and GitLab repositories on the same records as local Git', () => {
  const { scm, project, root } = setup((request) => ({ status: 500, body: request.url }));
  const github = registerGithub(scm, project.id, root);
  const gitea = scm.registerRepository({
    projectId: project.id,
    name: 'gitea-app',
    workspaceRoot: root,
    provider: 'gitea',
    owner: 'acme',
    repo: 'app',
    remoteUrl: 'https://gitea.example/acme/app.git',
  });
  const gitlab = scm.registerRepository({
    projectId: project.id,
    name: 'gitlab-app',
    workspaceRoot: root,
    provider: 'gitlab',
    owner: 'group',
    repo: 'app',
    remoteUrl: 'https://gitlab.example/group/app.git',
    apiBaseUrl: 'https://gitlab.example/api/v4',
  });
  const local = scm.registerRepository({
    projectId: project.id,
    name: 'local-app',
    workspaceRoot: root,
  });
  assert.equal(github.provider, 'github');
  assert.equal(github.owner, 'acme');
  assert.equal(gitea.provider, 'gitea');
  assert.equal(gitlab.provider, 'gitlab');
  assert.equal(local.provider, 'local-git');
  assert.equal(local.owner, null);
  assert.equal(scm.listRepositories(project.id).length, 4);
});

test('local Git still works without GitHub', () => {
  const { scm, project, story, root, authority } = setup((request) => ({ status: 500, body: request.url }));
  scm.registerRepository({ projectId: project.id, name: 'app', workspaceRoot: root });
  const branch = scm.createBranch({ workItemId: story.id, actor: 'gen-1', role: 'generator' });
  const approvalId = grant(authority, project.id, story.id, 'branch_push');
  const pushed = scm.pushBranch({
    branchId: branch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId,
  });
  assert.equal(pushed.workItemIds[0], story.id);
});

test('unknown provider or missing hosted remote metadata fails loud', () => {
  const { scm, project, root } = setup((request) => ({ status: 500, body: request.url }));
  assert.throws(
    () => scm.registerRepository({
      projectId: project.id,
      name: 'app',
      workspaceRoot: root,
      provider: 'bitbucket',
    }),
    (error) => error instanceof ScmError && error.code === 'VALIDATION' && /unknown scm provider/.test(error.message),
  );
  assert.throws(
    () => scm.registerRepository({
      projectId: project.id,
      name: 'app',
      workspaceRoot: root,
      provider: 'github',
      owner: 'acme',
      repo: 'app',
    }),
    /requires owner, repo, and remoteUrl/,
  );
});

test('hosted push, open pull request, and merge remain separate and still require approval', () => {
  const { calls, transport } = recordingTransport();
  const { scm, project, story, root, authority } = setup(transport, {});
  registerGithub(scm, project.id, root);
  const branch = scm.createBranch({ workItemId: story.id, actor: 'gen-1', role: 'generator' });
  assert.throws(
    () => scm.pushBranch({ branchId: branch.id, actor: 'gen-1', role: 'generator', token: 'ghp_secret' }),
    /requires human approval/,
  );
  const pushApproval = grant(authority, project.id, story.id, 'branch_push');
  scm.pushBranch({
    branchId: branch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: pushApproval,
    token: 'ghp_secret',
  });
  assert.throws(
    () => scm.openBranchPullRequest({
      branchId: branch.id,
      actor: 'gen-1',
      role: 'generator',
      token: 'ghp_secret',
    }),
    /requires human approval/,
  );
  const prApproval = grant(authority, project.id, story.id, 'pull_request');
  const pullRequest = scm.openBranchPullRequest({
    branchId: branch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: prApproval,
    title: 'Add login',
    token: 'ghp_secret',
  });
  assert.equal(pullRequest.status, 'open');
  assert.throws(
    () => scm.mergePullRequest({
      pullRequestId: pullRequest.id,
      actor: 'gen-1',
      role: 'generator',
      token: 'ghp_secret',
    }),
    /requires human approval/,
  );
  const mergeApproval = grant(authority, project.id, story.id, 'merge');
  const merged = scm.mergePullRequest({
    pullRequestId: pullRequest.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: mergeApproval,
    token: 'ghp_secret',
  });
  assert.equal(merged.status, 'merged');
  assert.equal(merged.mergeSha, 'merge111');
  assert.ok(calls.some((call) => call.method === 'POST' && call.url.endsWith('/git/refs')));
  assert.ok(calls.some((call) => call.method === 'POST' && call.url.endsWith('/pulls')));
  assert.ok(calls.some((call) => call.method === 'PUT' && call.url.endsWith('/pulls/3/merge')));
});

test('hosted credentials are supplied at call time or from the environment and are never persisted', () => {
  const { calls, transport } = recordingTransport();
  const { scm, project, story, root, authority } = setup(transport, {
    HUNTIANLING_GITHUB_TOKEN: 'env-secret-token',
  });
  registerGithub(scm, project.id, root);
  const branch = scm.createBranch({ workItemId: story.id, actor: 'gen-1', role: 'generator' });
  const pushApproval = grant(authority, project.id, story.id, 'branch_push');
  scm.pushBranch({
    branchId: branch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: pushApproval,
  });
  assert.equal(calls[0].headers.Authorization, 'Bearer env-secret-token');
  const persisted = readFileSync(scmStorePath(root), 'utf8');
  assert.equal(persisted.includes('env-secret-token'), false);
  assert.equal(persisted.includes('ghp_request'), false);
  assert.match(persisted, /"provider": "github"/);

  const { scm: missing, project: other, story: otherStory, root: otherRoot, authority: otherAuth } = setup(transport, {});
  registerGithub(missing, other.id, otherRoot);
  const otherBranch = missing.createBranch({ workItemId: otherStory.id, actor: 'gen-1', role: 'generator' });
  const otherApproval = grant(otherAuth, other.id, otherStory.id, 'branch_push');
  assert.throws(
    () => missing.pushBranch({
      branchId: otherBranch.id,
      actor: 'gen-1',
      role: 'generator',
      approvalId: otherApproval,
    }),
    (error) => error instanceof ScmError && error.code === 'HOSTED' && /token is required/.test(error.message),
  );
});

test('GitHub, Gitea, and GitLab use provider-specific pull-request and merge endpoints', () => {
  const { calls, transport } = recordingTransport();
  const { scm, project, story, root, authority } = setup(transport, {});
  const gitea = scm.registerRepository({
    projectId: project.id,
    name: 'gitea-app',
    workspaceRoot: root,
    provider: 'gitea',
    owner: 'acme',
    repo: 'app',
    remoteUrl: 'https://gitea.example/acme/app.git',
  });
  const giteaBranch = scm.createBranch({ workItemId: story.id, actor: 'gen-1', role: 'generator' });
  assert.equal(gitea.provider, 'gitea');
  const giteaPrApproval = grant(authority, project.id, story.id, 'pull_request');
  const giteaPr = scm.openBranchPullRequest({
    branchId: giteaBranch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: giteaPrApproval,
    token: 'gitea-token',
  });
  assert.equal(giteaPr.url, 'https://gitea.example/acme/app/pulls/4');
  const giteaMergeApproval = grant(authority, project.id, story.id, 'merge');
  const giteaMerged = scm.mergePullRequest({
    pullRequestId: giteaPr.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: giteaMergeApproval,
    token: 'gitea-token',
  });
  assert.equal(giteaMerged.mergeSha, 'merge222');

  const gitlabRoot = mkdtempSync(join(tmpdir(), 'huntianling-scm-gitlab-'));
  const gitlabBoard = createBoardService(gitlabRoot);
  const gitlabProject = gitlabBoard.createProject({ name: 'p' });
  const gitlabStory = gitlabBoard.createWorkItem({
    projectId: gitlabProject.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '需要登录',
    design: '表单',
    acceptance: ['can log in'],
  });
  const gitlabAuthority = createAuthorityService({ board: gitlabBoard, workspaceRoot: gitlabRoot });
  const gitlabScm = createScmService({
    board: gitlabBoard,
    authority: gitlabAuthority,
    workspaceRoot: gitlabRoot,
    runner: gitRunner(),
    hosted: transport,
    env: {},
  });
  gitlabScm.registerRepository({
    projectId: gitlabProject.id,
    name: 'gitlab-app',
    workspaceRoot: gitlabRoot,
    provider: 'gitlab',
    owner: 'group',
    repo: 'app',
    remoteUrl: 'https://gitlab.example/group/app.git',
    apiBaseUrl: 'https://gitlab.example/api/v4',
  });
  const gitlabBranch = gitlabScm.createBranch({ workItemId: gitlabStory.id, actor: 'gen-1', role: 'generator' });
  const gitlabPrApproval = grant(gitlabAuthority, gitlabProject.id, gitlabStory.id, 'pull_request');
  const gitlabPr = gitlabScm.openBranchPullRequest({
    branchId: gitlabBranch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: gitlabPrApproval,
    token: 'gitlab-token',
  });
  assert.equal(gitlabPr.url, 'https://gitlab.example/group/app/-/merge_requests/7');
  const gitlabMergeApproval = grant(gitlabAuthority, gitlabProject.id, gitlabStory.id, 'merge');
  const gitlabMerged = gitlabScm.mergePullRequest({
    pullRequestId: gitlabPr.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: gitlabMergeApproval,
    token: 'gitlab-token',
  });
  assert.equal(gitlabMerged.mergeSha, 'merge333');

  const giteaOpen = calls.find((call) =>
    call.method === 'POST' && call.url === 'https://gitea.example/api/v1/repos/acme/app/pulls',
  );
  assert.equal(giteaOpen.headers.Authorization, 'token gitea-token');
  const giteaMerge = calls.find((call) =>
    call.method === 'POST' && call.url === 'https://gitea.example/api/v1/repos/acme/app/pulls/4/merge',
  );
  assert.ok(giteaMerge);
  const gitlabOpen = calls.find((call) =>
    call.method === 'POST'
    && call.url === 'https://gitlab.example/api/v4/projects/group%2Fapp/merge_requests',
  );
  assert.equal(gitlabOpen.headers['PRIVATE-TOKEN'], 'gitlab-token');
  const gitlabMerge = calls.find((call) =>
    call.method === 'PUT'
    && call.url === 'https://gitlab.example/api/v4/projects/group%2Fapp/merge_requests/7/merge',
  );
  assert.ok(gitlabMerge);
});

test('Code View shows the hosted pull-request URL', () => {
  const { transport } = recordingTransport();
  const { scm, project, story, root, authority } = setup(transport, {});
  registerGithub(scm, project.id, root);
  const branch = scm.createBranch({ workItemId: story.id, actor: 'gen-1', role: 'generator' });
  const prApproval = grant(authority, project.id, story.id, 'pull_request');
  const pullRequest = scm.openBranchPullRequest({
    branchId: branch.id,
    actor: 'gen-1',
    role: 'generator',
    approvalId: prApproval,
    title: 'Add login',
    token: 'ghp_secret',
  });
  assert.equal(pullRequest.url, 'https://github.com/acme/app/pull/3');
  const view = scm.codeView(story.id);
  assert.equal(view.repositories[0].provider, 'github');
  assert.equal(view.pullRequests[0].url, 'https://github.com/acme/app/pull/3');
});
