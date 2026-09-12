/**
 * Local Git inspect and WorkItem link results.
 */

export interface GitCommandResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type GitCommandRunner = (
  args: readonly string[],
  cwd: string,
) => GitCommandResult;

export interface LocalGitInspect {
  readonly workspaceRoot: string;
  readonly branch: string;
  readonly head: string;
  readonly dirty: boolean;
  readonly remotes: readonly string[];
}

export interface ScmLinkInput {
  readonly workItemId: string;
  readonly workspaceRoot: string;
}

export interface ScmPushInput {
  readonly workItemId: string;
  readonly workspaceRoot: string;
  readonly role: string;
  readonly actor: string;
  readonly approvalId?: string;
}

export interface ScmPullRequestInput {
  readonly workItemId: string;
  readonly role: string;
  readonly actor: string;
  readonly approvalId?: string;
  readonly title?: string;
  readonly branchId?: string;
}

export interface ScmConfig {
  readonly branchNameTemplate?: string;
  readonly protectedBranches?: readonly string[];
  readonly commitMessageTemplate?: string;
}

export interface ResolvedScmConfig {
  readonly branchNameTemplate: string;
  readonly protectedBranches: readonly string[];
  readonly commitMessageTemplate: string;
}

export function resolveScmConfig(input: ScmConfig = {}): ResolvedScmConfig {
  const branchNameTemplate = input.branchNameTemplate ?? 'htl/{workItemId}';
  const protectedBranches = input.protectedBranches ?? ['main', 'master'];
  const commitMessageTemplate = input.commitMessageTemplate ?? '{workItemId}: {title}';
  if (branchNameTemplate.trim() === '' || !branchNameTemplate.includes('{workItemId}')) {
    throw new Error('scm branchNameTemplate must include {workItemId}');
  }
  if (commitMessageTemplate.trim() === '' || !commitMessageTemplate.includes('{workItemId}')) {
    throw new Error('scm commitMessageTemplate must include {workItemId}');
  }
  if (protectedBranches.some((name) => name.trim() === '')) {
    throw new Error('scm protectedBranches cannot contain a blank name');
  }
  return { branchNameTemplate, protectedBranches, commitMessageTemplate };
}

export type BranchPurpose = 'work-item' | 'milestone' | 'fix' | 'experiment' | 'release';
export type ManagedBranchStatus = 'active' | 'stale' | 'merged' | 'abandoned';
export type PullRequestStatus = 'open' | 'merged' | 'closed';
export type ChangesetStatus = 'draft' | 'committed';
export type ScmProvider = 'local-git' | 'github' | 'gitea' | 'gitlab';
export type HostedScmProvider = Exclude<ScmProvider, 'local-git'>;

export const SCM_PROVIDERS: readonly ScmProvider[] = ['local-git', 'github', 'gitea', 'gitlab'];
export const HOSTED_SCM_PROVIDERS: readonly HostedScmProvider[] = ['github', 'gitea', 'gitlab'];

export function isScmProvider(value: string): value is ScmProvider {
  return (SCM_PROVIDERS as readonly string[]).includes(value);
}

export function isHostedScmProvider(value: string): value is HostedScmProvider {
  return (HOSTED_SCM_PROVIDERS as readonly string[]).includes(value);
}

export interface HostedScmRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface HostedScmResponse {
  readonly status: number;
  readonly body: string;
}

export type HostedScmTransport = (request: HostedScmRequest) => HostedScmResponse;

export interface ProjectRepository {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly workspaceRoot: string;
  readonly defaultBranch: string;
  readonly provider: ScmProvider;
  readonly owner: string | null;
  readonly repo: string | null;
  readonly remoteUrl: string | null;
  readonly apiBaseUrl: string | null;
}

export interface BranchSyncResult {
  readonly at: number;
  readonly unpushed: boolean;
  readonly diverged: boolean;
  readonly conflict: boolean;
  readonly unlinked: boolean;
  readonly ahead: number;
  readonly behind: number;
  readonly detail: string;
}

export interface ManagedBranch {
  readonly id: string;
  readonly repositoryId: string;
  readonly projectId: string;
  readonly name: string;
  readonly baseBranch: string;
  readonly targetBranch: string;
  readonly purpose: BranchPurpose;
  readonly workItemIds: readonly string[];
  readonly milestoneId: string | null;
  readonly owner: string;
  readonly creator: string;
  readonly status: ManagedBranchStatus;
  readonly protection: 'none' | 'protected';
  readonly parentBranchId: string | null;
  readonly lastSync: BranchSyncResult | null;
}

export interface Changeset {
  readonly id: string;
  readonly projectId: string;
  readonly workItemId: string;
  readonly repositoryId: string;
  readonly branchId: string;
  readonly patch: string;
  readonly files: readonly string[];
  readonly author: string;
  readonly actor: string;
  readonly message: string;
  readonly commitSha: string | null;
  readonly status: ChangesetStatus;
  readonly createdAt: number;
}

export interface PullRequestRecord {
  readonly id: string;
  readonly projectId: string;
  readonly repositoryId: string;
  readonly branchId: string;
  readonly workItemId: string;
  readonly title: string;
  readonly base: string;
  readonly head: string;
  readonly status: PullRequestStatus;
  readonly mergeSha: string | null;
  readonly actor: string;
  readonly url: string | null;
  readonly providerPullRequestId: string | null;
}

export interface WorkItemCodeView {
  readonly repositories: readonly ProjectRepository[];
  readonly branches: readonly ManagedBranch[];
  readonly changesets: readonly Changeset[];
  readonly pullRequests: readonly PullRequestRecord[];
  readonly commits: readonly { readonly id: string; readonly label: string; readonly sha: string }[];
  readonly diffs: readonly { readonly id: string; readonly patch: string }[];
  readonly changedFiles: readonly string[];
  readonly unlinked: boolean;
}

export class ScmError extends Error {
  constructor(readonly code: 'GIT' | 'NOT_FOUND' | 'VALIDATION' | 'AUTHORITY' | 'HOSTED', message: string) {
    super(message);
  }
}
