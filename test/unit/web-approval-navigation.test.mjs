import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCustomerBoard } from '../../lib/host/web/customer-board.js';
import { createDeveloperBoard } from '../../lib/host/web/developer-board.js';

function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-approval-ui-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'Approval review' });
  const session = board.createIntakeSession({ projectId: project.id, title: 'Order cancellation' });
  board.addIntakeMessage(session.id, { role: 'user', body: 'Customers must be able to cancel an unshipped order.' });
  return { board, project, session };
}

test('developer review queue contains only this project unapproved candidates and approval removes them', (t) => {
  const { board, project, session } = setup(t);
  const bundle = board.analyzeIntakeSession(session.id);
  const other = board.createProject({ name: 'Other project' });
  const otherSession = board.createIntakeSession({ projectId: other.id, title: 'Other request' });
  board.addIntakeMessage(otherSession.id, { role: 'user', body: 'Another customer must see another project.' });
  board.analyzeIntakeSession(otherSession.id);
  const rejected = bundle.candidates.at(-1);
  board.updateIntakeCandidate(rejected.id, { status: 'rejected' });
  const before = createDeveloperBoard(board, project.id).collect.candidates;
  assert.ok(before.length > 0);
  assert.ok(before.every(candidate => candidate.projectId === project.id && candidate.status === 'draft'));
  assert.ok(before.every(candidate => candidate.id !== rejected.id));
  assert.ok(before[0].sourceRefs.some(ref => ref.quote.includes('unshipped order')));
  board.approveIntakeCandidates(session.id, { candidateIds: before.map(candidate => candidate.id) });
  assert.deepEqual(createDeveloperBoard(board, project.id).collect.candidates, []);
  assert.ok(createCustomerBoard(board, project.id).requirements.some(item => item.kind === 'work-item'));
  assert.ok(createDeveloperBoard(board, other.id).collect.candidates.length > 0);
});

test('answered customer questions stop blocking candidates even when extraction retained open questions', (t) => {
  const { board, project, session } = setup(t);
  board.clarifyIntakeSession(session.id);
  const bundle = board.analyzeIntakeSession(session.id);
  board.updateIntakeCandidate(bundle.candidates[0].id, { openQuestions: ['Who cancels the order?'] });
  assert.ok(createCustomerBoard(board, project.id).requirements
    .filter(item => item.kind === 'candidate').every(item => item.progress === 'waiting_on_customer'));
  for (const [field, value] of [['goal', 'Cancel orders'], ['actors', 'Customers'], ['scenarios', 'Before shipment'], ['confirm', '确认']]) {
    board.answerIntakeFollowUp(session.id, { field, value });
  }
  const customer = createCustomerBoard(board, project.id);
  assert.ok(customer.questions.every(question => question.status === 'answered'));
  assert.ok(customer.requirements.filter(item => item.kind === 'candidate').every(item => item.progress === 'submitted'));
  assert.ok(!JSON.stringify(customer.requirements).includes('Who cancels the order?'));
});

test('an open question in another intake session does not block a submitted message', (t) => {
  const { board, project, session } = setup(t);
  const other = board.createIntakeSession({ projectId: project.id, title: 'Unanswered request' });
  board.addIntakeMessage(other.id, { role: 'user', body: 'Another request' });
  board.clarifyIntakeSession(other.id);
  const customer = createCustomerBoard(board, project.id);
  const messageId = board.getIntakeSessionBundle(session.id).messages[0].id;
  assert.equal(customer.requirements.find(item => item.id === messageId).progress, 'submitted');
  assert.ok(customer.requirements.some(item => item.progress === 'waiting_on_customer'));
});
