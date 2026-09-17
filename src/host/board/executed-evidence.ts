/**
 * Executed delivery evidence: producer, design revision, and customer-visible gates.
 */

import { createHash } from 'node:crypto';

import {
  DELIVERY_EVIDENCE_EXECUTION_KINDS,
  DELIVERY_EVIDENCE_PRODUCERS,
  type DeliveryEvidenceCheck,
  type DeliveryEvidenceExecutionKind,
  type DeliveryEvidenceProducer,
  type DeliveryEvidenceSummary,
  type WorkItem,
} from './types.js';

export type WorkItemRevisionFields = Pick<
  WorkItem,
  'analysis' | 'design' | 'acceptance' | 'acceptanceCriteria'
>;

export function workItemDesignRevision(item: WorkItemRevisionFields): string {
  const payload = [
    item.analysis,
    item.design,
    item.acceptance.join('\n'),
    item.acceptanceCriteria.map((criterion) => `${criterion.id}:${criterion.text}`).join('\n'),
  ].join('\u001f');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function resolveEvidenceProducer(value: unknown): DeliveryEvidenceProducer {
  if (typeof value === 'string' && DELIVERY_EVIDENCE_PRODUCERS.includes(value as DeliveryEvidenceProducer)) {
    return value as DeliveryEvidenceProducer;
  }
  return 'manual';
}

export function resolveEvidenceExecutionKind(
  value: unknown,
  producer: DeliveryEvidenceProducer,
): DeliveryEvidenceExecutionKind {
  if (
    typeof value === 'string'
    && DELIVERY_EVIDENCE_EXECUTION_KINDS.includes(value as DeliveryEvidenceExecutionKind)
  ) {
    return value as DeliveryEvidenceExecutionKind;
  }
  if (producer === 'generator') return 'self_check';
  if (producer === 'evaluator') return 'demonstration';
  return 'manual';
}

export function isExecutedProducer(producer: DeliveryEvidenceProducer): boolean {
  return producer === 'evaluator' || producer === 'ci' || producer === 'scm';
}

const verifiedChecks = new WeakMap<object, () => boolean>();

/** Attach a host-record lookup to one check; JSON cannot carry this capability. */
export function withExecutionVerification(check: DeliveryEvidenceCheck, verify: () => boolean): DeliveryEvidenceCheck {
  const copy = structuredClone(check);
  const original = JSON.stringify(copy);
  verifiedChecks.set(copy, () => JSON.stringify(copy) === original && verify());
  return copy;
}

export function hasVerifiableExecutionProvenance(
  check: Pick<DeliveryEvidenceCheck, 'links' | 'evidenceIds'>,
): boolean {
  try {
    return verifiedChecks.get(check)?.() === true;
  } catch {
    // Missing or unreadable execution artifacts cannot authorize delivery.
    return false;
  }
}

export function coerceEvidenceExecutionKind(
  check: Pick<DeliveryEvidenceCheck, 'executionKind' | 'producer' | 'links' | 'evidenceIds'>,
): DeliveryEvidenceExecutionKind {
  const kind = resolveEvidenceExecutionKind(check.executionKind, check.producer);
  if (kind !== 'executed') return kind;
  if (hasVerifiableExecutionProvenance(check)) return 'executed';
  if (check.producer === 'generator') return 'self_check';
  if (check.producer === 'evaluator' || check.producer === 'manual' || check.producer === 'tool') {
    return 'demonstration';
  }
  return 'manual';
}

export function isStaleDeliveryEvidence(
  summary: DeliveryEvidenceSummary | null | undefined,
  item: WorkItemRevisionFields,
): boolean {
  if (summary === undefined || summary === null) return false;
  const recorded = summary.designRevision ?? '';
  if (recorded === '') return false;
  return recorded !== workItemDesignRevision(item);
}

export function isExecutedPassingCheck(check: DeliveryEvidenceCheck): boolean {
  return check.status === 'passing'
    && coerceEvidenceExecutionKind(check) === 'executed'
    && isExecutedProducer(check.producer)
    && hasVerifiableExecutionProvenance(check);
}

export function hasExecutedDeliveryEvidence(
  summary: DeliveryEvidenceSummary | null | undefined,
  item?: WorkItemRevisionFields,
): boolean {
  if (summary === undefined || summary === null) return false;
  if (item !== undefined && isStaleDeliveryEvidence(summary, item)) return false;
  if (summary.checks.some(check => check.required && check.status !== 'passing')) return false;
  if (summary.checks.some(check => check.required
    && (check.producer === 'ci' || check.producer === 'evaluator') && !isExecutedPassingCheck(check))) return false;
  return summary.checks.some(check => check.required
    && (check.producer === 'ci' || check.producer === 'evaluator') && isExecutedPassingCheck(check));
}

export function mergeChecksByProducer(
  existing: readonly DeliveryEvidenceCheck[],
  incoming: readonly DeliveryEvidenceCheck[],
  producer: DeliveryEvidenceProducer,
): readonly DeliveryEvidenceCheck[] {
  return [
    ...existing.filter((check) => check.producer !== producer),
    ...incoming,
  ];
}

export function staleExecutedChecks(
  checks: readonly DeliveryEvidenceCheck[],
): readonly DeliveryEvidenceCheck[] {
  return checks.map((check) => {
    if (check.executionKind !== 'executed' || check.status !== 'passing') return check;
    return {
      ...check,
      status: 'blocked',
      reason: 'stale after design revision',
    };
  });
}
