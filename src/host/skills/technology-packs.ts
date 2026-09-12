/**
 * Installable, versioned technology skill packs.
 * These are not part of the coding environment baseline.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { scanProjectSkills } from '../environment/scan.js';
import type { SkillDepthProfile, SkillId, SkillPackId, SkillRecord, SkillRole } from './types.js';

export const TECHNOLOGY_PACK_CATEGORIES = [
  'frontend-web',
  'backend-service',
  'api-integration',
  'database',
  'mobile',
  'desktop',
  'data-ml',
  'infrastructure',
  'security',
  'qa-automation',
  'documentation',
] as const;

export type TechnologyPackCategory = (typeof TECHNOLOGY_PACK_CATEGORIES)[number];

export interface TechnologySkillPack {
  readonly id: SkillPackId;
  readonly version: string;
  readonly category: TechnologyPackCategory;
  readonly name: string;
  readonly skills: readonly SkillRecord[];
}

export interface InstalledSkillPack {
  readonly packId: SkillPackId;
  readonly version: string;
}

export interface RecommendedSkillPack {
  readonly packId: SkillPackId;
  readonly version: string;
  readonly reason: string;
}

const DEPTH: SkillDepthProfile = {
  defaultLevel: 1,
  levels: [
    { id: 0, label: 'checklist', steps: [{ name: 'fill-schema', actor: 'human' }, { name: 'validate', actor: 'tool' }] },
    {
      id: 1,
      label: 'form-fill',
      steps: [
        { name: 'fill-schema', actor: 'model' },
        { name: 'validate', actor: 'tool' },
      ],
    },
    { id: 2, label: 'question-loop', steps: [{ name: 'ask-missing', actor: 'model' }] },
    { id: 3, label: 'method-constraint', steps: [{ name: 'method-check', actor: 'tool' }] },
    { id: 4, label: 'calibrated-quality', steps: [{ name: 'rubric', actor: 'model' }] },
  ],
};

function packSkill(
  id: SkillId,
  role: SkillRole,
  taskType: string,
  name: string,
  description: string,
  outputSchema: string,
  requiredTool: string,
): SkillRecord {
  return {
    id,
    name,
    version: '1.0.0',
    description,
    supportedRoles: [role],
    supportedTaskTypes: [taskType],
    requiredTools: [requiredTool],
    validationStatus: 'valid',
    createdThroughSkillCreator: false,
    boundary: {
      roles: [role],
      taskTypes: [taskType],
      artifacts: [outputSchema],
      requiredTools: [requiredTool],
      outputSchema,
      doesNotCover: ['acceptance-decision', 'unconfirmed-scope'],
    },
    depth: DEPTH,
    guide: description,
    examples: { pass: { ok: true }, fail: { ok: false } },
  };
}

function pack(
  category: TechnologyPackCategory,
  name: string,
  role: SkillRole,
  taskType: string,
  requiredTool: string,
): TechnologySkillPack {
  const id = `tech.${category}` as SkillPackId;
  return {
    id,
    version: '1.0.0',
    category,
    name,
    skills: [
      packSkill(
        `tech.${category}.${taskType}` as SkillId,
        role,
        taskType,
        `${name} ${taskType}`,
        `${name} coverage for ${taskType} tasks.`,
        `huntianling.tech.${category}.v1`,
        requiredTool,
      ),
    ],
  };
}

export const TECHNOLOGY_PACKS: readonly TechnologySkillPack[] = [
  pack('frontend-web', 'Frontend web', 'generator', 'implement', 'implementation.write'),
  pack('backend-service', 'Backend service', 'generator', 'implement', 'implementation.write'),
  pack('api-integration', 'API integration', 'generator', 'implement', 'implementation.write'),
  pack('database', 'Database', 'generator', 'implement', 'implementation.write'),
  pack('mobile', 'Mobile', 'generator', 'implement', 'implementation.write'),
  pack('desktop', 'Desktop', 'generator', 'implement', 'implementation.write'),
  pack('data-ml', 'Data / ML', 'generator', 'implement', 'implementation.write'),
  pack('infrastructure', 'Infrastructure', 'generator', 'implement', 'implementation.write'),
  pack('security', 'Security', 'evaluator', 'evaluate', 'evaluation.write'),
  pack('qa-automation', 'QA automation', 'evaluator', 'evaluate', 'evaluation.write'),
  pack('documentation', 'Documentation', 'generator', 'implement', 'implementation.write'),
];

const PACK_BY_ID = new Map(TECHNOLOGY_PACKS.map((item) => [item.id, item]));
const PACK_BY_SKILL = new Map(
  TECHNOLOGY_PACKS.flatMap((item) => item.skills.map((skill) => [skill.id, item.id] as const)),
);

export function technologyPack(packId: string, version?: string): TechnologySkillPack | undefined {
  const found = PACK_BY_ID.get(packId as SkillPackId);
  if (found === undefined) return undefined;
  if (version !== undefined && found.version !== version) return undefined;
  return found;
}

export function packIdForSkill(skillId: SkillId): SkillPackId | undefined {
  return PACK_BY_SKILL.get(skillId);
}

export function isTechnologyPackId(value: string): boolean {
  return PACK_BY_ID.has(value as SkillPackId);
}

export function requireTechnologyPack(packId: string, version?: string): TechnologySkillPack {
  const found = technologyPack(packId, version);
  if (found === undefined) {
    throw new Error(version === undefined ? `unknown skill pack: ${packId}` : `unknown skill pack version: ${packId}@${version}`);
  }
  return found;
}

const FRONTEND_DEPS = ['react', 'vue', 'next', 'nuxt', 'svelte', 'solid-js'];
const BACKEND_DEPS = ['express', 'fastify', 'koa', '@nestjs/core', 'hono'];
const API_DEPS = ['axios', 'got', 'openapi-client', 'swagger-client'];
const DATABASE_DEPS = ['pg', 'sqlite3', 'better-sqlite3', 'prisma', '@prisma/client', 'mongoose', 'mysql2', 'typeorm', 'drizzle-orm'];
const MOBILE_DEPS = ['react-native', 'expo', '@capacitor/core'];
const DESKTOP_DEPS = ['electron', '@tauri-apps/api'];
const ML_DEPS = ['@tensorflow/tfjs', 'brain.js'];
const SECURITY_DEPS = ['helmet', 'eslint-plugin-security'];
const QA_DEPS = ['playwright', 'cypress', '@playwright/test', 'nightwatch', 'webdriverio'];

export function recommendTechnologyPacks(workspaceRoot: string): readonly RecommendedSkillPack[] {
  const scan = scanProjectSkills(workspaceRoot);
  const deps = dependencyNames(workspaceRoot);
  const recommended: RecommendedSkillPack[] = [];
  addRecommendation(recommended, 'tech.frontend-web', scan.framework !== null && FRONTEND_DEPS.includes(scan.framework) || hasAny(deps, FRONTEND_DEPS), `framework ${scan.framework ?? 'none'}`);
  addRecommendation(recommended, 'tech.backend-service', hasAny(deps, BACKEND_DEPS), 'backend service dependency');
  addRecommendation(recommended, 'tech.api-integration', hasAny(deps, API_DEPS), 'API client dependency');
  addRecommendation(recommended, 'tech.database', hasAny(deps, DATABASE_DEPS), 'database dependency');
  addRecommendation(recommended, 'tech.mobile', hasAny(deps, MOBILE_DEPS), 'mobile dependency');
  addRecommendation(recommended, 'tech.desktop', hasAny(deps, DESKTOP_DEPS), 'desktop dependency');
  addRecommendation(recommended, 'tech.data-ml', hasAny(deps, ML_DEPS), 'data/ML dependency');
  addRecommendation(recommended, 'tech.infrastructure', existsSync(join(workspaceRoot, 'Dockerfile')) || existsSync(join(workspaceRoot, 'docker-compose.yml')), 'container config');
  addRecommendation(recommended, 'tech.security', hasAny(deps, SECURITY_DEPS), 'security dependency');
  addRecommendation(recommended, 'tech.qa-automation', hasAny(deps, QA_DEPS), 'QA automation dependency');
  addRecommendation(recommended, 'tech.documentation', scan.documentation !== null, `documentation ${scan.documentation ?? 'none'}`);
  return recommended;
}

function addRecommendation(
  list: RecommendedSkillPack[],
  packId: string,
  matched: boolean,
  reason: string,
): void {
  if (!matched) return;
  const found = technologyPack(packId);
  if (found === undefined) return;
  list.push({ packId: found.id, version: found.version, reason });
}

function hasAny(deps: ReadonlySet<string>, names: readonly string[]): boolean {
  return names.some((name) => deps.has(name));
}

function dependencyNames(workspaceRoot: string): ReadonlySet<string> {
  const path = join(workspaceRoot, 'package.json');
  if (!existsSync(path)) return new Set();
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return new Set();
    const record = parsed as Record<string, unknown>;
    const deps = {
      ...(isRecord(record.dependencies) ? record.dependencies : {}),
      ...(isRecord(record.devDependencies) ? record.devDependencies : {}),
    };
    return new Set(Object.keys(deps));
  } catch {
    return new Set();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
