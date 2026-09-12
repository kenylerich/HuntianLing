import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createAuthorityService } from '../../lib/host/authority/service.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCiService } from '../../lib/host/ci/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(4),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('customers cannot trigger hosted CI', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-ci-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '托管检查' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '需要检查',
    design: '托管流水线',
    acceptance: ['ci green'],
  });
  const authority = createAuthorityService({ board, workspaceRoot: root });
  const hosted = (request) => {
    if (request.method === 'GET' && request.url.endsWith('/actions/workflows')) {
      return { status: 200, body: JSON.stringify({ workflows: [{ id: 1, name: 'CI', path: 'ci.yml' }] }) };
    }
    if (request.method === 'POST' && request.url.includes('/dispatches')) {
      return { status: 204, body: '' };
    }
    if (request.url.includes('/actions/runs?')) {
      return {
        status: 200,
        body: JSON.stringify({
          workflow_runs: [{
            id: 42,
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/acme/app/actions/runs/42',
          }],
        }),
      };
    }
    if (request.url.endsWith('/artifacts')) {
      return { status: 200, body: JSON.stringify({ artifacts: [] }) };
    }
    if (request.url.endsWith('/logs')) {
      return { status: 200, body: 'ok' };
    }
    return { status: 500, body: `unexpected ${request.method} ${request.url}` };
  };
  const ci = createCiService({
    board,
    authority,
    hosted,
    env: {},
    runner: () => ({ status: 'pass', output: 'ok' }),
  });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements, authority, ci },
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
  const deniedRun = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/ci/run`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'github-actions',
      owner: 'acme',
      repo: 'app',
      workflow: 'ci.yml',
      token: 'ghp_secret',
      role: 'ci',
    }),
  });
  assert.equal(deniedRun.response.status, 403);

  const deniedDiscover = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/ci/workflows`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'github-actions',
      owner: 'acme',
      repo: 'app',
      token: 'ghp_secret',
    }),
  });
  assert.equal(deniedDiscover.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const triggered = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/ci/run`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'github-actions',
      owner: 'acme',
      repo: 'app',
      workflow: 'ci.yml',
      token: 'ghp_secret',
      role: 'ci',
    }),
  });
  assert.equal(triggered.response.status, 200);
  assert.equal(triggered.payload.ciRuns[0].url, 'https://github.com/acme/app/actions/runs/42');
  assert.equal(JSON.stringify(triggered.payload).includes('ghp_secret'), false);
});
