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
  if (producer === 'evaluator' || producer === 'ci' || producer === 'scm') return 'executed';
  return 'manual';
}

export function isExecutedProducer(producer: DeliveryEvidenceProducer): boolean {
  return producer === 'evaluator' || producer === 'ci' || producer === 'scm';
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
    && check.executionKind === 'executed'
    && isExecutedProducer(check.producer);
}

export function hasExecutedDeliveryEvidence(
  summary: DeliveryEvidenceSummary | null | undefined,
  item?: WorkItemRevisionFields,
): boolean {
  if (summary === undefined || summary === null) return false;
  if (item !== undefined && isStaleDeliveryEvidence(summary, item)) return false;
  return summary.checks.some(isExecutedPassingCheck);
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
