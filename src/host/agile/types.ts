/**
 * Agile methodology — type definitions.
 *
 * These types are the shape contract for the Service Definition in
 * ./plugin.ts. Future implementations consume them; this skeleton only
 * publishes the contract so other capability seams can be planned against it.
 *
 * Branded ids follow the AGENTS.md rule that opaque cross-boundary ids must
 * be nominal, not bare `string`. We declare them locally rather than
 * importing `dsh-brand` from the host harness, so that the bundle stays
 * self-contained and the harness can still rebrand ids at the wire.
 *
 * @mode declaration
 * @param payload keys not declared here must carry `@dshScopeScan unsupported`
 */

// --- Branded ids ---------------------------------------------------------

declare const _brand: unique symbol;

/** Nominal brand helper. Subtypes `string` so existing call sites keep working. */
export type Branded<T extends string> = string & { readonly [_brand]: T };

/** A requirement submission id, opaque and stable across sessions. */
export type RequirementId = Branded<'RequirementId'>;

/** A workflow instance id, scoped to a single requirement run. */
export type WorkflowRunId = Branded<'WorkflowRunId'>;

// --- Domain shapes -------------------------------------------------------

/**
 * One collected requirement. The intake captures what is being asked for,
 * the analysis/design notes produced during refinement, and stable
 * acceptance criteria that child work items can cover.
 */
export interface Requirement {
  readonly id: RequirementId;
  readonly title: string;
  readonly submittedBy: string;
  readonly submittedAt: number;
  readonly analysis: string;
  readonly design: string;
  readonly acceptanceCriteria: readonly RequirementAcceptanceCriterion[];
  // TODO: priority, tags, linked epic, source channel, backing WorkItem id.
}

export interface RequirementAcceptanceCriterion {
  readonly id: string;
  readonly text: string;
}

/**
 * The states a workflow run moves through. Closed union: every consumer
 * MUST switch on discriminant tags and end with `assertNever`.
 */
export type WorkflowState =
  | { readonly kind: 'collected' }
  | { readonly kind: 'analyzing' }
  | { readonly kind: 'designing' }
  | { readonly kind: 'triaged' }
  | { readonly kind: 'planned' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'in_progress' }
  | { readonly kind: 'in_review' }
  | { readonly kind: 'verifying' }
  | { readonly kind: 'gates_passing' }
  | { readonly kind: 'delivered' }
  | { readonly kind: 'rejected'; readonly reason: string };

// --- Service event payloads ---------------------------------------------

/** Emitted when the intake produces a new Requirement. */
export interface RequirementSubmitted {
  readonly requirement: Requirement;
}
