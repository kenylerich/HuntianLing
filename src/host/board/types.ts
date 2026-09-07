/**
 * Board capability — type definitions.
 *
 * WorkItem is the source of truth. Table / board / roadmap project the
 * same items. Roles claim work items; claim is not a nested lane of cards.
 */

import type { RequirementId } from '../agile/types.js';

declare const _boardBrand: unique symbol;
type BoardBranded<T extends string> = string & { readonly [_boardBrand]: T };

export type ProjectId = BoardBranded<'ProjectId'>;
export type MilestoneId = BoardBranded<'MilestoneId'>;
export type LaneId = BoardBranded<'LaneId'>;
export type WorkItemId = BoardBranded<'WorkItemId'>;
export type CardId = WorkItemId;
export type RoleId = BoardBranded<'RoleId'>;

export interface Role {
  readonly id: RoleId;
  readonly displayName: string;
}

export const DEFAULT_ROLES: readonly Role[] = [
  { id: 'product-owner' as RoleId, displayName: '产品负责人' },
  { id: 'developer' as RoleId, displayName: '开发' },
  { id: 'process-steward' as RoleId, displayName: '流程看护' },
];

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly roles: readonly Role[];
}

export type WorkItemType =
  | 'requirement'
  | 'defect'
  | 'task'
  | 'research'
  | 'discussion'
  | 'meeting'
  | 'decision'
  | 'brainstorm';

export type WorkItemStatus =
  | 'inbox'
  | 'triaged'
  | 'planned'
  | 'in_progress'
  | 'verifying'
  | 'gates_passing'
  | 'delivered'
  | 'rejected'
  | 'stopped';

export type WorkItemPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type WorkItemEstimate = number | null;
export type WorkItemAssignee = string;

export interface WorkItem {
  readonly id: WorkItemId;
  readonly projectId: ProjectId;
  readonly type: WorkItemType;
  readonly title: string;
  readonly body: string;
  readonly status: WorkItemStatus;
  readonly priority: WorkItemPriority | null;
  readonly estimate: WorkItemEstimate;
  readonly assignee: WorkItemAssignee;
  readonly parentId: WorkItemId | null;
  readonly startDate: number | null;
  readonly dueDate: number | null;
  readonly acceptance: readonly string[];
  readonly sourceRequirementId: RequirementId | null;
  readonly sortOrder: number;
  readonly claimedRoleId: RoleId | null;
  readonly claimedBy: string | null;
  readonly claimedAt: number | null;
}

/** @deprecated Use WorkItem. Kept as a persistence alias for the board store. */
export type Card = WorkItem;
export type StateGroup = WorkItemStatus;

export const SCHEMA_VERSION = 1;
