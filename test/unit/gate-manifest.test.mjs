import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BoardStore } from '../../lib/host/board/store.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { loadGateManifest } from '../../lib/host/board/gate-manifest.js';

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-manifest-'));
  mkdirSync(join(root, '.huntianling'), { recursive: true });
  return root;
}

function writeHook(dir, name, body) {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  chmodSync(path, 0o755);
  return path;
}

function readyCard(store, projectId) {
  return store.createCard({
    projectId,
    title: '薄片',
    body: '可验证。',
    acceptance: ['Given x When y Then z'],
  });
}

function attachExecutedEvidence(store, card) {
  store.updateDeliveryEvidenceSummary(card.id, {
    checks: [{
      id: 'evaluator:delivery-proof',
      area: 'acceptance',
      title: 'delivery proof',
      status: 'passing',
      required: true,
      reason: 'executed',
      evidenceIds: ['run-1'],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: '',
    }],
  });
}

test('no manifest means no gates', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-empty-'));
  assert.deepEqual(loadGateManifest(root), []);
});

test('manifest gates load and block matching transitions', () => {
  const root = tempRoot();
  const hook = writeHook(root, 'deny-delivery.sh', 'echo not verified >&2\nexit 1');
  writeFileSync(
    join(root, '.huntianling', 'gates.json'),
    `${JSON.stringify([{ id: 'delivery-proof', command: hook, to: 'delivered' }], null, 2)}\n`,
  );
  const service = createBoardService(root);
  const project = service.createProject({ name: 'p' });
  const card = readyCard(service, project.id);
  attachExecutedEvidence(service, card);
  assert.throws(
    () => service.transitionCard(card.id, 'delivered'),
    /gate delivery-proof.*not verified/s,
  );
  assert.equal(service.getCard(card.id)?.status, 'inbox');
});

test('manifest gate scoped by from/to only fires on that transition', () => {
  const root = tempRoot();
  const hook = writeHook(root, 'allow.sh', 'exit 0');
  writeFileSync(
    join(root, '.huntianling', 'gates.json'),
    `${JSON.stringify([{ id: 'scope', command: hook, from: 'delivered', to: 'inbox' }], null, 2)}\n`,
  );
  const store = new BoardStore(root);
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  const moved = store.transitionCard(card.id, 'triaged');
  assert.equal(moved.status, 'triaged');
});

test('unknown status in the manifest fails loud at load', () => {
  const root = tempRoot();
  const hook = writeHook(root, 'ok.sh', 'exit 0');
  writeFileSync(
    join(root, '.huntianling', 'gates.json'),
    `${JSON.stringify([{ id: 'bad', command: hook, to: 'shipping' }], null, 2)}\n`,
  );
  assert.throws(() => loadGateManifest(root), /unknown to status: shipping/);
});

test('missing command fails loud at load', () => {
  const root = tempRoot();
  writeFileSync(
    join(root, '.huntianling', 'gates.json'),
    `${JSON.stringify([{ id: 'no-cmd' }], null, 2)}\n`,
  );
  assert.throws(() => loadGateManifest(root), /missing a "command"/);
});
