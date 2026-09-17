/**
 * Database capability — Service Definition.
 *
 * Provides `huntianling.database` so board, files, and later services persist
 * without importing SQLite or PostgreSQL.
 */

import type { Context, Plugin } from '@deepseek-ai/cordis';

import { resolvePluginWorkspaceRoot } from '../workspace-context.js';
import { createDatabaseService } from './service.js';
import { resolveDatabaseConfig, type DatabaseConfig, type DatabaseService } from './types.js';

export type { DatabaseService };

const DatabasePlugin: Plugin<DatabaseConfig> = {
  name: 'huntianling:database',
  provide: 'huntianling.database',

  apply(ctx: Context, config: DatabaseConfig = {}): void {
    const workspaceRoot = resolvePluginWorkspaceRoot(ctx);
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
