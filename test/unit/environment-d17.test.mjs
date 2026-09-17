import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AgentTaskError } from '../../lib/host/agents/types.js';
import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { TOOL_TEST, TOOL_TYPECHECK } from '../../lib/host/tools/registry.js';

function boardRoot() {
  return mkdtempSync(join(tmpdir(), 'huntianling-d17-board-'));
}

function workspace(scripts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d17-workspace-'));
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({
    name: 'd17-workspace',
    packageManager: 'pnpm@11.21.0',
    scripts: {
      typecheck: 'node -e "process.exit(Number(process.env.FAIL_TYPECHECK || 0))"',
      test: 'node -e "process.exit(0)"',
      lint: 'node -e "console.log(\\"HUNTIANLING_PROBE: no lint yet\\"); process.exit(1)"',
      hygiene: 'node -e "console.log(\\"HUNTIANLING_PROBE: no hygiene yet\\"); process.exit(1)"',
      ...scripts,
    },
  }, null, 2)}\n`);
  return root;
}

function d17EnvironmentConfig(extra = {}) {
  return {
    localExecution: 'enabled',
    commandTimeoutMs: 30_000,
    commandOutputLimit: 4_000,
    profile: {
      id: 'huntianling.d17-local',
      version: '2026-09-12.1',
      runtime: { node: '>=22', packageManager: 'pnpm' },
      requiredSkillIds: [],
      requiredToolIds: [TOOL_TYPECHECK, TOOL_TEST],
      allowedCapabilities: ['typecheck', 'test', 'lint', 'hygiene'],
      commands: [
        { id: 'typecheck', toolId: TOOL_TYPECHECK, command: 'pnpm run typecheck', required: true },
        { id: 'test', toolId: TOOL_TEST, command: 'pnpm run test', required: true },
        { id: 'lint', toolId: TOOL_TYPECHECK, command: 'pnpm run lint', required: false, probeMeansBlocked: true },
        { id: 'hygiene', toolId: TOOL_TYPECHECK, command: 'pnpm run hygiene', required: false, probeMeansBlocked: true },
      ],
    },
    ...extra,
  };
}

function readyStory(board, projectId) {
  const milestone = board.createMilestone({ projectId, title: 'D17' });
  return board.createWorkItem({
    projectId,
    milestoneId: milestone.id,
    type: 'story',
    title: 'Run a project-scoped implementation',
    body: 'Generator needs a real prepared workspace.',
    sourceInput: 'Implement after the environment is ready.',
    analysis: 'The environment profile must record command results.',
    design: 'Use project-scoped prepare evidence before Generator starts.',
    acceptance: ['Generator starts only after required checks pass'],
  });
}

test('a single versioned profile prepares two project workspaces with real command artifacts', () => {
  const board = createBoardService(boardRoot());
  const skills = createSkillService();
  const firstProject = board.createProject({ name: 'First project' });
  const secondProject = board.createProject({ name: 'Second project' });
  const firstRoot = workspace();
  const secondRoot = workspace();
  const environment = createEnvironmentService({
    skills,
    board,
    config: d17EnvironmentConfig(),
  });

  const first = environment.prepare({ workspaceRoot: firstRoot, projectId: firstProject.id });
  const second = environment.prepare({ workspaceRoot: secondRoot, projectId: secondProject.id });

  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.equal(first.profileId, second.profileId);
  assert.equal(first.profileVersion, second.profileVersion);
  assert.equal(first.baseline.typecheck, 'pass');
  assert.equal(first.baseline.test, 'pass');
  assert.equal(first.baseline.lint, 'blocked');
  assert.equal(first.baseline.hygiene, 'blocked');
  assert.equal(environment.canStartImplementation(firstRoot, firstProject.id), true);
  assert.equal(environment.canStartImplementation(secondRoot, firstProject.id), false);
  assert.equal(environment.lastPrepare(firstProject.id, firstRoot)?.prepareRunId, first.prepareRunId);
  assert.equal(environment.lastPrepare(firstProject.id, secondRoot), null);
  const typecheck = first.commands.find((command) => command.id === 'typecheck');
  assert.equal(typecheck?.exitCode, 0);
  assert.equal(typecheck?.status, 'pass');
  assert.equal(existsSync(typecheck?.artifacts[0] ?? ''), true);
  assert.ok(first.artifacts.some((artifact) => artifact.endsWith('environment-profile.json')));
});

test('a failed required check blocks Generator until the same project environment is repaired', () => {
  const board = createBoardService(boardRoot());
  const skills = createSkillService();
  const project = board.createProject({ name: 'D17 gate' });
  const story = readyStory(board, project.id);
  const root = workspace();
  const environment = createEnvironmentService({
    skills,
    board,
    config: d17EnvironmentConfig(),
  });

  const failed = environment.prepare({
    workspaceRoot: root,
    projectId: project.id,
    env: { FAIL_TYPECHECK: '1' },
  });
  assert.equal(failed.ready, false);
  assert.equal(failed.baseline.typecheck, 'fail');
  assert.equal(environment.canStartImplementation(root, project.id), false);

  const agents = createAgentRuntime({ skills, board, environment });
  assert.throws(
    () => agents.startRun({
      agentId: 'generator',
      executor: 'manual',
      projectId: project.id,
      workItemId: story.id,
      workspaceRoot: root,
      environmentReady: true,
      input: { outcome: story.title, acceptance: story.acceptance },
    }),
    (error) => error instanceof AgentTaskError && error.code === 'ENVIRONMENT',
  );

  const repaired = environment.prepare({
    workspaceRoot: root,
    projectId: project.id,
    env: { FAIL_TYPECHECK: '0' },
  });
  assert.equal(repaired.ready, true);
  assert.equal(environment.canStartImplementation(root, project.id), true);
  const generated = agents.startRun({
    agentId: 'generator',
    executor: 'manual',
    projectId: project.id,
    workItemId: story.id,
    workspaceRoot: root,
    input: { outcome: story.title, acceptance: story.acceptance },
  });
  assert.equal(generated.status, 'completed');
  assert.equal(generated.environmentReady, true);
});

test('missing executors and unavailable optional probes stay visible in prepare results', () => {
  const root = workspace();
  const skills = createSkillService();
  const blocked = createEnvironmentService({
    skills,
    config: d17EnvironmentConfig({ localExecution: 'disabled' }),
  }).prepare({ workspaceRoot: root });

  assert.equal(blocked.ready, false);
  assert.equal(blocked.commands.find((command) => command.id === 'typecheck')?.status, 'blocked');
  assert.ok(blocked.blockers.some((blocker) => blocker.kind === 'executor'));
  assert.ok(blocked.capabilityProbes.some((probe) => probe.id === 'executor:command-runner' && probe.status === 'blocked'));

  const probed = createEnvironmentService({
    skills,
    config: d17EnvironmentConfig(),
  }).prepare({ workspaceRoot: root });

  assert.equal(probed.ready, true);
  assert.equal(probed.baseline.lint, 'blocked');
  assert.equal(probed.baseline.hygiene, 'blocked');
  assert.equal(probed.blockers.some((blocker) => blocker.message.includes('lint')), false);
});

test('command output artifacts redact credential-like environment values', () => {
  const root = workspace({
    typecheck: 'node -e "console.log(process.env.DEEPSEEK_API_KEY)"',
  });
  const environment = createEnvironmentService({
    skills: createSkillService(),
    config: d17EnvironmentConfig(),
  });
  const result = environment.prepare({
    workspaceRoot: root,
    env: { DEEPSEEK_API_KEY: 'super-secret-value' },
  });
  const typecheck = result.commands.find((command) => command.id === 'typecheck');
  assert.equal(result.credentialPresence.includes('DEEPSEEK_API_KEY'), true);
  assert.equal(typecheck?.output.includes('super-secret-value'), false);
  assert.equal(typecheck?.output.includes('[redacted:DEEPSEEK_API_KEY]'), true);
  const commandArtifact = readFileSync(typecheck?.artifacts[0] ?? '', 'utf8');
  const profileArtifact = readFileSync(join(root, '.huntianling/environment-profile.json'), 'utf8');
  assert.equal(commandArtifact.includes('super-secret-value'), false);
  assert.equal(commandArtifact.includes('[redacted:DEEPSEEK_API_KEY]'), true);
  assert.equal(profileArtifact.includes('super-secret-value'), false);
});
