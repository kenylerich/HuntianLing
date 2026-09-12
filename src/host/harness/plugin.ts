/**
 * Harness measurement capability — Service Definition.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import type { AgentRuntime } from '../agents/runtime.js';
import type { BoardService } from '../board/plugin.js';
import { resolveWorkspaceRoot } from '../board/workspace.js';
import type { EnvironmentService } from '../environment/service.js';
import type { SkillService } from '../skills/service.js';
import { defaultHarnessLlmTransport } from './hosted.js';
import { createHarnessService, type HarnessService } from './service.js';
import {
  resolveHarnessConfig,
  resolveHarnessLlmEndpoint,
  resolveHarnessLlmToken,
  type HarnessConfig,
} from './types.js';

export type { HarnessService };

const HarnessPlugin: Plugin<HarnessConfig> = {
  name: 'huntianling:harness',
  inject: ['huntianling.skills'],
  provide: 'huntianling.harness',

  apply(ctx: Context, config: HarnessConfig = {}): void {
    const skills = ctx.get('huntianling.skills') as SkillService | undefined;
    if (!skills) throw new Error('huntianling.skills is required');
    const board = ctx.get('huntianling.board') as BoardService | undefined;
    const agents = ctx.get('huntianling.agents') as AgentRuntime | undefined;
    const environment = ctx.get('huntianling.environment') as EnvironmentService | undefined;
    const configured = ctx.get('huntianling.workspaceRoot');
    const workspaceRoot = resolveWorkspaceRoot({
      ...(typeof configured === 'string' ? { explicit: configured } : {}),
      env: process.env,
    });
    const endpoint = resolveHarnessLlmEndpoint(config, process.env);
    let liveModel: {
      readonly url: string;
      readonly model: string;
      readonly token: string;
      readonly transport: typeof defaultHarnessLlmTransport;
    } | undefined;
    if (endpoint.url !== null) {
      liveModel = {
        url: endpoint.url,
        model: endpoint.model,
        token: resolveHarnessLlmToken(undefined, process.env),
        transport: defaultHarnessLlmTransport,
      };
    }
    ctx.provide(
      'huntianling.harness',
      createHarnessService({
        skills,
        workspaceRoot,
        config: resolveHarnessConfig(config),
        ...(board !== undefined ? { board } : {}),
        ...(agents !== undefined ? { agents } : {}),
        ...(environment !== undefined ? { environment } : {}),
        ...(liveModel !== undefined ? { liveModel } : {}),
      }),
    );
  },
};

export default HarnessPlugin;
