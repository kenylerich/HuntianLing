/**
 * Local and hosted CI adapters — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { AuthorityService } from '../authority/service.js';
import type { BoardService } from '../board/plugin.js';
import { createCiService, type CiService } from './service.js';

export type { CiService };

const CiPlugin: Plugin = {
  name: 'huntianling:ci',
  inject: ['huntianling.board'],
  provide: 'huntianling.ci',

  apply(ctx: Context): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const authority = ctx.get('huntianling.authority') as AuthorityService | undefined;
    ctx.provide(
      'huntianling.ci',
      createCiService({
        board,
        ...(authority !== undefined ? { authority } : {}),
      }),
    );
  },
};

export default CiPlugin;
