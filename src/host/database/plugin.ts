/**
 * Database capability — Service Definition.
 *
 * Provides `huntianling.database` so board, files, and later services persist
 * without importing a concrete driver.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import { resolveWorkspaceRoot } from '../board/workspace.js';
import { createDatabaseService } from './service.js';
import { resolveDatabaseConfig, type DatabaseConfig, type DatabaseService } from './types.js';

export type { DatabaseService };

const DatabasePlugin: Plugin<DatabaseConfig> = {
  name: 'huntianling:database',
  provide: 'huntianling.database',

  apply(ctx: Context, config: DatabaseConfig = {}): void {
    const configured = ctx.get('huntianling.workspaceRoot');
    const workspaceRoot = resolveWorkspaceRoot({
      ...(typeof configured === 'string' ? { explicit: configured } : {}),
      env: process.env,
    });
    const resolved = resolveDatabaseConfig(config);
    const service = createDatabaseService({
      workspaceRoot,
      config: resolved,
    });
    ctx.provide('huntianling.database', service);
    ctx.effect(() => () => service.close(), 'huntianling.database.close');
  },
};

export default DatabasePlugin;
