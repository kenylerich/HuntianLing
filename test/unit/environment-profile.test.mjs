import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { HUNTIANLING_NODE_PNPM_PROFILE } from '../../lib/host/environment/profile.js';
import { createEnvironmentService } from '../../lib/host/environment/service.js';
import { SKILL_PLANNER_CONTRACT } from '../../lib/host/skills/coding-pack.js';
import { MKT_SKILL_QUOTES } from '../../lib/host/skills/mkt-pack.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { TOOL_GIT_PUSH, TOOL_TYPECHECK } from '../../lib/host/tools/registry.js';
import { ToolDeniedError } from '../../lib/host/tools/types.js';

function workspace(withPackage = true) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-env-'));
  if (withPackage) writeFileSync(join(root, 'package.json'), '{"name":"sample"}\n');
  return root;
}

function passingRunner(command) {
  if (command.includes('lint') || command.includes('hygiene')) {
    return { status: 'fail', output: 'HUNTIANLING_PROBE: no lint yet' };
  }
  return { status: 'pass', output: 'ok' };
}

test('profile records version, commands, skills, and tools', () => {
  assert.equal(HUNTIANLING_NODE_PNPM_PROFILE.id, 'huntianling.node-pnpm');
  assert.equal(HUNTIANLING_NODE_PNPM_PROFILE.version, '1.0.0');
  assert.ok(HUNTIANLING_NODE_PNPM_PROFILE.commands.some((item) => item.id === 'typecheck' && item.required));
  assert.ok(HUNTIANLING_NODE_PNPM_PROFILE.requiredSkillIds.includes(MKT_SKILL_QUOTES));
  assert.ok(HUNTIANLING_NODE_PNPM_PROFILE.requiredSkillIds.includes(SKILL_PLANNER_CONTRACT));
  assert.ok(HUNTIANLING_NODE_PNPM_PROFILE.requiredToolIds.includes(TOOL_TYPECHECK));
});

test('prepare reports ready when required checks pass and does not persist secrets', () => {
  const root = workspace();
  const env = createEnvironmentService({ skills: createSkillService() });
  const result = env.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
    env: { DEEPSEEK_API_KEY: 'super-secret' },
  });
  assert.equal(result.ready, true);
  assert.equal(result.skillGaps.length, 0);
  assert.equal(result.profileVersion, '1.0.0');
  assert.equal(result.baseline.typecheck, 'pass');
  assert.equal(result.baseline.lint, 'blocked');
  assert.deepEqual(result.credentialPresence, ['DEEPSEEK_API_KEY']);
  const persisted = readFileSync(join(root, '.huntianling/environment-profile.json'), 'utf8');
  assert.equal(persisted.includes('super-secret'), false);
  assert.match(persisted, /DEEPSEEK_API_KEY/);
});

test('missing package.json is a dependency blocker', () => {
  const env = createEnvironmentService({ skills: createSkillService() });
  const result = env.prepare({
    workspaceRoot: workspace(false),
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  assert.equal(result.ready, false);
  assert.equal(result.blockers[0].kind, 'dependency');
});

test('the same profile prepares a second workspace', () => {
  const env = createEnvironmentService({ skills: createSkillService() });
  const first = env.prepare({
    workspaceRoot: workspace(),
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  const second = env.prepare({
    workspaceRoot: workspace(),
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  assert.equal(first.profileId, second.profileId);
  assert.equal(first.profileVersion, second.profileVersion);
  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.notEqual(first.workspaceId, second.workspaceId);
});

test('re-prepare preserves existing workspace files', () => {
  const root = workspace();
  const marker = join(root, 'uncommitted-work.txt');
  writeFileSync(marker, 'keep me\n');
  const env = createEnvironmentService({ skills: createSkillService() });
  env.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  env.prepare({
    workspaceRoot: root,
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
  });
  assert.equal(existsSync(marker), true);
  assert.equal(readFileSync(marker, 'utf8'), 'keep me\n');
});

test('disallowed tool use is denied', () => {
  const env = createEnvironmentService({ skills: createSkillService() });
  assert.throws(() => env.useTool(TOOL_GIT_PUSH, 'mkt', 'mkt.collect'), ToolDeniedError);
});

test('missing required skills appear as gaps and block implementation start', () => {
  const skills = createSkillService();
  const board = createBoardService(mkdtempSync(join(tmpdir(), 'huntianling-board-')));
  const project = board.createProject({ name: 'Coverage' });
  skills.disableForProject(project.id, MKT_SKILL_QUOTES);
  const env = createEnvironmentService({ skills, board });
  const result = env.prepare({
    workspaceRoot: workspace(),
    host: { node: 'v22.1.0', packageManager: 'pnpm' },
    runner: passingRunner,
    projectId: project.id,
  });
  assert.equal(result.ready, false);
  assert.ok(result.skillGaps.some((gap) => gap.skillId === MKT_SKILL_QUOTES));
  assert.equal(env.canStartImplementation(workspace(), project.id), false);
  assert.ok(board.listWorkItems({ projectId: project.id }).some((item) => item.title.includes(MKT_SKILL_QUOTES)));
});
