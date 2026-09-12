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
import type { EnvironmentProfile } from './types.js';

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
