import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { AgentTaskError } from '../../lib/host/agents/types.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCollabService } from '../../lib/host/collab/service.js';
import { ChannelWriteError } from '../../lib/host/collab/types.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(4),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function proposePayload(overrides = {}) {
  return {
    objective: '实现登录壳',
    assigneeRole: 'planner',
    requiredSkills: ['planner.delivery-contract'],
    allowedTools: ['delivery-contract.write'],
    expectedOutput: 'huntianling.delivery-contract.v1',
    checks: ['has-acceptance'],
    ...overrides,
  };
}

function setupWeb(t, extras = {}) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr10-'));
  const board = extras.board ?? createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const collab = extras.collab ?? createCollabService({ board });
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements, collab },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer' },
        ],
      },
    },
  );
  t.after(() => web.stop());
  return { root, board, collab, web };
}

test('a caller records a conversation decision through the conversation API', async (t) => {
  const { web, board, collab } = setupWeb(t);
  const project = board.createProject({ name: 'p' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['可登录'],
  });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const recorded = await json(`${status.url}/api/v1/team/conversations/${conversation.id}/decisions`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: { kind: 'human', role: 'developer' },
      payload: { body: '采用密码登录' },
      refs: { workItemId: item.id },
    }),
  });
  assert.equal(recorded.response.status, 201);
  assert.equal(recorded.payload.type, 'decision.record');
  assert.ok(typeof recorded.payload.payload.decisionId === 'string');
  const decisions = collab.listDecisions(project.id, item.id);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].body, '采用密码登录');
});

test('a caller records a conversation approval through the conversation API', async (t) => {
  const { web, board, collab } = setupWeb(t);
  const project = board.createProject({ name: 'p' });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload(),
  });
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const requested = await json(`${status.url}/api/v1/team/conversations/${conversation.id}/approvals`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: { kind: 'human', role: 'developer' },
      payload: { taskId: proposed.payload.taskId },
    }),
  });
  assert.equal(requested.response.status, 201);
  assert.equal(requested.payload.type, 'approval.request');
  assert.equal(collab.hasPendingApproval(proposed.payload.taskId), true);
  const granted = await json(`${status.url}/api/v1/team/conversations/${conversation.id}/approvals`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: { kind: 'human', role: 'developer' },
      payload: { taskId: proposed.payload.taskId, status: 'granted', reason: '范围已确认' },
    }),
  });
  assert.equal(granted.payload.type, 'approval.granted');
  assert.equal(collab.hasPendingApproval(proposed.payload.taskId), false);
  assert.equal(collab.listApprovals({ taskId: proposed.payload.taskId })[0].status, 'granted');
});

test('board and WorkItem views show unresolved team-chat questions and recorded decisions', async (t) => {
  const { web, board, collab } = setupWeb(t);
  const project = board.createProject({ name: 'p' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['可登录'],
  });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload(),
    refs: { workItemId: item.id },
  });
  collab.postMessage(conversation.id, {
    type: 'task.question',
    from: { kind: 'agent', role: 'planner' },
    payload: { taskId: proposed.payload.taskId, body: '验收标准是哪几条？' },
  });
  const asked = collab.postMessage(conversation.id, {
    type: 'question.ask',
    from: { kind: 'agent', role: 'planner' },
    payload: { body: '是否需要二次验证？' },
    refs: { workItemId: item.id },
  });
  collab.postMessage(conversation.id, {
    type: 'decision.record',
    from: { kind: 'human', role: 'developer' },
    payload: { body: '先不做二次验证' },
    refs: { workItemId: item.id },
  });
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const detail = await json(`${status.url}/api/v1/work-items/${item.id}/board-detail`, { headers: { cookie } });
  assert.equal(detail.payload.unresolvedQuestions.length, 2);
  assert.equal(detail.payload.channelDecisions.length, 1);
  const boardPayload = await json(`${status.url}/api/v1/projects/${project.id}/developer-board`, { headers: { cookie } });
  const progress = boardPayload.payload.progress.items.find((row) => row.id === item.id);
  assert.equal(progress.unresolvedQuestions.length, 2);
  assert.equal(progress.channelDecisions[0].body, '先不做二次验证');
  collab.postMessage(conversation.id, {
    type: 'question.answer',
    from: { kind: 'human', role: 'developer' },
    payload: { body: '不需要', questionId: asked.id },
    inReplyTo: asked.id,
  });
  assert.equal(collab.listUnresolvedQuestions(project.id, item.id).some((row) => row.id === asked.id), false);
});

test('task.split creates child collaboration tasks from a parent', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr10-split-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload(),
  });
  const split = collab.postMessage(conversation.id, {
    type: 'task.split',
    from: { kind: 'human', role: 'developer' },
    payload: {
      taskId: proposed.payload.taskId,
      childObjectives: ['写登录 API', '写登录页'],
    },
  });
  assert.equal(split.payload.childTaskIds.length, 2);
  const children = split.payload.childTaskIds.map((id) => collab.getTask(id));
  assert.equal(children[0].parentTaskId, proposed.payload.taskId);
  assert.equal(children[1].objective, '写登录页');
  assert.equal(collab.getTask(proposed.payload.taskId).status, 'proposed');
  assert.equal(collab.listEvents(conversation.id).some((event) => event.reason === 'split'), true);
});

test('task.merge combines selected tasks into one remaining task', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr10-merge-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const first = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload({ objective: '登录 API' }),
  });
  const second = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload({ objective: '登录页' }),
  });
  const merged = collab.postMessage(conversation.id, {
    type: 'task.merge',
    from: { kind: 'human', role: 'developer' },
    payload: {
      taskIds: [first.payload.taskId, second.payload.taskId],
      objective: '完整登录切片',
    },
  });
  assert.equal(merged.payload.remainingTaskId, first.payload.taskId);
  assert.equal(collab.getTask(first.payload.taskId).objective, '完整登录切片');
  assert.deepEqual(collab.getTask(first.payload.taskId).mergedFromTaskIds, [second.payload.taskId]);
  assert.equal(collab.getTask(second.payload.taskId).status, 'cancelled');
});

test('unknown later catalog types are still rejected at write time', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr10-unknown-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  assert.throws(
    () =>
      collab.postMessage(conversation.id, {
        type: 'review.request',
        from: { kind: 'human', role: 'developer' },
        payload: { body: 'nope' },
      }),
    (error) => error instanceof ChannelWriteError && error.code === 'UNKNOWN_TYPE',
  );
});

test('agent runtime reads selected channel messages before starting a collaboration task and writes conclusions back', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr10-runtime-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const item = board.createWorkItem({
    projectId: project.id,
    type: 'story',
    title: '登录',
    body: '客户能登录',
    acceptance: ['可登录'],
  });
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload(),
    refs: { workItemId: item.id },
  });
  collab.postMessage(conversation.id, {
    type: 'note.chat',
    from: { kind: 'human', role: 'developer' },
    payload: { body: '只做密码登录' },
    refs: { workItemId: item.id },
  });
  collab.postMessage(conversation.id, {
    type: 'note.chat',
    from: { kind: 'human', role: 'developer' },
    payload: { body: '无关闲聊' },
  });
  const agents = createAgentRuntime({ skills: createSkillService() });
  const run = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    input: {
      quotes: [{ text: '客户只看自己的进度', source: 'customer' }],
      goal: 'Customer sees only their progress',
      confirmed: true,
      acceptance: ['customer progress is visible'],
    },
    collaborationTaskId: proposed.payload.taskId,
    collab,
  });
  assert.equal(run.status, 'completed');
  assert.ok(run.channelMessages.some((message) => message.payload.body === '只做密码登录'));
  assert.equal(run.channelMessages.some((message) => message.payload.body === '无关闲聊'), false);
  assert.ok(collab.listMessages(conversation.id).some((message) =>
    message.type === 'progress.update' && String(message.payload.body).includes(run.id),
  ));
});

test('agent runtime refuses to start when the collaboration task has a pending approval', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-cr10-approval-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload(),
  });
  collab.postMessage(conversation.id, {
    type: 'approval.request',
    from: { kind: 'human', role: 'developer' },
    payload: { taskId: proposed.payload.taskId },
  });
  const agents = createAgentRuntime({ skills: createSkillService() });
  assert.throws(
    () =>
      agents.startRun({
        agentId: 'planner',
        executor: 'manual',
        input: {
          quotes: [{ text: '客户只看自己的进度', source: 'customer' }],
          goal: 'Customer sees only their progress',
          confirmed: true,
          acceptance: ['customer progress is visible'],
        },
        collaborationTaskId: proposed.payload.taskId,
        collab,
      }),
    (error) => error instanceof AgentTaskError && error.code === 'VALIDATION' && /approval/.test(error.message),
  );
});

test('customers cannot record decisions, approvals, split, or merge', async (t) => {
  const { web, board, collab } = setupWeb(t);
  const project = board.createProject({ name: 'p' });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload(),
  });
  const status = await web.start();
  const login = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const decision = await json(`${status.url}/api/v1/team/conversations/${conversation.id}/decisions`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { body: 'nope' } }),
  });
  assert.equal(decision.response.status, 403);
  const approval = await json(`${status.url}/api/v1/team/conversations/${conversation.id}/approvals`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { taskId: proposed.payload.taskId } }),
  });
  assert.equal(approval.response.status, 403);
  const split = await json(`${status.url}/api/v1/team/conversations/${conversation.id}/messages`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'task.split',
      payload: { taskId: proposed.payload.taskId, childObjectives: ['a', 'b'] },
    }),
  });
  assert.equal(split.response.status, 403);
});
