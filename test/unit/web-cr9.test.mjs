import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDatabaseService } from '../../lib/host/database/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(9),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function setupWeb(t, extras = {}) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr9-'));
  const database = extras.database ?? createDatabaseService({ workspaceRoot: root });
  const board = extras.board ?? createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements, database },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'ops', passwordHash: hash, audience: 'admin' },
          { username: 'cust', passwordHash: hash, audience: 'customer' },
        ],
      },
    },
  );
  t.after(() => {
    web.stop();
    database.close();
  });
  return { root, board, database, web, hash };
}

test('a caller lists versioned agent, skill, tool, SCM, and CI catalogs', async (t) => {
  const { web } = setupWeb(t);
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const agents = await json(`${status.url}/api/v1/agents`, { headers: { cookie } });
  assert.equal(agents.response.status, 200);
  assert.ok(agents.payload.agents.some((item) => item.id === 'planner'));
  const skills = await json(`${status.url}/api/v1/skills`, { headers: { cookie } });
  assert.ok(skills.payload.skills.length > 0);
  const tools = await json(`${status.url}/api/v1/tools`, { headers: { cookie } });
  assert.ok(tools.payload.tools.length > 0);
  const scm = await json(`${status.url}/api/v1/scm/catalog`, { headers: { cookie } });
  assert.deepEqual(scm.payload.providers, ['local', 'github', 'gitea', 'gitlab']);
  const ci = await json(`${status.url}/api/v1/ci/catalog`, { headers: { cookie } });
  assert.ok(ci.payload.providers.includes('github-actions'));
});

test('a project name and description can be updated and archived then restored', async (t) => {
  const { web, board } = setupWeb(t);
  const project = board.createProject({ name: '原名', description: '旧描述' });
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const updated = await json(`${status.url}/api/v1/projects/${project.id}`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: '新名', description: '新描述' }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.name, '新名');
  const archived = await json(`${status.url}/api/v1/projects/${project.id}/archive`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(typeof archived.payload.archivedAt, 'number');
  const listed = await json(`${status.url}/api/v1/projects`, { headers: { cookie } });
  assert.equal(listed.payload.projects.some((item) => item.id === project.id), false);
  const restored = await json(`${status.url}/api/v1/projects/${project.id}/restore`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(restored.payload.archivedAt, null);
});

test('a WorkItem can be created, transitioned, archived, and restored through versioned v1 APIs', async (t) => {
  const { web, board } = setupWeb(t);
  const project = board.createProject({ name: 'p' });
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const created = await json(`${status.url}/api/v1/work-items`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: project.id,
      type: 'story',
      title: '登录',
      body: '客户能登录',
      acceptance: ['可登录'],
    }),
  });
  assert.equal(created.response.status, 201);
  const moved = await json(`${status.url}/api/v1/work-items/${created.payload.id}/status`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ to: 'triaged' }),
  });
  assert.equal(moved.payload.status, 'triaged');
  const archived = await json(`${status.url}/api/v1/work-items/${created.payload.id}/archive`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(typeof archived.payload.archivedAt, 'number');
  assert.equal(board.listWorkItems({ projectId: project.id }).some((item) => item.id === created.payload.id), false);
  const restored = await json(`${status.url}/api/v1/work-items/${created.payload.id}/restore`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(restored.payload.archivedAt, null);
  assert.equal(board.listWorkItems({ projectId: project.id }).some((item) => item.id === created.payload.id), true);
});

test('an admin creates a user that still exists after the process reloads the directory', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr9-users-'));
  const hash = passwordHash();
  const auth = {
    enabled: true,
    sessionTtlMs: 60_000,
    users: [{ username: 'ops', passwordHash: hash, audience: 'admin' }],
  };
  const firstDb = createDatabaseService({ workspaceRoot: root });
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const first = createWebService({ board, requirements, database: firstDb }, {
    autoStart: false,
    host: '127.0.0.1',
    port: 0,
    auth,
  });
  t.after(() => first.stop());
  const status = await first.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'ops', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const created = await json(`${status.url}/api/v1/admin/users`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'newdev', password: 'correct-password', audience: 'developer' }),
  });
  assert.equal(created.response.status, 201);
  first.stop();
  const secondDb = createDatabaseService({ workspaceRoot: root });
  const second = createWebService({ board, requirements, database: secondDb }, {
    autoStart: false,
    host: '127.0.0.1',
    port: 0,
    auth,
  });
  t.after(() => {
    second.stop();
    secondDb.close();
  });
  const again = await second.start();
  const adminLogin = await json(`${again.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'ops', password: 'correct-password' }),
  });
  const adminCookie = adminLogin.response.headers.get('set-cookie')?.split(';')[0];
  const users = await json(`${again.url}/api/v1/admin/users`, { headers: { cookie: adminCookie } });
  assert.ok(users.payload.users.some((user) => user.username === 'newdev'));
  const newLogin = await json(`${again.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'newdev', password: 'correct-password' }),
  });
  assert.equal(newLogin.response.status, 200);
});

test('login, failed login, and logout write auth audit events', async (t) => {
  const { web } = setupWeb(t);
  const status = await web.start();
  await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'ops', password: 'wrong-password' }),
  });
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'ops', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  await json(`${status.url}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const again = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'ops', password: 'correct-password' }),
  });
  const adminCookie = again.response.headers.get('set-cookie')?.split(';')[0];
  const events = await json(`${status.url}/api/v1/admin/auth-events`, { headers: { cookie: adminCookie } });
  const actions = events.payload.events.map((event) => event.action);
  assert.ok(actions.includes('auth.login_failed'));
  assert.ok(actions.includes('auth.login'));
  assert.ok(actions.includes('auth.logout'));
});

test('moving a child WorkItem between Milestones updates the parent plan and audit log', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr9-plan-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const first = board.createMilestone({ projectId: project.id, title: 'M1' });
  const second = board.createMilestone({ projectId: project.id, title: 'M2' });
  const parent = board.createWorkItem({
    projectId: project.id,
    type: 'feature',
    title: '父需求',
    body: '跨里程碑',
    acceptance: ['交付'],
  });
  const child = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '切片',
    body: '第一段',
    parentId: parent.id,
    milestoneId: first.id,
    acceptance: ['可登录'],
  });
  board.assignWorkItemToMilestone(child.id, second.id);
  const events = board.listAuditEvents({ projectId: project.id, action: 'parent_plan.updated' });
  assert.equal(events.length, 1);
  assert.equal(events[0].targetId, parent.id);
  assert.match(events[0].reason, new RegExp(child.id));
});

test('customers cannot manage the user directory or archive projects', async (t) => {
  const { web, board } = setupWeb(t);
  const project = board.createProject({ name: 'p' });
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const users = await json(`${status.url}/api/v1/admin/users`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'x', password: 'y', audience: 'developer' }),
  });
  assert.equal(users.response.status, 403);
  const archived = await json(`${status.url}/api/v1/projects/${project.id}/archive`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(archived.response.status, 403);
  const catalogs = await json(`${status.url}/api/v1/agents`, { headers: { cookie } });
  assert.equal(catalogs.response.status, 403);
});
