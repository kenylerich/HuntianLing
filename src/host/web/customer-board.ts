/**
 * Customer-shell projection of intake and WorkItems.
 */

import type { BoardService } from '../board/plugin.js';
import type {
  DeliveryEvidenceSummary,
  IntakeCandidateRequirement,
  IntakeClarifyingQuestion,
  IntakeMessage,
  IntakeMktDraft,
  Project,
  ProjectId,
  WorkItem,
} from '../board/types.js';
import {
  customerProgressForWorkItem,
  type CustomerProgressLabel,
} from './customer-progress.js';

export interface CustomerRequirementView {
  readonly id: string;
  readonly kind: 'message' | 'candidate' | 'work-item';
  readonly title: string;
  readonly quotes: readonly string[];
  readonly progress: CustomerProgressLabel;
}

export interface CustomerBoardResponse {
  readonly project: Project;
  readonly sessions: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly messages: readonly IntakeMessage[];
    readonly questions: readonly IntakeClarifyingQuestion[];
    readonly mktDraft: IntakeMktDraft;
  }[];
  readonly questions: readonly IntakeClarifyingQuestion[];
  readonly mktDraft: IntakeMktDraft | null;
  readonly requirements: readonly CustomerRequirementView[];
}

export function createCustomerBoard(board: BoardService, projectId: ProjectId): CustomerBoardResponse {
  const project = board.listProjects().find((item) => item.id === projectId);
  if (project === undefined) throw new Error(`project not found: ${projectId}`);
  const sessions = board.listIntakeSessions({ projectId });
  const bundles = sessions.map((session) => board.getIntakeSessionBundle(session.id));
  const workItems = board.listWorkItems({ projectId });
  const evidenceByWorkItem = new Map<string, DeliveryEvidenceSummary>();
  for (const summary of board.listDeliveryEvidenceSummaries({ projectId })) {
    evidenceByWorkItem.set(summary.workItemId, summary);
  }

  const quotedMessageIds = new Set<string>();
  const workItemIdsFromCandidates = new Set<string>();
  const waitingOnCustomer = bundles.some((bundle) =>
    bundle.questions.some((question) => question.status === 'open'),
  );
  for (const bundle of bundles) {
    for (const candidate of bundle.candidates) {
      if (candidate.workItemId !== null) workItemIdsFromCandidates.add(candidate.workItemId);
      for (const ref of candidate.sourceRefs) {
        if (ref.messageId !== null) quotedMessageIds.add(ref.messageId);
      }
    }
  }

  const requirements: CustomerRequirementView[] = [];
  for (const bundle of bundles) {
    for (const message of bundle.messages) {
      if (message.role !== 'user' || message.kind === 'follow-up-answer' || quotedMessageIds.has(message.id)) continue;
      requirements.push({
        id: message.id,
        kind: 'message',
        title: message.body.slice(0, 80),
        quotes: [message.body],
        progress: waitingOnCustomer ? 'waiting_on_customer' : 'submitted',
      });
    }
    for (const candidate of bundle.candidates) {
      if (candidate.status === 'rejected' || candidate.workItemId !== null) continue;
      requirements.push(requirementFromCandidate(candidate));
    }
  }
  for (const item of workItems) {
    if (item.type === 'task') continue;
    requirements.push(requirementFromWorkItem(item, evidenceByWorkItem.get(item.id)));
  }

  const questions = bundles.flatMap((bundle) => bundle.questions);
  return {
    project,
    sessions: bundles.map((bundle) => ({
      id: bundle.session.id,
      title: bundle.session.title,
      status: bundle.session.status,
      messages: bundle.messages,
      questions: bundle.questions,
      mktDraft: bundle.mktDraft,
    })),
    questions,
    mktDraft: bundles[0]?.mktDraft ?? null,
    requirements,
  };
}

function requirementFromCandidate(candidate: IntakeCandidateRequirement): CustomerRequirementView {
  const quotes = candidate.sourceRefs.map((ref) => ref.quote).filter((quote) => quote.trim() !== '');
  const waiting = candidate.openQuestions.length > 0;
  return {
    id: candidate.id,
    kind: 'candidate',
    title: candidate.title,
    quotes: quotes.length > 0 ? quotes : [candidate.body || candidate.title],
    progress: waiting ? 'waiting_on_customer' : 'submitted',
  };
}

function requirementFromWorkItem(
  item: WorkItem,
  evidence: DeliveryEvidenceSummary | undefined,
): CustomerRequirementView {
  const quotes = item.sourceInput.trim() === '' ? [item.body || item.title] : [item.sourceInput];
  return {
    id: item.id,
    kind: 'work-item',
    title: item.title,
    quotes,
    progress: customerProgressForWorkItem(item.status, evidence, item),
  };
}
