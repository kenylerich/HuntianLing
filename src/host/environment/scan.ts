/**
 * Scan a workspace for language, framework, package manager, commands, CI, and docs.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ProjectSkillScan } from './types.js';

const FRAMEWORKS = ['next', 'nuxt', 'react', 'vue', 'express', 'fastify', 'koa'] as const;

export function scanProjectSkills(workspaceRoot: string): ProjectSkillScan {
  const packageJsonPath = join(workspaceRoot, 'package.json');
  const packageJson = readPackageJson(packageJsonPath);
  const deps = {
    ...(isRecord(packageJson?.dependencies) ? packageJson.dependencies : {}),
    ...(isRecord(packageJson?.devDependencies) ? packageJson.devDependencies : {}),
  };
  const scripts = isRecord(packageJson?.scripts) ? packageJson.scripts : {};
  const hasTypescript = existsSync(join(workspaceRoot, 'tsconfig.json')) || typeof deps.typescript === 'string';
  return {
    language: packageJson === undefined ? null : hasTypescript ? 'typescript' : 'javascript',
    framework: FRAMEWORKS.find((name) => typeof deps[name] === 'string') ?? null,
    packageManager: detectPackageManager(workspaceRoot),
    buildCommand: typeof scripts.build === 'string' ? scripts.build : null,
    testCommand: typeof scripts.test === 'string' ? scripts.test : null,
    ciConfig: detectCiConfig(workspaceRoot),
    documentation: detectDocumentation(workspaceRoot),
  };
}

function readPackageJson(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function detectPackageManager(workspaceRoot: string): string | null {
  if (existsSync(join(workspaceRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(workspaceRoot, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(workspaceRoot, 'bun.lockb'))) return 'bun';
  if (existsSync(join(workspaceRoot, 'package-lock.json'))) return 'npm';
  return existsSync(join(workspaceRoot, 'package.json')) ? 'npm' : null;
}

function detectCiConfig(workspaceRoot: string): string | null {
  if (hasFiles(join(workspaceRoot, '.github', 'workflows'))) return '.github/workflows';
  if (hasFiles(join(workspaceRoot, '.gitea', 'workflows'))) return '.gitea/workflows';
  if (existsSync(join(workspaceRoot, '.gitlab-ci.yml'))) return '.gitlab-ci.yml';
  return null;
}

function detectDocumentation(workspaceRoot: string): string | null {
  if (existsSync(join(workspaceRoot, 'README.md'))) return 'README.md';
  if (existsSync(join(workspaceRoot, 'docs'))) return 'docs';
  return null;
}

function hasFiles(directory: string): boolean {
  if (!existsSync(directory)) return false;
  try {
    return readdirSync(directory).length > 0;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
