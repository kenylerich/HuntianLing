import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import { resolveWorkspaceRoot } from '../../lib/host/board/workspace.js';

test('explicit path wins over env and cwd', () => {
  const root = resolveWorkspaceRoot({
    explicit: '/tmp/project-a',
    env: { HUNTIANLING_WORKSPACE: '/tmp/project-b' },
    cwd: '/tmp/project-c',
  });
  assert.equal(root, '/tmp/project-a');
});

test('HUNTIANLING_WORKSPACE is used when explicit is absent', () => {
  const root = resolveWorkspaceRoot({
    env: { HUNTIANLING_WORKSPACE: '/tmp/from-env' },
    cwd: '/tmp/cwd',
  });
  assert.equal(root, '/tmp/from-env');
});

test('relative env path is resolved against cwd', () => {
  const root = resolveWorkspaceRoot({
    env: { HUNTIANLING_WORKSPACE: 'nested' },
    cwd: '/tmp/cwd',
  });
  assert.equal(root, resolve('/tmp/cwd', 'nested'));
});

test('falls back to cwd', () => {
  const root = resolveWorkspaceRoot({ cwd: '/tmp/only-cwd' });
  assert.equal(root, '/tmp/only-cwd');
});
