/** Creates an explicitly promoted fixture, never an acceptance-grade execution record. */
export function approvedWorkItem(board, input) {
  const parent = input.parentId == null ? null : board.listIntakeCandidates().find(row => row.workItemId === input.parentId);
  if (input.parentId != null && parent == null) throw new Error('fixture parent must be created through intake approval');
  const session = parent == null ? board.createIntakeSession({ projectId: input.projectId, title: input.title })
    : board.getIntakeSessionBundle(parent.sessionId).session;
  if (parent == null) board.addIntakeMessage(session.id, { role: 'user', author: 'fixture-customer',
    body: `Goal: ${input.title}\nActors: customer\nScenarios: verify the requested behavior\n${input.sourceInput ?? input.body ?? input.title}` });
  const bundle = parent == null ? board.analyzeIntakeSession(session.id) : board.getIntakeSessionBundle(session.id);
  const candidate = bundle.candidates.find((row) => row.type === (input.type ?? 'story') && row.workItemId === null);
  if (candidate === undefined) throw new Error(`fixture has no ${input.type} candidate`);
  board.updateIntakeCandidate(candidate.id, { parentCandidateId: parent?.id ?? null, title: input.title,
    body: input.body ?? '', analysis: input.analysis ?? '', design: input.design ?? '',
    acceptance: input.acceptance ?? [], openQuestions: [] });
  const approved = board.approveIntakeCandidates(session.id, { candidateIds: [candidate.id], actorId: 'fixture-reviewer' });
  const itemId = approved.candidates.find(row => row.id === candidate.id).workItemId;
  const item = approved.workItems.find(row => row.id === itemId);
  const { projectId: _projectId, type: _type, title: _title, body: _body, acceptance: _acceptance,
    sourceInput: _sourceInput, parentId: _parentId, status, ...metadata } = input;
  const updated = board.updateWorkItem(item.id, metadata);
  return status === undefined ? updated : board.transitionWorkItem(item.id, status);
}
