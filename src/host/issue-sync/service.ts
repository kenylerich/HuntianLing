/**
 * huntianling.issueSync — optional mirrors of WorkItems onto issue trackers.
 */

import { randomUUID } from 'node:crypto';

import type { BoardService } from '../board/plugin.js';
import type { ProjectId, WorkItem, WorkItemId } from '../board/types.js';
import {
  createHostedIssue,
  defaultApiBaseUrl,
  defaultIssueTransport,
  getHostedIssue,
  resolveIssueToken,
  updateHostedIssue,
} from './hosted.js';
import {
  emptyIssueSyncSnapshot,
  loadIssueSyncSnapshot,
  saveIssueSyncSnapshot,
  type IssueSyncSnapshot,
} from './store.js';
import {
  FIELD_OWNERSHIP,
  ISSUE_PROVIDERS,
  IssueSyncError,
  type CloseIngestResult,
  type ExternalIssueRef,
  type ExternalIssueSnapshot,
  type HostedIssueTransport,
  type IssueProvider,
  type IssueSyncService,
  type IssueTrackerBinding,
  type SyncConflict,
} from './types.js';

export type { IssueSyncService };

const GATE_MARKER = '<!-- huntianling-delivery-gate -->';
const OWNED_MARKER = '<!-- huntianling-owned';

export interface CreateIssueSyncServiceInput {
  readonly board: BoardService;
  readonly workspaceRoot?: string;
  readonly hosted?: HostedIssueTransport;
  readonly env?: NodeJS.ProcessEnv;
}

export function createIssueSyncService(input: CreateIssueSyncServiceInput): IssueSyncService {
  const board = input.board;
  const transport = input.hosted ?? defaultIssueTransport;
  const env = input.env ?? process.env;
  let snapshot: IssueSyncSnapshot =
    input.workspaceRoot === undefined
      ? emptyIssueSyncSnapshot()
      : loadIssueSyncSnapshot(input.workspaceRoot);

  function persist(): void {
    if (input.workspaceRoot === undefined) return;
    saveIssueSyncSnapshot(input.workspaceRoot, snapshot);
  }

  function requireProject(projectId: ProjectId): void {
    const found = board.listProjects({ includeArchived: true }).some((item) => item.id === projectId);
    if (!found) throw new IssueSyncError('NOT_FOUND', `project not found: ${projectId}`);
  }

  function requireItem(workItemId: WorkItemId): WorkItem {
    const item = board.getWorkItem(workItemId);
    if (item === undefined) throw new IssueSyncError('NOT_FOUND', `work item not found: ${workItemId}`);
    return item;
  }

  function requireTracker(projectId: ProjectId): IssueTrackerBinding {
    const tracker = snapshot.trackers.find((row) => row.projectId === projectId);
    if (tracker === undefined) {
      throw new IssueSyncError('NOT_READY', `project ${projectId} has no issue tracker`);
    }
    return tracker;
  }

  function tokenFor(tracker: IssueTrackerBinding, token?: string): string {
    return resolveIssueToken(tracker.provider, token, env);
  }

  function upsertReference(next: ExternalIssueRef): void {
    snapshot = {
      ...snapshot,
      references: [...snapshot.references.filter((row) => row.workItemId !== next.workItemId), next],
    };
  }

  function replaceConflicts(projectId: ProjectId, next: readonly SyncConflict[]): void {
    snapshot = {
      ...snapshot,
      conflicts: [...snapshot.conflicts.filter((row) => row.projectId !== projectId), ...next],
    };
  }

  const service: IssueSyncService = {
    listProviders() {
      return ISSUE_PROVIDERS;
    },

    fieldOwnership() {
      return FIELD_OWNERSHIP;
    },

    bindTracker(raw) {
      requireProject(raw.projectId);
      if (!(ISSUE_PROVIDERS as readonly string[]).includes(raw.provider)) {
        throw new IssueSyncError('VALIDATION', `unknown issue provider: ${raw.provider}`);
      }
      const owner = requireNonBlank(raw.owner, 'tracker owner');
      const repo = requireNonBlank(raw.repo, 'tracker repo');
      const binding: IssueTrackerBinding = {
        id: randomUUID(),
        projectId: raw.projectId,
        provider: raw.provider,
        owner,
        repo,
        apiBaseUrl: defaultApiBaseUrl(raw.provider, raw.apiBaseUrl),
        createdAt: Date.now(),
        createdBy: raw.actor,
      };
      snapshot = {
        ...snapshot,
        trackers: [...snapshot.trackers.filter((row) => row.projectId !== raw.projectId), binding],
      };
      board.recordAuditEvent({
        projectId: raw.projectId,
        actorId: raw.actor,
        action: 'issue-sync.tracker.bound',
        targetType: 'issue_tracker',
        targetId: binding.id,
        targetLabel: `${binding.provider}:${binding.owner}/${binding.repo}`,
        changedFields: ['provider'],
      });
      persist();
      return binding;
    },

    listTrackers(projectId) {
      requireProject(projectId);
      return snapshot.trackers.filter((row) => row.projectId === projectId);
    },

    getReference(workItemId) {
      return snapshot.references.find((row) => row.workItemId === workItemId);
    },

    listReferences(projectId) {
      requireProject(projectId);
      return snapshot.references.filter((row) => row.projectId === projectId);
    },

    importIssue(raw) {
      requireProject(raw.projectId);
      const tracker = requireTracker(raw.projectId);
      const issue = raw.snapshot ?? fetchRequired(tracker, raw.number, raw.token);
      const mappedId = raw.workItemId ?? snapshot.references.find((row) =>
        row.projectId === raw.projectId && row.externalNumber === issue.number,
      )?.workItemId;
      const item = mappedId !== undefined
        ? applySynchronizedFields(requireItem(mappedId), issue)
        : board.createWorkItem({
          projectId: raw.projectId,
          type: 'story',
          title: issue.title,
          body: stripOwnedProjection(issue.body),
        });
      const reference = toReference(tracker, item, issue);
      upsertReference(reference);
      board.recordAuditEvent({
        projectId: raw.projectId,
        actorId: raw.actor,
        action: 'issue-sync.imported',
        targetType: 'work_item',
        targetId: item.id,
        targetLabel: item.title,
        changedFields: ['title', 'body'],
      });
      persist();
      return { workItemId: item.id, reference };
    },

    exportWorkItem(raw) {
      const item = requireItem(raw.workItemId);
      const tracker = requireTracker(item.projectId);
      const token = tokenFor(tracker, raw.token);
      const body = withOwnedProjection(item);
      const existing = snapshot.references.find((row) => row.workItemId === item.id);
      const issue = existing === undefined
        ? createHostedIssue({ transport, tracker, title: item.title, body, token })
        : updateHostedIssue({
          transport,
          tracker,
          number: existing.externalNumber,
          title: item.title,
          body,
          token,
        });
      const reference = toReference(tracker, item, issue, existing);
      upsertReference(reference);
      board.recordAuditEvent({
        projectId: item.projectId,
        actorId: raw.actor,
        action: 'issue-sync.exported',
        targetType: 'work_item',
        targetId: item.id,
        targetLabel: item.title,
        changedFields: ['title', 'body'],
      });
      persist();
      return { reference, issue };
    },

    sync(projectId, token) {
      requireProject(projectId);
      const tracker = requireTracker(projectId);
      const auth = tokenFor(tracker, token);
      const conflicts: SyncConflict[] = [];
      let imported = 0;
      let exported = 0;
      for (const reference of snapshot.references.filter((row) => row.projectId === projectId)) {
        const item = board.getWorkItem(reference.workItemId);
        if (item === undefined) continue;
        const issue = getHostedIssue({
          transport,
          tracker,
          number: reference.externalNumber,
          token: auth,
        });
        const internalTitleChanged = item.title !== reference.lastInternalTitle;
        const externalTitleChanged = issue.title !== reference.lastExternalTitle;
        const internalBodyChanged = stripOwnedProjection(item.body) !== stripOwnedProjection(reference.lastInternalBody);
        const externalBodyChanged = stripOwnedProjection(issue.body) !== stripOwnedProjection(reference.lastExternalBody);
        if (internalTitleChanged && externalTitleChanged && item.title !== issue.title) {
          conflicts.push(makeConflict(projectId, item.id, 'title', item.title, issue.title));
        } else if (externalTitleChanged && !internalTitleChanged) {
          applySynchronizedFields(item, { ...issue, body: item.body });
          imported += 1;
        } else if (internalTitleChanged && !externalTitleChanged) {
          updateHostedIssue({ transport, tracker, number: issue.number, title: item.title, token: auth });
          exported += 1;
        }
        if (internalBodyChanged && externalBodyChanged
          && stripOwnedProjection(item.body) !== stripOwnedProjection(issue.body)) {
          conflicts.push(makeConflict(
            projectId,
            item.id,
            'body',
            stripOwnedProjection(item.body),
            stripOwnedProjection(issue.body),
          ));
        } else if (externalBodyChanged && !internalBodyChanged) {
          applySynchronizedFields(item, { ...issue, title: item.title });
          imported += 1;
        } else if (internalBodyChanged && !externalBodyChanged) {
          updateHostedIssue({
            transport,
            tracker,
            number: issue.number,
            body: withOwnedProjection(item),
            token: auth,
          });
          exported += 1;
        }
        const latest = board.getWorkItem(item.id) ?? item;
        upsertReference(toReference(tracker, latest, issue, reference));
      }
      replaceConflicts(projectId, conflicts);
      persist();
      return { projectId, imported, exported, conflicts, recovered: 0 };
    },

    conflicts(projectId) {
      requireProject(projectId);
      return snapshot.conflicts.filter((row) => row.projectId === projectId);
    },

    publishGate(workItemId, actor, token) {
      const item = requireItem(workItemId);
      const tracker = requireTracker(item.projectId);
      const reference = snapshot.references.find((row) => row.workItemId === item.id);
      if (reference === undefined) {
        throw new IssueSyncError('NOT_READY', `work item ${workItemId} has no external issue`);
      }
      const inspection = board.inspectDeliveryGates(item.id, 'delivered');
      if (!inspection.allowed) {
        throw new IssueSyncError('NOT_READY', 'delivery gates are not ready to publish');
      }
      const issue = updateHostedIssue({
        transport,
        tracker,
        number: reference.externalNumber,
        body: withGateCertificate(withOwnedProjection(item), item),
        token: tokenFor(tracker, token),
      });
      const next = { ...toReference(tracker, item, issue, reference), gatePublishedAt: Date.now() };
      upsertReference(next);
      board.recordAuditEvent({
        projectId: item.projectId,
        actorId: actor,
        action: 'issue-sync.gate.published',
        targetType: 'work_item',
        targetId: item.id,
        targetLabel: item.title,
        changedFields: ['body'],
      });
      persist();
      return next;
    },

    ingestClose(workItemId, actor, token) {
      const item = requireItem(workItemId);
      const tracker = requireTracker(item.projectId);
      const reference = snapshot.references.find((row) => row.workItemId === item.id);
      if (reference === undefined) {
        throw new IssueSyncError('NOT_READY', `work item ${workItemId} has no external issue`);
      }
      const auth = tokenFor(tracker, token);
      const issue = getHostedIssue({
        transport,
        tracker,
        number: reference.externalNumber,
        token: auth,
      });
      const inspection = board.inspectDeliveryGates(item.id, 'delivered');
      const published = reference.gatePublishedAt !== null && hasGateCertificate(issue.body);
      if (issue.state === 'closed' && (!published || !inspection.allowed)) {
        const reopened = updateHostedIssue({
          transport,
          tracker,
          number: issue.number,
          state: 'open',
          token: auth,
        });
        upsertReference(toReference(tracker, item, reopened, reference));
        board.recordAuditEvent({
          projectId: item.projectId,
          actorId: actor,
          action: 'issue-sync.close.recovered',
          targetType: 'work_item',
          targetId: item.id,
          targetLabel: item.title,
          changedFields: ['state'],
        });
        persist();
        const result: CloseIngestResult = {
          kind: 'recovery',
          workItemId: item.id,
          reopened: true,
          workItemStatusUnchanged: true,
        };
        return result;
      }
      upsertReference(toReference(tracker, item, issue, reference));
      persist();
      return {
        kind: 'accepted-close',
        workItemId: item.id,
        reopened: false,
        workItemStatusUnchanged: true,
      };
    },
  };

  function fetchRequired(
    tracker: IssueTrackerBinding,
    number: number | undefined,
    token?: string,
  ): ExternalIssueSnapshot {
    if (number === undefined) {
      throw new IssueSyncError('VALIDATION', 'import requires a snapshot or issue number');
    }
    return getHostedIssue({ transport, tracker, number, token: tokenFor(tracker, token) });
  }

  function applySynchronizedFields(item: WorkItem, issue: ExternalIssueSnapshot): WorkItem {
    return board.updateWorkItem(item.id, {
      title: issue.title,
      body: stripOwnedProjection(issue.body),
    });
  }

  function toReference(
    tracker: IssueTrackerBinding,
    item: WorkItem,
    issue: ExternalIssueSnapshot,
    previous?: ExternalIssueRef,
  ): ExternalIssueRef {
    return {
      id: previous?.id ?? randomUUID(),
      projectId: item.projectId,
      workItemId: item.id,
      trackerId: tracker.id,
      provider: tracker.provider,
      externalNumber: issue.number,
      externalId: issue.externalId,
      url: issue.url,
      externalState: issue.state,
      lastSyncedAt: Date.now(),
      lastInternalTitle: item.title,
      lastExternalTitle: issue.title,
      lastInternalBody: item.body,
      lastExternalBody: issue.body,
      gatePublishedAt: previous?.gatePublishedAt ?? null,
      createdAt: previous?.createdAt ?? Date.now(),
    };
  }

  return service;
}

function makeConflict(
  projectId: ProjectId,
  workItemId: WorkItemId,
  field: SyncConflict['field'],
  internalValue: string,
  externalValue: string,
): SyncConflict {
  return {
    id: randomUUID(),
    projectId,
    workItemId,
    field,
    internalValue,
    externalValue,
    reason: `${field} changed on both sides`,
    createdAt: Date.now(),
  };
}

function withOwnedProjection(item: WorkItem): string {
  const owned = [
    `${OWNED_MARKER}`,
    `parentId: ${item.parentId ?? ''}`,
    `milestoneId: ${item.milestoneId ?? ''}`,
    `acceptance: ${item.acceptance.join('|')}`,
    `evidence: ${item.evidence.join('|')}`,
    `status: ${item.status}`,
    'agentFeedback: internal',
    '-->',
  ].join('\n');
  return `${stripOwnedProjection(item.body).trim()}\n\n${owned}\n`;
}

function stripOwnedProjection(body: string): string {
  const owned = body.indexOf(OWNED_MARKER);
  const gate = body.indexOf(GATE_MARKER);
  let end = body.length;
  if (owned >= 0) end = Math.min(end, owned);
  if (gate >= 0) end = Math.min(end, gate);
  return body.slice(0, end).trim();
}

function withGateCertificate(body: string, item: WorkItem): string {
  const evidence = item.evidence.length > 0 ? item.evidence.join(', ') : 'evidence-board record';
  const certificate = [
    GATE_MARKER,
    `- WorkItem: ${item.id}`,
    `- Acceptance: ${item.acceptance.length > 0 ? 'passed by acceptance coverage' : 'passed'}`,
    '- Code: passed',
    '- Review: approved',
    '- CI: passed',
    `- Evidence: ${evidence}`,
    '- Gates: passed',
  ].join('\n');
  return `${stripOwnedProjection(body)}\n\n${certificate}\n`;
}

function hasGateCertificate(body: string): boolean {
  if (!body.includes(GATE_MARKER)) return false;
  return /-\s*Gates:\s*(passed|approved|已通过)\b/i.test(body);
}

function requireNonBlank(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new IssueSyncError('VALIDATION', `${label} cannot be blank`);
  return trimmed;
}

export function isIssueProvider(value: string): value is IssueProvider {
  return (ISSUE_PROVIDERS as readonly string[]).includes(value);
}
