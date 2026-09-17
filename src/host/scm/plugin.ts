/**
 * Local Git and hosted SCM write adapters — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { AuthorityService } from '../authority/service.js';
import type { BoardService } from '../board/plugin.js';
import { resolvePluginWorkspaceRoot } from '../workspace-context.js';
import { createScmService, type ScmService } from './service.js';
import { resolveScmConfig, type ScmConfig } from './types.js';

export type { ScmService };

const ScmPlugin: Plugin<ScmConfig> = {
  name: 'huntianling:scm',
  inject: ['huntianling.board'],
  provide: 'huntianling.scm',

  apply(ctx: Context, config: ScmConfig = {}): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const authority = ctx.get('huntianling.authority') as AuthorityService | undefined;
    const workspaceRoot = resolvePluginWorkspaceRoot(ctx);
    ctx.provide(
      'huntianling.scm',
      createScmService({
        board,
        workspaceRoot,
        config: resolveScmConfig(config),
        ...(authority !== undefined ? { authority } : {}),
      }),
    );
  },
};

export default ScmPlugin;
