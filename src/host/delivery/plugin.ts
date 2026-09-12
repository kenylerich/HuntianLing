/**
 * Story delivery capability — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { AgentRuntime } from '../agents/runtime.js';
import type { BoardService } from '../board/plugin.js';
import { resolveWorkspaceRoot } from '../board/workspace.js';
import { createDeliveryService, type DeliveryService } from './service.js';
import { resolveDeliveryConfig, type DeliveryConfig } from './types.js';

export type { DeliveryService };

const DeliveryPlugin: Plugin<DeliveryConfig> = {
  name: 'huntianling:delivery',
  inject: ['huntianling.board', 'huntianling.agents'],
  provide: 'huntianling.delivery',

  apply(ctx: Context, config: DeliveryConfig = {}): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    const agents = ctx.get('huntianling.agents') as AgentRuntime | undefined;
    if (!board) throw new Error('huntianling.board is required');
    if (!agents) throw new Error('huntianling.agents is required');
    const configured = ctx.get('huntianling.workspaceRoot');
    const workspaceRoot = resolveWorkspaceRoot({
      ...(typeof configured === 'string' ? { explicit: configured } : {}),
      env: process.env,
    });
    ctx.provide(
      'huntianling.delivery',
      createDeliveryService({
        board,
        agents,
        workspaceRoot,
        config: resolveDeliveryConfig(config),
      }),
    );
  },
};

export default DeliveryPlugin;
