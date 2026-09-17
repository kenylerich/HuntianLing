/**
 * Governance capability — Service Definition.
 *
 * Provides huntianling.governance for obligation lifecycle and control packs.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { BoardService } from '../board/plugin.js';
import { resolvePluginWorkspaceRoot } from '../workspace-context.js';
import { createGovernanceService, type GovernanceService } from './service.js';

export type { GovernanceService };

const GovernancePlugin: Plugin = {
  name: 'huntianling:governance',
  inject: ['huntianling.board'],
  provide: 'huntianling.governance',

  apply(ctx: Context): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const workspaceRoot = resolvePluginWorkspaceRoot(ctx);
    ctx.provide('huntianling.governance', createGovernanceService({ board, workspaceRoot }));
  },
};

export default GovernancePlugin;
