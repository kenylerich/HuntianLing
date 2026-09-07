/**
 * Work-item runtime helpers.
 *
 * Pure functions over the `WorkItem` model declared in `./types.ts`.
 * Lives in its own file so `types.ts` stays a pure declaration surface
 * and these helpers can be unit-tested without spinning up the cordis
 * Context.
 *
 * Each function takes its inputs as arguments rather than reading from
 * a closure so they are trivial to test and to compose into the
 * transition guards the lifecycle Service (issue #17) will use.
 *
 * @mode declaration
 * @param payload keys not declared here must carry `@dshScopeScan unsupported`
 */

import type {
  CardId,
  WorkItem,
  WorkItemId,
  WorkItemStatus,
  WorkItemType,
} from './types.js';

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
  | { readonly kind: 'cycle_in_parent_chain'; readonly id: WorkItemId; readonly parentId: WorkItemId }
  | { readonly kind: 'parent_is_child'; readonly id: WorkItemId; readonly parentId: WorkItemId };

/** Exhaustiveness sentinel; throw a `TypeError` if a closed discriminant slips through. */
export function assertNever(value: never): never {
  throw new TypeError(`unhandled discriminant: ${JSON.stringify(value)}`);
}

// --- Hierarchy ----------------------------------------------------------

/**
 * Hierarchy rule from issue #18: a card may optionally carry one
 * parent id (an epic or theme), and a parent cannot itself have a
 * parent. `lookup` must return the parent record by id, or `null` if
 * the id is unknown; passing `null` skips the parent check.
 *
 * Cycles (`lookup` returns the original id) are reported as a separate
 * variant from "parent is a child" so the persistence layer can
 * distinguish data corruption from a layering violation.
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
  if (parent.id === item.id) {
    return { kind: 'cycle_in_parent_chain', id: item.id, parentId: item.parentId };
  }
  if (parent.parentId !== null) {
    return { kind: 'parent_is_child', id: item.id, parentId: item.parentId };
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
 * though the policy validator that runs on the GitHub side allows them
 * (the HuntianLing UI renders empty cards as broken links).
 *
 * Type-specific required-field rules from issue #18 live in
 * `assertRequirementHasAcceptance`, which this helper calls.
 */
export function validateWorkItemRequiredFields(item: WorkItem): WorkItemError | null {
  if (isBlank(item.title)) return { kind: 'missing_title', id: item.id };
  if (isBlank(item.body)) return { kind: 'missing_body', id: item.id };
  const acceptanceError = assertRequirementHasAcceptance(item);
  return acceptanceError;
}

/**
 * Issue #18: a requirement card cannot leave `inbox` until its
 * acceptance criteria list is non-empty. Other types do not require
 * acceptance. The check runs even when the current status is `inbox`
 * because downstream code may want to surface the missing list before
 * the transition is attempted.
 */
export function assertRequirementHasAcceptance(item: WorkItem): WorkItemError | null {
  if (item.type !== 'requirement') return null;
  if (item.acceptance.length === 0) {
    return { kind: 'missing_acceptance_for_requirement', id: item.id };
  }
  return null;
}

// --- Transition guards -------------------------------------------------

/**
 * Status pairs that are explicitly forbidden by the lifecycle in
 * issue #17. We only enumerate the jumps the issue body calls out
 * (delivered → inbox, etc.); a complete transition matrix lands with
 * the lifecycle Service. Adding a new entry here tightens the
 * behaviour without breaking the type-level exhaustiveness elsewhere.
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
): WorkItemError | { readonly kind: 'forbidden_transition'; readonly from: WorkItemStatus; readonly to: WorkItemStatus } | null {
  const fieldError = validateWorkItemRequiredFields(item);
  if (fieldError !== null) return fieldError;
  if (item.status === 'inbox' && to !== 'inbox') {
    const acceptanceError = assertRequirementHasAcceptance(item);
    if (acceptanceError !== null) return acceptanceError;
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
    case 'requirement':
      return null;
    case 'defect':
      return null;
    case 'task':
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
