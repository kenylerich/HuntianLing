import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createDatabaseService } from '../../lib/host/database/service.js';
import { createWebService } from '../../lib/host/web/server.js';

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

test('project file APIs store uploads under the workspace and reject oversize files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-web-files-'));
  const database = createDatabaseService({
    workspaceRoot: root,
    config: { maxUploadBytes: 64, allowedMimeTypes: ['text/plain'] },
  });
  const board = createBoardService(root, { database });
  const requirements = createRequirementManagementService(board);
  const project = board.createProject({ name: 'HuntianLing' });
  const web = createWebService(
    { board, requirements, database },
    { autoStart: false, host: '127.0.0.1', port: 0 },
  );
  await web.start();
  const base = web.url();

  const created = await json(`${base}/api/v1/projects/${project.id}/files`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      originalFilename: 'note.txt',
      mimeType: 'text/plain',
      contentBase64: Buffer.from('hello-file').toString('base64'),
      uploader: 'dev',
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.originalFilename, 'note.txt');
  assert.equal(created.payload.sha256.length, 64);

  const listed = await json(`${base}/api/v1/projects/${project.id}/files`);
  assert.equal(listed.payload.files.length, 1);

  const content = await fetch(`${base}/api/v1/files/${created.payload.id}/content`);
  assert.equal(content.status, 200);
  assert.equal(await content.text(), 'hello-file');

  const rejected = await json(`${base}/api/v1/projects/${project.id}/files`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      originalFilename: 'huge.txt',
      mimeType: 'text/plain',
      contentBase64: Buffer.from('x'.repeat(80)).toString('base64'),
      uploader: 'dev',
    }),
  });
  assert.equal(rejected.response.status, 400);
  assert.equal(rejected.payload.code, 'FILE_TOO_LARGE');

  await web.stop();
  database.close();
});
