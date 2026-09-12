/**
 * Persist Generator self-check and Evaluator criterion evidence onto a WorkItem.
 */

import type { BoardService } from '../board/plugin.js';
import {
  mergeChecksByProducer,
  workItemDesignRevision,
} from '../board/executed-evidence.js';
import type { DeliveryEvidenceCheck, WorkItemId } from '../board/types.js';

export function persistGeneratorSelfCheck(
  board: BoardService,
  workItemId: string,
  runId: string,
): void {
  const item = board.getWorkItem(workItemId as WorkItemId);
  if (item === undefined) return;
  const revision = workItemDesignRevision(item);
  const existing = board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
  const existingChecks = existing?.checks ?? [];
  const check: DeliveryEvidenceCheck = {
    id: 'generator-self-check',
    area: 'evidence',
    title: 'Generator self-check',
    status: 'passing',
    required: false,
    reason: 'Generator self-check is not acceptance',
    evidenceIds: [runId],
    acceptanceCriterionIds: [],
    links: [],
    producer: 'generator',
    executionKind: 'self_check',
    designRevision: revision,
  };
  board.updateDeliveryEvidenceSummary(item.id, {
    checks: mergeChecksByProducer(existingChecks, [check], 'generator'),
  });
}

export function persistEvaluatorEvidence(
  board: BoardService,
  workItemId: string,
  runId: string,
  output: unknown,
): void {
  const item = board.getWorkItem(workItemId as WorkItemId);
  if (item === undefined) return;
  const record = asObject(output);
  const criteria = Array.isArray(record.criteria) ? record.criteria : [];
  const revision = workItemDesignRevision(item);
  const existing = board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
  const existingChecks = existing?.checks ?? [];
  const existingProvenance = existing?.provenanceLinks ?? [];
  const checks: DeliveryEvidenceCheck[] = criteria.map((row, index) => {
    const criterion = asObject(row);
    const id = typeof criterion.id === 'string' && criterion.id !== ''
      ? criterion.id
      : `criterion-${String(index + 1)}`;
    const passed = criterion.result === 'pass';
    return {
      id: `evaluator:${id}`,
      area: 'acceptance',
      title: id,
      status: passed ? 'passing' : 'failing',
      required: true,
      reason: typeof criterion.evidence === 'string' ? criterion.evidence : 'evaluator',
      evidenceIds: [runId],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: revision,
    };
  });
  if (checks.length === 0) {
    checks.push({
      id: 'evaluator:missing',
      area: 'acceptance',
      title: 'Evaluator evidence',
      status: 'missing',
      required: true,
      reason: 'Evaluator produced no criterion evidence',
      evidenceIds: [runId],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'evaluator',
      executionKind: 'executed',
      designRevision: revision,
    });
  }
  board.updateDeliveryEvidenceSummary(item.id, {
    checks: mergeChecksByProducer(existingChecks, checks, 'evaluator'),
    provenanceLinks: [
      ...existingProvenance.filter((link) => link.id !== 'evaluator-run'),
      {
        kind: 'evidence-record',
        id: 'evaluator-run',
        label: `evaluator ${runId}`,
        url: null,
        acceptanceCriterionIds: [],
      },
    ],
    designRevision: revision,
  });
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
