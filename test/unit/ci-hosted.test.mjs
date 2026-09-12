import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAuthorityService } from '../../lib/host/authority/service.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { hasExecutedDeliveryEvidence } from '../../lib/host/board/executed-evidence.js';
import { createCiService } from '../../lib/host/ci/service.js';
import { CiError } from '../../lib/host/ci/types.js';

const JUNIT = '<?xml version="1.0"?><testsuite name="a" tests="2" failures="0" errors="0"></testsuite>';
const LCOV = 'SF:src/a.ts\nLF:10\nLH:8\nend_of_record\n';
const SARIF = JSON.stringify({
  version: '2.1.0',
  runs: [{ results: [{ level: 'warning', ruleId: 'no-console', message: { text: 'console' } }] }],
});
const PLAYWRIGHT = JSON.stringify({ stats: { expected: 3, unexpected: 0, skipped: 0 } });

function setup(transport, env = {}) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-ci-hosted-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    analysis: '需要检查',
    design: '托管流水线',
    acceptance: ['ci green'],
  });
  const authority = createAuthorityService({ board, workspaceRoot: root });
  const ci = createCiService({
    board,
    authority,
    hosted: transport,
    env,
    runner: () => ({ status: 'pass', output: 'ok' }),
  });
  return { root, board, project, story, authority, ci };
}

function githubTransport() {
  const calls = [];
  const transport = (request) => {
    calls.push(request);
    const { method, url } = request;
    if (method === 'GET' && url.endsWith('/actions/workflows')) {
      return { status: 200, body: JSON.stringify({ workflows: [{ id: 1, name: 'CI', path: 'ci.yml' }] }) };
    }
    if (method === 'POST' && url.includes('/dispatches')) {
      return { status: 204, body: '' };
    }
    if (method === 'GET' && url.endsWith('/actions/runs/42/artifacts')) {
      return {
        status: 200,
        body: JSON.stringify({
          artifacts: [
            { id: 1, name: 'junit', archive_download_url: 'https://api.github.com/repos/acme/app/actions/artifacts/1/zip' },
            { id: 2, name: 'coverage-lcov', archive_download_url: 'https://api.github.com/repos/acme/app/actions/artifacts/2/zip' },
            { id: 3, name: 'results.sarif', archive_download_url: 'https://api.github.com/repos/acme/app/actions/artifacts/3/zip' },
            { id: 4, name: 'playwright', archive_download_url: 'https://api.github.com/repos/acme/app/actions/artifacts/4/zip' },
          ],
        }),
      };
    }
    if (method === 'GET' && url.endsWith('/actions/runs/42/logs')) {
      return { status: 200, body: 'ok log' };
    }
    if (method === 'GET' && /\/actions\/runs\/42$/.test(url)) {
      return {
        status: 200,
        body: JSON.stringify({
          id: 42,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/acme/app/actions/runs/42',
        }),
      };
    }
    if (method === 'GET' && url.includes('/actions/runs?')) {
      return {
        status: 200,
        body: JSON.stringify({
          workflow_runs: [{
            id: 42,
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/acme/app/actions/runs/42',
          }],
        }),
      };
    }
    if (url.endsWith('/artifacts/1/zip')) return { status: 200, body: JUNIT };
    if (url.endsWith('/artifacts/2/zip')) return { status: 200, body: LCOV };
    if (url.endsWith('/artifacts/3/zip')) return { status: 200, body: SARIF };
    if (url.endsWith('/artifacts/4/zip')) return { status: 200, body: PLAYWRIGHT };
    return { status: 500, body: `unexpected ${method} ${url}` };
  };
  return { calls, transport };
}

test('a project can discover GitHub Actions, Gitea Actions, or GitLab CI workflows', () => {
  const { transport } = githubTransport();
  const { ci } = setup(transport, {});
  const github = ci.listWorkflows({
    provider: 'github-actions',
    owner: 'acme',
    repo: 'app',
    token: 'ghp_secret',
  });
  assert.equal(github[0].path, 'ci.yml');

  const giteaCalls = [];
  const giteaCi = setup((request) => {
    giteaCalls.push(request);
    return {
      status: 200,
      body: JSON.stringify({ workflows: [{ id: 2, name: 'Gitea CI', path: 'gitea.yml' }] }),
    };
  }, {}).ci;
  const gitea = giteaCi.listWorkflows({
    provider: 'gitea-actions',
    owner: 'acme',
    repo: 'app',
    token: 'gitea-token',
    apiBaseUrl: 'https://gitea.example/api/v1',
  });
  assert.equal(gitea[0].provider, 'gitea-actions');
  assert.equal(giteaCalls[0].headers.Authorization, 'token gitea-token');

  const gitlabCi = setup((request) => {
    assert.match(request.url, /\/projects\/group%2Fapp\/repository\/files\/.gitlab-ci.yml/);
    assert.equal(request.headers['PRIVATE-TOKEN'], 'gitlab-token');
    return { status: 200, body: JSON.stringify({ file_name: '.gitlab-ci.yml' }) };
  }, {}).ci;
  const gitlab = gitlabCi.listWorkflows({
    provider: 'gitlab-ci',
    owner: 'group',
    repo: 'app',
    token: 'gitlab-token',
    apiBaseUrl: 'https://gitlab.example/api/v4',
  });
  assert.equal(gitlab[0].id, '.gitlab-ci.yml');
});

test('an authorized hosted pipeline trigger records an executed CI run on the WorkItem', () => {
  const { calls, transport } = githubTransport();
  const { ci, story } = setup(transport, {});
  const summary = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp',
    provider: 'github-actions',
    owner: 'acme',
    repo: 'app',
    workflow: 'ci.yml',
    ref: 'main',
    token: 'ghp_secret',
    role: 'ci',
    actor: 'ci-1',
  });
  const run = summary.ciRuns.find((link) => link.kind === 'ci-run');
  assert.equal(run.url, 'https://github.com/acme/app/actions/runs/42');
  assert.equal(hasExecutedDeliveryEvidence(summary, story), true);
  assert.ok(calls.some((call) => call.method === 'POST' && call.url.endsWith('/dispatches')));
  assert.equal(JSON.stringify(summary).includes('ghp_secret'), false);
});

test('hosted trigger waits until the run has completed before attaching evidence', () => {
  let reads = 0;
  const { ci, story } = setup((request) => {
    if (request.method === 'POST' && request.url.includes('/dispatches')) {
      return { status: 204, body: '' };
    }
    if (request.url.includes('/actions/runs?')) {
      return {
        status: 200,
        body: JSON.stringify({ workflow_runs: [{ id: 7, status: 'in_progress' }] }),
      };
    }
    if (/\/actions\/runs\/7$/.test(request.url)) {
      reads += 1;
      return { status: 200, body: JSON.stringify({ id: 7, status: 'in_progress' }) };
    }
    return { status: 500, body: request.url };
  }, {});
  assert.throws(
    () => ci.run({
      workItemId: story.id,
      workspaceRoot: '/tmp',
      provider: 'github',
      owner: 'acme',
      repo: 'app',
      workflow: 'ci.yml',
      token: 'ghp_secret',
      role: 'ci',
      actor: 'ci-1',
    }),
    (error) => error instanceof CiError && error.code === 'HOSTED' && /did not complete/.test(error.message),
  );
  assert.ok(reads >= 1);
});

test('JUnit, coverage, SARIF, and Playwright artifacts attach as executed CI evidence', () => {
  const { transport } = githubTransport();
  const { ci, story } = setup(transport, {});
  const summary = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp',
    provider: 'github-actions',
    owner: 'acme',
    repo: 'app',
    workflow: 'ci.yml',
    token: 'ghp_secret',
    role: 'evaluator',
    actor: 'eval-1',
  });
  assert.ok(summary.checks.some((check) => check.title === 'JUnit' && check.status === 'passing'));
  assert.ok(summary.checks.some((check) => check.title === 'Coverage' && check.reason.includes('%')));
  assert.ok(summary.checks.some((check) => check.title === 'SARIF' && check.area === 'security'));
  assert.ok(summary.checks.some((check) => check.title === 'Playwright' && check.status === 'passing'));
  assert.ok(summary.evidenceLinks.some((link) => link.kind === 'ci-artifact'));
  assert.ok(summary.evidenceLinks.some((link) => link.kind === 'coverage-report'));
  assert.ok(summary.evidenceLinks.some((link) => link.kind === 'security-finding'));
});

test('local command-runner CI still works without GitHub', () => {
  const { ci, story } = setup(() => ({ status: 500, body: 'should not call hosted' }), {});
  const summary = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp',
    commands: [{ id: 'test', command: 'pnpm run test', required: true }],
  });
  assert.equal(summary.ciRuns[0].id, 'ci:test');
});

test('unknown provider or missing hosted workflow metadata fails loud', () => {
  const { ci, story } = setup(() => ({ status: 500, body: '' }), {});
  assert.throws(
    () => ci.run({
      workItemId: story.id,
      workspaceRoot: '/tmp',
      provider: 'jenkins',
      owner: 'acme',
      repo: 'app',
      role: 'ci',
      actor: 'ci-1',
    }),
    /unknown ci provider/,
  );
  assert.throws(
    () => ci.run({
      workItemId: story.id,
      workspaceRoot: '/tmp',
      provider: 'github-actions',
      owner: 'acme',
      workflow: 'ci.yml',
      token: 'ghp_secret',
      role: 'ci',
      actor: 'ci-1',
    }),
    /requires owner and repo/,
  );
  assert.throws(
    () => ci.run({
      workItemId: story.id,
      workspaceRoot: '/tmp',
      provider: 'github-actions',
      owner: 'acme',
      repo: 'app',
      token: 'ghp_secret',
      role: 'ci',
      actor: 'ci-1',
    }),
    /requires workflow/,
  );
});

test('hosted credentials are supplied at call time or from the environment and are never persisted', () => {
  const { calls, transport } = githubTransport();
  const { ci, story } = setup(transport, { HUNTIANLING_GITHUB_TOKEN: 'env-secret-token' });
  const summary = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp',
    provider: 'github-actions',
    owner: 'acme',
    repo: 'app',
    workflow: 'ci.yml',
    role: 'ci',
    actor: 'ci-1',
  });
  assert.equal(calls[0].headers.Authorization, 'Bearer env-secret-token');
  assert.equal(JSON.stringify(summary).includes('env-secret-token'), false);

  const { ci: missing, story: other } = setup(transport, {});
  assert.throws(
    () => missing.run({
      workItemId: other.id,
      workspaceRoot: '/tmp',
      provider: 'github-actions',
      owner: 'acme',
      repo: 'app',
      workflow: 'ci.yml',
      role: 'ci',
      actor: 'ci-1',
    }),
    /token is required/,
  );
});

test('production hosted CI still requires human approval', () => {
  const { transport } = githubTransport();
  const { ci, story, authority, project } = setup(transport, {});
  assert.throws(
    () => ci.run({
      workItemId: story.id,
      workspaceRoot: '/tmp',
      provider: 'github-actions',
      owner: 'acme',
      repo: 'app',
      workflow: 'ci.yml',
      token: 'ghp_secret',
      production: true,
      role: 'evaluator',
      actor: 'eval-1',
    }),
    /requires human approval/,
  );
  const approval = authority.requestApproval({
    projectId: project.id,
    workItemId: story.id,
    role: 'evaluator',
    action: 'production_deploy',
    requester: 'eval-1',
  });
  authority.decideApproval({ approvalId: approval.id, decision: 'granted', actor: 'reviewer' });
  const summary = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp',
    provider: 'github-actions',
    owner: 'acme',
    repo: 'app',
    workflow: 'ci.yml',
    token: 'ghp_secret',
    production: true,
    role: 'evaluator',
    actor: 'eval-1',
    approvalId: approval.id,
  });
  assert.ok(summary.ciRuns.some((link) => link.url !== null));
});

test('GitLab CI uses provider-specific pipeline endpoints', () => {
  const calls = [];
  const { ci, story } = setup((request) => {
    calls.push(request);
    if (request.method === 'POST' && request.url.endsWith('/pipeline')) {
      return {
        status: 201,
        body: JSON.stringify({ id: 9, status: 'success', web_url: 'https://gitlab.example/group/app/-/pipelines/9' }),
      };
    }
    if (request.url.endsWith('/pipelines/9/jobs')) {
      return { status: 200, body: JSON.stringify([{ id: 1, name: 'junit', web_url: 'https://gitlab.example/job/1' }]) };
    }
    if (request.url.endsWith('/jobs/1/artifacts')) {
      return { status: 200, body: JUNIT };
    }
    return { status: 500, body: `unexpected ${request.method} ${request.url}` };
  }, {});
  const summary = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp',
    provider: 'gitlab-ci',
    owner: 'group',
    repo: 'app',
    apiBaseUrl: 'https://gitlab.example/api/v4',
    token: 'gitlab-token',
    role: 'ci',
    actor: 'ci-1',
  });
  assert.equal(summary.ciRuns[0].url, 'https://gitlab.example/group/app/-/pipelines/9');
  assert.ok(summary.checks.some((check) => check.title === 'JUnit'));
  assert.equal(calls[0].headers['PRIVATE-TOKEN'], 'gitlab-token');
});
