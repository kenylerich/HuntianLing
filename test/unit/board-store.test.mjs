import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BoardStore } from '../../lib/host/board/store.js';
import { DEFAULT_ROLES } from '../../lib/host/board/types.js';

function tempStore() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  return new BoardStore(root);
}

test('create project seeds default roles', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'HuntianLing' });
  assert.equal(project.roles.length, DEFAULT_ROLES.length);
  assert.ok(project.roles.some((role) => role.id === 'developer'));
});

test('developer can claim an unclaimed card', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = store.createCard({ projectId: project.id, title: '认领切片' });
  assert.equal(card.claimedBy, null);
  const claimed = store.claimCard(card.id, { roleId: 'developer', actorId: 'dev-1' });
  assert.equal(claimed.claimedRoleId, 'developer');
  assert.equal(claimed.claimedBy, 'dev-1');
  assert.equal(typeof claimed.claimedAt, 'number');
});

test('another actor cannot take a claimed card', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = store.createCard({ projectId: project.id, title: '卡' });
  store.claimCard(card.id, { roleId: 'developer', actorId: 'dev-1' });
  assert.throws(
    () => store.claimCard(card.id, { roleId: 'product-owner', actorId: 'po-1' }),
    /already claimed/,
  );
});

test('same actor may switch role; unclaim then others may claim', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = store.createCard({ projectId: project.id, title: '卡' });
  store.claimCard(card.id, { roleId: 'developer', actorId: 'dev-1' });
  const switched = store.claimCard(card.id, { roleId: 'process-steward', actorId: 'dev-1' });
  assert.equal(switched.claimedRoleId, 'process-steward');
  store.unclaimCard(card.id, 'dev-1');
  const taken = store.claimCard(card.id, { roleId: 'product-owner', actorId: 'po-1' });
  assert.equal(taken.claimedBy, 'po-1');
});

test('claim persists across store reload', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-board-'));
  const first = new BoardStore(root);
  const project = first.createProject({ name: 'p' });
  const card = first.createCard({ projectId: project.id, title: '卡' });
  first.claimCard(card.id, { roleId: 'developer', actorId: 'dev-1' });
  const second = new BoardStore(root);
  const loaded = second.getCard(card.id);
  assert.equal(loaded?.claimedBy, 'dev-1');
  assert.equal(loaded?.claimedRoleId, 'developer');
});
