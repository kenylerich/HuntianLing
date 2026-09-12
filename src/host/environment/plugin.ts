/**
 * Environment capability — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { BoardService } from '../board/plugin.js';
import type { DatabaseService } from '../database/types.js';
import type { SkillService } from '../skills/service.js';
import { createEnvironmentService, type EnvironmentService } from './service.js';

export type { EnvironmentService };

const EnvironmentPlugin: Plugin = {
  name: 'huntianling:environment',
  inject: ['huntianling.skills'],
  provide: 'huntianling.environment',

  apply(ctx: Context): void {
    const skills = ctx.get('huntianling.skills') as SkillService | undefined;
    if (!skills) throw new Error('huntianling.skills is required');
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    const database = ctx.get('huntianling.database') as DatabaseService | undefined;
    ctx.provide(
      'huntianling.environment',
      createEnvironmentService({
        skills,
        ...(board !== undefined ? { board } : {}),
        ...(database !== undefined ? { database } : {}),
      }),
    );
  },
};

export default EnvironmentPlugin;
