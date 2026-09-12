import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { AGILE_SKILL_KINDS } from '../../lib/host/skills/types.js';
import { SkillWriteError } from '../../lib/host/skills/types.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

test('skill-creator drafts a skill from an agile template without enabling it', () => {
  const skills = createSkillService();
  const before = skills.list().map((skill) => skill.id);
  const draft = skills.draftSkill({ templateId: 'requirement-intake' });
  assert.equal(draft.createdThroughSkillCreator, true);
  assert.equal(draft.validationStatus, 'unvalidated');
  assert.equal(skills.get(draft.id), undefined);
  assert.equal(skills.list().some((skill) => skill.id === draft.id), false);
  assert.deepEqual(skills.list().map((skill) => skill.id), before);
});

test('the template catalog covers the agile skill kinds', () => {
  const skills = createSkillService();
  const templates = skills.listTemplates();
  assert.equal(templates.length, AGILE_SKILL_KINDS.length);
  for (const kind of AGILE_SKILL_KINDS) {
    assert.ok(templates.some((row) => row.kind === kind), kind);
  }
});

test('validating a draft records the result in agent_skill_validations', () => {
  const skills = createSkillService();
  const draft = skills.draftSkill({ templateId: 'code-review' });
  const record = skills.validateDraft(draft.id);
  assert.equal(record.source, 'skill-creator');
  assert.equal(record.status, 'valid');
  assert.equal(record.issues.length, 0);
  assert.equal(skills.listValidations(draft.id).length, 1);
  assert.equal(skills.getDraft(draft.id).validationStatus, 'valid');
});

test('an invalid or unvalidated draft cannot be enabled for agent execution', () => {
  const skills = createSkillService();
  const unvalidated = skills.draftSkill({ templateId: 'analysis' });
  assert.throws(
    () => skills.enableDraft(unvalidated.id, 'p1'),
    (error) => error instanceof SkillWriteError && error.code === 'GATED',
  );
  skills.updateDraft(unvalidated.id, { doesNotCover: [] });
  const invalid = skills.validateDraft(unvalidated.id);
  assert.equal(invalid.status, 'invalid');
  assert.ok(invalid.issues.length > 0);
  assert.throws(
    () => skills.enableDraft(unvalidated.id, 'p1'),
    (error) => error instanceof SkillWriteError && error.code === 'GATED',
  );
  const ready = skills.draftSkill({ templateId: 'documentation' });
  skills.validateDraft(ready.id);
  const live = skills.enableDraft(ready.id, 'p1');
  assert.equal(live.validationStatus, 'valid');
  assert.equal(skills.get(ready.id).id, ready.id);
  assert.equal(skills.isEnabled('p1', ready.id), true);
});

test('customers cannot create, validate, or enable skill drafts', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-skill-creator-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const skills = createSkillService();
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(8) });
  const web = createWebService(
    { board, requirements, skills },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
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
  const drafted = await fetch(`${status.url}/api/v1/skills/drafts`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ templateId: 'requirement-intake' }),
  });
  assert.equal(drafted.status, 403);
  const validated = await fetch(`${status.url}/api/v1/skills/drafts/x/validate`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(validated.status, 403);
  const enabled = await fetch(`${status.url}/api/v1/skills/drafts/x/enable`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: project.id }),
  });
  assert.equal(enabled.status, 403);
});
