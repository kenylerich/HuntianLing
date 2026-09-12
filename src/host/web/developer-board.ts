/**
 * Developer-shell projections for Collect, Design, and Progress.
 */

import { isStaleDeliveryEvidence } from '../board/executed-evidence.js';
import type { BoardService } from '../board/plugin.js';
import type { ProjectId, WorkItem } from '../board/types.js';
import type { AuthorityService } from '../authority/service.js';
import type { CollabService } from '../collab/service.js';
import type { WorkflowService } from '../workflow/service.js';
import type { DispatchService } from '../dispatch/service.js';
import type { ResourceLease } from '../dispatch/types.js';
import type { DeliveryService } from '../delivery/service.js';
import type { ScmService } from '../scm/service.js';
import type { AgentRuntime } from '../agents/runtime.js';
import { createCustomerBoard } from './customer-board.js';
import { customerProgressForWorkItem } from './customer-progress.js';

export const DEVELOPER_JOBS = ['collect', 'design', 'progress', 'channel', 'environment'] as const;
export type DeveloperJob = (typeof DEVELOPER_JOBS)[number];

export function createDeveloperBoard(
  board: BoardService,
  projectId: ProjectId,
  delivery?: DeliveryService,
  authority?: AuthorityService,
  scm?: ScmService,
  collab?: CollabService,
  workflow?: WorkflowService,
  dispatch?: DispatchService,
  agents?: AgentRuntime,
) {
  const collect = createCustomerBoard(board, projectId);
  const items = board.listWorkItems({ projectId }).filter((item) => item.type !== 'task');
  const evidence = new Map(
    board.listDeliveryEvidenceSummaries({ projectId }).map((summary) => [summary.workItemId, summary]),
  );
  const runs = delivery?.listForProject(projectId) ?? [];
  return {
    project: collect.project,
    jobs: DEVELOPER_JOBS,
    teamMembers: board.listTeamMembers({ projectId }),
    authority: {
      roles: authority?.policies() ?? [],
    },
    collect: {
      sessions: collect.sessions,
      requirements: collect.requirements,
    },
    design: {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        analysis: item.analysis,
        design: item.design,
        acceptance: item.acceptance,
        openQuestions: item.body,
      })),
    },
    progress: {
      items: items.map((item) => {
        const summary = evidence.get(item.id);
        const evaluatorChecks = summary?.checks.filter((check) => check.producer === 'evaluator') ?? [];
        return {
          id: item.id,
          title: item.title,
          status: item.status,
          progress: customerProgressForWorkItem(item.status, summary, item),
          blockedByIds: item.blockedByIds,
          stale: summary !== undefined && isStaleDeliveryEvidence(summary, item),
          agentFeedback: (dispatch?.listFeedback(item.id) ?? []).map((row) => ({
            id: row.id,
            agentId: row.agentId,
            title: row.summary,
            status: row.status,
            summary: row.summary,
            openQuestions: row.openQuestions,
            decisions: row.decisions,
            blockers: row.blockers,
            missingEvidence: row.missingEvidence,
            nextActions: row.nextActions,
            skillVersions: row.skillVersions,
            runId: row.runId,
          })),
          evaluatorChecks,
          codeLinks: summary?.codeLinks ?? [],
          ciRuns: summary?.ciRuns ?? [],
          evidenceLinks: summary?.evidenceLinks ?? [],
          checks: summary?.checks ?? [],
          deliveryRun: runs.filter((run) => run.workItemId === item.id).at(-1) ?? null,
          codeView: mergeCodeViewLeases(
            scm?.codeView(item.id) ?? null,
            dispatch?.listLeases(projectId).filter((lease) => lease.workItemId === item.id) ?? [],
          ),
          collaborationTasks: collab?.listOpenTasks(projectId, item.id) ?? [],
          unresolvedQuestions: collab?.listUnresolvedQuestions(projectId, item.id) ?? [],
          channelDecisions: collab?.listDecisions(projectId, item.id) ?? [],
          workflowRun: workflow?.listRuns(projectId).find((run) => run.workItemId === item.id) ?? null,
          leases: dispatch?.listLeases(projectId).filter((lease) => lease.workItemId === item.id) ?? [],
          taskContext: inspectProgressTask(agents, item.id),
          reviewerIds: item.reviewerIds,
          approverIds: item.approverIds,
          watcherIds: item.watcherIds,
        };
      }),
    },
  };
}

function mergeCodeViewLeases(
  view: ReturnType<ScmService['codeView']> | null,
  leases: readonly ResourceLease[],
) {
  if (view === null && leases.length === 0) return null;
  return {
    repositories: view?.repositories ?? [],
    branches: view?.branches ?? [],
    changesets: view?.changesets ?? [],
    pullRequests: view?.pullRequests ?? [],
    commits: view?.commits ?? [],
    diffs: view?.diffs ?? [],
    changedFiles: view?.changedFiles ?? [],
    unlinked: view?.unlinked ?? false,
    leases,
  };
}

function inspectProgressTask(agents: AgentRuntime | undefined, workItemId: WorkItem['id']) {
  if (agents === undefined) return null;
  try {
    return agents.inspectTask({ workItemId, agentId: 'evaluator' });
  } catch {
    // Agent inspect is optional on progress; a missing binding must not hide the board.
    return null;
  }
}

export function isDeveloperJob(value: string): value is DeveloperJob {
  return (DEVELOPER_JOBS as readonly string[]).includes(value);
}

export type { WorkItem };
