import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createAuthorityService } from '../../lib/host/authority/service.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createScmService } from '../../lib/host/scm/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(9),
  });
}

function gitRunner(args) {
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
    return { status: 0, stdout: '0\t0\n', stderr: '' };
  }
  return { status: 1, stdout: '', stderr: 'unknown' };
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('developer Code View shows managed branches and customers cannot create them', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-code-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '代码项目' });
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
  const scm = createScmService({ board, authority, workspaceRoot: root, runner: gitRunner });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements, authority, scm },
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
  const denied = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/repositories`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'app', workspaceRoot: root }),
  });
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];

  const html = await fetch(`${status.url}/developer`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /代码视图/);
  assert.match(html, /创建分支/);

  const repo = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/repositories`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'app', workspaceRoot: root }),
  });
  assert.equal(repo.response.status, 201);

  const branch = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/branches`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'generator' }),
  });
  assert.equal(branch.response.status, 201);
  assert.match(branch.payload.name, new RegExp(story.id));

  const changeset = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/changesets`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ branchId: branch.payload.id }),
  });
  assert.equal(changeset.response.status, 201);

  const committed = await json(`${status.url}/api/v1/changesets/${encodeURIComponent(changeset.payload.id)}/commit`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(committed.response.status, 200);
  assert.match(committed.payload.message, new RegExp(story.id));

  const codeView = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/code-view`, {
    headers: { cookie },
  });
  assert.equal(codeView.response.status, 200);
  assert.equal(codeView.payload.branches[0].name, branch.payload.name);
  assert.ok(codeView.payload.diffs.length > 0);

  const boardPayload = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/developer-board`,
    { headers: { cookie } },
  );
  const progress = boardPayload.payload.progress.items.find((item) => item.id === story.id);
  assert.equal(progress.codeView.branches[0].id, branch.payload.id);

  scm.importUnlinkedBranch({ repositoryId: repo.payload.id, name: 'orphan', actor: 'dev' });
  const unlinked = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/unlinked-code`, {
    headers: { cookie },
  });
  assert.ok(unlinked.payload.unlinkedCode.some((item) => item.name === 'orphan'));
});

test('customers cannot register hosted repositories or push', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-hosted-scm-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '托管项目' });
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
  const hosted = (request) => {
    if (request.method === 'POST' && /\/pulls$/.test(request.url)) {
      return { status: 201, body: JSON.stringify({ number: 9, html_url: 'https://github.com/acme/app/pull/9' }) };
    }
    if (request.method === 'POST' && request.url.includes('/git/refs')) {
      return { status: 201, body: '{}' };
    }
    return { status: 500, body: `unexpected ${request.method} ${request.url}` };
  };
  const scm = createScmService({
    board,
    authority,
    workspaceRoot: root,
    runner: gitRunner,
    hosted,
    env: {},
  });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements, authority, scm },
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
  const denied = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/repositories`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'app',
      provider: 'github',
      owner: 'acme',
      repo: 'app',
      remoteUrl: 'https://github.com/acme/app.git',
    }),
  });
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const repo = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/repositories`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'app',
      workspaceRoot: root,
      provider: 'github',
      owner: 'acme',
      repo: 'app',
      remoteUrl: 'https://github.com/acme/app.git',
    }),
  });
  assert.equal(repo.response.status, 201);
  assert.equal(repo.payload.provider, 'github');
  assert.equal(repo.payload.token, undefined);

  const branch = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/branches`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'generator' }),
  });
  assert.equal(branch.response.status, 201);

  const customerPush = await json(`${status.url}/api/v1/branches/${encodeURIComponent(branch.payload.id)}/push`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'generator', token: 'ghp_secret' }),
  });
  assert.equal(customerPush.response.status, 403);

  const html = await fetch(`${status.url}/developer`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /代码视图/);
});
