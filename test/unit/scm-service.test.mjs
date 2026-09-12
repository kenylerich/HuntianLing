import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { hasExecutedDeliveryEvidence } from '../../lib/host/board/executed-evidence.js';
import { createScmService } from '../../lib/host/scm/service.js';
import { ScmError } from '../../lib/host/scm/types.js';

function gitRunner(args) {
  if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
    return { status: 0, stdout: 'main\n', stderr: '' };
  }
  if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
    return { status: 0, stdout: 'abc123def456\n', stderr: '' };
  }
  if (args[0] === 'status') return { status: 0, stdout: '', stderr: '' };
  if (args[0] === 'remote') return { status: 0, stdout: '', stderr: '' };
  return { status: 1, stdout: '', stderr: `unknown git ${args.join(' ')}` };
}

function board() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-scm-'));
  return createBoardService(root);
}

test('inspect reports local branch and HEAD without GitHub', () => {
  const scm = createScmService({ board: board(), runner: gitRunner });
  const inspect = scm.inspect('/tmp/workspace');
  assert.equal(inspect.branch, 'main');
  assert.equal(inspect.head, 'abc123def456');
  assert.equal(inspect.dirty, false);
  assert.deepEqual(inspect.remotes, []);
});

test('linkHead writes an executed scm check onto the WorkItem', () => {
  const store = board();
  const project = store.createProject({ name: 'p' });
  const story = store.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '本地提交',
    body: '把 HEAD 链到需求。',
    analysis: '需要本地 Git。',
    design: 'inspect 后写入 code 检查。',
    acceptance: ['HEAD 已关联'],
  });
  const scm = createScmService({ board: store, runner: gitRunner });
  const summary = scm.linkHead({ workItemId: story.id, workspaceRoot: '/tmp/workspace' });
  assert.equal(summary.codeLinks[0].kind, 'commit');
  assert.equal(summary.codeLinks[0].label, 'abc123def456');
  const check = summary.checks.find((item) => item.producer === 'scm');
  assert.equal(check.status, 'passing');
  assert.equal(check.executionKind, 'executed');
  assert.equal(hasExecutedDeliveryEvidence(summary, story), true);
});

test('git failure is loud', () => {
  const scm = createScmService({
    board: board(),
    runner: () => ({ status: 128, stdout: '', stderr: 'not a git repository' }),
  });
  assert.throws(() => scm.inspect('/tmp/workspace'), (error) => (
    error instanceof ScmError && error.code === 'GIT'
  ));
});
