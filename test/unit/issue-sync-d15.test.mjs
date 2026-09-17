import test from 'node:test';
import { attachMockExecutionReceipt } from '../helpers/execution-receipt.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createIssueSyncService } from '../../lib/host/issue-sync/service.js';
import { issueSyncStorePath } from '../../lib/host/issue-sync/store.js';
import { IssueSyncError } from '../../lib/host/issue-sync/types.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(15),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function mockTracker() {
  const issues = new Map();
  let next = 1;
  const calls = [];
  const transport = (request) => {
    calls.push(request);
    if (request.headers.Authorization?.includes('secret-token') || request.headers['PRIVATE-TOKEN'] === 'secret-token') {
      // token is used, never stored
    }
    if (request.method === 'POST' && /\/issues$/.test(request.url)) {
      const body = JSON.parse(request.body || '{}');
      const number = next;
      next += 1;
      const issue = {
        id: 1000 + number,
        iid: number,
        number,
        title: body.title,
        body: body.body ?? body.description ?? '',
        description: body.description ?? body.body ?? '',
        state: 'open',
        html_url: `https://example.test/issues/${number}`,
        web_url: `https://example.test/issues/${number}`,
        updated_at: '2026-01-01T00:00:00Z',
      };
      issues.set(number, issue);
      return { status: 201, body: JSON.stringify(issue) };
    }
    const match = /\/issues\/(\d+)/.exec(request.url);
    const number = match ? Number(match[1]) : NaN;
    const current = issues.get(number);
    if (request.method === 'GET' && current) {
      return { status: 200, body: JSON.stringify(current) };
    }
    if ((request.method === 'PATCH' || request.method === 'PUT') && current) {
      const body = JSON.parse(request.body || '{}');
      if (body.title !== undefined) current.title = body.title;
      if (body.body !== undefined) current.body = body.body;
      if (body.description !== undefined) {
        current.description = body.description;
        current.body = body.description;
      }
      if (body.state === 'closed' || body.state_event === 'close') current.state = 'closed';
      if (body.state === 'open' || body.state_event === 'reopen') current.state = 'open';
      issues.set(number, current);
      return { status: 200, body: JSON.stringify(current) };
    }
    return { status: 500, body: `unexpected ${request.method} ${request.url}` };
  };
  return { transport, issues, calls };
}

function setup(provider = 'github') {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d15-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const mock = mockTracker();
  const issueSync = createIssueSyncService({
    board,
    workspaceRoot: root,
    hosted: mock.transport,
    env: {},
  });
  const apiBaseUrl = provider === 'github'
    ? 'https://api.github.com'
    : provider === 'gitlab'
      ? 'https://gitlab.example/api/v4'
      : 'https://gitea.example/api/v1';
  issueSync.bindTracker({
    projectId: project.id,
    provider,
    owner: 'acme',
    repo: 'app',
    apiBaseUrl,
    actor: 'dev',
  });
  return { root, board, project, issueSync, mock };
}

function story(board, project, extras = {}) {
  return board.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'verifying',
    title: '登录',
    body: '客户能登录',
    analysis: '需要登录',
    design: '表单',
    acceptance: ['可登录'],
    ...extras,
  });
}

function passGates(board, item) {
  board.updateDeliveryEvidenceSummary(item.id, {
    checks: [{
      id: 'ci',
      area: 'ci',
      title: 'tests',
      status: 'passing',
      required: true,
      reason: 'exit 0',
      evidenceIds: ['ci:tests'],
      acceptanceCriterionIds: [],
      links: [{
        kind: 'ci-run',
        id: 'ci:tests',
        label: 'pnpm test',
        url: null,
        acceptanceCriterionIds: [],
      }],
      producer: 'ci',
      executionKind: 'executed',
      designRevision: 'rev-1',
    }],
  });
  attachMockExecutionReceipt(board, item.id);
}

test('adapters for GitHub Issues, Gitea Issues, and GitLab Issues are available where configured', () => {
  const { issueSync } = setup();
  assert.deepEqual(issueSync.listProviders(), ['github', 'gitea', 'gitlab']);
  for (const provider of ['github', 'gitea', 'gitlab']) {
    const env = setup(provider);
    const item = story(env.board, env.project);
    const exported = env.issueSync.exportWorkItem({ workItemId: item.id, token: 'secret-token', actor: 'dev' });
    assert.equal(exported.reference.provider, provider);
    assert.ok(exported.reference.url.includes('/issues/'));
    assert.equal(exported.issue.state, 'open');
  }
});

test('external issues map to internal WorkItems through stored external references', () => {
  const { board, project, issueSync, root } = setup();
  const item = story(board, project);
  const exported = issueSync.exportWorkItem({ workItemId: item.id, token: 'secret-token', actor: 'dev' });
  assert.equal(issueSync.getReference(item.id)?.externalNumber, exported.issue.number);
  assert.equal(issueSync.listReferences(project.id).length, 1);
  const stored = JSON.parse(readFileSync(issueSyncStorePath(root), 'utf8'));
  assert.equal(stored.references[0].workItemId, item.id);
  assert.doesNotMatch(JSON.stringify(stored), /secret-token/);
});

test('internal parent-child hierarchy, milestones, acceptance coverage, agent feedback, and evidence stay owned even when the tracker lacks those concepts', () => {
  const { board, project, issueSync } = setup();
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const parent = board.createWorkItem({
    projectId: project.id,
    type: 'feature',
    title: '账户',
    body: '账户能力',
    acceptance: ['有账户'],
  });
  const child = story(board, project, {
    parentId: parent.id,
    milestoneId: milestone.id,
    evidence: ['local-check'],
  });
  issueSync.exportWorkItem({ workItemId: child.id, token: 'secret-token', actor: 'dev' });
  const imported = issueSync.importIssue({
    projectId: project.id,
    workItemId: child.id,
    snapshot: {
      number: 1,
      externalId: '1',
      url: 'https://example.test/issues/1',
      title: '外部标题',
      body: '外部正文\nparent: should-not-apply',
      state: 'open',
      updatedAt: '2026-01-02T00:00:00Z',
    },
    actor: 'dev',
  });
  const updated = board.getWorkItem(imported.workItemId);
  assert.equal(updated.title, '外部标题');
  assert.equal(updated.parentId, parent.id);
  assert.equal(updated.milestoneId, milestone.id);
  assert.deepEqual(updated.acceptance, ['可登录']);
  assert.deepEqual(updated.evidence, ['local-check']);
  assert.equal(updated.status, 'verifying');
  const ownership = issueSync.fieldOwnership();
  assert.deepEqual(ownership.synchronized, ['title', 'body', 'state']);
  assert.ok(ownership.owned.includes('parentId'));
  assert.ok(ownership.owned.includes('milestoneId'));
  assert.ok(ownership.owned.includes('acceptance'));
  assert.ok(ownership.owned.includes('agentFeedback'));
  assert.ok(ownership.owned.includes('evidence'));
});

test('import, export, and sync conflict reporting are available', () => {
  const { board, project, issueSync, mock } = setup();
  const created = issueSync.importIssue({
    projectId: project.id,
    snapshot: {
      number: 9,
      externalId: '9',
      url: 'https://example.test/issues/9',
      title: '导入卡片',
      body: '外部描述',
      state: 'open',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    actor: 'dev',
  });
  mock.issues.set(9, {
    id: 9,
    iid: 9,
    number: 9,
    title: '导入卡片',
    body: '外部描述',
    description: '外部描述',
    state: 'open',
    html_url: 'https://example.test/issues/9',
    web_url: 'https://example.test/issues/9',
    updated_at: '2026-01-01T00:00:00Z',
  });
  const item = board.getWorkItem(created.workItemId);
  assert.equal(item.title, '导入卡片');
  issueSync.exportWorkItem({ workItemId: item.id, token: 'secret-token', actor: 'dev' });
  board.updateWorkItem(item.id, { title: '内部新标题' });
  const remote = mock.issues.get(created.reference.externalNumber);
  remote.title = '外部新标题';
  mock.issues.set(created.reference.externalNumber, remote);
  const report = issueSync.sync(project.id, 'secret-token');
  assert.ok(report.conflicts.some((row) => row.field === 'title'));
  assert.equal(issueSync.conflicts(project.id).length >= 1, true);
});

test('externally synchronized fields and internally owned fields are marked', () => {
  const { issueSync } = setup();
  const ownership = issueSync.fieldOwnership();
  assert.deepEqual([...ownership.synchronized].sort(), ['body', 'state', 'title']);
  assert.deepEqual([...ownership.owned].sort(), [
    'acceptance',
    'agentFeedback',
    'evidence',
    'milestoneId',
    'parentId',
    'status',
  ]);
});

test('projects run with no issue tracker integration', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d15-none-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'solo' });
  const issueSync = createIssueSyncService({ board, workspaceRoot: root, hosted: mockTracker().transport, env: {} });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '无 tracker',
    body: '本地即可',
    acceptance: ['可跑'],
  });
  assert.equal(item.title, '无 tracker');
  assert.equal(issueSync.listTrackers(project.id).length, 0);
  assert.throws(
    () => issueSync.exportWorkItem({ workItemId: item.id, token: 'secret-token', actor: 'dev' }),
    (error) => error instanceof IssueSyncError && error.code === 'NOT_READY',
  );
});

test('an external completed close is a recovery event unless internal delivery evidence and the gate result have been published onto the external card', () => {
  const { board, project, issueSync, mock } = setup();
  const item = story(board, project);
  const exported = issueSync.exportWorkItem({ workItemId: item.id, token: 'secret-token', actor: 'dev' });
  const remote = mock.issues.get(exported.issue.number);
  remote.state = 'closed';
  mock.issues.set(exported.issue.number, remote);
  const recovered = issueSync.ingestClose(item.id, 'dev', 'secret-token');
  assert.equal(recovered.kind, 'recovery');
  assert.equal(recovered.reopened, true);
  assert.equal(recovered.workItemStatusUnchanged, true);
  assert.equal(board.getWorkItem(item.id).status, 'verifying');
  assert.equal(mock.issues.get(exported.issue.number).state, 'open');

  passGates(board, item);
  const published = issueSync.publishGate(item.id, 'dev', 'secret-token');
  assert.ok(published.gatePublishedAt);
  assert.match(mock.issues.get(exported.issue.number).body, /huntianling-delivery-gate/);
  mock.issues.get(exported.issue.number).state = 'closed';
  const accepted = issueSync.ingestClose(item.id, 'dev', 'secret-token');
  assert.equal(accepted.kind, 'accepted-close');
  assert.equal(accepted.reopened, false);
  assert.equal(board.getWorkItem(item.id).status, 'verifying');
});

test('customers cannot bind trackers or export WorkItems', async (t) => {
  const { board, project, issueSync } = setup();
  const item = story(board, project);
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), issueSync },
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
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const deniedBind = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/issue-trackers`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'github', owner: 'acme', repo: 'app' }),
    },
  );
  assert.equal(deniedBind.response.status, 403);
  const deniedExport = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(item.id)}/issue-sync/export`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'secret-token' }),
    },
  );
  assert.equal(deniedExport.response.status, 403);
  const catalog = await json(`${status.url}/api/v1/issue-sync/catalog`, { headers: { cookie } });
  assert.equal(catalog.response.status, 200);
  assert.deepEqual(catalog.payload.providers, ['github', 'gitea', 'gitlab']);
});
