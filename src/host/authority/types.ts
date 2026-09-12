/**
 * Agent role capability limits and high-risk approval records.
 */

import type { WorkItemType } from '../board/types.js';

export const AUTHORITY_ACTIONS = [
  'read',
  'draft',
  'code_modify',
  'git_commit',
  'branch_push',
  'pull_request',
  'ci_trigger',
  'production_deploy',
  'review_approve',
  'merge',
  'protected_file_write',
] as const;

export type AuthorityAction = (typeof AUTHORITY_ACTIONS)[number];
export type AuthorityDecision = 'allow' | 'deny' | 'needs_approval';
export type ApprovalStatus = 'pending' | 'granted' | 'rejected' | 'consumed';

export interface AuthorityConfig {
  readonly protectedPathPrefixes?: readonly string[];
}

export interface ResolvedAuthorityConfig {
  readonly protectedPathPrefixes: readonly string[];
}

export function resolveAuthorityConfig(input: AuthorityConfig = {}): ResolvedAuthorityConfig {
  const prefixes = input.protectedPathPrefixes ?? ['.github/', 'cordis.yml'];
  if (prefixes.some((prefix) => prefix.trim() === '')) {
    throw new Error('authority protectedPathPrefixes cannot contain a blank prefix');
  }
  return { protectedPathPrefixes: prefixes };
}

export interface RoleCapabilityPolicy {
  readonly role: string;
  readonly workItemTypes: readonly WorkItemType[];
  readonly tools: readonly string[];
  readonly writePermissions: readonly AuthorityAction[];
  readonly allowedActions: readonly AuthorityAction[];
  readonly approvalRequired: readonly AuthorityAction[];
  readonly forbiddenActions: readonly AuthorityAction[];
}

export interface AuthorizeInput {
  readonly role: string;
  readonly action: AuthorityAction;
  readonly projectId: string;
  readonly actor: string;
  readonly workItemId?: string;
  readonly workItemType?: WorkItemType;
  readonly path?: string;
  readonly approvalId?: string;
}

export interface AuthorizeResult {
  readonly decision: AuthorityDecision;
  readonly reason: string;
  readonly role: string;
  readonly action: AuthorityAction;
}

export interface ApprovalRecord {
  readonly id: string;
  readonly projectId: string;
  readonly workItemId: string | null;
  readonly role: string;
  readonly action: AuthorityAction;
  readonly requester: string;
  readonly status: ApprovalStatus;
  readonly reason: string;
  readonly decidedBy: string | null;
  readonly decidedReason: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export class AuthorityError extends Error {
  constructor(
    readonly code: 'DENIED' | 'APPROVAL_REQUIRED' | 'NOT_FOUND' | 'VALIDATION',
    message: string,
  ) {
    super(message);
  }
}
