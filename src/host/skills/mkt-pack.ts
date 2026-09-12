/**
 * Built-in MKT collection Skill pack (REQ-MKT-002).
 */

import { ORIGINAL_REQUIREMENT_SCHEMA } from './original-requirement.js';
import type { SkillDepthProfile, SkillId, SkillPackId, SkillRecord } from './types.js';

export const MKT_PACK_ID = 'mkt.collection' as SkillPackId;

export const MKT_SKILL_INTERVIEW = 'mkt.interview' as SkillId;
export const MKT_SKILL_WISH = 'mkt.wish-vs-requirement' as SkillId;
export const MKT_SKILL_EXTRACT = 'mkt.extract-original-requirement' as SkillId;
export const MKT_SKILL_QUOTES = 'mkt.preserve-quotes' as SkillId;
export const MKT_SKILL_CONFIRM = 'mkt.confirm-before-track' as SkillId;
export const MKT_SKILL_QUESTIONS = 'mkt.return-product-questions' as SkillId;

export const MKT_REQUIRED_SKILL_IDS: readonly SkillId[] = [
  MKT_SKILL_INTERVIEW,
  MKT_SKILL_WISH,
  MKT_SKILL_EXTRACT,
  MKT_SKILL_QUOTES,
  MKT_SKILL_CONFIRM,
  MKT_SKILL_QUESTIONS,
];

const MKT_DEPTH: SkillDepthProfile = {
  defaultLevel: 1,
  levels: [
    {
      id: 0,
      label: 'checklist',
      steps: [
        { name: 'fill-schema', actor: 'human' },
        { name: 'validate', actor: 'tool' },
      ],
    },
    {
      id: 1,
      label: 'form-fill',
      steps: [
        { name: 'fill-schema', actor: 'model' },
        { name: 'validate', actor: 'tool' },
        { name: 'human-confirm', actor: 'human' },
      ],
    },
    {
      id: 2,
      label: 'question-loop',
      steps: [{ name: 'ask-missing-fields', actor: 'model' }],
    },
    {
      id: 3,
      label: 'method-constraint',
      steps: [{ name: 'require-examples', actor: 'tool' }],
    },
    {
      id: 4,
      label: 'calibrated-quality',
      steps: [{ name: 'rubric', actor: 'model' }],
    },
  ],
};

const MKT_FORBIDDEN = ['technical-design', 'code-change', 'acceptance-decision'] as const;

const PASS_EXAMPLE = {
  quotes: [{ text: '客户只看自己的需求', source: 'customer' }],
  goal: 'Customer sees only their requirements',
  confirmed: true,
};

const FAIL_EXAMPLE = {
  quotes: [],
  goal: 'split files',
  technicalDesign: 'extract CSS',
  confirmed: false,
};

function mktSkill(
  id: SkillId,
  name: string,
  description: string,
  guide: string,
): SkillRecord {
  return {
    id,
    name,
    version: '1.0.0',
    description,
    supportedRoles: ['mkt'],
    supportedTaskTypes: ['mkt.collect'],
    requiredTools: ['original-requirement.write'],
    validationStatus: 'valid',
    createdThroughSkillCreator: false,
    boundary: {
      roles: ['mkt'],
      taskTypes: ['mkt.collect'],
      artifacts: ['original-requirement'],
      requiredTools: ['original-requirement.write'],
      outputSchema: ORIGINAL_REQUIREMENT_SCHEMA,
      doesNotCover: [...MKT_FORBIDDEN],
    },
    depth: MKT_DEPTH,
    guide,
    examples: { pass: PASS_EXAMPLE, fail: FAIL_EXAMPLE },
  };
}

export const MKT_PACK_SKILLS: readonly SkillRecord[] = [
  mktSkill(
    MKT_SKILL_INTERVIEW,
    'MKT interview',
    'Ask clarifying questions when required collection fields are missing.',
    'Interview the customer. Return product questions to the customer dialog. Do not design or code.',
  ),
  mktSkill(
    MKT_SKILL_WISH,
    'MKT wish vs requirement',
    'Distinguish a wish from a trackable original requirement.',
    'Keep wishes visible. Only confirmed original requirements become tracked records.',
  ),
  mktSkill(
    MKT_SKILL_EXTRACT,
    'MKT extract original requirement',
    'Extract goal, actors, scenarios, constraints, non-goals, and open questions.',
    'Fill the original-requirement schema. Do not freeze technical design.',
  ),
  mktSkill(
    MKT_SKILL_QUOTES,
    'MKT preserve quotes',
    'Persist raw customer language as source quotes.',
    'Every original-requirement write must include at least one source quote.',
  ),
  mktSkill(
    MKT_SKILL_CONFIRM,
    'MKT confirm before track',
    'Track an original requirement only after the configured confirm path.',
    'Depth 1 requires human confirm. Unconfirmed records stay untracked.',
  ),
  mktSkill(
    MKT_SKILL_QUESTIONS,
    'MKT return product questions',
    'Send product ambiguity back to the customer MKT dialog.',
    'Open questions stay with MKT. Do not send the customer to the developer board.',
  ),
];
