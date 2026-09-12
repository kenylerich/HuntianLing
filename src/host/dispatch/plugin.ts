/**
 * Dispatch, leases, and Agent feedback — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { AuthorityService } from '../authority/service.js';
import type { BoardService } from '../board/plugin.js';
import { resolveWorkspaceRoot } from '../board/workspace.js';
import type { CollabService } from '../collab/service.js';
import type { ScmService } from '../scm/service.js';
import { createDispatchService, type DispatchService } from './service.js';
import { resolveDispatchConfig, type DispatchConfig } from './types.js';

export type { DispatchService };

const DispatchPlugin: Plugin<DispatchConfig> = {
  name: 'huntianling:dispatch',
  inject: ['huntianling.board'],
  provide: 'huntianling.dispatch',

  apply(ctx: Context, config: DispatchConfig = {}): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const configured = ctx.get('huntianling.workspaceRoot');
    const workspaceRoot = resolveWorkspaceRoot({
      ...(typeof configured === 'string' ? { explicit: configured } : {}),
      env: process.env,
    });
    const collab = ctx.get('huntianling.collab') as CollabService | undefined;
    const scm = ctx.get('huntianling.scm') as ScmService | undefined;
    const authority = ctx.get('huntianling.authority') as AuthorityService | undefined;
    ctx.provide(
      'huntianling.dispatch',
      createDispatchService({
        board,
        workspaceRoot,
        config: resolveDispatchConfig(config),
        ...(collab !== undefined ? { collab } : {}),
        ...(scm !== undefined ? { scm } : {}),
        ...(authority !== undefined ? { authority } : {}),
      }),
    );
  },
};

export default DispatchPlugin;
