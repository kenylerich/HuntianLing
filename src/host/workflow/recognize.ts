/**
 * Build a workflow/delivery state snapshot and decide the next safe action.
 */

import { randomUUID } from 'node:crypto';

import type { BoardService } from '../board/plugin.js';
import { workItemDesignRevision, hasExecutedDeliveryEvidence } from '../board/executed-evidence.js';
import type { CollabService } from '../collab/service.js';
import type { DispatchService } from '../dispatch/service.js';
import type { ScmService } from '../scm/service.js';
import type { SkillService } from '../skills/service.js';
import { createToolRegistry, type ToolRegistry } from '../tools/registry.js';
import type {
  StepStateRecognition,
  WorkflowPlanStep,
  WorkflowRun,
  WorkflowStateSnapshot,
} from './types.js';

export interface RecognizeDeps {
  readonly board: BoardService;
  readonly collab?: CollabService;
  readonly dispatch?: DispatchService;
  readonly scm?: ScmService;
  readonly skills?: SkillService;
  readonly tools?: ToolRegistry;
}

export function buildRunSnapshot(
  deps: RecognizeDeps,
  run: WorkflowRun,
  step: WorkflowPlanStep | null,
  now = Date.now(),
): WorkflowStateSnapshot {
  const item = deps.board.getWorkItem(run.workItemId);
  const evidence = item === undefined ? null : deps.board.getDeliveryEvidenceSummary(item.id);
  const tasks = deps.collab === undefined
    ? []
    : item === undefined
      ? []
      : deps.collab.listOpenTasks(run.projectId, item.id);
  const conversations = deps.collab?.listConversations(run.projectId) ?? [];
  const messages = conversations.flatMap((conversation) => deps.collab?.listMessages(conversation.id) ?? []);
  const pendingApprovals: string[] = [];
  const leases = deps.dispatch?.listLeases(run.projectId).filter((lease) => lease.workItemId === run.workItemId) ?? [];
  const branches = deps.scm?.listBranches({ workItemId: run.workItemId }) ?? [];
  const blockers = item === undefined ? ['work-item-missing'] : [...item.blockedByIds];
  if (item !== undefined && item.status !== 'delivered' && !hasExecutedDeliveryEvidence(evidence, item)) {
    blockers.push('missing-executed-evidence');
  }
  const ciCheck = evidence?.checks.filter((check) => check.producer === 'ci').at(-1);
  const ciStatus = evidence === null
    ? null
    : ciCheck?.status ?? (evidence.ciRuns.length > 0 ? 'recorded' : null);
  return {
    workItemId: run.workItemId,
    workItemStatus: item?.status ?? 'missing',
    designRevision: item === undefined ? '' : workItemDesignRevision(item),
    workflowRunStatus: run.status,
    stepStatus: step?.status ?? null,
    collaborationTaskStatus: tasks[0]?.status ?? null,
    channelMessageCount: messages.length,
    milestoneId: item?.milestoneId ?? null,
    pendingApprovalKinds: pendingApprovals,
    leaseOwners: [...new Set(leases.map((lease) => lease.ownerId))],
    branchOwners: [...new Set(branches.map((branch) => branch.owner).filter((owner) => owner.trim() !== ''))],
    ciStatus,
    evidenceReady: item !== undefined && hasExecutedDeliveryEvidence(evidence, item),
    blockers,
    recognizedAt: now,
  };
}

export function recognizeStepState(
  deps: RecognizeDeps,
  run: WorkflowRun,
  step: WorkflowPlanStep,
  actor: string,
  pendingApprovalKinds: readonly string[] = [],
  previous: StepStateRecognition | null = null,
): StepStateRecognition {
  const snapshot = {
    ...buildRunSnapshot(deps, run, step),
    pendingApprovalKinds,
  };
  const tools = deps.tools ?? createToolRegistry();
  const requiredInputs: string[] = [];
  const missingSkills: string[] = [];
  const unavailableTools: string[] = [];
  const missingApprovals: string[] = [];
  const heldResources: string[] = [];
  const blockedActions: string[] = [];
  const allowedActions: string[] = [];
  let stale = false;
  let incomplete = false;
  let contradictory = false;
  let outsideBoundary = false;
  let nextSafeAction = 'start';
  let reason = 'state is executable';

  if (previous !== null && previous.snapshot.designRevision !== '' && previous.snapshot.designRevision !== snapshot.designRevision) {
    stale = true;
    blockedActions.push('start');
    nextSafeAction = 'revalidate';
    reason = 'state snapshot is stale after a design change';
  }

  const item = deps.board.getWorkItem(run.workItemId);
  if (item === undefined) {
    incomplete = true;
    blockedActions.push('start');
    nextSafeAction = 'ask';
    reason = 'work item is missing from the snapshot';
  }

  for (const skillId of step.requiredSkills) {
    if (deps.skills !== undefined && deps.skills.get(skillId as never) === undefined) {
      missingSkills.push(skillId);
    }
  }
  for (const toolId of step.allowedTools) {
    if (tools.get(toolId as never) === undefined) {
      unavailableTools.push(toolId);
    }
  }
  if (missingSkills.length > 0 || unavailableTools.length > 0) {
    incomplete = true;
    blockedActions.push('start');
    nextSafeAction = 'ask';
    reason = 'required skills or tools are missing';
  }

  if (step.kind === 'approval-required' && step.approvalKind !== null && !pendingApprovalKinds.includes(step.approvalKind)) {
    missingApprovals.push(step.approvalKind);
    blockedActions.push('start');
    nextSafeAction = 'request-approval';
    reason = `missing ${step.approvalKind} approval`;
  }

  const foreignLeases = deps.dispatch?.listLeases(run.projectId).filter(
    (lease) =>
      lease.workItemId === run.workItemId
      && lease.mode === 'exclusive_write'
      && lease.ownerId !== actor
      && lease.ownerId !== step.owner,
  ) ?? [];
  for (const lease of foreignLeases) {
    heldResources.push(`${lease.resourceType}:${lease.resourceId}`);
  }
  if (foreignLeases.length > 0) {
    contradictory = true;
    blockedActions.push('start');
    nextSafeAction = 'wait';
    reason = `exclusive lease is held by ${foreignLeases[0]?.ownerId ?? 'another owner'}`;
  }

  const foreignBranches = deps.scm?.listBranches({ workItemId: run.workItemId }).filter((branch) => {
    const owner = branch.owner.trim();
    return owner !== '' && owner !== actor && owner !== step.owner && owner !== (item?.assignee ?? '');
  }) ?? [];
  if (foreignBranches.length > 0) {
    contradictory = true;
    blockedActions.push('start');
    nextSafeAction = 'wait';
    reason = `branch ${foreignBranches[0]?.name ?? ''} is owned by ${foreignBranches[0]?.owner ?? 'another member'}`;
  }

  const agentRoles = new Set(['planner', 'generator', 'evaluator']);
  if (agentRoles.has(actor) && step.role !== '' && step.role !== actor) {
    outsideBoundary = true;
    blockedActions.push('start');
    nextSafeAction = 'ask';
    reason = `step role ${step.role} is outside the ${actor} capability boundary`;
  }

  if (step.role === 'evaluator' && !snapshot.evidenceReady && snapshot.blockers.includes('missing-executed-evidence')) {
    requiredInputs.push('executed-evidence');
  }

  const allowed = blockedActions.length === 0 && !stale && !incomplete && !contradictory && !outsideBoundary;
  if (allowed) {
    allowedActions.push('start');
    if (missingApprovals.length === 0) allowedActions.push('complete');
  }

  return {
    id: randomUUID(),
    runId: run.id,
    stepId: step.id,
    actor,
    snapshot,
    allowed,
    allowedActions,
    blockedActions,
    requiredInputs,
    missingApprovals,
    missingSkills,
    unavailableTools,
    heldResources,
    nextSafeAction: allowed ? 'start' : nextSafeAction,
    stale,
    incomplete,
    contradictory,
    outsideBoundary,
    reason: allowed ? 'state is executable' : reason,
    createdAt: snapshot.recognizedAt,
  };
}
