/**
 * Agent authority capability — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { BoardService } from '../board/plugin.js';
import { resolvePluginWorkspaceRoot } from '../workspace-context.js';
import { createAuthorityService, type AuthorityService } from './service.js';
import { resolveAuthorityConfig, type AuthorityConfig } from './types.js';

export type { AuthorityService };

const AuthorityPlugin: Plugin<AuthorityConfig> = {
  name: 'huntianling:authority',
  inject: ['huntianling.board'],
  provide: 'huntianling.authority',

  apply(ctx: Context, config: AuthorityConfig = {}): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const workspaceRoot = resolvePluginWorkspaceRoot(ctx);
    ctx.provide(
      'huntianling.authority',
      createAuthorityService({
        board,
        workspaceRoot,
        config: resolveAuthorityConfig(config),
      }),
    );
  },
};

export default AuthorityPlugin;
