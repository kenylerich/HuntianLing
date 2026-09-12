/**
 * Prepare and verify a versioned project environment.
 */

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
import { HUNTIANLING_NODE_PNPM_PROFILE } from './profile.js';
import { scanProjectSkills } from './scan.js';
import type {
  CheckResult,
  EnvironmentBlocker,
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
  lastPrepare(): EnvironmentPrepareResult | null;
  skillCoverage(projectId?: string, workspaceRoot?: string, requiredSkillIds?: readonly SkillId[]): SkillCoverageMatrix;
  canStartImplementation(workspaceRoot: string, projectId?: string): boolean;
  useTool(toolId: Parameters<ToolRegistry['assertAllowed']>[0], role: string, taskType: string): void;
  invokeTool(input: ToolInvokeInput, extras?: Omit<ToolInvokeDeps, 'registry' | 'board' | 'database'>): ToolCallEvidence;
}

export function createEnvironmentService(deps: {
  readonly skills: SkillService;
  readonly board?: BoardService;
  readonly tools?: ToolRegistry;
  readonly database?: DatabaseService;
}): EnvironmentService {
  const tools = deps.tools ?? createToolRegistry();
  const profile = HUNTIANLING_NODE_PNPM_PROFILE;
  let lastPrepareResult: EnvironmentPrepareResult | null = null;
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
      const selected = input.profile ?? profile;
      const workspaceRoot = input.workspaceRoot;
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
      const overrides = input.overrides?.profileVersion !== undefined
        ? [`profileVersion=${input.overrides.profileVersion}`]
        : [];

      if (packageJson) reused.push('package.json');
      else {
        blockers.push({
          kind: 'dependency',
          message: 'package.json is missing',
          action: 'Add a package.json for the Node/pnpm profile or choose another profile',
        });
      }

      if (!nodeSatisfies(host.node, selected.runtime.node)) {
        blockers.push({
          kind: 'dependency',
          message: `Node ${host.node} does not satisfy ${selected.runtime.node}`,
          action: `Install Node ${selected.runtime.node}`,
        });
      }

      for (const toolId of selected.requiredToolIds) {
        if (tools.get(toolId) === undefined) {
          blockers.push({
            kind: 'tool',
            message: `required tool is missing: ${toolId}`,
            action: `Register tool ${toolId}`,
          });
        }
      }

      const coverage = service.skillCoverage(input.projectId, workspaceRoot, selected.requiredSkillIds);
      for (const gap of coverage.gaps) {
        blockers.push({
          kind: 'skill',
          message: gap.message,
          action: `Enable or ship skill ${gap.skillId}`,
        });
      }
      if (input.projectId !== undefined && deps.board !== undefined) {
        writeSkillGapWorkItems(deps.board, input.projectId, coverage.gaps);
      }

      const runner = input.runner ?? defaultRunner;
      if (packageJson) {
        for (const spec of selected.commands) {
          tools.assertAllowed(spec.toolId, 'environment', 'environment.prepare');
          const ran = runner(spec.command);
          let status = ran.status;
          if (spec.probeMeansBlocked === true && /HUNTIANLING_PROBE/.test(ran.output)) {
            status = 'blocked';
          }
          baseline[spec.id] = status;
          tools.recordCall({
            toolId: spec.toolId,
            role: 'environment',
            taskType: 'environment.prepare',
            affectsDelivery: spec.required,
            result: 'ran',
            detail: status,
          });
          if (spec.required && status !== 'pass') {
            blockers.push({
              kind: 'tool',
              message: `${spec.id} check ${status}`,
              action: `Fix ${spec.command} until it passes`,
            });
          }
        }
      }

      const huntianlingDir = join(workspaceRoot, '.huntianling');
      mkdirSync(huntianlingDir, { recursive: true });
      const profilePath = join(huntianlingDir, 'environment-profile.json');
      if (existsSync(profilePath)) reused.push('environment-profile.json');
      else prepared.push('environment-profile.json');

      const credentialPresence: string[] = [];
      const env = input.env ?? process.env;
      if (env.DEEPSEEK_API_KEY !== undefined && env.DEEPSEEK_API_KEY !== '') {
        credentialPresence.push('DEEPSEEK_API_KEY');
      }

      const result: EnvironmentPrepareResult = {
        profileId: selected.id,
        profileVersion: selected.version,
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
        skillGaps: coverage.gaps,
        credentialPresence,
      };
      const persisted = {
        profileId: result.profileId,
        profileVersion: result.profileVersion,
        ready: result.ready,
        credentialPresence: result.credentialPresence,
      };
      writeFileSync(profilePath, `${JSON.stringify(persisted, null, 2)}\n`);
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

    lastPrepare() {
      return lastPrepareResult;
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
      const result = service.prepare({
        workspaceRoot,
        ...(projectId !== undefined ? { projectId } : {}),
        runner: () => ({ status: 'pass', output: '' }),
      });
      return result.ready && service.skillCoverage(projectId, workspaceRoot).complete;
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

function nodeSatisfies(actual: string, required: string): boolean {
  const match = /^>=(\d+)/.exec(required);
  if (match === null || match[1] === undefined) return true;
  const major = Number(actual.replace(/^v/, '').split('.')[0]);
  return major >= Number(match[1]);
}

function defaultRunner(command: string): { readonly status: CheckResult; readonly output: string } {
  return { status: 'skipped', output: `runner not configured for ${command}` };
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
