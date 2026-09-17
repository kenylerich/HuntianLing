/**
 * Optional issue-tracker synchronization — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { BoardService } from '../board/plugin.js';
import { resolveWorkspaceRoot } from '../board/workspace.js';
import { createIssueSyncService, type IssueSyncService } from './service.js';

export type { IssueSyncService };

const IssueSyncPlugin: Plugin = {
  name: 'huntianling:issue-sync',
  inject: ['huntianling.board'],
  provide: 'huntianling.issueSync',

  apply(ctx: Context): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const configured = ctx.get('huntianling.workspaceRoot');
    const workspaceRoot = resolveWorkspaceRoot({
      ...(typeof configured === 'string' ? { explicit: configured } : {}),
      env: process.env,
    });
    ctx.provide('huntianling.issueSync', createIssueSyncService({ board, workspaceRoot }));
  },
};

export default IssueSyncPlugin;
