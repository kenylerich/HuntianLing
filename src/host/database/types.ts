/**
 * Driver-agnostic persistence and local file storage.
 *
 * Upper layers consume `huntianling.database`. SQLite is the local driver;
 * PostgreSQL remains a later deployment option and fails loud if selected.
 */

export type DatabaseDriver = 'sqlite';
export type ExtractedTextStatus = 'pending' | 'extracted' | 'unsupported' | 'failed';
export type SqlValue = string | number | bigint | null;

export type DatabaseErrorCode =
  | 'UNSUPPORTED_DRIVER'
  | 'INVALID_CONFIG'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_NOT_ALLOWED'
  | 'FILE_NOT_FOUND'
  | 'VALIDATION';

export class DatabaseError extends Error {
  constructor(
    readonly code: DatabaseErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface DatabaseConfig {
  readonly driver?: string;
  readonly sqlitePath?: string;
  readonly storageRoot?: string;
  readonly maxUploadBytes?: number;
  readonly allowedMimeTypes?: readonly string[];
}

export interface ResolvedDatabaseConfig {
  readonly driver: DatabaseDriver;
  readonly sqlitePath: string;
  readonly storageRoot: string;
  readonly maxUploadBytes: number;
  readonly allowedMimeTypes: readonly string[];
}

export interface FileStorageBackend {
  write(relativePath: string, bytes: Uint8Array): void;
  read(relativePath: string): Uint8Array;
}

export interface StoreFileInput {
  readonly projectId: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly uploader: string;
  readonly bytes: Uint8Array;
  readonly extractedText?: string;
}

export interface StoredFile {
  readonly id: string;
  readonly projectId: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly size: number;
  readonly sha256: string;
  readonly uploader: string;
  readonly storagePath: string;
  readonly extractedTextStatus: ExtractedTextStatus;
  readonly extractedTextPath: string | null;
  readonly createdAt: number;
}

export interface StoredFileFilter {
  readonly projectId?: string;
}

export interface BoardDocument {
  readonly schemaVersion: number;
  readonly projects: readonly Record<string, unknown>[];
  readonly teamMembers: readonly Record<string, unknown>[];
  readonly milestones: readonly Record<string, unknown>[];
  readonly deliverySlices: readonly Record<string, unknown>[];
  readonly workflowSummaries: readonly Record<string, unknown>[];
  readonly deliveryEvidenceSummaries: readonly Record<string, unknown>[];
  readonly intakeSessions: readonly Record<string, unknown>[];
  readonly intakeMessages: readonly Record<string, unknown>[];
  readonly intakeSourceDocuments: readonly Record<string, unknown>[];
  readonly intakeCandidates: readonly Record<string, unknown>[];
  readonly auditEvents: readonly Record<string, unknown>[];
  readonly cards: readonly Record<string, unknown>[];
}

export interface DatabaseExecuteResult {
  readonly changes: number;
}

export interface StoredCredential {
  readonly username: string;
  readonly passwordHash: string;
  readonly algorithm: string;
  readonly enabled: boolean;
  readonly rotatedAt: number | null;
  readonly disabledAt: number | null;
  readonly updatedAt: number;
}

export interface StoredAuthUser {
  readonly username: string;
  readonly displayName: string;
  readonly audience: string;
  readonly projectIds: readonly string[];
  readonly createdAt: number;
}

export interface StoredAuthEvent {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly targetId: string;
  readonly requestSource: string;
  readonly reason: string;
  readonly region: string | null;
  readonly createdAt: number;
}

export interface StoredOAuthIdentity {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly subject: string;
  readonly unionid: string | null;
  readonly email: string | null;
  readonly profile: Readonly<Record<string, string>>;
  readonly createdAt: number;
}

export interface StoredOAuthState {
  readonly state: string;
  readonly providerId: string;
  readonly region: string;
  readonly redirectUri: string;
  readonly codeVerifier: string | null;
  readonly bindUserId: string | null;
  readonly createdAt: number;
}

export interface DatabaseService {
  readonly driver: DatabaseDriver;
  schemaVersion(): number;
  migrate(): number;
  execute(sql: string, params?: readonly SqlValue[]): DatabaseExecuteResult;
  query(sql: string, params?: readonly SqlValue[]): readonly Record<string, SqlValue>[];
  loadBoardSnapshot(): BoardDocument | undefined;
  saveBoardSnapshot(snapshot: BoardDocument): void;
  storeFile(input: StoreFileInput): StoredFile;
  getFile(id: string): StoredFile | undefined;
  listFiles(filter?: StoredFileFilter): readonly StoredFile[];
  readFileBytes(id: string): Uint8Array;
  upsertCredential(record: StoredCredential): void;
  getCredential(username: string): StoredCredential | undefined;
  upsertAuthUser(record: StoredAuthUser): void;
  listAuthUsers(): readonly StoredAuthUser[];
  recordAuthEvent(record: StoredAuthEvent): void;
  listAuthEvents(limit?: number): readonly StoredAuthEvent[];
  listOAuthIdentities(): readonly StoredOAuthIdentity[];
  upsertOAuthIdentity(record: StoredOAuthIdentity): void;
  deleteOAuthIdentity(id: string): void;
  upsertOAuthState(record: StoredOAuthState): void;
  takeOAuthState(state: string): StoredOAuthState | undefined;
  deleteOAuthState(state: string): void;
  close(): void;
}

export interface CreateDatabaseServiceInput {
  readonly workspaceRoot: string;
  readonly config?: DatabaseConfig;
  readonly storage?: FileStorageBackend;
}

const DEFAULT_ALLOWED_MIME_TYPES: readonly string[] = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/json',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function resolveDatabaseConfig(input: DatabaseConfig = {}): ResolvedDatabaseConfig {
  const driver = input.driver ?? 'sqlite';
  if (driver !== 'sqlite') {
    throw new DatabaseError(
      'UNSUPPORTED_DRIVER',
      `database driver ${driver} is not available; use sqlite`,
    );
  }
  const sqlitePath = input.sqlitePath ?? '.huntianling/huntianling.sqlite';
  const storageRoot = input.storageRoot ?? '.huntianling/files';
  if (sqlitePath.trim() === '') {
    throw new DatabaseError('INVALID_CONFIG', 'database sqlitePath cannot be blank');
  }
  if (storageRoot.trim() === '') {
    throw new DatabaseError('INVALID_CONFIG', 'database storageRoot cannot be blank');
  }
  const maxUploadBytes = input.maxUploadBytes ?? 10 * 1024 * 1024;
  if (!Number.isInteger(maxUploadBytes) || maxUploadBytes <= 0) {
    throw new DatabaseError('INVALID_CONFIG', 'database maxUploadBytes must be a positive integer');
  }
  const allowedMimeTypes = input.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
  if (allowedMimeTypes.length === 0) {
    throw new DatabaseError('INVALID_CONFIG', 'database allowedMimeTypes cannot be empty');
  }
  if (allowedMimeTypes.some((type) => type.trim() === '')) {
    throw new DatabaseError('INVALID_CONFIG', 'database allowedMimeTypes cannot contain a blank type');
  }
  return {
    driver: 'sqlite',
    sqlitePath,
    storageRoot,
    maxUploadBytes,
    allowedMimeTypes,
  };
}
