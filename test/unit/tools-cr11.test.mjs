import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDatabaseService } from '../../lib/host/database/service.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import {
  TOOL_BROWSER_NAVIGATE,
  TOOL_DATABASE_MIGRATE,
  TOOL_DOCUMENT_PARSE,
  TOOL_GIT_PUSH,
  TOOL_IMAGE_ANALYZE,
  TOOL_WEB_API_CALL,
} from '../../lib/host/tools/registry.js';
import { ToolDeniedError, ToolInvokeError } from '../../lib/host/tools/types.js';
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

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr11-'));
  const board = createBoardService(root);
  const database = createDatabaseService({ workspaceRoot: root });
  const environment = createEnvironmentService({
    skills: createSkillService(),
    board,
    database,
  });
  const project = board.createProject({ name: 'p' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['可登录'],
  });
  return { root, board, database, environment, project, item };
}

test('a caller lists browser, image, document-parse, database-migration, and web-api tools', async (t) => {
  const { environment, board } = setup();
  t.after(() => environment);
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), environment },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'dev', passwordHash: hash, audience: 'developer' }],
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
  const tools = await json(`${status.url}/api/v1/tools`, { headers: { cookie } });
  const ids = tools.payload.tools.map((tool) => tool.id);
  assert.ok(ids.includes(TOOL_BROWSER_NAVIGATE));
  assert.ok(ids.includes(TOOL_IMAGE_ANALYZE));
  assert.ok(ids.includes(TOOL_DOCUMENT_PARSE));
  assert.ok(ids.includes(TOOL_DATABASE_MIGRATE));
  assert.ok(ids.includes(TOOL_WEB_API_CALL));
  const categories = tools.payload.categories.map((row) => row.category);
  assert.ok(categories.includes('browser'));
  assert.ok(categories.includes('image'));
  assert.ok(categories.includes('database'));
  assert.ok(categories.includes('web-api'));
});

test('a role or task that is not allowed is denied', () => {
  const { environment } = setup();
  assert.throws(
    () => environment.useTool(TOOL_BROWSER_NAVIGATE, 'mkt', 'mkt.collect'),
    ToolDeniedError,
  );
  assert.throws(
    () => environment.useTool(TOOL_GIT_PUSH, 'planner', 'plan'),
    ToolDeniedError,
  );
});

test('document.parse extracts text and records delivery evidence', () => {
  const { environment, board, item } = setup();
  const evidence = environment.invokeTool({
    toolId: TOOL_DOCUMENT_PARSE,
    role: 'generator',
    taskType: 'implement',
    workItemId: item.id,
    affectsDelivery: true,
    input: { kind: 'plain-text', extractedText: '客户要登录', mimeType: 'text/plain' },
  });
  assert.equal(evidence.result, 'ran');
  assert.match(evidence.detail, /parsed:/);
  const summary = board.getDeliveryEvidenceSummary(item.id);
  assert.ok(summary.checks.some((check) => check.producer === 'tool' && check.id === `tool:${TOOL_DOCUMENT_PARSE}`));
});

test('image.analyze extracts image text and records delivery evidence', () => {
  const { environment, board, item } = setup();
  const evidence = environment.invokeTool({
    toolId: TOOL_IMAGE_ANALYZE,
    role: 'evaluator',
    taskType: 'evaluate',
    workItemId: item.id,
    affectsDelivery: true,
    input: { extractedText: '截图里的验收标准', mimeType: 'image/png' },
  });
  assert.equal(evidence.result, 'ran');
  assert.match(evidence.detail, /analyzed:/);
  const summary = board.getDeliveryEvidenceSummary(item.id);
  assert.ok(summary.checks.some((check) => check.producer === 'tool' && check.id === `tool:${TOOL_IMAGE_ANALYZE}`));
});

test('database.migrate applies schema and records delivery evidence', () => {
  const { environment, board, database, item } = setup();
  const evidence = environment.invokeTool({
    toolId: TOOL_DATABASE_MIGRATE,
    role: 'generator',
    taskType: 'implement',
    workItemId: item.id,
    affectsDelivery: true,
  });
  assert.equal(evidence.result, 'ran');
  assert.equal(evidence.detail, `schema:${String(database.schemaVersion())}`);
  const summary = board.getDeliveryEvidenceSummary(item.id);
  assert.ok(summary.checks.some((check) => check.producer === 'tool' && check.title === 'migrate-database'));
});

test('web-api.call uses call-time transport without persisting secrets', () => {
  const { environment } = setup();
  const evidence = environment.invokeTool(
    {
      toolId: TOOL_WEB_API_CALL,
      role: 'generator',
      taskType: 'implement',
      input: {
        url: 'https://example.test/hooks',
        method: 'POST',
        headers: { Authorization: 'secret-token', Accept: 'application/json' },
        body: '{}',
      },
    },
    {
      transport: (request) => {
        assert.equal(request.url, 'https://example.test/hooks');
        assert.equal(request.headers?.Authorization, undefined);
        assert.equal(request.headers?.Accept, 'application/json');
        return { status: 204, body: '' };
      },
    },
  );
  assert.equal(evidence.result, 'ran');
  assert.match(evidence.detail, /status=204/);
  assert.equal(evidence.detail.includes('secret-token'), false);
  assert.throws(
    () =>
      environment.invokeTool({
        toolId: TOOL_WEB_API_CALL,
        role: 'generator',
        taskType: 'implement',
        input: { url: 'https://example.test', persistSecrets: true, token: 'secret-token' },
      }),
    (error) => error instanceof ToolInvokeError && error.code === 'SECRET',
  );
});

test('browser.navigate runs locally and fails loud when a hosted fleet is requested', () => {
  const { environment } = setup();
  const evidence = environment.invokeTool({
    toolId: TOOL_BROWSER_NAVIGATE,
    role: 'generator',
    taskType: 'implement',
    input: { url: 'https://example.test/login' },
  });
  assert.equal(evidence.detail, 'local:https://example.test/login');
  assert.throws(
    () =>
      environment.invokeTool({
        toolId: TOOL_BROWSER_NAVIGATE,
        role: 'generator',
        taskType: 'implement',
        input: { url: 'https://example.test/login', fleet: 'hosted' },
      }),
    (error) => error instanceof ToolInvokeError && error.code === 'HOSTED_FLEET',
  );
});

test('tool calls that affect delivery appear on the WorkItem evidence summary', () => {
  const { environment, board, item } = setup();
  environment.invokeTool({
    toolId: TOOL_BROWSER_NAVIGATE,
    role: 'evaluator',
    taskType: 'evaluate',
    workItemId: item.id,
    affectsDelivery: true,
    input: { url: 'https://example.test/app' },
  });
  const summary = board.getDeliveryEvidenceSummary(item.id);
  const check = summary.checks.find((row) => row.producer === 'tool');
  assert.equal(check.status, 'passing');
  assert.equal(check.executionKind, 'executed');
  assert.equal(check.area, 'evidence');
});

test('customers cannot invoke remaining-category tools', async (t) => {
  const { board, environment } = setup();
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), environment },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'cust', passwordHash: hash, audience: 'customer' }],
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
  const invoked = await json(`${status.url}/api/v1/tools/invoke`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      toolId: TOOL_BROWSER_NAVIGATE,
      role: 'generator',
      taskType: 'implement',
      input: { url: 'https://example.test' },
    }),
  });
  assert.equal(invoked.response.status, 403);
  const catalog = await json(`${status.url}/api/v1/tools`, { headers: { cookie } });
  assert.equal(catalog.response.status, 403);
});
