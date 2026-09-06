/**
 * Board capability — type definitions.
 *
 * Models the GitHub Projects-style board: projects own milestones; each
 * milestone holds lanes (one per configured role); lanes hold cards
 * (issue-like items). Skeleton publishes the contract only.
 *
 * @mode declaration
 * @param payload keys not declared here must carry `@dshScopeScan unsupported`
 */

import type { RequirementId } from '../agile/types.js';

declare const _boardBrand: unique symbol;
type BoardBranded<T extends string> = string & { readonly [_boardBrand]: T };

export type ProjectId = BoardBranded<'ProjectId'>;
export type MilestoneId = BoardBranded<'MilestoneId'>;
export type LaneId = BoardBranded<'LaneId'>;
export type CardId = BoardBranded<'CardId'>;

/** A configurable role that owns one or more lanes on a milestone board. */
export interface Role {
  readonly id: string;
  readonly displayName: string;
}

/** A board container; one project has many milestones. */
export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly milestones: readonly Milestone[];
  readonly roles: readonly Role[];
}

/** A planning horizon inside a project; carries its own board. */
export interface Milestone {
  readonly id: MilestoneId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly dueAt: number | null;
  readonly lanes: readonly Lane[];
}

/** A swimlane owned by a role; cards move between lanes. */
export interface Lane {
  readonly id: LaneId;
  readonly milestoneId: MilestoneId;
  readonly roleId: string;
  readonly order: number;
  readonly cards: readonly Card[];
}

/** An issue-like card; bound to a Requirement once submitted through agile. */
export interface Card {
  readonly id: CardId;
  readonly laneId: LaneId;
  readonly title: string;
  readonly body: string;
  readonly order: number;
  /** Linked Requirement, if the card originated from an intake submission. */
  readonly requirementId: RequirementId | null;
}
