import test from 'node:test';
import assert from 'node:assert/strict';

import { MKT_PACK_SKILLS, MKT_REQUIRED_SKILL_IDS, MKT_SKILL_QUOTES } from '../../lib/host/skills/mkt-pack.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { SkillWriteError } from '../../lib/host/skills/types.js';

const validWrite = {
  quotes: [{ text: '客户只看自己的需求', source: 'customer' }],
  goal: 'Customer sees only their requirements',
  confirmed: true,
};

test('MKT pack skills declare boundary and depth 0-1 with default 1', () => {
  assert.equal(MKT_PACK_SKILLS.length, MKT_REQUIRED_SKILL_IDS.length);
  for (const skill of MKT_PACK_SKILLS) {
    assert.deepEqual(skill.supportedRoles, ['mkt']);
    assert.ok(skill.boundary.doesNotCover.includes('technical-design'));
    assert.ok(skill.boundary.doesNotCover.includes('code-change'));
    assert.ok(skill.boundary.doesNotCover.includes('acceptance-decision'));
    assert.equal(skill.depth.defaultLevel, 1);
    assert.deepEqual(
      skill.depth.levels.map((level) => level.id),
      [0, 1, 2, 3, 4],
    );
    assert.ok(skill.depth.levels[0].steps.every((step) => step.actor));
    assert.equal(skill.validationStatus, 'valid');
    assert.equal(skill.createdThroughSkillCreator, false);
  }
});

test('depth 0 and depth 1 writes record skill versions and tracking', () => {
  const skills = createSkillService();
  const depth0 = skills.writeOriginalRequirement(
    { ...validWrite, confirmed: false },
    { depth: 0, executor: 'manual' },
  );
  assert.equal(depth0.depthLevel, 0);
  assert.equal(depth0.tracked, false);
  assert.equal(depth0.executor, 'manual');
  assert.ok(depth0.skillIds.includes(MKT_SKILL_QUOTES));
  assert.ok(depth0.skillVersions.length > 0);

  const depth1 = skills.writeOriginalRequirement(validWrite, { depth: 1, executor: 'external-agent' });
  assert.equal(depth1.depthLevel, 1);
  assert.equal(depth1.tracked, true);
  assert.equal(depth1.confirmed, true);
});

test('write tool rejects missing source quotes and technical design', () => {
  const skills = createSkillService();
  assert.throws(
    () => skills.writeOriginalRequirement({ quotes: [], goal: 'x', confirmed: true }, { executor: 'manual', depth: 0 }),
    (error) => error instanceof SkillWriteError && error.code === 'VALIDATION' && /quotes/.test(error.message),
  );
  assert.throws(
    () =>
      skills.writeOriginalRequirement(
        { ...validWrite, technicalDesign: 'extract CSS' },
        { executor: 'manual', depth: 0 },
      ),
    (error) => error instanceof SkillWriteError && /technicalDesign/.test(error.message),
  );
});

test('missing required pack skill blocks collection complete', () => {
  const skills = createSkillService();
  skills.disableForProject('proj-1', MKT_SKILL_QUOTES);
  const coverage = skills.mktCoverage('proj-1');
  assert.equal(coverage.complete, false);
  assert.equal(coverage.gaps[0].skillId, MKT_SKILL_QUOTES);
  assert.throws(
    () => skills.writeOriginalRequirement(validWrite, { executor: 'manual', projectId: 'proj-1' }),
    (error) => error instanceof SkillWriteError && error.code === 'MISSING_SKILL' && error.gaps?.length === 1,
  );
});

test('repeated invalid depth 1 output requires depth 0', () => {
  const skills = createSkillService();
  const options = { executor: 'external-agent', depth: 1, failureKey: 'run-1' };
  const invalid = { quotes: [], goal: 'x', confirmed: true };
  assert.throws(() => skills.writeOriginalRequirement(invalid, options), /quotes/);
  assert.throws(() => skills.writeOriginalRequirement(invalid, options), /quotes/);
  assert.throws(
    () => skills.writeOriginalRequirement(invalid, options),
    (error) => error instanceof SkillWriteError && error.code === 'DEPTH_DOWNGRADE' && error.nextDepth === 0,
  );
  const recovered = skills.writeOriginalRequirement(
    { ...validWrite, confirmed: false },
    { executor: 'manual', depth: 0, failureKey: 'run-1' },
  );
  assert.equal(recovered.depthLevel, 0);
});

test('a skill without boundary or depth cannot be registered or enabled', () => {
  const skills = createSkillService();
  const valid = skills.get(MKT_SKILL_QUOTES);
  assert.throws(
    () =>
      skills.register({
        ...valid,
        id: 'mkt.broken',
        boundary: { ...valid.boundary, outputSchema: '', doesNotCover: [] },
      }),
    (error) => error instanceof SkillWriteError && error.code === 'ENABLE',
  );
  assert.throws(
    () =>
      skills.register({
        ...valid,
        id: 'mkt.no-depth',
        depth: { defaultLevel: 1, levels: [] },
      }),
    (error) => error instanceof SkillWriteError && error.code === 'ENABLE',
  );
});

test('skill registry keeps version history', () => {
  const skills = createSkillService();
  const current = skills.get(MKT_SKILL_QUOTES);
  skills.register({ ...current, version: '1.0.1' });
  assert.equal(skills.get(MKT_SKILL_QUOTES).version, '1.0.1');
  assert.deepEqual(
    skills.history(MKT_SKILL_QUOTES).map((item) => item.version),
    ['1.0.0', '1.0.1'],
  );
});
