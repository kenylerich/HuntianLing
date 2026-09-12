import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { createHarnessService } from '../../lib/host/harness/service.js';
import { HarnessError } from '../../lib/host/harness/types.js';
import { MKT_SKILL_EXTRACT } from '../../lib/host/skills/mkt-pack.js';
import { createSkillService } from '../../lib/host/skills/service.js';

function workspace() {
  return mkdtempSync(join(tmpdir(), 'huntianling-harness-'));
}

function harness(root, extras = {}) {
  const skills = extras.skills ?? createSkillService();
  return createHarnessService({
    skills,
    workspaceRoot: root,
    ...extras,
  });
}

test('comparison records pass, fail, and cancelled trials and keeps token cost unknown', () => {
  const service = harness(workspace());
  const comparison = service.compare();
  assert.equal(comparison.changedMechanism, 'skill-depth');
  assert.equal(comparison.baselineDepth, 0);
  assert.equal(comparison.candidateDepth, 1);
  assert.equal(comparison.candidateTrials.some((trial) => trial.kind === 'pass'), true);
  assert.equal(comparison.candidateTrials.some((trial) => trial.kind === 'fail'), true);
  assert.equal(comparison.candidateTrials.some((trial) => trial.kind === 'cancel'), true);
  assert.equal(comparison.candidateTrials.every((trial) => trial.tokenCost === null), true);
  assert.equal(comparison.meetsThreshold, true);
  assert.equal(comparison.promoted, false);
  assert.equal(service.isPromoted(MKT_SKILL_EXTRACT, 1), false);
});

test('orchestration replay is distinct from a fresh trial', () => {
  const service = harness(workspace());
  const fresh = service.runTrial({ scenarioId: 'mkt.collect.pass', depth: 1, mode: 'fresh' });
  const replay = service.runTrial({ scenarioId: 'mkt.collect.pass', depth: 1, mode: 'replay' });
  assert.equal(fresh.mode, 'fresh');
  assert.equal(replay.mode, 'replay');
  assert.ok(replay.artifacts.includes('orchestration-replay'));
  assert.equal(replay.outcome, fresh.outcome);
  assert.notEqual(replay.id, fresh.id);
});

test('promotion requires a comparison that already met a predeclared threshold', () => {
  const service = harness(workspace());
  const passing = service.compare({
    threshold: { minAcceptedScopeRate: 1, maxEscapedDefects: 0, maxFalseRejections: 0 },
  });
  assert.equal(passing.meetsThreshold, true);
  const promoted = service.promote(passing.id);
  assert.equal(promoted.promoted, true);
  assert.equal(service.isPromoted(MKT_SKILL_EXTRACT, 1), true);

  const missing = service.compare({
    candidateDepth: 3,
    threshold: { minAcceptedScopeRate: 1, maxEscapedDefects: 0, maxFalseRejections: 0 },
  });
  assert.equal(missing.meetsThreshold, false);
  assert.throws(
    () => service.promote(missing.id),
    (error) => error instanceof HarnessError && error.code === 'THRESHOLD',
  );
  assert.equal(service.isPromoted(MKT_SKILL_EXTRACT, 3), false);
});

test('self-development demonstration records fail, repair, interrupt, resume, and evidence progress', () => {
  const root = workspace();
  const skills = createSkillService();
  const board = createBoardService(root);
  const environment = createEnvironmentService({ skills, board });
  const agents = createAgentRuntime({ skills, board });
  const service = harness(root, { skills, board, environment, agents });
  const demo = service.demonstrateSelfDevelopment({
    owner: 'maintainer',
    selfHarnessSliceRefs: ['b10-story-delivery'],
  });
  assert.deepEqual(demo.reqIds, ['REQ-HARNESS-004', 'REQ-HARNESS-005']);
  assert.equal(demo.customerProgress, 'delivered');
  assert.equal(demo.gates.lint, 'blocked');
  assert.equal(demo.gates.hygiene, 'blocked');
  assert.notEqual(demo.gates.lint, 'pass');
  assert.equal(demo.freshProjectReady, true);
  assert.ok(demo.gaps.some((gap) => /live model/.test(gap)));
  assert.ok(demo.steps.some((step) => step.name === 'interrupt'));
  assert.ok(demo.steps.some((step) => step.name === 'evaluate-fail-repair'));
  assert.equal(demo.selfHarnessSliceRefs[0], 'b10-story-delivery');
  assert.equal(service.listDemonstrations().length, 1);
});
