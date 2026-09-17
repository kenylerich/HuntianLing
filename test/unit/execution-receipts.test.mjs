import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCiService } from '../../lib/host/ci/service.js';
import { hasExecutedDeliveryEvidence, workItemDesignRevision } from '../../lib/host/board/executed-evidence.js';
import { runLocalCheck, resolveCiConfig } from '../../lib/host/ci/local.js';
import { workspaceRevision } from '../../lib/host/board/execution-records.js';

// Trusted Host fixture only: this does not assert that the local runner contains descendants.
function mockHostReceipt(board, item, root, summary) {
  const checks = summary.checks.map(check => ({ ...check, executionKind: 'executed' }));
  board.recordExecutionEvidence(item.id, checks, root, workspaceRevision(root));
  return board.updateDeliveryEvidenceSummary(item.id, { checks });
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'htl-receipts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: {
    typecheck: 'node --check app.mjs', test: 'node --test acceptance.mjs',
  } }));
  writeFileSync(join(root, 'app.mjs'), 'export function cancelOrder(status) { throw new Error("not implemented"); }\n');
  writeFileSync(join(root, 'acceptance.mjs'), 'import assert from "node:assert/strict"; import {cancelOrder} from "./app.mjs"; assert.equal(cancelOrder("unshipped"), "cancelled"); assert.throws(() => cancelOrder("shipped"));\n');
  const prepared = spawnSync('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
  assert.equal(prepared.status, 0, prepared.stderr);
  const board = createBoardService(root);
  const project = board.createProject({ name: 'Cancellation' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const item = board.createWorkItem({ projectId: project.id, milestoneId: milestone.id,
    type: 'story', status: 'verifying', title: 'Cancel unshipped orders', body: 'Cancel order',
    sourceInput: 'Cancel only unshipped orders', analysis: 'Check shipment state',
    design: 'Reject shipped orders', acceptance: ['Unshipped cancels; shipped rejects'] });
  const ci = createCiService({ board, workspaceRoot: root, config: { localExecution: 'enabled' } });
  return { root, board, ci, item };
}

test('forged prefixes and changed-file links cannot authorize delivery, including after reload', t => {
  const { root, board, item } = fixture(t);
  board.updateDeliveryEvidenceSummary(item.id, { designRevision: workItemDesignRevision(item), checks: [{
    id: 'fake', area: 'ci', title: 'Forged CI', status: 'passing', required: true, reason: '',
    evidenceIds: ['ci:never-executed'], acceptanceCriterionIds: [],
    links: [{ kind: 'changed-file', id: 'app.mjs', label: 'candidate', url: null, acceptanceCriterionIds: [] }],
    producer: 'ci', executionKind: 'executed', designRevision: workItemDesignRevision(item),
  }] });
  for (const service of [board, createBoardService(root)]) {
    assert.equal(service.getDeliveryEvidenceSummary(item.id).checks[0].executionKind, 'manual');
    assert.ok(!service.getProjectDeliveryEvidenceRollup(item.projectId).readyWorkItemIds.includes(item.id));
    assert.throws(() => service.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
  }
});

test('local results remain diagnostic; trusted Host receipts survive reload and invalidate changed code', t => {
  const { root, board, ci, item } = fixture(t);
  const failed = ci.run({ workItemId: item.id });
  assert.ok(failed.checks.some(check => check.status === 'failing'), JSON.stringify(failed.checks));
  assert.throws(() => board.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
  writeFileSync(join(root, 'app.mjs'), 'export function cancelOrder(status) { if (status !== "unshipped") throw new Error("shipped"); return "cancelled"; }\n');
  const diagnostic = ci.run({ workItemId: item.id });
  assert.ok(diagnostic.checks.every(check => check.status === 'passing' && check.executionKind === 'manual'));
  assert.throws(() => board.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
  const passed = mockHostReceipt(board, item, root, diagnostic);
  assert.ok(passed.checks.every(check => check.status === 'passing' && check.executionKind === 'executed'));
  assert.ok(board.getProjectDeliveryEvidenceRollup(item.projectId).readyWorkItemIds.includes(item.id));
  const reopened = createBoardService(root);
  assert.equal(reopened.transitionWorkItem(item.id, 'delivered').status, 'delivered');
  writeFileSync(join(root, 'app.mjs'), 'throw new Error("regression");\n');
  assert.ok(createBoardService(root).getDeliveryEvidenceSummary(item.id).checks.every(check => check.executionKind !== 'executed'));
  assert.throws(() => board.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
});

test('caller cannot select another workspace or submit shell commands to the local runner', t => {
  const { root, board, ci, item } = fixture(t);
  assert.throws(() => ci.run({ workItemId: item.id, workspaceRoot: tmpdir() }), /configured workspace/);
  const result = ci.run({ workItemId: item.id, commands: [{ id: 'shell', command: 'echo forged; exit 0', required: true }] });
  assert.equal(result.checks[0].status, 'blocked');
  assert.notEqual(result.checks[0].executionKind, 'executed');
  const disabled = createCiService({ board, workspaceRoot: root });
  assert.ok(disabled.run({ workItemId: item.id }).checks.every(check => check.status === 'pending' && check.executionKind !== 'executed'));
});

test('local checks contain timeout and output overflow and omit host credentials', t => {
  const { root } = fixture(t);
  const key = 'HUNTIANLING_TEST_SECRET';
  const previous = process.env[key];
  process.env[key] = 'isolated-fixture-secret';
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: {
    hang: 'node -e "setInterval(() => {}, 1000)"',
    overflow: 'node -e "process.stdout.write(\'x\'.repeat(100000))"',
    credentials: 'node -e "console.log(process.env.HUNTIANLING_TEST_SECRET || \'absent\')"',
  } }));
  const limited = resolveCiConfig({ localExecution: 'enabled', timeoutMs: 200, outputLimit: 1024 });
  const timed = runLocalCheck('pnpm run hang', root, limited);
  assert.equal(timed.status, 'blocked');
  assert.equal(timed.timedOut, true);
  const overflow = runLocalCheck('pnpm run overflow', root, { ...limited, timeoutMs: 10_000 });
  assert.equal(overflow.status, 'blocked');
  const clean = runLocalCheck('pnpm run credentials', root, { ...limited, timeoutMs: 10_000 });
  assert.equal(clean.status, 'pass');
  assert.match(clean.output, /absent/);
  assert.doesNotMatch(clean.output, /isolated-fixture-secret/);
});

test('execution receipts reject altered passing fields and cannot be replayed to another work item', t => {
  const { root, board, ci, item } = fixture(t);
  writeFileSync(join(root, 'app.mjs'), 'export function cancelOrder(status) { if (status !== "unshipped") throw new Error("shipped"); return "cancelled"; }\n');
  const original = mockHostReceipt(board, item, root, ci.run({ workItemId: item.id }));
  const other = board.createWorkItem({ ...item, title: 'Another delivery', status: 'verifying' });
  assert.notEqual(other.id, item.id);
  board.updateDeliveryEvidenceSummary(other.id, { checks: original.checks });
  assert.throws(() => board.transitionWorkItem(other.id, 'delivered'), /executed evidence/);
  board.updateDeliveryEvidenceSummary(item.id, { checks: original.checks.map(check => ({ ...check, reason: 'altered claim' })) });
  assert.throws(() => board.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
});

test('a genuine check cannot hide another required check with unverified execution', t => {
  const { root, board, ci, item } = fixture(t);
  writeFileSync(join(root, 'app.mjs'), 'export function cancelOrder(status) { if (status !== "unshipped") throw new Error("shipped"); return "cancelled"; }\n');
  const original = mockHostReceipt(board, item, root, ci.run({ workItemId: item.id }));
  board.updateDeliveryEvidenceSummary(item.id, { checks: original.checks.map((check, index) => index === 0
    ? check : { ...check, evidenceIds: ['ci:unobserved'], reason: 'unverified passing result' }) });
  const mixed = board.getDeliveryEvidenceSummary(item.id);
  assert.notEqual(mixed.checks[0].executionKind, 'executed');
  assert.notEqual(mixed.checks[1].executionKind, 'executed');
  assert.throws(() => board.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
});

test('omitting a required failure invalidates the entire host execution batch', t => {
  const { root, board, ci, item } = fixture(t);
  const failed = mockHostReceipt(board, item, root, ci.run({ workItemId: item.id }));
  assert.ok(failed.checks.some(check => check.status === 'passing'));
  assert.ok(failed.checks.some(check => check.status === 'failing'));
  board.updateDeliveryEvidenceSummary(item.id, { checks: failed.checks.filter(check => check.status === 'passing') });
  assert.throws(() => board.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
});

test('a newer failure supersedes older passing receipts on the same source', t => {
  const { root, board, ci, item } = fixture(t);
  writeFileSync(join(root, 'app.mjs'), 'import {existsSync} from "node:fs"; export function cancelOrder(status) { if (existsSync(".huntianling/fail") || status !== "unshipped") throw new Error("blocked"); return "cancelled"; }\n');
  const passed = mockHostReceipt(board, item, root, ci.run({ workItemId: item.id }));
  assert.ok(hasExecutedDeliveryEvidence(passed, item));
  writeFileSync(join(root, '.huntianling/fail'), 'external fixture failure');
  const failed = ci.run({ workItemId: item.id });
  assert.ok(failed.checks.some(check => check.status === 'failing'));
  board.updateDeliveryEvidenceSummary(item.id, { checks: passed.checks });
  assert.throws(() => createBoardService(root).transitionWorkItem(item.id, 'delivered'), /executed evidence/);
});

test('intermediate edits invalidate a batch even when another command restores the source', t => {
  const { root, board, ci, item } = fixture(t);
  const broken = 'throw new Error("broken candidate");\n';
  writeFileSync(join(root, 'app.mjs'), broken);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { prepare: 'node prepare.mjs', test: 'node app.mjs', restore: 'node restore.mjs' } }));
  writeFileSync(join(root, 'prepare.mjs'), 'import {writeFileSync} from "node:fs"; writeFileSync("app.mjs", "export const ok = true;\\n");\n');
  writeFileSync(join(root, 'restore.mjs'), `import {writeFileSync} from "node:fs"; writeFileSync("app.mjs", ${JSON.stringify(broken)});\n`);
  const result = ci.run({ workItemId: item.id, commands: ['prepare', 'test', 'restore'].map(id => ({ id, command: `pnpm run ${id}`, required: true })) });
  assert.ok(result.checks.every(check => check.status === 'blocked'));
  assert.equal(spawnSync(process.execPath, ['app.mjs'], { cwd: root }).status, 1);
  assert.throws(() => board.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
});

test('executable permission changes invalidate tested scripts', t => {
  const { root, board, ci, item } = fixture(t);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { test: './acceptance.sh' } }));
  writeFileSync(join(root, 'acceptance.sh'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(root, 'acceptance.sh'), 0o755);
  assert.ok(hasExecutedDeliveryEvidence(mockHostReceipt(board, item, root,
    ci.run({ workItemId: item.id, commands: [{ id: 'test', command: 'pnpm run test', required: true }] })), item));
  chmodSync(join(root, 'acceptance.sh'), 0o644);
  assert.equal(runLocalCheck('pnpm run test', root, resolveCiConfig({ localExecution: 'enabled' })).status, 'fail');
  assert.throws(() => board.transitionWorkItem(item.id, 'delivered'), /executed evidence/);
});
