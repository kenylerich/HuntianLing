/**
 * Versioned Planner, Generator, Evaluator, and specialist task definitions.
 */

import {
  SKILL_EVALUATOR_EVALUATE,
  SKILL_GENERATOR_IMPLEMENT,
  SKILL_PLANNER_CONTRACT,
  SKILL_PLANNER_USER_STORY,
} from '../skills/coding-pack.js';
import {
  SKILL_ARCHITECT,
  SKILL_BACKEND_DEVELOPER,
  SKILL_BUSINESS_ANALYST,
  SKILL_DEVOPS,
  SKILL_FRONTEND_DEVELOPER,
  SKILL_PRODUCT_OWNER,
  SKILL_QA_ENGINEER,
  SKILL_SCRUM_MASTER,
  SKILL_SECURITY_REVIEWER,
  SKILL_TECHNICAL_WRITER,
  SKILL_UX_DESIGNER,
} from '../skills/specialist-pack.js';
import {
  TOOL_BROWSER_NAVIGATE,
  TOOL_CI_RUN,
  TOOL_DELIVERY_CONTRACT_WRITE,
  TOOL_DOCUMENT_PARSE,
  TOOL_EVALUATION_WRITE,
  TOOL_GIT_BRANCH,
  TOOL_GIT_COMMIT,
  TOOL_GIT_PUSH,
  TOOL_IMAGE_ANALYZE,
  TOOL_IMPLEMENTATION_WRITE,
  TOOL_MERGE,
  TOOL_PULL_REQUEST,
  TOOL_TEST,
  TOOL_TYPECHECK,
  TOOL_WEB_API_CALL,
} from '../tools/registry.js';
import type { AgentBindingRole, AgentDefinition, AgentId, SpecialistAgentId } from './types.js';

export const PLANNER_DEFINITION: AgentDefinition = {
  id: 'planner',
  version: '1.0.0',
  kind: 'coding',
  role: 'planner',
  bindingRole: 'planner',
  taskType: 'plan',
  responsibilities: ['Turn confirmed original requirements into a delivery contract'],
  allowedTaskTypes: ['plan'],
  requiredSkillIds: [SKILL_PLANNER_CONTRACT],
  allowedToolIds: [TOOL_DELIVERY_CONTRACT_WRITE],
  inputSchema: 'huntianling.original-requirement.v1',
  outputSchema: 'huntianling.delivery-contract.v1',
  outputExpectations: ['outcome', 'acceptance'],
  defaultDepth: 1,
  modelBinding: 'configurable',
};

export const GENERATOR_DEFINITION: AgentDefinition = {
  id: 'generator',
  version: '1.0.0',
  kind: 'coding',
  role: 'generator',
  bindingRole: 'generator',
  taskType: 'implement',
  responsibilities: ['Implement an agreed delivery contract in a prepared environment'],
  allowedTaskTypes: ['implement'],
  requiredSkillIds: [SKILL_GENERATOR_IMPLEMENT],
  allowedToolIds: [
    TOOL_IMPLEMENTATION_WRITE,
    TOOL_TYPECHECK,
    TOOL_TEST,
    TOOL_GIT_BRANCH,
    TOOL_GIT_COMMIT,
    TOOL_GIT_PUSH,
    TOOL_PULL_REQUEST,
    TOOL_MERGE,
    TOOL_DOCUMENT_PARSE,
    TOOL_BROWSER_NAVIGATE,
    TOOL_WEB_API_CALL,
  ],
  inputSchema: 'huntianling.delivery-contract.v1',
  outputSchema: 'huntianling.implementation-record.v1',
  outputExpectations: ['files', 'selfCheck'],
  defaultDepth: 1,
  modelBinding: 'configurable',
};

export const EVALUATOR_DEFINITION: AgentDefinition = {
  id: 'evaluator',
  version: '1.0.0',
  kind: 'coding',
  role: 'evaluator',
  bindingRole: 'evaluator',
  taskType: 'evaluate',
  responsibilities: ['Independently score a candidate against agreed acceptance'],
  allowedTaskTypes: ['evaluate'],
  requiredSkillIds: [SKILL_EVALUATOR_EVALUATE],
  allowedToolIds: [TOOL_EVALUATION_WRITE, TOOL_TEST, TOOL_CI_RUN, TOOL_IMAGE_ANALYZE, TOOL_BROWSER_NAVIGATE, TOOL_WEB_API_CALL],
  inputSchema: 'huntianling.implementation-record.v1',
  outputSchema: 'huntianling.evaluation-record.v1',
  outputExpectations: ['criteria', 'decision'],
  defaultDepth: 1,
  modelBinding: 'configurable',
};

function specialist(input: {
  readonly id: SpecialistAgentId;
  readonly bindingRole: AgentBindingRole;
  readonly taskType: string;
  readonly responsibilities: readonly string[];
  readonly skillId: AgentDefinition['requiredSkillIds'][number];
  readonly allowedToolIds: AgentDefinition['allowedToolIds'];
  readonly outputSchema: string;
  readonly outputExpectations: readonly string[];
}): AgentDefinition {
  return {
    id: input.id,
    version: '1.0.0',
    kind: 'specialist',
    role: input.id,
    bindingRole: input.bindingRole,
    taskType: input.taskType,
    responsibilities: input.responsibilities,
    allowedTaskTypes: [input.taskType],
    requiredSkillIds: [input.skillId],
    allowedToolIds: input.allowedToolIds,
    inputSchema: input.bindingRole === 'planner' ? 'huntianling.original-requirement.v1' : 'huntianling.implementation-record.v1',
    outputSchema: input.outputSchema,
    outputExpectations: input.outputExpectations,
    defaultDepth: 1,
    modelBinding: 'configurable',
  };
}

export const PRODUCT_OWNER_DEFINITION: AgentDefinition = specialist({
  id: 'product-owner',
  bindingRole: 'planner',
  taskType: 'plan',
  responsibilities: ['Prioritize scope and accept work without writing code'],
  skillId: SKILL_PRODUCT_OWNER,
  allowedToolIds: [TOOL_DELIVERY_CONTRACT_WRITE],
  outputSchema: 'huntianling.product-owner.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const BUSINESS_ANALYST_DEFINITION: AgentDefinition = specialist({
  id: 'business-analyst',
  bindingRole: 'planner',
  taskType: 'plan',
  responsibilities: ['Clarify actors, rules, and acceptance without writing code'],
  skillId: SKILL_BUSINESS_ANALYST,
  allowedToolIds: [TOOL_DELIVERY_CONTRACT_WRITE, TOOL_DOCUMENT_PARSE],
  outputSchema: 'huntianling.business-analyst.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const UX_DESIGNER_DEFINITION: AgentDefinition = specialist({
  id: 'ux-designer',
  bindingRole: 'evaluator',
  taskType: 'evaluate',
  responsibilities: ['Review interaction and copy against acceptance'],
  skillId: SKILL_UX_DESIGNER,
  allowedToolIds: [TOOL_EVALUATION_WRITE, TOOL_BROWSER_NAVIGATE, TOOL_IMAGE_ANALYZE],
  outputSchema: 'huntianling.ux-designer.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const ARCHITECT_DEFINITION: AgentDefinition = specialist({
  id: 'architect',
  bindingRole: 'planner',
  taskType: 'plan',
  responsibilities: ['Record design constraints without writing production code'],
  skillId: SKILL_ARCHITECT,
  allowedToolIds: [TOOL_DELIVERY_CONTRACT_WRITE],
  outputSchema: 'huntianling.architect.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const FRONTEND_DEVELOPER_DEFINITION: AgentDefinition = specialist({
  id: 'frontend-developer',
  bindingRole: 'planner',
  taskType: 'plan',
  responsibilities: ['Plan frontend work without installing a technology skill pack'],
  skillId: SKILL_FRONTEND_DEVELOPER,
  allowedToolIds: [TOOL_DELIVERY_CONTRACT_WRITE, TOOL_BROWSER_NAVIGATE],
  outputSchema: 'huntianling.frontend-developer.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const BACKEND_DEVELOPER_DEFINITION: AgentDefinition = specialist({
  id: 'backend-developer',
  bindingRole: 'planner',
  taskType: 'plan',
  responsibilities: ['Plan backend work without installing a technology skill pack'],
  skillId: SKILL_BACKEND_DEVELOPER,
  allowedToolIds: [TOOL_DELIVERY_CONTRACT_WRITE, TOOL_DOCUMENT_PARSE],
  outputSchema: 'huntianling.backend-developer.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const QA_ENGINEER_DEFINITION: AgentDefinition = specialist({
  id: 'qa-engineer',
  bindingRole: 'evaluator',
  taskType: 'evaluate',
  responsibilities: ['Independently verify delivery evidence'],
  skillId: SKILL_QA_ENGINEER,
  allowedToolIds: [TOOL_EVALUATION_WRITE, TOOL_TEST],
  outputSchema: 'huntianling.qa-engineer.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const DEVOPS_DEFINITION: AgentDefinition = specialist({
  id: 'devops',
  bindingRole: 'evaluator',
  taskType: 'evaluate',
  responsibilities: ['Review release evidence without merging'],
  skillId: SKILL_DEVOPS,
  allowedToolIds: [TOOL_EVALUATION_WRITE, TOOL_CI_RUN],
  outputSchema: 'huntianling.devops.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const SECURITY_REVIEWER_DEFINITION: AgentDefinition = specialist({
  id: 'security-reviewer',
  bindingRole: 'evaluator',
  taskType: 'evaluate',
  responsibilities: ['Review security-sensitive changes before release'],
  skillId: SKILL_SECURITY_REVIEWER,
  allowedToolIds: [TOOL_EVALUATION_WRITE],
  outputSchema: 'huntianling.security-reviewer.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const SCRUM_MASTER_DEFINITION: AgentDefinition = specialist({
  id: 'scrum-master',
  bindingRole: 'planner',
  taskType: 'plan',
  responsibilities: ['Inspect flow blockers without changing code'],
  skillId: SKILL_SCRUM_MASTER,
  allowedToolIds: [TOOL_DELIVERY_CONTRACT_WRITE],
  outputSchema: 'huntianling.scrum-master.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const TECHNICAL_WRITER_DEFINITION: AgentDefinition = specialist({
  id: 'technical-writer',
  bindingRole: 'evaluator',
  taskType: 'evaluate',
  responsibilities: ['Draft documentation from accepted behavior'],
  skillId: SKILL_TECHNICAL_WRITER,
  allowedToolIds: [TOOL_EVALUATION_WRITE],
  outputSchema: 'huntianling.technical-writer.v1',
  outputExpectations: ['findings', 'nextActions'],
});

export const SPECIALIST_DEFINITIONS: readonly AgentDefinition[] = [
  PRODUCT_OWNER_DEFINITION,
  BUSINESS_ANALYST_DEFINITION,
  UX_DESIGNER_DEFINITION,
  ARCHITECT_DEFINITION,
  FRONTEND_DEVELOPER_DEFINITION,
  BACKEND_DEVELOPER_DEFINITION,
  QA_ENGINEER_DEFINITION,
  DEVOPS_DEFINITION,
  SECURITY_REVIEWER_DEFINITION,
  SCRUM_MASTER_DEFINITION,
  TECHNICAL_WRITER_DEFINITION,
];

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  PLANNER_DEFINITION,
  GENERATOR_DEFINITION,
  EVALUATOR_DEFINITION,
  ...SPECIALIST_DEFINITIONS,
];

export function definitionFor(agentId: AgentId): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find((item) => item.id === agentId);
}

export function requireAgentId(value: string): AgentId {
  const definition = AGENT_DEFINITIONS.find((item) => item.id === value);
  if (definition === undefined) {
    throw new Error(`unknown agent: ${value}`);
  }
  return definition.id;
}

export function applyAgentCustomization(
  definition: AgentDefinition,
  customization: {
    readonly allowedToolIds?: readonly string[];
    readonly requiredSkillIds?: readonly string[];
  } | undefined,
): AgentDefinition {
  if (customization === undefined) return definition;
  const requestedTools = customization.allowedToolIds;
  const requestedSkills = customization.requiredSkillIds;
  if (requestedTools !== undefined) {
    for (const toolId of requestedTools) {
      if (!(definition.allowedToolIds as readonly string[]).includes(toolId)) {
        throw new Error(`agent ${definition.id} cannot add tool ${toolId}`);
      }
    }
  }
  if (requestedSkills !== undefined) {
    for (const skillId of requestedSkills) {
      if (!(definition.requiredSkillIds as readonly string[]).includes(skillId)) {
        throw new Error(`agent ${definition.id} cannot add skill ${skillId}`);
      }
    }
  }
  const allowedToolIds = requestedTools !== undefined
    ? definition.allowedToolIds.filter((toolId) => requestedTools.includes(toolId))
    : definition.allowedToolIds;
  const requiredSkillIds = requestedSkills !== undefined
    ? definition.requiredSkillIds.filter((skillId) => requestedSkills.includes(skillId))
    : definition.requiredSkillIds;
  if (requiredSkillIds.length === 0) {
    throw new Error(`agent ${definition.id} requires at least one skill`);
  }
  return { ...definition, allowedToolIds, requiredSkillIds };
}

export const USER_STORY_SKILL_ID = SKILL_PLANNER_USER_STORY;
