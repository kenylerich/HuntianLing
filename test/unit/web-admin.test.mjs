import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(5),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('admin shell lists users, grants membership, reads audit, and denies developers', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-admin-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '管理项目' });
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
          { username: 'ops', passwordHash: hash, audience: 'admin' },
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer' },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();

  const adminLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'ops', password: 'correct-password' }),
  });
  const adminCookie = adminLogin.response.headers.get('set-cookie')?.split(';')[0];

  const html = await fetch(`${status.url}/admin`, { headers: { cookie: adminCookie } }).then((response) => response.text());
  assert.match(html, /管理员界面/);
  assert.match(html, /data-job="users"/);
  assert.match(html, /data-job="membership"/);
  assert.match(html, /data-job="environment"/);
  assert.match(html, /data-job="access"/);
  assert.match(html, /data-job="audit"/);
  assert.doesNotMatch(html, /module-rail/);
  assert.doesNotMatch(html, /data-job="design"/);

  const users = await json(`${status.url}/api/v1/admin/users`, { headers: { cookie: adminCookie } });
  assert.equal(users.response.status, 200);
  assert.equal(users.payload.users.length, 3);

  const disabled = await json(`${status.url}/api/v1/admin/users/dev/credential`, {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
  assert.equal(disabled.response.status, 200);
  assert.equal(disabled.payload.enabled, false);
  assert.equal(disabled.payload.passwordHash, undefined);
  const blocked = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  assert.equal(blocked.response.status, 403);
  const enabled = await json(`${status.url}/api/v1/admin/users/dev/credential`, {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(enabled.payload.enabled, true);

  const audience = await json(`${status.url}/api/v1/admin/users/cust/audience`, {
    method: 'PATCH',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ audience: 'developer' }),
  });
  assert.equal(audience.payload.users.find((user) => user.username === 'cust').audience, 'developer');

  const grant = await json(`${status.url}/api/v1/admin/users/cust/projects`, {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: project.id }),
  });
  assert.ok(grant.payload.users.find((user) => user.username === 'cust').projectIds.includes(project.id));

  const audit = await json(
    `${status.url}/api/v1/admin/audit?projectId=${encodeURIComponent(project.id)}`,
    { headers: { cookie: adminCookie } },
  );
  assert.ok(audit.payload.auditEvents.some((event) => event.action === 'membership.grant'));

  const access = await json(`${status.url}/api/v1/admin/access`, { headers: { cookie: adminCookie } });
  assert.equal(access.payload.enabled, true);

  const environment = await json(`${status.url}/api/v1/admin/environment`, { headers: { cookie: adminCookie } });
  assert.equal(environment.payload.profile.id, 'huntianling.node-pnpm');

  const devLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const devCookie = devLogin.response.headers.get('set-cookie')?.split(';')[0];
  const denied = await json(`${status.url}/api/v1/admin/users`, { headers: { cookie: devCookie } });
  assert.equal(denied.response.status, 403);
});
