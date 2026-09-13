/**
 * First-slice HuntianLing Node/pnpm environment profile.
 */

import { CODING_REQUIRED_SKILL_IDS } from '../skills/coding-pack.js';
import { MKT_REQUIRED_SKILL_IDS } from '../skills/mkt-pack.js';
import {
  TOOL_DOC_SYNC,
  TOOL_ORIGINAL_REQUIREMENT_WRITE,
  TOOL_TEST,
  TOOL_TYPECHECK,
} from '../tools/registry.js';
import type { EnvironmentCommandSpec, EnvironmentConfig, EnvironmentProfile } from './types.js';

export const HUNTIANLING_NODE_PNPM_PROFILE: EnvironmentProfile = {
  id: 'huntianling.node-pnpm',
  version: '1.0.0',
  runtime: {
    node: '>=22',
    packageManager: 'pnpm',
  },
  commands: [
    {
      id: 'typecheck',
      toolId: TOOL_TYPECHECK,
      command: 'pnpm run typecheck',
      required: true,
    },
    {
      id: 'test',
      toolId: TOOL_TEST,
      command: 'pnpm run test',
      required: true,
    },
    {
      id: 'doc-sync',
      toolId: TOOL_DOC_SYNC,
      command: 'pnpm run doc-sync',
      required: false,
    },
    {
      id: 'lint',
      toolId: TOOL_TYPECHECK,
      command: 'pnpm run lint',
      required: false,
      probeMeansBlocked: true,
    },
    {
      id: 'hygiene',
      toolId: TOOL_TYPECHECK,
      command: 'pnpm run hygiene',
      required: false,
      probeMeansBlocked: true,
    },
  ],
  requiredSkillIds: [...MKT_REQUIRED_SKILL_IDS, ...CODING_REQUIRED_SKILL_IDS],
  requiredToolIds: [
    TOOL_TYPECHECK,
    TOOL_TEST,
    TOOL_DOC_SYNC,
    TOOL_ORIGINAL_REQUIREMENT_WRITE,
  ],
  allowedCapabilities: ['typecheck', 'test', 'doc-sync', 'original-requirement-write'],
};

export function resolveEnvironmentProfile(config: EnvironmentConfig = {}): EnvironmentProfile {
  const profileConfig = config.profile ?? {};
  const commands = config.commands ?? profileConfig.commands ?? HUNTIANLING_NODE_PNPM_PROFILE.commands;
  assertNonEmpty('environment profile id', profileConfig.id ?? HUNTIANLING_NODE_PNPM_PROFILE.id);
  assertNonEmpty('environment profile version', profileConfig.version ?? HUNTIANLING_NODE_PNPM_PROFILE.version);
  assertCommands(commands);
  return {
    id: profileConfig.id ?? HUNTIANLING_NODE_PNPM_PROFILE.id,
    version: profileConfig.version ?? HUNTIANLING_NODE_PNPM_PROFILE.version,
    runtime: {
      node: profileConfig.runtime?.node ?? HUNTIANLING_NODE_PNPM_PROFILE.runtime.node,
      packageManager: profileConfig.runtime?.packageManager ?? HUNTIANLING_NODE_PNPM_PROFILE.runtime.packageManager,
    },
    commands,
    requiredSkillIds: unique([
      ...(profileConfig.requiredSkillIds ?? HUNTIANLING_NODE_PNPM_PROFILE.requiredSkillIds),
    ]),
    requiredToolIds: unique([
      ...(profileConfig.requiredToolIds ?? HUNTIANLING_NODE_PNPM_PROFILE.requiredToolIds),
      ...commands.map((command) => command.toolId),
    ]),
    allowedCapabilities: unique([
      ...(profileConfig.allowedCapabilities ?? HUNTIANLING_NODE_PNPM_PROFILE.allowedCapabilities),
      ...commands.map((command) => command.id),
    ]),
  };
}

function assertCommands(commands: readonly EnvironmentCommandSpec[]): void {
  if (commands.length === 0) {
    throw new Error('environment profile commands are required');
  }
  const seen = new Set<string>();
  for (const command of commands) {
    assertNonEmpty('environment command id', command.id);
    assertNonEmpty(`environment command ${command.id}`, command.command);
    if (seen.has(command.id)) {
      throw new Error(`duplicate environment command id: ${command.id}`);
    }
    seen.add(command.id);
  }
}

function assertNonEmpty(label: string, value: string): void {
  if (value.trim() === '') {
    throw new Error(`${label} is required`);
  }
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
