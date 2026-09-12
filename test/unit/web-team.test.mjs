import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(7),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test('customers cannot change the roster, roles, participants, or WIP policies', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-team-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: '团队项目' });
  const member = board.createTeamMember({
    projectId: project.id,
    displayName: 'Dev',
    roleIds: ['developer'],
  });
  const milestone = board.createMilestone({ projectId: project.id, title: 'M' });
  const story = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'ready',
    title: '登录',
    body: '客户能登录',
    analysis: '分析',
    design: '设计',
    acceptance: ['可以登录'],
    milestoneId: milestone.id,
  });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();

  const customerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const customerCookie = customerLogin.response.headers.get('set-cookie')?.split(';')[0];

  const deniedMember = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/team/members`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Other', roleIds: ['developer'] }),
  });
  assert.equal(deniedMember.response.status, 403);

  const deniedRole = await json(`${status.url}/api/v1/team/members/${encodeURIComponent(member.id)}/roles`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ roleId: 'product-owner' }),
  });
  assert.equal(deniedRole.response.status, 403);

  const deniedReviewer = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/reviewers`, {
    method: 'POST',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ memberId: member.id }),
  });
  assert.equal(deniedReviewer.response.status, 403);

  const deniedPolicies = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/team/wip-policies`, {
    method: 'PATCH',
    headers: { cookie: customerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ policies: [] }),
  });
  assert.equal(deniedPolicies.response.status, 403);

  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const added = await json(`${status.url}/api/v1/team/members/${encodeURIComponent(member.id)}/roles`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ roleId: 'product-owner' }),
  });
  assert.equal(added.response.status, 200);
  assert.ok(added.payload.roleIds.includes('product-owner'));

  const reviewer = await json(`${status.url}/api/v1/work-items/${encodeURIComponent(story.id)}/reviewers`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ memberId: member.id }),
  });
  assert.equal(reviewer.response.status, 200);
  assert.deepEqual(reviewer.payload.reviewerIds, [member.id]);

  const policies = await json(`${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/team/wip-policies`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      policies: [{ kind: 'work-item', scope: 'role', scopeId: 'developer', limit: 2 }],
    }),
  });
  assert.equal(policies.response.status, 200);
  assert.equal(policies.payload.wipPolicies[0].limit, 2);
});
