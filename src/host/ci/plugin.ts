/**
 * Local and hosted CI adapters — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { AuthorityService } from '../authority/service.js';
import type { BoardService } from '../board/plugin.js';
import { createCiService, type CiService } from './service.js';
import type { CiConfig } from './types.js';
import { resolvePluginWorkspaceRoot } from '../workspace-context.js';

export type { CiService };

const CiPlugin: Plugin<CiConfig> = {
  name: 'huntianling:ci',
  inject: ['huntianling.board'],
  provide: 'huntianling.ci',

  apply(ctx: Context, config: CiConfig = {}): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const authority = ctx.get('huntianling.authority') as AuthorityService | undefined;
    const workspaceRoot = resolvePluginWorkspaceRoot(ctx);
    ctx.provide(
      'huntianling.ci',
      createCiService({
        board,
        workspaceRoot,
        config,
        ...(authority !== undefined ? { authority } : {}),
      }),
    );
  },
};

export default CiPlugin;
