/**
 * Web capability — Service Definition.
 *
 * Provides a browser surface and JSON API over the same internal Board and
 * Requirement services that dsh uses in-process.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { AuthorityService } from '../authority/service.js';
import type { AgentRuntime } from '../agents/runtime.js';
import type { DatabaseService } from '../database/types.js';
import type { RequirementManagementService } from '../agile/requirements.js';
import type { BoardService } from '../board/plugin.js';
import type { CiService } from '../ci/service.js';
import type { CollabService } from '../collab/service.js';
import type { EnvironmentService } from '../environment/service.js';
import type { DeliveryService } from '../delivery/service.js';
import type { HarnessService } from '../harness/service.js';
import type { ScmService } from '../scm/service.js';
import type { WorkflowService } from '../workflow/service.js';
import type { DispatchService } from '../dispatch/service.js';
import type { SkillService } from '../skills/service.js';
import { createWebService, resolveWebConfig } from './server.js';
import type { WebConfig } from './types.js';

const WebPlugin: Plugin<WebConfig> = {
  name: 'huntianling:web',
  inject: ['huntianling.board', 'huntianling.requirements'],
  provide: 'huntianling.web',

  apply(ctx: Context, config: WebConfig = {}): void {
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    const requirements = ctx.get('huntianling.requirements') as RequirementManagementService | undefined;
    if (!board) throw new Error('huntianling.board is required');
    if (!requirements) throw new Error('huntianling.requirements is required');

    const resolved = resolveWebConfig(config);
    const collab = ctx.get('huntianling.collab') as CollabService | undefined;
    const environment = ctx.get('huntianling.environment') as EnvironmentService | undefined;
    const scm = ctx.get('huntianling.scm') as ScmService | undefined;
    const ci = ctx.get('huntianling.ci') as CiService | undefined;
    const agents = ctx.get('huntianling.agents') as AgentRuntime | undefined;
    const delivery = ctx.get('huntianling.delivery') as DeliveryService | undefined;
    const harness = ctx.get('huntianling.harness') as HarnessService | undefined;
    const authority = ctx.get('huntianling.authority') as AuthorityService | undefined;
    const database = ctx.get('huntianling.database') as DatabaseService | undefined;
    const workflow = ctx.get('huntianling.workflow') as WorkflowService | undefined;
    const dispatch = ctx.get('huntianling.dispatch') as DispatchService | undefined;
    const skills = ctx.get('huntianling.skills') as SkillService | undefined;
    const service = createWebService({
      board,
      requirements,
      ...(collab !== undefined ? { collab } : {}),
      ...(environment !== undefined ? { environment } : {}),
      ...(scm !== undefined ? { scm } : {}),
      ...(ci !== undefined ? { ci } : {}),
      ...(agents !== undefined ? { agents } : {}),
      ...(delivery !== undefined ? { delivery } : {}),
      ...(harness !== undefined ? { harness } : {}),
      ...(authority !== undefined ? { authority } : {}),
      ...(database !== undefined ? { database } : {}),
      ...(workflow !== undefined ? { workflow } : {}),
      ...(dispatch !== undefined ? { dispatch } : {}),
      ...(skills !== undefined ? { skills } : {}),
    }, config);
    ctx.provide('huntianling.web', service);
    ctx.effect(() => () => service.stop(), 'huntianling.web.stop');
    if (resolved.enabled && resolved.autoStart) {
      ctx.effect(async () => {
        await service.start();
        return () => service.stop();
      }, 'huntianling.web.start');
    }
  },
};

export default WebPlugin;
