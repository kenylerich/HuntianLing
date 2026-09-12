import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';

function readyStory(store, projectId, fields = {}) {
  const milestone = store.listMilestones({ projectId })[0]
    ?? store.createMilestone({ projectId, title: 'Ready gate' });
  return store.createWorkItem({
    projectId,
    type: 'story',
    status: 'ready',
    title: fields.title ?? '可交付 Story',
    body: fields.body ?? '可以分配。',
    analysis: '分析已完成。',
    design: '设计已完成。',
    acceptance: ['可以交付'],
    milestoneId: milestone.id,
    ...fields,
  });
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-team-roster-'));
  const store = createBoardService(root);
  const project = store.createProject({ name: 'p' });
  return { root, store, project };
}

test('a project can add a role to a team member and the change is audited', () => {
  const { store, project } = setup();
  const member = store.createTeamMember({
    projectId: project.id,
    displayName: 'Dev',
    roleIds: ['developer'],
  });
  const updated = store.addTeamMemberRole(member.id, 'product-owner');
  assert.deepEqual(updated.roleIds, ['developer', 'product-owner']);
  const events = store.listAuditEvents({ projectId: project.id, action: 'team_member.role_added' });
  assert.equal(events.length, 1);
  assert.equal(events[0].targetId, member.id);
});

test('a project can remove a role from a team member and the change is audited', () => {
  const { store, project } = setup();
  const member = store.createTeamMember({
    projectId: project.id,
    displayName: 'Dev',
    roleIds: ['developer', 'product-owner'],
  });
  const updated = store.removeTeamMemberRole(member.id, 'product-owner');
  assert.deepEqual(updated.roleIds, ['developer']);
  assert.equal(store.listAuditEvents({ projectId: project.id, action: 'team_member.role_removed' }).length, 1);
});

test('a WorkItem can add and remove reviewers, approvers, and watchers from the project roster', () => {
  const { store, project } = setup();
  const reviewer = store.createTeamMember({
    projectId: project.id,
    displayName: 'Reviewer',
    roleIds: ['process-steward'],
  });
  const approver = store.createTeamMember({
    projectId: project.id,
    displayName: 'Approver',
    roleIds: ['product-owner'],
  });
  const watcher = store.createTeamMember({
    projectId: project.id,
    displayName: 'Watcher',
    status: 'observer',
    roleIds: ['developer'],
  });
  const story = readyStory(store, project.id);
  assert.deepEqual(store.addWorkItemReviewer(story.id, reviewer.id).reviewerIds, [reviewer.id]);
  assert.deepEqual(store.addWorkItemApprover(story.id, approver.id).approverIds, [approver.id]);
  assert.deepEqual(store.addWorkItemWatcher(story.id, watcher.id).watcherIds, [watcher.id]);
  assert.deepEqual(store.removeWorkItemReviewer(story.id, reviewer.id).reviewerIds, []);
  assert.deepEqual(store.removeWorkItemApprover(story.id, approver.id).approverIds, []);
  assert.deepEqual(store.removeWorkItemWatcher(story.id, watcher.id).watcherIds, []);
});

test('unknown roles or members from another project fail loud', () => {
  const { store, project } = setup();
  const other = store.createProject({ name: 'other' });
  const local = store.createTeamMember({
    projectId: project.id,
    displayName: 'Local',
    roleIds: ['developer'],
  });
  const foreign = store.createTeamMember({
    projectId: other.id,
    displayName: 'Foreign',
    roleIds: ['developer'],
  });
  const story = readyStory(store, project.id);
  assert.throws(() => store.addTeamMemberRole(local.id, 'missing-role'), /role not found/);
  assert.throws(() => store.addWorkItemReviewer(story.id, foreign.id), /another project/);
});

test('role, repository, CI, and environment WIP policies block a new assignment when the limit is reached', () => {
  const { store, project } = setup();
  const alice = store.createTeamMember({
    projectId: project.id,
    displayName: 'Alice',
    memberType: 'human',
    roleIds: ['developer'],
    concurrentWorkLimit: 10,
  });
  const bob = store.createTeamMember({
    projectId: project.id,
    displayName: 'Bob',
    memberType: 'human',
    roleIds: ['developer'],
    concurrentWorkLimit: 10,
  });
  store.replaceTeamWipPolicies(project.id, [
    { kind: 'work-item', scope: 'role', scopeId: 'developer', limit: 1 },
    { kind: 'repository', scope: 'project', scopeId: 'app', limit: 1 },
    { kind: 'ci', scope: 'project', scopeId: 'github-actions', limit: 1 },
    { kind: 'environment', scope: 'project', scopeId: 'node-pnpm', limit: 1 },
  ]);
  const first = readyStory(store, project.id, { title: '第一条' });
  store.updateWorkItem(first.id, {
    wipResources: [
      { kind: 'repository', id: 'app' },
      { kind: 'ci', id: 'github-actions' },
      { kind: 'environment', id: 'node-pnpm' },
    ],
  });
  store.assignWorkItem(first.id, { memberId: alice.id, roleId: 'developer' });
  const second = readyStory(store, project.id, { title: '第二条' });
  store.updateWorkItem(second.id, {
    wipResources: [
      { kind: 'repository', id: 'app' },
      { kind: 'ci', id: 'github-actions' },
      { kind: 'environment', id: 'node-pnpm' },
    ],
  });
  assert.throws(
    () => store.assignWorkItem(second.id, { memberId: bob.id, roleId: 'developer' }),
    /WIP policy/,
  );
});

test('humans and agents can use different WIP policies', () => {
  const { store, project } = setup();
  const human = store.createTeamMember({
    projectId: project.id,
    displayName: 'Human',
    memberType: 'human',
    roleIds: ['developer'],
    concurrentWorkLimit: 10,
  });
  const agent = store.createTeamMember({
    projectId: project.id,
    displayName: 'Agent',
    memberType: 'agent',
    roleIds: ['developer'],
    concurrentWorkLimit: 10,
  });
  store.replaceTeamWipPolicies(project.id, [
    { kind: 'work-item', scope: 'member-type', scopeId: 'agent', limit: 1 },
    { kind: 'work-item', scope: 'member-type', scopeId: 'human', limit: 2 },
  ]);
  const one = readyStory(store, project.id, { title: 'Agent 1' });
  store.assignWorkItem(one.id, { memberId: agent.id, roleId: 'developer' });
  const two = readyStory(store, project.id, { title: 'Agent 2' });
  assert.throws(
    () => store.assignWorkItem(two.id, { memberId: agent.id, roleId: 'developer' }),
    /member-type:agent/,
  );
  const humanOne = readyStory(store, project.id, { title: 'Human 1' });
  store.assignWorkItem(humanOne.id, { memberId: human.id, roleId: 'developer' });
  const humanTwo = readyStory(store, project.id, { title: 'Human 2' });
  assert.equal(
    store.assignWorkItem(humanTwo.id, { memberId: human.id, roleId: 'developer' }).assignee,
    human.id,
  );
});

test('the team capacity view shows overload warnings from those policies', () => {
  const { store, project } = setup();
  const member = store.createTeamMember({
    projectId: project.id,
    displayName: 'Dev',
    roleIds: ['developer'],
    concurrentWorkLimit: 10,
  });
  store.replaceTeamWipPolicies(project.id, [
    { kind: 'work-item', scope: 'role', scopeId: 'developer', limit: 1 },
  ]);
  const story = readyStory(store, project.id);
  store.assignWorkItem(story.id, { memberId: member.id, roleId: 'developer' });
  const capacity = store.getTeamCapacity(project.id);
  assert.ok(capacity.warnings.includes('role_over_wip_limit'));
});
