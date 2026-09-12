import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createPbkdf2PasswordHash, resolveWebAuthConfig } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function services() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-audience-'));
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
    salt: new Uint8Array(16).fill(7),
  });
}

test('auth users default to developer audience and reject unknown audiences', () => {
  const hash = passwordHash();
  const resolved = resolveWebAuthConfig({
    enabled: true,
    users: [{ username: 'dev', passwordHash: hash }],
  });
  assert.equal(resolved.users[0].audience, 'developer');
  assert.throws(
    () =>
      resolveWebAuthConfig({
        enabled: true,
        users: [{ username: 'bad', passwordHash: hash, audience: 'owner' }],
      }),
    /audience must be customer, developer, or admin/,
  );
});

test('login lands on audience shell and denies other shells', async (t) => {
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
          {
            username: 'cust',
            passwordHash: hash,
            audience: 'customer',
          },
          {
            username: 'dev',
            passwordHash: hash,
            audience: 'developer',
          },
          {
            username: 'ops',
            passwordHash: hash,
            audience: 'admin',
          },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();

  const unauthenticatedBoard = await fetch(`${status.url}/`, { redirect: 'manual' });
  assert.equal(unauthenticatedBoard.status, 302);
  assert.equal(unauthenticatedBoard.headers.get('location'), '/login');

  const unauthenticatedDeveloper = await fetch(`${status.url}/developer`, { redirect: 'manual' });
  assert.equal(unauthenticatedDeveloper.status, 302);
  assert.equal(unauthenticatedDeveloper.headers.get('location'), '/login');

  const loginPage = await fetch(`${status.url}/login`);
  assert.equal(loginPage.status, 200);
  const loginHtml = await loginPage.text();
  assert.match(loginHtml, /HuntianLing 登录/);
  assert.doesNotMatch(loginHtml, /id="workspace"/);

  const customerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(customerLogin.response.status, 200);
  assert.equal(customerLogin.payload.principal.audience, 'customer');
  assert.equal(customerLogin.payload.shellPath, '/customer');
  const customerCookie = customerLogin.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(customerCookie);

  const customerHome = await fetch(`${status.url}/`, { headers: { cookie: customerCookie }, redirect: 'manual' });
  assert.equal(customerHome.status, 302);
  assert.equal(customerHome.headers.get('location'), '/customer');

  const customerShell = await fetch(`${status.url}/customer`, { headers: { cookie: customerCookie } });
  assert.equal(customerShell.status, 200);
  assert.match(await customerShell.text(), /客户界面/);

  const deniedDeveloper = await fetch(`${status.url}/developer`, { headers: { cookie: customerCookie } });
  assert.equal(deniedDeveloper.status, 403);
  assert.match(await deniedDeveloper.text(), /不能打开其他人群/);

  const deniedAdmin = await fetch(`${status.url}/admin`, { headers: { cookie: customerCookie } });
  assert.equal(deniedAdmin.status, 403);

  const developerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
    headers: { 'content-type': 'application/json' },
  });
  const developerCookie = developerLogin.response.headers.get('set-cookie')?.split(';')[0];
  assert.equal(developerLogin.payload.shellPath, '/developer');
  const developerShell = await fetch(`${status.url}/developer`, { headers: { cookie: developerCookie } });
  assert.equal(developerShell.status, 200);
  const developerHtml = await developerShell.text();
  assert.match(developerHtml, /data-job="collect"/);
  assert.match(developerHtml, /data-job="design"/);
  assert.match(developerHtml, /data-job="progress"/);
  assert.match(developerHtml, /data-job="channel"/);
  assert.match(developerHtml, /data-job="environment"/);
  assert.doesNotMatch(developerHtml, /module-rail/);

  const adminLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'ops', password: 'correct-password' }),
    headers: { 'content-type': 'application/json' },
  });
  const adminCookie = adminLogin.response.headers.get('set-cookie')?.split(';')[0];
  assert.equal(adminLogin.payload.shellPath, '/admin');
  const adminShell = await fetch(`${status.url}/admin`, { headers: { cookie: adminCookie } });
  assert.equal(adminShell.status, 200);
  const adminHtml = await adminShell.text();
  assert.match(adminHtml, /管理员界面/);
  assert.match(adminHtml, /data-job="users"/);
  assert.doesNotMatch(adminHtml, /module-rail/);
});
