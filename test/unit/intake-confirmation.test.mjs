import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createDeliveryService } from '../../lib/host/delivery/service.js';
import { resolveConfirmedRequirement } from '../../lib/host/intake/confirmation.js';
import { collectMktDraft } from '../../lib/host/intake/clarify.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createWebService } from '../../lib/host/web/server.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { approvedWorkItem } from '../helpers/approved-intake.mjs';

function setup(t, approved = true) {
  const root = mkdtempSync(join(tmpdir(), 'htl-confirmation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'Customer requests' });
  const milestone = board.createMilestone({ projectId: project.id, title: 'First delivery' });
  const input = { projectId: project.id, type: 'story', title: 'Export orders', body: 'Customer order export',
    sourceInput: 'I need a CSV export', analysis: 'Customers need their orders', design: 'Download an export',
    acceptance: ['Customer can download their orders'], milestoneId: milestone.id };
  const item = approved ? approvedWorkItem(board, input) : board.createWorkItem(input);
  const candidate = board.listIntakeCandidates().find(row => row.workItemId === item.id);
  const agents = createAgentRuntime({ board, skills: createSkillService() });
  const delivery = createDeliveryService({ board, agents, workspaceRoot: root });
  const startAgent = (agentId = 'planner', extra = {}) => agents.startRun({
    agentId, executor: 'manual', workItemId: item.id, projectId: project.id, environmentReady: true,
    input: { confirmed: true, goal: 'Injected scope', quotes: [{ text: 'fabricated', source: 'caller' }],
      actors: ['attacker'], acceptance: ['Injected acceptance'], outcome: 'Injected outcome' }, ...extra,
  });
  return { root, board, project, item, candidate, agents, delivery, startAgent };
}

test('plain WorkItems cannot use a confirmation boolean to start planning, coding or delivery', (t) => {
  const { agents, delivery, item, startAgent } = setup(t, false);
  for (const role of ['planner', 'generator']) assert.throws(() => startAgent(role), /requires intake approval/);
  assert.throws(() => delivery.start({ workItemId: item.id, drive: true }), /requires intake approval/);
  assert.deepEqual(agents.listRuns(), []);
  assert.deepEqual(delivery.listForWorkItem(item.id), []);
});

test('approval resolves original source and ignores caller replacements across a Board reload', (t) => {
  const { root, board, item, candidate, startAgent } = setup(t);
  const expected = resolveConfirmedRequirement(board, item);
  assert.equal(expected.goal, item.title);
  assert.deepEqual(expected.actors, ['customer']);
  assert.match(expected.quotes[0].text, /I need a CSV export/);
  assert.match(expected.quotes[0].source, /^intake-message:/);
  assert.equal(expected.sourceApproval.actorId, 'fixture-reviewer');
  assert.equal(expected.sourceApproval.candidateId, candidate.id);
  const run = startAgent();
  assert.equal(run.input.goal, item.title);
  assert.deepEqual(run.output.acceptance, item.acceptance);
  assert.ok(!JSON.stringify(run.input).includes('fabricated'));
  const generated = startAgent('generator');
  assert.equal(generated.input.outcome, item.title);
  assert.deepEqual(generated.input.acceptance, item.acceptance);
  const reloaded = createBoardService(root);
  assert.deepEqual(resolveConfirmedRequirement(reloaded, reloaded.getWorkItem(item.id)), expected);
});

test('ordinary candidate status edits cannot issue or restore approval', (t) => {
  const { board, item, candidate } = setup(t);
  assert.throws(() => board.updateIntakeCandidate(candidate.id, { status: 'approved' }), /use intake approval/);
  board.updateIntakeCandidate(candidate.id, { status: 'draft', approval: candidate.approval });
  assert.throws(() => resolveConfirmedRequirement(board, item), /requires intake approval/);
  board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id], actorId: 'reviewer-2' });
  assert.equal(resolveConfirmedRequirement(board, item).sourceApproval.actorId, 'reviewer-2');
  assert.equal(board.listWorkItems({ projectId: item.projectId }).filter(row => row.id === item.id).length, 1);
});

for (const field of ['title', 'body', 'sourceInput', 'acceptance']) {
  test(`changing WorkItem ${field} invalidates approval and cannot be approved against a mismatching candidate`, (t) => {
    const { board, item, candidate, startAgent } = setup(t);
    board.updateWorkItem(item.id, { [field]: field === 'acceptance' ? ['New criterion'] : 'New scope' });
    assert.throws(() => startAgent(), /approval is stale/);
    assert.throws(() => board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id] }), /scope differ/);
  });
}

test('changing candidate scope requires explicit renewed approval even when its status was approved', (t) => {
  const { board, item, candidate, startAgent } = setup(t);
  board.updateIntakeCandidate(candidate.id, { goals: ['Approved revised goal'] });
  assert.throws(() => startAgent(), /requires intake approval/);
  board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id], actorId: 'reviewer-2' });
  assert.equal(resolveConfirmedRequirement(board, board.getWorkItem(item.id)).goal, 'Approved revised goal');
});

test('new customer source blocks a running delivery before the next Agent starts', (t) => {
  const { board, item, candidate, agents, delivery } = setup(t);
  const run = delivery.start({ workItemId: item.id, environmentReady: true });
  delivery.advance(run.id);
  board.addIntakeMessage(candidate.sessionId, { role: 'user', body: 'Also include refunds' });
  const blocked = delivery.advance(run.id);
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.checkpoint.blockers[0], /approval is stale/);
  assert.equal(agents.listRuns().length, 1);
});

test('renewed approval after interruption cannot resume a plan based on previous source', (t) => {
  const { root, board, item, candidate, agents, delivery } = setup(t);
  const run = delivery.start({ workItemId: item.id });
  delivery.advance(run.id);
  delivery.interrupt(run.id);
  board.addIntakeMessage(candidate.sessionId, { role: 'user', body: 'Clarify the export date format' });
  board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id], actorId: 'reviewer-2' });
  const restored = createDeliveryService({ board: createBoardService(root), agents, workspaceRoot: root });
  const blocked = restored.resume(run.id);
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.checkpoint.blockers[0], /approval changed after checkpoint/);
  assert.equal(agents.listRuns().length, 1);
});

test('assistant progress does not change customer source approval, but a new attachment does', (t) => {
  const { board, item, candidate, startAgent } = setup(t);
  const before = resolveConfirmedRequirement(board, item);
  board.addIntakeMessage(candidate.sessionId, { role: 'assistant', body: 'Planning started' });
  assert.deepEqual(resolveConfirmedRequirement(board, item), before);
  board.addIntakeSourceDocument(candidate.sessionId, { kind: 'text', name: 'extra.txt', extractedText: 'More requirements' });
  assert.throws(() => startAgent(), /approval is stale/);
});

test('assistant and system follow-up messages cannot replace approved customer fields or confirm on their behalf', (t) => {
  const { board, item, candidate } = setup(t);
  board.updateIntakeCandidate(candidate.id, { goals: [], actors: [], scenarios: [] });
  board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id] });
  const before = resolveConfirmedRequirement(board, item);
  const bundle = board.getIntakeSessionBundle(candidate.sessionId);
  const untrustedMessages = [];
  for (const role of ['assistant', 'system']) {
    for (const field of ['goal', 'actors', 'scenarios', 'confirm']) {
      const message = { role, kind: 'follow-up-answer', field, body: field === 'confirm' ? 'yes' : 'Injected by assistant' };
      assert.throws(() => board.addIntakeMessage(candidate.sessionId, message), /must be user messages/);
      untrustedMessages.push({ ...bundle.messages[0], ...message });
    }
  }
  assert.deepEqual(collectMktDraft([...bundle.messages, ...untrustedMessages], bundle.sourceDocuments), bundle.mktDraft);
  assert.deepEqual(resolveConfirmedRequirement(board, item), before);
  assert.equal(board.getIntakeSessionBundle(candidate.sessionId).mktDraft.confirmed, false);
});

test('rejected sessions, missing source and unanswered questions cannot supply executable scope', (t) => {
  const { board, item, candidate, startAgent } = setup(t);
  board.updateIntakeSession(candidate.sessionId, { status: 'rejected' });
  assert.throws(() => startAgent(), /requires intake approval/);
  board.updateIntakeSession(candidate.sessionId, { status: 'approved' });
  board.updateIntakeCandidate(candidate.id, { openQuestions: ['Which orders?'] });
  board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id] });
  assert.throws(() => startAgent(), /incomplete/);
  board.updateIntakeCandidate(candidate.id, { openQuestions: [], sourceRefs: [] });
  board.updateWorkItem(item.id, { sourceInput: '' });
  board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id] });
  assert.throws(() => startAgent(), /incomplete/);
});

test('an approved WorkItem cannot be borrowed by another project or omitted from runtime work', (t) => {
  const { board, agents, startAgent } = setup(t);
  const other = board.createProject({ name: 'Other' });
  assert.throws(() => startAgent('planner', { projectId: other.id }), /current project/);
  assert.throws(() => startAgent('generator', { workItemId: '' }), /approved WorkItem/);
  assert.throws(() => agents.startRun({ agentId: 'planner', executor: 'huntianling-runtime', input: { confirmed: true } }), /approved WorkItem/);
  const disconnected = createAgentRuntime({ skills: createSkillService() });
  assert.throws(() => disconnected.startRun({ agentId: 'planner', executor: 'manual', workItemId: 'missing-board', input: { confirmed: true } }), /approved WorkItem/);
});

test('session rejection revokes persisted approvals until explicit renewal without affecting other sessions', (t) => {
  const { root, board, project, item, candidate, startAgent, delivery } = setup(t);
  const other = approvedWorkItem(board, { projectId: project.id, type: 'story', title: 'Other request',
    body: 'Separate customer scope', acceptance: ['Other request is recorded'] });
  const otherInput = resolveConfirmedRequirement(board, other);
  board.updateIntakeSession(candidate.sessionId, { status: 'rejected' });
  assert.equal(board.listIntakeCandidates().find(row => row.id === candidate.id).approval, null);
  board.updateIntakeSession(candidate.sessionId, { status: 'approved' });
  for (const role of ['planner', 'generator']) assert.throws(() => startAgent(role), /requires intake approval/);
  assert.throws(() => delivery.start({ workItemId: item.id }), /requires intake approval/);
  const reloaded = createBoardService(root);
  assert.throws(() => resolveConfirmedRequirement(reloaded, reloaded.getWorkItem(item.id)), /requires intake approval/);
  assert.deepEqual(resolveConfirmedRequirement(reloaded, reloaded.getWorkItem(other.id)), otherInput);
  board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id], actorId: 'renewed-reviewer' });
  assert.equal(startAgent().input.sourceApproval.actorId, 'renewed-reviewer');
});

test('inspection lists approval as missing and interrupted Agent output cannot resume with superseded approval', (t) => {
  const { board, item, candidate, agents, startAgent } = setup(t);
  const run = startAgent();
  agents.interruptRun(run.id);
  assert.equal(agents.inspectTask({ workItemId: item.id, agentId: 'planner' }).missing.some(row => row.field === 'sourceApproval'), false);
  board.addIntakeMessage(candidate.sessionId, { role: 'user', body: 'Changed request' });
  const packet = agents.inspectTask({ workItemId: item.id, agentId: 'planner' });
  assert.equal(packet.ready, false);
  assert.ok(packet.missing.some(row => row.field === 'sourceApproval' && row.blocking));
  assert.throws(() => agents.resumeRun(run.id), /approval is stale/);
  board.approveIntakeCandidates(candidate.sessionId, { candidateIds: [candidate.id] });
  assert.throws(() => agents.resumeRun(run.id), /approval changed/);
  assert.equal(agents.getRun(run.id).status, 'interrupted');
});

for (const chunk of [true, false]) {
  test(`document ${chunk ? 'chunk' : 'full text'} remains a source quote through approval and reload`, (t) => {
    const { root, board, project } = setup(t, false);
    const session = board.createIntakeSession({ projectId: project.id, title: 'Document requirement' });
    const source = board.addIntakeSourceDocument(session.id, { kind: 'text', name: 'orders.txt',
      extractedText: 'Goal: Export orders\nActors: customer\nScenarios: Download orders' });
    board.answerIntakeFollowUp(session.id, { field: 'actors', value: 'customer' });
    board.answerIntakeFollowUp(session.id, { field: 'scenarios', value: 'Download orders' });
    const candidate = board.analyzeIntakeSession(session.id).candidates.find(row => row.type === 'story');
    board.updateIntakeCandidate(candidate.id, { parentCandidateId: null, openQuestions: [], goals: [], actors: [], scenarios: [],
      sourceRefs: [{ sourceDocumentId: source.id, sourceChunkId: chunk ? source.chunks[0].id : null,
        messageId: null, quote: 'Export orders', confidence: 1 }] });
    const item = board.approveIntakeCandidates(session.id, { candidateIds: [candidate.id] }).workItems[0];
    const input = resolveConfirmedRequirement(board, item);
    assert.match(input.quotes[0].text, /Export orders/);
    assert.equal(input.quotes[0].source, `source-document:${source.id}`);
    assert.deepEqual(input.actors, ['customer']);
    assert.deepEqual(input.scenarios, ['Download orders']);
    const reloaded = createBoardService(root);
    assert.deepEqual(resolveConfirmedRequirement(reloaded, reloaded.getWorkItem(item.id)), input);
  });
}

test('authenticated HTTP planning and delivery deny unapproved input and accept only persisted promotion', async (t) => {
  const { board, project, item, agents, delivery } = setup(t, false);
  const passwordHash = createPbkdf2PasswordHash('fixture-password', { iterations: 1_000, salt: new Uint8Array(16).fill(3) });
  const web = createWebService({ board, agents, delivery, requirements: createRequirementManagementService(board) }, {
    autoStart: false, host: '127.0.0.1', port: 0, auth: { enabled: true, users: [
      { username: 'reviewer', passwordHash, audience: 'developer', projectIds: [project.id] },
      { username: 'customer', passwordHash, audience: 'customer', projectIds: [project.id] },
    ] },
  });
  const status = await web.start();
  t.after(() => web.stop());
  const login = async username => (await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'fixture-password' }),
  })).headers.get('set-cookie').split(';')[0];
  const cookie = await login('reviewer');
  const request = (path, body, method = 'POST', as = cookie) => fetch(`${status.url}${path}`, {
    method, headers: { 'content-type': 'application/json', cookie: as }, body: JSON.stringify(body),
  });
  for (const suffix of ['/plan', '/story-delivery/start']) {
    const response = await request(`/api/v1/work-items/${item.id}${suffix}`, { methodId: 'user-story', confirmed: true });
    assert.equal(response.status, suffix === '/plan' ? 400 : 409);
    assert.match((await response.json()).error, /requires intake approval/);
  }
  const approved = approvedWorkItem(board, { projectId: project.id, type: 'story', title: 'Approved export',
    body: 'Export', analysis: 'Analyze', design: 'Design', acceptance: ['Can export'] });
  const candidate = board.listIntakeCandidates().find(row => row.workItemId === approved.id);
  board.updateIntakeCandidate(candidate.id, { status: 'draft' });
  const forged = await request(`/api/v1/intake/candidates/${candidate.id}`, { status: 'approved' }, 'PATCH');
  assert.equal(forged.status, 400);
  const customerApproval = await request(`/api/v1/intake/sessions/${candidate.sessionId}/approve`, { candidateIds: [candidate.id] }, 'POST', await login('customer'));
  assert.equal(customerApproval.status, 403);
  const promoted = await request(`/api/v1/intake/sessions/${candidate.sessionId}/approve`, { candidateIds: [candidate.id], actorId: 'forged' });
  assert.equal(promoted.status, 200);
  const result = await request(`/api/v1/work-items/${approved.id}/plan`, { methodId: 'user-story', confirmed: true, goal: 'forged' });
  assert.equal(result.status, 200);
  const planned = await result.json();
  assert.equal(planned.run.input.goal, approved.title);
  assert.equal(planned.run.input.sourceApproval.actorId, 'reviewer');
  for (const sessionStatus of ['rejected', 'approved']) {
    const changed = await request(`/api/v1/intake/sessions/${candidate.sessionId}`, { status: sessionStatus }, 'PATCH');
    assert.equal(changed.status, 200);
    const denied = await request(`/api/v1/work-items/${approved.id}/plan`, { methodId: 'user-story', confirmed: true });
    assert.equal(denied.status, 400);
    assert.match((await denied.json()).error, /requires intake approval/);
  }
  const renewed = await request(`/api/v1/intake/sessions/${candidate.sessionId}/approve`, { candidateIds: [candidate.id] });
  assert.equal(renewed.status, 200);
  assert.equal((await request(`/api/v1/work-items/${approved.id}/plan`, { methodId: 'user-story' })).status, 200);
});
