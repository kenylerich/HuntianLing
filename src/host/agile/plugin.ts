/**
 * Agile methodology capability — Service Definition.
 *
 * This file publishes the Cordis Service API for requirement management.
 * Requirement intake and workflow orchestration live beside this service and
 * use the board WorkItem store as their persistence surface.
 *
 * Conventions (see AGENTS.md):
 *   - the Plugin's `apply` body owns all contributions via ctx.effect()
 *   - hard Service dependencies go in `inject`
 *   - typed events are declared on a merge-extensible EventMap
 *
 * TODO once the workflow lands: declare the merged EventMap for
 * `requirement/submitted` and `workflow/state-changed`.
 */

import type { Context, Plugin, Service } from '@deepseek-ai/cordis';

import type { BoardService } from '../board/plugin.js';
import {
  createRequirementManagementService,
  type RequirementManagementService,
} from './requirements.js';

/**
 * Public Service contract for the agile requirement-management capability.
 */
export interface AgileService extends Service, RequirementManagementService {}

const AgilePlugin: Plugin = {
  name: 'huntianling:agile',
  inject: ['huntianling.board'],
  provide: 'huntianling.requirements',

  apply(ctx: Context): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    ctx.provide('huntianling.requirements', createRequirementManagementService(board));
  },
};

export default AgilePlugin;
