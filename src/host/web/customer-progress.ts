/**
 * Customer-safe progress labels. Delivered requires executed evidence.
 */

import {
  hasExecutedDeliveryEvidence,
  type WorkItemRevisionFields,
} from '../board/executed-evidence.js';
import type { DeliveryEvidenceSummary, WorkItem, WorkItemStatus } from '../board/types.js';

export const CUSTOMER_PROGRESS_LABELS = [
  'submitted',
  'waiting_on_customer',
  'in_analysis',
  'in_development',
  'delivered',
] as const;

export type CustomerProgressLabel = (typeof CUSTOMER_PROGRESS_LABELS)[number];

const ANALYSIS_STATUSES: readonly WorkItemStatus[] = [
  'analyzing',
  'designing',
  'triaged',
  'planned',
  'ready',
];

const DEVELOPMENT_STATUSES: readonly WorkItemStatus[] = [
  'in_progress',
  'in_review',
  'verifying',
  'gates_passing',
];

export { hasExecutedDeliveryEvidence };

export function customerProgressForWorkItem(
  status: WorkItemStatus,
  evidence: DeliveryEvidenceSummary | null | undefined,
  item?: WorkItemRevisionFields,
): CustomerProgressLabel {
  if (status === 'delivered') {
    return hasExecutedDeliveryEvidence(evidence, item) ? 'delivered' : 'in_development';
  }
  if (DEVELOPMENT_STATUSES.includes(status)) return 'in_development';
  if (ANALYSIS_STATUSES.includes(status)) return 'in_analysis';
  if (status === 'inbox') return 'submitted';
  return 'submitted';
}

export function customerProgressForWorkItemRecord(
  item: Pick<WorkItem, 'status'> & WorkItemRevisionFields,
  evidence: DeliveryEvidenceSummary | null | undefined,
): CustomerProgressLabel {
  return customerProgressForWorkItem(item.status, evidence, item);
}
