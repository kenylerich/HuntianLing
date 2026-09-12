/**
 * Skill registry and MKT original-requirement write tool.
 */

import { randomUUID } from 'node:crypto';

import { CODING_PACK_SKILLS } from './coding-pack.js';
import { DESIGN_METHOD_SKILLS } from './design-methods.js';
import { SPECIALIST_SKILLS } from './specialist-pack.js';
import {
  packIdForSkill,
  recommendTechnologyPacks,
  requireTechnologyPack,
  TECHNOLOGY_PACKS,
  type InstalledSkillPack,
  type RecommendedSkillPack,
  type TechnologySkillPack,
} from './technology-packs.js';
import { MKT_PACK_SKILLS, MKT_REQUIRED_SKILL_IDS, MKT_SKILL_EXTRACT } from './mkt-pack.js';
import { validateOriginalRequirementWrite } from './original-requirement.js';
import { agileSkillTemplates, isAgileSkillKind, templateFor } from './templates.js';
import { creatorEnabledMap, loadSkillsSnapshot, saveSkillsSnapshot } from './store.js';
import { validateSkillRecord } from './validator.js';
import {
  SkillWriteError,
  type AgileSkillKind,
  type MktWriteOptions,
  type OriginalRequirementRecord,
  type SkillDepthId,
  type SkillGap,
  type SkillId,
  type SkillPackId,
  type SkillRecord,
  type SkillValidation,
} from './types.js';

const SHIPPED_CALIBRATED_DEPTHS: readonly SkillDepthId[] = [0, 1];
const FAILURES_BEFORE_DOWNGRADE = 2;

export interface SkillService {
  register(skill: SkillRecord): SkillRecord;
  get(id: SkillId): SkillRecord | undefined;
  history(id: SkillId): readonly SkillRecord[];
  list(): readonly SkillRecord[];
  enableForProject(projectId: string, skillId: SkillId): void;
  disableForProject(projectId: string, skillId: SkillId): void;
  isEnabled(projectId: string, skillId: SkillId): boolean;
  skillsForTask(taskType: string): readonly SkillRecord[];
  mktCoverage(projectId?: string): { readonly complete: boolean; readonly gaps: readonly SkillGap[] };
  calibratedDepths(skillId: SkillId): readonly SkillDepthId[];
  markCalibrated(skillId: SkillId, depth: SkillDepthId): void;
  selectDepth(skillId: SkillId, requested?: SkillDepthId): SkillDepthId;
  writeOriginalRequirement(
    input: unknown,
    options: MktWriteOptions,
  ): OriginalRequirementRecord;
  listTemplates(): readonly { readonly kind: AgileSkillKind; readonly skillId: SkillId; readonly name: string }[];
  draftSkill(input: { readonly templateId: string; readonly name?: string; readonly description?: string }): SkillRecord;
  listDrafts(): readonly SkillRecord[];
  getDraft(skillId: SkillId): SkillRecord | undefined;
  updateDraft(skillId: SkillId, input: { readonly name?: string; readonly description?: string; readonly doesNotCover?: readonly string[]; readonly guide?: string }): SkillRecord;
  validateDraft(skillId: SkillId): SkillValidation;
  listValidations(skillId?: SkillId): readonly SkillValidation[];
  enableDraft(skillId: SkillId, projectId: string): SkillRecord;
  listPacks(): readonly TechnologySkillPack[];
  recommendPacks(workspaceRoot: string): readonly RecommendedSkillPack[];
  installedPacks(projectId: string): readonly InstalledSkillPack[];
  installPack(projectId: string, packId: string, version?: string): InstalledSkillPack;
  uninstallPack(projectId: string, packId: string): void;
}

export function createSkillService(input: { readonly workspaceRoot?: string } = {}): SkillService {
  const versions = new Map<SkillId, SkillRecord[]>();
  const disabled = new Map<string, Set<SkillId>>();
  const failures = new Map<string, number>();
  const calibrated = new Map<SkillId, SkillDepthId[]>();
  const records: OriginalRequirementRecord[] = [];
  const drafts = new Map<SkillId, SkillRecord>();
  const validations: SkillValidation[] = [];
  const creatorEnabled = new Map<string, Set<SkillId>>();
  const installed = new Map<string, Map<string, string>>();
  const persisted = input.workspaceRoot === undefined ? null : loadSkillsSnapshot(input.workspaceRoot);

  function latest(id: SkillId): SkillRecord | undefined {
    const list = versions.get(id);
    return list?.[list.length - 1];
  }

  function assertEnableable(skill: SkillRecord): void {
    if (skill.boundary.doesNotCover.length === 0 || skill.boundary.outputSchema.trim() === '') {
      throw new SkillWriteError('ENABLE', `skill ${skill.id} is missing a capability boundary`);
    }
    if (skill.depth.levels.length === 0) {
      throw new SkillWriteError('ENABLE', `skill ${skill.id} is missing a depth profile`);
    }
  }

  const service: SkillService = {
    register(skill) {
      assertEnableable(skill);
      const list = versions.get(skill.id) ?? [];
      list.push(skill);
      versions.set(skill.id, list);
      return skill;
    },

    get(id) {
      return latest(id);
    },

    history(id) {
      return [...(versions.get(id) ?? [])];
    },

    list() {
      return [...versions.keys()].map((id) => latest(id)).filter((skill): skill is SkillRecord => skill !== undefined);
    },

    enableForProject(projectId, skillId) {
      const skill = latest(skillId);
      if (skill === undefined) {
        throw new SkillWriteError('ENABLE', `skill not found: ${skillId}`);
      }
      assertEnableable(skill);
      if (skill.createdThroughSkillCreator) {
        const set = creatorEnabled.get(projectId) ?? new Set<SkillId>();
        set.add(skillId);
        creatorEnabled.set(projectId, set);
      }
      disabled.get(projectId)?.delete(skillId);
      persist();
    },

    disableForProject(projectId, skillId) {
      const set = disabled.get(projectId) ?? new Set<SkillId>();
      set.add(skillId);
      disabled.set(projectId, set);
      creatorEnabled.get(projectId)?.delete(skillId);
      persist();
    },

    isEnabled(projectId, skillId) {
      const skill = latest(skillId);
      if (skill === undefined) return false;
      const packId = packIdForSkill(skillId);
      if (packId !== undefined) {
        return installed.get(projectId)?.has(packId) === true && disabled.get(projectId)?.has(skillId) !== true;
      }
      if (skill.createdThroughSkillCreator) {
        return creatorEnabled.get(projectId)?.has(skillId) === true;
      }
      return disabled.get(projectId)?.has(skillId) !== true;
    },

    skillsForTask(taskType) {
      return service.list().filter((skill) => skill.boundary.taskTypes.includes(taskType));
    },

    calibratedDepths(skillId) {
      return [...(calibrated.get(skillId) ?? SHIPPED_CALIBRATED_DEPTHS)];
    },

    markCalibrated(skillId, depth) {
      const current = new Set(service.calibratedDepths(skillId));
      current.add(depth);
      calibrated.set(skillId, [...current].sort((left, right) => left - right) as SkillDepthId[]);
    },

    selectDepth(skillId, requested) {
      const skill = latest(skillId);
      const fallback = skill?.depth.defaultLevel ?? 1;
      const allowed = service.calibratedDepths(skillId);
      const target = requested ?? fallback;
      if (allowed.includes(target)) return target;
      return allowed.includes(fallback) ? fallback : (allowed[0] ?? fallback);
    },

    mktCoverage(projectId = '') {
      const gaps: SkillGap[] = [];
      for (const skillId of MKT_REQUIRED_SKILL_IDS) {
        const skill = latest(skillId);
        if (skill === undefined) {
          gaps.push({
            skillId,
            kind: 'missing',
            message: `required MKT skill is missing: ${skillId}`,
          });
          continue;
        }
        if (skill.validationStatus !== 'valid') {
          gaps.push({
            skillId,
            kind: 'unvalidated',
            message: `required MKT skill is unvalidated: ${skillId}`,
          });
          continue;
        }
        if (!service.isEnabled(projectId, skillId)) {
          gaps.push({
            skillId,
            kind: 'disabled',
            message: `required MKT skill is disabled: ${skillId}`,
          });
        }
      }
      return { complete: gaps.length === 0, gaps };
    },

    writeOriginalRequirement(input, options) {
      const coverage = service.mktCoverage(options.projectId ?? '');
      if (!coverage.complete) {
        throw new SkillWriteError(
          'MISSING_SKILL',
          'MKT collection is incomplete because required Skills are missing',
          { gaps: coverage.gaps },
        );
      }
      const requested = options.depth ?? 1;
      if (options.allowUncalibrated !== true && !service.calibratedDepths(MKT_SKILL_EXTRACT).includes(requested)) {
        throw new SkillWriteError('NOT_CALIBRATED', `MKT depth ${String(requested)} is not calibrated`);
      }
      const failureKey = `${options.failureKey ?? 'default'}:${String(requested)}`;
      const failCount = failures.get(failureKey) ?? 0;
      if (requested > 0 && failCount >= FAILURES_BEFORE_DOWNGRADE) {
        throw new SkillWriteError(
          'DEPTH_DOWNGRADE',
          `repeated invalid output; use depth ${String(requested - 1)} or stop`,
          { nextDepth: (requested - 1) as SkillDepthId },
        );
      }
      if (requested === 0 && failCount >= FAILURES_BEFORE_DOWNGRADE) {
        throw new SkillWriteError('STOPPED', 'repeated invalid output at depth 0; stop the task');
      }

      const matching = service.skillsForTask('mkt.collect');
      if (matching.length === 0) {
        throw new SkillWriteError('MISSING_SKILL', 'no MKT skills match task mkt.collect');
      }

      try {
        const parsed = validateOriginalRequirementWrite(input);
        if (requested === 1 && parsed.confirmed !== true) {
          throw new SkillWriteError('VALIDATION', 'depth 1 requires human confirm before tracking');
        }
        const openQuestions = applyDepthSensors(parsed, requested);
        failures.delete(failureKey);
        const tracked = parsed.confirmed === true && (requested !== 2 || openQuestions.length === 0);
        const record: OriginalRequirementRecord = {
          id: randomUUID(),
          quotes: parsed.quotes,
          goal: parsed.goal,
          actors: parsed.actors ?? [],
          scenarios: parsed.scenarios ?? [],
          constraints: parsed.constraints ?? [],
          nonGoals: parsed.nonGoals ?? [],
          openQuestions,
          confirmed: parsed.confirmed,
          tracked,
          skillIds: matching.map((skill) => skill.id),
          skillVersions: matching.map((skill) => skill.version),
          depthLevel: requested,
          executor: options.executor,
        };
        records.push(record);
        return record;
      } catch (error) {
        if (error instanceof SkillWriteError && error.code === 'VALIDATION') {
          failures.set(failureKey, failCount + 1);
        }
        throw error;
      }
    },

    listTemplates() {
      return agileSkillTemplates().map((item) => ({
        kind: item.kind,
        skillId: item.skill.id,
        name: item.skill.name,
      }));
    },

    draftSkill(input) {
      if (!isAgileSkillKind(input.templateId)) {
        throw new SkillWriteError('VALIDATION', `unknown agile skill template: ${input.templateId}`);
      }
      const template = templateFor(input.templateId);
      if (template === undefined) {
        throw new SkillWriteError('VALIDATION', `unknown agile skill template: ${input.templateId}`);
      }
      const existing = drafts.get(template.skill.id);
      const version = existing === undefined ? template.skill.version : bumpPatch(existing.version);
      const draft: SkillRecord = {
        ...template.skill,
        name: input.name?.trim() || template.skill.name,
        description: input.description?.trim() || template.skill.description,
        version,
        validationStatus: 'unvalidated',
        createdThroughSkillCreator: true,
      };
      drafts.set(draft.id, draft);
      persist();
      return draft;
    },

    listDrafts() {
      return [...drafts.values()];
    },

    getDraft(skillId) {
      return drafts.get(skillId);
    },

    updateDraft(skillId, input) {
      const draft = drafts.get(skillId);
      if (draft === undefined) {
        throw new SkillWriteError('MISSING_SKILL', `skill draft not found: ${skillId}`);
      }
      const next: SkillRecord = {
        ...draft,
        name: input.name?.trim() || draft.name,
        description: input.description?.trim() || draft.description,
        guide: input.guide ?? draft.guide,
        validationStatus: 'unvalidated',
        boundary: {
          ...draft.boundary,
          doesNotCover: input.doesNotCover !== undefined ? [...input.doesNotCover] : draft.boundary.doesNotCover,
        },
      };
      drafts.set(skillId, next);
      persist();
      return next;
    },

    validateDraft(skillId) {
      const draft = drafts.get(skillId);
      if (draft === undefined) {
        throw new SkillWriteError('MISSING_SKILL', `skill draft not found: ${skillId}`);
      }
      const result = validateSkillRecord(draft);
      const record: SkillValidation = {
        id: randomUUID(),
        skillId: draft.id,
        version: draft.version,
        status: result.status,
        issues: result.issues,
        source: 'skill-creator',
        createdAt: Date.now(),
      };
      validations.push(record);
      drafts.set(draft.id, { ...draft, validationStatus: result.status });
      persist();
      return record;
    },

    listValidations(skillId) {
      return skillId === undefined ? [...validations] : validations.filter((row) => row.skillId === skillId);
    },

    enableDraft(skillId, projectId) {
      const draft = drafts.get(skillId);
      if (draft === undefined) {
        throw new SkillWriteError('MISSING_SKILL', `skill draft not found: ${skillId}`);
      }
      if (draft.validationStatus !== 'valid') {
        throw new SkillWriteError('GATED', `skill draft ${skillId} is not validated`);
      }
      const existing = latest(draft.id);
      const live: SkillRecord = {
        ...draft,
        validationStatus: 'valid',
        ...(existing !== undefined ? { version: bumpPatch(existing.version) } : {}),
      };
      service.register(live);
      drafts.set(skillId, live);
      service.enableForProject(projectId, live.id);
      return live;
    },

    listPacks() {
      return TECHNOLOGY_PACKS;
    },

    recommendPacks(workspaceRoot) {
      return recommendTechnologyPacks(workspaceRoot);
    },

    installedPacks(projectId) {
      const packs = installed.get(projectId);
      if (packs === undefined) return [];
      return [...packs.entries()].map(([packId, version]) => ({ packId: packId as SkillPackId, version }));
    },

    installPack(projectId, packId, version) {
      const pack = loadPack(packId, version);
      for (const skill of pack.skills) {
        if (latest(skill.id) === undefined) service.register(skill);
      }
      const packs = installed.get(projectId) ?? new Map<string, string>();
      packs.set(pack.id, pack.version);
      installed.set(projectId, packs);
      persist();
      return { packId: pack.id, version: pack.version };
    },

    uninstallPack(projectId, packId) {
      const pack = loadPack(packId);
      const packs = installed.get(projectId);
      if (packs === undefined || !packs.has(pack.id)) {
        throw new SkillWriteError('MISSING_SKILL', `skill pack is not installed: ${pack.id}`);
      }
      packs.delete(pack.id);
      persist();
    },
  };

  function persist(): void {
    if (input.workspaceRoot === undefined) return;
    const creatorVersions: SkillRecord[] = [];
    for (const list of versions.values()) {
      for (const skill of list) {
        if (skill.createdThroughSkillCreator) creatorVersions.push(skill);
      }
    }
    const enabled: Record<string, readonly string[]> = {};
    for (const [projectId, set] of creatorEnabled) {
      enabled[projectId] = [...set];
    }
    const installedPacks: Record<string, InstalledSkillPack[]> = {};
    for (const [projectId, packs] of installed) {
      installedPacks[projectId] = [...packs.entries()].map(([packId, version]) => ({
        packId: packId as SkillPackId,
        version,
      }));
    }
    saveSkillsSnapshot(input.workspaceRoot, {
      schemaVersion: 1,
      versions: creatorVersions,
      drafts: [...drafts.values()],
      validations: [...validations],
      creatorEnabled: enabled,
      installedPacks,
    });
  }

  for (const skill of [...MKT_PACK_SKILLS, ...CODING_PACK_SKILLS, ...DESIGN_METHOD_SKILLS, ...SPECIALIST_SKILLS]) {
    service.register(skill);
  }
  if (persisted !== null) {
    for (const skill of persisted.versions) {
      if (!skill.createdThroughSkillCreator) continue;
      const list = versions.get(skill.id) ?? [];
      list.push(skill);
      versions.set(skill.id, list);
    }
    for (const draft of persisted.drafts) {
      drafts.set(draft.id, draft);
    }
    validations.push(...persisted.validations);
    for (const [projectId, set] of creatorEnabledMap(persisted)) {
      creatorEnabled.set(projectId, set);
    }
    for (const [projectId, packs] of Object.entries(persisted.installedPacks ?? {})) {
      const map = new Map<string, string>();
      for (const row of packs) {
        const pack = loadPack(row.packId, row.version);
        for (const skill of pack.skills) {
          if (latest(skill.id) === undefined) service.register(skill);
        }
        map.set(pack.id, pack.version);
      }
      installed.set(projectId, map);
    }
  }
  return service;
}

function loadPack(packId: string, version?: string): TechnologySkillPack {
  try {
    return requireTechnologyPack(packId, version);
  } catch (error) {
    throw new SkillWriteError('MISSING_SKILL', error instanceof Error ? error.message : `unknown skill pack: ${packId}`);
  }
}

function applyDepthSensors(
  parsed: {
    readonly actors?: readonly string[];
    readonly scenarios?: readonly string[];
    readonly openQuestions?: readonly string[];
    readonly confirmed: boolean;
  },
  depth: SkillDepthId,
): readonly string[] {
  const questions = [...(parsed.openQuestions ?? [])];
  if (depth === 2) {
    if ((parsed.actors ?? []).length === 0) questions.push('Who is the actor?');
    if ((parsed.scenarios ?? []).length === 0) questions.push('What is the scenario?');
    return [...new Set(questions)];
  }
  if (depth >= 3) {
    if ((parsed.actors ?? []).length === 0 || (parsed.scenarios ?? []).length === 0) {
      throw new SkillWriteError('VALIDATION', `depth ${String(depth)} requires actors and scenarios`);
    }
  }
  if (depth === 4) {
    if (parsed.confirmed !== true) {
      throw new SkillWriteError('VALIDATION', 'depth 4 requires human confirm');
    }
    if (questions.length > 0) {
      throw new SkillWriteError('VALIDATION', 'depth 4 forbids open questions');
    }
  }
  return questions;
}

function bumpPatch(version: string): string {
  const parts = version.split('.').map((part) => Number(part));
  const major = Number.isInteger(parts[0]) ? parts[0] : 0;
  const minor = Number.isInteger(parts[1]) ? parts[1] : 1;
  const patch = Number.isInteger(parts[2]) ? parts[2] : 0;
  return `${String(major ?? 0)}.${String(minor ?? 1)}.${String((patch ?? 0) + 1)}`;
}
