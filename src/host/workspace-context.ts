import type { Context } from '@deepseek-ai/cordis';

import { resolveWorkspaceRoot } from './board/workspace.js';

/** Resolve the workspace exported by the activating root plugin. */
export function resolvePluginWorkspaceRoot(ctx: Context): string {
  const configured = ctx.get('huntianling.workspaceRoot', false);
  return resolveWorkspaceRoot({
    ...(typeof configured === 'string' ? { explicit: configured } : {}),
    env: process.env,
  });
}
