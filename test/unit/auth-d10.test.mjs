import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDatabaseService } from '../../lib/host/database/service.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { inferRegionFromHost } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(21),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function authConfig(users = []) {
  return {
    enabled: true,
    sessionTtlMs: 60_000,
    regionMode: 'auto',
    users,
    providers: {
      cn: [{ id: 'wechat', label: 'WeChat', clientId: 'wx-app', clientSecret: 'wx-secret' }],
      global: [
        { id: 'google', label: 'Google', kind: 'oidc', clientId: 'google-client', clientSecret: 'google-secret' },
        { id: 'github', label: 'GitHub', clientId: 'gh-client', clientSecret: 'gh-secret' },
      ],
    },
  };
}

test('login routes by domain to cn or global without relying only on IP', async (t) => {
  assert.equal(inferRegionFromHost('board.example.cn', { cn: [], global: [] }), 'cn');
  assert.equal(inferRegionFromHost('board.example.com', { cn: [], global: [] }), 'global');
  const board = createBoardService(mkdtempSync(join(tmpdir(), 'huntianling-d10-')));
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
    { autoStart: false, host: '127.0.0.1', port: 0, auth: authConfig() },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const cn = await json(`${status.url}/api/auth/providers`, { headers: { 'x-forwarded-host': 'board.example.cn' } });
  assert.equal(cn.payload.region, 'cn');
  assert.equal(cn.payload.providers[0].id, 'wechat');
  const global = await json(`${status.url}/api/auth/providers`, { headers: { 'x-forwarded-host': 'board.example.com' } });
  assert.equal(global.payload.region, 'global');
  assert.ok(global.payload.providers.some((item) => item.id === 'google'));
});

test('users can manually switch login region when routing is ambiguous', async (t) => {
  const board = createBoardService(mkdtempSync(join(tmpdir(), 'huntianling-d10-')));
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
    { autoStart: false, host: '127.0.0.1', port: 0, auth: authConfig() },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const auto = await json(`${status.url}/api/auth/providers`);
  assert.equal(auto.payload.region, 'global');
  const switched = await json(`${status.url}/api/auth/providers?region=cn`);
  assert.equal(switched.payload.region, 'cn');
  assert.equal(switched.payload.providers[0].id, 'wechat');
});

test('login events record the region used', async (t) => {
  const board = createBoardService(mkdtempSync(join(tmpdir(), 'huntianling-d10-')));
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: authConfig([{ username: 'dev', passwordHash: hash, audience: 'admin', region: 'global' }]),
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password', region: 'global' }),
  });
  assert.equal(login.response.status, 200);
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const events = await json(`${status.url}/api/v1/admin/auth-events`, { headers: { cookie } });
  assert.equal(events.response.status, 200);
  const loginEvent = events.payload.events.find((item) => item.action === 'auth.login');
  assert.equal(loginEvent.region, 'global');
  assert.equal(login.payload.session.region, 'global');
});

test('Google, GitHub, and WeChat appear as regional OAuth/OIDC providers', async (t) => {
  const board = createBoardService(mkdtempSync(join(tmpdir(), 'huntianling-d10-')));
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board) },
    { autoStart: false, host: '127.0.0.1', port: 0, auth: authConfig() },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const global = await json(`${status.url}/api/auth/providers?region=global`);
  assert.deepEqual(global.payload.providers.map((item) => item.id), ['google', 'github']);
  assert.equal(global.payload.providers.find((item) => item.id === 'google').kind, 'oidc');
  assert.equal(global.payload.providers.find((item) => item.id === 'github').kind, 'oauth');
  const cn = await json(`${status.url}/api/auth/providers?region=cn`);
  assert.equal(cn.payload.providers[0].id, 'wechat');
  assert.equal(cn.payload.providers[0].kind, 'oauth');
});

test('OAuth start and callback bind a provider identity with state and PKCE where supported', async (t) => {
  const board = createBoardService(mkdtempSync(join(tmpdir(), 'huntianling-d10-')));
  const exchange = {
    async exchange(input) {
      assert.equal(input.clientSecret, 'gh-secret');
      assert.ok(input.codeVerifier);
      return { subject: 'gh-99', unionid: null, email: 'dev@example.com', profile: { name: 'Dev' } };
    },
  };
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), oauthExchange: exchange },
    { autoStart: false, host: '127.0.0.1', port: 0, auth: authConfig() },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const started = await fetch(`${status.url}/api/auth/oauth/github/start?region=global`, { redirect: 'manual' });
  assert.equal(started.status, 302);
  const location = started.headers.get('location');
  assert.match(location, /github.com\/login\/oauth\/authorize/);
  assert.match(location, /code_challenge=/);
  assert.match(location, /state=/);
  const payload = await started.json();
  const callback = await json(
    `${status.url}/api/auth/oauth/github/callback?code=ok&state=${encodeURIComponent(payload.state)}`,
  );
  assert.equal(callback.response.status, 200);
  assert.equal(callback.payload.identity.provider, 'github');
  assert.equal(callback.payload.identity.subject, 'gh-99');
  assert.equal(callback.payload.principal.username, 'dev@example.com');
});

test('one user can unlink a bound provider', async (t) => {
  const board = createBoardService(mkdtempSync(join(tmpdir(), 'huntianling-d10-')));
  const exchange = {
    async exchange() {
      return { subject: 'gh-99', unionid: null, email: 'dev@example.com', profile: { name: 'Dev' } };
    },
  };
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), oauthExchange: exchange },
    { autoStart: false, host: '127.0.0.1', port: 0, auth: authConfig() },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const started = await fetch(`${status.url}/api/auth/oauth/github/start?region=global`, { redirect: 'manual' });
  const payload = await started.json();
  const callback = await json(
    `${status.url}/api/auth/oauth/github/callback?code=ok&state=${encodeURIComponent(payload.state)}`,
  );
  const cookie = callback.response.headers.get('set-cookie')?.split(';')[0];
  const unlinked = await json(`${status.url}/api/auth/oauth/github/unlink`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(unlinked.response.status, 200);
  assert.equal(unlinked.payload.provider, 'github');
});

test('OAuth secrets are not stored in board records', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d10-'));
  const board = createBoardService(root);
  const database = createDatabaseService({ workspaceRoot: root });
  const exchange = {
    async exchange() {
      return { subject: 'gh-99', unionid: null, email: 'dev@example.com', profile: { name: 'Dev' } };
    },
  };
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), database, oauthExchange: exchange },
    { autoStart: false, host: '127.0.0.1', port: 0, auth: authConfig() },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const started = await fetch(`${status.url}/api/auth/oauth/github/start?region=global`, { redirect: 'manual' });
  const payload = await started.json();
  await json(`${status.url}/api/auth/oauth/github/callback?code=ok&state=${encodeURIComponent(payload.state)}`);
  const providers = await json(`${status.url}/api/auth/providers?region=global`);
  assert.equal(providers.payload.providers[0].clientSecret, undefined);
  assert.equal(providers.payload.providers[0].loginUrl.includes('gh-secret'), false);
  const boardPath = join(root, '.huntianling', 'board.json');
  const dump = existsSync(boardPath) ? readFileSync(boardPath, 'utf8') : JSON.stringify(board.listProjects());
  assert.equal(dump.includes('gh-secret'), false);
  assert.equal(dump.includes('google-secret'), false);
  assert.equal(dump.includes('wx-secret'), false);
});
