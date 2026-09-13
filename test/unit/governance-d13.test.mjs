import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentRuntime } from '../../lib/host/agents/runtime.js';
import { createRequirementManagementService } from '../../lib/host/agile/requirements.js';
import { createBoardService } from '../../lib/host/board/plugin.js';
import { createGovernanceService } from '../../lib/host/governance/service.js';
import { createSkillService } from '../../lib/host/skills/service.js';
import { createPbkdf2PasswordHash } from '../../lib/host/web/auth.js';
import { createWebService } from '../../lib/host/web/server.js';

const HIGH = {
  securityImpact: 'high',
  dataSensitivity: 'high',
  permissionImpact: 'medium',
  exposedApiSurface: 'high',
  dependencyRisk: 'low',
  deploymentRisk: 'medium',
};

const SCAN_KINDS = [
  'test',
  'code-review',
  'dependency-scan',
  'secret-scan',
  'static-analysis',
  'dynamic-test',
  'manual-review',
];

const REPORT_SCOPES = ['project', 'milestone', 'work-item', 'release', 'certification'];

function passwordHash() {
  return createPbkdf2PasswordHash('correct-password', {
    iterations: 1_000,
    salt: new Uint8Array(16).fill(13),
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'huntianling-d13-'));
  const board = createBoardService(root);
  const project = board.createProject({ name: 'p' });
  const governance = createGovernanceService({ board, workspaceRoot: root });
  const skills = createSkillService();
  const agents = createAgentRuntime({ skills, board, governance });
  return { root, board, project, governance, agents };
}

function story(board, project, extras = {}) {
  return board.createWorkItem({
    projectId: project.id,
    type: 'story',
    status: 'verifying',
    title: '登录',
    body: '客户能登录',
    analysis: '需要登录',
    design: '表单',
    acceptance: ['可登录'],
    ...extras,
  });
}

test('WorkItems can be classified by security impact, data sensitivity, permission impact, exposed API surface, dependency risk, and deployment risk', () => {
  const { board, project } = setup();
  const item = story(board, project, { securityClassification: HIGH, productionFacing: true });
  assert.deepEqual(item.securityClassification, HIGH);
  assert.equal(item.productionFacing, true);
  const updated = board.updateWorkItem(item.id, {
    securityClassification: { ...HIGH, deploymentRisk: 'critical' },
  });
  assert.equal(updated.securityClassification.deploymentRisk, 'critical');
  assert.throws(
    () => board.updateWorkItem(item.id, {
      securityClassification: { ...HIGH, securityImpact: 'extreme' },
    }),
    /unknown securityImpact risk level/,
  );
});

test('configured high-risk WorkItems require a threat model before delivery', () => {
  const { board, project, governance } = setup();
  const item = story(board, project, { securityClassification: HIGH });
  governance.configureGatePolicy(project.id, { requireThreatModelForHighRisk: true }, 'dev');
  const inspection = board.inspectDeliveryGates(item.id, 'delivered');
  assert.equal(inspection.allowed, false);
  assert.ok(inspection.missing.some((row) => row.message.includes('Threat model')));
  governance.recordThreatModel({
    workItemId: item.id,
    summary: 'Login token theft',
    assets: ['session'],
    threats: ['token theft'],
    mitigations: ['httpOnly cookie'],
    actor: 'dev',
  });
  const checks = board.getDeliveryEvidenceSummary(item.id).checks;
  assert.equal(checks.find((check) => check.id === 'gate:threat-model')?.status, 'passing');
});

test('security evidence can be ingested from tests, code review, dependency scans, secret scans, static analysis, dynamic tests, and manual reviews', () => {
  const { board, project, governance } = setup();
  const item = story(board, project);
  for (const kind of SCAN_KINDS) {
    const recorded = governance.ingestSecurityEvidence({
      workItemId: item.id,
      kind,
      title: kind,
      status: 'passing',
      source: kind,
      actor: 'dev',
    });
    assert.equal(recorded.kind, kind);
  }
});

test('missing required security controls or evidence block delivery when configured', () => {
  const { board, project, governance } = setup();
  const item = story(board, project, { securityClassification: HIGH });
  governance.configureGatePolicy(project.id, { requireThreatModelForHighRisk: true }, 'dev');
  governance.recordThreatModel({ workItemId: item.id, summary: 'model', actor: 'dev' });
  governance.ingestSecurityEvidence({
    workItemId: item.id,
    kind: 'secret-scan',
    title: 'secrets',
    status: 'failing',
    findings: ['aws key'],
    actor: 'ci',
  });
  const inspection = board.inspectDeliveryGates(item.id, 'delivered');
  assert.ok(inspection.missing.some((row) => row.message.includes('Security evidence')));
});

test('residual risk acceptance records approver, reason, scope, expiration, and compensating controls', () => {
  const { board, project, governance } = setup();
  const item = story(board, project, { securityClassification: HIGH });
  governance.configureGatePolicy(project.id, { requireThreatModelForHighRisk: true }, 'dev');
  governance.recordThreatModel({ workItemId: item.id, summary: 'model', actor: 'dev' });
  governance.ingestSecurityEvidence({
    workItemId: item.id,
    kind: 'secret-scan',
    title: 'secrets',
    status: 'failing',
    actor: 'ci',
  });
  const acceptance = governance.recordRiskAcceptance({
    workItemId: item.id,
    area: 'security',
    title: 'Temporary scanner waiver',
    approver: 'security-lead',
    reason: 'scanner false positive',
    scope: 'login story only',
    expiration: 99,
    compensatingControls: ['manual review'],
  });
  assert.equal(acceptance.approver, 'security-lead');
  assert.equal(acceptance.reason, 'scanner false positive');
  assert.equal(acceptance.scope, 'login story only');
  assert.equal(acceptance.expiration, 99);
  assert.deepEqual(acceptance.compensatingControls, ['manual review']);
  const stored = board.getDeliveryEvidenceSummary(item.id).riskAcceptances[0];
  assert.equal(stored.scope, 'login story only');
  assert.equal(board.getDeliveryEvidenceSummary(item.id).checks.find((check) => check.id === 'gate:security-evidence')?.status, 'passing');
});

test('a project can store SLOs with availability, latency, error budget, capacity, backup, restore, and dependency assumptions', () => {
  const { project, governance } = setup();
  const slo = governance.recordSlo({
    projectId: project.id,
    name: 'login availability',
    availabilityTarget: '99.9%',
    latencyTarget: '200ms',
    errorBudget: '43m/month',
    capacityAssumptions: '2 replicas',
    backupRequirements: 'daily',
    restoreObjective: '1h',
    dependencyAssumptions: 'auth provider',
    actor: 'sre',
  });
  assert.equal(slo.availabilityTarget, '99.9%');
  assert.equal(slo.latencyTarget, '200ms');
  assert.equal(slo.errorBudget, '43m/month');
  assert.equal(slo.capacityAssumptions, '2 replicas');
  assert.equal(slo.backupRequirements, 'daily');
  assert.equal(slo.restoreObjective, '1h');
  assert.equal(slo.dependencyAssumptions, 'auth provider');
});

test('configured production-facing WorkItems require an observability plan before delivery', () => {
  const { board, project, governance } = setup();
  const item = story(board, project, { productionFacing: true });
  governance.configureGatePolicy(project.id, { requireObservabilityForProduction: true }, 'dev');
  assert.ok(board.inspectDeliveryGates(item.id, 'delivered').missing.some((row) => row.message.includes('Observability plan')));
  governance.recordObservabilityPlan(item.id, 'metrics, logs, traces', 'sre');
  assert.equal(board.getDeliveryEvidenceSummary(item.id).checks.find((check) => check.id === 'gate:observability')?.status, 'passing');
});

test('reliability readiness rolls up to Project and Milestone views', () => {
  const { board, project, governance } = setup();
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const item = story(board, project, { productionFacing: true, milestoneId: milestone.id });
  governance.configureGatePolicy(project.id, { requireObservabilityForProduction: true }, 'dev');
  const before = governance.reliabilityReadiness(project.id, milestone.id);
  assert.equal(before.ready, false);
  assert.equal(before.productionFacingMissingObservability, 1);
  governance.recordObservabilityPlan(item.id, 'dashboards', 'sre');
  const after = governance.reliabilityReadiness(project.id);
  assert.equal(after.ready, true);
  assert.equal(governance.reliabilityReadiness(project.id, milestone.id).ready, true);
});

test('agent-run provenance records source inputs, model identity, skill versions, tool calls, output, and verification', () => {
  const { board, project, agents, governance } = setup();
  const item = story(board, project);
  const run = agents.startRun({
    agentId: 'planner',
    executor: 'manual',
    projectId: project.id,
    workItemId: item.id,
    input: {
      quotes: [{ text: '客户能登录', source: 'customer' }],
      goal: 'Customer can log in',
      actors: ['customer'],
      confirmed: true,
      acceptance: ['可登录'],
    },
  });
  const provenance = governance.getRunProvenance(run.id);
  assert.ok(provenance);
  assert.ok(provenance.sourceInputs.includes('客户能登录'));
  assert.match(provenance.modelIdentity, /manual:planner/);
  assert.ok(provenance.skillVersions.length > 0);
  assert.ok(provenance.generatedOutput.includes('Customer can log in') || provenance.generatedOutput.length > 0);
  assert.ok(Array.isArray(provenance.toolCalls));
  assert.ok(Array.isArray(provenance.verificationEvidence));
});

test('AI-generated analysis records confidence, assumptions, limitations, and open questions', () => {
  const { project, governance } = setup();
  const provenance = governance.recordAgentProvenance({
    runId: 'run-ai',
    projectId: project.id,
    sourceInputs: ['raw need'],
    modelIdentity: 'manual:planner',
    generatedOutput: '{}',
    confidence: 'medium',
    assumptions: ['session cookies'],
    limitations: ['no SSO'],
    openQuestions: ['MFA?'],
  });
  assert.equal(provenance.confidence, 'medium');
  assert.deepEqual(provenance.assumptions, ['session cookies']);
  assert.deepEqual(provenance.limitations, ['no SSO']);
  assert.deepEqual(provenance.openQuestions, ['MFA?']);
});

test('missing provenance blocks automated delivery claims when configured', () => {
  const { board, project, governance } = setup();
  const item = story(board, project);
  governance.configureGatePolicy(project.id, { requireProvenanceForDelivery: true }, 'dev');
  assert.ok(board.inspectDeliveryGates(item.id, 'delivered').missing.some((row) => row.message.includes('provenance')));
  governance.recordAgentProvenance({
    runId: 'run-1',
    projectId: project.id,
    workItemId: item.id,
    modelIdentity: 'manual:planner',
    generatedOutput: '{}',
  });
  assert.equal(board.getDeliveryEvidenceSummary(item.id).checks.find((check) => check.id === 'gate:provenance')?.status, 'passing');
});

test('evidence reports cover Project, Milestone, WorkItem, release, and certification scopes', () => {
  const { board, project, governance } = setup();
  const milestone = board.createMilestone({ projectId: project.id, title: 'M1' });
  const item = story(board, project, { milestoneId: milestone.id });
  for (const scope of REPORT_SCOPES) {
    const report = governance.createEvidenceReport({
      projectId: project.id,
      scope,
      scopeId: scope === 'work-item' ? item.id : scope === 'milestone' ? milestone.id : project.id,
      actor: 'dev',
    });
    assert.equal(report.scope, scope);
    assert.equal(report.status, 'draft');
    assert.ok(report.payload.obligations);
    assert.ok(report.payload.mappedControls);
    assert.ok(report.payload.completedChecks);
    assert.ok(report.payload.missingChecks);
    assert.ok(report.payload.riskAcceptances);
    assert.ok(report.payload.sourceCodeLinks);
    assert.ok(report.payload.ciEvidence);
    assert.ok(report.payload.securityEvidence);
    assert.ok(report.payload.reliabilityEvidence);
    assert.ok(report.payload.aiProvenance);
    assert.ok(report.payload.auditEvents);
  }
});

test('reports stay draft until a human owner approves them and snapshots include timestamp, actor, source version, and export hash', () => {
  const { project, governance } = setup();
  const report = governance.createEvidenceReport({
    projectId: project.id,
    scope: 'project',
    actor: 'dev',
  });
  assert.equal(report.status, 'draft');
  assert.equal(report.approvedAt, null);
  assert.ok(report.createdAt > 0);
  assert.equal(report.createdBy, 'dev');
  assert.ok(report.sourceDataVersion);
  assert.equal(report.exportHash.length, 64);
  const approved = governance.approveEvidenceReport(report.id, 'owner');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approvedBy, 'owner');
  assert.ok(approved.approvedAt);
});

test('reports export as JSON and Markdown', () => {
  const { project, governance } = setup();
  const report = governance.createEvidenceReport({
    projectId: project.id,
    scope: 'certification',
    actor: 'dev',
  });
  const jsonBody = governance.exportEvidenceReport(report.id, 'json');
  assert.match(jsonBody, /"scope": "certification"/);
  const markdown = governance.exportEvidenceReport(report.id, 'markdown');
  assert.match(markdown, /# Evidence report/);
  assert.match(markdown, /Hash:/);
});

test('customers cannot record threat models, risk acceptances, or approve attestations', async (t) => {
  const { board, project, governance } = setup();
  const item = story(board, project);
  const hash = passwordHash();
  const web = createWebService(
    { board, requirements: createRequirementManagementService(board), governance },
    {
      autoStart: false,
      host: '127.0.0.1',
      port: 0,
      auth: {
        enabled: true,
        sessionTtlMs: 60_000,
        users: [
          { username: 'dev', passwordHash: hash, audience: 'developer' },
          { username: 'cust', passwordHash: hash, audience: 'customer', projectIds: [project.id] },
        ],
      },
    },
  );
  t.after(() => web.stop());
  const status = await web.start();
  const customerLogin = await json(`${status.url}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cust', password: 'correct-password' }),
  });
  const cookie = customerLogin.response.headers.get('set-cookie')?.split(';')[0];
  const deniedThreat = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(item.id)}/security/threat-model`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ summary: 'no' }),
    },
  );
  assert.equal(deniedThreat.response.status, 403);
  const deniedRisk = await json(
    `${status.url}/api/v1/work-items/${encodeURIComponent(item.id)}/security/risk-acceptance`,
    {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'waiver',
        approver: 'x',
        reason: 'y',
        scope: 'z',
      }),
    },
  );
  assert.equal(deniedRisk.response.status, 403);
  const report = governance.createEvidenceReport({ projectId: project.id, scope: 'project', actor: 'dev' });
  const deniedApprove = await json(
    `${status.url}/api/v1/evidence-reports/${encodeURIComponent(report.id)}/approve`,
    { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({}) },
  );
  assert.equal(deniedApprove.response.status, 403);
});
