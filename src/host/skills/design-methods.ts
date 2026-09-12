/**
 * Planner skills for design method packs beyond User Story.
 */

import type { SkillDepthProfile, SkillId, SkillRecord } from './types.js';

export const SKILL_PLANNER_USE_CASE = 'planner.use-case' as SkillId;
export const SKILL_PLANNER_BDD = 'planner.bdd' as SkillId;
export const SKILL_PLANNER_EXAMPLE_MAPPING = 'planner.example-mapping' as SkillId;
export const SKILL_PLANNER_EVENT_STORMING = 'planner.event-storming' as SkillId;
export const SKILL_PLANNER_DDD = 'planner.ddd' as SkillId;
export const SKILL_PLANNER_API_DESIGN = 'planner.api-design' as SkillId;
export const SKILL_PLANNER_ADR = 'planner.adr' as SkillId;
export const SKILL_PLANNER_THREAT_MODELING = 'planner.threat-modeling' as SkillId;

const DEPTH: SkillDepthProfile = {
  defaultLevel: 1,
  levels: [
    { id: 0, label: 'checklist', steps: [{ name: 'fill-schema', actor: 'human' }, { name: 'validate', actor: 'tool' }] },
    {
      id: 1,
      label: 'form-fill',
      steps: [
        { name: 'fill-schema', actor: 'model' },
        { name: 'validate', actor: 'tool' },
      ],
    },
    { id: 2, label: 'question-loop', steps: [{ name: 'ask-missing', actor: 'model' }] },
    { id: 3, label: 'method-constraint', steps: [{ name: 'method-check', actor: 'tool' }] },
    { id: 4, label: 'calibrated-quality', steps: [{ name: 'rubric', actor: 'model' }] },
  ],
};

function skill(id: SkillId, name: string, description: string, outputSchema: string): SkillRecord {
  return {
    id,
    name,
    version: '1.0.0',
    description,
    supportedRoles: ['planner'],
    supportedTaskTypes: ['plan'],
    requiredTools: ['delivery-contract.write'],
    validationStatus: 'valid',
    createdThroughSkillCreator: false,
    boundary: {
      roles: ['planner'],
      taskTypes: ['plan'],
      artifacts: [outputSchema],
      requiredTools: ['delivery-contract.write'],
      outputSchema,
      doesNotCover: ['code-change', 'implementation-files'],
    },
    depth: DEPTH,
    guide: description,
    examples: { pass: { ok: true }, fail: { ok: false } },
  };
}

export const DESIGN_METHOD_SKILLS: readonly SkillRecord[] = [
  skill(SKILL_PLANNER_USE_CASE, 'Planner Use Case', 'Shape the delivery contract as a Use Case.', 'huntianling.use-case.v1'),
  skill(SKILL_PLANNER_BDD, 'Planner BDD', 'Shape the delivery contract as BDD/Gherkin scenarios.', 'huntianling.bdd.v1'),
  skill(SKILL_PLANNER_EXAMPLE_MAPPING, 'Planner Example Mapping', 'Shape the delivery contract as Example Mapping notes.', 'huntianling.example-mapping.v1'),
  skill(SKILL_PLANNER_EVENT_STORMING, 'Planner Event Storming', 'Shape the delivery contract as Event Storming output.', 'huntianling.event-storming.v1'),
  skill(SKILL_PLANNER_DDD, 'Planner DDD', 'Shape the delivery contract as Domain-Driven Design.', 'huntianling.ddd.v1'),
  skill(SKILL_PLANNER_API_DESIGN, 'Planner API Design', 'Shape the delivery contract as an API design.', 'huntianling.api-design.v1'),
  skill(SKILL_PLANNER_ADR, 'Planner ADR', 'Shape the delivery contract as an Architecture Decision Record.', 'huntianling.adr.v1'),
  skill(
    SKILL_PLANNER_THREAT_MODELING,
    'Planner Threat Modeling',
    'Shape the delivery contract as a threat model.',
    'huntianling.threat-model.v1',
  ),
];
