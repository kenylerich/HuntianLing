/**
 * Factory for huntianling.database. Driver selection is explicit and fails
 * loud when the requested driver cannot be used in this deployment.
 */

import { PersistentDatabase } from './persistence.js';
import { createWorkerPostgresClient, PostgresEngine } from './postgres.js';
import { SqliteEngine } from './sqlite.js';
import {
  resolveDatabaseConfig,
  type CreateDatabaseServiceInput,
  type DatabaseService,
  type ResolvedDatabaseConfig,
} from './types.js';

export function createDatabaseService(input: CreateDatabaseServiceInput): DatabaseService {
  const config = resolveDatabaseConfig(input.config);
  const engine =
    config.driver === 'sqlite'
      ? new SqliteEngine(input.workspaceRoot, config.sqlitePath)
      : new PostgresEngine(resolvePostgresClient(config, input));
  return new PersistentDatabase({
    driver: config.driver,
    workspaceRoot: input.workspaceRoot,
    config,
    engine,
    ...(input.storage !== undefined ? { storage: input.storage } : {}),
  });
}

function resolvePostgresClient(
  config: Extract<ResolvedDatabaseConfig, { driver: 'postgresql' }>,
  input: CreateDatabaseServiceInput,
) {
  if (input.postgresClient !== undefined) return input.postgresClient;
  return createWorkerPostgresClient(config.postgresUrl);
}

export type { DatabaseService };
