/**
 * Versioned built-in workflow capabilities.
 */

import type { WorkflowCapability } from './types.js';

export {
  BUILTIN_TEMPLATES,
  DEFAULT_TEMPLATE,
  DEFAULT_TEMPLATE_ID,
} from './templates.js';

function builtinCapability(
  id: string,
  title: string,
  area: string,
): WorkflowCapability {
  return {
    id,
    version: '1.0.0',
    title,
    builtin: true,
    area,
    documentation: `${title} is a built-in HuntianLing workflow capability. Teams may select, copy, or disable it per project; the definition cannot be edited in place.`,
    fixtures: [
      {
        id: `${id}.happy-path`,
        scenario: 'happy-path',
        input: { capabilityId: id },
        expected: { runnable: 'true' },
      },
    ],
    conformance: {
      schema: `huntianling.capability.${id}.v1`,
      result: 'pass',
    },
  };
}

export const BUILTIN_CAPABILITIES: readonly WorkflowCapability[] = [
  builtinCapability('intake', 'Intake', 'collect'),
  builtinCapability('analysis', 'Requirement analysis', 'design'),
  builtinCapability('design', 'Requirement design', 'design'),
  builtinCapability('decomposition', 'Decomposition', 'planning'),
  builtinCapability('implementation', 'Implementation', 'delivery'),
  builtinCapability('review', 'Code review', 'review'),
  builtinCapability('evaluation', 'QA verification', 'verification'),
  builtinCapability('approval', 'Approval', 'governance'),
  builtinCapability('git', 'Git', 'scm'),
  builtinCapability('ci', 'CI', 'ci'),
  builtinCapability('evidence', 'Evidence', 'evidence'),
  builtinCapability('audit', 'Audit', 'audit'),
];
