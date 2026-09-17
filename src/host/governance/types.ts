/**
 * Project obligation registry and versioned certification control packs.
 */

import {
  GOVERNANCE_IMPACT_FLAGS,
  type AcceptanceCriterionId,
  type GovernanceImpactFlag,
  type GovernanceObligationStatus,
  type ProjectId,
  type SecurityClassification,
  type WorkItemId,
} from '../board/types.js';

export { GOVERNANCE_IMPACT_FLAGS, type GovernanceImpactFlag };

export type GovernanceErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'NOT_READY' | 'CONFLICT';

export class GovernanceError extends Error {
  constructor(
    readonly code: GovernanceErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const OBLIGATION_KINDS = [
  'regional_law',
  'industry_rule',
  'internal_policy',
  'customer_contract',
  'certification_program',
] as const;
export type ObligationKind = (typeof OBLIGATION_KINDS)[number];

export const CONTROL_EVIDENCE_KINDS = ['code', 'ci', 'check', 'approval', 'audit'] as const;
export type ControlEvidenceKind = (typeof CONTROL_EVIDENCE_KINDS)[number];

export type ControlPackKind = 'builtin' | 'custom';

export interface ControlDefinition {
  readonly id: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly controlId: string;
  readonly summary: string;
  readonly applicability: string;
  readonly owner: string;
  readonly requiredEvidence: readonly ControlEvidenceKind[];
  readonly checkRules: readonly string[];
}

export interface ControlPack {
  readonly id: string;
  readonly frameworkName: string;
  readonly version: string;
  readonly kind: ControlPackKind;
  readonly description: string;
  readonly controls: readonly ControlDefinition[];
}

export interface CustomControlPackInput {
  readonly id: string;
  readonly frameworkName: string;
  readonly version: string;
  readonly description?: string;
  readonly controls: readonly {
    readonly controlId: string;
    readonly summary: string;
    readonly applicability?: string;
    readonly owner?: string;
    readonly requiredEvidence?: readonly string[];
    readonly checkRules?: readonly string[];
  }[];
}

export interface ProjectPackSelection {
  readonly projectId: ProjectId;
  readonly packId: string;
  readonly packVersion: string;
  readonly selectedAt: number;
  readonly selectedBy: string;
}

export interface ComplianceObligation {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly kind: ObligationKind;
  readonly jurisdiction: string;
  readonly source: string;
  readonly applicabilityReason: string;
  readonly owner: string;
  readonly reviewer: string;
  readonly effectiveDate: number | null;
  readonly reviewDate: number | null;
  readonly status: GovernanceObligationStatus;
  readonly controlIds: readonly string[];
  readonly workItemIds: readonly WorkItemId[];
  readonly acceptanceCriterionIds: readonly AcceptanceCriterionId[];
  readonly dataCategories: readonly string[];
  readonly userRoles: readonly string[];
  readonly sourceDocumentIds: readonly string[];
  readonly riskIds: readonly string[];
  readonly checkIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly approvedAt: number | null;
  readonly approvedBy: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateObligationInput {
  readonly projectId: ProjectId;
  readonly title: string;
  readonly kind: ObligationKind;
  readonly jurisdiction: string;
  readonly source: string;
  readonly applicabilityReason: string;
  readonly owner: string;
  readonly reviewer: string;
  readonly effectiveDate?: number | null;
  readonly reviewDate?: number | null;
  readonly controlIds?: readonly string[];
  readonly workItemIds?: readonly WorkItemId[];
  readonly acceptanceCriterionIds?: readonly AcceptanceCriterionId[];
  readonly dataCategories?: readonly string[];
  readonly userRoles?: readonly string[];
  readonly sourceDocumentIds?: readonly string[];
  readonly riskIds?: readonly string[];
  readonly checkIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
  readonly actor?: string;
}

export interface ControlMapping {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly packId: string;
  readonly packVersion: string;
  readonly controlId: string;
  readonly workItemId: WorkItemId;
  readonly checkIds: readonly string[];
  readonly codeEvidenceIds: readonly string[];
  readonly ciReportIds: readonly string[];
  readonly approvalIds: readonly string[];
  readonly auditEventIds: readonly string[];
  readonly createdAt: number;
  readonly createdBy: string;
}

export interface MapControlInput {
  readonly projectId: ProjectId;
  readonly packId: string;
  readonly packVersion: string;
  readonly controlId: string;
  readonly workItemId: WorkItemId;
  readonly checkIds?: readonly string[];
  readonly codeEvidenceIds?: readonly string[];
  readonly ciReportIds?: readonly string[];
  readonly approvalIds?: readonly string[];
  readonly actor?: string;
}

export interface CertificationControlReadiness {
  readonly controlKey: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly controlId: string;
  readonly mapped: boolean;
  readonly evidenceComplete: boolean;
  readonly missingEvidence: readonly ControlEvidenceKind[];
  readonly workItemId: WorkItemId | null;
}

export interface CertificationReadiness {
  readonly projectId: ProjectId;
  readonly milestoneId: string | null;
  readonly workItemId: WorkItemId | null;
  readonly totalControls: number;
  readonly mappedControls: number;
  readonly evidenceCompleteControls: number;
  readonly ready: boolean;
  readonly controls: readonly CertificationControlReadiness[];
}

export interface CertificationReadinessQuery {
  readonly projectId: ProjectId;
  readonly milestoneId?: string;
  readonly workItemId?: WorkItemId;
}

export const SECURITY_EVIDENCE_KINDS = [
  'test',
  'code-review',
  'dependency-scan',
  'secret-scan',
  'static-analysis',
  'dynamic-test',
  'manual-review',
] as const;
export type SecurityEvidenceKind = (typeof SECURITY_EVIDENCE_KINDS)[number];

export const EVIDENCE_REPORT_SCOPES = [
  'project',
  'milestone',
  'work-item',
  'release',
  'certification',
] as const;
export type EvidenceReportScope = (typeof EVIDENCE_REPORT_SCOPES)[number];

export const EVIDENCE_REPORT_STATUSES = ['draft', 'approved'] as const;
export type EvidenceReportStatus = (typeof EVIDENCE_REPORT_STATUSES)[number];

export interface GovernanceGatePolicy {
  readonly requireThreatModelForHighRisk: boolean;
  readonly requireObservabilityForProduction: boolean;
  readonly requireProvenanceForDelivery: boolean;
  readonly requireAttestationForDelivery: boolean;
}

export const DEFAULT_GATE_POLICY: GovernanceGatePolicy = {
  requireThreatModelForHighRisk: false,
  requireObservabilityForProduction: false,
  requireProvenanceForDelivery: false,
  requireAttestationForDelivery: false,
};

export interface ThreatModel {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly summary: string;
  readonly assets: readonly string[];
  readonly threats: readonly string[];
  readonly mitigations: readonly string[];
  readonly residualRisk: string;
  readonly actor: string;
  readonly createdAt: number;
}

export interface SecurityScanEvidence {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly kind: SecurityEvidenceKind;
  readonly title: string;
  readonly status: 'passing' | 'failing';
  readonly source: string;
  readonly findings: readonly string[];
  readonly actor: string;
  readonly createdAt: number;
}

export interface ResidualRiskAcceptance {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly area: 'security' | 'reliability' | 'trust' | 'governance';
  readonly title: string;
  readonly approver: string;
  readonly reason: string;
  readonly scope: string;
  readonly expiration: number | null;
  readonly compensatingControls: readonly string[];
  readonly createdAt: number;
}

export interface ReliabilitySlo {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId | null;
  readonly milestoneId: string | null;
  readonly name: string;
  readonly availabilityTarget: string;
  readonly latencyTarget: string;
  readonly errorBudget: string;
  readonly capacityAssumptions: string;
  readonly backupRequirements: string;
  readonly restoreObjective: string;
  readonly dependencyAssumptions: string;
  readonly observabilityPlan: string;
  readonly rollbackPlan: string;
  readonly actor: string;
  readonly createdAt: number;
}

export interface AgentProvenance {
  readonly id: string;
  readonly runId: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId | null;
  readonly sourceInputs: readonly string[];
  readonly promptTemplate: string;
  readonly modelIdentity: string;
  readonly skillVersions: readonly string[];
  readonly toolCalls: readonly string[];
  readonly retrievedContext: readonly string[];
  readonly generatedOutput: string;
  readonly humanEdits: readonly string[];
  readonly approvals: readonly string[];
  readonly verificationEvidence: readonly string[];
  readonly confidence: string | null;
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
  readonly openQuestions: readonly string[];
  readonly createdAt: number;
}

export interface AiRiskAssessment {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workItemId: WorkItemId;
  readonly summary: string;
  readonly residualRisk: string;
  readonly usesAi: boolean;
  readonly actor: string;
  readonly createdAt: number;
}

export interface EvidenceReport {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly scope: EvidenceReportScope;
  readonly scopeId: string;
  readonly status: EvidenceReportStatus;
  readonly createdAt: number;
  readonly createdBy: string;
  readonly approvedAt: number | null;
  readonly approvedBy: string | null;
  readonly sourceDataVersion: string;
  readonly exportHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface RecordProvenanceInput {
  readonly runId: string;
  readonly projectId: ProjectId;
  readonly workItemId?: WorkItemId | null;
  readonly sourceInputs?: readonly string[];
  readonly promptTemplate?: string;
  readonly modelIdentity?: string;
  readonly skillVersions?: readonly string[];
  readonly toolCalls?: readonly string[];
  readonly retrievedContext?: readonly string[];
  readonly generatedOutput?: string;
  readonly verificationEvidence?: readonly string[];
  readonly confidence?: string | null;
  readonly assumptions?: readonly string[];
  readonly limitations?: readonly string[];
  readonly openQuestions?: readonly string[];
}

export interface ReliabilityReadiness {
  readonly projectId: ProjectId;
  readonly milestoneId: string | null;
  readonly totalSlos: number;
  readonly slosWithObservability: number;
  readonly productionFacingMissingObservability: number;
  readonly ready: boolean;
}

export interface GovernanceDashboardQuery {
  readonly projectId: ProjectId;
  readonly milestoneId?: string;
  readonly workItemId?: WorkItemId;
}

export const GOVERNANCE_EXCEPTION_KINDS = [
  'unapproved_obligation',
  'open_risk',
  'failing_scan',
  'missing_check',
] as const;
export type GovernanceExceptionKind = (typeof GOVERNANCE_EXCEPTION_KINDS)[number];

export interface GovernanceOpenException {
  readonly kind: GovernanceExceptionKind;
  readonly id: string;
  readonly title: string;
  readonly workItemId: WorkItemId | null;
  readonly detail: string;
}

export interface GovernanceControlRow {
  readonly controlKey: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly controlId: string;
  readonly summary: string;
  readonly mapped: boolean;
  readonly evidenceComplete: boolean;
  readonly missingEvidence: readonly ControlEvidenceKind[];
  readonly workItemId: WorkItemId | null;
}

export interface GovernanceWorkItemDashboard {
  readonly workItemId: WorkItemId;
  readonly title: string;
  readonly milestoneId: string | null;
  readonly productionFacing: boolean;
  readonly securityClassification: SecurityClassification;
  readonly requiredControls: readonly GovernanceControlRow[];
  readonly mappedChecks: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly residualRisks: readonly ResidualRiskAcceptance[];
  readonly approvalRequirements: readonly string[];
  readonly provenance: readonly AgentProvenance[];
  readonly obligations: readonly ComplianceObligation[];
  readonly threatModels: readonly ThreatModel[];
  readonly securityEvidence: readonly SecurityScanEvidence[];
  readonly slos: readonly ReliabilitySlo[];
  readonly trustAssessments: readonly AiRiskAssessment[];
}

export interface GovernanceMilestoneRollup {
  readonly milestoneId: string;
  readonly title: string;
  readonly workItemCount: number;
  readonly complianceReady: boolean;
  readonly securityReady: boolean;
  readonly reliabilityReady: boolean;
  readonly trustReady: boolean;
  readonly unapprovedObligations: number;
  readonly openExceptions: number;
  readonly draftReports: number;
  readonly approvedReports: number;
}

export interface GovernanceSecurityReadiness {
  readonly ready: boolean;
  readonly highRiskWorkItems: number;
  readonly threatModelCount: number;
  readonly passingScans: number;
  readonly failingScans: number;
}

export interface GovernanceDashboard {
  readonly projectId: ProjectId;
  readonly milestoneId: string | null;
  readonly workItemId: WorkItemId | null;
  readonly obligations: readonly ComplianceObligation[];
  readonly controlCoverage: CertificationReadiness;
  readonly riskRegister: readonly ResidualRiskAcceptance[];
  readonly openExceptions: readonly GovernanceOpenException[];
  readonly securityReadiness: GovernanceSecurityReadiness;
  readonly reliabilityReadiness: ReliabilityReadiness;
  readonly trustAssessments: readonly AiRiskAssessment[];
  readonly evidenceReports: readonly EvidenceReport[];
  readonly milestones: readonly GovernanceMilestoneRollup[];
  readonly workItems: readonly GovernanceWorkItemDashboard[];
}

export interface GovernanceService {
  listPacks(): readonly ControlPack[];
  selectedPacks(projectId: ProjectId): readonly ProjectPackSelection[];
  selectPack(projectId: ProjectId, packId: string, version: string, actor: string): ProjectPackSelection;
  registerCustomPack(input: CustomControlPackInput): ControlPack;
  listObligations(projectId: ProjectId): readonly ComplianceObligation[];
  getObligation(id: string): ComplianceObligation | undefined;
  createObligation(input: CreateObligationInput): ComplianceObligation;
  submitObligation(id: string, actor: string): ComplianceObligation;
  approveObligation(id: string, actor: string): ComplianceObligation;
  activateObligation(id: string, actor: string): ComplianceObligation;
  retireObligation(id: string, actor: string): ComplianceObligation;
  mapControl(input: MapControlInput): ControlMapping;
  listControlMappings(projectId: ProjectId): readonly ControlMapping[];
  certificationReadiness(query: CertificationReadinessQuery): CertificationReadiness;
  workItemObligations(workItemId: WorkItemId): readonly ComplianceObligation[];
  gatePolicy(projectId: ProjectId): GovernanceGatePolicy;
  configureGatePolicy(projectId: ProjectId, policy: Partial<GovernanceGatePolicy>, actor: string): GovernanceGatePolicy;
  recordThreatModel(input: {
    readonly workItemId: WorkItemId;
    readonly summary: string;
    readonly assets?: readonly string[];
    readonly threats?: readonly string[];
    readonly mitigations?: readonly string[];
    readonly residualRisk?: string;
    readonly actor: string;
  }): ThreatModel;
  ingestSecurityEvidence(input: {
    readonly workItemId: WorkItemId;
    readonly kind: SecurityEvidenceKind;
    readonly title: string;
    readonly status: 'passing' | 'failing';
    readonly source?: string;
    readonly findings?: readonly string[];
    readonly actor: string;
  }): SecurityScanEvidence;
  recordRiskAcceptance(input: {
    readonly workItemId: WorkItemId;
    readonly area: ResidualRiskAcceptance['area'];
    readonly title: string;
    readonly approver: string;
    readonly reason: string;
    readonly scope: string;
    readonly expiration?: number | null;
    readonly compensatingControls?: readonly string[];
    readonly actor?: string;
  }): ResidualRiskAcceptance;
  recordSlo(input: {
    readonly projectId: ProjectId;
    readonly workItemId?: WorkItemId | null;
    readonly milestoneId?: string | null;
    readonly name: string;
    readonly availabilityTarget: string;
    readonly latencyTarget: string;
    readonly errorBudget: string;
    readonly capacityAssumptions: string;
    readonly backupRequirements: string;
    readonly restoreObjective: string;
    readonly dependencyAssumptions: string;
    readonly observabilityPlan?: string;
    readonly rollbackPlan?: string;
    readonly actor: string;
  }): ReliabilitySlo;
  recordObservabilityPlan(workItemId: WorkItemId, plan: string, actor: string): ReliabilitySlo;
  reliabilityReadiness(projectId: ProjectId, milestoneId?: string): ReliabilityReadiness;
  recordAgentProvenance(input: RecordProvenanceInput): AgentProvenance;
  getRunProvenance(runId: string): AgentProvenance | undefined;
  recordAiRiskAssessment(input: {
    readonly workItemId: WorkItemId;
    readonly summary: string;
    readonly residualRisk: string;
    readonly usesAi: boolean;
    readonly actor: string;
  }): AiRiskAssessment;
  recordHumanCorrection(workItemId: WorkItemId, notes: string, actor: string): AgentProvenance;
  createEvidenceReport(input: {
    readonly projectId: ProjectId;
    readonly scope: EvidenceReportScope;
    readonly scopeId?: string;
    readonly actor: string;
  }): EvidenceReport;
  getEvidenceReport(id: string): EvidenceReport | undefined;
  listEvidenceReports(projectId: ProjectId): readonly EvidenceReport[];
  approveEvidenceReport(id: string, actor: string): EvidenceReport;
  exportEvidenceReport(id: string, format: 'json' | 'markdown'): string;
  dashboard(query: GovernanceDashboardQuery): GovernanceDashboard;
}
