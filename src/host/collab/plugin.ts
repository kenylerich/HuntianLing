/**
 * Agent Channel capability — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { BoardService } from '../board/plugin.js';
import { createCollabService, type CollabService } from './service.js';

export type { CollabService };

const CollabPlugin: Plugin = {
  name: 'huntianling:collab',
  inject: ['huntianling.board'],
  provide: 'huntianling.collab',

  apply(ctx: Context): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    ctx.provide('huntianling.collab', createCollabService({ board }));
  },
};

export default CollabPlugin;
