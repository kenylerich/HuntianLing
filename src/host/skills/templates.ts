/**
 * Agile skill-creator templates. Drafts stay gated until validated and enabled.
 */

import type { AgileSkillKind, SkillDepthProfile, SkillId, SkillRecord, SkillRole } from './types.js';
import { AGILE_SKILL_KINDS } from './types.js';

const DEPTH: SkillDepthProfile = {
  defaultLevel: 1,
  levels: [
    { id: 0, label: 'checklist', steps: [{ name: 'fill-schema', actor: 'human' }, { name: 'validate', actor: 'tool' }] },
    { id: 1, label: 'form-fill', steps: [{ name: 'fill-schema', actor: 'model' }, { name: 'validate', actor: 'tool' }] },
    { id: 2, label: 'question-loop', steps: [{ name: 'ask-missing', actor: 'model' }] },
    { id: 3, label: 'method-constraint', steps: [{ name: 'method-check', actor: 'tool' }] },
    { id: 4, label: 'calibrated-quality', steps: [{ name: 'rubric', actor: 'model' }] },
  ],
};

interface TemplateSpec {
  readonly kind: AgileSkillKind;
  readonly name: string;
  readonly description: string;
  readonly role: SkillRole;
  readonly taskType: string;
  readonly doesNotCover: readonly string[];
  readonly outputSchema: string;
}

const SPECS: readonly TemplateSpec[] = [
  { kind: 'requirement-intake', name: 'Requirement intake', description: 'Collect original requirements with source quotes.', role: 'mkt', taskType: 'mkt.collect', doesNotCover: ['technical-design', 'code-change', 'acceptance-decision'], outputSchema: 'huntianling.original-requirement.v1' },
  { kind: 'analysis', name: 'Requirement analysis', description: 'Turn confirmed intake into WorkItem analysis.', role: 'planner', taskType: 'plan', doesNotCover: ['code-change', 'implementation-files'], outputSchema: 'huntianling.analysis.v1' },
  { kind: 'story-splitting', name: 'Story splitting', description: 'Split a requirement into implementable stories.', role: 'planner', taskType: 'plan', doesNotCover: ['code-change'], outputSchema: 'huntianling.story-split.v1' },
  { kind: 'acceptance-criteria', name: 'Acceptance criteria', description: 'Write testable acceptance for a WorkItem.', role: 'planner', taskType: 'plan', doesNotCover: ['code-change', 'acceptance-decision'], outputSchema: 'huntianling.acceptance.v1' },
  { kind: 'prioritization', name: 'Prioritization', description: 'Rank ready work by value and dependency.', role: 'planner', taskType: 'plan', doesNotCover: ['code-change'], outputSchema: 'huntianling.priority.v1' },
  { kind: 'sprint-planning', name: 'Sprint planning', description: 'Select a bounded slice of ready work.', role: 'planner', taskType: 'plan', doesNotCover: ['code-change'], outputSchema: 'huntianling.sprint-plan.v1' },
  { kind: 'ux-review', name: 'UX review', description: 'Review interaction and copy against acceptance.', role: 'evaluator', taskType: 'evaluate', doesNotCover: ['code-change'], outputSchema: 'huntianling.ux-review.v1' },
  { kind: 'architecture', name: 'Architecture', description: 'Record design constraints without writing production code.', role: 'planner', taskType: 'plan', doesNotCover: ['implementation-files', 'acceptance-decision'], outputSchema: 'huntianling.architecture.v1' },
  { kind: 'implementation-planning', name: 'Implementation planning', description: 'Plan implementation steps for a ready story.', role: 'planner', taskType: 'plan', doesNotCover: ['code-change'], outputSchema: 'huntianling.implementation-plan.v1' },
  { kind: 'code-review', name: 'Code review', description: 'Review a changeset against acceptance and gates.', role: 'evaluator', taskType: 'evaluate', doesNotCover: ['implementation-files'], outputSchema: 'huntianling.code-review.v1' },
  { kind: 'test-design', name: 'Test design', description: 'Design checks that score the agreed acceptance.', role: 'evaluator', taskType: 'evaluate', doesNotCover: ['code-change'], outputSchema: 'huntianling.test-design.v1' },
  { kind: 'qa-verification', name: 'QA verification', description: 'Independently verify delivery evidence.', role: 'evaluator', taskType: 'evaluate', doesNotCover: ['code-change', 'acceptance-decision'], outputSchema: 'huntianling.qa-verification.v1' },
  { kind: 'security-review', name: 'Security review', description: 'Review security-sensitive changes before release.', role: 'evaluator', taskType: 'evaluate', doesNotCover: ['code-change'], outputSchema: 'huntianling.security-review.v1' },
  { kind: 'release', name: 'Release', description: 'Assemble release evidence without merging by itself.', role: 'evaluator', taskType: 'evaluate', doesNotCover: ['git-merge'], outputSchema: 'huntianling.release.v1' },
  { kind: 'documentation', name: 'Documentation', description: 'Draft bilingual documentation from accepted behavior.', role: 'generator', taskType: 'implement', doesNotCover: ['acceptance-decision'], outputSchema: 'huntianling.documentation.v1' },
  { kind: 'retrospective-analysis', name: 'Retrospective analysis', description: 'Record what blocked or passed a slice.', role: 'evaluator', taskType: 'evaluate', doesNotCover: ['code-change'], outputSchema: 'huntianling.retrospective.v1' },
];

export interface AgileSkillTemplate {
  readonly kind: AgileSkillKind;
  readonly skill: SkillRecord;
}

export function agileSkillTemplates(): readonly AgileSkillTemplate[] {
  return SPECS.map((spec) => ({
    kind: spec.kind,
    skill: templateSkill(spec),
  }));
}

export function templateFor(kind: string): AgileSkillTemplate | undefined {
  return agileSkillTemplates().find((item) => item.kind === kind);
}

export function isAgileSkillKind(value: string): value is AgileSkillKind {
  return (AGILE_SKILL_KINDS as readonly string[]).includes(value);
}

function templateSkill(spec: TemplateSpec): SkillRecord {
  const id = `agile.${spec.kind}` as SkillId;
  return {
    id,
    name: spec.name,
    version: '0.1.0',
    description: spec.description,
    supportedRoles: [spec.role],
    supportedTaskTypes: [spec.taskType],
    requiredTools: ['skill-creator.draft'],
    validationStatus: 'unvalidated',
    createdThroughSkillCreator: true,
    boundary: {
      roles: [spec.role],
      taskTypes: [spec.taskType],
      artifacts: [spec.outputSchema],
      requiredTools: ['skill-creator.draft'],
      outputSchema: spec.outputSchema,
      doesNotCover: [...spec.doesNotCover],
    },
    depth: DEPTH,
    guide: spec.description,
    examples: {
      pass: { kind: spec.kind, ok: true },
      fail: { kind: spec.kind, ok: false },
    },
  };
}
