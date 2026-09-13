/**
 * Built-in certification control packs. Each pack keeps a version so later
 * editions can coexist with historical evidence.
 */

import type { ControlDefinition, ControlPack } from './types.js';

function control(
  packId: string,
  packVersion: string,
  controlId: string,
  summary: string,
  applicability: string,
  owner: string,
  requiredEvidence: ControlDefinition['requiredEvidence'],
  checkRules: readonly string[],
): ControlDefinition {
  return {
    id: `${packId}@${packVersion}:${controlId}`,
    packId,
    packVersion,
    controlId,
    summary,
    applicability,
    owner,
    requiredEvidence,
    checkRules,
  };
}

function pack(
  id: string,
  frameworkName: string,
  description: string,
  controls: readonly ControlDefinition[],
): ControlPack {
  return {
    id,
    frameworkName,
    version: '1.0.0',
    kind: 'builtin',
    description,
    controls,
  };
}

const NIST_CSF = pack(
  'nist-csf-2.0',
  'NIST CSF 2.0',
  'Cybersecurity governance outcomes from NIST CSF 2.0.',
  [
    control(
      'nist-csf-2.0',
      '1.0.0',
      'GV.OC-01',
      'The organizational mission is understood and informs cybersecurity risk management.',
      'organizational governance',
      'compliance',
      ['check'],
      ['mission-documented'],
    ),
    control(
      'nist-csf-2.0',
      '1.0.0',
      'PR.AA-01',
      'Identities and credentials are issued, managed, verified, revoked, and audited.',
      'authentication and access',
      'security',
      ['code'],
      ['identity-lifecycle'],
    ),
  ],
);

const OWASP_ASVS = pack(
  'owasp-asvs',
  'OWASP ASVS',
  'Application security verification from OWASP ASVS.',
  [
    control(
      'owasp-asvs',
      '1.0.0',
      'V2.1.1',
      'Verify that user set passwords are at least 12 characters in length.',
      'authentication',
      'security',
      ['code'],
      ['password-length'],
    ),
    control(
      'owasp-asvs',
      '1.0.0',
      'V4.1.1',
      'Verify that the application enforces access control rules on a trusted service layer.',
      'authorization',
      'security',
      ['check'],
      ['server-side-authorization'],
    ),
  ],
);

const NIST_AI_RMF = pack(
  'nist-ai-rmf',
  'NIST AI RMF',
  'AI risk management from NIST AI RMF.',
  [
    control(
      'nist-ai-rmf',
      '1.0.0',
      'GOVERN-1.1',
      'Legal and regulatory requirements involving AI are understood and managed.',
      'AI governance',
      'compliance',
      ['approval'],
      ['ai-legal-review'],
    ),
    control(
      'nist-ai-rmf',
      '1.0.0',
      'MEASURE-2.3',
      'AI system performance is evaluated against intended use and residual risk.',
      'AI evaluation',
      'trust',
      ['check'],
      ['evaluation-evidence'],
    ),
  ],
);

const ISO_42001 = pack(
  'iso-42001',
  'ISO/IEC 42001',
  'AI management system requirements from ISO/IEC 42001.',
  [
    control(
      'iso-42001',
      '1.0.0',
      '5.2',
      'Top management establishes an AI policy appropriate to the organization.',
      'AI management system',
      'compliance',
      ['approval'],
      ['ai-policy'],
    ),
    control(
      'iso-42001',
      '1.0.0',
      '8.1',
      'The organization plans, implements, and controls processes needed to meet AI MS requirements.',
      'AI operations',
      'compliance',
      ['audit'],
      ['operational-control'],
    ),
  ],
);

export const BUILTIN_CONTROL_PACKS: readonly ControlPack[] = [NIST_CSF, OWASP_ASVS, NIST_AI_RMF, ISO_42001];

export function builtinPackKey(packId: string, version: string): string {
  return `${packId}@${version}`;
}
