/**
 * Requirement management API backed by the internal board WorkItem store.
 *
 * This service owns requirement semantics: portfolio decomposition,
 * analysis/design updates, acceptance criteria, and coverage links. The Board
 * Service owns persistence, status movement, role claims, and view projection.
 */

import type { BoardService } from '../board/plugin.js';
import type {
  AcceptanceCoverageSummary,
  AcceptanceCriterion,
  AcceptanceCriterionId,
  MilestoneId,
  ProjectId,
  WorkItem,
  WorkItemCreateInput,
  WorkItemFilter,
  WorkItemId,
  WorkItemTreeNode,
  WorkItemType,
} from '../board/types.js';

export type RequirementNodeType = 'epic' | 'feature' | 'requirement' | 'story';
export type RequirementChildType = RequirementNodeType | 'task' | 'bug' | 'research';

export interface RequirementFields {
  readonly title: string;
  readonly body?: string;
  readonly analysis?: string;
  readonly design?: string;
  readonly sourceInput?: string;
  readonly decompositionReason?: string;
  readonly milestoneId?: MilestoneId | null;
  readonly acceptance?: readonly string[];
  readonly acceptanceCriteria?: readonly AcceptanceCriterion[];
}

export interface CreateEpicInput extends RequirementFields {
  readonly projectId: ProjectId;
}

export interface CreateFeatureInput extends RequirementFields {
  readonly epicId: WorkItemId;
}

export interface CreateRequirementInput extends RequirementFields {
  readonly featureId: WorkItemId;
}

export interface CreateExecutionInput {
  readonly parentId: WorkItemId;
  readonly title: string;
  readonly body?: string;
  readonly sourceInput?: string;
  readonly decompositionReason?: string;
  readonly milestoneId?: MilestoneId | null;
  readonly coversAcceptanceIds?: readonly AcceptanceCriterionId[];
  readonly dependencyIds?: readonly WorkItemId[];
  readonly blockedByIds?: readonly WorkItemId[];
  readonly evidence?: readonly string[];
}

export interface SplitRequirementChildInput extends RequirementFields {
  readonly type: RequirementChildType;
  readonly coversAcceptanceIds?: readonly AcceptanceCriterionId[];
  readonly dependencyIds?: readonly WorkItemId[];
  readonly blockedByIds?: readonly WorkItemId[];
  readonly evidence?: readonly string[];
}

export interface SplitRequirementInput {
  readonly parentId: WorkItemId;
  readonly children: readonly SplitRequirementChildInput[];
}

export interface RequirementDetailsUpdate {
  readonly title?: string;
  readonly body?: string;
  readonly analysis?: string;
  readonly design?: string;
  readonly sourceInput?: string;
  readonly decompositionReason?: string;
  readonly milestoneId?: MilestoneId | null;
  readonly acceptance?: readonly string[];
  readonly acceptanceCriteria?: readonly AcceptanceCriterion[];
}

export interface RequirementManagementService {
  createEpic(input: CreateEpicInput): WorkItem;
  createFeature(input: CreateFeatureInput): WorkItem;
  createRequirement(input: CreateRequirementInput): WorkItem;
  createStory(input: CreateRequirementInput): WorkItem;
  createTask(input: CreateExecutionInput): WorkItem;
  createBug(input: CreateExecutionInput): WorkItem;
  createResearch(input: CreateExecutionInput): WorkItem;
  splitRequirement(input: SplitRequirementInput): readonly WorkItem[];
  updateRequirement(workItemId: WorkItemId, input: RequirementDetailsUpdate): WorkItem;
  setAcceptanceCriteria(
    workItemId: WorkItemId,
    acceptanceCriteria: readonly AcceptanceCriterion[],
  ): WorkItem;
  linkAcceptanceCoverage(
    workItemId: WorkItemId,
    coversAcceptanceIds: readonly AcceptanceCriterionId[],
  ): WorkItem;
  listRequirements(filter?: WorkItemFilter): readonly WorkItem[];
  getRequirementTree(rootId: WorkItemId): WorkItemTreeNode;
  getAcceptanceCoverage(rootId: WorkItemId): AcceptanceCoverageSummary;
}

export function createRequirementManagementService(
  board: BoardService,
): RequirementManagementService {
  const createFromParent = (
    parentId: WorkItemId,
    type: WorkItemType,
    input: RequirementFields | CreateExecutionInput | SplitRequirementChildInput,
  ): WorkItem => {
    const parent = requireWorkItem(board, parentId);
    return board.createWorkItem({
      ...toCreateInput(input),
      projectId: parent.projectId,
      type,
      parentId,
    });
  };

  return {
    createEpic: (input) =>
      board.createWorkItem({
        ...toCreateInput(input),
        projectId: input.projectId,
        type: 'epic',
      }),
    createFeature: (input) => createFromParent(input.epicId, 'feature', input),
    createRequirement: (input) => createFromParent(input.featureId, 'requirement', input),
    createStory: (input) => createFromParent(input.featureId, 'story', input),
    createTask: (input) => createFromParent(input.parentId, 'task', input),
    createBug: (input) => createFromParent(input.parentId, 'bug', input),
    createResearch: (input) => createFromParent(input.parentId, 'research', input),
    splitRequirement: (input) =>
      input.children.map((child) => createFromParent(input.parentId, child.type, child)),
    updateRequirement: (workItemId, input) => board.updateWorkItem(workItemId, input),
    setAcceptanceCriteria: (workItemId, acceptanceCriteria) =>
      board.updateWorkItem(workItemId, { acceptanceCriteria }),
    linkAcceptanceCoverage: (workItemId, coversAcceptanceIds) =>
      board.updateWorkItem(workItemId, { coversAcceptanceIds }),
    listRequirements: (filter = {}) =>
      board.listWorkItems({
        ...filter,
        type: filter.type ?? ['epic', 'feature', 'requirement', 'story'],
      }),
    getRequirementTree: (rootId) => board.getWorkItemTree(rootId),
    getAcceptanceCoverage: (rootId) => board.getAcceptanceCoverage(rootId),
  };
}

function requireWorkItem(board: BoardService, workItemId: WorkItemId): WorkItem {
  const item = board.getWorkItem(workItemId);
  if (!item) throw new Error(`work item not found: ${workItemId}`);
  return item;
}

function toCreateInput(input: RequirementFields | CreateExecutionInput): Omit<
  WorkItemCreateInput,
  'projectId'
> {
  return {
    title: input.title,
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...('analysis' in input && input.analysis !== undefined ? { analysis: input.analysis } : {}),
    ...('design' in input && input.design !== undefined ? { design: input.design } : {}),
    ...('sourceInput' in input && input.sourceInput !== undefined ? { sourceInput: input.sourceInput } : {}),
    ...('decompositionReason' in input && input.decompositionReason !== undefined
      ? { decompositionReason: input.decompositionReason }
      : {}),
    ...('milestoneId' in input && input.milestoneId !== undefined
      ? { milestoneId: input.milestoneId }
      : {}),
    ...('acceptance' in input && input.acceptance !== undefined
      ? { acceptance: input.acceptance }
      : {}),
    ...('acceptanceCriteria' in input && input.acceptanceCriteria !== undefined
      ? { acceptanceCriteria: input.acceptanceCriteria }
      : {}),
    ...('coversAcceptanceIds' in input && input.coversAcceptanceIds !== undefined
      ? { coversAcceptanceIds: input.coversAcceptanceIds }
      : {}),
    ...('dependencyIds' in input && input.dependencyIds !== undefined
      ? { dependencyIds: input.dependencyIds }
      : {}),
    ...('blockedByIds' in input && input.blockedByIds !== undefined
      ? { blockedByIds: input.blockedByIds }
      : {}),
    ...('evidence' in input && input.evidence !== undefined ? { evidence: input.evidence } : {}),
  };
}
