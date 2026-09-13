/**
 * Three-agent runtime — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { BoardService } from '../board/plugin.js';
import type { EnvironmentService } from '../environment/service.js';
import type { SkillService } from '../skills/service.js';
import type { GovernanceService } from '../governance/service.js';
import { createAgentRuntime, type AgentRuntime } from './runtime.js';

export type { AgentRuntime };

const AgentsPlugin: Plugin = {
  name: 'huntianling:agents',
  inject: ['huntianling.skills', 'huntianling.board', 'huntianling.environment'],
  provide: 'huntianling.agents',

  apply(ctx: Context): void {
    const skills = ctx.get('huntianling.skills') as SkillService | undefined;
    if (!skills) throw new Error('huntianling.skills is required');
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    const environment = ctx.get('huntianling.environment') as EnvironmentService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    if (!environment) throw new Error('huntianling.environment is required');
    const governance = ctx.get('huntianling.governance') as GovernanceService | undefined;
    ctx.provide(
      'huntianling.agents',
      createAgentRuntime({
        skills,
        board,
        environment,
        ...(governance !== undefined ? { governance } : {}),
      }),
    );
  },
};

export default AgentsPlugin;
