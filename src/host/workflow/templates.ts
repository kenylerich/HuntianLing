/**
 * Built-in workflow templates: user-story plus Scrum, Kanban, hotfix, and research.
 */

import type { WorkflowStage, WorkflowTemplate, WorkflowTemplateStep } from './types.js';

export const DEFAULT_TEMPLATE_ID = 'huntianling.user-story';

function templateStep(
  step: Omit<WorkflowTemplateStep, 'triggerEvent' | 'intervalMs'> & {
    readonly triggerEvent?: string | null;
    readonly intervalMs?: number | null;
  },
): WorkflowTemplateStep {
  return {
    ...step,
    triggerEvent: step.triggerEvent ?? null,
    intervalMs: step.intervalMs ?? null,
  };
}

function stage(
  id: string,
  title: string,
  status: WorkflowStage['status'],
  extra: Partial<Pick<WorkflowStage, 'requiredFields' | 'requiredEvidence' | 'requiredReviews' | 'requiredApprovals'>> = {},
): WorkflowStage {
  return {
    id,
    title,
    status,
    requiredFields: extra.requiredFields ?? [],
    requiredEvidence: extra.requiredEvidence ?? [],
    requiredReviews: extra.requiredReviews ?? [],
    requiredApprovals: extra.requiredApprovals ?? [],
  };
}

const DELIVERY_STAGES: readonly WorkflowStage[] = [
  stage('inbox', 'Inbox', 'inbox', { requiredFields: ['title', 'body'] }),
  stage('ready', 'Ready', 'ready', { requiredFields: ['analysis', 'design', 'acceptance', 'milestoneId'] }),
  stage('in_review', 'In review', 'in_review', { requiredReviews: ['code'] }),
  stage('delivered', 'Delivered', 'delivered', {
    requiredEvidence: ['evaluator'],
    requiredApprovals: ['requirement_acceptance'],
  }),
];

function builtinTemplate(
  id: string,
  title: string,
  stages: readonly WorkflowStage[],
  steps: readonly WorkflowTemplateStep[],
): WorkflowTemplate {
  return {
    id,
    version: '1.0.0',
    title,
    state: 'published',
    builtin: true,
    owner: 'huntianling',
    clonedFrom: null,
    stages,
    steps,
  };
}

const analyze = templateStep({
  id: 'analyze',
  title: 'Analyze',
  kind: 'sequential',
  role: 'planner',
  capabilityId: 'analysis',
  requiredSkills: ['planner.delivery-contract'],
  allowedTools: ['delivery-contract.write'],
  checks: ['has-acceptance'],
  dependsOn: [],
  approvalKind: null,
  targetStatus: 'analyzing',
});

const design = templateStep({
  id: 'design',
  title: 'Design',
  kind: 'sequential',
  role: 'planner',
  capabilityId: 'design',
  requiredSkills: ['planner.delivery-contract'],
  allowedTools: ['delivery-contract.write'],
  checks: ['has-design'],
  dependsOn: ['analyze'],
  approvalKind: null,
  targetStatus: 'designing',
});

const implement = templateStep({
  id: 'implement',
  title: 'Implement',
  kind: 'sequential',
  role: 'generator',
  capabilityId: 'implementation',
  requiredSkills: ['generator.implement'],
  allowedTools: ['implementation.write'],
  checks: ['typecheck'],
  dependsOn: ['design'],
  approvalKind: null,
  targetStatus: 'in_progress',
});

const review = templateStep({
  id: 'review',
  title: 'Review',
  kind: 'review-only',
  role: 'developer',
  capabilityId: 'review',
  requiredSkills: [],
  allowedTools: [],
  checks: ['review'],
  dependsOn: ['implement'],
  approvalKind: null,
  targetStatus: 'in_review',
});

const evaluate = templateStep({
  id: 'evaluate',
  title: 'Evaluate',
  kind: 'sequential',
  role: 'evaluator',
  capabilityId: 'evaluation',
  requiredSkills: ['evaluator.evaluate'],
  allowedTools: ['evaluation.write'],
  checks: ['criterion-evidence'],
  dependsOn: ['review'],
  approvalKind: null,
  targetStatus: 'verifying',
});

const approve = templateStep({
  id: 'approve',
  title: 'Approve delivery',
  kind: 'approval-required',
  role: 'developer',
  capabilityId: 'approval',
  requiredSkills: [],
  allowedTools: [],
  checks: ['approval'],
  dependsOn: ['evaluate'],
  approvalKind: 'requirement_acceptance',
  targetStatus: 'gates_passing',
});

const deliver = templateStep({
  id: 'deliver',
  title: 'Deliver',
  kind: 'manual-only',
  role: 'developer',
  capabilityId: 'evidence',
  requiredSkills: [],
  allowedTools: [],
  checks: ['executed-evidence'],
  dependsOn: ['approve'],
  approvalKind: null,
  targetStatus: 'delivered',
});

export const DEFAULT_TEMPLATE: WorkflowTemplate = builtinTemplate(
  DEFAULT_TEMPLATE_ID,
  'User Story delivery',
  DELIVERY_STAGES,
  [analyze, design, implement, review, evaluate, approve, deliver],
);

export const SCRUM_TEMPLATE: WorkflowTemplate = builtinTemplate(
  'huntianling.scrum',
  'Scrum delivery',
  DELIVERY_STAGES,
  [
    analyze,
    design,
    implement,
    review,
    evaluate,
    templateStep({
      id: 'sprint-review',
      title: 'Sprint review',
      kind: 'review-only',
      role: 'developer',
      capabilityId: 'review',
      requiredSkills: [],
      allowedTools: [],
      checks: ['review'],
      dependsOn: ['evaluate'],
      approvalKind: null,
      targetStatus: 'in_review',
    }),
    templateStep({
      ...approve,
      dependsOn: ['sprint-review'],
    }),
    deliver,
  ],
);

export const KANBAN_TEMPLATE: WorkflowTemplate = builtinTemplate(
  'huntianling.kanban',
  'Kanban delivery',
  [
    stage('inbox', 'Inbox', 'inbox', { requiredFields: ['title', 'body'] }),
    stage('ready', 'Ready', 'ready', { requiredFields: ['acceptance', 'milestoneId'] }),
    stage('in_review', 'In review', 'in_review', { requiredReviews: ['code'] }),
    stage('delivered', 'Delivered', 'delivered', { requiredEvidence: ['evaluator'] }),
  ],
  [
    templateStep({
      id: 'pull',
      title: 'Pull ready work',
      kind: 'sequential',
      role: 'planner',
      capabilityId: 'analysis',
      requiredSkills: ['planner.delivery-contract'],
      allowedTools: ['delivery-contract.write'],
      checks: ['has-acceptance'],
      dependsOn: [],
      approvalKind: null,
      targetStatus: 'ready',
    }),
    templateStep({
      ...implement,
      dependsOn: ['pull'],
    }),
    review,
    evaluate,
    templateStep({
      ...deliver,
      dependsOn: ['evaluate'],
    }),
  ],
);

export const HOTFIX_TEMPLATE: WorkflowTemplate = builtinTemplate(
  'huntianling.hotfix',
  'Hotfix delivery',
  [
    stage('inbox', 'Inbox', 'inbox', { requiredFields: ['title', 'body'] }),
    stage('ready', 'Ready', 'ready', { requiredFields: ['acceptance'] }),
    stage('in_review', 'In review', 'in_review', { requiredReviews: ['code'] }),
    stage('delivered', 'Delivered', 'delivered', {
      requiredEvidence: ['evaluator'],
      requiredApprovals: ['requirement_acceptance'],
    }),
  ],
  [
    templateStep({
      id: 'reproduce',
      title: 'Reproduce',
      kind: 'sequential',
      role: 'planner',
      capabilityId: 'analysis',
      requiredSkills: ['planner.delivery-contract'],
      allowedTools: ['delivery-contract.write'],
      checks: ['has-acceptance'],
      dependsOn: [],
      approvalKind: null,
      targetStatus: 'analyzing',
    }),
    templateStep({
      id: 'patch',
      title: 'Patch',
      kind: 'sequential',
      role: 'generator',
      capabilityId: 'implementation',
      requiredSkills: ['generator.implement'],
      allowedTools: ['implementation.write'],
      checks: ['typecheck'],
      dependsOn: ['reproduce'],
      approvalKind: null,
      targetStatus: 'in_progress',
    }),
    templateStep({
      ...review,
      dependsOn: ['patch'],
    }),
    evaluate,
    approve,
    deliver,
  ],
);

export const RESEARCH_TEMPLATE: WorkflowTemplate = builtinTemplate(
  'huntianling.research',
  'Research-only work',
  [
    stage('inbox', 'Inbox', 'inbox', { requiredFields: ['title', 'body'] }),
    stage('ready', 'Ready', 'ready', { requiredFields: ['analysis'] }),
    stage('delivered', 'Delivered', 'delivered'),
  ],
  [
    templateStep({
      id: 'investigate',
      title: 'Investigate',
      kind: 'sequential',
      role: 'planner',
      capabilityId: 'analysis',
      requiredSkills: ['planner.delivery-contract'],
      allowedTools: ['delivery-contract.write'],
      checks: ['has-acceptance'],
      dependsOn: [],
      approvalKind: null,
      targetStatus: 'analyzing',
    }),
    templateStep({
      id: 'document',
      title: 'Document findings',
      kind: 'sequential',
      role: 'planner',
      capabilityId: 'design',
      requiredSkills: ['planner.delivery-contract'],
      allowedTools: ['delivery-contract.write'],
      checks: ['has-design'],
      dependsOn: ['investigate'],
      approvalKind: null,
      targetStatus: 'designing',
    }),
    templateStep({
      id: 'review',
      title: 'Review notes',
      kind: 'review-only',
      role: 'developer',
      capabilityId: 'review',
      requiredSkills: [],
      allowedTools: [],
      checks: ['review'],
      dependsOn: ['document'],
      approvalKind: null,
      targetStatus: 'in_review',
    }),
    templateStep({
      id: 'conclude',
      title: 'Conclude research',
      kind: 'manual-only',
      role: 'developer',
      capabilityId: 'evidence',
      requiredSkills: [],
      allowedTools: [],
      checks: [],
      dependsOn: ['review'],
      approvalKind: null,
      targetStatus: 'delivered',
    }),
  ],
);

export const BUILTIN_TEMPLATES: readonly WorkflowTemplate[] = [
  DEFAULT_TEMPLATE,
  SCRUM_TEMPLATE,
  KANBAN_TEMPLATE,
  HOTFIX_TEMPLATE,
  RESEARCH_TEMPLATE,
];
