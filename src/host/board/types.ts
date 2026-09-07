/**
 * Board capability — type definitions.
 *
 * Models the HuntianLing project-management model:
 *
 *   WorkItem  ← 统一的工作项模型，覆盖需求、缺陷、任务，以及调研、
 *               讨论、会议、裁决、头脑风暴八种类型。一张卡片就是一个
 *               工作项；表/板/路线图三视图共享同一份数据。
 *   Card      ← 工作项在泳道上的落点，包含 order、laneId 等板专属字段。
 *               Card 引用 WorkItem，不重复建模。
 *   Project / Milestone / Lane / Role
 *             ← 项目容器与流转基础设施。
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
export type WorkItemId = BoardBranded<'WorkItemId'>;

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

// --- Work item model (issue #18) ----------------------------------------

/**
 * The eight first-class card types HuntianLing tracks. Every value is a
 * discriminant on `WorkItem.type`; consumers MUST switch on this tag and
 * fall through with a documented default for forward compatibility.
 *
 * `requirement` and `defect` are the work the product owes its users.
 * `task` is engineering work that is not directly a requirement or defect
 * (e.g. paying down tech debt or upgrading a dependency).
 * `research` / `discussion` / `meeting` / `decision` / `brainstorm` are
 * the process cards from issue #16 — they ride the same lifecycle but
 * skip the delivery phases.
 *
 * `assertNever` on a closed union should branch on `WorkItemType` to make
 * the per-type rule omissions a type error.
 */
export type WorkItemType =
  | 'requirement'
  | 'defect'
  | 'task'
  | 'research'
  | 'discussion'
  | 'meeting'
  | 'decision'
  | 'brainstorm';

/**
 * The lifecycle every work item moves through. Defined here so the
 * transition guards in `./work-item.js` can validate them centrally;
 * the full state machine, including which transitions are legal, lives
 * in issue #17.
 */
export type WorkItemStatus =
  | 'inbox'
  | 'triaged'
  | 'planned'
  | 'in_progress'
  | 'verifying'
  | 'gates_passing'
  | 'delivered'
  | 'rejected';

/** Priority label on a work item. Mirrors `PRIORITIES` in the issue policy. */
export type WorkItemPriority = 'p0' | 'p1' | 'p2' | 'p3';

/**
 * A coarse-grained size estimate. Null means "not yet estimated"; the
 * Ready definition (issue #21) treats null as a blocker for `planned`.
 */
export type WorkItemEstimate = number | null;

/**
 * A login (or empty string for unassigned). Kept as a plain string
 * because the assignment domain spans users, bots, and teams; the
 * binding Service owns the resolution to a principal.
 */
export type WorkItemAssignee = string;

/**
 * The single parent reference. Issues #18 restricts hierarchy to one
 * level — a card may point at an epic or theme, but a parent of a
 * parent is rejected by `validateWorkItemHierarchy`. We model parent as
 * `WorkItemId | null` rather than `WorkItem` so the persistence layer
 * can fetch the parent on demand without circular shapes.
 */
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
  /** Cross-link to the original intake submission, if this item originated there. */
  readonly sourceRequirementId: RequirementId | null;
}
