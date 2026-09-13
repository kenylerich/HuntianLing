/**
 * huntianling.governance — obligation lifecycle and control pack selection.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { BoardService } from '../board/plugin.js';
import type {
  AcceptanceCriterionId,
  DeliveryEvidenceCheck,
  DeliveryEvidenceLink,
  DeliveryRiskAcceptance,
  GovernanceObligationSummary,
  MilestoneId,
  ProjectId,
  SecurityClassification,
  WorkItem,
  WorkItemId,
} from '../board/types.js';
import { BUILTIN_CONTROL_PACKS } from './packs.js';
import {
  emptyGovernanceSnapshot,
  loadGovernanceSnapshot,
  saveGovernanceSnapshot,
  type GovernanceSnapshot,
} from './store.js';
import {
  CONTROL_EVIDENCE_KINDS,
  DEFAULT_GATE_POLICY,
  EVIDENCE_REPORT_SCOPES,
  GOVERNANCE_IMPACT_FLAGS,
  GovernanceError,
  OBLIGATION_KINDS,
  SECURITY_EVIDENCE_KINDS,
  type CertificationReadiness,
  type CertificationReadinessQuery,
  type CertificationControlReadiness,
  type ComplianceObligation,
  type ControlDefinition,
  type ControlEvidenceKind,
  type ControlMapping,
  type ControlPack,
  type AgentProvenance,
  type CreateObligationInput,
  type CustomControlPackInput,
  type EvidenceReport,
  type EvidenceReportScope,
  type GovernanceDashboard,
  type GovernanceDashboardQuery,
  type GovernanceGatePolicy,
  type GovernanceImpactFlag,
  type GovernanceMilestoneRollup,
  type GovernanceOpenException,
  type GovernanceService,
  type GovernanceWorkItemDashboard,
  type MapControlInput,
  type ObligationKind,
  type ProjectPackSelection,
  type RecordProvenanceInput,
  type ReliabilitySlo,
  type ResidualRiskAcceptance,
  type SecurityEvidenceKind,
  type SecurityScanEvidence,
} from './types.js';

export type { GovernanceService };

export interface CreateGovernanceServiceInput {
  readonly board: BoardService;
  readonly workspaceRoot?: string;
}

export function createGovernanceService(input: CreateGovernanceServiceInput): GovernanceService {
  const board = input.board;
  let snapshot: GovernanceSnapshot =
    input.workspaceRoot === undefined
      ? emptyGovernanceSnapshot()
      : loadGovernanceSnapshot(input.workspaceRoot);

  function persist(): void {
    if (input.workspaceRoot === undefined) return;
    saveGovernanceSnapshot(input.workspaceRoot, snapshot);
  }

  function packs(): readonly ControlPack[] {
    return [...BUILTIN_CONTROL_PACKS, ...snapshot.customPacks];
  }

  function findPack(packId: string, version: string): ControlPack | undefined {
    return packs().find((item) => item.id === packId && item.version === version);
  }

  function findControl(packId: string, version: string, controlId: string): ControlDefinition | undefined {
    return findPack(packId, version)?.controls.find(
      (item) => item.controlId === controlId || item.id === controlId,
    );
  }

  function requireProject(projectId: ProjectId): void {
    const found = board.listProjects({ includeArchived: true }).some((item) => item.id === projectId);
    if (!found) throw new GovernanceError('NOT_FOUND', `project not found: ${projectId}`);
  }

  function requireWorkItem(workItemId: WorkItemId, projectId: ProjectId): void {
    const item = board.getWorkItem(workItemId);
    if (item === undefined) throw new GovernanceError('NOT_FOUND', `work item not found: ${workItemId}`);
    if (item.projectId !== projectId) {
      throw new GovernanceError('VALIDATION', `work item ${workItemId} is not in project ${projectId}`);
    }
  }

  function syncObligation(previous: ComplianceObligation | undefined, next: ComplianceObligation): void {
    const previousIds = new Set(previous?.workItemIds ?? []);
    const nextIds = new Set(next.workItemIds);
    for (const workItemId of nextIds) {
      upsertWorkItemObligation(workItemId, toSummary(next));
    }
    for (const workItemId of previousIds) {
      if (nextIds.has(workItemId)) continue;
      removeWorkItemObligation(workItemId, next.id);
    }
  }

  function upsertWorkItemObligation(workItemId: WorkItemId, obligation: GovernanceObligationSummary): void {
    const summary = board.getDeliveryEvidenceSummary(workItemId);
    const obligations = [
      ...summary.obligations.filter((item) => item.id !== obligation.id),
      obligation,
    ];
    board.updateDeliveryEvidenceSummary(workItemId, { obligations });
  }

  function removeWorkItemObligation(workItemId: WorkItemId, obligationId: string): void {
    const summary = board.getDeliveryEvidenceSummary(workItemId);
    board.updateDeliveryEvidenceSummary(workItemId, {
      obligations: summary.obligations.filter((item) => item.id !== obligationId),
    });
  }

  const service: GovernanceService = {
    listPacks() {
      return packs();
    },

    selectedPacks(projectId) {
      requireProject(projectId);
      return snapshot.selections.filter((item) => item.projectId === projectId);
    },

    selectPack(projectId, packId, version, actor) {
      requireProject(projectId);
      const pack = findPack(packId, version);
      if (pack === undefined) {
        throw new GovernanceError('NOT_FOUND', `unknown control pack ${packId}@${version}`);
      }
      const selection: ProjectPackSelection = {
        projectId,
        packId,
        packVersion: version,
        selectedAt: Date.now(),
        selectedBy: actor,
      };
      snapshot = {
        ...snapshot,
        selections: [
          ...snapshot.selections.filter((item) => !(item.projectId === projectId && item.packId === packId)),
          selection,
        ],
      };
      board.recordAuditEvent({
        projectId,
        actorId: actor,
        action: 'governance.pack.selected',
        targetType: 'control_pack',
        targetId: `${packId}@${version}`,
        targetLabel: pack.frameworkName,
        changedFields: ['packVersion'],
      });
      persist();
      return selection;
    },

    registerCustomPack(raw) {
      const id = requirePackedId(raw.id, 'control pack id');
      if (BUILTIN_CONTROL_PACKS.some((item) => item.id === id)) {
        throw new GovernanceError('VALIDATION', `cannot replace built-in control pack: ${id}`);
      }
      const version = requirePackedId(raw.version, 'control pack version');
      if (snapshot.customPacks.some((item) => item.id === id && item.version === version)) {
        throw new GovernanceError('CONFLICT', `control pack ${id}@${version} already exists`);
      }
      const frameworkName = requireNonBlank(raw.frameworkName, 'framework name');
      if (raw.controls.length === 0) {
        throw new GovernanceError('VALIDATION', 'control pack controls cannot be empty');
      }
      const controls = raw.controls.map((item) => {
        const controlId = requirePackedId(item.controlId, 'control id');
        return {
          id: `${id}@${version}:${controlId}`,
          packId: id,
          packVersion: version,
          controlId,
          summary: requireNonBlank(item.summary, 'control summary'),
          applicability: item.applicability?.trim() || 'custom',
          owner: item.owner?.trim() || 'compliance',
          requiredEvidence: normalizeEvidenceKinds(item.requiredEvidence),
          checkRules: [...(item.checkRules ?? [])],
        };
      });
      const pack: ControlPack = {
        id,
        frameworkName,
        version,
        kind: 'custom',
        description: raw.description?.trim() || frameworkName,
        controls,
      };
      snapshot = { ...snapshot, customPacks: [...snapshot.customPacks, pack] };
      persist();
      return pack;
    },

    listObligations(projectId) {
      requireProject(projectId);
      return snapshot.obligations.filter((item) => item.projectId === projectId);
    },

    getObligation(id) {
      return snapshot.obligations.find((item) => item.id === id);
    },

    createObligation(raw) {
      requireProject(raw.projectId);
      const obligation = buildObligation(raw, board);
      snapshot = { ...snapshot, obligations: [...snapshot.obligations, obligation] };
      syncObligation(undefined, obligation);
      board.recordAuditEvent({
        projectId: obligation.projectId,
        actorId: raw.actor ?? obligation.owner,
        action: 'governance.obligation.created',
        targetType: 'compliance_obligation',
        targetId: obligation.id,
        targetLabel: obligation.title,
        changedFields: ['status'],
        reason: obligation.kind,
      });
      persist();
      return obligation;
    },

    submitObligation(id, actor) {
      return transitionObligation(id, actor, 'pending_review', ['draft']);
    },

    approveObligation(id, actor) {
      const current = requireObligation(id);
      if (current.reviewer !== actor) {
        throw new GovernanceError('VALIDATION', `obligation ${id} must be approved by reviewer ${current.reviewer}`);
      }
      const next = transitionObligation(id, actor, 'approved', ['pending_review']);
      const approved: ComplianceObligation = {
        ...next,
        approvedAt: Date.now(),
        approvedBy: actor,
        updatedAt: Date.now(),
      };
      snapshot = {
        ...snapshot,
        obligations: snapshot.obligations.map((item) => (item.id === id ? approved : item)),
      };
      syncObligation(next, approved);
      persist();
      return approved;
    },

    activateObligation(id, actor) {
      return transitionObligation(id, actor, 'active', ['approved']);
    },

    retireObligation(id, actor) {
      return transitionObligation(id, actor, 'retired', ['approved', 'active']);
    },

    mapControl(raw) {
      requireProject(raw.projectId);
      requireWorkItem(raw.workItemId, raw.projectId);
      const definition = findControl(raw.packId, raw.packVersion, raw.controlId);
      if (definition === undefined) {
        throw new GovernanceError(
          'NOT_FOUND',
          `unknown control ${raw.packId}@${raw.packVersion}:${raw.controlId}`,
        );
      }
      const actor = raw.actor ?? 'developer';
      const audit = board.recordAuditEvent({
        projectId: raw.projectId,
        actorId: actor,
        action: 'governance.control.mapped',
        targetType: 'governance_control',
        targetId: definition.id,
        targetLabel: definition.summary,
        changedFields: ['workItemId'],
        reason: raw.workItemId,
      });
      const mapping: ControlMapping = {
        id: randomUUID(),
        projectId: raw.projectId,
        packId: raw.packId,
        packVersion: raw.packVersion,
        controlId: definition.controlId,
        workItemId: raw.workItemId,
        checkIds: [...(raw.checkIds ?? [])],
        codeEvidenceIds: [...(raw.codeEvidenceIds ?? [])],
        ciReportIds: [...(raw.ciReportIds ?? [])],
        approvalIds: [...(raw.approvalIds ?? [])],
        auditEventIds: [audit.id],
        createdAt: Date.now(),
        createdBy: actor,
      };
      snapshot = {
        ...snapshot,
        mappings: [
          ...snapshot.mappings.filter(
            (item) =>
              !(
                item.projectId === mapping.projectId &&
                item.packId === mapping.packId &&
                item.packVersion === mapping.packVersion &&
                item.controlId === mapping.controlId &&
                item.workItemId === mapping.workItemId
              ),
          ),
          mapping,
        ],
      };
      const summary = board.getDeliveryEvidenceSummary(raw.workItemId);
      const link: DeliveryEvidenceLink = {
        kind: 'governance-control',
        id: definition.id,
        label: definition.summary,
        url: null,
        acceptanceCriterionIds: [],
      };
      board.updateDeliveryEvidenceSummary(raw.workItemId, {
        evidenceLinks: [...summary.evidenceLinks.filter((item) => item.id !== link.id), link],
      });
      persist();
      return mapping;
    },

    listControlMappings(projectId) {
      requireProject(projectId);
      return snapshot.mappings.filter((item) => item.projectId === projectId);
    },

    certificationReadiness(query) {
      requireProject(query.projectId);
      const selected = snapshot.selections.filter((item) => item.projectId === query.projectId);
      const scopedItems = scopedWorkItems(board, query);
      const scopedIds = new Set(scopedItems.map((item) => item.id));
      const controls: CertificationControlReadiness[] = [];
      for (const selection of selected) {
        const pack = findPack(selection.packId, selection.packVersion);
        if (pack === undefined) continue;
        for (const definition of pack.controls) {
          const mapping = snapshot.mappings.find(
            (item) =>
              item.projectId === query.projectId &&
              item.packId === definition.packId &&
              item.packVersion === definition.packVersion &&
              item.controlId === definition.controlId &&
              scopedIds.has(item.workItemId) &&
              (query.workItemId === undefined || item.workItemId === query.workItemId),
          );
          const missing = mapping === undefined
            ? [...definition.requiredEvidence]
            : missingEvidence(definition, mapping, board);
          controls.push({
            controlKey: definition.id,
            packId: definition.packId,
            packVersion: definition.packVersion,
            controlId: definition.controlId,
            mapped: mapping !== undefined,
            evidenceComplete: mapping !== undefined && missing.length === 0,
            missingEvidence: missing,
            workItemId: mapping?.workItemId ?? null,
          });
        }
      }
      const mappedControls = controls.filter((item) => item.mapped).length;
      const evidenceCompleteControls = controls.filter((item) => item.evidenceComplete).length;
      return {
        projectId: query.projectId,
        milestoneId: query.milestoneId ?? null,
        workItemId: query.workItemId ?? null,
        totalControls: controls.length,
        mappedControls,
        evidenceCompleteControls,
        ready: controls.length > 0 && evidenceCompleteControls === controls.length,
        controls,
      };
    },

    workItemObligations(workItemId) {
      return snapshot.obligations.filter((item) => item.workItemIds.includes(workItemId));
    },

    gatePolicy(projectId) {
      requireProject(projectId);
      return snapshot.gatePolicies[projectId] ?? DEFAULT_GATE_POLICY;
    },

    configureGatePolicy(projectId, policy, actor) {
      requireProject(projectId);
      const current = snapshot.gatePolicies[projectId] ?? DEFAULT_GATE_POLICY;
      const next: GovernanceGatePolicy = {
        requireThreatModelForHighRisk: policy.requireThreatModelForHighRisk ?? current.requireThreatModelForHighRisk,
        requireObservabilityForProduction: policy.requireObservabilityForProduction ?? current.requireObservabilityForProduction,
        requireProvenanceForDelivery: policy.requireProvenanceForDelivery ?? current.requireProvenanceForDelivery,
        requireAttestationForDelivery: policy.requireAttestationForDelivery ?? current.requireAttestationForDelivery,
      };
      snapshot = {
        ...snapshot,
        gatePolicies: { ...snapshot.gatePolicies, [projectId]: next },
      };
      board.recordAuditEvent({
        projectId,
        actorId: actor,
        action: 'governance.gates.configured',
        targetType: 'project',
        targetId: projectId,
        targetLabel: projectId,
        changedFields: ['gatePolicy'],
      });
      persist();
      refreshProjectGates(projectId);
      return next;
    },

    recordThreatModel(input) {
      const item = requireItem(input.workItemId);
      const model = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId: item.id,
        summary: requireNonBlank(input.summary, 'threat model summary'),
        assets: [...(input.assets ?? [])],
        threats: [...(input.threats ?? [])],
        mitigations: [...(input.mitigations ?? [])],
        residualRisk: input.residualRisk?.trim() || 'accepted',
        actor: input.actor,
        createdAt: Date.now(),
      };
      snapshot = { ...snapshot, threatModels: [...snapshot.threatModels, model] };
      board.recordAuditEvent({
        projectId: item.projectId,
        actorId: input.actor,
        action: 'governance.threat-model.recorded',
        targetType: 'work_item',
        targetId: item.id,
        targetLabel: item.title,
        changedFields: ['threatModel'],
      });
      persist();
      refreshWorkItemGates(item);
      return model;
    },

    ingestSecurityEvidence(input) {
      if (!(SECURITY_EVIDENCE_KINDS as readonly string[]).includes(input.kind)) {
        throw new GovernanceError('VALIDATION', `unknown security evidence kind: ${input.kind}`);
      }
      const item = requireItem(input.workItemId);
      const evidence = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId: item.id,
        kind: input.kind,
        title: requireNonBlank(input.title, 'security evidence title'),
        status: input.status,
        source: input.source?.trim() || input.kind,
        findings: [...(input.findings ?? [])],
        actor: input.actor,
        createdAt: Date.now(),
      };
      snapshot = { ...snapshot, securityEvidence: [...snapshot.securityEvidence, evidence] };
      persist();
      refreshWorkItemGates(item);
      return evidence;
    },

    recordRiskAcceptance(input) {
      const item = requireItem(input.workItemId);
      const record = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId: item.id,
        area: input.area,
        title: requireNonBlank(input.title, 'risk acceptance title'),
        approver: requireNonBlank(input.approver, 'risk acceptance approver'),
        reason: requireNonBlank(input.reason, 'risk acceptance reason'),
        scope: requireNonBlank(input.scope, 'risk acceptance scope'),
        expiration: input.expiration ?? null,
        compensatingControls: [...(input.compensatingControls ?? [])],
        createdAt: Date.now(),
      };
      snapshot = { ...snapshot, riskAcceptances: [...snapshot.riskAcceptances, record] };
      board.recordAuditEvent({
        projectId: item.projectId,
        actorId: input.actor ?? record.approver,
        action: 'governance.risk-acceptance.recorded',
        targetType: 'work_item',
        targetId: item.id,
        targetLabel: item.title,
        changedFields: ['riskAcceptances'],
      });
      const summary = board.getDeliveryEvidenceSummary(item.id);
      const acceptance: DeliveryRiskAcceptance = {
        id: record.id,
        area: record.area,
        title: record.title,
        status: 'approved',
        approver: record.approver,
        reason: record.reason,
        scope: record.scope,
        compensatingControls: record.compensatingControls,
        expiresAt: record.expiration,
        links: [],
      };
      board.updateDeliveryEvidenceSummary(item.id, {
        riskAcceptances: [...summary.riskAcceptances.filter((row) => row.id !== record.id), acceptance],
      });
      persist();
      refreshWorkItemGates(item);
      return record;
    },

    recordSlo(input) {
      requireProject(input.projectId);
      if (input.workItemId) requireWorkItem(input.workItemId, input.projectId);
      const slo: ReliabilitySlo = {
        id: randomUUID(),
        projectId: input.projectId,
        workItemId: input.workItemId ?? null,
        milestoneId: input.milestoneId ?? null,
        name: requireNonBlank(input.name, 'SLO name'),
        availabilityTarget: requireNonBlank(input.availabilityTarget, 'availability target'),
        latencyTarget: requireNonBlank(input.latencyTarget, 'latency target'),
        errorBudget: requireNonBlank(input.errorBudget, 'error budget'),
        capacityAssumptions: requireNonBlank(input.capacityAssumptions, 'capacity assumptions'),
        backupRequirements: requireNonBlank(input.backupRequirements, 'backup requirements'),
        restoreObjective: requireNonBlank(input.restoreObjective, 'restore objective'),
        dependencyAssumptions: requireNonBlank(input.dependencyAssumptions, 'dependency assumptions'),
        observabilityPlan: input.observabilityPlan?.trim() ?? '',
        rollbackPlan: input.rollbackPlan?.trim() ?? '',
        actor: input.actor,
        createdAt: Date.now(),
      };
      snapshot = { ...snapshot, slos: [...snapshot.slos, slo] };
      persist();
      if (slo.workItemId !== null) {
        const item = board.getWorkItem(slo.workItemId);
        if (item !== undefined) refreshWorkItemGates(item);
      }
      return slo;
    },

    recordObservabilityPlan(workItemId, plan, actor) {
      const item = requireItem(workItemId);
      const existing = snapshot.slos.find((row) => row.workItemId === item.id);
      if (existing === undefined) {
        return service.recordSlo({
          projectId: item.projectId,
          workItemId: item.id,
          name: `${item.title} reliability`,
          availabilityTarget: 'unspecified',
          latencyTarget: 'unspecified',
          errorBudget: 'unspecified',
          capacityAssumptions: 'unspecified',
          backupRequirements: 'unspecified',
          restoreObjective: 'unspecified',
          dependencyAssumptions: 'unspecified',
          observabilityPlan: plan,
          actor,
        });
      }
      const next = { ...existing, observabilityPlan: requireNonBlank(plan, 'observability plan') };
      snapshot = {
        ...snapshot,
        slos: snapshot.slos.map((row) => (row.id === existing.id ? next : row)),
      };
      persist();
      refreshWorkItemGates(item);
      return next;
    },

    reliabilityReadiness(projectId, milestoneId) {
      requireProject(projectId);
      const items = milestoneId === undefined
        ? board.listWorkItems({ projectId })
        : board.listWorkItems({ projectId, milestoneId: milestoneId as MilestoneId });
      const itemIds = new Set(items.map((item) => item.id));
      const slos = snapshot.slos.filter((row) =>
        row.projectId === projectId
        && (milestoneId === undefined || row.milestoneId === milestoneId || (row.workItemId !== null && itemIds.has(row.workItemId))),
      );
      const productionFacing = items.filter((item) => item.productionFacing);
      const missingObservability = productionFacing.filter((item) => {
        const slo = snapshot.slos.find((row) => row.workItemId === item.id);
        return slo === undefined || slo.observabilityPlan.trim() === '';
      }).length;
      const slosWithObservability = slos.filter((row) => row.observabilityPlan.trim() !== '').length;
      return {
        projectId,
        milestoneId: milestoneId ?? null,
        totalSlos: slos.length,
        slosWithObservability,
        productionFacingMissingObservability: missingObservability,
        ready: missingObservability === 0,
      };
    },

    recordAgentProvenance(input) {
      requireProject(input.projectId);
      const provenance: AgentProvenance = {
        id: randomUUID(),
        runId: requireNonBlank(input.runId, 'run id'),
        projectId: input.projectId,
        workItemId: input.workItemId ?? null,
        sourceInputs: [...(input.sourceInputs ?? [])],
        promptTemplate: input.promptTemplate?.trim() ?? '',
        modelIdentity: input.modelIdentity?.trim() ?? 'unspecified',
        skillVersions: [...(input.skillVersions ?? [])],
        toolCalls: [...(input.toolCalls ?? [])],
        retrievedContext: [...(input.retrievedContext ?? [])],
        generatedOutput: input.generatedOutput ?? '',
        humanEdits: [],
        approvals: [],
        verificationEvidence: [...(input.verificationEvidence ?? [])],
        confidence: input.confidence ?? null,
        assumptions: [...(input.assumptions ?? [])],
        limitations: [...(input.limitations ?? [])],
        openQuestions: [...(input.openQuestions ?? [])],
        createdAt: Date.now(),
      };
      snapshot = {
        ...snapshot,
        provenance: [...snapshot.provenance.filter((row) => row.runId !== provenance.runId), provenance],
      };
      if (provenance.workItemId !== null) {
        const item = board.getWorkItem(provenance.workItemId);
        if (item !== undefined) {
          const summary = board.getDeliveryEvidenceSummary(item.id);
          board.updateDeliveryEvidenceSummary(item.id, {
            provenanceLinks: [
              ...summary.provenanceLinks.filter((link) => link.id !== provenance.runId),
              {
                kind: 'trust-evidence',
                id: provenance.runId,
                label: provenance.modelIdentity,
                url: null,
                acceptanceCriterionIds: [],
              },
            ],
          });
          persist();
          refreshWorkItemGates(item);
        } else {
          persist();
        }
      } else {
        persist();
      }
      return provenance;
    },

    getRunProvenance(runId) {
      return snapshot.provenance.find((row) => row.runId === runId);
    },

    recordAiRiskAssessment(input) {
      const item = requireItem(input.workItemId);
      const assessment = {
        id: randomUUID(),
        projectId: item.projectId,
        workItemId: item.id,
        summary: requireNonBlank(input.summary, 'AI risk summary'),
        residualRisk: requireNonBlank(input.residualRisk, 'residual risk'),
        usesAi: input.usesAi,
        actor: input.actor,
        createdAt: Date.now(),
      };
      snapshot = { ...snapshot, aiRiskAssessments: [...snapshot.aiRiskAssessments, assessment] };
      persist();
      return assessment;
    },

    recordHumanCorrection(workItemId, notes, actor) {
      const item = requireItem(workItemId);
      const existing = snapshot.provenance.filter((row) => row.workItemId === item.id).at(-1);
      if (existing === undefined) {
        throw new GovernanceError('NOT_FOUND', `no provenance to correct for work item ${workItemId}`);
      }
      const next = {
        ...existing,
        humanEdits: [...existing.humanEdits, requireNonBlank(notes, 'correction notes')],
        approvals: [...existing.approvals, actor],
      };
      snapshot = {
        ...snapshot,
        provenance: snapshot.provenance.map((row) => (row.id === existing.id ? next : row)),
      };
      persist();
      return next;
    },

    createEvidenceReport(input) {
      requireProject(input.projectId);
      if (!(EVIDENCE_REPORT_SCOPES as readonly string[]).includes(input.scope)) {
        throw new GovernanceError('VALIDATION', `unknown evidence report scope: ${input.scope}`);
      }
      const payload = assembleReportPayload(input.projectId, input.scope, input.scopeId ?? input.projectId);
      const sourceDataVersion = String(payload.generatedAt);
      const body = JSON.stringify(payload);
      const report: EvidenceReport = {
        id: randomUUID(),
        projectId: input.projectId,
        scope: input.scope,
        scopeId: input.scopeId ?? input.projectId,
        status: 'draft',
        createdAt: Date.now(),
        createdBy: input.actor,
        approvedAt: null,
        approvedBy: null,
        sourceDataVersion,
        exportHash: createHash('sha256').update(body).digest('hex'),
        payload,
      };
      snapshot = { ...snapshot, evidenceReports: [...snapshot.evidenceReports, report] };
      board.recordAuditEvent({
        projectId: input.projectId,
        actorId: input.actor,
        action: 'governance.evidence-report.created',
        targetType: 'evidence_report',
        targetId: report.id,
        targetLabel: `${input.scope}:${report.scopeId}`,
        changedFields: ['status'],
      });
      persist();
      return report;
    },

    getEvidenceReport(id) {
      return snapshot.evidenceReports.find((row) => row.id === id);
    },

    listEvidenceReports(projectId) {
      requireProject(projectId);
      return snapshot.evidenceReports.filter((row) => row.projectId === projectId);
    },

    approveEvidenceReport(id, actor) {
      const report = snapshot.evidenceReports.find((row) => row.id === id);
      if (report === undefined) throw new GovernanceError('NOT_FOUND', `evidence report not found: ${id}`);
      if (report.status === 'approved') return report;
      const next = {
        ...report,
        status: 'approved' as const,
        approvedAt: Date.now(),
        approvedBy: actor,
      };
      snapshot = {
        ...snapshot,
        evidenceReports: snapshot.evidenceReports.map((row) => (row.id === id ? next : row)),
      };
      board.recordAuditEvent({
        projectId: report.projectId,
        actorId: actor,
        action: 'governance.evidence-report.signed',
        targetType: 'evidence_report',
        targetId: report.id,
        targetLabel: `${report.scope}:${report.scopeId}`,
        changedFields: ['status', 'approvedBy', 'approvedAt', 'exportHash'],
      });
      persist();
      const item = board.getWorkItem(report.scopeId as WorkItemId);
      if (item !== undefined) refreshWorkItemGates(item);
      else refreshProjectGates(report.projectId);
      return next;
    },

    exportEvidenceReport(id, format) {
      const report = snapshot.evidenceReports.find((row) => row.id === id);
      if (report === undefined) throw new GovernanceError('NOT_FOUND', `evidence report not found: ${id}`);
      if (format === 'json') return `${JSON.stringify(report.payload, null, 2)}\n`;
      return renderMarkdownReport(report);
    },

    dashboard(query) {
      return buildDashboard(query);
    },
  };

  function buildDashboard(query: GovernanceDashboardQuery): GovernanceDashboard {
    requireProject(query.projectId);
    if (query.workItemId !== undefined) requireWorkItem(query.workItemId, query.projectId);
    if (query.milestoneId !== undefined) {
      const milestone = board.getMilestone(query.milestoneId as MilestoneId);
      if (milestone === undefined || milestone.projectId !== query.projectId) {
        throw new GovernanceError('NOT_FOUND', `milestone not found: ${query.milestoneId}`);
      }
    }
    const allItems = board.listWorkItems({ projectId: query.projectId });
    const scopedItems = query.workItemId !== undefined
      ? allItems.filter((item) => item.id === query.workItemId)
      : query.milestoneId !== undefined
        ? allItems.filter((item) => item.milestoneId === query.milestoneId)
        : allItems;
    const itemIds = new Set(scopedItems.map((item) => item.id));
    const controlCoverage = service.certificationReadiness(
      query.workItemId !== undefined
        ? { projectId: query.projectId, workItemId: query.workItemId }
        : query.milestoneId !== undefined
          ? { projectId: query.projectId, milestoneId: query.milestoneId }
          : { projectId: query.projectId },
    );
    const obligations = snapshot.obligations.filter((row) => obligationInScope(row, query, itemIds));
    const riskRegister = snapshot.riskAcceptances.filter((row) => {
      if (row.projectId !== query.projectId) return false;
      if (query.workItemId !== undefined) return row.workItemId === query.workItemId;
      if (query.milestoneId !== undefined) return itemIds.has(row.workItemId);
      return true;
    });
    const scans = snapshot.securityEvidence.filter((row) => {
      if (row.projectId !== query.projectId) return false;
      if (query.workItemId !== undefined) return row.workItemId === query.workItemId;
      if (query.milestoneId !== undefined) return itemIds.has(row.workItemId);
      return true;
    });
    const reports = snapshot.evidenceReports.filter((row) => reportInScope(row, query, itemIds));
    const trustAssessments = snapshot.aiRiskAssessments.filter((row) => {
      if (row.projectId !== query.projectId) return false;
      if (query.workItemId !== undefined) return row.workItemId === query.workItemId;
      if (query.milestoneId !== undefined) return itemIds.has(row.workItemId);
      return true;
    });
    const workItems = scopedItems.map((item) => workItemDashboard(item));
    const openExceptions = collectExceptions(obligations, riskRegister, scans, workItems);
    const highRiskWorkItems = scopedItems.filter((item) => isHighRisk(item.securityClassification)).length;
    const threatModelCount = snapshot.threatModels.filter((row) => itemIds.has(row.workItemId)).length;
    const failingScans = scans.filter((row) => row.status === 'failing').length;
    const securityReady = highRiskWorkItems === 0
      || (threatModelCount >= highRiskWorkItems && failingScans === 0)
      || riskRegister.some((row) => row.area === 'security');
    const reliability = service.reliabilityReadiness(query.projectId, query.milestoneId);
    return {
      projectId: query.projectId,
      milestoneId: query.milestoneId ?? null,
      workItemId: query.workItemId ?? null,
      obligations,
      controlCoverage,
      riskRegister,
      openExceptions,
      securityReadiness: {
        ready: securityReady && failingScans === 0,
        highRiskWorkItems,
        threatModelCount,
        passingScans: scans.filter((row) => row.status === 'passing').length,
        failingScans,
      },
      reliabilityReadiness: reliability,
      trustAssessments,
      evidenceReports: reports,
      milestones: query.workItemId !== undefined
        ? []
        : board.listMilestones({ projectId: query.projectId })
          .filter((milestone) => query.milestoneId === undefined || milestone.id === query.milestoneId)
          .map((milestone) => milestoneRollup(query.projectId, milestone.id, milestone.title, allItems)),
      workItems,
    };
  }

  function obligationInScope(
    row: ComplianceObligation,
    query: GovernanceDashboardQuery,
    itemIds: ReadonlySet<WorkItemId>,
  ): boolean {
    if (row.projectId !== query.projectId) return false;
    if (query.workItemId !== undefined) {
      return row.workItemIds.length === 0 || row.workItemIds.includes(query.workItemId);
    }
    if (query.milestoneId !== undefined) {
      return row.workItemIds.length === 0 || row.workItemIds.some((id) => itemIds.has(id));
    }
    return true;
  }

  function reportInScope(
    row: EvidenceReport,
    query: GovernanceDashboardQuery,
    itemIds: ReadonlySet<WorkItemId>,
  ): boolean {
    if (row.projectId !== query.projectId) return false;
    if (query.workItemId !== undefined) {
      return row.scopeId === query.workItemId || row.scope === 'project';
    }
    if (query.milestoneId !== undefined) {
      return row.scopeId === query.milestoneId || row.scope === 'project'
        || (row.scope === 'work-item' && itemIds.has(row.scopeId as WorkItemId));
    }
    return true;
  }

  function collectExceptions(
    obligations: readonly ComplianceObligation[],
    risks: readonly ResidualRiskAcceptance[],
    scans: readonly SecurityScanEvidence[],
    workItems: readonly GovernanceWorkItemDashboard[],
  ): GovernanceOpenException[] {
    const exceptions: GovernanceOpenException[] = [];
    for (const obligation of obligations) {
      if (obligation.status === 'approved' || obligation.status === 'active' || obligation.status === 'retired') {
        continue;
      }
      exceptions.push({
        kind: 'unapproved_obligation',
        id: obligation.id,
        title: obligation.title,
        workItemId: obligation.workItemIds[0] ?? null,
        detail: `status ${obligation.status}`,
      });
    }
    for (const scan of scans) {
      if (scan.status !== 'failing') continue;
      const waived = risks.some((row) => row.workItemId === scan.workItemId && row.area === 'security');
      if (waived) continue;
      exceptions.push({
        kind: 'failing_scan',
        id: scan.id,
        title: scan.title,
        workItemId: scan.workItemId,
        detail: scan.kind,
      });
    }
    for (const item of workItems) {
      for (const missing of item.missingEvidence) {
        exceptions.push({
          kind: 'missing_check',
          id: `${item.workItemId}:${missing}`,
          title: missing,
          workItemId: item.workItemId,
          detail: item.title,
        });
      }
    }
    return exceptions;
  }

  function workItemDashboard(item: WorkItem): GovernanceWorkItemDashboard {
    const coverage = service.certificationReadiness({ projectId: item.projectId, workItemId: item.id });
    const requiredControls = coverage.controls.map((control) => ({
      controlKey: control.controlKey,
      packId: control.packId,
      packVersion: control.packVersion,
      controlId: control.controlId,
      summary: findControl(control.packId, control.packVersion, control.controlId)?.summary ?? control.controlId,
      mapped: control.mapped,
      evidenceComplete: control.evidenceComplete,
      missingEvidence: control.missingEvidence,
      workItemId: control.workItemId,
    }));
    const mappings = snapshot.mappings.filter((row) => row.workItemId === item.id);
    const mappedChecks = [...new Set(mappings.flatMap((row) => row.checkIds))];
    const summary = board.getDeliveryEvidenceSummary(item.id);
    const missingEvidence = [
      ...requiredControls.flatMap((control) => control.missingEvidence.map((kind) => `${control.controlId}:${kind}`)),
      ...summary.checks
        .filter((check) => check.required && (check.status === 'missing' || check.status === 'failing' || check.status === 'blocked'))
        .map((check) => check.title),
    ];
    const residualRisks = snapshot.riskAcceptances.filter((row) => row.workItemId === item.id);
    const obligations = snapshot.obligations.filter(
      (row) => row.projectId === item.projectId && (row.workItemIds.length === 0 || row.workItemIds.includes(item.id)),
    );
    const policy = snapshot.gatePolicies[item.projectId] ?? DEFAULT_GATE_POLICY;
    const approvalRequirements: string[] = [];
    for (const obligation of obligations) {
      if (obligation.status === 'draft') approvalRequirements.push(`request review: ${obligation.title}`);
      if (obligation.status === 'pending_review') approvalRequirements.push(`approve obligation: ${obligation.title}`);
    }
    if (policy.requireThreatModelForHighRisk && isHighRisk(item.securityClassification)
      && !snapshot.threatModels.some((row) => row.workItemId === item.id)) {
      approvalRequirements.push('threat model required');
    }
    if (policy.requireObservabilityForProduction && item.productionFacing
      && !(snapshot.slos.find((row) => row.workItemId === item.id)?.observabilityPlan.trim())) {
      approvalRequirements.push('observability plan required');
    }
    if (policy.requireProvenanceForDelivery
      && !snapshot.provenance.some((row) => row.workItemId === item.id)) {
      approvalRequirements.push('AI provenance required');
    }
    if (policy.requireAttestationForDelivery
      && !snapshot.evidenceReports.some((row) =>
        row.status === 'approved'
        && row.projectId === item.projectId
        && (row.scopeId === item.id || row.scope === 'project' || row.scopeId === item.milestoneId))) {
      approvalRequirements.push('signed evidence report required');
    }
    return {
      workItemId: item.id,
      title: item.title,
      milestoneId: item.milestoneId,
      productionFacing: item.productionFacing,
      securityClassification: item.securityClassification,
      requiredControls,
      mappedChecks,
      missingEvidence,
      residualRisks,
      approvalRequirements,
      provenance: snapshot.provenance.filter((row) => row.workItemId === item.id),
      obligations,
      threatModels: snapshot.threatModels.filter((row) => row.workItemId === item.id),
      securityEvidence: snapshot.securityEvidence.filter((row) => row.workItemId === item.id),
      slos: snapshot.slos.filter((row) => row.workItemId === item.id),
      trustAssessments: snapshot.aiRiskAssessments.filter((row) => row.workItemId === item.id),
    };
  }

  function milestoneRollup(
    projectId: ProjectId,
    milestoneId: MilestoneId,
    title: string,
    allItems: readonly WorkItem[],
  ): GovernanceMilestoneRollup {
    const items = allItems.filter((item) => item.milestoneId === milestoneId);
    const itemIds = new Set(items.map((item) => item.id));
    const coverage = service.certificationReadiness({ projectId, milestoneId });
    const unapproved = snapshot.obligations.filter((row) =>
      (row.workItemIds.length === 0 || row.workItemIds.some((id) => itemIds.has(id)))
      && row.status !== 'approved'
      && row.status !== 'active'
      && row.status !== 'retired'
      && row.projectId === projectId,
    ).length;
    const highRisk = items.filter((item) => isHighRisk(item.securityClassification));
    const securityReady = highRisk.every((item) => snapshot.threatModels.some((row) => row.workItemId === item.id))
      && !snapshot.securityEvidence.some((row) => itemIds.has(row.workItemId) && row.status === 'failing'
        && !snapshot.riskAcceptances.some((risk) => risk.workItemId === row.workItemId && risk.area === 'security'));
    const reliability = service.reliabilityReadiness(projectId, milestoneId);
    const missingChecks = items.flatMap((item) =>
      board.getDeliveryEvidenceSummary(item.id).checks.filter((check) =>
        check.required && (check.status === 'missing' || check.status === 'failing' || check.status === 'blocked'),
      ),
    ).length;
    const reports = snapshot.evidenceReports.filter((row) =>
      row.scopeId === milestoneId
      || (row.scope === 'work-item' && itemIds.has(row.scopeId as WorkItemId)),
    );
    const trustReady = items.every((item) =>
      snapshot.provenance.some((row) => row.workItemId === item.id)
      || snapshot.aiRiskAssessments.some((row) => row.workItemId === item.id)
      || !item.governanceFlags.includes('ai_output'),
    );
    return {
      milestoneId,
      title,
      workItemCount: items.length,
      complianceReady: (coverage.totalControls === 0 || coverage.ready) && unapproved === 0,
      securityReady: highRisk.length === 0 || securityReady,
      reliabilityReady: reliability.ready,
      trustReady,
      unapprovedObligations: unapproved,
      openExceptions: unapproved + missingChecks,
      draftReports: reports.filter((row) => row.status === 'draft').length,
      approvedReports: reports.filter((row) => row.status === 'approved').length,
    };
  }

  function requireItem(workItemId: WorkItemId): WorkItem {
    const item = board.getWorkItem(workItemId);
    if (item === undefined) throw new GovernanceError('NOT_FOUND', `work item not found: ${workItemId}`);
    return item;
  }

  function refreshProjectGates(projectId: ProjectId): void {
    for (const item of board.listWorkItems({ projectId })) {
      refreshWorkItemGates(item);
    }
  }

  function refreshWorkItemGates(item: WorkItem): void {
    const policy = snapshot.gatePolicies[item.projectId] ?? DEFAULT_GATE_POLICY;
    const summary = board.getDeliveryEvidenceSummary(item.id);
    let checks = [...summary.checks];
    checks = upsertCheck(checks, {
      id: 'gate:threat-model',
      area: 'security',
      title: 'Threat model',
      required: policy.requireThreatModelForHighRisk && isHighRisk(item.securityClassification),
      passing: snapshot.threatModels.some((row) => row.workItemId === item.id),
      reason: 'Configured high-risk WorkItems require a threat model.',
    });
    const failedScan = snapshot.securityEvidence.some((row) => row.workItemId === item.id && row.status === 'failing');
    const waived = snapshot.riskAcceptances.some((row) => row.workItemId === item.id && row.area === 'security');
    checks = upsertCheck(checks, {
      id: 'gate:security-evidence',
      area: 'security',
      title: 'Security evidence',
      required: policy.requireThreatModelForHighRisk && isHighRisk(item.securityClassification),
      passing: !failedScan || waived,
      reason: failedScan && !waived
        ? 'Required security evidence is failing.'
        : 'Security evidence is attached or waived.',
    });
    const observability = snapshot.slos.find((row) => row.workItemId === item.id)?.observabilityPlan.trim() ?? '';
    checks = upsertCheck(checks, {
      id: 'gate:observability',
      area: 'reliability',
      title: 'Observability plan',
      required: policy.requireObservabilityForProduction && item.productionFacing,
      passing: observability.length > 0,
      reason: 'Configured production-facing WorkItems require an observability plan.',
    });
    checks = upsertCheck(checks, {
      id: 'gate:provenance',
      area: 'trust',
      title: 'AI provenance',
      required: policy.requireProvenanceForDelivery,
      passing: snapshot.provenance.some((row) => row.workItemId === item.id),
      reason: 'Configured delivery claims require agent-run provenance.',
    });
    const attested = snapshot.evidenceReports.some((row) =>
      row.status === 'approved'
      && row.projectId === item.projectId
      && (row.scopeId === item.id || row.scope === 'project' || row.scopeId === item.milestoneId),
    );
    checks = upsertCheck(checks, {
      id: 'gate:attestation',
      area: 'trust',
      title: 'Signed evidence report',
      required: policy.requireAttestationForDelivery,
      passing: attested,
      reason: 'Configured delivery claims require an approved evidence report.',
    });
    board.updateDeliveryEvidenceSummary(item.id, { checks });
  }

  function assembleReportPayload(projectId: ProjectId, scope: EvidenceReportScope, scopeId: string): Record<string, unknown> {
    const items = scope === 'work-item'
      ? board.listWorkItems({ projectId }).filter((item) => item.id === scopeId)
      : scope === 'milestone'
        ? board.listWorkItems({ projectId, milestoneId: scopeId as MilestoneId })
        : board.listWorkItems({ projectId });
    const itemIds = new Set(items.map((item) => item.id));
    const summaries = items.map((item) => board.getDeliveryEvidenceSummary(item.id));
    const obligations = snapshot.obligations.filter((row) => row.projectId === projectId);
    const mappings = snapshot.mappings.filter((row) => row.projectId === projectId);
    const audits = board.listAuditEvents({ projectId });
    return {
      generatedAt: Date.now(),
      projectId,
      scope,
      scopeId,
      obligations,
      mappedControls: mappings,
      completedChecks: summaries.flatMap((row) => row.checks.filter((check) => check.status === 'passing' || check.status === 'waived')),
      missingChecks: summaries.flatMap((row) => row.checks.filter((check) => check.required && (check.status === 'missing' || check.status === 'failing' || check.status === 'blocked'))),
      riskAcceptances: snapshot.riskAcceptances.filter((row) => row.projectId === projectId),
      approvals: snapshot.evidenceReports.filter((row) => row.projectId === projectId && row.status === 'approved'),
      sourceCodeLinks: summaries.flatMap((row) => row.codeLinks),
      ciEvidence: summaries.flatMap((row) => row.ciRuns),
      securityEvidence: snapshot.securityEvidence.filter((row) => itemIds.has(row.workItemId) || itemIds.size === 0),
      reliabilityEvidence: snapshot.slos.filter((row) => row.projectId === projectId),
      aiProvenance: snapshot.provenance.filter((row) => row.projectId === projectId),
      auditEvents: audits,
    };
  }

  function requireObligation(id: string): ComplianceObligation {
    const found = snapshot.obligations.find((item) => item.id === id);
    if (found === undefined) throw new GovernanceError('NOT_FOUND', `obligation not found: ${id}`);
    return found;
  }

  function transitionObligation(
    id: string,
    actor: string,
    status: ComplianceObligation['status'],
    allowed: readonly ComplianceObligation['status'][],
  ): ComplianceObligation {
    const current = requireObligation(id);
    if (!allowed.includes(current.status)) {
      throw new GovernanceError(
        'NOT_READY',
        `obligation ${id} cannot move from ${current.status} to ${status}`,
      );
    }
    const next: ComplianceObligation = { ...current, status, updatedAt: Date.now() };
    snapshot = {
      ...snapshot,
      obligations: snapshot.obligations.map((item) => (item.id === id ? next : item)),
    };
    syncObligation(current, next);
    board.recordAuditEvent({
      projectId: current.projectId,
      actorId: actor,
      action: `governance.obligation.${status}`,
      targetType: 'compliance_obligation',
      targetId: current.id,
      targetLabel: current.title,
      changedFields: ['status'],
    });
    persist();
    return next;
  }

  return service;
}

export function isGovernanceImpactFlag(value: string): value is GovernanceImpactFlag {
  return (GOVERNANCE_IMPACT_FLAGS as readonly string[]).includes(value);
}

export function normalizeGovernanceFlags(values: readonly string[] | undefined): GovernanceImpactFlag[] {
  const flags = [...(values ?? [])];
  for (const flag of flags) {
    if (!isGovernanceImpactFlag(flag)) {
      throw new Error(`unknown governance impact flag: ${flag}`);
    }
  }
  return flags as GovernanceImpactFlag[];
}

function buildObligation(raw: CreateObligationInput, board: BoardService): ComplianceObligation {
  if (!OBLIGATION_KINDS.includes(raw.kind)) {
    throw new GovernanceError('VALIDATION', `unknown obligation kind: ${raw.kind}`);
  }
  for (const workItemId of raw.workItemIds ?? []) {
    const item = board.getWorkItem(workItemId);
    if (item === undefined) throw new GovernanceError('NOT_FOUND', `work item not found: ${workItemId}`);
    if (item.projectId !== raw.projectId) {
      throw new GovernanceError('VALIDATION', `work item ${workItemId} is not in project ${raw.projectId}`);
    }
  }
  const now = Date.now();
  return {
    id: randomUUID(),
    projectId: raw.projectId,
    title: requireNonBlank(raw.title, 'obligation title'),
    kind: raw.kind,
    jurisdiction: requireNonBlank(raw.jurisdiction, 'obligation jurisdiction'),
    source: requireNonBlank(raw.source, 'obligation source'),
    applicabilityReason: requireNonBlank(raw.applicabilityReason, 'obligation applicability reason'),
    owner: requireNonBlank(raw.owner, 'obligation owner'),
    reviewer: requireNonBlank(raw.reviewer, 'obligation reviewer'),
    effectiveDate: raw.effectiveDate ?? null,
    reviewDate: raw.reviewDate ?? null,
    status: 'draft',
    controlIds: [...(raw.controlIds ?? [])],
    workItemIds: [...(raw.workItemIds ?? [])],
    acceptanceCriterionIds: [...(raw.acceptanceCriterionIds ?? [])] as AcceptanceCriterionId[],
    dataCategories: [...(raw.dataCategories ?? [])],
    userRoles: [...(raw.userRoles ?? [])],
    sourceDocumentIds: [...(raw.sourceDocumentIds ?? [])],
    riskIds: [...(raw.riskIds ?? [])],
    checkIds: [...(raw.checkIds ?? [])],
    evidenceIds: [...(raw.evidenceIds ?? [])],
    approvedAt: null,
    approvedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

function toSummary(obligation: ComplianceObligation): GovernanceObligationSummary {
  return {
    id: obligation.id,
    title: obligation.title,
    jurisdiction: obligation.jurisdiction,
    source: obligation.source,
    status: obligation.status,
    owner: obligation.owner,
    reviewer: obligation.reviewer,
    effectiveDate: obligation.effectiveDate,
    reviewDate: obligation.reviewDate,
    controlIds: [...obligation.controlIds],
    links: obligation.evidenceIds.map((id) => ({
      kind: 'compliance-obligation' as const,
      id,
      label: obligation.title,
      url: null,
      acceptanceCriterionIds: [],
    })),
  };
}

function scopedWorkItems(board: BoardService, query: CertificationReadinessQuery) {
  if (query.workItemId !== undefined) {
    const item = board.getWorkItem(query.workItemId);
    if (item === undefined) throw new GovernanceError('NOT_FOUND', `work item not found: ${query.workItemId}`);
    return [item];
  }
  if (query.milestoneId !== undefined) {
    return board.listWorkItems({ projectId: query.projectId, milestoneId: query.milestoneId as MilestoneId });
  }
  return board.listWorkItems({ projectId: query.projectId });
}

function missingEvidence(
  definition: ControlDefinition,
  mapping: ControlMapping,
  board: BoardService,
): readonly ControlEvidenceKind[] {
  const summary = board.getDeliveryEvidenceSummary(mapping.workItemId);
  const missing: ControlEvidenceKind[] = [];
  for (const kind of definition.requiredEvidence) {
    if (kind === 'code' && (mapping.codeEvidenceIds.length > 0 || summary.codeLinks.length > 0)) continue;
    if (kind === 'ci' && (mapping.ciReportIds.length > 0 || summary.ciRuns.length > 0)) continue;
    if (kind === 'check' && (
      mapping.checkIds.length > 0
      || summary.checks.some((check) => check.status === 'passing' || check.status === 'waived')
    )) continue;
    if (kind === 'approval' && mapping.approvalIds.length > 0) continue;
    if (kind === 'audit' && mapping.auditEventIds.length > 0) continue;
    missing.push(kind);
  }
  return missing;
}

function requireNonBlank(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new GovernanceError('VALIDATION', `${label} is required`);
  return trimmed;
}

function requirePackedId(value: string, label: string): string {
  const trimmed = requireNonBlank(value, label);
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new GovernanceError('VALIDATION', `${label} must be a dotted token`);
  }
  return trimmed;
}

function normalizeEvidenceKinds(values: readonly string[] | undefined): ControlEvidenceKind[] {
  const kinds = [...(values ?? [])];
  for (const kind of kinds) {
    if (!(CONTROL_EVIDENCE_KINDS as readonly string[]).includes(kind)) {
      throw new GovernanceError('VALIDATION', `unknown required evidence kind: ${kind}`);
    }
  }
  return kinds as ControlEvidenceKind[];
}

function isHighRisk(classification: SecurityClassification): boolean {
  return Object.values(classification).some((level) => level === 'high' || level === 'critical');
}

function upsertCheck(
  checks: readonly DeliveryEvidenceCheck[],
  spec: {
    readonly id: string;
    readonly area: DeliveryEvidenceCheck['area'];
    readonly title: string;
    readonly required: boolean;
    readonly passing: boolean;
    readonly reason: string;
  },
): DeliveryEvidenceCheck[] {
  const others = checks.filter((check) => check.id !== spec.id);
  if (!spec.required) return [...others];
  return [
    ...others,
    {
      id: spec.id,
      area: spec.area,
      title: spec.title,
      status: spec.passing ? 'passing' : 'missing',
      required: true,
      reason: spec.reason,
      evidenceIds: [],
      acceptanceCriterionIds: [],
      links: [],
      producer: 'manual',
      executionKind: 'manual',
      designRevision: '',
    },
  ];
}

function renderMarkdownReport(report: EvidenceReport): string {
  const payload = report.payload;
  const lines = [
    `# Evidence report (${report.scope})`,
    '',
    `- Project: ${report.projectId}`,
    `- Scope id: ${report.scopeId}`,
    `- Status: ${report.status}`,
    `- Created: ${String(report.createdAt)}`,
    `- Actor: ${report.createdBy}`,
    `- Source version: ${report.sourceDataVersion}`,
    `- Hash: ${report.exportHash}`,
    '',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
    '',
  ];
  return lines.join('\n');
}
