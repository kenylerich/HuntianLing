import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCollabService } from '../../lib/host/collab/service.js';
import { ChannelWriteError } from '../../lib/host/collab/types.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createWebService } from '../../lib/host/web/server.js';

function boardRoot() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-collab-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'Channel' });
  return { board, project };
}

function handoffPayload(kind, receiverRole) {
  return {
    handoffKind: kind,
    receiverRole,
    requiredSkills: ['planner.delivery-contract'],
    allowedTools: ['delivery-contract.write'],
    outputSchema: 'huntianling.delivery-contract.v1',
    checks: ['has-acceptance'],
  };
}

test('unknown message types are rejected at write time', () => {
  const { board, project } = boardRoot();
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

test('note.chat does not change WorkItem status', () => {
  const { board, project } = boardRoot();
  const item = board.createWorkItem({
    projectId: project.id,
    title: '需求',
    body: '正文',
    type: 'story',
    acceptance: ['可验收'],
  });
  const before = board.getWorkItem(item.id).status;
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  collab.postMessage(conversation.id, {
    type: 'note.chat',
    from: { kind: 'human', role: 'developer' },
    payload: { body: '讨论一下' },
    refs: { workItemId: item.id },
  });
  assert.equal(board.getWorkItem(item.id).status, before);
});

test('MKT to Planner to Generator to Evaluator handoffs change state and owner', () => {
  const { board, project } = boardRoot();
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const sequence = [
    ['collect_complete', 'planner', 'mkt'],
    ['design_ready', 'generator', 'planner'],
    ['implement', 'generator', 'planner'],
    ['evaluate', 'evaluator', 'generator'],
  ];
  const owners = [];
  for (const [kind, receiver, sender] of sequence) {
    const requested = collab.postMessage(conversation.id, {
      type: 'handoff.request',
      from: { kind: 'agent', role: sender },
      payload: handoffPayload(kind, receiver),
    });
    const accepted = collab.postMessage(conversation.id, {
      type: 'handoff.accept',
      from: { kind: 'agent', role: receiver },
      payload: { taskId: requested.payload.taskId },
    });
    const task = collab.getTask(accepted.payload.taskId);
    assert.equal(task.status, 'in_progress');
    assert.equal(task.ownerRole, receiver);
    owners.push(task.ownerRole);
  }
  assert.deepEqual(owners, ['planner', 'generator', 'generator', 'evaluator']);
  assert.ok(collab.listEvents(conversation.id).every((event) => event.accepted === true));
});

function proposePayload(overrides = {}) {
  return {
    objective: '实现登录壳',
    assigneeRole: 'generator',
    requiredSkills: ['generator.implement'],
    allowedTools: ['implementation.write'],
    expectedOutput: 'huntianling.implementation-record.v1',
    checks: ['typecheck'],
    inputs: ['delivery-contract'],
    priority: 'p1',
    ...overrides,
  };
}

test('a structured message creates a collaboration task with requester, assignee, and context tags', () => {
  const { board, project } = boardRoot();
  const item = board.createWorkItem({
    projectId: project.id,
    title: '登录',
    body: '客户能登录',
    type: 'story',
    acceptance: ['可登录'],
  });
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload({ dueMilestoneId: 'm1', branchId: 'htl/login' }),
    refs: { workItemId: item.id, branchId: 'htl/login', ciRunId: 'ci-1' },
  });
  const task = collab.getTask(proposed.payload.taskId);
  assert.equal(task.requester, 'developer');
  assert.equal(task.assignee, 'generator');
  assert.equal(task.assigneeKind, 'agent');
  assert.deepEqual(task.inputs, ['delivery-contract']);
  assert.equal(task.priority, 'p1');
  assert.equal(task.contextTags.workItemId, item.id);
  assert.equal(task.contextTags.branchId, 'htl/login');
  assert.equal(task.contextTags.ciRunId, 'ci-1');
  assert.equal(collab.listOpenTasks(project.id, item.id).length, 1);
});

test('accept decline question answer transfer block unblock complete and cancel update status and events', () => {
  const { board, project } = boardRoot();
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload(),
  });
  const taskId = proposed.payload.taskId;
  collab.postMessage(conversation.id, {
    type: 'task.accept',
    from: { kind: 'agent', role: 'generator' },
    payload: { taskId },
  });
  assert.equal(collab.getTask(taskId).status, 'accepted');
  collab.postMessage(conversation.id, {
    type: 'task.question',
    from: { kind: 'agent', role: 'generator' },
    payload: { taskId, body: '验收标准是哪几条？' },
  });
  assert.equal(collab.getTask(taskId).status, 'waiting_for_input');
  collab.postMessage(conversation.id, {
    type: 'task.answer',
    from: { kind: 'human', role: 'developer' },
    payload: { taskId, body: '客户能登录。' },
  });
  assert.equal(collab.getTask(taskId).status, 'in_progress');
  collab.postMessage(conversation.id, {
    type: 'task.block',
    from: { kind: 'agent', role: 'generator' },
    payload: { taskId, body: '缺少环境' },
  });
  assert.equal(collab.getTask(taskId).status, 'blocked');
  assert.deepEqual(collab.getTask(taskId).blockers, ['缺少环境']);
  collab.postMessage(conversation.id, {
    type: 'task.unblock',
    from: { kind: 'human', role: 'developer' },
    payload: { taskId },
  });
  assert.equal(collab.getTask(taskId).status, 'in_progress');
  collab.postMessage(conversation.id, {
    type: 'task.transfer',
    from: { kind: 'human', role: 'developer' },
    payload: {
      taskId,
      sendingRole: 'generator',
      receiverRole: 'evaluator',
      reason: '需要独立评价',
      transferredContext: '实现已完成',
      expectedNextAction: '跑验收',
      requiredEvidence: ['typecheck'],
      unresolvedQuestions: ['覆盖率门槛'],
    },
  });
  assert.equal(collab.getTask(taskId).ownerRole, 'evaluator');
  collab.postMessage(conversation.id, {
    type: 'task.complete',
    from: { kind: 'agent', role: 'evaluator' },
    payload: { taskId },
  });
  assert.equal(collab.getTask(taskId).status, 'completed');
  const other = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload({ objective: '另一条' }),
  });
  collab.postMessage(conversation.id, {
    type: 'task.decline',
    from: { kind: 'agent', role: 'generator' },
    payload: { taskId: other.payload.taskId },
  });
  assert.equal(collab.getTask(other.payload.taskId).status, 'rejected');
  assert.ok(collab.listEvents(conversation.id).some((event) => event.reason === 'transferred'));
  assert.equal(collab.listOpenTasks(project.id).length, 0);
});

test('human.stop cancels the active collaboration task', () => {
  const { board, project } = boardRoot();
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const proposed = collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: {
      objective: '实现登录壳',
      assigneeRole: 'generator',
      requiredSkills: ['generator.implement'],
      allowedTools: ['implementation.write'],
      expectedOutput: 'huntianling.implementation-record.v1',
      checks: ['typecheck'],
    },
  });
  collab.postMessage(conversation.id, {
    type: 'human.stop',
    from: { kind: 'human', role: 'developer' },
    payload: { taskId: proposed.payload.taskId },
  });
  assert.equal(collab.getTask(proposed.payload.taskId).status, 'cancelled');
});

test('customer.question_needed writes MKT dialog without channel notes', () => {
  const { board, project } = boardRoot();
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  collab.postMessage(conversation.id, {
    type: 'note.chat',
    from: { kind: 'agent', role: 'planner' },
    payload: { body: '内部讨论不要给客户' },
  });
  const asked = collab.postMessage(conversation.id, {
    type: 'customer.question_needed',
    from: { kind: 'agent', role: 'planner' },
    payload: { body: '登录后要看哪些进度？' },
  });
  const bundle = board.getIntakeSessionBundle(asked.payload.mktSessionId);
  assert.equal(bundle.messages[0].body, '登录后要看哪些进度？');
  assert.equal(
    bundle.messages.some((message) => message.body.includes('内部讨论')),
    false,
  );
});

test('customer cannot open the developer channel', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-collab-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(3),
  });
  const web = createWebService(
    { board, requirements },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [{ username: 'cust', passwordHash: hash, audience: 'customer' }],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const login = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const page = await fetch(`${status.url}/developer/channel`, { headers: { cookie } });
  assert.equal(page.status, 403);
  const api = await fetch(`${status.url}/api/v1/team/conversations`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: 'x', title: 'nope' }),
  });
  assert.equal(api.status, 403);
});

test('developer board shows open collaboration tasks and customers cannot create them', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-tasks-'));
  const board = createBoardService(root);
  const requirements = createRequirementManagementService(board);
  const collab = createCollabService({ board });
  const project = board.createProject({ name: '协作' });
  const item = board.createWorkItem({
    projectId: project.id,
    title: '登录',
    body: '客户能登录',
    type: 'story',
    acceptance: ['可登录'],
  });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  collab.postMessage(conversation.id, {
    type: 'task.propose',
    from: { kind: 'human', role: 'developer' },
    payload: proposePayload(),
    refs: { workItemId: item.id },
  });
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(9) });
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
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const devLogin = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'correct-password' }),
  });
  const devCookie = devLogin.headers.get('set-cookie')?.split(';')[0];
  const boardPayload = await fetch(`${status.url}/api/v1/projects/${project.id}/developer-board`, {
    headers: { cookie: devCookie },
  }).then((response) => response.json());
  const progress = boardPayload.progress.items.find((row) => row.id === item.id);
  assert.equal(progress.collaborationTasks.length, 1);
  assert.equal(progress.collaborationTasks[0].objective, '实现登录壳');
  const created = await fetch(`${status.url}/api/v1/team/conversations/${conversation.id}/tasks`, {
    method: 'POST',
    headers: { cookie: devCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: { kind: 'human', role: 'developer' },
      payload: proposePayload({ objective: '第二条' }),
    }),
  });
  assert.equal(created.status, 201);

  const custLogin = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const custCookie = custLogin.headers.get('set-cookie')?.split(';')[0];
  const denied = await fetch(`${status.url}/api/v1/team/conversations/${conversation.id}/tasks`, {
    method: 'POST',
    headers: { cookie: custCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ payload: proposePayload() }),
  });
  assert.equal(denied.status, 403);
});
