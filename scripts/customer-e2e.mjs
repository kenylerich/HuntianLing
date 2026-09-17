import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  ci: { localExecution: 'enabled' },
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
    for (const path of [`${projectPath}/developer-board`, `${projectPath}/main-board`,
      `${projectPath}/business-crud`, `${projectPath}/team/members`,
      `/api/work-items?projectId=${project.id}`, `/api/requirements/${project.id}/tree`]) {
      const response = await request(path, customer);
      assert.equal(response.status, 403, `Customer got ${response.status} from ${path}`);
    }
  });
  const session = await ok(`${projectPath}/intake/sessions`, customer, 'POST', { title: 'Cancel order' });
  const sessionPath = `/api/v1/intake/sessions/${session.id}`;
  await check('customer-cannot-impersonate-reviewer', ['REQ-AUTH-001', 'REQ-MKT-001'], async () => {
    const message = await ok(`${sessionPath}/messages`, customer, 'POST', {
      role: 'assistant', kind: 'analysis', author: 'reviewer', body: 'Untrusted claimed review',
    });
    assert.equal(message.role, 'user');
    assert.equal(message.kind, 'chat');
    assert.equal(message.author, 'customer-a');
    assert.equal((await request(`${sessionPath}/approve`, customer, 'POST', {})).status, 403);
    assert.equal((await request(sessionPath, customer, 'PATCH', { status: 'approved' })).status, 403);
  });
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
  await check('unapproved-story-is-blocked', ['REQ-MKT-001', 'REQ-HARNESS-006'], async () => {
    const denied = await request(`${itemPath}/story-delivery/start`, developer, 'POST', { drive: true, confirmed: true });
    assert.equal(denied.status, 409);
    assert.match(denied.data.error, /original requirement.*approval/);
    const plan = await request(`${itemPath}/plan`, developer, 'POST', { methodId: 'user-story', confirmed: true });
    assert.equal(plan.status, 400);
    assert.match(plan.data.error, /original requirement.*approval/);
  });
  await check('unprepared-story-is-blocked', ['REQ-HARNESS-001'], async () => {
    for (const [field, value] of [['goal', 'Cancel an unshipped order'], ['actors', 'order customer'],
      ['scenarios', 'Cancel before shipping'], ['confirm', 'yes']]) {
      await ok(`${sessionPath}/follow-ups`, customer, 'POST', { field, value });
    }
    const candidates = await ok(`${sessionPath}/candidates`, developer);
    const candidate = candidates.candidates.find(row => row.type === 'story');
    await ok(`/api/v1/intake/candidates/${candidate.id}`, developer, 'PATCH', { openQuestions: [] });
    const approved = await ok(`${sessionPath}/approve`, developer, 'POST', { candidateIds: [candidate.id] });
    const story = approved.workItems.find(row => row.id === candidate.workItemId);
    await ok(`/api/work-items/${story.id}`, developer, 'PATCH', { milestoneId: milestones.milestones[0].id });
    const planned = await ok(`/api/v1/work-items/${story.id}/plan`, developer, 'POST', { methodId: 'user-story' });
    assert.equal(planned.run.input.sourceApproval.candidateId, candidate.id);
    assert.equal(planned.run.input.sourceApproval.actorId, 'developer');
    assert.ok(ctx.get('huntianling.agents').getRun(planned.run.id));
    const run = await ok(`/api/v1/work-items/${story.id}/story-delivery/start`, developer, 'POST', { drive: true });
    assert.equal(run.status, 'blocked');
    assert.ok(run.checkpoint.blockers.some(reason => /environment/i.test(reason)), JSON.stringify(run.checkpoint));
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
  await check('production-local-ci-diagnostics-and-containment-gate', ['REQ-CI-001', 'REQ-EVIDENCE-001'], async () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: {
      typecheck: 'node --check candidate.mjs',
      test: 'node acceptance.mjs',
    } }));
    writeFileSync(join(root, 'candidate.mjs'), 'export const result = "broken";\n');
    writeFileSync(join(root, 'acceptance.mjs'), 'import assert from "node:assert/strict"; import {result} from "./candidate.mjs"; assert.equal(result, "working");\n');
    const prepared = spawnSync('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
    assert.equal(prepared.status, 0, prepared.stderr);
    const failed = await ok(`${itemPath}/ci/run`, developer, 'POST', {});
    assert.ok(failed.checks.some(check => check.status === 'failing'));
    assert.ok((await request(`${itemPath}/status`, developer, 'POST', { to: 'delivered' })).status >= 400);
    writeFileSync(join(root, 'candidate.mjs'), 'export const result = "working";\n');
    const evidence = await ok(`${itemPath}/ci/run`, developer, 'POST', {});
    assert.ok(evidence.checks.every(check => check.status === 'passing' && check.executionKind === 'manual'));
    assert.ok(evidence.checks.every(check => check.reason.includes('process containment is unverified')));
    assert.ok((await request(`${itemPath}/status`, developer, 'POST', { to: 'delivered' })).status >= 400);
  });
} finally {
  try { await fiber.dispose(); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

console.log(JSON.stringify({
  suite: 'customer-http-acceptance',
  result: results.some(result => result.result === 'fail') ? 'fail' : 'pass',
  results,
  notVerified: ['live dsh agents', 'native CI acceptance authority and descendant containment', 'OAuth exchanges', 'hosted SCM/CI', 'PostgreSQL',
    'browser interactions (separate Playwright review)', 'all backlog acceptance criteria'],
}, null, 2));
process.exitCode = results.some(result => result.result === 'fail') ? 1 : 0;
