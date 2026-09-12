/**
 * Developer Agent Channel: typed messages, collaboration tasks, and events.
 */

import { randomUUID } from 'node:crypto';

import type { BoardService } from '../board/plugin.js';
import type { ProjectId, WorkItemId } from '../board/types.js';
import { isMktFollowUpField } from '../intake/clarify.js';
import { assertNever, isFirstSliceMessageType, parseChannelMessageType, validateTypedPayload } from './schema.js';
import {
  ChannelWriteError,
  type ChannelApproval,
  type ChannelApprovalStatus,
  type ChannelConversation,
  type ChannelDecision,
  type ChannelMessage,
  type ChannelMessageType,
  type CollabEvent,
  type CollaborationTask,
  type CollaborationTaskStatus,
  type FirstSliceMessageType,
  type LaterCatalogMessageType,
  type UnresolvedChannelQuestion,
} from './types.js';

export interface CollabService {
  createConversation(input: { readonly projectId: ProjectId; readonly title: string }): ChannelConversation;
  listConversations(projectId: ProjectId): readonly ChannelConversation[];
  getConversation(id: string): ChannelConversation | undefined;
  postMessage(
    conversationId: string,
    input: {
      readonly type: unknown;
      readonly from: ChannelMessage['from'];
      readonly payload?: Record<string, unknown>;
      readonly refs?: ChannelMessage['refs'];
      readonly to?: ChannelMessage['to'];
      readonly inReplyTo?: string | null;
    },
  ): ChannelMessage;
  listMessages(conversationId: string): readonly ChannelMessage[];
  listTasks(conversationId: string): readonly CollaborationTask[];
  listOpenTasks(projectId: ProjectId, workItemId?: WorkItemId): readonly CollaborationTask[];
  listEvents(conversationId: string): readonly CollabEvent[];
  listDecisions(projectId: ProjectId, workItemId?: WorkItemId): readonly ChannelDecision[];
  listApprovals(filter?: {
    readonly projectId?: ProjectId;
    readonly taskId?: string;
    readonly status?: ChannelApprovalStatus;
  }): readonly ChannelApproval[];
  listUnresolvedQuestions(projectId: ProjectId, workItemId?: WorkItemId): readonly UnresolvedChannelQuestion[];
  selectMessagesForTask(taskId: string): readonly ChannelMessage[];
  getTask(taskId: string): CollaborationTask | undefined;
  hasPendingApproval(taskId: string): boolean;
  updateTaskFields(
    taskId: string,
    input: {
      readonly priority?: string | null;
      readonly dueDate?: number | null;
      readonly dueMilestoneId?: string | null;
      readonly assignee?: string;
    },
  ): CollaborationTask;
}

export function createCollabService(deps: { readonly board: BoardService }): CollabService {
  const conversations = new Map<string, ChannelConversation>();
  const messages = new Map<string, ChannelMessage[]>();
  const tasks = new Map<string, CollaborationTask[]>();
  const events = new Map<string, CollabEvent[]>();
  const decisions = new Map<string, ChannelDecision[]>();
  const approvals = new Map<string, ChannelApproval[]>();

  const service: CollabService = {
    createConversation(input) {
      deps.board.listProjects().find((project) => project.id === input.projectId)
        ?? failNotFound(`project not found: ${input.projectId}`);
      const conversation: ChannelConversation = {
        id: randomUUID(),
        projectId: input.projectId,
        title: input.title,
        createdAt: Date.now(),
      };
      conversations.set(conversation.id, conversation);
      messages.set(conversation.id, []);
      tasks.set(conversation.id, []);
      events.set(conversation.id, []);
      decisions.set(conversation.id, []);
      approvals.set(conversation.id, []);
      return conversation;
    },

    listConversations(projectId) {
      return [...conversations.values()].filter((item) => item.projectId === projectId);
    },

    getConversation(id) {
      return conversations.get(id);
    },

    postMessage(conversationId, input) {
      const conversation = conversations.get(conversationId) ?? failNotFound(`conversation not found: ${conversationId}`);
      const type = parseChannelMessageType(input.type);
      const payload = { ...(input.payload ?? {}) };
      validateTypedPayload(type, payload);
      const messageId = randomUUID();
      const extras = applyMessage({
        board: deps.board,
        conversation,
        type,
        payload,
        from: input.from,
        refs: input.refs ?? {},
        tasks,
        decisions,
        approvals,
        messageId,
      });
      const message: ChannelMessage = {
        id: messageId,
        conversationId,
        projectId: conversation.projectId,
        schemaVersion: 1,
        type,
        createdAt: Date.now(),
        from: input.from,
        to: input.to ?? { kind: 'channel' },
        threadId: null,
        inReplyTo: input.inReplyTo ?? null,
        refs: input.refs ?? {},
        visibility: 'developer',
        payload: {
          ...payload,
          ...(extras.taskId !== undefined ? { taskId: extras.taskId } : {}),
          ...(extras.mktSessionId !== undefined ? { mktSessionId: extras.mktSessionId } : {}),
          ...(extras.childTaskIds !== undefined ? { childTaskIds: extras.childTaskIds } : {}),
          ...(extras.remainingTaskId !== undefined ? { remainingTaskId: extras.remainingTaskId } : {}),
          ...(extras.decisionId !== undefined ? { decisionId: extras.decisionId } : {}),
          ...(extras.approvalId !== undefined ? { approvalId: extras.approvalId } : {}),
        },
      };
      recordEvent(events, conversation, message, extras.eventTargetType ?? 'message', extras.eventTargetId ?? message.id, extras.eventReason ?? 'recorded', true);
      const list = messages.get(conversationId) ?? [];
      list.push(message);
      messages.set(conversationId, list);
      return message;
    },

    listMessages(conversationId) {
      return [...(messages.get(conversationId) ?? [])];
    },

    listTasks(conversationId) {
      return [...(tasks.get(conversationId) ?? [])];
    },

    listOpenTasks(projectId, workItemId) {
      const closed: readonly CollaborationTaskStatus[] = ['completed', 'rejected', 'cancelled'];
      return [...tasks.values()]
        .flat()
        .filter((task) => task.projectId === projectId)
        .filter((task) => !closed.includes(task.status))
        .filter((task) => workItemId === undefined || task.workItemId === workItemId);
    },

    listEvents(conversationId) {
      return [...(events.get(conversationId) ?? [])];
    },

    listDecisions(projectId, workItemId) {
      return [...decisions.values()]
        .flat()
        .filter((item) => item.projectId === projectId)
        .filter((item) => workItemId === undefined || item.workItemId === workItemId);
    },

    listApprovals(filter = {}) {
      return [...approvals.values()]
        .flat()
        .filter((item) => filter.projectId === undefined || item.projectId === filter.projectId)
        .filter((item) => filter.taskId === undefined || item.taskId === filter.taskId)
        .filter((item) => filter.status === undefined || item.status === filter.status);
    },

    listUnresolvedQuestions(projectId, workItemId) {
      const result: UnresolvedChannelQuestion[] = [];
      for (const conversation of conversations.values()) {
        if (conversation.projectId !== projectId) continue;
        const list = messages.get(conversation.id) ?? [];
        for (const message of list) {
          if (message.type === 'task.question') {
            const taskId = typeof message.payload.taskId === 'string' ? message.payload.taskId : '';
            const answered = list.some((later) =>
              later.createdAt >= message.createdAt
              && later.id !== message.id
              && later.type === 'task.answer'
              && later.payload.taskId === taskId,
            );
            if (answered) continue;
            const task = service.getTask(taskId);
            const itemId = message.refs.workItemId ?? task?.workItemId ?? null;
            if (workItemId !== undefined && itemId !== workItemId) continue;
            result.push(questionFromMessage(message, itemId, taskId || null));
            continue;
          }
          if (message.type === 'question.ask') {
            const answered = list.some((later) =>
              later.type === 'question.answer'
              && (later.inReplyTo === message.id || later.payload.questionId === message.id),
            );
            if (answered) continue;
            const itemId = message.refs.workItemId ?? null;
            if (workItemId !== undefined && itemId !== workItemId) continue;
            result.push(questionFromMessage(message, itemId, null));
          }
        }
      }
      return result;
    },

    selectMessagesForTask(taskId) {
      const task = service.getTask(taskId);
      if (task === undefined) return [];
      return (messages.get(task.conversationId) ?? []).filter((message) =>
        message.payload.taskId === task.id
        || message.refs.taskId === task.id
        || (task.workItemId !== null && message.refs.workItemId === task.workItemId),
      );
    },

    hasPendingApproval(taskId) {
      return service.listApprovals({ taskId, status: 'requested' }).length > 0;
    },

    getTask(taskId) {
      for (const list of tasks.values()) {
        const found = list.find((task) => task.id === taskId);
        if (found !== undefined) return found;
      }
      return undefined;
    },

    updateTaskFields(taskId, input) {
      for (const [conversationId, list] of tasks.entries()) {
        const index = list.findIndex((task) => task.id === taskId);
        if (index < 0) continue;
        const current = list[index];
        if (current === undefined) continue;
        const next: CollaborationTask = {
          ...current,
          priority: input.priority !== undefined ? input.priority : current.priority,
          dueDate: input.dueDate !== undefined ? input.dueDate : current.dueDate,
          dueMilestoneId: input.dueMilestoneId !== undefined ? input.dueMilestoneId : current.dueMilestoneId,
          assignee: input.assignee ?? current.assignee,
        };
        list[index] = next;
        tasks.set(conversationId, list);
        return next;
      }
      throw new ChannelWriteError('NOT_FOUND', `collaboration task not found: ${taskId}`);
    },
  };
  return service;
}

interface ApplyMessageInput {
  readonly board: BoardService;
  readonly conversation: ChannelConversation;
  readonly type: ChannelMessageType;
  readonly payload: Record<string, unknown>;
  readonly from: ChannelMessage['from'];
  readonly refs: ChannelMessage['refs'];
  readonly tasks: Map<string, CollaborationTask[]>;
  readonly decisions: Map<string, ChannelDecision[]>;
  readonly approvals: Map<string, ChannelApproval[]>;
  readonly messageId: string;
}

interface ApplyMessageResult {
  readonly taskId?: string;
  readonly mktSessionId?: string;
  readonly childTaskIds?: readonly string[];
  readonly remainingTaskId?: string;
  readonly decisionId?: string;
  readonly approvalId?: string;
  readonly eventTargetType?: CollabEvent['targetType'];
  readonly eventTargetId?: string;
  readonly eventReason?: string;
}

function applyMessage(input: ApplyMessageInput): ApplyMessageResult {
  if (isFirstSliceMessageType(input.type)) {
    return applyFirstSliceMessage(input, input.type);
  }
  return applyLaterCatalogMessage(input, input.type);
}

function applyFirstSliceMessage(input: ApplyMessageInput, type: FirstSliceMessageType): ApplyMessageResult {
  const { board, conversation, payload, from, refs, tasks } = input;
  switch (type) {
    case 'note.chat':
    case 'progress.update':
    case 'question.ask':
    case 'question.answer':
      return {};
    case 'task.question':
      updateTask(tasks, conversation, payload, 'waiting_for_input', undefined);
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'question' };
    case 'task.answer':
      updateTask(tasks, conversation, payload, 'in_progress', undefined);
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'answered' };
    case 'task.propose': {
      const task = createTask(conversation, payload, refs, from, String(payload.assigneeRole), String(payload.objective));
      assertCollaborationWip(board, tasks, conversation.projectId, task.assignee);
      appendTask(tasks, conversation.id, task);
      return { taskId: task.id, eventTargetType: 'task', eventTargetId: task.id, eventReason: 'proposed' };
    }
    case 'task.accept':
      updateTask(tasks, conversation, payload, 'accepted', from.role);
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'accepted' };
    case 'task.decline':
      updateTask(tasks, conversation, payload, 'rejected', from.role);
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'declined' };
    case 'task.block':
    case 'blocker.raise':
      updateTask(tasks, conversation, payload, 'blocked', undefined, {
        blockers: [String(payload.body ?? payload.reason ?? 'blocked')],
      });
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'blocked' };
    case 'task.unblock':
    case 'blocker.resolve':
      updateTask(tasks, conversation, payload, 'in_progress', undefined, { blockers: [] });
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'unblocked' };
    case 'task.complete':
      updateTask(tasks, conversation, payload, 'completed', undefined);
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'completed' };
    case 'task.cancel':
    case 'human.stop':
      updateTask(tasks, conversation, payload, 'cancelled', undefined);
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'cancelled' };
    case 'task.transfer':
      updateTask(tasks, conversation, payload, 'accepted', String(payload.receiverRole));
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'transferred' };
    case 'handoff.request': {
      const task = createTask(
        conversation,
        payload,
        refs,
        from,
        String(payload.receiverRole),
        `handoff:${String(payload.handoffKind)}`,
      );
      assertCollaborationWip(board, tasks, conversation.projectId, task.assignee);
      appendTask(tasks, conversation.id, task);
      return { taskId: task.id, eventTargetType: 'handoff', eventTargetId: task.id, eventReason: 'requested' };
    }
    case 'handoff.accept':
      updateTask(tasks, conversation, payload, 'in_progress', from.role);
      return { taskId: String(payload.taskId), eventTargetType: 'handoff', eventTargetId: String(payload.taskId), eventReason: 'accepted' };
    case 'handoff.decline':
      updateTask(tasks, conversation, payload, 'rejected', undefined);
      return { taskId: String(payload.taskId), eventTargetType: 'handoff', eventTargetId: String(payload.taskId), eventReason: 'declined' };
    case 'report.findings':
      if (payload.delivered === true) {
        throw new ChannelWriteError('VALIDATION', 'report.findings cannot mark customer delivered');
      }
      return { eventReason: 'findings' };
    case 'human.redirect':
      updateTask(tasks, conversation, payload, 'waiting_for_input', String(payload.receiverRole ?? from.role));
      return { taskId: String(payload.taskId), eventTargetType: 'task', eventTargetId: String(payload.taskId), eventReason: 'redirected' };
    case 'customer.question_needed': {
      const session = board.createIntakeSession({
        projectId: conversation.projectId,
        title: '产品问题',
        sourceChannel: 'agent-channel',
        submitter: from.role,
      });
      board.addIntakeMessage(session.id, {
        role: 'assistant',
        author: from.role,
        kind: 'clarifying-question',
        field: typeof payload.field === 'string' && isMktFollowUpField(payload.field) ? payload.field : 'goal',
        body: String(payload.body),
      });
      return { mktSessionId: session.id, eventReason: 'customer-question' };
    }
    default:
      return assertNever(type);
  }
}

function applyLaterCatalogMessage(input: ApplyMessageInput, type: LaterCatalogMessageType): ApplyMessageResult {
  const { board, conversation, payload, from, refs, tasks, decisions, approvals, messageId } = input;
  switch (type) {
    case 'task.split':
      return splitTask(board, conversation, payload, tasks);
    case 'task.merge':
      return mergeTasks(conversation, payload, tasks);
    case 'decision.record': {
      const decision: ChannelDecision = {
        id: randomUUID(),
        conversationId: conversation.id,
        projectId: conversation.projectId,
        workItemId: refs.workItemId ?? null,
        taskId: optionalText(payload.taskId) ?? refs.taskId ?? null,
        body: String(payload.body),
        actor: from.memberId ?? from.agentRunId ?? from.role,
        createdAt: Date.now(),
        messageId,
      };
      const list = decisions.get(conversation.id) ?? [];
      list.push(decision);
      decisions.set(conversation.id, list);
      return {
        decisionId: decision.id,
        eventTargetType: 'decision',
        eventTargetId: decision.id,
        eventReason: 'decision-recorded',
      };
    }
    case 'approval.request':
    case 'approval.granted':
    case 'approval.rejected':
      return recordApproval(conversation, payload, from, refs, approvals, messageId, type);
    default: {
      throw new ChannelWriteError('UNKNOWN_TYPE', `unhandled later catalog type: ${String(type)}`);
    }
  }
}

function assertCollaborationWip(
  board: BoardService,
  tasks: Map<string, CollaborationTask[]>,
  projectId: ProjectId,
  roleId: string,
): void {
  const project = board.listProjects().find((item) => item.id === projectId);
  if (project === undefined) return;
  const closed: readonly CollaborationTaskStatus[] = ['completed', 'rejected', 'cancelled'];
  const open = [...tasks.values()]
    .flat()
    .filter((task) => task.projectId === projectId && !closed.includes(task.status));
  for (const policy of project.wipPolicies) {
    if (policy.kind !== 'collaboration-task') continue;
    if (policy.scope === 'role' && policy.scopeId !== roleId) continue;
    const count = policy.scope === 'role'
      ? open.filter((task) => task.assignee === roleId || task.ownerRole === roleId).length
      : open.length;
    if (count >= policy.limit) {
      throw new ChannelWriteError(
        'VALIDATION',
        `WIP policy ${policy.kind}/${policy.scope}:${policy.scopeId} exceeds limit ${String(policy.limit)}`,
      );
    }
  }
}

function createTask(
  conversation: ChannelConversation,
  payload: Record<string, unknown>,
  refs: ChannelMessage['refs'],
  from: ChannelMessage['from'],
  ownerRole: string,
  objective: string,
): CollaborationTask {
  const assigneeKind = payload.assigneeKind === 'human' ? 'human' : 'agent';
  const dueDate = typeof payload.dueDate === 'number' && Number.isFinite(payload.dueDate) ? payload.dueDate : null;
  const workItemId = refs.workItemId ?? null;
  return {
    id: randomUUID(),
    conversationId: conversation.id,
    projectId: conversation.projectId,
    status: 'proposed',
    requester: from.role,
    ownerRole,
    assigneeKind,
    assignee: typeof payload.assignee === 'string' && payload.assignee.trim() !== '' ? payload.assignee : ownerRole,
    objective,
    inputs: asStrings(payload.inputs),
    requiredSkills: asStrings(payload.requiredSkills),
    allowedTools: asStrings(payload.allowedTools),
    expectedOutput: String(payload.expectedOutput ?? payload.outputSchema ?? ''),
    checks: asStrings(payload.checks),
    dueMilestoneId: optionalText(payload.dueMilestoneId) ?? refs.milestoneId ?? null,
    dueDate,
    priority: optionalText(payload.priority),
    blockers: [],
    contextTags: {
      workItemId,
      milestoneId: refs.milestoneId ?? optionalText(payload.milestoneId),
      branchId: refs.branchId ?? optionalText(payload.branchId),
      pullRequestId: refs.pullRequestId ?? optionalText(payload.pullRequestId),
      ciRunId: refs.ciRunId ?? optionalText(payload.ciRunId),
      sourceDocumentId: refs.sourceDocumentId ?? optionalText(payload.sourceDocumentId),
    },
    workItemId,
    parentTaskId: optionalText(payload.parentTaskId),
    mergedFromTaskIds: asStrings(payload.mergedFromTaskIds),
  };
}

function splitTask(
  board: BoardService,
  conversation: ChannelConversation,
  payload: Record<string, unknown>,
  tasks: Map<string, CollaborationTask[]>,
): ApplyMessageResult {
  const parent = requireTask(tasks, conversation.id, String(payload.taskId));
  const objectives = asStrings(payload.childObjectives);
  if (objectives.length === 0) {
    throw new ChannelWriteError('VALIDATION', 'childObjectives must be a non-empty string array');
  }
  const childTaskIds: string[] = [];
  for (const objective of objectives) {
    const child: CollaborationTask = {
      ...parent,
      id: randomUUID(),
      status: 'proposed',
      objective,
      blockers: [],
      parentTaskId: parent.id,
      mergedFromTaskIds: [],
    };
    assertCollaborationWip(board, tasks, conversation.projectId, child.assignee);
    appendTask(tasks, conversation.id, child);
    childTaskIds.push(child.id);
  }
  return {
    taskId: parent.id,
    childTaskIds,
    eventTargetType: 'task',
    eventTargetId: parent.id,
    eventReason: 'split',
  };
}

function mergeTasks(
  conversation: ChannelConversation,
  payload: Record<string, unknown>,
  tasks: Map<string, CollaborationTask[]>,
): ApplyMessageResult {
  const ids = asStrings(payload.taskIds);
  if (ids.length < 2) {
    throw new ChannelWriteError('VALIDATION', 'taskIds must include at least two tasks');
  }
  const remainingId = ids[0] ?? '';
  const remaining = requireTask(tasks, conversation.id, remainingId);
  const mergedFrom = ids.slice(1);
  for (const taskId of mergedFrom) {
    updateTask(tasks, conversation, { taskId }, 'cancelled', undefined);
  }
  const list = tasks.get(conversation.id) ?? [];
  const index = list.findIndex((task) => task.id === remaining.id);
  if (index < 0) {
    throw new ChannelWriteError('NOT_FOUND', `collaboration task not found: ${remaining.id}`);
  }
  const current = list[index];
  if (current === undefined) {
    throw new ChannelWriteError('NOT_FOUND', `collaboration task not found: ${remaining.id}`);
  }
  list[index] = {
    ...current,
    objective: String(payload.objective),
    status: current.status === 'cancelled' || current.status === 'rejected' ? 'proposed' : current.status,
    mergedFromTaskIds: mergedFrom,
  };
  tasks.set(conversation.id, list);
  return {
    taskId: remaining.id,
    remainingTaskId: remaining.id,
    eventTargetType: 'task',
    eventTargetId: remaining.id,
    eventReason: 'merged',
  };
}

function recordApproval(
  conversation: ChannelConversation,
  payload: Record<string, unknown>,
  from: ChannelMessage['from'],
  refs: ChannelMessage['refs'],
  approvals: Map<string, ChannelApproval[]>,
  messageId: string,
  type: 'approval.request' | 'approval.granted' | 'approval.rejected',
): ApplyMessageResult {
  const taskId = String(payload.taskId);
  const status: ChannelApprovalStatus = type === 'approval.request' ? 'requested' : type === 'approval.granted' ? 'granted' : 'rejected';
  const list = approvals.get(conversation.id) ?? [];
  const pendingIndex = list.findIndex((item) => item.taskId === taskId && item.status === 'requested');
  const pending = pendingIndex >= 0 ? list[pendingIndex] : undefined;
  const record: ChannelApproval = {
    id: pending?.id ?? randomUUID(),
    conversationId: conversation.id,
    projectId: conversation.projectId,
    workItemId: refs.workItemId ?? pending?.workItemId ?? null,
    taskId,
    status,
    actor: from.memberId ?? from.agentRunId ?? from.role,
    reason: typeof payload.reason === 'string' ? payload.reason : status,
    createdAt: Date.now(),
    messageId,
  };
  if (pendingIndex >= 0) {
    list[pendingIndex] = record;
  } else {
    list.push(record);
  }
  approvals.set(conversation.id, list);
  return {
    taskId,
    approvalId: record.id,
    eventTargetType: 'approval',
    eventTargetId: record.id,
    eventReason: status,
  };
}

function requireTask(
  tasks: Map<string, CollaborationTask[]>,
  conversationId: string,
  taskId: string,
): CollaborationTask {
  const found = (tasks.get(conversationId) ?? []).find((task) => task.id === taskId);
  if (found === undefined) {
    throw new ChannelWriteError('NOT_FOUND', `collaboration task not found: ${taskId}`);
  }
  return found;
}

function questionFromMessage(
  message: ChannelMessage,
  workItemId: WorkItemId | null,
  taskId: string | null,
): UnresolvedChannelQuestion {
  return {
    id: message.id,
    conversationId: message.conversationId,
    projectId: message.projectId,
    workItemId,
    taskId,
    type: message.type === 'task.question' ? 'task.question' : 'question.ask',
    body: String(message.payload.body ?? ''),
    createdAt: message.createdAt,
  };
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function updateTask(
  tasks: Map<string, CollaborationTask[]>,
  conversation: ChannelConversation,
  payload: Record<string, unknown>,
  status: CollaborationTaskStatus,
  ownerRole: string | undefined,
  extra: Partial<Pick<CollaborationTask, 'blockers' | 'assignee'>> = {},
): void {
  const taskId = String(payload.taskId);
  const list = tasks.get(conversation.id) ?? [];
  const index = list.findIndex((task) => task.id === taskId);
  if (index < 0) {
    throw new ChannelWriteError('NOT_FOUND', `collaboration task not found: ${taskId}`);
  }
  const current = list[index];
  if (current === undefined) {
    throw new ChannelWriteError('NOT_FOUND', `collaboration task not found: ${taskId}`);
  }
  const nextOwner = ownerRole ?? current.ownerRole;
  const nextAssignee = extra.assignee ?? (ownerRole !== undefined ? ownerRole : current.assignee);
  const nextBlockers = extra.blockers ?? current.blockers;
  if (
    status === current.status &&
    nextOwner === current.ownerRole &&
    nextAssignee === current.assignee &&
    nextBlockers.length === current.blockers.length
  ) {
    throw new ChannelWriteError('TRANSITION', 'handoff must change state or owner');
  }
  list[index] = {
    ...current,
    status,
    ownerRole: nextOwner,
    assignee: nextAssignee,
    blockers: nextBlockers,
  };
  tasks.set(conversation.id, list);
}

function appendTask(tasks: Map<string, CollaborationTask[]>, conversationId: string, task: CollaborationTask): void {
  const list = tasks.get(conversationId) ?? [];
  list.push(task);
  tasks.set(conversationId, list);
}

function recordEvent(
  events: Map<string, CollabEvent[]>,
  conversation: ChannelConversation,
  message: ChannelMessage,
  targetType: CollabEvent['targetType'],
  targetId: string,
  reason: string,
  accepted: boolean,
): void {
  const list = events.get(conversation.id) ?? [];
  list.push({
    id: randomUUID(),
    conversationId: conversation.id,
    projectId: conversation.projectId,
    actor: message.from.memberId ?? message.from.agentRunId ?? message.from.role,
    actorRole: message.from.role,
    targetType,
    targetId,
    reason,
    createdAt: message.createdAt,
    correlationId: message.id,
    accepted,
  });
  events.set(conversation.id, list);
}

function asStrings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function failNotFound(message: string): never {
  throw new ChannelWriteError('NOT_FOUND', message);
}
