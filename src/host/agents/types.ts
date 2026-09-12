/**
 * Three-agent task definitions, method baseline, and run records.
 */

import type { CollabService } from '../collab/service.js';
import type { StepStateRecognition } from '../workflow/types.js';
import type { ChannelMessage } from '../collab/types.js';
import type { SkillDepthId, SkillExecutor, SkillId } from '../skills/types.js';
import type { TaskContextPacket, ToolId } from '../tools/types.js';

export const CODING_AGENT_IDS = ['planner', 'generator', 'evaluator'] as const;
export type CodingAgentId = (typeof CODING_AGENT_IDS)[number];

export const SPECIALIST_AGENT_IDS = [
  'product-owner',
  'business-analyst',
  'ux-designer',
  'architect',
  'frontend-developer',
  'backend-developer',
  'qa-engineer',
  'devops',
  'security-reviewer',
  'scrum-master',
  'technical-writer',
] as const;
export type SpecialistAgentId = (typeof SPECIALIST_AGENT_IDS)[number];

export type AgentId = CodingAgentId | SpecialistAgentId;
export type AgentKind = 'coding' | 'specialist';
export type AgentBindingRole = 'planner' | 'generator' | 'evaluator';

export const DEFAULT_ENABLED_AGENT_IDS: readonly AgentId[] = [...CODING_AGENT_IDS];

export function isCodingAgentId(value: string): value is CodingAgentId {
  return (CODING_AGENT_IDS as readonly string[]).includes(value);
}

export function isSpecialistAgentId(value: string): value is SpecialistAgentId {
  return (SPECIALIST_AGENT_IDS as readonly string[]).includes(value);
}

export function isAgentId(value: string): value is AgentId {
  return isCodingAgentId(value) || isSpecialistAgentId(value);
}
export type AgentHandoffKind =
  | 'design_ready'
  | 'implement'
  | 'evaluate'
  | 'repair'
  | 'complete'
  | 'clarify';
export type AgentRunStatus = 'running' | 'completed' | 'rejected' | 'interrupted' | 'blocked';

export interface AgentDefinition {
  readonly id: AgentId;
  readonly version: string;
  readonly kind: AgentKind;
  readonly role: AgentId;
  readonly bindingRole: AgentBindingRole;
  readonly taskType: string;
  readonly responsibilities: readonly string[];
  readonly allowedTaskTypes: readonly string[];
  readonly requiredSkillIds: readonly SkillId[];
  readonly allowedToolIds: readonly ToolId[];
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly outputExpectations: readonly string[];
  readonly defaultDepth: SkillDepthId;
  readonly modelBinding: 'configurable';
}

export interface MethodDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly appliesWhen: string;
  readonly agentId: AgentId;
  readonly requiredInputs: readonly string[];
  readonly skillIds: readonly SkillId[];
  readonly outputFields: readonly string[];
  readonly checks: readonly string[];
  readonly missingRoute: AgentHandoffKind;
}

export interface MethodBaseline {
  readonly id: string;
  readonly version: string;
  readonly methodIds: readonly string[];
}

export interface AgentHandoff {
  readonly kind: AgentHandoffKind;
  readonly from: AgentId;
  readonly to: AgentId | 'user';
  readonly runId: string;
}

export interface AgentRun {
  readonly id: string;
  readonly agentId: AgentId;
  readonly status: AgentRunStatus;
  readonly skillIds: readonly SkillId[];
  readonly skillVersions: readonly string[];
  readonly depthLevel: SkillDepthId;
  readonly executor: SkillExecutor;
  readonly methodId: string | null;
  readonly input: unknown;
  readonly output: unknown;
  readonly handoff: AgentHandoff | null;
  readonly error: string | null;
  readonly workItemId: string | null;
  readonly projectId: string;
  readonly environmentReady: boolean;
  readonly context: TaskContextPacket | null;
  readonly channelMessages: readonly ChannelMessage[];
  readonly stateRecognition: StepStateRecognition | null;
}

export interface StartRunInput {
  readonly agentId: AgentId;
  readonly input: unknown;
  readonly executor: SkillExecutor;
  readonly depth?: SkillDepthId;
  readonly methodId?: string;
  readonly environmentReady?: boolean;
  readonly runId?: string;
  readonly projectId?: string;
  readonly workItemId?: string;
  readonly collaborationTaskId?: string;
  readonly collab?: CollabService;
  readonly skillIds?: readonly SkillId[];
  readonly stateRecognition?: StepStateRecognition;
}

export class AgentTaskError extends Error {
  constructor(
    readonly code: 'VALIDATION' | 'MISSING_SKILL' | 'MISSING_METHOD' | 'ENVIRONMENT' | 'BINDING' | 'SELF_CHECK' | 'MISSING_INPUT',
    message: string,
  ) {
    super(message);
  }
}
