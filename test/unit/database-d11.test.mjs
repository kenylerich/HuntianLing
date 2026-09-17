import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { BoardStore } from '../../lib/host/board/store.js';
import { createDatabaseService } from '../../lib/host/database/service.js';
import { toPostgresPlaceholders } from '../../lib/host/database/postgres.js';
import { DatabaseError } from '../../lib/host/database/types.js';

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'huntianling-d11-'));
}

function sqliteBackedPostgresClient() {
  const db = new DatabaseSync(':memory:');
  return {
    query(sql, params = []) {
      const text = String(sql).replace(/\$\d+/g, '?');
      const trimmed = text.trim();
      if (trimmed.length === 0) return { rows: [], rowCount: 0 };
      if (/^(BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|DROP)\b/i.test(trimmed)) {
        db.exec(trimmed);
        return { rows: [], rowCount: 0 };
      }
      const stmt = db.prepare(trimmed);
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(trimmed)) {
        const result = stmt.run(...params);
        return { rows: [], rowCount: Number(result.changes) };
      }
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length };
    },
    end() {
      db.close();
    },
  };
}

function postgresService(root, extras = {}) {
  return createDatabaseService({
    workspaceRoot: root,
    config: {
      driver: 'postgresql',
      postgresUrl: 'postgres://huntianling@127.0.0.1/huntianling',
    },
    postgresClient: sqliteBackedPostgresClient(),
    ...extras,
  });
}

test('local deployments keep SQLite when no driver is configured', () => {
  const root = tempRoot();
  const db = createDatabaseService({ workspaceRoot: root });
  assert.equal(db.driver, 'sqlite');
  assert.equal(existsSync(join(root, '.huntianling', 'huntianling.sqlite')), true);
  db.close();
});

test('missing PostgreSQL connection settings fail loud at load', () => {
  const root = tempRoot();
  assert.throws(
    () => createDatabaseService({ workspaceRoot: root, config: { driver: 'postgresql' } }),
    (error) =>
      error instanceof DatabaseError &&
      error.code === 'INVALID_CONFIG' &&
      error.message.includes('postgresUrl is required'),
  );
  assert.throws(
    () => createDatabaseService({
      workspaceRoot: root,
      config: { driver: 'postgresql', postgresUrl: '   ' },
    }),
    (error) => error instanceof DatabaseError && error.code === 'INVALID_CONFIG',
  );
  assert.throws(
    () => createDatabaseService({
      workspaceRoot: root,
      config: { driver: 'postgresql', postgresUrl: 'mysql://localhost/db' },
    }),
    (error) =>
      error instanceof DatabaseError &&
      error.code === 'INVALID_CONFIG' &&
      error.message.includes('postgres://'),
  );
});

test('PostgreSQL connection failure does not leak the URL', () => {
  const root = tempRoot();
  const secret = 'super-secret-password';
  assert.throws(
    () => createDatabaseService({
      workspaceRoot: root,
      config: {
        driver: 'postgresql',
        postgresUrl: `postgres://huntianling:${secret}@127.0.0.1:1/huntianling`,
      },
    }),
    (error) =>
      error instanceof DatabaseError &&
      error.code === 'CONNECTION' &&
      error.message.includes(secret) === false,
  );
});

test('team deployments select PostgreSQL through huntianling.database config', () => {
  const root = tempRoot();
  const db = postgresService(root);
  assert.equal(db.driver, 'postgresql');
  assert.equal(db.schemaVersion(), 4);
  assert.equal(db.migrate(), 4);
  db.close();
});

test('schema migrations and version tracking work on PostgreSQL', () => {
  assert.equal(toPostgresPlaceholders('SELECT * FROM t WHERE a = ? AND b = ?'), 'SELECT * FROM t WHERE a = $1 AND b = $2');
  const root = tempRoot();
  const db = postgresService(root);
  const versions = db.query('SELECT version FROM schema_migrations ORDER BY version');
  assert.deepEqual(versions.map((row) => Number(row.version)), [1, 2, 3, 4]);
  db.close();
});

test('board reads and writes persist through PostgreSQL as the source of truth', () => {
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
  const db = postgresService(root);
  const store = new BoardStore(root, { database: db });
  assert.equal(store.getWorkItem('item-1')?.title, '旧标题');
  store.updateWorkItem('item-1', { title: 'PostgreSQL 标题' });
  const workItems = db.query('SELECT id, type, status FROM work_items');
  assert.equal(workItems.length, 1);
  assert.equal(workItems[0]?.id, 'item-1');
  const reopened = new BoardStore(root, { database: db });
  assert.equal(reopened.getWorkItem('item-1')?.title, 'PostgreSQL 标题');
  db.close();
});

test('large file bytes stay outside the database on PostgreSQL', () => {
  const root = tempRoot();
  const marker = 'UNIQUE-PG-PAYLOAD-MARKER-NOT-IN-SQL';
  const db = postgresService(root);
  const stored = db.storeFile({
    projectId: 'project-1',
    originalFilename: 'notes.md',
    mimeType: 'text/markdown',
    uploader: 'dev',
    bytes: new TextEncoder().encode(`# notes\n${marker}`),
  });
  const onDisk = readFileSync(join(root, '.huntianling', 'files', stored.storagePath));
  assert.match(onDisk.toString('utf8'), /UNIQUE-PG-PAYLOAD-MARKER-NOT-IN-SQL/);
  const rows = db.query('SELECT original_filename, sha256, extracted_text_status FROM stored_files WHERE id = ?', [
    stored.id,
  ]);
  assert.equal(rows[0]?.original_filename, 'notes.md');
  assert.equal(String(rows[0]?.sha256 ?? '').includes(marker), false);
  assert.equal(Buffer.from(db.readFileBytes(stored.id)).includes(Buffer.from(marker)), true);
  db.close();
});

const liveUrl = process.env.HUNTIANLING_POSTGRES_URL;
test('live PostgreSQL round-trip', { skip: liveUrl === undefined || liveUrl.trim() === '' }, () => {
  const root = tempRoot();
  const db = createDatabaseService({
    workspaceRoot: root,
    config: { driver: 'postgresql', postgresUrl: liveUrl },
  });
  try {
    assert.equal(db.driver, 'postgresql');
    assert.equal(db.schemaVersion(), 4);
    const id = `d11-${Date.now()}`;
    db.saveBoardSnapshot({
      schemaVersion: 2,
      projects: [{ id, name: 'live', description: '', roles: [] }],
      teamMembers: [],
      milestones: [],
      deliverySlices: [],
      workflowSummaries: [],
      deliveryEvidenceSummaries: [],
      intakeSessions: [],
      intakeMessages: [],
      intakeSourceDocuments: [],
      intakeCandidates: [],
      auditEvents: [],
      cards: [],
    });
    assert.equal(db.loadBoardSnapshot()?.projects[0]?.id, id);
  } finally {
    db.close();
  }
});
