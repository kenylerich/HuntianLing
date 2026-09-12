/**
 * Built-in engineering method packs. Default baseline is User Story.
 */

import {
  SKILL_PLANNER_ADR,
  SKILL_PLANNER_API_DESIGN,
  SKILL_PLANNER_BDD,
  SKILL_PLANNER_DDD,
  SKILL_PLANNER_EVENT_STORMING,
  SKILL_PLANNER_EXAMPLE_MAPPING,
  SKILL_PLANNER_THREAT_MODELING,
  SKILL_PLANNER_USE_CASE,
} from '../skills/design-methods.js';
import { SKILL_PLANNER_USER_STORY } from '../skills/coding-pack.js';
import type { MethodBaseline, MethodDefinition } from './types.js';

function method(
  id: string,
  name: string,
  appliesWhen: string,
  skillId: MethodDefinition['skillIds'][number],
  outputFields: readonly string[],
  checks: readonly string[],
): MethodDefinition {
  return {
    id,
    version: '1.0.0',
    name,
    appliesWhen,
    agentId: 'planner',
    requiredInputs: ['goal', 'quotes'],
    skillIds: [skillId],
    outputFields,
    checks,
    missingRoute: 'clarify',
  };
}

export const USER_STORY_METHOD: MethodDefinition = method(
  'user-story',
  'User Story',
  'planning a confirmed original requirement',
  SKILL_PLANNER_USER_STORY,
  ['userStory', 'acceptance'],
  ['has-user-story', 'has-acceptance'],
);

export const USE_CASE_METHOD: MethodDefinition = method(
  'use-case',
  'Use Case',
  'planning actor goals and main flow',
  SKILL_PLANNER_USE_CASE,
  ['useCase', 'acceptance'],
  ['has-use-case', 'has-acceptance'],
);

export const BDD_METHOD: MethodDefinition = method(
  'bdd',
  'BDD / Gherkin',
  'planning Given/When/Then scenarios',
  SKILL_PLANNER_BDD,
  ['bdd', 'acceptance'],
  ['has-bdd', 'has-acceptance'],
);

export const EXAMPLE_MAPPING_METHOD: MethodDefinition = method(
  'example-mapping',
  'Example Mapping',
  'planning rules, examples, and questions',
  SKILL_PLANNER_EXAMPLE_MAPPING,
  ['exampleMapping', 'acceptance'],
  ['has-example-mapping', 'has-acceptance'],
);

export const EVENT_STORMING_METHOD: MethodDefinition = method(
  'event-storming',
  'Event Storming',
  'planning domain events and commands',
  SKILL_PLANNER_EVENT_STORMING,
  ['eventStorming', 'acceptance'],
  ['has-event-storming', 'has-acceptance'],
);

export const DDD_METHOD: MethodDefinition = method(
  'ddd',
  'Domain-Driven Design',
  'planning bounded contexts and aggregates',
  SKILL_PLANNER_DDD,
  ['ddd', 'acceptance'],
  ['has-ddd', 'has-acceptance'],
);

export const API_DESIGN_METHOD: MethodDefinition = method(
  'api-design',
  'API Design',
  'planning resources and operations',
  SKILL_PLANNER_API_DESIGN,
  ['apiDesign', 'acceptance'],
  ['has-api-design', 'has-acceptance'],
);

export const ADR_METHOD: MethodDefinition = method(
  'adr',
  'ADR',
  'recording an architecture decision',
  SKILL_PLANNER_ADR,
  ['adr', 'acceptance'],
  ['has-adr', 'has-acceptance'],
);

export const THREAT_MODELING_METHOD: MethodDefinition = method(
  'threat-modeling',
  'Threat Modeling',
  'planning assets, threats, and mitigations',
  SKILL_PLANNER_THREAT_MODELING,
  ['threatModel', 'acceptance'],
  ['has-threat-model', 'has-acceptance'],
);

export const METHOD_DEFINITIONS: readonly MethodDefinition[] = [
  USER_STORY_METHOD,
  USE_CASE_METHOD,
  BDD_METHOD,
  EXAMPLE_MAPPING_METHOD,
  EVENT_STORMING_METHOD,
  DDD_METHOD,
  API_DESIGN_METHOD,
  ADR_METHOD,
  THREAT_MODELING_METHOD,
];

export const DEFAULT_ENABLED_METHOD_IDS: readonly string[] = [USER_STORY_METHOD.id];

export const DEFAULT_METHOD_BASELINE: MethodBaseline = {
  id: 'huntianling.baseline',
  version: '1.0.0',
  methodIds: [...DEFAULT_ENABLED_METHOD_IDS],
};

export function isMethodId(value: string): boolean {
  return METHOD_DEFINITIONS.some((item) => item.id === value);
}
