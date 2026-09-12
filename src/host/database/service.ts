/**
 * Factory for `huntianling.database`. Driver selection is explicit and fails
 * loud when the requested driver is not available in this deployment.
 */

import { SqliteDatabase } from './sqlite.js';
import {
  resolveDatabaseConfig,
  type CreateDatabaseServiceInput,
  type DatabaseService,
} from './types.js';

export function createDatabaseService(input: CreateDatabaseServiceInput): DatabaseService {
  const config = resolveDatabaseConfig(input.config);
  return new SqliteDatabase({
    workspaceRoot: input.workspaceRoot,
    config,
    ...(input.storage !== undefined ? { storage: input.storage } : {}),
  });
}

export type { DatabaseService };
