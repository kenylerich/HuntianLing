/**
 * Planner/evaluator skills that bind specialist agent definitions.
 * These are not technology coverage packs.
 */

import type { SkillDepthProfile, SkillId, SkillRecord, SkillRole } from './types.js';

export const SKILL_PRODUCT_OWNER = 'specialist.product-owner' as SkillId;
export const SKILL_BUSINESS_ANALYST = 'specialist.business-analyst' as SkillId;
export const SKILL_UX_DESIGNER = 'specialist.ux-designer' as SkillId;
export const SKILL_ARCHITECT = 'specialist.architect' as SkillId;
export const SKILL_FRONTEND_DEVELOPER = 'specialist.frontend-developer' as SkillId;
export const SKILL_BACKEND_DEVELOPER = 'specialist.backend-developer' as SkillId;
export const SKILL_QA_ENGINEER = 'specialist.qa-engineer' as SkillId;
export const SKILL_DEVOPS = 'specialist.devops' as SkillId;
export const SKILL_SECURITY_REVIEWER = 'specialist.security-reviewer' as SkillId;
export const SKILL_SCRUM_MASTER = 'specialist.scrum-master' as SkillId;
export const SKILL_TECHNICAL_WRITER = 'specialist.technical-writer' as SkillId;

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
  name: string,
  description: string,
  role: SkillRole,
  taskType: string,
  requiredTool: string,
  outputSchema: string,
): SkillRecord {
  return {
    id,
    name,
    version: '1.0.0',
    description,
    supportedRoles: [role],
    supportedTaskTypes: [taskType],
    requiredTools: [requiredTool],
    validationStatus: 'valid',
    createdThroughSkillCreator: false,
    boundary: {
      roles: [role],
      taskTypes: [taskType],
      artifacts: [outputSchema],
      requiredTools: [requiredTool],
      outputSchema,
      doesNotCover: ['code-change', 'implementation-files', 'acceptance-decision'],
    },
    depth: DEPTH,
    guide: description,
    examples: { pass: { ok: true }, fail: { ok: false } },
  };
}

export const SPECIALIST_SKILLS: readonly SkillRecord[] = [
  skill(SKILL_PRODUCT_OWNER, 'Product Owner', 'Prioritize and accept scope without writing code.', 'planner', 'plan', 'delivery-contract.write', 'huntianling.product-owner.v1'),
  skill(SKILL_BUSINESS_ANALYST, 'Business Analyst', 'Clarify actors, rules, and acceptance without writing code.', 'planner', 'plan', 'delivery-contract.write', 'huntianling.business-analyst.v1'),
  skill(SKILL_UX_DESIGNER, 'UX Designer', 'Review interaction and copy against acceptance.', 'evaluator', 'evaluate', 'evaluation.write', 'huntianling.ux-designer.v1'),
  skill(SKILL_ARCHITECT, 'Architect', 'Record design constraints without writing production code.', 'planner', 'plan', 'delivery-contract.write', 'huntianling.architect.v1'),
  skill(SKILL_FRONTEND_DEVELOPER, 'Frontend Developer', 'Plan frontend work without a technology skill pack.', 'planner', 'plan', 'delivery-contract.write', 'huntianling.frontend-developer.v1'),
  skill(SKILL_BACKEND_DEVELOPER, 'Backend Developer', 'Plan backend work without a technology skill pack.', 'planner', 'plan', 'delivery-contract.write', 'huntianling.backend-developer.v1'),
  skill(SKILL_QA_ENGINEER, 'QA Engineer', 'Independently verify delivery evidence.', 'evaluator', 'evaluate', 'evaluation.write', 'huntianling.qa-engineer.v1'),
  skill(SKILL_DEVOPS, 'DevOps', 'Review release evidence without merging.', 'evaluator', 'evaluate', 'evaluation.write', 'huntianling.devops.v1'),
  skill(SKILL_SECURITY_REVIEWER, 'Security Reviewer', 'Review security-sensitive changes before release.', 'evaluator', 'evaluate', 'evaluation.write', 'huntianling.security-reviewer.v1'),
  skill(SKILL_SCRUM_MASTER, 'Scrum Master', 'Inspect flow blockers without changing code.', 'planner', 'plan', 'delivery-contract.write', 'huntianling.scrum-master.v1'),
  skill(SKILL_TECHNICAL_WRITER, 'Technical Writer', 'Draft documentation from accepted behavior.', 'evaluator', 'evaluate', 'evaluation.write', 'huntianling.technical-writer.v1'),
];
