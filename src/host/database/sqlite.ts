/**
 * SQLite adapter for `huntianling.database` using `node:sqlite`.
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { extractStoredFile } from '../intake/extract.js';
import { LocalFileStorage, resolveUnderRoot, storageSegment } from './files.js';
import {
  DatabaseError,
  type BoardDocument,
  type DatabaseExecuteResult,
  type DatabaseService,
  type ExtractedTextStatus,
  type FileStorageBackend,
  type ResolvedDatabaseConfig,
  type SqlValue,
  type StoreFileInput,
  type StoredAuthEvent,
  type StoredAuthUser,
  type StoredOAuthIdentity,
  type StoredOAuthState,
  type StoredCredential,
  type StoredFile,
  type StoredFileFilter,
} from './types.js';

export const DATABASE_SCHEMA_VERSION = 4;

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS board_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_slices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_work_item_id TEXT NOT NULL,
  milestone_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_summaries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_evidence_summaries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intake_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intake_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intake_source_documents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  stored_file_id TEXT,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intake_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  parent_id TEXT,
  milestone_id TEXT,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS work_item_links (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id, kind)
);
CREATE TABLE IF NOT EXISTS acceptance_criteria (
  work_item_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (work_item_id, criterion_id)
);
CREATE TABLE IF NOT EXISTS work_item_acceptance_coverage (
  work_item_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  PRIMARY KEY (work_item_id, criterion_id)
);
CREATE TABLE IF NOT EXISTS stored_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  uploader TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text_status TEXT NOT NULL,
  extracted_text_path TEXT,
  created_at INTEGER NOT NULL
);
`;

const MIGRATION_V2 = `
CREATE TABLE IF NOT EXISTS credentials (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  rotated_at INTEGER,
  disabled_at INTEGER,
  updated_at INTEGER NOT NULL
);
`;

const MIGRATION_V3 = `
CREATE TABLE IF NOT EXISTS auth_users (
  username TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  audience TEXT NOT NULL,
  project_ids TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  request_source TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

const MIGRATION_V4 = `
ALTER TABLE auth_events ADD COLUMN region TEXT;
CREATE TABLE IF NOT EXISTS oauth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  unionid TEXT,
  email TEXT,
  profile TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  region TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_verifier TEXT,
  bind_user_id TEXT,
  created_at INTEGER NOT NULL
);
`;

const MIGRATIONS: readonly { readonly version: number; readonly sql: string }[] = [
  { version: 1, sql: MIGRATION_V1 },
  { version: 2, sql: MIGRATION_V2 },
  { version: 3, sql: MIGRATION_V3 },
  { version: 4, sql: MIGRATION_V4 },
];

export interface SqliteDatabaseOptions {
  readonly workspaceRoot: string;
  readonly config: ResolvedDatabaseConfig;
  readonly storage?: FileStorageBackend;
}

export class SqliteDatabase implements DatabaseService {
  readonly driver = 'sqlite' as const;
  private readonly db: DatabaseSync;
  private readonly storage: FileStorageBackend;
  private readonly config: ResolvedDatabaseConfig;
  private closed = false;

  constructor(options: SqliteDatabaseOptions) {
    this.config = options.config;
    const sqlitePath = resolveSqlitePath(options.workspaceRoot, options.config.sqlitePath);
    if (sqlitePath !== ':memory:') {
      mkdirSync(dirname(sqlitePath), { recursive: true });
    }
    this.db = new DatabaseSync(sqlitePath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.storage =
      options.storage ??
      new LocalFileStorage(resolveUnderRoot(options.workspaceRoot, options.config.storageRoot, 'storage root'));
    this.migrate();
  }

  schemaVersion(): number {
    const row = this.db
      .prepare('SELECT MAX(version) AS version FROM schema_migrations')
      .get() as { version: number | null } | undefined;
    return row?.version ?? 0;
  }

  migrate(): number {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `);
    const current = this.schemaVersion();
    for (const migration of MIGRATIONS) {
      if (migration.version <= current) continue;
      this.db.exec('BEGIN');
      try {
        this.db.exec(migration.sql);
        this.db
          .prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)')
          .run(migration.version, Date.now());
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }
    return this.schemaVersion();
  }

  execute(sql: string, params: readonly SqlValue[] = []): DatabaseExecuteResult {
    const result = this.db.prepare(sql).run(...toSqlParams(params));
    return { changes: Number(result.changes) };
  }

  query(sql: string, params: readonly SqlValue[] = []): readonly Record<string, SqlValue>[] {
    const rows = this.db.prepare(sql).all(...toSqlParams(params));
    return rows.map(asSqlRow);
  }

  loadBoardSnapshot(): BoardDocument | undefined {
    const row = this.db.prepare('SELECT snapshot FROM board_state WHERE id = 1').get() as
      | { snapshot: string }
      | undefined;
    if (row === undefined) return undefined;
    return JSON.parse(row.snapshot) as BoardDocument;
  }

  saveBoardSnapshot(snapshot: BoardDocument): void {
    const payload = JSON.stringify(snapshot);
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM projects').run();
      this.db.prepare('DELETE FROM team_members').run();
      this.db.prepare('DELETE FROM milestones').run();
      this.db.prepare('DELETE FROM delivery_slices').run();
      this.db.prepare('DELETE FROM workflow_summaries').run();
      this.db.prepare('DELETE FROM delivery_evidence_summaries').run();
      this.db.prepare('DELETE FROM intake_sessions').run();
      this.db.prepare('DELETE FROM intake_messages').run();
      this.db.prepare('DELETE FROM intake_source_documents').run();
      this.db.prepare('DELETE FROM intake_candidates').run();
      this.db.prepare('DELETE FROM audit_events').run();
      this.db.prepare('DELETE FROM work_items').run();
      this.db.prepare('DELETE FROM work_item_links').run();
      this.db.prepare('DELETE FROM acceptance_criteria').run();
      this.db.prepare('DELETE FROM work_item_acceptance_coverage').run();
      this.db.prepare(`
        INSERT INTO board_state(id, schema_version, snapshot, updated_at)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          schema_version = excluded.schema_version,
          snapshot = excluded.snapshot,
          updated_at = excluded.updated_at
      `).run(snapshot.schemaVersion, payload, Date.now());

      const insertProject = this.db.prepare('INSERT INTO projects(id, name, payload) VALUES (?, ?, ?)');
      for (const project of snapshot.projects) {
        insertProject.run(requireText(project, 'id', 'project'), requireText(project, 'name', 'project'), JSON.stringify(project));
      }

      const insertMember = this.db.prepare('INSERT INTO team_members(id, project_id, payload) VALUES (?, ?, ?)');
      for (const member of snapshot.teamMembers) {
        insertMember.run(
          requireText(member, 'id', 'team member'),
          requireText(member, 'projectId', 'team member'),
          JSON.stringify(member),
        );
      }

      const insertMilestone = this.db.prepare(
        'INSERT INTO milestones(id, project_id, status, payload) VALUES (?, ?, ?, ?)',
      );
      for (const milestone of snapshot.milestones) {
        insertMilestone.run(
          requireText(milestone, 'id', 'milestone'),
          requireText(milestone, 'projectId', 'milestone'),
          requireText(milestone, 'status', 'milestone'),
          JSON.stringify(milestone),
        );
      }

      const insertSlice = this.db.prepare(
        'INSERT INTO delivery_slices(id, project_id, parent_work_item_id, milestone_id, payload) VALUES (?, ?, ?, ?, ?)',
      );
      for (const slice of snapshot.deliverySlices) {
        insertSlice.run(
          requireText(slice, 'id', 'delivery slice'),
          requireText(slice, 'projectId', 'delivery slice'),
          requireText(slice, 'parentWorkItemId', 'delivery slice'),
          requireText(slice, 'milestoneId', 'delivery slice'),
          JSON.stringify(slice),
        );
      }

      const insertWorkflow = this.db.prepare(
        'INSERT INTO workflow_summaries(id, project_id, work_item_id, payload) VALUES (?, ?, ?, ?)',
      );
      for (const summary of snapshot.workflowSummaries) {
        insertWorkflow.run(
          requireText(summary, 'id', 'workflow summary'),
          requireText(summary, 'projectId', 'workflow summary'),
          requireText(summary, 'workItemId', 'workflow summary'),
          JSON.stringify(summary),
        );
      }

      const insertEvidence = this.db.prepare(
        'INSERT INTO delivery_evidence_summaries(id, project_id, work_item_id, payload) VALUES (?, ?, ?, ?)',
      );
      for (const summary of snapshot.deliveryEvidenceSummaries) {
        insertEvidence.run(
          requireText(summary, 'id', 'delivery evidence'),
          requireText(summary, 'projectId', 'delivery evidence'),
          requireText(summary, 'workItemId', 'delivery evidence'),
          JSON.stringify(summary),
        );
      }

      const insertSession = this.db.prepare(
        'INSERT INTO intake_sessions(id, project_id, status, payload) VALUES (?, ?, ?, ?)',
      );
      for (const session of snapshot.intakeSessions) {
        insertSession.run(
          requireText(session, 'id', 'intake session'),
          requireText(session, 'projectId', 'intake session'),
          requireText(session, 'status', 'intake session'),
          JSON.stringify(session),
        );
      }

      const insertMessage = this.db.prepare(
        'INSERT INTO intake_messages(id, session_id, project_id, payload) VALUES (?, ?, ?, ?)',
      );
      for (const message of snapshot.intakeMessages) {
        insertMessage.run(
          requireText(message, 'id', 'intake message'),
          requireText(message, 'sessionId', 'intake message'),
          requireText(message, 'projectId', 'intake message'),
          JSON.stringify(message),
        );
      }

      const insertSource = this.db.prepare(
        'INSERT INTO intake_source_documents(id, session_id, project_id, stored_file_id, payload) VALUES (?, ?, ?, ?, ?)',
      );
      for (const source of snapshot.intakeSourceDocuments) {
        insertSource.run(
          requireText(source, 'id', 'intake source document'),
          requireText(source, 'sessionId', 'intake source document'),
          requireText(source, 'projectId', 'intake source document'),
          optionalText(source, 'storedFileId'),
          JSON.stringify(source),
        );
      }

      const insertCandidate = this.db.prepare(
        'INSERT INTO intake_candidates(id, session_id, project_id, status, payload) VALUES (?, ?, ?, ?, ?)',
      );
      for (const candidate of snapshot.intakeCandidates) {
        insertCandidate.run(
          requireText(candidate, 'id', 'intake candidate'),
          requireText(candidate, 'sessionId', 'intake candidate'),
          requireText(candidate, 'projectId', 'intake candidate'),
          requireText(candidate, 'status', 'intake candidate'),
          JSON.stringify(candidate),
        );
      }

      const insertAudit = this.db.prepare(
        'INSERT INTO audit_events(id, project_id, actor_id, action, target_type, target_id, created_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      );
      for (const event of snapshot.auditEvents) {
        insertAudit.run(
          requireText(event, 'id', 'audit event'),
          requireText(event, 'projectId', 'audit event'),
          requireText(event, 'actorId', 'audit event'),
          requireText(event, 'action', 'audit event'),
          requireText(event, 'targetType', 'audit event'),
          requireText(event, 'targetId', 'audit event'),
          requireNumber(event, 'createdAt', 'audit event'),
          JSON.stringify(event),
        );
      }

      const insertWorkItem = this.db.prepare(
        'INSERT INTO work_items(id, project_id, type, status, parent_id, milestone_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
      );
      const insertLink = this.db.prepare(
        'INSERT INTO work_item_links(from_id, to_id, kind) VALUES (?, ?, ?)',
      );
      const insertCriterion = this.db.prepare(
        'INSERT INTO acceptance_criteria(work_item_id, criterion_id, text, sort_order) VALUES (?, ?, ?, ?)',
      );
      const insertCoverage = this.db.prepare(
        'INSERT INTO work_item_acceptance_coverage(work_item_id, criterion_id) VALUES (?, ?)',
      );
      for (const card of snapshot.cards) {
        const id = requireText(card, 'id', 'work item');
        insertWorkItem.run(
          id,
          requireText(card, 'projectId', 'work item'),
          requireText(card, 'type', 'work item'),
          requireText(card, 'status', 'work item'),
          optionalText(card, 'parentId'),
          optionalText(card, 'milestoneId'),
          JSON.stringify(card),
        );
        const parentId = optionalText(card, 'parentId');
        if (parentId !== null) insertLink.run(id, parentId, 'parent');
        for (const dependencyId of stringArray(card, 'dependencyIds')) {
          insertLink.run(id, dependencyId, 'depends');
        }
        for (const blockedById of stringArray(card, 'blockedByIds')) {
          insertLink.run(id, blockedById, 'blocked_by');
        }
        const criteria = Array.isArray(card.acceptanceCriteria) ? card.acceptanceCriteria : [];
        criteria.forEach((criterion, index) => {
          if (criterion === null || typeof criterion !== 'object') return;
          const row = criterion as Record<string, unknown>;
          insertCriterion.run(
            id,
            requireText(row, 'id', 'acceptance criterion'),
            requireText(row, 'text', 'acceptance criterion'),
            index,
          );
        });
        for (const criterionId of stringArray(card, 'coversAcceptanceIds')) {
          insertCoverage.run(id, criterionId);
        }
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  storeFile(input: StoreFileInput): StoredFile {
    const originalFilename = input.originalFilename.trim();
    if (originalFilename.length === 0) {
      throw new DatabaseError('VALIDATION', 'original filename is required');
    }
    const mimeType = input.mimeType.trim().toLowerCase();
    if (mimeType.length === 0) {
      throw new DatabaseError('VALIDATION', 'mime type is required');
    }
    const uploader = input.uploader.trim();
    if (uploader.length === 0) {
      throw new DatabaseError('VALIDATION', 'uploader is required');
    }
    const projectId = input.projectId.trim();
    if (projectId.length === 0) {
      throw new DatabaseError('VALIDATION', 'project id is required');
    }
    if (input.bytes.byteLength > this.config.maxUploadBytes) {
      throw new DatabaseError(
        'FILE_TOO_LARGE',
        `file exceeds maxUploadBytes ${String(this.config.maxUploadBytes)}`,
      );
    }
    if (!this.config.allowedMimeTypes.map((type) => type.toLowerCase()).includes(mimeType)) {
      throw new DatabaseError('FILE_TYPE_NOT_ALLOWED', `file type ${mimeType} is not allowed`);
    }
    const id = randomUUID();
    const storagePath = join(storageSegment(projectId), storageSegment(id), 'content');
    this.storage.write(storagePath, input.bytes);
    const extracted = resolveExtractedText(mimeType, input.bytes, input.extractedText);
    let extractedTextPath: string | null = null;
    if (extracted.status === 'extracted' && extracted.text.length > 0) {
      extractedTextPath = join(storageSegment(projectId), storageSegment(id), 'extracted.txt');
      this.storage.write(extractedTextPath, new TextEncoder().encode(extracted.text));
    }
    const stored: StoredFile = {
      id,
      projectId,
      originalFilename,
      mimeType,
      size: input.bytes.byteLength,
      sha256: createHash('sha256').update(input.bytes).digest('hex'),
      uploader,
      storagePath,
      extractedTextStatus: extracted.status,
      extractedTextPath,
      createdAt: Date.now(),
    };
    this.db
      .prepare(
        `INSERT INTO stored_files(
          id, project_id, original_filename, mime_type, size, sha256, uploader,
          storage_path, extracted_text_status, extracted_text_path, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        stored.id,
        stored.projectId,
        stored.originalFilename,
        stored.mimeType,
        stored.size,
        stored.sha256,
        stored.uploader,
        stored.storagePath,
        stored.extractedTextStatus,
        stored.extractedTextPath,
        stored.createdAt,
      );
    return stored;
  }

  getFile(id: string): StoredFile | undefined {
    const row = this.db.prepare('SELECT * FROM stored_files WHERE id = ?').get(id);
    if (row === undefined) return undefined;
    return storedFileFromRow(asSqlRow(row));
  }

  listFiles(filter: StoredFileFilter = {}): readonly StoredFile[] {
    const rows =
      filter.projectId === undefined
        ? this.db.prepare('SELECT * FROM stored_files ORDER BY created_at DESC, id DESC').all()
        : this.db
            .prepare('SELECT * FROM stored_files WHERE project_id = ? ORDER BY created_at DESC, id DESC')
            .all(filter.projectId);
    return rows.map((row) => storedFileFromRow(asSqlRow(row)));
  }

  readFileBytes(id: string): Uint8Array {
    const stored = this.getFile(id);
    if (stored === undefined) {
      throw new DatabaseError('FILE_NOT_FOUND', `stored file not found: ${id}`);
    }
    return this.storage.read(stored.storagePath);
  }

  upsertCredential(record: StoredCredential): void {
    this.db
      .prepare(
        `INSERT INTO credentials(username, password_hash, algorithm, enabled, rotated_at, disabled_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(username) DO UPDATE SET
           password_hash = excluded.password_hash,
           algorithm = excluded.algorithm,
           enabled = excluded.enabled,
           rotated_at = excluded.rotated_at,
           disabled_at = excluded.disabled_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        record.username,
        record.passwordHash,
        record.algorithm,
        record.enabled ? 1 : 0,
        record.rotatedAt,
        record.disabledAt,
        record.updatedAt,
      );
  }

  getCredential(username: string): StoredCredential | undefined {
    const row = this.db.prepare('SELECT * FROM credentials WHERE username = ?').get(username);
    if (row === undefined) return undefined;
    const values = asSqlRow(row);
    return {
      username: String(values.username ?? ''),
      passwordHash: String(values.password_hash ?? ''),
      algorithm: String(values.algorithm ?? ''),
      enabled: Number(values.enabled ?? 0) === 1,
      rotatedAt: values.rotated_at === null || values.rotated_at === undefined ? null : Number(values.rotated_at),
      disabledAt: values.disabled_at === null || values.disabled_at === undefined ? null : Number(values.disabled_at),
      updatedAt: Number(values.updated_at ?? 0),
    };
  }

  upsertAuthUser(record: StoredAuthUser): void {
    this.db
      .prepare(
        `INSERT INTO auth_users(username, display_name, audience, project_ids, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(username) DO UPDATE SET
           display_name = excluded.display_name,
           audience = excluded.audience,
           project_ids = excluded.project_ids`,
      )
      .run(
        record.username,
        record.displayName,
        record.audience,
        JSON.stringify(record.projectIds),
        record.createdAt,
      );
  }

  listAuthUsers(): readonly StoredAuthUser[] {
    const rows = this.db.prepare('SELECT * FROM auth_users ORDER BY created_at ASC, username ASC').all();
    return rows.map((row) => {
      const values = asSqlRow(row);
      let projectIds: string[] = [];
      try {
        const parsed: unknown = JSON.parse(String(values.project_ids ?? '[]'));
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
          projectIds = parsed;
        }
      } catch {
        projectIds = [];
      }
      return {
        username: String(values.username ?? ''),
        displayName: String(values.display_name ?? ''),
        audience: String(values.audience ?? 'developer'),
        projectIds,
        createdAt: Number(values.created_at ?? 0),
      };
    });
  }

  recordAuthEvent(record: StoredAuthEvent): void {
    this.db
      .prepare(
        `INSERT INTO auth_events(id, actor_id, action, target_id, request_source, reason, region, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.actorId,
        record.action,
        record.targetId,
        record.requestSource,
        record.reason,
        record.region,
        record.createdAt,
      );
  }

  listAuthEvents(limit = 100): readonly StoredAuthEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM auth_events ORDER BY created_at DESC, id DESC LIMIT ?')
      .all(limit);
    return rows.map((row) => {
      const values = asSqlRow(row);
      return {
        id: String(values.id ?? ''),
        actorId: String(values.actor_id ?? ''),
        action: String(values.action ?? ''),
        targetId: String(values.target_id ?? ''),
        requestSource: String(values.request_source ?? ''),
        reason: String(values.reason ?? ''),
        region: values.region === 'cn' || values.region === 'global' ? String(values.region) : null,
        createdAt: Number(values.created_at ?? 0),
      };
    });
  }

  listOAuthIdentities(): readonly StoredOAuthIdentity[] {
    const rows = this.db.prepare('SELECT * FROM oauth_identities ORDER BY created_at ASC, id ASC').all();
    return rows.map((row) => {
      const values = asSqlRow(row);
      return {
        id: String(values.id ?? ''),
        userId: String(values.user_id ?? ''),
        provider: String(values.provider ?? ''),
        subject: String(values.subject ?? ''),
        unionid: values.unionid === null || values.unionid === undefined ? null : String(values.unionid),
        email: values.email === null || values.email === undefined ? null : String(values.email),
        profile: parseJsonRecord(values.profile),
        createdAt: Number(values.created_at ?? 0),
      };
    });
  }

  upsertOAuthIdentity(record: StoredOAuthIdentity): void {
    this.db
      .prepare(
        `INSERT INTO oauth_identities(id, user_id, provider, subject, unionid, email, profile, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           unionid = excluded.unionid,
           email = excluded.email,
           profile = excluded.profile`,
      )
      .run(
        record.id,
        record.userId,
        record.provider,
        record.subject,
        record.unionid,
        record.email,
        JSON.stringify(record.profile),
        record.createdAt,
      );
  }

  deleteOAuthIdentity(id: string): void {
    this.db.prepare('DELETE FROM oauth_identities WHERE id = ?').run(id);
  }

  upsertOAuthState(record: StoredOAuthState): void {
    this.db
      .prepare(
        `INSERT INTO oauth_states(state, provider_id, region, redirect_uri, code_verifier, bind_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(state) DO UPDATE SET
           provider_id = excluded.provider_id,
           region = excluded.region,
           redirect_uri = excluded.redirect_uri,
           code_verifier = excluded.code_verifier,
           bind_user_id = excluded.bind_user_id,
           created_at = excluded.created_at`,
      )
      .run(
        record.state,
        record.providerId,
        record.region,
        record.redirectUri,
        record.codeVerifier,
        record.bindUserId,
        record.createdAt,
      );
  }

  takeOAuthState(state: string): StoredOAuthState | undefined {
    const row = this.db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state);
    this.db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
    if (row === undefined) return undefined;
    const values = asSqlRow(row);
    return {
      state: String(values.state ?? ''),
      providerId: String(values.provider_id ?? ''),
      region: String(values.region ?? ''),
      redirectUri: String(values.redirect_uri ?? ''),
      codeVerifier: values.code_verifier === null || values.code_verifier === undefined ? null : String(values.code_verifier),
      bindUserId: values.bind_user_id === null || values.bind_user_id === undefined ? null : String(values.bind_user_id),
      createdAt: Number(values.created_at ?? 0),
    };
  }

  deleteOAuthState(state: string): void {
    this.db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}

function resolveSqlitePath(workspaceRoot: string, sqlitePath: string): string {
  if (sqlitePath === ':memory:') return ':memory:';
  return resolveUnderRoot(workspaceRoot, sqlitePath, 'sqlite path');
}

function toSqlParams(params: readonly SqlValue[]): SQLInputValue[] {
  return [...params];
}

function parseJsonRecord(value: SqlValue | undefined): Record<string, string> {
  if (typeof value !== 'string' || value.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const record: Record<string, string> = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (typeof item === 'string') record[key] = item;
    }
    return record;
  } catch {
    return {};
  }
}

function asSqlRow(row: Record<string, unknown>): Record<string, SqlValue> {
  const next: Record<string, SqlValue> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      next[key] = value;
      continue;
    }
    throw new DatabaseError('VALIDATION', `unsupported sql value for ${key}`);
  }
  return next;
}

function requireText(row: Record<string, unknown>, key: string, label: string): string {
  const value = row[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new DatabaseError('VALIDATION', `${label} is missing ${key}`);
  }
  return value;
}

function optionalText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new DatabaseError('VALIDATION', `${key} must be a string`);
  }
  return value;
}

function requireNumber(row: Record<string, unknown>, key: string, label: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DatabaseError('VALIDATION', `${label} is missing ${key}`);
  }
  return value;
}

function stringArray(row: Record<string, unknown>, key: string): readonly string[] {
  const value = row[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new DatabaseError('VALIDATION', `${key} must be an array`);
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function storedFileFromRow(row: Record<string, SqlValue>): StoredFile {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    originalFilename: String(row.original_filename ?? ''),
    mimeType: String(row.mime_type ?? ''),
    size: Number(row.size ?? 0),
    sha256: String(row.sha256 ?? ''),
    uploader: String(row.uploader ?? ''),
    storagePath: String(row.storage_path ?? ''),
    extractedTextStatus: String(row.extracted_text_status ?? 'pending') as ExtractedTextStatus,
    extractedTextPath: row.extracted_text_path === null || row.extracted_text_path === undefined
      ? null
      : String(row.extracted_text_path),
    createdAt: Number(row.created_at ?? 0),
  };
}

function resolveExtractedText(
  mimeType: string,
  bytes: Uint8Array,
  extractedText: string | undefined,
): { status: ExtractedTextStatus; text: string } {
  const parsed = extractStoredFile({
    mimeType,
    bytes,
    ...(extractedText !== undefined ? { extractedText } : {}),
  });
  if (parsed.status === 'parsed' && parsed.text.trim().length > 0) {
    return { status: 'extracted', text: parsed.text };
  }
  if (parsed.status === 'failed') return { status: 'failed', text: '' };
  if (parsed.status === 'unsupported') return { status: 'unsupported', text: '' };
  return { status: 'pending', text: '' };
}
