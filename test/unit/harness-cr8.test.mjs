import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { HUNTIANLING_NODE_PNPM_PROFILE } from '../../lib/host/environment/profile.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { createHarnessService } from '../../lib/host/harness/service.js';
import { HarnessError } from '../../lib/host/harness/types.js';
import { SKILL_PLANNER_CONTRACT } from '../../lib/host/skills/coding-pack.js';
import { MKT_SKILL_EXTRACT, MKT_SKILL_QUOTES } from '../../lib/host/skills/mkt-pack.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { SkillWriteError } from '../../lib/host/skills/types.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

const PASS_INPUT = {
  quotes: [{ text: '客户只看自己的需求', source: 'customer' }],
  goal: 'Customer sees only their requirements',
  confirmed: true,
};

const DEPTH3_INPUT = {
  ...PASS_INPUT,
  actors: ['customer'],
  scenarios: ['sees own requirements'],
};

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr8-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'sample',
    scripts: { build: 'tsc -b', test: 'node --test' },
    dependencies: { react: '19.0.0' },
  }, null, 2));
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  writeFileSync(join(root, 'tsconfig.json'), '{}\n');
  writeFileSync(join(root, 'README.md'), '# sample\n');
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'name: ci\n');
  return root;
}

test('environment prepare scans language, package manager, build, test, CI, and documentation and requires coding Skills besides MKT', () => {
  const root = workspace();
  const env = createEnvironmentService({ skills: createSkillService() });
  const result = env.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: () => ({ status: 'pass', output: 'ok' }),
  });
  const coverage = env.skillCoverage('', root);
  assert.equal(result.ready, true);
  assert.ok(coverage.required.includes(MKT_SKILL_QUOTES));
  assert.ok(coverage.required.includes(SKILL_PLANNER_CONTRACT));
  assert.equal(coverage.scan.language, 'typescript');
  assert.equal(coverage.scan.framework, 'react');
  assert.equal(coverage.scan.packageManager, 'pnpm');
  assert.equal(coverage.scan.buildCommand, 'tsc -b');
  assert.equal(coverage.scan.testCommand, 'node --test');
  assert.equal(coverage.scan.ciConfig, '.github/workflows');
  assert.equal(coverage.scan.documentation, 'README.md');
  assert.equal(coverage.complete, true);
});

test('a missing, unvalidated, or tool-blocked required Skill is a coverage gap and blocks claiming support', () => {
  const root = workspace();
  const skills = createSkillService();
  const template = skills.get(MKT_SKILL_QUOTES);
  skills.register({
    ...template,
    id: 'custom.unvalidated',
    validationStatus: 'unvalidated',
  });
  skills.register({
    ...template,
    id: 'custom.blocked',
    requiredTools: ['missing.tool'],
    boundary: { ...template.boundary, requiredTools: ['missing.tool'] },
  });
  const env = createEnvironmentService({ skills });
  const missing = env.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: () => ({ status: 'pass', output: 'ok' }),
    profile: { ...HUNTIANLING_NODE_PNPM_PROFILE, requiredSkillIds: ['custom.missing'] },
  });
  assert.equal(missing.ready, false);
  assert.ok(missing.skillGaps.some((gap) => gap.kind === 'missing'));
  const unvalidated = env.skillCoverage('', root);
  const unvalidatedProfile = env.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: () => ({ status: 'pass', output: 'ok' }),
    profile: { ...HUNTIANLING_NODE_PNPM_PROFILE, requiredSkillIds: ['custom.unvalidated'] },
  });
  assert.ok(unvalidatedProfile.skillGaps.some((gap) => gap.kind === 'unvalidated'));
  const blocked = env.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: () => ({ status: 'pass', output: 'ok' }),
    profile: { ...HUNTIANLING_NODE_PNPM_PROFILE, requiredSkillIds: ['custom.blocked'] },
  });
  assert.ok(blocked.skillGaps.some((gap) => gap.kind === 'blocked-by-tool'));
  skills.disableForProject('proj', SKILL_PLANNER_CONTRACT);
  assert.equal(env.canStartImplementation(root, 'proj'), false);
  assert.equal(unvalidated.required.includes(SKILL_PLANNER_CONTRACT), true);
});

test('depth 2, 3, and 4 writes use their sensors instead of a longer prompt', () => {
  const skills = createSkillService();
  skills.markCalibrated(MKT_SKILL_EXTRACT, 2);
  skills.markCalibrated(MKT_SKILL_EXTRACT, 3);
  skills.markCalibrated(MKT_SKILL_EXTRACT, 4);
  const depth2 = skills.writeOriginalRequirement(PASS_INPUT, { depth: 2, executor: 'manual' });
  assert.equal(depth2.depthLevel, 2);
  assert.ok(depth2.openQuestions.some((item) => /actor/i.test(item)));
  assert.throws(
    () => skills.writeOriginalRequirement(PASS_INPUT, { depth: 3, executor: 'manual' }),
    (error) => error instanceof SkillWriteError && error.code === 'VALIDATION' && /actors/.test(error.message),
  );
  const depth3 = skills.writeOriginalRequirement(DEPTH3_INPUT, { depth: 3, executor: 'manual' });
  assert.equal(depth3.depthLevel, 3);
  const depth4 = skills.writeOriginalRequirement(DEPTH3_INPUT, { depth: 4, executor: 'manual' });
  assert.equal(depth4.depthLevel, 4);
});

test('an uncalibrated depth 2-4 product write is rejected until a comparison is promoted', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr8-cal-'));
  const skills = createSkillService();
  assert.throws(
    () => skills.writeOriginalRequirement(PASS_INPUT, { depth: 2, executor: 'manual' }),
    (error) => error instanceof SkillWriteError && error.code === 'NOT_CALIBRATED',
  );
  const harness = createHarnessService({ skills, workspaceRoot: root });
  const comparison = harness.compare({
    baselineDepth: 1,
    candidateDepth: 2,
    threshold: { minAcceptedScopeRate: 1, maxEscapedDefects: 0, maxFalseRejections: 0 },
  });
  assert.equal(comparison.meetsThreshold, true);
  harness.promote(comparison.id);
  const written = skills.writeOriginalRequirement(PASS_INPUT, { depth: 2, executor: 'manual' });
  assert.equal(written.depthLevel, 2);
});

test('repeated invalid output at a higher depth lowers depth or stops', () => {
  const skills = createSkillService();
  skills.markCalibrated(MKT_SKILL_EXTRACT, 3);
  const options = { executor: 'external-agent', depth: 3, failureKey: 'run-3' };
  assert.throws(() => skills.writeOriginalRequirement(PASS_INPUT, options), SkillWriteError);
  assert.throws(() => skills.writeOriginalRequirement(PASS_INPUT, options), SkillWriteError);
  assert.throws(
    () => skills.writeOriginalRequirement(PASS_INPUT, options),
    (error) => error instanceof SkillWriteError && error.code === 'DEPTH_DOWNGRADE' && error.nextDepth === 2,
  );
});

test('live-model trials can repeat when a model endpoint is configured and fail loud when it is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr8-live-'));
  const skills = createSkillService();
  const missing = createHarnessService({ skills, workspaceRoot: root });
  assert.throws(
    () => missing.runTrial({ scenarioId: 'mkt.collect.pass', depth: 1, modelBinding: 'live-model' }),
    (error) => error instanceof HarnessError && error.code === 'NOT_READY',
  );
  const harness = createHarnessService({
    skills,
    workspaceRoot: root,
    liveModel: {
      url: 'https://example.test/v1/chat/completions',
      model: 'demo',
      token: 'secret-token',
      transport: (request) => {
        assert.match(request.headers.authorization, /Bearer secret-token/);
        return {
          status: 200,
          body: JSON.stringify({
            choices: [{ message: { content: JSON.stringify(PASS_INPUT) } }],
            usage: { total_tokens: 42 },
          }),
        };
      },
    },
  });
  const trials = harness.repeatTrials({
    scenarioId: 'mkt.collect.pass',
    depth: 1,
    repeats: 3,
    modelBinding: 'live-model',
  });
  assert.equal(trials.length, 3);
  assert.equal(trials.every((trial) => trial.modelBinding === 'live-model'), true);
  assert.equal(trials.every((trial) => trial.tokenCost === 42), true);
  const persisted = readFileSync(join(root, '.huntianling', 'harness.json'), 'utf8');
  assert.equal(persisted.includes('secret-token'), false);
});

test('orchestration replay stays distinct from a live-model trial', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr8-replay-'));
  const skills = createSkillService();
  const harness = createHarnessService({
    skills,
    workspaceRoot: root,
    liveModel: {
      url: 'https://example.test/v1/chat/completions',
      model: 'demo',
      token: 'secret-token',
      transport: () => ({
        status: 200,
        body: JSON.stringify({
          choices: [{ message: { content: JSON.stringify(PASS_INPUT) } }],
          usage: { total_tokens: 7 },
        }),
      }),
    },
  });
  const live = harness.runTrial({ scenarioId: 'mkt.collect.pass', depth: 1, modelBinding: 'live-model' });
  const replay = harness.runTrial({ scenarioId: 'mkt.collect.pass', depth: 1, mode: 'replay' });
  assert.equal(live.modelBinding, 'live-model');
  assert.equal(replay.mode, 'replay');
  assert.ok(replay.artifacts.includes('orchestration-replay'));
  assert.notEqual(replay.id, live.id);
});

test('self-development demonstration steps are labeled manual, external-agent, or HuntianLing-runtime', () => {
  const root = workspace();
  const skills = createSkillService();
  const board = createBoardService(root);
  const environment = createEnvironmentService({ skills, board });
  const agents = createAgentRuntime({ skills, board });
  const harness = createHarnessService({ skills, workspaceRoot: root, board, agents, environment });
  const demo = harness.demonstrateSelfDevelopment({
    owner: 'maintainer',
    stepExecutors: { plan: 'external-agent', implement: 'manual', evaluate: 'huntianling-runtime' },
  });
  assert.equal(demo.steps.find((step) => step.name === 'environment.prepare').executor, 'huntianling-runtime');
  assert.equal(demo.steps.find((step) => step.name === 'plan').executor, 'external-agent');
  assert.equal(demo.steps.find((step) => step.name === 'implement').executor, 'manual');
  assert.equal(demo.steps.find((step) => step.name === 'evaluate-pass').executor, 'huntianling-runtime');
  assert.equal(demo.steps.find((step) => step.name === 'live-model-trials').executor, 'manual');
  assert.equal(demo.steps.find((step) => step.name === 'live-model-trials').result, 'unbound');
  assert.ok(demo.steps.some((step) => step.name === 'skill-coverage'));
  assert.equal(demo.gates.lint, 'blocked');
});

test('customers cannot run harness comparisons or coverage scans', async (t) => {
  const root = workspace();
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const requirements = createRequirementManagementService(board);
  const skills = createSkillService();
  const environment = createEnvironmentService({ skills, board });
  const agents = createAgentRuntime({ skills, board });
  const harness = createHarnessService({ skills, workspaceRoot: root, board, agents, environment });
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(8) });
  const web = createWebService(
    { board, requirements, environment, harness },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const customerLogin = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = customerLogin.headers.get('set-cookie')?.split(';')[0];
  const coverage = await fetch(`${status.url}/api/v1/projects/${project.id}/skill-coverage`, { headers: { cookie } });
  assert.equal(coverage.status, 403);
  const trials = await fetch(`${status.url}/api/v1/harness/trials`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ scenarioId: 'mkt.collect.pass', depth: 1, repeats: 2 }),
  });
  assert.equal(trials.status, 403);

  const developerLogin = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const devCookie = developerLogin.headers.get('set-cookie')?.split(';')[0];
  const allowed = await fetch(`${status.url}/api/v1/projects/${project.id}/skill-coverage`, { headers: { cookie: devCookie } });
  assert.equal(allowed.status, 200);
  const payload = await allowed.json();
  assert.ok(payload.required.includes(SKILL_PLANNER_CONTRACT));
  assert.ok(payload.scan);
});
