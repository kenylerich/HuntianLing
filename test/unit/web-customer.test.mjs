import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function services() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-customer-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  return { board, requirements };
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(9),
  });
}

test('customer shell collects MKT dialog and hides other customers and developer chrome', async (t) => {
  const { board, requirements } = services();
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'cust-a', passwordHash: hash, audience: 'customer' },
          { username: 'cust-b', passwordHash: hash, audience: 'customer' },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();

  const page = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust-a', password: 'correct-password' }),
  });
  const cookieA = page.headers.get('set-cookie')?.split(';')[0];
  const html = await fetch(`${status.url}/customer`, { headers: { cookie: cookieA } }).then((response) => response.text());
  assert.match(html, /需求对话/);
  assert.match(html, /待补充/);
  assert.match(html, /附件/);
  assert.match(html, /生成候选需求/);
  assert.match(html, /我的需求和进度/);
  assert.doesNotMatch(html, /module-rail/);
  assert.doesNotMatch(html, /data-area-id="requirements"/);

  const empty = await json(`${status.url}/api/v1/projects`, { headers: { cookie: cookieA } });
  assert.deepEqual(empty.payload.projects, []);

  const created = await json(`${status.url}/api/v1/projects`, {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ name: '客户甲项目' }),
  });
  assert.equal(created.response.status, 201);
  const projectId = created.payload.id;

  const listed = await json(`${status.url}/api/v1/projects`, { headers: { cookie: cookieA } });
  assert.deepEqual(listed.payload.projects.map((item) => item.id), [projectId]);

  const loginB = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust-b', password: 'correct-password' }),
  });
  const cookieB = loginB.response.headers.get('set-cookie')?.split(';')[0];
  const listedB = await json(`${status.url}/api/v1/projects`, { headers: { cookie: cookieB } });
  assert.deepEqual(listedB.payload.projects, []);

  const denied = await json(`${status.url}/api/v1/projects/${encodeURIComponent(projectId)}/customer-board`, {
    headers: { cookie: cookieB },
  });
  assert.equal(denied.response.status, 403);

  const session = await json(`${status.url}/api/v1/projects/${encodeURIComponent(projectId)}/intake/sessions`, {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ title: '需求对话' }),
  });
  await json(`${status.url}/api/v1/intake/sessions/${encodeURIComponent(session.payload.id)}/messages`, {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'user', body: '我需要一个登录后只看自己需求的界面' }),
  });

  const boardPayload = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(projectId)}/customer-board`,
    { headers: { cookie: cookieA } },
  );
  assert.equal(boardPayload.response.status, 200);
  assert.equal(boardPayload.payload.sessions[0].messages[0].body, '我需要一个登录后只看自己需求的界面');
  assert.equal(boardPayload.payload.requirements[0].quotes[0], '我需要一个登录后只看自己需求的界面');
  assert.equal(boardPayload.payload.requirements[0].progress, 'waiting_on_customer');
  assert.ok(boardPayload.payload.questions.some((question) => question.status === 'open'));
});
