/**
 * Workflow engine capability — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { AgentRuntime } from '../agents/runtime.js';
import type { BoardService } from '../board/plugin.js';
import { resolveWorkspaceRoot } from '../board/workspace.js';
import type { CollabService } from '../collab/service.js';
import type { DispatchService } from '../dispatch/service.js';
import type { ScmService } from '../scm/service.js';
import type { SkillService } from '../skills/service.js';
import { createWorkflowService, type WorkflowService } from './service.js';

export type { WorkflowService };

const WorkflowPlugin: Plugin = {
  name: 'huntianling:workflow',
  inject: ['huntianling.board'],
  provide: 'huntianling.workflow',

  apply(ctx: Context): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    const configured = ctx.get('huntianling.workspaceRoot');
    const workspaceRoot = resolveWorkspaceRoot({
      ...(typeof configured === 'string' ? { explicit: configured } : {}),
      env: process.env,
    });
    const collab = ctx.get('huntianling.collab') as CollabService | undefined;
    const agents = ctx.get('huntianling.agents') as AgentRuntime | undefined;
    const dispatch = ctx.get('huntianling.dispatch') as DispatchService | undefined;
    const scm = ctx.get('huntianling.scm') as ScmService | undefined;
    const skills = ctx.get('huntianling.skills') as SkillService | undefined;
    ctx.provide(
      'huntianling.workflow',
      createWorkflowService({
        board,
        workspaceRoot,
        ...(collab !== undefined ? { collab } : {}),
        ...(agents !== undefined ? { agents } : {}),
        ...(dispatch !== undefined ? { dispatch } : {}),
        ...(scm !== undefined ? { scm } : {}),
        ...(skills !== undefined ? { skills } : {}),
      }),
    );
  },
};

export default WorkflowPlugin;
