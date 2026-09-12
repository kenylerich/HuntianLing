import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { createHarnessService } from '../../lib/host/harness/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(7),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('developer can compare skill depth and run the self-development demonstration', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-harness-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const skills = createSkillService();
  const environment = createEnvironmentService({ skills, board });
  const agents = createAgentRuntime({ skills, board });
  const harness = createHarnessService({ skills, workspaceRoot: root, board, agents, environment });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements, agents, environment, harness },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
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
  const denied = await json(`${status.url}/api/v1/harness/comparisons`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];

  const html = await fetch(`${status.url}/developer`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /比较 Skill 深度/);
  assert.match(html, /自身开发演示/);

  const compared = await json(`${status.url}/api/v1/harness/comparisons`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(compared.response.status, 201);
  assert.equal(compared.payload.meetsThreshold, true);

  const promoted = await json(
    `${status.url}/api/v1/harness/comparisons/${encodeURIComponent(compared.payload.id)}/promote`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(promoted.payload.promoted, true);

  const demo = await json(`${status.url}/api/v1/harness/demonstrations`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(demo.response.status, 201);
  assert.equal(demo.payload.customerProgress, 'delivered');
  assert.equal(demo.payload.gates.lint, 'blocked');
});
