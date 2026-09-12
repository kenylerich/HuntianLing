import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createBoardService } from '../../lib/host/board/plugin.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

function pdfWithText(text) {
  const stream = `BT (${text}) Tj ET\n`;
  return new TextEncoder().encode(
    `%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>endobj\n4 0 obj<< /Length ${String(stream.length)} >>stream\n${stream}endstream\nendobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n`,
  );
}

function docxWithText(text) {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:t>${text}</w:t></w:p></w:document>`;
  const name = Buffer.from('word/document.xml');
  const data = Buffer.from(xml);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  return new Uint8Array(Buffer.concat([header, name, data]));
}

function pngBytes() {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function setup(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-intake-extract-'));
  const board = createBoardService(root, options);
  const project = board.createProject({ name: 'p' });
  const session = board.createIntakeSession({ projectId: project.id, title: '登录', submitter: 'po' });
  return { root, board, project, session };
}

test('uploading a PDF stores a source document and extracts text into chunks', () => {
  const { board, session } = setup();
  const source = board.addIntakeSourceDocument(session.id, {
    kind: 'pdf',
    name: 'login.pdf',
    mimeType: 'application/pdf',
    content: pdfWithText('客户必须能用邮箱登录'),
  });
  assert.equal(source.parseStatus, 'parsed');
  assert.match(source.extractedText, /邮箱登录/);
  assert.ok(source.chunks.length > 0);
  assert.equal(source.parseError, '');
});

test('uploading a Word document stores a source document and extracts text into chunks', () => {
  const { board, session } = setup();
  const source = board.addIntakeSourceDocument(session.id, {
    kind: 'word',
    name: 'login.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    content: docxWithText('角色：客户\n场景：邮箱登录\n验收标准：登录后只看自己的需求'),
  });
  assert.equal(source.parseStatus, 'parsed');
  assert.match(source.extractedText, /邮箱登录/);
  assert.ok(source.chunks.some((chunk) => chunk.text.includes('客户')));
});

test('an image with understanding extracts text; without understanding it stays pending', () => {
  const { board, session } = setup();
  const understood = board.addIntakeSourceDocument(session.id, {
    kind: 'image',
    name: 'wireframe.png',
    mimeType: 'image/png',
    content: pngBytes(),
    understanding: '客户必须能用邮箱登录',
  });
  assert.equal(understood.parseStatus, 'parsed');
  assert.match(understood.extractedText, /邮箱登录/);
  const pending = board.addIntakeSourceDocument(session.id, {
    kind: 'image',
    name: 'photo.png',
    mimeType: 'image/png',
    content: pngBytes(),
  });
  assert.equal(pending.parseStatus, 'pending');
  assert.match(pending.parseError, /image understanding or OCR/);
});

test('analysis extracts structured fields and LLM analysis can add Bug candidates', () => {
  const { board, session } = setup({
    intakeLlm: {
      extract() {
        return {
          goals: ['客户能登录'],
          actors: ['客户'],
          scenarios: ['邮箱登录'],
          constraints: ['只看自己的需求'],
          risks: ['登录缺陷导致串数据'],
          assumptions: ['使用邮箱作为账号'],
          openQuestions: ['是否需要 SSO？'],
          acceptance: ['登录后只看自己的需求'],
        };
      },
    },
  });
  board.addIntakeMessage(session.id, {
    role: 'user',
    author: 'po',
    body: '目标：客户能登录\n角色：客户\n场景：邮箱登录\n约束：只看自己的需求\n风险：登录缺陷导致串数据\n假设：使用邮箱作为账号\n未决问题：是否需要 SSO？\n验收标准：登录后只看自己的需求',
  });
  const deterministic = board.analyzeIntakeSession(session.id);
  const epic = deterministic.candidates.find((candidate) => candidate.type === 'epic');
  assert.ok(epic.actors.includes('客户'));
  assert.ok(epic.scenarios.includes('邮箱登录'));
  assert.ok(epic.constraints.includes('只看自己的需求'));
  assert.ok(epic.risks.some((risk) => /缺陷/.test(risk)));
  assert.ok(epic.assumptions.includes('使用邮箱作为账号'));
  assert.ok(deterministic.candidates.some((candidate) => candidate.type === 'bug'));
  assert.ok(epic.sourceRefs.length > 0);

  const llm = board.analyzeIntakeSession(session.id, { mode: 'llm' });
  assert.ok(llm.candidates.some((candidate) => candidate.type === 'bug'));
  assert.ok(llm.candidates[0].goals.includes('客户能登录'));
  assert.match(llm.candidates[0].analysis, /LLM/);
});

test('human approval is still required before candidates become WorkItems', () => {
  const { board, project, session } = setup();
  board.addIntakeMessage(session.id, { role: 'user', body: '需要登录' });
  const analyzed = board.analyzeIntakeSession(session.id);
  assert.equal(analyzed.candidates.every((candidate) => candidate.status === 'draft'), true);
  assert.equal(board.listWorkItems({ projectId: project.id }).length, 0);
  const approved = board.approveIntakeCandidates(session.id, { actorId: 'po' });
  assert.ok(approved.workItems.length > 0);
  assert.equal(approved.candidates.every((candidate) => candidate.status === 'approved'), true);
});

test('LLM analysis fails loud when no extractor is configured', () => {
  const { board, session } = setup();
  board.addIntakeMessage(session.id, { role: 'user', body: '需要登录' });
  assert.throws(
    () => board.analyzeIntakeSession(session.id, { mode: 'llm' }),
    /extractor/,
  );
});

test('customers can upload attachments and run analysis on their own intake sessions', async (t) => {
  const { root, board, project, session } = setup();
  const requirements = createRequirementManagementService(board);
  const hash = createPbkdf2PasswordHash('correct-password', { iterations: 1_000, salt: new Uint8Array(16).fill(3) });
  const web = createWebService(
    { board, requirements },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        users: [{ username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] }],
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
  const html = await fetch(`${status.url}/customer`, { headers: { cookie } }).then((response) => response.text());
  assert.match(html, /附件/);
  assert.match(html, /生成候选需求/);
  const uploaded = await fetch(`${status.url}/api/v1/intake/sessions/${encodeURIComponent(session.id)}/source-documents`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'pdf',
      name: 'login.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from(pdfWithText('客户必须能用邮箱登录')).toString('base64'),
    }),
  });
  assert.equal(uploaded.status, 201);
  const payload = await uploaded.json();
  assert.equal(payload.parseStatus, 'parsed');
  const analyzed = await fetch(`${status.url}/api/v1/intake/sessions/${encodeURIComponent(session.id)}/analyze`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(analyzed.status, 200);
  const bundle = await analyzed.json();
  assert.ok(bundle.candidates.length > 0);
  assert.equal(bundle.candidates.every((candidate) => candidate.status === 'draft'), true);
});
