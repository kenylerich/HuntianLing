/**
 * Optional issue-tracker synchronization — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { BoardService } from '../board/plugin.js';
import { resolvePluginWorkspaceRoot } from '../workspace-context.js';
import { createIssueSyncService, type IssueSyncService } from './service.js';

export type { IssueSyncService };

const IssueSyncPlugin: Plugin = {
  name: 'huntianling:issue-sync',
  inject: ['huntianling.board'],
  provide: 'huntianling.issueSync',

  apply(ctx: Context): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const workspaceRoot = resolvePluginWorkspaceRoot(ctx);
    ctx.provide('huntianling.issueSync', createIssueSyncService({ board, workspaceRoot }));
  },
};

export default IssueSyncPlugin;
