/**
 * Built-in Planner/Generator/Evaluator Skill pack.
 */

import type { SkillDepthProfile, SkillId, SkillPackId, SkillRecord } from './types.js';

export const CODING_PACK_ID = 'coding.three-agent' as SkillPackId;

export const SKILL_PLANNER_CONTRACT = 'planner.delivery-contract' as SkillId;
export const SKILL_PLANNER_USER_STORY = 'planner.user-story' as SkillId;
export const SKILL_GENERATOR_IMPLEMENT = 'generator.implement' as SkillId;
export const SKILL_EVALUATOR_EVALUATE = 'evaluator.evaluate' as SkillId;

export const CODING_REQUIRED_SKILL_IDS: readonly SkillId[] = [
  SKILL_PLANNER_CONTRACT,
  SKILL_PLANNER_USER_STORY,
  SKILL_GENERATOR_IMPLEMENT,
  SKILL_EVALUATOR_EVALUATE,
];

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

function skill(
  id: SkillId,
  role: 'planner' | 'generator' | 'evaluator',
  taskType: string,
  name: string,
  description: string,
  doesNotCover: readonly string[],
  outputSchema: string,
  requiredTools: readonly string[],
): SkillRecord {
  return {
    id,
    name,
    version: '1.0.0',
    description,
    supportedRoles: [role],
    supportedTaskTypes: [taskType],
    requiredTools,
    validationStatus: 'valid',
    createdThroughSkillCreator: false,
    boundary: {
      roles: [role],
      taskTypes: [taskType],
      artifacts: [outputSchema],
      requiredTools,
      outputSchema,
      doesNotCover: [...doesNotCover],
    },
    depth: DEPTH,
    guide: description,
    examples: { pass: { ok: true }, fail: { ok: false } },
  };
}

export const CODING_PACK_SKILLS: readonly SkillRecord[] = [
  skill(
    SKILL_PLANNER_CONTRACT,
    'planner',
    'plan',
    'Planner delivery contract',
    'Turn confirmed original requirements into product intent and testable acceptance.',
    ['code-change', 'implementation-files'],
    'huntianling.delivery-contract.v1',
    ['delivery-contract.write'],
  ),
  skill(
    SKILL_PLANNER_USER_STORY,
    'planner',
    'plan',
    'Planner User Story method',
    'Shape the delivery contract as a User Story with role, want, and benefit.',
    ['code-change', 'implementation-files'],
    'huntianling.delivery-contract.v1',
    ['delivery-contract.write'],
  ),
  skill(
    SKILL_GENERATOR_IMPLEMENT,
    'generator',
    'implement',
    'Generator implement',
    'Implement a confirmed delivery contract in the prepared environment.',
    ['acceptance-decision'],
    'huntianling.implementation-record.v1',
    ['implementation.write', 'typecheck.run', 'test.run'],
  ),
  skill(
    SKILL_EVALUATOR_EVALUATE,
    'evaluator',
    'evaluate',
    'Evaluator evaluate',
    'Independently score the candidate against the delivery contract.',
    ['code-change'],
    'huntianling.evaluation-record.v1',
    ['evaluation.write', 'test.run'],
  ),
];
