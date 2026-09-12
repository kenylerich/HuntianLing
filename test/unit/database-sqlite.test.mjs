import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BoardStore } from '../../lib/host/board/store.js';
import { createDatabaseService } from '../../lib/host/database/service.js';
import { DatabaseError } from '../../lib/host/database/types.js';

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'huntianling-database-'));
}

test('upper layers use huntianling.database and do not import node:sqlite', () => {
  const board = readFileSync(new URL('../../src/host/board/store.ts', import.meta.url), 'utf8');
  const boardPlugin = readFileSync(new URL('../../src/host/board/plugin.ts', import.meta.url), 'utf8');
  const rootPlugin = readFileSync(new URL('../../src/host/plugin.ts', import.meta.url), 'utf8');
  const web = readFileSync(new URL('../../src/host/web/server.ts', import.meta.url), 'utf8');
  assert.equal(board.includes('node:sqlite'), false);
  assert.equal(boardPlugin.includes('node:sqlite'), false);
  assert.equal(rootPlugin.includes('node:sqlite'), false);
  assert.equal(web.includes('node:sqlite'), false);
  assert.match(boardPlugin, /huntianling\.database/);
  assert.match(rootPlugin, /databasePlugin/);
});

test('local deployments persist through SQLite and record schema version', () => {
  const root = tempRoot();
  const db = createDatabaseService({ workspaceRoot: root });
  assert.equal(db.driver, 'sqlite');
  assert.equal(db.schemaVersion(), 4);
  assert.equal(db.migrate(), 4);
  assert.equal(existsSync(join(root, '.huntianling', 'huntianling.sqlite')), true);
  db.close();
});

test('PostgreSQL and blank config fail loud', () => {
  const root = tempRoot();
  assert.throws(
    () => createDatabaseService({ workspaceRoot: root, config: { driver: 'postgresql' } }),
    (error) => error instanceof DatabaseError && error.code === 'UNSUPPORTED_DRIVER',
  );
  assert.throws(
    () => createDatabaseService({ workspaceRoot: root, config: { maxUploadBytes: 0 } }),
    (error) => error instanceof DatabaseError && error.code === 'INVALID_CONFIG',
  );
  assert.throws(
    () => createDatabaseService({ workspaceRoot: root, config: { allowedMimeTypes: [] } }),
    (error) => error instanceof DatabaseError && error.code === 'INVALID_CONFIG',
  );
});

test('existing JSON board data is imported into database tables', () => {
  const root = tempRoot();
  mkdirSync(join(root, '.huntianling'), { recursive: true });
  writeFileSync(
    join(root, '.huntianling', 'board.json'),
    JSON.stringify({
      schemaVersion: 2,
      projects: [{ id: 'project-1', name: 'p', description: '', roles: [] }],
      cards: [
        {
          id: 'item-1',
          projectId: 'project-1',
          type: 'epic',
          title: '旧数据',
          body: '从 JSON 迁入。',
          analysis: '',
          design: '',
          status: 'inbox',
          priority: null,
          estimate: null,
          assignee: '',
          parentId: null,
          startDate: null,
          dueDate: null,
          acceptance: ['保留来源'],
          acceptanceCriteria: [{ id: 'item-1:ac-1', text: '保留来源' }],
          coversAcceptanceIds: [],
          dependencyIds: [],
          blockedByIds: [],
          evidence: [],
          sourceRequirementId: null,
          sortOrder: 10000,
          claimedRoleId: null,
          claimedBy: null,
          claimedAt: null,
        },
      ],
    }),
  );

  const store = new BoardStore(root);
  assert.equal(store.getWorkItem('item-1')?.title, '旧数据');

  const db = createDatabaseService({ workspaceRoot: root });
  const workItems = db.query('SELECT id, type, status FROM work_items');
  assert.equal(workItems.length, 1);
  assert.equal(workItems[0]?.id, 'item-1');
  assert.equal(workItems[0]?.type, 'epic');
  const criteria = db.query('SELECT criterion_id, text FROM acceptance_criteria');
  assert.equal(criteria.length, 1);
  assert.equal(criteria[0]?.text, '保留来源');
  db.close();
});

test('after import, board reads and writes use the database as the source of truth', () => {
  const root = tempRoot();
  mkdirSync(join(root, '.huntianling'), { recursive: true });
  writeFileSync(
    join(root, '.huntianling', 'board.json'),
    JSON.stringify({
      schemaVersion: 2,
      projects: [{ id: 'project-1', name: 'p', description: '', roles: [] }],
      cards: [
        {
          id: 'item-1',
          projectId: 'project-1',
          type: 'story',
          title: '旧标题',
          body: '正文',
          analysis: '分析',
          design: '设计',
          status: 'inbox',
          priority: null,
          estimate: null,
          assignee: '',
          parentId: null,
          startDate: null,
          dueDate: null,
          acceptance: ['可迁移'],
          acceptanceCriteria: [{ id: 'item-1:ac-1', text: '可迁移' }],
          coversAcceptanceIds: [],
          dependencyIds: [],
          blockedByIds: [],
          evidence: [],
          sourceRequirementId: null,
          sortOrder: 1,
          claimedRoleId: null,
          claimedBy: null,
          claimedAt: null,
        },
      ],
    }),
  );

  const store = new BoardStore(root);
  store.updateWorkItem('item-1', { title: '数据库标题' });
  writeFileSync(
    join(root, '.huntianling', 'board.json'),
    JSON.stringify({
      schemaVersion: 2,
      projects: [{ id: 'project-1', name: 'stale', description: '', roles: [] }],
      cards: [],
    }),
  );

  const reopened = new BoardStore(root);
  assert.equal(reopened.listProjects()[0]?.name, 'p');
  assert.equal(reopened.getWorkItem('item-1')?.title, '数据库标题');
});

test('uploads store metadata in the database and bytes outside it', () => {
  const root = tempRoot();
  const marker = 'UNIQUE-PAYLOAD-MARKER-NOT-IN-SQL';
  const db = createDatabaseService({ workspaceRoot: root });
  const project = 'project-1';
  const stored = db.storeFile({
    projectId: project,
    originalFilename: 'notes.md',
    mimeType: 'text/markdown',
    uploader: 'dev',
    bytes: new TextEncoder().encode(`# notes\n${marker}`),
  });
  assert.equal(stored.originalFilename, 'notes.md');
  assert.equal(stored.mimeType, 'text/markdown');
  assert.equal(stored.uploader, 'dev');
  assert.equal(stored.projectId, project);
  assert.equal(stored.extractedTextStatus, 'extracted');
  assert.equal(typeof stored.sha256, 'string');
  assert.equal(stored.sha256.length, 64);
  assert.equal(stored.extractedTextPath !== null, true);
  const onDisk = readFileSync(join(root, '.huntianling', 'files', stored.storagePath));
  assert.match(onDisk.toString('utf8'), /UNIQUE-PAYLOAD-MARKER-NOT-IN-SQL/);
  const sqliteBytes = readFileSync(join(root, '.huntianling', 'huntianling.sqlite'));
  assert.equal(sqliteBytes.includes(Buffer.from(marker)), false);
  assert.equal(Buffer.from(db.readFileBytes(stored.id)).includes(Buffer.from(marker)), true);
  assert.equal(db.listFiles({ projectId: project }).length, 1);
  db.close();
});

test('files that exceed configured size or type limits are rejected', () => {
  const root = tempRoot();
  const db = createDatabaseService({
    workspaceRoot: root,
    config: { maxUploadBytes: 8, allowedMimeTypes: ['text/plain'] },
  });
  assert.throws(
    () => db.storeFile({
      projectId: 'p',
      originalFilename: 'too-big.txt',
      mimeType: 'text/plain',
      uploader: 'dev',
      bytes: new TextEncoder().encode('123456789'),
    }),
    (error) => error instanceof DatabaseError && error.code === 'FILE_TOO_LARGE',
  );
  assert.throws(
    () => db.storeFile({
      projectId: 'p',
      originalFilename: 'photo.png',
      mimeType: 'image/png',
      uploader: 'dev',
      bytes: new Uint8Array([1, 2, 3]),
    }),
    (error) => error instanceof DatabaseError && error.code === 'FILE_TYPE_NOT_ALLOWED',
  );
  db.close();
});

test('file storage interface can be replaced without MinIO', () => {
  const root = tempRoot();
  const writes = new Map();
  const db = createDatabaseService({
    workspaceRoot: root,
    storage: {
      write(relativePath, bytes) {
        writes.set(relativePath, bytes);
      },
      read(relativePath) {
        const bytes = writes.get(relativePath);
        if (bytes === undefined) throw new Error(`missing ${relativePath}`);
        return bytes;
      },
    },
  });
  const stored = db.storeFile({
    projectId: 'p',
    originalFilename: 'swap.txt',
    mimeType: 'text/plain',
    uploader: 'dev',
    bytes: new TextEncoder().encode('replaced-backend'),
  });
  assert.equal(writes.has(stored.storagePath), true);
  assert.equal(existsSync(join(root, '.huntianling', 'files', stored.storagePath)), false);
  assert.equal(new TextDecoder().decode(db.readFileBytes(stored.id)), 'replaced-backend');
  db.close();
});

test('intake source bytes are stored as files and linked from the document', () => {
  const root = tempRoot();
  const store = new BoardStore(root);
  const project = store.createProject({ name: 'p' });
  const session = store.createIntakeSession({ projectId: project.id, title: '来源' });
  const source = store.addIntakeSourceDocument(session.id, {
    kind: 'markdown',
    name: 'brief.md',
    mimeType: 'text/markdown',
    content: new TextEncoder().encode('# 目标\n必须能上传附件。'),
    extractedText: '# 目标\n必须能上传附件。',
    uploader: 'po',
  });
  assert.equal(typeof source.storedFileId, 'string');
  const db = createDatabaseService({ workspaceRoot: root });
  const stored = db.getFile(source.storedFileId);
  assert.equal(stored?.originalFilename, 'brief.md');
  assert.equal(stored?.uploader, 'po');
  db.close();
});
