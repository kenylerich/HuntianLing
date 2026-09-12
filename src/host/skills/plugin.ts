/**
 * Skills capability — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import { createSkillService, type SkillService } from './service.js';

export type { SkillService };

const SkillsPlugin: Plugin = {
  name: 'huntianling:skills',
  provide: 'huntianling.skills',

  apply(ctx: Context): void {
    const workspaceRoot = ctx.get('huntianling.workspaceRoot') as string | undefined;
    ctx.provide(
      'huntianling.skills',
      createSkillService(workspaceRoot !== undefined ? { workspaceRoot } : {}),
    );
  },
};

export default SkillsPlugin;
