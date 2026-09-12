/**
 * Work-item runtime helpers.
 *
 * Pure functions over the `WorkItem` model declared in `./types.ts`.
 * Lives in its own file so `types.ts` stays a pure declaration surface
 * and these helpers can be unit-tested without spinning up the cordis
 * Context.
 *
 * Each function takes its inputs as arguments rather than reading from
 * a closure so they are trivial to test and to compose into transition
 * guards.
 *
 * @mode declaration
 * @param payload keys not declared here must carry `@dshScopeScan unsupported`
 */

import { hasExecutedDeliveryEvidence } from './executed-evidence.js';
import type {
  CardId,
  DeliveryEvidenceSummary,
  DoneCheckKind,
  ProjectDeliveryPolicy,
  ReadyCheckKind,
  WorkItem,
  WorkItemId,
  WorkItemStatus,
  WorkItemType,
} from './types.js';
import { DEFAULT_DELIVERY_POLICY } from './types.js';

// --- Type errors --------------------------------------------------------

/**
 * Field-level error raised when a WorkItem is invalid as-is. The shape
 * is a discriminated union so the caller can render a specific message
 * per case without a string-match later. New variants are added by
 * extending this union; consumers must exhaust them with `assertNever`.
 */
export type WorkItemError =
  | { readonly kind: 'missing_title'; readonly id: WorkItemId }
  | { readonly kind: 'missing_body'; readonly id: WorkItemId }
  | { readonly kind: 'missing_acceptance_for_requirement'; readonly id: WorkItemId }
  | { readonly kind: 'missing_analysis_for_ready'; readonly id: WorkItemId }
  | { readonly kind: 'missing_design_for_ready'; readonly id: WorkItemId }
  | { readonly kind: 'missing_milestone_for_ready'; readonly id: WorkItemId }
  | { readonly kind: 'blocked_work_items_for_ready'; readonly id: WorkItemId }
  | { readonly kind: 'missing_executed_evidence_for_done'; readonly id: WorkItemId }
  | { readonly kind: 'missing_review_for_done'; readonly id: WorkItemId }
  | { readonly kind: 'missing_code_for_done'; readonly id: WorkItemId }
  | { readonly kind: 'unfinished_children_for_done'; readonly id: WorkItemId }
  | { readonly kind: 'not_ready_for_development'; readonly id: WorkItemId; readonly status: WorkItemStatus }
  | { readonly kind: 'cycle_in_parent_chain'; readonly id: WorkItemId; readonly parentId: WorkItemId }
  | {
      readonly kind: 'invalid_parent_type';
      readonly id: WorkItemId;
      readonly parentId: WorkItemId;
      readonly childType: WorkItemType;
      readonly parentType: WorkItemType;
    }
  | {
      readonly kind: 'cross_project_parent';
      readonly id: WorkItemId;
      readonly parentId: WorkItemId;
      readonly projectId: string;
      readonly parentProjectId: string;
    };

/** Exhaustiveness sentinel; throw a `TypeError` if a closed discriminant slips through. */
export function assertNever(value: never): never {
  throw new TypeError(`unhandled discriminant: ${JSON.stringify(value)}`);
}

// --- Hierarchy ----------------------------------------------------------

const PORTFOLIO_PARENTS: readonly WorkItemType[] = ['epic', 'feature'];
const REQUIREMENT_PARENTS: readonly WorkItemType[] = ['feature'];
const EXECUTION_PARENTS: readonly WorkItemType[] = ['requirement', 'story'];
const SUPPORTING_PARENTS: readonly WorkItemType[] = [
  'epic',
  'feature',
  'requirement',
  'story',
  'task',
  'bug',
  'defect',
  'research',
];

/**
 * Return the allowed direct parent types for a work item type.
 */
export function allowedParentTypes(type: WorkItemType): readonly WorkItemType[] {
  switch (type) {
    case 'epic':
      return [];
    case 'feature':
      return ['epic'];
    case 'requirement':
    case 'story':
      return REQUIREMENT_PARENTS;
    case 'task':
      return EXECUTION_PARENTS;
    case 'bug':
    case 'defect':
      return ['feature', ...EXECUTION_PARENTS];
    case 'research':
      return PORTFOLIO_PARENTS;
    case 'discussion':
    case 'meeting':
    case 'decision':
    case 'brainstorm':
      return SUPPORTING_PARENTS;
    default:
      return assertNever(type);
  }
}

/**
 * Hierarchy rule: a card may optionally carry one parent id. When the
 * parent is available, its type must match the Azure Boards-style product
 * hierarchy and the ancestor chain must not cycle.
 */
export function validateWorkItemHierarchy(
  item: WorkItem,
  lookup: (id: WorkItemId) => WorkItem | null,
): WorkItemError | null {
  if (item.parentId === null) return null;
  const parent = lookup(item.parentId);
  if (parent === null) {
    // The parent id is unknown to the caller; we treat that as a soft
    // violation because the lookup may legitimately not be loaded yet.
    // The persistence layer re-runs this check after hydration.
    return null;
  }
  const visited = new Set<WorkItemId>([item.id]);
  let cursor: WorkItem | null = parent;
  while (cursor !== null) {
    if (visited.has(cursor.id)) {
      return { kind: 'cycle_in_parent_chain', id: item.id, parentId: cursor.id };
    }
    visited.add(cursor.id);
    cursor = cursor.parentId === null ? null : lookup(cursor.parentId);
  }

  const allowed = allowedParentTypes(item.type);
  if (!allowed.includes(parent.type)) {
    return {
      kind: 'invalid_parent_type',
      id: item.id,
      parentId: item.parentId,
      childType: item.type,
      parentType: parent.type,
    };
  }
  if (item.projectId !== parent.projectId) {
    return {
      kind: 'cross_project_parent',
      id: item.id,
      parentId: item.parentId,
      projectId: item.projectId,
      parentProjectId: parent.projectId,
    };
  }
  return null;
}

// --- Field-level validation --------------------------------------------

/** Empty-or-whitespace check that does not depend on a particular title policy. */
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Required-field check for `WorkItem`. Returns the first failing
 * variant, or `null` when every required field is present. The check is
 * deliberately conservative: empty bodies or titles are rejected even
 * though the optional GitHub projection policy allows them (the
 * HuntianLing UI renders empty cards as broken links).
 *
 * Type-specific required-field rules live in `assertRequirementHasAcceptance`,
 * which this helper calls.
 */
export function validateWorkItemRequiredFields(item: WorkItem): WorkItemError | null {
  if (isBlank(item.title)) return { kind: 'missing_title', id: item.id };
  if (isBlank(item.body)) return { kind: 'missing_body', id: item.id };
  const acceptanceError = assertRequirementHasAcceptance(item);
  return acceptanceError;
}

/**
 * Requirement and story cards cannot leave `inbox` until their acceptance
 * criteria list is non-empty. Other types do not require acceptance.
 */
export function assertRequirementHasAcceptance(item: WorkItem): WorkItemError | null {
  if (item.type !== 'requirement' && item.type !== 'story') return null;
  if (item.acceptance.length === 0) {
    return { kind: 'missing_acceptance_for_requirement', id: item.id };
  }
  return null;
}

function requiresDefinitionOfReady(item: WorkItem): boolean {
  return item.type === 'requirement' || item.type === 'story';
}

/**
 * Definition of Ready for requirement-bearing work. Execution items may
 * be made ready by their parent Story, but Stories and Requirements must
 * carry the product analysis, design, acceptance, milestone, and blocker
 * checks before they become developer-startable.
 */
export function resolveDeliveryPolicy(policy?: ProjectDeliveryPolicy | null): ProjectDeliveryPolicy {
  if (policy === undefined || policy === null) return DEFAULT_DELIVERY_POLICY;
  return {
    readyChecks: policy.readyChecks.length > 0 ? policy.readyChecks : DEFAULT_DELIVERY_POLICY.readyChecks,
    doneChecks: uniqueDoneChecks(policy.doneChecks),
  };
}

function uniqueDoneChecks(checks: readonly DoneCheckKind[]): readonly DoneCheckKind[] {
  const next = new Set<DoneCheckKind>(['executed-evidence']);
  for (const check of checks) next.add(check);
  return [...next];
}

function hasReadyCheck(policy: ProjectDeliveryPolicy, kind: ReadyCheckKind): boolean {
  return policy.readyChecks.includes(kind);
}

export function validateDefinitionOfReady(
  item: WorkItem,
  policy?: ProjectDeliveryPolicy | null,
): WorkItemError | null {
  if (!requiresDefinitionOfReady(item)) return null;
  const resolved = resolveDeliveryPolicy(policy);
  if (hasReadyCheck(resolved, 'analysis') && isBlank(item.analysis)) {
    return { kind: 'missing_analysis_for_ready', id: item.id };
  }
  if (hasReadyCheck(resolved, 'design') && isBlank(item.design)) {
    return { kind: 'missing_design_for_ready', id: item.id };
  }
  if (hasReadyCheck(resolved, 'acceptance')) {
    const acceptanceError = assertRequirementHasAcceptance(item);
    if (acceptanceError !== null) return acceptanceError;
  }
  if (hasReadyCheck(resolved, 'milestone') && item.milestoneId === null) {
    return { kind: 'missing_milestone_for_ready', id: item.id };
  }
  if (hasReadyCheck(resolved, 'unblocked') && item.blockedByIds.length > 0) {
    return { kind: 'blocked_work_items_for_ready', id: item.id };
  }
  return null;
}

export interface DefinitionOfDoneContext {
  readonly evidence?: DeliveryEvidenceSummary | null;
  readonly children?: readonly WorkItem[];
  readonly policy?: ProjectDeliveryPolicy | null;
}

export function validateDefinitionOfDone(
  item: WorkItem,
  context: DefinitionOfDoneContext = {},
): WorkItemError | null {
  if (!requiresDefinitionOfReady(item)) return null;
  const resolved = resolveDeliveryPolicy(context.policy);
  if (resolved.doneChecks.includes('executed-evidence')) {
    if (!hasExecutedDeliveryEvidence(context.evidence, item)) {
      return { kind: 'missing_executed_evidence_for_done', id: item.id };
    }
  }
  if (resolved.doneChecks.includes('review')) {
    const reviews = context.evidence?.reviewLinks.length ?? 0;
    if (item.reviewerIds.length === 0 && reviews === 0) {
      return { kind: 'missing_review_for_done', id: item.id };
    }
  }
  if (resolved.doneChecks.includes('code')) {
    const code = context.evidence?.codeLinks.length ?? 0;
    if (code === 0) {
      return { kind: 'missing_code_for_done', id: item.id };
    }
  }
  if (resolved.doneChecks.includes('children-complete')) {
    const unfinished = (context.children ?? []).filter(
      (child) => child.status !== 'delivered' && child.status !== 'rejected' && child.status !== 'stopped',
    );
    if (unfinished.length > 0) {
      return { kind: 'unfinished_children_for_done', id: item.id };
    }
  }
  return null;
}

// --- Transition guards -------------------------------------------------

/**
 * Status pairs that are explicitly forbidden by the lifecycle. Adding a new
 * entry here tightens the behaviour without breaking the type-level
 * exhaustiveness elsewhere.
 */
const FORBIDDEN_TRANSITIONS: ReadonlySet<string> = new Set([
  'delivered→inbox',
  'delivered→triaged',
  'rejected→inbox',
  'rejected→in_progress',
]);

/**
 * True when the lifecycle forbids moving from `from` to `to`. Reused
 * by the lifecycle Service (issue #17) and by the board Service when
 * it receives a `cards.move` request. Returning a boolean keeps the
 * helper composable; the Service raises the typed error.
 */
export function isForbiddenTransition(from: WorkItemStatus, to: WorkItemStatus): boolean {
  return FORBIDDEN_TRANSITIONS.has(`${from}→${to}`);
}

/**
 * Compound guard: returns the first issue that blocks the transition,
 * or `null` if the move is allowed given the item's fields and the
 * lifecycle. Required-field errors win over forbidden transitions so
 * the user fixes data first and policy second.
 */
export function validateWorkItemTransition(
  item: WorkItem,
  to: WorkItemStatus,
  context: DefinitionOfDoneContext = {},
): WorkItemError | { readonly kind: 'forbidden_transition'; readonly from: WorkItemStatus; readonly to: WorkItemStatus } | null {
  const fieldError = validateWorkItemRequiredFields(item);
  if (fieldError !== null) return fieldError;
  if (to === 'ready' || to === 'in_progress') {
    const readyError = validateDefinitionOfReady(item, context.policy);
    if (readyError !== null) return readyError;
  }
  if (to === 'delivered') {
    const doneError = validateDefinitionOfDone(item, context);
    if (doneError !== null) return doneError;
  }
  if (
    to === 'in_progress' &&
    item.status !== 'ready' &&
    item.status !== 'in_review' &&
    item.status !== 'verifying' &&
    item.status !== 'gates_passing'
  ) {
    return { kind: 'not_ready_for_development', id: item.id, status: item.status };
  }
  if (isForbiddenTransition(item.status, to)) {
    return { kind: 'forbidden_transition', from: item.status, to };
  }
  return null;
}

// --- Discriminant exhaustiveness for WorkItemType ----------------------

/**
 * Per-type rule evaluation. Returning `null` means "no rule". A future
 * `task`-estimation rule or a `decision`-required-date rule plugs in
 * here without touching the call site.
 *
 * The `assertNever(value)` call inside the exhaustive switch enforces
 * a compile-time error when a new `WorkItemType` is added without a
 * matching rule entry.
 */
export function typeSpecificRule(item: WorkItem): WorkItemError | null {
  switch (item.type) {
    case 'epic':
      return null;
    case 'feature':
      return null;
    case 'requirement':
      return assertRequirementHasAcceptance(item);
    case 'story':
      return assertRequirementHasAcceptance(item);
    case 'task':
      return null;
    case 'bug':
      return null;
    case 'defect':
      return null;
    case 'research':
      return null;
    case 'discussion':
      return null;
    case 'meeting':
      return null;
    case 'decision':
      return null;
    case 'brainstorm':
      return null;
    default:
      return assertNever(item.type);
  }
}

// --- Re-export for backwards-compatible imports ------------------------

/** @deprecated Imported from `./types.ts` directly. */
export type { CardId, WorkItemId, WorkItemType, WorkItemStatus };
