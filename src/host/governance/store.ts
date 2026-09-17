/**
 * JSON persistence for custom packs, pack selections, obligations, and mappings.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type {
  AgentProvenance,
  AiRiskAssessment,
  ComplianceObligation,
  ControlMapping,
  ControlPack,
  EvidenceReport,
  GovernanceGatePolicy,
  ProjectPackSelection,
  ReliabilitySlo,
  ResidualRiskAcceptance,
  SecurityScanEvidence,
  ThreatModel,
} from './types.js';

const SCHEMA_VERSION = 1;

export interface GovernanceSnapshot {
  readonly schemaVersion: number;
  readonly customPacks: readonly ControlPack[];
  readonly selections: readonly ProjectPackSelection[];
  readonly obligations: readonly ComplianceObligation[];
  readonly mappings: readonly ControlMapping[];
  readonly gatePolicies: Readonly<Record<string, GovernanceGatePolicy>>;
  readonly threatModels: readonly ThreatModel[];
  readonly securityEvidence: readonly SecurityScanEvidence[];
  readonly riskAcceptances: readonly ResidualRiskAcceptance[];
  readonly slos: readonly ReliabilitySlo[];
  readonly provenance: readonly AgentProvenance[];
  readonly aiRiskAssessments: readonly AiRiskAssessment[];
  readonly evidenceReports: readonly EvidenceReport[];
}

export function governanceStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, '.huntianling', 'governance.json');
}

export function emptyGovernanceSnapshot(): GovernanceSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    customPacks: [],
    selections: [],
    obligations: [],
    mappings: [],
    gatePolicies: {},
    threatModels: [],
    securityEvidence: [],
    riskAcceptances: [],
    slos: [],
    provenance: [],
    aiRiskAssessments: [],
    evidenceReports: [],
  };
}

export function loadGovernanceSnapshot(workspaceRoot: string): GovernanceSnapshot {
  try {
    const raw = readFileSync(governanceStorePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as GovernanceSnapshot;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`unsupported governance schema ${String(parsed.schemaVersion)}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      customPacks: parsed.customPacks ?? [],
      selections: parsed.selections ?? [],
      obligations: parsed.obligations ?? [],
      mappings: parsed.mappings ?? [],
      gatePolicies: parsed.gatePolicies ?? {},
      threatModels: parsed.threatModels ?? [],
      securityEvidence: parsed.securityEvidence ?? [],
      riskAcceptances: parsed.riskAcceptances ?? [],
      slos: parsed.slos ?? [],
      provenance: parsed.provenance ?? [],
      aiRiskAssessments: parsed.aiRiskAssessments ?? [],
      evidenceReports: parsed.evidenceReports ?? [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return emptyGovernanceSnapshot();
    throw error;
  }
}

export function saveGovernanceSnapshot(workspaceRoot: string, snapshot: GovernanceSnapshot): void {
  const path = governanceStorePath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...snapshot, schemaVersion: SCHEMA_VERSION }, null, 2)}\n`);
}
