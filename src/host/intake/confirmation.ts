import { createHash } from 'node:crypto';

import type { BoardService } from '../board/plugin.js';
import type { IntakeCandidateRequirement, IntakeSessionBundle, WorkItem } from '../board/types.js';

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function candidateScopeRevision(candidate: IntakeCandidateRequirement): string {
  return digest([candidate.id, candidate.sessionId, candidate.projectId, candidate.type,
    candidate.title, candidate.body, candidate.analysis, candidate.design, candidate.acceptance,
    candidate.parentCandidateId, candidate.sourceRefs.map((ref) =>
      [ref.sourceDocumentId, ref.sourceChunkId, ref.messageId, ref.quote, ref.confidence]),
    candidate.openQuestions, candidate.goals, candidate.actors, candidate.scenarios,
    candidate.constraints, candidate.risks, candidate.assumptions]);
}

export function originalWorkItemRevision(item: WorkItem): string {
  return digest({ id: item.id, projectId: item.projectId, type: item.type, parentId: item.parentId,
    title: item.title, body: item.body, sourceInput: item.sourceInput, acceptance: item.acceptance });
}

export function intakeSourceRevision(bundle: IntakeSessionBundle): string {
  return digest([bundle.session.id, bundle.session.projectId,
    bundle.messages.filter((message) => message.role === 'user').map((message) =>
      [message.id, message.role, message.author, message.body, message.kind, message.field, message.sourceDocumentIds]),
    bundle.sourceDocuments.map((document) => [document.id, document.kind, document.name, document.parseStatus,
      document.extractedText, document.chunks.map((chunk) => [chunk.id, chunk.text])])]);
}

export function confirmedRequirementRevision(input: Record<string, unknown>): string {
  return digest(input.sourceApproval);
}

/** Resolves current developer-approved source data; public input flags cannot grant approval. */
export function resolveConfirmedRequirement(board: BoardService, item: WorkItem): Record<string, unknown> {
  const candidate = board.listIntakeCandidates({ projectId: item.projectId })
    .find((row) => row.workItemId === item.id);
  const approval = candidate?.approval;
  if (candidate === undefined || candidate.status !== 'approved' || approval == null) {
    throw new Error('original requirement requires intake approval before planning or implementation');
  }
  const bundle = board.getIntakeSessionBundle(candidate.sessionId);
  if (bundle.session.status === 'rejected' || approval.actorId.trim() === ''
    || approval.candidateRevision !== candidateScopeRevision(candidate)
    || approval.workItemRevision !== originalWorkItemRevision(item)
    || approval.sourceRevision !== intakeSourceRevision(bundle)) {
    throw new Error('original requirement approval is stale; review and approve the current scope');
  }
  const draft = bundle.mktDraft;
  const goals = candidate.goals.filter((value) => value.trim() !== '');
  const actors = candidate.actors.length > 0 ? candidate.actors : draft.actors;
  const scenarios = candidate.scenarios.length > 0 ? candidate.scenarios : draft.scenarios;
  const quotes = candidate.sourceRefs.flatMap((ref) => {
    const message = bundle.messages.find((row) => row.id === ref.messageId && row.role === 'user');
    if (message !== undefined) return [{ text: message.body, source: `intake-message:${message.id}` }];
    const document = bundle.sourceDocuments.find((row) => row.id === ref.sourceDocumentId && row.parseStatus === 'parsed');
    if (document === undefined) return [];
    const text = ref.sourceChunkId === null ? document.extractedText
      : document.chunks.find((chunk) => chunk.id === ref.sourceChunkId)?.text ?? '';
    return [{ text, source: `source-document:${document.id}` }];
  }).filter((quote) => quote.text.trim() !== '');
  const goal = goals[0] ?? draft.goal;
  if (quotes.length === 0 || actors.every((value) => value.trim() === '')
    || scenarios.every((value) => value.trim() === '') || candidate.openQuestions.length > 0
    || draft.openQuestions.length > 0 || item.acceptance.length === 0 || goal.trim() === '') {
    throw new Error('original requirement is incomplete; resolve source quotes, actors, scenarios, questions and acceptance');
  }
  return { quotes, goal, actors, scenarios, constraints: candidate.constraints, nonGoals: draft.nonGoals,
    assumptions: candidate.assumptions, openQuestions: [], confirmed: true, acceptance: [...item.acceptance],
    sourceApproval: { candidateId: candidate.id, sessionId: candidate.sessionId, ...approval } };
}
