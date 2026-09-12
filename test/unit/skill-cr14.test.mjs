import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { SkillWriteError } from '../../lib/host/skills/types.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function workspace() {
  return mkdtempSync(join(tmpdir(), 'huntianling-cr14-'));
}

function validatedDraft(skills, templateId = 'documentation') {
  const draft = skills.draftSkill({ templateId });
  skills.validateDraft(draft.id);
  return skills.getDraft(draft.id);
}

test('validating a draft does not register it for agent execution', () => {
  const skills = createSkillService();
  const draft = validatedDraft(skills);
  assert.equal(draft.validationStatus, 'valid');
  assert.equal(skills.get(draft.id), undefined);
  assert.equal(skills.list().some((skill) => skill.id === draft.id), false);
});

test('a validated draft can be enabled for a project and used on an agent run', () => {
  const skills = createSkillService();
  const draft = validatedDraft(skills);
  const live = skills.enableDraft(draft.id, 'p1');
  assert.equal(live.createdThroughSkillCreator, true);
  assert.equal(skills.get(live.id).id, live.id);
  assert.equal(skills.isEnabled('p1', live.id), true);
  const agents = createAgentRuntime({ skills });
  const run = agents.startRun({
    agentId: 'generator',
    executor: 'manual',
    environmentReady: true,
    projectId: 'p1',
    skillIds: [live.id],
    input: { outcome: '登录壳', acceptance: ['可登录'] },
  });
  assert.equal(run.status, 'completed');
  assert.ok(run.skillIds.includes(live.id));
});

test('an unvalidated draft still cannot be enabled', () => {
  const skills = createSkillService();
  const draft = skills.draftSkill({ templateId: 'documentation' });
  assert.throws(
    () => skills.enableDraft(draft.id, 'p1'),
    (error) => error instanceof SkillWriteError && error.code === 'GATED',
  );
});

test('enabling for one project does not enable it for another project', () => {
  const skills = createSkillService();
  const draft = validatedDraft(skills);
  skills.enableDraft(draft.id, 'p1');
  assert.equal(skills.isEnabled('p1', draft.id), true);
  assert.equal(skills.isEnabled('p2', draft.id), false);
});

test('enabling one draft does not enable other drafts', () => {
  const skills = createSkillService();
  const first = validatedDraft(skills, 'documentation');
  const second = validatedDraft(skills, 'code-review');
  skills.enableDraft(first.id, 'p1');
  assert.equal(skills.get(second.id), undefined);
  assert.equal(skills.isEnabled('p1', second.id), false);
});

test('enabled skill-creator versions are retained in history', () => {
  const skills = createSkillService();
  const draft = validatedDraft(skills);
  skills.enableDraft(draft.id, 'p1');
  skills.enableDraft(draft.id, 'p1');
  assert.equal(skills.history(draft.id).length, 2);
  assert.notEqual(skills.history(draft.id)[0].version, skills.history(draft.id)[1].version);
});

test('enabled drafts survive process reload', () => {
  const root = workspace();
  const first = createSkillService({ workspaceRoot: root });
  const draft = validatedDraft(first);
  first.enableDraft(draft.id, 'p1');
  const second = createSkillService({ workspaceRoot: root });
  assert.equal(second.get(draft.id)?.createdThroughSkillCreator, true);
  assert.equal(second.isEnabled('p1', draft.id), true);
  assert.equal(second.isEnabled('p2', draft.id), false);
});

test('customers cannot enable skill drafts', async (t) => {
  const root = workspace();
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const skills = createSkillService();
  const hash = createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(3),
  });
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), skills },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] }],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const enabled = await fetch(`${status.url}/api/v1/skills/drafts/x/enable`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: project.id }),
  });
  assert.equal(enabled.status, 403);
});
