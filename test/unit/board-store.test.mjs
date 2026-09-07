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

function readyCard(store, projectId) {
  return store.createCard({
    projectId,
    title: '薄片',
    body: '可验证的一小步。',
    acceptance: ['Given x When y Then z'],
  });
}

test('transitionCard is the only status write path and allows inbox to triaged', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  const moved = store.transitionCard(card.id, 'triaged');
  assert.equal(moved.status, 'triaged');
});

test('transitionCard rejects delivered back to inbox', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  store.transitionCard(card.id, 'delivered');
  assert.throws(() => store.transitionCard(card.id, 'inbox'), /forbidden transition/);
});

test('failing gate blocks transition and leaves status unchanged', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  store.registerGate({
    id: 'block-delivered',
    to: 'delivered',
    run: () => ({ ok: false, reason: 'no evidence' }),
  });
  assert.throws(() => store.transitionCard(card.id, 'delivered'), /gate block-delivered/);
  assert.equal(store.getCard(card.id)?.status, 'inbox');
});

test('passing gate allows the transition', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = readyCard(store, project.id);
  store.registerGate({
    id: 'allow-triaged',
    to: 'triaged',
    run: () => ({ ok: true }),
  });
  const moved = store.transitionCard(card.id, 'triaged');
  assert.equal(moved.status, 'triaged');
});

test('requirement cannot leave inbox without acceptance', () => {
  const store = tempStore();
  const project = store.createProject({ name: 'p' });
  const card = store.createCard({
    projectId: project.id,
    title: '无验收',
    body: '缺验收。',
  });
  assert.throws(() => store.transitionCard(card.id, 'triaged'), /without acceptance/);
});
