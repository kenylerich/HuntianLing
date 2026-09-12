/**
 * Built-in harness tool registry.
 */

import { randomUUID } from 'node:crypto';

import {
  TOOL_CATEGORIES,
  ToolDeniedError,
  type ToolCallEvidence,
  type ToolCategory,
  type ToolId,
  type ToolRecord,
} from './types.js';

export const TOOL_ORIGINAL_REQUIREMENT_WRITE = 'original-requirement.write' as ToolId;
export const TOOL_TYPECHECK = 'typecheck.run' as ToolId;
export const TOOL_TEST = 'test.run' as ToolId;
export const TOOL_DOC_SYNC = 'doc-sync.run' as ToolId;
export const TOOL_GIT_PUSH = 'git.push' as ToolId;
export const TOOL_GIT_INSPECT = 'git.inspect' as ToolId;
export const TOOL_GIT_BRANCH = 'git.branch' as ToolId;
export const TOOL_GIT_COMMIT = 'git.commit' as ToolId;
export const TOOL_PULL_REQUEST = 'git.pull-request' as ToolId;
export const TOOL_MERGE = 'git.merge' as ToolId;
export const TOOL_CI_RUN = 'ci.run' as ToolId;
export const TOOL_CI_PRODUCTION = 'ci.production' as ToolId;
export const TOOL_DELIVERY_CONTRACT_WRITE = 'delivery-contract.write' as ToolId;
export const TOOL_IMPLEMENTATION_WRITE = 'implementation.write' as ToolId;
export const TOOL_EVALUATION_WRITE = 'evaluation.write' as ToolId;
export const TOOL_SKILL_CREATOR = 'skill-creator.draft' as ToolId;
export const TOOL_BROWSER_NAVIGATE = 'browser.navigate' as ToolId;
export const TOOL_IMAGE_ANALYZE = 'image.analyze' as ToolId;
export const TOOL_DOCUMENT_PARSE = 'document.parse' as ToolId;
export const TOOL_DATABASE_MIGRATE = 'database.migrate' as ToolId;
export const TOOL_WEB_API_CALL = 'web-api.call' as ToolId;

const BUILTIN_TOOLS: readonly ToolRecord[] = [
  {
    id: TOOL_ORIGINAL_REQUIREMENT_WRITE,
    capability: 'write-original-requirement',
    category: 'document',
    permission: 'write',
    risk: 'low',
    taskTypes: ['mkt.collect'],
    roles: ['mkt'],
  },
  {
    id: TOOL_TYPECHECK,
    capability: 'run-typecheck',
    category: 'terminal',
    permission: 'execute',
    risk: 'low',
    taskTypes: ['implement', 'evaluate', 'environment.prepare'],
    roles: ['generator', 'evaluator', 'environment'],
  },
  {
    id: TOOL_TEST,
    capability: 'run-tests',
    category: 'test',
    permission: 'execute',
    risk: 'low',
    taskTypes: ['implement', 'evaluate', 'environment.prepare'],
    roles: ['generator', 'evaluator', 'environment'],
  },
  {
    id: TOOL_DOC_SYNC,
    capability: 'run-doc-sync',
    category: 'terminal',
    permission: 'execute',
    risk: 'low',
    taskTypes: ['implement', 'evaluate', 'environment.prepare'],
    roles: ['generator', 'evaluator', 'environment'],
  },
  {
    id: TOOL_GIT_PUSH,
    capability: 'push-git',
    category: 'git',
    permission: 'write',
    risk: 'high',
    taskTypes: ['implement', 'scm.push'],
    roles: ['generator', 'scm'],
  },
  {
    id: TOOL_GIT_INSPECT,
    capability: 'inspect-git',
    category: 'git',
    permission: 'read',
    risk: 'low',
    taskTypes: ['scm.inspect', 'scm.link'],
    roles: ['scm', 'evaluator'],
  },
  {
    id: TOOL_GIT_BRANCH,
    capability: 'create-git-branch',
    category: 'git',
    permission: 'write',
    risk: 'medium',
    taskTypes: ['implement', 'scm.branch'],
    roles: ['generator', 'scm'],
  },
  {
    id: TOOL_GIT_COMMIT,
    capability: 'create-git-commit',
    category: 'git',
    permission: 'write',
    risk: 'medium',
    taskTypes: ['implement', 'scm.commit'],
    roles: ['generator', 'scm'],
  },
  {
    id: TOOL_PULL_REQUEST,
    capability: 'open-pull-request',
    category: 'git',
    permission: 'write',
    risk: 'high',
    taskTypes: ['implement', 'scm.pull-request'],
    roles: ['generator', 'scm'],
  },
  {
    id: TOOL_MERGE,
    capability: 'merge-git',
    category: 'git',
    permission: 'write',
    risk: 'high',
    taskTypes: ['implement', 'scm.merge'],
    roles: ['generator', 'scm'],
  },
  {
    id: TOOL_CI_RUN,
    capability: 'run-local-ci',
    category: 'ci',
    permission: 'execute',
    risk: 'medium',
    taskTypes: ['ci.run', 'evaluate'],
    roles: ['ci', 'evaluator'],
  },
  {
    id: TOOL_CI_PRODUCTION,
    capability: 'trigger-production-ci',
    category: 'ci',
    permission: 'execute',
    risk: 'high',
    taskTypes: ['ci.production'],
    roles: ['ci', 'evaluator'],
  },
  {
    id: TOOL_DELIVERY_CONTRACT_WRITE,
    capability: 'write-delivery-contract',
    category: 'document',
    permission: 'write',
    risk: 'low',
    taskTypes: ['plan'],
    roles: ['planner'],
  },
  {
    id: TOOL_IMPLEMENTATION_WRITE,
    capability: 'write-implementation-record',
    category: 'filesystem',
    permission: 'write',
    risk: 'medium',
    taskTypes: ['implement'],
    roles: ['generator'],
  },
  {
    id: TOOL_EVALUATION_WRITE,
    capability: 'write-evaluation-record',
    category: 'document',
    permission: 'write',
    risk: 'low',
    taskTypes: ['evaluate'],
    roles: ['evaluator'],
  },
  {
    id: TOOL_SKILL_CREATOR,
    capability: 'draft-agile-skill',
    category: 'document',
    permission: 'write',
    risk: 'medium',
    taskTypes: ['skill.create'],
    roles: ['developer', 'planner'],
  },
  {
    id: TOOL_BROWSER_NAVIGATE,
    capability: 'navigate-local-browser',
    category: 'browser',
    permission: 'execute',
    risk: 'medium',
    taskTypes: ['implement', 'evaluate', 'browser.inspect'],
    roles: ['generator', 'evaluator'],
  },
  {
    id: TOOL_IMAGE_ANALYZE,
    capability: 'analyze-image',
    category: 'image',
    permission: 'read',
    risk: 'low',
    taskTypes: ['mkt.collect', 'plan', 'evaluate'],
    roles: ['mkt', 'planner', 'evaluator'],
  },
  {
    id: TOOL_DOCUMENT_PARSE,
    capability: 'parse-document',
    category: 'document',
    permission: 'read',
    risk: 'low',
    taskTypes: ['mkt.collect', 'plan', 'implement'],
    roles: ['mkt', 'planner', 'generator'],
  },
  {
    id: TOOL_DATABASE_MIGRATE,
    capability: 'migrate-database',
    category: 'database',
    permission: 'write',
    risk: 'high',
    taskTypes: ['implement', 'environment.prepare'],
    roles: ['generator', 'environment'],
  },
  {
    id: TOOL_WEB_API_CALL,
    capability: 'call-web-api',
    category: 'web-api',
    permission: 'execute',
    risk: 'medium',
    taskTypes: ['implement', 'evaluate', 'web-api.call', 'scm.inspect', 'ci.run'],
    roles: ['generator', 'evaluator', 'scm', 'ci'],
  },
];

export interface ToolRegistry {
  get(id: ToolId): ToolRecord | undefined;
  list(): readonly ToolRecord[];
  categories(): readonly { readonly category: ToolCategory; readonly tools: readonly ToolRecord[] }[];
  assertAllowed(toolId: ToolId, role: string, taskType: string): ToolRecord;
  recordCall(input: {
    readonly toolId: ToolId;
    readonly role: string;
    readonly taskType: string;
    readonly affectsDelivery: boolean;
    readonly result: ToolCallEvidence['result'];
    readonly detail: string;
  }): ToolCallEvidence;
  evidence(): readonly ToolCallEvidence[];
}

export function createToolRegistry(tools: readonly ToolRecord[] = BUILTIN_TOOLS): ToolRegistry {
  const byId = new Map(tools.map((tool) => [tool.id, tool]));
  const calls: ToolCallEvidence[] = [];

  const registry: ToolRegistry = {
    get(id) {
      return byId.get(id);
    },
    list() {
      return [...byId.values()];
    },
    categories() {
      return TOOL_CATEGORIES.map((category) => ({
        category,
        tools: [...byId.values()].filter((tool) => tool.category === category),
      }));
    },
    assertAllowed(toolId, role, taskType) {
      const tool = byId.get(toolId);
      if (tool === undefined) {
        throw new ToolDeniedError(toolId, role, taskType);
      }
      if (!tool.roles.includes(role) || !tool.taskTypes.includes(taskType)) {
        registry.recordCall({
          toolId,
          role,
          taskType,
          affectsDelivery: false,
          result: 'denied',
          detail: 'role or task is not allowed',
        });
        throw new ToolDeniedError(toolId, role, taskType);
      }
      return tool;
    },
    recordCall(input) {
      const evidence: ToolCallEvidence = {
        id: randomUUID(),
        toolId: input.toolId,
        role: input.role,
        taskType: input.taskType,
        affectsDelivery: input.affectsDelivery,
        result: input.result,
        detail: input.detail,
      };
      calls.push(evidence);
      return evidence;
    },
    evidence() {
      return [...calls];
    },
  };
  return registry;
}
