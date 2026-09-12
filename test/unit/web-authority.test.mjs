import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createAuthorityService } from '../../lib/host/authority/service.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCiService } from '../../lib/host/ci/service.js';
import { createScmService } from '../../lib/host/scm/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(8),
  });
}

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

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('developer sees capability boundaries and can approve a generator push', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-authority-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '权限项目' });
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
  const scm = createScmService({ board, authority, runner: gitRunner });
  const ci = createCiService({
    board,
    authority,
    runner: () => ({ status: 'pass', output: 'ok' }),
  });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements, authority, scm, ci },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'reviewer', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer' },
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
  const denied = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/authority`, {
    headers: { cookie: customerCookie },
  });
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];

  const html = await fetch(`${status.url}/developer`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /权限边界/);

  const policy = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/authority`, {
    headers: { cookie },
  });
  assert.ok(policy.payload.roles.some((role) => role.role === 'generator' && role.approvalRequired.includes('branch_push')));

  const boardPayload = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/developer-board`,
    { headers: { cookie } },
  );
  assert.ok(boardPayload.payload.authority.roles.some((role) => role.role === 'planner'));

  const blocked = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/scm/push`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceRoot: root, role: 'generator' }),
  });
  assert.equal(blocked.response.status, 400);
  assert.match(blocked.payload.error, /approval/);

  const requested = await json(`${status.url}/api/v1/authority/approvals`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: project.id,
      workItemId: story.id,
      role: 'generator',
      action: 'branch_push',
      reason: 'ship login',
    }),
  });
  assert.equal(requested.response.status, 201);

  const reviewerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'reviewer', password: 'correct-password' }),
  });
  const reviewerCookie = reviewerLogin.response.headers.get('set-cookie')?.split(';')[0];
  const granted = await json(
    `${status.url}/api/v1/authority/approvals/${encodeURIComponent(requested.payload.id)}/decide`,
    {
      method: 'POST',
      headers: { cookie: reviewerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'granted', reason: 'ok' }),
    },
  );
  assert.equal(granted.payload.status, 'granted');

  const pushed = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/scm/push`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceRoot: root, role: 'generator', approvalId: requested.payload.id }),
  });
  assert.equal(pushed.response.status, 200);

  const production = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/ci/run`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ production: true, role: 'evaluator' }),
  });
  assert.equal(production.response.status, 400);
  assert.match(production.payload.error, /approval/);
});
