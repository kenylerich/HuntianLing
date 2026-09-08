import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createHookGate } from '../../lib/host/board/hook-gate.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'huntianling-hook-'));
}

function writeHook(dir, name, body) {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  chmodSync(path, 0o755);
  return path;
}

function card() {
  return {
    id: 'wi-1',
    projectId: 'proj-1',
    type: 'requirement',
    title: 't',
    body: 'b',
    status: 'inbox',
    priority: null,
    estimate: null,
    assignee: '',
    parentId: null,
    startDate: null,
    dueDate: null,
    acceptance: ['a'],
    sourceRequirementId: null,
    sortOrder: 0,
    claimedRoleId: null,
    claimedBy: null,
    claimedAt: null,
  };
}

test('exit 0 passes', () => {
  const dir = tempDir();
  const gate = createHookGate({ id: 'ok', command: writeHook(dir, 'ok.sh', 'exit 0') });
  assert.deepEqual(gate.run(card(), 'inbox', 'triaged'), { ok: true });
});

test('non-zero exit blocks and the last stderr line is the reason', () => {
  const dir = tempDir();
  const gate = createHookGate({
    id: 'deny',
    command: writeHook(dir, 'deny.sh', 'echo first >&2\necho no evidence >&2\nexit 3'),
  });
  const result = gate.run(card(), 'inbox', 'triaged');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no evidence');
});

test('spawn failure counts as failure, never a silent pass', () => {
  const gate = createHookGate({ id: 'missing', command: '/nonexistent/hook-binary-xyz' });
  const result = gate.run(card(), 'inbox', 'triaged');
  assert.equal(result.ok, false);
  assert.match(result.reason ?? '', /failed to run/);
});

test('timeout counts as failure', () => {
  const dir = tempDir();
  const gate = createHookGate({
    id: 'slow',
    command: writeHook(dir, 'slow.sh', 'sleep 5'),
    timeoutMs: 300,
  });
  const result = gate.run(card(), 'inbox', 'triaged');
  assert.equal(result.ok, false);
  assert.match(result.reason ?? '', /timed out/);
});

test('hook reads transition context as JSON on stdin', () => {
  const dir = tempDir();
  const script = [
    'payload=$(cat)',
    'echo "$payload" | grep -q \'"to":"delivered"\' || exit 9',
    'exit 0',
  ].join('\n');
  const gate = createHookGate({ id: 'ctx', command: writeHook(dir, 'ctx.sh', script) });
  assert.deepEqual(gate.run(card(), 'verifying', 'delivered'), { ok: true });
});
