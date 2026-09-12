/**
 * JSON persistence for repositories, branches, changesets, and pull requests.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { Changeset, ManagedBranch, ProjectRepository, PullRequestRecord, ScmProvider } from './types.js';
import { isScmProvider } from './types.js';

const SCHEMA_VERSION = 1;

export interface ScmSnapshot {
  readonly schemaVersion: number;
  readonly repositories: ProjectRepository[];
  readonly branches: ManagedBranch[];
  readonly changesets: Changeset[];
  readonly pullRequests: PullRequestRecord[];
}

export function scmStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'scm.json');
}

export function emptyScmSnapshot(): ScmSnapshot {
  return { schemaVersion: SCHEMA_VERSION, repositories: [], branches: [], changesets: [], pullRequests: [] };
}

export function loadScmSnapshot(workspaceRoot: string): ScmSnapshot {
  try {
    const raw = readFileSync(scmStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as ScmSnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported scm schema ${String(parsed.schemaVersion)}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      repositories: (parsed.repositories ?? []).map(normalizeRepository),
      branches: parsed.branches ?? [],
      changesets: parsed.changesets ?? [],
      pullRequests: (parsed.pullRequests ?? []).map(normalizePullRequest),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return emptyScmSnapshot();
    throw error;
  }
}

export function saveScmSnapshot(workspaceRoot: string, snapshot: ScmSnapshot): void {
  const normalized: ScmSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    repositories: snapshot.repositories.map(normalizeRepository),
    branches: snapshot.branches,
    changesets: snapshot.changesets,
    pullRequests: snapshot.pullRequests.map(normalizePullRequest),
  };
  assertSnapshotHasNoSecrets(normalized);
  const path = scmStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(normalized, null, 2)}\n`);
}

function normalizeRepository(raw: ProjectRepository): ProjectRepository {
  return {
    id: raw.id,
    projectId: raw.projectId,
    name: raw.name,
    workspaceRoot: raw.workspaceRoot,
    defaultBranch: raw.defaultBranch,
    provider: parseStoredProvider(raw.provider),
    owner: raw.owner ?? null,
    repo: raw.repo ?? null,
    remoteUrl: raw.remoteUrl ?? null,
    apiBaseUrl: raw.apiBaseUrl ?? null,
  };
}

function normalizePullRequest(raw: PullRequestRecord): PullRequestRecord {
  return {
    id: raw.id,
    projectId: raw.projectId,
    repositoryId: raw.repositoryId,
    branchId: raw.branchId,
    workItemId: raw.workItemId,
    title: raw.title,
    base: raw.base,
    head: raw.head,
    status: raw.status,
    mergeSha: raw.mergeSha,
    actor: raw.actor,
    url: raw.url ?? null,
    providerPullRequestId: raw.providerPullRequestId ?? null,
  };
}

function parseStoredProvider(value: ScmProvider | undefined): ScmProvider {
  if (value === undefined) return 'local-git';
  if (!isScmProvider(value)) {
    throw new Error(`unsupported scm provider ${String(value)}`);
  }
  return value;
}

function assertSnapshotHasNoSecrets(snapshot: ScmSnapshot): void {
  for (const repository of snapshot.repositories) {
    if ('token' in repository || 'accessToken' in repository || 'secret' in repository) {
      throw new Error('scm snapshot must not persist tokens');
    }
  }
  if (/"token"\s*:/.test(JSON.stringify(snapshot))) {
    throw new Error('scm snapshot must not persist tokens');
  }
}
