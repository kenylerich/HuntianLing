import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import huntianling from '../lib/host/plugin.js';
import { createPbkdf2PasswordHash } from '../lib/host/web/auth.js';
import { workItemDesignRevision } from '../lib/host/board/executed-evidence.js';

// Production composition and HTTP only; no model, CI, or OAuth substitutes.
const root = mkdtempSync(join(tmpdir(), 'huntianling-customer-e2e-'));
const password = 'Isolated-acceptance-only!';
const passwordHash = createPbkdf2PasswordHash(password);
const ctx = new Context();
const results = [];
const fiber = ctx.plugin(huntianling, {
  workspaceRoot: root,
  web: {
    host: '127.0.0.1', port: 0, autoStart: false,
    auth: { enabled: true, users: [
      { username: 'customer-a', audience: 'customer', passwordHash },
      { username: 'customer-b', audience: 'customer', passwordHash },
      { username: 'developer', audience: 'developer', passwordHash },
      { username: 'admin', audience: 'admin', passwordHash },
    ] },
  },
});

async function check(id, reqs, run) {
  try {
    const detail = await run();
    results.push({ id, reqs, result: 'pass', detail });
  } catch (error) {
    results.push({ id, reqs, result: 'fail', detail: error.message });
  }
}

try {
  await fiber;
  // Root activation alone does not await the services registered by children.
  for (const runtime of ctx.registry.values()) {
    for (const child of runtime.fibers) await child.await();
  }
  const web = ctx.get('huntianling.web');
  assert.ok(web, 'Web service must register in the production composition');
  const { url } = await web.start();
  async function request(path, cookie = '', method = 'GET', body) {
    const response = await fetch(url + path, {
      method, redirect: 'manual', signal: AbortSignal.timeout(30_000),
      headers: { cookie, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { data = text; } // HTML responses are retained as text.
    return { status: response.status, headers: response.headers, data };
  }
  async function ok(path, cookie, method = 'GET', body) {
    const response = await request(path, cookie, method, body);
    assert.ok(response.status >= 200 && response.status < 300,
      `${method} ${path}: ${response.status} ${JSON.stringify(response.data)}`);
    return response.data;
  }
  async function login(username) {
    const response = await request('/api/auth/password/login', '', 'POST', { username, password });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  const customer = await login('customer-a');
  const other = await login('customer-b');
  const developer = await login('developer');
  const admin = await login('admin');
  await check('unauthenticated-and-role-access', ['REQ-AUTH-001', 'REQ-WEB-007'], async () => {
    assert.equal((await request('/')).status, 302);
    assert.equal((await request('/api/v1/projects')).status, 401);
    assert.equal((await request('/developer', customer)).status, 403);
    assert.equal((await request('/api/v1/admin/users', developer)).status, 403);
    assert.ok((await ok('/api/v1/admin/users', admin)).users.length >= 4);
  });
  const project = await ok('/api/v1/projects', customer, 'POST', { name: 'Customer acceptance' });
  const projectPath = `/api/v1/projects/${project.id}`;
  await check('customer-project-isolation', ['REQ-AUTH-001', 'REQ-WEB-007'], async () => {
    assert.equal((await ok('/api/v1/projects', other)).projects.length, 0);
    assert.equal((await request(`${projectPath}/customer-board`, other)).status, 403);
    assert.equal((await ok('/api/v1/projects', customer)).projects[0].id, project.id);
  });
  await check('customer-cannot-read-developer-records', ['REQ-WEB-007'], async () => {
    const response = await request(`${projectPath}/developer-board`, customer);
    assert.equal(response.status, 403,
      `Customer got ${response.status}; returned fields: ${Object.keys(response.data).join(', ')}`);
  });
  const session = await ok(`${projectPath}/intake/sessions`, customer, 'POST', { title: 'Cancel order' });
  const sessionPath = `/api/v1/intake/sessions/${session.id}`;
  await check('intake-chat-and-plain-attachments', ['REQ-INTAKE-001', 'REQ-INTAKE-002'], async () => {
    const body = 'As an order customer I need to cancel an unshipped order and release its stock.';
    await ok(`${sessionPath}/messages`, customer, 'POST', { role: 'user', body });
    for (const [kind, name] of [['markdown', 'idea.md'], ['plain-text', 'idea.txt']]) {
      const content = 'Shipped orders must reject cancellation.';
      await ok(`${sessionPath}/source-documents`, customer, 'POST', {
        kind, name, mimeType: 'text/plain', contentBase64: Buffer.from(content).toString('base64'),
      });
    }
    const bundle = await ok(sessionPath, customer);
    assert.ok(bundle.messages.some(message => message.body === body));
    assert.equal(bundle.sourceDocuments.length, 2);
    assert.ok(bundle.sourceDocuments.every(source => source.parseStatus === 'parsed'));
  });
  await check('candidate-approval-and-hierarchy', ['REQ-BOARD-004', 'REQ-INTAKE-003'], async () => {
    await ok(`${sessionPath}/analyze`, developer, 'POST', {});
    const before = await ok(`${sessionPath}/candidates`, developer);
    assert.ok(before.candidates.length > 0);
    await ok(`${sessionPath}/approve`, developer, 'POST', {});
    const after = await ok(`${sessionPath}/candidates`, developer);
    assert.ok(after.candidates.every(candidate => candidate.status === 'approved'));
    const { workItems } = await ok(`/api/work-items?projectId=${project.id}`, developer);
    const story = workItems.find(item => item.type === 'story');
    const feature = workItems.find(item => item.id === story.parentId);
    assert.equal(feature.type, 'feature');
    assert.equal(workItems.find(item => item.id === feature.parentId).type, 'epic');
    assert.ok(workItems.some(item => item.type === 'task' && item.parentId === story.id));
  });
  await check('milestone-create-and-list', ['REQ-MILESTONE-002'], async () => {
    const milestone = await ok('/api/milestones', developer, 'POST', { projectId: project.id, title: 'First release' });
    const listed = await ok(`/api/milestones?projectId=${project.id}`, developer);
    assert.ok(listed.milestones.some(item => item.id === milestone.id));
  });
  await check('project-business-projections', ['REQ-BOARD-003', 'REQ-WEB-006'], async () => {
    for (const suffix of ['main-board', 'main-board/team', 'main-board/workflow', 'main-board/evidence',
      'story-queue', 'business-crud', 'team/members']) {
      const projection = await ok(`${projectPath}/${suffix}`, developer);
      assert.ok(projection && typeof projection === 'object', suffix);
    }
  });
  await check('workflow-static-canvas', ['REQ-FLOW-006', 'REQ-FLOW-016'], async () => {
    const canvas = await ok('/api/v1/workflow-templates/huntianling.user-story/canvas', developer);
    assert.ok(canvas.nodes.length > 0);
    assert.ok(canvas.edges.length > 0);
  });
  const milestones = await ok(`/api/milestones?projectId=${project.id}`, developer);
  const item = await ok('/api/v1/work-items', developer, 'POST', {
    projectId: project.id, type: 'story', status: 'verifying', title: 'Evidence negative control',
    milestoneId: milestones.milestones[0].id,
    body: 'Reject delivery when no independent acceptance command has run.',
    sourceInput: 'Verify actual customer behavior', analysis: 'Reject simulated evidence',
    design: 'Require independent execution', acceptance: ['A broken application cannot be delivered'],
  });
  const itemPath = `/api/v1/work-items/${item.id}`;
  await check('missing-evidence-blocks-delivery', ['REQ-EVIDENCE-001'], async () => {
    const response = await request(`${itemPath}/status`, developer, 'POST', { to: 'delivered' });
    assert.ok(response.status >= 400, `Unexpected delivery status ${response.status}`);
    assert.match(response.data.error, /evidence|executed/i);
  });
  await check('unprepared-story-is-blocked', ['REQ-HARNESS-001'], async () => {
    const run = await ok(`${itemPath}/story-delivery/start`, developer, 'POST', { drive: true });
    assert.equal(run.status, 'blocked');
  });
  await check('manual-ci-prefix-cannot-deliver', ['REQ-HARNESS-003', 'REQ-EVIDENCE-001'], async () => {
    const revision = workItemDesignRevision(item);
    await ok(`${itemPath}/delivery-evidence`, developer, 'PATCH', {
      designRevision: revision,
      checks: [{ id: 'unexecuted-ci', area: 'ci', title: 'No command was executed',
        status: 'passing', required: true, evidenceIds: ['ci:never-executed'], links: [],
        acceptanceCriterionIds: [], producer: 'ci', executionKind: 'executed', designRevision: revision }],
    });
    const response = await request(`${itemPath}/status`, developer, 'POST', { to: 'delivered' });
    assert.ok(response.status >= 400,
      `Forged evidence accepted: HTTP ${response.status}, state ${response.data.status}`);
    return { status: response.status, response: response.data,
      evidence: await ok(`${itemPath}/delivery-evidence`, developer) };
  });
  await check('session-logout-revokes-access', ['REQ-AUTH-001'], async () => {
    await ok('/api/auth/logout', customer, 'POST', {});
    assert.equal((await request('/api/v1/projects', customer)).status, 401);
  });
  await check('production-local-ci-executes-commands', ['REQ-CI-001'], async () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: {
      typecheck: 'node -e "require(\'node:fs\').writeFileSync(\'typecheck-ran\',\'yes\')"',
      test: 'node -e "require(\'node:fs\').writeFileSync(\'test-ran\',\'yes\')"',
    } }));
    const evidence = await ok(`${itemPath}/ci/run`, developer, 'POST', {});
    assert.ok(existsSync(join(root, 'typecheck-ran')) && existsSync(join(root, 'test-ran')),
      `Local commands did not run: ${evidence.checks.map(check => `${check.title}: ${check.status} (${check.reason})`).join('; ')}`);
  });
} finally {
  try { await fiber.dispose(); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

console.log(JSON.stringify({
  suite: 'customer-http-acceptance',
  result: results.some(result => result.result === 'fail') ? 'fail' : 'pass',
  results,
  notVerified: ['live dsh agents', 'OAuth exchanges', 'hosted SCM/CI', 'PostgreSQL',
    'browser interactions (separate Playwright review)', 'all backlog acceptance criteria'],
}, null, 2));
process.exitCode = results.some(result => result.result === 'fail') ? 1 : 0;
