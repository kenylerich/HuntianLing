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

function emptyPdf() {
  return new TextEncoder().encode(
    '%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n',
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

function llmPayload(fields) {
  return JSON.stringify({
    choices: [{ message: { content: JSON.stringify(fields) } }],
  });
}

function recordingTransport() {
  const calls = [];
  const transport = (request) => {
    calls.push(request);
    if (request.url.includes('/ocr')) {
      return { status: 200, body: JSON.stringify({ text: '客户必须能用邮箱登录' }) };
    }
    if (request.url.includes('/chat/completions')) {
      return {
        status: 200,
        body: llmPayload({
          goals: ['客户能登录'],
          actors: ['客户'],
          scenarios: ['邮箱登录'],
          constraints: ['只看自己的需求'],
          risks: ['登录缺陷导致串数据'],
          assumptions: ['使用邮箱作为账号'],
          openQuestions: ['是否需要 SSO？'],
          acceptance: ['登录后只看自己的需求'],
        }),
      };
    }
    return { status: 500, body: `unexpected ${request.url}` };
  };
  return { calls, transport };
}

function setup(transport, env) {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-intake-hosted-'));
  const board = createBoardService(root, {
    intake: {
      ocrUrl: 'https://ocr.example/v1/ocr',
      llmUrl: 'https://api.example/v1/chat/completions',
      llmModel: 'demo-model',
    },
    hosted: transport,
    env,
  });
  const project = board.createProject({ name: 'p' });
  const session = board.createIntakeSession({ projectId: project.id, title: '登录', submitter: 'po' });
  return { root, board, project, session };
}

test('an image extracts through configured hosted OCR without a per-test understanding stub', () => {
  const { calls, transport } = recordingTransport();
  const { board, session } = setup(transport, { HUNTIANLING_OCR_TOKEN: 'ocr-secret' });
  const source = board.addIntakeSourceDocument(session.id, {
    kind: 'image',
    name: 'photo.png',
    mimeType: 'image/png',
    content: pngBytes(),
  });
  assert.equal(source.parseStatus, 'parsed');
  assert.match(source.extractedText, /邮箱登录/);
  assert.equal(calls[0].headers.Authorization, 'Bearer ocr-secret');
  assert.equal(JSON.stringify(source).includes('ocr-secret'), false);
});

test('a PDF with no extractable text falls back to hosted OCR', () => {
  const { transport } = recordingTransport();
  const { board, session } = setup(transport, { HUNTIANLING_OCR_TOKEN: 'ocr-secret' });
  const source = board.addIntakeSourceDocument(session.id, {
    kind: 'pdf',
    name: 'scan.pdf',
    mimeType: 'application/pdf',
    content: emptyPdf(),
  });
  assert.equal(source.parseStatus, 'parsed');
  assert.match(source.extractedText, /邮箱登录/);
});

test('a Word document still extracts without OCR', () => {
  const { calls, transport } = recordingTransport();
  const { board, session } = setup(transport, { HUNTIANLING_OCR_TOKEN: 'ocr-secret' });
  const source = board.addIntakeSourceDocument(session.id, {
    kind: 'word',
    name: 'login.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    content: docxWithText('角色：客户\n场景：邮箱登录'),
  });
  assert.equal(source.parseStatus, 'parsed');
  assert.match(source.extractedText, /邮箱登录/);
  assert.equal(calls.length, 0);
});

test('an image without OCR configuration stays pending with a parse error', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-intake-no-ocr-'));
  const board = createBoardService(root, { env: {} });
  const project = board.createProject({ name: 'p' });
  const session = board.createIntakeSession({ projectId: project.id, title: '登录', submitter: 'po' });
  const pending = board.addIntakeSourceDocument(session.id, {
    kind: 'image',
    name: 'photo.png',
    mimeType: 'image/png',
    content: pngBytes(),
  });
  assert.equal(pending.parseStatus, 'pending');
  assert.match(pending.parseError, /image understanding or OCR/);
});

test('mode llm uses a configured extractor without injecting a test stub', () => {
  const { calls, transport } = recordingTransport();
  const { board, session } = setup(transport, {
    HUNTIANLING_OCR_TOKEN: 'ocr-secret',
    HUNTIANLING_INTAKE_LLM_TOKEN: 'llm-secret',
  });
  board.addIntakeMessage(session.id, { role: 'user', author: 'po', body: '需要登录' });
  const llm = board.analyzeIntakeSession(session.id, { mode: 'llm' });
  assert.ok(llm.candidates[0].goals.includes('客户能登录'));
  assert.ok(llm.candidates.some((candidate) => candidate.type === 'bug'));
  assert.match(llm.candidates[0].analysis, /LLM/);
  const completion = calls.find((call) => call.url.includes('/chat/completions'));
  assert.equal(completion.headers.Authorization, 'Bearer llm-secret');
  assert.equal(JSON.stringify(llm).includes('llm-secret'), false);
  assert.equal(JSON.stringify(llm).includes('ocr-secret'), false);
});

test('mode llm still fails loud when no extractor is configured', () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-intake-no-llm-'));
  const board = createBoardService(root, { env: {} });
  const project = board.createProject({ name: 'p' });
  const session = board.createIntakeSession({ projectId: project.id, title: '登录', submitter: 'po' });
  board.addIntakeMessage(session.id, { role: 'user', body: '需要登录' });
  assert.throws(
    () => board.analyzeIntakeSession(session.id, { mode: 'llm' }),
    /extractor/,
  );
});

test('hosted credentials are supplied at call time or from the environment and are never persisted', () => {
  const { transport } = recordingTransport();
  const { board, session } = setup(transport, {});
  const failed = board.addIntakeSourceDocument(session.id, {
    kind: 'image',
    name: 'photo.png',
    mimeType: 'image/png',
    content: pngBytes(),
  });
  assert.equal(failed.parseStatus, 'failed');
  assert.match(failed.parseError, /OCR token is required/);
});

test('human approval is still required before candidates become WorkItems', () => {
  const { transport } = recordingTransport();
  const { board, project, session } = setup(transport, {
    HUNTIANLING_INTAKE_LLM_TOKEN: 'llm-secret',
  });
  board.addIntakeMessage(session.id, { role: 'user', body: '需要登录' });
  const analyzed = board.analyzeIntakeSession(session.id, { mode: 'llm' });
  assert.equal(analyzed.candidates.every((candidate) => candidate.status === 'draft'), true);
  assert.equal(board.listWorkItems({ projectId: project.id }).length, 0);
  const approved = board.approveIntakeCandidates(session.id, { actorId: 'po' });
  assert.ok(approved.workItems.length > 0);
});

test('customers can upload attachments and run llm analysis on their own intake sessions', async (t) => {
  const { transport } = recordingTransport();
  const { root, board, project, session } = setup(transport, {
    HUNTIANLING_OCR_TOKEN: 'ocr-secret',
    HUNTIANLING_INTAKE_LLM_TOKEN: 'llm-secret',
  });
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
  const analyzed = await fetch(`${status.url}/api/v1/intake/sessions/${encodeURIComponent(session.id)}/analyze`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'llm' }),
  });
  assert.equal(analyzed.status, 200);
  const bundle = await analyzed.json();
  assert.ok(bundle.candidates.length > 0);
  assert.equal(bundle.candidates.every((candidate) => candidate.status === 'draft'), true);
  assert.ok(bundle.candidates[0].goals.includes('客户能登录'));
  assert.equal(JSON.stringify(bundle).includes('llm-secret'), false);
});
