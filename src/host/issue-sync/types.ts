/**
 * Optional issue-tracker mirrors. External cards do not own the WorkItem lifecycle.
 */

import type { ProjectId, WorkItemId } from '../board/types.js';

export type IssueSyncErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'NOT_READY' | 'CONFLICT' | 'HOSTED';

export class IssueSyncError extends Error {
  constructor(
    readonly code: IssueSyncErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const ISSUE_PROVIDERS = ['github', 'gitea', 'gitlab'] as const;
export type IssueProvider = (typeof ISSUE_PROVIDERS)[number];

export const SYNCHRONIZED_FIELDS = ['title', 'body', 'state'] as const;
export type SynchronizedField = (typeof SYNCHRONIZED_FIELDS)[number];

export const OWNED_FIELDS = [
  'parentId',
  'milestoneId',
  'acceptance',
  'agentFeedback',
  'evidence',
  'status',
] as const;
export type OwnedField = (typeof OWNED_FIELDS)[number];

export type ExternalIssueState = 'open' | 'closed';

export interface IssueFieldOwnership {
  readonly synchronized: readonly SynchronizedField[];
  readonly owned: readonly OwnedField[];
}

export const FIELD_OWNERSHIP: IssueFieldOwnership = {
  synchronized: SYNCHRONIZED_FIELDS,
  owned: OWNED_FIELDS,
};

export interface HostedIssueRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface HostedIssueResponse {
  readonly status: number;
  readonly body: string;
}

export type HostedIssueTransport = (request: HostedIssueRequest) => HostedIssueResponse;

export interface IssueTrackerBinding {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly provider: IssueProvider;
  readonly owner: string;
  readonly repo: string;
  readonly apiBaseUrl: string;
  readonly createdAt: number;
  readonly createdBy: string;
}

export interface BindTrackerInput {
  readonly projectId: ProjectId;
  readonly provider: IssueProvider;
  readonly owner: string;
  readonly repo: string;
  readonly apiBaseUrl?: string;
  readonly actor: string;
}

export interface ExternalIssueSnapshot {
  readonly number: number;
  readonly externalId: string;
  readonly url: string;
  readonly title: string;
  readonly body: string;
  readonly state: ExternalIssueState;
  readonly updatedAt: string;
}

export interface ExternalIssueRef {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly trackerId: string;
  readonly provider: IssueProvider;
  readonly externalNumber: number;
  readonly externalId: string;
  readonly url: string;
  readonly externalState: ExternalIssueState;
  readonly lastSyncedAt: number;
  readonly lastInternalTitle: string;
  readonly lastExternalTitle: string;
  readonly lastInternalBody: string;
  readonly lastExternalBody: string;
  readonly gatePublishedAt: number | null;
  readonly createdAt: number;
}

export interface SyncConflict {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly field: SynchronizedField;
  readonly internalValue: string;
  readonly externalValue: string;
  readonly reason: string;
  readonly createdAt: number;
}

export interface SyncReport {
  readonly projectId: ProjectId;
  readonly imported: number;
  readonly exported: number;
  readonly conflicts: readonly SyncConflict[];
  readonly recovered: number;
}

export interface CloseIngestResult {
  readonly kind: 'accepted-close' | 'recovery';
  readonly workItemId: WorkItemId;
  readonly reopened: boolean;
  readonly workItemStatusUnchanged: true;
}

export interface ImportIssueInput {
  readonly projectId: ProjectId;
  readonly workItemId?: WorkItemId;
  readonly snapshot?: ExternalIssueSnapshot;
  readonly number?: number;
  readonly token?: string;
  readonly actor: string;
}

export interface ExportWorkItemInput {
  readonly workItemId: WorkItemId;
  readonly token?: string;
  readonly actor: string;
}

export interface IssueSyncService {
  listProviders(): readonly IssueProvider[];
  fieldOwnership(): IssueFieldOwnership;
  bindTracker(input: BindTrackerInput): IssueTrackerBinding;
  listTrackers(projectId: ProjectId): readonly IssueTrackerBinding[];
  getReference(workItemId: WorkItemId): ExternalIssueRef | undefined;
  listReferences(projectId: ProjectId): readonly ExternalIssueRef[];
  importIssue(input: ImportIssueInput): { readonly workItemId: WorkItemId; readonly reference: ExternalIssueRef };
  exportWorkItem(input: ExportWorkItemInput): { readonly reference: ExternalIssueRef; readonly issue: ExternalIssueSnapshot };
  sync(projectId: ProjectId, token?: string): SyncReport;
  conflicts(projectId: ProjectId): readonly SyncConflict[];
  publishGate(workItemId: WorkItemId, actor: string, token?: string): ExternalIssueRef;
  ingestClose(workItemId: WorkItemId, actor: string, token?: string): CloseIngestResult;
}
