import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCiService } from '../../lib/host/ci/service.js';
import { createDispatchService } from '../../lib/host/dispatch/service.js';
import { resolveDispatchConfig } from '../../lib/host/dispatch/types.js';
import { createScmService } from '../../lib/host/scm/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(5),
  });
}

function gitRunner(args) {
  if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
    return { status: 0, stdout: 'main\n', stderr: '' };
  }
  if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
    return { status: 0, stdout: 'def789abc\n', stderr: '' };
  }
  if (args[0] === 'status' || args[0] === 'remote') {
    return { status: 0, stdout: '', stderr: '' };
  }
  return { status: 1, stdout: '', stderr: 'unknown' };
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('developer records local git, CI, and evaluator evidence; customer progress follows it', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-evidence-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '证据项目' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'delivered',
    title: '客户只看证据',
    body: '交付必须来自已执行检查。',
    analysis: '客户进度来自证据。',
    design: '本地 Git、本地检查、Evaluator。',
    acceptance: ['customer progress is visible'],
  });
  const hash = passwordHash();
  const skills = createSkillService();
  const dispatch = createDispatchService({
    board,
    workspaceRoot: root,
    config: resolveDispatchConfig({ leaseTtlMs: 60_000 }),
  });
  const web = createWebService(
    {
      board,
      requirements,
      scm: createScmService({ board, runner: gitRunner }),
      ci: createCiService({
        board,
        runner: () => ({ status: 'pass', output: 'ok' }),
      }),
      agents: createAgentRuntime({ skills, board }),
      dispatch,
    },
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
  const before = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/customer-board`,
    { headers: { cookie: customerCookie } },
  );
  const beforeItem = before.payload.requirements.find((item) => item.id === story.id);
  assert.equal(beforeItem.progress, 'in_development');

  const denied = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/evaluate`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ independent: true }),
  });
  assert.equal(denied.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];

  const linked = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/scm/link`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceRoot: root }),
  });
  assert.equal(linked.response.status, 200);
  assert.equal(linked.payload.codeLinks[0].label, 'def789abc');

  const ci = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/ci/run`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceRoot: root }),
  });
  assert.equal(ci.response.status, 200);
  assert.ok(ci.payload.ciRuns.length > 0);

  const evaluated = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/evaluate`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ independent: true }),
  });
  assert.equal(evaluated.response.status, 200);
  assert.equal(evaluated.payload.run.output.decision, 'pass');
  assert.ok(evaluated.payload.evidence.checks.some((check) => check.producer === 'evaluator' && check.status === 'passing'));

  const developerBoard = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/developer-board`,
    { headers: { cookie } },
  );
  const progressItem = developerBoard.payload.progress.items.find((item) => item.id === story.id);
  assert.equal(progressItem.progress, 'delivered');
  assert.ok(progressItem.agentFeedback.length > 0);
  assert.equal(progressItem.agentFeedback[0].agentId, 'evaluator');
  assert.ok(progressItem.agentFeedback[0].runId);
  assert.ok(progressItem.agentFeedback[0].skillVersions.length > 0);
  assert.ok(progressItem.codeLinks.length > 0);
  assert.ok(progressItem.ciRuns.length > 0);

  const after = await json(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/customer-board`,
    { headers: { cookie: customerCookie } },
  );
  const afterItem = after.payload.requirements.find((item) => item.id === story.id);
  assert.equal(afterItem.progress, 'delivered');
});
