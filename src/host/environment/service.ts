/**
 * Prepare and verify a versioned project environment.
 */

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { BoardService } from '../board/plugin.js';
import type { ProjectId } from '../board/types.js';
import { CODING_PACK_SKILLS } from '../skills/coding-pack.js';
import { DESIGN_METHOD_SKILLS } from '../skills/design-methods.js';
import { SPECIALIST_SKILLS } from '../skills/specialist-pack.js';
import { TECHNOLOGY_PACKS } from '../skills/technology-packs.js';
import { MKT_PACK_SKILLS } from '../skills/mkt-pack.js';
import type { SkillService } from '../skills/service.js';
import type { SkillGap, SkillId } from '../skills/types.js';
import type { DatabaseService } from '../database/types.js';
import { invokeTool, type ToolInvokeDeps } from '../tools/invoke.js';
import { createToolRegistry, type ToolRegistry } from '../tools/registry.js';
import { ToolDeniedError, type ToolId, type ToolCallEvidence, type ToolInvokeInput } from '../tools/types.js';
import { copyWorkspaceFiles, isProfileInventory, listWorkspaceRelPaths } from './fleet.js';
import { resolveEnvironmentProfile } from './profile.js';
import { scanProjectSkills } from './scan.js';
import type {
  CheckResult,
  EnvironmentBlocker,
  EnvironmentCapabilityProbe,
  EnvironmentCommandExecution,
  EnvironmentCommandRunner,
  EnvironmentConfig,
  EnvironmentFleetSlot,
  EnvironmentPrepareInput,
  EnvironmentPrepareResult,
  EnvironmentProfile,
  EnvironmentReplaceInput,
  EnvironmentReplaceResult,
  SkillCoverageMatrix,
} from './types.js';

export interface EnvironmentService {
  profile(): EnvironmentProfile;
  tools(): ToolRegistry;
  prepare(input: EnvironmentPrepareInput): EnvironmentPrepareResult;
  replace(input: EnvironmentReplaceInput): EnvironmentReplaceResult;
  listFleets(): readonly EnvironmentFleetSlot[];
  lastPrepare(projectId?: string, workspaceRoot?: string): EnvironmentPrepareResult | null;
  skillCoverage(projectId?: string, workspaceRoot?: string, requiredSkillIds?: readonly SkillId[]): SkillCoverageMatrix;
  canStartImplementation(workspaceRoot?: string, projectId?: string): boolean;
  useTool(toolId: Parameters<ToolRegistry['assertAllowed']>[0], role: string, taskType: string): void;
  invokeTool(input: ToolInvokeInput, extras?: Omit<ToolInvokeDeps, 'registry' | 'board' | 'database'>): ToolCallEvidence;
}

export function createEnvironmentService(deps: {
  readonly skills: SkillService;
  readonly board?: BoardService;
  readonly tools?: ToolRegistry;
  readonly database?: DatabaseService;
  readonly config?: EnvironmentConfig;
  readonly runner?: EnvironmentCommandRunner;
}): EnvironmentService {
  const tools = deps.tools ?? createToolRegistry();
  const profile = resolveEnvironmentProfile(deps.config ?? {});
  const commandTimeoutMs = positiveInteger(deps.config?.commandTimeoutMs, 120_000);
  const commandOutputLimit = positiveInteger(deps.config?.commandOutputLimit, 12_000);
  const localExecution = deps.config?.localExecution ?? 'enabled';
  let lastPrepareResult: EnvironmentPrepareResult | null = null;
  const prepareResults: EnvironmentPrepareResult[] = [];
  const fleets: EnvironmentFleetSlot[] = [];

  const service: EnvironmentService = {
    profile() {
      return profile;
    },

    tools() {
      return tools;
    },

    prepare(input) {
      const started = Date.now();
      const prepareRunId = randomUUID();
      const selected = selectProfile(input.profile ?? profile, input.overrides?.profileVersion);
      const workspaceRoot = input.workspaceRoot;
      const projectId = input.projectId ?? null;
      const env = mergedEnv(input.env);
      const host = input.host ?? {
        node: process.version,
        packageManager: 'pnpm',
      };
      const packageJson = existsSync(join(workspaceRoot, 'package.json'));
      const reused: string[] = [];
      const prepared: string[] = [];
      const blockers: EnvironmentBlocker[] = [];
      const manualSteps: string[] = [];
      const baseline: Record<string, CheckResult> = {};
      const commands: EnvironmentCommandExecution[] = [];
      const capabilityProbes: EnvironmentCapabilityProbe[] = [];
      const artifacts: string[] = [];
      const overrides = input.overrides?.profileVersion !== undefined
        ? [`profileVersion=${input.overrides.profileVersion}`]
        : [];
      const huntianlingDir = join(workspaceRoot, '.huntianling');
      const runDir = join(huntianlingDir, 'environment-runs', prepareRunId);
      mkdirSync(runDir, { recursive: true });
      prepared.push(`environment-runs/${prepareRunId}`);

      if (packageJson) reused.push('package.json');
      else {
        addBlocker(blockers, {
          kind: 'dependency',
          message: 'package.json is missing',
          action: 'Add a package.json for the Node/pnpm profile or choose another profile',
        });
      }
      capabilityProbes.push({
        id: 'dependency:package-json',
        kind: 'dependency',
        status: packageJson ? 'pass' : 'blocked',
        message: packageJson ? 'package.json is present' : 'package.json is missing',
      });

      if (!nodeSatisfies(host.node, selected.runtime.node)) {
        addBlocker(blockers, {
          kind: 'dependency',
          message: `Node ${host.node} does not satisfy ${selected.runtime.node}`,
          action: `Install Node ${selected.runtime.node}`,
        });
      }
      capabilityProbes.push({
        id: 'dependency:node',
        kind: 'dependency',
        status: nodeSatisfies(host.node, selected.runtime.node) ? 'pass' : 'fail',
        message: `Node ${host.node}; requires ${selected.runtime.node}`,
      });
      const packageManagerReady = host.packageManager === selected.runtime.packageManager;
      if (!packageManagerReady) {
        addBlocker(blockers, {
          kind: 'dependency',
          message: `package manager ${host.packageManager} does not match ${selected.runtime.packageManager}`,
          action: `Use ${selected.runtime.packageManager} for this environment profile`,
        });
      }
      capabilityProbes.push({
        id: 'dependency:package-manager',
        kind: 'dependency',
        status: packageManagerReady ? 'pass' : 'fail',
        message: `package manager ${host.packageManager}; requires ${selected.runtime.packageManager}`,
      });

      for (const toolId of selected.requiredToolIds) {
        if (tools.get(toolId) === undefined) {
          addBlocker(blockers, {
            kind: 'tool',
            message: `required tool is missing: ${toolId}`,
            action: `Register tool ${toolId}`,
          });
          capabilityProbes.push({
            id: `tool:${toolId}`,
            kind: 'tool',
            status: 'blocked',
            message: `required tool is missing: ${toolId}`,
          });
          continue;
        }
        capabilityProbes.push({
          id: `tool:${toolId}`,
          kind: 'tool',
          status: 'pass',
          message: `required tool is registered: ${toolId}`,
        });
      }

      const coverage = service.skillCoverage(input.projectId, workspaceRoot, selected.requiredSkillIds);
      for (const gap of coverage.gaps) {
        addBlocker(blockers, {
          kind: 'skill',
          message: gap.message,
          action: `Enable or ship skill ${gap.skillId}`,
        });
        capabilityProbes.push({
          id: `skill:${gap.skillId}`,
          kind: 'skill',
          status: 'blocked',
          message: gap.message,
        });
      }
      if (coverage.gaps.length === 0) {
        capabilityProbes.push({
          id: 'skill:coverage',
          kind: 'skill',
          status: 'pass',
          message: 'required skills are valid and enabled',
        });
      }
      if (input.projectId !== undefined && deps.board !== undefined) {
        writeSkillGapWorkItems(deps.board, input.projectId, coverage.gaps);
      }

      const runner = input.runner ?? deps.runner ?? (localExecution === 'enabled' ? localCommandRunner : undefined);
      capabilityProbes.push({
        id: 'executor:command-runner',
        kind: 'executor',
        status: runner === undefined ? 'blocked' : 'pass',
        message: runner === undefined ? 'environment command runner is not configured' : 'environment command runner is available',
      });
      if (runner === undefined && selected.commands.some((command) => command.required)) {
        manualSteps.push('Configure the environment command runner or enable local execution for this profile');
        addBlocker(blockers, {
          kind: 'executor',
          message: 'environment command runner is not configured',
          action: 'Configure a runner before starting implementation',
        });
      }

      for (const spec of selected.commands) {
        const executed = runProfileCommand({
          spec,
          runner,
          workspaceRoot,
          projectId,
          selected,
          packageJson,
          env,
          runDir,
          timeoutMs: commandTimeoutMs,
          outputLimit: commandOutputLimit,
          tools,
        });
        commands.push(executed);
        baseline[spec.id] = executed.status;
        artifacts.push(...executed.artifacts);
        tools.recordCall({
          toolId: spec.toolId,
          role: 'environment',
          taskType: 'environment.prepare',
          affectsDelivery: spec.required,
          result: executed.status === 'blocked' && tools.get(spec.toolId) === undefined ? 'denied' : 'ran',
          detail: executed.status,
        });
        if (spec.required && executed.status !== 'pass') {
          addBlocker(blockers, {
            kind: executed.status === 'blocked' && runner === undefined ? 'executor' : 'tool',
            message: `${spec.id} check ${executed.status}`,
            action: `Fix ${spec.command} until it passes`,
          });
        }
      }

      const profilePath = join(huntianlingDir, 'environment-profile.json');
      if (existsSync(profilePath)) reused.push('environment-profile.json');
      else prepared.push('environment-profile.json');
      artifacts.push(profilePath);

      const credentialPresence = credentialKeys(env);

      const result: EnvironmentPrepareResult = {
        prepareRunId,
        profileId: selected.id,
        profileVersion: selected.version,
        projectId,
        workspaceRoot,
        overrides,
        workspaceId: basename(workspaceRoot),
        ready: blockers.length === 0,
        durationMs: Date.now() - started,
        inventory: {
          node: host.node,
          packageManager: host.packageManager,
          packageJson,
        },
        reused,
        prepared,
        blockers,
        manualSteps,
        baseline,
        commands,
        capabilityProbes,
        artifacts,
        skillGaps: coverage.gaps,
        credentialPresence,
      };
      const persisted = {
        prepareRunId: result.prepareRunId,
        projectId: result.projectId,
        profileId: result.profileId,
        profileVersion: result.profileVersion,
        workspaceRoot: result.workspaceRoot,
        workspaceId: result.workspaceId,
        ready: result.ready,
        commands: result.commands.map((command) => ({
          id: command.id,
          toolId: command.toolId,
          command: command.command,
          required: command.required,
          status: command.status,
          exitCode: command.exitCode,
          artifacts: command.artifacts,
          startedAt: command.startedAt,
          endedAt: command.endedAt,
          durationMs: command.durationMs,
        })),
        capabilityProbes: result.capabilityProbes,
        artifacts: result.artifacts,
        blockers: result.blockers,
        credentialPresence: result.credentialPresence,
      };
      writeFileSync(profilePath, `${JSON.stringify(persisted, null, 2)}\n`);
      rememberPrepare(prepareResults, result);
      lastPrepareResult = result;
      registerFleet(fleets, {
        kind: input.kind ?? 'local',
        workspaceRoot,
        profileId: result.profileId,
        profileVersion: result.profileVersion,
        ready: result.ready,
      });
      return result;
    },

    replace(input) {
      const listed = input.listUncommitted?.(input.sourceRoot) ?? listWorkspaceRelPaths(input.sourceRoot);
      const inventory = listed.filter((path) => isProfileInventory(path));
      const uncommitted = listed.filter((path) => !isProfileInventory(path));
      const preserve = input.preserveUncommitted !== false;
      const acceptLoss = input.acceptUncommittedLoss === true;
      const atRisk = !preserve ? uncommitted : [];
      copyWorkspaceFiles(input.sourceRoot, input.targetRoot, preserve ? listed : inventory);
      const prepared = service.prepare({
        workspaceRoot: input.targetRoot,
        kind: input.kind ?? 'remote',
        ...(input.profile !== undefined ? { profile: input.profile } : {}),
        ...(input.overrides !== undefined ? { overrides: input.overrides } : {}),
        ...(input.host !== undefined ? { host: input.host } : {}),
        ...(input.runner !== undefined ? { runner: input.runner } : {}),
        ...(input.env !== undefined ? { env: input.env } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      });
      const blockers: EnvironmentBlocker[] = [...prepared.blockers];
      if (atRisk.length > 0 && !acceptLoss) {
        blockers.push({
          kind: 'uncommitted',
          message: `uncommitted work would be lost: ${atRisk.join(', ')}`,
          action: 'Copy the files onto the replacement or set acceptUncommittedLoss after review',
        });
      }
      const ready = blockers.length === 0;
      const slot = registerFleet(fleets, {
        kind: input.kind ?? 'remote',
        workspaceRoot: input.targetRoot,
        profileId: prepared.profileId,
        profileVersion: prepared.profileVersion,
        ready,
      });
      const prepare: EnvironmentPrepareResult = { ...prepared, ready, blockers };
      rememberPrepare(prepareResults, prepare);
      lastPrepareResult = prepare;
      return {
        slot,
        prepare,
        uncommitted: {
          paths: uncommitted,
          preserved: preserve ? uncommitted : [],
          atRisk,
        },
      };
    },

    listFleets() {
      return [...fleets];
    },

    lastPrepare(projectId, workspaceRoot) {
      const found = findLastPrepare(prepareResults, projectId, workspaceRoot);
      if (projectId !== undefined || workspaceRoot !== undefined) return found;
      return found ?? lastPrepareResult;
    },

    skillCoverage(projectId = '', workspaceRoot, requiredSkillIds) {
      const required = requiredSkillIds ?? profile.requiredSkillIds;
      const scan = scanProjectSkills(workspaceRoot ?? '.');
      const available = deps.skills
        .list()
        .filter((skill) => deps.skills.isEnabled(projectId, skill.id) && skill.validationStatus === 'valid')
        .map((skill) => skill.id);
      const gaps: SkillGap[] = [];
      for (const skillId of required) {
        const gap = classifySkillGap(deps.skills, tools, projectId, skillId);
        if (gap !== undefined) gaps.push(gap);
      }
      return {
        required,
        available,
        gaps,
        complete: gaps.length === 0,
        scan,
        recommendedPacks: deps.skills.recommendPacks(workspaceRoot ?? '.'),
        installedPacks: projectId === '' ? [] : deps.skills.installedPacks(projectId),
      };
    },

    canStartImplementation(workspaceRoot, projectId) {
      const result = findLastPrepare(prepareResults, projectId, workspaceRoot);
      if (result === null) return false;
      if (!result.ready) return false;
      if (result.commands.some((command) => command.required && command.status !== 'pass')) return false;
      if (result.capabilityProbes.some((probe) => probe.status !== 'pass')) return false;
      const coverage = service.skillCoverage(result.projectId ?? undefined, result.workspaceRoot, profile.requiredSkillIds);
      return coverage.complete;
    },

    useTool(toolId, role, taskType) {
      tools.assertAllowed(toolId, role, taskType);
    },

    invokeTool(input, extras = {}) {
      return invokeTool({
        registry: tools,
        ...(deps.board !== undefined ? { board: deps.board } : {}),
        ...(deps.database !== undefined ? { database: deps.database } : {}),
        ...(extras.transport !== undefined ? { transport: extras.transport } : {}),
        ...(extras.ocr !== undefined ? { ocr: extras.ocr } : {}),
      }, input);
    },
  };
  return service;
}

function selectProfile(profile: EnvironmentProfile, profileVersion?: string): EnvironmentProfile {
  if (profileVersion === undefined) return profile;
  if (profileVersion.trim() === '') {
    throw new Error('environment profile version override is required');
  }
  return { ...profile, version: profileVersion };
}

function runProfileCommand(input: {
  readonly spec: EnvironmentProfile['commands'][number];
  readonly runner: EnvironmentCommandRunner | undefined;
  readonly workspaceRoot: string;
  readonly projectId: string | null;
  readonly selected: EnvironmentProfile;
  readonly packageJson: boolean;
  readonly env: NodeJS.ProcessEnv;
  readonly runDir: string;
  readonly timeoutMs: number;
  readonly outputLimit: number;
  readonly tools: ToolRegistry;
}): EnvironmentCommandExecution {
  const startedAt = Date.now();
  let status: CheckResult;
  let output: string;
  let exitCode: number | null = null;
  let runnerArtifacts: readonly string[] = [];

  if (!input.packageJson) {
    status = 'skipped';
    output = 'package.json missing; command skipped';
  } else if (input.tools.get(input.spec.toolId) === undefined) {
    status = 'blocked';
    output = `required tool missing: ${input.spec.toolId}`;
  } else {
    try {
      input.tools.assertAllowed(input.spec.toolId, 'environment', 'environment.prepare');
      if (input.runner === undefined) {
        status = 'blocked';
        output = 'environment command runner is not configured';
      } else {
        const ran = input.runner(input.spec.command, {
          workspaceRoot: input.workspaceRoot,
          projectId: input.projectId,
          profileId: input.selected.id,
          profileVersion: input.selected.version,
          commandId: input.spec.id,
          required: input.spec.required,
          timeoutMs: input.timeoutMs,
          env: input.env,
        });
        status = ran.status;
        output = ran.output;
        exitCode = ran.exitCode ?? null;
        runnerArtifacts = ran.artifacts ?? [];
      }
    } catch (error) {
      status = 'blocked';
      output = error instanceof Error ? error.message : 'environment command failed before execution';
    }
  }

  const redactedOutput = limitOutput(redactOutput(output, input.env), input.outputLimit);
  if (input.spec.probeMeansBlocked === true && probeOutputMeansBlocked(redactedOutput)) {
    status = 'blocked';
  }
  const endedAt = Date.now();
  const artifact = join(input.runDir, `${safeSegment(input.spec.id)}.json`);
  const artifacts = [artifact, ...runnerArtifacts];
  const execution: EnvironmentCommandExecution = {
    id: input.spec.id,
    toolId: input.spec.toolId,
    command: input.spec.command,
    required: input.spec.required,
    status,
    exitCode,
    output: redactedOutput,
    artifacts,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
  };
  writeFileSync(artifact, `${JSON.stringify({
    id: execution.id,
    toolId: execution.toolId,
    command: execution.command,
    required: execution.required,
    status: execution.status,
    exitCode: execution.exitCode,
    output: execution.output,
    startedAt: execution.startedAt,
    endedAt: execution.endedAt,
    durationMs: execution.durationMs,
  }, null, 2)}\n`);
  return execution;
}

const localCommandRunner: EnvironmentCommandRunner = (command, context) => {
  const completed = spawnSync(command, {
    cwd: context.workspaceRoot,
    shell: true,
    encoding: 'utf8',
    timeout: context.timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    env: context.env,
  });
  const stdout = completed.stdout ?? '';
  const stderr = completed.stderr ?? '';
  const output = `${stdout}${stderr}`;
  if (completed.error !== undefined) {
    return {
      status: 'blocked',
      output: `${completed.error.message}${output === '' ? '' : `\n${output}`}`,
      exitCode: completed.status ?? null,
    };
  }
  return {
    status: completed.status === 0 ? 'pass' : 'fail',
    output,
    exitCode: completed.status ?? null,
  };
};

function addBlocker(blockers: EnvironmentBlocker[], blocker: EnvironmentBlocker): void {
  if (blockers.some((item) => item.kind === blocker.kind && item.message === blocker.message)) return;
  blockers.push(blocker);
}

function mergedEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...process.env, ...(env ?? {}) };
}

function credentialKeys(env: NodeJS.ProcessEnv): readonly string[] {
  return Object.entries(env)
    .filter(([key, value]) => SECRET_ENV_KEY.test(key) && value !== undefined && value !== '')
    .map(([key]) => key)
    .sort();
}

function redactOutput(output: string, env: NodeJS.ProcessEnv): string {
  let redacted = output;
  for (const [key, value] of Object.entries(env)) {
    if (!SECRET_ENV_KEY.test(key) || value === undefined || value.length < 4) continue;
    redacted = redacted.split(value).join(`[redacted:${key}]`);
  }
  return redacted;
}

function limitOutput(output: string, limit: number): string {
  if (output.length <= limit) return output;
  return `${output.slice(0, limit)}\n[truncated ${String(output.length - limit)} chars]`;
}

function probeOutputMeansBlocked(output: string): boolean {
  return /HUNTIANLING_PROBE|Missing script|command not found|not found/i.test(output);
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'command';
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : fallback;
}

function rememberPrepare(results: EnvironmentPrepareResult[], result: EnvironmentPrepareResult): void {
  const index = results.findIndex((item) => item.prepareRunId === result.prepareRunId);
  if (index >= 0) {
    results[index] = result;
  } else {
    results.push(result);
  }
  while (results.length > 100) results.shift();
}

function findLastPrepare(
  results: readonly EnvironmentPrepareResult[],
  projectId?: string,
  workspaceRoot?: string,
): EnvironmentPrepareResult | null {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (result === undefined) continue;
    if (projectId !== undefined && result.projectId !== projectId) continue;
    if (workspaceRoot !== undefined && result.workspaceRoot !== workspaceRoot) continue;
    return result;
  }
  return null;
}

const SECRET_ENV_KEY = /password|token|secret|api[_-]?key|authorization|credential/i;

function nodeSatisfies(actual: string, required: string): boolean {
  const match = /^>=(\d+)/.exec(required);
  if (match === null || match[1] === undefined) return true;
  const major = Number(actual.replace(/^v/, '').split('.')[0]);
  return major >= Number(match[1]);
}

function classifySkillGap(
  skills: SkillService,
  tools: ToolRegistry,
  projectId: string,
  skillId: SkillId,
): SkillGap | undefined {
  const registered = skills.get(skillId);
  if (registered === undefined) {
    return { skillId, kind: 'missing', message: `required skill is missing: ${skillId}` };
  }
  if (registered.validationStatus !== 'valid') {
    return { skillId, kind: 'unvalidated', message: `required skill is unvalidated: ${skillId}` };
  }
  const builtin = builtinSkillVersion(skillId);
  if (builtin !== undefined && registered.version !== builtin) {
    return { skillId, kind: 'outdated', message: `required skill is outdated: ${skillId}` };
  }
  if (!skills.isEnabled(projectId, skillId)) {
    return { skillId, kind: 'disabled', message: `required skill is disabled: ${skillId}` };
  }
  const missingTool = registered.requiredTools.find((toolId) => tools.get(toolId as ToolId) === undefined);
  if (missingTool !== undefined) {
    return {
      skillId,
      kind: 'blocked-by-tool',
      message: `required skill ${skillId} is blocked by missing tool ${missingTool}`,
    };
  }
  return undefined;
}

function builtinSkillVersion(skillId: SkillId): string | undefined {
  return [...MKT_PACK_SKILLS, ...CODING_PACK_SKILLS, ...DESIGN_METHOD_SKILLS, ...SPECIALIST_SKILLS, ...TECHNOLOGY_PACKS.flatMap((pack) => pack.skills)].find((skill) => skill.id === skillId)?.version;
}

function writeSkillGapWorkItems(board: BoardService, projectId: string, gaps: readonly SkillGap[]): void {
  for (const gap of gaps) {
    const title = `Skill gap: ${gap.skillId}`;
    const existing = board.listWorkItems({ projectId: projectId as ProjectId }).some((item) => item.title === title);
    if (existing) continue;
    board.createWorkItem({
      projectId: projectId as ProjectId,
      type: 'research',
      title,
      body: gap.message,
    });
  }
}

function registerFleet(
  fleets: EnvironmentFleetSlot[],
  input: {
    readonly kind: EnvironmentFleetSlot['kind'];
    readonly workspaceRoot: string;
    readonly profileId: string;
    readonly profileVersion: string;
    readonly ready: boolean;
  },
): EnvironmentFleetSlot {
  const slot: EnvironmentFleetSlot = {
    id: randomUUID(),
    kind: input.kind,
    workspaceRoot: input.workspaceRoot,
    profileId: input.profileId,
    profileVersion: input.profileVersion,
    ready: input.ready,
    createdAt: Date.now(),
  };
  const index = fleets.findIndex((item) => item.workspaceRoot === input.workspaceRoot);
  if (index >= 0) {
    fleets[index] = slot;
    return slot;
  }
  fleets.push(slot);
  return slot;
}

export { ToolDeniedError };
