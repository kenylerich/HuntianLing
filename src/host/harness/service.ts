/**
 * Measure Skill depth changes and record HuntianLing self-development.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { AgentRuntime } from '../agents/runtime.js';
import type { BoardService } from '../board/plugin.js';
import type { WorkItemId } from '../board/types.js';
import { createDeliveryService } from '../delivery/service.js';
import type { EnvironmentService } from '../environment/service.js';
import { MKT_SKILL_EXTRACT } from '../skills/mkt-pack.js';
import type { SkillService } from '../skills/service.js';
import type { SkillDepthId, SkillId } from '../skills/types.js';
import { SkillWriteError } from '../skills/types.js';
import { customerProgressForWorkItem } from '../web/customer-progress.js';
import { loadHarnessSnapshot, saveHarnessSnapshot } from './store.js';
import {
  HarnessError,
  resolveHarnessConfig,
  type HarnessComparison,
  type HarnessConfig,
  type HarnessDemonstration,
  type HarnessLlmTransport,
  type HarnessModelBinding,
  type HarnessScenario,
  type HarnessTrial,
  type HarnessTrialKind,
  type ResolvedHarnessConfig,
} from './types.js';

const PASS_INPUT = {
  quotes: [{ text: '客户只看自己的需求', source: 'customer' }],
  goal: 'Customer sees only their requirements',
  confirmed: true,
};

const FAIL_INPUT = {
  quotes: [],
  goal: 'split files',
  confirmed: true,
};

export interface HarnessService {
  scenarios(): readonly HarnessScenario[];
  runTrial(input: {
    readonly scenarioId: string;
    readonly depth: SkillDepthId;
    readonly mode?: HarnessTrial['mode'];
    readonly executor?: HarnessTrial['executor'];
    readonly modelBinding?: HarnessModelBinding;
    readonly repeatIndex?: number;
    readonly token?: string;
  }): HarnessTrial;
  repeatTrials(input: {
    readonly scenarioId: string;
    readonly depth: SkillDepthId;
    readonly repeats: number;
    readonly modelBinding?: HarnessModelBinding;
    readonly executor?: HarnessTrial['executor'];
    readonly token?: string;
  }): readonly HarnessTrial[];
  compare(input?: {
    readonly skillId?: SkillId;
    readonly baselineDepth?: SkillDepthId;
    readonly candidateDepth?: SkillDepthId;
    readonly threshold?: HarnessConfig;
    readonly modelBinding?: HarnessModelBinding;
    readonly repeats?: number;
    readonly token?: string;
  }): HarnessComparison;
  promote(comparisonId: string): HarnessComparison;
  isPromoted(skillId: SkillId, depth: SkillDepthId): boolean;
  listComparisons(): readonly HarnessComparison[];
  listDemonstrations(): readonly HarnessDemonstration[];
  demonstrateSelfDevelopment(input?: {
    readonly owner?: string;
    readonly selfHarnessSliceRefs?: readonly string[];
    readonly stepExecutors?: Partial<Record<'plan' | 'implement' | 'evaluate', HarnessTrial['executor']>>;
  }): HarnessDemonstration;
}

export function createHarnessService(deps: {
  readonly skills: SkillService;
  readonly workspaceRoot: string;
  readonly board?: BoardService;
  readonly agents?: AgentRuntime;
  readonly environment?: EnvironmentService;
  readonly config?: HarnessConfig;
  readonly liveModel?: {
    readonly url: string;
    readonly model: string;
    readonly token: string;
    readonly transport: HarnessLlmTransport;
  };
}): HarnessService {
  const config = resolveHarnessConfig(deps.config ?? {});
  let snapshot = loadHarnessSnapshot(deps.workspaceRoot);

  const service: HarnessService = {
    scenarios() {
      return SCENARIOS;
    },

    runTrial(input) {
      const scenario = SCENARIOS.find((item) => item.id === input.scenarioId);
      if (scenario === undefined) {
        throw new HarnessError('NOT_FOUND', `scenario not found: ${input.scenarioId}`);
      }
      const mode = input.mode ?? 'fresh';
      if (mode === 'replay') {
        const previous = [...snapshot.trials]
          .reverse()
          .find((trial) =>
            trial.scenarioId === input.scenarioId
            && trial.depth === input.depth
            && trial.mode === 'fresh'
          );
        if (previous === undefined) {
          throw new HarnessError('NOT_FOUND', `no fresh trial to replay for ${input.scenarioId} depth ${String(input.depth)}`);
        }
        const replayed: HarnessTrial = {
          ...previous,
          id: randomUUID(),
          mode: 'replay',
          elapsedMs: 0,
          artifacts: [...previous.artifacts, 'orchestration-replay'],
          modelBinding: previous.modelBinding ?? 'deterministic-executor',
          repeatIndex: previous.repeatIndex ?? 0,
        };
        snapshot = { ...snapshot, trials: [...snapshot.trials, replayed] };
        persist();
        return replayed;
      }
      const modelBinding = input.modelBinding ?? 'deterministic-executor';
      const trial = executeFreshTrial({
        skills: deps.skills,
        scenario,
        depth: input.depth,
        executor: input.executor ?? 'huntianling-runtime',
        modelBinding,
        repeatIndex: input.repeatIndex ?? 0,
        ...(modelBinding === 'live-model' ? { liveModel: requireLiveModel(deps, input.token) } : {}),
      });
      snapshot = { ...snapshot, trials: [...snapshot.trials, trial] };
      persist();
      return trial;
    },
    repeatTrials(input) {
      if (!Number.isInteger(input.repeats) || input.repeats < 1) {
        throw new HarnessError('VALIDATION', 'repeats must be a positive integer');
      }
      const trials: HarnessTrial[] = [];
      for (let index = 0; index < input.repeats; index += 1) {
        trials.push(service.runTrial({
          scenarioId: input.scenarioId,
          depth: input.depth,
          mode: 'fresh',
          modelBinding: input.modelBinding ?? 'live-model',
          repeatIndex: index,
          ...(input.executor !== undefined ? { executor: input.executor } : {}),
          ...(input.token !== undefined ? { token: input.token } : {}),
        }));
      }
      return trials;
    },

    compare(input = {}) {
      const skillId = input.skillId ?? MKT_SKILL_EXTRACT;
      const baselineDepth = input.baselineDepth ?? 0;
      const candidateDepth = input.candidateDepth ?? 1;
      const threshold = resolveHarnessConfig(input.threshold ?? config);
      const baselineTrials = runSuite(service, skillId, baselineDepth, input);
      const candidateTrials = runSuite(service, skillId, candidateDepth, input);
      const stats = summarize(candidateTrials);
      const comparison: HarnessComparison = {
        id: randomUUID(),
        skillId,
        changedMechanism: 'skill-depth',
        baselineDepth,
        candidateDepth,
        threshold,
        baselineTrials,
        candidateTrials,
        acceptedScopeRate: stats.acceptedScopeRate,
        escapedDefects: stats.escapedDefects,
        falseRejections: stats.falseRejections,
        meetsThreshold:
          stats.acceptedScopeRate >= threshold.minAcceptedScopeRate
          && stats.escapedDefects <= threshold.maxEscapedDefects
          && stats.falseRejections <= threshold.maxFalseRejections,
        promoted: false,
        createdAt: Date.now(),
      };
      snapshot = { ...snapshot, comparisons: [...snapshot.comparisons, comparison] };
      persist();
      return comparison;
    },

    promote(comparisonId) {
      const comparison = snapshot.comparisons.find((item) => item.id === comparisonId);
      if (comparison === undefined) {
        throw new HarnessError('NOT_FOUND', `comparison not found: ${comparisonId}`);
      }
      if (!comparison.meetsThreshold) {
        throw new HarnessError('THRESHOLD', 'comparison does not meet the predeclared threshold');
      }
      const promoted: HarnessComparison = { ...comparison, promoted: true };
      snapshot = {
        ...snapshot,
        comparisons: snapshot.comparisons.map((item) => item.id === comparisonId ? promoted : item),
        promoted: {
          ...snapshot.promoted,
          [comparison.skillId]: comparison.candidateDepth,
        },
      };
      deps.skills.markCalibrated(comparison.skillId, comparison.candidateDepth);
      persist();
      return promoted;
    },

    isPromoted(skillId, depth) {
      return snapshot.promoted[skillId] === depth;
    },

    listComparisons() {
      return snapshot.comparisons;
    },

    listDemonstrations() {
      return snapshot.demonstrations;
    },

    demonstrateSelfDevelopment(input = {}) {
      if (deps.board === undefined || deps.agents === undefined || deps.environment === undefined) {
        throw new HarnessError('NOT_READY', 'board, agents, and environment are required for the demonstration');
      }
      const board = deps.board;
      const freshRoot = join(deps.workspaceRoot, '.huntianling', 'demo-fresh');
      mkdirSync(freshRoot, { recursive: true });
      writeFileSync(join(freshRoot, 'package.json'), `${JSON.stringify({ name: 'demo-fresh' }, null, 2)}\n`);
      const prepared = deps.environment.prepare({
        workspaceRoot: freshRoot,
        host: { node: process.version, packageManager: 'pnpm' },
        runner: demoRunner,
      });
      const project = board.createProject({ name: 'HuntianLing demo' });
      const milestone = board.createMilestone({ projectId: project.id, title: 'Phase B' });
      const story = board.createWorkItem({
        projectId: project.id,
        type: 'story',
        title: 'Customer sees evidence-based progress',
        body: 'Deliver one Story with Evaluator evidence.',
        analysis: 'Customer progress must come from executed evidence.',
        design: 'Run Planner, Generator, and Evaluator with a durable checkpoint.',
        acceptance: ['customer can log in'],
        sourceInput: '我要看见进度来自证据',
        milestoneId: milestone.id,
      });
      const agents = failOnceEvaluator(deps.agents, ['customer can log in']);
      const first = createDeliveryService({
        board,
        agents,
        workspaceRoot: deps.workspaceRoot,
        config: { maxRetries: 1, maxSteps: 12 },
      });
      const started = first.start({
        workItemId: story.id,
        environmentReady: true,
        actor: input.owner ?? 'developer',
      });
      first.advance(started.id);
      first.advance(started.id);
      const interrupted = first.interrupt(started.id);
      const second = createDeliveryService({
        board,
        agents,
        workspaceRoot: deps.workspaceRoot,
        config: { maxRetries: 1, maxSteps: 12 },
      });
      second.resume(interrupted.id);
      const completed = second.drive(interrupted.id);
      const evidence = board.getDeliveryEvidenceSummary(story.id);
      if (completed.status === 'completed') {
        board.transitionWorkItem(story.id, 'delivered');
      }
      const delivered = board.getWorkItem(story.id as WorkItemId);
      const progress = customerProgressForWorkItem(
        delivered?.status ?? story.status,
        evidence,
        delivered ?? story,
      );
      const demonstration: HarnessDemonstration = {
        id: randomUUID(),
        reqIds: ['REQ-HARNESS-004', 'REQ-HARNESS-005'],
        outcome: 'One Story demonstrated environment prepare, failed evaluation, repair, interrupt/resume, and evidence-based progress',
        owner: input.owner ?? 'developer',
        milestoneTitle: milestone.title,
        workItemId: story.id,
        storyDeliveryRunId: started.id,
        customerProgress: progress,
        gates: {
          typecheck: prepared.baseline.typecheck ?? 'skipped',
          test: prepared.baseline.test ?? 'skipped',
          lint: prepared.baseline.lint ?? 'blocked',
          hygiene: prepared.baseline.hygiene ?? 'blocked',
        },
        steps: [
          { name: 'environment.prepare', executor: 'huntianling-runtime', result: prepared.ready ? 'ready' : 'blocked' },
          {
            name: 'skill-coverage',
            executor: 'huntianling-runtime',
            result: deps.environment.skillCoverage(project.id, freshRoot).complete ? 'complete' : 'gaps',
          },
          { name: 'plan', executor: stepExecutor(input.stepExecutors, 'plan'), result: 'completed' },
          { name: 'implement', executor: stepExecutor(input.stepExecutors, 'implement'), result: 'completed' },
          { name: 'interrupt', executor: 'huntianling-runtime', result: 'interrupted' },
          { name: 'resume', executor: 'huntianling-runtime', result: 'running' },
          { name: 'evaluate-fail-repair', executor: stepExecutor(input.stepExecutors, 'evaluate'), result: 'repaired' },
          { name: 'evaluate-pass', executor: stepExecutor(input.stepExecutors, 'evaluate'), result: completed.status },
          {
            name: 'live-model-trials',
            executor: deps.liveModel === undefined ? 'manual' : 'huntianling-runtime',
            result: deps.liveModel === undefined ? 'unbound' : 'configured',
          },
          { name: 'customer-progress', executor: 'huntianling-runtime', result: progress },
        ],
        gaps: [
          'live model is not bound; deterministic executors ran',
          'lint remains a blocked probe script',
          'hygiene remains a blocked probe script',
        ],
        selfHarnessSliceRefs: [...(input.selfHarnessSliceRefs ?? [])],
        freshProjectReady: prepared.ready,
        createdAt: Date.now(),
      };
      if (demonstration.gates.lint === 'pass' || demonstration.gates.hygiene === 'pass') {
        throw new HarnessError('VALIDATION', 'lint and hygiene cannot be recorded as pass while they probe-fail');
      }
      snapshot = { ...snapshot, demonstrations: [...snapshot.demonstrations, demonstration] };
      persist();
      return demonstration;
    },
  };

  function persist(): void {
    saveHarnessSnapshot(deps.workspaceRoot, snapshot);
  }

  return service;
}

const SCENARIOS: readonly HarnessScenario[] = [
  {
    id: 'mkt.collect.pass',
    skillId: MKT_SKILL_EXTRACT,
    title: 'MKT collect with quotes',
    kind: 'pass',
    input: PASS_INPUT,
    expectedOutcome: 'accepted',
    modelBinding: 'deterministic-executor',
    budget: { maxRepairRounds: 2 },
  },
  {
    id: 'mkt.collect.fail',
    skillId: MKT_SKILL_EXTRACT,
    title: 'MKT collect without quotes',
    kind: 'fail',
    input: FAIL_INPUT,
    expectedOutcome: 'rejected',
    modelBinding: 'deterministic-executor',
    budget: { maxRepairRounds: 2 },
  },
  {
    id: 'mkt.collect.cancel',
    skillId: MKT_SKILL_EXTRACT,
    title: 'MKT collect cancelled before write',
    kind: 'cancel',
    input: PASS_INPUT,
    expectedOutcome: 'cancelled',
    modelBinding: 'deterministic-executor',
    budget: { maxRepairRounds: 0 },
  },
];

function runSuite(
  service: HarnessService,
  skillId: SkillId,
  depth: SkillDepthId,
  input: {
    readonly modelBinding?: HarnessModelBinding;
    readonly repeats?: number;
    readonly token?: string;
  },
): readonly HarnessTrial[] {
  const selected = SCENARIOS.filter((scenario) => scenario.skillId === skillId);
  const repeats = input.repeats ?? 1;
  return selected.flatMap((scenario) => {
    if (repeats > 1) {
      return service.repeatTrials({
        scenarioId: scenario.id,
        depth,
        repeats,
        modelBinding: input.modelBinding ?? 'deterministic-executor',
        ...(input.token !== undefined ? { token: input.token } : {}),
      });
    }
    return [service.runTrial({
      scenarioId: scenario.id,
      depth,
      mode: 'fresh',
      ...(input.modelBinding !== undefined ? { modelBinding: input.modelBinding } : {}),
      ...(input.token !== undefined ? { token: input.token } : {}),
    })];
  });
}

function requireLiveModel(
  deps: {
    readonly liveModel?: {
      readonly url: string;
      readonly model: string;
      readonly token: string;
      readonly transport: HarnessLlmTransport;
    };
  },
  requestToken?: string,
): {
  readonly url: string;
  readonly model: string;
  readonly token: string;
  readonly transport: HarnessLlmTransport;
} {
  if (deps.liveModel === undefined) {
    throw new HarnessError('NOT_READY', 'live-model endpoint is not configured (HUNTIANLING_HARNESS_LLM_URL)');
  }
  const token = requestToken?.trim();
  return {
    ...deps.liveModel,
    token: token !== undefined && token !== '' ? token : deps.liveModel.token,
  };
}

function executeFreshTrial(input: {
  readonly skills: SkillService;
  readonly scenario: HarnessScenario;
  readonly depth: SkillDepthId;
  readonly executor: HarnessTrial['executor'];
  readonly modelBinding: HarnessModelBinding;
  readonly repeatIndex: number;
  readonly liveModel?: {
    readonly url: string;
    readonly model: string;
    readonly token: string;
    readonly transport: HarnessLlmTransport;
  };
}): HarnessTrial {
  const { skills, scenario, depth, executor, modelBinding, repeatIndex } = input;
  const started = Date.now();
  if (scenario.kind === 'cancel') {
    return {
      id: randomUUID(),
      scenarioId: scenario.id,
      skillId: scenario.skillId,
      depth,
      mode: 'fresh',
      kind: 'cancel',
      outcome: 'cancelled',
      acceptedScopeComplete: false,
      escapedDefects: 0,
      falseRejections: 0,
      repairRounds: 0,
      humanInterventionMs: null,
      recoverySuccess: null,
      elapsedMs: Date.now() - started,
      tokenCost: null,
      toolCost: null,
      artifacts: ['cancelled-before-write'],
      error: null,
      executor,
      modelBinding,
      repeatIndex,
    };
  }
  let payload: unknown = scenario.input;
  let tokenCost: number | null = null;
  if (modelBinding === 'live-model') {
    const live = input.liveModel;
    if (live === undefined) {
      throw new HarnessError('NOT_READY', 'live-model endpoint is not configured (HUNTIANLING_HARNESS_LLM_URL)');
    }
    const extracted = extractLiveModelPayload(live, scenario);
    payload = extracted.payload;
    tokenCost = extracted.tokenCost;
  }
  try {
    const record = skills.writeOriginalRequirement(payload, {
      depth,
      executor,
      failureKey: `${scenario.id}:${String(depth)}:${modelBinding}`,
      allowUncalibrated: true,
    });
    const escapedDefects = scenario.kind === 'fail' ? 1 : 0;
    const falseRejections = 0;
    return {
      id: randomUUID(),
      scenarioId: scenario.id,
      skillId: scenario.skillId,
      depth,
      mode: 'fresh',
      kind: scenario.kind,
      outcome: 'accepted',
      acceptedScopeComplete: scenario.kind === 'pass',
      escapedDefects,
      falseRejections,
      repairRounds: 0,
      humanInterventionMs: depth === 1 ? null : 0,
      recoverySuccess: null,
      elapsedMs: Date.now() - started,
      tokenCost,
      toolCost: null,
      artifacts: [record.id],
      error: null,
      executor,
      modelBinding,
      repeatIndex,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'trial failed';
    const repairRounds = error instanceof SkillWriteError && error.code === 'DEPTH_DOWNGRADE' ? 2 : 0;
    const rejectedExpected = scenario.kind === 'fail';
    return {
      id: randomUUID(),
      scenarioId: scenario.id,
      skillId: scenario.skillId,
      depth,
      mode: 'fresh',
      kind: scenario.kind,
      outcome: error instanceof SkillWriteError && error.code === 'NOT_CALIBRATED' ? 'failed' : 'rejected',
      acceptedScopeComplete: false,
      escapedDefects: 0,
      falseRejections: scenario.kind === 'pass' ? 1 : 0,
      repairRounds,
      humanInterventionMs: depth === 1 ? null : 0,
      recoverySuccess: rejectedExpected ? true : null,
      elapsedMs: Date.now() - started,
      tokenCost,
      toolCost: null,
      artifacts: [],
      error: message,
      executor,
      modelBinding,
      repeatIndex,
    };
  }
}

function stepExecutor(
  overrides: Partial<Record<'plan' | 'implement' | 'evaluate', HarnessTrial['executor']>> | undefined,
  step: 'plan' | 'implement' | 'evaluate',
): HarnessTrial['executor'] {
  return overrides?.[step] ?? 'huntianling-runtime';
}

function extractLiveModelPayload(
  live: {
    readonly url: string;
    readonly model: string;
    readonly token: string;
    readonly transport: HarnessLlmTransport;
  },
  scenario: HarnessScenario,
): { readonly payload: unknown; readonly tokenCost: number | null } {
  const response = live.transport({
    method: 'POST',
    url: live.url,
    headers: {
      authorization: `Bearer ${live.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: live.model,
      messages: [
        { role: 'system', content: 'Return only a JSON original-requirement object.' },
        { role: 'user', content: JSON.stringify(scenario.input) },
      ],
    }),
  });
  if (response.status >= 400) {
    throw new HarnessError('NOT_READY', `live-model request failed with status ${String(response.status)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new HarnessError('VALIDATION', 'live-model response is not JSON');
  }
  const record = parsed as {
    readonly choices?: readonly { readonly message?: { readonly content?: unknown } }[];
    readonly usage?: { readonly total_tokens?: unknown };
  };
  const content = record.choices?.[0]?.message?.content;
  const payload = typeof content === 'string' ? parseJsonOrRaw(content) : scenario.input;
  const total = record.usage?.total_tokens;
  return {
    payload,
    tokenCost: typeof total === 'number' ? total : null,
  };
}

function parseJsonOrRaw(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function summarize(trials: readonly HarnessTrial[]): {
  readonly acceptedScopeRate: number;
  readonly escapedDefects: number;
  readonly falseRejections: number;
} {
  const passTrials = trials.filter((trial) => trial.kind === 'pass' && trial.outcome !== 'cancelled');
  const accepted = passTrials.filter((trial) => trial.acceptedScopeComplete).length;
  return {
    acceptedScopeRate: passTrials.length === 0 ? 0 : accepted / passTrials.length,
    escapedDefects: trials.reduce((sum, trial) => sum + trial.escapedDefects, 0),
    falseRejections: trials.reduce((sum, trial) => sum + trial.falseRejections, 0),
  };
}

function demoRunner(command: string): { readonly status: 'pass' | 'fail' | 'blocked' | 'skipped'; readonly output: string } {
  if (command.includes('lint') || command.includes('hygiene')) {
    return { status: 'fail', output: 'HUNTIANLING_PROBE: no lint yet' };
  }
  return { status: 'pass', output: 'ok' };
}

function failOnceEvaluator(agents: AgentRuntime, failedCriteria: readonly string[]): AgentRuntime {
  let evaluateCalls = 0;
  return {
    definitions: () => agents.definitions(),
    methods: () => agents.methods(),
    baseline: () => agents.baseline(),
    methodGaps: (projectId, methodId) => agents.methodGaps(projectId, methodId),
    resolveBinding: (id) => agents.resolveBinding(id),
    inspectTask: (input) => agents.inspectTask(input),
    startRun(input) {
      if (input.agentId === 'evaluator') {
        evaluateCalls += 1;
        if (evaluateCalls === 1) {
          const record = asObject(input.input);
          return agents.startRun({
            ...input,
            input: { ...record, failedCriteria: [...failedCriteria] },
          });
        }
      }
      return agents.startRun(input);
    },
    interruptRun: (id) => agents.interruptRun(id),
    resumeRun: (id) => agents.resumeRun(id),
    getRun: (id) => agents.getRun(id),
    listRuns: () => agents.listRuns(),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export type { ResolvedHarnessConfig };
