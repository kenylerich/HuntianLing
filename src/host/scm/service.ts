/**
 * Local Git adapter: inspect and link HEAD to a WorkItem.
 */

import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import type { AuthorityService } from '../authority/service.js';
import { AuthorityError } from '../authority/types.js';
import type { BoardService } from '../board/plugin.js';
import {
  mergeChecksByProducer,
  workItemDesignRevision,
} from '../board/executed-evidence.js';
import type { DeliveryEvidenceSummary, WorkItemId } from '../board/types.js';
import {
  createToolRegistry,
  TOOL_GIT_BRANCH,
  TOOL_GIT_COMMIT,
  TOOL_GIT_INSPECT,
  TOOL_GIT_PUSH,
  TOOL_MERGE,
  TOOL_PULL_REQUEST,
  type ToolRegistry,
} from '../tools/registry.js';
import {
  defaultHostedTransport,
  hostedMerge,
  hostedOpenPullRequest,
  hostedPush,
  resolveHostedToken,
} from './hosted.js';
import { emptyScmSnapshot, loadScmSnapshot, saveScmSnapshot } from './store.js';
import type {
  BranchPurpose,
  Changeset,
  GitCommandRunner,
  HostedScmTransport,
  LocalGitInspect,
  ManagedBranch,
  ProjectRepository,
  PullRequestRecord,
  ScmConfig,
  ScmLinkInput,
  ScmPullRequestInput,
  ScmPushInput,
  WorkItemCodeView,
} from './types.js';
import { isHostedScmProvider, isScmProvider, resolveScmConfig, ScmError } from './types.js';

export interface ScmService {
  inspect(workspaceRoot: string): LocalGitInspect;
  linkHead(input: ScmLinkInput): DeliveryEvidenceSummary;
  push(input: ScmPushInput): DeliveryEvidenceSummary;
  openPullRequest(input: ScmPullRequestInput): DeliveryEvidenceSummary;
  registerRepository(input: {
    readonly projectId: string;
    readonly name: string;
    readonly workspaceRoot: string;
    readonly defaultBranch?: string;
    readonly provider?: string;
    readonly owner?: string;
    readonly repo?: string;
    readonly remoteUrl?: string;
    readonly apiBaseUrl?: string;
  }): ProjectRepository;
  listRepositories(projectId: string): readonly ProjectRepository[];
  createBranch(input: {
    readonly workItemId: string;
    readonly actor: string;
    readonly role?: string;
    readonly purpose?: BranchPurpose;
    readonly parentBranchId?: string;
    readonly workspaceRoot?: string;
  }): ManagedBranch;
  listBranches(filter: { readonly projectId?: string; readonly workItemId?: string }): readonly ManagedBranch[];
  syncBranch(branchId: string, workspaceRoot?: string): ManagedBranch;
  rebaseCheck(branchId: string, workspaceRoot?: string): ManagedBranch;
  createChangeset(input: {
    readonly workItemId: string;
    readonly branchId: string;
    readonly actor: string;
    readonly role?: string;
    readonly patch?: string;
    readonly files?: readonly string[];
  }): Changeset;
  listChangesets(workItemId: string): readonly Changeset[];
  commitChangeset(input: {
    readonly changesetId: string;
    readonly actor: string;
    readonly role?: string;
    readonly workspaceRoot?: string;
  }): Changeset;
  pushBranch(input: {
    readonly branchId: string;
    readonly actor: string;
    readonly role: string;
    readonly approvalId?: string;
    readonly workspaceRoot?: string;
    readonly token?: string;
  }): ManagedBranch;
  openBranchPullRequest(input: {
    readonly branchId: string;
    readonly actor: string;
    readonly role: string;
    readonly approvalId?: string;
    readonly title?: string;
    readonly token?: string;
  }): PullRequestRecord;
  mergePullRequest(input: {
    readonly pullRequestId: string;
    readonly actor: string;
    readonly role: string;
    readonly approvalId?: string;
    readonly token?: string;
  }): PullRequestRecord;
  codeView(workItemId: string): WorkItemCodeView;
  unlinkedCode(projectId: string): readonly ManagedBranch[];
  importUnlinkedBranch(input: {
    readonly repositoryId: string;
    readonly name: string;
    readonly actor: string;
  }): ManagedBranch;
}

export function createScmService(deps: {
  readonly board: BoardService;
  readonly runner?: GitCommandRunner;
  readonly hosted?: HostedScmTransport;
  readonly tools?: ToolRegistry;
  readonly authority?: AuthorityService;
  readonly workspaceRoot?: string;
  readonly config?: ScmConfig;
  readonly env?: NodeJS.ProcessEnv;
}): ScmService {
  const tools = deps.tools ?? createToolRegistry();
  const runner = deps.runner ?? defaultGitRunner;
  const hosted = deps.hosted ?? defaultHostedTransport;
  const env = deps.env ?? process.env;
  const config = resolveScmConfig(deps.config ?? {});
  let snapshot = deps.workspaceRoot !== undefined ? loadScmSnapshot(deps.workspaceRoot) : emptyScmSnapshot();

  const service: ScmService = {
    inspect(workspaceRoot) {
      tools.assertAllowed(TOOL_GIT_INSPECT, 'scm', 'scm.inspect');
      const inspect = inspectGit(runner, workspaceRoot);
      tools.recordCall({
        toolId: TOOL_GIT_INSPECT,
        role: 'scm',
        taskType: 'scm.inspect',
        affectsDelivery: false,
        result: 'ran',
        detail: `${inspect.branch}@${inspect.head}`,
      });
      return inspect;
    },

    linkHead(input) {
      tools.assertAllowed(TOOL_GIT_INSPECT, 'scm', 'scm.link');
      const item = deps.board.getWorkItem(input.workItemId as WorkItemId);
      if (item === undefined) {
        throw new ScmError('NOT_FOUND', `work item not found: ${input.workItemId}`);
      }
      const inspect = inspectGit(runner, input.workspaceRoot);
      if (inspect.head === '') {
        throw new ScmError('GIT', 'local Git HEAD is empty');
      }
      const revision = workItemDesignRevision(item);
      const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
      const existingChecks = existing?.checks ?? [];
      const existingProvenance = existing?.provenanceLinks ?? [];
      const commitId = `git:${inspect.head}`;
      const branchId = `git-branch:${inspect.branch}`;
      const codeLinks = [
        {
          kind: 'commit' as const,
          id: commitId,
          label: inspect.head,
          url: null,
          acceptanceCriterionIds: [],
        },
        {
          kind: 'branch' as const,
          id: branchId,
          label: inspect.branch,
          url: null,
          acceptanceCriterionIds: [],
        },
      ];
      const check = {
        id: 'scm-head',
        area: 'code' as const,
        title: 'Local Git HEAD linked',
        status: 'passing' as const,
        required: true,
        reason: `Linked ${inspect.branch} at ${inspect.head}`,
        evidenceIds: [commitId],
        acceptanceCriterionIds: [],
        links: codeLinks,
        producer: 'scm' as const,
        executionKind: 'executed' as const,
        designRevision: revision,
      };
      tools.recordCall({
        toolId: TOOL_GIT_INSPECT,
        role: 'scm',
        taskType: 'scm.link',
        affectsDelivery: true,
        result: 'ran',
        detail: inspect.head,
      });
      return deps.board.updateDeliveryEvidenceSummary(item.id, {
        codeLinks,
        checks: mergeChecksByProducer(existingChecks, [check], 'scm'),
        provenanceLinks: [
          ...existingProvenance.filter((link) => link.id !== 'scm-run'),
          {
            kind: 'audit-record',
            id: 'scm-run',
            label: `scm ${inspect.head}`,
            url: null,
            acceptanceCriterionIds: [],
          },
        ],
        designRevision: revision,
      });
    },

    push(input) {
      tools.assertAllowed(TOOL_GIT_PUSH, input.role, input.role === 'scm' ? 'scm.push' : 'implement');
      const item = deps.board.getWorkItem(input.workItemId as WorkItemId);
      if (item === undefined) {
        throw new ScmError('NOT_FOUND', `work item not found: ${input.workItemId}`);
      }
      assertAuthority(deps.authority, {
        role: input.role,
        action: 'branch_push',
        projectId: item.projectId,
        actor: input.actor,
        workItemId: item.id,
        workItemType: item.type,
        ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
      });
      const inspect = inspectGit(runner, input.workspaceRoot);
      const pushed = runner(['push'], input.workspaceRoot);
      if (pushed.status !== 0) {
        throw new ScmError('GIT', gitFailure(pushed.stderr, 'git push failed'));
      }
      tools.recordCall({
        toolId: TOOL_GIT_PUSH,
        role: input.role,
        taskType: 'scm.push',
        affectsDelivery: true,
        result: 'ran',
        detail: inspect.head,
      });
      const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
      return deps.board.updateDeliveryEvidenceSummary(item.id, {
        codeLinks: [
          ...(existing?.codeLinks ?? []),
          {
            kind: 'branch',
            id: `git-push:${inspect.head}`,
            label: `pushed ${inspect.branch}`,
            url: null,
            acceptanceCriterionIds: [],
          },
        ],
      });
    },

    openPullRequest(input) {
      tools.assertAllowed(TOOL_PULL_REQUEST, input.role, input.role === 'scm' ? 'scm.pull-request' : 'implement');
      const item = deps.board.getWorkItem(input.workItemId as WorkItemId);
      if (item === undefined) {
        throw new ScmError('NOT_FOUND', `work item not found: ${input.workItemId}`);
      }
      assertAuthority(deps.authority, {
        role: input.role,
        action: 'pull_request',
        projectId: item.projectId,
        actor: input.actor,
        workItemId: item.id,
        workItemType: item.type,
        ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
      });
      tools.recordCall({
        toolId: TOOL_PULL_REQUEST,
        role: input.role,
        taskType: 'scm.pull-request',
        affectsDelivery: true,
        result: 'ran',
        detail: input.title ?? item.title,
      });
      const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
      return deps.board.updateDeliveryEvidenceSummary(item.id, {
        pullRequests: [
          ...(existing?.pullRequests ?? []),
          {
            kind: 'pull-request',
            id: `pr-intent:${item.id}`,
            label: input.title ?? `PR for ${item.title}`,
            url: null,
            acceptanceCriterionIds: [],
          },
        ],
      });
    },

    registerRepository(input) {
      if (input.name.trim() === '') throw new ScmError('VALIDATION', 'repository name is required');
      const provider = parseProvider(input.provider);
      const owner = optionalMeta(input.owner);
      const repoName = optionalMeta(input.repo);
      const remoteUrl = optionalMeta(input.remoteUrl);
      const apiBaseUrl = optionalMeta(input.apiBaseUrl);
      if (isHostedScmProvider(provider) && (owner === null || repoName === null || remoteUrl === null)) {
        throw new ScmError('VALIDATION', `hosted ${provider} repository requires owner, repo, and remoteUrl`);
      }
      const repo: ProjectRepository = {
        id: randomUUID(),
        projectId: input.projectId,
        name: input.name,
        workspaceRoot: input.workspaceRoot,
        defaultBranch: input.defaultBranch ?? 'main',
        provider,
        owner,
        repo: repoName,
        remoteUrl,
        apiBaseUrl,
      };
      snapshot = { ...snapshot, repositories: [...snapshot.repositories, repo] };
      persist();
      return repo;
    },

    listRepositories(projectId) {
      return snapshot.repositories.filter((item) => item.projectId === projectId);
    },

    createBranch(input) {
      const role = input.role ?? 'generator';
      tools.assertAllowed(TOOL_GIT_BRANCH, role, role === 'scm' ? 'scm.branch' : 'implement');
      const item = requireWorkItem(deps.board, input.workItemId);
      const repo = requireRepo(item.projectId, input.workspaceRoot);
      const parent = input.parentBranchId !== undefined ? requireBranch(input.parentBranchId) : undefined;
      const name = formatTemplate(config.branchNameTemplate, {
        workItemId: item.id,
        kind: input.purpose ?? 'work-item',
      });
      if (config.protectedBranches.includes(name)) {
        throw new ScmError('VALIDATION', `branch ${name} is protected`);
      }
      if (snapshot.branches.some((branch) => branch.repositoryId === repo.id && branch.name === name)) {
        throw new ScmError('VALIDATION', `branch ${name} already exists`);
      }
      const base = parent?.name ?? repo.defaultBranch;
      const created = runner(['checkout', '-b', name, base], repo.workspaceRoot);
      if (created.status !== 0) {
        throw new ScmError('GIT', gitFailure(created.stderr, 'git checkout -b failed'));
      }
      tools.recordCall({
        toolId: TOOL_GIT_BRANCH,
        role,
        taskType: 'scm.branch',
        affectsDelivery: true,
        result: 'ran',
        detail: name,
      });
      const branch: ManagedBranch = {
        id: randomUUID(),
        repositoryId: repo.id,
        projectId: item.projectId,
        name,
        baseBranch: base,
        targetBranch: repo.defaultBranch,
        purpose: input.purpose ?? 'work-item',
        workItemIds: [item.id],
        milestoneId: item.milestoneId,
        owner: input.actor,
        creator: input.actor,
        status: 'active',
        protection: 'none',
        parentBranchId: parent?.id ?? null,
        lastSync: null,
      };
      snapshot = { ...snapshot, branches: [...snapshot.branches, branch] };
      persist();
      return branch;
    },

    listBranches(filter) {
      return snapshot.branches.filter((branch) => {
        if (filter.projectId !== undefined && branch.projectId !== filter.projectId) return false;
        if (filter.workItemId !== undefined && !branch.workItemIds.includes(filter.workItemId)) return false;
        return true;
      });
    },

    syncBranch(branchId, workspaceRoot) {
      return refreshBranch(branchId, workspaceRoot, false);
    },

    rebaseCheck(branchId, workspaceRoot) {
      return refreshBranch(branchId, workspaceRoot, true);
    },

    createChangeset(input) {
      const item = requireWorkItem(deps.board, input.workItemId);
      const branch = requireBranch(input.branchId);
      if (!branch.workItemIds.includes(item.id)) {
        throw new ScmError('VALIDATION', `branch ${branch.id} is not linked to work item ${item.id}`);
      }
      const repo = requireRepoById(branch.repositoryId);
      const patch = input.patch ?? runner(['diff', 'HEAD'], repo.workspaceRoot).stdout;
      const files = input.files ?? parseChangedFiles(patch);
      const changeset: Changeset = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId: item.id,
        repositoryId: repo.id,
        branchId: branch.id,
        patch,
        files,
        author: input.actor,
        actor: input.actor,
        message: '',
        commitSha: null,
        status: 'draft',
        createdAt: Date.now(),
      };
      snapshot = { ...snapshot, changesets: [...snapshot.changesets, changeset] };
      persist();
      return changeset;
    },

    listChangesets(workItemId) {
      return snapshot.changesets.filter((item) => item.workItemId === workItemId);
    },

    commitChangeset(input) {
      const role = input.role ?? 'generator';
      tools.assertAllowed(TOOL_GIT_COMMIT, role, role === 'scm' ? 'scm.commit' : 'implement');
      const changeset = snapshot.changesets.find((item) => item.id === input.changesetId);
      if (changeset === undefined) throw new ScmError('NOT_FOUND', `changeset not found: ${input.changesetId}`);
      const item = requireWorkItem(deps.board, changeset.workItemId);
      const repo = requireRepoById(changeset.repositoryId);
      const message = formatTemplate(config.commitMessageTemplate, {
        workItemId: item.id,
        title: item.title,
      });
      const added = runner(['add', '-A'], repo.workspaceRoot);
      if (added.status !== 0) throw new ScmError('GIT', gitFailure(added.stderr, 'git add failed'));
      const committed = runner(['commit', '-m', message], repo.workspaceRoot);
      if (committed.status !== 0) throw new ScmError('GIT', gitFailure(committed.stderr, 'git commit failed'));
      const sha = runGit(runner, ['rev-parse', 'HEAD'], repo.workspaceRoot);
      tools.recordCall({
        toolId: TOOL_GIT_COMMIT,
        role,
        taskType: 'scm.commit',
        affectsDelivery: true,
        result: 'ran',
        detail: sha,
      });
      const next: Changeset = { ...changeset, status: 'committed', message, commitSha: sha, actor: input.actor };
      snapshot = {
        ...snapshot,
        changesets: snapshot.changesets.map((item) => item.id === next.id ? next : item),
      };
      persist();
      const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
      deps.board.updateDeliveryEvidenceSummary(item.id, {
        codeLinks: [
          ...(existing?.codeLinks ?? []),
          {
            kind: 'commit',
            id: `commit:${sha}`,
            label: message,
            url: null,
            acceptanceCriterionIds: [],
          },
          ...next.files.map((file) => ({
            kind: 'changed-file' as const,
            id: `file:${next.id}:${file}`,
            label: file,
            url: null,
            acceptanceCriterionIds: [],
          })),
          {
            kind: 'diff',
            id: `diff:${next.id}`,
            label: 'changeset diff',
            url: null,
            acceptanceCriterionIds: [],
          },
        ],
      });
      return next;
    },

    pushBranch(input) {
      const branch = requireBranch(input.branchId);
      const workItemId = branch.workItemIds[0];
      if (workItemId === undefined) throw new ScmError('VALIDATION', `branch ${branch.id} has no linked WorkItem`);
      const repo = requireRepoById(branch.repositoryId);
      if (isHostedScmProvider(repo.provider)) {
        const item = requireWorkItem(deps.board, workItemId);
        tools.assertAllowed(TOOL_GIT_PUSH, input.role, input.role === 'scm' ? 'scm.push' : 'implement');
        assertAuthority(deps.authority, {
          role: input.role,
          action: 'branch_push',
          projectId: item.projectId,
          actor: input.actor,
          workItemId: item.id,
          workItemType: item.type,
          ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
        });
        const token = resolveHostedToken(repo.provider, input.token, env);
        const sha = resolvePushSha(runner, repo, branch.id, snapshot.changesets);
        hostedPush({
          transport: hosted,
          repository: repo,
          branch: branch.name,
          sha,
          token,
        });
        tools.recordCall({
          toolId: TOOL_GIT_PUSH,
          role: input.role,
          taskType: 'scm.push',
          affectsDelivery: true,
          result: 'ran',
          detail: `${repo.provider}:${branch.name}@${sha}`,
        });
        const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
        deps.board.updateDeliveryEvidenceSummary(item.id, {
          codeLinks: [
            ...(existing?.codeLinks ?? []),
            {
              kind: 'branch',
              id: `hosted-push:${sha}`,
              label: `pushed ${branch.name} to ${repo.provider}`,
              url: repo.remoteUrl,
              acceptanceCriterionIds: [],
            },
          ],
        });
        return refreshBranch(branch.id, repo.workspaceRoot, false);
      }
      service.push({
        workItemId,
        workspaceRoot: repo.workspaceRoot,
        role: input.role,
        actor: input.actor,
        ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
      });
      return refreshBranch(branch.id, repo.workspaceRoot, false);
    },

    openBranchPullRequest(input) {
      const branch = requireBranch(input.branchId);
      const workItemId = branch.workItemIds[0];
      if (workItemId === undefined) throw new ScmError('VALIDATION', `branch ${branch.id} has no linked WorkItem`);
      const item = requireWorkItem(deps.board, workItemId);
      const repo = requireRepoById(branch.repositoryId);
      tools.assertAllowed(TOOL_PULL_REQUEST, input.role, input.role === 'scm' ? 'scm.pull-request' : 'implement');
      assertAuthority(deps.authority, {
        role: input.role,
        action: 'pull_request',
        projectId: item.projectId,
        actor: input.actor,
        workItemId: item.id,
        workItemType: item.type,
        ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
      });
      const title = input.title ?? `PR for ${item.title}`;
      let url: string | null = null;
      let providerPullRequestId: string | null = null;
      if (isHostedScmProvider(repo.provider)) {
        const token = resolveHostedToken(repo.provider, input.token, env);
        const opened = hostedOpenPullRequest({
          transport: hosted,
          repository: repo,
          title,
          head: branch.name,
          base: branch.targetBranch,
          token,
        });
        url = opened.url;
        providerPullRequestId = opened.id;
      }
      tools.recordCall({
        toolId: TOOL_PULL_REQUEST,
        role: input.role,
        taskType: 'scm.pull-request',
        affectsDelivery: true,
        result: 'ran',
        detail: url ?? title,
      });
      const record: PullRequestRecord = {
        id: randomUUID(),
        projectId: item.projectId,
        repositoryId: branch.repositoryId,
        branchId: branch.id,
        workItemId,
        title,
        base: branch.targetBranch,
        head: branch.name,
        status: 'open',
        mergeSha: null,
        actor: input.actor,
        url,
        providerPullRequestId,
      };
      snapshot = { ...snapshot, pullRequests: [...snapshot.pullRequests, record] };
      persist();
      const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
      deps.board.updateDeliveryEvidenceSummary(item.id, {
        pullRequests: [
          ...(existing?.pullRequests ?? []),
          {
            kind: 'pull-request',
            id: record.id,
            label: title,
            url,
            acceptanceCriterionIds: [],
          },
        ],
      });
      return record;
    },

    mergePullRequest(input) {
      const pullRequest = snapshot.pullRequests.find((item) => item.id === input.pullRequestId);
      if (pullRequest === undefined) {
        throw new ScmError('NOT_FOUND', `pull request not found: ${input.pullRequestId}`);
      }
      tools.assertAllowed(TOOL_MERGE, input.role, input.role === 'scm' ? 'scm.merge' : 'implement');
      const item = requireWorkItem(deps.board, pullRequest.workItemId);
      const repo = requireRepoById(pullRequest.repositoryId);
      assertAuthority(deps.authority, {
        role: input.role,
        action: 'merge',
        projectId: item.projectId,
        actor: input.actor,
        workItemId: item.id,
        workItemType: item.type,
        ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
      });
      let mergeSha = `merge:${pullRequest.id}`;
      if (isHostedScmProvider(repo.provider)) {
        if (pullRequest.providerPullRequestId === null) {
          throw new ScmError('HOSTED', `hosted pull request ${pullRequest.id} is missing providerPullRequestId`);
        }
        const token = resolveHostedToken(repo.provider, input.token, env);
        mergeSha = hostedMerge({
          transport: hosted,
          repository: repo,
          providerPullRequestId: pullRequest.providerPullRequestId,
          token,
        }).sha;
      }
      const next: PullRequestRecord = { ...pullRequest, status: 'merged', mergeSha };
      snapshot = {
        ...snapshot,
        pullRequests: snapshot.pullRequests.map((row) => row.id === next.id ? next : row),
        branches: snapshot.branches.map((branch) =>
          branch.id === pullRequest.branchId ? { ...branch, status: 'merged' } : branch,
        ),
      };
      persist();
      tools.recordCall({
        toolId: TOOL_MERGE,
        role: input.role,
        taskType: 'scm.merge',
        affectsDelivery: true,
        result: 'ran',
        detail: next.url ?? next.id,
      });
      const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
      deps.board.updateDeliveryEvidenceSummary(item.id, {
        pullRequests: [
          ...(existing?.pullRequests ?? []).filter((link) => link.id !== next.id),
          {
            kind: 'pull-request',
            id: next.id,
            label: `merged ${next.title}`,
            url: next.url,
            acceptanceCriterionIds: [],
          },
        ],
      });
      return next;
    },

    codeView(workItemId) {
      const item = requireWorkItem(deps.board, workItemId);
      const branches = snapshot.branches.filter((branch) => branch.workItemIds.includes(item.id));
      const changesets = snapshot.changesets.filter((row) => row.workItemId === item.id);
      const pullRequests = snapshot.pullRequests.filter((row) => row.workItemId === item.id);
      const repos = snapshot.repositories.filter((repo) =>
        branches.some((branch) => branch.repositoryId === repo.id) || repo.projectId === item.projectId,
      );
      return {
        repositories: repos,
        branches,
        changesets,
        pullRequests,
        commits: changesets
          .filter((row) => row.commitSha !== null)
          .map((row) => ({ id: row.id, label: row.message, sha: row.commitSha ?? '' })),
        diffs: changesets.map((row) => ({ id: row.id, patch: row.patch })),
        changedFiles: [...new Set(changesets.flatMap((row) => row.files))],
        unlinked: branches.length === 0,
      };
    },

    unlinkedCode(projectId) {
      return snapshot.branches.filter((branch) =>
        branch.projectId === projectId && branch.workItemIds.length === 0,
      );
    },

    importUnlinkedBranch(input) {
      const repo = requireRepoById(input.repositoryId);
      if (snapshot.branches.some((branch) => branch.repositoryId === repo.id && branch.name === input.name)) {
        throw new ScmError('VALIDATION', `branch ${input.name} already exists`);
      }
      const branch: ManagedBranch = {
        id: randomUUID(),
        repositoryId: repo.id,
        projectId: repo.projectId,
        name: input.name,
        baseBranch: repo.defaultBranch,
        targetBranch: repo.defaultBranch,
        purpose: 'experiment',
        workItemIds: [],
        milestoneId: null,
        owner: input.actor,
        creator: input.actor,
        status: 'active',
        protection: config.protectedBranches.includes(input.name) ? 'protected' : 'none',
        parentBranchId: null,
        lastSync: {
          at: Date.now(),
          unpushed: false,
          diverged: false,
          conflict: false,
          unlinked: true,
          ahead: 0,
          behind: 0,
          detail: 'imported without WorkItem',
        },
      };
      snapshot = { ...snapshot, branches: [...snapshot.branches, branch] };
      persist();
      return branch;
    },
  };
  return service;

  function persist(): void {
    if (deps.workspaceRoot === undefined) return;
    saveScmSnapshot(deps.workspaceRoot, snapshot);
  }

  function requireRepo(projectId: string, workspaceRoot?: string): ProjectRepository {
    const found = snapshot.repositories.find((repo) =>
      repo.projectId === projectId && (workspaceRoot === undefined || repo.workspaceRoot === workspaceRoot),
    );
    if (found === undefined) throw new ScmError('NOT_FOUND', `repository not registered for project ${projectId}`);
    return found;
  }

  function requireRepoById(repositoryId: string): ProjectRepository {
    const found = snapshot.repositories.find((repo) => repo.id === repositoryId);
    if (found === undefined) throw new ScmError('NOT_FOUND', `repository not found: ${repositoryId}`);
    return found;
  }

  function requireBranch(branchId: string): ManagedBranch {
    const found = snapshot.branches.find((branch) => branch.id === branchId);
    if (found === undefined) throw new ScmError('NOT_FOUND', `branch not found: ${branchId}`);
    return found;
  }

  function refreshBranch(branchId: string, workspaceRoot: string | undefined, checkConflict: boolean): ManagedBranch {
    const branch = requireBranch(branchId);
    const repo = requireRepoById(branch.repositoryId);
    const root = workspaceRoot ?? repo.workspaceRoot;
    const counts = runner(['rev-list', '--left-right', '--count', `${branch.baseBranch}...${branch.name}`], root);
    const [behindText, aheadText] = (counts.stdout.trim() || '0\t0').split(/\s+/);
    const behind = Number(behindText ?? '0');
    const ahead = Number(aheadText ?? '0');
    let conflict = false;
    if (checkConflict) {
      const merge = runner(['merge-tree', branch.baseBranch, branch.name], root);
      conflict = merge.status !== 0 || merge.stdout.includes('CONFLICT');
    }
    const unlinked = branch.workItemIds.length === 0;
    const lastSync = {
      at: Date.now(),
      unpushed: ahead > 0,
      diverged: ahead > 0 && behind > 0,
      conflict,
      unlinked,
      ahead,
      behind,
      detail: counts.stdout.trim(),
    };
    const status = conflict || lastSync.diverged ? 'stale' : branch.status;
    const next: ManagedBranch = { ...branch, lastSync, status };
    snapshot = {
      ...snapshot,
      branches: snapshot.branches.map((item) => item.id === branch.id ? next : item),
    };
    persist();
    return next;
  }
}

function requireWorkItem(board: BoardService, workItemId: string) {
  const item = board.getWorkItem(workItemId as WorkItemId);
  if (item === undefined) throw new ScmError('NOT_FOUND', `work item not found: ${workItemId}`);
  return item;
}

function parseProvider(value: string | undefined): ProjectRepository['provider'] {
  const provider = value?.trim() ?? 'local-git';
  if (!isScmProvider(provider)) {
    throw new ScmError('VALIDATION', `unknown scm provider: ${provider}`);
  }
  return provider;
}

function optionalMeta(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : null;
}

function resolvePushSha(
  runner: GitCommandRunner,
  repo: ProjectRepository,
  branchId: string,
  changesets: readonly Changeset[],
): string {
  try {
    return inspectGit(runner, repo.workspaceRoot).head;
  } catch (error) {
    if (!(error instanceof ScmError) || error.code !== 'GIT') throw error;
    // Hosted push can still use the last committed changeset when local inspect fails.
    const committed = [...changesets].reverse().find((row) =>
      row.branchId === branchId && row.commitSha !== null,
    );
    if (committed?.commitSha !== null && committed?.commitSha !== undefined) return committed.commitSha;
    throw new ScmError('HOSTED', 'hosted push requires a local HEAD or committed changeset sha');
  }
}

function formatTemplate(template: string, values: { readonly workItemId: string; readonly title?: string; readonly kind?: string }): string {
  return template
    .replaceAll('{workItemId}', values.workItemId)
    .replaceAll('{title}', values.title ?? '')
    .replaceAll('{kind}', values.kind ?? 'work-item');
}

function parseChangedFiles(patch: string): readonly string[] {
  const files = [...patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map((match) => match[2] ?? match[1] ?? '');
  return files.filter((file) => file !== '');
}

function assertAuthority(
  authority: AuthorityService | undefined,
  input: Parameters<AuthorityService['assert']>[0],
): void {
  if (authority === undefined) {
    throw new ScmError('AUTHORITY', 'authority is required for branch push and pull requests');
  }
  try {
    authority.assert(input);
  } catch (error) {
    if (error instanceof AuthorityError) {
      throw new ScmError('AUTHORITY', error.message);
    }
    throw error;
  }
}

function inspectGit(runner: GitCommandRunner, workspaceRoot: string): LocalGitInspect {
  const branch = runGit(runner, ['rev-parse', '--abbrev-ref', 'HEAD'], workspaceRoot);
  const head = runGit(runner, ['rev-parse', 'HEAD'], workspaceRoot);
  const status = runner(['status', '--porcelain'], workspaceRoot);
  if (status.status !== 0) {
    throw new ScmError('GIT', gitFailure(status.stderr, 'git status failed'));
  }
  const remotesResult = runner(['remote', '-v'], workspaceRoot);
  const remotes = remotesResult.status === 0
    ? uniqueRemotes(remotesResult.stdout)
    : [];
  return {
    workspaceRoot,
    branch,
    head,
    dirty: status.stdout.trim() !== '',
    remotes,
  };
}

function runGit(runner: GitCommandRunner, args: readonly string[], cwd: string): string {
  const result = runner(args, cwd);
  if (result.status !== 0) {
    throw new ScmError('GIT', gitFailure(result.stderr, `git ${args.join(' ')} failed`));
  }
  const value = result.stdout.trim();
  if (value === '') {
    throw new ScmError('GIT', `git ${args.join(' ')} returned empty output`);
  }
  return value;
}

function uniqueRemotes(stdout: string): readonly string[] {
  const names = stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((name): name is string => name !== undefined && name !== '');
  return [...new Set(names)];
}

function gitFailure(stderr: string, fallback: string): string {
  const line = stderr.trim().split('\n').filter(Boolean).at(-1);
  return line ?? fallback;
}

function defaultGitRunner(args: readonly string[], cwd: string) {
  const result = spawnSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  };
}

export { ScmError };
