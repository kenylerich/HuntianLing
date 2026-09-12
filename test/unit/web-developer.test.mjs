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
    salt: new Uint8Array(16).fill(4),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('developer shell restacks five jobs and keeps fused board at /board', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-developer-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '开发项目' });
  const story = board.createWorkItem({
    projectId: project.id,
    title: '登录壳',
    body: '开发者设计需求',
    analysis: '需要独立开发界面',
    design: '五项工作',
    type: 'story',
    acceptance: ['可以编辑分析'],
  });
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
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer' },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];

  const html = await fetch(`${status.url}/developer`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /收集/);
  assert.match(html, /设计/);
  assert.match(html, /进度/);
  assert.match(html, /频道/);
  assert.match(html, /环境/);
  assert.match(html, /Agent 反馈/);
  assert.match(html, /缺输入/);
  assert.match(html, /起草 Skill/);
  assert.match(html, /资源租约/);
  assert.match(html, /按策略调度/);
  assert.match(html, /接受反馈/);
  assert.match(html, /代码/);
  assert.match(html, /证据/);
  assert.match(html, /交付运行/);
  assert.match(html, /比较 Skill 深度/);
  assert.match(html, /权限边界/);
  assert.match(html, /代码视图/);
  assert.doesNotMatch(html, /module-rail/);
  assert.doesNotMatch(html, /data-area-id="requirements"/);

  const channelHtml = await fetch(`${status.url}/developer/channel`, { headers: { cookie } }).then((response) =>
    response.text(),
  );
  assert.match(channelHtml, /data-job="channel"/);

  const fused = await fetch(`${status.url}/board`, { headers: { cookie } }).then((response) => response.text());
  assert.match(fused, /id="workspace"/);

  const boardPayload = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/developer-board`,
    { headers: { cookie } },
  );
  assert.deepEqual(boardPayload.payload.jobs, ['collect', 'design', 'progress', 'channel', 'environment']);
  assert.equal(boardPayload.payload.design.items[0].analysis, '需要独立开发界面');

  const patched = await json(`${status.url}/api/work-items/${encodeURIComponent(story.id)}`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ analysis: '已更新分析' }),
  });
  assert.equal(patched.payload.analysis, '已更新分析');

  const env = await json(`${status.url}/api/v1/environment/prepare`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceRoot: root }),
  });
  assert.equal(env.response.status, 200);
  assert.equal(typeof env.payload.ready, 'boolean');

  const customerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const customerCookie = customerLogin.response.headers.get('set-cookie')?.split(';')[0];
  const denied = await json(`${status.url}/api/v1/environment/prepare`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(denied.response.status, 403);
});
