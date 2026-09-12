/**
 * Authorize agent actions against role policy and human approval.
 */

import { randomUUID } from 'node:crypto';

import type { BoardService } from '../board/plugin.js';
import type { ProjectId, WorkItemId, WorkItemType } from '../board/types.js';
import { policyForRole, ROLE_POLICIES } from './policies.js';
import { loadApprovals, saveApprovals } from './store.js';
import {
  AuthorityError,
  resolveAuthorityConfig,
  type ApprovalRecord,
  type ApprovalStatus,
  type AuthorityAction,
  type AuthorityConfig,
  type AuthorizeInput,
  type AuthorizeResult,
  type RoleCapabilityPolicy,
} from './types.js';

export interface AuthorityService {
  policies(): readonly RoleCapabilityPolicy[];
  policyFor(role: string): RoleCapabilityPolicy;
  authorize(input: AuthorizeInput): AuthorizeResult;
  assert(input: AuthorizeInput): void;
  requestApproval(input: {
    readonly projectId: string;
    readonly workItemId?: string;
    readonly role: string;
    readonly action: AuthorityAction;
    readonly requester: string;
    readonly reason?: string;
  }): ApprovalRecord;
  decideApproval(input: {
    readonly approvalId: string;
    readonly decision: 'granted' | 'rejected';
    readonly actor: string;
    readonly reason?: string;
  }): ApprovalRecord;
  listApprovals(filter?: { readonly projectId?: string; readonly status?: ApprovalStatus }): readonly ApprovalRecord[];
}

export function createAuthorityService(deps: {
  readonly board: BoardService;
  readonly workspaceRoot: string;
  readonly config?: AuthorityConfig;
}): AuthorityService {
  const config = resolveAuthorityConfig(deps.config ?? {});
  let approvals = loadApprovals(deps.workspaceRoot);

  const service: AuthorityService = {
    policies() {
      return ROLE_POLICIES;
    },

    policyFor(role) {
      const policy = policyForRole(role);
      if (policy === undefined) {
        throw new AuthorityError('NOT_FOUND', `unknown role: ${role}`);
      }
      return policy;
    },

    authorize(input) {
      return decide(deps.board, config.protectedPathPrefixes, approvals, input);
    },

    assert(input) {
      const result = service.authorize(input);
      if (result.decision === 'allow') {
        if (input.approvalId !== undefined) {
          consume(input.approvalId);
        }
        audit(deps.board, input, 'authority.allowed', result.reason);
        return;
      }
      if (result.decision === 'needs_approval') {
        audit(deps.board, input, 'authority.denied', result.reason);
        throw new AuthorityError('APPROVAL_REQUIRED', result.reason);
      }
      audit(deps.board, input, 'authority.denied', result.reason);
      throw new AuthorityError('DENIED', result.reason);
    },

    requestApproval(input) {
      const policy = service.policyFor(input.role);
      if (policy.forbiddenActions.includes(input.action)) {
        throw new AuthorityError('DENIED', `${input.role} cannot request approval for ${input.action}`);
      }
      if (!policy.approvalRequired.includes(input.action)) {
        throw new AuthorityError('VALIDATION', `${input.action} does not require approval for ${input.role}`);
      }
      const now = Date.now();
      const record: ApprovalRecord = {
        id: randomUUID(),
        projectId: input.projectId,
        workItemId: input.workItemId ?? null,
        role: input.role,
        action: input.action,
        requester: input.requester,
        status: 'pending',
        reason: input.reason ?? '',
        decidedBy: null,
        decidedReason: '',
        createdAt: now,
        updatedAt: now,
      };
      approvals = [...approvals, record];
      persist();
      deps.board.recordAuditEvent({
        projectId: input.projectId as ProjectId,
        actorId: input.requester,
        action: 'authority.approval_requested',
        targetType: 'authority_approval',
        targetId: record.id,
        targetLabel: input.action,
        requestSource: 'authority',
        changedFields: ['status'],
        reason: record.reason,
      });
      return record;
    },

    decideApproval(input) {
      const existing = approvals.find((item) => item.id === input.approvalId);
      if (existing === undefined) {
        throw new AuthorityError('NOT_FOUND', `approval not found: ${input.approvalId}`);
      }
      if (existing.status !== 'pending') {
        throw new AuthorityError('VALIDATION', `approval ${existing.id} is ${existing.status}`);
      }
      if (input.actor === existing.requester) {
        throw new AuthorityError('VALIDATION', 'requester cannot approve their own request');
      }
      if (input.decision === 'granted' && (input.reason === undefined || input.reason.trim() === '')) {
        // reason optional for grant
      }
      const next: ApprovalRecord = {
        ...existing,
        status: input.decision,
        decidedBy: input.actor,
        decidedReason: input.reason ?? '',
        updatedAt: Date.now(),
      };
      approvals = approvals.map((item) => item.id === next.id ? next : item);
      persist();
      deps.board.recordAuditEvent({
        projectId: existing.projectId as ProjectId,
        actorId: input.actor,
        action: input.decision === 'granted' ? 'authority.approved' : 'authority.rejected',
        targetType: 'authority_approval',
        targetId: next.id,
        targetLabel: existing.action,
        requestSource: 'authority',
        changedFields: ['status'],
        reason: next.decidedReason,
      });
      return next;
    },

    listApprovals(filter = {}) {
      return approvals.filter((item) => {
        if (filter.projectId !== undefined && item.projectId !== filter.projectId) return false;
        if (filter.status !== undefined && item.status !== filter.status) return false;
        return true;
      });
    },
  };

  function consume(approvalId: string): void {
    const existing = approvals.find((item) => item.id === approvalId);
    if (existing === undefined || existing.status !== 'granted') return;
    const consumed: ApprovalRecord = { ...existing, status: 'consumed', updatedAt: Date.now() };
    approvals = approvals.map((item) => item.id === approvalId ? consumed : item);
    persist();
  }

  function persist(): void {
    saveApprovals(deps.workspaceRoot, approvals);
  }

  return service;
}

function decide(
  board: BoardService,
  protectedPathPrefixes: readonly string[],
  approvals: readonly ApprovalRecord[],
  input: AuthorizeInput,
): AuthorizeResult {
  const policy = policyForRole(input.role);
  if (policy === undefined) {
    return result(input, 'deny', `unknown role: ${input.role}`);
  }
  const action = effectiveAction(input, protectedPathPrefixes);
  const workItemType = resolveWorkItemType(board, input);
  if (workItemType !== undefined && !policy.workItemTypes.includes(workItemType)) {
    return result({ ...input, action }, 'deny', `${input.role} cannot act on ${workItemType} work items`);
  }
  if (policy.forbiddenActions.includes(action)) {
    return result({ ...input, action }, 'deny', `${input.role} is forbidden to ${action}`);
  }
  if (policy.allowedActions.includes(action)) {
    return result({ ...input, action }, 'allow', `${input.role} may ${action}`);
  }
  if (policy.approvalRequired.includes(action)) {
    if (input.approvalId !== undefined) {
      const approval = approvals.find((item) => item.id === input.approvalId);
      if (approval !== undefined && matchesApproval(approval, input, action)) {
        return result({ ...input, action }, 'allow', `approval ${approval.id} grants ${action}`);
      }
      return result({ ...input, action }, 'deny', 'approval does not match this action');
    }
    return result({ ...input, action }, 'needs_approval', `${action} requires human approval for ${input.role}`);
  }
  return result({ ...input, action }, 'deny', `${input.role} has no policy for ${action}`);
}

function effectiveAction(input: AuthorizeInput, protectedPathPrefixes: readonly string[]): AuthorityAction {
  if (input.path !== undefined && isProtectedPath(input.path, protectedPathPrefixes)) {
    if (input.action === 'code_modify' || input.action === 'git_commit' || input.action === 'protected_file_write') {
      return 'protected_file_write';
    }
  }
  return input.action;
}

function isProtectedPath(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

function resolveWorkItemType(board: BoardService, input: AuthorizeInput): WorkItemType | undefined {
  if (input.workItemType !== undefined) return input.workItemType;
  if (input.workItemId === undefined) return undefined;
  return board.getWorkItem(input.workItemId as WorkItemId)?.type;
}

function matchesApproval(approval: ApprovalRecord, input: AuthorizeInput, action: AuthorityAction): boolean {
  return approval.status === 'granted'
    && approval.role === input.role
    && approval.action === action
    && approval.projectId === input.projectId
    && (approval.workItemId === null || approval.workItemId === (input.workItemId ?? null));
}

function result(input: AuthorizeInput, decision: AuthorizeResult['decision'], reason: string): AuthorizeResult {
  return {
    decision,
    reason,
    role: input.role,
    action: input.action,
  };
}

function audit(board: BoardService, input: AuthorizeInput, action: string, reason: string): void {
  board.recordAuditEvent({
    projectId: input.projectId as ProjectId,
    actorId: input.actor,
    action,
    targetType: 'authority',
    targetId: input.workItemId ?? input.role,
    targetLabel: input.action,
    requestSource: 'authority',
    changedFields: ['decision'],
    reason,
  });
}
