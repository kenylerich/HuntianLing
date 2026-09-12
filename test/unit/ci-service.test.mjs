import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { hasExecutedDeliveryEvidence } from '../../lib/host/board/executed-evidence.js';
import { createCiService } from '../../lib/host/ci/service.js';

function board() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-ci-'));
  return createBoardService(root);
}

test('local typecheck and test write executed ci checks', () => {
  const store = board();
  const project = store.createProject({ name: 'p' });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '本地检查',
    body: '把 typecheck 和 test 记到需求。',
    analysis: '本地命令即可。',
    design: '注入 runner。',
    acceptance: ['检查通过'],
  });
  const ci = createCiService({
    board: store,
    runner: () => ({ status: 'pass', output: 'ok' }),
  });
  const summary = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp/workspace',
    commands: [
      { id: 'typecheck', command: 'pnpm run typecheck', required: true },
      { id: 'test', command: 'pnpm run test', required: true },
    ],
  });
  assert.equal(summary.ciRuns.length, 2);
  assert.equal(summary.checks.filter((check) => check.producer === 'ci' && check.status === 'passing').length, 2);
  assert.equal(hasExecutedDeliveryEvidence(summary, story), true);
});

test('failed local checks are failing executed evidence', () => {
  const store = board();
  const project = store.createProject({ name: 'p' });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '失败检查',
    body: '失败不能交付。',
    analysis: '失败要可见。',
    design: '写入 failing check。',
    acceptance: ['失败可见'],
  });
  const ci = createCiService({
    board: store,
    runner: () => ({ status: 'fail', output: 'boom' }),
  });
  const summary = ci.run({
    workItemId: story.id,
    workspaceRoot: '/tmp/workspace',
    commands: [{ id: 'test', command: 'pnpm run test', required: true }],
  });
  const ciCheck = summary.checks.find((check) => check.producer === 'ci');
  assert.equal(ciCheck.status, 'failing');
  assert.equal(hasExecutedDeliveryEvidence(summary, story), false);
  assert.throws(() => store.transitionWorkItem(story.id, 'delivered'), /executed evidence|blocking delivery evidence/);
});
