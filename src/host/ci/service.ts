/**
 * Local and hosted CI adapters: collect checks with independently verified provenance.
 */

import type { AuthorityService } from '../authority/service.js';
import { randomUUID } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { workspaceRevision } from '../board/execution-records.js';
import { resolveCiConfig, runLocalCheck } from './local.js';
import type { CiConfig } from './types.js';
import { AuthorityError } from '../authority/types.js';
import type { BoardService } from '../board/plugin.js';
import {
  mergeChecksByProducer,
  workItemDesignRevision,
} from '../board/executed-evidence.js';
import type { DeliveryEvidenceCheck, DeliveryEvidenceLink, DeliveryEvidenceSummary, WorkItemId } from '../board/types.js';
import { HUNTIANLING_NODE_PNPM_PROFILE } from '../environment/profile.js';
import type { CheckResult } from '../environment/types.js';
import { createToolRegistry, TOOL_CI_PRODUCTION, TOOL_CI_RUN, type ToolRegistry } from '../tools/registry.js';
import { parseCiArtifact } from './artifacts.js';
import {
  defaultHostedCiTransport,
  hostedListWorkflows,
  hostedTriggerAndCollect,
  parseHostedCiProvider,
  resolveHostedCiTarget,
  resolveHostedCiToken,
} from './hosted.js';
import type {
  CiCommandRunner,
  CiCommandSpec,
  CiRunInput,
  CiWorkflowListInput,
  HostedCiTransport,
  HostedCiWorkflow,
} from './types.js';
import { CiError } from './types.js';

export interface CiService {
  run(input: CiRunInput): DeliveryEvidenceSummary;
  listWorkflows(input: CiWorkflowListInput): readonly HostedCiWorkflow[];
}

export function createCiService(deps: {
  readonly board: BoardService;
  readonly runner?: CiCommandRunner;
  readonly hosted?: HostedCiTransport;
  readonly tools?: ToolRegistry;
  readonly authority?: AuthorityService;
  readonly env?: NodeJS.ProcessEnv;
  readonly workspaceRoot?: string;
  readonly config?: CiConfig;
}): CiService {
  const config = resolveCiConfig(deps.config);
  const tools = deps.tools ?? createToolRegistry();
  const hosted = deps.hosted ?? defaultHostedCiTransport;
  const env = deps.env ?? process.env;

  function runHosted(input: CiRunInput, role: string): DeliveryEvidenceSummary {
    const item = deps.board.getWorkItem(input.workItemId as WorkItemId);
    if (item === undefined) {
      throw new CiError('NOT_FOUND', `work item not found: ${input.workItemId}`);
    }
    assertAuthority(deps.authority, {
      role,
      action: 'ci_trigger',
      projectId: item.projectId,
      actor: input.actor ?? 'ci',
      workItemId: item.id,
      workItemType: item.type,
      ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
    });
    const target = resolveHostedCiTarget({
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.owner !== undefined ? { owner: input.owner } : {}),
      ...(input.repo !== undefined ? { repo: input.repo } : {}),
      ...(input.apiBaseUrl !== undefined ? { apiBaseUrl: input.apiBaseUrl } : {}),
    });
    const workflow = input.workflow?.trim() ?? '';
    const ref = input.ref?.trim() || 'main';
    if (target.provider !== 'gitlab-ci' && workflow === '') {
      throw new CiError('VALIDATION', `hosted ${target.provider} requires workflow`);
    }
    const token = resolveHostedCiToken(target.provider, input.token, env);
    deps.board.beginExecutionEvidence(item.id);
    const collected = hostedTriggerAndCollect({
      transport: hosted,
      target,
      token,
      workflow: workflow === '' ? '.gitlab-ci.yml' : workflow,
      ref,
    });
    const revision = workItemDesignRevision(item);
    const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
    const runId = `ci:${target.provider}:${collected.runId}`;
    const ciRuns: DeliveryEvidenceLink[] = [
      {
        kind: 'ci-run',
        id: runId,
        label: `${target.provider} ${collected.conclusion}`,
        url: collected.url,
        acceptanceCriterionIds: [],
      },
    ];
    const evidenceLinks: DeliveryEvidenceLink[] = [];
    const checks: DeliveryEvidenceCheck[] = [
      {
        id: `ci-hosted-${collected.runId}`,
        area: 'ci',
        title: `${target.provider} pipeline`,
        status: collected.conclusion === 'success' ? 'passing' : 'failing',
        required: true,
        reason: collected.logs.trim() === '' ? collected.conclusion : collected.logs.trim().slice(0, 240),
        evidenceIds: [runId],
        acceptanceCriterionIds: [],
        links: ciRuns,
        producer: 'ci',
        executionKind: 'executed',
        designRevision: revision,
      },
    ];
    for (const artifact of collected.artifacts) {
      const parsed = parseCiArtifact(artifact.name, artifact.content);
      const artifactId = `ci-artifact:${collected.runId}:${artifact.name}`;
      const kind = parsed?.kind === 'coverage'
        ? 'coverage-report' as const
        : parsed?.kind === 'sarif'
          ? 'security-finding' as const
          : 'ci-artifact' as const;
      evidenceLinks.push({
        kind,
        id: artifactId,
        label: artifact.name,
        url: artifact.url,
        acceptanceCriterionIds: [],
      });
      if (parsed?.kind === 'junit') {
        checks.push({
          id: `ci-junit-${collected.runId}`,
          area: 'ci',
          title: 'JUnit',
          status: parsed.failures === 0 && parsed.errors === 0 ? 'passing' : 'failing',
          required: true,
          reason: `${String(parsed.tests)} tests, ${String(parsed.failures)} failures, ${String(parsed.errors)} errors`,
          evidenceIds: [artifactId],
          acceptanceCriterionIds: [],
          links: [evidenceLinks[evidenceLinks.length - 1]!],
          producer: 'ci',
          executionKind: 'executed',
          designRevision: revision,
        });
      } else if (parsed?.kind === 'coverage') {
        checks.push({
          id: `ci-coverage-${collected.runId}`,
          area: 'ci',
          title: 'Coverage',
          status: 'passing',
          required: false,
          reason: `${parsed.percent.toFixed(1)}% lines`,
          evidenceIds: [artifactId],
          acceptanceCriterionIds: [],
          links: [evidenceLinks[evidenceLinks.length - 1]!],
          producer: 'ci',
          executionKind: 'executed',
          designRevision: revision,
        });
      } else if (parsed?.kind === 'sarif') {
        for (const finding of parsed.findings) {
          evidenceLinks.push({
            kind: 'security-finding',
            id: `ci-sarif-${collected.runId}:${finding.ruleId}`,
            label: `${finding.level} ${finding.ruleId}`,
            url: artifact.url,
            acceptanceCriterionIds: [],
          });
        }
        checks.push({
          id: `ci-sarif-${collected.runId}`,
          area: 'security',
          title: 'SARIF',
          status: parsed.errors === 0 ? 'passing' : 'failing',
          required: parsed.errors > 0,
          reason: `${String(parsed.errors)} errors, ${String(parsed.warnings)} warnings`,
          evidenceIds: [artifactId],
          acceptanceCriterionIds: [],
          links: evidenceLinks.filter((link) => link.id.startsWith(`ci-sarif-${collected.runId}`) || link.id === artifactId),
          producer: 'ci',
          executionKind: 'executed',
          designRevision: revision,
        });
      } else if (parsed?.kind === 'playwright') {
        checks.push({
          id: `ci-playwright-${collected.runId}`,
          area: 'ci',
          title: 'Playwright',
          status: parsed.unexpected === 0 ? 'passing' : 'failing',
          required: true,
          reason: `${String(parsed.expected)} passed, ${String(parsed.unexpected)} failed, ${String(parsed.skipped)} skipped`,
          evidenceIds: [artifactId],
          acceptanceCriterionIds: [],
          links: [evidenceLinks[evidenceLinks.length - 1]!],
          producer: 'ci',
          executionKind: 'executed',
          designRevision: revision,
        });
      }
    }
    tools.recordCall({
      toolId: TOOL_CI_RUN,
      role: role === 'evaluator' ? 'evaluator' : 'ci',
      taskType: 'ci.run',
      affectsDelivery: true,
      result: 'ran',
      detail: `${target.provider}:${collected.runId}:${collected.conclusion}`,
    });
    return deps.board.updateDeliveryEvidenceSummary(item.id, {
      ciRuns: [
        ...(existing?.ciRuns ?? []).filter((link) => !ciRuns.some((next) => next.id === link.id)),
        ...ciRuns,
      ],
      evidenceLinks: [
        ...(existing?.evidenceLinks ?? []).filter((link) => !evidenceLinks.some((next) => next.id === link.id)),
        ...evidenceLinks,
      ],
      checks: mergeChecksByProducer(existing?.checks ?? [], checks, 'ci'),
      provenanceLinks: [
        ...(existing?.provenanceLinks ?? []).filter((link) => link.id !== 'ci-run'),
        {
          kind: 'ci-run',
          id: 'ci-run',
          label: `${target.provider} adapter`,
          url: collected.url,
          acceptanceCriterionIds: [],
        },
      ],
      designRevision: revision,
    });
  }

  return {
    listWorkflows(input) {
      const role = input.role ?? 'ci';
      tools.assertAllowed(TOOL_CI_RUN, role === 'evaluator' ? 'evaluator' : 'ci', role === 'evaluator' ? 'evaluate' : 'ci.run');
      const target = resolveHostedCiTarget({
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        ...(input.owner !== undefined ? { owner: input.owner } : {}),
        ...(input.repo !== undefined ? { repo: input.repo } : {}),
        ...(input.apiBaseUrl !== undefined ? { apiBaseUrl: input.apiBaseUrl } : {}),
      });
      const token = resolveHostedCiToken(target.provider, input.token, env);
      return hostedListWorkflows({
        transport: hosted,
        target,
        token,
        ...(input.ref !== undefined ? { ref: input.ref } : {}),
      });
    },

    run(input) {
      const production = input.production === true;
      const role = input.role ?? (production ? 'evaluator' : 'ci');
      const hostedProvider = parseHostedCiProvider(input.provider);
      if (production) {
        tools.assertAllowed(TOOL_CI_PRODUCTION, role, 'ci.production');
        const itemForAuth = deps.board.getWorkItem(input.workItemId as WorkItemId);
        if (itemForAuth === undefined) {
          throw new CiError('NOT_FOUND', `work item not found: ${input.workItemId}`);
        }
        assertAuthority(deps.authority, {
          role,
          action: 'production_deploy',
          projectId: itemForAuth.projectId,
          actor: input.actor ?? 'ci',
          workItemId: itemForAuth.id,
          workItemType: itemForAuth.type,
          ...(input.approvalId !== undefined ? { approvalId: input.approvalId } : {}),
        });
        tools.recordCall({
          toolId: TOOL_CI_PRODUCTION,
          role,
          taskType: 'ci.production',
          affectsDelivery: true,
          result: 'allowed',
          detail: 'production ci authorized',
        });
      } else {
        tools.assertAllowed(TOOL_CI_RUN, role === 'evaluator' ? 'evaluator' : 'ci', role === 'evaluator' ? 'evaluate' : 'ci.run');
      }
      if (hostedProvider !== 'local') {
        return runHosted(input, role);
      }
      const item = deps.board.getWorkItem(input.workItemId as WorkItemId);
      if (item === undefined) {
        throw new CiError('NOT_FOUND', `work item not found: ${input.workItemId}`);
      }
      const commands = input.commands ?? defaultLocalCommands();
      if (commands.length === 0) {
        throw new CiError('VALIDATION', 'CI run requires at least one command');
      }
      const root = deps.workspaceRoot ?? input.workspaceRoot;
      if (root === undefined) throw new CiError('VALIDATION', 'CI workspace is not configured');
      if (deps.workspaceRoot !== undefined && input.workspaceRoot !== undefined
        && realpathSync(input.workspaceRoot) !== realpathSync(deps.workspaceRoot)) {
        throw new CiError('VALIDATION', 'CI workspace differs from configured workspace');
      }
      const runner = input.runner ?? deps.runner ?? ((command: string) => runLocalCheck(command, root, config));
      const native = input.runner === undefined && deps.runner === undefined;
      deps.board.beginExecutionEvidence(item.id);
      const candidateRevision = native && config.localExecution === 'enabled' && existsSync(root) ? workspaceRevision(root) : null;
      const revision = workItemDesignRevision(item);
      const existing = deps.board.listDeliveryEvidenceSummaries({ workItemId: item.id })[0];
      const existingChecks = existing?.checks ?? [];
      const existingRuns = existing?.ciRuns ?? [];
      const existingProvenance = existing?.provenanceLinks ?? [];
      const ciRuns: DeliveryEvidenceLink[] = [];
      const checks: DeliveryEvidenceCheck[] = [];
      let candidateChanged = false;
      for (const spec of commands) {
        const before = candidateRevision === null ? null : workspaceRevision(root);
        const ran = runner(spec.command);
        if (candidateRevision !== null && (before !== candidateRevision || workspaceRevision(root) !== candidateRevision)) candidateChanged = true;
        const runId = `ci:${randomUUID()}:${spec.id}`;
        const observed = candidateRevision !== null && typeof ran.exitCode === 'number' && ran.timedOut !== true && !ran.signal;
        const status = observed && ran.exitCode !== 0 && ran.status === 'pass' ? 'fail' : ran.status;
        ciRuns.push({
          kind: 'ci-run',
          id: runId,
          label: `${spec.id}: ${ran.status}`,
          url: null,
          acceptanceCriterionIds: [],
        });
        checks.push({
          id: `ci-${spec.id}`,
          area: 'ci',
          title: spec.command,
          status: ciStatus(status),
          required: spec.required,
          reason: ran.output.trim() === '' ? ran.status : ran.output.trim().slice(0, 240),
          evidenceIds: [runId],
          acceptanceCriterionIds: [],
          links: [],
          producer: 'ci',
          executionKind: observed ? 'executed' : 'demonstration',
          designRevision: revision,
        });
        tools.recordCall({
          toolId: TOOL_CI_RUN,
          role: 'ci',
          taskType: 'ci.run',
          affectsDelivery: spec.required,
          result: ran.status === 'skipped' || ran.status === 'blocked' ? 'allowed' : 'ran',
          detail: `${spec.id}:${ran.status}`,
        });
      }
      const executed = checks.filter(check => check.executionKind === 'executed');
      if (executed.length > 0 && candidateRevision !== null) {
        if (!candidateChanged && workspaceRevision(root) === candidateRevision
          && checks.every(check => check.executionKind === 'executed')) {
          for (let index = 0; index < checks.length; index += 1) {
            checks[index] = { ...checks[index]!, executionKind: 'manual',
              reason: `${checks[index]!.reason}; diagnostic only: process containment is unverified` };
          }
        }
        else {
          for (let index = 0; index < checks.length; index += 1) {
            checks[index] = { ...checks[index]!, status: 'blocked', executionKind: 'demonstration',
              reason: 'candidate changed during CI; rerun on a stable revision' };
          }
        }
      }
      return deps.board.updateDeliveryEvidenceSummary(item.id, {
        ciRuns: [
          ...existingRuns.filter((link) => !ciRuns.some((next) => next.id === link.id)),
          ...ciRuns,
        ],
        checks: mergeChecksByProducer(existingChecks, checks, 'ci'),
        provenanceLinks: [
          ...existingProvenance.filter((link) => link.id !== 'ci-run'),
          {
            kind: 'ci-run',
            id: 'ci-run',
            label: 'local command runner',
            url: null,
            acceptanceCriterionIds: [],
          },
        ],
        designRevision: revision,
      });
    },
  };
}

function defaultLocalCommands(): readonly CiCommandSpec[] {
  return HUNTIANLING_NODE_PNPM_PROFILE.commands
    .filter((spec) => spec.required)
    .map((spec) => ({
      id: spec.id,
      command: spec.command,
      required: spec.required,
    }));
}

function ciStatus(status: CheckResult): DeliveryEvidenceCheck['status'] {
  if (status === 'pass') return 'passing';
  if (status === 'blocked') return 'blocked';
  if (status === 'skipped') return 'pending';
  return 'failing';
}

function assertAuthority(
  authority: AuthorityService | undefined,
  input: Parameters<AuthorityService['assert']>[0],
): void {
  if (authority === undefined) {
    throw new CiError('AUTHORITY', 'authority is required for production CI');
  }
  try {
    authority.assert(input);
  } catch (error) {
    if (error instanceof AuthorityError) {
      throw new CiError('AUTHORITY', error.message);
    }
    throw error;
  }
}

export { CiError };
