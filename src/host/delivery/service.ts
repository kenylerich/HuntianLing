/**
 * Story delivery runs with durable checkpoints.
 */

import { randomUUID } from 'node:crypto';

import type { AgentRuntime } from '../agents/runtime.js';
import { workItemDesignRevision } from '../board/executed-evidence.js';
import type { BoardService } from '../board/plugin.js';
import type { WorkItem, WorkItemId } from '../board/types.js';
import { validateDefinitionOfReady } from '../board/work-item.js';
import { loadDeliveryRuns, saveDeliveryRuns } from './store.js';
import {
  DeliveryError,
  resolveDeliveryConfig,
  STORY_DELIVERY_STEPS,
  type DeliveryConfig,
  type ResolvedDeliveryConfig,
  type StartStoryDeliveryInput,
  type StoryDeliveryCheckpoint,
  type StoryDeliveryEvent,
  type StoryDeliveryRun,
  type StoryDeliveryStep,
} from './types.js';

const ACTIVE: readonly StoryDeliveryRun['status'][] = ['running', 'paused', 'interrupted'];

export interface DeliveryService {
  start(input: StartStoryDeliveryInput): StoryDeliveryRun;
  get(runId: string): StoryDeliveryRun;
  listForWorkItem(workItemId: string): readonly StoryDeliveryRun[];
  listForProject(projectId: string): readonly StoryDeliveryRun[];
  advance(runId: string, actor?: string): StoryDeliveryRun;
  drive(runId: string, actor?: string): StoryDeliveryRun;
  interrupt(runId: string, actor?: string): StoryDeliveryRun;
  resume(runId: string, actor?: string): StoryDeliveryRun;
  pause(runId: string, reason: string, actor?: string): StoryDeliveryRun;
  cancel(runId: string, reason: string, actor?: string): StoryDeliveryRun;
  ingestEvent(input: {
    readonly runId: string;
    readonly key: string;
    readonly type: string;
    readonly actor?: string;
    readonly reason?: string;
    readonly seq: number;
  }): StoryDeliveryRun;
}

export function createDeliveryService(deps: {
  readonly board: BoardService;
  readonly agents: AgentRuntime;
  readonly workspaceRoot: string;
  readonly config?: DeliveryConfig;
}): DeliveryService {
  const config = resolveDeliveryConfig(deps.config ?? {});
  let runs = loadDeliveryRuns(deps.workspaceRoot);

  const service: DeliveryService = {
    start(input) {
      const item = requireStory(deps.board, input.workItemId);
      const policy = deps.board.listProjects({ includeArchived: true }).find((project) => project.id === item.projectId)?.deliveryPolicy;
      const readyError = validateDefinitionOfReady(item, policy ?? null);
      if (readyError !== null) {
        throw new DeliveryError('NOT_READY', readyMessage(readyError.kind));
      }
      if (runs.some((run) => run.workItemId === item.id && ACTIVE.includes(run.status))) {
        throw new DeliveryError('CONFLICT', `story ${item.id} already has an active delivery run`);
      }
      const actor = input.actor ?? 'developer';
      const now = Date.now();
      const revision = workItemDesignRevision(item);
      const runId = randomUUID();
      const checkpoint = emptyCheckpoint(item, actor, revision);
      const started: StoryDeliveryRun = {
        id: runId,
        projectId: item.projectId,
        workItemId: item.id,
        status: 'running',
        environmentReady: input.environmentReady === true,
        agentRunIds: [],
        checkpoint,
        events: [],
        createdAt: now,
        updatedAt: now,
      };
      const withEvent = appendAccepted(started, {
        key: `start:${item.id}:${runId}`,
        type: 'story_delivery.started',
        actor,
        reason: input.reason ?? 'start story delivery',
      });
      persist(withEvent);
      audit(deps.board, withEvent, 'story_delivery.started', actor);
      if (input.drive === true) return service.drive(withEvent.id, actor);
      return withEvent;
    },

    get(runId) {
      return requireRun(runId);
    },

    listForWorkItem(workItemId) {
      return runs.filter((run) => run.workItemId === workItemId);
    },

    listForProject(projectId) {
      return runs.filter((run) => run.projectId === projectId);
    },

    advance(runId, actor = 'developer') {
      const run = requireRun(runId);
      if (run.status !== 'running') {
        throw new DeliveryError('CONFLICT', `run ${runId} is ${run.status}`);
      }
      const key = `advance:${runId}:${run.checkpoint.seq}`;
      const duplicate = run.events.find((event) => event.key === key && event.accepted);
      if (duplicate !== undefined) return run;
      return executeStep(run, actor, config, key);
    },

    drive(runId, actor = 'developer') {
      let run = requireRun(runId);
      while (run.status === 'running' && run.checkpoint.pendingSteps.length > 0) {
        run = service.advance(run.id, actor);
      }
      return run;
    },

    interrupt(runId, actor = 'developer') {
      const run = requireRun(runId);
      if (run.status !== 'running' && run.status !== 'paused') {
        throw new DeliveryError('CONFLICT', `run ${runId} is ${run.status}`);
      }
      const next = withStatus(run, 'interrupted', {
        key: `interrupt:${runId}:${run.checkpoint.seq}`,
        type: 'story_delivery.interrupted',
        actor,
        reason: 'interrupt',
        nextAction: 'resume',
      });
      persist(next);
      audit(deps.board, next, 'story_delivery.interrupted', actor);
      return next;
    },

    resume(runId, actor = 'developer') {
      const run = requireRun(runId);
      if (run.status !== 'interrupted' && run.status !== 'paused') {
        if (run.status === 'running') return run;
        throw new DeliveryError('CONFLICT', `run ${runId} is ${run.status}`);
      }
      const item = requireStory(deps.board, run.workItemId);
      const currentRevision = workItemDesignRevision(item);
      if (run.checkpoint.designRevision !== currentRevision) {
        const blocked = withStatus(run, 'blocked', {
          key: `stale:${runId}:${run.checkpoint.seq}`,
          type: 'story_delivery.stale',
          actor,
          reason: 'design revision changed after checkpoint',
          blockers: ['stale after design revision'],
          nextAction: 'revalidate scope',
        });
        persist(blocked);
        return blocked;
      }
      const next = withStatus(run, 'running', {
        key: `resume:${runId}:${run.checkpoint.seq}`,
        type: 'story_delivery.resumed',
        actor,
        reason: 'resume',
        nextAction: run.checkpoint.pendingSteps[0] ?? 'complete',
      });
      persist(next);
      audit(deps.board, next, 'story_delivery.resumed', actor);
      return next;
    },

    pause(runId, reason, actor = 'developer') {
      const run = requireRun(runId);
      if (run.status !== 'running') {
        throw new DeliveryError('CONFLICT', `run ${runId} is ${run.status}`);
      }
      if (reason.trim() === '') {
        throw new DeliveryError('VALIDATION', 'pause reason is required');
      }
      const next = withStatus(run, 'paused', {
        key: `pause:${runId}:${run.checkpoint.seq}`,
        type: 'story_delivery.paused',
        actor,
        reason,
        nextAction: 'resume',
      });
      persist(next);
      audit(deps.board, next, 'story_delivery.paused', actor);
      return next;
    },

    cancel(runId, reason, actor = 'developer') {
      const run = requireRun(runId);
      if (!ACTIVE.includes(run.status)) {
        throw new DeliveryError('CONFLICT', `run ${runId} is ${run.status}`);
      }
      if (reason.trim() === '') {
        throw new DeliveryError('VALIDATION', 'cancel reason is required');
      }
      const next = withStatus(run, 'cancelled', {
        key: `cancel:${runId}:${run.checkpoint.seq}`,
        type: 'story_delivery.cancelled',
        actor,
        reason,
        nextAction: 'recover or start a new run',
      });
      persist(next);
      audit(deps.board, next, 'story_delivery.cancelled', actor);
      return next;
    },

    ingestEvent(input) {
      const run = requireRun(input.runId);
      const existing = run.events.find((event) => event.key === input.key);
      if (existing !== undefined) {
        const rejected = makeEvent(run, {
          key: `${input.key}:duplicate`,
          type: input.type,
          actor: input.actor ?? 'developer',
          reason: input.reason ?? 'duplicate event',
        }, false, 'duplicate event');
        const next = { ...run, events: [...run.events, rejected], updatedAt: rejected.at };
        persist(next);
        return next;
      }
      if (input.seq < run.checkpoint.seq) {
        const rejected = makeEvent(run, {
          key: input.key,
          type: input.type,
          actor: input.actor ?? 'developer',
          reason: input.reason ?? 'stale event',
        }, false, 'stale event');
        const next = { ...run, events: [...run.events, rejected], updatedAt: rejected.at };
        persist(next);
        return next;
      }
      throw new DeliveryError('STALE', `event ${input.key} is not an accepted control event`);
    },
  };

  function requireRun(runId: string): StoryDeliveryRun {
    const found = runs.find((run) => run.id === runId);
    if (found === undefined) throw new DeliveryError('NOT_FOUND', `run not found: ${runId}`);
    return found;
  }

  function persist(next: StoryDeliveryRun): void {
    const exists = runs.some((run) => run.id === next.id);
    runs = exists ? runs.map((run) => (run.id === next.id ? next : run)) : [...runs, next];
    saveDeliveryRuns(deps.workspaceRoot, runs);
  }

  function executeStep(
    run: StoryDeliveryRun,
    actor: string,
    resolved: ResolvedDeliveryConfig,
    key: string,
  ): StoryDeliveryRun {
    if (run.checkpoint.budgetUsage.steps >= resolved.maxSteps) {
      const blocked = withStatus(run, 'blocked', {
        key: `limit-steps:${run.id}:${run.checkpoint.seq}`,
        type: 'story_delivery.limit',
        actor,
        reason: 'step budget exhausted',
        blockers: ['maxSteps'],
        nextAction: 'human decision',
      });
      persist(blocked);
      return blocked;
    }
    const step = run.checkpoint.pendingSteps[0];
    if (step === undefined) {
      const completed = withStatus(run, 'completed', {
        key: `complete:${run.id}:${run.checkpoint.seq}`,
        type: 'story_delivery.completed',
        actor,
        reason: 'no pending steps',
        nextAction: 'complete',
      });
      persist(completed);
      return completed;
    }
    if (run.checkpoint.completedSteps.includes(step)) {
      const skipped = appendAccepted(run, {
        key,
        type: 'step.skipped',
        actor,
        reason: `${step} already completed`,
      });
      persist(skipped);
      return skipped;
    }

    const item = requireStory(deps.board, run.workItemId);
    const currentRevision = workItemDesignRevision(item);
    if (run.checkpoint.designRevision !== currentRevision) {
      const blocked = withStatus(run, 'blocked', {
        key: `stale-step:${run.id}:${run.checkpoint.seq}`,
        type: 'story_delivery.stale',
        actor,
        reason: 'design revision changed after checkpoint',
        blockers: ['stale after design revision'],
        nextAction: 'revalidate scope',
      });
      persist(blocked);
      return blocked;
    }

    try {
      const { output, agentRunId } = runAgentStep(deps.agents, run, item, step);
      const decisions = { ...run.checkpoint.decisions, [step]: output };
      const agentRunIds = [...run.agentRunIds, agentRunId];
      if (step === 'evaluate' && isRevisionRequired(output)) {
        if (run.checkpoint.budgetUsage.retries >= resolved.maxRetries) {
          const blocked = replaceRun({
            ...run,
            status: 'blocked',
            agentRunIds,
            checkpoint: {
              ...run.checkpoint,
              seq: run.checkpoint.seq + 1,
              decisions,
              blockers: ['retry limit'],
              budgetUsage: {
                steps: run.checkpoint.budgetUsage.steps + 1,
                retries: run.checkpoint.budgetUsage.retries,
              },
              nextAction: 'human decision',
              evidenceRefs: evidenceRefs(decisions),
            },
            updatedAt: Date.now(),
          }, {
            key,
            type: 'story_delivery.limit',
            actor,
            reason: 'retry limit exhausted',
          });
          persist(blocked);
          return blocked;
        }
        const repaired = replaceRun({
          ...run,
          agentRunIds,
          checkpoint: {
            ...run.checkpoint,
            seq: run.checkpoint.seq + 1,
            completedSteps: run.checkpoint.completedSteps.filter((itemStep) => itemStep !== 'implement'),
            pendingSteps: ['implement', 'evaluate'],
            decisions,
            blockers: [],
            budgetUsage: {
              steps: run.checkpoint.budgetUsage.steps + 1,
              retries: run.checkpoint.budgetUsage.retries + 1,
            },
            nextAction: 'implement',
            evidenceRefs: evidenceRefs(decisions),
          },
          updatedAt: Date.now(),
        }, {
          key,
          type: 'step.repair',
          actor,
          reason: 'evaluator requested revision',
        });
        persist(repaired);
        return repaired;
      }

      const completedSteps = [...run.checkpoint.completedSteps, step];
      const pendingSteps = run.checkpoint.pendingSteps.slice(1);
      const done = pendingSteps.length === 0;
      const advanced = replaceRun({
        ...run,
        status: done ? 'completed' : 'running',
        agentRunIds,
        checkpoint: {
          ...run.checkpoint,
          seq: run.checkpoint.seq + 1,
          completedSteps,
          pendingSteps,
          decisions,
          blockers: [],
          budgetUsage: {
            steps: run.checkpoint.budgetUsage.steps + 1,
            retries: run.checkpoint.budgetUsage.retries,
          },
          nextAction: done ? 'complete' : pendingSteps[0] ?? 'complete',
          evidenceRefs: evidenceRefs(decisions),
        },
        updatedAt: Date.now(),
      }, {
        key,
        type: done ? 'story_delivery.completed' : 'step.completed',
        actor,
        reason: `${step} completed`,
      });
      persist(advanced);
      return advanced;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'step failed';
      const blocked = withStatus(run, 'blocked', {
        key,
        type: 'story_delivery.blocked',
        actor,
        reason: message,
        blockers: [message],
        nextAction: 'repair or cancel',
      });
      persist(blocked);
      return blocked;
    }
  }

  return service;
}

function runAgentStep(
  agents: AgentRuntime,
  run: StoryDeliveryRun,
  item: WorkItem,
  step: StoryDeliveryStep,
): { readonly output: unknown; readonly agentRunId: string } {
  if (step === 'plan') {
    const planned = agents.startRun({
      agentId: 'planner',
      executor: 'manual',
      projectId: item.projectId,
      workItemId: item.id,
      input: plannerInput(item),
    });
    return { output: planned.output, agentRunId: planned.id };
  }
  if (step === 'implement') {
    const planned = asObject(run.checkpoint.decisions.plan);
    const generated = agents.startRun({
      agentId: 'generator',
      executor: 'manual',
      projectId: item.projectId,
      workItemId: item.id,
      environmentReady: run.environmentReady,
      input: {
        outcome: typeof planned.outcome === 'string' ? planned.outcome : item.title,
        acceptance: run.checkpoint.acceptance,
      },
    });
    return { output: generated.output, agentRunId: generated.id };
  }
  const generated = asObject(run.checkpoint.decisions.implement);
  const evaluated = agents.startRun({
    agentId: 'evaluator',
    executor: 'manual',
    projectId: item.projectId,
    workItemId: item.id,
    input: {
      independent: true,
      outcome: typeof generated.outcome === 'string' ? generated.outcome : item.title,
      acceptance: run.checkpoint.acceptance,
      ...(generated.selfCheck !== undefined ? { selfCheck: generated.selfCheck } : {}),
    },
  });
  return { output: evaluated.output, agentRunId: evaluated.id };
}

function plannerInput(item: WorkItem): Record<string, unknown> {
  const quote = item.sourceInput.trim() === '' ? item.body : item.sourceInput;
  return {
    quotes: [{ text: quote, source: 'work-item' }],
    goal: item.title,
    actors: ['developer'],
    confirmed: true,
    acceptance: [...item.acceptance],
  };
}

function requireStory(board: BoardService, workItemId: string): WorkItem {
  const item = board.getWorkItem(workItemId as WorkItemId);
  if (item === undefined) throw new DeliveryError('NOT_FOUND', `work item not found: ${workItemId}`);
  if (item.type !== 'story') {
    throw new DeliveryError('VALIDATION', `delivery runs require a story: ${item.id}`);
  }
  return item;
}

function emptyCheckpoint(item: WorkItem, owner: string, revision: string): StoryDeliveryCheckpoint {
  return {
    seq: 0,
    designRevision: revision,
    acceptance: [...item.acceptance],
    completedSteps: [],
    pendingSteps: [...STORY_DELIVERY_STEPS],
    owner,
    blockers: [],
    decisions: {},
    repositoryRevision: '',
    evidenceRefs: [],
    budgetUsage: { steps: 0, retries: 0 },
    nextAction: 'plan',
  };
}

function appendAccepted(
  run: StoryDeliveryRun,
  input: { key: string; type: string; actor: string; reason: string },
): StoryDeliveryRun {
  const duplicate = run.events.find((event) => event.key === input.key);
  if (duplicate !== undefined) {
    if (duplicate.accepted) return run;
    throw new DeliveryError('DUPLICATE', `event ${input.key} was already rejected`);
  }
  const event = makeEvent(run, input, true, '');
  return {
    ...run,
    checkpoint: { ...run.checkpoint, seq: run.checkpoint.seq + 1 },
    events: [...run.events, event],
    updatedAt: event.at,
  };
}

function replaceRun(
  run: StoryDeliveryRun,
  input: { key: string; type: string; actor: string; reason: string },
): StoryDeliveryRun {
  const duplicate = run.events.find((event) => event.key === input.key && event.accepted);
  if (duplicate !== undefined) return run;
  const stale = run.events.find((event) => event.key === input.key && !event.accepted);
  if (stale !== undefined) {
    throw new DeliveryError('DUPLICATE', `event ${input.key} was already rejected`);
  }
  const event = makeEvent(run, input, true, '');
  return { ...run, events: [...run.events, event], updatedAt: event.at };
}

function withStatus(
  run: StoryDeliveryRun,
  status: StoryDeliveryRun['status'],
  input: {
    key: string;
    type: string;
    actor: string;
    reason: string;
    nextAction?: string;
    blockers?: readonly string[];
  },
): StoryDeliveryRun {
  const duplicate = run.events.find((event) => event.key === input.key);
  if (duplicate !== undefined) {
    if (duplicate.accepted) return run;
    const rejected = makeEvent(run, input, false, 'duplicate event');
    return { ...run, events: [...run.events, rejected], updatedAt: rejected.at };
  }
  const event = makeEvent(run, input, true, '');
  return {
    ...run,
    status,
    checkpoint: {
      ...run.checkpoint,
      seq: run.checkpoint.seq + 1,
      nextAction: input.nextAction ?? run.checkpoint.nextAction,
      blockers: input.blockers ?? run.checkpoint.blockers,
    },
    events: [...run.events, event],
    updatedAt: event.at,
  };
}

function makeEvent(
  run: StoryDeliveryRun,
  input: { key: string; type: string; actor: string; reason: string },
  accepted: boolean,
  rejection: string,
): StoryDeliveryEvent {
  return {
    id: randomUUID(),
    key: input.key,
    type: input.type,
    runId: run.id,
    workItemId: run.workItemId,
    actor: input.actor,
    reason: input.reason,
    at: Date.now(),
    seq: run.checkpoint.seq,
    accepted,
    rejection,
  };
}

function audit(board: BoardService, run: StoryDeliveryRun, action: string, actor: string): void {
  board.recordAuditEvent({
    projectId: run.projectId as WorkItem['projectId'],
    actorId: actor,
    action,
    targetType: 'story_delivery',
    targetId: run.id,
    targetLabel: run.workItemId,
    requestSource: 'delivery',
    changedFields: ['status', 'checkpoint'],
  });
}

function isRevisionRequired(output: unknown): boolean {
  return asObject(output).decision === 'revision-required';
}

function evidenceRefs(decisions: Readonly<Record<string, unknown>>): readonly string[] {
  const evaluate = asObject(decisions.evaluate);
  const criteria = Array.isArray(evaluate.criteria) ? evaluate.criteria : [];
  return criteria
    .map((row) => asObject(row).id)
    .filter((id): id is string => typeof id === 'string' && id !== '');
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readyMessage(kind: string): string {
  switch (kind) {
    case 'missing_analysis_for_ready':
      return 'Story is missing analysis';
    case 'missing_design_for_ready':
      return 'Story is missing design';
    case 'missing_acceptance_for_requirement':
      return 'Story is missing acceptance';
    case 'missing_milestone_for_ready':
      return 'Story is missing a milestone';
    case 'blocked_work_items_for_ready':
      return 'Story is blocked by other work';
    default:
      return `Story is not ready: ${kind}`;
  }
}
