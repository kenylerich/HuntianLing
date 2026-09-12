/**
 * Policy dispatch, resource leases, and Agent feedback on WorkItems.
 */

import { randomUUID } from 'node:crypto';

import type { AgentRun } from '../agents/types.js';
import type { AuthorityService } from '../authority/service.js';
import type { BoardService } from '../board/plugin.js';
import type { ProjectId, TeamMember, TeamMemberId, WorkItem, WorkItemId } from '../board/types.js';
import type { CollabService } from '../collab/service.js';
import type { ScmService } from '../scm/service.js';
import { loadDispatchSnapshot, saveDispatchSnapshot } from './store.js';
import {
  DispatchError,
  LEASE_MODES,
  LEASE_RESOURCE_TYPES,
  type AgentFeedback,
  type DispatchRecommendation,
  type LeaseMode,
  type LeaseResourceType,
  type ResourceConflict,
  type ResourceLease,
  type ResolvedDispatchConfig,
} from './types.js';

export interface DispatchService {
  recommend(projectId: ProjectId, workItemId: WorkItemId): DispatchRecommendation;
  run(projectId: ProjectId, actor: string): readonly WorkItem[];
  claim(workItemId: WorkItemId, memberId: TeamMemberId, actor: string): WorkItem;
  transfer(workItemId: WorkItemId, memberId: TeamMemberId, actor: string): WorkItem;
  release(workItemId: WorkItemId, actor: string): WorkItem;
  rebalance(projectId: ProjectId, actor: string): readonly WorkItem[];
  acquireLease(input: {
    readonly projectId: ProjectId;
    readonly resourceType: LeaseResourceType;
    readonly resourceId: string;
    readonly mode: LeaseMode;
    readonly ownerId: string;
    readonly reason: string;
    readonly workItemId?: WorkItemId;
    readonly linkedTaskId?: string;
  }): ResourceLease;
  renewLease(leaseId: string, ownerId: string): ResourceLease;
  releaseLease(leaseId: string, ownerId: string): ResourceLease | undefined;
  listLeases(projectId: ProjectId): readonly ResourceLease[];
  listConflicts(projectId: ProjectId): readonly ResourceConflict[];
  captureRun(run: AgentRun): AgentFeedback | undefined;
  listFeedback(workItemId: WorkItemId): readonly AgentFeedback[];
  decideFeedback(
    feedbackId: string,
    input: {
      readonly actor: string;
      readonly decision: 'accept' | 'reject' | 'request-revision';
    },
  ): AgentFeedback;
}

export function createDispatchService(deps: {
  readonly board: BoardService;
  readonly workspaceRoot: string;
  readonly config: ResolvedDispatchConfig;
  readonly collab?: CollabService;
  readonly scm?: ScmService;
  readonly authority?: AuthorityService;
}): DispatchService {
  const loaded = loadDispatchSnapshot(deps.workspaceRoot);
  let leases: ResourceLease[] = [...loaded.leases];
  let feedback: AgentFeedback[] = [...loaded.feedback];

  const service: DispatchService = {
    recommend(projectId, workItemId) {
      const item = requireWorkItem(workItemId);
      if (item.projectId !== projectId) throw new DispatchError('VALIDATION', 'work item is not in this project');
      return recommendItem(item);
    },
    run(projectId, actor) {
      deps.board.listProjects().find((project) => project.id === projectId)
        ?? fail(`project not found: ${projectId}`);
      const assigned: WorkItem[] = [];
      const queue = deps.board.getStoryPriorityQueue(projectId).items
        .map((row) => deps.board.getWorkItem(row.workItemId))
        .filter((item): item is WorkItem => item !== undefined)
        .filter((item) => item.assignee.trim() === '' && isOpen(item) && item.status === 'ready');
      for (const item of queue) {
        const recommendation = recommendItem(item);
        const winner = recommendation.candidates[0];
        if (winner === undefined) continue;
        assigned.push(assignExclusive(item, winner.memberId, actor, 'dispatch.run'));
      }
      persist();
      return assigned;
    },
    claim(workItemId, memberId, actor) {
      const item = requireWorkItem(workItemId);
      const assigned = assignExclusive(item, memberId, actor, 'dispatch.claim');
      persist();
      return assigned;
    },
    transfer(workItemId, memberId, actor) {
      const item = requireWorkItem(workItemId);
      const from = item.assignee.trim();
      if (from === '') throw new DispatchError('VALIDATION', `work item ${item.id} has no assignee to transfer`);
      if (from === memberId) throw new DispatchError('VALIDATION', 'transfer requires a different member');
      expireLeases();
      for (const lease of activeLeases().filter((row) => row.workItemId === item.id && row.mode === 'exclusive_write')) {
        dropLease(lease.id);
      }
      let assigned: WorkItem;
      try {
        assigned = deps.board.assignWorkItem(item.id, {
          memberId,
          actorId: actor,
          auditAction: 'work_item.transferred',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'transfer failed';
        throw new DispatchError(message.includes('WIP') ? 'WIP' : 'VALIDATION', message);
      }
      const now = Date.now();
      leases = [
        ...leases,
        {
          id: randomUUID(),
          projectId: item.projectId,
          resourceType: 'work_item',
          resourceId: item.id,
          mode: 'exclusive_write',
          ownerId: memberId,
          reason: 'dispatch.transfer',
          linkedTaskId: null,
          workItemId: item.id,
          expiresAt: now + deps.config.leaseTtlMs,
          createdAt: now,
        },
      ];
      note(item.projectId, item.id, `${actor} transferred ${item.title} from ${from} to ${memberId}`, actor);
      persist();
      return assigned;
    },
    release(workItemId, actor) {
      const item = requireWorkItem(workItemId);
      expireLeases();
      for (const lease of activeLeases().filter((row) => row.workItemId === item.id && row.ownerId === actor)) {
        dropLease(lease.id);
      }
      const next = deps.board.updateWorkItem(item.id, { assignee: '' });
      audit(item.projectId, actor, 'work_item.released', item.id, item.title, ['assignee']);
      note(item.projectId, item.id, `${actor} released ${item.title}`, actor);
      persist();
      return next;
    },
    rebalance(projectId, actor) {
      const changed: WorkItem[] = [];
      expireLeases();
      for (const item of deps.board.listWorkItems({ projectId })) {
        const blocked = isOpen(item) && item.blockedByIds.length > 0;
        const cancelled = item.status === 'stopped' || item.status === 'rejected';
        if (!blocked && !cancelled) continue;
        const held = activeLeases().filter((row) => row.workItemId === item.id);
        if (item.assignee.trim() === '' && held.length === 0) continue;
        for (const lease of held) {
          dropLease(lease.id);
        }
        if (item.assignee.trim() !== '') {
          changed.push(deps.board.updateWorkItem(item.id, { assignee: '' }));
        }
        audit(projectId, actor, 'work_item.rebalanced', item.id, item.title, ['assignee']);
        note(projectId, item.id, `rebalanced ${item.title}`, actor);
      }
      persist();
      return changed;
    },
    acquireLease(input) {
      expireLeases();
      if (input.ownerId.trim() === '' || input.reason.trim() === '') {
        throw new DispatchError('VALIDATION', 'lease owner and reason are required');
      }
      if (!isLeaseResourceType(input.resourceType)) {
        throw new DispatchError('VALIDATION', `unsupported lease resource type: ${input.resourceType}`);
      }
      if (!isLeaseMode(input.mode)) {
        throw new DispatchError('VALIDATION', `unsupported lease mode: ${input.mode}`);
      }
      const others = activeLeases().filter(
        (item) =>
          item.resourceType === input.resourceType &&
          item.resourceId === input.resourceId &&
          item.ownerId !== input.ownerId,
      );
      if (input.mode === 'exclusive_write' && others.length > 0) {
        throw new DispatchError('CONFLICT', `exclusive lease already held for ${input.resourceType}:${input.resourceId}`);
      }
      if (input.mode === 'shared_read' && others.some((item) => item.mode === 'exclusive_write')) {
        throw new DispatchError('CONFLICT', `exclusive lease blocks shared read of ${input.resourceType}:${input.resourceId}`);
      }
      const now = Date.now();
      const lease: ResourceLease = {
        id: randomUUID(),
        projectId: input.projectId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        mode: input.mode,
        ownerId: input.ownerId,
        reason: input.reason,
        linkedTaskId: input.linkedTaskId ?? null,
        workItemId: input.workItemId ?? null,
        expiresAt: now + deps.config.leaseTtlMs,
        createdAt: now,
      };
      leases = [...leases, lease];
      persist();
      return lease;
    },
    renewLease(leaseId, ownerId) {
      expireLeases();
      const lease = activeLeases().find((item) => item.id === leaseId);
      if (lease === undefined) throw new DispatchError('NOT_FOUND', `lease not found: ${leaseId}`);
      if (lease.ownerId !== ownerId) throw new DispatchError('AUTHORITY', 'only the lease owner can renew');
      const next = { ...lease, expiresAt: Date.now() + deps.config.leaseTtlMs };
      leases = leases.map((item) => (item.id === leaseId ? next : item));
      persist();
      return next;
    },
    releaseLease(leaseId, ownerId) {
      const lease = leases.find((item) => item.id === leaseId);
      if (lease === undefined) return undefined;
      if (lease.ownerId !== ownerId) throw new DispatchError('AUTHORITY', 'only the lease owner can release');
      dropLease(leaseId);
      persist();
      return lease;
    },
    listLeases(projectId) {
      expireLeases();
      persist();
      return activeLeases().filter((item) => item.projectId === projectId);
    },
    listConflicts(projectId) {
      expireLeases();
      const active = activeLeases().filter((item) => item.projectId === projectId);
      const conflicts: ResourceConflict[] = [];
      const seen = new Set<string>();
      for (const lease of active) {
        const key = `${lease.resourceType}:${lease.resourceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const group = active.filter((item) => item.resourceType === lease.resourceType && item.resourceId === lease.resourceId);
        const exclusive = group.filter((item) => item.mode === 'exclusive_write');
        if (exclusive.length > 1) {
          conflicts.push({
            resourceType: lease.resourceType,
            resourceId: lease.resourceId,
            leaseIds: exclusive.map((item) => item.id),
            owners: exclusive.map((item) => item.ownerId),
            mode: 'exclusive',
            message: `multiple exclusive leases on ${key}`,
          });
        }
        if (lease.resourceType === 'file') {
          const overlaps = active.filter(
            (item) =>
              item.resourceType === 'file' &&
              item.id !== lease.id &&
              pathsOverlap(item.resourceId, lease.resourceId) &&
              (item.mode === 'exclusive_write' || lease.mode === 'exclusive_write'),
          );
          if (overlaps.length > 0) {
            conflicts.push({
              resourceType: 'file',
              resourceId: lease.resourceId,
              leaseIds: [lease.id, ...overlaps.map((item) => item.id)],
              owners: [lease.ownerId, ...overlaps.map((item) => item.ownerId)],
              mode: 'overlap',
              message: `file overlap on ${lease.resourceId}`,
            });
          }
        }
        if (lease.resourceType === 'file' && isMigrationPath(lease.resourceId)) {
          const others = active.filter(
            (item) =>
              item.id !== lease.id &&
              item.resourceType === 'file' &&
              isMigrationPath(item.resourceId) &&
              (item.mode === 'exclusive_write' || lease.mode === 'exclusive_write'),
          );
          if (others.length > 0) {
            conflicts.push({
              resourceType: 'file',
              resourceId: lease.resourceId,
              leaseIds: [lease.id, ...others.map((item) => item.id)],
              owners: [lease.ownerId, ...others.map((item) => item.ownerId)],
              mode: 'migration',
              message: `migration conflict on ${lease.resourceId}`,
            });
          }
        }
        if (lease.resourceType === 'branch') {
          const others = active.filter(
            (item) => item.resourceType === 'branch' && item.resourceId === lease.resourceId && item.id !== lease.id && item.mode === 'exclusive_write',
          );
          if (lease.mode === 'exclusive_write' && others.length > 0) {
            conflicts.push({
              resourceType: 'branch',
              resourceId: lease.resourceId,
              leaseIds: [lease.id, ...others.map((item) => item.id)],
              owners: [lease.ownerId, ...others.map((item) => item.ownerId)],
              mode: 'exclusive',
              message: `branch contention on ${lease.resourceId}`,
            });
          }
        }
      }
      return conflicts;
    },
    captureRun(run) {
      if (run.workItemId === null || run.workItemId === '') return undefined;
      const item = deps.board.getWorkItem(run.workItemId as WorkItemId);
      if (item === undefined) return undefined;
      const extracted = extractFeedback(run, item);
      const record: AgentFeedback = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId: item.id,
        runId: run.id,
        agentId: run.agentId,
        skillVersions: run.skillVersions,
        status: 'pending',
        ...extracted,
        createdAt: Date.now(),
        decidedAt: null,
        decidedBy: null,
      };
      feedback = [...feedback, record];
      persist();
      return record;
    },
    listFeedback(workItemId) {
      return feedback.filter((item) => item.workItemId === workItemId);
    },
    decideFeedback(feedbackId, input) {
      const record = feedback.find((item) => item.id === feedbackId);
      if (record === undefined) throw new DispatchError('NOT_FOUND', `feedback not found: ${feedbackId}`);
      if (record.status !== 'pending' && record.status !== 'revision_requested') {
        throw new DispatchError('VALIDATION', `feedback ${feedbackId} is not open`);
      }
      const status =
        input.decision === 'accept' ? 'accepted' : input.decision === 'reject' ? 'rejected' : 'revision_requested';
      if (input.decision === 'accept') {
        const patch: { analysis?: string; design?: string; acceptance?: readonly string[] } = {};
        if (record.proposedAnalysis.trim() !== '') patch.analysis = record.proposedAnalysis;
        if (record.proposedDesign.trim() !== '') patch.design = record.proposedDesign;
        if (record.proposedAcceptance.length > 0) patch.acceptance = record.proposedAcceptance;
        if (Object.keys(patch).length > 0) deps.board.updateWorkItem(record.workItemId, patch);
      }
      const next: AgentFeedback = {
        ...record,
        status,
        decidedAt: Date.now(),
        decidedBy: input.actor,
      };
      feedback = feedback.map((item) => (item.id === feedbackId ? next : item));
      audit(
        record.projectId,
        input.actor,
        input.decision === 'accept' ? 'agent_feedback.accepted' : input.decision === 'reject' ? 'agent_feedback.rejected' : 'agent_feedback.revision_requested',
        record.workItemId,
        record.summary,
        input.decision === 'accept' ? ['analysis', 'design', 'acceptance'] : [],
      );
      persist();
      return next;
    },
  };
  return service;

  function recommendItem(item: WorkItem): DispatchRecommendation {
    expireLeases();
    const members = deps.board.listTeamMembers({ projectId: item.projectId });
    const capacity = deps.board.getTeamCapacity(item.projectId);
    const requiredRole = roleFor(item);
    const requiredSkills = item.type === 'story' || item.type === 'task' ? ['implementation'] : ['analysis'];
    const candidates = [];
    const ineligible = [];
    for (const member of members) {
      const summary = capacity.members.find((row) => row.member.id === member.id);
      const reason = ineligibleReason(item, member, summary?.availableSlots ?? 0, requiredRole);
      if (reason !== undefined) {
        ineligible.push({ memberId: member.id, reason });
        continue;
      }
      const skillHits = member.skillProfile.filter((skill) =>
        requiredSkills.some((needed) => skill.toLowerCase().includes(needed)),
      ).length;
      const ownsBranch = memberOwnsBranch(item, member);
      const pendingApprovals = pendingApprovalsFor(item);
      const isApprover = item.approverIds.includes(member.id);
      const score =
        (summary?.availableSlots ?? 0) * 10 +
        skillHits * 5 +
        (member.roleIds.includes(requiredRole as never) ? 3 : 0) -
        (item.blockedByIds.length > 0 ? 4 : 0) +
        (ownsBranch ? 8 : 0) +
        (isApprover ? 6 : 0) -
        (pendingApprovals > 0 && !isApprover ? 5 : 0);
      candidates.push({
        memberId: member.id,
        displayName: member.displayName,
        score,
        availableSlots: summary?.availableSlots ?? 0,
        reasons: [
          `slots:${String(summary?.availableSlots ?? 0)}`,
          ...(skillHits > 0 ? [`skills:${String(skillHits)}`] : []),
          `role:${requiredRole}`,
          ...(ownsBranch ? ['branch-owner'] : []),
          ...(isApprover ? ['approver'] : []),
          ...(pendingApprovals > 0 && !isApprover ? ['pending-approval'] : []),
        ],
      });
    }
    candidates.sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName));
    return { workItemId: item.id, candidates, ineligible };
  }

  function assignExclusive(item: WorkItem, memberId: TeamMemberId, actor: string, reason: string): WorkItem {
    expireLeases();
    const holders = exclusiveHolders('work_item', item.id).filter((lease) => lease.ownerId !== memberId);
    if (holders.length > 0) {
      throw new DispatchError('CONFLICT', `exclusive lease already held on work item ${item.id}`);
    }
    let assigned: WorkItem;
    try {
      assigned = deps.board.assignWorkItem(item.id, { memberId, actorId: actor });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'assignment failed';
      throw new DispatchError(message.includes('WIP') ? 'WIP' : 'VALIDATION', message);
    }
    const existing = exclusiveHolders('work_item', item.id).find((lease) => lease.ownerId === memberId);
    if (existing === undefined) {
      const now = Date.now();
      leases = [
        ...leases,
        {
          id: randomUUID(),
          projectId: item.projectId,
          resourceType: 'work_item',
          resourceId: item.id,
          mode: 'exclusive_write',
          ownerId: memberId,
          reason,
          linkedTaskId: null,
          workItemId: item.id,
          expiresAt: now + deps.config.leaseTtlMs,
          createdAt: now,
        },
      ];
    }
    audit(item.projectId, actor, 'work_item.assigned', item.id, item.title, ['assignee']);
    note(item.projectId, item.id, `${actor} assigned ${item.title} to ${memberId}`, actor);
    return assigned;
  }

  function requireWorkItem(workItemId: WorkItemId): WorkItem {
    const item = deps.board.getWorkItem(workItemId);
    if (item === undefined) throw new DispatchError('NOT_FOUND', `work item not found: ${workItemId}`);
    return item;
  }

  function activeLeases(): readonly ResourceLease[] {
    const now = Date.now();
    return leases.filter((item) => item.expiresAt > now);
  }

  function exclusiveHolders(resourceType: LeaseResourceType, resourceId: string): readonly ResourceLease[] {
    return activeLeases().filter(
      (item) => item.resourceType === resourceType && item.resourceId === resourceId && item.mode === 'exclusive_write',
    );
  }

  function expireLeases(): void {
    const now = Date.now();
    leases = leases.filter((item) => item.expiresAt > now);
  }

  function dropLease(leaseId: string): void {
    leases = leases.filter((item) => item.id !== leaseId);
  }

  function persist(): void {
    saveDispatchSnapshot(deps.workspaceRoot, { schemaVersion: 1, leases, feedback });
  }

  function audit(
    projectId: ProjectId,
    actorId: string,
    action: string,
    targetId: string,
    targetLabel: string,
    changedFields: readonly string[],
  ): void {
    deps.board.recordAuditEvent({
      projectId,
      actorId,
      action,
      targetType: 'work_item',
      targetId,
      targetLabel,
      changedFields: [...changedFields],
    });
  }

  function memberOwnsBranch(item: WorkItem, member: TeamMember): boolean {
    const branches = deps.scm?.listBranches({ workItemId: item.id }) ?? [];
    return branches.some((branch) => branch.owner === member.id || branch.owner === member.displayName);
  }

  function pendingApprovalsFor(item: WorkItem): number {
    const authorityPending = deps.authority?.listApprovals({
      projectId: item.projectId,
      status: 'pending',
    }).filter((row) => row.workItemId === item.id).length ?? 0;
    return authorityPending + (item.approverIds.length > 0 ? item.approverIds.length : 0);
  }

  function note(projectId: ProjectId, workItemId: WorkItemId, body: string, role: string): void {
    if (deps.collab === undefined) return;
    const conversation = deps.collab.listConversations(projectId)[0]
      ?? deps.collab.createConversation({ projectId, title: 'Agent Channel' });
    deps.collab.postMessage(conversation.id, {
      type: 'note.chat',
      from: { kind: 'system', role },
      payload: { body },
      refs: { workItemId },
    });
  }
}

function ineligibleReason(
  item: WorkItem,
  member: TeamMember,
  availableSlots: number,
  requiredRole: string,
): string | undefined {
  if (member.status !== 'active') return 'member is not active';
  if (availableSlots <= 0) return 'WIP limit reached';
  if (requiredRole !== '' && !member.roleIds.includes(requiredRole as never)) return `missing role ${requiredRole}`;
  if (item.blockedByIds.length > 0 && member.memberType === 'agent') return 'blocked work';
  return undefined;
}

function roleFor(item: WorkItem): string {
  if (item.type === 'story' || item.type === 'task' || item.type === 'bug') return 'developer';
  return 'developer';
}

function isOpen(item: WorkItem): boolean {
  return item.status !== 'delivered' && item.status !== 'rejected' && item.status !== 'stopped';
}

function isLeaseResourceType(value: string): value is LeaseResourceType {
  return (LEASE_RESOURCE_TYPES as readonly string[]).includes(value);
}

function isLeaseMode(value: string): value is LeaseMode {
  return (LEASE_MODES as readonly string[]).includes(value);
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function isMigrationPath(path: string): boolean {
  return /(^|\/)(migrations?|migrate)(\/|$)/i.test(path) || /migrat/i.test(path);
}

function extractFeedback(run: AgentRun, item: WorkItem): Pick<
  AgentFeedback,
  | 'summary'
  | 'openQuestions'
  | 'decisions'
  | 'blockers'
  | 'missingEvidence'
  | 'nextActions'
  | 'proposedAnalysis'
  | 'proposedDesign'
  | 'proposedAcceptance'
> {
  const output = asObject(run.output);
  const openQuestions = stringArray(output.openQuestions);
  const acceptance = stringArray(output.acceptance);
  const outcome = typeof output.outcome === 'string' ? output.outcome : item.title;
  const failed = stringArray(output.failedCriteria);
  return {
    summary: typeof output.summary === 'string' ? output.summary : outcome,
    openQuestions,
    decisions: run.handoff !== null ? [`handoff:${run.handoff.kind}`] : [],
    blockers: run.error !== null ? [run.error] : failed.map((row) => `failed:${row}`),
    missingEvidence: failed.length > 0 ? failed : [],
    nextActions: run.handoff !== null ? [run.handoff.kind] : ['review-feedback'],
    proposedAnalysis: run.agentId === 'planner' ? outcome : '',
    proposedDesign: run.agentId === 'planner' && typeof output.userStory === 'object' && output.userStory !== null
      ? JSON.stringify(output.userStory)
      : '',
    proposedAcceptance: run.agentId === 'planner' ? acceptance : [],
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function fail(message: string): never {
  throw new DispatchError('NOT_FOUND', message);
}
