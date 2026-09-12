/**
 * Built-in role capability policies. High-risk Git and production actions
 * require human approval; that list is a security invariant.
 */

import {
  TOOL_BROWSER_NAVIGATE,
  TOOL_CI_PRODUCTION,
  TOOL_CI_RUN,
  TOOL_DATABASE_MIGRATE,
  TOOL_DELIVERY_CONTRACT_WRITE,
  TOOL_DOC_SYNC,
  TOOL_DOCUMENT_PARSE,
  TOOL_EVALUATION_WRITE,
  TOOL_GIT_BRANCH,
  TOOL_GIT_COMMIT,
  TOOL_GIT_INSPECT,
  TOOL_GIT_PUSH,
  TOOL_IMAGE_ANALYZE,
  TOOL_IMPLEMENTATION_WRITE,
  TOOL_MERGE,
  TOOL_PULL_REQUEST,
  TOOL_TEST,
  TOOL_TYPECHECK,
  TOOL_WEB_API_CALL,
} from '../tools/registry.js';
import type { AuthorityAction, RoleCapabilityPolicy } from './types.js';

const ALL_ACTIONS: readonly AuthorityAction[] = [
  'read',
  'draft',
  'code_modify',
  'git_commit',
  'branch_push',
  'pull_request',
  'ci_trigger',
  'production_deploy',
  'review_approve',
  'merge',
  'protected_file_write',
];

export const ROLE_POLICIES: readonly RoleCapabilityPolicy[] = [
  {
    role: 'planner',
    workItemTypes: ['epic', 'feature', 'requirement', 'story'],
    tools: [TOOL_DELIVERY_CONTRACT_WRITE],
    writePermissions: ['draft'],
    allowedActions: ['read', 'draft'],
    approvalRequired: [],
    forbiddenActions: ALL_ACTIONS.filter((action) => action !== 'read' && action !== 'draft'),
  },
  {
    role: 'generator',
    workItemTypes: ['story', 'task', 'bug', 'defect'],
    tools: [
      TOOL_IMPLEMENTATION_WRITE,
      TOOL_TYPECHECK,
      TOOL_TEST,
      TOOL_DOC_SYNC,
      TOOL_GIT_BRANCH,
      TOOL_GIT_COMMIT,
      TOOL_GIT_PUSH,
      TOOL_PULL_REQUEST,
      TOOL_MERGE,
      TOOL_DOCUMENT_PARSE,
      TOOL_DATABASE_MIGRATE,
      TOOL_BROWSER_NAVIGATE,
      TOOL_WEB_API_CALL,
    ],
    writePermissions: ['draft', 'code_modify', 'git_commit'],
    allowedActions: ['read', 'draft', 'code_modify', 'git_commit'],
    approvalRequired: ['branch_push', 'pull_request', 'protected_file_write', 'merge'],
    forbiddenActions: ['review_approve', 'production_deploy', 'ci_trigger'],
  },
  {
    role: 'evaluator',
    workItemTypes: ['story', 'task', 'bug', 'defect', 'research'],
    tools: [TOOL_EVALUATION_WRITE, TOOL_TEST, TOOL_TYPECHECK, TOOL_CI_RUN, TOOL_GIT_INSPECT, TOOL_IMAGE_ANALYZE, TOOL_BROWSER_NAVIGATE, TOOL_WEB_API_CALL],
    writePermissions: [],
    allowedActions: ['read', 'ci_trigger'],
    approvalRequired: ['production_deploy'],
    forbiddenActions: [
      'draft',
      'code_modify',
      'git_commit',
      'branch_push',
      'pull_request',
      'review_approve',
      'merge',
      'protected_file_write',
    ],
  },
  {
    role: 'scm',
    workItemTypes: ['story', 'task', 'bug', 'defect'],
    tools: [TOOL_GIT_INSPECT, TOOL_GIT_BRANCH, TOOL_GIT_COMMIT, TOOL_GIT_PUSH, TOOL_PULL_REQUEST],
    writePermissions: [],
    allowedActions: ['read'],
    approvalRequired: ['branch_push', 'pull_request'],
    forbiddenActions: [
      'draft',
      'code_modify',
      'git_commit',
      'ci_trigger',
      'production_deploy',
      'review_approve',
      'merge',
      'protected_file_write',
    ],
  },
  {
    role: 'ci',
    workItemTypes: ['story', 'task', 'bug', 'defect'],
    tools: [TOOL_CI_RUN, TOOL_CI_PRODUCTION],
    writePermissions: [],
    allowedActions: ['read', 'ci_trigger'],
    approvalRequired: ['production_deploy'],
    forbiddenActions: [
      'draft',
      'code_modify',
      'git_commit',
      'branch_push',
      'pull_request',
      'review_approve',
      'merge',
      'protected_file_write',
    ],
  },
  specialistPolicy('product-owner', ['epic', 'feature', 'requirement', 'story'], [TOOL_DELIVERY_CONTRACT_WRITE], ['read', 'draft']),
  specialistPolicy('business-analyst', ['epic', 'feature', 'requirement', 'story'], [TOOL_DELIVERY_CONTRACT_WRITE, TOOL_DOCUMENT_PARSE], ['read', 'draft']),
  specialistPolicy('ux-designer', ['story', 'requirement'], [TOOL_EVALUATION_WRITE, TOOL_BROWSER_NAVIGATE, TOOL_IMAGE_ANALYZE], ['read']),
  specialistPolicy('architect', ['epic', 'feature', 'story'], [TOOL_DELIVERY_CONTRACT_WRITE], ['read', 'draft']),
  specialistPolicy('frontend-developer', ['story', 'task'], [TOOL_DELIVERY_CONTRACT_WRITE, TOOL_BROWSER_NAVIGATE], ['read', 'draft']),
  specialistPolicy('backend-developer', ['story', 'task'], [TOOL_DELIVERY_CONTRACT_WRITE, TOOL_DOCUMENT_PARSE], ['read', 'draft']),
  specialistPolicy('qa-engineer', ['story', 'task', 'bug', 'defect'], [TOOL_EVALUATION_WRITE, TOOL_TEST], ['read', 'ci_trigger']),
  specialistPolicy('devops', ['story', 'task'], [TOOL_EVALUATION_WRITE, TOOL_CI_RUN], ['read', 'ci_trigger']),
  specialistPolicy('security-reviewer', ['story', 'task', 'bug', 'defect'], [TOOL_EVALUATION_WRITE], ['read']),
  specialistPolicy('scrum-master', ['story', 'task'], [TOOL_DELIVERY_CONTRACT_WRITE], ['read', 'draft']),
  specialistPolicy('technical-writer', ['story', 'task'], [TOOL_EVALUATION_WRITE], ['read', 'draft']),
];

function specialistPolicy(
  role: string,
  workItemTypes: RoleCapabilityPolicy['workItemTypes'],
  tools: readonly string[],
  allowedActions: readonly AuthorityAction[],
): RoleCapabilityPolicy {
  const approvalRequired: readonly AuthorityAction[] = allowedActions.includes('ci_trigger')
    ? ['production_deploy']
    : [];
  return {
    role,
    workItemTypes,
    tools,
    writePermissions: allowedActions.includes('draft') ? ['draft'] : [],
    allowedActions,
    approvalRequired,
    forbiddenActions: ALL_ACTIONS.filter((action) => !allowedActions.includes(action) && !approvalRequired.includes(action)),
  };
}

export function policyForRole(role: string): RoleCapabilityPolicy | undefined {
  return ROLE_POLICIES.find((policy) => policy.role === role);
}
