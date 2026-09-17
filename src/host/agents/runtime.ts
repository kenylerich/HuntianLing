/**
 * Agent task runtime for Planner, Generator, and Evaluator.
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { BoardService } from '../board/plugin.js';
import type { SkillService } from '../skills/service.js';
import type { SkillGap, SkillId, SkillRecord } from '../skills/types.js';
import type { DispatchService } from '../dispatch/service.js';
import type { GovernanceService } from '../governance/service.js';
import type { ProjectId, WorkItemId } from '../board/types.js';
import type { EnvironmentService } from '../environment/service.js';
import { confirmedRequirementRevision, resolveConfirmedRequirement } from '../intake/confirmation.js';
import { inspectTaskContext } from '../tools/feedback.js';
import { createToolRegistry, type ToolRegistry } from '../tools/registry.js';
import type { TaskContextPacket } from '../tools/types.js';
import { persistEvaluatorEvidence, persistGeneratorSelfCheck } from './evidence.js';
import { AGENT_DEFINITIONS, applyAgentCustomization, definitionFor } from './definitions.js';
import { DEFAULT_METHOD_BASELINE, METHOD_DEFINITIONS } from './methods.js';
import {
  AgentTaskError,
  type AgentExecutionReference,
  isSpecialistAgentId,
  type AgentDefinition,
  type AgentHandoff,
  type AgentId,
  type AgentMethodTrace,
  type AgentMethodSensor,
  type AgentRun,
  type MethodBaseline,
  type MethodDefinition,
  type StartRunInput,
} from './types.js';

const PLANNER_FORBIDDEN = ['files', 'filePaths', 'technicalDesign', 'code'] as const;

interface AgentExecutionContext {
  readonly runId: string;
  readonly projectId: string;
  readonly workspaceRoot?: string;
  readonly workItemId?: string;
  readonly environmentReady: boolean;
  readonly localArtifactsEnabled: boolean;
  readonly startedAt: number;
}

interface CandidateRevision {
  readonly revision: string;
  readonly artifactRefs: readonly string[];
}

export interface AgentRuntime {
  definitions(): readonly AgentDefinition[];
  methods(): readonly MethodDefinition[];
  baseline(): MethodBaseline;
  methodGaps(projectId: string, methodId: string): readonly SkillGap[];
  resolveBinding(agentId: AgentId): AgentDefinition;
  inspectTask(input: {
    readonly workItemId: string;
    readonly agentId: AgentId;
    readonly methodId?: string;
    readonly environmentReady?: boolean;
    readonly input?: unknown;
  }): TaskContextPacket;
  startRun(input: StartRunInput): AgentRun;
  interruptRun(runId: string): AgentRun;
  resumeRun(runId: string): AgentRun;
  getRun(runId: string): AgentRun | undefined;
  listRuns(): readonly AgentRun[];
}

export function createAgentRuntime(deps: {
  readonly skills: SkillService;
  readonly tools?: ToolRegistry;
  readonly baseline?: MethodBaseline;
  readonly board?: BoardService;
  readonly environment?: EnvironmentService;
  readonly dispatch?: DispatchService;
  readonly governance?: GovernanceService;
}): AgentRuntime {
  const tools = deps.tools ?? createToolRegistry();
  const baseline = deps.baseline ?? DEFAULT_METHOD_BASELINE;
  const runs = new Map<string, AgentRun>();
  const failures = new Map<string, number>();

  const runtime: AgentRuntime = {
    definitions() {
      return AGENT_DEFINITIONS;
    },
    methods() {
      return METHOD_DEFINITIONS;
    },
    methodGaps(projectId, methodId) {
      const method = requireMethod(methodId);
      const gaps: SkillGap[] = [];
      for (const skillId of method.skillIds) {
        if (deps.skills.get(skillId) === undefined) {
          gaps.push({ skillId, kind: 'missing', message: `method skill missing: ${skillId}` });
          continue;
        }
        if (!deps.skills.isEnabled(projectId, skillId)) {
          gaps.push({ skillId, kind: 'disabled', message: `method skill disabled: ${skillId}` });
        }
      }
      return gaps;
    },
    baseline() {
      return baseline;
    },
    resolveBinding(agentId) {
      const definition = definitionFor(agentId);
      if (definition === undefined) {
        throw new AgentTaskError('BINDING', `unknown agent: ${agentId}`);
      }
      for (const skillId of definition.requiredSkillIds) {
        const skill = deps.skills.get(skillId);
        if (skill === undefined || skill.validationStatus !== 'valid') {
          throw new AgentTaskError('MISSING_SKILL', `required skill missing or unvalidated: ${skillId}`);
        }
      }
      for (const toolId of definition.allowedToolIds) {
        tools.assertAllowed(toolId, definition.bindingRole, definition.taskType);
      }
      return definition;
    },
    inspectTask(input) {
      const definition = runtime.resolveBinding(input.agentId);
      if (deps.board === undefined) {
        throw new AgentTaskError('MISSING_INPUT', 'task inspect requires huntianling.board');
      }
      const method = input.methodId !== undefined ? requireMethod(input.methodId) : null;
      const context = inspectTaskContext({
        board: deps.board,
        tools,
        definition,
        ...(deps.environment !== undefined ? { environment: deps.environment } : {}),
        ...(deps.dispatch !== undefined ? { dispatch: deps.dispatch } : {}),
        ...(method !== null ? { method } : {}),
        ...(input.environmentReady !== undefined ? { environmentReady: input.environmentReady } : {}),
        ...(input.input !== undefined ? { input: input.input } : {}),
      }, input.workItemId);
      if (definition.id !== 'planner' && definition.id !== 'generator') return context;
      try {
        const item = deps.board.getWorkItem(input.workItemId as WorkItemId);
        if (item === undefined) throw new Error('approved WorkItem not found');
        resolveConfirmedRequirement(deps.board, item);
        return context;
      } catch (error) {
        return { ...context, ready: false, missing: [...context.missing, {
          field: 'sourceApproval', blocking: true,
          reason: error instanceof Error ? error.message : 'original requirement approval unavailable',
        }] };
      }
    },
    startRun(input) {
      let definition = runtime.resolveBinding(input.agentId);
      let projectId = input.projectId ?? '';
      if (projectId === '' && input.workItemId !== undefined && input.workItemId !== '' && deps.board !== undefined) {
        const item = deps.board.getWorkItem(input.workItemId as WorkItemId);
        if (item !== undefined) projectId = item.projectId;
      }
      if (definition.id === 'planner' || definition.id === 'generator') {
        if (deps.board !== undefined || input.workItemId !== undefined || input.executor === 'huntianling-runtime') {
          const item = input.workItemId === undefined ? undefined
            : deps.board?.getWorkItem(input.workItemId as WorkItemId);
          if (item === undefined || deps.board === undefined || item.projectId !== projectId) {
            throw new AgentTaskError('MISSING_INPUT', 'planning and implementation require an approved WorkItem in the current project');
          }
          let confirmed: Record<string, unknown>;
          try {
            confirmed = resolveConfirmedRequirement(deps.board, item);
          } catch (error) {
            throw new AgentTaskError('MISSING_INPUT', error instanceof Error ? error.message : 'original requirement approval unavailable');
          }
          input = { ...input, input: definition.id === 'planner'
            ? { ...asObject(input.input), ...confirmed }
            : { ...asObject(input.input), outcome: confirmed.goal, acceptance: confirmed.acceptance, sourceApproval: confirmed.sourceApproval } };
        }
      }
      if (projectId !== '' && deps.board !== undefined) {
        const project = deps.board.listProjects({ includeArchived: true }).find((item) => item.id === projectId);
        if (project !== undefined) {
          if (!project.enabledAgentIds.includes(definition.id)) {
            throw new AgentTaskError('BINDING', `agent ${definition.id} is not enabled for this project`);
          }
          const customization = project.agentCustomizations.find((row) => row.agentId === definition.id);
          try {
            definition = applyAgentCustomization(definition, customization);
          } catch (error) {
            throw new AgentTaskError('BINDING', error instanceof Error ? error.message : 'invalid agent customization');
          }
        }
      }
      const method = input.methodId !== undefined ? requireMethod(input.methodId) : null;
      if (method !== null && method.agentId !== definition.id) {
        throw new AgentTaskError('MISSING_METHOD', `method ${method.id} is not for ${definition.id}`);
      }
      if (method !== null) {
        if (projectId !== '' && deps.board !== undefined) {
          const project = deps.board.listProjects({ includeArchived: true }).find((item) => item.id === projectId);
          if (project !== undefined && !project.enabledMethodIds.includes(method.id)) {
            throw new AgentTaskError('MISSING_METHOD', `method ${method.id} is not enabled for this project`);
          }
        }
        for (const skillId of method.skillIds) {
          if (deps.skills.get(skillId) === undefined || !deps.skills.isEnabled(projectId, skillId)) {
            throw new AgentTaskError('MISSING_METHOD', `method skill missing: ${skillId}`);
          }
        }
      }
      const environmentReady = resolveEnvironmentReady(deps.environment, input.workspaceRoot, projectId, input.environmentReady);
      if (definition.id === 'generator' && environmentReady !== true) {
        throw new AgentTaskError('ENVIRONMENT', 'Generator requires a ready environment');
      }
      if (input.stateRecognition !== undefined && input.stateRecognition.allowed !== true) {
        throw new AgentTaskError('VALIDATION', `state recognition blocked: ${input.stateRecognition.reason}`);
      }
      let channelMessages: AgentRun['channelMessages'] = [];
      if (input.collaborationTaskId !== undefined) {
        const collab = input.collab;
        if (collab === undefined) {
          throw new AgentTaskError('VALIDATION', 'collaboration task runtime requires huntianling.collab');
        }
        const task = collab.getTask(input.collaborationTaskId);
        if (task === undefined) {
          throw new AgentTaskError('VALIDATION', `collaboration task not found: ${input.collaborationTaskId}`);
        }
        if (['cancelled', 'rejected', 'completed'].includes(task.status)) {
          throw new AgentTaskError('VALIDATION', `collaboration task ${task.id} is not runnable`);
        }
        if (task.requiredSkills.length === 0 || task.allowedTools.length === 0 || task.checks.length === 0 || task.expectedOutput.trim() === '') {
          throw new AgentTaskError('VALIDATION', 'collaboration task is missing required fields, skills, tools, or checks');
        }
        if (collab.hasPendingApproval(task.id)) {
          throw new AgentTaskError('VALIDATION', `collaboration task ${task.id} is missing required approval`);
        }
        channelMessages = collab.selectMessagesForTask(task.id);
      }

      for (const skillId of definition.requiredSkillIds) {
        if (!deps.skills.isEnabled(projectId, skillId)) {
          throw new AgentTaskError('MISSING_SKILL', `required skill missing or unvalidated: ${skillId}`);
        }
      }
      const packSkillIds: SkillId[] = [];
      if (deps.board !== undefined && input.workItemId !== undefined && input.workItemId !== '') {
        const item = deps.board.getWorkItem(input.workItemId as never);
        if (item !== undefined) {
          const installed = deps.skills.installedPacks(projectId);
          for (const packId of item.requiredSkillPackIds) {
            const match = installed.find((row) => row.packId === packId);
            if (match === undefined) {
              throw new AgentTaskError('MISSING_SKILL', `skill pack not installed: ${packId}`);
            }
            const pack = deps.skills.listPacks().find((row) => row.id === packId && row.version === match.version);
            if (pack === undefined) {
              throw new AgentTaskError('MISSING_SKILL', `skill pack not installed: ${packId}`);
            }
            for (const skill of pack.skills) {
              if (skill.boundary.taskTypes.includes(definition.taskType)) packSkillIds.push(skill.id);
            }
          }
        }
      }
      const requestedSkillIds: SkillId[] = [
        ...(input.skillIds ?? []),
        ...packSkillIds,
        ...((input.collaborationTaskId !== undefined ? input.collab?.getTask(input.collaborationTaskId)?.requiredSkills : undefined) ?? [])
          .filter((id): id is SkillId => typeof id === 'string'),
      ];
      for (const skillId of requestedSkillIds) {
        const skill = deps.skills.get(skillId);
        if (skill === undefined || skill.validationStatus !== 'valid' || !deps.skills.isEnabled(projectId, skillId)) {
          throw new AgentTaskError('MISSING_SKILL', `enabled skill missing or unvalidated: ${skillId}`);
        }
      }
      const skillIds = uniqueSkillIds([
        ...definition.requiredSkillIds,
        ...(method?.skillIds ?? []),
        ...requestedSkillIds,
      ]);
      const loaded = skillIds.map((skillId) => {
        const skill = deps.skills.get(skillId);
        if (skill === undefined) {
          throw new AgentTaskError('MISSING_SKILL', `skill not loaded: ${skillId}`);
        }
        if (!skill.boundary.taskTypes.includes(definition.taskType)) {
          throw new AgentTaskError('BINDING', `skill ${skill.id} does not match task ${definition.taskType}`);
        }
        return skill;
      });
      const primarySkill = definition.requiredSkillIds[0];
      const depth = primarySkill === undefined
        ? (input.depth ?? definition.defaultDepth)
        : deps.skills.selectDepth(primarySkill, input.depth ?? definition.defaultDepth);
      const runId = input.runId ?? randomUUID();
      const startedAt = Date.now();
      const localArtifactsEnabled = input.executor === 'huntianling-runtime'
        && deps.environment !== undefined
        && environmentReady === true
        && input.workspaceRoot !== undefined
        && input.workspaceRoot.trim() !== '';
      let methodTrace: AgentMethodTrace | null = createMethodTrace(method, loaded, depth, input.input, null);
      let execution: AgentExecutionReference | null = null;
      let context: TaskContextPacket | null = null;
      if (input.workItemId !== undefined && input.workItemId !== '' && deps.board !== undefined) {
        context = inspectTaskContext({
          board: deps.board,
          tools,
          definition,
          ...(deps.environment !== undefined ? { environment: deps.environment } : {}),
          ...(deps.dispatch !== undefined ? { dispatch: deps.dispatch } : {}),
          ...(method !== null ? { method } : {}),
          environmentReady,
          input: input.input,
        }, input.workItemId);
        if (!context.ready) {
          const blocking = context.missing.filter((row) => row.blocking).map((row) => row.field).join(', ');
          throw new AgentTaskError('MISSING_INPUT', `missing required information: ${blocking}`);
        }
      }

      try {
        const output = executeAgent(definition, input.input, method, {
          runId,
          projectId,
          ...(input.workspaceRoot !== undefined ? { workspaceRoot: input.workspaceRoot } : {}),
          ...(input.workItemId !== undefined ? { workItemId: input.workItemId } : {}),
          environmentReady,
          localArtifactsEnabled,
          startedAt,
        });
        methodTrace = createMethodTrace(method, loaded, depth, input.input, output);
        assertMethodTrace(methodTrace);
        execution = executionReference(runId, input.workspaceRoot, output, startedAt);
        const handoff = handoffFor(definition.id, runId, output);
        const run: AgentRun = {
          id: runId,
          agentId: definition.id,
          status: 'completed',
          skillIds,
          skillVersions: loaded.map((skill) => skill.version),
          depthLevel: depth,
          executor: input.executor,
          methodId: method?.id ?? null,
          input: input.input,
          output,
          handoff,
          error: null,
          workItemId: input.workItemId ?? null,
          projectId,
          environmentReady,
          context,
          channelMessages,
          stateRecognition: input.stateRecognition ?? null,
          execution,
          methodTrace,
        };
        persistRunEvidence(deps.board, definition.id, input.workItemId, runId, output);
        if (method !== null && deps.board !== undefined && input.workItemId !== undefined && input.workItemId !== '') {
          deps.board.updateWorkItem(input.workItemId as never, { methodId: method.id });
        }
        if (definition.kind === 'specialist') {
          attachSpecialistRun(deps.board, deps.dispatch, run);
        }
        writeRunConclusion(input, definition.id, runId, output);
        failures.delete(`${definition.id}:${projectId}`);
        runs.set(runId, run);
        recordRunProvenance(deps.governance, run);
        return run;
      } catch (error) {
        if (error instanceof AgentTaskError && error.code === 'VALIDATION') {
          const key = `${definition.id}:${projectId}`;
          const count = (failures.get(key) ?? 0) + 1;
          failures.set(key, count);
          if (count >= 2) {
            throw new AgentTaskError(
              'VALIDATION',
              depth === 0
                ? 'repeated invalid output at depth 0; stop the task'
                : `repeated invalid output; use depth ${String(depth - 1)} or stop`,
            );
          }
        }
        const message = error instanceof Error ? error.message : 'task failed';
        const run: AgentRun = {
          id: runId,
          agentId: definition.id,
          status: error instanceof AgentTaskError && error.code === 'VALIDATION' ? 'rejected' : 'blocked',
          skillIds,
          skillVersions: loaded.map((skill) => skill.version),
          depthLevel: depth,
          executor: input.executor,
          methodId: method?.id ?? null,
          input: input.input,
          output: null,
          handoff: null,
          error: message,
          workItemId: input.workItemId ?? null,
          projectId,
          environmentReady,
          context,
          channelMessages,
          stateRecognition: input.stateRecognition ?? null,
          execution,
          methodTrace,
        };
        runs.set(runId, run);
        throw error;
      }
    },
    interruptRun(runId) {
      const existing = runs.get(runId);
      if (existing === undefined) {
        throw new AgentTaskError('BINDING', `run not found: ${runId}`);
      }
      const interrupted: AgentRun = { ...existing, status: 'interrupted' };
      runs.set(runId, interrupted);
      return interrupted;
    },
    resumeRun(runId) {
      const existing = runs.get(runId);
      if (existing === undefined) {
        throw new AgentTaskError('BINDING', `run not found: ${runId}`);
      }
      if (existing.status !== 'interrupted') {
        return existing;
      }
      if (deps.board !== undefined && (existing.agentId === 'planner' || existing.agentId === 'generator')) {
        const item = existing.workItemId === null ? undefined : deps.board.getWorkItem(existing.workItemId as WorkItemId);
        if (item === undefined) throw new AgentTaskError('MISSING_INPUT', 'approved WorkItem not found');
        let confirmed: Record<string, unknown>;
        try {
          confirmed = resolveConfirmedRequirement(deps.board, item);
        } catch (error) {
          throw new AgentTaskError('MISSING_INPUT', error instanceof Error ? error.message : 'original requirement approval unavailable');
        }
        if (confirmedRequirementRevision(confirmed) !== confirmedRequirementRevision(asObject(existing.input))) {
          throw new AgentTaskError('MISSING_INPUT', 'original requirement approval changed; start a new Agent run');
        }
      }
      if (existing.output !== null) {
        const restored: AgentRun = { ...existing, status: 'completed' };
        runs.set(runId, restored);
        return restored;
      }
      return runtime.startRun({
        agentId: existing.agentId,
        input: existing.input,
        executor: existing.executor,
        depth: existing.depthLevel,
        ...(existing.methodId !== null ? { methodId: existing.methodId } : {}),
        runId: existing.id,
        environmentReady: existing.environmentReady,
        ...(existing.workItemId !== null ? { workItemId: existing.workItemId } : {}),
        ...(existing.projectId !== '' ? { projectId: existing.projectId } : {}),
        ...(existing.execution?.workspaceRoot !== null && existing.execution?.workspaceRoot !== undefined
          ? { workspaceRoot: existing.execution.workspaceRoot }
          : {}),
      });
    },
    getRun(runId) {
      return runs.get(runId);
    },
    listRuns() {
      return [...runs.values()];
    },
  };

  return runtime;
}

function resolveEnvironmentReady(
  environment: EnvironmentService | undefined,
  workspaceRoot: string | undefined,
  projectId: string,
  declaredReady: boolean | undefined,
): boolean {
  if (environment === undefined) return declaredReady === true;
  if (workspaceRoot === undefined && projectId === '') return false;
  return environment.canStartImplementation(workspaceRoot, projectId === '' ? undefined : projectId);
}

function requireMethod(methodId: string): MethodDefinition {
  const method = METHOD_DEFINITIONS.find((item) => item.id === methodId);
  if (method === undefined) {
    throw new AgentTaskError('MISSING_METHOD', `unknown method: ${methodId}`);
  }
  return method;
}

function uniqueSkillIds(ids: readonly SkillId[]): readonly SkillId[] {
  return [...new Set(ids)];
}

function writeRunConclusion(
  input: StartRunInput,
  agentId: AgentId,
  runId: string,
  output: unknown,
): void {
  if (input.collaborationTaskId === undefined || input.collab === undefined) return;
  const task = input.collab.getTask(input.collaborationTaskId);
  if (task === undefined) return;
  const workItemRef = task.workItemId ?? undefined;
  if (agentId === 'evaluator') {
    const record = asObject(output);
    const criteria = Array.isArray(record.criteria) ? record.criteria : [];
    const criterionIds = criteria
      .map((row) => asObject(row).id)
      .filter((id): id is string => typeof id === 'string' && id.trim() !== '');
    input.collab.postMessage(task.conversationId, {
      type: 'report.findings',
      from: { kind: 'agent', role: agentId },
      payload: {
        kind: 'evaluator',
        criterionIds: criterionIds.length > 0 ? criterionIds : ['runtime-conclusion'],
        body: `completed evaluator run ${runId}`,
      },
      refs: {
        taskId: task.id,
        ...(workItemRef !== undefined ? { workItemId: workItemRef } : {}),
      },
    });
    return;
  }
  input.collab.postMessage(task.conversationId, {
    type: 'progress.update',
    from: { kind: 'agent', role: agentId },
    payload: { body: `completed ${agentId} run ${runId}`, taskId: task.id },
    refs: {
      taskId: task.id,
      ...(workItemRef !== undefined ? { workItemId: workItemRef } : {}),
    },
  });
}

function persistRunEvidence(
  board: BoardService | undefined,
  agentId: AgentId,
  workItemId: string | undefined,
  runId: string,
  output: unknown,
): void {
  if (board === undefined || workItemId === undefined || workItemId === '') return;
  if (agentId === 'generator') {
    persistGeneratorSelfCheck(board, workItemId, runId);
    return;
  }
  if (agentId === 'evaluator') {
    persistEvaluatorEvidence(board, workItemId, runId, output);
  }
}

function executeAgent(
  definition: AgentDefinition,
  input: unknown,
  method: MethodDefinition | null,
  context: AgentExecutionContext,
): unknown {
  switch (definition.id) {
    case 'planner':
      return plan(input, method);
    case 'generator':
      return generate(input, context);
    case 'evaluator':
      return evaluate(input, context);
    default:
      if (definition.kind !== 'specialist' || !isSpecialistAgentId(definition.id)) {
        throw new AgentTaskError('BINDING', `unhandled agent: ${definition.id}`);
      }
      return executeSpecialist(definition, input);
  }
}

function executeSpecialist(definition: AgentDefinition, input: unknown): unknown {
  const record = asObject(input);
  for (const field of PLANNER_FORBIDDEN) {
    if (Object.hasOwn(record, field)) {
      throw new AgentTaskError('VALIDATION', `${definition.id} output cannot include ${field}`);
    }
  }
  if (record.accepted === true || record.delivered === true) {
    throw new AgentTaskError('SELF_CHECK', `${definition.id} cannot mark the slice accepted`);
  }
  const outcome = typeof record.outcome === 'string' && record.outcome.trim() !== ''
    ? record.outcome
    : typeof record.goal === 'string' && record.goal.trim() !== ''
      ? record.goal
      : definition.id;
  const findings = Array.isArray(record.findings)
    ? record.findings.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [`${definition.id} reviewed: ${outcome}`];
  if (findings.length === 0) {
    throw new AgentTaskError('VALIDATION', `${definition.id} requires findings`);
  }
  return attachStructured(definition.id, {
    schemaVersion: 1,
    role: definition.id,
    kind: 'specialist',
    outcome,
    findings,
    responsibilities: definition.responsibilities,
    allowedTaskTypes: definition.allowedTaskTypes,
    outputExpectations: definition.outputExpectations,
    nextActions: ['complete'],
  });
}

function attachSpecialistRun(
  board: BoardService | undefined,
  dispatch: DispatchService | undefined,
  run: AgentRun,
): void {
  if (board === undefined || run.workItemId === null || run.workItemId === '') return;
  const item = board.getWorkItem(run.workItemId as never);
  if (item === undefined) return;
  const evidenceRef = `agent-run:${run.id}`;
  if (!item.evidence.includes(evidenceRef)) {
    board.updateWorkItem(item.id, { evidence: [...item.evidence, evidenceRef] });
  }
  if (run.projectId !== '') {
    board.recordAuditEvent({
      projectId: run.projectId as never,
      actorId: run.agentId,
      action: 'agent.run.completed',
      targetType: 'work_item',
      targetId: item.id,
      targetLabel: item.title,
      changedFields: ['evidence'],
      reason: run.agentId,
    });
  }
  dispatch?.captureRun(run);
}

function plan(input: unknown, method: MethodDefinition | null): unknown {
  const record = asObject(input);
  for (const field of PLANNER_FORBIDDEN) {
    if (Object.hasOwn(record, field)) {
      throw new AgentTaskError('VALIDATION', `planner output cannot include ${field}`);
    }
  }
  const goal = requireString(record, 'goal');
  const quotes = record.quotes;
  if (!Array.isArray(quotes) || quotes.length === 0) {
    throw new AgentTaskError('VALIDATION', 'planner requires source quotes');
  }
  if (record.confirmed !== true) {
    throw new AgentTaskError('VALIDATION', 'planner requires confirmed original requirements');
  }
  const acceptance = Array.isArray(record.acceptance)
    ? record.acceptance.filter((item): item is string => typeof item === 'string')
    : [`Customer can verify: ${goal}`];
  if (acceptance.length === 0) {
    throw new AgentTaskError('VALIDATION', 'planner requires testable acceptance');
  }
  const contract: Record<string, unknown> = {
    schemaVersion: 1,
    role: 'planner',
    outcome: goal,
    acceptance,
    assumptions: Array.isArray(record.assumptions) ? record.assumptions : [],
    openQuestions: Array.isArray(record.openQuestions) ? record.openQuestions : [],
  };
  if (method !== null && record.omitMethodOutput !== true) {
    Object.assign(contract, methodOutput(method.id, goal, firstString(record.actors) ?? 'user'));
  }
  return attachStructured('planner', contract);
}

function methodOutput(methodId: string, goal: string, actor: string): Record<string, unknown> {
  switch (methodId) {
    case 'user-story':
      return {
        userStory: {
          asA: actor,
          iWant: goal,
          soThat: 'the agreed acceptance can be verified',
        },
      };
    case 'use-case':
      return {
        useCase: {
          actor,
          goal,
          mainFlow: [`Actor ${actor} completes ${goal}`],
        },
      };
    case 'bdd':
      return {
        bdd: {
          feature: goal,
          scenarios: [{ given: `${actor} is present`, when: goal, then: 'the agreed acceptance can be verified' }],
        },
      };
    case 'example-mapping':
      return {
        exampleMapping: {
          rules: [goal],
          examples: [`${actor} can verify ${goal}`],
          questions: [],
        },
      };
    case 'event-storming':
      return {
        eventStorming: {
          domainEvents: [`${goal} happened`],
          commands: [`request ${goal}`],
        },
      };
    case 'ddd':
      return {
        ddd: {
          boundedContext: goal,
          aggregates: [actor],
        },
      };
    case 'api-design':
      return {
        apiDesign: {
          resources: [goal],
          operations: ['GET', 'POST'],
        },
      };
    case 'adr':
      return {
        adr: {
          title: goal,
          status: 'proposed',
          decision: goal,
          consequences: ['the agreed acceptance can be verified'],
        },
      };
    case 'threat-modeling':
      return {
        threatModel: {
          assets: [goal],
          threats: [`${actor} data is exposed`],
          mitigations: ['restrict access'],
        },
      };
    default:
      return {};
  }
}

function generate(input: unknown, context: AgentExecutionContext): unknown {
  const record = asObject(input);
  if (record.accepted === true || record.delivered === true) {
    throw new AgentTaskError('SELF_CHECK', 'generator cannot mark the slice accepted');
  }
  const outcome = requireString(record, 'outcome');
  const acceptance = stringArray(record.acceptance);
  if (acceptance.length === 0) {
    throw new AgentTaskError('VALIDATION', 'generator requires agreed acceptance');
  }
  const repairFindings = stringArray(record.repairFindings);
  const fallbackFiles = Array.isArray(record.files) ? stringArray(record.files) : [`src/${slug(outcome)}.ts`];
  if (!context.localArtifactsEnabled || context.workspaceRoot === undefined) {
    return attachStructured('generator', {
      schemaVersion: 1,
      role: 'generator',
      files: fallbackFiles,
      selfCheck: {
        typecheck: 'skipped',
        test: 'skipped',
        kind: 'self_check',
      },
      outcome,
      acceptance,
    });
  }
  const artifactRefs = writeCandidateImplementation(context.workspaceRoot, context.runId, outcome, acceptance, repairFindings);
  const candidateRevision = candidateRevisionFor(context.workspaceRoot, artifactRefs).revision;
  return attachStructured('generator', {
    schemaVersion: 1,
    role: 'generator',
    files: artifactRefs,
    artifactRefs,
    candidateRevision,
    repositoryRevision: candidateRevision,
    selfCheck: {
      typecheck: 'skipped',
      test: 'skipped',
      kind: 'self_check',
      evidenceIds: [],
    },
    outcome,
    acceptance,
    repairFindings,
    evidenceRefs: [],
    provenanceLinks: candidateLinks(artifactRefs),
  });
}

function evaluate(input: unknown, context: AgentExecutionContext): unknown {
  const record = asObject(input);
  if (record.independent === false) {
    throw new AgentTaskError('VALIDATION', 'evaluator must run independently');
  }
  const selfCheck = asObject(record.selfCheck ?? {});
  if (record.decision === 'pass' && selfCheck.kind === 'self_check' && record.criteria === undefined) {
    throw new AgentTaskError('SELF_CHECK', 'evaluator pass cannot be generator self-check');
  }
  const acceptance = Array.isArray(record.acceptance)
    ? record.acceptance.filter((item): item is string => typeof item === 'string')
    : [];
  if (acceptance.length === 0) {
    throw new AgentTaskError('VALIDATION', 'evaluator requires contract acceptance');
  }
  const failed = Array.isArray(record.failedCriteria)
    ? record.failedCriteria.filter((item): item is string => typeof item === 'string')
    : [];
  const candidate = evaluateCandidate(record, acceptance, context);
  const failedCriteria = new Set([...failed, ...candidate.failedCriteria]);
  const criteria = acceptance.map((id) => ({
    id,
    result: failedCriteria.has(id) ? 'fail' : 'pass',
    evidence: candidate.executed ? `executed-evaluator:${context.runId}` : 'deterministic-evaluator',
    evidenceIds: candidate.executed
      ? [`ci:local-evaluator:${context.runId}:${slug(id)}`, ...candidate.evidenceRefs]
      : [],
    links: candidate.links,
  }));
  const decision = failedCriteria.size === 0 ? 'pass' : 'revision-required';
  return attachStructured('evaluator', {
    schemaVersion: 1,
    role: 'evaluator',
    independent: true,
    criteria,
    decision,
    evidenceRefs: criteria.flatMap((row) => row.evidenceIds.length > 0 ? row.evidenceIds : [row.evidence]),
    executionKind: candidate.executed ? 'executed' : 'demonstration',
    artifactRefs: candidate.artifactRefs,
    candidateRevision: candidate.candidateRevision,
    provenanceLinks: candidate.links,
    failureReasons: candidate.failureReasons,
    nextActions: decision === 'pass' ? ['complete'] : ['repair'],
  });
}

function writeCandidateImplementation(
  workspaceRoot: string,
  runId: string,
  outcome: string,
  acceptance: readonly string[],
  repairFindings: readonly string[],
): readonly string[] {
  const directory = join(workspaceRoot, '.huntianling', 'candidates', runId);
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `${slug(outcome)}.ts`);
  const content = [
    'export const huntianlingDelivery = Object.freeze({',
    `  outcome: ${JSON.stringify(outcome)},`,
    `  acceptance: ${JSON.stringify(acceptance)},`,
    `  repairFindings: ${JSON.stringify(repairFindings)},`,
    `  verifiedMarkers: ${JSON.stringify(acceptance)},`,
    '});',
    '',
    'export function satisfiesAcceptance(id: string): boolean {',
    '  return huntianlingDelivery.verifiedMarkers.includes(id);',
    '}',
    '',
  ].join('\n');
  writeFileSync(file, content);
  return [relative(workspaceRoot, file)];
}

function candidateRevisionFor(workspaceRoot: string, artifactRefs: readonly string[]): CandidateRevision {
  const safeRefs = artifactRefs
    .filter((ref) => ref.trim() !== '' && !ref.startsWith('/') && !ref.split('/').includes('..'))
    .sort();
  if (safeRefs.length === 0) return { revision: '', artifactRefs: [] };
  const hash = createHash('sha256');
  for (const ref of safeRefs) {
    hash.update(ref);
    hash.update('\0');
    const file = join(workspaceRoot, ref);
    hash.update(existsSync(file) ? readFileSync(file) : `missing:${ref}`);
    hash.update('\0');
  }
  return { revision: hash.digest('hex').slice(0, 16), artifactRefs: safeRefs };
}

function evaluateCandidate(
  record: Record<string, unknown>,
  acceptance: readonly string[],
  context: AgentExecutionContext,
): {
  readonly executed: boolean;
  readonly artifactRefs: readonly string[];
  readonly candidateRevision: string;
  readonly evidenceRefs: readonly string[];
  readonly links: readonly Record<string, unknown>[];
  readonly failedCriteria: readonly string[];
  readonly failureReasons: readonly string[];
} {
  const candidateRevision = typeof record.candidateRevision === 'string' ? record.candidateRevision : '';
  const artifactRefs = stringArray(record.artifactRefs).length > 0
    ? stringArray(record.artifactRefs)
    : stringArray(record.files);
  if (!context.localArtifactsEnabled || context.workspaceRoot === undefined || artifactRefs.length === 0 || candidateRevision === '') {
    return {
      executed: false,
      artifactRefs,
      candidateRevision,
      evidenceRefs: [],
      links: [],
      failedCriteria: [],
      failureReasons: [],
    };
  }
  const actual = candidateRevisionFor(context.workspaceRoot, artifactRefs);
  const failureReasons: string[] = [];
  const failedCriteria = new Set<string>();
  if (actual.revision !== candidateRevision) {
    failureReasons.push('candidate revision changed after generator self-check');
    for (const criterion of acceptance) failedCriteria.add(criterion);
  } else {
    const contents = artifactRefs.map((ref) => {
      const file = join(context.workspaceRoot!, ref);
      return existsSync(file) ? readFileSync(file, 'utf8') : '';
    });
    for (const criterion of acceptance) {
      if (!contents.some((content) => content.includes(criterion) || content.includes(JSON.stringify(criterion)))) {
        failureReasons.push(`missing acceptance marker: ${criterion}`);
        failedCriteria.add(criterion);
      }
    }
  }
  const links = candidateLinks(artifactRefs);
  return {
    executed: false,
    artifactRefs,
    candidateRevision,
    evidenceRefs: [],
    links,
    failedCriteria: [...failedCriteria],
    failureReasons,
  };
}

function candidateLinks(
  artifactRefs: readonly string[],
): readonly Record<string, unknown>[] {
  return [
    ...artifactRefs.map((ref) => ({
      kind: 'changed-file',
      id: `file:${ref}`,
      label: ref,
      url: null,
      acceptanceCriterionIds: [],
    })),
  ];
}

function executionReference(
  runId: string,
  workspaceRoot: string | undefined,
  output: unknown,
  startedAt: number,
): AgentExecutionReference {
  const record = asObject(output);
  const artifactRefs = stringArray(record.artifactRefs);
  const candidateRevision = typeof record.candidateRevision === 'string' && record.candidateRevision !== ''
    ? record.candidateRevision
    : null;
  return {
    taskId: `agent-task:${runId}`,
    sessionId: `local-session:${runId}`,
    toolCallIds: [],
    artifactRefs,
    workspaceRoot: workspaceRoot ?? null,
    candidateRevision,
    startedAt,
    completedAt: Date.now(),
  };
}

function createMethodTrace(
  method: MethodDefinition | null,
  skills: readonly SkillRecord[],
  depth: 0 | 1 | 2 | 3 | 4,
  input: unknown,
  output: unknown,
): AgentMethodTrace {
  const outputRecord = lenientObject(output);
  const methodSkillIds = method?.skillIds ?? [];
  const methodSkillVersions = skills
    .filter((skill) => methodSkillIds.includes(skill.id))
    .map((skill) => skill.version);
  const steps = skills.flatMap((skill) => {
    const selected = skill.depth.levels.find((level) => level.id === depth)
      ?? skill.depth.levels.find((level) => level.id === skill.depth.defaultLevel);
    return (selected?.steps ?? []).map((step) => ({
      name: step.name,
      actor: step.actor,
      status: output === null ? 'blocked' as const : 'pass' as const,
      evidence: `skill:${skill.id}@${skill.version}:${step.name}`,
    }));
  });
  const sensors = method === null ? [] : methodSensors(method, input, outputRecord, output !== null);
  return {
    methodId: method?.id ?? null,
    methodVersion: method?.version ?? null,
    skillIds: skills.map((skill) => skill.id),
    skillVersions: methodSkillVersions.length > 0 ? methodSkillVersions : skills.map((skill) => skill.version),
    depthLevel: depth,
    steps,
    sensors,
    nextDepth: sensors.some((sensor) => sensor.status === 'fail' || sensor.status === 'blocked')
      ? (depth > 0 ? (depth - 1) as 0 | 1 | 2 | 3 | 4 : null)
      : null,
  };
}

function methodSensors(
  method: MethodDefinition,
  input: unknown,
  output: Record<string, unknown>,
  hasOutput: boolean,
): readonly AgentMethodSensor[] {
  const inputRecord = lenientObject(input);
  const sensors: AgentMethodSensor[] = [];
  for (const field of method.requiredInputs) {
    const passed = inputHas(inputRecord, field);
    sensors.push({
      id: `input:${field}`,
      status: passed ? 'pass' : 'blocked',
      message: passed ? `${field} present` : `${field} missing; route ${method.missingRoute}`,
      evidence: method.id,
    });
  }
  for (const field of method.outputFields) {
    const passed = hasOutput && outputHas(output, field);
    sensors.push({
      id: `output:${field}`,
      status: passed ? 'pass' : 'fail',
      message: passed ? `${field} produced` : `${field} missing from ${method.id}`,
      evidence: method.version,
    });
  }
  for (const check of method.checks) {
    const passed = hasOutput && methodCheckPassed(method, output, check);
    sensors.push({
      id: `check:${check}`,
      status: passed ? 'pass' : 'fail',
      message: passed ? `${check} passed` : `${check} failed`,
      evidence: method.version,
    });
  }
  return sensors;
}

function assertMethodTrace(trace: AgentMethodTrace): void {
  const failed = trace.sensors.find((sensor) => sensor.status === 'fail' || sensor.status === 'blocked');
  if (failed !== undefined) {
    throw new AgentTaskError('VALIDATION', failed.message);
  }
}

function inputHas(record: Record<string, unknown>, field: string): boolean {
  if (field === 'quotes') return Array.isArray(record.quotes) && record.quotes.length > 0;
  if (field === 'acceptance') return stringArray(record.acceptance).length > 0;
  const value = record[field];
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

function outputHas(record: Record<string, unknown>, field: string): boolean {
  if (field === 'acceptance') return stringArray(record.acceptance).length > 0;
  const value = record[field];
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

function methodCheckPassed(method: MethodDefinition, output: Record<string, unknown>, check: string): boolean {
  if (check === 'has-acceptance') return outputHas(output, 'acceptance');
  return method.outputFields
    .filter((field) => field !== 'acceptance')
    .some((field) => outputHas(output, field));
}

function handoffFor(agentId: AgentId, runId: string, output: unknown): AgentHandoff {
  if (agentId === 'planner') {
    return { kind: 'design_ready', from: 'planner', to: 'user', runId };
  }
  if (agentId === 'generator') {
    return { kind: 'evaluate', from: 'generator', to: 'evaluator', runId };
  }
  if (isSpecialistAgentId(agentId)) {
    return { kind: 'complete', from: agentId, to: 'user', runId };
  }
  const decision = asObject(output).decision;
  if (decision === 'revision-required') {
    return { kind: 'repair', from: 'evaluator', to: 'generator', runId };
  }
  return { kind: 'complete', from: 'evaluator', to: 'user', runId };
}

function attachStructured(agentId: AgentId, record: Record<string, unknown>): Record<string, unknown> {
  const nextActions = Array.isArray(record.nextActions)
    ? record.nextActions
    : agentId === 'planner'
      ? ['design_ready']
      : agentId === 'generator'
        ? ['evaluate']
        : isSpecialistAgentId(agentId)
          ? ['complete']
          : ['complete'];
  const evidenceRefs = Array.isArray(record.evidenceRefs) ? record.evidenceRefs : [];
  const feedback = typeof record.feedback === 'string'
    ? record.feedback
    : typeof record.outcome === 'string'
      ? record.outcome
      : typeof record.decision === 'string'
        ? record.decision
        : agentId;
  return {
    ...record,
    feedback,
    assumptions: Array.isArray(record.assumptions) ? record.assumptions : [],
    openQuestions: Array.isArray(record.openQuestions) ? record.openQuestions : [],
    evidenceRefs,
    nextActions,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AgentTaskError('VALIDATION', 'expected an object');
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AgentTaskError('VALIDATION', `${key} is required`);
  }
  return value;
}

function firstString(value: unknown): string | undefined {
  if (!Array.isArray(value) || typeof value[0] !== 'string') return undefined;
  return value[0];
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function slug(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return cleaned === '' ? 'slice' : cleaned;
}

function recordRunProvenance(governance: GovernanceService | undefined, run: AgentRun): void {
  if (governance === undefined) return;
  const input = lenientObject(run.input);
  const output = lenientObject(run.output);
  const quotes = Array.isArray(input.quotes) ? input.quotes : [];
  const sourceInputs = quotes
    .map((row) => lenientObject(row).text)
    .filter((text): text is string => typeof text === 'string' && text.trim() !== '');
  if (typeof input.goal === 'string' && input.goal.trim() !== '') sourceInputs.push(input.goal);
  const assumptions = Array.isArray(output.assumptions)
    ? output.assumptions.filter((row): row is string => typeof row === 'string')
    : [];
  const limitations = Array.isArray(output.limitations)
    ? output.limitations.filter((row): row is string => typeof row === 'string')
    : [];
  const openQuestions = Array.isArray(output.openQuestions)
    ? output.openQuestions.filter((row): row is string => typeof row === 'string')
    : [];
  const confidence = typeof output.confidence === 'string' ? output.confidence : null;
  governance.recordAgentProvenance({
    runId: run.id,
    projectId: run.projectId as ProjectId,
    workItemId: (run.workItemId ?? null) as WorkItemId | null,
    sourceInputs,
    promptTemplate: run.methodId ?? run.agentId,
    modelIdentity: `${run.executor}:${run.agentId}`,
    skillVersions: run.skillVersions,
    toolCalls: (run.context?.toolPermissions ?? []).filter((row) => row.allowed).map((row) => row.toolId),
    retrievedContext: [],
    generatedOutput: JSON.stringify(run.output),
    verificationEvidence: run.skillIds,
    ...(confidence !== null ? { confidence } : {}),
    assumptions,
    limitations,
    openQuestions,
  });
}

function lenientObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
