/**
 * Agent task runtime for Planner, Generator, and Evaluator.
 */

import { randomUUID } from 'node:crypto';

import type { BoardService } from '../board/plugin.js';
import type { SkillService } from '../skills/service.js';
import type { SkillId } from '../skills/types.js';
import type { DispatchService } from '../dispatch/service.js';
import type { EnvironmentService } from '../environment/service.js';
import { inspectTaskContext } from '../tools/feedback.js';
import { createToolRegistry, type ToolRegistry } from '../tools/registry.js';
import type { TaskContextPacket } from '../tools/types.js';
import { persistEvaluatorEvidence, persistGeneratorSelfCheck } from './evidence.js';
import { AGENT_DEFINITIONS, applyAgentCustomization, definitionFor } from './definitions.js';
import { DEFAULT_METHOD_BASELINE, METHOD_DEFINITIONS } from './methods.js';
import type { SkillGap } from '../skills/types.js';
import {
  AgentTaskError,
  isSpecialistAgentId,
  type AgentDefinition,
  type AgentHandoff,
  type AgentId,
  type AgentRun,
  type MethodBaseline,
  type MethodDefinition,
  type StartRunInput,
} from './types.js';

const PLANNER_FORBIDDEN = ['files', 'filePaths', 'technicalDesign', 'code'] as const;

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
      return inspectTaskContext({
        board: deps.board,
        tools,
        definition,
        ...(deps.environment !== undefined ? { environment: deps.environment } : {}),
        ...(deps.dispatch !== undefined ? { dispatch: deps.dispatch } : {}),
        ...(method !== null ? { method } : {}),
        ...(input.environmentReady !== undefined ? { environmentReady: input.environmentReady } : {}),
        ...(input.input !== undefined ? { input: input.input } : {}),
      }, input.workItemId);
    },
    startRun(input) {
      let definition = runtime.resolveBinding(input.agentId);
      const projectId = input.projectId ?? '';
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
      if (definition.id === 'generator' && input.environmentReady !== true) {
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
      let context: TaskContextPacket | null = null;
      if (input.workItemId !== undefined && input.workItemId !== '' && deps.board !== undefined) {
        context = inspectTaskContext({
          board: deps.board,
          tools,
          definition,
          ...(deps.environment !== undefined ? { environment: deps.environment } : {}),
          ...(deps.dispatch !== undefined ? { dispatch: deps.dispatch } : {}),
          ...(method !== null ? { method } : {}),
          ...(input.environmentReady !== undefined ? { environmentReady: input.environmentReady } : {}),
          input: input.input,
        }, input.workItemId);
        if (!context.ready) {
          const blocking = context.missing.filter((row) => row.blocking).map((row) => row.field).join(', ');
          throw new AgentTaskError('MISSING_INPUT', `missing required information: ${blocking}`);
        }
      }

      try {
        const output = executeAgent(definition, input.input, method);
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
          environmentReady: input.environmentReady === true,
          context,
          channelMessages,
          stateRecognition: input.stateRecognition ?? null,
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
          environmentReady: input.environmentReady === true,
          context,
          channelMessages,
          stateRecognition: input.stateRecognition ?? null,
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

function executeAgent(definition: AgentDefinition, input: unknown, method: MethodDefinition | null): unknown {
  switch (definition.id) {
    case 'planner':
      return plan(input, method);
    case 'generator':
      return generate(input);
    case 'evaluator':
      return evaluate(input);
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
  if (method !== null) {
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

function generate(input: unknown): unknown {
  const record = asObject(input);
  if (record.accepted === true || record.delivered === true) {
    throw new AgentTaskError('SELF_CHECK', 'generator cannot mark the slice accepted');
  }
  const outcome = requireString(record, 'outcome');
  const acceptance = Array.isArray(record.acceptance) ? record.acceptance : [];
  if (acceptance.length === 0) {
    throw new AgentTaskError('VALIDATION', 'generator requires agreed acceptance');
  }
  return attachStructured('generator', {
    schemaVersion: 1,
    role: 'generator',
    files: Array.isArray(record.files) ? record.files : [`src/${slug(outcome)}.ts`],
    selfCheck: {
      typecheck: 'pass',
      test: 'pass',
      kind: 'self_check',
    },
    outcome,
    acceptance,
  });
}

function evaluate(input: unknown): unknown {
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
  const criteria = acceptance.map((id) => ({
    id,
    result: failed.includes(id) ? 'fail' : 'pass',
    evidence: 'deterministic-evaluator',
  }));
  const decision = failed.length === 0 ? 'pass' : 'revision-required';
  return attachStructured('evaluator', {
    schemaVersion: 1,
    role: 'evaluator',
    independent: true,
    criteria,
    decision,
    evidenceRefs: criteria.map((row) => row.evidence),
    nextActions: decision === 'pass' ? ['complete'] : ['repair'],
  });
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

function slug(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return cleaned === '' ? 'slice' : cleaned;
}
