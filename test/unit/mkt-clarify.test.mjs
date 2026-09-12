import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createCollabService } from '../../lib/host/collab/service.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-mkt-clarify-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const session = board.createIntakeSession({ projectId: project.id, title: '需求对话', submitter: 'cust' });
  return { root, board, project, session };
}

test('a customer message missing required fields produces clarifying questions', () => {
  const { board, session } = setup();
  board.addIntakeMessage(session.id, { role: 'user', body: '我需要一个登录后只看自己需求的界面' });
  const bundle = board.clarifyIntakeSession(session.id);
  const open = bundle.questions.filter((question) => question.status === 'open').map((question) => question.field);
  assert.ok(open.includes('actors'));
  assert.ok(open.includes('scenarios'));
  assert.ok(open.includes('confirm'));
  assert.equal(bundle.mktDraft.tracked, false);
  assert.match(bundle.mktDraft.goal, /登录/);
});

test('structured follow-up answers stay untracked until the customer confirms', () => {
  const { board, session } = setup();
  board.addIntakeMessage(session.id, { role: 'user', body: '我需要登录' });
  board.clarifyIntakeSession(session.id);
  board.answerIntakeFollowUp(session.id, { field: 'actors', value: '客户' });
  const afterActors = board.answerIntakeFollowUp(session.id, { field: 'scenarios', value: '邮箱登录' });
  assert.equal(afterActors.mktDraft.actors.includes('客户'), true);
  assert.equal(afterActors.mktDraft.scenarios.includes('邮箱登录'), true);
  assert.equal(afterActors.mktDraft.confirmed, false);
  assert.equal(afterActors.mktDraft.tracked, false);
  const confirmed = board.answerIntakeFollowUp(session.id, { field: 'confirm', value: '确认' });
  assert.equal(confirmed.mktDraft.confirmed, true);
  assert.equal(confirmed.mktDraft.tracked, true);
  assert.ok(confirmed.mktDraft.quotes.some((quote) => quote.text.includes('登录')));
  assert.equal(confirmed.questions.every((question) => question.status === 'answered'), true);
});

test('a follow-up answer that includes technical design is rejected', () => {
  const { board, session } = setup();
  board.addIntakeMessage(session.id, { role: 'user', body: '我需要登录' });
  board.clarifyIntakeSession(session.id);
  assert.throws(
    () => board.answerIntakeFollowUp(session.id, { field: 'actors', value: '{"technicalDesign":"split CSS"}' }),
    /technicalDesign/,
  );
  assert.equal(board.getIntakeSessionBundle(session.id).mktDraft.actors.length, 0);
});

test('a product question from Agent Channel appears in the customer MKT dialog', () => {
  const { board, project } = setup();
  const collab = createCollabService({ board });
  const conversation = collab.createConversation({ projectId: project.id, title: 'Agent Channel' });
  const asked = collab.postMessage(conversation.id, {
    type: 'customer.question_needed',
    from: { kind: 'agent', role: 'planner' },
    payload: { body: '登录后要看哪些进度？', field: 'scenarios' },
  });
  const bundle = board.getIntakeSessionBundle(asked.payload.mktSessionId);
  assert.equal(bundle.messages[0].kind, 'clarifying-question');
  assert.equal(bundle.messages[0].field, 'scenarios');
  assert.equal(bundle.questions[0].status, 'open');
});

test('customers can list open questions and answer them on their own project', async (t) => {
  const { root, board, project, session } = setup();
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(2) });
  const web = createWebService(
    { board, requirements },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        users: [
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
          { username: 'dev', passwordHash: hash, audience: 'developer' },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const html = await fetch(`${status.url}/customer`, {
    headers: {
      cookie: (await fetch(`${status.url}/api/auth/password/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
      })).headers.get('set-cookie')?.split(';')[0],
    },
  }).then((response) => response.text());
  assert.match(html, /待补充/);
  assert.match(html, /确认跟踪/);

  const login = await fetch(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const posted = await fetch(`${status.url}/api/v1/intake/sessions/${encodeURIComponent(session.id)}/messages`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'user', body: '我需要一个登录后只看自己需求的界面' }),
  });
  assert.equal(posted.status, 201);
  const postedPayload = await posted.json();
  assert.ok(postedPayload.id);
  assert.ok(postedPayload.questions.some((question) => question.status === 'open' && question.field === 'actors'));

  const boardPayload = await fetch(
    `${status.url}/api/v1/projects/${encodeURIComponent(project.id)}/customer-board`,
    { headers: { cookie } },
  ).then((response) => response.json());
  assert.equal(boardPayload.requirements[0].progress, 'waiting_on_customer');
  assert.ok(boardPayload.questions.some((question) => question.status === 'open'));

  const answered = await fetch(`${status.url}/api/v1/intake/sessions/${encodeURIComponent(session.id)}/follow-ups`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ field: 'actors', value: '客户' }),
  });
  assert.equal(answered.status, 200);
  const answeredPayload = await answered.json();
  assert.ok(answeredPayload.mktDraft.actors.includes('客户'));
});
