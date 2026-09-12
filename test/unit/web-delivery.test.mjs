import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDeliveryService } from '../../lib/host/delivery/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(6),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('developer can start pause resume and cancel a Story delivery run', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-delivery-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '交付项目' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '客户能登录',
    body: '用账号登录系统。',
    analysis: '需要登录入口。',
    design: '账号密码表单。',
    acceptance: ['customer can log in'],
    sourceInput: '我要登录',
    milestoneId: milestone.id,
  });
  const hash = passwordHash();
  const skills = createSkillService();
  const agents = createAgentRuntime({ skills, board });
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const web = createWebService(
    { board, requirements, agents, delivery },
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
  const denied = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/story-delivery/start`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ environmentReady: true }),
  });
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];

  const started = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/story-delivery/start`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ environmentReady: true }),
  });
  assert.equal(started.response.status, 201);
  const runId = started.payload.id;

  const advanced = await json(`${status.url}/api/v1/story-delivery-runs/${encodeURIComponent(runId)}/advance`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(advanced.response.status, 200);
  assert.deepEqual(advanced.payload.checkpoint.completedSteps, ['plan']);

  const paused = await json(`${status.url}/api/v1/story-delivery-runs/${encodeURIComponent(runId)}/pause`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'wait for review' }),
  });
  assert.equal(paused.payload.status, 'paused');

  const resumed = await json(`${status.url}/api/v1/story-delivery-runs/${encodeURIComponent(runId)}/resume`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(resumed.payload.status, 'running');

  const driven = await json(`${status.url}/api/v1/story-delivery-runs/${encodeURIComponent(runId)}/advance`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.ok(driven.payload.checkpoint.completedSteps.includes('implement'));

  const cancelled = await json(`${status.url}/api/v1/story-delivery-runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'stop' }),
  });
  assert.equal(cancelled.payload.status, 'cancelled');

  const boardPayload = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/developer-board`,
    { headers: { cookie } },
  );
  const progress = boardPayload.payload.progress.items.find((item) => item.id === story.id);
  assert.equal(progress.deliveryRun.status, 'cancelled');

  const html = await fetch(`${status.url}/developer`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /交付运行/);
  assert.match(html, /开始交付运行/);
});
